import fs from 'node:fs'
import dns from 'node:dns'
import {createHash} from 'node:crypto'
dns.setDefaultResultOrder('ipv4first')
const origin='https://wenzhi.autumn427.xyz'
const response=await fetch(origin+'/',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('HOME_FAILED')
const html=await response.text(),file=new URL('../server/production-index-before.html',import.meta.url)
if(process.argv.includes('--snapshot')){fs.writeFileSync(file,html);console.log(JSON.stringify({homeStatus:response.status,sha256:createHash('sha256').update(html).digest('hex')}));process.exit(0)}
const before=fs.readFileSync(file,'utf8');if(html!==before)throw new Error('STATIC_HOME_CHANGED')
for(const route of ['/api/health','/api/ready','/api/knowledge/search?query=AI']){
 const r=await fetch(origin+route,{signal:AbortSignal.timeout(25000)});const body=await r.json()
 console.log(JSON.stringify({route,status:r.status,backend:r.headers.get('X-Wenzhi-Backend'),...(route==='/api/health'||route==='/api/ready'?body:{items:body.items?.length})}))
 if(!r.ok||r.headers.get('X-Wenzhi-Backend')!=='node-zjc')throw new Error('CUTOVER_CHECK_FAILED')
}
console.log('STATIC_HOME_UNCHANGED')
