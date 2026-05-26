import RuleCard from '../RuleCard'

const GROUPS = [
  { prefix: 'F',  label: 'Formation Document' },
  { prefix: 'E',  label: 'EIN Letter' },
  { prefix: 'O',  label: 'Operating Agreement' },
  { prefix: 'C',  label: 'Certificate of Good Standing' },
  { prefix: 'A',  label: 'LLC Address' },
  { prefix: 'S',  label: 'Secretary of State' },
  { prefix: 'ST', label: 'Company Structure' },
]

const STATUS_COLORS = {
  pass:    'var(--green)',
  flag:    'var(--amber)',
  fail:    'var(--red)',
  manual:  'var(--purple)',
  pending: 'var(--text3)',
}

export default function ValidationTab({ deal, onRefresh }) {
  const rules = deal.rule_results || []

  const stats = {
    pass:    rules.filter(r => r.status === 'pass').length,
    flag:    rules.filter(r => r.status === 'flag' && !r.resolved).length,
    fail:    rules.filter(r => r.status === 'fail' && !r.resolved).length,
    manual:  rules.filter(r => r.status === 'manual' && !r.resolved).length,
    pending: rules.filter(r => r.status === 'pending').length,
    resolved:rules.filter(r => r.resolved).length,
  }

  const autoTotal = rules.filter(r => r.mode === 'auto').length
  const autoPassed = rules.filter(r => r.mode === 'auto' && (r.status === 'pass' || r.resolved)).length
  const autoPct = autoTotal > 0 ? Math.round((autoPassed / autoTotal) * 100) : 0

  const getGroupRules = (prefix) => {
    if (prefix === 'ST') return rules.filter(r => r.rule_id.startsWith('ST'))
    if (prefix === 'S')  return rules.filter(r => r.rule_id.startsWith('S') && !r.rule_id.startsWith('ST'))
    return rules.filter(r => r.rule_id.startsWith(prefix) && !r.rule_id.startsWith('ST') && !r.rule_id.startsWith('S' + prefix))
  }

  return (
    <div>
      {/* Stats Row */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap',
      }}>
        {[
          { key: 'fail',    label: 'Failed',   bg: 'rgba(239,68,68,0.12)',   color: 'var(--red)' },
          { key: 'flag',    label: 'Flagged',  bg: 'rgba(245,158,11,0.12)',  color: 'var(--amber)' },
          { key: 'manual',  label: 'Manual',   bg: 'rgba(167,139,250,0.12)', color: 'var(--purple)' },
          { key: 'pass',    label: 'Passed',   bg: 'rgba(34,197,94,0.12)',   color: 'var(--green)' },
          { key: 'resolved',label: 'Resolved', bg: 'rgba(79,126,248,0.12)',  color: 'var(--accent)' },
          { key: 'pending', label: 'Pending',  bg: 'rgba(90,96,112,0.12)',   color: 'var(--text3)' },
        ].map(s => (
          <div key={s.key} style={{
            background: s.bg, borderRadius: 8,
            padding: '10px 14px', textAlign: 'center', minWidth: 70,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{stats[s.key]}</div>
            <div style={{ fontSize: 10, color: s.color, fontWeight: 600, letterSpacing: '0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Auto-check progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: 'var(--text3)' }}>
          <span>Auto-check completion</span>
          <span style={{ color: 'var(--text2)' }}>{autoPassed} / {autoTotal} ({autoPct}%)</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${autoPct}%`,
            background: autoPct === 100 ? 'var(--green)' : 'var(--accent)',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Rules by group */}
      {GROUPS.map(group => {
        const groupRules = getGroupRules(group.prefix)
        if (groupRules.length === 0) return null

        const groupFail = groupRules.filter(r => r.status === 'fail' && !r.resolved).length
        const groupFlag = groupRules.filter(r => r.status === 'flag' && !r.resolved).length
        const groupManual = groupRules.filter(r => r.status === 'manual' && !r.resolved).length

        return (
          <div key={group.prefix} style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              paddingBottom: 6, borderBottom: '1px solid var(--border)',
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text2)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {group.label}
              </span>
              {groupFail > 0 && (
                <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: 'var(--red)', borderRadius: 9999, padding: '1px 6px', fontWeight: 700 }}>
                  {groupFail} fail
                </span>
              )}
              {groupFlag > 0 && (
                <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.15)', color: 'var(--amber)', borderRadius: 9999, padding: '1px 6px', fontWeight: 700 }}>
                  {groupFlag} flag
                </span>
              )}
              {groupManual > 0 && (
                <span style={{ fontSize: 10, background: 'rgba(167,139,250,0.15)', color: 'var(--purple)', borderRadius: 9999, padding: '1px 6px', fontWeight: 700 }}>
                  {groupManual} manual
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groupRules.map(rule => (
                <RuleCard key={rule.rule_id} rule={rule} dealId={deal.id} onRefresh={onRefresh} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
