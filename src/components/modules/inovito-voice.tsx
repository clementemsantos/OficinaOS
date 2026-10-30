import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { OwnerDashboardDTO } from "@shared/types/dashboard";
import { can } from "@/hooks/use-can";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import {
  isVoiceHelpRequest,
  matchVoiceDestination,
  normalizeVoice,
  parseVoiceInput,
} from "@/lib/inovito-voice-commands";
import { NAV_ITEMS } from "@/lib/navigation";
import {
  formatOwnerSummary,
  isOwnerSummaryRequest,
} from "@/lib/inovito-owner-summary";
import { useAuthStore } from "@/stores/auth";

interface VoiceResult {
  0: { transcript: string };
  isFinal: boolean;
}

interface VoiceEvent {
  resultIndex: number;
  results: ArrayLike<VoiceResult>;
}

interface BrowserSpeechRecognition {
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: VoiceEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechConstructor = new () => BrowserSpeechRecognition;

const GREETING_PATTERN = /\b(bom dia|boa tarde|boa noite|ola)\b/;

function recognitionConstructor(): SpeechConstructor | undefined {
  const browser = window as Window & {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

/**
 * Experiência opt-in: só navega para secções que a sessão pode abrir.
 * A escuta só funciona com a página aberta, HTTPS/localhost e API suportada.
 * Sem armazenamento ou envio próprio de gravações (o browser pode usar serviço externo).
 */
export default function InovitoVoice() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const [enabled, setEnabled] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [typedCommand, setTypedCommand] = useState("");
  const [status, setStatus] = useState("Desligado");
  const [feedback, setFeedback] = useState(
    "Carrega em «Falar» e diz, por exemplo, «resumo da loja»."
  );
  const recognizerRef = useRef<BrowserSpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const awakeUntilRef = useRef(0);
  const restartTimerRef = useRef<number | undefined>(undefined);
  const awakeTimerRef = useRef<number | undefined>(undefined);

  const startRecognition = useCallback(() => {
    if (
      !listeningRef.current ||
      speakingRef.current ||
      document.visibilityState === "hidden"
    ) {
      return;
    }
    try {
      recognizerRef.current?.start();
      setStatus("À escuta de «Inovito»");
    } catch {
      // Pode já estar a arrancar: o próximo onend trata do reinício.
    }
  }, []);

  const speak = useCallback(
    (message: string) => {
      setFeedback(message);
      if (!("speechSynthesis" in window)) {
        if (!continuousMode) {
          listeningRef.current = false;
          setEnabled(false);
        }
        return;
      }
      window.speechSynthesis.cancel();
      speakingRef.current = true;
      recognizerRef.current?.stop();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = "pt-PT";
      const resume = () => {
        speakingRef.current = false;
        if (continuousMode) {
          startRecognition();
        } else {
          listeningRef.current = false;
          setEnabled(false);
          setStatus("Microfone desligado");
        }
      };
      utterance.onend = resume;
      utterance.onerror = resume;
      window.speechSynthesis.speak(utterance);
    },
    [continuousMode, startRecognition]
  );

  const handleSpokenCommand = useCallback(
    (spoken: string) => {
      const command = normalizeVoice(spoken);
      if (isOwnerSummaryRequest(command)) {
        if (!can(role, { dashboard: ["viewOwner"] })) {
          speak("O resumo completo da loja só está disponível para o proprietário.");
          return;
        }
        api
          .get<OwnerDashboardDTO>("/dashboard/owner")
          .then((response) => {
            speak(formatOwnerSummary(response.data));
          })
          .catch(() => {
            speak(
              "Não consegui consultar os indicadores da loja. Tenta novamente mais tarde."
            );
          });
        return;
      }
      const route = matchVoiceDestination(command);
      if (route) {
        const destination = NAV_ITEMS.find((item) => item.to === route);
        if (!(destination && can(role, destination.perm))) {
          speak("Não tens permissão para abrir essa área.");
          return;
        }
        navigate(route);
        speak("A abrir a secção pedida.");
        return;
      }

      if (isVoiceHelpRequest(command)) {
        speak(
          "Podes pedir para abrir tarefas, reparações, encomendas, clientes, stock, relatórios ou o painel."
        );
        return;
      }
      if (GREETING_PATTERN.test(command)) {
        speak("Olá! Estou pronto para te ajudar a navegar pelo OficinaOS.");
        return;
      }
      speak(
        "Ainda não sei executar esse pedido. Pede ajuda para ouvir os comandos disponíveis."
      );
    },
    [navigate, role, speak]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!window.isSecureContext) {
      setFeedback(
        "Para usar o microfone, abre o OficinaOS por HTTPS ou localhost."
      );
      setStatus("É necessária uma ligação segura");
      setEnabled(false);
      return;
    }
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setFeedback("O reconhecimento de voz não é suportado neste navegador.");
      setStatus("Navegador incompatível");
      setEnabled(false);
      return;
    }

    const recognizer = new Constructor();
    recognizer.lang = "pt-PT";
    recognizer.continuous = continuousMode;
    recognizer.interimResults = false;
    recognizerRef.current = recognizer;
    listeningRef.current = true;

    recognizer.onresult = (event) => {
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        if (!result?.isFinal) {
          continue;
        }
        const heard = parseVoiceInput(
          result[0]?.transcript ?? "",
          !continuousMode || Date.now() < awakeUntilRef.current
        );
        if (heard.kind === "ignore") {
          continue;
        }
        if (heard.kind === "wake" && !continuousMode) {
          speak("Pede o comando completo depois de carregar em falar.");
        } else if (heard.kind === "wake") {
          awakeUntilRef.current = Date.now() + 15_000;
          window.clearTimeout(awakeTimerRef.current);
          awakeTimerRef.current = window.setTimeout(() => {
            awakeUntilRef.current = 0;
            setStatus("À escuta de «Inovito»");
          }, 15_000);
          setStatus("Pronto para o comando");
          speak("Sim, estou a ouvir.");
        } else {
          awakeUntilRef.current = 0;
          window.clearTimeout(awakeTimerRef.current);
          handleSpokenCommand(heard.text);
        }
        return;
      }
    };

