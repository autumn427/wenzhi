/** Run: node --experimental-strip-types scripts/test-relay-ai.mjs */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { callRelayText } from '../worker/relay-ai.ts'

// Only synthetic credentials and payloads are used. No test makes a real call.
const fakeKey = 'test-only-relay-key-not-a-real-credential'
const privateMarker = 'upstream-private-debug-marker'
const env = {
  OPENAI_NEXT_API_KEY: fakeKey,
  OPENAI_NEXT_BASE_URL: 'https://api.openai-next.com',
  OPENAI_NEXT_MODEL: 'server-selected-test-model',
}
const messages = [{ role: 'user', content: 'Return a small JSON response for this synthetic test.' }]

function completion(content = '{"answer":"synthetic-ok"}', finishReason = 'stop') {
  return Response.json({ choices: [{ message: { content }, finish_reason: finishReason }] })
}

function intercept(t, handler) {
  const calls = []
  const logs = []
  t.mock.method(globalThis, 'fetch', async (...args) => {
    calls.push(args)
    return handler(...args)
  })
  t.mock.method(console, 'info', value => logs.push(String(value)))
  return { calls, logs }
}

function assertPrivateDataAbsent(result, logs) {
  const output = JSON.stringify({ result, logs })
  assert(!output.includes(fakeKey), 'The API key must not appear in results or logs')
  assert(!output.includes(privateMarker), 'Upstream debug content must not appear in results or logs')
}

test('JSON requests use only the server-owned endpoint and model, with no credential in the result', async t => {
  const { calls, logs } = intercept(t, () => completion())
  const injectedMessages = [...messages, {
    role: 'user',
    content: JSON.stringify({ base_url: 'https://untrusted.invalid', model: 'client-model', privatePrompt: privateMarker }),
  }]
  const result = await callRelayText(env, injectedMessages)
  assert.deepEqual(result, { ok: true, content: '{"answer":"synthetic-ok"}' })
  assert.equal(calls.length, 1)
  const [url, init] = calls[0]
  assert.equal(String(url), 'https://api.openai-next.com/v1/chat/completions')
  assert.equal(init.method, 'POST')
  assert.equal(init.redirect, 'manual')
  assert.equal(new Headers(init.headers).get('Authorization'), `Bearer ${fakeKey}`)
  const body = JSON.parse(init.body)
  assert.equal(body.model, env.OPENAI_NEXT_MODEL)
  assert.deepEqual(body.messages, injectedMessages)
  assert.equal(body.stream, false)
  assert.deepEqual(body.response_format, { type: 'json_object' })
  assert(Number.isInteger(body.max_completion_tokens) && body.max_completion_tokens > 0)
  assertPrivateDataAbsent(result, logs)
})

test('base URL variants normalize to exactly one /v1 prefix', async t => {
  const { calls } = intercept(t, () => completion())
  for (const base of [undefined, 'https://api.openai-next.com', 'https://api.openai-next.com/', 'https://api.openai-next.com/v1', 'https://api.openai-next.com/v1/']) {
    const result = await callRelayText({ ...env, OPENAI_NEXT_BASE_URL: base }, messages)
    assert.equal(result.ok, true)
    assert.equal(String(calls.at(-1)[0]), 'https://api.openai-next.com/v1/chat/completions')
  }
  assert.equal(calls.length, 5)
})

test('missing credentials and untrusted configurations never send a request', async t => {
  const { calls, logs } = intercept(t, () => { throw new Error('No request should be sent') })
  const missing = await callRelayText({ ...env, OPENAI_NEXT_API_KEY: '  ' }, messages)
  assert.equal(missing.code, 'AI_NOT_CONFIGURED')
  for (const base of [
    'http://api.openai-next.com',
    'https://untrusted.invalid',
    'https://api.openai-next.com.untrusted.invalid',
    'https://api.openai-next.com@untrusted.invalid',
    'https://user:password@api.openai-next.com',
    'https://api.openai-next.com:8443',
    'https://api.openai-next.com/v1?token=private',
    'https://api.openai-next.com/v1#fragment',
    'https://api.openai-next.com/untrusted-path',
    'invalid-url',
  ]) {
    const result = await callRelayText({ ...env, OPENAI_NEXT_BASE_URL: base }, messages)
    assert.equal(result.ok, false)
    assert.equal(result.code, 'AI_INVALID_CONFIG')
    assertPrivateDataAbsent(result, logs)
  }
  assert.equal(calls.length, 0)
})

