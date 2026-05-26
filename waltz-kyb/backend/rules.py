import json
import re
from datetime import date, datetime
from typing import Optional

# ── Config constants ──────────────────────────────────────────────────────────

UNSUPPORTED_STATES = ["CA", "ID", "MN", "NV", "ND", "OR", "SD", "UT", "VT"]

COGS_MAX_DAYS = 30

ACCEPTED_EIN_TYPES = ["CP 575 A", "CP 575 B", "CP 575 G", "147C"]

FORMATION_DOC_BY_STATE = {
    "AL": "Articles of Organization",
    "AK": "Articles of Organization",
    "AZ": "Articles of Organization",
    "AR": "Articles of Organization",
    "CA": "Articles of Organization",
    "CO": "Articles of Organization",
    "CT": "Certificate of Organization",
    "DE": "Certificate of Formation",
    "FL": "Articles of Organization",
    "GA": "Articles of Organization",
    "HI": "Articles of Organization",
    "ID": "Articles of Organization",
    "IL": "Articles of Organization",
    "IN": "Articles of Organization",
    "IA": "Articles of Organization",
    "KS": "Articles of Organization",
    "KY": "Articles of Organization",
    "LA": "Articles of Organization",
    "ME": "Articles of Organization",
    "MD": "Articles of Organization",
    "MA": "Certificate of Organization",
    "MI": "Certificate of Organization",
    "MN": "Articles of Organization",
    "MS": "Certificate of Formation",
    "MO": "Articles of Organization",
    "MT": "Articles of Organization",
    "NE": "Articles of Organization",
    "NV": "Articles of Organization",
    "NH": "Certificate of Formation",
    "NJ": "Certificate of Formation",
    "NM": "Articles of Organization",
    "NY": "Articles of Organization",
    "NC": "Articles of Organization",
    "ND": "Articles of Organization",
    "OH": "Articles of Organization",
    "OK": "Articles of Organization",
    "OR": "Articles of Organization",
    "PA": "Certificate of Organization",
    "RI": "Certificate of Formation",
    "SC": "Articles of Organization",
    "SD": "Articles of Organization",
    "TN": "Articles of Organization",
    "TX": "Certificate of Formation",
    "UT": "Certificate of Organization",
    "VT": "Articles of Organization",
    "VA": "Articles of Organization",
    "WA": "Certificate of Formation",
    "WV": "Articles of Organization",
    "WI": "Articles of Organization",
    "WY": "Articles of Organization",
    "DC": "Articles of Organization",
}

US_STATES = set(FORMATION_DOC_BY_STATE.keys()) | {"PR", "GU", "VI", "AS", "MP"}

COGS_NAMES_ACCEPTED = ["good standing", "existence", "status", "authorization"]

