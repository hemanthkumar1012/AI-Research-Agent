import argparse
import json
import re
import sys
from pathlib import Path

from .agent import ResearchAgent
from .config import Config
from .llm import GeminiClient
from .search import Searcher

ICON = {"status": "•", "plan": "🧭", "search": "🔎", "source": "📄", "gaps": "🕳️",
        "verify": "✅", "done": "🏁"}


def log(kind: str, data: dict) -> None:
    if kind == "plan":
        msg = "Plan:\n" + "\n".join(f"    - {s['question']}" for s in data["subquestions"])
    elif kind == "search":
        msg = f"Searching: {data['query']}"
    elif kind == "source":
        msg = f"[{data['id']}] {data['title'][:80]}"
    elif kind == "gaps":
        msg = "Filling gaps: " + "; ".join(data["queries"])
    elif kind == "verify":
        msg = f"Checked {data['checked']}/{data['total']} claims"
    elif kind == "done":
        msg = f"Done. Citation precision {data['score']['citation_precision']:.0%}"
    else:
        msg = data.get("message", "")
    print(f"{ICON.get(kind, '•')} {msg}", file=sys.stderr, flush=True)


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60] or "report"


def main(argv=None) -> None:
    p = argparse.ArgumentParser(prog="research-agent", description="Cited, self-verifying web research")
    p.add_argument("question", nargs="+")
    p.add_argument("--rounds", type=int, help="research rounds (default 2)")
    p.add_argument("--sources", type=int, help="max sources (default 10)")
    p.add_argument("--out", default="reports", help="output folder")
    args = p.parse_args(argv)

    cfg = Config.from_env()
    if args.rounds:
        cfg.max_rounds = args.rounds
    if args.sources:
        cfg.max_sources = args.sources
    question = " ".join(args.question)

    agent = ResearchAgent(GeminiClient(cfg.gemini_api_key), Searcher(cfg.tavily_api_key), cfg, log)
    report = agent.run(question)

    out = Path(args.out)
    out.mkdir(exist_ok=True)
    md = out / f"{slug(question)}.md"
    md.write_text(f"# {question}\n\n{report.markdown}\n", encoding="utf-8")
    md.with_suffix(".json").write_text(json.dumps(report.to_dict(), indent=2), encoding="utf-8")
    print(report.markdown)
    print(f"\nSaved {md} and {md.with_suffix('.json')}", file=sys.stderr)


if __name__ == "__main__":
    main()