test('401, 403 and 429 discard upstream error bodies and do not retry', async t => {
  for (const [status, code, expectedStatus] of [[401, 'AI_NOT_CONFIGURED', 502], [403, 'AI_NOT_CONFIGURED', 502], [429, 'AI_RATE_LIMITED', 429]]) {
    await t.test(`HTTP ${status}`, async t => {
      let cancelled = 0
      const { calls, logs } = intercept(t, () => ({
        ok: false,
        status,
        body: { cancel: async () => { cancelled++ } },
        json: async () => { throw new Error(`${privateMarker}:${fakeKey}`) },
        text: async () => `${privateMarker}:${fakeKey}`,
      }))
      const result = await callRelayText(env, messages)
      assert.equal(result.ok, false)
      assert.equal(result.code, code)
      assert.equal(result.status, expectedStatus)
      assert.equal(cancelled, 1)
      assert.equal(calls.length, 1)
      assertPrivateDataAbsent(result, logs)
    })
  }
})

test('manual redirect responses are rejected without requesting the redirected host or retrying', async t => {
  const { calls, logs } = intercept(t, (_url, init) => {
    assert.equal(init.redirect, 'manual')
    return new Response(null, { status: 302, headers: { Location: 'https://untrusted.invalid/steal' } })
  })
  const responseResult = await callRelayText(env, messages)
  assert.equal(responseResult.ok, false)
  assert.equal(responseResult.code, 'AI_UPSTREAM_ERROR')
  assert.equal(calls.length, 1)
  assert(calls.every(([url]) => new URL(String(url)).hostname === 'api.openai-next.com'))
  assertPrivateDataAbsent(responseResult, logs)
  const rejectingFetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError(privateMarker) })
  const rejectedResult = await callRelayText(env, messages)
  assert.equal(rejectedResult.ok, false)
  assert.equal(rejectedResult.code, 'AI_NETWORK_ERROR')
  assert.equal(rejectingFetch.mock.callCount(), 1)
  assertPrivateDataAbsent(rejectedResult, logs)
})

test('incomplete, malformed, empty, and error responses are rejected safely', async t => {
  const cases = [
    ['truncated completion', () => completion('{"partial":', 'length'), 'AI_INCOMPLETE_RESPONSE'],
    ['tool call instead of completed message', () => completion('', 'tool_calls'), 'AI_INCOMPLETE_RESPONSE'],
    ['missing choices', () => Response.json({ id: 'test' }), 'AI_INCOMPLETE_RESPONSE'],
    ['empty content', () => completion('   '), 'AI_EMPTY_RESPONSE'],
    ['non-text content', () => completion([{ text: privateMarker }]), 'AI_EMPTY_RESPONSE'],
    ['missing body', () => new Response(null), 'AI_EMPTY_RESPONSE'],
    ['invalid JSON envelope', () => new Response(privateMarker), 'AI_INVALID_RESPONSE'],
    ['upstream error in success envelope', () => Response.json({ error: { message: privateMarker } }), 'AI_UPSTREAM_ERROR'],
  ]
  for (const [name, response, code] of cases) {
    await t.test(name, async t => {
      const { calls, logs } = intercept(t, response)
      const result = await callRelayText(env, messages)
      assert.equal(result.ok, false)
      assert.equal(result.code, code)
      assert.equal(calls.length, 1)
      assertPrivateDataAbsent(result, logs)
    })
  }
})

test('both the envelope byte limit and message length limit are enforced', async t => {
  for (const [name, response] of [
    ['large envelope', () => new Response(' '.repeat(262_145))],
    ['large message', () => completion('x'.repeat(32_001))],
  ]) {
    await t.test(name, async t => {
      const { calls, logs } = intercept(t, response)
      const result = await callRelayText(env, messages)
      assert.equal(result.ok, false)
      assert.equal(result.code, 'AI_RESPONSE_TOO_LONG')
      assert.equal(calls.length, 1)
      assertPrivateDataAbsent(result, logs)
    })
  }
})

test('a stalled response body is cancelled on deadline without an automatic retry', async t => {
  let cancelled = 0
  let signal
  const { calls, logs } = intercept(t, (_url, init) => {
    signal = init.signal
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('{"choices":[')) },
      cancel() { cancelled++ },
    }))
  })
  const started = Date.now()
  const result = await callRelayText(env, messages, 25)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'AI_TIMEOUT')
  assert.equal(result.status, 504)
  assert(signal.aborted)
  assert.equal(cancelled, 1)
  assert.equal(calls.length, 1)
  assert(Date.now() - started < 2_000, 'A stalled body must not keep the request alive')
  assertPrivateDataAbsent(result, logs)
})

test('a request that never receives headers also aborts without a retry', async t => {
  let signal
  const { calls, logs } = intercept(t, (_url, init) => {
    signal = init.signal
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error(privateMarker)), { once: true })
    })
  })
  const result = await callRelayText(env, messages, 25)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'AI_TIMEOUT')
  assert(signal.aborted)
  assert.equal(calls.length, 1)
  assertPrivateDataAbsent(result, logs)
})
