export type ZhihuOAuthEnv = {
  DB: D1Database
  ZHIHU_OAUTH_APP_ID?: string
  ZHIHU_OAUTH_APP_KEY?: string
  ZHIHU_OAUTH_REDIRECT_URI?: string
}
const cookieName = '__Host-wenzhi_zhihu'
const callbackPath = '/api/auth/zhihu/callback'
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
const json = (value: unknown, status = 200) => Response.json(value, { status, headers })
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), v => v.toString(16).padStart(2, '0')).join('')
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), v => v.toString(16).padStart(2, '0')).join('')
const cookie = (id: string, age: number) => `${cookieName}=${id}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`
const session = (r: Request) => r.headers.get('Cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1) ?? ''
const redirect = (to: string, setCookie?: string) => new Response(null, { status: 303, headers: { ...headers, Location: to, ...(setCookie ? { 'Set-Cookie': setCookie } : {}) } })
function configured(env: ZhihuOAuthEnv, origin: string) {
  return Boolean(env.ZHIHU_OAUTH_APP_ID?.trim() && env.ZHIHU_OAUTH_APP_KEY?.trim() && env.ZHIHU_OAUTH_REDIRECT_URI === origin + callbackPath && origin.startsWith('https://'))
}

export async function zhihuOAuth(request: Request, env: ZhihuOAuthEnv): Promise<Response> {
  const url = new URL(request.url), path = url.pathname, now = Math.floor(Date.now() / 1000)
  const enabled = configured(env, url.origin)
  try {
    if (path === '/api/auth/zhihu/status' && request.method === 'GET') {
      if (!enabled) return json({ configured: false, authorized: false })
      const id = session(request)
      const row = /^[a-f0-9]{64}$/.test(id) ? await env.DB.prepare('SELECT expires_at FROM zhihu_oauth_sessions WHERE session_hash = ? AND expires_at > ?').bind(await hash(id), now).first<{ expires_at: number }>() : null
      return json({ configured: true, authorized: Boolean(row), expiresAt: row?.expires_at ?? null })
    }
    if (path === '/api/auth/zhihu/start' || path === '/api/auth/zhihu/logout') {
      if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
      if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ error: 'UNTRUSTED_ORIGIN' }, 403)
      if (path.endsWith('/logout')) {
        const id = session(request)
        if (/^[a-f0-9]{64}$/.test(id)) {
          await env.DB.prepare('DELETE FROM zhihu_oauth_sessions WHERE session_hash = ?').bind(await hash(id)).run()
          await env.DB.prepare('DELETE FROM zhihu_oauth_pending WHERE session_hash = ?').bind(await hash(id)).run()
        }
        return redirect('/?zhihu=disconnected', cookie('', 0))
      }
      if (!enabled) return redirect('/?zhihu=unavailable')
      const id = random(), state = random()
      await env.DB.prepare('DELETE FROM zhihu_oauth_pending WHERE expires_at <= ?').bind(now).run()
      await env.DB.prepare('DELETE FROM zhihu_oauth_sessions WHERE expires_at <= ?').bind(now).run()
      await env.DB.prepare('INSERT INTO zhihu_oauth_pending (session_hash, state_hash, expires_at) VALUES (?, ?, ?)').bind(await hash(id), await hash(state), now + 600).run()
      const authorize = new URL('https://openapi.zhihu.com/authorize')
      authorize.search = new URLSearchParams({ app_id: env.ZHIHU_OAUTH_APP_ID!, redirect_uri: env.ZHIHU_OAUTH_REDIRECT_URI!, response_type: 'code', state }).toString()
      return redirect(authorize.href, cookie(id, 600))
    }
    if (path === callbackPath && request.method === 'GET') {
      if (!enabled) return redirect('/?zhihu=unavailable')
      const id = session(request), states = url.searchParams.getAll('state')
      const codes = [...url.searchParams.getAll('authorization_code'), ...url.searchParams.getAll('code')]
      if (!/^[a-f0-9]{64}$/.test(id) || states.length !== 1 || !/^[a-f0-9]{64}$/.test(states[0]) || codes.length !== 1 || !codes[0] || codes[0].length > 4096) return redirect('/?zhihu=verification_failed')
      // Atomically consume the browser-bound transaction before any token call.
      const pending = await env.DB.prepare('DELETE FROM zhihu_oauth_pending WHERE session_hash = ? AND state_hash = ? AND expires_at > ? RETURNING session_hash').bind(await hash(id), await hash(states[0]), now).first()
      if (!pending) return redirect('/?zhihu=verification_failed')
      const response = await fetch('https://openapi.zhihu.com/access_token', { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ app_id: env.ZHIHU_OAUTH_APP_ID!, app_key: env.ZHIHU_OAUTH_APP_KEY!, grant_type: 'authorization_code', redirect_uri: env.ZHIHU_OAUTH_REDIRECT_URI!, code: codes[0] }), signal: AbortSignal.timeout(15000) })
      if (!response.ok) return redirect('/?zhihu=exchange_failed', cookie('', 0))
      const payload = await response.json() as Record<string, unknown>
      const data = (payload.data ?? payload.Data ?? payload) as Record<string, unknown>
      if (!data || typeof data.access_token !== 'string' || !data.access_token || typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in < 1) return redirect('/?zhihu=exchange_failed', cookie('', 0))
      // This release only confirms account authorization. Do not retain OAuth
      // tokens or read creations, follows, collections or profile information.
      const age = Math.min(Math.floor(data.expires_in), 3600), nextId = random()
      await env.DB.prepare('INSERT INTO zhihu_oauth_sessions (session_hash, expires_at) VALUES (?, ?)').bind(await hash(nextId), now + age).run()
      return redirect('/?zhihu=connected', cookie(nextId, age))
    }
    return json({ error: 'NOT_FOUND' }, 404)
  } catch {
    // Never reflect upstream payloads, authorization codes or credentials.
    return path === callbackPath ? redirect('/?zhihu=exchange_failed', cookie('', 0)) : json({ error: 'AUTH_UNAVAILABLE', configured: false, authorized: false }, 503)
  }
}
