# Production API cutover — 2026-09-14

The public website remains `https://wenzhi.autumn427.xyz`. Existing Cloudflare static assets were preserved (`keep_assets: true`), and the public homepage was verified byte-for-byte against the pre-cutover snapshot.

API traffic now follows: public Worker → `https://wenzhi-origin.autumn427.xyz` → dedicated `wenzhi-node-zjc` tunnel → `127.0.0.1:30120` on `zjc-online` → remote Cloudflare D1.

## Verified

- `/api/health` returns `X-Wenzhi-Backend: node-zjc`, `runtime: node`, `relay: true`.
- `/api/ready` verifies a real D1 SELECT.
- Knowledge source lookup returns HTTP 200. Missing migrations 0003 and 0004 were applied through the server's remote D1 adapter, and recorded in `d1_migrations`. Migration 0005 was not applied.
- A real `/api/reality-experiment` call returned HTTP 200, `source: relay-ai`, and seven daily tasks through the new backend.
- Direct unauthenticated access to the tunnel returns 404. Authenticated proxy requests carry a trusted client IP; user-supplied identity headers are overwritten by the Worker. Forwarded writes are never automatically replayed after upstream failures.
- AI uses the user-authorized existing `OPENAI_NEXT_API_KEY`, endpoint `https://api.openai-next.com`, configured model `gpt-5.4-mini`.

## Zhihu runs on Node

The user safely supplied `ZHIHU_ACCESS_SECRET`, which is saved in the server's private environment file. Direct origin search was verified before setting `NODE_KEEP_ZHIHU=false`. Public search then returned HTTP 200, one result, and `X-Wenzhi-Backend: node-zjc`. Public health reports both `relay: true` and `zhihu: true`. All API routes now use Node. OAuth app credentials are not configured by this search integration; search success does not establish OAuth login readiness. Original Worker secrets remain available for rollback.

## Operations and rollback

Code and logs remain below `/tos-mlp-zgci/wenzhi-backend`; database remains in D1. Private `server.env` and `tunnel.json` are within the root-only `.runtime` directory. Never commit their contents.

The independent Supervisor manages `wenzhi-backend` and `wenzhi-tunnel`. Existing server services, especially ports 5050 and 8899, are unchanged. Boot integration is not configured; follow the startup instructions in `node-server-configured.md` after a host/container restart.

The Worker version immediately before the gateway deployment was `623ba158-c704-403e-8731-f70dcb8be9be` (same original application with the new, then-unused gateway secret). `server/cutover-rollback.json` records the deployment history before cutover. Roll back to that version using Wrangler rollback if needed. Keep additive knowledge tables; do not delete production data to roll back traffic.

`wrangler.jsonc` now records the Node origin and `NODE_KEEP_ZHIHU=false`. `scripts/deploy-node-gateway.mjs --cutover` updates Worker code only and preserves currently hosted assets. The intermediate version `1bd490a1-7f6a-4cf2-aec8-f66382cc1d7c` retains Zhihu on the Worker while forwarding other APIs to Node; it is recorded in the final cutover's rollback history. Deployment requires working Cloudflare authentication. Local API connectivity can use an explicitly established SSH forward when `CF_SSH_PROXY=1`; this setting does not disable TLS certificate verification.

The earlier `node-server-configured.md` describes the initial D1-only state. Use this document for the post-cutover state.
