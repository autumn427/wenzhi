import { ArrowLeft, ArrowRight, BookOpen, CaretRight, Check, Paperclip, Pause, Play, ThumbsUp } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { chooseUniverseFreeAction, chooseUniversePath, isGeneratedActionSource, type GeneratedFreeAction, type SimulationProfile, type UniverseRun } from './simulation'
import { acceptsNextAction, normalizedAction } from './action-submission'
import { compareEcho, type EchoContext } from './echo-context'
import { forkIdentity, keepForkResult, pickForkSource, readForkRecord, type ForkRecord, type ForkResult, type ForkSource } from './fork-comparison'
import './fork-comparison.css'
import { galSceneAssets } from './gal-scene-assets'

// Keep the authored story intact, but give each dialogue beat a readable length.
function dialogueBeats(story: string) {
  const sentences = story.match(/[^。！？\n]+[。！？]?|\n/g) ?? [story]
  const beats: string[] = []
  for (const sentence of sentences) {
    const last = beats.length - 1
    if (last >= 0 && beats[last].length + sentence.length <= 65) beats[last] += sentence
    else if (sentence.trim()) beats.push(sentence.trim())
  }
  return beats.length ? beats : ['这一刻，你停下来想了想。']
}

export function ForkComparison({ run, profile, cycle, demo, demoRecords, live, evidence, sourceLoading, sourceError, context, allowFallback, onBusy, onCommit, onCustom, onRetrySource, customOpen, customAction, customPending, onCloseCustom }: {
  run: UniverseRun; profile: SimulationProfile; cycle: number; demo: boolean; live: boolean;
  demoRecords: Map<string, ForkRecord>;
  evidence: ForkSource[]; sourceLoading: boolean; sourceError: string; context: EchoContext; allowFallback: boolean;
  onBusy: (busy: boolean) => void; onCommit: (run: UniverseRun) => void; onCustom: () => void; onRetrySource: () => void;
  customOpen: boolean; customAction: ReactNode; customPending: boolean; onCloseCustom: () => void;
}) {
  const identity = forkIdentity(run, profile, cycle)
  const storageKey = `wenzhi:fork:v1:${JSON.stringify([profile, cycle, run.code])}`
  const [record, setRecord] = useState<ForkRecord | null>(() => {
    if (demo) return demoRecords.get(identity) ?? null
    try { return readForkRecord(localStorage.getItem(storageKey), identity, run) } catch { return null }
  })
  const recordRef = useRef(record)
  const [busy, setBusy] = useState('')
  const [motionPaused, setMotionPaused] = useState(false)
  const scene = galSceneAssets(run.code, run.currentEvent.day)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(true)
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const root = useRef<HTMLElement>(null)
  const dialogueRef = useRef<HTMLDivElement>(null)
  const choicesRef = useRef<HTMLDivElement>(null)
  const source = record ? record.source : pickForkSource(evidence, context)
  const comparison = source ? compareEcho(context, source) : null
  const results = record?.results ?? []
  const choices = run.currentEvent.choices.slice(0, 2)
  const beats = dialogueBeats(run.currentEvent.story)
  const [beat, setBeat] = useState(record?.results.length ? beats.length : 0)
  const [previewChoice, setPreviewChoice] = useState<string | null>(record?.results[record.results.length - 1]?.choiceId ?? null)
  const preview = results.find(result => result.choiceId === previewChoice)
  const choosing = beat >= beats.length
  const routeTitle = run.route?.title ?? ({ A: '去店里兼职', B: '投第一份实习', C: '和朋友摆市集' }[run.code])
  useEffect(() => {
    if (customOpen) root.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true })
  }, [customOpen])
  useEffect(() => {
    if (previewChoice) dialogueRef.current?.focus({ preventScroll: true })
    else if (choosing) choicesRef.current?.focus({ preventScroll: true })
  }, [choosing, previewChoice])
  useEffect(() => {
    mounted.current = true
    root.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    return () => { mounted.current = false; controller.current?.abort(); onBusy(false) }
  }, [onBusy])
  const persist = (next: ForkRecord) => {
    recordRef.current = next; setRecord(next)
    if (demo) demoRecords.set(identity, next)
    if (!demo) try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(true) } catch { setSaved(false) }
  }
  const tryChoice = async (choiceId: string) => {
    if (controller.current || recordRef.current?.results.some(r => r.choiceId === choiceId)) return
    const choice = choices.find(c => c.id === choiceId)
    if (!choice) return
    const frozen = recordRef.current ?? { version: 1 as const, identity, source: source ? structuredClone(source) : null, results: [] }
    persist(frozen)
    setBusy(choiceId); onBusy(true); setError('')
    const abort = new AbortController(); controller.current = abort
    const timeout = window.setTimeout(() => abort.abort(), 60000)
    try {
      let next: UniverseRun
      let sourceIds: string[] = []
      if (run.route || choice.generatedAction) {
        if (!live) throw new Error('当前模式不能续写这条路线，原进度已保留。')
        const response = await fetch('/api/simulation/free-action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
          body: JSON.stringify({ action: choice.label, allowThirdPartyFallback: allowFallback, mode: 'full',
            comparisonPreview: true, universeCode: run.code, profile,
            route: run.route ? { title: run.route.title, premise: run.route.premise } : undefined,
            decisions: run.decisions,
            event: { ...run.currentEvent, choices: choices.map(({ id, label, tradeoff }) => ({ id, label, tradeoff })) },
            evidence: frozen.source ? [frozen.source] : [],
          }),
        })
        const payload = await response.json() as { action?: GeneratedFreeAction }
        if (!response.ok || !payload.action || !isGeneratedActionSource(payload.action.source)
          || !acceptsNextAction(run, payload.action)
          || normalizedAction(payload.action.actionLabel) !== normalizedAction(choice.label)) throw new Error('这次试选没有生成可用结果，第一份记录和原路线都已保留。可以重试。')
        next = chooseUniverseFreeAction(run, payload.action)
        sourceIds = (payload.action.evidenceRefs ?? []).filter(id => id === frozen.source?.id)
      } else {
        next = chooseUniversePath(run, choice.id)
      }
      if (!mounted.current || abort.signal.aborted) return
      const decision = next.decisions[next.decisions.length - 1]
      const result: ForkResult = { choiceId, action: choice.label, run: next,
        cost: decision.actionOutcome?.immediateCost ?? decision.tradeoff ?? choice.tradeoff,
        remaining: decision.actionOutcome?.observableChange ?? next.currentEvent.tension,
        sourceIds,
      }
      persist(keepForkResult(recordRef.current ?? frozen, run, result))
      setPreviewChoice(choiceId)
    } catch (failure) {
      if (mounted.current) setError(abort.signal.aborted ? '试选等待超时，原路线和已完成的试选没有改变。请重试。' : failure instanceof Error ? failure.message : '试选暂不可用，请重试。')
    } finally {
      clearTimeout(timeout); controller.current = null
      if (mounted.current) { setBusy(''); onBusy(false) }
    }
  }
  return <section ref={root} className={`fork-workshop gal-scene${choosing ? ' is-choosing' : ''}`} data-universe={run.code} data-scene-day={scene.stage} aria-label="纸上故事，试试你的选择">
    <img className="gal-backdrop" src={scene.background} alt="" aria-hidden="true" fetchPriority="high" />
    <header className="gal-chapter">
      <span>第 {run.currentEvent.day} 天 <i aria-hidden="true" /> {routeTitle}</span>
      <h2>{run.currentEvent.title}</h2>
    </header>
    <div className="gal-scene-body">
      <div className="fork-main">

        {choosing && !preview && !customOpen && <div className="gal-choice-stack" ref={choicesRef} tabIndex={-1} aria-label="你的选择">
          {choices.map((choice, index) => {
            const tried = results.some(result => result.choiceId === choice.id)
            return <button type="button" key={choice.id} disabled={Boolean(busy)} onClick={() => tried ? setPreviewChoice(choice.id) : void tryChoice(choice.id)}>
              <span className="gal-choice-index">{tried ? <Check size={17} aria-hidden="true" /> : `0${index + 1}`}</span>
              <span className="gal-choice-copy"><strong>{choice.label}</strong><small>{tried ? '已试过 · 回看后续' : choice.tradeoff}</small></span>
              <CaretRight size={20} aria-hidden="true" />
            </button>
          })}
        </div>}
        <div className={`gal-dialogue ${customOpen ? 'gal-custom-action' : preview ? 'is-preview' : ''}`} ref={dialogueRef} tabIndex={-1} aria-label={customOpen ? '写下我的做法' : preview ? '试选后续故事' : '当前故事'}>
        <figure className="gal-mascot">
          <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet={scene.still} />
            <img src={motionPaused ? scene.still : scene.mascot} alt="陪你读故事的刘看山" width="320" height="320" decoding="async" />
          </picture>
          <button className="gal-motion-toggle" type="button" onClick={() => setMotionPaused(!motionPaused)} aria-label={motionPaused ? '播放刘看山动画' : '暂停刘看山动画'} aria-pressed={motionPaused} title={motionPaused ? '播放动画' : '暂停动画'}>
            {motionPaused ? <Play size={14} weight="fill" aria-hidden="true" /> : <Pause size={14} weight="fill" aria-hidden="true" />}
          </button>
        </figure>
          <div className="gal-speaker"><BookOpen size={18} aria-hidden="true" /><span>{customOpen ? '我想这样做' : preview ? '如果这样选…' : choosing ? '心里想' : '旁白'}</span><small>{customOpen ? '自己的选择' : preview ? '试选后续' : choosing ? '轮到你了' : `${beat + 1} / ${beats.length}`}</small></div>
          {customOpen ? customAction : <>
          <div className="gal-dialogue-text" aria-live="polite" aria-atomic="true">
            {preview ? <><h3>{preview.run.currentEvent.title}</h3><p>{preview.run.currentEvent.story}</p></> : <p key={beat}>{choosing ? run.currentEvent.tension : beats[beat]}</p>}
          </div>
          {preview && <details className="gal-outcome-detail"><summary>看看这次选择的取舍</summary><p>{preview.cost}</p><p>{preview.remaining}</p><small>{preview.sourceIds.length ? '知乎摘录仅作参照。' : '后续为虚构模拟。'} {demo ? '试玩记录仅在本次页面内保留。' : saved ? '已保存在当前浏览器。' : '浏览器未能保存，请保留当前页面。'}</small></details>}
          {busy && <p className="gal-status" role="status">正在展开下一幕…</p>}
          {error && <p className="fork-error" role="alert">{error}</p>}
          </>}
          <footer className="gal-dialogue-actions">
            {customOpen ? <button type="button" className="gal-text-button" disabled={customPending} onClick={() => { setBeat(beats.length); onCloseCustom() }}><ArrowLeft size={16} />回到两个选择</button> : preview ? <>
              <button type="button" className="gal-text-button" onClick={() => setPreviewChoice(null)}><ArrowLeft size={16} />回到选择</button>
              <button type="button" className="gal-next" disabled={Boolean(busy)} onClick={() => onCommit(structuredClone(preview.run))}>沿这个选择继续 <ArrowRight size={18} /></button>
            </> : choosing ? <>
              <button type="button" className="gal-text-button" disabled={Boolean(busy)} onClick={() => setBeat(0)}><ArrowLeft size={16} />重读故事</button>
              <button type="button" className="gal-text-button" disabled={Boolean(busy)} onClick={onCustom}>我有别的做法 <ArrowRight size={16} /></button>
            </> : <>
              <div className="gal-reading-tools">{beat > 0 && <button type="button" className="gal-text-button" onClick={() => setBeat(beat - 1)} aria-label="上一段故事"><ArrowLeft size={16} /></button>}<button type="button" className="gal-text-button" onClick={() => setBeat(beats.length)}>直接选择</button></div>
              <button type="button" className="gal-next" onClick={() => setBeat(beat + 1)}>{beat === beats.length - 1 ? '看看我的选择' : '继续'}<CaretRight size={18} /></button>
            </>}
          </footer>
        </div>
      </div>
    <aside className="fork-source" aria-label="知乎现实参照">
      <Paperclip className="gal-source-clip" size={34} weight="light" aria-hidden="true" />
      <div className="fork-source-brand"><img src="/zhihu-logo.svg" alt="知乎" /><span>现实参照</span></div>
      {source && comparison ? <>
        <div className="fork-source-author">
          {source.avatarUrl && /^https:\/\/[^/]+\.zhimg\.com\//.test(source.avatarUrl) ? <img src={source.avatarUrl} alt={`${source.author}的头像`} referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none' }} /> : null}
          <span>{source.author || '作者未提供'}</span>
        </div>
        <a className="fork-source-title" href={source.sourceUrl} target="_blank" rel="noreferrer">{source.title.replace(/\s*[-–]\s*知乎$/, '')}<span aria-hidden="true"> ↗</span></a>
        <p className="fork-source-excerpt">{source.excerpt}</p>
        <div className="fork-source-stats"><span><ThumbsUp size={16} aria-hidden="true" />{typeof source.votes === 'number' && Number.isFinite(source.votes) ? `${source.votes.toLocaleString('zh-CN')} 赞同` : '赞同数未提供'}</span><a href={source.sourceUrl} target="_blank" rel="noreferrer">查看原文 ↗</a></div>
      </> : <div className="fork-source-empty"><p>{sourceLoading ? '正在寻找相关经历…' : '暂时没有合适的参照，不影响选择。'}</p>{!record && !sourceLoading && <button type="button" onClick={onRetrySource}>重新查找</button>}</div>}
    </aside>
    </div>
  </section>
}
