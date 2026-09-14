import * as THREE from 'three'
import type { UniverseCode } from './simulation'

/** Low roadside scenery, not earned rewards. Shares the four static paper batches. */
export function buildPaperRoadside(code: UniverseCode, papers: Record<'cream' | 'edge' | 'ink' | 'pale', THREE.Material>) {
  const root = new THREE.Group()
  for (let site = 0; site < 3; site++) {
    const group = new THREE.Group()
    group.position.set(site % 2 ? -7 : 7, .17, 6 - site * 6)
    group.rotation.y = site % 2 ? .18 : -.22
    root.add(group)
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, material = papers.cream) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
      mesh.position.set(x, y, z); group.add(mesh); return mesh
    }
    const cylinder = (x: number, y: number, z: number, r: number, h: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), material)
      mesh.position.set(x, y, z); group.add(mesh); return mesh
    }
    // A broad folded base grounds the vignette and stays below the building silhouettes.
    box(0, .025, 0, 2.2, .05, 1.7, papers.edge)
    box(0, .065, 0, 2.12, .03, 1.62)
    if (code === 'A') {
      // Book trolley: open shelves, folded handles, four actual wheels.
      for (const y of [.36, .95]) box(0, y, 0, 1.55, .06, .7)
      for (const x of [-.74, .74]) for (const z of [-.3, .3]) box(x, .76, z, .045, 1.05, .045, papers.ink)
      for (const x of [-.74, .74]) box(x, 1.3, 0, .055, .055, .65, papers.pale)
      for (const x of [-.62, .62]) for (const z of [-.28, .28]) {
        const wheel = cylinder(x, .19, z, .12, .065, papers.ink); wheel.rotation.x = Math.PI / 2
      }
      for (let shelf = 0; shelf < 2; shelf++) for (let book = 0; book < 6 - site; book++) {
        const x = -.55 + book * .21, h = .3 + (book % 3) * .075, y = .4 + shelf * .59
        box(x, y + h / 2, 0, .14, h, .39, papers.pale)
        box(x, y + h / 2, .2, .14, h, .025, papers.ink)
        box(x, y + .1, .22, .09, .02, .012)
      }
    } else if (code === 'B') {
      // Sorting cabinet and a rack of paper rolls for the workshop.
      box(-.36, .62, 0, 1.03, 1.04, .73, papers.ink)
      for (let drawer = 0; drawer < 4; drawer++) {
        box(-.36, .24 + drawer * .25, .39, .95, .21, .035, papers.pale)
        box(-.36, .24 + drawer * .25, .42, .18, .035, .035)
      }
      box(.65, .35, 0, .53, .5, .66, papers.pale)
      for (let roll = 0; roll < 3; roll++) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, .85 + roll * .12, 12, 1, true), papers.cream)
        tube.position.set(.49 + roll * .16, .68 + roll * .06, 0); group.add(tube)
      }
      for (let page = 0; page < 3; page++) box(-.36, 1.17 + page * .035, 0, .8, .025, .55, page === 0 ? papers.pale : papers.cream)
    } else {
      // Shallow growing bed: individual thick paper leaves, no particles or animated substitute mascot.
      box(0, .22, 0, 1.8, .26, 1.12, papers.edge)
      for (const z of [-.58, .58]) box(0, .3, z, 1.92, .4, .05, papers.pale)
      for (const x of [-.93, .93]) box(x, .3, 0, .05, .4, 1.2, papers.pale)
      for (let plant = 0; plant < 6; plant++) {
        const x = -.6 + plant % 3 * .6, z = -.3 + Math.floor(plant / 3) * .6
        box(x, .6, z, .025, .52, .025, papers.ink)
        for (const side of [-1, 1]) {
          const leaf = new THREE.Shape(); leaf.moveTo(0, 0)
          leaf.quadraticCurveTo(.05, .32, .38, .42); leaf.quadraticCurveTo(.43, .12, 0, 0)
          const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(leaf, {depth: .02, bevelEnabled: false, curveSegments: 6}), side < 0 ? papers.ink : papers.pale)
          mesh.position.set(x, .57, z); mesh.rotation.z = side < 0 ? 1.8 : -.3; group.add(mesh)
        }
      }
      box(.68, .8, .5, .34, .18, .025)
      box(.68, .57, .5, .025, .4, .025, papers.ink)
    }
  }
  return root
}
