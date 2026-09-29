# AIYY - ComfyUI 工作流转 AI 应用平台

将 ComfyUI 工作流快速转化为可分享的 AI 应用。管理员通过后台创建和管理工作流应用，分配使用权限给用户，用户通过简洁的界面使用 AI 应用。

## 架构概览

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   前端 Next.js │────▶│  后端 FastAPI │────▶│  ComfyUI 服务  │
│  localhost:3000│     │  localhost:8000│     │ localhost:8188 │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  SQLite 数据库 │
                    │   aiyy.db    │
                    └─────────────┘
```

## 功能模块

### 用户端
- **我的应用** - 查看管理员分配的可使用工作流应用
- **应用执行** - 填写表单参数，一键执行工作流
- **实时进度** - SSE 实时推送执行进度和状态
- **结果查看** - 图片预览、放大查看、单张/批量下载
- **运行历史** - 查看所有运行记录，支持下载历史结果
- **积分系统** - 执行消耗积分，失败自动退款

### 管理后台
- **工作流管理** - 上传 ComfyUI JSON 创建应用，自动审核通过
- **字段配置** - 自定义表单字段标题、可见性、分组
- **权限分配** - 按用户或按工作流分配使用权限
- **用户管理** - 查看/禁用用户，调整积分
- **ComfyUI 状态** - 实时检测连接状态、GPU 信息、显存使用

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router, Turbopack) |
| UI 组件 | shadcn/ui + Tailwind CSS 4 |
| 状态管理 | Zustand (persist) + React Query |
| 后端框架 | FastAPI + Uvicorn |
| 数据库 | SQLite (aiosqlite) + SQLAlchemy 2.0 (async) |
| 认证 | JWT (python-jose + bcrypt) |
| 实时通信 | SSE (sse-starlette) |
| HTTP 客户端 | httpx (async) |

## 项目结构

```
aiyy/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口，CORS，静态文件
│   │   ├── core/
│   │   │   ├── config.py        # 配置（环境变量）
│   │   │   ├── database.py      # 数据库连接
│   │   │   ├── security.py      # JWT 生成/验证，密码哈希
│   │   │   └── dependencies.py  # 依赖注入
│   │   ├── models/
│   │   │   ├── user.py          # 用户模型
│   │   │   ├── workflow.py      # 工作流、运行记录、权限模型
│   │   │   ├── credit.py        # 积分账户、交易记录
│   │   │   └── admin.py         # 管理员审计日志
│   │   ├── api/v1/
│   │   │   ├── auth.py          # 注册/登录/刷新Token
│   │   │   ├── workflows.py     # 工作流 CRUD、解析、运行、ComfyUI 状态
│   │   │   ├── runs.py          # 运行历史查询
│   │   │   ├── stream.py        # SSE 实时进度推送
│   │   │   ├── upload.py        # 图片上传
│   │   │   ├── credits.py       # 积分余额/交易记录
│   │   │   └── admin.py         # 管理员 API（用户/工作流/权限管理）
│   │   ├── services/
│   │   │   ├── comfyui_client.py    # ComfyUI HTTP API 客户端
│   │   │   ├── workflow_parser.py   # 工作流 JSON 解析，表单字段提取
│   │   │   ├── workflow_runner.py   # 工作流执行，结果收集
│   │   │   └── credit_service.py    # 积分扣减/退款/交易记录
│   │   └── schemas/             # Pydantic 请求/响应模型
│   ├── storage/                 # 上传文件和生成结果存储
│   ├── aiyy.db                  # SQLite 数据库文件
│   ├── pyproject.toml           # Python 依赖
│   └── .env                     # 环境变量配置
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/     # 用户端页面
│   │   │   │   ├── page.tsx           # 我的应用（首页）
│   │   │   │   ├── layout.tsx         # 用户端布局（侧边栏）
│   │   │   │   ├── workshop/[id]/     # 应用执行页
│   │   │   │   ├── history/           # 运行历史
│   │   │   │   └── credits/           # 积分中心
│   │   │   ├── admin/           # 管理后台页面
│   │   │   │   ├── login/            # 管理员登录
│   │   │   │   ├── layout.tsx        # 管理后台布局
│   │   │   │   ├── users/            # 用户管理
│   │   │   │   ├── workflows/        # 工作流管理
│   │   │   │   │   └── create/       # 创建工作流
│   │   │   │   ├── permissions/      # 权限分配
│   │   │   │   ├── credits/          # 积分管理
│   │   │   │   └── stats/            # 数据统计
│   │   │   ├── login/           # 用户登录
│   │   │   └── register/        # 用户注册
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui 基础组件
│   │   │   └── workflow/        # 工作流相关组件
│   │   │       ├── workflow-uploader.tsx   # JSON 上传/拖拽
│   │   │       ├── workflow-visualizer.tsx # 工作流可视化
│   │   │       ├── workflow-form.tsx      # 动态表单渲染
│   │   │       └── run-progress.tsx       # 执行进度显示
│   │   ├── lib/
│   │   │   └── api.ts           # API 客户端（封装 fetch）
│   │   ├── stores/
│   │   │   ├── auth-store.ts    # 认证状态（persist）
│   │   │   ├── credit-store.ts  # 积分状态
│   │   │   └── workflow-store.ts # 工作流执行状态
│   │   └── types/               # TypeScript 类型定义
│   └── package.json
│
└── docker-compose.yml           # Docker 编排（可选）
```

## 快速启动

### 前置条件

- Python 3.10+
- Node.js 18+
- ComfyUI 运行在 `localhost:8188`（执行工作流需要）

### 1. 启动后端

```bash
cd backend

