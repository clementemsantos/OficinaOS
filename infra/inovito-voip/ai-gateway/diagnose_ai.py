#!/usr/bin/env python3
"""Isolated Gemini API diagnostic. Uses synthetic text + Inovito TTS only."""
import os
import re
import sys
from pathlib import Path
from google import genai
from google.genai import types

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
TTS = Path("/shared/sounds/inovito-boas-vindas.wav")
KEY = os.getenv("GEMINI_API_KEY")
if not KEY:
    sys.exit("ERRO: GEMINI_API_KEY ausente no contentor")
client = genai.Client(api_key=KEY, http_options={"timeout": 25000})

def print_error(error):
    # Never print full request data, auth headers, or credentials.
    code = getattr(error, "code", "")
    message = getattr(error, "message", None) or str(error)
    message = message.replace(KEY, "[REDACTED]")
    message = re.sub(r"AIza[A-Za-z0-9_-]{20,}", "[REDACTED_KEY]", message)
    print(f"FALHOU ({type(error).__name__}, estado={code}): {message[:1200]}")

def test(label, contents, config=None):
    print(f"=== {label} ===", flush=True)
    try:
        r = client.models.generate_content(model=MODEL, contents=contents, config=config)
        if not (r.text or "").strip():
            print("RESPOSTA SEM TEXTO; verificar finish_reason")
            return False
        print("OK: Gemini respondeu")
        return True
    except Exception as error:
        print_error(error)
        return False

print("Modelo:", MODEL)
base_text = "Responde apenas: Olá."
if not test("A - pedido simples só de texto", base_text):
    print("Conclusão: falha mesmo sem áudio/configurações; verificar modelo, acesso e chave no Google AI Studio.")
    sys.exit(1)

cfg = types.GenerateContentConfig(
    system_instruction="Responde em português de Portugal.",
    max_output_tokens=700,
    thinking_config=types.ThinkingConfig(thinking_level="low"),
)
if not test("B - pedido só de texto com configurações do gateway", base_text, cfg):
    print("Conclusão: problema provável na configuração ou versão do SDK.")
    sys.exit(2)

if not TTS.is_file():
    print("Falta o WAV de saudação no gateway:", TTS)
    sys.exit(3)
voice = TTS.read_bytes()
if not voice.startswith(b"RIFF") or b"WAVE" not in voice[:12]:
    print("Ficheiro de teste não tem cabeçalho WAV.")
    sys.exit(4)
audio_contents = [
    types.Content(role="user", parts=[
        types.Part.from_text(text="Resume esta gravação numa frase em português de Portugal."),
        types.Part.from_bytes(data=voice, mime_type="audio/wav"),
    ])
]
if not test("C - pedido com WAV da saudação (sem dados de clientes)", audio_contents, cfg):
    print("Conclusão: texto funciona, mas pedido com áudio falha.")
    sys.exit(5)
print("Todos os testes passaram. Verificar gravação produzida pelo Asterisk ou histórico da conversa.")
