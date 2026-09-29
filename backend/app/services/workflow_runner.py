import json
import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings
from app.services.comfyui_client import comfyui_client
from app.services.workflow_parser import workflow_parser
from app.models.workflow import WorkflowRun
from app.models.credit import CreditAccount

settings = get_settings()
logger = logging.getLogger(__name__)


class WorkflowRunner:
    async def submit_run(
        self,
        db: AsyncSession,
        run_id: str,
        workflow_json: dict,
        user_input: dict,
    ) -> str:
        logger.info("submit_run user_input: %s", json.dumps(user_input, ensure_ascii=False, default=str)[:1000])
        injected_workflow = workflow_parser.inject_params(workflow_json, user_input)
        logger.info("submit_run injected_workflow: %s", json.dumps(injected_workflow, ensure_ascii=False, default=str)[:2000])

        client_id = str(run_id)
        result = await comfyui_client.submit_prompt(injected_workflow, client_id)
        prompt_id = result.get("prompt_id")

        run_result = await db.execute(
            select(WorkflowRun).where(WorkflowRun.id == run_id)
        )
        run = run_result.scalar_one_or_none()
        if run:
            run.prompt_id = prompt_id
            run.status = "running"
            run.started_at = datetime.now(timezone.utc)
            await db.flush()

        return prompt_id

    async def stream_progress(
        self, prompt_id: str, client_id: str
    ) -> AsyncGenerator[dict, None]:
        try:
            async for event in comfyui_client.listen_progress(client_id):
                event_type = event.get("type", "")
                data = event.get("data", {})

                if event_type == "progress":
                    yield {
                        "type": "progress",
                        "data": data,
                    }
                elif event_type == "executing":
                    node = data.get("node")
                    if node is None:
                        yield {
                            "type": "execution_success",
                            "data": {"prompt_id": data.get("prompt_id")},
                        }
                        break
                    else:
                        yield {
                            "type": "executing",
                            "data": {"node": node},
                        }
                elif event_type == "execution_error":
                    yield {
                        "type": "execution_error",
                        "data": data,
                    }
                    break
                elif event_type == "execution_cached":
                    pass
                elif event_type == "status":
                    pass
        except Exception as e:
            yield {
                "type": "execution_error",
                "data": {"message": str(e)},
            }

    async def fetch_results(
        self, db: AsyncSession, run_id: str, prompt_id: str
    ) -> dict:
        history = await comfyui_client.get_history(prompt_id)
        prompt_history = history.get(prompt_id, {})
        outputs = prompt_history.get("outputs", {})

        images = []
        for node_id, node_output in outputs.items():
            if "images" in node_output:
                for img_info in node_output["images"]:
                    filename = img_info["filename"]
                    subfolder = img_info.get("subfolder", "")
                    img_type = img_info.get("type", "output")

                    try:
                        image_data = await comfyui_client.get_image(
                            filename, subfolder, img_type
                        )

                        result_dir = os.path.join(settings.STORAGE_PATH, "results")
                        os.makedirs(result_dir, exist_ok=True)

                        local_filename = f"{run_id}_{filename}"
                        local_path = os.path.join(result_dir, local_filename)

                        with open(local_path, "wb") as f:
                            f.write(image_data)

                        base_url = settings.RESULT_IMAGE_BASE_URL.rstrip("/") if settings.RESULT_IMAGE_BASE_URL else "/static/results"
                        image_url = f"{base_url}/{local_filename}"
                        images.append(
                            {"url": image_url, "filename": filename}
                        )
                    except Exception as e:
                        logger.warning("Failed to save image %s: %s", filename, str(e))

        result_data = {"images": images, "outputs": outputs}

        run_result = await db.execute(
            select(WorkflowRun).where(WorkflowRun.id == run_id)
        )
        run = run_result.scalar_one_or_none()
        if run:
            run.result_data = json.dumps(result_data)
            run.status = "success"
            run.completed_at = datetime.now(timezone.utc)
            await db.flush()

        return result_data

    async def mark_failed(
        self, db: AsyncSession, run_id: str, error_message: str
    ) -> None:
        run_result = await db.execute(
            select(WorkflowRun).where(WorkflowRun.id == run_id)
        )
        run = run_result.scalar_one_or_none()
        if run:
            run.status = "failed"
            run.error_message = error_message
            run.completed_at = datetime.now(timezone.utc)
            await db.flush()


workflow_runner = WorkflowRunner()
