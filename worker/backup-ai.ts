type Messages = Array<{ role: string; content: string }>
export type TextResult = { ok: true; content: string } | { ok: false; code: string; status: number }

class BackupProtocolError extends Error {}

/** Incremental SSE parser: no partial narrative is returned to the application. */
class BackupStream {
  pending = ''
  content = ''
  done = false
  finish: unknown = null
  push(text: string) {
    this.pending = (this.pending + text).replace(/\r\n/g, '\n')
    let boundary: number
    while (!this.done && (boundary = this.pending.indexOf('\n\n')) >= 0) {
      const block = this.pending.slice(0, boundary)
      this.pending = this.pending.slice(boundary + 2)
      const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
      if (!data) continue
      if (data === '[DONE]') { this.done = true; break }
      let payload: { error?: unknown; choices?: Array<{ index?: number; delta?: { content?: unknown }; finish_reason?: unknown }> } | null
      try { payload = JSON.parse(data) } catch { throw new BackupProtocolError('BACKUP_AI_INVALID_RESPONSE') }
      if (payload?.error) throw new BackupProtocolError('BACKUP_AI_UPSTREAM_ERROR')
      const choice = payload?.choices?.[0]
      if (choice?.index !== undefined && choice.index !== 0) throw new BackupProtocolError('BACKUP_AI_INVALID_RESPONSE')
      if (choice?.finish_reason) this.finish = choice.finish_reason
      const content = choice?.delta?.content
      if (content !== undefined && content !== null && typeof content !== 'string') throw new BackupProtocolError('BACKUP_AI_INVALID_RESPONSE')
      if (typeof content === 'string') this.content += content
      if (this.content.length > 32_000) throw new BackupProtocolError('BACKUP_AI_RESPONSE_TOO_LONG')
    }
  }
  result() {
    if (!this.done || this.finish !== 'stop') throw new BackupProtocolError('BACKUP_AI_INCOMPLETE_RESPONSE')
    return this.content
  }
}

export function canUseBackup(result: TextResult): boolean {
  return !result.ok && (['AI_RATE_LIMITED', 'AI_TIMEOUT', 'AI_NETWORK_ERROR'].includes(result.code) ||
    (result.code === 'AI_UPSTREAM_ERROR' && result.status >= 500))
}

/** Fixed approved host, one call, no redirects, no response/prompt cache or logs. */
export async function callBackupAI(apiKey: string, messages: Messages, timeoutMs = 40_000, configuredModel?: string): Promise<TextResult> {
  // Server-owned allowlist. Missing config preserves existing deployments;
  // invalid config must not silently route to a different paid model.
  const model = configuredModel?.trim() || 'gpt-5.4-mini'
  if (model !== 'gpt-5.4-mini' && model !== 'gpt-5.6-luna') {
    return { ok: false, code: 'BACKUP_AI_REQUEST_REJECTED', status: 502 }
  }
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const failure = (code: string, status = 502): TextResult => ({ ok: false, code, status })
  try {
    return await Promise.race([
      (async (): Promise<TextResult> => {
        const response = await fetch('https://newapi.yeako-node3.xyz/v1/chat/completions', {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'text/event-stream, application/json' },
          body: JSON.stringify({ model, messages, stream: true, max_tokens: 4000 }),
        })
        if (!response.ok) {
          await response.body?.cancel()
          // HTTP status is enough to guide recovery. Never expose or log the
          // upstream body, and do not infer a particular model error from 400.
          if (response.status === 429) return failure('BACKUP_AI_RATE_LIMITED', 429)
          if (response.status === 401 || response.status === 403) return failure('BACKUP_AI_ACCESS_DENIED')
          if ([400, 404, 422].includes(response.status)) return failure('BACKUP_AI_REQUEST_REJECTED')
          return failure('BACKUP_AI_UPSTREAM_ERROR')
        }
        if (!response.body) return failure('BACKUP_AI_EMPTY_RESPONSE')
        const reader = response.body.getReader()
        const cancel = () => { void reader.cancel().catch(() => {}) }
        controller.signal.addEventListener('abort', cancel, { once: true })
        if (controller.signal.aborted) cancel()
        const stream = response.headers.get('content-type')?.toLowerCase().includes('text/event-stream') ? new BackupStream() : null
        const decoder = new TextDecoder()
        let bytes = 0
        let text = ''
        try {
          while (true) {
            const chunk = await reader.read()
            if (chunk.done) break
            bytes += chunk.value.byteLength
            if (bytes > (stream ? 1_048_576 : 128_000)) return failure('BACKUP_AI_RESPONSE_TOO_LONG')
            const decoded = decoder.decode(chunk.value, { stream: true })
            if (stream) { stream.push(decoded); if (stream.done) break }
            else text += decoded
          }
          if (controller.signal.aborted) return failure('BACKUP_AI_TIMEOUT', 504)
          if (stream) {
            stream.push(decoder.decode())
            const content = stream.result().trim()
            return content ? { ok: true, content } : failure('BACKUP_AI_EMPTY_RESPONSE')
          }
          text += decoder.decode()
        } finally {
          controller.signal.removeEventListener('abort', cancel)
          await reader.cancel().catch(() => {})
          reader.releaseLock()
        }
        let payload: { choices?: Array<{ message?: { content?: unknown } }> }
        try { payload = JSON.parse(text) } catch { return failure('BACKUP_AI_INVALID_RESPONSE') }
        const content = payload?.choices?.[0]?.message?.content
        if (typeof content !== 'string' || !content.trim()) return failure('BACKUP_AI_EMPTY_RESPONSE')
        if (content.length > 32_000) return failure('BACKUP_AI_RESPONSE_TOO_LONG')
        return { ok: true, content: content.trim() }
      })(),
      new Promise<TextResult>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(failure('BACKUP_AI_TIMEOUT', 504)) }, timeoutMs) }),
    ])
  } catch (error) {
    if (error instanceof BackupProtocolError) return failure(error.message)
    return failure(controller.signal.aborted ? 'BACKUP_AI_TIMEOUT' : 'BACKUP_AI_NETWORK_ERROR', 504)
  } finally { clearTimeout(timer) }
}
