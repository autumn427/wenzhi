import * as THREE from 'three'

/** Tessellated, closed paper sheet with an asymmetric aperture and physically curled lip. */
export function createSculptedPaperSheet(layer:number) {
  const angular=192,radial=18,positions:number[]=[],uv:number[]=[],indices:number[]=[]
  const rx=8.7-layer*.25,ry=6.9-layer*.19
  for(let face=0;face<2;face++)for(let ring=0;ring<=radial;ring++)for(let step=0;step<=angular;step++) {
    const t=step/angular*Math.PI*2,u=ring/radial,c=Math.cos(t),s=Math.sin(t)
    const ripple=1+.033*Math.sin(t*5+.4)+.019*Math.sin(t*9+layer*.3)
      +.0035*Math.sin(t*31+layer*1.7)+.0018*Math.sin(t*67+layer*.91)
    // Use extra clearance at the foot so the cut-out never crosses the outer rectangle.
    const innerX=c*rx*ripple,innerY=4.2+s*ry*Math.min(ripple,s<-.6?1:1.06)
    const outerDistance=Math.min(12/Math.max(Math.abs(c),1e-6),(s>=0?8.8:7.2)/Math.max(Math.abs(s),1e-6))
    const x=THREE.MathUtils.lerp(innerX,c*outerDistance,u),y=THREE.MathUtils.lerp(innerY,4.2+s*outerDistance,u)
    const curl=(.17+.1*Math.sin(t*3+layer*.35))*Math.exp(-u*11)
    const undulation=.1*Math.sin(t*7+layer*.23)*Math.sin(Math.PI*u)*Math.exp(-u*3)
    const z=curl+undulation+(face===0?.07:0)
    positions.push(x,y,z);uv.push(x*.14,y*.14)
  }
  const stride=angular+1,faceSize=(radial+1)*stride
  for(let face=0;face<2;face++)for(let ring=0;ring<radial;ring++)for(let step=0;step<angular;step++) {
    const a=face*faceSize+ring*stride+step,b=a+1,c=a+stride,d=c+1
    if(face===0)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c)
  }
  // Close both inner cut edge and outer perimeter: thickness is actual geometry.
  for(const ring of [0,radial])for(let step=0;step<angular;step++) {
    const a=ring*stride+step,b=a+1,c=a+faceSize,d=b+faceSize
    if(ring===0)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d)
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2))
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox()
  return geometry
}
