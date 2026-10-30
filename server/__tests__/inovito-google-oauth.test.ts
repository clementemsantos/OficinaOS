import { describe, expect, it } from "vitest";
import {
  GOOGLE_READ_SCOPES,
  googlePkceVerifier,
  makeGoogleState,
  verifyGoogleState,
} from "../services/inovito-google.service";

describe("Inovito Google OAuth — proteção de ligação", () => {
  const secret = "test-secret-long-enough-and-not-production";
  const fixed = 1_790_000_000_000;

  it("vincula o estado à sessão e ao utilizador com validade curta", () => {
    const state = makeGoogleState("owner-1", "session-1", secret, fixed);
    expect(verifyGoogleState(state, "owner-1", "session-1", secret, fixed)).not.toBeNull();
    expect(verifyGoogleState(state, "owner-2", "session-1", secret, fixed)).toBeNull();
    expect(verifyGoogleState(state, "owner-1", "session-2", secret, fixed)).toBeNull();
    expect(verifyGoogleState(state, "owner-1", "session-1", secret, fixed + 600_001)).toBeNull();
  });

  it("rejeita assinatura adulterada", () => {
    const state = makeGoogleState("owner-1", "session-1", secret, fixed);
    const [payload] = state.split(".");
    const bad = payload + "." + "A".repeat(43);
    expect(verifyGoogleState(bad, "owner-1", "session-1", secret, fixed)).toBeNull();
    expect(verifyGoogleState("x", "owner-1", "session-1", secret, fixed)).toBeNull();
  });

  it("deriva uma chave PKCE determinística sem revelar segredos", () => {
    const verifier = googlePkceVerifier("nonce-1", secret);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(googlePkceVerifier("nonce-2", secret)).not.toBe(verifier);
  });

  it("solicita apenas permissões Google de leitura", () => {
    expect(GOOGLE_READ_SCOPES).toEqual([
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/tasks.readonly",
      "https://www.googleapis.com/auth/gmail.metadata",
    ]);
  });
});
