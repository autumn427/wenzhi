import { campusOpening } from './campus-demo'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, Check } from '@phosphor-icons/react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { UniverseCode } from './simulation'
import './story-journey.css'

const worlds = [
  { code: 'A' as const, title: '去店里兼职', note: '校门口的兼职小店', tone: '#315f80' },
  { code: 'B' as const, title: '投第一份实习', note: '第一份实习', tone: '#aa762d' },
  { code: 'C' as const, title: '和朋友摆市集', note: '和朋友一起的校园市集', tone: '#486c52' },
]

/** A small Liu Kanshan paper figure that walks between timeline stations. */
export function EventProgress({ code, activeDay, stages, labels }: {
  code: UniverseCode
  activeDay: number
  stages: readonly number[]
  labels: Record<number, string>
}) {
  const previousStage = useRef(`${code}:${activeDay}`)
  const roadId = useId().replace(/:/g, '')
  const [moving, setMoving] = useState(false)
  useEffect(() => {
    const stage = `${code}:${activeDay}`
    if (previousStage.current === stage) return
    previousStage.current = stage
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMoving(false)
      return
    }
    setMoving(true)
    const timer = window.setTimeout(() => setMoving(false), 1200)
    return () => window.clearTimeout(timer)
  }, [code, activeDay])
  const activeIndex = Math.max(0, stages.findIndex((value) => value === activeDay))
  // The road, stations and mascot share these anchors, so they stay aligned
  // when the viewport changes or a different route resumes its saved day.
  const anchors = [{ x: 120, y: 46 }, { x: 348, y: 42 }, { x: 600, y: 44 }, { x: 912, y: 44 }]
  const stationStyle = (index: number) => ({
    '--station-x': `${anchors[index].x / 12}%`,
    '--station-y': `${anchors[index].y}px`,
  } as CSSProperties)
  const road = 'M -20 26 C 60 16 66 58 120 46 C 196 39 284 34 348 42 C 440 52 527 36 600 44 C 716 58 819 26 912 44 C 1010 59 1140 8 1220 22'
  const traveled = 'M 120 46 C 196 39 284 34 348 42 C 440 52 527 36 600 44 C 716 58 819 26 912 44'
  return <div className={`paper-road ${moving ? 'is-moving' : 'is-still'}`}>
    <svg className="paper-road-art" viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${roadId}-paper`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffdf5" /><stop offset="1" stopColor="#ebe1d0" />
        </linearGradient>
        <filter id={`${roadId}-shadow`} x="-10%" y="-100%" width="120%" height="400%">
          <feDropShadow dx="0" dy="6" stdDeviation="3" floodColor="#8b7659" floodOpacity=".2" />
        </filter>
        <clipPath id={`${roadId}-traveled`}><rect x="120" y="0" width={Math.max(0, anchors[activeIndex].x - 120)} height="80" /></clipPath>
      </defs>
      <path d={road} fill="none" stroke={`url(#${roadId}-paper)`} strokeWidth="23" filter={`url(#${roadId}-shadow)`} />
      <path d={road} fill="none" stroke="#fffdf7" strokeWidth="1.8" transform="translate(0 -10)" />
      <path d={traveled} fill="none" stroke="currentColor" strokeWidth="3" opacity=".7" clipPath={`url(#${roadId}-traveled)`} />
    </svg>
    <ol className="paper-road-stations" aria-label={`宇宙 ${code} 的 180 天进度`}>
      {stages.map((day, index) => {
        const status = activeDay === day ? '当前' : activeDay > day ? '已完成' : '待到达'
        return <li className={`paper-road-station ${status === '当前' ? 'is-current' : status === '已完成' ? 'is-done' : ''}`} style={stationStyle(index)} aria-current={status === '当前' ? 'step' : undefined} key={day}>
          <span className="paper-road-node" aria-hidden="true" />
          <strong>第 {day} 天</strong><small>{labels[day] ?? ''}<span className="paper-road-status">{status}</span></small>
        </li>
      })}
    </ol>
    <picture className="paper-road-mascot" style={stationStyle(activeIndex)} aria-hidden="true">
      <source media="(prefers-reduced-motion: reduce)" srcSet="/wayfinding/kanshan-rest.webp" />
      <img src={moving ? '/kanshan-stroll.gif' : '/kanshan-idle.gif'} alt="" draggable={false} />
    </picture>
  </div>
}

