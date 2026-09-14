import * as THREE from 'three'
import type { UniverseCode } from './simulation'

/** A freestanding, open-front cut-paper theatre. No picture planes or opaque wall over the road. */
export function buildPaperLandscape(code: UniverseCode, papers: { cream: THREE.Material; edge: THREE.Material; ink: THREE.Material; pale: THREE.Material }) {
  const root = new THREE.Group()
  // The theatre folds out of a backing sheet; rear contour feet must not float off the island.
  for (let layer=0;layer<3;layer++) {
    const page = new THREE.Mesh(new THREE.BoxGeometry(28.4-layer*.12,.045,35.4-layer*.12),layer===0?papers.edge:papers.cream)
    page.position.set(0,-1.10+layer*.05,0);root.add(page)
  }
  const palette = [papers.cream, papers.edge, papers.cream, papers.pale, papers.cream, papers.ink, papers.pale]
  for (let layer = 0; layer < 7; layer++) {
    const shape = new THREE.Shape()
    const w = 8.8 - layer * .30, h = 5.2 - layer * .22
    const point = (t: number, inset: number) => {
      const fold = code === 'A' ? .018 * Math.cos(t * 12) : code === 'B' ? .035 * Math.sin(t * 16) : .045 * Math.sin(t * 5 + .3)
      return new THREE.Vector2(Math.cos(t) * (w - inset) * (1 + fold), -.97 + Math.sin(t) * (h - inset) * (1 + fold))
    }
    for (let i = 0; i <= 96; i++) {
      const p = point(Math.PI - i / 96 * Math.PI, 0)
      if (i === 0) shape.moveTo(p.x, p.y); else shape.lineTo(p.x, p.y)
    }
    for (let i = 0; i <= 96; i++) {
      const p = point(i / 96 * Math.PI, .38)
      shape.lineTo(p.x, p.y)
    }
    shape.closePath()
    const sheet = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth:.08,bevelEnabled:false}), palette[layer])
    // Keep every layer behind the final station (z=-12), including its rear frame.
    // Otherwise the end-of-route close-up looks through the landscape itself.
    sheet.position.z = -16 + layer * .16
    root.add(sheet)
  }
  // Lower side contours give the road an enclosing landscape without blocking its entrance.
  for (const side of [-1,1]) for (let layer=0;layer<4;layer++) {
    const s = new THREE.Shape()
    s.moveTo(-7,0);s.lineTo(7,0)
    s.bezierCurveTo(7,2.8,3,3.8,1,2.6)
    s.bezierCurveTo(-2,1.3,-4,1.6,-7,.3);s.closePath()
    const bank = new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:.075,bevelEnabled:false}),layer%2 ? papers.cream : papers.pale)
    bank.rotation.y = side * Math.PI / 2
    bank.position.set(side * (10.1 - layer * .2),.05,-4)
    bank.scale.y = 1 - layer * .12
    root.add(bank)
  }
  return root
}
