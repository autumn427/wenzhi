import fs from 'node:fs'
import path from 'node:path'
import dns from 'node:dns'
import {Agent,fetch as undiciFetch,buildConnector} from 'undici'
dns.setDefaultResultOrder('ipv4first')
const connector=buildConnector({rejectUnauthorized:true})
const dispatcher=process.env.CF_SSH_PROXY==='1'?new Agent({connect(options,callback){
 if(options.hostname!=='api.cloudflare.com')return callback(new Error('UNEXPECTED_API_HOST'),null)
 connector({...options,hostname:'127.0.0.1',host:'127.0.0.1',port:57401,servername:'api.cloudflare.com'},callback)
}}):undefined
export const account='96b0fc65bb6cbc58cd7cebdd69a97443'
export async function cf(endpoint,method='GET',body) {
 console.log(JSON.stringify({event:'cloudflare_request',method,path:endpoint.replace(/\?.*/, '')}))
 const config=fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8')
 const token=config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1]
 if(!token)throw new Error('WRANGLER_LOGIN_MISSING')
 const headers={Authorization:`Bearer ${token}`}
 let payload
 if(body instanceof FormData){const encoded=new Request('https://api.cloudflare.com/',{method:'POST',body});headers['Content-Type']=encoded.headers.get('Content-Type');payload=new Uint8Array(await encoded.arrayBuffer())}
 else if(body){headers['Content-Type']='application/json';payload=JSON.stringify(body)}
 const res=await undiciFetch('https://api.cloudflare.com/client/v4'+endpoint,{method,headers,body:payload,signal:AbortSignal.timeout(30000),dispatcher})
 const data=await res.json()
 if(!res.ok||!data.success)throw new Error(`CLOUDFLARE_${res.status}_${data.errors?.map(e=>e.code).join('_')}`)
 return data.result
}