const storyStages: Record<30 | 90 | 150, { label: string; note: string }> = {
  30: { label: '起步', note: '先把选择落到一件能留下反馈的小事' },
  90: { label: '第一次分岔', note: '回看行动留下的线索，再决定如何继续' },
  150: { label: '边界测试', note: '面对尚未解决的问题，决定下一步投入' },
}
const stageArtwork: Record<UniverseCode, Partial<Record<30 | 90 | 150, string>>> = {
  A: { 30: '/career-universe-a-full.webp', 90: '/career-scene-a-90-coherent-q78.webp', 150: '/career-scene-a-150-coherent-q78.webp' },
  B: { 30: '/career-universe-b-full.webp', 90: '/career-scene-b-90-coherent-q78.webp', 150: '/career-scene-b-150-coherent-q78.webp' },
  C: { 30: '/career-universe-c-full.webp', 90: '/career-scene-c-90-coherent-q78.webp', 150: '/career-scene-c-150-coherent-q78.webp' },
}
export function UniverseDoors({ onEnter, complete, routes, opening }: { opening?: typeof campusOpening; routes?: {code: UniverseCode; title: string; choice: string; fit?: string}[]; onEnter: (index: number) => void; complete: UniverseCode[] }) {
  const root = useRef<HTMLElement>(null)
  const [entering, setEntering] = useState<number | null>(null)
  useGSAP(() => {
    if (entering === null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onEnter(entering); return }
    const buttons = root.current?.querySelectorAll('.universe-door-grid > button')
    if (!buttons) return
    const timeline = gsap.timeline({ onComplete: () => onEnter(entering) })
    buttons.forEach((button, index) => {
      timeline.to(button, { opacity: index === entering ? 1 : 0, scale: index === entering ? 1.06 : .94, duration: .5, ease: 'power2.inOut' }, 0)
    })
    timeline.to(buttons[entering].querySelector('img'), { scale: 1.25, duration: .65, ease: 'power2.inOut' }, 0)
  }, { scope: root, dependencies: [entering], revertOnUpdate: true })
  return <section ref={root} className="universe-doors" aria-label="选择一条路进入故事">
    <h2>{opening?.title ?? '这一次，走哪条路？'}</h2>
    <p className="universe-doors-lede">{opening ? <>{opening.story}<br />{opening.tension}<br /><strong>{opening.question}</strong></> : '先选一条愿意试走的路，接下来会看到 180 天后的取舍。'}</p>
    <div className="universe-door-grid">{worlds.map((base, index) => { const route=routes?.find(r=>r.code===base.code); const world={...base,title:route?.title??base.title}; return <button key={world.code} disabled={entering !== null} onClick={() => setEntering(index)} style={{ '--door-tone': world.tone } as React.CSSProperties}>
      <img src={`/career-universe-${world.code.toLowerCase()}-full.webp`} alt={world.note} />
      <span className="universe-door-caption"><small>宇宙 {world.code}{complete.includes(world.code) ? ' · 已抵达' : ''}</small><strong>{world.title}</strong>{route && <small className="door-premise">{route.choice}</small>}{route?.fit && <small className="door-fit">适合：{route.fit}</small>}<span>{complete.includes(world.code) ? <Check size={20}/> : <ArrowRight size={20}/>}</span></span>
    </button>})}</div>
  </section>
}

type Props = {
  code: UniverseCode; day: number; story: string; previousResult: string; title: string; tension: string
  choices: Array<{ id: string; label: string }>; disabled: boolean; needsWork: boolean
  customAction?: ReactNode; onChoose: (id: string) => void
}

