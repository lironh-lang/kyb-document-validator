import { useState } from 'react'
import { api } from '../api'

const STATUS_STYLE = {
  new:      { bg: 'rgba(79,126,248,0.15)', color: 'var(--accent)' },
  review:   { bg: 'rgba(245,158,11,0.15)', color: 'var(--amber)' },
  approved: { bg: 'rgba(34,197,94,0.15)',  color: 'var(--green)' },
}

export default function DealHeader({ deal, onRefresh, ruleStats }) {
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState(null)

  const canApprove = ruleStats && ruleStats.fail === 0 && ruleStats.flag === 0

  const handleApprove = async () => {
    setApproving(true)
    setError(null)
    try {
      await api.approveDeal(deal.id)
      await onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setApproving(false)
    }
  }

  const st = STATUS_STYLE[deal.status] || STATUS_STYLE.new

  return (
    <div style={{
      marginBottom: 20,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
            {deal.name}
          </h1>
          <span style={{
            ...st, borderRadius: 9999, padding: '2px 10px',
            fontSize: 11, fontWeight: 700,
          }}>
            {deal.status?.toUpperCase()}
          </span>
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {deal.formation_state && (
            <span>Formation: <strong style={{ color: 'var(--text2)' }}>{deal.formation_state}</strong></span>
          )}
          {deal.property_state && (
            <span>Property: <strong style={{ color: 'var(--text2)' }}>{deal.property_state}</strong></span>
          )}
          {deal.closing_date && (
            <span>Closing: <strong style={{ color: 'var(--text2)' }}>{deal.closing_date}</strong></span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {deal.status !== 'approved' && (
          <button
            onClick={handleApprove}
            disabled={!canApprove || approving}
            style={{
              background: canApprove ? 'var(--green)' : 'var(--bg4)',
              color: canApprove ? '#fff' : 'var(--text3)',
              border: 'none',
              borderRadius: 6,
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: canApprove ? 'pointer' : 'not-allowed',
              opacity: approving ? 0.7 : 1,
            }}
          >
            {approving ? 'Approving...' : 'Approve KYB'}
          </button>
        )}
        {!canApprove && ruleStats && deal.status !== 'approved' && (
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
            {ruleStats.fail > 0 && <span style={{ color: 'var(--red)' }}>{ruleStats.fail} fail </span>}
            {ruleStats.flag > 0 && <span style={{ color: 'var(--amber)' }}>{ruleStats.flag} flag </span>}
            must be resolved
          </div>
        )}
        {error && (
          <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>
        )}
      </div>
    </div>
  )
}
