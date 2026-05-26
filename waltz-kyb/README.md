# Waltz KYB Document Validation Platform

AI-powered KYB (Know Your Business) document review platform for Waltz. Upload formation documents, EIN letters, operating agreements, and certificates of good standing — Claude extracts structured data and runs 37 automated validation rules.

## Setup

### Backend

```bash
cd waltz-kyb/backend
pip install -r requirements.txt
```

Create a `.env` file:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Start the server:
```bash
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. The SQLite database (`kyb.db`) and `uploads/` folder are created automatically on first start.

### Frontend

```bash
cd waltz-kyb/frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Usage

1. Click **+ New Deal** to create a KYB deal (enter entity name, formation state, property state, closing date)
2. Go to the **Documents** tab and upload the four required documents
3. Claude automatically extracts structured data from each document
4. View **Validation** tab to see all 37 rule results — auto-checked rules run immediately, manual/assisted rules show reviewer questions
5. Resolve flags/failures as you work through them
6. Check **Entity Facts** to see extracted values across documents — click any fact to override
7. Add deal members in the **Members** tab
8. Once all issues are resolved, click **Approve KYB**

## Architecture

```
waltz-kyb/
├── backend/
│   ├── main.py        FastAPI routes
│   ├── models.py      SQLAlchemy models (Deal, Document, RuleResult, EntityFact, AuditLog)
│   ├── database.py    SQLite setup
│   ├── extraction.py  Claude claude-sonnet-4-20250514 vision API for document extraction
│   ├── rules.py       All 37 validation rules
│   └── facts.py       Entity facts derivation and consistency checking
└── frontend/
    └── src/
        ├── App.jsx           Layout + navigation
        ├── api.js            API client
        └── components/
            ├── tabs/         Documents, Validation, Facts, Members, Audit
            ├── RuleCard.jsx  Expandable rule with resolve/request actions
            └── FactCard.jsx  Editable entity fact with conflict detection
```

## Validation Rules

| Group | Rules | Mode |
|-------|-------|------|
| Formation | F1-F4 | Auto |
| EIN Letter | E1-E5 | Auto + Manual |
| Operating Agreement | O1-O14 | Auto + Assisted |
| Certificate of Good Standing | C1-C5 | Auto + Manual |
| LLC Address | A1-A2 | Auto + Assisted |
| Secretary of State | S1-S4 | Manual |
| Company Structure | ST1-ST3 | Auto + Manual |
