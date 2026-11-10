"""Heuristic source credibility so the writer can weight evidence and prefer strong sources."""
from urllib.parse import urlparse

HIGH = ("nature.com", "science.org", "nih.gov", "who.int", "arxiv.org", "acm.org", "ieee.org",
        "reuters.com", "apnews.com", "bbc.co.uk", "bbc.com", "economist.com", "ft.com",
        "nytimes.com", "theguardian.com", "thehindu.com", "worldbank.org", "imf.org", "oecd.org",
        "britannica.com", "sciencedirect.com", "springer.com", "pubmed.ncbi.nlm.nih.gov",
        "rbi.org.in", "npci.org.in", "pib.gov.in", "docs.python.org", "developer.mozilla.org")
LOW = ("reddit.com", "quora.com", "medium.com", "pinterest.com", "facebook.com", "tiktok.com",
       "instagram.com", "x.com", "twitter.com", "blogspot.com", "wordpress.com", "fandom.com")


def domain(url: str) -> str:
    host = urlparse(url).netloc.lower().split(":")[0]
    return host[4:] if host.startswith("www.") else host


def credibility(url: str) -> str:
    d = domain(url)
    if any(d == h or d.endswith("." + h) for h in HIGH) or d.endswith((".gov", ".edu", ".gov.in",
                                                                       ".ac.in", ".ac.uk", ".int")):
        return "high"
    if any(d == h or d.endswith("." + h) for h in LOW):
        return "low"
    return "medium"


RANK = {"high": 0, "medium": 1, "low": 2}
