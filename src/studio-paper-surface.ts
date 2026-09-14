import * as THREE from 'three'

/** Object-space triplanar pulp: consistent fibre size across shelves and broad sheets. */
export function applyStudioPaperSurface(material:THREE.MeshStandardMaterial) {
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vPaperPoint;\n'+shader.vertexShader
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPaperPoint = position;')
    shader.fragmentShader=`varying vec3 vPaperPoint;
vec4 paperSample(sampler2D tex) {
  vec3 weights=abs(normalize(cross(dFdx(vPaperPoint),dFdy(vPaperPoint))));
  weights=pow(weights,vec3(4.0));weights/=max(dot(weights,vec3(1.0)),0.00000001);
  vec3 p=vPaperPoint*0.28;
  return texture2D(tex,p.yz)*weights.x+texture2D(tex,p.xz)*weights.y+texture2D(tex,p.xy)*weights.z;
}
`+shader.fragmentShader
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','diffuseColor *= paperSample(map);')
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
float paperHeight=paperSample(bumpMap).r*bumpScale;
normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(paperHeight),dFdy(paperHeight)),faceDirection);
`)
  }
  material.customProgramCacheKey=()=> 'studio-triplanar-pulp-v1'
}
