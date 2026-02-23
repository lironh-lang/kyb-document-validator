import { useState, useRef } from "react";

const SUPPORTED_STATES = ["AL","AK","AZ","AR","CO","CT","DC","DE","FL","GA","HI","IA","ID","IL","IN","KS","KY","LA","ME","MD","MI","MN","MO","MS","MT","NE","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WV","WI","WY"];
const UNSUPPORTED_STATES = ["CA","ID","MN","NV","ND","OR","SD","UT","VT"];
const FORMATION_DOC_NAMES = {
  "Articles of Organization": ["AL","AK","AZ","CA","CO","FL","GA","HI","ID","IN","IA","KS","KY","LA","ME","MN","MO","MT","NE","NV","NH","NM","NY","NC","ND","OH","OK","OR","SC","SD","TN","VT","VA","WV","WI","WY"],
  "Certificate of Organization": ["CT","MI","PA","UT"],
  "Certificate of Formation": ["DE","MS","NH","NJ","RI","TX","WA"],
};
const EIN_TYPES = ["CP 575 A","CP 575 B","CP 575 G","147C"];
const CGS_NAMES = {
  "Certificate of Good Standing": ["AL","AK","AZ","AR","CA","CO","CT","DC","GA","HI","IA","IL","IN","KS","KY","LA","ME","MI","MN","MO","MT","NE","NV","NH","NJ","NM","NC","ND","OH","OK","OR","PA","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY"],
  "Certificate of Existence": ["DE","ID","MD","MS","TN"],
  "Certificate of Status": ["FL","MI","TX"],
  "Certificate of Authorization": ["PR"],
};
const DOC_TYPES = [
  { id:"formation", label:"Formation Document", icon:"🏛️" },
  { id:"ein",       label:"EIN Letter",          icon:"🔢" },
  { id:"operating", label:"Operating Agreement", icon:"📋" },
  { id:"cgs",       label:"Certificate of Good Standing", icon:"✅" },
  { id:"fincen",    label:"FinCEN BOI Report",   icon:"🏦", conditional:true },
];

// Fields that can be manually overridden (boolean fields where AI may be uncertain)
const OVERRIDABLE = {
  operating: [
    { key:"signed",              label:"All parties have signed (override if AI missed signatures)" },
    { key:"ownershipClear",      label:"Ownership percentages are clearly stated" },
    { key:"noMissingPages",      label:"No missing pages / blank fields / cut-off text" },
    { key:"formationStateMatches",label:"Formation state in agreement matches formation doc" },
    { key:"entityOwners",        label:"Entity owners are listed (companies as owners)" },
    { key:"structureMismatch",   label:"Management structure mismatch suspected" },
    { key:"missingExhibits",     label:"References unattached exhibits/schedules" },
    { key:"unlisted",            label:"Someone in agreement not listed as deal member" },
    { key:"registeredAgentAsAddress", label:"Registered agent address used as business address" },
  ],
  ein: [
    { key:"hasIrsLogo", label:"IRS logo, form number & formatting confirmed" },
  ],
  fincen: [
    { key:"isOfficialReport", label:"Starts with official BOIR status header" },
    { key:"einMatch",         label:"EIN matches the EIN letter" },
    { key:"stateMatch",       label:"State of formation matches formation doc" },
    { key:"ownersMatch",      label:"Beneficial owners match Operating Agreement" },
  ],
};

