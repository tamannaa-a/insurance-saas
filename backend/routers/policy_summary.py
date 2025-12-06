from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import io

import pdfplumber

from ..auth import get_current_user
from .. import schemas, models
from ..database import get_db

router = APIRouter(prefix="/policy-summary", tags=["Policy Summary"])


def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = ""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""
            text += "\n"
    return text.strip()


def simple_summarize(text: str, max_words: int = 200) -> str:
    # Naive baseline: first N words, could be replaced with LLM later
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words])


@router.post("/summarize", response_model=schemas.PolicySummaryResponse)
async def summarize_policy(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a policy document (PDF or text) and get a ~200-word summary.
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file.")

    text: Optional[str] = None

    if file.content_type == "application/pdf" or file.filename.lower().endswith(".pdf"):
        text = extract_text_from_pdf(content)
    else:
        # Assume text-like
        try:
            text = content.decode("utf-8", errors="ignore")
        except Exception:
            raise HTTPException(status_code=400, detail="Unsupported file encoding.")

    if not text or len(text.strip()) == 0:
        raise HTTPException(
            status_code=400, detail="Could not extract text from the document."
        )

    summary = simple_summarize(text, max_words=200)
    word_count = len(summary.split())

    return schemas.PolicySummaryResponse(summary=summary, word_count=word_count)
