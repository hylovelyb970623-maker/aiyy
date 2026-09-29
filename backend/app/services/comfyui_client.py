import httpx
import json
import uuid
import asyncio
import logging
from typing import Optional
import websockets

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class ComfyUIClient:
    def __init__(self):
        self._default_url = settings.COMFYUI_URL
        self._default_ws_url = settings.COMFYUI_WS_URL
        self._override_url: Optional[str] = None

    def set_url(self, url: str):
        self._override_url = url.rstrip("/") if url else None
        logger.info("ComfyUI URL set to: %s", self._override_url or self._default_url)

    @property
    def base_url(self) -> str:
        return self._override_url or self._default_url

    @property
    def ws_url(self) -> str:
        if self._override_url:
            return self._override_url.replace("https://", "wss://").replace("http://", "ws://")
        return self._default_ws_url

    async def submit_prompt(
        self, workflow: dict, client_id: Optional[str] = None
    ) -> dict:
        if client_id is None:
            client_id = str(uuid.uuid4())

        payload = {"prompt": workflow, "client_id": client_id}
        logger.info("Submitting prompt to ComfyUI: %s", json.dumps(payload, ensure_ascii=False, default=str)[:2000])

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/prompt",
                json=payload,
            )
            response.raise_for_status()
            return response.json()

    async def get_history(self, prompt_id: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.base_url}/history/{prompt_id}",
            )
            response.raise_for_status()
            return response.json()

    async def get_system_stats(self) -> dict:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{self.base_url}/system_stats")
            response.raise_for_status()
            return response.json()

    async def upload_image(self, image_data: bytes, filename: str, overwrite: bool = True) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/upload/image",
                files={"image": (filename, image_data, "image/png")},
                data={"overwrite": str(overwrite).lower()},
            )
            response.raise_for_status()
            return response.json()

    async def get_image(self, filename: str, subfolder: str = "", folder_type: str = "output") -> bytes:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/view",
                params={"filename": filename, "subfolder": subfolder, "type": folder_type},
            )
            response.raise_for_status()
            return response.content

    async def listen_ws(self, client_id: str, callback):
        ws_url = self.ws_url
        logger.info("Connecting to ComfyUI WS: %s", ws_url)
        try:
            async with websockets.connect(f"{ws_url}/ws?clientId={client_id}") as ws:
                async for message in ws:
                    data = json.loads(message)
                    await callback(data)
        except Exception as e:
            logger.error("WebSocket error: %s", e)
            raise

    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/system_stats")
                return response.status_code == 200
        except Exception:
            return False


comfyui_client = ComfyUIClient()
