// CPU（釣り合いの検証とタイトルのデモ用）
//   skilled: 予告の輪・線から出る、追尾弾は横の建物へワイヤーでふり切る、UFO を引っかけて体当たり、落ちてくる丼の下へ
//   clumsy:  同じ考えだが、反応が0.4秒遅れ、ワイヤーを3回に1回掛け損ね、予告を半分見落とす
//   idle:    何もしない（いちばん悪い結果になるはず）
import { findAnchor, blocked, RUN } from './runner.js?v=1'
import { U } from './ufo.js?v=1'

export function createUfoBot(kind, seed = 1) { let q = (seed * 9301 + 49297) % 233280; return { kind, rnd: () => ((q = (q * 9301 + 49297) % 233280) / 233280), lag: [], wT: 0, prevW: false, seen: new Set(), skip: new Set(), stuck: 0, lx: 0, lz: 0, jT: 0 } }

const segDist = (px, pz, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz || 1, s = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / L)); return Math.hypot(px - ax - vx * s, pz - az - vz * s) }

export function ufoBotInput(b, r, R, world, dt) {
  if (b.kind === 'idle') return { throttle: 0, steer: 0 }
  const inp = think(b, r, R, world, dt)
  if (b.kind === 'clumsy') {
    if (inp.moveDir) { const a = Math.atan2(inp.moveDir.x, inp.moveDir.z) + (b.rnd() - 0.5) * 0.7; inp.moveDir = { x: Math.sin(a), z: Math.cos(a) } }
    b.lag.push(inp); const n = Math.round(0.4 / dt)
    if (b.lag.length <= n) return { throttle: 0, steer: 0 }
    return b.lag.shift()
  }
  return inp
}

function think(b, r, R, world, dt) {
  const inp = { throttle: 0, steer: 0 }
  if (R.sucked || R.over) return inp
  b.wT += dt
  let flee = null, wantWire = null, goal = null
  const clumsy = b.kind === 'clumsy'
  const notice = id => { if (!clumsy) return true; if (!b.seen.has(id)) { b.seen.add(id); if (b.rnd() < 0.5) b.skip.add(id) } return !b.skip.has(id) }
  // 1) 予告から出る
  for (const bm of R.beams) {
    if (!notice(bm.id)) continue
    const d = Math.hypot(r.x - bm.x, r.z - bm.z)
    if (d < bm.r + 3) { const l = d || 1; flee = { x: (r.x - bm.x) / l || 1, z: (r.z - bm.z) / l } }
  }
  for (const L of R.lasers) {
    if (!notice(L.id)) continue
    if (segDist(r.x, r.z, L.ax, L.az, L.bx, L.bz) < 5) { const vx = L.bx - L.ax, vz = L.bz - L.az, l = Math.hypot(vx, vz) || 1, nx = -vz / l, nz = vx / l, side = (r.x - L.ax) * nx + (r.z - L.az) * nz >= 0 ? 1 : -1; flee = { x: nx * side, z: nz * side } }
  }
  // 2) 追尾弾: 近づいてきたら横の建物へワイヤーで振ってふり切る
  for (const m of R.missiles) {
    if (!notice(m.id)) continue
    const d = Math.hypot(m.x - r.x, m.y - r.y, m.z - r.z)
    if (d < 24 && !r.rope) {
      const my = Math.atan2(m.vx, m.vz), side = b.rnd() < 0.5 ? 1 : -1
      wantWire = { yaw: my + side * Math.PI / 2 }
      flee = flee || { x: Math.sin(my + side * Math.PI / 2), z: Math.cos(my + side * Math.PI / 2) }
    }
  }
  // 3) 落ちてくる丼の下へ・地面の丼を拾う
  let bowl = null, bd = 1e9
  for (const q of R.bowls) { const d = Math.hypot(q.x - r.x, q.z - r.z); if (d < 70 && d < bd) { bd = d; bowl = q } }
  // 4) UFO
  let tgt = null, ts = -1e9
  for (const u of R.ufos) {
    if (u.state !== 'fly' || (R.boss && R.boss.state === 'arrive')) continue
    const d = Math.hypot(u.x - r.x, u.y - r.y, u.z - r.z)
    const s = -d * 0.03 + (u.bowl ? (100 - u.bowl.left) * 0.02 : 0) + (u.kind === 'core' ? 1 : 0)
    if (s > ts) { ts = s; tgt = u }
  }
  if (bowl && (bowl.state === 'ground' || bowl.y - r.y < 14 || bd > 6)) goal = { x: bowl.x, z: bowl.z, bowl: true }
  else if (tgt) goal = { x: tgt.x, z: tgt.z }
  const dir = flee || (goal ? (() => { const dx = goal.x - r.x, dz = goal.z - r.z, l = Math.hypot(dx, dz); return l > 1.5 ? { x: dx / l, z: dz / l } : null })() : null)
  if (dir) { inp.moveDir = dir; inp.throttle = 1 }
  // ワイヤー
  let wire = false, at = null
  if (r.rope) {
    // 引っかけていない（ビル）のワイヤーは、行きたい向きを過ぎたら外す
    if (r.rope.ufo == null && (r.rope.t > 1.6 || (r.vy < -2 && r.rope.t > 0.6))) wire = true
  } else if (b.wT > (clumsy ? 0.8 : 0.45) && !(r.stun > 0)) {
    if (wantWire) {
      const a = findAnchor(world, r, wantWire.yaw); if (a) { wire = true; at = a }
    } else if (!flee && tgt && !(goal && goal.bowl && bd < 12)) {
      const d = Math.hypot(tgt.x - r.x, tgt.y - (r.y + 1.2), tgt.z - r.z)
      if (d < RUN.wireRange - 3 && !blocked(world, r.x, r.y + 1.5, r.z, tgt.x, tgt.y, tgt.z)) { wire = true; at = { ufo: tgt.id, x: tgt.x, y: tgt.y, z: tgt.z } }
      else if (d > 30) { const a = findAnchor(world, r, Math.atan2(tgt.x - r.x, tgt.z - r.z)); if (a && (r.grounded || r.vy < -1)) { wire = true; at = a } }
    }
    if (wire && clumsy && b.rnd() < 0.33) { wire = false; b.wT = 0 }
  }
  if (wire) b.wT = 0
  inp.wire = wire && !b.prevW; b.prevW = wire
  if (inp.wire && at) inp.wireAt = at
  // 詰まったら跳ぶ
  b.stuck = Math.hypot(r.x - b.lx, r.z - b.lz) < 0.05 && !r.climbing && inp.throttle ? b.stuck + dt : 0
  b.lx = r.x; b.lz = r.z
  if (b.stuck > 1 || r.climbing) { inp.jump = !b.prevJ; b.stuck = 0 }
  b.prevJ = !!inp.jump
  return inp
}
