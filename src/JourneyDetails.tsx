import { PaperAccent } from './PaperAccent'
import { useEffect, useRef, useState } from 'react'
import type { SimulationState, UniverseRun } from './simulation'
import './journey-ending-paper-desk.css'
const axes = [['technicalSkill','技术'],['aiCollaboration','AI 协作'],['domainDepth','专业'],['portfolio','作品'],['opportunity','机会'],['energy','精力']] as const
type PaperIconKind = 'route' | 'radar' | 'insight' | 'metric'

/** Small CSS-built paper cut-outs keep the page light while adding a visual cue. */
function PaperIcon({ kind }: { kind: PaperIconKind }) {
 return <span className={`paper-icon paper-icon-${kind}`} aria-hidden="true"><i/><i/><i/></span>
}
export function StateRadar({run, baseline = 'previous'}:{run:UniverseRun; baseline?: 'previous' | 'initial'}) {
 const canvas=useRef<HTMLCanvasElement>(null)
 const previous=run.decisions[baseline === 'initial' ? 0 : run.decisions.length-1]?.stateBefore
 const radarPalette = { A: { ink: '#287dcc', fillTop: 'rgba(40,125,204,.30)', fillBottom: 'rgba(40,125,204,.10)', label: '蓝色' }, B: { ink: '#c88725', fillTop: 'rgba(200,135,37,.30)', fillBottom: 'rgba(200,135,37,.10)', label: '橙色' }, C: { ink: '#4f8968', fillTop: 'rgba(79,137,104,.30)', fillBottom: 'rgba(79,137,104,.10)', label: '绿色' } } as const
 const routePalette = radarPalette[run.code]
 const routeTitle = run.route?.title ?? ({ A: '系统学习', B: 'AI 协作', C: '专业深耕' } as const)[run.code]
 const timelineSnapshots: Array<{key:string;label:string;state:SimulationState}> = baseline === 'initial'
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
 const comparisonState=baseline === 'initial' && selectedStageKey === 'day-30' ? undefined : previous
 useEffect(()=>{setSelectedStageKey(baseline === 'initial' ? 'day-180' : 'current')},[run.code,run.currentEvent.id,baseline])
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

const routeCardColors: Record<UniverseRun['code'], {ink:string; soft:string}> = { A: {ink:'#315f80',soft:'#e6eef3'}, B: {ink:'#aa762d',soft:'#f3ead8'}, C: {ink:'#486c52',soft:'#e5eee5'} }
const cardLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
 const lines: string[] = []; let line = ''
 for (const char of text) { const next = line + char; if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = char } else line = next }
 if (line) lines.push(line)
 return lines
}
const drawCardRadar = (ctx: CanvasRenderingContext2D, run: UniverseRun, baseline?: SimulationState) => {
 const cx = 600, cy = 900, radius = 205
 const routeInk = routeCardColors[run.code].ink
 const routeFill = run.code === 'A' ? 'rgba(49,95,128,.22)' : run.code === 'B' ? 'rgba(170,118,45,.22)' : 'rgba(72,108,82,.22)'
 const point = (i:number,v:number,r=radius) => { const a=i*Math.PI/3-Math.PI/2; const value=Math.max(0,Math.min(100,v)); return [cx+Math.cos(a)*r*value/100,cy+Math.sin(a)*r*value/100] as const }
 const atScale = (i:number,r:number) => { const a=i*Math.PI/3-Math.PI/2; return [cx+Math.cos(a)*r,cy+Math.sin(a)*r] as const }
 const polygon = (state: SimulationState, stroke:string, fill:string, dash:number[] = []) => { const pts=axes.map(([key],i)=>point(i,state[key])); ctx.beginPath(); pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath(); ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=4;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]) }
 const outer=axes.map((_,i)=>atScale(i,265));ctx.beginPath();outer.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.save();ctx.translate(7,10);ctx.fillStyle='rgba(111,84,52,.12)';ctx.fill();ctx.restore();ctx.fillStyle='#f4eadb';ctx.fill();ctx.strokeStyle='#d2c1a8';ctx.lineWidth=3;ctx.stroke();
 for(let level=100;level>=20;level-=20){const pts=axes.map((_,i)=>point(i,level));ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=level%40===0?'rgba(255,255,255,.20)':'rgba(239,230,214,.15)';ctx.fill();ctx.strokeStyle='#d8cdbd';ctx.lineWidth=2;ctx.stroke()}
 axes.forEach(([key,label],i)=>{const [x,y]=point(i,100);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.strokeStyle='#d8cdbd';ctx.lineWidth=2;ctx.stroke();const [tx,ty]=atScale(i,245);ctx.font='600 25px "Noto Serif SC", serif';ctx.fillStyle='#514638';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,tx,ty)})
 if (baseline) polygon(baseline,'#c34d48','rgba(195,77,72,.10)',[10,7]); polygon(run.state,routeInk,routeFill)
 axes.forEach(([key],i)=>{const value=run.state[key];const [x,y]=atScale(i,Math.max(54,radius*value/100+22));ctx.font='700 18px "Noto Serif SC", serif';ctx.textAlign='center';ctx.textBaseline='middle';const w=ctx.measureText(String(value)).width+18;ctx.fillStyle='rgba(255,252,244,.95)';ctx.fillRect(x-w/2,y-15,w,30);ctx.fillStyle=routeInk;ctx.fillText(String(value),x,y)})
}
const resultCardBlob = (run: UniverseRun, endingMetrics: Array<{label:string;gain:number|null}>): Promise<Blob|null> => new Promise(resolve => {
 const canvas = document.createElement('canvas'); canvas.width=1200; canvas.height=1500; const ctx=canvas.getContext('2d'); if(!ctx){resolve(null);return}
 const colors=routeCardColors[run.code]; ctx.fillStyle='#faf5eb';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=colors.ink;ctx.fillRect(0,0,canvas.width,22)
 ctx.fillStyle='#756954';ctx.font='500 28px "Noto Serif SC", serif';ctx.fillText(`问枝 · 宇宙 ${run.code}`,80,100);ctx.fillStyle='#2b2925';ctx.font='600 58px "Noto Serif SC", serif';ctx.fillText('走过这半年',80,180)
 ctx.fillStyle=colors.soft;ctx.fillRect(80,220,1040,76);ctx.fillStyle=colors.ink;ctx.font='600 30px "Noto Serif SC", serif';ctx.fillText(run.currentEvent.title,108,270)
 ctx.fillStyle='#514638';ctx.font='400 28px "Noto Serif SC", serif';let y=360;for(const line of cardLines(ctx,run.currentEvent.story,980)){ctx.fillText(line,80,y);y+=48;if(y>620)break}
 drawCardRadar(ctx,run,run.decisions[0]?.stateBefore); ctx.fillStyle='#756954';ctx.font='500 24px "Noto Serif SC", serif';const routeLabel=run.code==='A'?'蓝色':run.code==='B'?'橙色':'绿色';ctx.fillText(`${routeLabel} · 最终    红色 · 起始    宇宙 ${run.code} 路线`,80,1165)
 ctx.fillStyle='#2b2925';ctx.font='600 28px "Noto Serif SC", serif';ctx.fillText('关键变化',80,1235);ctx.font='500 25px "Noto Serif SC", serif';endingMetrics.forEach(({label,gain},i)=>{const col=i%3,row=Math.floor(i/3);const x=80+col*350, yy=1285+row*70;ctx.fillStyle='#756954';ctx.fillText(label,x,yy);ctx.fillStyle=gain===null?'#756954':gain>0?'#258458':gain<0?'#c34d48':'#756954';ctx.font='600 28px "Noto Serif SC", serif';ctx.fillText(gain===null?'—':`${gain>0?'+':''}${gain}`,x+170,yy);ctx.font='500 25px "Noto Serif SC", serif'})
 ctx.fillStyle='#9a8b76';ctx.font='400 20px "Noto Serif SC", serif';ctx.fillText('规则驱动的互动模拟 · 不代表现实预测',80,1450);canvas.toBlob(resolve,'image/png')
})