RULE_METADATA = {
    "F1": {"name": "Unsupported Formation Doc Type", "group": "Formation", "mode": "auto"},
    "F2": {"name": "Company-Property State Mismatch", "group": "Formation", "mode": "auto"},
    "F3": {"name": "Non-U.S. Entity", "group": "Formation", "mode": "auto"},
    "F4": {"name": "Unsupported U.S. State", "group": "Formation", "mode": "auto"},
    "E1": {"name": "Unsupported EIN Doc Type", "group": "EIN Letter", "mode": "auto"},
    "E2": {"name": "Company Name Mismatch (EIN)", "group": "EIN Letter", "mode": "auto"},
    "E3": {"name": "Invalid EIN Format", "group": "EIN Letter", "mode": "auto"},
    "E4": {"name": "EIN Letter Authenticity", "group": "EIN Letter", "mode": "assisted"},
    "E5": {"name": "Responsible Party Discrepancy", "group": "EIN Letter", "mode": "assisted"},
    "O1": {"name": "Company Name Mismatch (OA)", "group": "Operating Agreement", "mode": "auto"},
    "O2": {"name": "Unclear Ownership Percentages", "group": "Operating Agreement", "mode": "auto"},
    "O3": {"name": "Management Structure Mismatch", "group": "Operating Agreement", "mode": "auto"},
    "O4": {"name": "Inconsistent Member/Manager Roles", "group": "Operating Agreement", "mode": "assisted"},
    "O5": {"name": "Owner Name Errors", "group": "Operating Agreement", "mode": "assisted"},
    "O6": {"name": "Incomplete or Defective Agreement", "group": "Operating Agreement", "mode": "assisted"},
    "O7": {"name": "Entity Owners Require KYB", "group": "Operating Agreement", "mode": "auto"},
    "O8": {"name": "Missing Signatures", "group": "Operating Agreement", "mode": "auto"},
    "O9": {"name": "Legal Structure Inconsistency", "group": "Operating Agreement", "mode": "assisted"},
    "O10": {"name": "Ownership Totals Incorrect", "group": "Operating Agreement", "mode": "auto"},
    "O11": {"name": "Missing Referenced Exhibits", "group": "Operating Agreement", "mode": "assisted"},
    "O12": {"name": "Company Type Conflict", "group": "Operating Agreement", "mode": "auto"},
    "O13": {"name": "Unlisted Deal Member", "group": "Operating Agreement", "mode": "auto"},
    "O14": {"name": "Loan Term Restriction Language", "group": "Operating Agreement", "mode": "assisted"},
    "C1": {"name": "Unsupported COGS Doc Type", "group": "Certificate of Good Standing", "mode": "auto"},
    "C2": {"name": "Stale Certificate", "group": "Certificate of Good Standing", "mode": "auto"},
    "C3": {"name": "Improper Certificate Type", "group": "Certificate of Good Standing", "mode": "manual"},
    "C4": {"name": "Certificate State Mismatch", "group": "Certificate of Good Standing", "mode": "auto"},
    "C5": {"name": "Company Name Mismatch (COGS)", "group": "Certificate of Good Standing", "mode": "auto"},
    "A1": {"name": "Business Address Confirmation", "group": "LLC Address", "mode": "assisted"},
    "A2": {"name": "Foreign Address as Business Address", "group": "LLC Address", "mode": "auto"},
    "S1": {"name": "Owner/Member Discrepancy (SoS)", "group": "Secretary of State", "mode": "manual"},
    "S2": {"name": "Entity Status Verification (SoS)", "group": "Secretary of State", "mode": "manual"},
    "S3": {"name": "Public Information Mismatch (SoS)", "group": "Secretary of State", "mode": "manual"},
    "S4": {"name": "KYB Restriction for Inactive Entity", "group": "Secretary of State", "mode": "manual"},
    "ST1": {"name": "Parent Company KYB Required", "group": "Company Structure", "mode": "auto"},
    "ST2": {"name": "Foreign Entity in Ownership Chain", "group": "Company Structure", "mode": "manual"},
    "ST3": {"name": "Three-Layer Ownership Structure", "group": "Company Structure", "mode": "manual"},
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _pass(evidence: str) -> dict:
    return {"status": "pass", "evidence": evidence, "question": None}


def _flag(evidence: str, question: str = None) -> dict:
    return {"status": "flag", "evidence": evidence, "question": question}


def _fail(evidence: str) -> dict:
    return {"status": "fail", "evidence": evidence, "question": None}


def _manual(question: str, evidence: str = "") -> dict:
    return {"status": "manual", "evidence": evidence, "question": question}


def _pending(evidence: str = "Document not yet uploaded.") -> dict:
    return {"status": "pending", "evidence": evidence, "question": None}


def _norm_state(state_str: Optional[str]) -> Optional[str]:
    if not state_str:
        return None
    s = state_str.strip().upper()
    if len(s) == 2:
        return s
    STATE_NAMES = {
        "ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR",
        "CALIFORNIA": "CA", "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE",
        "FLORIDA": "FL", "GEORGIA": "GA", "HAWAII": "HI", "IDAHO": "ID",
        "ILLINOIS": "IL", "INDIANA": "IN", "IOWA": "IA", "KANSAS": "KS",
        "KENTUCKY": "KY", "LOUISIANA": "LA", "MAINE": "ME", "MARYLAND": "MD",
        "MASSACHUSETTS": "MA", "MICHIGAN": "MI", "MINNESOTA": "MN", "MISSISSIPPI": "MS",
        "MISSOURI": "MO", "MONTANA": "MT", "NEBRASKA": "NE", "NEVADA": "NV",
        "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
        "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", "OHIO": "OH", "OKLAHOMA": "OK",
        "OREGON": "OR", "PENNSYLVANIA": "PA", "RHODE ISLAND": "RI",
        "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD", "TENNESSEE": "TN",
        "TEXAS": "TX", "UTAH": "UT", "VERMONT": "VT", "VIRGINIA": "VA",
        "WASHINGTON": "WA", "WEST VIRGINIA": "WV", "WISCONSIN": "WI", "WYOMING": "WY",
        "DISTRICT OF COLUMBIA": "DC",
    }
    return STATE_NAMES.get(s)


def _parse_date(date_str: Optional[str]) -> Optional[date]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _name_in_list(name: str, members: list) -> bool:
    name_lower = name.lower().strip()
    name_parts = name_lower.split()
    for m in members:
        m_name = (m.get("name") or "").lower().strip()
        if name_lower == m_name:
            return True
        for part in name_parts:
            if len(part) > 2 and part in m_name:
                return True
    return False


# ── Formation Rules ───────────────────────────────────────────────────────────

def rule_F1(deal, docs: dict) -> dict:
    formation = docs.get("formation")
    if not formation:
        return _pending("Formation document not yet uploaded.")
    if formation.get("error"):
        return _flag(f"Extraction failed: {formation.get('notes', 'unknown error')}")

    expected = FORMATION_DOC_BY_STATE.get(deal.formation_state.upper(), "")
    found = (formation.get("doc_type_found") or "").strip()

    if not found:
        return _flag("Document type not detected in formation document.")
    if not expected:
        return _flag(f"No expected formation document type configured for state: {deal.formation_state}")

    found_lower = found.lower()
    expected_lower = expected.lower()

    if expected_lower in found_lower or found_lower in expected_lower:
        return _pass(f"Formation document type '{found}' matches expected '{expected}' for {deal.formation_state}.")
    return _fail(
        f"Document type '{found}' does not match expected '{expected}' for {deal.formation_state}."
    )


def rule_F2(deal, docs: dict) -> dict:
    if not docs.get("formation"):
        return _pending("Formation document not yet uploaded.")
    if deal.formation_state and deal.property_state:
        fs = deal.formation_state.upper()
        ps = deal.property_state.upper()
        if fs != ps:
            return _flag(
                f"Formation state ({fs}) differs from property state ({ps}).",
                "Foreign registration or Certificate of Authority in the property state is required. Request certificate of registration for this entity.",
            )
    return _pass(f"Formation state ({deal.formation_state}) matches property state ({deal.property_state}).")


def rule_F3(deal, docs: dict) -> dict:
    formation = docs.get("formation")
    if not formation:
        return _pending("Formation document not yet uploaded.")
    if formation.get("error"):
        return _flag(f"Extraction failed: {formation.get('notes', '')}")

    state_raw = formation.get("formation_state")
    if not state_raw:
        return _manual("Could not determine formation state from document. Verify it is a U.S.-formed entity.")

    normalized = _norm_state(state_raw)
    if normalized and normalized in US_STATES:
        return _pass(f"Entity formed in U.S. state: {state_raw}.")
    if not normalized:
        return _fail(f"Formation state '{state_raw}' does not appear to be a U.S. state. Entity may be non-U.S.")
    return _pass(f"Entity formed in U.S.: {state_raw}.")


def rule_F4(deal, docs: dict) -> dict:
    if not docs.get("formation"):
        return _pending("Formation document not yet uploaded.")
    state = (deal.formation_state or "").upper()
    if state in UNSUPPORTED_STATES:
        return _fail(
            f"Formation state {state} is unsupported. "
            f"Unsupported states: {', '.join(UNSUPPORTED_STATES)}."
        )
    return _pass(f"Formation state {state} is supported.")


# ── EIN Letter Rules ──────────────────────────────────────────────────────────

def rule_E1(deal, docs: dict) -> dict:
    ein = docs.get("ein")
    if not ein:
        return _pending("EIN letter not yet uploaded.")
    if ein.get("error"):
        return _flag(f"Extraction failed: {ein.get('notes', '')}")

    letter_type = (ein.get("ein_letter_type") or "").strip()
    if not letter_type:
        return _flag("EIN letter type not detected. Verify document is CP 575 A/B/G or 147C.")

    for accepted in ACCEPTED_EIN_TYPES:
        if accepted.lower() in letter_type.lower():
            return _pass(f"EIN letter type '{letter_type}' is accepted.")
    return _fail(
        f"EIN letter type '{letter_type}' is not accepted. "
        f"Accepted types: {', '.join(ACCEPTED_EIN_TYPES)}. "
        "Screenshots from IRS website and EIN Assistant printouts are not accepted."
    )


def rule_E2(deal, docs: dict) -> dict:
    formation = docs.get("formation")
    ein = docs.get("ein")
    if not ein:
        return _pending("EIN letter not yet uploaded.")
    if not formation:
        return _manual("Formation document not uploaded. Cannot compare company names.")

    formation_name = (formation.get("company_name") or "").strip()
    ein_name = (ein.get("company_name") or "").strip()

    if not formation_name:
        return _manual("Company name not found in formation document.")
    if not ein_name:
        return _manual("Company name not found in EIN letter.")
    if formation_name == ein_name:
        return _pass(f"Company name matches exactly: '{ein_name}'.")
    return _flag(
        f"Company name mismatch: EIN letter has '{ein_name}', formation document has '{formation_name}'. "
        "Name must match exactly including capitalization, spacing, and special characters."
    )


def rule_E3(deal, docs: dict) -> dict:
    ein_doc = docs.get("ein")
    if not ein_doc:
        return _pending("EIN letter not yet uploaded.")

    ein_val = (ein_doc.get("ein") or "").strip()
    if not ein_val:
        return _flag("EIN number not detected in document.")

    if re.match(r"^\d{2}-\d{7}$", ein_val):
        return _pass(f"EIN format is valid: {ein_val}.")
    return _fail(f"EIN '{ein_val}' does not follow required XX-XXXXXXX format (9 digits with hyphen).")


def rule_E4(deal, docs: dict) -> dict:
    ein = docs.get("ein")
    if not ein:
        return _manual("EIN letter not yet uploaded. Once uploaded, verify IRS authenticity.")

    has_logo = ein.get("has_irs_logo")
    if has_logo is False:
        return _flag("IRS logo not detected in EIN letter.")

    return _manual(
        "Verify the EIN letter contains the IRS logo, correct EIN number, and proper IRS formatting. "
        "Reject screenshots from IRS website and EIN Assistant printouts.",
        evidence=f"IRS logo detected: {has_logo}",
    )


def rule_E5(deal, docs: dict) -> dict:
    ein = docs.get("ein")
    if not ein:
        return _manual("EIN letter not yet uploaded.")

    responsible_party = (ein.get("responsible_party") or "").strip()
    if not responsible_party:
        return _manual("Responsible party not detected. Verify no unexpected entity is listed.")

    return _manual(
        f"Responsible party detected: '{responsible_party}'. "
        "Verify this individual is listed in the operating agreement and is an expected member or officer.",
        evidence=f"Responsible party: {responsible_party}",
    )


# ── Operating Agreement Rules ─────────────────────────────────────────────────

def rule_O1(deal, docs: dict) -> dict:
    formation = docs.get("formation")
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")
    if not formation:
        return _manual("Formation document not uploaded. Cannot compare company names.")

    formation_name = (formation.get("company_name") or "").strip()
    oa_name = (oa.get("company_name") or "").strip()

    if not formation_name:
        return _manual("Company name not found in formation document.")
    if not oa_name:
        return _manual("Company name not found in operating agreement.")
    if formation_name == oa_name:
        return _pass(f"Company name matches: '{oa_name}'.")
    return _flag(
        f"Company name mismatch: OA has '{oa_name}', formation document has '{formation_name}'."
    )


def rule_O2(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    members = oa.get("members") or []
    if not members:
        return _flag("No members detected in operating agreement. Cannot verify ownership percentages.")

    missing_pct = [m.get("name", "Unknown") for m in members if m.get("pct") is None]
    if missing_pct:
        return _flag(
            f"Ownership percentage missing for: {', '.join(missing_pct)}. "
            "All members must have clearly stated ownership percentages."
        )
    return _pass("All members have clearly stated ownership percentages.")


def rule_O3(deal, docs: dict) -> dict:
    formation = docs.get("formation")
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")
    if not formation:
        return _manual("Formation document not uploaded. Cannot compare management structures.")

    formation_mgmt = (formation.get("management_structure") or "unknown").lower()
    oa_mgmt = (oa.get("management_structure") or "unknown").lower()

    if formation_mgmt == "unknown" or oa_mgmt == "unknown":
        return _manual(
            f"Management structure could not be confirmed in one or both documents "
            f"(formation: '{formation_mgmt}', OA: '{oa_mgmt}'). "
            "Verify manually that management structures are consistent."
        )
    if formation_mgmt == oa_mgmt:
        return _pass(f"Management structure consistent: {oa_mgmt}.")
    return _flag(
        f"Management structure mismatch: formation says '{formation_mgmt}', "
        f"operating agreement says '{oa_mgmt}'."
    )


def rule_O4(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    members = oa.get("members") or []
    members_str = ", ".join(
        f"{m.get('name', 'Unknown')} ({m.get('role', 'no role')})" for m in members
    ) or "No members detected"

    return _manual(
        f"Review that member/manager roles are internally consistent throughout the agreement. "
        f"Members detected: {members_str}",
        evidence=members_str,
    )


def rule_O5(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    members = oa.get("members") or []
    names = ", ".join(m.get("name", "Unknown") for m in members) or "No names detected"

    return _manual(
        f"Verify owner names are spelled correctly and match government-issued IDs. "
        f"Names detected: {names}",
        evidence=names,
    )


def rule_O6(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    has_missing_pages = oa.get("has_missing_pages")
    has_unfilled_fields = oa.get("has_unfilled_fields")

    issues = []
    if has_missing_pages is True:
        issues.append("missing pages detected")
    if has_unfilled_fields is True:
        issues.append("unfilled fields detected")

    if issues:
        return _flag(f"Document defects: {', '.join(issues)}. Agreement may be incomplete.")
    return _manual(
        "Visually confirm the agreement has no missing pages, cut-off text, or unfilled blank fields.",
        evidence=f"Missing pages: {has_missing_pages}, Unfilled fields: {has_unfilled_fields}",
    )


def rule_O7(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    has_entity_owners = oa.get("has_entity_owners", False)
    entity_names = oa.get("entity_owner_names") or []

    if has_entity_owners or entity_names:
        names_str = ", ".join(entity_names) if entity_names else "entity owner(s) detected"
        return _flag(
            f"Entity owner(s) found: {names_str}. "
            "A full KYB review must be completed for each entity in the ownership structure."
        )
    return _pass("No entity owners detected. All owners appear to be individuals.")


def rule_O8(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    signatures_present = oa.get("signatures_present")
    if signatures_present is False:
        return _fail("Signatures not found in operating agreement. All parties must sign.")
    if signatures_present is True:
        return _pass("Signatures are present in the operating agreement.")
    return _manual("Verify all members and managers have signed the agreement.")


def rule_O9(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    uses_shareholder = oa.get("uses_shareholder_language", False)
    if uses_shareholder:
        return _flag(
            "Agreement uses 'shareholders' or 'stocks' language. "
            "LLCs must use 'members' and 'interests', not shareholder/stock terminology."
        )
    return _manual(
        "Verify agreement uses correct LLC terminology throughout (members/interests, not shareholders/stocks).",
        evidence="No shareholder language auto-detected.",
    )


def rule_O10(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    members = oa.get("members") or []
    ownership_total = oa.get("ownership_total")

    if ownership_total is not None:
        try:
            total = float(ownership_total)
            if abs(total - 100.0) <= 0.01:
                return _pass(f"Ownership totals 100% ({total}%).")
            return _fail(f"Ownership totals {total}% — must equal exactly 100%.")
        except (ValueError, TypeError):
            pass

    if members:
        pcts = [m.get("pct") for m in members if m.get("pct") is not None]
        if pcts:
            total = sum(float(p) for p in pcts)
            if abs(total - 100.0) <= 0.01:
                return _pass(f"Ownership percentages sum to 100% ({total}%).")
            return _fail(f"Ownership percentages sum to {total}% — must equal exactly 100%.")

    return _manual("Ownership percentages not fully detected. Verify total equals 100%.")


def rule_O11(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    references_exhibits = oa.get("references_unattached_exhibits")
    if references_exhibits is True:
        return _flag(
            "Agreement references exhibits or schedules that appear unattached. "
            "All referenced exhibits must be included."
        )
    return _manual(
        "Confirm all exhibits and schedules referenced in the agreement are attached.",
        evidence=f"Auto-detected unattached exhibits: {references_exhibits}",
    )


def rule_O12(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    entity_type = (oa.get("entity_type_stated") or "").lower()
    corp_keywords = ["corporation", "inc.", "incorporated", "s-corp", "c-corp", "shareholder", "stock"]
    has_corp_language = any(kw in entity_type for kw in corp_keywords)
    has_llc_language = "llc" in entity_type or "limited liability" in entity_type

    if has_corp_language and not has_llc_language:
        return _flag(
            f"Operating agreement refers to entity as '{oa.get('entity_type_stated')}'. "
            "This conflicts with LLC structure. Agreement should reference LLC/limited liability company."
        )
    return _pass(f"Entity type stated as: '{oa.get('entity_type_stated', 'not specified')}'.")


def rule_O13(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    oa_members = oa.get("members") or []
    deal_members = [{"name": m.name} for m in deal.members] if deal.members else []

    unlisted = []
    for om in oa_members:
        name = (om.get("name") or "").strip()
        role = (om.get("role") or "").lower()
        if not name:
            continue
        significant_roles = ["member", "manager", "owner", "president", "officer"]
        is_significant = any(r in role for r in significant_roles) or not role
        if is_significant and not _name_in_list(name, deal_members):
            unlisted.append(f"{name} ({om.get('role', 'unspecified role')})")

    if unlisted:
        return _flag(
            f"Individual(s) in operating agreement not listed as deal members: {', '.join(unlisted)}. "
            "Verify their current role and add to deal if still involved."
        )
    if not deal_members:
        return _manual("No deal members configured. Add members to verify OA member alignment.")
    return _pass("All operating agreement members are accounted for in deal members.")


def rule_O14(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    has_restriction = oa.get("has_loan_term_restriction")
    restriction_detail = oa.get("loan_term_restriction_detail")

    if has_restriction is True:
        detail_text = f" Language found: '{restriction_detail}'" if restriction_detail else ""
        return _flag(
            f"Operating agreement contains loan term restriction language.{detail_text} "
            "Verify this does not conflict with the actual Waltz mortgage term."
        )
    return _manual(
        "Verify the agreement contains no language limiting the borrowing authority period "
        "to less than the actual Waltz mortgage term.",
        evidence=f"Auto-detected restriction: {has_restriction}",
    )


# ── Certificate of Good Standing Rules ───────────────────────────────────────

def rule_C1(deal, docs: dict) -> dict:
    cogs = docs.get("cogs")
    if not cogs:
        return _pending("Certificate of Good Standing not yet uploaded.")
    if cogs.get("error"):
        return _flag(f"Extraction failed: {cogs.get('notes', '')}")

    doc_type = (cogs.get("doc_type_found") or "").lower()
    if not doc_type:
        return _flag("Document type not detected in certificate.")

    if any(name in doc_type for name in COGS_NAMES_ACCEPTED):
        return _pass(f"Certificate type '{cogs.get('doc_type_found')}' is accepted.")
    return _fail(
        f"Certificate type '{cogs.get('doc_type_found')}' is not accepted. "
        "Must be Certificate of Good Standing, Existence, Status, or Authorization."
    )


def rule_C2(deal, docs: dict) -> dict:
    cogs = docs.get("cogs")
    if not cogs:
        return _pending("Certificate of Good Standing not yet uploaded.")

    issue_date_str = cogs.get("cogs_issue_date")
    if not issue_date_str:
        return _flag("Issue date not detected in certificate. Cannot verify freshness.")

    issue_date = _parse_date(issue_date_str)
    if not issue_date:
        return _flag(f"Could not parse issue date '{issue_date_str}'. Verify date manually.")

    closing_date_str = deal.closing_date
    if not closing_date_str:
        return _manual(
            f"Certificate issue date: {issue_date_str}. No closing date set on deal — cannot verify staleness.",
            evidence=f"Issue date: {issue_date_str}",
        )

    closing_date = _parse_date(closing_date_str)
    if not closing_date:
        return _flag(f"Could not parse closing date '{closing_date_str}'.")

    delta = (closing_date - issue_date).days
    if delta < 0:
        return _flag(
            f"Certificate issue date ({issue_date_str}) is after the closing date ({closing_date_str})."
        )
    if delta > COGS_MAX_DAYS:
        return _fail(
            f"Certificate is {delta} days old from closing date — must be within {COGS_MAX_DAYS} days. "
            f"Issue date: {issue_date_str}, Closing date: {closing_date_str}."
        )
    return _pass(
        f"Certificate is {delta} day(s) from closing date — within the {COGS_MAX_DAYS}-day requirement."
    )


def rule_C3(deal, docs: dict) -> dict:
    cogs = docs.get("cogs")
    if not cogs:
        return _manual("Certificate not yet uploaded. Once uploaded, confirm it is official state-issued.")
    return _manual(
        "Confirm this is the official state-issued certificate, not a third-party status report or unofficial document.",
        evidence=f"Document type detected: {cogs.get('doc_type_found', 'unknown')}",
    )


def rule_C4(deal, docs: dict) -> dict:
    cogs = docs.get("cogs")
    if not cogs:
        return _pending("Certificate of Good Standing not yet uploaded.")

    cert_state_raw = cogs.get("cogs_state")
    if not cert_state_raw:
        return _manual("Certificate state not detected. Verify state matches formation or property state.")

    cert_state = _norm_state(cert_state_raw) or cert_state_raw.upper()
    formation_state = (deal.formation_state or "").upper()
    property_state = (deal.property_state or "").upper()

    if cert_state in (formation_state, property_state):
        return _pass(f"Certificate state ({cert_state}) matches formation/property state.")
    return _flag(
        f"Certificate state ({cert_state}) does not match formation state ({formation_state}) "
        f"or property state ({property_state})."
    )


def rule_C5(deal, docs: dict) -> dict:
    formation = docs.get("formation")
    cogs = docs.get("cogs")
    if not cogs:
        return _pending("Certificate of Good Standing not yet uploaded.")
    if not formation:
        return _manual("Formation document not uploaded. Cannot compare company names.")

    formation_name = (formation.get("company_name") or "").strip()
    cogs_name = (cogs.get("company_name") or "").strip()

    if not formation_name:
        return _manual("Company name not found in formation document.")
    if not cogs_name:
        return _manual("Company name not found in certificate.")
    if formation_name == cogs_name:
        return _pass(f"Company name matches: '{cogs_name}'.")
    return _flag(
        f"Company name mismatch: certificate has '{cogs_name}', "
        f"formation document has '{formation_name}'."
    )


# ── LLC Address Rules ─────────────────────────────────────────────────────────

def rule_A1(deal, docs: dict) -> dict:
    formation = docs.get("formation")
    oa = docs.get("oa")

    if not formation and not oa:
        return _pending("Documents not yet uploaded.")

    reg_agent = None
    biz_address = None

    for doc in [formation, oa]:
        if doc:
            if not reg_agent:
                reg_agent = doc.get("registered_agent")
            if not biz_address:
                biz_address = doc.get("business_address")

    if reg_agent and biz_address:
        reg_lower = reg_agent.lower()
        biz_lower = biz_address.lower()
        # Simple overlap check
        reg_parts = [p for p in reg_lower.split() if len(p) > 4]
        overlap = sum(1 for p in reg_parts if p in biz_lower)
        if overlap >= 2:
            return _flag(
                f"Registered agent address appears same as business address. "
                f"Registered agent: '{reg_agent}'. Business: '{biz_address}'. "
                "Confirm with client that mortgage servicing correspondence can be sent here.",
                "Confirm with client that they agree to receive mortgage servicing correspondence at the registered agent address.",
            )

    return _manual(
        "Confirm business address is appropriate for mortgage servicing correspondence.",
        evidence=f"Registered agent: {reg_agent or 'not found'} | Business address: {biz_address or 'not found'}",
    )


def rule_A2(deal, docs: dict) -> dict:
    all_docs = [d for d in [docs.get("formation"), docs.get("oa"), docs.get("ein")] if d]
    if not all_docs:
        return _pending("Documents not yet uploaded.")

    for doc in all_docs:
        if doc.get("is_foreign_address") is True:
            return _flag(
                "Non-U.S. business address detected. "
                "The LLC's business address must be a U.S. address for mortgage servicing and banking purposes."
            )
    return _pass("No foreign business address detected.")


# ── Secretary of State Rules (all manual) ────────────────────────────────────

def rule_S1(deal, docs: dict) -> dict:
    return _manual(
        f"Check {deal.formation_state} Secretary of State records. "
        "Confirm no additional owners or members appear that are not part of this deal. "
        "If found, verify their current involvement and add or resolve accordingly."
    )


def rule_S2(deal, docs: dict) -> dict:
    return _manual(
        f"Verify entity status on {deal.formation_state} Secretary of State is 'Active' or 'Good Standing'. "
        "If inactive, dissolved, or suspended, the entity must be reinstated before KYB approval."
    )


def rule_S3(deal, docs: dict) -> dict:
    return _manual(
        f"Compare {deal.formation_state} SoS public records (company name, formation date, entity type, "
        "registered agent) against submitted documents. Flag any discrepancies."
    )


def rule_S4(deal, docs: dict) -> dict:
    return _manual(
        "Confirm entity is currently active and in good standing. "
        "KYB cannot be approved for inactive, dissolved, terminated, or suspended entities."
    )


# ── Company Structure Rules ───────────────────────────────────────────────────

def rule_ST1(deal, docs: dict) -> dict:
    oa = docs.get("oa")
    if not oa:
        return _pending("Operating agreement not yet uploaded.")

    has_entity_owners = oa.get("has_entity_owners", False)
    entity_names = oa.get("entity_owner_names") or []

    if has_entity_owners or entity_names:
        names_str = ", ".join(entity_names) if entity_names else "entity owner(s)"
        return _flag(
            f"Entity owner(s) detected: {names_str}. "
            "A full KYB review must be completed for each entity in the ownership structure before this deal can proceed."
        )
    return _pass("No parent companies detected. Direct individual ownership confirmed.")


def rule_ST2(deal, docs: dict) -> dict:
    return _manual(
        "Verify no foreign (non-U.S.) entities appear anywhere in the ownership chain. "
        "Foreign entity ownership is generally not supported by Waltz note buyers and may block deal approval."
    )


def rule_ST3(deal, docs: dict) -> dict:
    return _manual(
        "If the ownership structure includes more than two layers "
        "(e.g. individual → holding LLC → borrower LLC), flag for note-buyer compatibility review. "
        "Some Waltz note buyers do not support three-layer structures."
    )


# ── Rules Engine ──────────────────────────────────────────────────────────────

RULE_FUNCTIONS = {
    "F1": rule_F1, "F2": rule_F2, "F3": rule_F3, "F4": rule_F4,
    "E1": rule_E1, "E2": rule_E2, "E3": rule_E3, "E4": rule_E4, "E5": rule_E5,
    "O1": rule_O1, "O2": rule_O2, "O3": rule_O3, "O4": rule_O4, "O5": rule_O5,
    "O6": rule_O6, "O7": rule_O7, "O8": rule_O8, "O9": rule_O9, "O10": rule_O10,
    "O11": rule_O11, "O12": rule_O12, "O13": rule_O13, "O14": rule_O14,
    "C1": rule_C1, "C2": rule_C2, "C3": rule_C3, "C4": rule_C4, "C5": rule_C5,
    "A1": rule_A1, "A2": rule_A2,
    "S1": rule_S1, "S2": rule_S2, "S3": rule_S3, "S4": rule_S4,
    "ST1": rule_ST1, "ST2": rule_ST2, "ST3": rule_ST3,
}


def run_rules_engine(deal, db) -> list:
    from models import Document, RuleResult

    documents = db.query(Document).filter(Document.deal_id == deal.id).all()
    docs = {}
    doc_type_map = {"formation": "formation", "ein": "ein", "oa": "oa", "cogs": "cogs"}
    for doc in documents:
        dt = doc_type_map.get(doc.doc_type)
        if dt and doc.extracted_json:
            try:
                docs[dt] = json.loads(doc.extracted_json)
            except json.JSONDecodeError:
                docs[dt] = {}

    results = []
    for rule_id, rule_fn in RULE_FUNCTIONS.items():
        try:
            result = rule_fn(deal, docs)
        except Exception as e:
            result = _flag(f"Rule evaluation error: {e}")

        existing = db.query(RuleResult).filter(
            RuleResult.deal_id == deal.id,
            RuleResult.rule_id == rule_id,
        ).first()

        if existing:
            existing.status = result["status"]
            existing.evidence = result.get("evidence", "")
            existing.question = result.get("question")
        else:
            new_rule = RuleResult(
                deal_id=deal.id,
                rule_id=rule_id,
                status=result["status"],
                evidence=result.get("evidence", ""),
                question=result.get("question"),
                resolved=False,
            )
            db.add(new_rule)

        meta = RULE_METADATA.get(rule_id, {})
        results.append({
            "rule_id": rule_id,
            "name": meta.get("name", rule_id),
            "group": meta.get("group", ""),
            "mode": meta.get("mode", "auto"),
            **result,
        })

    db.commit()
    return results
