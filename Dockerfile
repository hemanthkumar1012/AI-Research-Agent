FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY research_agent ./research_agent
ENV PORT=8000
EXPOSE 8000
CMD ["python", "-m", "research_agent.server"]