export function JourneyEnding({run,onContinue,continueLabel,onReplay}:{run:UniverseRun;onContinue:()=>void;continueLabel:string;onReplay?:()=>void}) {
 const [shareState,setShareState]=useState<'idle'|'copied'|'shared'|'downloaded'>('idle')
 useEffect(()=>{document.querySelector('.wz-view.wz-universes')?.scrollTo({top:0,behavior:'instant'})},[run.code])
 const first=run.decisions[0]?.stateBefore
 const ranking=axes.filter(([key])=>key!=='energy').map(([key,label])=>({key,label,gain:first?run.state[key]-first[key]:0})).sort((a,b)=>b.gain-a.gain)
 const growth=ranking[0]
 const keyDecision=[...run.decisions].sort((a,b)=>(b.delta[growth.key]??0)-(a.delta[growth.key]??0))[0]
 const outward=run.decisions.filter(d=>(d.delta.portfolio??0)>0 || (d.delta.opportunity??0)>0)
 const cost=[...run.decisions].sort((a,b)=>(a.delta.energy??0)-(b.delta.energy??0))[0]
 const endingMetrics=axes.map(([key,label])=>({key,label,gain:first ? run.state[key]-first[key] : null}))
 const downloadCard=async()=>{const blob=await resultCardBlob(run,endingMetrics);if(!blob)return;const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`wenzhi-${run.code}-180-days.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setShareState('downloaded')}
 const shareResult=async()=>{
  const changes=endingMetrics.filter(({gain})=>gain!==null).map(({label,gain})=>`${label} ${gain! > 0 ? '+' : ''}${gain}`).join(' · ')
  const text=[`问枝 · 宇宙 ${run.code} · ${run.currentEvent.title}`,`180天后：${run.currentEvent.story}`,`这条路的变化：${changes || '暂无起始记录'}`,`这是一段规则驱动的互动模拟，不是现实预测。`].join('\n')
  const shareApi=navigator as Navigator & { share?: (data:{title?:string;text?:string;files?:File[]})=>Promise<void>; canShare?: (data:{files?:File[]})=>boolean }
  try {
   const blob=await resultCardBlob(run,endingMetrics); const file=blob ? new File([blob],`wenzhi-${run.code}-180-days.png`,{type:'image/png'}) : null
   if (shareApi.share && file && shareApi.canShare?.({files:[file]})) { await shareApi.share({title:`问枝 · 宇宙 ${run.code}`,text,files:[file]}); setShareState('shared'); return }
   if (blob) { await downloadCard(); return }
   await navigator.clipboard.writeText(text); setShareState('copied')
  } catch { setShareState('idle') }
 }
 const observations=[
  {title:'你把投入放在了哪里',body:first && growth.gain>0 ? `这条路线里，${growth.label}的变化最明显。“${keyDecision?.choiceLabel}”是其中一次具体投入。` : '这条路线没有显示出明确的能力增长。行动留下的线索，比急着给自己下结论更有用。'},
  {title:'你怎样让事情往前走',body:outward.length ? `有 ${outward.length} 次选择把精力用在作品或外部机会。“${outward[outward.length-1].choiceLabel}”让这条路从想法走向了具体行动。` : `“${run.decisions[run.decisions.length-1]?.choiceLabel ?? '继续探索'}”保留了你的方向。这段经历里，外部反馈仍然有限。`},
  {title:'你为这条路付出了什么',body:!first ? '这条旧记录没有起始快照，无法判断精力的整体变化。可以回看已保存的行动与代价。' : run.state.energy<first.energy ? `精力比出发时更少了。“${cost?.choiceLabel}”也占用了你的余力；这些投入能否长期维持，值得带回现实再试一试。` : '到结束时，你仍保留了起始的精力水平。这条路上的取舍，没有表现为持续透支；其他代价仍要结合现实判断。'},
 ]
 return <section className="journey-ending ending-paper-desk" tabIndex={-1} aria-label="这条路线的故事结尾">
  <header className="ending-desk-header"><PaperAccent kind="return-envelope" placement="ending" /><div className="ending-desk-meta"><span className="ending-desk-stamp">RETURN / 180</span><span>宇宙 {run.code} · 第 180 天</span></div><h2>{run.currentEvent.title}</h2><p>{run.currentEvent.story}</p><aside className="ending-envelope-note" aria-label="返程信笺"><span>返程信笺</span><strong>把这段旅程带回现实</strong><p>留下一件小事，试 7 天再回来。</p><b>已封存</b></aside></header>
  <div className="ending-desk-board"><div className="ending-desk-line" aria-hidden="true"/><div className="ending-desk-index ending-desk-index-reflection" aria-hidden="true"><b>01</b><span>回望选择</span></div><div className="ending-desk-index ending-desk-index-radar" aria-hidden="true"><b>02</b><span>读取变化</span></div><div className="ending-reflection"><div><div className="paper-section-heading"><PaperIcon kind="insight"/><h3>从你的选择里，看到了这些</h3></div><ol>{observations.map((o,index)=><li key={o.title}><PaperIcon kind={index === 1 ? 'route' : index === 2 ? 'metric' : 'insight'}/><div><h4>{o.title}</h4><p>{o.body}</p></div></li>)}</ol></div><div className={`ending-radar-column route-tone-${run.code.toLowerCase()}`}><StateRadar run={run} baseline="initial"/><div className="ending-metrics" aria-label="这条路线的半年变化">{endingMetrics.map(({key,label,gain})=><div className={gain === null ? '' : gain > 0 ? 'up' : gain < 0 ? 'down' : 'flat'} key={key}><PaperIcon kind="metric"/><span><small>{label}</small><strong>{gain === null ? '—' : `${gain > 0 ? '+' : ''}${gain}`}</strong></span></div>)}</div><p className="ending-metrics-note">数值只用于回看这次模拟，不代表现实能力测评。</p></div></div></div>
  <footer className="ending-desk-footer"><small>{continueLabel.includes('实验') ? '把一件小事带回现实，试 7 天再回来。' : '再走一条路，比较不同取舍。'}</small><div className="journey-ending-actions">{onReplay && <button className="ending-share ending-replay" type="button" onClick={onReplay}>重新走一遍</button>}<button className="ending-share" type="button" onClick={() => void shareResult()}>{shareState === 'shared' ? '已打开分享' : shareState === 'copied' ? '结果已复制' : shareState === 'downloaded' ? '结果卡已下载' : '分享结果卡'}</button><button className="ending-share ending-card-download" type="button" onClick={() => void downloadCard()}>下载 PNG</button><button className="paper-primary" onClick={onContinue}>{continueLabel}</button></div></footer>
 </section>
}

const ticketLabels: Record<string, string> = {technicalSkill:'技术',aiCollaboration:'AI 协作',domainDepth:'专业',portfolio:'作品',opportunity:'机会',confidence:'信心',energy:'精力',weeklyHours:'投入'}
export function JourneyTickets({run}:{run:UniverseRun}) {
 return <section className="journey-tickets" aria-label="每次选择的故事票根">
  {run.decisions.length ? run.decisions.map((decision,index)=> {
   const changes=Object.entries(decision.delta).map(([key,value])=> {
    const metric=key as keyof typeof decision.delta
    return [key,decision.stateBefore && decision.stateAfter ? decision.stateAfter[metric]-decision.stateBefore[metric] : value] as const
   }).filter(([,value])=>value!==0)
   return <article className="journey-ticket" key={`${run.code}-${decision.eventId}`}>
    <header><span>宇宙 {run.code} · 第 {decision.day} 天</span><b>{String(index+1).padStart(2,'0')}</b></header>
    <p className="ticket-story">{decision.eventSnapshot?.story ?? '这条旧记录没有保存当时的完整故事。'}</p>
    <section className="ticket-choice"><small>当时的选择</small><strong>{decision.choiceLabel}</strong></section>
    <div className="ticket-changes" aria-label="这次选择的能力变化">{changes.length ? changes.map(([key,value])=><span key={key} className={value>0?'up':'down'}>{ticketLabels[key]??key} {value>0?'+':''}{value}</span>) : <span>能力值未变化</span>}</div>
   </article>
  }) : <p className="ticket-empty">完成一次选择后，这里会留下当时的故事与变化。</p>}
 </section>
}

