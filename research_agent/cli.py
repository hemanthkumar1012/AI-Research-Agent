"""Command line interface.

    python -m research_agent "question" [--depth quick|standard|deep]
    python -m research_agent ask <report-id>            # interactive follow-ups
    python -m research_agent list                       # saved reports
"""
import argparse
import sys

from .agent import Report, build_agent
from .config import PRESETS, Config, apply_preset
from .store import ReportStore

ICON = {"status": "•", "plan": "🧭", "search": "🔎", "source": "📄", "gaps": "🕳️",
        "verify": "✅", "revise": "✍️", "conflicts": "⚖️", "writing": "📝", "budget": "💸", "done": "🏁"}


def log(kind: str, data: dict) -> None:
    if kind == "token":
        return   # the finished report is printed at the end
    if kind == "writing":
        msg = "Drafting report (streaming)…" if data["phase"] == "draft" else "Streaming revision…"
    elif kind == "plan":
        msg = ("Plan" + (" (time-sensitive: preferring recent sources)" if data.get("time_sensitive")
                         else "") + ":\n" + "\n".join(f"    - [{s.get('source', 'web')}] {s['question']}"
                                    for s in data["subquestions"])
    elif kind == "search":
        msg = f"Searching ({data.get('kind', 'web')}): {data['query']}"
    elif kind == "source":
        date = f", {data['date']}" if data.get("date") else ""
        msg = f"[{data['id']}] {data['title'][:80]} ({data.get('credibility', '?')}{date})"
    elif kind == "gaps":
        msg = "Filling gaps: " + "; ".join(data["queries"])
    elif kind == "verify":
        msg = f"Checked {data['checked']}/{data['total']} claims"
    elif kind == "conflicts":
        msg = "Sources disagree on: " + "; ".join(c["topic"] for c in data["conflicts"])
    elif kind == "revise":
        msg = f"Self-correcting: rewriting {data['flagged']} flagged claims (round {data['round']})"
    elif kind == "done":
        hist = " → ".join(f"{h['citation_precision']:.0%}" for h in data["history"])
        msg = f"Done. Citation precision {hist}"
    else:
        msg = data.get("message", "")
    print(f"{ICON.get(kind, '•')} {msg}", file=sys.stderr, flush=True)


def cmd_research(argv):
    p = argparse.ArgumentParser(prog="research-agent", description="Cited, self-verifying research")
    p.add_argument("question", nargs="+")
    p.add_argument("--depth", choices=list(PRESETS), default="standard")
    p.add_argument("--rounds", type=int, help="research rounds")
    p.add_argument("--sources", type=int, help="max sources")
    p.add_argument("--revisions", type=int, help="self-correction passes (0 = off)")
    p.add_argument("--no-embeddings", action="store_true", help="BM25 only, skip semantic rerank")
    p.add_argument("--no-conflicts", action="store_true", help="skip contradiction analysis")
    p.add_argument("--no-cache", action="store_true")
    p.add_argument("--max-tokens", type=int, help="token budget; optional steps are skipped past it")
    p.add_argument("--files", nargs="+", default=[], metavar="PATH",
                   help="your own PDFs / docs to include as primary sources")
    p.add_argument("--out", default="reports", help="output folder")
    a = p.parse_args(argv)

    cfg = apply_preset(Config.from_env(), a.depth)
    for flag, attr in ((a.rounds, "max_rounds"), (a.sources, "max_sources"),
                       (a.revisions, "max_revisions")):
        if flag is not None:
            setattr(cfg, attr, flag)
    cfg.use_embeddings &= not a.no_embeddings
    cfg.detect_conflicts &= not a.no_conflicts
    cfg.use_cache &= not a.no_cache
    if a.max_tokens is not None:
        cfg.max_tokens = a.max_tokens

    question = " ".join(a.question)
    report = build_agent(cfg, log).run(question, files=a.files)
    rid = ReportStore(a.out).save(report.to_dict())
    print(report.markdown)
    u = report.usage
    if u:
        print(f"💰 {u.get('calls', 0)} LLM calls ({u.get('cached', 0)} cached), "
              f"{u.get('input_tokens', 0):,} in / {u.get('output_tokens', 0):,} out tokens",
              file=sys.stderr)
    print(f"\nSaved as {rid}. Ask follow-ups: python -m research_agent ask {rid}", file=sys.stderr)


def cmd_ask(argv):
    p = argparse.ArgumentParser(prog="research-agent ask")
    p.add_argument("report_id")
    p.add_argument("question", nargs="*", help="one-shot question (omit for interactive)")
    p.add_argument("--out", default="reports")
    a = p.parse_args(argv)
    report = Report.from_dict(ReportStore(a.out).load(a.report_id))
    agent = build_agent(Config.from_env())
    history: list[dict] = []

    def answer(q):
        res = agent.ask(report, q, history)
        print(f"\n{res['answer']}\n  (citation precision {res['score']['citation_precision']:.0%})\n")
        history.extend([{"role": "user", "content": q}, {"role": "assistant", "content": res["answer"]}])

    if a.question:
        return answer(" ".join(a.question))
    print(f"Follow-ups on: {report.question}  (empty line to quit)")
    while (q := input("❓ ").strip()):
        answer(q)


def cmd_list(argv):
    for r in ReportStore(argv[0] if argv else "reports").list():
        prec = f"{r['precision']:.0%}" if r["precision"] is not None else "-"
        print(f"{r['id']}  [{prec}]  {r['question']}")


def main(argv=None) -> None:
    argv = sys.argv[1:] if argv is None else argv
    if argv and argv[0] == "ask":
        return cmd_ask(argv[1:])
    if argv and argv[0] == "list":
        return cmd_list(argv[1:])
    return cmd_research(argv)


if __name__ == "__main__":
    main()
