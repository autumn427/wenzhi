import path from 'node:path'
import { fileURLToPath } from 'node:url'
import worker from '../worker/index.ts'
import { configuredD1, createNodeBackend } from './node-runtime.mjs'
const port = Number(process.env.PORT ?? 30120)
if (!Number.isInteger(port) || port < 1024 || port > 65535 || [5050, 8899].includes(port)) throw new Error('INVALID_OR_RESERVED_PORT')
const publicOrigin = process.env.PUBLIC_ORIGIN ?? `http://127.0.0.1:${port}`
const env = { DB: configuredD1(process.env) }
for (const key of ['OPENAI_NEXT_API_KEY','OPENAI_NEXT_BASE_URL','OPENAI_NEXT_MODEL','ZHIHU_ACCESS_SECRET','ZHIHU_OAUTH_APP_ID','ZHIHU_OAUTH_APP_KEY','ZHIHU_OAUTH_REDIRECT_URI','YEAKO_API_KEY','YEAKO_MODEL']) if (process.env[key]) env[key] = process.env[key]
const assetsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const app = createNodeBackend({ worker, env, publicOrigin, assetsDirectory, gatewaySecret: process.env.NODE_GATEWAY_SECRET })
// A configured token is not proof of connectivity. Fail startup if D1 is unavailable.
try { const row = await env.DB.prepare('SELECT 1 AS ok').first(); if (row?.ok !== 1) throw new Error('D1_INVALID_PROBE') }
catch { console.error('D1_STARTUP_CHECK_FAILED: verify the dedicated D1 token and network.'); process.exit(1) }
app.server.on('error', () => { console.error('BACKEND_LISTEN_FAILED'); process.exitCode = 1 })
app.server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ event: 'backend_started', address: `127.0.0.1:${port}`, storage: 'd1-remote' })))
let stopping = false
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async () => { if (stopping) return; stopping = true; await app.close(); process.exit(0) })
