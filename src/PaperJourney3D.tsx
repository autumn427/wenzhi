import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { buildPaperStation, makePaperGrain } from './paper-diorama'
import { buildBlueArrivalStudio } from './blue-arrival-studio'
import { buildPaperLandscape } from './paper-landscape'
import { buildPaperRoadside } from './paper-roadside'
import { buildMemoryModel } from './paper-memory-model'
import { paperWorldMemory, type PaperWorldState } from './paper-world-memory'
import type { UniverseCode } from './simulation'
import './paper-journey-3d.css'

const themes = {
  A: { color: '#315f80', light: '#8da9b4', name: '蓝色书塔' },
  B: { color: '#aa762d', light: '#d9ba7d', name: '金色工坊' },
  C: { color: '#486c52', light: '#9bad83', name: '绿色苗圃' },
}
const stages = [30, 90, 150, 180]
const progressFor = (day: number) => THREE.MathUtils.clamp((day - 30) / 150, 0, 1)

/** Actual extruded paper meshes, not transformed background images. No network assets. */
export function PaperJourney3D({ code, day, eventTitle, active = true, state, temporal=false, journey=false, inRoom=false, trace='', onArrive }: {
  code: UniverseCode; day: number; eventTitle: string; active?: boolean; state?: PaperWorldState; temporal?:boolean
  journey?:boolean; inRoom?:boolean; trace?:string; onArrive?:()=>void
}) {
  const host = useRef<HTMLDivElement>(null)
  const target = useRef(progressFor(day))
  const visible = useRef(active)
  const angle = useRef(0)
  const overview = useRef(temporal && !journey)
  const closeUp = useRef(false)
  const memoryFocus = useRef(false)
  const [wide, setWide] = useState(temporal && !journey)
  const roomTarget=useRef(inRoom), traceTarget=useRef(trace), arrival=useRef(onArrive), arrived=useRef(false)
  useEffect(()=>{arrival.current=onArrive},[onArrive])
  useEffect(()=>{traceTarget.current=trace},[trace])
  useEffect(()=>{roomTarget.current=inRoom;arrived.current=false;if(journey){overview.current=false;setWide(false)}},[inRoom,day,journey])
  const [close, setClose] = useState(false)
  const [failed, setFailed] = useState(false)
  const theme = themes[code]
  const memory = paperWorldMemory(code, state)
  const memoryTarget = useRef(memory)
  const lastStep = useRef({ code, day })
  useEffect(() => { memoryTarget.current = memory }, [memory.count, memory.energy, memory.available, memory.score, code])
  useEffect(() => {
    const previous = lastStep.current
    lastStep.current = { code, day }
    if (!active || previous.code !== code || previous.day === day) return
    // Only a new step in this route brings the stage back; opening/switching routes never steals scroll.
    const frame = requestAnimationFrame(() => host.current?.closest('section')?.scrollIntoView({
      block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    }))
    return () => cancelAnimationFrame(frame)
  }, [code, day, active])
  useEffect(() => { target.current = progressFor(day) }, [day])
  useEffect(() => { visible.current = active }, [active])

  useEffect(() => {
    const container = host.current
    if (!container) return
    setFailed(false)
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }) }
    catch { setFailed(true); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.shadowMap.autoUpdate = false
    renderer.shadowMap.needsUpdate = true
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    container.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#e8dfce')
    scene.fog = new THREE.Fog('#e8dfce', 27, 62)
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 100)
    const materials: THREE.Material[] = []
    const geometries: THREE.BufferGeometry[] = []
    const grain = makePaperGrain()
    const colorGrain = grain.clone(); colorGrain.colorSpace = THREE.SRGBColorSpace; colorGrain.needsUpdate = true
    const paper = (color: string) => {
      const material = new THREE.MeshStandardMaterial({ color, map: colorGrain, bumpMap: grain, bumpScale: .045, roughness: 1, metalness: 0, flatShading: true, side: THREE.DoubleSide })
      materials.push(material); return material
    }
    const cream = paper('#f3e9d2'), edge = paper('#d1c0a1')
    const ink = paper(theme.color), pale = paper(theme.light)
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = scene) => {
      geometries.push(geometry)
      const object = new THREE.Mesh(geometry, material)
      object.castShadow = true; object.receiveShadow = true; parent.add(object); return object
    }
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, parent?: THREE.Object3D) => {
      const object = mesh(new THREE.BoxGeometry(w, h, d), material, parent)
      object.position.set(x, y, z); return object
    }
    scene.add(new THREE.HemisphereLight('#fffaf0', '#746753', 1.5))
    const sun = new THREE.DirectionalLight('#fff6e7', 2.8)
    sun.position.set(-9, 18, 10); sun.castShadow = true
    sun.shadow.mapSize.set(journey?2048:1024, journey?2048:1024)
    Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 24, bottom: -24, far: 65 })
    sun.shadow.normalBias = journey?.012:.04; sun.shadow.bias=-.0001; scene.add(sun)

    // Uneven nested contours: each layer has actual thickness and casts a paper-edge shadow.
    for (let layer = 0; layer < 12; layer++) {
      const shape = new THREE.Shape()
      const radius = 13.5 - layer * .29
      for (let i = 0; i <= 100; i++) {
        const t = i / 100 * Math.PI * 2
        const ripple = 1 + .035 * Math.sin(t * 7 + layer * .25) + .025 * Math.cos(t * 11)
        const x = Math.cos(t) * radius * ripple
        const y = Math.sin(t) * radius * 1.26 * ripple
        if (!i) shape.moveTo(x, y); else shape.lineTo(x, y)
      }
      const slab = mesh(new THREE.ExtrudeGeometry(shape, { depth: .065, bevelEnabled: false, curveSegments: 32 }), layer === 11 ? pale : layer % 3 ? cream : edge)
      slab.rotation.x = -Math.PI / 2; slab.position.y = -.95 + layer * .09
    }
    const road = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, .15, 12), new THREE.Vector3(-2.7, .15, 7),
      new THREE.Vector3(1.6, .15, 1), new THREE.Vector3(-1.8, .15, -5), new THREE.Vector3(0, .15, -12),
    ])
    const points = road.getPoints(160)
    const roadShape = new THREE.Shape()
    const sides = [-1, 1].map(side => points.map((point, i) => {
      const tangent = road.getTangent(i / 160)
      return new THREE.Vector2(point.x + tangent.z * side * .85, -point.z + tangent.x * side * .85)
    }))
    const outline = [...sides[0], ...sides[1].reverse()]
    outline.forEach((p, i) => i ? roadShape.lineTo(p.x, p.y) : roadShape.moveTo(p.x, p.y))
    roadShape.closePath()
    const ribbon = mesh(new THREE.ExtrudeGeometry(roadShape, { depth: .09, bevelEnabled: false }), cream)
    ribbon.rotation.x = -Math.PI / 2; ribbon.position.y = .13
    scene.add(buildPaperLandscape(code, { cream, edge, ink, pale }))
    scene.add(buildPaperRoadside(code, { cream, edge, ink, pale }))

    // Route-specific architecture, deliberately not an invented mascot approximation.
    const temporalStations:THREE.Group[]=[]
    const studioDisposers:(()=>void)[]=[]
    for (let station = 0; station < 4; station++) {
      const p = road.getPoint(progressFor(stages[station]))
      const side = station % 2 ? -1 : 1
      const studio=journey&&code==='A'&&station===0?buildBlueArrivalStudio({cream,edge,ink,pale}):null
      if(studio)studioDisposers.push(studio.disposeMaterials)
      const group = studio?.root??buildPaperStation(code, station, { cream, edge, ink, pale })
      group.position.set(p.x + side * 3.15, .17, p.z)
      group.rotation.y = side * -.12
      if(temporal)temporalStations.push(group);else scene.add(group)
      // Folded milestone marker; text lives in accessible DOM rather than tiny 3D labels.
      const marker = box(p.x - side * 1.2, .52, p.z, .45, .65, .045, ink)
      marker.rotation.y = side * .2
    }
    // Merge static paper by material: hundreds of cut pieces become four draw batches.
    scene.updateMatrixWorld(true)
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>()
    const originals: THREE.Mesh[] = []
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return
      originals.push(object)
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()
      geometry.applyMatrix4(object.matrixWorld); geometry.clearGroups()
      const batch = batches.get(object.material) ?? []; batch.push(geometry); batches.set(object.material, batch)
    })
    originals.forEach(object => { object.geometry.dispose(); object.removeFromParent() })
    geometries.length = 0
    batches.forEach((batch, material) => {
      const combined = mergeGeometries(batch, false)
      if (combined) mesh(combined, material)
      batch.forEach(g => g.dispose())
    })
    // Keep each dated room as four batches so its reveal is independent of the landscape.
    for(const room of temporalStations) {
      room.updateMatrixWorld(true)
      const parts=new Map<THREE.Material,THREE.BufferGeometry[]>()
      room.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){
        const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.clearGroups()
        const list=parts.get(o.material)??[];list.push(g);parts.set(o.material,list);o.geometry.dispose()
      }})
      room.clear();room.position.set(0,0,0);room.rotation.set(0,0,0)
      for(const [mat,list] of parts){const g=mergeGeometries(list,false);if(g)mesh(g,mat,room);list.forEach(part=>part.dispose())}
      scene.add(room)
    }
    if(journey)container.dataset.firstStationBatches=String(temporalStations[0]?.children.length??0)
    const roomFolds:number[]=temporalStations.map((_,i)=>progressFor(stages[i])<=target.current?1:0)
    // A dated physical record stays on the first desk, independent of the current station.
    const record=new THREE.Group()
    const recordBook=new THREE.Group(),recordPrototype=new THREE.Group()
    record.add(recordBook,recordPrototype)
    if(journey){
      const p=road.getPoint(0);record.position.set(p.x+3.15,.17,p.z);record.rotation.y=-.12
      box(-.48,1.21,.88,.65,.06,.5,ink,recordBook)
      for(let i=0;i<3;i++)box(-.48,1.248+i*.015,.88,.61,.012,.47,cream,recordBook)
      box(-.65,1.30,.88,.07,.012,.47,pale,recordBook)
      box(-.48,1.20,.88,.78,.025,.62,cream,recordPrototype)
      for(const side of [-1,1]){
        const fold=box(-.48+side*.14,1.38,.88,.36,.025,.45,pale,recordPrototype)
        fold.rotation.z=side*-.9
      }
      // Match the rebuilt tabletop elevation.
      record.position.y+=.19
      scene.add(record)
    }
    const pin = mesh(new THREE.ConeGeometry(.2, .45, 4), ink)
    pin.castShadow = false
    const memoryModel = buildMemoryModel(code, cream, ink, pale)
    scene.add(memoryModel.root)
    let memoryCount = memoryTarget.current.count
    const foldAmounts: number[] = memoryModel.slots.map((_, i) => i < memoryCount ? 1 : 0)
    let energy = memoryTarget.current.energy
    let memoryDay = target.current
    let memoryAvailable = memoryTarget.current.available
    const placeMemory = () => {
      const index = stages.findIndex(value => progressFor(value) === target.current)
      const side = index % 2 ? -1 : 1, point = road.getPoint(target.current)
      memoryModel.root.position.set(point.x - side * 2.5, .24, point.z)
      memoryModel.root.rotation.y = side * -.18
    }
    placeMemory()
    let progress = target.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let onScreen = true, last = 0, dirty = true, frames = 0
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; dirty = true })
    observer.observe(container)
    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix()
      dirty = true
    }); resize.observe(container)
    const lose = (event: Event) => { event.preventDefault(); setFailed(true); renderer.setAnimationLoop(null) }
    renderer.domElement.addEventListener('webglcontextlost', lose)
    const aim = new THREE.Vector3(), desiredAim = new THREE.Vector3(), desired = new THREE.Vector3()
    renderer.setAnimationLoop((time) => {
      const dt = Math.min((time - last) / 1000, .05); last = time
      // Finish an in-flight arrival even when the event panel has scrolled the canvas off screen.
      if (!visible.current || (!onScreen && (!journey || arrived.current)) || document.hidden) return
      const factor = reduced.matches ? 1 : 1 - Math.exp(-dt * 2.2)
      progress = journey && !reduced.matches ? progress + THREE.MathUtils.clamp(target.current-progress,-dt*.085,dt*.085) : THREE.MathUtils.lerp(progress, target.current, factor)
      // A changed day moves the present-state display, not a claimed historical record.
      if (memoryDay !== target.current) { memoryDay = target.current; placeMemory(); dirty = true }
      if (memoryCount !== memoryTarget.current.count || memoryAvailable !== memoryTarget.current.available || Math.abs(energy - memoryTarget.current.energy) > .01) dirty = true
      memoryAvailable = memoryTarget.current.available
      memoryCount = memoryTarget.current.count
      energy = THREE.MathUtils.lerp(energy, memoryTarget.current.energy, factor)
      sun.intensity = 2.2 + energy / 100 * .6
      let folding = false
      if(journey && record.visible!==Boolean(traceTarget.current)){record.visible=Boolean(traceTarget.current);dirty=true}
      if(journey){
        const prototype=traceTarget.current==='原型边界清单'
        if(recordPrototype.visible!==prototype)dirty=true
        recordPrototype.visible=prototype;recordBook.visible=!prototype
        container.dataset.record=traceTarget.current?prototype?'prototype':'book':'none'
      }
      temporalStations.forEach((room,i)=>{
        const goal=progressFor(stages[i])<=target.current+.0001?1:0
        const previousFold=roomFolds[i]
        roomFolds[i]=THREE.MathUtils.lerp(roomFolds[i],goal,factor)
        if(Math.abs(previousFold-roomFolds[i])>.000001)dirty=true
        if(Math.abs(roomFolds[i]-goal)>.001)folding=true
        room.visible=roomFolds[i]>.005;room.scale.y=Math.max(.001,roomFolds[i])
      })
      container.dataset.rooms=String(roomFolds.filter(v=>v>.99).length)
      memoryModel.root.visible = memoryTarget.current.available
      memoryModel.slots.forEach((slot, i) => {
        // Let the camera arrive before opening the new paper, rather than unfolding off screen.
        const goal = Math.abs(progress - target.current) < .025 ? (i < memoryCount ? 1 : 0) : foldAmounts[i]
        foldAmounts[i] = THREE.MathUtils.lerp(foldAmounts[i], goal, factor)
        if (Math.abs(foldAmounts[i] - goal) > .001) folding = true
        slot.visible = foldAmounts[i] > .005
        slot.rotation.x = -(1 - foldAmounts[i]) * Math.PI / 2
        slot.scale.y = .05 + foldAmounts[i] * .95
      })
      if (folding || dirty) renderer.shadowMap.needsUpdate = true
      const here = road.getPoint(progress)
      pin.position.set(here.x, .65, here.z)
      const portrait = camera.aspect < .8
      const stationIndex = stages.reduce((best, value, i) => Math.abs(progressFor(value) - target.current) < Math.abs(progressFor(stages[best]) - target.current) ? i : best, 0)
      const stationSide = (stationIndex % 2 ? -1 : 1) * (memoryFocus.current ? -1 : 1)
      const focusX = here.x + stationSide * (closeUp.current || portrait ? 2.4 : 1.4)
      if (overview.current) desired.set(18 + angle.current * 5, 24, 26)
      else if (memoryFocus.current) desired.set(focusX + stationSide * 1.5 + angle.current * 2, 4.5, here.z - (portrait ? 7 : 5))
      else if (closeUp.current) desired.set(focusX + stationSide * 4 + angle.current * 3, portrait ? 7 : 5.5, here.z + (portrait ? 12 : 8))
      else desired.set(here.x + (portrait ? 4 : 7) + angle.current * 5, portrait ? 14 : 8.5, here.z + (portrait ? 19 : 12))
      if (overview.current) desiredAim.set(0, 0, 0)
      else desiredAim.set(focusX, memoryFocus.current ? .6 : closeUp.current ? 1.5 : .9, here.z - (closeUp.current ? 0 : 3 * (1 - progress)))
      if(journey && !overview.current){
        const moving=Math.abs(progress-target.current)>.002
        if(roomTarget.current && !moving){
          const roomX=here.x+stationSide*3.15
          desired.set(roomX+angle.current*2,portrait?3.7:3.1,here.z+(portrait?9:7))
          desiredAim.set(roomX,1.8,here.z-.2)
          if(stationIndex===0){
            desired.set(roomX+.9,portrait?3.5:3.1,here.z+(portrait?13:8.3))
            desiredAim.set(roomX,1.95,here.z)
          }
        }else{
          const ahead=road.getPoint(Math.min(1,progress+.13))
          desired.set(here.x+angle.current*2,portrait?3.8:2.8,here.z+4.8)
          desiredAim.set(ahead.x,.9,ahead.z)
        }
        const ready=!moving && camera.position.distanceToSquared(desired)<.015 && aim.distanceToSquared(desiredAim)<.015
        container.dataset.arrived=String(ready)
        if(ready && !arrived.current){arrived.current=true;arrival.current?.()}
      }
      const settled = Math.abs(progress - target.current) < .0001 && camera.position.distanceToSquared(desired) < .00001 && aim.distanceToSquared(desiredAim) < .00001
      if (settled && !dirty && !folding) return
      if (camera.position.lengthSq() === 0) { camera.position.copy(desired); aim.copy(desiredAim) }
      camera.position.lerp(desired, factor)
      aim.lerp(desiredAim, factor); camera.lookAt(aim)
      container.dataset.progress = progress.toFixed(3)
      renderer.render(scene, camera)
      container.dataset.drawCalls = String(renderer.info.render.calls)
      container.dataset.frames = String(++frames)
      container.dataset.memoryCount = String(memoryCount)
      container.dataset.folding = String(folding)
      dirty = false
    })
    return () => {
      renderer.setAnimationLoop(null); observer.disconnect(); resize.disconnect()
      renderer.domElement.removeEventListener('webglcontextlost', lose)
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
      grain.dispose(); colorGrain.dispose()
      memoryModel.dispose()
      studioDisposers.forEach(dispose=>dispose())
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove()
    }
  }, [code, theme.color, theme.light, temporal, journey])

  return <section className={`paper-journey paper-route-${code}`} aria-label={`${theme.name}三维纸雕路线`}>
    <div className="paper-journey-tools"><span>立体纸雕 · 细化原型</span><div>
      <button type="button" onClick={() => { angle.current = Math.max(-1, angle.current - .4) }} aria-label="从左侧看纸雕">左侧看</button>
      <button type="button" aria-pressed={wide} onClick={() => { overview.current = !wide; setWide(!wide) }}>{wide ? '回到脚下' : '看整条路'}</button>
      {!journey&&<button type="button" aria-pressed={close && !wide} onClick={() => { memoryFocus.current = false; closeUp.current = wide || !close; setClose(wide || !close); overview.current = false; setWide(false) }}>{close && !wide ? '退远一点' : '近看纸雕'}</button>}
      <button type="button" onClick={() => { angle.current = Math.min(1, angle.current + .4) }} aria-label="从右侧看纸雕">右侧看</button>
    </div></div>
    <div className="paper-journey-viewport" ref={host} aria-hidden="true" />
    {failed && <p className="paper-journey-error" role="status">当前设备无法显示三维场景，请切回「原版纸雕」继续体验。剧情不受影响。</p>}
    <footer className="paper-journey-caption"><div><span>{theme.name} · 第 {day} 天</span><h3>{eventTitle}</h3><p>{journey?'在下方做出选择，再沿路前行。「看整条路」可回看已展开的工作室。':temporal?'切换时间，逐站展开工作室。点击「回到脚下」让镜头跟随当前站点；这是时间布局预演，不代表能力增长。':'做出选择后，镜头沿路前行。路标只表示剧情进度，不代表能力评分。'}</p>
      {memory.available && <details className="paper-memory-note"><summary>{memory.label} · {memory.count} / 5 档{memory.energy < 35 ? ' · 精力偏紧' : ''}</summary><p>路旁台座呈现当前模拟状态：{memory.metricLabel} {memory.score} / 100，每 20 点对应一档纸样；精力 {memory.energy} / 100。纸样不是实际作品数量或真实能力测评，也不是过去各站的状态快照。数值不变，纸样不会增加。</p><button type="button" onClick={() => { memoryFocus.current = true; closeUp.current = true; setClose(true); overview.current = false; setWide(false) }}>近看路旁纸样</button></details>}
    </div>
      <ol aria-label="剧情路标">{stages.map(value => <li key={value} aria-current={value === day ? 'step' : undefined} className={value <= day ? 'is-reached' : ''}>{value}<small>天</small></li>)}</ol>
    </footer>
  </section>
}
