import fs from 'node:fs'
import path from 'node:path'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')
const config=fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8')
const token=config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1]
if(!token) throw new Error('WRANGLER_LOGIN_MISSING')
const response=await fetch('https://api.cloudflare.com/client/v4/accounts/96b0fc65bb6cbc58cd7cebdd69a97443/cfd_tunnel?is_deleted=false',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)})
const data=await response.json()
console.log(JSON.stringify({status:response.status,success:data.success,errors:data.errors?.map(e=>({code:e.code,message:e.message})),tunnels:data.result?.map(t=>({id:t.id,name:t.name,status:t.status}))}))
