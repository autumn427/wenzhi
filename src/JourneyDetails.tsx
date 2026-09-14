import { useEffect, useRef, useState } from 'react'
import type { SimulationState, UniverseRun } from './simulation'
import './journey-ending-paper-desk.css'
import { EndingSequence } from './EndingSequence'
const axes = [['technicalSkill','技术'],['aiCollaboration','AI 协作'],['domainDepth','专业'],['portfolio','作品'],['opportunity','机会'],['energy','精力']] as const
type PaperIconKind = 'route' | 'radar' | 'insight' | 'metric'

/** Small CSS-built paper cut-outs keep the page light while adding a visual cue. */
function PaperIcon({ kind }: { kind: PaperIconKind }) {
 return <span className={`paper-icon paper-icon-${kind}`} aria-hidden="true"><i/><i/><i/></span>
}
export function StateRadar(props:{run:UniverseRun; baseline?: 'previous' | 'initial' | 'timeline'}) {
 const {run} = props
 if (props.baseline !== 'timeline' && !run.route && run.currentEvent.id.startsWith('campus-')) return <section className="campus-time-notes" aria-label="课余时间与取舍">
  <h4>这条路的时间账</h4>
  <p>每周最多留出 {run.state.weeklyHours} 小时 · 课程和小组作业优先</p>
  <p>{run.decisions.length ? `已做 ${run.decisions.length} 次选择。最近一次：${run.decisions[run.decisions.length - 1].tradeoff}` : '先看看排班、出勤或备摊需要多少时间，再决定能接多少。'}</p>
  <small>这是虚构试玩；工资、工作机会和朋友的反应都需要在现实中重新确认。</small>
 </section>
 return <SkillRadar {...props}/>
}

