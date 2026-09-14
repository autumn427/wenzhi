import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './paper-foundation.css'
import './paper-redesign.css'
import './reality-echo.css'
import './readability.css'

const BluePaperStudy = React.lazy(() => import('./BluePaperStudy'))
const BlueLayerStudy = React.lazy(() => import('./BlueLayerStudy'))
const BlueStorySlice = React.lazy(() => import('./BlueStorySlice'))
const PaperTimelineStudy = React.lazy(() => import('./PaperTimelineStudy'))
const BlenderStudioStudy = React.lazy(() => import('./BlenderStudioStudy'))
const studyMode = new URLSearchParams(window.location.search).get('paper-study')
const paperStudy = studyMode === 'blue' || studyMode === 'blue-fixed'

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) {
    console.error('wenzhi_render_failed', error)
  }
  render() {
    if (this.state.failed) return <main className="paper-experience app-error-state"><h1>这一页暂时没有展开</h1><p>刚才的内容没有完整加载。重新加载后可以继续试玩。</p><button className="paper-primary" type="button" onClick={() => window.location.reload()}>重新加载</button></main>
    return this.props.children
  }
}

// Paper and Reality Echo load their own runtime styles. Keep older workspace rules
// in a separate CSS chunk so first-time demo visitors do not download 550 KB
// of unrelated selectors. Legacy study routes still receive the full sheet.
const isPaperDemo = new URLSearchParams(window.location.search).get('demo') === '1'
const legacyStylesReady = isPaperDemo ? Promise.resolve() : import('./styles.css')

legacyStylesReady.catch(() => undefined).then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppErrorBoundary>
      {studyMode === 'blender-blue' ? <React.Suspense fallback={<p>正在加载 Blender 工作室…</p>}><BlenderStudioStudy /></React.Suspense> : studyMode === 'timeline-3d' ? <React.Suspense fallback={<p>正在展开三维纸路…</p>}><PaperTimelineStudy /></React.Suspense> : <>
      {studyMode === 'blue-story' ? <React.Suspense fallback={<p>正在打开蓝色工作室…</p>}><BlueStorySlice /></React.Suspense> : studyMode === 'blue-layered' ? <React.Suspense fallback={<p>正在打开纸雕素材…</p>}><BlueLayerStudy /></React.Suspense> : paperStudy ? <React.Suspense fallback={<p>正在展开蓝色纸雕样板…</p>}><BluePaperStudy fixed={studyMode === 'blue-fixed'} /></React.Suspense> : <App />}
      </>}
      </AppErrorBoundary>
    </React.StrictMode>,
  )
})
