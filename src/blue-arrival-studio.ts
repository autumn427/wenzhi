import * as THREE from 'three'
import {buildStudioWorkbench} from './studio-workbench'
import {makeStudioPaperTexture} from './studio-paper-texture'
import {applyStudioPaperSurface} from './studio-paper-surface'

/** First-stop cutaway: one assembled desk/sitter, low side shelves, a layered paper shell. */
export function buildBlueArrivalStudio(papers:{cream:THREE.MeshStandardMaterial;edge:THREE.MeshStandardMaterial;ink:THREE.MeshStandardMaterial;pale:THREE.MeshStandardMaterial}){
  const root=new THREE.Group()
  const grain=makeStudioPaperTexture(),colorGrain=grain.clone()
  colorGrain.colorSpace=THREE.SRGBColorSpace;colorGrain.needsUpdate=true
  const localMaterials=Object.values(papers).map(source=>{
    const m=source.clone();m.map=colorGrain;m.bumpMap=grain;m.bumpScale=.12;m.flatShading=false
    applyStudioPaperSurface(m);return m
  })
  const [cream,edge,ink,pale]=localMaterials
  const shellMaterials=['#f0e5ce','#ddd0b8','#6c8c9d','#52768d','#3a627f','#305571'].map(color=>{
    const m=ink.clone();m.color.set(color);applyStudioPaperSurface(m);localMaterials.push(m);return m
  })
  root.name='blue-arrival-studio'
  const put=(g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0)=>{
    const item=new THREE.Mesh(g,m);item.position.set(x,y,z);root.add(item);return item
  }
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,m=cream)=>put(new THREE.BoxGeometry(w,h,d),m,x,y,z)
  // Broad nested sheets: every cutout shares a continuous outer paper wall.
  // Unlike narrow ribs, rear sheets fill the gaps behind the foreground cut edges.
  for(let layer=0;layer<6;layer++){
    const w=3.7-layer*.15,h=4.05-layer*.12
    const points:number[]=[],indices:number[]=[]
    const count=100
    for(let face=0;face<2;face++)for(let side=0;side<2;side++)for(let i=0;i<=count;i++){
      const t=i/count*Math.PI,envelope=Math.sin(t)
      const ripple=.10*Math.sin(t*5+.5+layer*.09)+.035*Math.sin(t*13+layer*.27)
      const distance=Math.min(4.8/Math.max(Math.abs(Math.cos(t)),.00001),5.15/Math.max(envelope,.00001))
      const x=side?Math.cos(t)*(w+ripple)+.18*envelope*Math.sin(t*2+.3):Math.cos(t)*distance
      const y=side?Math.pow(envelope,.78)*(h+ripple)+.12:envelope*distance+.12
      const curl=(.08*Math.sin(t*5+layer*.4)+.025*Math.sin(t*17))*envelope*(side?1:.3)
      points.push(x,y,curl+face*.055)
    }
    const n=count+1
    for(let face=0;face<2;face++)for(let i=0;i<count;i++){
      const a=face*2*n+i,b=a+n
      if(face)indices.push(a,b,a+1,a+1,b,b+1);else indices.push(a,a+1,b,a+1,b+1,b)
    }
    for(let side=0;side<2;side++)for(let i=0;i<count;i++){
      const a=side*n+i,b=a+2*n;indices.push(a,b,a+1,a+1,b,b+1)
    }
    for(const i of [0,count]){indices.push(i,i+n,i+2*n,i+n,i+3*n,i+2*n)}
    const uv:number[]=[];for(let i=0;i<points.length;i+=3)uv.push(points[i]*.3,points[i+1]*.3)
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals()
    put(g,shellMaterials[layer],0,0,1.1-layer*.36)
  }
  // A dark curved rear wall prevents the room reading as furniture on an open island.
  const back=new THREE.Shape();back.moveTo(-3.7,0);back.lineTo(3.7,0);back.absellipse(0,0,3.7,4.5,0,Math.PI,false,0);back.closePath()
  put(new THREE.ExtrudeGeometry(back,{depth:.065,bevelEnabled:false}),ink,0,.12,-1.16)
  for(let layer=0;layer<3;layer++){
    const s=new THREE.Shape();s.absellipse(0,0,4.8-layer*.12,2.4-layer*.13,0,Math.PI*2,false,0)
    const item=put(new THREE.ExtrudeGeometry(s,{depth:.055,bevelEnabled:false}),layer===2?ink:layer?edge:cream,0,.02+layer*.06,0);item.rotation.x=-Math.PI/2
  }
  // Lower storage flanks the subject; no central book tower.
  for(const side of [-1,1]){
    const x=side*2.15,rows=side<0?4:3,h=rows*.57
    box(x,h/2+.2,-.65,1.05,h,.075,ink)
    for(const dx of [-.54,.54])box(x+dx,h/2+.2,-.37,.06,h,.7,pale)
    for(let row=0;row<=rows;row++){
      const y=.2+row*.57;box(x,y,-.35,1.15,.045,.74,cream)
      if(row===rows)continue
      for(let b=0;b<4;b++){
        const bh=.28+((b+row)%3)*.07,bx=x-.38+b*.23
        box(bx,y+bh/2+.03,-.24,.16,bh,.35,pale)
        box(bx,y+bh/2+.03,-.055,.175,bh+.02,.022,ink)
        box(bx,y+.12,-.039,.11,.022,.013,cream)
      }
    }
  }
  const work=buildStudioWorkbench(cream,edge,ink)
  const assembly=new THREE.Group();assembly.add(work.table,work.character)
  assembly.scale.setScalar(.65);assembly.position.set(.91,.18,0)
  work.character.rotation.y=.75;work.character.position.y=.48;work.character.rotation.x=.025
  work.pose(.4);root.add(assembly)
  // Extend the existing footrest under the seated feet, rather than adding another prop.
  box(-.16,.52,.015,.68,.035,.42,edge)
  // A restrained drafting panel provides depth behind the sitter.
  box(.4,2.7,-1.07,1.9,1.3,.04,pale)
  box(.4,2.7,-1.04,1.8,1.2,.025,ink)
  for(let i=0;i<5;i++)box(-.25+i*.3,2.7,-1.018,.012,1.05,.008,cream)
  for(let i=0;i<4;i++)box(.4,2.28+i*.27,-1.014,1.6,.012,.008,pale)
  return {root,disposeMaterials:()=>{work.disposeMaterials();localMaterials.forEach(m=>m.dispose());grain.dispose();colorGrain.dispose()}}
}
