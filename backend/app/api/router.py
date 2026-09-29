from fastapi import APIRouter
from app.api.v1 import auth, workflows, runs, credits, admin, stream, upload

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)
router.include_router(workflows.router)
router.include_router(runs.router)
router.include_router(credits.router)
router.include_router(admin.router)
router.include_router(stream.router)
router.include_router(upload.router)
