// Explicit opt-in: two synthetic model requests to a local Worker; never reads keys.
import assert from 'node:assert/strict'
import { createGeneratedUniverseRuns, chooseUniverseFreeAction } from '../src/simulation.ts'
import { acceptsNextAction, normalizedAction } from '../src/action-submission.ts'
if (!process.argv.includes('--run')) throw new Error('Pass --run to make two synthetic local model calls.')
const profile={identity:'student',intent:'efficiency',time:'low',sacrifice:'study',confusion:'一个小工具报错，今晚只有30分钟',skills:'刚开始学习代码',goal:'保留一份能继续排查的问题记录',worries:'不挤占课程和休息'}
const opening={title:'今晚三十分钟先用在哪里',story:'小工具遇到一个报错。今晚留出三十分钟，包括准备、操作和记录，到点就停，不挤占课程和休息。原因还没有查清，也没有其他人反馈。',tension:'先缩小问题还是让AI提出一处修改再核对',choices:[{label:'用三十分钟复现报错，只查一个必要知识点',tradeoff:'暂不修改代码，留下输入和待核对线索，不保证修好'},{label:'用三十分钟让AI提议一处修改，再逐项核对',tradeoff:'保留原版，核对建议，不保证修改有效'}]}
const routes=['A','B','C'].map(code=>({code,title:'处理一个具体报错',premise:'在现有三十分钟内处理一个报错，保存输入、原版与核对记录，不扩大任务。',opening}))
const base=createGeneratedUniverseRuns(profile,routes,'relay-ai').A
const before=JSON.stringify(base),results=[]
for(const choice of base.currentEvent.choices){
 const request={action:choice.label,comparisonPreview:true,allowThirdPartyFallback:false,mode:'full',universeCode:'A',profile,route:{title:base.route.title,premise:base.route.premise},decisions:base.decisions,event:base.currentEvent,evidence:[]}
 const response=await fetch('http://127.0.0.1:8787/api/simulation/free-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(60000)})
 const data=await response.json()
 assert.ok(response.ok && data.action,`Request failed: ${response.status} ${data.error?.code ?? 'missing action'}`)
 assert.ok(acceptsNextAction(base,data.action))
 assert.equal(normalizedAction(data.action.actionLabel),normalizedAction(choice.label))
 const next=chooseUniverseFreeAction(base,data.action)
 assert.deepEqual(next.decisions[0].stateBefore,base.state)
 assert.equal(JSON.stringify(base),before)
 results.push(next.currentEvent.story)
 console.log(JSON.stringify({choice:choice.label,status:response.status,source:data.action.source,plannedMinutes:data.action.plannedMinutes,story:next.currentEvent.story,cost:data.action.immediateCost,remaining:data.action.observableChange}))
}
assert.notEqual(results[0],results[1])
console.log('Two live synthetic branches passed schema, action identity and original-state preservation; narrative quality still needs human review.')
