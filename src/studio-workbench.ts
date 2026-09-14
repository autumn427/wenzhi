import * as THREE from 'three'

/** One assembled workbench and a scene-native, articulated Kanshan study. */
export function buildStudioWorkbench(paper: THREE.MeshStandardMaterial, edge: THREE.MeshStandardMaterial, blue: THREE.MeshStandardMaterial) {
  const table = new THREE.Group(), character = new THREE.Group()
  table.name = 'layered-workbench'; character.name = 'kanshan-sculpture'
  const white = new THREE.MeshStandardMaterial({color:'#f4f1e7',roughness:.92})
  const ink = new THREE.MeshStandardMaterial({color:'#252a2b',roughness:.78})
  const put=(parent:THREE.Group,g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{
    const item=new THREE.Mesh(g,m);item.position.set(x,y,z);item.castShadow=true;item.receiveShadow=true;parent.add(item);return item
  }
  const slab=(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material)=>{
    const outline=new THREE.Shape(),r=.075
    outline.moveTo(-w/2+r,-d/2);outline.lineTo(w/2-r,-d/2);outline.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r)
    outline.lineTo(w/2,d/2-r);outline.quadraticCurveTo(w/2,d/2,w/2-r,d/2)
    outline.lineTo(-w/2+r,d/2);outline.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r)
    outline.lineTo(-w/2,-d/2+r);outline.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2)
    const g=new THREE.ExtrudeGeometry(outline,{depth:h,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:2,curveSegments:8});g.rotateX(-Math.PI/2)
    const points=g.attributes.position
    for(let i=0;i<points.count;i++) {
      const px=points.getX(i),pz=points.getZ(i)
      // Shared coordinate-based offsets preserve joined faces and the board's thickness.
      points.setXYZ(i,px+.0025*Math.sin(pz*31+x),points.getY(i)+.0018*Math.sin(px*17+pz*11),pz+.002*Math.sin(px*27+z))
    }
    g.computeVertexNormals()
    return put(table,g,m,x,y,z)
  }
  // Broad three-ply board, folded trestles and a low stretcher: one legible silhouette.
  slab(-1.4,1.7,1.35,4.65,.045,2.32,edge)
  slab(-1.4,1.745,1.35,4.6,.055,2.27,paper)
  slab(-1.4,1.8,1.35,4.54,.024,2.21,paper)
  for(const x of [-3.1,.3]) {
    for(const direction of [-1,1]) {
      const support=put(table,new THREE.BoxGeometry(.16,1.65,1.7),paper,x+direction*.17,.87,1.35)
      support.rotation.z=direction*.13
    }
    slab(x,.08,1.35,.75,.08,1.85,edge)
  }
  slab(-1.4,.43,1.35,3.65,.07,1.35,blue)
  // A single softly folded sheet, instead of unrelated flat rectangles at the edge.
  const vertices:number[]=[],uv:number[]=[],indices:number[]=[]
  for(let i=0;i<=32;i++) {
    const t=i/32,z=.65+t*2.05,y=1.842-Math.pow(Math.max(0,(t-.72)/.28),1.6)*.64
    for(const side of [-1,1]) {vertices.push(-.45+side*.43,y,z);uv.push((side+1)/2,t)}
    if(i<32){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3)}
  }
  const sheet=new THREE.BufferGeometry();sheet.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));sheet.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));sheet.setIndex(indices);sheet.computeVertexNormals()
  put(table,sheet,blue,0,0,0)
  slab(-1.8,1.83,1.4,1.05,.025,.75,edge)
  slab(-1.8,1.855,1.4,.98,.012,.68,paper)

  // A grounded drafting stool supports the seated pose and the visible feet.
  put(table,new THREE.CylinderGeometry(.48,.48,.09,32),paper,-1.65,.86,-.35)
  for(const x of [-1.97,-1.33])for(const z of [-.65,-.05])put(table,new THREE.BoxGeometry(.075,.8,.075),blue,x,.43,z)
  slab(-1.65,.49,-.12,.9,.045,.55,edge)
  character.position.set(-1.65,.13,-.35);character.rotation.y=.4
  const oval=(parent:THREE.Group,m:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{
    const g=new THREE.SphereGeometry(1,32,24);g.scale(sx,sy,sz);return put(parent,g,m,x,y,z)
  }
  // Pear-shaped body and rounded snout; ears are tapered, not floating cones.
  const contour=new THREE.CatmullRomCurve3([[0,0],[.36,.03],[.55,.23],[.62,.65],[.56,1.02],[.48,1.35],[.54,1.65],[.56,1.92],[.43,2.2],[0,2.34]].map(([r,y])=>new THREE.Vector3(r,y,0)))
  const profile=contour.getPoints(72).map(p=>new THREE.Vector2(Math.max(0,p.x),p.y))
  const body=new THREE.LatheGeometry(profile,64);body.scale(1,1,.85)
  put(character,body,white,0,.36,0)
  for(const x of [-.36,.36]) {
    const ear=oval(character,white,x,2.61,.01,.17,.34,.17);ear.rotation.z=x>0?-.16:.16
  }
  oval(character,white,0,1.95,.4,.4,.34,.45)
  oval(character,ink,.03,2.04,.76,.3,.27,.24)
  for(const x of [-.32,.32])oval(character,ink,x,2.24,.432,.049,.068,.038)
  oval(character,white,.43,.74,-.37,.27,.28,.29)
  for(const x of [-.27,.27])oval(character,ink,x,.17,.12,.19,.17,.3)
  const arms:THREE.Group[]=[]
  for(const side of [-1,1]) {
    const arm=new THREE.Group();arm.position.set(side*.48,1.58,.11);character.add(arm);arms.push(arm)
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(side*.1,-.2,.16),new THREE.Vector3(side*.04,-.3,.47),new THREE.Vector3(-side*.07,-.22,.78)])
    put(arm,new THREE.TubeGeometry(curve,20,.085,10,false),ink,0,0,0)
    oval(arm,ink,-side*.07,-.22,.8,.13,.07,.16)
  }
  // Lift the working hands to the board, with shoulders connected to the body.
  character.position.y=.52
  const pose=(progress:number)=>{
    const p=THREE.MathUtils.clamp(Number.isFinite(progress)?progress:0,0,1)
    arms[0].rotation.y=-.12+p*.22;arms[1].rotation.y=.08-p*.2
    arms[0].rotation.x=-.12+p*.13;arms[1].rotation.x=.02-p*.09
  }
  pose(.58)
  return {table,character,pose,disposeMaterials:()=>{white.dispose();ink.dispose()}}
}
