import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cf,account } from './node-cloudflare-api.mjs'
const candidate=randomBytes(48).toString('hex')
const py=`import os,sys,pathlib,re
p=pathlib.Path('/tos-mlp-zgci/wenzhi-backend/.runtime/server.env')
text=p.read_text()
m=re.search(r'^NODE_GATEWAY_SECRET=(.+)$',text,re.M)
if m: print(m.group(1).strip().strip(\"'\\\"\"))
else:
 secret=sys.stdin.read().strip()
 assert re.fullmatch('[a-f0-9]{96}',secret)
 backup=p.with_name('server.env.before-gateway')
 fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f: f.write(text)
 text=re.sub(r'^PUBLIC_ORIGIN=.*$', 'PUBLIC_ORIGIN=https://wenzhi.autumn427.xyz',text,flags=re.M)
 with p.open('w') as f: f.write(text+'\\nNODE_GATEWAY_SECRET='+secret+'\\n')
 os.chmod(p,0o600)
 print(secret)`
const code=Buffer.from(py).toString('base64')
const r=spawnSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','-o','StrictHostKeyChecking=yes','zjc-online',`/root/miniconda3/bin/python3 -c "import base64; exec(base64.b64decode('${code}'))"`],{input:candidate,encoding:'utf8',windowsHide:true})
if(r.status!==0||!/^[a-f0-9]{96}$/.test(r.stdout.trim()))throw new Error('GATEWAY_CONFIG_FAILED')
await cf(`/accounts/${account}/workers/scripts/wenzhi/secrets`,'PUT',{name:'NODE_GATEWAY_SECRET',type:'secret_text',text:r.stdout.trim()})
console.log('GATEWAY_SECRET_CONFIGURED_SERVER_AND_WORKER')
