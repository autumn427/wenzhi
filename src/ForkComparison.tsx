import { ThumbsUp } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { chooseUniverseFreeAction, chooseUniversePath, isGeneratedActionSource, type GeneratedFreeAction, type SimulationProfile, type UniverseRun } from './simulation'
import { acceptsNextAction, normalizedAction } from './action-submission'
import { compareEcho, type EchoContext } from './echo-context'
import { forkIdentity, keepForkResult, pickForkSource, readForkRecord, type ForkRecord, type ForkResult, type ForkSource } from './fork-comparison'
import './fork-comparison.css'

export function ForkComparison({ run, profile, cycle, demo, demoRecords, live, evidence, sourceLoading, sourceError, context, allowFallback, onBusy, onCommit, onCustom, onRetrySource }: {
  run: UniverseRun; profile: SimulationProfile; cycle: number; demo: boolean; live: boolean;
  demoRecords: Map<string, ForkRecord>;
  evidence: ForkSource[]; sourceLoading: boolean; sourceError: string; context: EchoContext; allowFallback: boolean;
  onBusy: (busy: boolean) => void; onCommit: (run: UniverseRun) => void; onCustom: () => void; onRetrySource: () => void;
}) {
  const identity = forkIdentity(run, profile, cycle)
  const storageKey = `wenzhi:fork:v1:${JSON.stringify([profile, cycle, run.code])}`
  const [record, setRecord] = useState<ForkRecord | null>(() => {
    if (demo) return demoRecords.get(identity) ?? null
    try { return readForkRecord(localStorage.getItem(storageKey), identity, run) } catch { return null }
  })
  const recordRef = useRef(record)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(true)
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const resultsRef = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLElement>(null)
  const source = record ? record.source : pickForkSource(evidence, context)
  const comparison = source ? compareEcho(context, source) : null
  const results = record?.results ?? []
  const choices = run.currentEvent.choices.slice(0, 2)
  useEffect(() => {
    mounted.current = true
    root.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    return () => { mounted.current = false; controller.current?.abort(); onBusy(false) }
  }, [onBusy])
  useEffect(() => {
    if (results.length) resultsRef.current?.focus({ preventScroll: false })
  }, [results.length])
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
    } catch (failure) {
      if (mounted.current) setError(abort.signal.aborted ? '试选等待超时，原路线和已完成的试选没有改变。请重试。' : failure instanceof Error ? failure.message : '试选暂不可用，请重试。')
    } finally {
      clearTimeout(timeout); controller.current = null
      if (mounted.current) { setBusy(''); onBusy(false) }
    }
  }
  return <section ref={root} className="fork-workshop" aria-label="同一处境，试两种做法">
    <div className="fork-main">
    <header className="fork-intro"><div><span className="fork-eyebrow">第 {run.currentEvent.day} 天</span>
      <h2>{run.currentEvent.title}</h2><p>{run.currentEvent.story}</p><strong>{run.currentEvent.tension}</strong></div></header>
    <div className="fork-choices">{choices.map((choice, index) => {
      const tried = results.some(result => result.choiceId === choice.id)
      return <button type="button" key={choice.id} disabled={Boolean(busy) || tried} onClick={() => void tryChoice(choice.id)}>
        <span className="fork-eyebrow">选择 {index + 1}{tried ? ' · 已试过' : ''}</span>
        <strong>{choice.label}</strong><span>{choice.tradeoff}</span><b aria-hidden="true">{tried ? '✓' : '→'}</b></button>
    })}</div>
    <div className="fork-choice-footer"><span>先看后果，再决定是否继续。</span><button className="fork-custom" type="button" disabled={Boolean(busy)} onClick={onCustom}>我有别的做法 →</button></div>

    {busy && <p role="status">正在展开下一幕…</p>}
    {error && <p className="fork-error" role="alert">{error}</p>}
    {results.length > 0 && <div className="fork-results" ref={resultsRef} tabIndex={-1}>
      <h3>{results.length === 2 ? '两种选择，两个后续' : '如果这样选…'}</h3>
      <div className="fork-result-grid">{results.map(result => <article key={result.choiceId}>
        <span className="fork-eyebrow">做法 {choices.findIndex(c => c.id === result.choiceId) + 1} · {run.route ? 'AI 模拟' : '预设模拟'}</span>
        <h4>{result.action}</h4><dl><dt>留下了什么 · 模拟记录</dt><dd>{result.run.currentEvent.story}</dd>
          <dt>付出了什么</dt><dd>{result.cost}</dd><dt>仍待弄清</dt><dd>{result.remaining}</dd></dl>
        <small>{result.sourceIds.length ? '本幕引用了知乎摘录作为参照。' : '本幕没有引用知乎内容作为后果依据。'}</small>
        <button type="button" disabled={Boolean(busy)} onClick={() => onCommit(structuredClone(result.run))}>沿做法 {choices.findIndex(c => c.id === result.choiceId) + 1} 继续 →</button>
      </article>)}</div>
      <p className="fork-footnote">{demo ? '试玩记录仅在本次页面内保留。' : saved ? '已保存到当前浏览器，刷新可回看。' : '浏览器未能保存，关闭页面后试选记录可能丢失。'} {run.route ? 'AI 输出仍可能存在生成差异；固定条件不等于真实因果实验。' : '预设后果固定，不因重新打开而改变。'}</p>
    </div>}
    </div>
    <aside className="fork-source" aria-label="知乎现实参照">
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
  </section>
}
