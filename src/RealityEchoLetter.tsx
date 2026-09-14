import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { compareEcho, echoQuery, type EchoContext } from './echo-context'
import './RealityEchoLetter.css'

type Letter = { id: string; title: string; excerpt: string; sourceUrl: string; author: string; avatarUrl?: string; votes?: number; relevanceScore?: number }

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
    <header className="wz-letter-top"><span>现实来信 / 宇宙 {context.code} · 第 {context.day} 天</span><button type="button" aria-label="关闭来信" onClick={onClose}>×</button></header>
    <div className="wz-letter-desk">
      <aside className="wz-letter-envelope"><img src="/art/return-envelope.png" alt="拆开的纸质信封"/><span>寄给正在选择的你</span><small>{context.route}</small></aside>
      <div className="wz-choice-letter-body">
        <h2 id="wz-choice-letter-title">有人也走过这段路。</h2>
        <p className="wz-letter-salutation">关于「{context.eventTitle}」</p>
        <div aria-live="polite">
          {loading && <p className="wz-choice-letter-status">正在寻找相关经历…</p>}
          {error && <p className="wz-choice-letter-status">{error} <button type="button" onClick={() => setAttempt(value => value + 1)}>重试</button></p>}
          {!loading && !error && !letter && <p className="wz-choice-letter-status">暂时没有找到相关来信，先继续你的故事吧。</p>}
          {letter && <article className="wz-choice-letter-source" key={letter.id || letter.sourceUrl}>
            <div className="wz-letter-source-brand"><img src="/zhihu-logo.svg" alt="知乎"/><span>真实讨论</span></div>
            <div className="wz-letter-author">{letter.avatarUrl && <img src={letter.avatarUrl} alt="" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.style.display='none'}}/>}<span>{letter.author || '作者未提供'}</span>{comparison?.matches[0] && <small>{comparison.matches[0].label}</small>}</div>
            <h3><a href={letter.sourceUrl} target="_blank" rel="noopener noreferrer">{letter.title.replace(/\s*[-–—]\s*知乎$/, '')} ↗</a></h3>
            <p>{letter.excerpt ? `${letter.excerpt.slice(0, 180)}${letter.excerpt.length > 180 ? '…' : ''}` : '此来源未提供摘录，请查看原文。'}</p>
            {letter.excerpt.length > 180 && <details><summary>展开摘录</summary><p>{letter.excerpt.slice(180)}</p></details>}
            <div className="wz-letter-source-footer"><span>{typeof letter.votes === 'number' ? `${letter.votes.toLocaleString()} 赞同` : '知乎公开摘录'}</span><a href={letter.sourceUrl} target="_blank" rel="noopener noreferrer">查看原文 ↗</a></div>
          </article>}
        </div>
        {letter && <p className="wz-letter-question">读完想一想：对方的条件，和你有哪些不同？</p>}
        <div className="wz-letter-paper-end"><small>他人的经历，供你参考。</small>{letters.length > 1 && <button type="button" onClick={() => setIndex(value => (value + 1) % letters.length)}>下一封 · {index + 1}/{letters.length}</button>}</div>
      </div>
    </div>
    <footer><div>{onAdjust && <button type="button" onClick={onAdjust}>调整下一步</button>}<button type="button" className="wz-choice-letter-primary" onClick={onClose}>回到故事</button></div></footer>
  </dialog>, document.body)
}
