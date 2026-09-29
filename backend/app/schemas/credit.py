from pydantic import BaseModel
from datetime import datetime


class CreditAccountResponse(BaseModel):
    id: str
    user_id: str
    balance: int
    total_recharged: int
    total_consumed: int
    total_gifted: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreditTransactionResponse(BaseModel):
    id: str
    user_id: str
    type: str
    amount: int
    balance_after: int
    reference_type: str
    reference_id: str
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CreditAdjustRequest(BaseModel):
    amount: int
    type: str = "gift"
    description: str | None = None


class RechargeRequest(BaseModel):
    amount: int
    payment_method: str | None = None