// ── Validators ────────────────────────────────────────────────────────────
function validateFormation(f, ctx) {
  const issues = [];
  if (!f.docName) issues.push({ type:"error", msg:"Document name not found." });
  else {
    const valid = Object.keys(FORMATION_DOC_NAMES);
    if (!valid.includes(f.docName)) issues.push({ type:"error", msg:`Unsupported document type: "${f.docName}".` });
    else if (f.state && !FORMATION_DOC_NAMES[f.docName].includes(f.state))
      issues.push({ type:"error", msg:`"${f.docName}" is not the correct formation doc for ${f.state}.` });
  }
  if (!f.companyName) issues.push({ type:"error", msg:"Company name not found." });
  if (!f.state) issues.push({ type:"error", msg:"Formation state not found." });
  else {
    if (UNSUPPORTED_STATES.includes(f.state)) issues.push({ type:"error", msg:`Unsupported U.S. state: ${f.state}.` });
    if (ctx.propertyState && f.state !== ctx.propertyState)
      issues.push({ type:"warning", msg:`Formation state (${f.state}) doesn't match property state (${ctx.propertyState}).` });
  }
  if (!f.stateId) issues.push({ type:"error", msg:"State/Control/Document ID not found." });
  if (!f.formationDate) issues.push({ type:"error", msg:"Date of formation not found." });
  else if (new Date(f.formationDate) > new Date()) issues.push({ type:"warning", msg:"Formation date is in the future." });
  if (!f.registeredAgent) issues.push({ type:"warning", msg:"Registered agent not found — may be needed for address cross-check." });
  if (!issues.length) issues.push({ type:"pass", msg:"Formation document passed all validations." });
  return issues;
}
function validateEIN(e, ctx) {
  const issues = [];
  const refName = ctx.formationCompanyName;
  if (!e.letterType) issues.push({ type:"error", msg:"EIN letter type not found." });
  else if (!EIN_TYPES.some(t => e.letterType.includes(t)))
    issues.push({ type:"error", msg:`Unsupported type: "${e.letterType}". Accepted: ${EIN_TYPES.join(", ")}.` });
  if (!e.companyName) issues.push({ type:"error", msg:"Company name not found." });
  else if (refName && e.companyName !== refName)
    issues.push({ type:"error", msg:`Name mismatch: EIN="${e.companyName}" vs formation="${refName}".` });
  if (!e.ein) issues.push({ type:"error", msg:"EIN number not found." });
  else if (!/^\d{2}-?\d{7}$/.test(e.ein.trim()))
    issues.push({ type:"error", msg:`Invalid EIN format: "${e.ein}". Must be XX-XXXXXXX.` });
  if (!e.hasIrsLogo) issues.push({ type:"warning", msg:"IRS logo/authenticity not confirmed — verify manually." });
  if (!e.responsibleParty) issues.push({ type:"warning", msg:"Responsible party not found — verify no unexpected entity listed." });
  if (e.letterType && e.companyType) {
    if (e.companyType?.toLowerCase().includes("single") && !e.letterType.includes("575 A"))
      issues.push({ type:"warning", msg:`Single-Member LLC typically uses CP 575 A, but "${e.letterType}" found.` });
    if (e.companyType?.toLowerCase().includes("multi") && !e.letterType.includes("575 B"))
      issues.push({ type:"warning", msg:`Multi-Member LLC typically uses CP 575 B, but "${e.letterType}" found.` });
  }
  if (!issues.length) issues.push({ type:"pass", msg:"EIN letter passed all validations." });
  return issues;
}
function validateOperating(o, ctx) {
  const issues = [];
  const refName = ctx.formationCompanyName;
  if (!o.companyName) issues.push({ type:"error", msg:"Company name not found." });
  else if (refName && o.companyName !== refName)
    issues.push({ type:"error", msg:`Name mismatch: agreement="${o.companyName}" vs formation="${refName}".` });
  if (!o.ownershipClear) issues.push({ type:"error", msg:"Ownership percentages not clearly stated." });
  if (o.ownershipTotal !== undefined && o.ownershipTotal !== null && o.ownershipTotal !== "") {
    const total = parseFloat(o.ownershipTotal);
    if (isNaN(total)) issues.push({ type:"warning", msg:"Could not parse ownership total — verify manually." });
    else if (total !== 100) issues.push({ type:"error", msg:`Ownership totals ${total}% — must equal 100%.` });
  } else issues.push({ type:"warning", msg:"Ownership total not found — verify manually." });
  if (!o.signed) issues.push({ type:"error", msg:"Agreement missing signatures from all parties." });
  if (!o.noMissingPages) issues.push({ type:"error", msg:"Missing pages, blank fields, or cut-off text detected." });
  if (o.entityOwners) issues.push({ type:"warning", msg:"Entity owners listed — additional KYB verification required." });
  if (o.structureMismatch) issues.push({ type:"warning", msg:"Management structure may differ from formation document." });
  if (o.missingExhibits) issues.push({ type:"warning", msg:"Agreement references unattached exhibits or schedules." });
  if (o.unlisted) issues.push({ type:"warning", msg:"Individual in agreement not listed as deal member — verify." });
  if (o.registeredAgentAsAddress) issues.push({ type:"info", msg:"Business Address Confirmation Needed: registered agent address used as business address — confirm mailing preference with client." });
  if (!o.formationStateMatches) issues.push({ type:"warning", msg:"Formation state in agreement not confirmed to match formation document." });
  if (o.terminationYears !== null && o.terminationYears !== undefined) {
    if (o.terminationYears < 35) issues.push({ type:"error", msg:`Company termination term is ${o.terminationYears} years — must be at least 35 years. Clause: "${o.terminationClause || 'see agreement'}"` });
  } else {
    issues.push({ type:"warning", msg:"Company termination/duration clause not found — verify the agreement specifies at least 35 years." });
  }
  if (!issues.length) issues.push({ type:"pass", msg:"Operating agreement passed all validations." });
  return issues;
}
function validateCGS(c, ctx) {
  const issues = [];
  const refName = ctx.formationCompanyName;
  const refState = ctx.formationState;
  if (!c.certName) issues.push({ type:"error", msg:"Certificate name not found." });
  else if (!Object.keys(CGS_NAMES).includes(c.certName))
    issues.push({ type:"error", msg:`Unsupported certificate type: "${c.certName}".` });
  else if (c.state && !CGS_NAMES[c.certName].includes(c.state))
    issues.push({ type:"warning", msg:`"${c.certName}" may not be correct for ${c.state}.` });
  if (!c.companyName) issues.push({ type:"error", msg:"Company name not found." });
  else if (refName && c.companyName !== refName)
    issues.push({ type:"error", msg:`Name mismatch: cert="${c.companyName}" vs formation="${refName}".` });
  if (!c.state) issues.push({ type:"error", msg:"Certificate state not found." });
  else if (refState && c.state !== refState)
    issues.push({ type:"warning", msg:`Cert state (${c.state}) doesn't match formation state (${refState}).` });
  if (!c.issueDate) issues.push({ type:"error", msg:"Issue date not found." });
  else if (ctx.closingDate) {
    const diff = (new Date(ctx.closingDate) - new Date(c.issueDate)) / 86400000;
    if (diff > 30) issues.push({ type:"error", msg:`Certificate is ${Math.round(diff)} days old from closing — must be within 30 days.` });
    else if (diff < 0) issues.push({ type:"warning", msg:"Certificate issue date is after the closing date." });
  }
  if (!issues.length) issues.push({ type:"pass", msg:"Certificate of Good Standing passed all validations." });
  return issues;
}
function validateFinCEN(f, ctx) {
  const issues = [];
  const refName = ctx.formationCompanyName;
  if (!f.isOfficialReport) issues.push({ type:"error", msg:"Not an official FinCEN BOIR." });
  if (!f.companyName) issues.push({ type:"error", msg:"Company name in Reporting Company section not found." });
  else if (refName && f.companyName !== refName)
    issues.push({ type:"error", msg:`Name mismatch: BOI="${f.companyName}" vs formation="${refName}".` });
  if (!f.einMatch) issues.push({ type:"error", msg:"EIN in BOI report doesn't match the EIN letter." });
  if (!f.stateMatch) issues.push({ type:"warning", msg:"State of formation in BOI not confirmed to match formation document." });
  if (!f.ownersMatch) issues.push({ type:"error", msg:"Beneficial owners in BOI don't match Operating Agreement owners." });
  if (!issues.length) issues.push({ type:"pass", msg:"FinCEN BOI Report passed all validations." });
  return issues;
}
const VALIDATORS = { formation:validateFormation, ein:validateEIN, operating:validateOperating, cgs:validateCGS, fincen:validateFinCEN };

