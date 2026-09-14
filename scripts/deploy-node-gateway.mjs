// Explicit cutover only; keeps the currently deployed static asset set.
import fs from 'node:fs'
import { build } from 'esbuild'
import { cf,account } from './node-cloudflare-api.mjs'
if(!process.argv.includes('--cutover'))throw new Error('EXPLICIT_CUTOVER_REQUIRED')
const keepZhihu=process.argv.includes('--keep-zhihu')
const settings=await cf(`/accounts/${account}/workers/scripts/wenzhi/settings`)
if(!settings.bindings.some(b=>b.type==='secret_text'&&b.name==='NODE_GATEWAY_SECRET'))throw new Error('GATEWAY_SECRET_MISSING')
const current=await cf(`/accounts/${account}/workers/scripts/wenzhi/deployments`)
fs.writeFileSync(new URL('../server/cutover-rollback.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),deployments:current},null,2))
const source=await build({entryPoints:['worker/index.ts'],bundle:true,platform:'browser',target:'es2022',format:'esm',write:false})
const bindings=settings.bindings.filter(b=>b.type!=='secret_text'&&!['NODE_BACKEND_ORIGIN','NODE_KEEP_ZHIHU'].includes(b.name))
bindings.push({name:'NODE_BACKEND_ORIGIN',type:'plain_text',text:'https://wenzhi-origin.autumn427.xyz'},{name:'NODE_KEEP_ZHIHU',type:'plain_text',text:String(keepZhihu)})
const metadata={main_module:'index.js',compatibility_date:settings.compatibility_date,compatibility_flags:settings.compatibility_flags,bindings,keep_bindings:['secret_text'],keep_assets:true,observability:settings.observability,annotations:{'workers/message':'Route API to authenticated zjc Node backend; preserve existing static assets'}}
const form=new FormData();form.set('metadata',JSON.stringify(metadata));form.set('index.js',new Blob([source.outputFiles[0].text],{type:'application/javascript+module'}),'index.js')
const result=await cf(`/accounts/${account}/workers/scripts/wenzhi`,'PUT',form)
console.log(JSON.stringify({deployed:true,id:result.id,version:result.version_id,keepZhihu,keepAssets:true}))
