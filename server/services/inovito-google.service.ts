import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { loadEnv, resolveUrls } from "../config/env.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";

export const GOOGLE_READ_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/tasks.readonly",
  "https://www.googleapis.com/auth/gmail.metadata",
] as const;

const MAX_STATE_AGE_MS = 10 * 60_000;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleCredentials {
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
}

interface StatePayload {
  exp: number;
  nonce: string;
  sessionId: string;
  userId: string;
}

function hmac(value: string, key: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

export function makeGoogleState(
  userId: string,
  sessionId: string,
  secret: string,
  now = Date.now()
): string {
  const payload: StatePayload = {
    exp: now + MAX_STATE_AGE_MS,
    nonce: randomBytes(18).toString("base64url"),
    sessionId,
    userId,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return data + "." + hmac(data, secret).toString("base64url");
}

export function verifyGoogleState(
  state: string,
  userId: string,
  sessionId: string,
  secret: string,
  now = Date.now()
): StatePayload | null {
  if (state.length > 1024) {
    return null;
  }
  const parts = state.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }
  const expected = hmac(parts[0], secret);
  const received = Buffer.from(parts[1], "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as StatePayload;
    if (
      data.userId !== userId ||
      data.sessionId !== sessionId ||
      typeof data.nonce !== "string" ||
      data.nonce.length < 12 ||
      typeof data.exp !== "number" ||
      data.exp < now ||
      data.exp > now + MAX_STATE_AGE_MS
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function googlePkceVerifier(nonce: string, secret: string): string {
  return hmac("google-pkce:" + nonce, secret).toString("base64url");
}

function connectionConfig() {
  const env = loadEnv();
  const { apiUrl } = resolveUrls(env);
  const clientId = process.env.INOVITO_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.INOVITO_GOOGLE_CLIENT_SECRET;
  const url = new URL(apiUrl || "http://localhost:4000");
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return null;
  }
  if (!(clientId && clientSecret) || env.DEMO_MODE || process.env.OFICINAOS_SANDBOX === "true") {
    return null;
  }
  return {
    clientId,
    clientSecret,
    redirectUri: url.origin + "/api/inovito/google/callback",
    stateSecret: env.BETTER_AUTH_SECRET,
  };
}

export function googleIsConfigured(): boolean {
  return connectionConfig() !== null;
}

export function createGoogleAuthorizeUrl(userId: string, sessionId: string): string | null {
  const config = connectionConfig();
  if (!config) {
    return null;
  }
  const state = makeGoogleState(userId, sessionId, config.stateSecret);
  const payload = JSON.parse(Buffer.from(state.split(".")[0], "base64url").toString()) as StatePayload;
  const verifier = googlePkceVerifier(payload.nonce, config.stateSecret);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", GOOGLE_READ_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  return url.toString();
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

async function requestGoogleToken(params: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error("Google authorization failed");
  }
  return (await response.json()) as TokenResponse;
}

export async function exchangeGoogleCode(
  code: string,
  state: string,
  userId: string,
  sessionId: string
): Promise<{ credentials: string; scopes: string }> {
  const config = connectionConfig();
  if (!config) {
    throw new Error("Google OAuth not configured");
  }
  const payload = verifyGoogleState(state, userId, sessionId, config.stateSecret);
  if (!payload || !code || code.length > 2048) {
    throw new Error("Invalid Google OAuth response");
  }
  const token = await requestGoogleToken(new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: googlePkceVerifier(payload.nonce, config.stateSecret),
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  }));
  if (!(token.access_token && token.refresh_token)) {
    throw new Error("No offline access granted by Google");
  }
  const grantedScopes = new Set((token.scope ?? "").split(/\s+/));
  if (!GOOGLE_READ_SCOPES.every((scope) => grantedScopes.has(scope))) {
    throw new Error("Not all Google read-only permissions were granted");
  }
  const credentials: GoogleCredentials = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  };
  return { credentials: encryptSecret(JSON.stringify(credentials)), scopes: GOOGLE_READ_SCOPES.join(" ") };
}

