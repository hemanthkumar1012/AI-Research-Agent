import argparse
import json
import re
import sys
from pathlib import Path

from .agent import build_agent
from .config import Config

ICON = {"status": "•", "plan": "🧭", "search": "🔎", "source": "📄", "gaps": "🕳️",
        "verify": "✅", "revise": "✍️", "done": "🏁"}


def log(kind: str, data: dict) -> None:
    if kind == "plan":
        msg = "Plan:\n" + "\n".join(f"    - {s['question']}" for s in data["subquestions"])
    elif kind == "search":
        msg = f"Searching: {data['query']}"
    elif kind == "source":
        msg = f"[{data['id']}] {data['title'][:80]} ({data.get('credibility', '?')})"
    elif kind == "gaps":
        msg = "Filling gaps: " + "; ".join(data["queries"])
    elif kind == "verify":
        msg = f"Checked {data['checked']}/{data['total']} claims"
    elif kind == "revise":
        msg = f"Self-correcting: rewriting {data['flagged']} flagged claims (round {data['round']})"
    elif kind == "done":
        hist = " → ".join(f"{h['citation_precision']:.0%}" for h in data["history"])
        msg = f"Done. Citation precision {hist}"
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
    p.add_argument("--revisions", type=int, help="self-correction passes (default 1, 0 = off)")
    p.add_argument("--no-embeddings", action="store_true", help="BM25 only, skip semantic rerank")
    p.add_argument("--no-cache", action="store_true")
    p.add_argument("--out", default="reports", help="output folder")
    args = p.parse_args(argv)

    cfg = Config.from_env()
    if args.rounds:
        cfg.max_rounds = args.rounds
    if args.sources:
        cfg.max_sources = args.sources
    if args.revisions is not None:
        cfg.max_revisions = args.revisions
    cfg.use_embeddings = cfg.use_embeddings and not args.no_embeddings
    cfg.use_cache = cfg.use_cache and not args.no_cache
    question = " ".join(args.question)

    report = build_agent(cfg, log).run(question)
    u = report.usage
    if u:
        print(f"💰 {u.get('calls', 0)} LLM calls ({u.get('cached', 0)} cached), "
              f"{u.get('input_tokens', 0):,} in / {u.get('output_tokens', 0):,} out tokens", file=sys.stderr)

    out = Path(args.out)
    out.mkdir(exist_ok=True)
    md = out / f"{slug(question)}.md"
    md.write_text(f"# {question}\n\n{report.markdown}\n", encoding="utf-8")
    md.with_suffix(".json").write_text(json.dumps(report.to_dict(), indent=2), encoding="utf-8")
    print(report.markdown)
    print(f"\nSaved {md} and {md.with_suffix('.json')}", file=sys.stderr)


if __name__ == "__main__":
    main()
