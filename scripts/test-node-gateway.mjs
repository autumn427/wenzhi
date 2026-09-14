import {test} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
const output=await build({entryPoints:['worker/node-gateway.ts'],bundle:true,platform:'node',format:'esm',write:false})
const {nodeGateway}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'))
test('gateway is opt-in; validates origin/config; preserves selected legacy routes',async()=>{
 const req=new Request('https://wenzhi.autumn427.xyz/api/health')
 assert.equal(await nodeGateway(req,{}),null)
 const env={NODE_BACKEND_ORIGIN:'https://wenzhi-origin.autumn427.xyz',NODE_GATEWAY_SECRET:'a'.repeat(48)}
 assert.equal(await nodeGateway(new Request('https://wenzhi.autumn427.xyz/'),env),null)
 assert.equal((await nodeGateway(req,{...env,NODE_GATEWAY_SECRET:''})).status,503)
 assert.equal((await nodeGateway(req,{...env,NODE_BACKEND_ORIGIN:'https://evil.test'})).status,503)
 assert.equal((await nodeGateway(new Request(req,{headers:{Origin:'https://evil.test'}}),env)).status,403)
 assert.equal(await nodeGateway(new Request('https://wenzhi.autumn427.xyz/api/zhihu/search'),{...env,NODE_KEEP_ZHIHU:'true'}),null)
})
test('gateway overwrites spoofed auth/IP, preserves body and cookies, never replays a failed write',async()=>{
 const saved=globalThis.fetch;let calls=0
 const env={NODE_BACKEND_ORIGIN:'https://wenzhi-origin.autumn427.xyz',NODE_GATEWAY_SECRET:'a'.repeat(48)}
 try {
  globalThis.fetch=async(url,init)=>{calls++;assert.equal(url.origin,env.NODE_BACKEND_ORIGIN);assert.equal(init.headers.get('X-Wenzhi-Gateway'),env.NODE_GATEWAY_SECRET);assert.equal(init.headers.get('X-Wenzhi-Client-IP'),'203.0.113.1');assert.equal(init.redirect,'manual');assert.equal(await new Response(init.body).text(),'test-body');return new Response('ok',{headers:{'Set-Cookie':'s=x; HttpOnly'}})}
  const response=await nodeGateway(new Request('https://wenzhi.autumn427.xyz/api/test',{method:'POST',body:'test-body',headers:{'CF-Connecting-IP':'203.0.113.1','X-Wenzhi-Client-IP':'bad','X-Wenzhi-Gateway':'bad'}}),env)
  assert.equal(response.headers.get('Set-Cookie'),'s=x; HttpOnly');assert.equal(response.headers.get('X-Wenzhi-Backend'),'node-zjc');assert.equal(await response.text(),'ok');assert.equal(calls,1)
  globalThis.fetch=async()=>{calls++;throw new Error('private upstream details')}
  const failure=await nodeGateway(new Request('https://wenzhi.autumn427.xyz/api/test',{method:'POST',body:'write'}),env)
  assert.equal(failure.status,503);assert.equal(calls,2);assert.equal((await failure.json()).error.code,'BACKEND_UNAVAILABLE')
 }finally{globalThis.fetch=saved}
})
