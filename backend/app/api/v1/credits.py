import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.credit import CreditAccount, CreditTransaction
from app.services.credit_service import credit_service, InsufficientCreditsError
from app.schemas.credit import (
    CreditAccountResponse,
    CreditTransactionResponse,
    CreditAdjustRequest,
    RechargeRequest,
)
from app.schemas.workflow import PaginatedResponse

router = APIRouter(prefix="/credits", tags=["积分"])


@router.get("/balance", response_model=CreditAccountResponse)
async def get_balance(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditAccount).where(CreditAccount.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if account is None:
        account = await credit_service.get_or_create_account(db, user.id)
    return account


@router.get("/transactions", response_model=PaginatedResponse)
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count_result = await db.execute(
        select(func.count()).where(CreditTransaction.user_id == user.id)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == user.id)
        .order_by(CreditTransaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    transactions = result.scalars().all()

    return PaginatedResponse(
        items=[
            CreditTransactionResponse.model_validate(tx) for tx in transactions
        ],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("/recharge")
async def recharge(
    req: RechargeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="充值金额必须大于0")

    transaction = await credit_service.add_credits(
        db, user.id, req.amount, "recharge", "manual_recharge", user.id,
        f"手动充值 {req.amount} 积分",
    )
    return {"message": "充值成功", "balance_after": transaction.balance_after}
