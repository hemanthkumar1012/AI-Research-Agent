"""Tests for the serverless-era fixes: thinkingConfig fallback, fail-fast
4xx, wall-clock deadlines, writer/extractive fallbacks, and the POST
research endpoint with knowledge-base context."""
import json
import time

import pytest

from research_agent import llm as llm_mod
from research_agent.agent import ResearchAgent, Report, Source
from research_agent.config import Config
from research_agent.search import SearchResult


class Resp:
    def __init__(self, data=None, status=200, text=""):
        self.data, self.status_code, self.text = data or {}, status, text

    def raise_for_status(self):
        pass

    def json(self):
        return self.data


def ok_resp(text="hi"):
    return Resp({"candidates": [{"content": {"parts": [{"text": text}]}}],
                 "usageMetadata": {"promptTokenCount": 1, "candidatesTokenCount": 1}})


# ── llm.py ──────────────────────────────────────────────────────────

def test_thinking_config_sent_by_default(monkeypatch):
    bodies = []
    monkeypatch.setattr(llm_mod, "_THINKING_OK", True)
    monkeypatch.setattr(llm_mod.requests, "post",
                        lambda url, json, timeout, headers: bodies.append(json) or ok_resp())
    llm_mod.GeminiClient("k").generate("p", "m")
    assert bodies[0]["generationConfig"]["thinkingConfig"] == {"thinkingBudget": 0}


def test_thinking_config_dropped_after_400(monkeypatch):
    """A model that rejects thinkingConfig gets one retry without it, and
    the rejection is remembered for the rest of the process."""
    bodies = []

    def fake_post(url, json, timeout, headers):
        bodies.append(json)
        if "thinkingConfig" in json.get("generationConfig", {}):
            return Resp(status=400, text="INVALID_ARGUMENT")
        return ok_resp("recovered")

    monkeypatch.setattr(llm_mod, "_THINKING_OK", True)
    monkeypatch.setattr(llm_mod.requests, "post", fake_post)
    c = llm_mod.GeminiClient("k")
    assert c.generate("p", "m") == "recovered"
    assert len(bodies) == 2
    # process-wide flag flipped: the next call never sends thinkingConfig
    assert c.generate("p2", "m") == "recovered"
    assert "thinkingConfig" not in bodies[-1]["generationConfig"]


def test_4xx_fails_fast_without_retries(monkeypatch):
    monkeypatch.setattr(llm_mod, "_THINKING_OK", False)
    calls = []
    monkeypatch.setattr(llm_mod.requests, "post",
                        lambda url, json, timeout, headers: calls.append(1) or Resp(status=404, text="gone"))
    with pytest.raises(RuntimeError, match="404"):
        llm_mod.GeminiClient("k", retries=3).generate("p", "m")
    assert len(calls) == 1  # no retry burn on permanent errors


def test_503_is_retried(monkeypatch):
    monkeypatch.setattr(llm_mod, "_THINKING_OK", False)
    monkeypatch.setattr(llm_mod.time, "sleep", lambda s: None)
    seq = [Resp(status=503, text="busy"), ok_resp("after retry")]
    monkeypatch.setattr(llm_mod.requests, "post", lambda url, json, timeout, headers: seq.pop(0))
    assert llm_mod.GeminiClient("k", retries=2).generate("p", "m") == "after retry"


def test_build_agent_honors_llm_budget_config(monkeypatch):
    from research_agent.agent import build_agent
    cfg = Config(gemini_api_key="k", use_cache=False)
    cfg.llm_timeout, cfg.llm_retries = 25, 2
    agent = build_agent(cfg)
    assert agent.llm.timeout == 25 and agent.llm.retries == 2


# ── agent.py fallbacks ──────────────────────────────────────────────

class FakeLLM:
    def __init__(self, fail_models=()):
        self.fail_models, self.calls = set(fail_models), []

    def generate(self, prompt, model, **kw):
        self.calls.append(model)
        if model in self.fail_models:
            raise RuntimeError("Gemini 503: busy")
        if "subquestion" in prompt.lower():
            return json.dumps({"time_sensitive": False, "subquestions":
                               [{"question": "what is x", "query": "x", "source": "web"}]})
        return "X is a thing [1]. It does stuff [1]."

    def generate_json(self, prompt, model, **kw):
        from research_agent.llm import parse_json
        return parse_json(self.generate(prompt, model))


class FakeSearch:
    def search(self, q, k, kind="web"):
        return [SearchResult(title="T", url="https://example.com/a",
                             snippet="X is a thing. " * 30, content="X is a thing. " * 60)]


def quick_cfg():
    cfg = Config(gemini_api_key="k")
    cfg.max_rounds, cfg.max_revisions = 1, 0
    cfg.use_embeddings = cfg.detect_conflicts = False
    cfg.fast_model, cfg.writer_model = "fast", "writer"
    cfg.stream = False
    return cfg


