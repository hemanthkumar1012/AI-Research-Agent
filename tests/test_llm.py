from research_agent import llm as llm_mod
from research_agent.cache import Cache


class Resp:
    def __init__(self, data):
        self.data, self.status_code, self.text = data, 200, ""

    def raise_for_status(self):
        pass

    def json(self):
        return self.data


def test_generate_uses_cache_and_tracks_usage(monkeypatch, tmp_path):
    calls = []

    def fake_post(url, json, timeout, headers):
        calls.append(url)
        if "batchEmbedContents" in url:
            return Resp({"embeddings": [{"values": [0.1, 0.2]} for _ in json["requests"]]})
        return Resp({"candidates": [{"content": {"parts": [{"text": "hi"}]}}],
                     "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 2}})

    monkeypatch.setattr(llm_mod.requests, "post", fake_post)
    c = llm_mod.GeminiClient("k", cache=Cache(str(tmp_path / "c.sqlite")))
    assert c.generate("p", "m") == "hi"
    assert c.generate("p", "m") == "hi"
    assert len(calls) == 1 and c.usage == {"calls": 1, "cached": 1, "input_tokens": 5, "output_tokens": 2}
    assert c.embed(["a", "b"]) == [[0.1, 0.2], [0.1, 0.2]]
    c.embed(["a"])
    assert len(calls) == 2  # second embed fully cached
