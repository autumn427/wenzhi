import http from 'node:http'
import { Readable } from 'node:stream'
import fs from 'node:fs/promises'
import path from 'node:path'
import { timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import { createRemoteD1 } from './d1-remote.mjs'

export function memoryCaches({ maxBytes = 8 * 1024 * 1024, maxEntries = 64, now = Date.now } = {}) {
  const entries = new Map(); let bytes = 0
  const drop = key => { const item = entries.get(key); if (item) { bytes -= item.body.length; entries.delete(key) } }
  return { async open(name) { return {
    async match(request) { const key = name + ':' + request.url, item = entries.get(key); if (!item) return undefined; if (item.until <= now()) { drop(key); return undefined }; return new Response(item.body.slice(), { status: item.status, headers: item.headers }) },
    async put(request, response) {
      const control = response.headers.get('Cache-Control') ?? '', ttl = Number(control.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1] ?? 0)
      if (request.method !== 'GET' || !response.ok || /private|no-store|no-cache/i.test(control) || response.headers.has('set-cookie') || ttl <= 0) return
      const body = new Uint8Array(await response.arrayBuffer()); if (body.length > maxBytes) return
      const key = name + ':' + request.url; drop(key)
      while (entries.size >= maxEntries || bytes + body.length > maxBytes) drop(entries.keys().next().value)
      entries.set(key, { body, status: response.status, headers: [...response.headers], until: now() + Math.min(ttl, 21600) * 1000 }); bytes += body.length
    },
  } } }
}
export function rateLimiter({ limit = 12, periodMs = 60000, now = Date.now } = {}) {
  const buckets = new Map()
  return { async limit({ key }) {
    const current = now(); for (const [k, value] of buckets) if (value.until <= current) buckets.delete(k)
    let bucket = buckets.get(key)
    if (!bucket) { if (buckets.size >= 10000) return { success: false }; bucket = { count: 0, until: current + periodMs }; buckets.set(key, bucket) }
    return { success: ++bucket.count <= limit }
  } }
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
export function staticAssets(directory) {
  return { async fetch(request) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 })
    const url = new URL(request.url); let pathname
    try { pathname = decodeURIComponent(url.pathname) } catch { return new Response('Bad path', { status: 400 }) }
    if (pathname.startsWith('/api/') || pathname.split(/[\\/]/).some(part => part.startsWith('.')) || pathname.includes('\0')) return new Response('Not found', { status: 404 })
    try {
      const root = await fs.realpath(directory)
      let file = path.resolve(root, '.' + pathname)
      if (!file.startsWith(root + path.sep) && file !== root) return new Response('Not found', { status: 404 })
      try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html'); await fs.access(file) }
      catch { if (path.extname(pathname)) return new Response('Not found', { status: 404 }); file = path.join(root, 'index.html') }
      file = await fs.realpath(file)
      if (!file.startsWith(root + path.sep)) return new Response('Not found', { status: 404 })
      const body = request.method === 'HEAD' ? null : await fs.readFile(file)
      return new Response(body, { headers: { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600' } })
    } catch { return new Response('Not found', { status: 404 }) }
  } }
}

export function createNodeBackend({ worker, env, publicOrigin, assetsDirectory, maxBodyBytes = 1024 * 1024, gatewaySecret }) {
  if (gatewaySecret !== undefined && gatewaySecret.length < 32) throw new Error('INVALID_GATEWAY_SECRET')
  const origin = new URL(publicOrigin)
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('INVALID_PUBLIC_ORIGIN')
  globalThis.caches = memoryCaches()
  const bindings = { ...env, ASSETS: staticAssets(assetsDirectory), AI_RATE_LIMITER: rateLimiter() }
  const pending = new Set()
  const ctx = { waitUntil(promise) { const task = Promise.resolve(promise).catch(() => console.error(JSON.stringify({ event: 'background_task_failed' }))).finally(() => pending.delete(task)); pending.add(task) } }
  const server = http.createServer(async (incoming, outgoing) => {
    try {
      if (gatewaySecret) {
        const provided = incoming.headers['x-wenzhi-gateway']
        if (typeof provided !== 'string' || Buffer.byteLength(provided) !== Buffer.byteLength(gatewaySecret) || !timingSafeEqual(Buffer.from(provided), Buffer.from(gatewaySecret))) { outgoing.writeHead(404).end(); return }
      }
      if (!incoming.url?.startsWith('/') || incoming.url.startsWith('//')) { outgoing.writeHead(400).end(); return }
      const url = new URL(incoming.url, origin.origin)
      if (url.origin !== origin.origin) { outgoing.writeHead(400).end(); return }
      // Never infer origin or identity from untrusted proxy/Host headers.
      const requestOrigin = incoming.headers.origin
      if (url.pathname.startsWith('/api/') && ((requestOrigin && requestOrigin !== origin.origin) || incoming.headers['sec-fetch-site'] === 'cross-site')) { outgoing.writeHead(403).end(); return }
      const parts = []; let size = 0
      for await (const part of incoming) { size += part.length; if (size > maxBodyBytes) { outgoing.writeHead(413, { Connection: 'close' }).end(); incoming.resume(); return }; parts.push(part) }
      const headers = new Headers()
      for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined && !['host','connection','transfer-encoding','content-length','cf-connecting-ip','forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-wenzhi-gateway','x-wenzhi-client-ip'].includes(key)) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
      const trustedIP = incoming.headers['x-wenzhi-client-ip']
      headers.set('CF-Connecting-IP', gatewaySecret && typeof trustedIP === 'string' && isIP(trustedIP) ? trustedIP : incoming.socket.remoteAddress ?? 'unknown')
      const request = new Request(url, { method: incoming.method, headers, body: !['GET', 'HEAD'].includes(incoming.method) && size ? Buffer.concat(parts) : undefined })
      let result
      if (url.pathname === '/api/ready' && incoming.method === 'GET') {
        try { const row = await env.DB.prepare('SELECT 1 AS ok').first(); if (row?.ok !== 1) throw new Error('D1_INVALID_PROBE'); result = Response.json({ status: 'ok', storage: 'd1-remote', runtime: 'node' }, { headers: { 'Cache-Control': 'no-store' } }) }
        catch { result = Response.json({ status: 'unavailable', storage: 'd1-remote' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
      } else {
        result = await worker.fetch(request, bindings, ctx)
        if (url.pathname === '/api/health' && result.ok) result = Response.json({ ...await result.json(), storage: 'd1-remote', runtime: 'node', databaseVerified: false }, { headers: { 'Cache-Control': 'no-store' } })
      }
      outgoing.statusCode = result.status
      for (const [key, value] of result.headers) if (key !== 'set-cookie') outgoing.setHeader(key, value)
      const cookies = result.headers.getSetCookie(); if (cookies.length) outgoing.setHeader('Set-Cookie', cookies)
      if (!result.body || incoming.method === 'HEAD') { await result.body?.cancel(); outgoing.end() }
      else { const stream = Readable.fromWeb(result.body); stream.on('error', () => outgoing.destroy()); outgoing.on('close', () => stream.destroy()); stream.pipe(outgoing) }
    } catch { if (!outgoing.headersSent) outgoing.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); outgoing.end(JSON.stringify({ error: { code: 'BACKEND_UNAVAILABLE' } })) }
  })
  server.requestTimeout = 70000; server.headersTimeout = 15000; server.keepAliveTimeout = 5000
  return { server, async close() { const stopped = new Promise(resolve => server.close(resolve)); server.closeIdleConnections(); const timer = setTimeout(() => server.closeAllConnections(), 10000); await stopped; clearTimeout(timer); let drainTimer; await Promise.race([Promise.allSettled([...pending]), new Promise(resolve => { drainTimer = setTimeout(resolve, 10000) })]); clearTimeout(drainTimer) } }
}
export function configuredD1(environment) {
  return createRemoteD1({ accountId: environment.CLOUDFLARE_ACCOUNT_ID, databaseId: environment.CLOUDFLARE_D1_DATABASE_ID, token: environment.CLOUDFLARE_D1_API_TOKEN })
}
