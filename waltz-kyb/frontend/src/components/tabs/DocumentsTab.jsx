import { useRef, useState } from 'react'
import { api } from '../../api'

const DOC_TYPES = [
  { id: 'formation', label: 'Formation Document', icon: '🏛️', hint: 'Articles / Certificate of Organization or Formation' },
  { id: 'ein',       label: 'EIN Letter',          icon: '🔢', hint: 'CP 575 A/B/G or 147C' },
  { id: 'oa',        label: 'Operating Agreement', icon: '📋', hint: 'Governing document for the LLC' },
  { id: 'cogs',      label: 'Certificate of Good Standing', icon: '✅', hint: 'State-issued certificate, within 30 days of closing' },
]

function DocCard({ docType, uploaded, uploading, onUpload }) {
  const fileRef = useRef()

  let extraction = null
  if (uploaded?.extracted_json) {
    try { extraction = JSON.parse(uploaded.extracted_json) } catch {}
  }

  const hasError = extraction?.error

  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${uploaded ? (hasError ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.25)') : 'var(--border)'}`,
      borderRadius: 10,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minHeight: 160,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{docType.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
            {docType.label}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{docType.hint}</div>
        </div>
        {uploaded && !hasError && (
          <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>✓ Uploaded</span>
        )}
        {uploaded && hasError && (
          <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700 }}>⚠ Upload error</span>
        )}
      </div>

      {uploading ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, color: 'var(--text3)', fontSize: 12,
        }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
          Extracting with AI...
        </div>
      ) : uploaded ? (
        <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: 'var(--text2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📄 {uploaded.file_name}
          </div>
          {uploaded.uploaded_at && (
            <div>{new Date(uploaded.uploaded_at).toLocaleString()}</div>
          )}
          {extraction && !hasError && (
            <div style={{ marginTop: 4, color: 'var(--text2)' }}>
              {extraction.company_name && <div>🏢 {extraction.company_name}</div>}
              {extraction.doc_type_found && <div>📑 {extraction.doc_type_found}</div>}
              {extraction.ein && <div>🔢 EIN: {extraction.ein}</div>}
            </div>
          )}
          {hasError && (
            <div style={{ color: 'var(--amber)' }}>Extraction warning: {extraction.notes || 'check document'}</div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ color: 'var(--text3)', fontSize: 11 }}>Not uploaded</div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) { onUpload(e.target.files[0]); e.target.value = '' }}}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{
          padding: '6px 0', borderRadius: 6, border: '1px dashed var(--border2)',
          background: 'none', color: 'var(--text2)', fontSize: 12,
          cursor: uploading ? 'not-allowed' : 'pointer',
          fontWeight: 500,
          opacity: uploading ? 0.5 : 1,
        }}
      >
        {uploaded ? '↑ Replace' : '↑ Upload'}
      </button>
    </div>
  )
}

export default function DocumentsTab({ deal, onRefresh }) {
  const [uploading, setUploading] = useState({})
  const [uploadError, setUploadError] = useState(null)

  const getUploaded = (docTypeId) =>
    deal.documents?.find(d => d.doc_type === docTypeId) || null

  const handleUpload = async (docTypeId, file) => {
    setUploading(u => ({ ...u, [docTypeId]: true }))
    setUploadError(null)
    try {
      await api.uploadDocument(deal.id, docTypeId, file)
      await onRefresh()
    } catch (e) {
      setUploadError(`Upload failed for ${docTypeId}: ${e.message}`)
    } finally {
      setUploading(u => ({ ...u, [docTypeId]: false }))
    }
  }

  const uploadedCount = DOC_TYPES.filter(dt => getUploaded(dt.id)).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          {uploadedCount} / {DOC_TYPES.length} documents uploaded
        </div>
        {uploadedCount === DOC_TYPES.length && (
          <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>All documents uploaded ✓</span>
        )}
      </div>

      {uploadError && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--red)', marginBottom: 16,
        }}>
          {uploadError}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 14,
      }}>
        {DOC_TYPES.map(dt => (
          <DocCard
            key={dt.id}
            docType={dt}
            uploaded={getUploaded(dt.id)}
            uploading={!!uploading[dt.id]}
            onUpload={(file) => handleUpload(dt.id, file)}
          />
        ))}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
