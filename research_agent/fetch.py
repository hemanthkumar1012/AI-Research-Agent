"""Fetch pages, extract readable text, and pick the passages most relevant to a question."""
import io
import math
import os
import re
from collections import Counter

import requests
from bs4 import BeautifulSoup

from .search import UA

STOP = set("""a an the and or of to in on for with by is are was were be been it this that
as at from what which who how why when where does do did can could should would about
into than then them their there these those its not no yes""".split())


_cache = None


def set_cache(cache) -> None:
    global _cache
    _cache = cache


def fetch_text(url: str, timeout: int = 20, max_chars: int = 60_000) -> str:
    return fetch_doc(url, timeout, max_chars)[0]


def fetch_doc(url: str, timeout: int = 20, max_chars: int = 60_000) -> tuple[str, str]:
    """Return (text, publication date as YYYY-MM-DD or "")."""
    key = _cache.key("page2", url) if _cache is not None else None
    if key and (hit := _cache.get(key)) is not None:
        return hit["text"], hit.get("date", "")
    text, date = _fetch(url, timeout, max_chars)
    if key and text:
        _cache.set(key, {"text": text, "date": date})
    return text, date


def _fetch(url: str, timeout: int, max_chars: int) -> tuple[str, str]:
    try:
        r = requests.get(url, headers=UA, timeout=timeout)
        r.raise_for_status()
        ctype = r.headers.get("content-type", "html").lower()
        if "pdf" in ctype or url.lower().split("?")[0].endswith(".pdf"):
            return pdf_text(r.content)[:max_chars], ""
        if "html" not in ctype and "text" not in ctype:
            return "", ""
        return extract_text(r.text)[:max_chars], extract_date(r.text)
    except requests.RequestException:
        return "", ""


_DATE = re.compile(r"(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])")


def extract_date(html: str) -> str:
    """Best-effort publication date from meta tags, JSON-LD or <time>."""
    soup = BeautifulSoup(html, "html.parser")
    for attr, names in (("property", ("article:published_time", "og:published_time")),
                        ("name", ("date", "pubdate", "publish-date", "citation_publication_date",
                                  "dc.date", "article:published_time"))):
        for n in names:
            tag = soup.find("meta", attrs={attr: n})
            if tag and (m := _DATE.search(tag.get("content", "").replace("/", "-"))):
                return m.group(0)
    for script in soup.find_all("script", type="application/ld+json"):
        m = re.search(r'"datePublished"\s*:\s*"([^"]+)"', script.string or "")
        if m and (d := _DATE.search(m.group(1))):
            return d.group(0)
    t = soup.find("time", attrs={"datetime": True})
    if t and (m := _DATE.search(t["datetime"])):
        return m.group(0)
    return ""


def pdf_text(data: bytes, max_pages: int = 40) -> str:
    """Extract text from a PDF (needs the optional `pypdf` package)."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""
    try:
        reader = PdfReader(io.BytesIO(data))
        pages = [(pg.extract_text() or "") for pg in reader.pages[:max_pages]]
    except Exception:
        return ""
    text = "\n".join(pages)
    text = re.sub(r"-\n(?=[a-z])", "", text)              # re-join hyphenated words
    text = re.sub(r"(?<![.!?:])\n(?=[a-z])", " ", text)    # re-flow broken lines
    # stop at references so citations of other papers don't pollute passages
    m = re.search(r"\n\s*(references|bibliography)\s*\n", text, re.I)
    if m and m.start() > len(text) * 0.5:
        text = text[: m.start()]
    return "\n".join(line for line in text.split("\n") if len(line.strip()) > 2)


def read_local(path: str, max_chars: int = 200_000) -> str:
    """Read a user-supplied document (PDF, HTML, Markdown or text)."""
    ext = os.path.splitext(path)[1].lower()
    with open(path, "rb") as f:
        data = f.read()
    if ext == ".pdf":
        return pdf_text(data, max_pages=200)[:max_chars]
    raw = data.decode("utf-8", errors="ignore")
    if ext in (".html", ".htm"):
        return extract_text(raw)[:max_chars]
    return raw[:max_chars]


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
