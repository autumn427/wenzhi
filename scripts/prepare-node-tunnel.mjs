import fs from 'node:fs'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cf,account } from './node-cloudflare-api.mjs'
const tunnels=await cf(`/accounts/${account}/cfd_tunnel?is_deleted=false`)
if(tunnels.some(t=>t.name==='wenzhi-node-zjc'))throw new Error('TUNNEL_EXISTS_INSPECT_BEFORE_REUSE')
const secret=randomBytes(32).toString('base64')
const tunnel=await cf(`/accounts/${account}/cfd_tunnel`,'POST',{name:'wenzhi-node-zjc',config_src:'local',tunnel_secret:secret})
fs.writeFileSync(new URL('../server/tunnel-state.json',import.meta.url),JSON.stringify({account,id:tunnel.id,name:tunnel.name,hostname:'wenzhi-origin.autumn427.xyz'},null,2)+'\n')
const credential=JSON.stringify({AccountTag:account,TunnelID:tunnel.id,TunnelSecret:secret})
const py=`import os,sys
p='/tos-mlp-zgci/wenzhi-backend/.runtime/tunnel.json'
fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f: f.write(sys.stdin.read())
os.chmod(p,0o600)
print('TUNNEL_CREDENTIAL_SAVED')`
const code=Buffer.from(py).toString('base64')
const result=spawnSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','-o','StrictHostKeyChecking=yes','zjc-online',`/root/miniconda3/bin/python3 -c "import base64; exec(base64.b64decode('${code}'))"`],{input:credential,encoding:'utf8',windowsHide:true})
if(result.status!==0)throw new Error('TUNNEL_CREATED_BUT_TRANSFER_FAILED')
console.log(JSON.stringify({id:tunnel.id,name:tunnel.name,credentialsSaved:true,publicRouting:false}))
