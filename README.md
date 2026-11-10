# AI Research Agent

![tests](https://github.com/hemanthkumar1012/AI-Research-Agent/actions/workflows/tests.yml/badge.svg)

An autonomous research agent that **plans, searches the web, reads sources, writes a cited
report — and then fact-checks its own citations.** Built in Python on the Gemini API.

Most "research agents" stop at summarising search results. This one treats hallucinated
citations as the main failure mode: after writing, every cited sentence is checked against
the exact passages it cites and labelled *supported*, *partial* or *unsupported*. The report
ends with a **citation precision** score and flags the weak claims — and if anything is
flagged, the agent **rewrites its own report** and re-verifies it.

### Highlights

- **Self-correcting:** verify → rewrite flagged claims → re-verify, keeping a revision only if
  precision doesn't drop. Reports show draft → final precision.
- **Hybrid retrieval:** BM25 picks candidate passages, then Gemini embeddings rerank them
  semantically (score fusion), and off-topic sources are dropped.
- **Source credibility:** sources are tagged high / medium / low (gov, edu, journals, wire
  services vs. forums and social media), ordered by strength, and the writer is told to
  attribute weak-source claims.
- **Multi-round gap filling:** the agent asks itself what's missing and searches again.
- **Cost-aware:** SQLite cache for LLM calls, embeddings and pages; token usage reported per run.
- **Measured:** an eval harness reports citation precision and unsupported-claim rate, with a
  `--revisions 0` ablation to quantify what self-correction buys.
- **Lightweight:** only `requests` + `beautifulsoup4`; Gemini via REST, web UI on the standard library.

## How it works

```
question
   │
   ▼
 Plan ──► sub-questions + search queries          (Gemini Flash, JSON mode)
   │
   ▼
 Search ──► Tavily  or  DuckDuckGo (free, no key)
   │
   ▼
 Read ──► fetch pages in parallel, strip boilerplate,
          rank passages with BM25 against the question
   │
   ▼
 Gap check ──► "what's still missing?" → new queries → search again   (multi-round)
   │
   ▼
 Rerank ──► Gemini embeddings + BM25 fusion, credibility tagging, drop off-topic sources
   │
   ▼
 Write ──► Markdown report, every sentence cited [n]  (Gemini Pro)
   │
   ▼
 Verify ──► each claim vs. its cited passages → supported / partial / unsupported
   │        ▲
   ▼        │  (flagged claims)
 Revise ────┘  rewrite, re-verify, keep only if precision improves
   │
   ▼
 report.md + report.json (sources, claims, labels, score)
```

## Quick start

```bash
git clone https://github.com/hemanthkumar1012/AI-Research-Agent
cd AI-Research-Agent
pip install -r requirements.txt
cp .env.example .env        # add your GEMINI_API_KEY (free at aistudio.google.com)

python -m research_agent "What is the current state of solid-state batteries for EVs?"
```

Options: `--rounds 3` (more gap-filling), `--sources 15`, `--revisions 2`,
`--no-embeddings`, `--no-cache`, `--out my_reports`.

Or with Docker: `docker build -t research-agent . && docker run -p 8000:8000 --env-file .env research-agent`

### Web UI (live agent trace)

```bash
python -m research_agent.server      # open http://localhost:8000
```

The left panel streams every step over Server-Sent Events (plan, searches, sources found,
gap-filling, verification progress); the right panel renders the final report with its
citation-quality score. No web framework needed — it runs on the standard library.

### Evaluation harness

```bash
python -m research_agent.evaluate evals/questions.json --limit 3
python -m research_agent.evaluate --revisions 0 --out evals/no_revise   # ablation
```

Runs the agent over a fixed question set and writes `evals/results/results.md` with
micro-averaged **citation precision**, **unsupported-claim rate**, sources and latency per
question — so prompt or model changes can be compared with numbers instead of vibes.

## Project layout

| File | Role |
|------|------|
| `research_agent/agent.py` | The research loop, claim extraction, verification, scoring |
| `research_agent/llm.py` | Dependency-free Gemini REST client with retries and JSON mode |
| `research_agent/search.py` | Tavily / DuckDuckGo search |
| `research_agent/fetch.py` | Page fetching, text extraction, BM25 passage ranking |
| `research_agent/prompts.py` | All prompts in one place |
| `research_agent/credibility.py` | Domain-based source credibility |
| `research_agent/cache.py` | SQLite cache for LLM, embedding and page results |
| `research_agent/cli.py` | Command-line interface with live progress |
| `research_agent/server.py` + `static/index.html` | Streaming web UI (SSE) |
| `research_agent/evaluate.py` + `evals/` | Evaluation harness and question set |
| `tests/` | Offline tests using fake LLM and search |

## Tests

```bash
pip install pytest && pytest -q
```

## Roadmap

- [x] Plan → search → read → write → verify pipeline
- [x] Multi-round gap filling
- [x] Citation precision scoring
- [x] Web UI with live streaming of the agent's steps
- [x] Evaluation harness over a fixed question set
- [x] Self-correction of unsupported claims
- [x] Hybrid BM25 + embedding retrieval
- [x] Source credibility scoring
- [x] Caching, token accounting, CI, Docker
- [ ] Follow-up Q&A over gathered sources
- [ ] Contradiction detection across sources
