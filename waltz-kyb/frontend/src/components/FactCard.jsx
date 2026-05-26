import { useState } from 'react'
import { api } from '../api'

const FIELD_LABELS = {
  legal_name:           'Legal Name',
  formation_state:      'Formation State',
  ein:                  'EIN',
  entity_type:          'Entity Type',
  management_structure: 'Management Structure',
  registered_agent:     'Registered Agent',
  business_address:     'Business Address',
  cogs_date:            'COGS Issue Date',
  total_ownership:      'Total Ownership %',
  members_list:         'Members',
}

export default function FactCard({ fact, dealId, onRefresh }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(fact.field_value || '')
  const [loading, setLoading] = useState(false)

  const label = FIELD_LABELS[fact.field_key] || fact.field_key

  let sources = []
  try { sources = JSON.parse(fact.sources || '[]') } catch {}

  let conflicts = null
  try { conflicts = fact.conflicts ? JSON.parse(fact.conflicts) : null } catch {}

  let displayValue = fact.field_value || '—'
  // Try to pretty-print JSON arrays/objects
  try {
    const parsed = JSON.parse(fact.field_value)
    if (Array.isArray(parsed)) {
      displayValue = parsed.map(m => {
        if (typeof m === 'object' && m !== null) {
          return `${m.name || '?'} (${m.pct ?? m.ownership_pct ?? '?'}%)`
        }
        return String(m)
      }).join(', ')
    }
  } catch {}

  const handleSave = async () => {
    setLoading(true)
    try {
      await api.updateFact(dealId, fact.field_key, editVal)
      await onRefresh()
      setEditing(false)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${!fact.is_consistent && !fact.manually_overridden ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
      borderRadius: 8,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {sources.map(s => (
            <span key={s} style={{
              fontSize: 10, fontWeight: 600,
              background: fact.is_consistent ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
              color: fact.is_consistent ? 'var(--green)' : 'var(--amber)',
              borderRadius: 9999, padding: '1px 6px',
            }}>
              {s}
            </span>
          ))}
          {fact.manually_overridden && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              background: 'rgba(79,126,248,0.12)', color: 'var(--accent)',
              borderRadius: 9999, padding: '1px 6px',
            }}>
              manual
            </span>
          )}
        </div>
      </div>

      {editing ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            style={{ flex: 1, fontSize: 13 }}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button onClick={handleSave} disabled={loading} style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 5, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Save
          </button>
          <button onClick={() => setEditing(false)} style={{
            background: 'var(--bg4)', color: 'var(--text2)', border: 'none',
            borderRadius: 5, padding: '4px 8px', fontSize: 12, cursor: 'pointer',
          }}>
            ×
          </button>
        </div>
      ) : (
        <div
          onClick={() => { setEditVal(fact.field_value || ''); setEditing(true) }}
          style={{
            fontSize: 13, color: 'var(--text)',
            wordBreak: 'break-word',
            cursor: 'pointer',
            padding: '2px 0',
            borderBottom: '1px dashed transparent',
          }}
          title="Click to override"
        >
          {displayValue}
        </div>
      )}

      {conflicts && !fact.manually_overridden && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>Conflicts:</span>
          {Object.entries(conflicts).map(([src, val]) => (
            <span key={src} style={{
              fontSize: 10, background: 'rgba(239,68,68,0.12)', color: 'var(--red)',
              borderRadius: 9999, padding: '1px 6px',
            }}>
              {src}: {val}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
