#!/bin/sh
set -e

echo "=== AIYY Backend Starting ==="

mkdir -p /app/data /app/storage/uploads /app/storage/results

if [ ! -f /app/data/aiyy.db ]; then
    echo "Initializing database..."
    python -c "
import asyncio
from app.core.database import engine, Base
async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Database initialized.')
asyncio.run(init())
"
fi

echo "Running seed data..."
python seed.py || echo "Seed data already exists, skipping."

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
