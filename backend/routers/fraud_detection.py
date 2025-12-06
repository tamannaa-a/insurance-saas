from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from auth import get_current_user
from database import get_db
import schemas
import models

router = APIRouter(prefix="/fraud-detection", tags=["Fraud Detection"])


@router.post("/score", response_model=schemas.FraudScore)
def score_claim(
    claim: schemas.ClaimInput,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Simple rule-based fraud risk scoring (demo).
    You can later swap this with a trained ML model.
    """
    score = 0.0
    reasons: List[str] = []

    # Rule 1: Very high amount
    if claim.amount > 500000:
        score += 40
        reasons.append("Claim amount is very high.")
    elif claim.amount > 200000:
        score += 25
        reasons.append("Claim amount is high.")

    # Rule 2: Previous claims
    if claim.previous_claims_count > 3:
        score += 25
        reasons.append("Customer has many previous claims.")
    elif claim.previous_claims_count > 1:
        score += 10
        reasons.append("Customer has some previous claims.")

    # Rule 3: Suspicious keywords
    suspicious_keywords = [
        "sudden",
        "stolen",
        "lost",
        "fire",
        "cash",
        "urgent",
        "fake",
        "duplicate",
    ]
    desc_lower = claim.description.lower()
    keyword_hits = [k for k in suspicious_keywords if k in desc_lower]
    if keyword_hits:
        score += 20
        reasons.append(f"Suspicious keywords found: {', '.join(keyword_hits)}")

    # Rule 4: Third-party claim
    if claim.is_third_party:
        score += 10
        reasons.append("Third-party claim.")

    # Normalize to [0, 100]
    score = min(score, 100.0)

    if score >= 60:
        risk_level = "High"
    elif score >= 30:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    if not reasons:
        reasons.append("No obvious fraud indicators detected.")

    return schemas.FraudScore(
        claim_id=claim.claim_id,
        risk_level=risk_level,
        score=score,
        reasons=reasons,
    )
