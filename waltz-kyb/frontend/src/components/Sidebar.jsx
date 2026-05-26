const STATUS_COLORS = {
  new:      'var(--text3)',
  review:   'var(--amber)',
  approved: 'var(--green)',
}

const STATUS_LABELS = {
  new:      'New',
  review:   'In Review',
  approved: 'Approved',
}

export default function Sidebar({ deals, selectedId, onSelect }) {
  return (
    <aside style={{
      width: 240,
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '12px 16px 8px',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text3)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        borderBottom: '1px solid var(--border)',
      }}>
        Deals ({deals.length})
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {deals.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>
            No deals yet
          </div>
        ) : (
          deals.map(deal => (
            <button
              key={deal.id}
              onClick={() => onSelect(deal.id)}
              style={{
                width: '100%',
                background: selectedId === deal.id ? 'var(--bg3)' : 'none',
                border: 'none',
                borderLeft: selectedId === deal.id ? '2px solid var(--accent)' : '2px solid transparent',
                padding: '10px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span style={{
                marginTop: 4,
                width: 8, height: 8,
                borderRadius: '50%',
                background: STATUS_COLORS[deal.status] || 'var(--text3)',
                flexShrink: 0,
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500,
                  color: selectedId === deal.id ? 'var(--text)' : 'var(--text2)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {deal.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {[deal.formation_state, deal.property_state].filter(Boolean).join(' → ') || 'No states set'}
                </div>
                <div style={{
                  marginTop: 3,
                  display: 'inline-block',
                  fontSize: 10, fontWeight: 600,
                  color: STATUS_COLORS[deal.status] || 'var(--text3)',
                }}>
                  {STATUS_LABELS[deal.status] || deal.status}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}
