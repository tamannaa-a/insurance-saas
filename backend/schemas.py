from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict


# ------------ AUTH / USER ------------

class TenantBase(BaseModel):
    name: str


class TenantOut(TenantBase):
    id: int

    class Config:
        orm_mode = True


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str
    tenant_name: str  # new tenant or existing tenant name


class UserOut(UserBase):
    id: int
    is_active: bool
    tenant: Optional[TenantOut]

    class Config:
        orm_mode = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


# ------------ POLICY SUMMARY ------------

class PolicySummaryResponse(BaseModel):
    summary: str
    word_count: int


# ------------ FRAUD DETECTION ------------

class ClaimInput(BaseModel):
    claim_id: str
    amount: float
    description: str
    is_third_party: bool = False
    previous_claims_count: int = 0


class FraudScore(BaseModel):
    claim_id: str
    risk_level: str  # High / Medium / Low
    score: float
    reasons: List[str]


# ------------ DOCUMENT CLASSIFICATION (PREMIUM) ------------

class ExtractionField(BaseModel):
    name: str
    value: Optional[str] = None
    confidence: float


class FraudSignal(BaseModel):
    label: str
    severity: str  # "low", "medium", "high"
    description: str


class SimilarDoc(BaseModel):
    id: int
    filename: str
    doc_type: str
    similarity: float


class PageType(BaseModel):
    page_number: int
    doc_type: str
    confidence: float


class DocClassAnalysisResponse(BaseModel):
    doc_type: str
    confidence: float
    keywords_matched: List[str]
    engine_breakdown: Dict[str, float]  # keyword / semantic / layout / final

    extracted_fields: List[ExtractionField]
    fraud_signals: List[FraudSignal]
    tags: List[str]

    quality_score: float  # 0–100
    similar_docs: List[SimilarDoc]
    page_map: List[PageType]

    # For frontend text highlighting
    highlight_phrases: List[str]
