#!/usr/bin/env python3
"""FastAGI experimental turn-based phone assistant. Internal Docker network only."""
import asyncio
import logging
import os
from pathlib import Path
import re
import socketserver
import subprocess
import tempfile
import uuid

import edge_tts
from google import genai
from google.genai import types

LOG = logging.getLogger("inovito-ai")
RECORD_DIR = Path("/shared/recordings")
SOUND_DIR = Path("/shared/sounds")
VOICE = os.getenv("INOVITO_TTS_VOICE", "pt-PT-DuarteNeural")
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
MAX_TURNS = 3
PROMPT = (
    "És o Inovito, assistente de atendimento da Inove.pt em Rio Maior, Portugal. "
    "Responde sempre em português de Portugal, de forma curta, clara, cordial e natural. "
    "Podes informar genericamente sobre reparações, encomendas, produtos, EDP, DIGI e "
    "serviços tecnológicos. Esta é uma demonstração: não estás ligado ao OficinaOS, "
    "não consultas clientes, stocks, preços nem o estado real das reparações. "
    "Não inventes preços, condições contratuais, campanhas, disponibilidade ou prazos. "
    "Nunca peças passwords, documentos, NIF, dados bancários nem informações pessoais. "
    "Para assuntos particulares, explica que um colaborador terá de confirmar. "
    "Fala no máximo em duas ou três frases breves por resposta."
)


def api_reply(audio: bytes, history: list) -> tuple[str, list]:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"], http_options={"timeout": 25000})
    request = types.Content(
        role="user",
        parts=[
            types.Part.from_text(text="Responde oralmente à pergunta nesta gravação de um teste telefónico."),
            types.Part.from_bytes(data=audio, mime_type="audio/wav"),
        ],
    )
    all_contents = history + [request]
    result = client.models.generate_content(
        model=MODEL,
        contents=all_contents,
        config=types.GenerateContentConfig(
            system_instruction=PROMPT,\n            max_output_tokens=700,\n            thinking_config=types.ThinkingConfig(thinking_level="low")
        ),
    )
    answer = (result.text or "").strip()
    if not answer:
        raise RuntimeError("A IA não devolveu texto")
    # Keep short answers for predictable phone testing.
    answer = answer[:650]
    return answer, all_contents + [types.Content(role="model", parts=[types.Part.from_text(text=answer)])]


def make_wav(message: str, name: str) -> Path:
    SOUND_DIR.mkdir(parents=True, exist_ok=True)
    final = SOUND_DIR / (name + ".wav")
    with tempfile.TemporaryDirectory(dir="/tmp") as tmp:
        mp3 = Path(tmp) / "voice.mp3"
        wav = Path(tmp) / "voice.wav"
        asyncio.run(edge_tts.Communicate(message, voice=VOICE).save(str(mp3)))
        subprocess.run(
            ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(mp3), "-ar", "8000", "-ac", "1",
             "-c:a", "pcm_s16le", str(wav)],
            check=True, timeout=35,
        )
        if wav.stat().st_size < 256:
            raise RuntimeError("Áudio TTS vazio")
        # Rename atomically on the bind-mount to avoid partial playback.
        staging = SOUND_DIR / (name + ".tmp.wav")
        staging.write_bytes(wav.read_bytes())
        staging.chmod(0o644)
        staging.replace(final)
    return final


class AGI(socketserver.StreamRequestHandler):
    def command(self, command: str) -> str:
        self.wfile.write((command + "\n").encode("utf-8"))
        self.wfile.flush()
        line = self.rfile.readline().decode("utf-8", errors="replace").strip()
        if not line or not line.startswith("200 result="):
            raise ConnectionError("AGI terminou ou devolveu uma resposta inválida")
        if re.search(r"result=-1(?:\D|$)", line):
            raise ConnectionError("Chamador desligou")
        return line

    def handle(self) -> None:
        self.request.settimeout(70)
        headers = {}
        try:
            while True:
                line = self.rfile.readline()
                if not line:
                    return
                if line in (b"\n", b"\r\n"):
                    break
                key, sep, value = line.decode("utf-8", errors="replace").strip().partition(":")
                if sep:
                    headers[key] = value.strip()
            if headers.get("agi_extension") != "997":
                LOG.warning("Extensão não permitida")
                return
            if not SEMAPHORE.acquire(blocking=False):
                LOG.warning("Limite de chamada de testes atingido")
                return
            try:
                self.conversation()
            finally:
                SEMAPHORE.release()
        except Exception as exc:
            # No phone numbers, credentials, transcripts or recordings in logs.
            LOG.warning("Chamada de teste terminada: %s", type(exc).__name__)

    def conversation(self) -> None:
        call = uuid.uuid4().hex
        history: list = []
        self.command('STREAM FILE custom/inovito-boas-vindas ""')
        for index in range(MAX_TURNS):
            stem = f"inovito-{call}-{index}"
            recorded = RECORD_DIR / (stem + ".wav")
            spoken: Path | None = None
            try:
                self.command(
                    f"RECORD FILE /var/spool/asterisk/recording/{stem} wav # 18000 0 BEEP s=2"
                )
                if not recorded.exists() or recorded.stat().st_size < 5000:
                    return
                answer, history = api_reply(recorded.read_bytes(), history)
                spoken = make_wav(answer, stem)
                self.command(f'STREAM FILE custom/{stem} ""')
            except ConnectionError:
                return
            except Exception as exc:
                LOG.warning("Erro de serviço na resposta: %s", type(exc).__name__)
                try:
                    spoken = make_wav(
                        "Desculpa, estou com uma dificuldade técnica. "
                        "Por favor, fala com um colaborador da Inove.",
                        stem + "-erro",
                    )
                    self.command(f'STREAM FILE custom/{stem}-erro ""')
                except Exception:
                    pass
                return
            finally:
                recorded.unlink(missing_ok=True)
                if spoken:
                    spoken.unlink(missing_ok=True)
        # End test after three questions; do not stay on the call indefinitely.
        try:
            spoken = make_wav("Obrigado pela conversa. Até breve!", f"inovito-{call}-fim")
            self.command(f'STREAM FILE custom/inovito-{call}-fim ""')
            spoken.unlink(missing_ok=True)
        except Exception:
            pass


import threading
SEMAPHORE = threading.BoundedSemaphore(1)


class Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    if not os.environ.get("GEMINI_API_KEY"):
        raise SystemExit("GEMINI_API_KEY não configurada")
    with Server(("0.0.0.0", 4573), AGI) as server:
        LOG.info("Inovito FastAGI de testes pronto (apenas rede Docker)")
        server.serve_forever()
