from pydantic import BaseModel, Field
from datetime import datetime


class FormFieldSchema(BaseModel):
    node_id: str
    field: str
    type: str
    label: str
    default: object = None
    required: bool = False
    options: list | None = None
    min: float | None = None
    max: float | None = None
    step: float | None = None
    group: str | None = None
    visible: bool = True


class WorkflowParseRequest(BaseModel):
    workflow_json: dict


class WorkflowParseResponse(BaseModel):
    form_schema: list[FormFieldSchema]
    workflow_json: dict


class WorkflowCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    workflow_json: dict = Field(..., max_length=100000)
    form_schema: list[FormFieldSchema] | None = None


class WorkflowUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    is_public: bool | None = None


class WorkflowResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str | None
    cover_image: str | None
    workflow_json: dict
    form_schema: list[FormFieldSchema] | None
    input_nodes: dict | None
    output_nodes: dict | None
    is_public: bool
    status: str
    run_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowRunRequest(BaseModel):
    input_data: dict


class RunResultImage(BaseModel):
    url: str
    filename: str


class RunResult(BaseModel):
    images: list[RunResultImage] | None = None
    outputs: dict | None = None


class WorkflowRunResponse(BaseModel):
    id: str
    template_id: str
    user_id: str
    input_data: dict | None
    status: str
    prompt_id: str | None
    result_data: RunResult | None
    credits_consumed: int
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    pages: int
