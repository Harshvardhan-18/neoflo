import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies.auth import get_install_key
from app.models import PrivacyRule
from app.schemas.privacy import PrivacyRuleCreate, PrivacyRuleResponse

router = APIRouter(prefix="/api/v1/privacy/rules", tags=["Privacy Rules"])

@router.get("", response_model=List[PrivacyRuleResponse])
async def list_privacy_rules(
    _install_id: uuid.UUID = Depends(get_install_key),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(PrivacyRule).order_by(PrivacyRule.created_at.desc())
    result = await db.execute(stmt)
    rules = result.scalars().all()
    return [
        PrivacyRuleResponse(
            id=r.id,
            domain=r.domain,
            action=r.action,
            created_at=r.created_at
        )
        for r in rules
    ]

@router.post("", response_model=PrivacyRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_privacy_rule(
    payload: PrivacyRuleCreate,
    _install_id: uuid.UUID = Depends(get_install_key),
    db: AsyncSession = Depends(get_db)
):
    clean_domain = payload.domain.strip().lower()
    
    # Check if rule already exists
    stmt = select(PrivacyRule).where(PrivacyRule.domain == clean_domain)
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Privacy rule for domain '{clean_domain}' already exists."
        )

    rule = PrivacyRule(
        id=uuid.uuid4(),
        domain=clean_domain,
        action=payload.action.lower()
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return PrivacyRuleResponse(
        id=rule.id,
        domain=rule.domain,
        action=rule.action,
        created_at=rule.created_at
    )

@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_privacy_rule(
    rule_id: uuid.UUID,
    _install_id: uuid.UUID = Depends(get_install_key),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(PrivacyRule).where(PrivacyRule.id == rule_id)
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Privacy rule with ID '{rule_id}' not found."
        )

    await db.delete(rule)
    await db.commit()
    return None
