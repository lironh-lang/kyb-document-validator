import { useState } from 'react'
import { api } from '../api'

const STATUS_CONFIG = {
  pass:    { icon: '✓', color: 'var(--green)',  label: 'Pass' },
  flag:    { icon: '!', color: 'var(--amber)',  label: 'Flag' },
  fail:    { icon: '✕', color: 'var(--red)',    label: 'Fail' },
  manual:  { icon: '○', color: 'var(--purple)', label: 'Manual' },
  pending: { icon: '…', color: 'var(--text3)',  label: 'Pending' },
}

const MODE_LABELS = {
  auto:     { label: 'Auto',     bg: 'rgba(79,126,248,0.15)',  color: 'var(--accent)' },
  assisted: { label: 'Assisted', bg: 'rgba(245,158,11,0.15)',  color: 'var(--amber)' },
  manual:   { label: 'Manual',   bg: 'rgba(167,139,250,0.15)', color: 'var(--purple)' },
}

export default function RuleCard({ rule, dealId, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const cfg = STATUS_CONFIG[rule.resolved ? 'pass' : rule.status] || STATUS_CONFIG.pending
  const modeCfg = MODE_LABELS[rule.mode] || MODE_LABELS.manual

  const isActionable = ['flag', 'fail', 'manual'].includes(rule.status)

  const handleResolve = async () => {
    setLoading(true)
    try {
      if (rule.resolved) {
        await api.unresolveRule(dealId, rule.rule_id)
      } else {
        await api.resolveRule(dealId, rule.rule_id)
      }
      await onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleRequest = async () => {
    setLoading(true)
    try {
      await api.requestInfo(dealId, rule.rule_id)
      await onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${rule.resolved ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
      borderRadius: 8,
      overflow: 'hidden',
      opacity: rule.status === 'pass' || rule.status === 'pending' ? 0.75 : 1,
    }}>
      {/* Header row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Status icon */}
        <div style={{
          width: 24, height: 24,
          borderRadius: '50%',
          background: rule.resolved ? 'rgba(34,197,94,0.15)' : `${cfg.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
          color: rule.resolved ? 'var(--green)' : cfg.color,
          flexShrink: 0,
        }}>
          {rule.resolved ? '✓' : cfg.icon}
        </div>

        {/* Rule name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: 'var(--text)',
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          }}>
            <span style={{ color: 'var(--text3)', fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>
              {rule.rule_id}
            </span>
            {rule.name}
            {rule.resolved && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: 'var(--green)',
                background: 'rgba(34,197,94,0.15)', borderRadius: 9999, padding: '1px 6px',
              }}>
                RESOLVED
              </span>
            )}
          </div>
        </div>

        {/* Mode badge */}
        <span style={{
          ...modeCfg, borderRadius: 9999, padding: '1px 8px',
          fontSize: 10, fontWeight: 600, flexShrink: 0,
        }}>
          {modeCfg.label}
        </span>

        {/* Chevron */}
        <span style={{ color: 'var(--text3)', fontSize: 11, flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* Evidence */}
          {rule.evidence && (
            <div style={{
              background: 'var(--bg3)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 12,
              fontFamily: 'monospace',
              color: rule.status === 'fail' ? 'var(--red)' : rule.status === 'flag' ? 'var(--amber)' : rule.status === 'pass' ? 'var(--green)' : 'var(--text2)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {rule.evidence}
            </div>
          )}

          {/* Reviewer question */}
          {rule.question && (
            <div style={{
              background: 'rgba(79,126,248,0.08)',
              border: '1px solid rgba(79,126,248,0.2)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--text2)',
              lineHeight: 1.5,
            }}>
              <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 11 }}>REVIEWER: </span>
              {rule.question}
            </div>
          )}

          {/* Resolved metadata */}
          {rule.resolved && rule.resolved_at && (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>
              Resolved {new Date(rule.resolved_at).toLocaleString()} by {rule.resolved_by || 'analyst'}
            </div>
          )}

          {/* Action buttons */}
          {(isActionable || rule.resolved) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isActionable && (
                <button
                  onClick={handleResolve}
                  disabled={loading}
                  style={{
                    padding: '5px 12px', borderRadius: 5, border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: rule.resolved ? 'var(--bg4)' : 'rgba(34,197,94,0.15)',
                    color: rule.resolved ? 'var(--text3)' : 'var(--green)',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {rule.resolved ? 'Unresolve' : 'Mark Resolved'}
                </button>
              )}
              {!rule.resolved && isActionable && (
                <button
                  onClick={handleRequest}
                  disabled={loading}
                  style={{
                    padding: '5px 12px', borderRadius: 5, border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.12)',
                    color: 'var(--red)',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  Request from Client
                </button>
              )}
              {rule.resolved && (
                <button
                  onClick={handleResolve}
                  disabled={loading}
                  style={{
                    padding: '5px 12px', borderRadius: 5, border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: 'var(--bg4)',
                    color: 'var(--text3)',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  Unresolve
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
