FROM python:3.12-slim

WORKDIR /app

# Dependencies first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code (main.py, ingest.py). The guide (BSS_steps.md) is mounted at runtime
# so it can be edited and re-ingested without rebuilding the image.
COPY . .

EXPOSE 8080

# uvicorn workers each open their own asyncpg pool; size to the host.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "4"]
