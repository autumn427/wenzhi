import assert from 'node:assert/strict'
import { experimentEvidence } from '../src/experiment-evidence.ts'
import { firstRouteExperiment } from '../src/first-experiment.ts'
const base={checkins:Object.fromEntries(Array.from({length:7},(_,i)=>[i+1,'skipped'])),notes:{},result:'strong',signalObserved:true,answer:'我确实试过，但是没有留下任何记录。'}
assert.equal(experimentEvidence(base).ready,false,'all skipped must not imply success')
base.checkins[1]='done'
assert.equal(experimentEvidence(base).ready,false,'clicks alone are insufficient')
base.notes[1]='用三篇文献检查五个字段，发现两处遗漏，共花了九分钟。'
assert.equal(experimentEvidence(base).ready,true)
assert.equal(experimentEvidence({...base,signalObserved:false}).ready,false)
assert.equal(experimentEvidence({...base,result:'weak',signalObserved:false}).ready,true,'negative observations are useful too')
assert.equal(experimentEvidence({...base,notes:{2:'这一条只是跳过原因，不能当作已执行的观察'}}).ready,false)
const run={code:'A',currentEvent:{day:180,title:'样例完成'},decisions:[{choiceLabel:'借助 AI 先做原型',tradeoff:'需要检查错误'}]}
const profile={goal:'做一个文献整理小工具'}
const ai=firstRouteExperiment(run,profile)
assert.ok(ai.dailyTasks[1].task.includes('三篇已有文献'))
assert.ok(ai.dailyTasks[1].task.includes('五个字段'))
assert.ok(ai.dailyTasks[2].task.includes('用 AI 草拟'))
const own=firstRouteExperiment({...run,decisions:[{choiceLabel:'补齐基础再重做'}]},profile)
assert.notEqual(ai.dailyTasks[2].task,own.dailyTasks[2].task)
const notes=firstRouteExperiment(run,{goal:'整理可复用的读书笔记'})
assert.ok(notes.dailyTasks[1].task.includes('四个栏目'))
assert.ok(!notes.dailyTasks[1].task.includes('三篇已有文献'))
const generic=firstRouteExperiment(run,{goal:'完成一幅水彩画'})
assert.ok(generic.dailyTasks[1].task.includes('完成一幅水彩画'))
assert.equal(ai.dailyTasks.reduce((sum,t)=>sum+t.minutes,0),90)
console.log('Contextual goals, choice-dependent methods, negative evidence and no-evidence gates passed')
