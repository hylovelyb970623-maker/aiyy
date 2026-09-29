import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sse_starlette.sse import EventSourceResponse

from app.core.database import async_session_maker
from app.models.user import User
from app.models.workflow import WorkflowRun
from app.core.security import decode_token
from app.services.comfyui_client import comfyui_client
from app.services.workflow_runner import workflow_runner
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/runs", tags=["运行记录"])


async def verify_token(
    token: str | None = Query(None, alias="token"),
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="缺少认证 Token")
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="无效的 Token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="无效的 Token")

    async with async_session_maker() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or user.status != "active":
            raise HTTPException(status_code=401, detail="用户不存在或已封禁")
        return user


@router.get("/{run_id}/stream")
async def stream_run_progress(
    run_id: str,
    user: User = Depends(verify_token),
):
    async def event_generator():
        logger.info("SSE stream started for run_id=%s, user=%s", run_id, user.id)
        yield {"event": "message", "data": json.dumps({"type": "connected", "data": {}})}

        async with async_session_maker() as db:
            result = await db.execute(
                select(WorkflowRun).where(WorkflowRun.id == run_id)
            )
            run = result.scalar_one_or_none()
            if not run:
                logger.warning("SSE: run %s not found", run_id)
                yield {"event": "message", "data": json.dumps({"type": "error", "data": {"message": "运行记录不存在"}})}
                return
            if run.user_id != user.id:
                logger.warning("SSE: user %s cannot access run %s", user.id, run_id)
                yield {"event": "message", "data": json.dumps({"type": "error", "data": {"message": "无权访问"}})}
                return

            if not run.prompt_id:
                logger.info("SSE: run %s has no prompt_id yet", run_id)
                yield {"event": "message", "data": json.dumps({"type": "waiting", "data": {}})}
                return

            prompt_id = run.prompt_id
            logger.info("SSE: polling for prompt_id=%s", prompt_id)

            try:
                max_polls = 600
                poll_interval = 1.0

                for poll_count in range(max_polls):
                    try:
                        history = await comfyui_client.get_history(prompt_id)
                    except Exception as e:
                        logger.warning("get_history error (poll %d): %s", poll_count, e)
                        history = {}

                    if prompt_id in history:
                        prompt_history = history[prompt_id]
                        status_val = prompt_history.get("status", {})

                        if status_val.get("status_str") == "error":
                            error_msg = ""
                            messages = status_val.get("messages", [])
                            if messages:
                                for msg in messages:
                                    if len(msg) >= 2 and isinstance(msg[1], dict):
                                        error_msg = msg[1].get(
                                            "exception_message", str(msg[1])
                                        )
                                        break
                            if not error_msg:
                                error_msg = "执行出错"
                            await workflow_runner.mark_failed(db, run_id, error_msg)
                            await db.commit()
                            yield {
                                "event": "message",
                                "data": json.dumps({
                                    "type": "execution_error",
                                    "data": {"message": error_msg},
                                }),
                            }
                            return

                        result_data = await workflow_runner.fetch_results(
                            db, run_id, prompt_id
                        )
                        await db.commit()
                        yield {
                            "event": "message",
                            "data": json.dumps({
                                "type": "execution_success",
                                "data": result_data,
                            }),
                        }
                        return

                    if poll_count % 3 == 0:
                        yield {
                            "event": "message",
                            "data": json.dumps({
                                "type": "progress",
                                "data": {"value": poll_count, "max": max_polls},
                            }),
                        }

                    await asyncio.sleep(poll_interval)

                await workflow_runner.mark_failed(db, run_id, "等待超时")
                await db.commit()
                yield {
                    "event": "message",
                    "data": json.dumps({
                        "type": "execution_error",
                        "data": {"message": "等待超时，请查看运行历史获取结果"},
                    }),
                }
            except Exception as e:
                logger.error("SSE stream error: %s", str(e), exc_info=True)
                try:
                    await workflow_runner.mark_failed(db, run_id, str(e))
                    await db.commit()
                except Exception:
                    await db.rollback()
                yield {
                    "event": "message",
                    "data": json.dumps({
                        "type": "execution_error",
                        "data": {"message": str(e)},
                    }),
                }

    return EventSourceResponse(event_generator())