function StoryArtwork({ code, day, src, alt }: { code: UniverseCode; day: number; src: string; alt: string }) {
  const root = useRef<HTMLDivElement>(null)
  const [loadedSource, setLoadedSource] = useState('')
  const [frame, setFrame] = useState({ code, day, source: src, previous: '', backward: false })
  // Keep just the outgoing picture across renders; never duplicate dialogue or controls.
  if (frame.source !== src) {
    setFrame({ code, day, source: src, previous: frame.source, backward: code !== frame.code ? code < frame.code : day < frame.day })
  }
  useGSAP(() => {
    if (!frame.previous || loadedSource !== frame.source) return
    const outgoing = root.current?.querySelector('.story-art-previous')
    const corner = root.current?.querySelector('.story-page-corner')
    if (!outgoing || !corner) return
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const timeline = gsap.timeline({ defaults: { ease: 'sine.inOut' } })
      timeline
        .fromTo(outgoing, { opacity: 1 }, { opacity: 0, duration: .32 }, 0)
        .fromTo(corner, { opacity: 0, scale: .55 }, { opacity: .85, scale: 1, duration: .12 }, 0)
        .to(corner, { opacity: 0, scale: .05, duration: .22 }, .12)
    })
    return () => media.revert()
  }, { scope: root, dependencies: [frame.source, loadedSource], revertOnUpdate: true })
  return <div ref={root} className={`story-art story-day-${day}`} data-turn={frame.backward ? 'back' : 'forward'}>
    <img decoding="async" src={src} alt={alt} onLoad={() => setLoadedSource(src)} />
    {frame.previous && <img className="story-art-previous" decoding="async" src={frame.previous} alt="" aria-hidden="true" />}
    <span>宇宙 {code} · 第 {day} 天</span>
    <i className="story-page-corner" aria-hidden="true" />
  </div>
}

export function StoryEventCard({ code, day, story, previousResult, title, tension, choices, disabled, needsWork, onChoose, customAction }: Props) {
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    root.current?.closest<HTMLElement>('.wz-view')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [code, day, title])
  const analysis = () => document.getElementById(`universe-story-${code}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  const artwork = stageArtwork[code][day as 30 | 90 | 150] ?? `/career-universe-${code.toLowerCase()}-full.webp`
  const stage = storyStages[day as 30 | 90 | 150]
  const decisionPrompt = tension
  return <section ref={root} className="story-event" tabIndex={-1} aria-label={`宇宙 ${code} · 第 ${day} 天`}>
    <div className="story-event-card">
      <StoryArtwork code={code} day={day} src={artwork} alt={worlds.find(world => world.code === code)?.note ?? ''} />
      <div className="story-dialogue">
        <h3 className="story-dialogue-title">{title}</h3>
        {stage && <div className={`story-stage-note story-stage-${day}`}><span>{stage.label}</span><small>{stage.note}</small></div>}
        <p className="story-context-label">这一幕发生了什么</p>
        {!story.includes('\n') && previousResult && <p className="story-previous-result">{previousResult}</p>}
        {story.split(/\n+/).filter(Boolean).map((paragraph,index)=><p key={index}>{paragraph}</p>)}
        <p className="story-decision-label">接下来要怎么走</p>
        <p className="story-decision-prompt">{decisionPrompt}</p>
        <div className="story-options">{choices.map(choice => <button key={choice.id} disabled={disabled} onClick={() => onChoose(choice.id)}><span>{choice.label}</span><ArrowRight size={22} aria-hidden="true"/></button>)}{customAction}</div>
        {needsWork && <button className="story-work-link" onClick={analysis}>先完成本幕的小练习 <ArrowDown size={18}/></button>}
        {!choices.length && <button className="story-work-link" onClick={analysis}>看看这一路的结果 <ArrowDown size={18}/></button>}
      </div>
    </div>
    <button className="story-analysis-link" onClick={analysis}>往下看，这条路意味着什么 <ArrowDown size={18}/></button>
  </section>
}
