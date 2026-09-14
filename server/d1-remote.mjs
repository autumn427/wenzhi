// Server-only adapter for the D1 subset used by this application.
export class D1RemoteError extends Error {
  constructor(code, status = 503) { super(code); this.name = 'D1RemoteError'; this.code = code; this.status = status }
}
export function createRemoteD1({ accountId, databaseId, token, fetchImpl = fetch, timeoutMs = 15000 }) {
  if (!/^[a-f0-9]{32}$/i.test(accountId ?? '') || !/^[a-f0-9-]{36}$/i.test(databaseId ?? '') || !token?.trim()) throw new D1RemoteError('D1_NOT_CONFIGURED')
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`
  async function query(body, count) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      // Never retry: a lost response may follow a committed write.
      const response = await fetchImpl(endpoint, { method: 'POST', redirect: 'error', signal: controller.signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) { await response.body?.cancel(); throw new D1RemoteError(response.status === 429 ? 'D1_RATE_LIMITED' : 'D1_UPSTREAM_ERROR', response.status === 429 ? 429 : 503) }
      const reader = response.body?.getReader(); if (!reader) throw new D1RemoteError('D1_INVALID_RESPONSE')
      const chunks = []; let size = 0
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new D1RemoteError('D1_RESPONSE_TOO_LARGE') }; chunks.push(value) }
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (payload.success !== true || !Array.isArray(payload.result) || payload.result.length !== count || payload.result.some(r => r.success !== true || (r.results !== undefined && !Array.isArray(r.results)))) throw new D1RemoteError('D1_QUERY_FAILED')
      return payload.result.map(r => ({ success: true, results: r.results ?? [], meta: r.meta ?? {} }))
    } catch (error) {
      if (error instanceof D1RemoteError) throw error
      throw new D1RemoteError(controller.signal.aborted ? 'D1_TIMEOUT' : 'D1_REQUEST_FAILED')
    } finally { clearTimeout(timer) }
  }
  const statements = new WeakMap()
  function prepare(sql, params = []) {
    if (typeof sql !== 'string' || !sql.trim() || sql.length > 100000) throw new D1RemoteError('D1_INVALID_SQL', 400)
    const statement = {
      bind(...values) {
        if (values.some(v => v !== null && typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v)))) throw new D1RemoteError('D1_UNSUPPORTED_PARAMETER', 400)
        return prepare(sql, [...values])
      },
      async all() { return (await query({ sql, params }, 1))[0] },
      async run() { return (await query({ sql, params }, 1))[0] },
      async first(column) {
        const result = await statement.all(), row = result.results[0]
        if (!row) return null
        if (column === undefined) return row
        if (!Object.hasOwn(row, column)) throw new D1RemoteError('D1_COLUMN_NOT_FOUND', 400)
        return row[column]
      },
    }
    statements.set(statement, { sql, params }); return Object.freeze(statement)
  }
  return Object.freeze({ prepare, async batch(items) {
    if (!Array.isArray(items) || items.length > 100 || items.some(s => !statements.has(s))) throw new D1RemoteError('D1_INVALID_BATCH', 400)
    if (!items.length) return []
    return query({ batch: items.map(s => statements.get(s)) }, items.length)
  } })
}
