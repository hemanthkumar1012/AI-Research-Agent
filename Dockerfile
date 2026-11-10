# ── Stage 1: Build frontend ─────────────────────────────
FROM node:20-slim AS frontend
WORKDIR /build
COPY frontend/ ./frontend/
COPY research_agent/static/ ./research_agent/static/
RUN cd frontend && npm install --ignore-scripts 2>/dev/null; \
    node frontend/build.mjs

# ── Stage 2: Python runtime ────────────────────────────
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY research_agent ./research_agent

# Copy built frontend assets into the static dir
COPY --from=frontend /build/research_agent/static/ ./research_agent/static/

ENV PORT=8000
EXPOSE 8000
CMD ["python", "-m", "research_agent.server"]
