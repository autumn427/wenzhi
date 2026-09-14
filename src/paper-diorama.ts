import * as THREE from 'three'
import type { UniverseCode } from './simulation'

type Papers = { cream: THREE.Material; edge: THREE.Material; ink: THREE.Material; pale: THREE.Material }

/** Handmade-looking architectural miniatures. Geometry is static and merged by the caller. */
export function buildPaperStation(code: UniverseCode, station: number, papers: Papers) {
  const root = new THREE.Group()
  const { cream, edge, ink, pale } = papers
  const add = (g: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(g, material); m.position.set(x, y, z); root.add(m); return m
  }
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat = cream) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z)
  const cut = (shape: THREE.Shape, mat: THREE.Material, depth = .045) => add(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 }), mat)
  const beam = (a: THREE.Vector3, b: THREE.Vector3, width = .065, mat = cream) => {
    const m = add(new THREE.BoxGeometry(width, a.distanceTo(b), width), mat)
    m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return m
  }
  const arch = (width: number, height: number, x: number, z: number) => {
    // Nested freestanding sheets, not solid blocks; negative space remains genuinely open.
    for (let layer = 0; layer < 3; layer++) {
      const w = width - layer * .23, h = height - layer * .18
      const outer = new THREE.Shape()
      outer.moveTo(-w / 2, 0); outer.lineTo(-w / 2, h * .63)
      outer.bezierCurveTo(-w / 2, h * .88, -w * .23, h, 0, h)
      outer.bezierCurveTo(w * .23, h, w / 2, h * .88, w / 2, h * .63)
      outer.lineTo(w / 2, 0); outer.closePath()
      const hole = new THREE.Path(), iw = w / 2 - .18, ih = h - .22
      hole.moveTo(-iw, .08); hole.lineTo(iw, .08); hole.lineTo(iw, ih * .64)
      hole.bezierCurveTo(iw, ih * .87, iw * .45, ih, 0, ih)
      hole.bezierCurveTo(-iw * .45, ih, -iw, ih * .87, -iw, ih * .64)
      hole.closePath(); outer.holes.push(hole)
      const frame = cut(outer, layer === 1 ? pale : cream, .08)
      frame.position.set(x, .14, z + layer * .14)
    }
  }
  const book = (x: number, y: number, z: number, w: number, h: number, lean = 0) => {
    // Pages sit inside folded covers; rotate the whole book, not just its body.
    const volume = new THREE.Group(); volume.position.set(x, y, z); volume.rotation.z = lean
    const part = (px: number, py: number, pz: number, pw: number, ph: number, pd: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), mat)
      mesh.position.set(px, py, pz); volume.add(mesh)
    }
    part(0, h / 2, 0, w * .75, h - .035, .22, cream)
    for (const side of [-1, 1]) part(side * w * .46, h / 2, 0, .018, h, .26, pale)
    part(0, h / 2, .125, w, h, .022, ink)
    part(0, h * .24, .14, w * .65, .025, .009, cream)
    root.add(volume)
  }
  const stool = (x: number, z: number) => {
    box(x, .68, z, .58, .07, .55, pale)
    box(x, .63, z, .61, .035, .58, edge)
    for (const dx of [-.21, .21]) for (const dz of [-.2, .2]) box(x + dx, .39, z + dz, .045, .48, .045)
    box(x, .33, z, .46, .035, .035, ink)
  }
  const desk = (x: number, z: number, width = 2.5) => {
    box(x, 1.1, z, width, .09, 1.2)
    box(x, 1.03, z, width + .06, .035, 1.26, edge)
    for (const dx of [-width * .4, width * .4]) for (const dz of [-.45, .45]) box(x + dx, .55, z + dz, .07, 1.1, .07, ink)
  }
  const openBook = (x: number, y: number, z: number) => {
    for (const side of [-1, 1]) {
      const page = box(x + side * .23, y, z, .46, .035, .6); page.rotation.z = side * .16
      for (let line = 0; line < 4; line++) box(x + side * .23, y + .045, z - .17 + line * .1, .31, .008, .008, pale)
    }
  }
  // A layered, stepped plinth joins architecture to the road instead of a flat square card.
  for (let i = 0; i < 3; i++) box(0, .025 + i * .06, 0, 4.7 - i * .18, .05, 3.7 - i * .18, i === 1 ? edge : cream)
  for (let i = 0; i < 3; i++) box(-.7, .055 + i * .055, 2 - i * .22, 1.3, .09, .45)

  if (code === 'A') {
    if (station === 0 || station === 3) arch(4.4, station === 3 ? 5.6 : 4.7, 0, -1.45)
    const count = station === 0 ? 2 : 3
    for (let bay = 0; bay < count; bay++) {
      const x = (bay - (count - 1) / 2) * 1.12
      const h = 2.5 + ((bay + station) % 3) * .6 + (station === 1 ? 1 : 0)
      box(x, h / 2 + .2, -.9, 1, h, .1, ink)
      for (const edgeX of [-.5, .5]) box(x + edgeX, h / 2 + .2, -.58, .065, h, .65)
      for (let shelf = 0; shelf < Math.floor(h / .6); shelf++) {
        const y = .24 + shelf * .6
        box(x, y, -.58, 1.04, .065, .72)
        for (let b = 0; b < 4; b++) book(x - .34 + b * .21, y + .04, -.34, .13, .32 + ((b + shelf) % 3) * .07, b === 3 ? -.08 : 0)
      }
    }
    desk(.25, .85, station === 2 ? 3 : 2)
    openBook(.1, 1.17, .85)
    stool(1.15, 1.42)
    // A small pile beside the open book gives the reading table a working scale.
    for (let page = 0; page < 4; page++) {
      const sheet = box(.88, 1.18 + page * .027, .65, .4, .022, .46, page === 0 ? ink : cream)
      sheet.rotation.y = -.12
    }
    if (station === 2) {
      // An open drafting station between the reading alcove and the archive.
      const board = box(.65, 1.8, .4, 1.2, .85, .055, ink); board.rotation.x = -.17
      for (let line=0;line<4;line++) box(.65,1.53+line*.15,.46,.9,.018,.02,pale)
      box(.65,1.38,.4,.065,.55,.065)
    }
    if (station > 0) {
      for (let i = 0; i < 9; i++) box(-1.95, .27 + i * .25, 1.35 - i * .25, .55, .06, .28, pale)
      beam(new THREE.Vector3(-2.22, .75, 1.4), new THREE.Vector3(-2.22, 2.8, -.7), .04)
    }
    if (station === 3) {
      box(.85, 2.3, .5, .055, 2.3, .055, ink)
      add(new THREE.ConeGeometry(.48, .4, 8, 1, true), cream, .85, 3.25, .5)
    }
  } else if (code === 'B') {
    // Workshop bays use angular folded lintels rather than the library's rounded arches.
    for (const x of [-2,2]) box(x,2,-1.2,.11,3.7,.1,ink)
    const lintel = box(0,3.8,-1.2,4.2,.16,.15,pale); lintel.rotation.z = station%2 ? -.06 : .06
    const gear = (x: number, y: number, r: number, teeth: number) => {
      const s = new THREE.Shape()
      for (let i = 0; i <= teeth * 4; i++) {
        const t = i / (teeth * 4) * Math.PI * 2, radius = r * (i % 4 < 2 ? 1 : .84)
        if (i === 0) s.moveTo(Math.cos(t) * radius, Math.sin(t) * radius)
        else s.lineTo(Math.cos(t) * radius, Math.sin(t) * radius)
      }
      s.closePath(); const hole = new THREE.Path(); hole.absarc(0, 0, r * .57, 0, Math.PI * 2, true); s.holes.push(hole)
      const m = cut(s, ink, .1); m.position.set(x, y, -1)
      for (let spoke = 0; spoke < 6; spoke++) {
        const rib = box(x, y, -.94, .045, r * 1.5, .055, pale); rib.rotation.z = spoke * Math.PI / 3
      }
      add(new THREE.CylinderGeometry(.12, .12, .13, 12), cream, x, y, -.86).rotation.x = Math.PI / 2
    }
    gear(-.7, station === 1 ? 2.3 : 2.65, station === 1 ? 1.12 : .87, 12); gear(.85, 3.12, .6, 10)
    if (station > 1) gear(1.25, 1.9, .48, 8)
    desk(-.15, .5, station === 2 ? 3.3 : 2.8)
    stool(-1.15, 1.48)
    // A ruler and hinged paper prototype belong on the work surface, not floating above it.
    box(-.8, 1.16, .92, .85, .025, .08, ink)
    for (let tick = 0; tick < 8; tick++) box(-1.15 + tick * .1, 1.176, .92, .008, .008, tick % 2 ? .035 : .06, cream)
    const sample = new THREE.Shape()
    sample.moveTo(0, 0); sample.lineTo(.34, .43); sample.lineTo(.65, 0); sample.closePath()
    const folded = cut(sample, pale, .035); folded.position.set(-1.1, 1.15, .17)
    for (let sheet = 0; sheet < 3 + station; sheet++) {
      const p = box(-.4, 1.17 + sheet * .025, .5, 1, .02, .75, sheet % 2 ? pale : cream); p.rotation.y = sheet * .12
    }
    for (let roll = 0; roll < 3; roll++) {
      const scroll = add(new THREE.CylinderGeometry(.09, .09, .85, 12, 1, true), cream, .7 + roll * .2, 1.25, .5)
      scroll.rotation.x = Math.PI / 2
    }
    box(1.7, .68, -.2, .62, 1, .85, ink)
    for (let drawer = 0; drawer < 3; drawer++) {
      box(1.7, .38 + drawer * .28, .24, .54, .24, .055, pale)
      box(1.7, .38 + drawer * .28, .285, .13, .025, .035, cream)
    }
    beam(new THREE.Vector3(-1.65, .2, -.6), new THREE.Vector3(-1.65, 3.5, -.6), .06, ink)
    beam(new THREE.Vector3(-1.65, 3.5, -.6), new THREE.Vector3(-.6, 3.5, .4), .055, ink)
    add(new THREE.ConeGeometry(.5, .48, 10, 1, true), cream, -.6, 3.16, .4)
  } else {
    // No repeated library portal in this route: alternate low nursery beds and roofed bays.
    // A greenhouse skeleton in folded paper, never transparent plastic or glass.
    for (const z of station === 1 ? [] : [-1.25, .1, 1.4]) {
      for (const x of [-1.95, 1.95]) {
        beam(new THREE.Vector3(x, .2, z), new THREE.Vector3(x, 2.65, z), .07, pale)
        beam(new THREE.Vector3(x, 2.65, z), new THREE.Vector3(0, 3.65, z), .07, cream)
      }
    }
    if (station !== 1) beam(new THREE.Vector3(0, 3.65, -1.25), new THREE.Vector3(0, 3.65, 1.4), .07)
    if (station !== 1) {
      // Low side rails tie the thin roof frames into one folded-paper building.
      for (const x of [-1.95, 1.95]) for (const y of [.38, 1.12]) {
        beam(new THREE.Vector3(x, y, -1.25), new THREE.Vector3(x, y, 1.4), .055, pale)
      }
      box(0, 1.05, -1.44, 2.5, .065, .42)
      for (const x of [-1.05, 1.05]) box(x, .61, -1.44, .055, .82, .055, ink)
      for (let tray = 0; tray < 3; tray++) {
        const x = -.75 + tray * .75
        box(x, 1.11, -1.44, .58, .05, .31, edge)
        for (const dz of [-.16, .16]) box(x, 1.16, -1.44 + dz, .62, .1, .025, pale)
        for (const dx of [-.3, .3]) box(x + dx, 1.16, -1.44, .025, .1, .32, pale)
      }
    }
    if (station === 1) for (const z of [-1.25,1.25]) box(0,.32,z,3.7,.3,.065,pale)
    for (let plant = 0; plant < 6; plant++) {
      const x = (plant % 3 - 1) * 1.12, z = Math.floor(plant / 3) * 1.25 - .7
      const h = .65 + ((plant + station) % 3) * .3
      add(new THREE.CylinderGeometry(.38, .29, .4, 12), edge, x, .4, z)
      add(new THREE.TorusGeometry(.37, .035, 4, 16), cream, x, .6, z).rotation.x = Math.PI / 2
      box(x, .6 + h / 2, z, .028, h, .028, ink)
      for (let leaf = 0; leaf < 4; leaf++) {
        const shape = new THREE.Shape(); shape.moveTo(0, 0)
        shape.quadraticCurveTo(.42, -.02, .58, .52); shape.quadraticCurveTo(.04, .5, 0, 0)
        const m = cut(shape, leaf % 2 ? ink : pale, .025)
        m.position.set(x, .7 + leaf * h / 5, z); m.rotation.set(.12, (plant % 2) * .5, leaf % 2 ? -.45 : 1.65)
      }
      if ((plant + station) % 3 === 0) {
        for (let petal = 0; petal < 6; petal++) {
          const m = add(new THREE.CircleGeometry(.15, 7), cream, x + Math.cos(petal * Math.PI / 3) * .16, .67 + h + Math.sin(petal * Math.PI / 3) * .16, z)
          m.scale.y = .65
        }
        add(new THREE.CircleGeometry(.09, 12), edge, x, .67 + h, z + .02)
      }
      const tag = box(x + .3, .85, z + .3, .23, .14, .025); tag.rotation.z = -.1
      box(x + .3, .63, z + .3, .018, .4, .018, ink)
    }
  }
  return root
}

export function makePaperGrain() {
  const size = 256, data = new Uint8Array(size * size * 4)
  let seed = 427
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const value = 231 + (seed % 23) + Math.sin(x * .6 + y * .3) * 2
    const i = (y * size + x) * 4
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true; texture.repeat.set(2, 2); texture.needsUpdate = true
  return texture
}
