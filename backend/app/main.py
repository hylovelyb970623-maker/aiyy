import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import engine, Base
from app.api.router import router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(os.path.join(settings.STORAGE_PATH, "results"), exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="ComfyUI 工作流转 AI 应用平台 API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(router)

results_path = os.path.join(settings.STORAGE_PATH, "results")
os.makedirs(results_path, exist_ok=True)
app.mount("/static/results", StaticFiles(directory=results_path), name="results")


@app.on_event("startup")
async def load_system_config():
    from app.core.database import async_session_maker
    from app.models.system_config import SystemConfig
    from app.services.comfyui_client import comfyui_client
    from sqlalchemy import select

    try:
        async with async_session_maker() as db:
            result = await db.execute(
                select(SystemConfig).where(SystemConfig.key == "comfyui_url")
            )
            config = result.scalar_one_or_none()
            if config and config.value:
                comfyui_client.set_url(config.value)
    except Exception:
        pass
