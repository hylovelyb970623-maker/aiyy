import json
import math
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.workflow import WorkflowTemplate, WorkflowRun, WorkflowPermission
from app.models.credit import WorkflowPricing
from app.services.workflow_parser import workflow_parser
from app.services.workflow_runner import workflow_runner
from app.services.credit_service import credit_service, InsufficientCreditsError
from app.services.comfyui_client import comfyui_client
from app.schemas.workflow import (
    WorkflowParseRequest,
    WorkflowParseResponse,
    WorkflowCreateRequest,
    WorkflowUpdateRequest,
    WorkflowResponse,
    WorkflowRunRequest,
    WorkflowRunResponse,
    PaginatedResponse,
)

router = APIRouter(prefix="/workflows", tags=["工作流"])


@router.get("/comfyui/status")
async def comfyui_status(
    user: User = Depends(get_current_user),
):
    try:
        stats = await comfyui_client.get_system_stats()
        return {
            "connected": True,
            "data": {
                "system": stats.get("system", {}),
                "devices": stats.get("devices", []),
            },
        }
    except Exception:
        return {
            "connected": False,
            "error": "ComfyUI 服务不可用",
        }


@router.post("/parse")
async def parse_workflow(
    req: WorkflowParseRequest,
    user: User = Depends(get_current_user),
):
    workflow_json = req.workflow_json
    if workflow_parser.is_frontend_format(workflow_json):
        workflow_json = workflow_parser.convert_frontend_to_api(workflow_json)
    workflow_json = workflow_parser.strip_meta(workflow_json)
    form_schema = workflow_parser.parse(workflow_json)
    return WorkflowParseResponse(
        form_schema=form_schema,
        workflow_json=workflow_json,
    )


