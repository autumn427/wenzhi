import { useEffect, useRef } from 'react'
import { ArrowDown, ArrowRight } from '@phosphor-icons/react'
import './paper-landing.css'

type Props = { onStart: () => void; onDemo: () => void }

/** Native scrolling drives a reversible paper-camera move; it never chooses a route. */
export function PaperLanding({ onStart, onDemo }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const art = useRef<HTMLDivElement>(null)
  const copy = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = root.current
    const scene = el?.closest<HTMLElement>('.wz-view')
    if (!el || !scene) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let x = 0
    let y = 0
    const draw = () => {
      frame = 0
      const progress = Math.min(1, scene.scrollTop / Math.max(1, scene.clientHeight))
      if (art.current) art.current.style.transform = media.matches ? 'none' : `translate3d(${x * 9}px,${y * 7 - progress * 28}px,0) scale(${1.015 + progress * .075})`
      if (copy.current) copy.current.style.transform = media.matches ? 'none' : `translate3d(0,${-progress * 42}px,0)`
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw) }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      x = event.clientX / window.innerWidth - .5
      y = event.clientY / window.innerHeight - .5
      schedule()
    }
    const leave = () => { x = 0; y = 0; schedule() }
    scene.addEventListener('scroll', schedule, { passive: true })
    el.addEventListener('pointermove', move, { passive: true })
    el.addEventListener('pointerleave', leave)
    media.addEventListener('change', schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      scene.removeEventListener('scroll', schedule)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      media.removeEventListener('change', schedule)
    }
  }, [])
  const explore = () => root.current?.querySelector('#paper-paths')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  return <div className="paper-landing wz-reveal" ref={root}>
    <section className="paper-opening" aria-labelledby="paper-title">
      <div className="paper-opening-art" ref={art} aria-hidden="true">
        <span className="paper-opening-layer layer-haze" />
        <span className="paper-opening-layer layer-moon" />
        <span className="paper-opening-layer layer-ribbon" />
        <span className="paper-opening-layer layer-grain" />
      </div>
      <div className="paper-opening-frame" aria-hidden="true">
        <span className="paper-frame-corner corner-tl" />
        <span className="paper-frame-corner corner-br" />
        <span className="paper-frame-stamp">WZ / 180</span>
      </div>
      <div className="paper-opening-copy" ref={copy}>
        <span className="paper-scene-kicker"><i /> 一张还没折完的人生地图</span>
        <h1 id="paper-title">如果当初，<br />选了另一条路。</h1>
        <p>换个选择，过完这半年的另一种人生。</p>
        <button className="paper-primary" onClick={onStart}>这次，我来选 <ArrowRight size={26} /></button>
        <button className="paper-text-action" onClick={onDemo}>先试玩 3 分钟</button>
      </div>
      <p className="paper-source">知乎真实经历 · 原文可追溯</p>
      <button className="paper-scroll" onClick={explore}>向下，看看三条路 <ArrowDown size={20} /></button>
    </section>
    <section className="paper-paths" id="paper-paths" aria-labelledby="paper-paths-title">
      <header className="paper-paths-intro">
        <div className="paper-paths-heading">
          <h2 id="paper-paths-title">想换条路，又怕后悔。<br />那就先在这里试一次。</h2>
        </div>
        <div className="paper-demo-context" aria-labelledby="paper-demo-title">
          <h3 id="paper-demo-title">“这个学期，每周空出来的两三个晚上，怎么用？”</h3>
          <p>课表终于没那么满了。你想多一点生活费，也担心以后找工作没什么可写，但又不想把大学过成每天赶任务。室友已经各自开始行动，<span className="paper-demo-ending">你也想试着改变一点。</span></p>
        </div>
      </header>
      <div className="paper-route-list">
        {[
          ['A', '去店里兼职', '先挣一点生活费，看看自己能不能兼顾。', 'blue', 'fold'],
          ['B', '投第一份实习', '先投一次简历，看看真正的上班是什么样。', 'amber', 'spark'],
          ['C', '和朋友摆市集', '一起摆个小摊，钱和分工都得说清。', 'green', 'leaf'],
        ].map(([code, title, text, tone, shape]) => <article className={`paper-route ${tone}`} key={code}>
          <div className="paper-route-door" aria-hidden="true">
            <img loading="lazy" decoding="async" src={`/career-universe-${code.toLowerCase()}-full.webp`} alt="" />
            <span className="paper-route-cut cut-back" />
            <span className="paper-route-cut cut-front" />
            <span className={`paper-route-icon icon-${shape}`}><i /><i /><i /></span>
            <span className="paper-route-scene-label">{code === 'A' ? '兼职 · 生活费' : code === 'B' ? '实习 · 探探路' : '市集 · 一起做'}</span>
          </div>
          <div className="paper-route-copy"><span className="paper-route-index">{code}</span><h3>{title}</h3><p>{text}</p></div>
        </article>)}
      </div>
      <div className="paper-paths-footer"><p>每条路都有舍不得的东西。看看半年后，你还认不认这笔账。<br />玩完以后，挑一件小事，回到生活里试七天。</p><button className="paper-primary" onClick={onDemo}>试试我的选择 <ArrowRight size={24} /></button></div>
    </section>
  </div>
}
