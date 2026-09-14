import { Miniflare } from './node_modules/miniflare/dist/src/index.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const runtime=path.dirname(fileURLToPath(import.meta.url)), root=path.dirname(runtime)
const state='/dev/shm/wenzhi-backend-30120'
fs.mkdirSync(state,{recursive:true,mode:0o700})
const allowed=['OPENAI_NEXT_API_KEY','ZHIHU_ACCESS_SECRET','ZHIHU_OAUTH_APP_ID','ZHIHU_OAUTH_APP_KEY','ZHIHU_OAUTH_REDIRECT_URI']
const bindings={OPENAI_NEXT_BASE_URL:'https://api.openai-next.com',OPENAI_NEXT_MODEL:'gpt-5.4-mini'}
for(const key of allowed)if(process.env[key])bindings[key]=process.env[key]
const mf=new Miniflare({host:'127.0.0.1',port:30120,modules:true,scriptPath:path.join(runtime,'worker.mjs'),compatibilityDate:'2026-08-24',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'wenzhi-server-local'},d1Persist:path.join(state,'d1'),cachePersist:path.join(state,'cache'),bindings,ratelimits:{AI_RATE_LIMITER:{namespace_id:'1001',simple:{limit:12,period:60}}},assets:{directory:path.join(root,'dist'),binding:'ASSETS',run_worker_first:['/api/*'],assetConfig:{not_found_handling:'single-page-application'}}})
await mf.ready
const db=await mf.getD1Database('DB')
for(const file of fs.readdirSync(path.join(root,'migrations')).filter(f=>f.endsWith('.sql')).sort()){
 const sql=fs.readFileSync(path.join(root,'migrations',file),'utf8')
 // Current checked-in migrations are idempotent CREATE statements.
 for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run()
}
console.log('Wenzhi local integration service ready: http://127.0.0.1:30120; database is temporary tmpfs, not production D1.')
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await mf.dispose();process.exit(0)})
