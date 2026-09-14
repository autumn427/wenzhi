import {useState} from 'react'
import './blue-layer-study.css'

export default function BlueLayerStudy() {
  const [plate,setPlate]=useState(false),[near,setNear]=useState(true)
  return <main className="layer-study">
    <header><div><p>问枝 · 纸雕分层验收</p><h1>先保住这张纸雕的样子。</h1></div><a href="/?paper-study=blue-fixed">查看三维对照稿 ↗</a></header>
    <div className={`layer-study-frame ${near?'is-near':''}`}>
      <img src={plate?'/blue-clean-plate-v1.png':'/career-universe-a-full.webp'} alt={plate?'移除角色后的纸雕底图候选':'原图中的刘看山在蓝色工作台前操作'} />
      <span>{plate?'底图候选 · 尚未与角色合成':'原图基准 · 非动态画面'}</span>
    </div>
    <div className="layer-study-controls">
      <a href="/?paper-study=blue-story">试玩一次蓝色路线选择 →</a>
      <div role="group" aria-label="素材对照"><button aria-pressed={!plate} onClick={()=>setPlate(false)}>原图基准</button><button aria-pressed={plate} onClick={()=>setPlate(true)}>查看移除角色后的底图</button></div>
      <button aria-pressed={near} onClick={()=>setNear(!near)}>{near?'看完整构图':'近看工作台'}</button>
    </div>
    <p className="layer-study-status" role="status">{plate?'检查桌沿、椅背与图纸有没有被重画。底图是生成候选，不能视为逐像素保真的原图。':'先以原图的角色比例、侧身姿态和纸材细节为验收标准，不再以简化模型代替。'}</p>
    <section><h2>这一轮不急着动</h2><p>当前已生成角色移除底图。角色提取候选的位置和大小发生变化，而且没有真实透明通道，因此未接入。等角色与桌面遮挡对齐后，再制作局部动作。</p><p>这是 2.5D 素材准备页，不是已经完成的分层动画。现有剧情、存档和三维交互原型保持不变。</p></section>
  </main>
}