    recognizer.onerror = (event) => {
      if (
        [
          "not-allowed",
          "service-not-allowed",
          "audio-capture",
          "network",
          "language-not-supported",
        ].includes(event.error)
      ) {
        listeningRef.current = false;
        setFeedback(
          "O microfone ou o serviço de reconhecimento não está disponível. Verifica as permissões, o navegador e a ligação."
        );
        setStatus("Escuta interrompida");
        setEnabled(false);
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setStatus("Reconhecimento temporariamente indisponível");
        setFeedback(
          "O serviço de reconhecimento falhou. Verifica a ligação ou usa o botão para desligar."
        );
      }
    };

    recognizer.onend = () => {
      if (!listeningRef.current || speakingRef.current) {
        return;
      }
      if (!continuousMode) {
        listeningRef.current = false;
        setEnabled(false);
        setStatus("Microfone desligado");
        return;
      }
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = window.setTimeout(startRecognition, 600);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        listeningRef.current = false;
        recognizer.abort();
        setEnabled(false);
        setStatus("Microfone desligado: separador em segundo plano");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    startRecognition();

    return () => {
      listeningRef.current = false;
      awakeUntilRef.current = 0;
      speakingRef.current = false;
      window.clearTimeout(restartTimerRef.current);
      window.clearTimeout(awakeTimerRef.current);
      recognizer.onend = null;
      recognizer.onresult = null;
      recognizer.onerror = null;
      recognizer.abort();
      recognizerRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [continuousMode, enabled, handleSpokenCommand, speak, startRecognition]);

  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    []
  );

  return (
    <aside
      aria-label="Assistente Inovito por voz"
      className="fixed right-4 bottom-20 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-xl"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-bold text-on-surface text-sm">Inovito · Voz</p>
          <p aria-live="polite" className="text-on-surface-variant text-xs">
            {status}
          </p>
        </div>
        <button
          aria-label={
            enabled
              ? "Desligar o microfone do Inovito"
              : continuousMode
                ? "Ativar escuta experimental"
                : "Falar com o Inovito"
          }
          aria-pressed={enabled}
          className={
            enabled
              ? "min-h-11 rounded-xl bg-error-container px-3 text-on-error-container text-sm"
              : "min-h-11 rounded-xl bg-primary px-3 text-on-primary text-sm"
          }
          onClick={() => {
            setEnabled((current) => !current);
            if (enabled) {
              setStatus("Desligado");
              setFeedback("O microfone está desligado.");
            }
          }}
          type="button"
        >
          {enabled ? "Desligar" : continuousMode ? "Ativar escuta" : "Falar"}
        </button>
      </div>
      <button
        aria-pressed={continuousMode}
        className="mt-2 w-full text-left text-on-surface-variant text-xs underline disabled:opacity-50"
        disabled={enabled}
        onClick={() => setContinuousMode((current) => !current)}
        type="button"
      >
        {continuousMode
          ? "Modo experimental contínuo — selecionar para desligar"
          : "Ativar modo experimental «Inovito» (escuta contínua)"}
      </button>
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const command = typedCommand.trim();
          if (!command) {
            return;
          }
          setTypedCommand("");
          handleSpokenCommand(command);
        }}
      >
        <div className="min-w-0 flex-1">
          <Input
            aria-label="Escrever comando para o Inovito"
            onChange={(event) => setTypedCommand(event.target.value)}
            placeholder="Resumo da loja"
            value={typedCommand}
          />
        </div>
        <button
          className="min-h-10 rounded-xl bg-primary px-3 text-on-primary text-sm"
          disabled={!typedCommand.trim()}
          type="submit"
        >
          Enviar
        </button>
      </form>
      <p aria-live="polite" className="mt-2 text-on-surface-variant text-xs">
        {feedback}
      </p>
      <p className="mt-2 text-[11px] text-on-surface-variant">
        Por defeito, só escuta ao carregar em «Falar». O reconhecimento
        do navegador pode enviar áudio para serviços externos. Não usar
        junto de clientes. O modo contínuo é apenas experimental.
      </p>
    </aside>
  );
}
