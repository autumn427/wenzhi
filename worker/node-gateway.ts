export type NodeGatewayEnv = { NODE_BACKEND_ORIGIN?: string; NODE_GATEWAY_SECRET?: string; NODE_KEEP_ZHIHU?: string; ZHIHU_ACCESS_SECRET?: string }
export async function nodeGateway(request: Request, env: NodeGatewayEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (!env.NODE_BACKEND_ORIGIN || !url.pathname.startsWith('/api/')) return null
  if (env.NODE_KEEP_ZHIHU === 'true' && (url.pathname.startsWith('/api/zhihu/') || url.pathname.startsWith('/api/auth/zhihu/'))) return null
  const fail = (code: string, status: number) => Response.json({ error: { code } }, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!env.NODE_GATEWAY_SECRET || env.NODE_GATEWAY_SECRET.length < 32) return fail('BACKEND_NOT_CONFIGURED', 503)
  const origin = request.headers.get('Origin')
  if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') return fail('UNTRUSTED_ORIGIN', 403)
  if (!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(request.method)) return fail('METHOD_NOT_ALLOWED', 405)
  let upstream: URL
  try {
    upstream = new URL(env.NODE_BACKEND_ORIGIN)
    if (upstream.origin !== 'https://wenzhi-origin.autumn427.xyz' || upstream.pathname !== '/' || upstream.search || upstream.hash || upstream.username || upstream.password) return fail('BACKEND_INVALID_CONFIG', 503)
  } catch { return fail('BACKEND_INVALID_CONFIG', 503) }
  upstream.pathname = url.pathname; upstream.search = url.search
  const headers = new Headers(request.headers)
  for (const key of ['host','forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-wenzhi-gateway','x-wenzhi-client-ip']) headers.delete(key)
  headers.set('X-Wenzhi-Gateway', env.NODE_GATEWAY_SECRET)
  headers.set('X-Wenzhi-Client-IP', request.headers.get('CF-Connecting-IP') || 'unknown')
  try {
    // Never retry or fall back after forwarding a potentially committed write.
    const result = await fetch(upstream, { method: request.method, headers, body: ['GET','HEAD'].includes(request.method) ? undefined : request.body, redirect: 'manual', signal: AbortSignal.timeout(65000) })
    const response = url.pathname === '/api/health' && result.ok && env.NODE_KEEP_ZHIHU === 'true'
      ? Response.json({ ...await result.json() as Record<string, unknown>, zhihu: Boolean(env.ZHIHU_ACCESS_SECRET?.trim()), zhihuRuntime: 'worker' }, { status: result.status, headers: result.headers })
      : new Response(result.body, result)
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('X-Wenzhi-Backend', 'node-zjc')
    response.headers.delete('X-Wenzhi-Gateway')
    return response
  } catch { return fail('BACKEND_UNAVAILABLE', 503) }
}
