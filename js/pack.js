// 背中の電池パック（体力を体の上で見せる）。6本のセルが光り、減ると消えていく。残り2本からは赤
import * as THREE from 'three'

const M = {
  body: new THREE.MeshStandardMaterial({ color: 0x2a2d30, metalness: 0.6, roughness: 0.45 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x55585a, metalness: 0.7, roughness: 0.35 }),
  on: new THREE.MeshBasicMaterial({ color: 0x6ff6ff }),
  low: new THREE.MeshBasicMaterial({ color: 0xff3a2a }),
  off: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6 })
}
export function makePack(n = 6) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.14), M.body); body.castShadow = true
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.05, 0.16), M.frame); rim.position.y = 0.23
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 5), M.frame); ant.position.set(0.13, 0.36, 0)
  g.add(body, rim, ant)
  const cells = []
  const gc = new THREE.BoxGeometry(0.11, 0.075, 0.02)
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(gc, M.on)
    const col = i % 2, row = Math.floor(i / 2)
    c.position.set(col ? 0.065 : -0.065, -0.12 + row * 0.105, -0.075)   // 背中側（-z）の面
    g.add(c); cells.push(c)
  }
  g.userData.cells = cells
  g.userData.set = (hp, flash = 0) => {
    for (let i = 0; i < cells.length; i++) cells[i].material = i < hp ? (hp <= 2 ? M.low : M.on) : M.off
    M.on.color.setHex(flash > 0 ? 0xffffff : 0x6ff6ff)
  }
  return g
}
