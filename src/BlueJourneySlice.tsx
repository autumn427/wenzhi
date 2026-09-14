import {useRef,useState,useEffect} from 'react'
import {PaperJourney3D} from './PaperJourney3D'

type Phase='departure'|'entering'|'choice'|'record'|'walking'|'destination'
const choices={debug:{title:'先修好它，再往前走',record:'排错手册',result:'你把出错的输入和修复步骤留在桌上。下一站先验证旧问题有没有再出现，原型范围暂时不扩大。'},demo:{title:'先带一个小原型上路',record:'原型边界清单',result:'你写清了目前支持的输入和暂不处理的情况。下一站先请人试用，再决定补什么。'}}
export function BlueJourneySlice(){
  const [phase,setPhase]=useState<Phase>('departure'),[choice,setChoice]=useState<keyof typeof choices|null>(null)
  const [run,setRun]=useState(0)
  const panel=useRef<HTMLElement>(null)
  const later=phase==='walking'||phase==='destination'
  const busy=phase==='entering'||phase==='walking'
  useEffect(()=>{if(phase==='choice'||phase==='destination')panel.current?.focus({preventScroll:true})},[phase])
  const arrive=()=>setPhase(p=>p==='entering'?'choice':p==='walking'?'destination':p)
  return <div className="blue-journey-slice">
    <PaperJourney3D key={run} code="A" day={later?90:30} temporal journey inRoom={phase!=='departure'} trace={choice?choices[choice].record:''} onArrive={arrive} eventTitle={later?'项目工作室':'起步阅读室'}/>
    <section className="journey-letter" ref={panel} tabIndex={-1} aria-label="当前旅途事件" aria-busy={busy}>
      <p className="journey-eyebrow">蓝色路线 · {later?'第二站 / 第 90 天':'第一站 / 第 30 天'} · 独立剧情样片</p>
      <h2>{({departure:'先走进眼前的工作室。',entering:'穿过路口，靠近工作台……',choice:'第一次跑通之后，它又出错了。',record:'带走选择，留下一页记录。',walking:'旧工作室正在退到身后……',destination:'抵达了。把上一站的问题带进来。'})[phase]}</h2>
      <p aria-live="polite">{phase==='departure'?'远处的路先不急着走完。这一站，你只需要决定如何处理一个出错的小工具。':phase==='entering'?'镜头到达工作台后，就可以做选择。':phase==='choice'?'工具终于处理好了一份表格，换一份输入却报错。你只剩下一个周末：先弄清原因，还是收紧范围、让别人试一试？':phase==='record'&&choice?choices[choice].result:phase==='walking'?'沿纸路前往项目工作室。你留在第一张桌上的记录不会消失。':choice?`你带来了「${choices[choice].record}」。${choice==='debug'?'先用三份曾出错的输入重新测试，再扩展项目。':'先让同学用真实输入试一次，记录超出边界的地方。'}`:''}</p>
      <div className="journey-actions">
        {phase==='departure'&&<button onClick={()=>setPhase('entering')}>走进第一间工作室 →</button>}
        {phase==='choice'&&(Object.keys(choices) as (keyof typeof choices)[]).map(c=><button key={c} onClick={()=>{setChoice(c);setPhase('record')}}>{choices[c].title}</button>)}
        {phase==='record'&&<button onClick={()=>setPhase('walking')}>带着这次选择，去下一站 →</button>}
        {busy&&<button onClick={()=>setPhase(phase==='entering'?'choice':'destination')}>先读抵达后的事件</button>}
        {phase==='destination'&&<button onClick={()=>{setPhase('departure');setChoice(null);setRun(n=>n+1)}}>重新走一次，尝试另一种选择</button>}
      </div>
      {choice&&<details><summary>旅途记录 · {choices[choice].record}</summary><p>第 30 天 · {choices[choice].result}</p><p>第一站桌面保留{choice==='debug'?'一本排错纸册':'一件折纸原型'}，是选择记录的示意，不代表真实学习成果。</p></details>}
      <small>本段为预设分支，不调用 AI，不写入正式存档。当前完成至第二站抵达；模型仍为原型，尚无刘看山角色动作。</small>
    </section>
  </div>
}