// ── AI Prompt ─────────────────────────────────────────────────────────────
function buildPrompt(docType, ctx) {
  const ctxBlock = `Property State: ${ctx.propertyState||"unknown"} | Closing Date: ${ctx.closingDate||"unknown"} | Formation Company Name: ${ctx.formationCompanyName||"unknown"} | Formation State: ${ctx.formationState||"unknown"} | Known EIN: ${ctx.ein||"unknown"}`;
  const schemas = {
    formation:`{"docName":"Articles of Organization|Certificate of Organization|Certificate of Formation","companyName":"exact as written","state":"2-letter state code","stateId":"State/Control/Document ID number","formationDate":"YYYY-MM-DD","registeredAgent":"name or null","addresses":"or null","ownerNames":["list or empty array"]}`,
    ein:`{"letterType":"CP 575 A|CP 575 B|CP 575 G|147C","companyName":"exact as written","ein":"XX-XXXXXXX","companyType":"Single-Member LLC|Multi-Member LLC|Partnership|S-Corp|C-Corp","responsibleParty":"name or null","hasIrsLogo":true if IRS letterhead and logo are visible}`,
    operating:`{"companyName":"exact as written","ownershipClear":true if ownership percentages are explicitly stated anywhere in the document,"ownershipTotal":sum of all ownership percentages as a number or null if not found,"owners":[{"name":"","percentage":0,"role":""}],"signed":true ONLY if you can clearly and explicitly see completed signatures — handwritten, DocuSign stamps, or typed signature blocks with names actually filled in. If signature lines are blank, empty, or absent return false. If you cannot clearly confirm signatures exist return false,"noMissingPages":true if document appears complete with no obvious gaps or cut-off sentences,"entityOwners":true only if a company LLC or entity is listed as an owner,"structureMismatch":false unless you clearly see conflicting management terms,"missingExhibits":true only if the text explicitly says 'see Exhibit' or 'attached hereto' but no exhibit follows,"unlisted":false unless you clearly see a name that seems to be a non-party individual,"registeredAgentAsAddress":true only if the same address is labeled both as registered agent and business address,"formationStateMatches":true if a state is mentioned that matches the formation state or if no conflicting state is mentioned,"terminationYears":extract the number of years specified for company termination/duration if mentioned (e.g. 25 from 'twenty-five (25) years') or null if not mentioned,"terminationClause":"exact sentence about company term/duration or null if not found"}`,
    cgs:`{"certName":"Certificate of Good Standing|Certificate of Existence|Certificate of Status|Certificate of Authorization","companyName":"exact as written","state":"2-letter state code","issueDate":"YYYY-MM-DD or null"}`,
    fincen:`{"isOfficialReport":true if document contains 'Beneficial Ownership Information Report' or 'BOIR',"companyName":"exact from Reporting Company section","beneficialOwners":["list of names"],"einMatch":true if EIN in report matches known EIN or if only one EIN is present,"stateMatch":true if formation state in report matches known formation state or if only one state is present,"ownersMatch":true if beneficial owners listed seem consistent with a typical operating agreement}`,
  };
  return `You are a KYB document validation expert for a US mortgage company. Carefully analyze this document and extract all fields. For most boolean fields, lean toward TRUE if there is reasonable evidence. EXCEPTION: for the "signed" field, be strict — only return true if you can clearly and explicitly see actual signatures (handwritten, DocuSign, or typed signature blocks with names filled in). If signature lines are blank, missing, or you are unsure, return false.

Return ONLY a valid JSON object. No markdown, no explanation.

Context: ${ctxBlock}
Schema: ${schemas[docType]}`;
}

