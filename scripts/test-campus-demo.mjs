import assert from 'node:assert/strict'
import fs from 'node:fs'
import { campusProfile, campusOpening } from '../src/campus-demo.ts'
import { createUniverseRuns, chooseUniversePath, chooseUniversePathQuick, createGeneratedUniverseRuns } from '../src/simulation.ts'
import { firstRouteExperiment } from '../src/first-experiment.ts'
import { campusComparisonExperiment } from '../src/campus-experiment.ts'
import { compareEcho } from '../src/echo-context.ts'

const sources = JSON.parse(fs.readFileSync(new URL('../research/campus-demo-sources.json', import.meta.url))).items
const sourceById = new Map(sources.map(item => [item.id, item]))
assert.equal(campusOpening.title, '周四晚上，三条消息同时来了。')
const oldTopic = /系统学习|AI协作|专业深耕|编程|报错|原型|调试/
const endings = new Set()
let paths = 0
for (const code of ['A', 'B', 'C']) {
  for (let bits = 0; bits < 8; bits++) {
    let run = createUniverseRuns(campusProfile)[code]
    for (let step = 0; step < 3; step++) {
      const event = run.currentEvent
      assert.equal(event.day, [30, 90, 150][step])
      assert.equal(event.choices.length, 2)
      assert.ok(!oldTopic.test(JSON.stringify(event)), event.title)
      for (const id of event.evidenceIds) {
        const source = sourceById.get(id)
        assert.ok(source, `Missing source: ${id}`)
        assert.ok(/^https:\/\/(www|zhuanlan)\.zhihu\.com\//.test(source.sourceUrl))
      }
      const snapshot = JSON.stringify(run)
      const selected = event.choices[(bits >> step) & 1]
      const next = chooseUniversePath(run, selected.id)
      assert.equal(JSON.stringify(run), snapshot, 'preview must not mutate the starting point')
      assert.equal(next.decisions.length, step + 1)
      assert.equal(next.decisions[step].choiceLabel, selected.label)
      run = next
    }
    assert.equal(run.currentEvent.day, 180)
    assert.equal(run.currentEvent.choices.length, 0)
    assert.ok(!oldTopic.test(run.currentEvent.story))
    endings.add(run.currentEvent.story)
    const plan = firstRouteExperiment(run, campusProfile)
    assert.ok(plan.hypothesis.includes(run.decisions[2].choiceLabel))
    assert.equal(plan.dailyTasks.length, 7)
    assert.equal(plan.dailyTasks.reduce((total, task) => total + task.minutes, 0), 90)
    assert.ok(!oldTopic.test(JSON.stringify(plan)))
    paths++
  }
  const initial = createUniverseRuns(campusProfile)[code]
  for (const choice of initial.currentEvent.choices) {
    assert.equal(chooseUniversePathQuick(initial, choice.id).currentEvent.day, 180)
  }
  assert.ok(initial.currentEvent.evidenceIds.some(id => compareEcho({ code, route: '', action: '', obstacle: initial.currentEvent.tension, profile: campusProfile.confusion }, sourceById.get(id)).matches.length))
}
assert.equal(endings.size, 24, 'each combination must retain its own causal history')
assert.equal(campusComparisonExperiment().dailyTasks.reduce((n, task) => n + task.minutes, 0), 90)
// A newly generated route must retain its own premise and opening.
const route = { code: 'A', title: '准备考研', premise: '晚间复习', opening: { title: '复习计划', story: '教材还有两章', tension: '先复习哪章', choices: [{ label: '复习第一章', tradeoff: '第二章稍后' }, { label: '复习第二章', tradeoff: '第一章稍后' }] } }
const generated = createGeneratedUniverseRuns(campusProfile, [route], 'relay-ai').A
assert.equal(generated.currentEvent.title, route.opening.title)
assert.equal(generated.route.title, route.title)
assert.equal(generated.currentEvent.generationSource, 'relay-ai')
console.log(`${paths} campus paths, 24 distinct histories, six quick continuations, source references and seven-day plans passed`)
