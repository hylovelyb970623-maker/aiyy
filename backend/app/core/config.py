import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "AIYY"
    DEBUG: bool = os.environ.get("DEBUG", "false").lower() == "true"

    DATABASE_URL: str = "sqlite+aiosqlite:///./aiyy.db"
    DATABASE_URL_SYNC: str = "sqlite:///./aiyy.db"

    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET: str = "aiyy-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    COMFYUI_URL: str = "http://127.0.0.1:8188"
    COMFYUI_WS_URL: str = "ws://127.0.0.1:8188"

    STORAGE_PATH: str = "./storage"
    RESULT_IMAGE_BASE_URL: str = ""

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    DEFAULT_CREDITS_ON_SIGNUP: int = 100
    DEFAULT_CREDITS_PER_RUN: int = 1

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
