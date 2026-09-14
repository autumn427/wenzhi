import assert from 'node:assert/strict'
import { echoQuery, echoIdentity } from '../src/echo-context.ts'
const base = {code:'A',route:'系统学习',day:30,action:'先完成一个小作品',obstacle:'只有两小时且缺少反馈',profile:'研究生背景'.repeat(50)}
assert.ok(echoQuery(base).length <=120)
assert.ok(echoQuery(base).startsWith(base.action))
assert.ok(echoQuery(base).includes(base.obstacle))
assert.notEqual(echoIdentity(base),echoIdentity({...base,code:'C'}))
assert.notEqual(echoIdentity(base),echoIdentity({...base,action:'先找一个真实使用者'}))
assert.notEqual(echoIdentity(base),echoIdentity({...base,obstacle:'需要保护材料隐私'}))
assert.notEqual(echoIdentity(base),echoIdentity({...base,route:'专业深耕'}))
const original=JSON.stringify(base)
echoIdentity(base); echoQuery(base)
assert.equal(JSON.stringify(base),original)
console.log('8 echo context checks passed')
