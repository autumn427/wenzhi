import fs from 'node:fs'
import { parseEnv } from 'node:util'
import { spawnSync } from 'node:child_process'
const vars=parseEnv(fs.readFileSync(new URL('../.dev.vars',import.meta.url),'utf8'))
if(!vars.OPENAI_NEXT_API_KEY?.trim()) throw new Error('LOCAL_AI_KEY_MISSING')
const changes={OPENAI_NEXT_API_KEY:vars.OPENAI_NEXT_API_KEY,OPENAI_NEXT_BASE_URL:vars.OPENAI_NEXT_BASE_URL||'https://api.openai-next.com',OPENAI_NEXT_MODEL:'gpt-5.4-mini'}
const py=`import os,sys,json,pathlib,stat
p=pathlib.Path('/tos-mlp-zgci/wenzhi-backend/.runtime/server.env')
assert stat.S_IMODE(p.stat().st_mode)==0o600
changes=json.load(sys.stdin)
assert set(changes)=={'OPENAI_NEXT_API_KEY','OPENAI_NEXT_BASE_URL','OPENAI_NEXT_MODEL'}
assert all(isinstance(v,str) and '\\n' not in v and '\\r' not in v and \"'\" not in v for v in changes.values())
old=p.read_text()
backup=p.with_name('server.env.before-ai')
fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f: f.write(old)
lines=[l for l in old.splitlines() if l.split('=',1)[0] not in changes]
lines += [k+\"='\"+v+\"'\" for k,v in changes.items()]
with p.open('w') as f: f.write('\\n'.join(lines)+'\\n')
os.chmod(p,0o600)
print('AI_CONFIGURATION_SAVED')`
const code=Buffer.from(py).toString('base64')
const r=spawnSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','-o','StrictHostKeyChecking=yes','zjc-online',`/root/miniconda3/bin/python3 -c "import base64; exec(base64.b64decode('${code}'))"`],{input:JSON.stringify(changes),encoding:'utf8',windowsHide:true})
if(r.status!==0){console.error('AI_CONFIGURATION_FAILED');process.exitCode=1}else console.log(r.stdout.trim())