# 安装依赖
pip install -e .

# 启动服务（含热重载）
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

后端 API 地址：`http://localhost:8000`

### 2. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务
npm run dev
```

前端页面地址：`http://localhost:3000`

### 3. 启动 ComfyUI

```bash
# 在 ComfyUI 目录下启动
python main.py --listen 0.0.0.0 --port 8188
```

## 默认账号

| 角色 | 邮箱 | 密码 | 说明 |
|------|------|------|------|
| 管理员 | admin@aiyy.com | admin123 | 管理后台登录 |
| 用户 | test@aiyy.com | test123456 | 用户端登录 |
| 用户 | e2e@test.com | test123456 | 测试用户（无权限） |

## 环境变量

### 后端 (`backend/.env`)

```env
# 数据库（默认 SQLite）
DATABASE_URL=sqlite+aiosqlite:///./aiyy.db

# JWT 密钥（生产环境务必修改）
JWT_SECRET=aiyy-secret-key-change-in-production

# ComfyUI 服务地址
COMFYUI_URL=http://127.0.0.1:8188

# 文件存储路径
STORAGE_PATH=./storage

# 结果图片访问地址
RESULT_IMAGE_BASE_URL=http://localhost:8000/static/results

# CORS 允许的前端地址
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]

# 新用户注册赠送积分
DEFAULT_CREDITS_ON_SIGNUP=100
```

### 前端 (`frontend/.env.local`)

```env
# 后端 API 地址（可选，默认 http://localhost:8000）
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API 接口一览

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/register` | 用户注册 |
| POST | `/api/v1/auth/login` | 用户登录 |
| GET | `/api/v1/auth/me` | 获取当前用户 |
| POST | `/api/v1/auth/refresh` | 刷新 Token |

### 工作流
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/workflows/parse` | 解析工作流 JSON |
| POST | `/api/v1/workflows` | 创建工作流 |
| GET | `/api/v1/workflows/available` | 获取可用工作流（需权限） |
| GET | `/api/v1/workflows/{id}` | 获取工作流详情（需权限） |
| POST | `/api/v1/workflows/{id}/run` | 执行工作流（需权限） |
| GET | `/api/v1/workflows/comfyui/status` | ComfyUI 连接状态 |

### 运行记录
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/runs` | 运行历史列表 |
| GET | `/api/v1/runs/{id}/stream` | SSE 执行进度推送 |

### 积分
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/credits/balance` | 积分余额 |
| GET | `/api/v1/credits/transactions` | 交易记录 |

### 管理员
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/admin/login` | 管理员登录 |
| GET | `/api/v1/admin/users` | 用户列表 |
| PUT | `/api/v1/admin/users/{id}/status` | 修改用户状态 |
| GET | `/api/v1/admin/workflows` | 工作流列表 |
| PUT | `/api/v1/admin/workflows/{id}/status` | 审核工作流 |
| POST | `/api/v1/admin/workflows/{id}/grant` | 授权用户使用工作流 |
| DELETE | `/api/v1/admin/workflows/{id}/grant/{user_id}` | 撤销用户权限 |
| GET | `/api/v1/admin/workflows/{id}/users` | 查看工作流已授权用户 |
| GET | `/api/v1/admin/users/{id}/workflows` | 查看用户已授权工作流 |

## 核心流程

### 工作流执行流程

```
1. 用户点击"运行"
   └─▶ 前端 POST /workflows/{id}/run
        ├─▶ 后端检查用户权限
        ├─▶ 预扣积分
        ├─▶ 注入用户参数到工作流 JSON
        ├─▶ 提交到 ComfyUI /prompt
        └─▶ 返回 run_id + prompt_id

2. 前端建立 SSE 连接
   └─▶ GET /runs/{id}/stream?token=xxx
        ├─▶ 后端轮询 ComfyUI /history/{prompt_id}
        ├─▶ 推送 progress 事件
        └─▶ 完成时：
             ├─▶ 成功 → 保存结果图片，确认扣积分，推送 execution_success
             └─▶ 失败 → 退还积分，推送 execution_error
```

### 权限控制流程

```
管理员在后台创建工作流（自动 approved）
   └─▶ 管理员分配权限给用户
        └─▶ 用户在"我的应用"看到已分配的工作流
             ├─▶ 有权限 → 可以查看和执行
             └─▶ 无权限 → 看不到，直接访问返回 403
```

## 数据库表

| 表名 | 说明 |
|------|------|
| users | 用户（含管理员 role=admin） |
| workflow_templates | 工作流模板 |
| workflow_runs | 运行记录 |
| workflow_permissions | 工作流使用权限 |
| workflow_pricings | 工作流定价 |
| credit_accounts | 积分账户 |
| credit_transactions | 积分交易记录 |
| admin_audit_logs | 管理员操作审计日志 |
