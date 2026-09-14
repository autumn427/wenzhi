import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowUpRight, GitBranch, X } from '@phosphor-icons/react'
import type { UniverseRun } from './simulation'
import type { ForkSource } from './fork-comparison'
import { JourneyTickets } from './JourneyDetails'
import './journey-map.css'

const days = [30, 90, 150, 180] as const
const points = [{ x: 12, y: 70 }, { x: 36, y: 52 }, { x: 64, y: 66 }, { x: 89, y: 43 }]
const branchPoints = [{ x: 23, y: 23 }, { x: 47, y: 29 }, { x: 77, y: 20 }]

export function JourneyMap({ run, sources }: { run: UniverseRun; sources: ForkSource[] }) {
  const [selected, setSelected] = useState<{ day: number; branch: boolean } | null>(null)
  const [archive, setArchive] = useState<Record<string, ForkSource>>({})
  const canvas = useRef<HTMLCanvasElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const currentIndex = days.indexOf(run.currentEvent.day)
  const ink = { A: '#287dcc', B: '#aa762d', C: '#4f8968' }[run.code]
  useEffect(() => { setArchive(old => ({ ...old, ...Object.fromEntries(sources.map(s => [s.id, s])) })) }, [sources])
  useEffect(() => { setSelected(null) }, [run.currentEvent.id])
  useEffect(() => {
    const el = scroll.current; if (!el) return
    const center = () => { el.scrollLeft = Math.max(0, el.scrollWidth * points[currentIndex].x / 100 - el.clientWidth / 2) }
    const observer = new ResizeObserver(center); observer.observe(el); center()
    return () => observer.disconnect()
  }, [currentIndex])
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const draw = () => {
      const box = el.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
      el.width = box.width * dpr; el.height = box.height * dpr
      const ctx = el.getContext('2d'); if (!ctx) return
      ctx.scale(dpr, dpr)
      const line = (a: {x: number; y: number}, b: {x: number; y: number}, color: string, dashed = false, branch = false) => {
        const dx = b.x - a.x
        // Stable bends keep the map organic without moving its clickable nodes.
        const c1 = branch ? { x: a.x - 3, y: a.y - 16 } : { x: a.x + dx * .45, y: a.y + 10 }
        const c2 = branch ? { x: b.x + 3, y: b.y + 17 } : { x: b.x - dx * .4, y: b.y - 10 }
        ctx.beginPath(); ctx.moveTo(a.x * box.width / 100, a.y * box.height / 100)
        ctx.bezierCurveTo(c1.x * box.width / 100, c1.y * box.height / 100, c2.x * box.width / 100, c2.y * box.height / 100, b.x * box.width / 100, b.y * box.height / 100)
        ctx.strokeStyle = color; ctx.lineWidth = dashed ? 2 : 5; ctx.lineCap = 'round'; ctx.setLineDash(dashed ? [5, 7] : []); ctx.stroke()
      }
      points.slice(1).forEach((p, i) => line(points[i], p, i < currentIndex ? ink : '#cdbfa8', i >= currentIndex))
      run.decisions.forEach(d => {
        const i = days.indexOf(d.day)
        if (d.eventSnapshot?.choices.some(c => c.id !== d.choiceId)) line(points[i], branchPoints[i], '#b6a78d', true, true)
      })
    }
    const observer = new ResizeObserver(draw); observer.observe(el); draw()
    return () => observer.disconnect()
  }, [run.decisions, currentIndex, ink])
  const decision = run.decisions.find(d => d.day === selected?.day)
  const event = decision?.eventSnapshot ?? (selected?.day === run.currentEvent.day ? run.currentEvent : undefined)
  const sourceIds = decision?.evidenceIds ?? event?.evidenceIds ?? []
  const matched = [...new Set(sourceIds)].map(id => archive[id] ?? sources.find(s => s.id === id)).filter((s): s is ForkSource => Boolean(s))
  const alternatives = decision?.eventSnapshot?.choices.filter(c => c.id !== decision.choiceId) ?? []
  return <section className="journey-map" aria-label="我的树状路径地图" style={{ '--map-ink': ink } as CSSProperties}>
    <header className="journey-map-heading"><div><GitBranch size={23} /><h3>走过的路，留在这里</h3></div><span>第 {run.currentEvent.day} 天 · {run.decisions.length} 次选择</span></header>
    <div className="journey-map-scroll" ref={scroll} tabIndex={0} role="group" aria-label="路径地图，小屏可左右滑动">
      <div className="journey-map-board">
        <img className="journey-map-paper" src="/assets/galgame/journey-map-paper.png" alt="" loading="lazy" />
        <canvas ref={canvas} aria-hidden="true" />
        {days.map((day, i) => {
          const reached = day <= run.currentEvent.day
          return <div key={day} className="journey-map-stop" style={{ left: `${points[i].x}%`, top: `${points[i].y}%` }}>
            {day === run.currentEvent.day && <picture className="journey-map-kanshan"><source media="(prefers-reduced-motion: reduce)" srcSet="/assets/galgame/kanshan-wave-still.png" /><img src="/kanshan-wave.gif" alt={`刘看山目前在第${day}天`} /></picture>}
            <button type="button" className={`journey-map-node ${reached ? 'is-reached' : ''}`} disabled={!reached} aria-current={day === run.currentEvent.day ? 'step' : undefined} aria-pressed={selected?.day === day && !selected.branch} aria-label={`第${day}天 · ${day === run.currentEvent.day ? '当前位置' : reached ? '查看选择票根' : '尚未到达'}`} onClick={() => setSelected({ day, branch: false })}>{String(i + 1).padStart(2, '0')}</button>
            <span>第 {day} 天</span><small>{day === run.currentEvent.day ? '你在这里' : reached ? '已走过' : '待展开'}</small>
          </div>
        })}
        {run.decisions.map(d => d.eventSnapshot?.choices.some(c => c.id !== d.choiceId) && <button key={d.eventId} className="journey-map-branch" type="button" style={{ left: `${branchPoints[days.indexOf(d.day)].x}%`, top: `${branchPoints[days.indexOf(d.day)].y}%` }} onClick={() => setSelected({ day: d.day, branch: true })} aria-pressed={selected?.day === d.day && selected.branch}>第 {d.day} 天<br /><small>未走的分支</small></button>)}
      </div>
    </div>
    <p className="journey-map-legend">实线是走过的路，虚线留给未展开的可能。点击节点，展开票根。</p>
    {selected && <div className="journey-map-detail" aria-live="polite">
      <header><h4>第 {selected.day} 天 · {selected.branch ? '另一种选择' : decision ? '选择票根' : '当前位置'}</h4><button type="button" aria-label="收起节点详情" onClick={() => setSelected(null)}><X size={20} /></button></header>
      <div className="journey-map-detail-grid">
        <div>
          {selected.branch ? <article className="journey-map-alternative"><small>当时没有选择这条路</small><h5>{decision?.eventTitle}</h5>{alternatives.map(c => <div key={c.id}><strong>{c.label}</strong><p>{c.tradeoff}</p></div>)}<small>这里没有发生过的后续记录。</small></article>
            : decision ? <JourneyTickets run={{ ...run, decisions: [decision] }} startIndex={run.decisions.indexOf(decision)} />
              : <article className="journey-map-alternative"><h5>{run.currentEvent.title}</h5><p>{run.currentEvent.story}</p><small>{run.currentEvent.day === 180 ? '这段路已走完。' : '这一幕还没有确认选择。'}</small></article>}
        </div>
        <aside className="journey-map-sources" aria-label="该节点的知乎参照">
          <div className="journey-map-source-brand"><img src="/zhihu-logo.svg" alt="知乎" /><span>这一刻的现实参照</span></div>
          {matched.length ? matched.map(source => <article key={source.id}>
            <div className="journey-map-author">{source.avatarUrl && /^https:\/\/[^/]+\.zhimg\.com\//.test(source.avatarUrl) && <img src={source.avatarUrl} alt="" referrerPolicy="no-referrer" />}<span>{source.author}</span></div>
            <a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={16} /></a><p>{source.excerpt}</p><small>{typeof source.votes === 'number' ? `${source.votes.toLocaleString('zh-CN')} 赞同` : '赞同数未提供'}</small>
          </article>) : <p>这一步没有保存可对应的知乎参照。</p>}
        </aside>
      </div>
    </div>}
  </section>
}