// ── UI helpers ────────────────────────────────────────────────────────────
const SEV = { error:"🔴", warning:"🟡", pass:"🟢", info:"🔵" };
const SEV_BG = { error:"bg-red-50 border-red-200 text-red-800", warning:"bg-yellow-50 border-yellow-200 text-yellow-800", pass:"bg-green-50 border-green-200 text-green-800", info:"bg-blue-50 border-blue-200 text-blue-800" };
const FIELD_LABELS = {
  formation:{ docName:"Document Type", companyName:"Company Name", state:"State", stateId:"Doc/State ID", formationDate:"Formation Date", registeredAgent:"Registered Agent" },
  ein:{ letterType:"Letter Type", companyName:"Company Name", ein:"EIN", companyType:"Company Type", responsibleParty:"Responsible Party", hasIrsLogo:"IRS Logo Confirmed" },
  operating:{ companyName:"Company Name", ownershipClear:"Ownership Clear", ownershipTotal:"Ownership Total %", signed:"Fully Signed", noMissingPages:"No Missing Pages", entityOwners:"Entity Owners", structureMismatch:"Structure Mismatch", missingExhibits:"Missing Exhibits", unlisted:"Unlisted Members", registeredAgentAsAddress:"Agent as Biz Address", formationStateMatches:"Formation State Matches", terminationYears:"Termination Term (years)", terminationClause:"Termination Clause" },
  cgs:{ certName:"Certificate Name", companyName:"Company Name", state:"State", issueDate:"Issue Date" },
  fincen:{ companyName:"Company Name", isOfficialReport:"Official BOIR", einMatch:"EIN Match", stateMatch:"State Match", ownersMatch:"Owners Match", beneficialOwners:"Beneficial Owners" },
};

