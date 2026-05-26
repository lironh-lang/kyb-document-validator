import { useState } from 'react'
import { api } from '../api'

const US_STATES = [
  'AL','AK','AZ','AR','CO','CT','DC','DE','FL','GA','HI','IA','ID','IL','IN',
  'KS','KY','LA','ME','MD','MA','MI','MN','MO','MS','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

export default function NewDealModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    formation_state: '',
    property_state: '',
    closing_date: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Deal name is required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const deal = await api.createDeal(form)
      onCreated(deal)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 12, padding: 28, width: 420, maxWidth: '95vw',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            New Deal
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text3)',
            fontSize: 18, cursor: 'pointer', lineHeight: 1,
          }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4, fontWeight: 500 }}>
              Entity Name *
            </label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Smith Holdings LLC"
              style={{ width: '100%' }}
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4, fontWeight: 500 }}>
                Formation State
              </label>
              <select value={form.formation_state} onChange={e => setForm(f => ({ ...f, formation_state: e.target.value }))} style={{ width: '100%' }}>
                <option value="">— Select —</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4, fontWeight: 500 }}>
                Property State
              </label>
              <select value={form.property_state} onChange={e => setForm(f => ({ ...f, property_state: e.target.value }))} style={{ width: '100%' }}>
                <option value="">— Select —</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 4, fontWeight: 500 }}>
              Estimated Closing Date
            </label>
            <input
              type="date"
              value={form.closing_date}
              onChange={e => setForm(f => ({ ...f, closing_date: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--red)', fontSize: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '8px 12px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '8px 0', background: 'var(--bg4)', color: 'var(--text2)',
              border: '1px solid var(--border2)', borderRadius: 6, fontSize: 13, fontWeight: 500,
            }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{
              flex: 1, padding: '8px 0', background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
