import assert from 'node:assert/strict'
import { createUniverseRuns, chooseUniversePath } from '../src/simulation.ts'
import { firstRouteExperiment } from '../src/first-experiment.ts'
import { actionDraftKey, saveLocal, readActionDraft, clearActionDraft, readLastProfile, lastProfileKey } from '../src/journey-recovery.ts'
import { compareEcho } from '../src/echo-context.ts'

const profile={identity:'student',intent:'portfolio',time:'low',sacrifice:'study',confusion:'每周只有两小时，是否继续学习编程？',skills:'文献整理',goal:'做一个文献整理小工具',worries:'挤占课程时间'}
const store=new Map()
const storage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)}
let completed=0
for(const code of ['A','B','C']) for(const choiceIndex of [0,1]) {
 let run=createUniverseRuns(profile)[code]
 assert.equal(firstRouteExperiment(run,profile),null)
 for(let step=0;step<3;step++) {
  const before=JSON.stringify(run)
  const key=actionDraftKey('profile',run,1)
  assert.ok(saveLocal(storage,key,'先整理一份具体的问题记录'))
  assert.equal(readActionDraft(storage,key),'先整理一份具体的问题记录')
  assert.equal(readActionDraft(storage,actionDraftKey('other-profile',run,1)),'')
  assert.equal(readActionDraft(storage,actionDraftKey('profile',{...run,code:code==='A'?'B':'A'},1)),'')
  assert.equal(readActionDraft(storage,actionDraftKey('profile',run,2)),'')
  assert.equal(JSON.stringify(run),before,'draft editing must not change the timeline')
  run=chooseUniversePath(run,run.currentEvent.choices[choiceIndex].id)
  assert.equal(readActionDraft(storage,actionDraftKey('profile',run,1)),'')
  clearActionDraft(storage,key)
  assert.equal(readActionDraft(storage,key),'')
 }
 assert.equal(run.currentEvent.day,180)
 const snapshot=JSON.stringify(run)
 const plan=firstRouteExperiment(run,profile)
 assert.ok(plan);assert.equal(plan.origin.code,code)
 assert.deepEqual(plan.dailyTasks.map(task=>task.day),[1,2,3,4,5,6,7])
 assert.ok(plan.dailyTasks.reduce((sum,task)=>sum+task.minutes,0)<=120)
 assert.ok(plan.hypothesis.includes(run.decisions.at(-1).choiceLabel))
 assert.equal(JSON.stringify(run),snapshot)
 completed++
}
saveLocal(storage,lastProfileKey,profile);assert.deepEqual(readLastProfile(storage,{}),{})
assert.deepEqual(readLastProfile(storage,profile),profile)
storage.setItem(lastProfileKey,'{broken');assert.deepEqual(readLastProfile(storage,profile),profile)
const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('quota')},removeItem(){throw Error('blocked')}}
assert.equal(saveLocal(blocked,'key','draft'),false);assert.equal(readActionDraft(blocked,'key'),'');clearActionDraft(blocked,'key')
const context={code:'A',day:90,route:'系统学习',action:'用两小时完成一个小工具并找人试用',obstacle:'没有用户反馈',profile:''}
const source={title:'经历',excerpt:'我每周只花两小时做一个工具。找朋友试用后得到了反馈。'}
const relation=compareEcho(context,source)
assert.ok(relation.matches.length);assert.ok(relation.matches.every(match=>source.excerpt.includes(match.quote)))
assert.equal(compareEcho(context,{title:'天气',excerpt:'今天阳光明媚。'}).matches.length,0)
assert.ok(compareEcho(context,{title:'天气',excerpt:'今天阳光明媚。'}).summary.includes('暂不据此调整选择'))
console.log(`${completed} preset journeys completed; first-route plans, isolated draft recovery, blocked storage and traceable echo comparisons passed`)
