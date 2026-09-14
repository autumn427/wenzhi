import * as THREE from 'three'

/** Repeatable, seamless pulp relief for the study only. No downloaded or edited images. */
export function makeStudioPaperTexture() {
  const size=512,field=new Float32Array(size*size),data=new Uint8Array(size*size*4)
  let seed=427
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    // Broad pulp variation stays low contrast; fine grain is secondary to short fibres.
    field[y*size+x]=237+(random()-.5)*3+1.6*Math.sin(x/size*Math.PI*8)*Math.cos(y/size*Math.PI*6)
  }
  for(let fibre=0;fibre<11000;fibre++) {
    const x=random()*size,y=random()*size,angle=random()*Math.PI*2,length=3+random()*12,strength=2+random()*4
    const dx=Math.cos(angle),dy=Math.sin(angle)
    for(let step=0;step<length;step+=.6) {
      const bend=Math.sin(step/length*Math.PI)*1.2
      const px=Math.floor(x+dx*step-dy*bend),py=Math.floor(y+dy*step+dx*bend)
      const wrap=(n:number)=>(n%size+size)%size
      const relief=Math.sin(step/length*Math.PI)*strength
      field[wrap(py)*size+wrap(px)]+=relief
      field[wrap(py+1)*size+wrap(px+1)]-=relief*.55
    }
  }
  for(let i=0;i<field.length;i++) {
    const value=Math.round(THREE.MathUtils.clamp(field[i],218,252))
    data[i*4]=data[i*4+1]=data[i*4+2]=value;data[i*4+3]=255
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat)
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,2)
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter
  texture.generateMipmaps=true;texture.needsUpdate=true
  return texture
}
