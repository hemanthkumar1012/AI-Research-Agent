"""Fetch pages, extract readable text, and pick the passages most relevant to a question."""
import math
import re
from collections import Counter

import requests
from bs4 import BeautifulSoup

from .search import UA

STOP = set("""a an the and or of to in on for with by is are was were be been it this that
as at from what which who how why when where does do did can could should would about
into than then them their there these those its not no yes""".split())


def fetch_text(url: str, timeout: int = 20, max_chars: int = 60_000) -> str:
    try:
        r = requests.get(url, headers=UA, timeout=timeout)
        r.raise_for_status()
        if "html" not in r.headers.get("content-type", "html"):
            return ""
        return extract_text(r.text)[:max_chars]
    except requests.RequestException:
        return ""


def extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form",
                     "noscript", "svg", "iframe"]):
        tag.decompose()
    root = soup.find("article") or soup.find("main") or soup.body or soup
    blocks = [el.get_text(" ", strip=True) for el in root.find_all(["p", "li", "h1", "h2", "h3", "td"])]
    text = "\n".join(b for b in blocks if len(b) > 40)
    return re.sub(r"[ \t]+", " ", text).strip()


def tokenize(s: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP and len(w) > 1]


def chunk(text: str, size: int = 900) -> list[str]:
    paras, chunks, cur = text.split("\n"), [], ""
    for p in paras:
        if len(cur) + len(p) > size and cur:
            chunks.append(cur.strip())
            cur = ""
        cur += p + "\n"
    if cur.strip():
        chunks.append(cur.strip())
    return chunks


def top_passages(text: str, query: str, k: int = 3, size: int = 900) -> list[str]:
    """BM25-style ranking of chunks against the query."""
    chunks = chunk(text, size)
    if not chunks:
        return []
    q = tokenize(query)
    docs = [Counter(tokenize(c)) for c in chunks]
    n, avg = len(docs), sum(sum(d.values()) for d in docs) / len(docs) or 1
    df = Counter(t for d in docs for t in set(d))
    def score(d):
        dl = sum(d.values())
        s = 0.0
        for t in q:
            if t in d:
                idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
                s += idf * d[t] * 2.2 / (d[t] + 1.2 * (0.25 + 0.75 * dl / avg))
        return s
    ranked = sorted(range(n), key=lambda i: score(docs[i]), reverse=True)[:k]
    return [chunks[i] for i in sorted(ranked)]
