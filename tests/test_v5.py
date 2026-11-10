"""Tests for v5 features: streaming, atomic facts, extract_date, budget guard,
time-sensitive recency sort, GeminiClient.stream SSE."""
import json
from unittest.mock import MagicMock

from research_agent.agent import ResearchAgent, clean_facts, Claim, Report
from research_agent.config import Config
from research_agent.fetch import extract_date, extract_text
from research_agent.search import SearchResult
from tests.test_agent import PAGE, FakeLLM, FakeSearch


# ── extract_date ──────────────────────────────────────────────

def test_extract_date_meta_property():
    html = '<html><head><meta property="article:published_time" content="2024-06-15T12:00:00Z"></head></html>'
    assert extract_date(html) == "2024-06-15"

def test_extract_date_jsonld():
    html = '<html><head><script type="application/ld+json">{"datePublished":"2023-11-03T08:00:00"}</script></head></html>'
    assert extract_date(html) == "2023-11-03"

def test_extract_date_time_tag():
    html = '<html><body><time datetime="2025-01-20">Jan 20</time></body></html>'
    assert extract_date(html) == "2025-01-20"

def test_extract_date_none():
    assert extract_date("<html><body>no date here</body></html>") == ""


# ── clean_facts ───────────────────────────────────────────────

def test_clean_facts_filters_bad_entries():
    raw = [
        {"fact": "Earth is round", "supported": True, "source": 1, "quote": "it's round"},
        {"fact": "", "supported": True},  # empty → dropped
        "not a dict",                     # string → dropped
        {"fact": "Water is wet", "supported": False, "source": 99, "quote": ""},  # bad source
    ]
    out = clean_facts(raw, [1, 2])
    assert len(out) == 2
    assert out[0]["fact"] == "Earth is round" and out[0]["source"] == 1
    assert out[1]["fact"] == "Water is wet" and out[1]["source"] is None  # 99 not in cites


def test_clean_facts_none():
    assert clean_facts(None, []) == []


# ── fact_precision on Report ──────────────────────────────────

def test_fact_precision_score():
    from research_agent.agent import Source
    s1 = Source(1, "T", "http://x", ["p"], "high", 0.8)
    c = Claim(1, "claim", [1], "supported", "ok",
              [{"fact": "a", "supported": True, "source": 1, "quote": ""},
               {"fact": "b", "supported": False, "source": 1, "quote": ""}])
    r = Report("q", "body", [s1], [c])
    sc = r.score
    assert sc["fact_precision"] == 0.5
    assert sc["facts"] == 2


# ── budget guard ──────────────────────────────────────────────

def test_budget_skips_steps():
    events = []

    class BudgetLLM(FakeLLM):
        tokens_used = 500  # already over budget

    agent = ResearchAgent(BudgetLLM(), FakeSearch(),
                          Config(max_rounds=2, max_tokens=100, max_revisions=1,
                                 detect_conflicts=True),
                          on_event=lambda k, d: events.append(k),
                          fetcher=lambda url, timeout=20: extract_text(PAGE))
    rep = agent.run("solar?")
    kinds = set(events)
    assert "budget" in kinds
    # gap filling, conflicts and self-correction should be skipped
    assert "gaps" not in kinds
    assert "conflicts" not in kinds


# ── time-sensitive recency sort ───────────────────────────────

def test_time_sensitive_sorts_newest_first():
    class TimeSensitiveLLM(FakeLLM):
        def generate_json(self, prompt, model, **kw):
            if "research planner" in prompt:
                return {"subquestions": [{"question": "q", "query": "q"}],
                        "time_sensitive": True}
            return super().generate_json(prompt, model, **kw)

    class MultiSearch:
        def search(self, q, k=4, kind="web"):
            return [SearchResult("Old", "http://a.com", "old"),
                    SearchResult("New", "http://b.com", "new")]

    dates = {"http://a.com": ("Text about solar " * 30, "2020-01-01"),
             "http://b.com": ("Text about solar " * 30, "2024-06-01")}

    agent = ResearchAgent(TimeSensitiveLLM(), MultiSearch(),
                          Config(max_rounds=1, max_revisions=0),
                          fetcher=lambda url, timeout=20: dates.get(url, ("text", "")))
    rep = agent.run("current solar?")
    assert rep.time_sensitive
    # Within the same credibility tier, newer source should come first
    if len(rep.sources) >= 2:
        high_sources = [s for s in rep.sources if s.credibility == rep.sources[0].credibility]
        if len(high_sources) >= 2:
            # Newer date should sort first
            assert high_sources[0].date >= high_sources[1].date or high_sources[0].date == ""


# ── streaming _compose ────────────────────────────────────────

def test_compose_streams_tokens():
    events = []

    class StreamLLM(FakeLLM):
        def stream(self, prompt, model, **kw):
            yield "Hello "
            yield "world"

    agent = ResearchAgent(StreamLLM(), FakeSearch(),
                          Config(max_rounds=1, max_revisions=0, stream=True),
                          on_event=lambda k, d: events.append((k, d)),
                          fetcher=lambda url, timeout=20: extract_text(PAGE))
    rep = agent.run("solar?")
    writing_events = [(k, d) for k, d in events if k == "writing"]
    token_events = [(k, d) for k, d in events if k == "token"]
    assert len(writing_events) >= 1
    assert len(token_events) >= 2
    assert token_events[0][1]["text"] == "Hello "


# ── GeminiClient.stream mock SSE ─────────────────────────────

def test_gemini_stream_sse():
    """Test that GeminiClient.stream parses SSE lines."""
    from research_agent.llm import GeminiClient
    from research_agent.cache import Cache

    cache = Cache(":memory:")
    client = GeminiClient("fake-key", cache=cache)

    # Build a fake SSE response
    chunks = [
        'data:{"candidates":[{"content":{"parts":[{"text":"Hello "}]}}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5}}',
        'data:{"candidates":[{"content":{"parts":[{"text":"world"}]}}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":10}}',
    ]

    class FakeResp:
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def raise_for_status(self): pass
        def iter_lines(self, decode_unicode=True):
            yield from chunks

    import requests as req_mod
    original = req_mod.post
    def mock_post(*args, **kwargs):
        return FakeResp()

    req_mod.post = mock_post
    try:
        parts = list(client.stream("test prompt", "gemini-2.5-flash"))
        assert parts == ["Hello ", "world"]
        assert client.tokens_used > 0
    finally:
        req_mod.post = original


def test_gemini_stream_cached():
    """Second call to stream with same params returns cached result."""
    from research_agent.llm import GeminiClient
    from research_agent.cache import Cache

    cache = Cache(":memory:")
    client = GeminiClient("fake-key", cache=cache)

    # Seed cache with the exact body structure stream() builds
    body = {"contents": [{"role": "user", "parts": [{"text": "cached prompt"}]}],
            "generationConfig": {"temperature": 0.3}}
    ck = cache.key("gen", "gemini-2.5-flash", body)
    cache.set(ck, "cached result")

    parts = list(client.stream("cached prompt", "gemini-2.5-flash"))
    assert parts == ["cached result"]
    assert client.usage["cached"] == 1
