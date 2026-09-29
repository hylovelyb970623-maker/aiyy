# AIYY Docker 部署指南（飞牛 NAS）

## 1. 上传项目

将整个 `aiyy` 项目文件夹上传到飞牛 NAS，建议路径：
```
/vol1/docker/aiyy/
```

上传时可以跳过以下文件夹（减小体积）：
- `frontend/.next/`
- `frontend/node_modules/`
- `backend/__pycache__/`
- `backend/storage/`
- `backend/aiyy.db`
- `.trae/`

## 2. SSH 登录飞牛

```bash
ssh admin@NAS的IP地址
```

## 3. 进入项目目录

```bash
cd /vol1/docker/aiyy
```

## 4. 确认 .env 文件

```bash
cat .env
```

先复制一份环境变量文件再填写：

```bash
cp .env.example .env
```

必须修改以下两项（示例）：
```
PORT=80
JWT_SECRET=请改成你自己的随机长字符串
ADMIN_ACCOUNT=你的管理员账号（如 admin@example.com）
ADMIN_PASSWORD=你的管理员密码（强密码）
DEFAULT_CREDITS_ON_SIGNUP=100
DEFAULT_CREDITS_PER_RUN=1
```

ComfyUI 地址不需要在这里改，部署后在管理后台的 **系统设置** 页面在线修改即可，立即生效。

## 5. 构建并启动

```bash
docker-compose up -d --build
```

首次构建需要下载依赖和编译，大约 5-10 分钟。

## 6. 查看状态

```bash
# 查看容器运行状态
docker-compose ps

# 查看后端日志
docker-compose logs backend

# 查看前端日志
docker-compose logs frontend

# 查看 Nginx 日志
docker-compose logs nginx

# 查看所有日志
docker-compose logs -f
```

## 7. 访问服务

- 用户前台：`http://NAS的IP`
- 管理后台：`http://NAS的IP/admin/login`
- 管理员账号：你在 `.env` 中设置的 `ADMIN_ACCOUNT`
- 管理员密码：你在 `.env` 中设置的 `ADMIN_PASSWORD`
- API 文档：`http://NAS的IP/docs`

## 8. 常用运维命令

```bash
# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重新构建（代码更新后）
docker-compose up -d --build

# 查看数据库数据持久化目录
docker volume inspect aiyy_backend-data
docker volume inspect aiyy_backend-storage

# 清理旧镜像
docker image prune -f
```

## 9. 数据备份

数据库和文件存储在 Docker Volume 中，备份方法：

```bash
# 查看卷路径
docker volume inspect aiyy_backend-data
docker volume inspect aiyy_backend-storage

# 备份数据库
cp /var/lib/docker/volumes/aiyy_backend-data/_data/aiyy.db ./backup/

# 备份图片文件
tar -czf storage-backup.tar.gz /var/lib/docker/volumes/aiyy_backend-storage/_data/
```

## 10. 端口修改

如需改端口（例如改为 8080），编辑 `.env`：
```
PORT=8080
```
然后重启：
```bash
docker-compose up -d
```

## 故障排查

| 问题 | 解决方法 |
|------|---------|
| 容器启动失败 | `docker-compose logs backend` 查看错误日志 |
| 前端白屏 | `docker-compose logs frontend` 检查构建是否成功 |
| API 502 | 检查后端是否启动完成，`docker-compose ps` 确认状态 |
| ComfyUI 连不上 | 确认 ComfyUI 已启动，在管理后台 **系统设置** 中修改地址 |
| 端口被占用 | 修改 `.env` 中的 `PORT` 为其他端口 |
