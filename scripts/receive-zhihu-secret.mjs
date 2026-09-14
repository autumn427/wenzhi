import http from 'node:http'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
const route='/'+randomBytes(24).toString('hex')
const csrf=randomBytes(32).toString('hex')
let busy=false, saved=false
const py=`import os,sys,pathlib,re
p=pathlib.Path('/tos-mlp-zgci/wenzhi-backend/.runtime/server.env')
secret=sys.stdin.read().strip()
assert 8<=len(secret)<=4096 and all(ord(c)>=33 and ord(c)<=126 for c in secret) and \"'\" not in secret
assert p.stat().st_mode & 0o777 == 0o600
old=p.read_text()
backup=p.with_name('server.env.before-zhihu-'+str(__import__('time').time_ns()))
fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f: f.write(old)
lines=[l for l in old.splitlines() if not l.startswith('ZHIHU_ACCESS_SECRET=')]
lines.append(\"ZHIHU_ACCESS_SECRET='\"+secret+\"'\")
with p.open('w') as f: f.write('\\n'.join(lines)+'\\n')
os.chmod(p,0o600)
print('ZHIHU_SECRET_SAVED')`
const command=`/root/miniconda3/bin/python3 -c "import base64; exec(base64.b64decode('${Buffer.from(py).toString('base64')}'))"`
const page=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>问枝 · 安全填写知乎凭据</title><style>body{font:16px system-ui;background:#f7f3ea;color:#302a22;margin:8vh auto;padding:24px;max-width:580px}form{background:#fffdf8;padding:28px;border:1px solid #dfd5c3;border-radius:16px}h1{font-size:25px}p{line-height:1.7;color:#665e51}label{display:block;margin-top:24px}input{box-sizing:border-box;width:100%;padding:14px;margin:10px 0 20px;border:1px solid #c8bba6;border-radius:6px}button{background:#1861a8;color:white;border:0;border-radius:6px;padding:13px 20px;font-size:16px}</style><h1>安全填写知乎凭据</h1><p>此页仅在本机开放，有效期 15 分钟。提交后经 SSH 保存到 zjc-online 的问枝私密配置文件，不写入聊天或请求日志。</p><form method="post" autocomplete="off"><label for="secret">ZHIHU_ACCESS_SECRET</label><input id="secret" name="secret" type="password" required minlength="8" maxlength="4096" autocomplete="off" spellcheck="false"><button type="submit">安全保存到服务器</button></form><p>这是知乎开放平台的 Access Secret，不是知乎登录密码。保存后请回到聊天回复“已保存”，我会验证检索并继续切换。</p></html>`
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");res.setHeader('Referrer-Policy','no-referrer')
 const origin=`http://127.0.0.1:${server.address().port}`
 if(req.url!==route||req.headers.host!==new URL(origin).host){res.writeHead(404);return res.end()}
 if(req.method==='GET'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(saved?'<meta charset="utf-8"><h1>知乎凭据已安全保存</h1><p>请返回聊天回复“已保存”。</p>':page.replace('<form method="post" autocomplete="off">',`<form method="post" autocomplete="off"><input type="hidden" name="csrf" value="${csrf}">`))}
 if(saved){res.writeHead(303,{Location:route});return res.end()}
 if(busy){res.writeHead(409,{'Content-Type':'text/html; charset=utf-8'});return res.end('<meta charset="utf-8"><h1>正在保存，请勿重复提交</h1><p>稍后刷新本页查看结果。</p>')}
 if(req.method!=='POST'){res.writeHead(405);return res.end('Method not allowed')}
 let body='';for await(const chunk of req){body+=chunk;if(body.length>16384){res.writeHead(413);return res.end('Input too long')}}
 const fields=new URLSearchParams(body)
 // Embedded browsers may rewrite Origin. A per-page random CSRF value, the
 // unguessable action path, and exact loopback Host protect this local handoff.
 if(fields.get('csrf')!==csrf){res.writeHead(403);return res.end('Rejected')}
 const secret=fields.get('secret')?.trim()??''
 if(!/^[!-~]{8,4096}$/.test(secret)||secret.includes("'")){res.writeHead(400);return res.end('Invalid secret format; use the Access Secret from Zhihu.')}
 busy=true
 const ssh=spawn('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','-o','StrictHostKeyChecking=yes','zjc-online',command],{stdio:['pipe','pipe','pipe'],windowsHide:true})
 let out='';ssh.stdout.on('data',chunk=>out+=chunk);ssh.stderr.resume();ssh.stdin.on('error',()=>{});ssh.stdin.end(secret)
 let complete=false;const finish=ok=>{if(complete)return;complete=true;busy=false;saved=ok;res.writeHead(ok?200:502,{'Content-Type':'text/html; charset=utf-8'});res.end(ok?'<meta charset="utf-8"><h1>知乎凭据已安全保存</h1><p>请返回聊天回复“已保存”，继续验证与切换。</p>':'<meta charset="utf-8"><h1>保存未成功</h1><p>未显示任何密钥，请返回聊天让我排查。</p>');console.log(ok?'ZHIHU_SECRET_SAVED':'ZHIHU_SECRET_SAVE_FAILED')}
 ssh.once('error',()=>finish(false));ssh.once('close',code=>finish(code===0&&out.trim()==='ZHIHU_SECRET_SAVED'))
})
server.listen(0,'127.0.0.1',()=>console.log(`SECURE_FORM=http://127.0.0.1:${server.address().port}${route}`))
setTimeout(()=>server.close(),15*60*1000).unref()
