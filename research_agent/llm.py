"""Minimal Gemini REST client (no SDK dependency)."""
import json
import re
import time

import requests

API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class LLMError(RuntimeError):
    pass


class GeminiClient:
    def __init__(self, api_key: str, timeout: int = 90, retries: int = 3):
        if not api_key:
            raise LLMError("GEMINI_API_KEY is not set. Get one at https://aistudio.google.com/apikey")
        self.api_key = api_key
        self.timeout = timeout
        self.retries = retries

    def generate(self, prompt: str, model: str, *, json_mode: bool = False,
                 system: str | None = None, temperature: float = 0.3) -> str:
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temperature},
        }
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        if json_mode:
            body["generationConfig"]["responseMimeType"] = "application/json"

        last = None
        for attempt in range(self.retries):
            try:
                r = requests.post(API.format(model=model), json=body, timeout=self.timeout,
                                  headers={"x-goog-api-key": self.api_key})
                if r.status_code in (429, 500, 503):
                    raise LLMError(f"Gemini {r.status_code}: {r.text[:200]}")
                r.raise_for_status()
                data = r.json()
                parts = data["candidates"][0]["content"]["parts"]
                return "".join(p.get("text", "") for p in parts)
            except (requests.RequestException, LLMError, KeyError, IndexError) as e:
                last = e
                time.sleep(2 ** attempt)
        raise LLMError(f"Gemini request failed after {self.retries} attempts: {last}")

    def generate_json(self, prompt: str, model: str, **kw):
        return parse_json(self.generate(prompt, model, json_mode=True, **kw))


def parse_json(text: str):
    """Parse JSON even if the model wrapped it in a ``` fence."""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1).strip()
    return json.loads(text)
