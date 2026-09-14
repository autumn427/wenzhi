// Explicit opt-in: uses configured model credits through a local Worker only.
import assert from 'node:assert/strict'
import { createGeneratedUniverseRuns, chooseUniverseFreeAction } from '../src/simulation.ts'
import { acceptsNextAction } from '../src/action-submission.ts'
import { readStoryRoutes } from '../shared/story-routes.ts'
if (!process.argv.includes('--live')) throw Error('Pass --live to run four real model requests against the local Worker.')
const profile={identity:'student',intent:'portfolio',time:'low',sacrifice:'study',confusion:'每周只有两小时，怎样整理一份可重复使用的读书笔记？',skills:'已经整理过几份笔记',goal:'做一份能自己复用的读书笔记模板',worries:'不影响课程，不额外购买工具'}
async function post(path,body){
 const start=Date.now()
 const response=await fetch(`http://127.0.0.1:8787${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(62000)})
 const data=await response.json()
 console.log(JSON.stringify({path,status:response.status,elapsedMs:Date.now()-start,error:data.error?.code}))
 assert.ok(response.ok, data.error?.code || 'Request failed')
 return data
}
const opening=await post('/api/simulation/personalize',{profile})
const routes=readStoryRoutes(opening.routes);assert.ok(routes)
let run=createGeneratedUniverseRuns(profile,routes,opening.source).A
for(let i=0;i<3;i++){
 const action=run.currentEvent.choices[0].label
 const result=await post('/api/simulation/free-action',{profile,universeCode:'A',mode:'full',action,route:{title:run.route.title,premise:run.route.premise},event:run.currentEvent,decisions:run.decisions,evidence:[]})
 assert.ok(acceptsNextAction(run,result.action))
 run=chooseUniverseFreeAction(run,result.action,false)
 console.log(JSON.stringify({day:run.currentEvent.day,chosen:action,title:run.currentEvent.title,story:run.currentEvent.story}))
}
assert.equal(run.currentEvent.day,180)
console.log('One real AI journey reached day 180; this is a single smoke check, not a success-rate estimate.')
