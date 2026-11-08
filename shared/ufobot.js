// CPU（釣り合いの検証とタイトルのデモ用）
//   skilled: 予告の輪・線から出る、追尾弾は横の建物へワイヤーでふり切る、UFO を引っかけて体当たり、ドローンには飛んだまま当たる
//   clumsy:  同じ考えだが、反応が0.4秒遅れ、ワイヤーを3回に1回掛け損ね、予告を半分見落とす
//   masher:  突撃できる時はすぐ突撃する（速さや開いた所を待たない）。v3 の確認用
//   evader:  ワイヤーで逃げ回るだけ（突撃しない）。v4 の確認用（逃げるだけでは勝てないこと）
//   runner:  ワイヤーを使わず地面を走るだけ（遅い人。追跡機に捕まるはず）
//   idle:    何もしない（いちばん悪い結果になるはず）
import { findAnchor, blocked, RUN } from './runner.js?v=1'
import { lockTarget } from './ufo.js?v=1'

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
  if (R.taken || R.over) return inp
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
  // 3) 狙う UFO（向かう先）と、今すぐ突撃できる UFO
  const sp = Math.hypot(r.vx, r.vy, r.vz)
  let tgt = null, ts = -1e9
  for (const u of R.ufos) {
    if (u.state !== 'fly' || (R.boss && R.boss.state === 'arrive')) continue
    const d = Math.hypot(u.x - r.x, u.y - r.y, u.z - r.z)
    const s2 = -d * 0.03 + (u.kind === 'core' ? 1 : 0) + (u.kind === 'hunter' && d < 30 ? 0.8 : 0)
    if (s2 > ts) { ts = s2; tgt = u }
  }
  if (tgt) goal = { x: tgt.x, z: tgt.z }
  if (b.kind === 'evader' && tgt) { const dx = r.x - tgt.x, dz = r.z - tgt.z, l = Math.hypot(dx, dz) || 1; goal = { x: r.x + dx / l * 40 + (66 - r.x) * 0.3, z: r.z + dz / l * 40 + (862 - r.z) * 0.3 } }
  const dir = flee || (goal ? (() => { const dx = goal.x - r.x, dz = goal.z - r.z, l = Math.hypot(dx, dz); return l > 1.5 ? { x: dx / l, z: dz / l } : null })() : null)
  if (dir) { inp.moveDir = dir; inp.throttle = 1 }
  if (b.kind === 'runner') return inp
  // 突撃: 上手い人は速い時・開いた所・向かってくる追跡機を待つ。ほかは使えたらすぐ
  if (b.kind !== 'evader' && !R.dash && R.dashReady && !(r.stun > 0)) {
    const lk = lockTarget(R, r, Math.atan2(r.vx, r.vz))
    if (lk) {
      const wait = b.kind === 'skilled' && sp < 18 && !(lk.open > 0) && !(lk.kind === 'hunter') && r.rope && r.rope.t < 1.0
      if (!wait && !(clumsy && b.rnd() < 0.02)) { inp.dash = lk.id; b.wT = 0; return inp }
    }
  }
  // ワイヤー（ビルだけ）: 振って速さを作り、狙いへ近づく
  let wire = false, at = null
  if (r.rope) {
    if (r.rope.t > 1.7 || (r.vy < -2 && r.rope.t > 0.7)) wire = true
  } else if (b.wT > (clumsy ? 0.8 : 0.45) && !(r.stun > 0) && !R.dash) {
    if (wantWire) { const a = findAnchor(world, r, wantWire.yaw); if (a) { wire = true; at = a } }
    else if (goal && (r.grounded || r.vy < -1 || sp < 12)) {
      const d = Math.hypot(goal.x - r.x, goal.z - r.z)
      const yaw = Math.atan2(goal.x - r.x, goal.z - r.z) + (d < 20 ? (b.rnd() - 0.5) * 1.6 : 0)
      const a = findAnchor(world, r, yaw); if (a) { wire = true; at = a }
    }
    if (wire && clumsy && b.rnd() < 0.33) { wire = false; b.wT = 0 }
  }
  if (wire) b.wT = 0
  inp.wire = wire && !b.prevW; b.prevW = wire
  if (inp.wire && at) inp.wireAt = at
  void blocked; void RUN
  // 詰まったら跳ぶ
  b.stuck = Math.hypot(r.x - b.lx, r.z - b.lz) < 0.05 && !r.climbing && inp.throttle ? b.stuck + dt : 0
  b.lx = r.x; b.lz = r.z
  if (b.stuck > 1 || r.climbing) { inp.jump = !b.prevJ; b.stuck = 0 }
  b.prevJ = !!inp.jump
  return inp
}
