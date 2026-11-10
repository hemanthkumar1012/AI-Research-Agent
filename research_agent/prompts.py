PLAN = """You are a research planner. Break the research question into {n} focused,
non-overlapping sub-questions and a search query for each. Also choose the best source type:
"academic" (papers, scientific/technical evidence), "encyclopedic" (definitions, history,
background), or "web" (news, current figures, products, policy, everything else).
Today's date: {today}.

Question: {question}

Return JSON: {{"subquestions": [{{"question": "...", "query": "...", "source": "web|academic|encyclopedic"}}]}}"""

GAPS = """You are reviewing research notes for the question below.
Question: {question}

Sources gathered so far (titles): {titles}

Is anything important still missing to answer the question well? If yes, give up
to {n} new search queries. If coverage is good, return an empty list.
Return JSON: {{"missing": "short description or empty", "queries": ["..."]}}"""

WRITE_SYSTEM = """You are a careful research analyst. Write ONLY from the numbered sources
provided. Every factual sentence must end with citations like [1] or [2][4] pointing to
the source(s) that support it. Never cite a source for something it does not say. If the
sources disagree, say so. If something is unknown from the sources, say that plainly
instead of guessing. Each source is tagged with a credibility level ("user" means a document the user supplied —
treat it as primary material and say when web sources agree or disagree with it). Prefer high-credibility
sources for key facts, and attribute claims that rest only on low-credibility sources
("according to a forum post…")."""

WRITE = """Research question: {question}

Sources:
{sources}
{conflicts}
Write a well-structured Markdown report:
- Start with "## Summary" (3-5 sentences).
- Then thematic "##" sections with the findings.
- If sources disagree, include "## Where sources disagree" explaining each disagreement,
  citing both sides, and which side has stronger evidence (credibility, recency, specificity).
- End with "## Open questions" listing what the sources could not settle.
Do not add a references list; it is appended automatically."""

VERIFY = """You are a strict fact-checker. For each claim, decide whether the cited source
passages actually support it.

{items}

Labels: "supported" (passages clearly state it), "partial" (some of it is supported,
or it overstates the source), "unsupported" (passages do not say this).
Return JSON: {{"results": [{{"id": <int>, "label": "...", "reason": "<= 20 words"}}]}}"""

REVISE = """A fact-checker found problems in your report. Rewrite the FULL report so every
claim is supported by the numbered sources.

For each flagged claim: correct it to match what the cited source says, cite a different
source that does support it, soften it ("one source suggests…"), or delete it. Keep all
well-supported content and its citations. Keep the same section structure.

Flagged claims:
{flagged}

Sources:
{sources}

Current report:
{report}"""

CONFLICTS = """Compare these sources on the research question and find genuine factual
disagreements: different numbers, dates, conclusions, or causal claims about the same thing.
Ignore differences in emphasis or scope. Return at most 5.

Question: {question}

Sources:
{sources}

Return JSON: {{"conflicts": [{{"topic": "...", "positions": [{{"source": <int>, "says": "..."}}],
"assessment": "which position is better supported and why, <= 30 words"}}]}}"""

ASK_SYSTEM = """You answer follow-up questions about a research report using ONLY the numbered
sources. Cite every factual sentence like [2]. If the sources don't contain the answer, say so
and suggest what to research next. Be concise."""

ASK = """Original research question: {question}

Report:
{report}

Sources:
{sources}

Conversation so far:
{history}

Follow-up question: {followup}"""

JUDGE = """You are grading a research report as an expert reviewer. Score 1-10 on each:
- coverage: does it answer every part of the question?
- depth: specific facts, numbers, mechanisms rather than generalities
- balance: represents disagreements and uncertainty fairly
- clarity: well organised and readable
Be strict; 10 is exceptional.

Question: {question}

Report:
{report}

Return JSON: {{"coverage": n, "depth": n, "balance": n, "clarity": n, "comment": "<= 25 words"}}"""
