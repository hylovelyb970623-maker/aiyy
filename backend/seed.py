import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import async_session_maker, engine, Base
from app.core.security import get_password_hash
from app.models.user import User
from app.models.credit import CreditAccount
from app.core.config import get_settings

settings = get_settings()

ADMIN_ACCOUNT = os.environ.get("ADMIN_ACCOUNT", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as db:
        from sqlalchemy import select

        result = await db.execute(select(User).where(User.email == "test@aiyy.com"))
        if result.scalar_one_or_none():
            print("测试用户已存在，跳过创建")
        else:
            test_user = User(
                email="test@aiyy.com",
                password_hash=get_password_hash("123456"),
                nickname="测试用户",
                role="user",
                status="active",
            )
            db.add(test_user)
            await db.flush()

            account = CreditAccount(
                user_id=test_user.id,
                balance=1000,
                total_recharged=0,
                total_consumed=0,
                total_gifted=1000,
            )
            db.add(account)
            print(f"测试用户创建成功: test@aiyy.com / 123456 (1000积分)")

        result = await db.execute(select(User).where(User.email == ADMIN_ACCOUNT))
        if result.scalar_one_or_none():
            print("管理员已存在，跳过创建")
        else:
            admin_user = User(
                email=ADMIN_ACCOUNT,
                password_hash=get_password_hash(ADMIN_PASSWORD),
                nickname="管理员",
                role="admin",
                status="active",
            )
            db.add(admin_user)
            await db.flush()

            admin_account = CreditAccount(
                user_id=admin_user.id,
                balance=99999,
                total_recharged=0,
                total_consumed=0,
                total_gifted=99999,
            )
            db.add(admin_account)
            print(f"管理员创建成功: {ADMIN_ACCOUNT} / {ADMIN_PASSWORD} (99999积分)")

        await db.commit()
        print("种子数据初始化完成！")


if __name__ == "__main__":
    asyncio.run(seed())
