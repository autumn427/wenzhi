import { useEffect, useState } from 'react'
import './zhihu-connection.css'
const notices: Record<string, string> = {
  connected: '知乎授权已完成。', disconnected: '已退出本网站的知乎连接。',
  unavailable: '知乎账号连接尚未开放，你可以继续游客体验。',
  verification_failed: '授权回调未通过校验，请重新连接。若再次失败，需核对知乎应用的回调协议。',
  exchange_failed: '此次授权未完成，请稍后重试。你的探索记录没有改变。',
}
export function ZhihuConnection() {
  const [status, setStatus] = useState<{ configured: boolean; authorized: boolean; expiresAt?: number } | null>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/auth/zhihu/status', { signal: controller.signal, cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error('unavailable')
      return r.json()
    }).then(setStatus).catch(() => { if (!controller.signal.aborted) setNotice('暂时无法检查知乎连接，游客体验仍可使用。') })
    const url = new URL(window.location.href), result = url.searchParams.get('zhihu')
    if (result && notices[result]) { setNotice(notices[result]); url.searchParams.delete('zhihu'); window.history.replaceState(null, '', url) }
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!status?.authorized || !status.expiresAt) return
    const timer = window.setTimeout(() => { setStatus({ configured: true, authorized: false }); setNotice('知乎连接已过期，请重新授权。') }, Math.max(0, status.expiresAt * 1000 - Date.now()))
    return () => window.clearTimeout(timer)
  }, [status])
  return <details className="zhihu-connection"><summary>{status?.authorized ? '知乎已连接' : '连接知乎'}</summary>
    <div className="zhihu-connection-panel">
      <strong>{status?.authorized ? '已完成知乎授权' : '使用知乎账号连接问枝'}</strong>
      <p>连接是可选的，不影响试玩。本版仅记录授权状态，不读取你的创作、关注或收藏，也不自动同步探索记录。</p>
      {notice && <p role="status">{notice}</p>}
      {status?.authorized ? <form method="post" action="/api/auth/zhihu/logout"><button type="submit">退出连接</button><small>退出只清除本站会话，不代表撤销知乎侧授权。</small></form>
        : status?.configured ? <form method="post" action="/api/auth/zhihu/start"><button type="submit">前往知乎授权 →</button></form>
          : <p>{status ? '账号连接尚未开放，当前可直接以游客体验。' : '正在检查连接状态…'}</p>}
    </div>
  </details>
}
