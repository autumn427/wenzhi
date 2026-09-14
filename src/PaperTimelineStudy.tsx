import {useState} from 'react'
import {PaperJourney3D} from './PaperJourney3D'
import type {UniverseCode} from './simulation'
import './paper-timeline-study.css'
import {BlueJourneySlice} from './BlueJourneySlice'
const days=[30,90,150,180]
const routes={A:{name:'蓝色 · 系统学习',rooms:['起步阅读室','项目工作室','调试工作室','成果档案室']},B:{name:'金色 · AI 协作',rooms:['任务工坊','原型工坊','校验工坊','协作工坊']},C:{name:'绿色 · 专业深耕',rooms:['种子苗圃','实践苗圃','观察温室','专业花园']}}
export default function PaperTimelineStudy(){
  const [code,setCode]=useState<UniverseCode>('A'),[indices,setIndices]=useState({A:0,B:0,C:0})
  const [mode,setMode]=useState<'journey'|'map'>('journey')
  const index=indices[code],route=routes[code]
  const go=(next:number)=>setIndices(old=>({...old,[code]:Math.max(0,Math.min(3,next))}))
  return <main className="paper-timeline"><header><p>问枝 · 三维时间路线样板</p><h1>沿着纸路，走进下一间工作室。</h1><a href="/?paper-study=blue-layered">保留的素材验收页 ↗</a></header>
    <div className="paper-timeline-mode"><button aria-pressed={mode==='journey'} onClick={()=>setMode('journey')}>走一段蓝色旅程</button><button aria-pressed={mode==='map'} onClick={()=>setMode('map')}>三色路线总览</button><a href="/?paper-study=blender-blue">查看 Blender 模型验收页 ↗</a></div>
    {mode==='journey'?<BlueJourneySlice/>:<>
    <nav aria-label="选择纸雕路线">{(['A','B','C'] as const).map(c=><button key={c} aria-pressed={c===code} onClick={()=>setCode(c)}>{routes[c].name}</button>)}</nav>
    <div className="paper-timeline-days" role="group" aria-label="选择时间">{days.map((day,i)=><button key={day} aria-pressed={index===i} onClick={()=>go(i)}><strong>第 {day} 天</strong><span>{route.rooms[i]}</span></button>)}</div>
    <PaperJourney3D code={code} day={days[index]} eventTitle={route.rooms[index]} temporal/>
    <div className="paper-timeline-next"><button disabled={!index} onClick={()=>go(index-1)}>← 上一站</button><p aria-live="polite">已展开 {index+1} / 4 个时间站点</p><button disabled={index===3} onClick={()=>go(index+1)}>展开下一间工作室 →</button></div>
    <p>真实三维几何，不是图片轮播。三条路线各有四个阶段，未到达的工作室暂不展开。当前为独立美术与时间预演，尚未绑定正式剧情选择，也未加入刘看山动作；切换路线保留本页进度，刷新重置。不修改正式存档。</p></>}
  </main>
}
