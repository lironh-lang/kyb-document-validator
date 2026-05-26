import json

FACT_FIELD_SOURCES = {
    "legal_name": [
        ("formation", "company_name"),
        ("ein", "company_name"),
        ("oa", "company_name"),
        ("cogs", "company_name"),
    ],
    "formation_state": [
        ("formation", "formation_state"),
        ("oa", "formation_state"),
        ("cogs", "cogs_state"),
    ],
    "ein": [
        ("ein", "ein"),
    ],
    "entity_type": [
        ("formation", "entity_type_stated"),
        ("oa", "entity_type_stated"),
    ],
    "management_structure": [
        ("formation", "management_structure"),
        ("oa", "management_structure"),
    ],
    "registered_agent": [
        ("formation", "registered_agent"),
    ],
    "business_address": [
        ("oa", "business_address"),
        ("formation", "business_address"),
    ],
    "cogs_date": [
        ("cogs", "cogs_issue_date"),
    ],
    "total_ownership": [
        ("oa", "ownership_total"),
    ],
    "members_list": [
        ("oa", "members"),
    ],
}


def _normalize(val) -> str:
    if isinstance(val, (list, dict)):
        return json.dumps(val, sort_keys=True)
    return str(val).strip() if val is not None else ""


def derive_facts(deal, db) -> None:
    from models import Document, EntityFact

    docs_raw = db.query(Document).filter(Document.deal_id == deal.id).all()
    docs: dict[str, dict] = {}
    for doc in docs_raw:
        if doc.extracted_json:
            try:
                docs[doc.doc_type] = json.loads(doc.extracted_json)
            except (json.JSONDecodeError, TypeError):
                docs[doc.doc_type] = {}

    for field_key, source_defs in FACT_FIELD_SOURCES.items():
        gathered: dict[str, object] = {}
        for doc_type, field in source_defs:
            doc = docs.get(doc_type)
            if not doc:
                continue
            val = doc.get(field)
            if val is None or val == "" or val == []:
                continue
            gathered[doc_type] = val

        if not gathered:
            continue

        values = list(gathered.values())
        unique_vals = {_normalize(v) for v in values}
        is_consistent = len(unique_vals) == 1

        primary_value = _normalize(values[0])
        conflicts_data = (
            {k: _normalize(v) for k, v in gathered.items()} if not is_consistent else None
        )

        existing = (
            db.query(EntityFact)
            .filter(EntityFact.deal_id == deal.id, EntityFact.field_key == field_key)
            .first()
        )

        if existing and existing.manually_overridden:
            continue

        if existing:
            existing.field_value = primary_value
            existing.sources = json.dumps(list(gathered.keys()))
            existing.is_consistent = is_consistent
            existing.conflicts = json.dumps(conflicts_data) if conflicts_data else None
        else:
            db.add(
                EntityFact(
                    deal_id=deal.id,
                    field_key=field_key,
                    field_value=primary_value,
                    sources=json.dumps(list(gathered.keys())),
                    is_consistent=is_consistent,
                    conflicts=json.dumps(conflicts_data) if conflicts_data else None,
                    manually_overridden=False,
                )
            )

    db.commit()
