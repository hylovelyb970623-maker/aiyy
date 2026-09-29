import math
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.dependencies import get_admin_user
from app.core.security import verify_password, create_access_token, create_refresh_token
from app.models.user import User
from app.models.workflow import WorkflowTemplate, WorkflowPermission, WorkflowRun
from app.models.credit import CreditAccount, CreditTransaction, WorkflowPricing
from app.models.admin import AdminAuditLog
from app.models.system_config import SystemConfig
from app.services.credit_service import credit_service
from app.schemas.admin import AdminLoginRequest, UserStatusUpdate, WorkflowStatusUpdate, GrantWorkflowRequest, WorkflowPricingUpdate, SystemConfigUpdate, ALLOWED_CONFIG_KEYS
from app.schemas.credit import CreditAdjustRequest
from app.schemas.workflow import PaginatedResponse

router = APIRouter(prefix="/admin", tags=["管理后台"])


@router.post("/login")
async def admin_login(
    req: AdminLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or user.role != "admin":
        raise HTTPException(status_code=401, detail="管理员账号或密码错误")
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="管理员账号或密码错误")

    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.get("/users", response_model=PaginatedResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=50),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(User, CreditAccount).outerjoin(
        CreditAccount, User.id == CreditAccount.user_id
    )
    count_query = select(func.count()).select_from(User)

    if search:
        search_param = f"%{search}%"
        base_query = base_query.where(
            User.email.ilike(search_param) | User.nickname.ilike(search_param)
        )
        count_query = count_query.where(
            User.email.ilike(search_param) | User.nickname.ilike(search_param)
        )

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        base_query.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = result.all()

    return PaginatedResponse(
        items=[
            {
                "id": u.id,
                "email": u.email,
                "nickname": u.nickname,
                "avatar": u.avatar,
                "role": u.role,
                "status": u.status,
                "balance": ca.balance if ca else 0,
                "total_consumed": ca.total_consumed if ca else 0,
                "created_at": u.created_at,
                "updated_at": u.updated_at,
            }
            for u, ca in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    req: UserStatusUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="不能修改自己的状态")

    user.status = req.status
    await db.flush()

    log = AdminAuditLog(
        admin_id=admin.id,
        action="update_user_status",
        target_type="user",
        target_id=user_id,
        detail=f"状态改为 {req.status}",
    )
    db.add(log)
    await db.commit()

    return {"message": "状态更新成功"}


@router.post("/users/{user_id}/credits")
async def adjust_user_credits(
    user_id: str,
    req: CreditAdjustRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    transaction = await credit_service.add_credits(
        db, user_id, req.amount, req.type, "admin_adjust", admin.id,
        req.description or f"管理员调整积分: {req.amount}",
    )

    log = AdminAuditLog(
        admin_id=admin.id,
        action="adjust_credits",
        target_type="user",
        target_id=user_id,
        detail=f"调整积分 {req.amount}",
    )
    db.add(log)
    await db.commit()

    return {"message": "积分调整成功", "balance_after": transaction.balance_after}


@router.get("/workflows", response_model=PaginatedResponse)
async def list_all_workflows(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    count_result = await db.execute(select(func.count()).select_from(WorkflowTemplate))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(WorkflowTemplate, WorkflowPricing, User)
        .outerjoin(WorkflowPricing, WorkflowTemplate.id == WorkflowPricing.template_id)
        .join(User, WorkflowTemplate.user_id == User.id)
        .order_by(WorkflowTemplate.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = result.all()

    items = []
    for wf, pricing, creator in rows:
        form_schema = json.loads(wf.form_schema) if wf.form_schema else []
        items.append({
            "id": wf.id,
            "user_id": wf.user_id,
            "creator_name": creator.nickname or creator.email,
            "name": wf.name,
            "description": wf.description,
            "cover_image": wf.cover_image,
            "workflow_json": json.loads(wf.workflow_json) if isinstance(wf.workflow_json, str) else wf.workflow_json,
            "form_schema": form_schema,
            "input_nodes": json.loads(wf.input_nodes) if wf.input_nodes else {},
            "output_nodes": json.loads(wf.output_nodes) if wf.output_nodes else {},
            "is_public": wf.is_public,
            "status": wf.status,
            "run_count": wf.run_count,
            "credits_per_run": pricing.credits_per_run if pricing else 1,
            "created_at": wf.created_at,
            "updated_at": wf.updated_at,
        })

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.put("/workflows/{workflow_id}/status")
async def update_workflow_status(
    workflow_id: str,
    req: WorkflowStatusUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="工作流不存在")

    workflow.status = req.status
    if req.status == "approved":
        workflow.is_public = True
    await db.flush()

    log = AdminAuditLog(
        admin_id=admin.id,
        action="update_workflow_status",
        target_type="workflow",
        target_id=workflow_id,
        detail=f"状态改为 {req.status}",
    )
    db.add(log)
    await db.commit()

    return {"message": "状态更新成功"}


@router.delete("/workflows/{workflow_id}")
async def delete_workflow_admin(
    workflow_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="工作流不存在")

    pricing_result = await db.execute(
        select(WorkflowPricing).where(WorkflowPricing.template_id == workflow_id)
    )
    for pricing in pricing_result.scalars().all():
        await db.delete(pricing)

    perm_result = await db.execute(
        select(WorkflowPermission).where(WorkflowPermission.workflow_id == workflow_id)
    )
    for perm in perm_result.scalars().all():
        await db.delete(perm)

    await db.delete(workflow)

    log = AdminAuditLog(
        admin_id=admin.id,
        action="delete_workflow",
        target_type="workflow",
        target_id=workflow_id,
        detail=f"删除工作流: {workflow.name}",
    )
    db.add(log)
    await db.commit()

    return {"message": "删除成功"}


@router.get("/stats/overview")
async def stats_overview(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    total_workflows = (await db.execute(select(func.count()).select_from(WorkflowTemplate))).scalar() or 0
    total_runs = (await db.execute(select(func.count()).select_from(WorkflowRun))).scalar() or 0

    credits_issued = (await db.execute(
        select(func.coalesce(func.sum(CreditAccount.total_recharged), 0) +
               func.coalesce(func.sum(CreditAccount.total_gifted), 0))
    )).scalar() or 0
    credits_consumed = (await db.execute(
        select(func.coalesce(func.sum(CreditAccount.total_consumed), 0))
    )).scalar() or 0

    active_users = (await db.execute(
        select(func.count()).select_from(User).where(User.status == "active")
    )).scalar() or 0

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_workflows": total_workflows,
        "total_runs": total_runs,
        "credits_issued": credits_issued,
        "credits_consumed": credits_consumed,
    }


@router.get("/comfyui/status")
async def comfyui_status(
    admin: User = Depends(get_admin_user),
):
    from app.services.comfyui_client import comfyui_client
    try:
        stats = await comfyui_client.get_system_stats()
        return {"status": "online", "data": stats}
    except Exception as e:
        return {"status": "offline", "error": str(e)}


@router.post("/workflows/{workflow_id}/grant")
async def grant_workflow_to_user(
    workflow_id: str,
    req: GrantWorkflowRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.id == workflow_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="工作流不存在")

    result = await db.execute(select(User).where(User.id == req.user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="用户不存在")

    result = await db.execute(
        select(WorkflowPermission).where(
            WorkflowPermission.workflow_id == workflow_id,
            WorkflowPermission.user_id == req.user_id,
        )
    )
    if result.scalar_one_or_none():
        return {"message": "该用户已有此工作流权限"}

    permission = WorkflowPermission(
        workflow_id=workflow_id,
        user_id=req.user_id,
        granted_by=admin.id,
    )
    db.add(permission)

    log = AdminAuditLog(
        admin_id=admin.id,
        action="grant_workflow",
        target_type="workflow",
        target_id=workflow_id,
        detail=f"授权给用户 {req.user_id}",
    )
    db.add(log)
    await db.commit()

    return {"message": "授权成功"}


@router.delete("/workflows/{workflow_id}/grant/{user_id}")
async def revoke_workflow_from_user(
    workflow_id: str,
    user_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowPermission).where(
            WorkflowPermission.workflow_id == workflow_id,
            WorkflowPermission.user_id == user_id,
        )
    )
    permission = result.scalar_one_or_none()
    if not permission:
        raise HTTPException(status_code=404, detail="权限记录不存在")

    await db.delete(permission)

    log = AdminAuditLog(
        admin_id=admin.id,
        action="revoke_workflow",
        target_type="workflow",
        target_id=workflow_id,
        detail=f"撤销用户 {user_id} 的权限",
    )
    db.add(log)
    await db.commit()

    return {"message": "撤销成功"}


@router.get("/workflows/{workflow_id}/users")
async def list_workflow_users(
    workflow_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowPermission, User)
        .join(User, WorkflowPermission.user_id == User.id)
        .where(WorkflowPermission.workflow_id == workflow_id)
    )
    rows = result.all()

    return {
        "items": [
            {
                "permission_id": perm.id,
                "user_id": user.id,
                "email": user.email,
                "nickname": user.nickname,
                "granted_at": perm.created_at,
            }
            for perm, user in rows
        ]
    }


@router.get("/users/{user_id}/workflows")
async def list_user_workflows_admin(
    user_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowPermission, WorkflowTemplate)
        .join(WorkflowTemplate, WorkflowPermission.workflow_id == WorkflowTemplate.id)
        .where(WorkflowPermission.user_id == user_id)
    )
    rows = result.all()

    return {
        "items": [
            {
                "permission_id": perm.id,
                "workflow_id": wf.id,
                "name": wf.name,
                "description": wf.description,
                "status": wf.status,
                "granted_at": perm.created_at,
            }
            for perm, wf in rows
        ]
    }


@router.put("/workflows/{workflow_id}/pricing")
async def update_workflow_pricing(
    workflow_id: str,
    req: WorkflowPricingUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if req.credits_per_run < 0:
        raise HTTPException(status_code=400, detail="积分不能为负数")

    result = await db.execute(
        select(WorkflowPricing).where(WorkflowPricing.template_id == workflow_id)
    )
    pricing = result.scalar_one_or_none()
    if pricing:
        pricing.credits_per_run = req.credits_per_run
    else:
        pricing = WorkflowPricing(
            template_id=workflow_id,
            credits_per_run=req.credits_per_run,
        )
        db.add(pricing)

    log = AdminAuditLog(
        admin_id=admin.id,
        action="update_pricing",
        target_type="workflow",
        target_id=workflow_id,
        detail=f"每次运行积分改为 {req.credits_per_run}",
    )
    db.add(log)
    await db.commit()

    return {"message": "定价更新成功", "credits_per_run": req.credits_per_run}


@router.get("/config/{key}")
async def get_config(
    key: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if key not in ALLOWED_CONFIG_KEYS:
        raise HTTPException(status_code=400, detail="不支持的配置项")

    result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == key)
    )
    config = result.scalar_one_or_none()
    if config:
        return {"key": config.key, "value": config.value}
    return {"key": key, "value": None}


@router.put("/config/{key}")
async def set_config(
    key: str,
    req: SystemConfigUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if key not in ALLOWED_CONFIG_KEYS:
        raise HTTPException(status_code=400, detail="不支持的配置项")

    value = req.value.strip()

    if key == "comfyui_url" and value:
        import re
        if not re.match(r"^https?://[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=]+$", value):
            raise HTTPException(status_code=400, detail="请输入有效的 HTTP/HTTPS 地址")

    result = await db.execute(
        select(SystemConfig).where(SystemConfig.key == key)
    )
    config = result.scalar_one_or_none()
    if config:
        config.value = value
    else:
        config = SystemConfig(key=key, value=value)
        db.add(config)

    if key == "comfyui_url":
        from app.services.comfyui_client import comfyui_client
        comfyui_client.set_url(value)

    log = AdminAuditLog(
        admin_id=admin.id,
        action="update_config",
        target_type="system",
        target_id=key,
        detail=f"配置 {key} 已更新",
    )
    db.add(log)
    await db.commit()

    return {"key": key, "value": value}
