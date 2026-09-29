import json
import logging
from celery_app import celery_app
from app.core.database import async_session_maker
from app.services.comfyui_client import comfyui_client
from app.services.workflow_parser import workflow_parser
from app.services.workflow_runner import workflow_runner
from app.services.credit_service import credit_service
from app.models.workflow import WorkflowRun, WorkflowTemplate
from app.models.credit import WorkflowPricing
from sqlalchemy import select

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="execute_workflow")
def execute_workflow(self, run_id: str, workflow_json_str: str, user_input_str: str):
    import asyncio

    workflow_json = json.loads(workflow_json_str)
    user_input = json.loads(user_input_str)

    async def _run():
        async with async_session_maker() as db:
            try:
                injected = workflow_parser.inject_params(workflow_json, user_input)
                client_id = str(run_id)
                result = await comfyui_client.submit_prompt(injected, client_id)
                prompt_id = result.get("prompt_id")

                run_result = await db.execute(
                    select(WorkflowRun).where(WorkflowRun.id == run_id)
                )
                run = run_result.scalar_one_or_none()
                if run:
                    run.prompt_id = prompt_id
                    run.status = "running"
                    await db.commit()

                import websockets
                ws_url = f"ws://127.0.0.1:8188/ws?clientId={client_id}"
                async with websockets.connect(ws_url) as ws:
                    while True:
                        message = await ws.recv()
                        data = json.loads(message)
                        event_type = data.get("type", "")

                        if event_type == "executing":
                            node = data.get("data", {}).get("node")
                            if node is None:
                                break
                        elif event_type == "execution_error":
                            raise Exception(data.get("data", {}).get("message", "执行失败"))

                history = await comfyui_client.get_history(prompt_id)
                if prompt_id in history:
                    await workflow_runner.fetch_results(db, run_id, prompt_id)
                    await db.commit()

            except Exception as e:
                logger.error(f"Workflow execution failed: {e}")
                async with async_session_maker() as db2:
                    await workflow_runner.mark_failed(db2, run_id, str(e))
                    await db2.commit()

    asyncio.run(_run())
