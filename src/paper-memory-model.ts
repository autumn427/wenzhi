import * as THREE from 'three'
import type { UniverseCode } from './simulation'

/** Five physical fold-outs on a roadside plinth, grouped for one-time folding transitions. */
export function buildMemoryModel(code: UniverseCode, cream: THREE.Material, ink: THREE.Material, pale: THREE.Material) {
  const root = new THREE.Group()
  const geometries: THREE.BufferGeometry[] = []
  const create = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) => {
    geometries.push(geometry)
    const m = new THREE.Mesh(geometry, material); m.receiveShadow = true; m.castShadow = true; parent.add(m); return m
  }
  const plinth = create(new THREE.BoxGeometry(2.2, .1, 1.25), cream, root)
  plinth.position.y = .05
  const slots = Array.from({ length: 5 }, (_, i) => {
    const hinge = new THREE.Group(); hinge.position.set((i - 2) * .38, .13, 0); root.add(hinge)
    if (code === 'C') {
      const stem = create(new THREE.BoxGeometry(.025, .75, .025), ink, hinge); stem.position.y = .375
      for (const side of [-1, 1]) {
        const shape = new THREE.Shape(); shape.moveTo(0, 0)
        shape.quadraticCurveTo(.26, -.03, .32, .4); shape.quadraticCurveTo(.01, .35, 0, 0)
        const leaf = create(new THREE.ExtrudeGeometry(shape, { depth: .02, bevelEnabled: false }), side === 1 ? pale : ink, hinge)
        leaf.position.y = side === 1 ? .34 : .15; leaf.rotation.z = side === 1 ? -.25 : 1.45
      }
    } else {
      // Each unit is an open book / folded working sheet, hinged at the ground edge.
      const h = code === 'A' ? .65 : .4 + i * .09
      const back = create(new THREE.BoxGeometry(.29, h, .045), ink, hinge); back.position.set(0, h / 2, 0)
      const page = create(new THREE.BoxGeometry(.26, h * .92, .025), cream, hinge)
      page.position.set(.07, h / 2, .12); page.rotation.y = -.4
      const stripe = create(new THREE.BoxGeometry(.16, .035, .026), pale, hinge); stripe.position.set(0, h * .67, .04)
    }
    return hinge
  })
  return { root, slots, dispose: () => geometries.forEach(g => g.dispose()) }
}
