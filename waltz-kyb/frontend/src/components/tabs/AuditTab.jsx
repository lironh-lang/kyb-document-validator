const ACTION_ICONS = {
  upload: '📤',
  approve: '✅',
  resolve: '✓',
  unresolve: '↩',
  override: '✏️',
  create: '➕',
  member: '👤',
  request: '📨',
}

function getIcon(action) {
  const lower = action.toLowerCase()
  if (lower.includes('upload')) return '📤'
  if (lower.includes('approved')) return '✅'
  if (lower.includes('resolved') && lower.includes('un')) return '↩'
  if (lower.includes('resolved')) return '✓'
  if (lower.includes('overridden') || lower.includes('override')) return '✏️'
  if (lower.includes('created')) return '➕'
  if (lower.includes('member added')) return '👤'
  if (lower.includes('member removed')) return '🗑'
  if (lower.includes('request')) return '📨'
  if (lower.includes('updated')) return '📝'
  return '•'
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AuditTab({ deal }) {
  const logs = deal.audit_logs || []

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
        {logs.length} audit event{logs.length !== 1 ? 's' : ''}
      </div>

      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>
          No activity yet
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute', left: 15, top: 0, bottom: 0,
            width: 1, background: 'var(--border)',
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {logs.map((log, i) => (
              <div key={log.id} style={{
                display: 'flex', gap: 12, padding: '8px 0',
              }}>
                {/* Dot */}
                <div style={{
                  width: 30, height: 30, flexShrink: 0,
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 12, zIndex: 1,
                }}>
                  {getIcon(log.action)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, paddingTop: 5 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
                    {log.action}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, display: 'flex', gap: 8 }}>
                    <span>{log.performed_by || 'system'}</span>
                    <span>·</span>
                    <span>{formatTime(log.performed_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
