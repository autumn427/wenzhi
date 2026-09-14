import assert from 'node:assert/strict'
import { zhihuOAuth } from '../worker/zhihu-oauth.ts'
const origin='https://wenzhi.test', pending=new Map(), sessions=new Map()
const DB={prepare(sql){return {bind(...args){return {
 async run(){ if(sql.startsWith('INSERT INTO zhihu_oauth_pending')) pending.set(args[0],{state:args[1],expires:args[2]}); if(sql.startsWith('INSERT INTO zhihu_oauth_sessions')) sessions.set(args[0],args[1]); if(sql.includes('DELETE FROM zhihu_oauth_sessions WHERE session_hash'))sessions.delete(args[0]); if(sql.includes('DELETE FROM zhihu_oauth_pending WHERE session_hash'))pending.delete(args[0]); return {} },
 async first(){if(sql.startsWith('DELETE')){const row=pending.get(args[0]);if(row?.state===args[1]&&row.expires>args[2]){pending.delete(args[0]);return {session_hash:args[0]}}return null}const expires=sessions.get(args[0]);return expires>args[1]?{expires_at:expires}:null}
 }}}}}
const env={DB,ZHIHU_OAUTH_APP_ID:'test-app',ZHIHU_OAUTH_APP_KEY:'synthetic-key',ZHIHU_OAUTH_REDIRECT_URI:origin+'/api/auth/zhihu/callback'}
const req=(path,method='GET',cookie,extra={})=>new Request(origin+'/api/auth/zhihu/'+path,{method,headers:{...(method==='POST'?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...extra}})
const saved=globalThis.fetch;let calls=0
globalThis.fetch=async(url,options)=>{calls++;assert.equal(String(url),'https://openapi.zhihu.com/access_token');assert.equal(options.body.get('app_key'),'synthetic-key');return Response.json({code:20000,data:{access_token:'synthetic-user-token',expires_in:3600}})}
try{
 assert.equal((await (await zhihuOAuth(req('status'),{DB})).json()).configured,false)
 assert.equal((await zhihuOAuth(req('start','POST',null,{Origin:'https://foreign.test'}),env)).status,403)
 const start=await zhihuOAuth(req('start','POST'),env), auth=new URL(start.headers.get('Location')), browserCookie=start.headers.get('Set-Cookie').split(';')[0], state=auth.searchParams.get('state')
 assert.equal(auth.hostname,'openapi.zhihu.com');assert.ok(start.headers.get('Set-Cookie').includes('HttpOnly'))
 assert.equal((await zhihuOAuth(req('callback?authorization_code=test-code','GET',browserCookie),env)).headers.get('Location'),'/?zhihu=verification_failed');assert.equal(calls,0)
 const callback='callback?authorization_code=test-code&state='+state
 assert.equal((await zhihuOAuth(req(callback),env)).headers.get('Location'),'/?zhihu=verification_failed');assert.equal(calls,0)
 const success=await zhihuOAuth(req(callback,'GET',browserCookie),env)
 assert.equal(success.headers.get('Location'),'/?zhihu=connected');assert.equal(calls,1)
 const connectedCookie=success.headers.get('Set-Cookie').split(';')[0];assert.notEqual(connectedCookie,browserCookie)
 assert.equal((await zhihuOAuth(req(callback,'GET',browserCookie),env)).headers.get('Location'),'/?zhihu=verification_failed');assert.equal(calls,1)
 const status=await (await zhihuOAuth(req('status','GET',connectedCookie),env)).json();assert.equal(status.authorized,true);assert.ok(!JSON.stringify(status).includes('synthetic'))
 await zhihuOAuth(req('logout','POST',connectedCookie),env)
 assert.equal((await (await zhihuOAuth(req('status','GET',connectedCookie),env)).json()).authorized,false)
 console.log('OAuth checks passed: disabled configuration, cross-origin rejection, required browser/state binding, token exchange, session rotation, replay rejection and logout.')
}finally{globalThis.fetch=saved}
