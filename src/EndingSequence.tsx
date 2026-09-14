import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { UniverseRun } from './simulation'
import { galSceneAssets } from './gal-scene-assets'
import './ending-sequence.css'

const art = '/assets/galgame/ending-ticket-paper.png'
const stamp = '/assets/galgame/checked-ticket-stamp.png'
const routeNames = { A: '去店里兼职', B: '投第一份实习', C: '和朋友摆市集' }

// The effect lives outside the scrolling story panel, so it fills the viewport.
function PaperCelebration() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let width = innerWidth, height = innerHeight, frame = 0, start = 0
    const resize = () => { width = innerWidth; height = innerHeight; const dpr = Math.min(devicePixelRatio, 2); canvas.width = width*dpr; canvas.height = height*dpr; ctx.setTransform(dpr,0,0,dpr,0,0) }
    resize(); window.addEventListener('resize', resize)
    const colors = ['#448bcc','#dbaa51','#739578','#e9c9ac','#fff1d2']
    const pieces = Array.from({length:140}, (_,i) => ({x:Math.random(), y:-Math.random()*height, speed:75+Math.random()*110, phase:Math.random()*6.28, color:colors[i%colors.length]}))
    const draw = (now:number) => {
      if (!start) start=now
      const time=(now-start)/1000
      ctx.clearRect(0,0,width,height)
      for (const p of pieces) {
        ctx.save();ctx.globalAlpha=Math.min(1,Math.max(0,7-time));ctx.translate(p.x*width+Math.sin(time+p.phase)*55,p.y+time*p.speed);ctx.rotate(time*2+p.phase);ctx.scale(Math.cos(time*3+p.phase),1);ctx.fillStyle=p.color;ctx.fillRect(-5,-8,10,16);ctx.restore()
      }
      if(time<7) frame=requestAnimationFrame(draw)
    }
    frame=requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize',resize) }
  }, [])
  return createPortal(<canvas ref={ref} className="ending-confetti" aria-hidden="true"/>,document.body)
}

const loadImage = (src:string) => new Promise<HTMLImageElement>((resolve,reject) => {const image = new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src})
function wrapText(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,lineHeight:number) {
  let line=''
  for(const char of text){if(ctx.measureText(line+char).width>width){ctx.fillText(line,x,y);line=char;y+=lineHeight}else line+=char}
  ctx.fillText(line,x,y)
}

export function EndingSequence({run,radar,onContinue,continueLabel,onReplay}:{run:UniverseRun;radar:ReactNode;onContinue:()=>void;continueLabel:string;onReplay?:()=>void}) {
  const [scene,setScene]=useState(0)
  const [download,setDownload]=useState<'idle'|'pending'|'done'|'error'>('idle')
  const heading=useRef<HTMLHeadingElement>(null)
  const root=useRef<HTMLElement>(null)
  const paragraphs=run.currentEvent.story.match(/[^。！？!?]+[。！？!?]?/g)?.filter(Boolean) ?? [run.currentEvent.story]
  // At most two sentences per beat: keep the complete ending without a wall of text.
  const storyBeats=Array.from({length:Math.ceil(paragraphs.length/2)},(_,i)=>paragraphs.slice(i*2,i*2+2).join(''))
  const radarScene=storyBeats.length+run.decisions.length
  const ticketScene=radarScene+1
  const decision=scene>=storyBeats.length && scene<radarScene ? run.decisions[scene-storyBeats.length] : undefined
  const isTicket=scene===ticketScene
  const title=isTicket ? '这半年，留一张票根。' : scene===radarScene ? '看看一路发生的变化' : decision ? `第 ${decision.day} 天，你这样选择` : run.currentEvent.title
  const route=run.route?.title ?? routeNames[run.code]
  useEffect(()=>{root.current?.scrollIntoView({block:'start',behavior:'instant'});heading.current?.focus({preventScroll:true})},[scene])
  const saveTicket=async()=>{
    setDownload('pending')
    try {
      const [background,seal]=await Promise.all([loadImage(art),loadImage(stamp)])
      const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=850
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable')
      ctx.drawImage(background,0,0,1800,850);ctx.fillStyle='#302d26';ctx.font='600 62px serif';wrapText(ctx,'走过的路，\n都算数。'.replace('\n',''),65,225,400,84)
      ctx.font='28px serif';wrapText(ctx,run.currentEvent.title,65,455,390,44)
      ctx.font='24px serif';ctx.fillText(`问枝 · 宇宙 ${run.code}`,1510,95);wrapText(ctx,route,1510,155,220,36);ctx.fillText('第 180 天 · 已抵达',1510,290)
      ctx.font='20px serif';ctx.fillText(`${run.decisions.length} 次选择 · 一段自己的路`,1510,340)
      ctx.globalCompositeOperation='multiply';ctx.drawImage(seal,1510,470,225,225);ctx.globalCompositeOperation='source-over'
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('No image')
      const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`问枝-宇宙${run.code}-180天票根.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setDownload('done')
    } catch {setDownload('error')}
  }
  return <section ref={root} className={`ending-sequence ending-tone-${run.code.toLowerCase()} ${isTicket?'is-ticket':''}`} aria-label="这条路线的故事结尾" style={{backgroundImage:`url(${galSceneAssets(run.code,180).background})`}}>
    <div className="ending-sequence-shade"/>
    <header className="ending-sequence-header"><span>宇宙 {run.code} / 第 180 天</span><span>{scene+1} / {ticketScene+1}</span></header>
    <main className={`ending-beat ${scene===radarScene?'is-radar':''}`} key={scene}>
      <h2 ref={heading} tabIndex={-1}>{title}</h2>
      {scene<storyBeats.length && <div className="ending-narration"><span>半年后的你</span><p>{storyBeats[scene]}</p><img src="/kanshan-wave.gif" alt="刘看山"/></div>}
      {decision && <article className="ending-memory"><small>当时的选择</small><h3>{decision.choiceLabel}</h3><p>{decision.actionOutcome?.tradeoff ?? decision.tradeoff}</p></article>}
      {scene===radarScene && <div className="ending-radar-scene">{radar}<p>实线是所选节点，虚线是上一节点。数值来自这次模拟。</p></div>}
      {isTicket && <><PaperCelebration/><article className="ending-souvenir" aria-label="180天纪念票根"><img className="ending-ticket-art" src={art} alt="蓝色、金色与绿色的三条纸雕旅途"/><div className="ending-ticket-copy"><small>问枝 / 一段自己的路</small><h3>走过的路，<br/>都算数。</h3><p>{run.currentEvent.title}</p></div><aside className="ending-ticket-stub"><span>宇宙 {run.code}</span><strong>{route}</strong><small>第 180 天 · 已抵达<br/>{run.decisions.length} 次选择</small><img src={stamp} alt="刘看山已检票印章"/></aside></article></>}
    </main>
    <footer className="ending-sequence-footer"><button type="button" disabled={scene===0} onClick={()=>setScene(n=>n-1)}>上一幕</button><div>{isTicket ? <><button type="button" disabled={download==='pending'} onClick={()=>void saveTicket()}>{download==='pending'?'正在保存…':download==='done'?'再次保存票根':'保存票根'}</button>{onReplay&&<button type="button" onClick={onReplay}>重新走一遍</button>}<button className="ending-next" type="button" onClick={onContinue}>{continueLabel}</button></> : <button className="ending-next" type="button" onClick={()=>setScene(n=>n+1)}>{scene===radarScene?'收下这张票根':'下一幕'}</button>}</div></footer>
    {download==='error'&&<p role="alert" className="ending-download-error">票根暂时没有保存成功，请再试一次。</p>}
  </section>
}
