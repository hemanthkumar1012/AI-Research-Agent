import os
from dataclasses import dataclass, field


def _load_dotenv(path: str = ".env") -> None:
    """Tiny .env loader so python-dotenv isn't required."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass
class Config:
    gemini_api_key: str = ""
    tavily_api_key: str = ""
    fast_model: str = "gemini-2.5-flash"     # planning, verification
    writer_model: str = "gemini-2.5-pro"     # final report
    max_subquestions: int = 4
    results_per_query: int = 4
    max_sources: int = 10
    passages_per_source: int = 3
    passage_chars: int = 900
    max_rounds: int = 2                      # research rounds (gap-filling)
    request_timeout: int = 20
    max_revisions: int = 1                   # self-correction passes after verification
    use_embeddings: bool = True              # hybrid BM25 + semantic reranking
    candidate_passages: int = 6              # BM25 candidates per source before reranking
    use_cache: bool = True
    detect_conflicts: bool = True
    read_full_papers: bool = True            # fetch full arXiv PDFs, not just abstracts            # cross-source contradiction analysis
    extra: dict = field(default_factory=dict)

    @classmethod
    def from_env(cls) -> "Config":
        _load_dotenv()
        return cls(
            gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
            tavily_api_key=os.getenv("TAVILY_API_KEY", ""),
            fast_model=os.getenv("FAST_MODEL", cls.fast_model),
            writer_model=os.getenv("WRITER_MODEL", cls.writer_model),
            max_rounds=int(os.getenv("MAX_ROUNDS", cls.max_rounds)),
            max_revisions=int(os.getenv("MAX_REVISIONS", cls.max_revisions)),
            use_embeddings=os.getenv("USE_EMBEDDINGS", "1") != "0",
            use_cache=os.getenv("USE_CACHE", "1") != "0",
        )


PRESETS = {
    "quick":    dict(max_subquestions=3, results_per_query=3, max_sources=6, max_rounds=1,
                     max_revisions=0, detect_conflicts=False, read_full_papers=False),
    "standard": dict(),
    "deep":     dict(max_subquestions=6, results_per_query=5, max_sources=16, max_rounds=3,
                     max_revisions=2, passages_per_source=4),
}


def apply_preset(cfg: Config, name: str) -> Config:
    if name not in PRESETS:
        raise ValueError(f"Unknown depth '{name}'. Choose from: {', '.join(PRESETS)}")
    for k, v in PRESETS[name].items():
        setattr(cfg, k, v)
    return cfg
