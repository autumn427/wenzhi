import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createUniverseRuns, chooseUniversePath, refreshCampusGrowth } from '../src/simulation.ts'
const bundle = await build({ entryPoints: ['src/fork-comparison.ts'], bundle: true, write: false, format: 'esm', platform: 'node' })
const { forkIdentity, keepForkResult, readForkRecord, pickForkSource } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const profile = { identity:'student', intent:'efficiency', time:'low', sacrifice:'study', confusion:'报错没有解决', skills:'刚开始学习', goal:'做一个小工具', worries:'不能影响课程' }
const runs = createUniverseRuns(profile)
assert.deepEqual(runs.A.state,runs.B.state)
assert.deepEqual(runs.B.state,runs.C.state)
assert.equal(runs.A.state.weeklyHours,2,'a route must not increase the time budget')
const base=runs.A, original=JSON.stringify(base), identity=forkIdentity(base,profile,1)
let record={version:1,identity,source:null,results:[]}
for(const choice of base.currentEvent.choices){
 const next=chooseUniversePath(base,choice.id)
 const result={choiceId:choice.id,action:choice.label,run:next,cost:choice.tradeoff,remaining:next.currentEvent.tension,sourceIds:[]}
 record=keepForkResult(record,base,result)
 assert.deepEqual(next.decisions[0].stateBefore,base.state)
 assert.deepEqual(next.decisions[0].eventSnapshot,base.currentEvent)
 assert.equal(next.decisions.length,1)
 assert.equal(next.currentEvent.day,90)
 assert.ok(next.currentEvent.story.includes(choice.id === 'a-take-shift' ? '提前交了两页作业' : '拒绝了补班'))
 assert.ok(next.currentEvent.story.includes('第90天'))
 assert.deepEqual(next.decisions[0].delta,choice.delta)
 assert.ok(['technicalSkill','aiCollaboration','domainDepth','portfolio','opportunity'].every(key=>Math.abs(choice.delta[key]??0)>=6),'campus steps should visibly change practical skills over the intervening weeks')
}
assert.equal(JSON.stringify(base),original,'preview must not mutate the original timeline')
assert.notEqual(record.results[0].run.currentEvent.story,record.results[1].run.currentEvent.story)
assert.deepEqual(keepForkResult(record,base,record.results[0]),record,'successful branch must not be replaced on retry')
assert.deepEqual(readForkRecord(JSON.stringify(record),identity,base),record,'refresh restores both results')
assert.equal(readForkRecord(JSON.stringify(record),forkIdentity(base,profile,2),base),null)
assert.equal(readForkRecord(JSON.stringify(record),forkIdentity(base,{...profile,time:'deep'},1),base),null)
assert.equal(readForkRecord('{broken',identity,base),null)
const changed=structuredClone(record.results[0]); changed.run.decisions[0].stateBefore.energy=1
assert.throws(()=>keepForkResult(record,base,changed))
const wrong=structuredClone(record);wrong.results[1].run.decisions.push(wrong.results[0].run.decisions[0])
assert.equal(readForkRecord(JSON.stringify(wrong),identity,base),null)
const context={code:'A',day:30,route:'系统学习',action:'核对AI给出的代码',obstacle:'编程报错',profile:''}
const source={id:'one',title:'一次编程记录',author:'示例作者',excerpt:'我用AI整理报错，再核对代码。',sourceUrl:'https://www.zhihu.com/question/1/answer/2',relevanceScore:.5}
assert.equal(pickForkSource([source],context)?.id,'one')
assert.equal(pickForkSource([{...source,sourceUrl:'javascript:alert(1)'}],context),null)
assert.equal(pickForkSource([{...source,title:'天气',excerpt:'今天下雨了。'}],context),null)
assert.equal(pickForkSource([{...source,relevanceScore:.01}],context),null)
assert.equal(pickForkSource([source,{...source,id:'duplicate',sourceUrl:source.sourceUrl+'?utm=1'}],context)?.id,'one')
console.log('Fork comparison passed: equal starting budgets, independent previews, fixed results, safe restoration, source matching and immutable original route.')

// Every chapter now uses the same galgame preview. Validate later branches and
// the ending, including restoration, without allowing chapters to be skipped.
let endings = 0
function checkChapter(chapter) {
 if (chapter.currentEvent.day === 180) { endings++; return }
 const original = JSON.stringify(chapter)
 const id = forkIdentity(chapter,profile,1)
 let saved = {version:1,identity:id,source:null,results:[]}
 for (const choice of chapter.currentEvent.choices) {
  const next = chooseUniversePath(chapter,choice.id)
  const result = {choiceId:choice.id,action:choice.label,run:next,cost:choice.tradeoff,remaining:next.currentEvent.tension,sourceIds:[]}
  saved = keepForkResult(saved,chapter,result)
  assert.deepEqual(readForkRecord(JSON.stringify(saved),id,chapter),saved)
  const skipped = structuredClone(result)
  skipped.run.currentEvent.day = chapter.currentEvent.day
  assert.throws(()=>keepForkResult(saved,chapter,skipped),'a preview must advance exactly one chapter')
  checkChapter(next)
 }
 assert.equal(JSON.stringify(chapter),original,'later previews must preserve the input history')
}
Object.values(runs).forEach(checkChapter)
assert.equal(endings,24)
console.log('All 24 galgame paths passed: chapter 30 → 90 → 150 → 180, preview restoration and no chapter skipping.')

// Existing preset progress is rebased consistently, without replaying choices.
let campusRun=createUniverseRuns(profile).C
while(campusRun.currentEvent.day<180) campusRun=chooseUniversePath(campusRun,campusRun.currentEvent.choices[1].id)
const old=structuredClone(campusRun)
let oldState={...old.decisions[0].stateBefore}
for(const d of old.decisions){d.stateBefore={...oldState};d.delta={energy:d.delta.energy,confidence:d.delta.confidence??0};oldState={...oldState,confidence:oldState.confidence+d.delta.confidence,energy:Math.max(0,Math.min(100,oldState.energy+d.delta.energy)),day:d.day};d.stateAfter={...oldState}}
old.state={...oldState,day:180}
const rebased=refreshCampusGrowth(old)
assert.deepEqual(rebased.state,campusRun.state)
assert.deepEqual(refreshCampusGrowth(rebased),rebased,'migration must be idempotent')
assert.deepEqual(rebased.decisions.map(d=>d.choiceId),old.decisions.map(d=>d.choiceId))
for(let i=1;i<rebased.decisions.length;i++) assert.deepEqual(rebased.decisions[i].stateBefore,rebased.decisions[i-1].stateAfter)
assert.ok(rebased.state.domainDepth<=100)
assert.equal(refreshCampusGrowth({...old,route:{title:'custom'}}).state,old.state,'generated routes stay untouched')
console.log('Campus growth migration passed: snapshots, clamping, idempotence, choices and custom isolation.')
