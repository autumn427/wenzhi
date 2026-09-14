export type RelayConfig = {
  OPENAI_NEXT_API_KEY?: string
  OPENAI_NEXT_BASE_URL?: string
  OPENAI_NEXT_MODEL?: string
}

export type ModelTextResult =
  | { ok: true; content: string }
  | { ok: false; code: string; status: number; message: string }

export const relayModel = (env: RelayConfig) => env.OPENAI_NEXT_MODEL?.trim() || 'gpt-5.4-mini'

/** Only server-owned configuration chooses the host and model. Never a public proxy. */
export async function callRelayText(
  env: RelayConfig,
  messages: Array<{ role: string; content: string }>,
  timeoutMs = 55_000,
): Promise<ModelTextResult> {
  const key = env.OPENAI_NEXT_API_KEY?.trim()
  const failure = (code: string, status = 502): ModelTextResult => ({
    ok: false, code, status,
    message: code === 'AI_NOT_CONFIGURED' ? '实时 AI 尚未配置或密钥不可用。'
      : code === 'AI_RATE_LIMITED' ? '实时 AI 请求较多，请稍后再试。'
      : code === 'AI_TIMEOUT' ? '实时 AI 生成超时，请重试。' : '实时 AI 暂时不可用，请重试。',
  })
  if (!key) return failure('AI_NOT_CONFIGURED', 503)
  let endpoint: URL
  try {
    const base = new URL(env.OPENAI_NEXT_BASE_URL?.trim() || 'https://api.openai-next.com')
    if (base.protocol !== 'https:' || base.hostname !== 'api.openai-next.com' || base.username || base.password || base.search || base.hash || base.port) return failure('AI_INVALID_CONFIG', 503)
    if (!['', '/', '/v1', '/v1/'].includes(base.pathname)) return failure('AI_INVALID_CONFIG', 503)
    endpoint = new URL('/v1/chat/completions', base)
  } catch { return failure('AI_INVALID_CONFIG', 503) }

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const startedAt = Date.now()
  const model = relayModel(env)
  const run = async (): Promise<ModelTextResult> => {
    const response = await fetch(endpoint, {
      method: 'POST', redirect: 'manual', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ model, messages, stream: false, max_completion_tokens: 5500, response_format: { type: 'json_object' } }),
    })
    if (!response.ok) {
      await response.body?.cancel()
      return failure(response.status === 429 ? 'AI_RATE_LIMITED' : [401, 403].includes(response.status) ? 'AI_NOT_CONFIGURED' : 'AI_UPSTREAM_ERROR', response.status === 429 ? 429 : 502)
    }
    if (!response.body) return failure('AI_EMPTY_RESPONSE')
    const reader = response.body.getReader()
    const cancel = () => { void reader.cancel().catch(() => {}) }
    controller.signal.addEventListener('abort', cancel, { once: true })
    const decoder = new TextDecoder()
    let bytes = 0
    let text = ''
    try {
      if (controller.signal.aborted) return failure('AI_TIMEOUT', 504)
      while (true) {
        const part = await reader.read()
        if (part.done) break
        bytes += part.value.byteLength
        if (bytes > 262_144) return failure('AI_RESPONSE_TOO_LONG')
        text += decoder.decode(part.value, { stream: true })
      }
      text += decoder.decode()
    } finally {
      controller.signal.removeEventListener('abort', cancel)
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
    if (controller.signal.aborted) return failure('AI_TIMEOUT', 504)
    let payload: { error?: unknown; choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }> }
    try { payload = JSON.parse(text) } catch { return failure('AI_INVALID_RESPONSE') }
    if (payload.error) return failure('AI_UPSTREAM_ERROR')
    const choice = payload.choices?.[0]
    if (choice?.finish_reason !== 'stop') return failure('AI_INCOMPLETE_RESPONSE')
    const content = choice.message?.content
    if (typeof content !== 'string' || !content.trim()) return failure('AI_EMPTY_RESPONSE')
    if (content.length > 32_000) return failure('AI_RESPONSE_TOO_LONG')
    return { ok: true, content: content.trim() }
  }
  let result: ModelTextResult
  try {
    result = await Promise.race([
      run(),
      new Promise<ModelTextResult>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(failure('AI_TIMEOUT', 504)) }, timeoutMs) }),
    ])
  } catch {
    result = failure(controller.signal.aborted ? 'AI_TIMEOUT' : 'AI_NETWORK_ERROR', 504)
  }
  finally { clearTimeout(timer) }
  // Operational metadata only: no prompts, response text, headers, or credentials.
  console.info(JSON.stringify({ event: 'model-call', provider: 'relay-ai', model, ok: result.ok, code: result.ok ? undefined : result.code, elapsedMs: Date.now() - startedAt }))
  return result
}
