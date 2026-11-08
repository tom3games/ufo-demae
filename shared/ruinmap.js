// 廃都の当たり判定（画面と bot で同じ）。墜ちた UFO 3機と、広場の鉄塔（ワイヤーを掛ける所）。three.js に依存しない
// v4（2026-11-09 本人「もっとワイヤーの移動を楽しみたい。地形を活かしたり」）: 開けた所にも掛け点を増やす
import { ARENA } from './ufo.js?v=1'

function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function addBox(world, c) { world.colliders.push(c); world.colGrid.add(c, c.cx - c.hw - 1, c.cz - c.hl - 1, c.cx + c.hw + 1, c.cz + c.hl + 1) }

export function addRuinMap(world) {
  if (world.ruinMap) return world.ruinMap
  const rnd = rng(91)
  const free = (x, z, pad) => {
    if (world.groundAt(x, z, 3).h > 0.6) return false
    for (const c of world.nearby(x, z)) { if (c.kind === 'bound') continue; if (Math.abs(x - c.cx) < c.hw + pad && Math.abs(z - c.cz) < c.hl + pad) return false }
    return true
  }
  const wrecks = [{ x: 36, z: 842, a: 0.4 }]   // 開始地点の東の空き地（もとは店のあった所）
  for (let t = 0; wrecks.length < 3 && t < 400; t++) {
    const a = rnd() * Math.PI * 2, d = 45 + rnd() * 60, x = ARENA.x + Math.sin(a) * d, z = ARENA.z + Math.cos(a) * d
    if (free(x, z, 6) && wrecks.every(w => Math.hypot(w.x - x, w.z - z) > 50)) wrecks.push({ x, z, a: rnd() * 6 })
  }
  for (const w of wrecks) { const gy = world.groundAt(w.x, w.z, 3).h; w.y = gy; addBox(world, { cx: w.x, cz: w.z, yaw: 0, hw: 3.6, hl: 3.6, y0: gy, y1: gy + 2.4, kind: 'building', small: true, wreck: true }) }
  // 鉄塔: 広場や通りの開けた所に 14 本（高さ 22〜34m・細い）。ワイヤーを掛けて振る所
  const towers = []
  for (let t = 0; towers.length < 14 && t < 2000; t++) {
    const a = rnd() * Math.PI * 2, d = 12 + rnd() * (ARENA.r - 10), x = ARENA.x + Math.sin(a) * d, z = ARENA.z + Math.cos(a) * d
    if (Math.hypot(x - 21, z - 842) < 10) continue
    if (!free(x, z, 3.5) || towers.some(q => Math.hypot(q.x - x, q.z - z) < 22) || wrecks.some(w => Math.hypot(w.x - x, w.z - z) < 10)) continue
    const gy = world.groundAt(x, z, 3).h, h = 22 + rnd() * 12
    const c = { cx: x, cz: z, yaw: 0, hw: 0.9, hl: 0.9, y0: gy, y1: gy + h, kind: 'building', small: true, tower: true }
    addBox(world, c); towers.push({ x, z, y: gy, h, tilt: (rnd() - 0.5) * 0.12, c })
  }
  world._anchorBoxes = null
  world.ruinMap = { wrecks, towers }
  return world.ruinMap
}
