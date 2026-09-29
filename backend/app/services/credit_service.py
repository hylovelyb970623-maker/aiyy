from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.credit import CreditAccount, CreditTransaction
from app.models.user import User


class InsufficientCreditsError(Exception):
    pass


class CreditService:
    async def get_or_create_account(
        self, db: AsyncSession, user_id: str, initial_balance: int = 0
    ) -> CreditAccount:
        result = await db.execute(
            select(CreditAccount).where(CreditAccount.user_id == user_id)
        )
        account = result.scalar_one_or_none()
        if account is None:
            account = CreditAccount(
                user_id=user_id,
                balance=initial_balance,
                total_recharged=0,
                total_consumed=0,
                total_gifted=initial_balance,
            )
            db.add(account)
            await db.flush()
        return account

    async def pre_deduct(
        self,
        db: AsyncSession,
        user_id: str,
        amount: int,
        reference_type: str,
        reference_id: str,
        description: str = "",
    ) -> CreditTransaction:
        result = await db.execute(
            select(CreditAccount)
            .where(CreditAccount.user_id == user_id)
            .with_for_update()
        )
        account = result.scalar_one_or_none()
        if account is None:
            raise InsufficientCreditsError("积分账户不存在")
        if account.balance < amount:
            raise InsufficientCreditsError(
                f"积分不足，当前余额: {account.balance}，需要: {amount}"
            )

        account.balance -= amount
        account.total_consumed += amount

        transaction = CreditTransaction(
            user_id=user_id,
            type="consume",
            amount=-amount,
            balance_after=account.balance,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description or f"预扣积分 - {reference_type}",
        )
        db.add(transaction)
        await db.flush()
        return transaction

    async def settle(
        self,
        db: AsyncSession,
        user_id: str,
        pre_deduct_amount: int,
        actual_amount: int,
        reference_type: str,
        reference_id: str,
        description: str = "",
    ) -> CreditTransaction | None:
        if actual_amount >= pre_deduct_amount:
            return None

        refund_amount = pre_deduct_amount - actual_amount

        result = await db.execute(
            select(CreditAccount)
            .where(CreditAccount.user_id == user_id)
            .with_for_update()
        )
        account = result.scalar_one_or_none()
        if account is None:
            return None

        account.balance += refund_amount
        account.total_consumed -= refund_amount

        transaction = CreditTransaction(
            user_id=user_id,
            type="refund",
            amount=refund_amount,
            balance_after=account.balance,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description or f"结算退款 - 差额 {refund_amount}",
        )
        db.add(transaction)
        await db.flush()
        return transaction

    async def refund(
        self,
        db: AsyncSession,
        user_id: str,
        amount: int,
        reference_type: str,
        reference_id: str,
        description: str = "",
    ) -> CreditTransaction:
        result = await db.execute(
            select(CreditAccount)
            .where(CreditAccount.user_id == user_id)
            .with_for_update()
        )
        account = result.scalar_one_or_none()
        if account is None:
            raise InsufficientCreditsError("积分账户不存在")

        account.balance += amount
        account.total_consumed -= amount

        transaction = CreditTransaction(
            user_id=user_id,
            type="refund",
            amount=amount,
            balance_after=account.balance,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description or "全额退款",
        )
        db.add(transaction)
        await db.flush()
        return transaction

    async def add_credits(
        self,
        db: AsyncSession,
        user_id: str,
        amount: int,
        credit_type: str,
        reference_type: str,
        reference_id: str,
        description: str = "",
    ) -> CreditTransaction:
        result = await db.execute(
            select(CreditAccount)
            .where(CreditAccount.user_id == user_id)
            .with_for_update()
        )
        account = result.scalar_one_or_none()
        if account is None:
            account = await self.get_or_create_account(db, user_id, 0)

        account.balance += amount
        if credit_type == "recharge":
            account.total_recharged += amount
        elif credit_type == "gift":
            account.total_gifted += amount

        transaction = CreditTransaction(
            user_id=user_id,
            type=credit_type,
            amount=amount,
            balance_after=account.balance,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description,
        )
        db.add(transaction)
        await db.flush()
        return transaction


credit_service = CreditService()
