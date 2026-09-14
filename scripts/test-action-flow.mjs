import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { normalizedAction, acceptsNextAction } from '../src/action-submission.ts'
import { narrativeViolation } from '../worker/action-constraints.ts'
assert.equal(narrativeViolation('整理记录','study',['原本可做的课业被暂缓'],[]),'AI_PROTECTED_BOUNDARY_VIOLATION')
assert.equal(narrativeViolation('整理记录','study',['课程不会被暂缓'],[]),null)
const bundle = await build({entryPoints:['worker/index.ts'],bundle:true,platform:'node',format:'esm',write:false})
const {default:worker} = await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const request = () => new Request('https://wenzhi.test/api/simulation/free-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'整理一份问题记录',universeCode:'A',mode:'full',profile:{time:'low',sacrifice:'study'},event:{day:30,title:'整理问题',story:'你正在整理一份资料，还不知道问题在哪里。',tension:'先整理问题还是先做一份记录',choices:[{id:'one',label:'整理一份问题记录',tradeoff:'需要投入一些时间'},{id:'two',label:'核对一处问题线索',tradeoff:'需要核对记录中的信息'}]},decisions:[]})})
const valid={targetDay:90,plannedMinutes:30,baseChoiceId:'one',tradeoff:'用三十分钟整理，其他可选任务暂缓',assumption:'问题原因仍然需要核对',immediateCost:'投入三十分钟整理记录',observableChange:'这份记录能否说明问题所在？',causalChain:['整理问题记录','留下有限线索','还不能确认问题原因'],sourceInfluence:'没有使用外部来源',delta:{technicalSkill:0,energy:0},deltaEvidence:{},title:'记录摆在桌面',story:'第90天，回看这次整理的问题记录，原因还没有确认。纸面列出了待核对的问题，其他可选事项暂缓。你仍需要决定先核对哪一处线索。',tension:'先核对一处线索还是请别人看看',nextChoices:[{label:'先核对其中一处线索',tradeoff:'需要投入核对时间',minutes:30},{label:'请同伴查看这份记录',tradeoff:'需要投入沟通时间',minutes:30}],evidenceRefs:[]}
const env={OPENAI_NEXT_API_KEY:'synthetic-test-key',OPENAI_NEXT_MODEL:'test',AI_RATE_LIMITER:{limit:async()=>({success:true})}}
const saved=globalThis.fetch
let calls=0
async function run(sequence){calls=0;globalThis.fetch=async()=>{const content=sequence[Math.min(calls++,sequence.length-1)];return Response.json({choices:[{message:{content:typeof content==='string'?content:JSON.stringify(content)},finish_reason:'stop'}]})}; const response=await worker.fetch(request(),env,{});return {status:response.status,data:await response.json()}}
try{
 let result=await run([valid]);assert.ok(result.data.action,JSON.stringify(result));assert.equal(result.status,200,JSON.stringify(result));assert.equal(calls,1)
 result=await run(['not json',valid]);assert.equal(result.status,200,JSON.stringify(result));assert.equal(calls,2)
 result=await run([{...valid,nextChoices:[{...valid.nextChoices[0],label:'整理一份问题记录'},valid.nextChoices[1]]},valid]);assert.equal(result.status,200,JSON.stringify(result));assert.equal(calls,2);assert.notEqual(result.data.action.nextChoices[0].label,'整理一份问题记录')
 result=await run(['not json']);assert.equal(result.status,502);assert.equal(calls,2);assert.equal(result.data.action,undefined)
 result=await run([{...valid,plannedMinutes:121}]);assert.equal(result.status,502);assert.equal(calls,1)
 const brokenScore={...valid,delta:{technicalSkill:3,energy:0},deltaEvidence:{technicalSkill:{actionQuote:'整理一份问题记录',outcomeQuote:'这段引文不在正文中',reason:'记录带来可观察的学习'}}}
 result=await run([brokenScore,{delta:{technicalSkill:0,energy:0},deltaEvidence:{}}]);assert.equal(result.status,200,JSON.stringify(result));assert.equal(calls,2);assert.equal(result.data.action.narrative.story,valid.story);assert.equal(result.data.action.delta.technicalSkill,0)
 result=await run([brokenScore,{delta:{technicalSkill:0,energy:0},deltaEvidence:{},story:'为加分编造的故事'}]);assert.equal(result.status,502);assert.equal(calls,2);assert.equal(result.data.action,undefined)
 result=await run([brokenScore,{delta:brokenScore.delta,deltaEvidence:brokenScore.deltaEvidence}]);assert.equal(result.status,502);assert.equal(calls,2)
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify(brokenScore)},finish_reason:'stop'}]})
 const previewBody=await request().json()
 const preview=await worker.fetch(new Request('https://wenzhi.test/api/simulation/free-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...previewBody,comparisonPreview:true})}),env,{})
 const previewData=await preview.json()
 assert.equal(preview.status,200,JSON.stringify(previewData));assert.deepEqual(previewData.action.delta,{technicalSkill:0,energy:0});assert.equal(previewData.action.narrative.story,valid.story)
 assert.equal(normalizedAction(' 整理一份问题记录。'),normalizedAction('整理一份问题记录'))
 const runState={currentEvent:{day:30}}
 const action={...valid,narrative:{title:valid.title,story:valid.story,tension:valid.tension}}
 assert.ok(acceptsNextAction(runState,action));assert.equal(acceptsNextAction(runState,{...action,targetDay:150}),false);assert.equal(acceptsNextAction(runState,{...action,nextChoices:[]}),false)
 assert.equal(acceptsNextAction(runState,{...action,delta:{}}),false);assert.equal(acceptsNextAction(runState,{...action,delta:{technicalSkill:999,energy:0}}),false)
 console.log('Action submission and bounded repair checks passed')
}finally{globalThis.fetch=saved}

