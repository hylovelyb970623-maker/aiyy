import os
import uuid
import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.core.dependencies import get_current_user
from app.models.user import User
from app.core.config import get_settings

router = APIRouter(prefix="/upload", tags=["上传"])
settings = get_settings()

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
MAX_FILE_SIZE = 10 * 1024 * 1024


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="请上传图片文件")

    raw_filename = file.filename or "image.png"
    ext = os.path.splitext(raw_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {ext}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过10MB")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="文件为空")

    safe_name = re.sub(r"[^\w\-.]", "_", os.path.splitext(raw_filename)[0])
    filename = f"{uuid.uuid4().hex}_{safe_name}{ext}"

    upload_dir = os.path.join(settings.STORAGE_PATH, "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    filepath = os.path.join(upload_dir, filename)
    filepath = os.path.realpath(filepath)
    if not filepath.startswith(os.path.realpath(upload_dir)):
        raise HTTPException(status_code=400, detail="非法文件路径")

    with open(filepath, "wb") as f:
        f.write(content)

    from app.services.comfyui_client import comfyui_client
    try:
        result = await comfyui_client.upload_image(content, filename)
        return {
            "name": result.get("name", filename),
            "subfolder": result.get("subfolder", ""),
            "type": result.get("type", "input"),
            "local_path": filepath,
        }
    except Exception:
        return {
            "name": filename,
            "subfolder": "",
            "type": "input",
            "local_path": filepath,
        }
