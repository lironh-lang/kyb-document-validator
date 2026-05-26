import FactCard from '../FactCard'

const FACT_ORDER = [
  'legal_name', 'formation_state', 'ein', 'entity_type',
  'management_structure', 'registered_agent', 'business_address',
  'cogs_date', 'total_ownership', 'members_list',
]

export default function FactsTab({ deal, onRefresh }) {
  const facts = deal.entity_facts || []

  const sortedFacts = [...facts].sort((a, b) => {
    const ai = FACT_ORDER.indexOf(a.field_key)
    const bi = FACT_ORDER.indexOf(b.field_key)
    if (ai === -1 && bi === -1) return a.field_key.localeCompare(b.field_key)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  const inconsistentCount = facts.filter(f => !f.is_consistent && !f.manually_overridden).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          {facts.length} facts derived from uploaded documents
        </div>
        {inconsistentCount > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            background: 'rgba(239,68,68,0.12)', color: 'var(--red)',
            borderRadius: 9999, padding: '2px 8px',
          }}>
            {inconsistentCount} conflict{inconsistentCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {facts.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13,
        }}>
          Upload documents to extract entity facts
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
        }}>
          {sortedFacts.map(fact => (
            <FactCard
              key={fact.field_key}
              fact={fact}
              dealId={deal.id}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}
