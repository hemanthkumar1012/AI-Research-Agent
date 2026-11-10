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
        )