export async function googleAccessToken(encrypted: string): Promise<{
  accessToken: string;
  updatedCredentials: string | null;
}> {
  const config = connectionConfig();
  if (!config) {
    throw new Error("Google OAuth not configured");
  }
  const parsed = JSON.parse(decryptSecret(encrypted)) as GoogleCredentials;
  if (!parsed.refreshToken) {
    throw new Error("Google session missing");
  }
  if (parsed.accessToken && Date.now() < parsed.expiresAt - 60_000) {
    return { accessToken: parsed.accessToken, updatedCredentials: null };
  }
  const token = await requestGoogleToken(new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: parsed.refreshToken,
    grant_type: "refresh_token",
  }));
  if (!token.access_token) {
    throw new Error("Google token refresh failed");
  }
  const next: GoogleCredentials = {
    accessToken: token.access_token,
    refreshToken: parsed.refreshToken,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  };
  return { accessToken: next.accessToken, updatedCredentials: encryptSecret(JSON.stringify(next)) };
}

async function googleGet(url: URL, accessToken: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { authorization: "Bearer " + accessToken },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error("Google read request failed");
  }
  return response.json();
}

export interface GoogleOverview {
  calendar: Array<{ start: string; title: string }>;
  googleTasks: Array<{ due: string | null; title: string }>;
  unreadMailEstimate: number | null;
}

interface GoogleCalendarData {
  items?: Array<{ summary?: string; start?: { dateTime?: string; date?: string } }>;
}
interface GoogleListsData {
  items?: Array<{ id?: string; title?: string }>;
}
interface GoogleTasksData {
  items?: Array<{ title?: string; due?: string; status?: string }>;
}
interface GoogleMailData {
  resultSizeEstimate?: number;
}

export async function fetchGoogleOverview(accessToken: string): Promise<GoogleOverview> {
  const eventsUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  eventsUrl.searchParams.set("timeMin", new Date().toISOString());
  eventsUrl.searchParams.set("maxResults", "8");
  eventsUrl.searchParams.set("singleEvents", "true");
  eventsUrl.searchParams.set("orderBy", "startTime");
  const listsUrl = new URL("https://tasks.googleapis.com/tasks/v1/users/@me/lists");
  listsUrl.searchParams.set("maxResults", "10");
  const mailUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  mailUrl.searchParams.set("maxResults", "10");
  mailUrl.searchParams.set("q", "is:unread");

  const [events, lists, mail] = await Promise.all([
    googleGet(eventsUrl, accessToken) as Promise<GoogleCalendarData>,
    googleGet(listsUrl, accessToken) as Promise<GoogleListsData>,
    googleGet(mailUrl, accessToken) as Promise<GoogleMailData>,
  ]);
  const firstList = lists.items?.find((item) => item.id);
  let tasks: GoogleTasksData = {};
  if (firstList?.id) {
    const taskUrl = new URL("https://tasks.googleapis.com/tasks/v1/lists/" + encodeURIComponent(firstList.id) + "/tasks");
    taskUrl.searchParams.set("maxResults", "8");
    taskUrl.searchParams.set("showCompleted", "false");
    tasks = (await googleGet(taskUrl, accessToken)) as GoogleTasksData;
  }
  return {
    calendar: (events.items ?? []).slice(0, 8).map((event) => ({
      title: event.summary ?? "Evento sem título",
      start: event.start?.dateTime ?? event.start?.date ?? "",
    })),
    googleTasks: (tasks.items ?? [])
      .filter((task) => task.status !== "completed")
      .slice(0, 8)
      .map((task) => ({ title: task.title ?? "Tarefa sem título", due: task.due ?? null })),
    unreadMailEstimate: typeof mail.resultSizeEstimate === "number" ? mail.resultSizeEstimate : null,
  };
}
