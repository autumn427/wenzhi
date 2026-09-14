import assert from 'node:assert/strict'
import { createRemoteD1 } from './d1-remote.mjs'
try {
 const db=createRemoteD1({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,databaseId:process.env.CLOUDFLARE_D1_DATABASE_ID,token:process.env.CLOUDFLARE_D1_API_TOKEN})
 assert.equal(await db.prepare('SELECT 1 AS ok').first('ok'),1)
 assert.deepEqual(await db.prepare('SELECT ? AS number, ? AS text, ? AS empty').bind(42,'wenzhi-probe',null).first(),{number:42,text:'wenzhi-probe',empty:null})
 const batch=await db.batch([db.prepare('SELECT ? AS n').bind(1),db.prepare('SELECT ? AS n').bind(2)])
 assert.deepEqual(batch.map(r=>r.results[0].n),[1,2])
 const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
 console.log(JSON.stringify({result:'PASS',storage:'d1-remote',checks:['query','bound-parameters','batch'],tableCount:tables.results.length,mutations:0}))
} catch(error) { console.error(JSON.stringify({result:'FAIL',code:error.code??'D1_CHECK_FAILED'}));process.exitCode=1 }
