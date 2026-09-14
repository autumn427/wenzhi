import { useEffect, useRef, useState } from 'react'
import './experiment-planner.css'

type Status = 'done' | 'skipped'
type Plan = {
  title: string; hypothesis: string; reason: string
  dailyTasks: { day: number; task: string; minutes: number }[]
  successSignal: string; stopRule: string; feedbackQuestion: string
  origin?: { code: string }
}
const labels = ['缩小步骤', '准备材料', '动手尝试', '对照变化', '调整卡点', '获取反馈', '回看取舍']
const headings = ['选一个真实小步骤', '准备必要材料', '动手试一次', '看看发生了什么', '只调整一个卡点', '听一听真实反馈', '回看这七天的取舍']
const prompts = ['写下你的最小步骤和验收信号', '记录开始前的卡点', '记录这次尝试的过程与产物', '记录实际变化和未验证的猜测', '记录卡点与这次调整', '记录一个不符合预期的反馈', '记录获得、代价和下一步决定']

export function ExperimentPlanner({ plan, active, goal, checkins, notes, demo, locked, onStatus, onNote, onCopy, copied }: {
  plan: Plan; active: boolean; goal: string; checkins: Partial<Record<number, Status>>; notes: Record<number, string>
  demo: boolean; locked: boolean; onStatus: (day: number, status: Status) => void
  onNote: (day: number, text: string) => void; onCopy: () => void; copied: boolean
}) {
  const [selected, setSelected] = useState(() => plan.dailyTasks.find(t => !checkins[t.day])?.day ?? 1)
  const task = plan.dailyTasks.find(t => t.day === selected) ?? plan.dailyTasks[0]
  const taskRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => {
      taskRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
      taskRef.current?.querySelector<HTMLElement>('h4')?.focus({ preventScroll: true })
    }, 380)
    return () => window.clearTimeout(timer)
  }, [active])
  const done = plan.dailyTasks.filter(t => checkins[t.day] === 'done').length
  const skipped = plan.dailyTasks.filter(t => checkins[t.day] === 'skipped').length
  const recorded = plan.dailyTasks.filter(t => checkins[t.day]).length
  const status = checkins[task.day]
  const chooseStatus = (value: Status) => {
    onStatus(task.day, value)
    if (status !== value) {
      const next = plan.dailyTasks.find(t => t.day > task.day && !checkins[t.day])
      if (next) setSelected(next.day)
    }
  }
  return <div className="ep-planner">
    <div className="ep-heading">
      <div><span className="ep-tag">七天行动计划</span><h3 id="experiment-title">{plan.title}</h3><p>用一个真实小步骤，验证这条路是否值得继续。</p></div>
      <div className="ep-goal"><span aria-hidden="true">◎</span><p><b>目标：</b>{goal}</p></div>
      <div className="ep-source"><details><summary>▤　模板来源与说明</summary><p>{plan.hypothesis}</p><p>{plan.reason}</p><button type="button" onClick={onCopy}>{copied ? '已复制行动票' : '复制行动票'}</button></details><small>{plan.origin ? '本地行动模板，不代表现实结果或成功承诺。' : '根据路线讨论整理，需在现实中验证。'}</small></div>
    </div>
    <div className="ep-journey">
      <nav className="ep-timeline" aria-label="七天进度">{plan.dailyTasks.map(t => <button key={t.day} type="button" className={`${selected === t.day ? 'is-selected' : ''} ${checkins[t.day] === 'done' ? 'is-recorded' : checkins[t.day] === 'skipped' ? 'is-skipped' : ''}`} aria-current={selected === t.day ? 'step' : undefined} onClick={() => setSelected(t.day)}><span>{String(t.day).padStart(2, '0')}</span><b>{plan.origin ? labels[t.day - 1] : `第${t.day}天`}</b></button>)}</nav>
      <div className="ep-progress" aria-live="polite"><strong>完成 {done} 天</strong><span className="ep-status-counts">跳过 {skipped} 天 · 待记录 {plan.dailyTasks.length - recorded} 天</span><progress max={plan.dailyTasks.length} value={done} aria-label="已完成天数"/><small>进度只表示执行，不代表有效。</small><small>{demo ? '试玩记录仅在本次体验内保留；退出或刷新后重置。' : '记录保存在当前浏览器，便于下次继续。'}</small></div>
    </div>
    <div className="ep-workspace">
      <nav className="ep-day-list" aria-label="选择当天任务">{plan.dailyTasks.map(t => <button key={t.day} type="button" className={selected === t.day ? 'is-selected' : ''} aria-pressed={selected === t.day} onClick={() => setSelected(t.day)}><i className={`ep-file tone-${t.day % 3}`} aria-hidden="true">☰</i><span>{String(t.day).padStart(2, '0')}</span><b>{plan.origin ? labels[t.day - 1] : `第${t.day}天`}</b><small>{t.minutes}分钟</small><em>{checkins[t.day] === 'done' ? '已完成' : checkins[t.day] === 'skipped' ? '已跳过' : selected === t.day ? '◉' : '○'}</em></button>)}</nav>
      <section ref={taskRef} className="ep-task" aria-labelledby="ep-task-title">
        <div className="ep-task-intro"><div><span className="ep-day-tag">DAY {task.day} · {status === 'done' ? '已完成' : status === 'skipped' ? '已跳过' : '待记录'}</span><h4 id="ep-task-title" tabIndex={-1}>{plan.origin ? headings[task.day - 1] : `第 ${task.day} 天的行动`}</h4><p>{task.task}</p><span className="ep-time">◷　预计 {task.minutes} 分钟</span></div><div className="ep-notebook" aria-hidden="true"><i/><i/><b/></div></div>
        <label className="ep-note"><span>{status === 'skipped' ? '记录跳过原因（可选）' : prompts[task.day - 1] ?? '记录今天的观察'}</span><textarea key={task.day} aria-label={`第${task.day}天记录`} value={notes[task.day] ?? ''} onChange={e => onNote(task.day, e.target.value)} maxLength={500} disabled={locked} placeholder={status === 'skipped' ? '例如：材料还没准备好，先缩小任务范围。' : '例如：产物是什么、用了几分钟、哪里仍然卡住。'}/><small>完成后建议留下实际观察；跳过无需证明。仅在本机保留 · {(notes[task.day] ?? '').length}/500</small></label>
        <div className="ep-actions"><button type="button" disabled={locked} aria-pressed={status === 'done'} onClick={() => chooseStatus('done')}>{status === 'done' ? '撤销完成' : '标记完成'}</button><button type="button" disabled={locked} aria-pressed={status === 'skipped'} onClick={() => chooseStatus('skipped')}>{status === 'skipped' ? '撤销跳过' : '跳过今天'}</button></div>
      </section>
    </div>
    <footer className="ep-criteria">{[['▥', '成功信号', plan.successSignal], ['⊘', '停止规则', plan.stopRule], ['◉', '第7天回看', plan.feedbackQuestion]].map(([icon, title, text]) => <div key={title}><span aria-hidden="true">{icon}</span><div><b>{title}</b><p>{text}</p></div></div>)}</footer>
  </div>
}
