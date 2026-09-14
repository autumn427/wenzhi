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
    <header className="fork-intro"><div><span className="fork-eyebrow">第 {run.currentEvent.day} 天 · 一个关键分岔</span>
      <h2>{run.currentEvent.title}</h2><p>{run.currentEvent.story}</p><strong>{run.currentEvent.tension}</strong></div>
      <img src="/wayfinding/paper-wayfinding-landscape.webp" alt="" /></header>
    <div className="fork-ground"><span>同一个出发点</span><p>两次试选共用当前处境、此前选择、每周 {run.state.weeklyHours} 小时预算和同一份参照。仅预演下一幕，确认后才推进路线。</p></div>
    <aside className="fork-source" aria-label="这一份知乎参照">
      <span className="fork-eyebrow">选择前，看看一个现实线索</span>
      {source && comparison ? <><p>{comparison.summary}</p><details><summary>展开摘录 · {source.author || '作者未提供'}</summary>
        <h3>{source.title}</h3>{comparison.matches.slice(0, 1).map(match => <blockquote key={match.label}>{match.quote}</blockquote>)}
        <p>{source.excerpt}</p><small>检索摘录，可能不完整；共同关键词不代表处境相同，也不证明模拟结局。</small>
        <a href={source.sourceUrl} target="_blank" rel="noreferrer">阅读知乎原文 ↗</a></details></>
        : <p>{record ? '这次试选未使用知乎参照，后果仅按场景推演。' : sourceLoading ? '正在寻找相关摘录，也可以直接试选。' : sourceError ? '来源检索暂不可用，可以直接试选。' : '暂未找到有明确共同线索的摘录，先留白。'}</p>}
      {!record && !sourceLoading && !source && <button type="button" onClick={onRetrySource}>重新查找参照</button>}
      {record && <small>参照已固定，两种做法使用同一份资料。</small>}
    </aside>
    <div className="fork-choices">{choices.map((choice, index) => {
      const tried = results.some(result => result.choiceId === choice.id)
      return <button type="button" key={choice.id} disabled={Boolean(busy) || tried} onClick={() => void tryChoice(choice.id)}>
        <span className="fork-eyebrow">做法 {index + 1} · {tried ? '已保留结果' : results.length ? '换一种做法试试' : '先试这一种'}</span>
        <strong>{choice.label}</strong><span>{choice.tradeoff}</span><b aria-hidden="true">{tried ? '✓' : '→'}</b></button>
    })}</div>
    {busy && <p role="status">正在预演这次行动；原路线停在出发点，暂未推进…</p>}
    {error && <p className="fork-error" role="alert">{error}</p>}
    {results.length > 0 && <div className="fork-results" ref={resultsRef} tabIndex={-1}>
      <h3>{results.length === 2 ? '同一处境，两份模拟记录' : '第一份模拟记录已保留'}</h3>
      <p>这一轮只记录行动与取舍，不计能力加分。</p>
      <p>{results.length === 1 ? '可以回到同一处境试另一种做法，也可以沿这条路继续。' : '只比较这次行动留下的线索，不据此判断哪条人生更好。'}</p>
      <div className="fork-result-grid">{results.map(result => <article key={result.choiceId}>
        <span className="fork-eyebrow">做法 {choices.findIndex(c => c.id === result.choiceId) + 1} · {run.route ? 'AI 模拟' : '预设模拟'}</span>
        <h4>{result.action}</h4><dl><dt>留下了什么 · 模拟记录</dt><dd>{result.run.currentEvent.story}</dd>
          <dt>付出了什么</dt><dd>{result.cost}</dd><dt>仍待弄清</dt><dd>{result.remaining}</dd></dl>
        <small>{result.sourceIds.length ? '本幕引用了上方摘录作为参照。' : '本幕没有引用知乎内容作为后果依据。'}</small>
        <button type="button" disabled={Boolean(busy)} onClick={() => onCommit(structuredClone(result.run))}>沿做法 {choices.findIndex(c => c.id === result.choiceId) + 1} 继续 →</button>
      </article>)}</div>
      <p className="fork-footnote">{demo ? '试玩记录仅在本次页面内保留。' : saved ? '已保存到当前浏览器，刷新可回看。' : '浏览器未能保存，关闭页面后试选记录可能丢失。'} {run.route ? 'AI 输出仍可能存在生成差异；固定条件不等于真实因果实验。' : '预设后果固定，不因重新打开而改变。'}</p>
    </div>}
    <button className="fork-custom" type="button" disabled={Boolean(busy)} onClick={onCustom}>我有别的做法，返回自由选择</button>
  </section>
}
