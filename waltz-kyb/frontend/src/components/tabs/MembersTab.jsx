import { useState } from 'react'
import { api } from '../../api'

function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map(p => p[0].toUpperCase())
    .slice(0, 2)
    .join('')
}

const AVATAR_COLORS = [
  '#4f7ef8', '#22c55e', '#f59e0b', '#a78bfa', '#ef4444',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6',
]

function avatarColor(name) {
  let h = 0
  for (let c of (name || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export default function MembersTab({ deal, onRefresh }) {
  const [form, setForm] = useState({ name: '', ownership_pct: '', role: 'member' })
  const [loading, setLoading] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [error, setError] = useState(null)

  const members = deal.members || []
  const total = members.reduce((s, m) => s + (m.ownership_pct || 0), 0)
  const totalOk = Math.abs(total - 100) < 0.01

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name required'); return }
    setLoading(true)
    setError(null)
    try {
      await api.addMember(deal.id, {
        name: form.name.trim(),
        ownership_pct: form.ownership_pct ? parseFloat(form.ownership_pct) : null,
        role: form.role || null,
      })
      await onRefresh()
      setForm({ name: '', ownership_pct: '', role: 'member' })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (id) => {
    setRemoving(id)
    try {
      await api.removeMember(deal.id, id)
      await onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div>
      {/* Total ownership indicator */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
        {members.length > 0 && (
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: totalOk ? 'var(--green)' : 'var(--red)',
            background: totalOk ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            borderRadius: 9999, padding: '2px 10px',
          }}>
            {total.toFixed(1)}% total {totalOk ? '✓' : '≠ 100%'}
          </span>
        )}
      </div>

      {/* Member list */}
      {members.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {members.map(m => (
            <div key={m.id} style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: avatarColor(m.name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {initials(m.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                  {m.role && <span style={{ marginRight: 8 }}>{m.role}</span>}
                  {m.ownership_pct != null && (
                    <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{m.ownership_pct}%</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRemove(m.id)}
                disabled={removing === m.id}
                style={{
                  background: 'none', border: 'none', color: 'var(--text3)',
                  cursor: 'pointer', fontSize: 16, padding: '0 4px',
                  opacity: removing === m.id ? 0.4 : 1,
                }}
                title="Remove member"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13,
          background: 'var(--bg2)', borderRadius: 8, marginBottom: 16,
        }}>
          No members yet. Add members to validate ownership and KYC requirements.
        </div>
      )}

      {/* Add member form */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 8, padding: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 12 }}>
          Add Member
        </div>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Full Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="John Smith"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Ownership %</label>
              <input
                type="number" min="0" max="100" step="0.01"
                value={form.ownership_pct}
                onChange={e => setForm(f => ({ ...f, ownership_pct: e.target.value }))}
                placeholder="50"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ width: '100%' }}>
                <option value="member">Member</option>
                <option value="managing member">Managing Member</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>
          {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            padding: '7px 0', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Adding...' : '+ Add Member'}
          </button>
        </form>
      </div>
    </div>
  )
}
