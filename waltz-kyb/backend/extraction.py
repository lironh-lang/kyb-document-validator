import base64
import json
import logging
import os
import re
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a KYB document analyst for Waltz, a real estate mortgage company. "
    "Extract structured information from the uploaded document and return ONLY a valid JSON object. "
    "No markdown, no explanation, no preamble. "
    "Be precise — exact company name spelling and capitalization matters for compliance checks."
)

EXTRACTION_SCHEMA = """{
  "doc_type_found": "exact document type name as it appears",
  "company_name": "exact legal name with original capitalization and punctuation",
  "formation_state": "state name or abbreviation as it appears",
  "formation_date": "date string",
  "state_control_id": "state/control/document ID",
  "ein": "XX-XXXXXXX format or null",
  "ein_letter_type": "CP 575 A / CP 575 B / CP 575 G / 147C or null",
  "responsible_party": "name if present or null",
  "management_structure": "manager-managed / member-managed / unknown",
  "entity_type_stated": "how document refers to entity type",
  "members": [
    {"name": "full name", "pct": null, "role": "member/managing member/manager/etc", "signed": null}
  ],
  "ownership_total": null,
  "signatures_present": null,
  "has_missing_pages": null,
  "has_unfilled_fields": null,
  "has_entity_owners": false,
  "entity_owner_names": [],
  "has_loan_term_restriction": null,
  "loan_term_restriction_detail": null,
  "references_unattached_exhibits": null,
  "uses_shareholder_language": false,
  "cogs_issue_date": null,
  "cogs_state": null,
  "business_address": null,
  "registered_agent": null,
  "is_foreign_address": null,
  "has_irs_logo": null,
  "notes": null
}"""


def extract_document(file_path: str, doc_type: str, deal_context: dict) -> dict:
    try:
        path = Path(file_path)
        file_bytes = path.read_bytes()
        b64_data = base64.b64encode(file_bytes).decode("utf-8")

        suffix = path.suffix.lower()
        if suffix == ".pdf":
            media_type = "application/pdf"
            content_block = {
                "type": "document",
                "source": {"type": "base64", "media_type": media_type, "data": b64_data},
            }
        elif suffix in (".jpg", ".jpeg"):
            media_type = "image/jpeg"
            content_block = {
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": b64_data},
            }
        else:
            media_type = "image/png"
            content_block = {
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": b64_data},
            }

        entity_name = deal_context.get("name", "Unknown Entity")
        formation_state = deal_context.get("formation_state", "unknown")
        property_state = deal_context.get("property_state", "unknown")
        closing_date = deal_context.get("closing_date", "unknown")
        members = deal_context.get("members", [])
        members_str = ", ".join(
            f"{m.get('name', '')} ({m.get('ownership_pct', '?')}%)" for m in members
        ) or "none listed"

        user_prompt = (
            f'Extract all KYB-relevant fields from this {doc_type} document for entity "{entity_name}" '
            f"(formation state: {formation_state}, property state: {property_state}, "
            f"closing date: {closing_date}, deal members: {members_str}).\n\n"
            f"Return exactly this JSON structure (null for any field not found):\n{EXTRACTION_SCHEMA}"
        )

        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        content_block,
                        {"type": "text", "text": user_prompt},
                    ],
                }
            ],
        )

        raw_text = response.content[0].text if response.content else ""
        clean_text = re.sub(r"```json\s*|\s*```", "", raw_text).strip()
        parsed = json.loads(clean_text)
        return parsed

    except json.JSONDecodeError as e:
        logger.error("Failed to parse extraction JSON: %s", e)
        return {"error": "json_parse_error", "notes": str(e)}
    except anthropic.APIError as e:
        logger.error("Anthropic API error: %s", e)
        return {"error": "api_error", "notes": str(e)}
    except Exception as e:
        logger.error("Extraction failed: %s", e)
        return {"error": "extraction_failed", "notes": str(e)}
