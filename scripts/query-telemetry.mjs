import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const local = args.includes('--local')
const raw = args.includes('--raw')
const jsonOutput = args.includes('--json')
const daysArg = args.find((arg) => arg.startsWith('--days='))?.slice('--days='.length)
const days = Math.max(1, Math.min(90, Number.parseInt(daysArg || '30', 10) || 30))
const mode = local ? '--local' : '--remote'
const sql = `SELECT metric_date, event_name, route_code, day, device, release, event_count, value_total
FROM telemetry_daily
WHERE metric_date >= date('now', '-${days} day')
ORDER BY metric_date DESC, event_name, route_code, day, device, release;`

// Windows exposes npx through a .cmd shim that spawnSync cannot launch
// directly in the desktop runtime. Build one quoted command line so the SQL
// remains a single --command argument on both Windows and Unix shells.
const sqlArg = sql.replace(/"/g, '\\"').replace(/\r?\n/g, ' ')
const result = spawnSync(`npx wrangler d1 execute wenzhi-contributions ${mode} --command "${sqlArg}" --json`, {
  encoding: 'utf8',
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})

if (result.error) {
  console.error(`无法启动 Wrangler：${result.error.message}`)
  process.exit(1)
}
if (result.status !== 0) {
  process.stderr.write(result.stderr || 'Wrangler 查询失败。\n')
  process.exit(result.status || 1)
}

let payload
try {
  payload = JSON.parse(result.stdout)
} catch {
  console.error('Wrangler 返回的不是 JSON：')
  console.error(result.stdout)
  process.exit(1)
}

const rows = Array.isArray(payload)
  ? payload.flatMap((item) => Array.isArray(item?.results) ? item.results : [])
  : Array.isArray(payload?.results) ? payload.results : []

if (!jsonOutput) console.log(`问枝 telemetry · ${local ? 'local' : 'remote'} · 最近 ${days} 天`)
if (!rows.length) {
  if (jsonOutput) console.log(JSON.stringify({ windowDays: days, mode: local ? 'local' : 'remote', summary: null, routes: [], stages: [], rows: [] }, null, 2))
  else console.log('暂无记录。')
} else {
  const count = (eventName, predicate = () => true) => rows
    .filter((row) => row.event_name === eventName && predicate(row))
    .reduce((total, row) => total + (Number(row.event_count) || 0), 0)
  const routeRows = ['A', 'B', 'C'].map((route_code) => ({
    路线: route_code,
    进入: count('route_enter', (row) => row.route_code === route_code),
    选择: count('choice_made', (row) => row.route_code === route_code),
    来源打开: count('source_open', (row) => row.route_code === route_code),
  }))
  const stageRows = [30, 90, 150, 180].map((day) => ({
    阶段: `第 ${day} 天`,
    选择: count('choice_made', (row) => Number(row.day) === day),
    来源打开: count('source_open', (row) => Number(row.day) === day),
    实时检索: count('live_search_result', (row) => Number(row.day) === day),
  }))
  const summary = {
    sessions: count('session_start'),
    routeEntries: count('route_enter'),
    choices: count('choice_made'),
    journeysCompleted: count('journey_complete'),
    experimentCta: count('experiment_cta'),
    experimentGenerated: count('experiment_generated'),
    liveSearchErrors: count('live_search_error'),
  }
  if (jsonOutput) {
    console.log(JSON.stringify({ windowDays: days, mode: local ? 'local' : 'remote', summary, routes: routeRows, stages: stageRows, rows }, null, 2))
  } else {
    console.table([
      { 指标: '会话开始', 数值: summary.sessions },
      { 指标: '进入路线', 数值: summary.routeEntries },
      { 指标: '做出选择', 数值: summary.choices },
      { 指标: '完成路线', 数值: summary.journeysCompleted },
      { 指标: '七天实验入口', 数值: summary.experimentCta },
      { 指标: '七天实验生成', 数值: summary.experimentGenerated },
      { 指标: '实时检索失败', 数值: summary.liveSearchErrors },
    ])
    console.log('按路线')
    console.table(routeRows)
    console.log('按时间节点')
    console.table(stageRows)
    if (raw) {
      console.log('原始聚合行')
      console.table(rows)
    }
  }
}
