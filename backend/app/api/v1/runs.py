import json
import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.workflow import WorkflowRun, WorkflowTemplate
from app.schemas.workflow import PaginatedResponse

router = APIRouter(prefix="/runs", tags=["运行记录"])


@router.get("", response_model=PaginatedResponse)
async def list_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count_result = await db.execute(
        select(func.count()).where(WorkflowRun.user_id == user.id)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(WorkflowRun, WorkflowTemplate)
        .join(WorkflowTemplate, WorkflowRun.template_id == WorkflowTemplate.id)
        .where(WorkflowRun.user_id == user.id)
        .order_by(WorkflowRun.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = result.all()

    items = []
    for run, wf in rows:
        result_data = json.loads(run.result_data) if run.result_data else None
        input_data = json.loads(run.input_data) if run.input_data else None
        items.append({
            "id": run.id,
            "template_id": run.template_id,
            "template_name": wf.name,
            "user_id": run.user_id,
            "input_data": input_data,
            "status": run.status,
            "prompt_id": run.prompt_id,
            "result_data": result_data,
            "credits_consumed": run.credits_consumed,
            "error_message": run.error_message,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
            "created_at": run.created_at,
        })

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/{run_id}")
async def get_run(
    run_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowRun).where(WorkflowRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="运行记录不存在")
    if run.user_id != user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="无权访问")

    result_data = json.loads(run.result_data) if run.result_data else None
    input_data = json.loads(run.input_data) if run.input_data else None

    return {
        "id": run.id,
        "template_id": run.template_id,
        "user_id": run.user_id,
        "input_data": input_data,
        "status": run.status,
        "prompt_id": run.prompt_id,
        "result_data": result_data,
        "credits_consumed": run.credits_consumed,
        "error_message": run.error_message,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "created_at": run.created_at,
    }
