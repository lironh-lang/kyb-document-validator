import json
import os
import shutil
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

load_dotenv()

from database import get_db, init_db
from extraction import extract_document
from facts import derive_facts
from models import AuditLog, Deal, DealMember, Document, EntityFact, RuleResult
from rules import RULE_METADATA, run_rules_engine

UPLOAD_DIR = Path(__file__).parent / "uploads"

app = FastAPI(title="Waltz KYB API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    UPLOAD_DIR.mkdir(exist_ok=True)
    init_db()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class DealCreate(BaseModel):
    name: str
    formation_state: str = ""
    property_state: str = ""
    closing_date: str = ""


class DealUpdate(BaseModel):
    name: str | None = None
    formation_state: str | None = None
    property_state: str | None = None
    closing_date: str | None = None
    status: str | None = None


class MemberCreate(BaseModel):
    name: str
    ownership_pct: float | None = None
    role: str | None = None


class FactUpdate(BaseModel):
    field_value: str


class RuleResolveBody(BaseModel):
    resolved_by: str = "analyst"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _deal_or_404(deal_id: int, db: Session) -> Deal:
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


def _serialize_deal(deal: Deal) -> dict:
    return {
        "id": deal.id,
        "name": deal.name,
        "formation_state": deal.formation_state,
        "property_state": deal.property_state,
        "closing_date": deal.closing_date,
        "status": deal.status,
        "created_at": deal.created_at.isoformat() if deal.created_at else None,
        "members": [
            {
                "id": m.id,
                "name": m.name,
                "ownership_pct": m.ownership_pct,
                "role": m.role,
            }
            for m in deal.members
        ],
        "documents": [
            {
                "id": d.id,
                "doc_type": d.doc_type,
                "file_name": d.file_name,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
                "extracted_json": d.extracted_json,
            }
            for d in deal.documents
        ],
        "rule_results": _serialize_rules(deal),
        "entity_facts": [
            {
                "id": f.id,
                "field_key": f.field_key,
                "field_value": f.field_value,
                "sources": f.sources,
                "is_consistent": f.is_consistent,
                "conflicts": f.conflicts,
                "manually_overridden": f.manually_overridden,
            }
            for f in deal.facts
        ],
        "audit_logs": [
            {
                "id": a.id,
                "action": a.action,
                "performed_by": a.performed_by,
                "performed_at": a.performed_at.isoformat() if a.performed_at else None,
            }
            for a in sorted(deal.audit_logs, key=lambda x: x.performed_at or datetime.min, reverse=True)
        ],
    }


def _serialize_rules(deal: Deal) -> list:
    results = []
    for r in deal.rules:
        meta = RULE_METADATA.get(r.rule_id, {})
        results.append(
            {
                "id": r.id,
                "rule_id": r.rule_id,
                "name": meta.get("name", r.rule_id),
                "group": meta.get("group", ""),
                "mode": meta.get("mode", "auto"),
                "status": r.status,
                "evidence": r.evidence,
                "question": r.question,
                "resolved": r.resolved,
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
                "resolved_by": r.resolved_by,
            }
        )
    return sorted(results, key=lambda x: x["rule_id"])


def _add_audit(db: Session, deal_id: int, action: str, performed_by: str = "system"):
    db.add(
        AuditLog(
            deal_id=deal_id,
            action=action,
            performed_by=performed_by,
            performed_at=datetime.utcnow(),
        )
    )


# ── Deals ─────────────────────────────────────────────────────────────────────

@app.post("/api/deals")
def create_deal(body: DealCreate, db: Session = Depends(get_db)):
    deal = Deal(
        name=body.name,
        formation_state=body.formation_state,
        property_state=body.property_state,
        closing_date=body.closing_date or None,
        status="new",
        created_at=datetime.utcnow(),
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    run_rules_engine(deal, db)
    _add_audit(db, deal.id, f"Deal created: {deal.name}")
    db.commit()
    db.refresh(deal)
    return _serialize_deal(deal)


@app.get("/api/deals")
def list_deals(db: Session = Depends(get_db)):
    deals = db.query(Deal).order_by(Deal.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "status": d.status,
            "formation_state": d.formation_state,
            "property_state": d.property_state,
            "closing_date": d.closing_date,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in deals
    ]


@app.get("/api/deals/{deal_id}")
def get_deal(deal_id: int, db: Session = Depends(get_db)):
    deal = _deal_or_404(deal_id, db)
    return _serialize_deal(deal)


@app.put("/api/deals/{deal_id}")
def update_deal(deal_id: int, body: DealUpdate, db: Session = Depends(get_db)):
    deal = _deal_or_404(deal_id, db)
    changes = []
    if body.name is not None:
        deal.name = body.name
        changes.append(f"name → {body.name}")
    if body.formation_state is not None:
        deal.formation_state = body.formation_state
        changes.append(f"formation_state → {body.formation_state}")
    if body.property_state is not None:
        deal.property_state = body.property_state
        changes.append(f"property_state → {body.property_state}")
    if body.closing_date is not None:
        deal.closing_date = body.closing_date or None
        changes.append(f"closing_date → {body.closing_date}")
    if body.status is not None:
        deal.status = body.status
        changes.append(f"status → {body.status}")
    db.commit()
    db.refresh(deal)

    run_rules_engine(deal, db)
    if changes:
        _add_audit(db, deal.id, f"Deal updated: {', '.join(changes)}")
    db.commit()
    db.refresh(deal)
    return _serialize_deal(deal)


# ── Documents ─────────────────────────────────────────────────────────────────

@app.post("/api/deals/{deal_id}/documents")
async def upload_document(
    deal_id: int,
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    deal = _deal_or_404(deal_id, db)

    safe_name = f"{deal_id}_{doc_type}_{file.filename}"
    file_path = UPLOAD_DIR / safe_name

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Build deal context from already-uploaded docs
    deal_context = {
        "name": deal.name,
        "formation_state": deal.formation_state,
        "property_state": deal.property_state,
        "closing_date": deal.closing_date,
        "members": [
            {"name": m.name, "ownership_pct": m.ownership_pct} for m in deal.members
        ],
    }
    for doc in deal.documents:
        if doc.extracted_json:
            try:
                ex = json.loads(doc.extracted_json)
                if doc.doc_type == "formation" and not deal_context.get("company_name"):
                    deal_context["company_name"] = ex.get("company_name")
                elif doc.doc_type == "ein" and not deal_context.get("ein"):
                    deal_context["ein"] = ex.get("ein")
            except (json.JSONDecodeError, TypeError):
                pass

    # Extract via Claude
    extraction_error = None
    extracted = None
    try:
        extracted = extract_document(str(file_path), doc_type, deal_context)
        if extracted.get("error"):
            extraction_error = extracted.get("notes", "Extraction failed")
    except Exception as e:
        extraction_error = str(e)

    extracted_str = json.dumps(extracted) if extracted else None

    # Upsert Document record
    existing_doc = (
        db.query(Document)
        .filter(Document.deal_id == deal_id, Document.doc_type == doc_type)
        .first()
    )
    if existing_doc:
        if existing_doc.file_path != str(file_path):
            try:
                os.remove(existing_doc.file_path)
            except FileNotFoundError:
                pass
        existing_doc.file_name = file.filename
        existing_doc.file_path = str(file_path)
        existing_doc.uploaded_at = datetime.utcnow()
        existing_doc.extracted_json = extracted_str
    else:
        db.add(
            Document(
                deal_id=deal_id,
                doc_type=doc_type,
                file_name=file.filename,
                file_path=str(file_path),
                uploaded_at=datetime.utcnow(),
                extracted_json=extracted_str,
            )
        )

    # Auto-update deal formation_state from formation doc if not set
    if doc_type == "formation" and extracted and not extraction_error:
        new_state = extracted.get("formation_state")
        if new_state and not deal.formation_state:
            deal.formation_state = new_state

    db.commit()
    db.refresh(deal)

    # Derive entity facts and re-run rules
    derive_facts(deal, db)
    run_rules_engine(deal, db)

    action = f"Uploaded {doc_type} document: {file.filename}"
    if extraction_error:
        action += f" (extraction warning: {extraction_error})"
    _add_audit(db, deal_id, action)
    db.commit()
    db.refresh(deal)

    return _serialize_deal(deal)


# ── Rules ─────────────────────────────────────────────────────────────────────

@app.get("/api/deals/{deal_id}/rules")
def get_rules(deal_id: int, db: Session = Depends(get_db)):
    deal = _deal_or_404(deal_id, db)
    return _serialize_rules(deal)


@app.post("/api/deals/{deal_id}/rules/{rule_id}/resolve")
def resolve_rule(
    deal_id: int,
    rule_id: str,
    body: RuleResolveBody = RuleResolveBody(),
    db: Session = Depends(get_db),
):
    _deal_or_404(deal_id, db)
    rule = (
        db.query(RuleResult)
        .filter(RuleResult.deal_id == deal_id, RuleResult.rule_id == rule_id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.resolved = True
    rule.resolved_at = datetime.utcnow()
    rule.resolved_by = body.resolved_by
    _add_audit(db, deal_id, f"Rule {rule_id} marked resolved by {body.resolved_by}")
    db.commit()
    return {"rule_id": rule_id, "resolved": True}


@app.post("/api/deals/{deal_id}/rules/{rule_id}/unresolve")
def unresolve_rule(deal_id: int, rule_id: str, db: Session = Depends(get_db)):
    _deal_or_404(deal_id, db)
    rule = (
        db.query(RuleResult)
        .filter(RuleResult.deal_id == deal_id, RuleResult.rule_id == rule_id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.resolved = False
    rule.resolved_at = None
    rule.resolved_by = None
    _add_audit(db, deal_id, f"Rule {rule_id} un-resolved")
    db.commit()
    return {"rule_id": rule_id, "resolved": False}


@app.post("/api/deals/{deal_id}/rules/{rule_id}/request")
def request_rule(deal_id: int, rule_id: str, db: Session = Depends(get_db)):
    _deal_or_404(deal_id, db)
    _add_audit(db, deal_id, f"Rule {rule_id}: information requested from client")
    db.commit()
    return {"rule_id": rule_id, "requested": True}


# ── Entity Facts ──────────────────────────────────────────────────────────────

@app.put("/api/deals/{deal_id}/facts/{field_key}")
def update_fact(
    deal_id: int,
    field_key: str,
    body: FactUpdate,
    db: Session = Depends(get_db),
):
    deal = _deal_or_404(deal_id, db)
    fact = (
        db.query(EntityFact)
        .filter(EntityFact.deal_id == deal_id, EntityFact.field_key == field_key)
        .first()
    )
    if fact:
        old_val = fact.field_value
        fact.field_value = body.field_value
        fact.manually_overridden = True
        fact.is_consistent = True
        fact.conflicts = None
    else:
        fact = EntityFact(
            deal_id=deal_id,
            field_key=field_key,
            field_value=body.field_value,
            sources=json.dumps(["manual"]),
            is_consistent=True,
            manually_overridden=True,
        )
        db.add(fact)
        old_val = None

    _add_audit(
        db,
        deal_id,
        f"Entity fact '{field_key}' overridden: '{old_val}' → '{body.field_value}'",
        performed_by="analyst",
    )
    db.commit()

    run_rules_engine(deal, db)
    db.commit()
    db.refresh(deal)
    return _serialize_deal(deal)


# ── Members ───────────────────────────────────────────────────────────────────

@app.post("/api/deals/{deal_id}/members")
def add_member(deal_id: int, body: MemberCreate, db: Session = Depends(get_db)):
    deal = _deal_or_404(deal_id, db)
    member = DealMember(
        deal_id=deal_id,
        name=body.name,
        ownership_pct=body.ownership_pct,
        role=body.role,
    )
    db.add(member)
    _add_audit(db, deal_id, f"Member added: {body.name} ({body.ownership_pct}%, {body.role})")
    db.commit()
    db.refresh(deal)
    run_rules_engine(deal, db)
    db.commit()
    db.refresh(deal)
    return _serialize_deal(deal)


@app.delete("/api/deals/{deal_id}/members/{member_id}")
def remove_member(deal_id: int, member_id: int, db: Session = Depends(get_db)):
    deal = _deal_or_404(deal_id, db)
    member = (
        db.query(DealMember)
        .filter(DealMember.id == member_id, DealMember.deal_id == deal_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    _add_audit(db, deal_id, f"Member removed: {member.name}")
    db.delete(member)
    db.commit()
    db.refresh(deal)
    run_rules_engine(deal, db)
    db.commit()
    db.refresh(deal)
    return _serialize_deal(deal)


# ── Approve ───────────────────────────────────────────────────────────────────

@app.post("/api/deals/{deal_id}/approve")
def approve_deal(deal_id: int, db: Session = Depends(get_db)):
    deal = _deal_or_404(deal_id, db)

    blocking = [
        r
        for r in deal.rules
        if r.status in ("fail", "flag") and not r.resolved
    ]
    if blocking:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve: {len(blocking)} unresolved issues remain.",
        )

    deal.status = "approved"
    _add_audit(db, deal_id, "KYB approved", performed_by="analyst")
    db.commit()
    db.refresh(deal)
    return _serialize_deal(deal)


# ── Audit ─────────────────────────────────────────────────────────────────────

@app.get("/api/deals/{deal_id}/audit")
def get_audit(deal_id: int, db: Session = Depends(get_db)):
    _deal_or_404(deal_id, db)
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.deal_id == deal_id)
        .order_by(AuditLog.performed_at.desc())
        .all()
    )
    return [
        {
            "id": a.id,
            "action": a.action,
            "performed_by": a.performed_by,
            "performed_at": a.performed_at.isoformat() if a.performed_at else None,
        }
        for a in logs
    ]
