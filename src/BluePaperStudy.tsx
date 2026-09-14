import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js'
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js'
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js'
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js'
import {buildBluePaperRoom} from './blue-paper-room'
import {studioTierFold} from './studio-time-fold'
import './blue-paper-study.css'

const days=[30,90,150,180]
const phases=[.58,.82,.72,1]
const notes=['铺开图纸，留下工作的起点。','后方书塔展开，工作室的纵深显现。','回看与调整：部分结构收拢，不是一路增长。','镜头靠近桌面，看清留下来的结构。']
type StudyView='room'|'desk'|'shelf'|'tower'
const viewNotes:Record<StudyView,string>={room:'完整洞口',desk:'工作台 · 叠层桌板、折下的蓝图与桌前的刘看山',shelf:'书架 · 书脊、横放书堆与档案盒',tower:'书塔 · 切换时间，观察分层展开与收拢'}

export default function BluePaperStudy({fixed=false}:{fixed?:boolean}) {
  const host=useRef<HTMLDivElement>(null),phase=useRef(0),look=useRef<StudyView>('room')
  const [index,setIndex]=useState(0),[view,setView]=useState<StudyView>('room'),[failed,setFailed]=useState(false)
  const selectView=(next:StudyView)=>{look.current=next;setView(next)}
  useEffect(()=>{phase.current=index},[index])
  useEffect(()=>{
    const node=host.current;if(!node)return
    let renderer:THREE.WebGLRenderer
    try{renderer=new THREE.WebGLRenderer({antialias:true})}catch{setFailed(true);return}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap
    renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true
    node.append(renderer.domElement)
    const scene=new THREE.Scene();scene.background=new THREE.Color('#e8decb')
    const room=buildBluePaperRoom(fixed);scene.add(room.root)
    scene.add(new THREE.HemisphereLight('#fff4da','#18334a',1.2))
    const sun=new THREE.DirectionalLight('#fff0d5',3.2);sun.position.set(-7,12,12);sun.castShadow=true
    sun.shadow.mapSize.set(1024,1024);sun.shadow.radius=5;sun.shadow.blurSamples=8
    Object.assign(sun.shadow.camera,{left:-13,right:13,top:14,bottom:-9,far:50})
    sun.shadow.normalBias=.035;scene.add(sun)
    const fill=new THREE.PointLight('#e8eff5',30,24,2);fill.position.set(0,5,2);scene.add(fill)
    // Broad non-shadowing bounce prevents the paper aperture casting a black band across the room.
    const bounce=new THREE.DirectionalLight('#e2ebf0',.45);bounce.position.set(4,5,9);scene.add(bounce)
    const camera=new THREE.PerspectiveCamera(40,1,.1,100)
    const composer=new EffectComposer(renderer),renderPass=new RenderPass(scene,camera)
    const contact=new SSAOPass(scene,camera,512,512,16),output=new OutputPass()
    contact.kernelRadius=.5;contact.minDistance=.0008;contact.maxDistance=.035
    composer.addPass(renderPass);composer.addPass(contact);composer.addPass(output)
    renderer.info.autoReset=false
    const reduced=matchMedia('(prefers-reduced-motion: reduce)')
    let dirty=true,onScreen=true,last=0,current=phases[0],frames=0,initialized=false
    const resize=new ResizeObserver(()=>{const {width,height}=node.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();composer.setSize(width,height);dirty=true})
    resize.observe(node)
    const observer=new IntersectionObserver(([entry])=>{onScreen=entry.isIntersecting;dirty=true});observer.observe(node)
    const lose=(event:Event)=>{event.preventDefault();setFailed(true);renderer.setAnimationLoop(null)}
    renderer.domElement.addEventListener('webglcontextlost',lose)
    const desired=new THREE.Vector3(),aim=new THREE.Vector3(0,3.4,0),wantedAim=new THREE.Vector3()
    renderer.setAnimationLoop(time=>{
      const dt=Math.min((time-last)/1000,.05);last=time
      if(document.hidden||!onScreen)return
      const target=fixed?1:phases[phase.current],factor=fixed||reduced.matches?1:1-Math.exp(-dt*2.5)
      const previous=current;current=THREE.MathUtils.lerp(current,target,factor)
      // A fixed inspection camera can already be settled when reduced motion jumps time.
      // Geometry still needs one draw even though both camera and target have now settled.
      if(Math.abs(current-previous)>.000001)dirty=true
      // Fixed frontal framing; mild time-linked approach, never an orbit behind the paper facade.
      const portrait=camera.aspect<1
      if(fixed) {
        desired.set(2.7,6.1,16.8);wantedAim.set(-.2,2.2,-.4)
      } else if(look.current==='desk') {
        desired.set(1.2,4.6,portrait?20:12);wantedAim.set(-1.3,1.6,1.3)
      } else if(look.current==='shelf') {
        desired.set(-1.4,4.5,portrait?23:13);wantedAim.set(-4,2.8,-1)
      } else if(look.current==='tower') {
        desired.set(1.5,6,portrait?26:15);wantedAim.set(1,3.8,-3.3)
      } else {
        desired.set(1,6.6,(portrait?34:22)-phase.current*.25);wantedAim.set(0,3.5,0)
      }
      const settled=Math.abs(current-target)<.0001&&camera.position.distanceToSquared(desired)<.00001&&aim.distanceToSquared(wantedAim)<.00001
      if(settled&&!dirty)return
      if(!initialized){camera.position.copy(desired);aim.copy(wantedAim);initialized=true}
      camera.position.lerp(desired,factor);aim.lerp(wantedAim,factor);camera.lookAt(aim)
      let openTiers=0
      room.pose(current)
      room.tiers.forEach((tiers,i)=>tiers.forEach((tier,level)=>{
        const fold=studioTierFold(current,i,level)
        tier.visible=fold>.001
        tier.rotation.x=(1-fold)*Math.PI/3
        if(tier.visible)openTiers++
      }))
      if(Math.abs(current-previous)>.00001||dirty)renderer.shadowMap.needsUpdate=true
      renderer.info.reset();composer.render(dt)
      node.dataset.frames=String(++frames);node.dataset.phase=current.toFixed(3);node.dataset.calls=String(renderer.info.render.calls)
      node.dataset.openTiers=String(openTiers)
      node.dataset.view=look.current
      dirty=false
    })
    return()=>{renderer.setAnimationLoop(null);resize.disconnect();observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',lose);contact.dispose();output.dispose();renderPass.dispose();composer.dispose();room.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()}
  },[fixed])
  return <main className={`blue-study${fixed?' blue-study-fixed':''}`}>
    <header><div><span>问枝 / 蓝色工作室 · {fixed?'固定镜头对照稿':'独立美术样板'}</span><h1>{fixed?'先对齐一张画面。':'从纸页里，走进一间工作室。'}</h1></div><a href={fixed?'/?paper-study=blue':'/?demo=1'}>{fixed?'查看保留的交互原型 ↗':'返回原体验 ↗'}</a></header>
    <section aria-label="蓝色纸雕工作室">
      <div className="blue-study-stage" ref={host} aria-hidden="true"/>
      {failed&&<p role="alert">当前设备无法显示三维样板。可以返回原体验，剧情不会受到影响。</p>}
      {!fixed&&<><div className="blue-study-bar"><p aria-live="polite"><strong>第 {days[index]} 天 · 构图预演</strong><span>{view==='room'?notes[index]:viewNotes[view]}</span></p><div className="blue-study-views" role="group" aria-label="纸雕观察位置">
        <button type="button" aria-pressed={view==='desk'} onClick={()=>selectView(view==='room'?'desk':'room')}>{view==='room'?'靠近工作台':'看完整洞口'}</button>
        <button type="button" aria-pressed={view==='shelf'} onClick={()=>selectView('shelf')}>看书架</button>
        <button type="button" aria-pressed={view==='tower'} onClick={()=>selectView('tower')}>看书塔</button>
      </div></div>
      <nav aria-label="预演时间"><span>拨动时间</span>{days.map((day,i)=><button key={day} type="button" aria-pressed={i===index} onClick={()=>setIndex(i)}>{day}<small> 天</small></button>)}</nav></>}
    </section>
    {fixed&&<figure className="blue-study-reference"><figcaption>蓝色原图 · 构图与比例对照（参考图片，不是三维渲染）</figcaption><img src="/career-universe-a-full.webp" alt="蓝色纸雕原图：工作台、侧身操作的刘看山、书架和通向前景的纸路" /></figure>}
    <p className="blue-study-note">{fixed?'固定镜头、固定姿态，无时间动画。这是构图重构的第一稿，不是已达到原图精度的成品。原交互原型与剧情存档保持不变。':'这是三维建模与时间过渡样板，不修改你的存档。刘看山为场景内三维造型样稿，拨动时间时调整桌前手臂姿态；尚未绑定实际选择。原插画与原版路线保持不变。'}</p>
  </main>
}