function SkillRadar({run, baseline = 'previous'}:{run:UniverseRun; baseline?: 'previous' | 'initial' | 'timeline'}) {
 const canvas=useRef<HTMLCanvasElement>(null)
 const previous=run.decisions[baseline === 'initial' ? 0 : run.decisions.length-1]?.stateBefore
 const radarPalette = { A: { ink: '#287dcc', fillTop: 'rgba(40,125,204,.30)', fillBottom: 'rgba(40,125,204,.10)', label: '蓝色' }, B: { ink: '#c88725', fillTop: 'rgba(200,135,37,.30)', fillBottom: 'rgba(200,135,37,.10)', label: '橙色' }, C: { ink: '#4f8968', fillTop: 'rgba(79,137,104,.30)', fillBottom: 'rgba(79,137,104,.10)', label: '绿色' } } as const
 const routePalette = radarPalette[run.code]
 const routeTitle = run.route?.title ?? ({ A: '去店里兼职', B: '投第一份实习', C: '和朋友摆市集' } as const)[run.code]
 const timelineSnapshots: Array<{key:string;label:string;state:SimulationState}> = baseline !== 'previous'
  ? [
    ...(run.decisions[0]?.stateBefore ? [{key:'day-30',label:'30天',state:run.decisions[0].stateBefore}] : []),
    ...run.decisions.flatMap((decision) => {
      const nextDay = decision.day === 30 ? 90 : decision.day === 90 ? 150 : 180
      return decision.stateAfter ? [{key:`day-${nextDay}`,label:`${nextDay}天`,state:decision.stateAfter}] : []
    }),
   ]
  : []
 const [selectedStageKey,setSelectedStageKey]=useState('day-180')
 const selectedSnapshot=timelineSnapshots.find((snapshot)=>snapshot.key===selectedStageKey)
 const displayState=selectedSnapshot?.state ?? run.state
 const priorStageKey:Record<string,string>={'day-90':'day-30','day-150':'day-90','day-180':'day-150'}
 const comparisonState=baseline === 'timeline' ? timelineSnapshots.find(snapshot=>snapshot.key===priorStageKey[selectedStageKey])?.state : baseline === 'initial' && selectedStageKey === 'day-30' ? undefined : previous
 useEffect(()=>{setSelectedStageKey(baseline !== 'previous' ? 'day-180' : 'current')},[run.code,run.currentEvent.id,baseline])
 useEffect(()=>{
  const el=canvas.current; if(!el)return
  const ctx=el.getContext('2d');if(!ctx)return
  const size=420,dpr=Math.min(2.5,window.devicePixelRatio||1);el.width=size*dpr;el.height=size*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size)
  const center=[210,205] as const
  const radius=142
  const point=(i:number,v:number,scale=radius)=>{const a=i*Math.PI/3-Math.PI/2;const value=Math.max(0,Math.min(100,v));return [center[0]+Math.cos(a)*scale*value/100,center[1]+Math.sin(a)*scale*value/100] as const}
  const atScale=(i:number,scale:number)=>{const a=i*Math.PI/3-Math.PI/2;return [center[0]+Math.cos(a)*scale,center[1]+Math.sin(a)*scale] as const}
  const points=(state:SimulationState,scale=radius)=>axes.map(([key],i)=>point(i,state[key],scale))
  const path=(vertices:ReadonlyArray<readonly [number,number]>)=>{ctx.beginPath();vertices.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath()}
  const polygon=(state:SimulationState,color:string,fill:CanvasGradient|string,dash:number[])=>{const vertices=points(state);path(vertices);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);vertices.forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,4.2,0,Math.PI*2);ctx.fillStyle='#fffaf1';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke()})}
  const paperTag=(text:string,x:number,y:number,font:string,color:string,kind:'axis'|'value'='value')=>{ctx.save();ctx.font=font;const width=ctx.measureText(text).width+(kind==='axis'?18:14);const height=kind==='axis'?27:21;ctx.translate(x,y);ctx.shadowColor='rgba(93,69,37,.20)';ctx.shadowBlur=4;ctx.shadowOffsetX=2;ctx.shadowOffsetY=3;ctx.fillStyle='#fffaf0';ctx.beginPath();ctx.moveTo(-width/2,-height/2+2);ctx.lineTo(-width/2+4,-height/2);ctx.lineTo(width/2-3,-height/2+1);ctx.lineTo(width/2,-height/2+4);ctx.lineTo(width/2-1,height/2-2);ctx.lineTo(width/2-4,height/2);ctx.lineTo(-width/2+2,height/2-1);ctx.closePath();ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle=kind==='axis'?'#d6c5a9':'#eadfce';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,0,0);ctx.restore()}
  // Layered cardstock underlay makes the chart feel cut from the same paper
  // as the rest of the journey, while keeping the canvas payload tiny.
  const outer=axes.map((_,i)=>atScale(i,190)); path(outer); ctx.save(); ctx.translate(3,5); ctx.fillStyle='rgba(111,84,52,.14)'; ctx.fill(); ctx.restore(); path(outer); ctx.fillStyle='#f4eadb'; ctx.fill(); ctx.strokeStyle='#d2c1a8'; ctx.lineWidth=1.5; ctx.stroke();
  const inner=axes.map((_,i)=>atScale(i,178)); path(inner); ctx.fillStyle='rgba(255,252,244,.62)'; ctx.fill(); ctx.strokeStyle='#e1d5c3'; ctx.lineWidth=1; ctx.stroke();
  // Alternating paper-toned rings add depth while keeping the chart calm.
  for(let level=100;level>=20;level-=20){const ring=points({technicalSkill:level,aiCollaboration:level,domainDepth:level,portfolio:level,opportunity:level,confidence:level,energy:level} as SimulationState);path(ring);ctx.fillStyle=level%40===0?'rgba(255,255,255,.22)':'rgba(239,230,214,.18)';ctx.fill();ctx.strokeStyle=level===100?'#cbbda8':'#ddd3c5';ctx.lineWidth=level===100?1.4:1;ctx.stroke()}
  axes.forEach(([key,label],i)=>{const [x,y]=point(i,100);ctx.beginPath();ctx.moveTo(center[0],center[1]);ctx.lineTo(x,y);ctx.strokeStyle='#d6ccbc';ctx.lineWidth=1;ctx.stroke();const [tx,ty]=atScale(i,166);paperTag(label,tx,ty,'600 16px "Noto Serif SC", serif','#514638','axis')})
  ctx.beginPath();ctx.arc(center[0],center[1],3,0,Math.PI*2);ctx.fillStyle='#9a8b76';ctx.fill()
  if(comparisonState)polygon(comparisonState,'#c34d48','rgba(195,77,72,.12)',[6,4])
  const currentGradient=ctx.createLinearGradient(center[0],center[1]-radius,center[0],center[1]+radius);currentGradient.addColorStop(0,routePalette.fillTop);currentGradient.addColorStop(1,routePalette.fillBottom)
  polygon(displayState,routePalette.ink,currentGradient,[])
  // Value tags sit just beyond each vertex. They remain readable even when a
  // value is low by keeping a minimum radial offset from the centre.
  axes.forEach(([key],i)=>{const value=displayState[key]; const spoke=Math.max(31, radius*value/100+14); const [x,y]=atScale(i,spoke); paperTag(String(value),x,y,'700 12px "Noto Serif SC", serif',routePalette.ink,'value')})
  if(comparisonState) axes.forEach(([key],i)=>{const value=comparisonState[key]; const spoke=Math.max(27, radius*value/100+8); const [x,y]=atScale(i,spoke); ctx.font='600 10px "Noto Serif SC", serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#a6403c'; ctx.fillText(String(value),x+10,y+10)})
  // Small registration marks reinforce the layered, hand-cut construction.
  ctx.fillStyle='rgba(137,112,77,.45)'; [[34,34],[386,34],[34,376],[386,376]].forEach(([x,y])=>{ctx.fillRect(x,y,3,3)})
 },[displayState,comparisonState,run.code])
 return <section className={`state-radar radar-tone-${run.code.toLowerCase()}`}><div className="paper-section-heading"><PaperIcon kind="radar"/><h4>能力与精力</h4></div><p className="ending-radar-key radar-legend"><span><i className="radar-dot radar-dot-current" />{routePalette.label} · 当前</span>{comparisonState && <span><i className="radar-dot radar-dot-start" />红色 · {baseline === 'initial' ? '起始' : '上次'}</span>}<span className={`radar-route radar-route-${run.code.toLowerCase()}`}><i />宇宙 {run.code} · {routeTitle}</span></p>{timelineSnapshots.length > 1 && <div className="radar-timeline" role="group" aria-label="选择要查看的时间节点">{timelineSnapshots.map((snapshot)=><button key={snapshot.key} type="button" className={selectedStageKey === snapshot.key ? 'is-selected' : ''} aria-pressed={selectedStageKey === snapshot.key} onClick={()=>setSelectedStageKey(snapshot.key)}>{snapshot.label}</button>)}</div>}<div className={`radar-stage radar-stage-${run.code.toLowerCase()}`}><canvas ref={canvas} role="img" aria-label={`${routePalette.label}为${selectedSnapshot?.label ?? '当前'}能力${comparisonState ? `，红色为${baseline === 'initial' ? '起始' : '上一次'}能力` : ''}。图中数字为所选节点值。${axes.map(([key,label])=>`${label}：当前 ${displayState[key]}，对比 ${comparisonState?.[key]??'暂无记录'}`).join('；')}`}/><div className="radar-mascot" aria-label="刘看山正在观察这张能力图"><img loading="lazy" decoding="async" src="/kanshan-idle.gif" alt="刘看山"/><span>我来帮你读这张图</span></div></div><details className="radar-data"><summary>查看详细数值</summary><table><caption>{selectedSnapshot ? `${selectedSnapshot.label}能力数据` : baseline === 'initial' ? '半年变化数据' : '当前能力与上次记录'}</caption><thead><tr><th scope="col">维度</th><th scope="col">当前</th><th scope="col">对比</th><th scope="col">变化</th></tr></thead><tbody>{axes.map(([key,label])=>{const current=displayState[key];const prior=comparisonState?.[key];const delta=prior === undefined ? null : current-prior;const deltaClass=delta === null ? '' : delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat';return <tr key={key}><th scope="row">{label}</th><td>{current}</td><td>{prior ?? '—'}</td><td className={deltaClass}><span>{delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}</span></td></tr>})}</tbody></table></details></section>
}
export function PathHistory({run,initial}:{run:UniverseRun;initial:string}) {
 const [selected,setSelected]=useState<string|null>(null)
 const decision=run.decisions.find(d=>d.eventId===selected)
 return <section className="path-history"><div className="paper-section-heading"><PaperIcon kind="route"/><h4>时间线回看</h4></div><p className="history-start"><PaperIcon kind="metric"/><span>起点 · {initial}</span></p><ol className="history-points" aria-label="这条路上的选择时间线">{run.decisions.map(d=><li key={d.eventId}><button type="button" onClick={()=>setSelected(d.eventId)} aria-current={selected===d.eventId ? 'step' : undefined}><PaperIcon kind="route"/><span className="history-copy"><small>第 {d.day} 天 · 回看</small><strong>{d.choiceLabel}</strong></span></button></li>)}<li><button type="button" onClick={()=>setSelected(null)} aria-current={!selected ? 'step' : undefined}><PaperIcon kind="route"/><span className="history-copy"><small>第 {run.currentEvent.day} 天 · 当前</small><strong>{run.currentEvent.title}</strong></span></button></li></ol>{decision&&<article className="history-preview"><span>历史回看 · 选择已锁定</span><h5>{decision.eventTitle}</h5><p>{decision.eventSnapshot?.story??decision.eventTension??'这条旧记录未保存完整故事。'}</p>{decision.eventSnapshot?.choices.map(c=><div key={c.id} className={c.id===decision.choiceId?'was-chosen':''}>{c.id===decision.choiceId?'当时选择：':'另一选项：'}{c.label}</div>)}{!decision.eventSnapshot?.choices.some(c=>c.id===decision.choiceId)&&<p>当时选择：{decision.choiceLabel}</p>}<p>{decision.actionOutcome?.tradeoff??decision.tradeoff}</p></article>}</section>
}

export function JourneyEnding({run,onContinue,continueLabel,onReplay}:{run:UniverseRun;onContinue:()=>void;continueLabel:string;onReplay?:()=>void}) {
 return <EndingSequence key={`${run.code}-${run.currentEvent.id}`} run={run} onContinue={onContinue} continueLabel={continueLabel} onReplay={onReplay} radar={<StateRadar run={run} baseline="timeline"/>}/>
}

const ticketLabels: Record<string, string> = {technicalSkill:'技术',aiCollaboration:'AI 协作',domainDepth:'专业',portfolio:'作品',opportunity:'机会',confidence:'信心',energy:'精力',weeklyHours:'投入'}
export function JourneyTickets({run,startIndex=0}:{run:UniverseRun;startIndex?:number}) {
 return <section className="journey-tickets" aria-label="每次选择的故事票根">
  {run.decisions.length ? run.decisions.map((decision,index)=> {
   const changes=Object.entries(decision.delta).map(([key,value])=> {
    const metric=key as keyof typeof decision.delta
    return [key,decision.stateBefore && decision.stateAfter ? decision.stateAfter[metric]-decision.stateBefore[metric] : value] as const
   }).filter(([,value])=>value!==0)
   return <article className="journey-ticket" key={`${run.code}-${decision.eventId}`}>
    <header><span>宇宙 {run.code} · 第 {decision.day} 天</span><b>{String(startIndex+index+1).padStart(2,'0')}</b></header>
    <p className="ticket-story">{decision.eventSnapshot?.story ?? '这条旧记录没有保存当时的完整故事。'}</p>
    <section className="ticket-choice"><small>当时的选择</small><strong>{decision.choiceLabel}</strong></section>
    <div className="ticket-changes" aria-label="这次选择的能力变化">{changes.length ? changes.map(([key,value])=><span key={key} className={value>0?'up':'down'}>{ticketLabels[key]??key} {value>0?'+':''}{value}</span>) : <span>能力值未变化</span>}</div>
   </article>
  }) : <p className="ticket-empty">完成一次选择后，这里会留下当时的故事与变化。</p>}
 </section>
}

