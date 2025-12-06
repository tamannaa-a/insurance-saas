from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import io
from typing import List
import pdfplumber

from ..auth import get_current_user
from ..database import get_db
from .. import schemas, models

router = APIRouter(prefix="/doc-classify", tags=["Document Classification"])


def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = ""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""
            text += "\n"
    return text.strip()


@router.post("/classify", response_model=schemas.DocClassResponse)
async def classify_document(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Simple keyword-based document type classification:
    - Claim Form
    - Inspection Report
    - Invoice
    - Other
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file.")

    if file.content_type == "application/pdf" or file.filename.lower().endswith(".pdf"):
        text = extract_text_from_pdf(content)
    else:
        try:
            text = content.decode("utf-8", errors="ignore")
        except Exception:
            raise HTTPException(status_code=400, detail="Unsupported file encoding.")

    if not text:
        raise HTTPException(status_code=400, detail="No text found in document.")

    text_lower = text.lower()

    patterns = {
        "Claim Form": ["claim number", "policy number", "loss date", "incident"],
        "Inspection Report": ["inspection", "survey", "inspector", "site visit"],
        "Invoice": ["invoice", "gst", "amount due", "bill no"],
    }

    best_type = "Other"
    best_hits: List[str] = []
    best_count = 0

    for doc_type, keywords in patterns.items():
        hits = [kw for kw in keywords if kw in text_lower]
        if len(hits) > best_count:
            best_count = len(hits)
            best_type = doc_type
            best_hits = hits

    # Confidence: simple heuristic
    if best_type == "Other":
        confidence = 0.4
    elif best_count >= 3:
        confidence = 0.95
    elif best_count == 2:
        confidence = 0.85
    else:
        confidence = 0.7

    return schemas.DocClassResponse(
        doc_type=best_type,
        confidence=confidence,
        keywords_matched=best_hits,
    )
