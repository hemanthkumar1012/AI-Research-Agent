"""Saves reports as JSON so they can be reopened and questioned later."""
import json
import re
import time
from pathlib import Path


class ReportStore:
    def __init__(self, root: str = "reports"):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def make_id(question: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", question.lower()).strip("-")[:50] or "report"
        return f"{time.strftime('%Y%m%d-%H%M%S')}-{slug}"

    def _path(self, rid: str) -> Path:
        if not re.fullmatch(r"[a-z0-9\-]+", rid):
            raise KeyError(rid)
        return self.root / f"{rid}.json"

    def save(self, data: dict) -> str:
        rid = data.get("id") or self.make_id(data["question"])
        data["id"] = rid
        data.setdefault("created", time.time())
        self._path(rid).write_text(json.dumps(data, indent=2), encoding="utf-8")
        (self.root / f"{rid}.md").write_text(f"# {data['question']}\n\n{data['markdown']}\n",
                                             encoding="utf-8")
        return rid

    def load(self, rid: str) -> dict:
        p = self._path(rid)
        if not p.exists():
            raise KeyError(rid)
        return json.loads(p.read_text(encoding="utf-8"))

    def list(self, limit: int = 30) -> list[dict]:
        items = []
        for p in sorted(self.root.glob("*.json"), reverse=True)[:limit]:
            try:
                d = json.loads(p.read_text(encoding="utf-8"))
                items.append({"id": d["id"], "question": d["question"],
                              "precision": d.get("score", {}).get("citation_precision")})
            except (json.JSONDecodeError, KeyError):
                continue
        return items
