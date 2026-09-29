export interface User {
  id: string;
  email: string;
  nickname: string;
  avatar: string | null;
  role: "user" | "admin";
  status: "active" | "banned";
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
}

export interface WorkflowTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string;
  cover_image: string | null;
  workflow_json: Record<string, unknown>;
  form_schema: FormField[];
  input_nodes: Record<string, InputNodeConfig>;
  output_nodes: Record<string, OutputNodeConfig>;
  is_public: boolean;
  status: "draft" | "pending" | "approved" | "rejected";
  run_count: number;
  credits_per_run?: number;
  created_at: string;
  updated_at: string;
}

export interface FormField {
  node_id: string;
  field: string;
  type: "textarea" | "text" | "slider" | "select" | "seed" | "image_upload" | "number";
  label: string;
  default: unknown;
  required?: boolean;
  options?: unknown[];
  min?: number;
  max?: number;
  step?: number;
  group?: "basic" | "advanced";
  visible?: boolean;
}

export interface InputNodeConfig {
  node_id: string;
  class_type: string;
  fields: string[];
}

export interface OutputNodeConfig {
  type: "image" | "video" | "audio" | "text";
  filename_prefix?: string;
}

export interface WorkflowRun {
  id: string;
  template_id: string;
  template_name?: string;
  user_id: string;
  input_data: Record<string, unknown>;
  status: "pending" | "running" | "success" | "failed";
  prompt_id: string | null;
  result_data: RunResult | null;
  credits_consumed: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface RunResult {
  images?: Array<{
    url: string;
    filename: string;
  }>;
  outputs?: Record<string, unknown>;
}

export interface CreditAccount {
  id: string;
  user_id: string;
  balance: number;
  total_recharged: number;
  total_consumed: number;
  total_gifted: number;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: "recharge" | "consume" | "gift" | "refund" | "expire";
  amount: number;
  balance_after: number;
  reference_type: string;
  reference_id: string;
  description: string;
  created_at: string;
}

export interface WorkflowPricing {
  id: string;
  template_id: string;
  credits_per_run: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SSEEvent {
  type: "connected" | "waiting" | "progress" | "executing" | "executed" | "execution_error" | "execution_success" | "node_start" | "node_end";
  data: unknown;
}
