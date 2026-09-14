// Bundled separately for Node 20 compatibility checks; never calls real D1.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import worker from '../worker/index.ts'
import { createRemoteD1 } from './d1-remote.mjs'
import { createNodeBackend } from './node-runtime.mjs'
let queries=0
const DB=createRemoteD1({accountId:'a'.repeat(32),databaseId:'00000000-0000-4000-8000-000000000001',token:'synthetic-token',fetchImpl:async()=>{queries++;return Response.json({success:true,result:[{success:true,results:[{ok:1}],meta:{}}]})}})
const app=createNodeBackend({worker,env:{DB},publicOrigin:'http://127.0.0.1:30120',assetsDirectory:'dist'})
app.server.listen(0,'127.0.0.1');await once(app.server,'listening')
const port=app.server.address().port
try{
 assert.ok(![5050,8899].includes(port))
 const response=await fetch(`http://127.0.0.1:${port}/api/ready`)
 assert.equal(response.status,200);assert.equal((await response.json()).storage,'d1-remote');assert.equal(queries,1)
 const health=await(await fetch(`http://127.0.0.1:${port}/api/health`)).json();assert.equal(health.runtime,'node');assert.equal(health.relay,false)
 console.log(JSON.stringify({result:'PASS',node:process.version,database:'mock-only',productionRequests:0}))
}finally{await app.close()}