def test_writer_falls_back_to_fast_model():
    cfg = quick_cfg()
    agent = ResearchAgent(FakeLLM(fail_models={"writer"}), FakeSearch(), cfg)
    r = agent.run("what is x?")
    assert "X is a thing" in r.body
    assert "writer" in agent.llm.calls and agent.llm.calls.count("fast") >= 2


def test_extractive_report_when_all_models_down():
    cfg = quick_cfg()
    events = []
    agent = ResearchAgent(FakeLLM(fail_models={"writer", "fast"}), FakeSearch(), cfg,
                          lambda k, d: events.append((k, d)))
    # plan also fails -> run() raises before gather; so only writing falls back.
    # Make plan succeed by allowing fast for the first call only:
    llm = agent.llm
    orig = llm.generate

    def gen(prompt, model, **kw):
        if "subquestion" in prompt.lower():
            return json.dumps({"time_sensitive": False, "subquestions":
                               [{"question": "q", "query": "x", "source": "web"}]})
        return orig(prompt, model, **kw)

    llm.generate = gen
    r = agent.run("what is x?")
    assert "[1]" in r.body  # extractive body still carries citations
    assert any(k == "status" and "extractive" in str(d).lower() for k, d in events)


def test_wall_deadline_skips_verification():
    cfg = quick_cfg()
    cfg.wall_deadline = time.time() - 1
    events = []
    agent = ResearchAgent(FakeLLM(), FakeSearch(), cfg, lambda k, d: events.append(k))
    r = agent.run("what is x?")
    assert r.body
    assert "budget" in events  # verification was skipped, run still completed


def test_draft_event_emitted_before_verification():
    cfg = quick_cfg()
    order = []
    agent = ResearchAgent(FakeLLM(), FakeSearch(), cfg, lambda k, d: order.append(k))
    agent.run("what is x?")
    assert "draft" in order
    assert order.index("draft") < order.index("report") if "report" in order else True


def test_ask_accepts_inline_report():
    cfg = quick_cfg()
    agent = ResearchAgent(FakeLLM(), FakeSearch(), cfg)
    rep = Report("q", "body [1]", [Source(1, "T", "https://e.com", ["X is a thing."], "high", .9, "")],
                 [], body="body [1]")
    out = agent.ask(rep, "why?")
    assert out["answer"]


# ── api/research.py POST with knowledge-base context ────────────────

def test_research_post_injects_context(monkeypatch):
    import importlib
    import api.research as research_mod
    importlib.reload(research_mod)
    captured = {}

    class H(research_mod.handler):
        def __init__(self):  # no socket setup
            pass

        def _run(self, question, depth):
            captured["q"], captured["depth"] = question, depth

    h = H()
    payload = json.dumps({"q": "What changed?", "depth": "deep",
                          "context": [{"name": "notes.md", "text": "EV sales doubled in 2025."}]}).encode()
    h.headers = {"Content-Length": str(len(payload))}
    import io
    h.rfile = io.BytesIO(payload)
    h.do_POST()
    assert captured["depth"] == "deep"
    assert captured["q"].startswith("What changed?")
    assert "notes.md" in captured["q"] and "EV sales doubled" in captured["q"]


def test_research_post_without_context_leaves_question_untouched():
    import api.research as research_mod

    class H(research_mod.handler):
        def __init__(self):
            pass

        def _run(self, question, depth):
            self.got = (question, depth)

    h = H()
    payload = json.dumps({"q": "Plain question"}).encode()
    h.headers = {"Content-Length": str(len(payload))}
    import io
    h.rfile = io.BytesIO(payload)
    h.do_POST()
    assert h.got == ("Plain question", "standard")


# ── verify() resilience ─────────────────────────────────────────────

def test_verify_survives_malformed_llm_and_unknown_cites():
    cfg = quick_cfg()

    class BadJsonLLM(FakeLLM):
        def generate_json(self, prompt, model, **kw):
            raise ValueError("not json")

    agent = ResearchAgent(BadJsonLLM(), FakeSearch(), cfg)
    srcs = [Source(1, "T", "https://e.com", ["X is a thing."], "high", .9, "")]
    claims = agent.verify("The compound reduces emissions by forty percent overall [1].", srcs)
    assert claims and all(c.label == "unchecked" for c in claims)


def test_verify_retries_flaky_batch_once():
    cfg = quick_cfg()

    class FlakyLLM(FakeLLM):
        def __init__(self):
            super().__init__()
            self.n = 0

        def generate_json(self, prompt, model, **kw):
            self.n += 1
            if self.n == 1:
                raise RuntimeError("Gemini 503")
            return {"results": [{"id": 1, "label": "supported", "reason": "ok", "facts": []}]}

    agent = ResearchAgent(FlakyLLM(), FakeSearch(), cfg)
    srcs = [Source(1, "T", "https://e.com", ["X is a thing."], "high", .9, "")]
    claims = agent.verify("The compound reduces emissions by forty percent overall [1].", srcs)
    assert agent.llm.n == 2
    assert claims[0].label == "supported"
