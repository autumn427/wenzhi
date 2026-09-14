const headers={'X-Wenzhi-Gateway':process.env.NODE_GATEWAY_SECRET,'X-Wenzhi-Client-IP':'127.0.0.1'}
try {
 const origin=process.argv[2]||'http://127.0.0.1:30120'
 if(!['http://127.0.0.1:30120','https://wenzhi-origin.autumn427.xyz'].includes(origin))throw new Error('INVALID_PROBE_ORIGIN')
 for(const route of ['/api/ready','/api/health']) {
  const r=await fetch(origin+route,{headers,signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('PROBE_HTTP_'+r.status)
  console.log(JSON.stringify({route,...await r.json()}))
 }
 const knowledge=await fetch(origin+'/api/knowledge/search?query=AI',{headers,signal:AbortSignal.timeout(20000)})
 console.log(JSON.stringify({route:'/api/knowledge/search',status:knowledge.status}))
 if(!knowledge.ok)throw new Error('KNOWLEDGE_PROBE_FAILED')
 const unauth=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(10000)});if(unauth.status!==404)throw new Error('AUTH_GUARD_FAILED');console.log('UNAUTHENTICATED_ACCESS_BLOCKED')
}catch(error){console.error(error.message);process.exitCode=1}
