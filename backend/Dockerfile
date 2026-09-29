FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pip install --no-cache-dir .

RUN mkdir -p /app/storage/uploads /app/storage/results /app/data

RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

VOLUME ["/app/storage", "/app/data"]

ENTRYPOINT ["/app/entrypoint.sh"]
