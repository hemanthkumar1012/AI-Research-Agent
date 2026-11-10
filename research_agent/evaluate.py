"""Run the agent over a question set and report citation-quality metrics.

    python -m research_agent.evaluate evals/questions.json --limit 3
"""
import argparse
import json
import sys
import time
from pathlib import Path

from .agent import build_agent
from .config import Config


def evaluate(agent_factory, questions):
    rows = []
    for i, q in enumerate(questions, 1):
        print(f"[{i}/{len(questions)}] {q}", file=sys.stderr, flush=True)
        t = time.time()
        try:
            rep = agent_factory().run(q)
            first = rep.history[0]["citation_precision"] if rep.history else rep.score["citation_precision"]
            rows.append({"question": q, "seconds": round(time.time() - t, 1),
                         "sources": len(rep.sources), "draft_precision": first,
                         "revisions": rep.revisions, **rep.score})
        except Exception as e:
            rows.append({"question": q, "error": str(e)})
    ok = [r for r in rows if "error" not in r]
    total_claims = sum(r["claims"] for r in ok) or 1
    summary = {
        "questions": len(rows), "succeeded": len(ok),
        "avg_sources": round(sum(r["sources"] for r in ok) / max(len(ok), 1), 1),
        "avg_seconds": round(sum(r["seconds"] for r in ok) / max(len(ok), 1), 1),
        "total_claims": sum(r["claims"] for r in ok),
        # micro-averaged over all claims, so long reports weigh more
        "citation_precision": round(sum(r["supported"] + 0.5 * r["partial"] for r in ok) / total_claims, 3),
        "avg_draft_precision": round(sum(r["draft_precision"] for r in ok) / max(len(ok), 1), 3),
        "avg_final_precision": round(sum(r["citation_precision"] for r in ok) / max(len(ok), 1), 3),
        "unsupported_rate": round(sum(r["unsupported"] for r in ok) / total_claims, 3),
    }
    return {"summary": summary, "rows": rows}


def to_markdown(result) -> str:
    s = result["summary"]
    lines = ["| Metric | Value |", "|---|---|"] + [f"| {k} | {v} |" for k, v in s.items()]
    lines += ["", "| Question | Sources | Claims | Draft → Final precision | Unsupported |",
              "|---|---|---|---|---|"]
    for r in result["rows"]:
        if "error" in r:
            lines.append(f"| {r['question'][:60]} | – | – | error | – |")
        else:
            lines.append(f"| {r['question'][:60]} | {r['sources']} | {r['claims']} | "
                         f"{r['draft_precision']:.0%} → {r['citation_precision']:.0%} | {r['unsupported']} |")
    return "\n".join(lines)


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("questions", nargs="?", default="evals/questions.json")
    p.add_argument("--limit", type=int)
    p.add_argument("--out", default="evals/results")
    p.add_argument("--revisions", type=int, help="override self-correction passes (0 = ablation)")
    a = p.parse_args(argv)
    qs = json.loads(Path(a.questions).read_text())[: a.limit]
    cfg = Config.from_env()
    if a.revisions is not None:
        cfg.max_revisions = a.revisions
    result = evaluate(lambda: build_agent(cfg), qs)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "results.json").write_text(json.dumps(result, indent=2))
    (out / "results.md").write_text(to_markdown(result))
    print(to_markdown(result))


if __name__ == "__main__":
    main()
