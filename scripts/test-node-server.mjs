import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { build } from 'esbuild'
import { createRemoteD1 } from '../server/d1-remote.mjs'
import { createNodeBackend, memoryCaches, rateLimiter } from '../server/node-runtime.mjs'
const options = { accountId: 'a'.repeat(32), databaseId: '00000000-0000-4000-8000-000000000001', token: 'synthetic-private-token' }
const ok = results => Response.json({ success: true, result: results.map(rows => ({ success: true, results: rows, meta: { changes: 1 } })) })

test('configured gateway rejects unauthenticated traffic and trusts only authenticated client IP', async () => {
 const app=createNodeBackend({worker:{fetch:async request=>Response.json({ip:request.headers.get('CF-Connecting-IP'),secret:request.headers.has('X-Wenzhi-Gateway')})},env:{},publicOrigin:'https://wenzhi.test',assetsDirectory:'dist',gatewaySecret:'a'.repeat(48)})
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const url=`http://127.0.0.1:${app.server.address().port}/api/test`
 try {
  assert.equal((await fetch(url)).status,404)
  assert.equal((await fetch(url,{headers:{'X-Wenzhi-Gateway':'wrong'}})).status,404)
  assert.deepEqual(await (await fetch(url,{headers:{'X-Wenzhi-Gateway':'a'.repeat(48),'X-Wenzhi-Client-IP':'203.0.113.12','CF-Connecting-IP':'198.51.100.1'}})).json(),{ip:'203.0.113.12',secret:false})
  assert.equal((await fetch(url,{headers:{'X-Wenzhi-Gateway':'a'.repeat(48),Origin:'https://evil.test'}})).status,403)
 }finally{await app.close()}
})
test('D1 immutable parameter bindings, first, null, all, run and single-request batch', async () => {
  const calls = []
  const db = createRemoteD1({ ...options, fetchImpl: async (url, init) => {
    assert.equal(new URL(url).hostname, 'api.cloudflare.com'); assert.equal(init.redirect, 'error')
    assert.equal(init.headers.Authorization, 'Bearer synthetic-private-token')
    const body = JSON.parse(init.body); calls.push(body)
    return ok(body.batch ? body.batch.map((_, i) => [{ id: i }]) : body.params?.[0] === 'empty' ? [[]] : [[{ id: 7, value: null }]])
  } })
  const base = db.prepare('SELECT id FROM sample WHERE id = ?'), one = base.bind(7), two = base.bind('empty')
  assert.deepEqual(await one.first(), { id: 7, value: null }); assert.equal(await one.first('id'), 7); assert.equal(await one.first('value'), null)
  assert.equal(await two.first(), null); assert.equal((await one.run()).meta.changes, 1); assert.equal((await one.all()).results.length, 1)
  await assert.rejects(one.first('missing'), /D1_COLUMN_NOT_FOUND/)
  const before = calls.length, batch = await db.batch([one, two]); assert.equal(calls.length, before + 1); assert.equal(batch.length, 2)
  assert.deepEqual(calls.at(-1), { batch: [{ sql: 'SELECT id FROM sample WHERE id = ?', params: [7] }, { sql: 'SELECT id FROM sample WHERE id = ?', params: ['empty'] }] })
  assert.throws(() => base.bind({ unsafe: true }), /UNSUPPORTED_PARAMETER/)
  await assert.rejects(db.batch([{}]), /INVALID_BATCH/)
})
test('D1 errors are sanitized; timeout/write failures never replay', async () => {
  for (const response of [() => new Response('secret SQL upstream detail', { status: 403 }), () => new Response('', { status: 429 }), () => Response.json({ success: true, result: [{ success: false, error: 'private data' }] }), () => new Response('bad-json')]) {
    let calls = 0
    const db = createRemoteD1({ ...options, fetchImpl: async () => { calls++; return response() } })
    await assert.rejects(db.prepare('INSERT INTO sample VALUES (?)').bind('private').run(), error => !error.message.includes('private') && !error.message.includes('secret'))
    assert.equal(calls, 1)
  }
  let calls = 0
  const db = createRemoteD1({ ...options, timeoutMs: 5, fetchImpl: async (_url, { signal }) => { calls++; return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) } })
  await assert.rejects(db.prepare('DELETE FROM sample').run(), /D1_TIMEOUT/); assert.equal(calls, 1)
  assert.throws(() => createRemoteD1({ ...options, token: '' }), /NOT_CONFIGURED/)
})
test('memory cache expires and refuses private responses; limiter is bounded', async () => {
  let now = 0; const cache = await memoryCaches({ now: () => now, maxEntries: 1 }).open('test'), request = new Request('https://test/a')
  await cache.put(request, new Response('hello', { headers: { 'Cache-Control': 'public, max-age=1' } }))
  assert.equal(await (await cache.match(request)).text(), 'hello'); now = 1001; assert.equal(await cache.match(request), undefined)
  await cache.put(request, new Response('secret', { headers: { 'Cache-Control': 'private, max-age=10' } })); assert.equal(await cache.match(request), undefined)
  const limiter = rateLimiter({ now: () => now, limit: 1, periodMs: 100 }); assert.equal((await limiter.limit({ key: 'a' })).success, true); assert.equal((await limiter.limit({ key: 'a' })).success, false); now += 101; assert.equal((await limiter.limit({ key: 'a' })).success, true)
})
test('real Worker runs through Node HTTP with remote D1, preserved errors and assets isolation', async () => {
  const output = await build({ entryPoints: ['worker/index.ts'], bundle: true, platform: 'node', format: 'esm', write: false })
  const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
  let fail = false; const queries = []
  const DB = createRemoteD1({ ...options, fetchImpl: async (_url, init) => { const body=JSON.parse(init.body); queries.push(body); return fail ? new Response('', { status: 503 }) : ok([body.sql === 'SELECT 1 AS ok' ? [{ok:1}] : []]) } })
  const app = createNodeBackend({ worker, env: { DB }, publicOrigin: 'https://wenzhi.test', assetsDirectory: 'dist', maxBodyBytes: 1024 })
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening')
  const origin = `http://127.0.0.1:${app.server.address().port}`
  try {
    const health = await (await fetch(origin + '/api/health')).json(); assert.equal(health.runtime, 'node'); assert.equal(health.storage, 'd1-remote'); assert.equal(health.databaseVerified, false)
    assert.equal((await fetch(origin + '/api/ready')).status, 200); assert.equal(queries.at(-1).sql, 'SELECT 1 AS ok')
    const search = await fetch(origin + '/api/knowledge/search?query=test'); assert.equal(search.status, 200); assert.deepEqual((await search.json()).items, [])
    assert.equal((await fetch(origin + '/api/knowledge/search?query=test', { headers: { Origin: 'https://evil.test' } })).status, 403)
    const auth = await (await fetch(origin + '/api/auth/zhihu/status')).json(); assert.equal(auth.authorized, false)
    assert.equal((await fetch(origin + '/api/telemetry', { method: 'POST', body: 'x'.repeat(1025) })).status, 413)
    for (const route of ['/.dev.vars', '/worker/index.ts', '/api/not-real']) assert.equal((await fetch(origin + route)).status, 404)
    fail = true; assert.equal((await fetch(origin + '/api/ready')).status, 503); assert.equal((await fetch(origin + '/api/knowledge/search?query=test')).status, 503)
  } finally { await app.close() }
})
test('Node ignores spoofed proxy IP, preserves cookies and drains background work', async () => {
  let finished = false
  const worker = { async fetch(request, _env, ctx) {
    ctx.waitUntil(new Promise(resolve => setTimeout(() => { finished = true; resolve() }, 20)))
    const headers = new Headers(); headers.append('Set-Cookie','a=1; HttpOnly'); headers.append('Set-Cookie','b=2; HttpOnly')
    return Response.json({ ip: request.headers.get('CF-Connecting-IP'), url: request.url }, { headers })
  } }
  const app = createNodeBackend({ worker, env: {}, publicOrigin: 'https://wenzhi.test', assetsDirectory: 'dist' }); app.server.listen(0, '127.0.0.1'); await once(app.server,'listening')
  const response = await fetch(`http://127.0.0.1:${app.server.address().port}/api/test`, { headers: { 'CF-Connecting-IP': 'spoofed', 'X-Forwarded-Host': 'evil.test' } })
  const body = await response.json(); assert.equal(body.ip,'127.0.0.1'); assert.equal(body.url,'https://wenzhi.test/api/test'); assert.equal(response.headers.getSetCookie().length,2)
  await app.close(); assert.equal(finished,true)
})
