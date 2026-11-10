# AI Research Agent

An autonomous research agent that **plans, searches the web, reads sources, writes a cited
report — and then fact-checks its own citations.** Built in Python on the Gemini API.

Most "research agents" stop at summarising search results. This one treats hallucinated
citations as the main failure mode: after writing, every cited sentence is checked against
the exact passages it cites and labelled *supported*, *partial* or *unsupported*. The report
ends with a **citation precision** score and flags the weak claims.

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
 Write ──► Markdown report, every sentence cited [n]  (Gemini Pro)
   │
   ▼
 Verify ──► each claim vs. its cited passages → supported / partial / unsupported
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

Options: `--rounds 3` (more gap-filling), `--sources 15`, `--out my_reports`.

## Project layout

| File | Role |
|------|------|
| `research_agent/agent.py` | The research loop, claim extraction, verification, scoring |
| `research_agent/llm.py` | Dependency-free Gemini REST client with retries and JSON mode |
| `research_agent/search.py` | Tavily / DuckDuckGo search |
| `research_agent/fetch.py` | Page fetching, text extraction, BM25 passage ranking |
| `research_agent/prompts.py` | All prompts in one place |
| `research_agent/cli.py` | Command-line interface with live progress |
| `tests/` | Offline tests using fake LLM and search |

## Tests

```bash
pip install pytest && pytest -q
```

## Roadmap

- [x] Plan → search → read → write → verify pipeline
- [x] Multi-round gap filling
- [x] Citation precision scoring
- [ ] Web UI with live streaming of the agent's steps
- [ ] Evaluation harness over a fixed question set
- [ ] Auto-rewrite of unsupported claims