@router.post("", response_model=WorkflowResponse)
async def create_workflow(
    req: WorkflowCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow_json = req.workflow_json
    if workflow_parser.is_frontend_format(workflow_json):
        workflow_json = workflow_parser.convert_frontend_to_api(workflow_json)
    workflow_json = workflow_parser.strip_meta(workflow_json)

    if req.form_schema:
        form_schema = req.form_schema
    else:
        form_schema = workflow_parser.parse(workflow_json)
    input_nodes = workflow_parser.get_input_nodes(workflow_json)
    output_nodes = workflow_parser.get_output_nodes(workflow_json)

    workflow = WorkflowTemplate(
        user_id=user.id,
        name=req.name,
        description=req.description,
        workflow_json=json.dumps(workflow_json),
        form_schema=json.dumps([f.model_dump() for f in form_schema]),
        input_nodes=json.dumps(input_nodes),
        output_nodes=json.dumps(output_nodes),
        status="approved" if user.role == "admin" else "draft",
    )
    db.add(workflow)
    await db.flush()

    pricing = WorkflowPricing(
        template_id=workflow.id,
        credits_per_run=1,
    )
    db.add(pricing)
    await db.commit()

    return _to_workflow_response(workflow)


@router.get("", response_model=PaginatedResponse)
async def list_my_workflows(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count_result = await db.execute(
        select(func.count()).where(WorkflowTemplate.user_id == user.id)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(WorkflowTemplate)
        .where(WorkflowTemplate.user_id == user.id)
        .order_by(WorkflowTemplate.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    workflows = result.scalars().all()

    return PaginatedResponse(
        items=[_to_workflow_response(w) for w in workflows],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/available", response_model=PaginatedResponse)
async def list_available_workflows(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    perm_query = select(WorkflowPermission.workflow_id).where(
        WorkflowPermission.user_id == user.id
    )
    count_result = await db.execute(
        select(func.count()).select_from(WorkflowTemplate).where(
            WorkflowTemplate.id.in_(perm_query),
            WorkflowTemplate.status == "approved",
        )
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(WorkflowTemplate, WorkflowPricing)
        .outerjoin(WorkflowPricing, WorkflowTemplate.id == WorkflowPricing.template_id)
        .where(
            WorkflowTemplate.id.in_(perm_query),
            WorkflowTemplate.status == "approved",
        )
        .order_by(WorkflowTemplate.run_count.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = result.all()

    items = []
    for wf, pricing in rows:
        resp = _to_workflow_response(wf, credits_per_run=pricing.credits_per_run if pricing else 1)
        items.append(resp)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="工作流不存在")

    if user.role != "admin" and workflow.user_id != user.id:
        perm_result = await db.execute(
            select(WorkflowPermission).where(
                WorkflowPermission.workflow_id == workflow_id,
                WorkflowPermission.user_id == user.id,
            )
        )
        if not perm_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="无权访问此应用")

    pricing_result = await db.execute(
        select(WorkflowPricing).where(WorkflowPricing.template_id == workflow_id)
    )
    pricing = pricing_result.scalar_one_or_none()
    credits = pricing.credits_per_run if pricing else 1

    return _to_workflow_response(workflow, credits_per_run=credits)


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    req: WorkflowUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="工作流不存在")
    if workflow.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权修改")

    if req.name is not None:
        workflow.name = req.name
    if req.description is not None:
        workflow.description = req.description
    if req.is_public is not None:
        workflow.is_public = req.is_public
        if req.is_public and workflow.status == "draft":
            workflow.status = "pending"

    await db.flush()
    await db.commit()
    return _to_workflow_response(workflow)


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="工作流不存在")
    if workflow.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权删除")

    await db.delete(workflow)
    await db.commit()
    return {"message": "删除成功"}


@router.post("/{workflow_id}/run", response_model=WorkflowRunResponse)
async def run_workflow(
    workflow_id: str,
    req: WorkflowRunRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="工作流不存在")

    if user.role != "admin":
        perm_result = await db.execute(
            select(WorkflowPermission).where(
                WorkflowPermission.workflow_id == workflow_id,
                WorkflowPermission.user_id == user.id,
            )
        )
        if not perm_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="无权使用此应用")

    pricing_result = await db.execute(
        select(WorkflowPricing).where(WorkflowPricing.template_id == workflow_id)
    )
    pricing = pricing_result.scalar_one_or_none()
    credits_per_run = pricing.credits_per_run if pricing else 1

    try:
        await credit_service.pre_deduct(
            db, user.id, credits_per_run, "workflow_run", "pending", f"运行工作流: {workflow.name}"
        )
    except InsufficientCreditsError as e:
        raise HTTPException(status_code=402, detail=str(e))

    run = WorkflowRun(
        template_id=workflow_id,
        user_id=user.id,
        input_data=json.dumps(req.input_data),
        status="pending",
        credits_consumed=credits_per_run,
    )
    db.add(run)
    await db.flush()

    workflow_json = json.loads(workflow.workflow_json)
    if workflow_parser.is_frontend_format(workflow_json):
        workflow_json = workflow_parser.convert_frontend_to_api(workflow_json)
    workflow_json = workflow_parser.strip_meta(workflow_json)
    try:
        prompt_id = await workflow_runner.submit_run(
            db, run.id, workflow_json, req.input_data
        )
    except Exception as e:
        await credit_service.refund(
            db, user.id, credits_per_run, "workflow_run", run.id, "工作流提交失败退款"
        )
        run.status = "failed"
        run.error_message = str(e)
        await db.flush()
        await db.commit()
        raise HTTPException(status_code=500, detail=f"提交工作流失败: {str(e)}")

    await db.commit()
    return _to_run_response(run)


def _to_workflow_response(wf: WorkflowTemplate, credits_per_run: int | None = None) -> dict:
    form_schema = json.loads(wf.form_schema) if wf.form_schema else []
    input_nodes = json.loads(wf.input_nodes) if wf.input_nodes else {}
    output_nodes = json.loads(wf.output_nodes) if wf.output_nodes else {}
    workflow_json = json.loads(wf.workflow_json) if isinstance(wf.workflow_json, str) else wf.workflow_json

    if credits_per_run is None:
        credits_per_run = 1

    return {
        "id": wf.id,
        "user_id": wf.user_id,
        "name": wf.name,
        "description": wf.description,
        "cover_image": wf.cover_image,
        "workflow_json": workflow_json,
        "form_schema": form_schema,
        "input_nodes": input_nodes,
        "output_nodes": output_nodes,
        "is_public": wf.is_public,
        "status": wf.status,
        "run_count": wf.run_count,
        "credits_per_run": credits_per_run,
        "created_at": wf.created_at,
        "updated_at": wf.updated_at,
    }


def _to_run_response(run: WorkflowRun) -> dict:
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
