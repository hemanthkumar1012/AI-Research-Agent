"""Minimal Gemini REST client (no SDK dependency)."""
import json
import re
import time

import requests

from .cache import NullCache

BASE = "https://generativelanguage.googleapis.com/v1beta/models/"
import os as _os
_THINK_BUDGET = int(_os.environ.get("GEMINI_THINKING_BUDGET", "0"))
API = BASE + "{model}:generateContent"


class LLMError(RuntimeError):
    pass


class GeminiClient:
    def __init__(self, api_key: str, timeout: int = 90, retries: int = 3, cache=None,
                 embed_model: str = "gemini-embedding-001"):
        if not api_key:
            raise LLMError("GEMINI_API_KEY is not set. Get one at https://aistudio.google.com/apikey")
        self.api_key = api_key
        self.timeout = timeout
        self.retries = retries
        self.cache = cache or NullCache()
        self.embed_model = embed_model
        self.usage = {"calls": 0, "cached": 0, "input_tokens": 0, "output_tokens": 0}

    def generate(self, prompt: str, model: str, *, json_mode: bool = False,
                 system: str | None = None, temperature: float = 0.3) -> str:
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temperature,
                                 "thinkingConfig": {"thinkingBudget": _THINK_BUDGET}},
        }
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        if json_mode:
            body["generationConfig"]["responseMimeType"] = "application/json"

        ck = self.cache.key("gen", model, body)
        if (hit := self.cache.get(ck)) is not None:
            self.usage["cached"] += 1
            return hit
        text = self._post(API.format(model=model), body, self._parse_text)
        self.cache.set(ck, text)
        return text

    def stream(self, prompt: str, model: str, *, system: str | None = None,
               temperature: float = 0.3):
        """Yield text chunks as Gemini generates them (SSE). Cached results replay at once."""
        body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": temperature,
                                     "thinkingConfig": {"thinkingBudget": _THINK_BUDGET}}}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        ck = self.cache.key("gen", model, body)
        if (hit := self.cache.get(ck)) is not None:
            self.usage["cached"] += 1
            yield hit
            return
        url = BASE + f"{model}:streamGenerateContent?alt=sse"
        parts, meta = [], {}
        try:
            with requests.post(url, json=body, timeout=self.timeout, stream=True,
                               headers={"x-goog-api-key": self.api_key}) as r:
                r.raise_for_status()
                for line in r.iter_lines(decode_unicode=True):
                    if not line or not line.startswith("data:"):
                        continue
                    data = json.loads(line[5:])
                    meta = data.get("usageMetadata", meta)
                    for c in data.get("candidates", [])[:1]:
                        for p in c.get("content", {}).get("parts", []):
                            if p.get("text"):
                                parts.append(p["text"])
                                yield p["text"]
        except (requests.RequestException, ValueError):
            if not parts:      # nothing streamed yet: fall back to a normal request
                yield self.generate(prompt, model, system=system, temperature=temperature)
                return
            # otherwise keep the partial text rather than throwing away a long answer
        self.usage["calls"] += 1
        self.usage["input_tokens"] += meta.get("promptTokenCount", 0)
        self.usage["output_tokens"] += meta.get("candidatesTokenCount", 0)
        self.cache.set(ck, "".join(parts))

    @property
    def tokens_used(self) -> int:
        return self.usage["input_tokens"] + self.usage["output_tokens"]

    def _parse_text(self, data: dict) -> str:
        meta = data.get("usageMetadata", {})
        self.usage["calls"] += 1
        self.usage["input_tokens"] += meta.get("promptTokenCount", 0)
        self.usage["output_tokens"] += meta.get("candidatesTokenCount", 0)
        parts = data["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts)

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Batch embeddings (cached per text)."""
        out: list = [None] * len(texts)
        todo = []
        for i, t in enumerate(texts):
            hit = self.cache.get(self.cache.key("emb", self.embed_model, t))
            if hit is not None:
                out[i] = hit
            else:
                todo.append(i)
        for start in range(0, len(todo), 100):
            idx = todo[start:start + 100]
            body = {"requests": [{"model": f"models/{self.embed_model}",
                                  "content": {"parts": [{"text": texts[i][:8000]}]}} for i in idx]}
            vecs = self._post(BASE + f"{self.embed_model}:batchEmbedContents", body,
                              lambda d: [e["values"] for e in d["embeddings"]])
            for i, v in zip(idx, vecs):
                out[i] = v
                self.cache.set(self.cache.key("emb", self.embed_model, texts[i]), v)
        return out

    def _post(self, url: str, body: dict, parse):
        last = None
        for attempt in range(self.retries):
            try:
                r = requests.post(url, json=body, timeout=self.timeout,
                                  headers={"x-goog-api-key": self.api_key})
                if r.status_code in (429, 500, 503):
                    raise LLMError(f"Gemini {r.status_code}: {r.text[:200]}")
                r.raise_for_status()
                return parse(r.json())
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
