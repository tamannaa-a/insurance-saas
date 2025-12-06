from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import io
from typing import List, Tuple
import pdfplumber
import re

from auth import get_current_user
from database import get_db
import schemas
import models

router = APIRouter(prefix="/doc-classify", tags=["Document Classification"])


# --------- Helpers ---------


def extract_text_from_pdf_with_pages(file_bytes: bytes) -> List[str]:
    """Returns list of per-page text strings."""
    texts: List[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            texts.append(page_text.strip())
    return texts


def simple_doc_type_keywords(text_lower: str) -> Tuple[str, List[str], float]:
    """
    Basic keyword engine that returns (doc_type, matched_keywords, score).
    Score in [0,1].
    """
    patterns = {
        "Claim Form": [
            "claim number",
            "policy number",
            "loss date",
            "incident",
            "insured",
            "claim form",
        ],
        "Inspection Report": [
            "inspection report",
            "inspector",
            "survey",
            "site visit",
            "observation",
            "damage assessment",
        ],
        "Invoice": [
            "invoice",
            "gst",
            "amount due",
            "invoice no",
            "bill no",
            "subtotal",
        ],
        "Policy Document": [
            "coverage",
            "exclusions",
            "sum insured",
            "premium",
            "endorsement",
            "policy schedule",
        ],
        "Letter": [
            "dear sir",
            "dear madam",
            "sincerely",
            "regards",
            "communication",
        ],
    }

    best_type = "Other"
    best_hits: List[str] = []
    best_score = 0.0

    for doc_type, keywords in patterns.items():
        hits = [kw for kw in keywords if kw in text_lower]
        if hits:
            # simple scoring: hits / total_keywords
            score = len(hits) / len(keywords)
            if score > best_score:
                best_score = score
                best_type = doc_type
                best_hits = hits

    return best_type, best_hits, best_score


def layout_heuristic(text: str, num_pages: int) -> float:
    """
    Very rough approximation of layout confidence:
    - Long, table-like content => invoice/policy
    - Many short lines => forms
    """
    lines = text.splitlines()
    if not lines:
        return 0.2

    avg_line_len = sum(len(l) for l in lines) / max(len(lines), 1)

    score = 0.3
    if "invoice" in text.lower() or "bill" in text.lower():
        score += 0.3
    if avg_line_len > 60:
        score += 0.2
    if num_pages > 3:
        score += 0.1

    return min(score, 1.0)


def semantic_placeholder_score(doc_type: str) -> float:
    """
    Placeholder for a semantic model (e.g. DistilBERT).
    Right now, we assign high confidence if doc_type != Other.
    """
    if doc_type == "Other":
        return 0.4
    return 0.85


def extract_fields(doc_type: str, text: str) -> List[schemas.ExtractionField]:
    fields: List[schemas.ExtractionField] = []

    def add_field(name: str, value: str | None, conf: float):
        fields.append(
            schemas.ExtractionField(
                name=name,
                value=value.strip() if value else None,
                confidence=conf,
            )
        )

    if doc_type == "Invoice":
        invoice_no = re.search(
            r"(invoice\s*(no\.?|number)[:\-\s]+)([A-Za-z0-9\-\/]+)",
            text,
            re.IGNORECASE,
        )
        amount = re.search(
            r"(total\s*amount|amount\s*due|grand\s*total)[:\-\s]+([\d,]+\.\d{2}|\d+)",
            text,
            re.IGNORECASE,
        )
        date = re.search(
            r"(invoice\s*date|date)[:\-\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})",
            text,
            re.IGNORECASE,
        )

        add_field(
            "Invoice Number", invoice_no.group(3) if invoice_no else None, 0.9 if invoice_no else 0.4
        )
        add_field("Amount", amount.group(2) if amount else None, 0.9 if amount else 0.4)
        add_field(
            "Invoice Date", date.group(2) if date else None, 0.8 if date else 0.4
        )

    elif doc_type == "Claim Form":
        claim_no = re.search(
            r"(claim\s*(no\.?|number)[:\-\s]+)([A-Za-z0-9\-\/]+)",
            text,
            re.IGNORECASE,
        )
        policy_no = re.search(
            r"(policy\s*(no\.?|number)[:\-\s]+)([A-Za-z0-9\-\/]+)",
            text,
            re.IGNORECASE,
        )
        loss_date = re.search(
            r"(date\s*of\s*loss|loss\s*date)[:\-\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})",
            text,
            re.IGNORECASE,
        )

        add_field(
            "Claim Number", claim_no.group(3) if claim_no else None, 0.9 if claim_no else 0.4
        )
        add_field(
            "Policy Number", policy_no.group(3) if policy_no else None, 0.9 if policy_no else 0.4
        )
        add_field(
            "Loss Date", loss_date.group(2) if loss_date else None, 0.8 if loss_date else 0.4
        )

    elif doc_type == "Inspection Report":
        inspector = re.search(
            r"(inspector\s*name)[:\-\s]+([A-Za-z\s\.]+)", text, re.IGNORECASE
        )
        date = re.search(
            r"(inspection\s*date|date\s*of\s*inspection)[:\-\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})",
            text,
            re.IGNORECASE,
        )

        add_field(
            "Inspector Name",
            inspector.group(2) if inspector else None,
            0.8 if inspector else 0.4,
        )
        add_field(
            "Inspection Date",
            date.group(2) if date else None,
            0.8 if date else 0.4,
        )

    elif doc_type == "Policy Document":
        sum_insured = re.search(
            r"(sum\s*insured)[:\-\s]+([A-Za-z0-9,\. ]+)", text, re.IGNORECASE
        )
        coverage_limit = re.search(
            r"(coverage\s*limit|limit\s*of\s*liability)[:\-\s]+([A-Za-z0-9,\. ]+)",
            text,
            re.IGNORECASE,
        )

        add_field(
            "Sum Insured",
            sum_insured.group(2) if sum_insured else None,
            0.7 if sum_insured else 0.4,
        )
        add_field(
            "Coverage Limit",
            coverage_limit.group(2) if coverage_limit else None,
            0.7 if coverage_limit else 0.4,
        )

    if not fields:
        add_field("Note", "No specific structured fields extracted.", 0.3)

    return fields


def fraud_signals_heuristic(
    doc_type: str,
    text: str,
    fields: List[schemas.ExtractionField],
) -> List[schemas.FraudSignal]:
    signals: List[schemas.FraudSignal] = []
    lower = text.lower()

    suspicious_words = ["urgent", "immediately", "lost", "duplicate", "backdated"]
    hits = [w for w in suspicious_words if w in lower]
    if hits:
        signals.append(
            schemas.FraudSignal(
                label="Suspicious language",
                severity="medium",
                description=f"Suspicious phrases detected: {', '.join(hits)}",
            )
        )

    important_field_names = {
        "Invoice": ["Invoice Number", "Amount"],
        "Claim Form": ["Claim Number", "Policy Number"],
    }

    if doc_type in important_field_names:
        for required in important_field_names[doc_type]:
            if not any(f.name == required and f.value for f in fields):
                signals.append(
                    schemas.FraudSignal(
                        label=f"Missing {required}",
                        severity="high",
                        description=f"Expected field '{required}' could not be found in the document.",
                    )
                )

    return signals


def quality_score_heuristic(text: str, is_pdf: bool) -> float:
    length = len(text)
    if length < 300:
        base = 50
    elif length < 2000:
        base = 80
    else:
        base = 90

    if not is_pdf:
        base -= 5

    weird_chars = sum(1 for ch in text if ord(ch) > 126 and ch not in ("\n", "\t"))
    if weird_chars > 0:
        base -= 10

    return max(0.0, min(float(base), 100.0))


def generate_tags(
    doc_type: str,
    fields: List[schemas.ExtractionField],
    fraud_signals: List[schemas.FraudSignal],
) -> List[str]:
    tags: List[str] = []
    tags.append(doc_type.lower().replace(" ", "-"))

    if any("Amount" in f.name and f.value for f in fields):
        tags.append("amount-detected")
    if any(f.name == "Claim Number" and f.value for f in fields):
        tags.append("claim-identified")
    if fraud_signals:
        tags.append("fraud-review")
    if doc_type == "Invoice":
        tags.append("finance")
    if doc_type == "Claim Form":
        tags.append("claims")

    return list(sorted(set(tags)))


def jaccard_similarity(a: str, b: str) -> float:
    a_tokens = set(a.lower().split())
    b_tokens = set(b.lower().split())
    if not a_tokens or not b_tokens:
        return 0.0
    intersection = len(a_tokens & b_tokens)
    union = len(a_tokens | b_tokens)
    return intersection / union


def find_similar_docs(
    db: Session,
    tenant_id: int,
    current_text: str,
    current_type: str,
    limit: int = 3,
) -> List[schemas.SimilarDoc]:
    docs = db.query(models.Document).filter(models.Document.tenant_id == tenant_id).all()

    sims: List[tuple[models.Document, float]] = []
    for d in docs:
        sim = jaccard_similarity(current_text, d.text_content)
        if sim > 0:
            sims.append((d, sim))

    sims.sort(key=lambda x: x[1], reverse=True)
    top = sims[:limit]

    return [
        schemas.SimilarDoc(
            id=d.id,
            filename=d.filename,
            doc_type=d.doc_type,
            similarity=sim,
        )
        for d, sim in top
    ]


def per_page_map(page_texts: List[str]) -> List[schemas.PageType]:
    page_map: List[schemas.PageType] = []
    for idx, page_text in enumerate(page_texts):
        doc_type, hits, score = simple_doc_type_keywords(page_text.lower())
        if doc_type == "Other":
            conf = 0.4
        else:
            conf = 0.6 + score * 0.4
        page_map.append(
            schemas.PageType(page_number=idx + 1, doc_type=doc_type, confidence=conf)
        )
    return page_map


# --------- Endpoint ---------


@router.post("/analyze", response_model=schemas.DocClassAnalysisResponse)
async def analyze_document(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Premium document classification endpoint.
    Returns:
    - doc_type + confidence
    - engine breakdown (keyword / semantic / layout / final)
    - extracted fields
    - fraud signals
    - tags
    - quality score
    - page-level doc_type map
    - similar docs (same tenant)
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file.")

    is_pdf = file.content_type == "application/pdf" or file.filename.lower().endswith(
        ".pdf"
    )

    if is_pdf:
        page_texts = extract_text_from_pdf_with_pages(content)
        full_text = "\n\n".join(page_texts)
    else:
        try:
            full_text = content.decode("utf-8", errors="ignore")
            page_texts = [full_text]
        except Exception:
            raise HTTPException(status_code=400, detail="Unsupported file encoding.")

    if not full_text.strip():
        raise HTTPException(status_code=400, detail="No text found in document.")

    text_lower = full_text.lower()

    # 1) Keyword engine
    kw_doc_type, matched_keywords, kw_score = simple_doc_type_keywords(text_lower)

    # 2) Layout engine
    layout_score = layout_heuristic(full_text, num_pages=len(page_texts))

    # 3) Semantic (placeholder)
    sem_score = semantic_placeholder_score(kw_doc_type)

    # Final doc type
    final_type = kw_doc_type if kw_doc_type != "Other" else "Other"

    # Combine into final confidence
    final_confidence = min(
        1.0,
        0.4 * sem_score + 0.35 * kw_score + 0.25 * layout_score,
    )

    # Extract fields
    fields = extract_fields(final_type, full_text)

    # Fraud signals
    fraud_signals = fraud_signals_heuristic(final_type, full_text, fields)

    # Quality score
    quality_score = quality_score_heuristic(full_text, is_pdf)

    # Tags
    tags = generate_tags(final_type, fields, fraud_signals)

    # Page map
    page_map = per_page_map(page_texts)

    # Similar docs
    similar_docs = find_similar_docs(
        db=db,
        tenant_id=current_user.tenant_id,
        current_text=full_text,
        current_type=final_type,
    )

    # Store current doc
    new_doc = models.Document(
        tenant_id=current_user.tenant_id,
        filename=file.filename,
        doc_type=final_type,
        text_content=full_text[:5000],  # limit size
    )
    db.add(new_doc)
    db.commit()

    engine_breakdown = {
        "keyword_engine": round(float(kw_score), 3),
        "semantic_engine": round(float(sem_score), 3),
        "layout_engine": round(float(layout_score), 3),
        "final_confidence": round(float(final_confidence), 3),
    }

    highlight_phrases: List[str] = list(matched_keywords)
    for f in fields:
        if f.value and f.name != "Note":
            highlight_phrases.append(f.value)

    return schemas.DocClassAnalysisResponse(
        doc_type=final_type,
        confidence=float(final_confidence),
        keywords_matched=matched_keywords,
        engine_breakdown=engine_breakdown,
        extracted_fields=fields,
        fraud_signals=fraud_signals,
        tags=tags,
        quality_score=quality_score,
        similar_docs=similar_docs,
        page_map=page_map,
        highlight_phrases=list(dict.fromkeys(highlight_phrases)),  # unique
    )
