from pydantic import BaseModel
from datetime import datetime


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class UserStatusUpdate(BaseModel):
    status: str


class WorkflowStatusUpdate(BaseModel):
    status: str


class WorkflowPricingUpdate(BaseModel):
    credits_per_run: int


class GrantWorkflowRequest(BaseModel):
    user_id: str


class SystemConfigUpdate(BaseModel):
    value: str = ""


ALLOWED_CONFIG_KEYS = {"comfyui_url"}


class AdminStatsOverview(BaseModel):
    total_users: int
    total_workflows: int
    total_runs: int
    total_credits_issued: int
    total_credits_consumed: int
