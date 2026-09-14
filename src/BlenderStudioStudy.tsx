import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js'
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js'
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js'
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js'
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js'
import {makeStudioPaperTexture} from './studio-paper-texture'
import {applyStudioPaperSurface} from './studio-paper-surface'
import './blender-studio-study.css'

export default function BlenderStudioStudy(){
  const host=useRef<HTMLDivElement>(null),commands=useRef<{view:(near:boolean)=>void;clay:(value:boolean)=>void}|null>(null)
  const [status,setStatus]=useState('正在加载 Blender 模型…'),[clay,setClay]=useState(false),[ready,setReady]=useState(false)
  useEffect(()=>{
    const node=host.current;if(!node)return
    let dead=false,frame=0,loaded=false,onScreen=true,renderer:THREE.WebGLRenderer
    const abort=new AbortController(),geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>()
    try{renderer=new THREE.WebGLRenderer({antialias:true})}catch{setStatus('无法启动 WebGL，可查看下方静态渲染图。');return}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
    renderer.shadowMap.autoUpdate=false;node.append(renderer.domElement)
    const scene=new THREE.Scene();scene.background=new THREE.Color('#e8dfce')
    const camera=new THREE.OrthographicCamera(-6,6,4,-4,.1,100)
    const controls=new OrbitControls(camera,renderer.domElement)
    controls.enableDamping=false;controls.enablePan=false;controls.minZoom=.75;controls.maxZoom=2.4
    controls.minPolarAngle=.55;controls.maxPolarAngle=Math.PI*.49
    controls.minAzimuthAngle=-.45;controls.maxAzimuthAngle=.65
    const composer=new EffectComposer(renderer),ao=new SSAOPass(scene,camera,512,512,16)
    ao.kernelRadius=.22;ao.minDistance=.001;ao.maxDistance=.015
    const output=new OutputPass(),antialias=new SMAAPass()
    composer.addPass(new RenderPass(scene,camera));composer.addPass(ao);composer.addPass(output);composer.addPass(antialias)
    scene.add(new THREE.HemisphereLight('#fff5df','#546776',1.6))
    const key=new THREE.DirectionalLight('#fff1d7',2.7);key.position.set(-4,9,6);key.castShadow=true
    key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-8,right:8,top:9,bottom:-5,far:35})
    key.shadow.normalBias=.035;key.shadow.bias=-.0002;scene.add(key)
    const fill=new THREE.DirectionalLight('#daeaff',1.05);fill.position.set(5,5,2);scene.add(fill)
    const grain=makeStudioPaperTexture(),colorGrain=grain.clone();colorGrain.colorSpace=THREE.SRGBColorSpace;colorGrain.needsUpdate=true
    const clayMat=new THREE.MeshStandardMaterial({color:'#d4c8b3',roughness:1});materials.add(clayMat)
    const meshes:THREE.Mesh[]=[];const originals:THREE.Material[]=[]
    let draws=0
    const invalidate=()=>{
      if(dead||frame||!onScreen||document.hidden)return
      frame=requestAnimationFrame(()=>{frame=0;if(dead)return;composer.render();node.dataset.frames=String(++draws);node.dataset.ready=String(loaded);node.dataset.batches=String(meshes.length)})
    }
    const view=(near:boolean)=>{camera.position.set(3.3,6.2,14);controls.target.set(near?-.3:0,near?1.95:2.15,near?.5:-.1);camera.zoom=near?1.6:1;camera.updateProjectionMatrix();controls.update();invalidate()}
    commands.current={view,clay:value=>{meshes.forEach((m,i)=>{m.material=value?clayMat:originals[i]});invalidate()}}
    controls.addEventListener('change',invalidate);view(false)
    const resize=new ResizeObserver(()=>{const {width,height}=node.getBoundingClientRect();if(!width||!height)return;const aspect=width/height,halfH=Math.max(4.15,6.1/aspect);camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();renderer.setSize(width,height);composer.setSize(width,height);invalidate()});resize.observe(node)
    const observer=new IntersectionObserver(([e])=>{onScreen=e.isIntersecting;if(onScreen)invalidate()});observer.observe(node)
    document.addEventListener('visibilitychange',invalidate)
    const lose=(e:Event)=>{e.preventDefault();setReady(false);setStatus('三维上下文已中断，请刷新重试；下方保留静态渲染图。')}
    renderer.domElement.addEventListener('webglcontextlost',lose)
    const disposeSource=(root:THREE.Object3D)=>root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}})
    void (async()=>{
      try{
        const response=await fetch('/models/blue-studio-v1.glb',{signal:abort.signal});if(!response.ok)throw Error('模型文件加载失败')
        const gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),'')
        if(dead){disposeSource(gltf.scene);return}
        gltf.scene.updateMatrixWorld(true)
        const groups=new Map<THREE.Material,THREE.BufferGeometry[]>()
        gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){
          const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.clearGroups()
          for(const name of Object.keys(g.attributes))if(name!=='position'&&name!=='normal')g.deleteAttribute(name)
          if(!g.attributes.normal)g.computeVertexNormals()
          g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2))
          const list=groups.get(o.material)??[];list.push(g);groups.set(o.material,list)
        }})
        for(const [source,parts] of groups){
          const geometry=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());if(!geometry)throw Error('模型合批失败')
          const mat=(source as THREE.MeshStandardMaterial).clone();mat.roughness=.95
          if(!source.name.includes('Kanshan')){mat.map=colorGrain;mat.bumpMap=grain;mat.bumpScale=.12;applyStudioPaperSurface(mat)}
          geometries.add(geometry);materials.add(mat)
          const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=true;mesh.receiveShadow=true
          meshes.push(mesh);originals.push(mat);scene.add(mesh)
        }
        disposeSource(gltf.scene);loaded=true;renderer.shadowMap.needsUpdate=true
        setReady(true);setStatus(`Blender GLB 已加载 · ${meshes.length} 个静态材质批次`);invalidate()
      }catch(error){if(!dead)setStatus(error instanceof Error?error.message:'模型加载失败，请刷新重试。')}
    })()
    return()=>{dead=true;abort.abort();cancelAnimationFrame(frame);commands.current=null;resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',invalidate);renderer.domElement.removeEventListener('webglcontextlost',lose);controls.dispose();ao.dispose();output.dispose();antialias.dispose();composer.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());grain.dispose();colorGrain.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()}
  },[])
  return <main className="blender-study"><header><p>问枝 · Blender 模型网页验收</p><h1>走近蓝色工作室。</h1><a href="/?paper-study=timeline-3d">← 返回原有三维旅途</a></header>
    <div className="blender-study-tools"><button disabled={!ready} onClick={()=>commands.current?.view(false)}>完整洞口</button><button disabled={!ready} onClick={()=>commands.current?.view(true)}>近看工作台</button><button disabled={!ready} aria-pressed={clay} onClick={()=>{setClay(!clay);commands.current?.clay(!clay)}}>{clay?'恢复纸材':'素模检查'}</button></div>
    <p role="status">{status}</p><div className="blender-study-canvas" ref={host} aria-label="可拖动旋转的三维工作室"/>
    <p>拖动查看侧面，滚轮或双指缩放；也可使用上方按钮。这里加载的是真实 GLB，角色暂无动画，未连接剧情与存档。</p>
    <details><summary>对照 Blender 离线渲染</summary><img src="/models/blue-studio-v1-reference.png" alt="Blender Cycles 静态参考渲染，不是网页三维截图" loading="lazy"/></details>
    <p>网页使用实时纸纤维与屏幕空间接触阴影，尚未烘焙 Blender 光照及纹理，因此不会与离线渲染完全一致。原旅途未替换，未发布。</p>
  </main>
}
