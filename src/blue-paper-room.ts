import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeStudioPaperTexture } from './studio-paper-texture'
import { createSculptedPaperSheet } from './sculpted-paper-sheet'
import { buildStudioWorkbench } from './studio-workbench'
import { applyStudioPaperSurface } from './studio-paper-surface'

/** Enclosed studio with scene-native workbench and articulated character study. */
export function buildBluePaperRoom(fixed=false) {
  const root = new THREE.Group(), solid = new THREE.Group()
  root.add(solid)
  const aperture=new THREE.Group();if(fixed)root.add(aperture)
  const grain = makeStudioPaperTexture(), color = grain.clone()
  color.colorSpace = THREE.SRGBColorSpace; color.needsUpdate = true
  const materials = ['#eee3ce', '#cbb998', '#254d71', '#3d6b91', '#7695ad'].map(value => new THREE.MeshStandardMaterial({
    color: value, roughness: 1, metalness: 0, map: color, bumpMap: grain, bumpScale: .45, side: THREE.DoubleSide,
  }))
  materials.forEach(applyStudioPaperSurface)
  const [paper, edge, deep, blue, pale] = materials
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x=0,y=0,z=0, parent: THREE.Group=solid) => {
    const item = new THREE.Mesh(g,m); item.position.set(x,y,z); item.castShadow=true;item.receiveShadow=true;parent.add(item);return item
  }
  const box = (x:number,y:number,z:number,w:number,h:number,d:number,m=paper,parent=solid) => mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent)
  const beam = (a:THREE.Vector3,b:THREE.Vector3,w=.04,m=pale) => {
    const item=box(0,0,0,w,a.distanceTo(b),w,m)
    item.position.copy(a).add(b).multiplyScalar(.5)
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize())
  }
  // Curled, tessellated sheets replace planar extrusions and uniform bright outlines.
  for(let layer=0;layer<9;layer++) {
    const sheet=createSculptedPaperSheet(layer)
    if(fixed){sheet.translate(0,-4.2,0);sheet.scale(1,.85,1);sheet.translate(0,3.4,0)}
    mesh(sheet,layer<4?paper:layer%2?blue:deep,0,0,4-layer*.4,fixed?aperture:solid)
  }
  const backdrop=box(0,4,-5.3,22,15,.15,deep,fixed?root:solid)
  if(fixed){backdrop.castShadow=false;backdrop.receiveShadow=false}
  // Broad stepped blue floor with cream edge seams.
  for(let level=0;level<4;level++) {
    const shape=new THREE.Shape();shape.absellipse(0,0,8.7-level*.45,7.3-level*.7,0,Math.PI*2,false,0)
    const floor=mesh(new THREE.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:false}),level%2?blue:deep,0,-.7+level*.2,0)
    floor.rotation.x=-Math.PI/2
  }
  const road=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.08,7.5),new THREE.Vector3(.4,.08,4),new THREE.Vector3(2.6,.08,1.3),new THREE.Vector3(2.1,.08,-2)])
  const ribbon=new THREE.Shape(), pts=road.getPoints(100)
  const edges=[-1,1].map(side=>pts.map((p,i)=>{const t=road.getTangent(i/100);return new THREE.Vector2(p.x+t.z*side*.47,-p.z+t.x*side*.47)}))
  ;[...edges[0],...edges[1].reverse()].forEach((p,i)=>i?ribbon.lineTo(p.x,p.y):ribbon.moveTo(p.x,p.y));ribbon.closePath()
  mesh(new THREE.ExtrudeGeometry(ribbon,{depth:.04,bevelEnabled:false}),paper,0,.1,0).rotation.x=-Math.PI/2
  // Floor drafting seams are physical thin paper strips, not a luminous overlay.
  for(let i=-6;i<=6;i++) box(i,.04,-1,.013,.008,7,pale)
  for(let i=-4;i<3;i++)box(0,.045,i,13,.008,.013,pale)
  const book=(x:number,y:number,z:number,w:number,h:number) => {
    box(x,y+h/2,z,w*.8,h-.03,.36,paper)
    for(const dx of [-w/2,w/2])box(x+dx,y+h/2,z,.025,h,.4,blue)
    box(x,y+h/2,z+.205,w,h,.03,deep)
    box(x,y+.13,z+.225,w*.7,.025,.015,pale)
  }
  for(const side of [-1,1]) {
    const shelfStart=solid.children.length
    const x=side*4.55
    const rows=side<0?7:5,height=rows*.72+.08
    box(x,height/2,-1.8,2.55,height,.12,deep)
    for(const dx of [-1.3,0,1.3])box(x+dx,height/2,-1.3,.08,height,1.1,pale)
    for(let shelf=0;shelf<rows;shelf++) {
      const y=.14+shelf*.72
      box(x,y,-1.3,2.7,.07,1.18,pale)
      const arrangement=(shelf+(side>0?1:0))%3
      for(let b=0;b<(arrangement===0?9:4);b++)book(x-1.12+b*.27,y+.05,-.93,.17,.32+((b*2+shelf)%4)*.085)
      if(arrangement===1)for(let stack=0;stack<4;stack++) {
        box(x+.66,y+.09+stack*.105,-1,.78,.085,.53,stack%2?blue:paper)
        box(x+.66,y+.09+stack*.105,-.724,.68,.055,.02,pale)
      }
      if(arrangement===2) {
        box(x+.66,y+.23,-1,.83,.38,.55,blue)
        box(x+.66,y+.43,-1,.88,.04,.58,pale)
        box(x+.66,y+.26,-.71,.22,.1,.025,paper)
      }
    }
    box(x,height,-1.3,2.7,.07,1.18,pale)
    for(let stack=0;stack<4;stack++)box(x+.5,height+.1+stack*.11,-1.25,.9,.09,.7,stack%2?blue:paper)
    for(let drawer=0;drawer<3;drawer++) {
      box(x+.5,.27+drawer*.38,.05,.9,.33,.8,blue)
      box(x+.5,.27+drawer*.38,.46,.23,.04,.04,paper)
    }
    // Offset the two bays in depth as well as height: a studio, not mirrored display shelving.
    for(const item of solid.children.slice(shelfStart)) {
      item.position.z+=side<0?.25:-.45
      if(fixed) {
        const width=side<0?.92:1.25,heightScale=side<0?.88:1.06
        item.position.x=x+(item.position.x-x)*width+(side<0?-.15:.25)
        item.position.y*=heightScale;item.scale.x*=width;item.scale.y*=heightScale
        item.position.z-=side<0?.25:.45
      }
    }
  }
  const workbench=buildStudioWorkbench(paper,edge,blue)
  if(fixed) {
    // Reference study only: rotate the whole assembled desk and sitter together.
    const pivot=new THREE.Vector3(-1.4,0,1.35),turn=new THREE.Matrix4().makeRotationY(-.16)
    for(const part of workbench.table.children){part.position.sub(pivot).applyMatrix4(turn).add(pivot);part.rotation.y-=.16}
    workbench.character.position.sub(pivot).applyMatrix4(turn).add(pivot)
    workbench.character.rotation.y=.85
    workbench.character.rotation.x=.07
  }
  // Flatten table parts into the existing static batch; keep the rig articulated.
  for(const part of [...workbench.table.children])solid.add(part)
  root.add(workbench.character)
  // Two low storage arrangements occupy the edges of the foreground, never the central path.
  for(let stack=0;stack<5;stack++) {
    const y=.17+stack*.17
    const cover=box(-4.35,y,2.2,1.38,.06,.93,blue);cover.rotation.y=.12
    const pages=box(-4.35,y+.065,2.2,1.3,.07,.85,paper);pages.rotation.y=.12
    const top=box(-4.35,y+.12,2.2,1.38,.025,.93,pale);top.rotation.y=.12
  }
  mesh(new THREE.CylinderGeometry(.4,.34,.83,12,1,true),blue,4.85,.53,1.55)
  mesh(new THREE.TorusGeometry(.4,.035,4,16),pale,4.85,.95,1.55).rotation.x=Math.PI/2
  for(let roll=0;roll<5;roll++) {
    const height=1.1+(roll%3)*.25
    const tube=mesh(new THREE.CylinderGeometry(.075,.075,height,12,1,true),paper,4.62+roll*.115,.55+height/2,1.55+(roll%2)*.13)
    tube.rotation.z=(roll-2)*.045
  }
  // Foreground cut-paper plants frame the room while leaving the central path open.
  for(const side of [-1,1])for(let stem=0;stem<3;stem++) {
    const x=side*(5.9+stem*.35),z=2.4+stem*.38,h=1.25+stem*.42
    beam(new THREE.Vector3(x,-.25,z),new THREE.Vector3(x-side*.15,h,z),.035,pale)
    for(let leaf=0;leaf<5;leaf++) {
      const outline=new THREE.Shape();outline.moveTo(0,0)
      outline.bezierCurveTo(.16,.45,.43,.68,.72,.7)
      outline.bezierCurveTo(.73,.28,.28,.03,0,0);outline.closePath()
      const item=mesh(new THREE.ExtrudeGeometry(outline,{depth:.025,bevelEnabled:false,curveSegments:8}),leaf%2?blue:pale,x-side*.08,leaf*h/6,z)
      item.rotation.z=leaf%2?-.38:1.6;item.rotation.y=side*.25
    }
  }
  // Drafting board and chair flank the path without filling its entrance.
  box(2.85,2,-1.8,1.65,1.25,.08,pale)
  box(2.85,2,-1.74,1.48,1.08,.025,deep)
  for(let i=0;i<7;i++)box(2.24+i*.2,2,-1.715,.012,.95,.008,pale)
  for(let i=0;i<5;i++)box(2.85,1.58+i*.2,-1.71,1.35,.012,.008,pale)
  for(const x of [2.25,3.45])box(x,.88,-1.8,.065,1.7,.065,pale)
  box(.7,1.05,2.2,1,.12,.88,pale);box(.7,1.67,1.83,1,1.15,.08,blue)
  box(.7,.53,2.2,.09,.98,.09,pale)
  for(const x of [.25,1.15])for(const z of [1.8,2.6])beam(new THREE.Vector3(.7,.2,2.2),new THREE.Vector3(x,.12,z),.05)
  for(const x of [.25,1.15])for(const z of [1.8,2.6])mesh(new THREE.CylinderGeometry(.085,.085,.065,12),deep,x,.115,z).rotation.x=Math.PI/2
  for(const x of [.22,1.18]) {
    box(x,1.35,2.13,.06,.48,.06,pale)
    box(x,1.59,2.13,.09,.055,.55,pale)
  }
  // Rear blueprint diagrams and tower stacks provide tall, dense depth behind the low furniture.
  for(let i=0;i<12;i++)box(-4.7+i*.36,4,-5.16,.018,4.9,.012,pale)
  for(let i=0;i<12;i++)box(-2.7,1.5+i*.44,-5.15,4.1,.018,.012,pale)
  // Structural drawing over the grid: a few legible braces instead of more grid density.
  for(let level=0;level<4;level++) {
    const y=2+level*.8
    beam(new THREE.Vector3(-4.3,y,-5.12),new THREE.Vector3(-3.4,y+.8,-5.12),.032,paper)
    beam(new THREE.Vector3(-3.4,y,-5.12),new THREE.Vector3(-4.3,y+.8,-5.12),.032,paper)
    box(-3.85,y,-5.12,1.08,.035,.028,paper)
  }
  const towers:THREE.Group[]=[]
  const tiers:THREE.Group[][]=[]
  for(let i=0;i<9;i++) {
    const tower=new THREE.Group();tower.position.set(-.65+(i%5)*.63,.14,-3.7+Math.floor(i/5)*.63);root.add(tower);towers.push(tower)
    if(fixed){tower.position.x=.05+(i%5)*.79;tower.position.z-=.25;tower.scale.x=1.12}
    const height=[3.5,5,7.2,5.8,3.9,2.3,3.5,4.1,2.5][i]
    const levels:THREE.Group[]=[];tiers.push(levels)
    for(let level=0;level<4;level++) {
      const tier=new THREE.Group(),h=height/4
      tier.position.y=level*h;tower.add(tier);levels.push(tier)
      box(0,h/2,0,.48,h-.035,.5,blue,tier)
      for(let y=.25;y<h;y+=.42)box(0,y,.26,.49,.018,.016,pale,tier)
      for(const x of [-.18,.18])box(x,h/2,.26,.013,h,.012,pale,tier)
      box(0,h,0,.5,.035,.52,pale,tier)
    }
  }
  // Batch within each animated group; retain only a small set of independently moving towers.
  const batch=(group:THREE.Group) => {
    group.updateMatrixWorld(true)
    const byMaterial=new Map<THREE.Material,THREE.BufferGeometry[]>()
    for(const child of [...group.children])if(child instanceof THREE.Mesh) {
      const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();g.applyMatrix4(child.matrix)
      const m=child.material as THREE.Material, list=byMaterial.get(m)??[];list.push(g);byMaterial.set(m,list)
      child.geometry.dispose();group.remove(child)
    }
    for(const [m,list] of byMaterial){const merged=mergeGeometries(list,false);if(merged)mesh(merged,m,0,0,0,group);list.forEach(g=>g.dispose())}
  }
  batch(solid);tiers.flat().forEach(batch)
  if(fixed) {
    // Treat the cutaway border as a photographic frame: retain local AO but do not
    // project its off-camera rectangular perimeter onto the entire back wall.
    batch(aperture)
    aperture.children.forEach(part=>{if(part instanceof THREE.Mesh)part.castShadow=false})
  }
  for(const part of workbench.character.children)if(part instanceof THREE.Group)batch(part)
  batch(workbench.character)
  return {root,towers,tiers,pose:workbench.pose,dispose:()=>{root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose()});workbench.disposeMaterials();materials.forEach(m=>m.dispose());grain.dispose();color.dispose()}}
}