function ToggleOverride({ fieldKey, label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <button
        onClick={() => onChange(fieldKey, !value)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${value ? "bg-green-500" : "bg-red-400"}`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${value ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export default function App() {
  const [ctx, setCtx] = useState({ propertyState:"", closingDate:"", ownerNoITIN:false });
  const [step, setStep] = useState("select");
  const [selectedType, setSelectedType] = useState(null);
  const [file, setFile] = useState(null);
  const [extracted, setExtracted] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);
  const [showOverrides, setShowOverrides] = useState(false);
  const fileRef = useRef();

  const visibleDocs = DOC_TYPES.filter(d => !d.conditional || ctx.ownerNoITIN);

  const buildCtx = () => ({
    propertyState: ctx.propertyState,
    closingDate: ctx.closingDate,
    formationCompanyName: null,
    formationState: null,
    ein: null,
  });

  const revalidate = (data) => {
    const vresult = VALIDATORS[selectedType](data, buildCtx());
    setValidationResult(vresult);
  };

  const handleOverride = (key, val) => {
    const updated = { ...extracted, [key]: val };
    setExtracted(updated);
    revalidate(updated);
  };

  const handleFile = async (f) => {
    if (!f || !selectedType) return;
    setFile(f);
    setStep("analyzing");
    setError(null);
    setShowOverrides(false);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      const isPdf = f.type === "application/pdf";
      const contentBlock = isPdf
        ? { type:"document", source:{ type:"base64", media_type:"application/pdf", data:base64 } }
        : { type:"image", source:{ type:"base64", media_type:f.type, data:base64 } };
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{ role:"user", content:[contentBlock, { type:"text", text:buildPrompt(selectedType, buildCtx()) }] }],
        }),
      });
      const data = await resp.json();
      const text = data.content?.map(b=>b.text||"").join("") || "";
      const clean = text.replace(/```json\n?|```\n?/g,"").trim();
      const parsed = JSON.parse(clean);
      const vresult = VALIDATORS[selectedType](parsed, buildCtx());
      setExtracted(parsed);
      setValidationResult(vresult);
      setStep("result");
    } catch(err) {
      console.error(err);
      setError("Failed to analyze document. Please check the file and try again.");
      setStep("select");
    }
  };

  const reset = () => { setStep("select"); setSelectedType(null); setFile(null); setExtracted(null); setValidationResult(null); setError(null); setShowOverrides(false); };

  const errCount = validationResult?.filter(r=>r.type==="error").length || 0;
  const warnCount = validationResult?.filter(r=>r.type==="warning").length || 0;
  const allPassed = validationResult && errCount===0 && warnCount===0;
  const overridableFields = OVERRIDABLE[selectedType] || [];

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white px-6 py-5 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold">🏦 KYB Document Validator</h1>
          <p className="text-indigo-200 text-sm mt-0.5">AI-Powered · Upload → Validate in one step</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Deal Context */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Deal Context</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500">Property State</label>
              <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" value={ctx.propertyState} onChange={e=>setCtx(c=>({...c,propertyState:e.target.value}))}>
                <option value="">— Select —</option>
                {SUPPORTED_STATES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500">Estimated Closing Date</label>
              <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={ctx.closingDate} onChange={e=>setCtx(c=>({...c,closingDate:e.target.value}))} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="noITIN" checked={ctx.ownerNoITIN} onChange={e=>setCtx(c=>({...c,ownerNoITIN:e.target.checked}))} className="rounded" />
              <label htmlFor="noITIN" className="text-sm text-gray-600">Owner without ITIN/SSN → FinCEN BOI required</label>
            </div>
          </div>
        </div>

        {/* Select */}
        {step === "select" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Select Document Type to Upload</h2>
            {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">⚠️ {error}</div>}
            <div className="flex flex-col gap-2">
              {visibleDocs.map(d => (
                <button key={d.id} onClick={()=>{ setSelectedType(d.id); setTimeout(()=>fileRef.current?.click(),50); }}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-gray-100 hover:border-indigo-400 hover:bg-indigo-50 text-left transition-all group">
                  <span className="text-2xl">{d.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 text-sm">{d.label}</p>
                    <p className="text-xs text-gray-400">PDF or image</p>
                  </div>
                  <span className="text-indigo-300 group-hover:text-indigo-500 text-lg transition-colors">↑</span>
                </button>
              ))}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
              onChange={e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); e.target.value=""; }} />
          </div>
        )}

        {/* Analyzing */}
        {step === "analyzing" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center gap-4">
            <div className="text-5xl animate-bounce">🔍</div>
            <h3 className="font-bold text-gray-700 text-lg">Analyzing Document...</h3>
            <p className="text-sm text-gray-400 text-center">Reading <span className="font-medium text-gray-600">{file?.name}</span></p>
            <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-indigo-500 rounded-full animate-pulse w-3/4"></div>
            </div>
          </div>
        )}

        {/* Results */}
        {step === "result" && validationResult && (
          <>
            {/* Banner */}
            <div className={`rounded-2xl p-5 flex items-center gap-4 ${errCount>0?"bg-red-50 border border-red-200":warnCount>0?"bg-yellow-50 border border-yellow-200":"bg-green-50 border border-green-200"}`}>
              <div className="text-4xl">{errCount>0?"🔴":warnCount>0?"🟡":"🟢"}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800">{DOC_TYPES.find(d=>d.id===selectedType)?.icon} {DOC_TYPES.find(d=>d.id===selectedType)?.label}</p>
                <p className="text-xs text-gray-400 truncate">{file?.name}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {errCount>0 && <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full font-semibold">{errCount} error{errCount>1?"s":""}</span>}
                {warnCount>0 && <span className="text-xs bg-yellow-400 text-gray-800 px-2 py-1 rounded-full font-semibold">{warnCount} warning{warnCount>1?"s":""}</span>}
                {allPassed && <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full font-semibold">All Clear ✓</span>}
              </div>
            </div>

            {/* Validation Results */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Validation Results</h2>
              <div className="flex flex-col gap-2">
                {validationResult.map((r,i)=>(
                  <div key={i} className={`rounded-xl px-4 py-3 text-sm border ${SEV_BG[r.type]}`}>
                    {SEV[r.type]} {r.msg}
                  </div>
                ))}
              </div>
            </div>

            {/* Manual Overrides — only shown for docs that have overridable fields */}
            {overridableFields.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-5">
                <button
                  onClick={()=>setShowOverrides(v=>!v)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div>
                    <h2 className="text-xs font-bold text-orange-500 uppercase tracking-widest">⚠️ AI Got Something Wrong?</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Manually correct any field the AI misread — results update instantly</p>
                  </div>
                  <span className="text-gray-400 text-lg ml-4">{showOverrides?"▲":"▼"}</span>
                </button>
                {showOverrides && (
                  <div className="mt-4 divide-y divide-gray-50">
                    {overridableFields.map(({key, label})=>(
                      <ToggleOverride key={key} fieldKey={key} label={label} value={!!extracted?.[key]} onChange={handleOverride} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Extracted Fields */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Extracted Fields</h2>
              <div className="divide-y divide-gray-50">
                {Object.entries(FIELD_LABELS[selectedType]||{}).map(([k,label])=>{
                  const val = extracted?.[k];
                  if(val===null||val===undefined||val==="") return null;
                  const display = typeof val==="boolean"?(val?"✓ Yes":"✗ No"):Array.isArray(val)?val.join(", "):String(val);
                  return (
                    <div key={k} className="flex justify-between items-start gap-3 py-2.5">
                      <span className="text-xs text-gray-400 font-medium shrink-0">{label}</span>
                      <span className={`text-xs font-mono text-right ${typeof val==="boolean"?(val?"text-green-600":"text-red-500"):"text-gray-700"}`}>{display}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow transition">
                + Validate Another Document
              </button>
              <button onClick={()=>{ setCtx({propertyState:"",closingDate:"",ownerNoITIN:false}); reset(); }} className="px-5 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
                New Deal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
