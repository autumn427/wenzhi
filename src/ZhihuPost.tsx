import { ArrowSquareOut, ThumbsUp, UserCircle } from '@phosphor-icons/react'

type Props = {
  author: string
  title?: string
  summary: string
  badge?: string
  sourceUrl?: string
  votes?: number
  live?: boolean
  compact?: boolean
}

export function ZhihuPost({ author, title, summary, badge, sourceUrl, votes, live, compact }: Props) {
  return <article className={`zhihu-post${compact ? ' is-compact' : ''}`}>
    <header className="zhihu-post-brand"><img src="/zhihu-logo.svg" alt="知乎" width="64" height="30" /><span>{live ? '实时检索 · 回答摘要' : '公开回答 · 摘要转述'}</span></header>
    {title && <h4 className="zhihu-post-title">{title}</h4>}
    <div className="zhihu-post-author"><UserCircle size={42} weight="duotone" aria-hidden="true" /><div><strong>{author || '知乎用户'}</strong>{badge && <span>{badge}</span>}</div></div>
    <p className="zhihu-post-body">{summary}</p>
    <footer className="zhihu-post-footer">
      {typeof votes === 'number' && votes > 0 && <span className="zhihu-post-votes"><ThumbsUp size={18}/>{votes.toLocaleString()} 赞同</span>}
      {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">阅读知乎原文 <ArrowSquareOut size={18}/></a>}
    </footer>
    <p className="zhihu-post-note">这是问枝整理的摘要。想知道作者完整的意思，可以打开原文。</p>
  </article>
}
