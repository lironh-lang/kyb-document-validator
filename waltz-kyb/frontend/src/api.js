const BASE = '/api'

async function req(method, path, body, isMultipart = false) {
  const opts = {
    method,
    headers: isMultipart ? {} : { 'Content-Type': 'application/json' },
  }
  if (body) {
    opts.body = isMultipart ? body : JSON.stringify(body)
  }
  const res = await fetch(BASE + path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Deals
  listDeals:  ()         => req('GET',  '/deals'),
  createDeal: (body)     => req('POST', '/deals', body),
  getDeal:    (id)       => req('GET',  `/deals/${id}`),
  updateDeal: (id, body) => req('PUT',  `/deals/${id}`, body),
  approveDeal:(id)       => req('POST', `/deals/${id}/approve`),

  // Documents
  uploadDocument: (dealId, docType, file) => {
    const fd = new FormData()
    fd.append('doc_type', docType)
    fd.append('file', file)
    return req('POST', `/deals/${dealId}/documents`, fd, true)
  },

  // Rules
  getRules:     (id)             => req('GET',  `/deals/${id}/rules`),
  resolveRule:  (id, ruleId, by) => req('POST', `/deals/${id}/rules/${ruleId}/resolve`, { resolved_by: by || 'analyst' }),
  unresolveRule:(id, ruleId)     => req('POST', `/deals/${id}/rules/${ruleId}/unresolve`),
  requestInfo:  (id, ruleId)     => req('POST', `/deals/${id}/rules/${ruleId}/request`),

  // Facts
  updateFact: (id, key, val) => req('PUT', `/deals/${id}/facts/${key}`, { field_value: val }),

  // Members
  addMember:    (id, body)     => req('POST',   `/deals/${id}/members`, body),
  removeMember: (id, memberId) => req('DELETE',  `/deals/${id}/members/${memberId}`),

  // Audit
  getAudit: (id) => req('GET', `/deals/${id}/audit`),
}
