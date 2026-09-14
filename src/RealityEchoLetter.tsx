import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { compareEcho, echoQuery, type EchoContext } from './echo-context'
import './RealityEchoLetter.css'

type Letter = { id: string; title: string; excerpt: string; sourceUrl: string; author: string; relevanceScore?: number }

export function RealityEchoLetter({ context, onClose, onAdjust, savedLetters }: { context: EchoContext; onClose: () => void; onAdjust?: () => void; savedLetters?: Letter[] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [letters, setLetters] = useState<Letter[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => { dialog.current?.close(); previous?.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    if (savedLetters) { setLetters(savedLetters); setIndex(0); setLoading(false); setError(''); return }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20000)
    let active = true
    setLoading(true); setError(''); setLetters([]); setIndex(0)
    void (async () => {
      try {
        const response = await fetch('/api/zhihu/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: echoQuery(context), count: 3 }), signal: controller.signal,
        })
        const data = await response.json() as { search?: { items?: Letter[] } }
        if (!response.ok || !data.search) throw new Error('暂时没有连上来源检索，请稍后重试。')
        const items = (data.search.items ?? []).filter(item => typeof item.title === 'string' && typeof item.excerpt === 'string' && /^https:\/\/(?:www|zhuanlan)\.zhihu\.com\//.test(item.sourceUrl) && (item.relevanceScore === undefined || item.relevanceScore >= .08))
        if (active) setLetters(items)
      } catch (err) {
        if (active) setError(controller.signal.aborted ? '检索超时了，你可以重试，也可以继续当前路线。' : err instanceof Error ? err.message : '来源暂不可用。')
      } finally { clearTimeout(timeout); if (active) setLoading(false) }
    })()
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [context, attempt, savedLetters])
  const letter = letters[index]
  const comparison = letter ? compareEcho(context, letter) : null
  return createPortal(<dialog className="wz-choice-letter" ref={dialog} aria-labelledby="wz-choice-letter-title" onCancel={onClose}>
    <header><span>现实回声 · 宇宙 {context.code} · 第 {context.day} 天</span><button type="button" aria-label="关闭来信" onClick={onClose}>×</button></header>
    <div className="wz-choice-letter-body">
      <h2 id="wz-choice-letter-title">从别人的经历，看看自己的选择。</h2>
      {savedLetters && <p>知乎 API 摘录 · 2026-09-14 检索保存 · 故事为虚构试玩</p>}
      <section className="wz-choice-letter-context"><small>你的模拟路线 · {context.route}</small>{context.action && <p>上一次选择{context.actionDay !== undefined ? ` · 第 ${context.actionDay} 天` : ''}：{context.action}</p>}<p>眼前这一幕：{context.eventTitle}</p><span>{context.obstacle}</span></section>
      <div aria-live="polite">
        {loading && <p className="wz-choice-letter-status">正在寻找与这次选择相关的公开经历…</p>}
        {error && <p className="wz-choice-letter-status">{error} <button type="button" onClick={() => setAttempt(value => value + 1)}>重新检索</button></p>}
        {!loading && !error && !letter && <p className="wz-choice-letter-status">暂未找到足够相关的公开经历。这次先留白，你的选择和进度已保留。</p>}
        {letter && comparison && <article className="wz-choice-letter-source" key={letter.id || letter.sourceUrl}><small>知乎公开内容 · {letter.author || '作者未提供'} · 不属于模拟剧情</small><h3>{letter.title}</h3>
          <section className="wz-echo-relevance"><strong>为什么会出现在这里？</strong><p>{comparison.summary}</p></section>
          {comparison.matches.length > 0 && <ul className="wz-echo-comparison">{comparison.matches.map(match => <li key={match.label}><b>{match.label}</b><q>{match.quote.length > 160 ? `${match.quote.slice(0, 160)}…` : match.quote}</q></li>)}</ul>}
          <p>{letter.excerpt ? `${letter.excerpt.slice(0, 240)}${letter.excerpt.length > 240 ? '…' : ''}` : '此来源未提供摘录，请查看原文。'}</p>
          {letter.excerpt.length > 240 && <details><summary>展开检索摘录</summary><p>{letter.excerpt}</p></details>}
          <a href={letter.sourceUrl} target="_blank" rel="noopener noreferrer">核对作者和原文 ↗</a>
          <aside><strong>带着这一个问题回到选择</strong><p>{context.action ? `如果在现实中尝试“${context.action}”，你的基础、可用时间和反馈条件，与原文有哪些不同？` : '对方的基础、可用时间和反馈条件，与你有哪些不同？'}</p><p>摘录可能是建议、讨论或个人经历，不能仅凭检索认定为亲身经验；没有说明的条件保持未知，他人的结果也不是你的未来。</p></aside>
          {letters.length > 1 && <button type="button" onClick={() => setIndex(value => (value + 1) % letters.length)}>另一份经历 · {index + 1}/{letters.length} →</button>}
        </article>}
      </div>
    </div>
    <footer><small>阅读不会改变能力数值或已做的选择。</small><div>{onAdjust && <button type="button" onClick={onAdjust}>调整下一步</button>}<button type="button" className="wz-choice-letter-primary" onClick={onClose}>继续当前路线 →</button></div></footer>
  </dialog>, document.body)
}
