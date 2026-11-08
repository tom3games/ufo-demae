// UFO の出前泥棒（空中出前 UFO襲来）の中身。three.js に依存しない。画面と bot（tools/sim.mjs）で同じものが動く
// 固定ステップで stepRaid を呼ぶ。runner（shared/runner.js）の状態を読み、体当たり・はね返り・吸い上げ・ふっ飛びだけ runner を書き換える
//
// 遊び: 宙吊軒の丼を UFO がさらって、ストローですすりながら街の上を飛ぶ。ワイヤーで飛んで体当たりして落とし、落ちてくる丼を空中で取る
//   体当たり: 当たった速さがそのまま強さ（10m/s から1、19m/s から2、30m/s から3）。UFO をタッチすると引っかけて引き寄せられる（26m/s まで）
//   敵の攻撃: 吸い上げ光線（地面の輪で予告）・なぎ払いレーザー（地面の線で予告）・追いかけドローン・追尾弾（光って照準が出てから撃つ）
//   負け: 岡持ちが5回へこむと吸い上げられて連れていかれる。丼は UFO が食べきると持っていかれる（すすり終わるまでが実質の時間）
//   4波＋どんぶり型の母船。母船を落とすと、さらわれた丼が空から降ってくる

import { floorAt } from './runner.js?v=1'

export const SHOP = { x: 30, y: 0, z: 842, r: 7 }   // 宙吊軒（sky-delivery の店と同じ場所）
export const ARENA = { x: 66, z: 862, r: 115 }      // UFO が飛ぶ範囲（店の広場と周りの通り）

export const U = {
  box: 6,                 // 岡持ちの耐久（へこむ回数）
  inv: 1.7,               // 当たった後の無敵（秒）
  ramMin: 10, ram2: 19, ram3: 30,   // 体当たりの強さの境目（UFO との相対の速さ m/s）
  bounceUp: 10, bounceOut: 7,       // 体当たり後に跳ね返る速さ
  catchR: 3.0,            // 落ちてくる丼を取れる距離（胸から）
  pickR: 2.6, groundSec: 7,         // 地面に落ちた丼は7秒以内なら拾える（半分）
  bowlFall: 3.4,          // 丼が落ちる速さ（泡に包まれてゆっくり）
  beamR: 4.6, beamWarn: 1.35, beamOn: 1.0, beamReach: 38,   // 吸い上げ光線
  suckSec: 1.25,          // 吸われてから吐き出されるまで
  laserWarn: 1.45, laserSweep: 0.9, laserLen: 46, laserHit: 1.4,
  droneR: 1.3, droneLife: 9, droneKillV: 6,
  mLock: 1.0, mLife: 7, mR: 1.35, mNear: 3.6,   // 追尾弾: 照準1秒→発射、7秒で消える、当たり1.35m、すれすれ3.6m
  comboGap: 0.35,         // 地面にこれだけ立つとつなぎが切れる
  between: 4.5,           // 波と波のあいだ
  bossSec: 110            // 母船が全部食べきるまで
}

// 波の中身。kind: saucer（すすりUFO 2発）/ big（大型 5発・レーザーと追尾弾）/ naruto（ナルトだけ盗る小さいの 1発・逃げる）
// atk: その波で使う攻撃。slurp: 1杯を食べきる秒数。maxM: 同時に飛ぶ追尾弾の上限
export const WAVES = [
  { ufos: ['saucer', 'saucer'], extra: ['saucer'], atk: ['beam'], first: 6, cd: [5.5, 8], slurp: 60, maxAtk: 1, maxM: 0, droneV: 0 },
  { ufos: ['saucer', 'saucer', 'saucer'], extra: ['saucer', 'saucer'], atk: ['beam', 'drone'], first: 4, cd: [5, 7.5], slurp: 54, maxAtk: 2, maxM: 0, droneV: 9.5, naruto: 0.45 },
  { ufos: ['saucer', 'saucer', 'big'], extra: ['saucer', 'saucer'], atk: ['beam', 'drone', 'laser', 'missile'], first: 4, cd: [4.6, 7], slurp: 50, maxAtk: 2, maxM: 2, droneV: 10, mV: 14.5, mTurn: 1.45 },
  { ufos: ['saucer', 'saucer', 'saucer', 'big'], extra: ['saucer', 'big'], atk: ['beam', 'drone', 'laser', 'missile'], first: 3, cd: [4.2, 6.5], slurp: 46, maxAtk: 3, maxM: 3, droneV: 10.5, mV: 15.5, mTurn: 1.55, naruto: 0.45 }
]
export const BOSS = { y: 46, rimR: 15, pods: 3, podHp: 4, coreHp: 9, coreY: 30, droneV: 11, mV: 16, mTurn: 1.6, maxM: 3, maxAtk: 3, cd: [3.6, 5.6], rain: 6 }
const KIND = {
  saucer: { hp: 3, r: 3.3, hh: 1.3, v: 7, alt: [20, 34] },
  big: { hp: 7, r: 5.2, hh: 1.9, v: 5, alt: [28, 40] },
  naruto: { hp: 1, r: 1.7, hh: 0.8, v: 13, alt: [14, 26] },
  pod: { hp: BOSS.podHp, r: 2.8, hh: 1.6, v: 0 },
  core: { hp: BOSS.coreHp, r: 4.4, hh: 2.2, v: 3 }
}
export const DISHES = [
  { id: 'shoyu', ja: '醤油ラーメン', en: 'Shoyu ramen' }, { id: 'miso', ja: '味噌ラーメン', en: 'Miso ramen' },
  { id: 'tantan', ja: '担々麺', en: 'Tantanmen' }, { id: 'chanpon', ja: 'ちゃんぽん', en: 'Champon' },
  { id: 'tonkotsu', ja: '豚骨ラーメン', en: 'Tonkotsu ramen' }, { id: 'shio', ja: '塩ラーメン', en: 'Shio ramen' },
  { id: 'wonton', ja: 'ワンタン麺', en: 'Wonton noodles' }, { id: 'tenshin', ja: '天津飯', en: 'Tenshin-han' },
  { id: 'chahan', ja: '炒飯', en: 'Fried rice' }, { id: 'reimen', ja: '冷やし中華', en: 'Cold ramen' }
]
export const NARUTO = { id: 'naruto', ja: 'ナルト1枚', en: 'One naruto slice' }

function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v

// 建物の中か（追尾弾が建物に当たる・UFO の高さ）
export function insideSolid(world, x, y, z) {
  for (const o of world.nearby(x, z)) {
    if (o.slab || o.y1 == null || o.kind === 'bound' || y < (o.y0 || 0) || y > o.y1) continue
    const c = Math.cos(o.yaw || 0), s = Math.sin(o.yaw || 0), dx = x - o.cx, dz = z - o.cz
    if (Math.abs(dx * c - dz * s) < o.hw && Math.abs(dx * s + dz * c) < o.hl) return true
  }
  return false
}
const topAt = (world, x, z) => floorAt(world, x, z, 400).h

export function createRaid(world, seed = 1, opt = {}) {
  const R = {
    world, seed, rnd: rng(seed), t: 0, wave: -1, phase: 'intro', phaseT: 2.5, box: U.box, inv: 0,
    ufos: [], beams: [], lasers: [], drones: [], missiles: [], bowls: [], events: [], nextId: 1,
    sucked: null, combo: 0, groundT: 0, boss: null, over: false, end: null, atkCd: {},
    stats: { downed: 0, rams: 0, hooks: 0, caught: 0, picked: 0, eaten: 0, dropped: 0, hurt: 0, hurtBy: {}, bestCombo: 0, near: 0, mBait: 0, mWall: 0, drones: 0, bestRam: 0, total: 0, naruto: 0, sucked: 0 },
    log: [], tut: !!opt.tut, noAttack: !!opt.noAttack
  }
  return R
}
const ev = (R, e) => R.events.push(e)

// 範囲の中で、低い所（広場・通り）の上にある点を選ぶ。高層ビルの上には行かない
function pickSpot(R, near, minD = 0, maxD = 70) {
  const w = R.world
  for (let i = 0; i < 40; i++) {
    const a = R.rnd() * Math.PI * 2, d = minD + R.rnd() * (maxD - minD)
    const x = near.x + Math.sin(a) * d, z = near.z + Math.cos(a) * d
    if (Math.hypot(x - ARENA.x, z - ARENA.z) > ARENA.r) continue
    let hi = 0
    for (const [ox, oz] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]]) hi = Math.max(hi, topAt(w, x + ox, z + oz))
    if (hi > 16) continue
    return { x, z }
  }
  return { x: ARENA.x + (R.rnd() - 0.5) * 40, z: ARENA.z + (R.rnd() - 0.5) * 40 }
}
function lineLow(R, ax, az, bx, bz) {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 8)
  for (let i = 1; i < n; i++) if (topAt(R.world, ax + (bx - ax) * i / n, az + (bz - az) * i / n) > 22) return false
  return true
}

function addUfo(R, kind, at, extra = {}) {
  const K = KIND[kind]
  const alt = K.alt ? K.alt[0] + R.rnd() * (K.alt[1] - K.alt[0]) : 0
  const u = {
    id: R.nextId++, kind, x: at.x, y: (at.y != null ? at.y : alt) + (at.drop || 0), z: at.z, vx: 0, vy: 0, vz: 0, hp: K.hp, maxHp: K.hp, r: K.r, hh: K.hh, alt,
    tx: at.x, tz: at.z, state: 'fly', t: 0, atk: null, hitCd: 0, hooked: 0, wob: 0, flash: 0, spin: R.rnd() * 6, charge: 0, fall: 0,
    bowl: kind === 'pod' || kind === 'core' ? null : { dish: kind === 'naruto' ? NARUTO : DISHES[Math.floor(R.rnd() * DISHES.length)], left: 100 },
    atkCd: (R.wave >= 0 && WAVES[R.wave] ? WAVES[R.wave].first : 3) + R.rnd() * 2.5, ...extra
  }
  R.ufos.push(u)
  return u
}

function startWave(R, i) {
  R.wave = i; R.phase = 'wave'; R.phaseT = 0; R.extraIn = false
  const W = WAVES[i], used = new Set()
  const kinds = [...W.ufos]
  if (W.naruto && R.rnd() < W.naruto) kinds.push('naruto')
  const used2 = []
  for (const k of kinds) {
    // 自分の近く（30〜90m）の、ばらけた所に出す。高い所から降りてくる
    let p = null
    for (let j = 0; j < 12; j++) { p = pickSpot(R, R.lastR || SHOP, 30, 95); if (used2.every(q => Math.hypot(q.x - p.x, q.z - p.z) > 26)) break }
    used2.push(p)
    addUfo(R, k, { ...p, drop: 40 })
  }
  ev(R, { t: 'wave', n: i + 1, count: kinds.length, naruto: kinds.includes('naruto') })
}

function startBoss(R) {
  R.wave = WAVES.length; R.phase = 'boss'; R.phaseT = 0
  const B = { x: ARENA.x, y: BOSS.y + 60, z: ARENA.z, ang: 0, t: 0, left: U.bossSec, pods: [], core: null, state: 'arrive', spin: 0, atkCd: 4, down: 0 }
  for (let i = 0; i < BOSS.pods; i++) {
    const u = addUfo(R, 'pod', { x: B.x, y: B.y, z: B.z }, { slot: i, atkCd: 5 + i * 1.7 })
    B.pods.push(u)
  }
  R.boss = B
  ev(R, { t: 'boss' })
}

// ---------------------------------------------------------------- 毎歩
export function stepRaid(R, r, dt) {
  if (R.over) return
  R.t += dt; R.lastR = { x: r.x, y: r.y, z: r.z }
  if (R.inv > 0) R.inv -= dt
  R.phaseT += dt
  // つなぎ（地面に立たずに当て続けた数）
  if (r.grounded) { R.groundT += dt; if (R.groundT > U.comboGap && R.combo) { if (R.combo >= 2) ev(R, { t: 'comboEnd', n: R.combo }); R.combo = 0 } } else R.groundT = 0

  if (R.phase === 'intro' && R.phaseT > 2.5) startWave(R, 0)
  else if (R.phase === 'between' && R.phaseT > U.between) { if (R.wave + 1 < WAVES.length) startWave(R, R.wave + 1); else startBoss(R) }
  else if (R.phase === 'wave') {
    // 残りが1機になったら増援（波ごとに1回）
    const W = WAVES[R.wave]
    if (W.extra && !R.extraIn && R.ufos.filter(u => u.state === 'fly').length <= 1) {
      R.extraIn = true
      for (const k of W.extra) { const p = pickSpot(R, R.lastR || SHOP, 35, 90); addUfo(R, k, { ...p, drop: 45 }) }
      ev(R, { t: 'extra', n: W.extra.length })
    }
    const alive = R.ufos.some(u => u.state !== 'gone'), falling = R.bowls.some(b => b.state === 'fall' || b.state === 'ground')
    if (!alive && !falling && R.phaseT > 2) {
      R.phase = 'between'; R.phaseT = 0
      const fix = R.box < U.box && R.wave >= 0
      if (fix) R.box++
      ev(R, { t: 'waveClear', n: R.wave + 1, fix, last: R.wave + 1 >= WAVES.length })
    }
  } else if (R.phase === 'rain' && R.phaseT > 3 && !R.bowls.some(b => b.state === 'fall' || b.state === 'ground')) finish(R, 'clear')

  // 吸われている間は自分の動きを上書きする
  if (R.sucked) stepSucked(R, r, dt)

  if (R.boss) stepBoss(R, r, dt)
  for (const u of R.ufos) stepUfo(R, u, r, dt)
  R.ufos = R.ufos.filter(u => !(u.state === 'gone' && u.t > 0.1))
  stepBeams(R, r, dt); stepLasers(R, r, dt); stepDrones(R, r, dt); stepMissiles(R, r, dt); stepBowls(R, r, dt)
}

// ロープの先を引っかけた UFO に合わせる（stepRunner の前に呼ぶ）。UFO がいなくなったら外す
export function syncRope(R, r) {
  if (!r.rope || r.rope.ufo == null) return
  const u = R.ufos.find(q => q.id === r.rope.ufo && q.state === 'fly')
  if (!u) { r.rope = null; r.events.push({ t: 'unwire', auto: true }); return }
  r.rope.x = u.x; r.rope.y = u.y; r.rope.z = u.z
}
// 画面と bot の狙い: 線が当たる UFO（球で見る。少し大きめに当てる）
export function rayUfo(R, ox, oy, oz, dx, dy, dz, maxT = 400) {
  let best = null
  for (const u of R.ufos) {
    if (u.state !== 'fly' || (R.boss && R.boss.state === 'arrive')) continue
    const rr = u.r + 1.6, px = u.x - ox, py = u.y - oy, pz = u.z - oz, t = px * dx + py * dy + pz * dz
    if (t < 0 || t > maxT) continue
    const ex = px - dx * t, ey = py - dy * t, ez = pz - dz * t
    if (ex * ex + ey * ey + ez * ez < rr * rr && (!best || t < best.t)) best = { u, t }
  }
  return best
}
// ワイヤーボタンの自動の狙い: 向き（dirYaw）の前 60 度以内で、見通せて届く UFO のいちばん良いもの
export function aimUfo(R, r, dirYaw, range = 74, blockedFn = null) {
  let best = null, bs = -1e9
  const hx = Math.sin(dirYaw), hz = Math.cos(dirYaw)
  for (const u of R.ufos) {
    if (u.state !== 'fly' || (R.boss && R.boss.state === 'arrive')) continue
    const dx = u.x - r.x, dy = u.y - (r.y + 1.2), dz = u.z - r.z, d = Math.hypot(dx, dy, dz), h = Math.hypot(dx, dz) || 1
    if (d > range) continue
    const cos = (dx * hx + dz * hz) / h
    if (cos < 0.5 && h > 8) continue
    if (blockedFn && [[0, 0, 0], [0, u.hh + 1.5, 0], [u.r, 0, 0], [-u.r, 0, 0], [0, 0, u.r], [0, 0, -u.r]].every(([ox, oy, oz]) => blockedFn(r.x, r.y + 1.5, r.z, u.x + ox, u.y + oy, u.z + oz))) continue   // どこか1点でも見えればよい
    const s = cos * 2 - d * 0.02 + (u.bowl ? (100 - u.bowl.left) * 0.01 : 0)
    if (s > bs) { bs = s; best = u }
  }
  return best
}

function stepUfo(R, u, r, dt) {
  u.t += dt; u.spin += dt * (u.kind === 'naruto' ? 9 : 2.2); u.flash = Math.max(0, u.flash - dt * 3); u.hitCd = Math.max(0, u.hitCd - dt)
  if (u.state === 'gone') return
  if (u.state === 'fall') {
    // 落ちていく: 回りながら煙を吐いて落ちる。地面か屋上に着いたら爆発
    u.vy -= 18 * dt; u.x += u.vx * dt; u.y += u.vy * dt; u.z += u.vz * dt; u.spin += dt * 14
    if (u.y <= topAt(R.world, u.x, u.z) + 0.6 || insideSolid(R.world, u.x, u.y, u.z) || u.t > 6) { u.state = 'gone'; u.t = 0; ev(R, { t: 'crash', id: u.id, x: u.x, y: Math.max(u.y, topAt(R.world, u.x, u.z)), z: u.z, kind: u.kind }) }
    return
  }
  if (u.state === 'leave') {
    // 食べ終わって帰る: まっすぐ上へ
    u.vy = Math.min(26, u.vy + 18 * dt); u.y += u.vy * dt; u.spin += dt * 6
    if (u.t > 3.5) { u.state = 'gone'; u.t = 0 }
    return
  }
  const K = KIND[u.kind]
  // すする（丼の残りが減る）。食べきったら帰る
  if (u.bowl && R.phase === 'wave') {
    const W = WAVES[R.wave]
    u.bowl.left -= 100 / (u.kind === 'naruto' ? W.slurp * 0.7 : W.slurp) * dt * (R.tut && R.wave === 0 ? 0.75 : 1)
    if (u.bowl.left <= 0) {
      u.bowl.left = 0; u.state = 'leave'; u.t = 0; u.vy = 2; R.stats.eaten++
      R.log.push({ dish: u.bowl.dish, how: 'eaten', left: 0 })
      if (r.rope && r.rope.ufo === u.id) { r.rope = null; r.events.push({ t: 'unwire', auto: true }) }
      ev(R, { t: 'eaten', id: u.id, x: u.x, y: u.y, z: u.z, dish: u.bowl.dish, naruto: u.kind === 'naruto' })
      return
    }
  }
  // 動き。pod は母船に付いている（stepBoss が置く）
  if (u.kind !== 'pod' && !u.frozen) {
    if (u.kind === 'core') { /* stepBoss */ }
    else {
      const dT = Math.hypot(u.tx - u.x, u.tz - u.z)
      const pl = { x: r.x, z: r.z }
      if (u.kind === 'naruto' && Math.hypot(r.x - u.x, r.z - u.z) < 30 && R.rnd() < dt * 1.5) {
        const p = pickSpot(R, u, 25, 45); u.tx = p.x; u.tz = p.z   // ナルトの UFO は近づくと逃げる
      } else if (dT < 4 || u.t > (u.retarget || 0)) {
        let p = pickSpot(R, pl, u.kind === 'big' ? 28 : 16, u.kind === 'big' ? 60 : 48)
        if (!lineLow(R, u.x, u.z, p.x, p.z)) p = pickSpot(R, u, 8, 30)
        u.tx = p.x; u.tz = p.z; u.retarget = u.t + 5 + R.rnd() * 4
      }
      const busy = u.atk && (u.atk === 'beam' || u.atk === 'laser')
      const want = busy ? 0.15 : 1, hooked = r.rope && r.rope.ufo === u.id
      const sp = K.v * want * (hooked ? 0.35 : 1)
      const ddx = u.tx - u.x, ddz = u.tz - u.z, l = Math.hypot(ddx, ddz) || 1
      u.vx += ((ddx / l) * sp - u.vx) * Math.min(1, dt * 1.6); u.vz += ((ddz / l) * sp - u.vz) * Math.min(1, dt * 1.6)
      // 高さ: 決めた高さ。下の建物より 10m 上。降りてくる時は速く。引っかけられている間は少し下がる
      const floor = topAt(R.world, u.x, u.z)
      const ty = Math.max(u.alt, floor + 11) - (hooked ? 6 : 0) + Math.sin(u.t * 1.3 + u.id) * 0.8
      u.vy += ((ty - u.y) * (u.y > ty + 8 ? 1.4 : 0.9) - u.vy) * Math.min(1, dt * 2)
      u.x += u.vx * dt; u.y += u.vy * dt; u.z += u.vz * dt
    }
  }
  if (r.rope && r.rope.ufo === u.id) { u.hooked += dt; u.wob = Math.min(1, u.wob + dt * 3) } else { u.hooked = 0; u.wob = Math.max(0, u.wob - dt * 2) }
  // 体当たり
  ramCheck(R, u, r)
  // 攻撃
  if (!R.noAttack && R.phase !== 'rain') ufoAttack(R, u, r, dt)
}

function ramCheck(R, u, r) {
  if (u.hitCd > 0 || u.state !== 'fly' || R.sucked) return
  const cx = r.x, cy = r.y + 1.0, cz = r.z
  const dx = cx - u.x, dy = cy - u.y, dz = cz - u.z, dh = Math.hypot(dx, dz)
  const k = (dh / (u.r + 0.8)) ** 2 + (dy / (u.hh + 1.0)) ** 2
  if (k >= 1) return
  const rvx = r.vx - u.vx, rvy = r.vy - u.vy, rvz = r.vz - u.vz, v = Math.hypot(rvx, rvy, rvz)
  const hooked = r.rope && r.rope.ufo === u.id
  let dmg = v >= U.ram3 ? 3 : v >= U.ram2 ? 2 : v >= U.ramMin ? 1 : 0
  if (hooked) dmg = Math.max(1, dmg)
  // はね返る（上へ。地面に戻さず次の UFO へつなげる）
  const l = Math.hypot(dx, dy, dz) || 1
  r.vx = dx / l * U.bounceOut + u.vx * 0.5; r.vz = dz / l * U.bounceOut + u.vz * 0.5; r.vy = Math.max(U.bounceUp * (dmg ? 1 : 0.6), dy / l * U.bounceOut)
  r.grounded = false; r.climbing = null
  if (r.rope) { r.rope = null; r.events.push({ t: 'unwire', auto: true }) }
  u.hitCd = 0.45
  if (!dmg) { ev(R, { t: 'boing', id: u.id, x: u.x, y: u.y, z: u.z, v }); return }
  u.hp -= dmg; u.flash = 1; u.wob = 1
  R.stats.rams++; if (hooked) R.stats.hooks++
  R.stats.bestRam = Math.max(R.stats.bestRam, v)
  R.combo++; R.stats.bestCombo = Math.max(R.stats.bestCombo, R.combo); R.groundT = 0
  const kill = u.hp <= 0
  ev(R, { t: 'ram', id: u.id, kind: u.kind, x: u.x, y: u.y, z: u.z, cx: (cx + u.x + dx / l * u.r) / 2, cy: (cy + u.y + dy / l * u.hh) / 2, cz: (cz + u.z + dz / l * u.r) / 2, v, dmg, kill, hooked, combo: R.combo })
  if (kill) downUfo(R, u, r.vx * 0.3, r.vz * 0.3)
}

function downUfo(R, u, pvx = 0, pvz = 0, by = 'ram') {
  u.state = 'fall'; u.t = 0; u.vx = u.vx * 0.3 + pvx; u.vz = u.vz * 0.3 + pvz; u.vy = 4; u.hp = 0
  if (u.kind !== 'pod' && u.kind !== 'core') R.stats.downed++
  if (u.kind === 'naruto') R.stats.naruto++
  ev(R, { t: 'down', id: u.id, kind: u.kind, x: u.x, y: u.y, z: u.z, by })
  // 丼を落とす（泡に包まれてゆっくり）
  if (u.bowl) dropBowl(R, u.x, u.y - u.hh - 1.2, u.z, u.bowl.dish, u.bowl.left, u.kind === 'naruto')
  u.bowl = null
}
function dropBowl(R, x, y, z, dish, left, naruto = false) {
  R.bowls.push({ id: R.nextId++, x, y, z, vx: (R.rnd() - 0.5) * 1.2, vz: (R.rnd() - 0.5) * 1.2, dish, left: Math.max(1, Math.round(left)), state: 'fall', t: 0, naruto })
}

function stepBowls(R, r, dt) {
  const cx = r.x, cy = r.y + 1.1, cz = r.z
  for (const b of R.bowls) {
    if (b.state === 'fall') {
      b.t += dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y -= U.bowlFall * dt
      const d = Math.hypot(b.x - cx, b.y - cy, b.z - cz)
      if (d < U.catchR && !R.sucked) {
        b.state = 'caught'; R.stats.caught++; R.combo++; R.stats.bestCombo = Math.max(R.stats.bestCombo, R.combo)
        const pts = Math.round(b.left * (1 + Math.min(1, (R.combo - 1) * 0.1)))
        R.stats.total += pts
        R.log.push({ dish: b.dish, how: 'caught', left: b.left, air: !r.grounded, pts })
        ev(R, { t: 'catch', id: b.id, x: b.x, y: b.y, z: b.z, dish: b.dish, left: b.left, air: !r.grounded, pts, combo: R.combo, naruto: b.naruto })
        continue
      }
      const fl = floorAt(R.world, b.x, b.z, b.y + 0.5).h
      if (b.y <= fl + 0.3) { b.y = fl + 0.3; b.state = 'ground'; b.t = 0; ev(R, { t: 'bowlLand', id: b.id, x: b.x, y: b.y, z: b.z }) }
    } else if (b.state === 'ground') {
      b.t += dt
      if (Math.hypot(b.x - r.x, b.z - r.z) < U.pickR && Math.abs(b.y - r.y) < 2.5) {
        b.state = 'caught'; R.stats.picked++
        const pts = Math.round(b.left * 0.5)
        R.stats.total += pts
        R.log.push({ dish: b.dish, how: 'picked', left: b.left, pts })
        ev(R, { t: 'pick', id: b.id, x: b.x, y: b.y, z: b.z, dish: b.dish, left: b.left, pts })
      } else if (b.t > U.groundSec) {
        b.state = 'lost'; R.stats.dropped++
        R.log.push({ dish: b.dish, how: 'cat', left: b.left })
        ev(R, { t: 'cat', id: b.id, x: b.x, y: b.y, z: b.z, dish: b.dish })
      }
    }
  }
  R.bowls = R.bowls.filter(b => b.state === 'fall' || b.state === 'ground')
}

// ---------------------------------------------------------------- 攻撃
function cfg(R) { return R.boss ? BOSS : WAVES[Math.max(0, R.wave)] }
function busyCount(R) { return R.beams.length + R.lasers.length + R.ufos.filter(u => u.atk === 'missile' && u.charge > 0).length }
function ufoAttack(R, u, r, dt) {
  if (u.state !== 'fly' || u.kind === 'naruto' || (R.boss && R.boss.state === 'arrive')) return
  if (R.phase !== 'wave' && R.phase !== 'boss') return
  // 追尾弾の溜め: 光って、照準が出てから撃つ
  if (u.atk === 'missile') {
    u.charge -= dt
    if (u.charge <= 0) { u.atk = null; fireMissile(R, u, r) }
    return
  }
  if (u.atk) return
  u.atkCd -= dt
  if (u.atkCd > 0) return
  const C = cfg(R), list = u.kind === 'pod' ? ['missile', 'laser'] : u.kind === 'core' ? ['beam3', 'missile'] : u.kind === 'big' ? ['laser', 'missile', 'missile', 'drone'] : C.atk.filter(a => a === 'beam' || a === 'drone' || (a === 'missile' && u.id % 2 === 0))
  const opts = list.filter(a => (R.boss || C.atk.includes(a.replace('3', ''))) || u.kind === 'pod' || u.kind === 'core')
  u.atkCd = C.cd[0] + R.rnd() * (C.cd[1] - C.cd[0])
  if (!opts.length || r.wreck > 0 || R.sucked || R.box <= 0) return
  if (busyCount(R) >= C.maxAtk) { u.atkCd = 0.8 + R.rnd(); return }
  const a = opts[Math.floor(R.rnd() * opts.length)]
  const dh = Math.hypot(r.x - u.x, r.z - u.z)
  if (a === 'beam' || a === 'beam3') {
    if (dh > U.beamReach + (a === 'beam3' ? 20 : 0)) { u.atkCd = 0.6; return }
    // 予告: 0.5秒先の自分の位置の地面に輪
    const n = a === 'beam3' ? 3 : 1
    for (let i = 0; i < n; i++) {
      const lead = 0.5, px = r.x + r.vx * lead * (i === 0 ? 1 : 0), pz = r.z + r.vz * lead * (i === 0 ? 1 : 0)
      const ang = i * Math.PI * 2 / 3 + R.rnd(), off = i === 0 ? 0 : 9
      const x = px + Math.sin(ang) * off, z = pz + Math.cos(ang) * off
      R.beams.push({ id: R.nextId++, ufo: u.id, x, z, gy: floorAt(R.world, x, z, Math.max(r.y, 0) + 1).h, r: U.beamR, t: 0, phase: 'warn' })
    }
    u.atk = 'beam'
    ev(R, { t: 'beamWarn', id: u.id, x: u.x, y: u.y, z: u.z, n })
  } else if (a === 'laser') {
    if (dh > 70) { u.atkCd = 0.6; return }
    // 地面の線: 自分の近くを横切る線（自分を中心に、UFO から見て横向き）
    const ux = (r.x - u.x) / (dh || 1), uz = (r.z - u.z) / (dh || 1), off = (R.rnd() - 0.5) * 3
    const cx = r.x + r.vx * 0.4 + ux * off, cz = r.z + r.vz * 0.4 + uz * off, L = U.laserLen / 2, s = R.rnd() < 0.5 ? 1 : -1
    R.lasers.push({ id: R.nextId++, ufo: u.id, ax: cx - uz * L * s, az: cz + ux * L * s, bx: cx + uz * L * s, bz: cz - ux * L * s, gy: Math.max(0, floorAt(R.world, cx, cz, r.y + 1).h), t: 0, phase: 'warn', hit: false })
    u.atk = 'laser'
    ev(R, { t: 'laserWarn', id: u.id, x: u.x, y: u.y, z: u.z })
  } else if (a === 'drone') {
    const n = u.kind === 'big' ? 2 : 1
    for (let i = 0; i < n; i++) R.drones.push({ id: R.nextId++, x: u.x + (i - 0.5) * 2, y: u.y - u.hh - 0.8, z: u.z, vx: 0, vy: -3, vz: 0, t: 0, v: C.droneV || 11 })
    ev(R, { t: 'droneOut', id: u.id, x: u.x, y: u.y, z: u.z, n })
  } else if (a === 'missile') {
    const alive = R.missiles.length + R.ufos.filter(q => q.atk === 'missile').length
    if (alive >= (C.maxM || 0) || dh > 80) { u.atkCd = 1.2; return }
    u.atk = 'missile'; u.charge = U.mLock
    ev(R, { t: 'lock', id: u.id, x: u.x, y: u.y, z: u.z })
  }
}

function hurt(R, r, src, x, z, knock = true) {
  if (R.inv > 0 || R.sucked || R.over || r.wreck > 0) return false
  R.box--; R.inv = U.inv; R.stats.hurt++; R.stats.hurtBy[src] = (R.stats.hurtBy[src] || 0) + 1; R.combo = 0
  if (knock) {
    let dx = r.x - x, dz = r.z - z, l = Math.hypot(dx, dz); if (l < 0.3) { dx = -Math.sin(r.yaw); dz = -Math.cos(r.yaw); l = 1 }
    r.rope = null; r.climbing = null; r.grounded = false
    r.vx = dx / l * 10 + r.vx * 0.2; r.vz = dz / l * 10 + r.vz * 0.2; r.vy = Math.max(r.vy, 6); r.y += 0.15; r.stun = Math.max(r.stun || 0, 0.35)
  }
  ev(R, { t: 'hurt', src, x: r.x, y: r.y, z: r.z, box: R.box })
  if (R.box <= 0) abduct(R, r)
  return true
}
function abduct(R, r) {
  // 岡持ちがつぶれた: いちばん近い UFO（いなければ空）に吸い上げられて連れていかれる
  const u = R.ufos.filter(q => q.state === 'fly').sort((a, b) => Math.hypot(a.x - r.x, a.z - r.z) - Math.hypot(b.x - r.x, b.z - r.z))[0]
  R.sucked = { t: 0, ufo: u ? u.id : null, x: u ? u.x : r.x, y: u ? u.y : r.y + 40, z: u ? u.z : r.z, final: true, y0: r.y }
  r.rope = null; r.climbing = null
  ev(R, { t: 'abduct', x: r.x, y: r.y, z: r.z })
}
function stepSucked(R, r, dt) {
  const S = R.sucked
  S.t += dt
  const u = S.ufo != null && R.ufos.find(q => q.id === S.ufo)
  if (u) { S.x = u.x; S.y = u.y; S.z = u.z }
  // 吸い上げる: UFO の真下へ寄りながら上がる
  const k = Math.min(1, dt * 2.2)
  r.x += (S.x - r.x) * k; r.z += (S.z - r.z) * k
  r.y = Math.min(S.y - 2.5, r.y + (S.final ? 5 : 9) * dt)
  r.vx = r.vy = r.vz = 0; r.grounded = false; r.rope = null; r.climbing = null
  r.yaw += dt * 9
  if (S.final) { if (S.t > 3.2) finish(R, 'abducted'); return }
  if (S.t > U.suckSec) {
    // ぺっと吐き出される（まずかったらしい）
    const a = R.rnd() * Math.PI * 2
    r.vx = Math.sin(a) * 9; r.vz = Math.cos(a) * 9; r.vy = 3; r.stun = 0.3
    R.sucked = null; R.inv = U.inv
    ev(R, { t: 'spit', x: r.x, y: r.y, z: r.z })
  }
}

function stepBeams(R, r, dt) {
  for (const b of R.beams) {
    b.t += dt
    const u = R.ufos.find(q => q.id === b.ufo)
    if (!u || u.state !== 'fly') { b.done = true; continue }
    b.ux = u.x; b.uy = u.y - u.hh; b.uz = u.z
    if (b.phase === 'warn' && b.t > U.beamWarn) { b.phase = 'on'; b.t = 0; ev(R, { t: 'beamOn', id: b.id, x: b.x, z: b.z }) }
    else if (b.phase === 'on') {
      if (b.t > U.beamOn) { b.done = true; continue }
      // 円すいの中か: UFO の底 → 地面の輪 の軸からの距離が、その高さでの半径より小さい
      const ax = b.x - b.ux, ay = b.gy - b.uy, az = b.z - b.uz, L2 = ax * ax + ay * ay + az * az
      const px = r.x - b.ux, py = r.y + 0.9 - b.uy, pz = r.z - b.uz
      const s = clamp((px * ax + py * ay + pz * az) / L2, 0, 1)
      const ex = px - ax * s, ey = py - ay * s, ez = pz - az * s, rad = 1.2 + (b.r - 1.2) * s
      if (s > 0.02 && ex * ex + ey * ey + ez * ez < rad * rad && !R.sucked && R.inv <= 0 && !(r.wreck > 0)) {
        R.stats.sucked++
        if (hurt(R, r, 'beam', b.x, b.z, false) && !R.sucked) { R.sucked = { t: 0, ufo: u.id, x: u.x, y: u.y, z: u.z }; r.rope = null; ev(R, { t: 'sucked', x: r.x, y: r.y, z: r.z }) }
      }
    }
  }
  for (const b of R.beams) if (b.done) { const u = R.ufos.find(q => q.id === b.ufo); if (u && u.atk === 'beam' && !R.beams.some(q => q !== b && !q.done && q.ufo === u.id)) u.atk = null }
  R.beams = R.beams.filter(b => !b.done)
}

function stepLasers(R, r, dt) {
  for (const L of R.lasers) {
    L.t += dt
    const u = R.ufos.find(q => q.id === L.ufo)
    if (!u || u.state !== 'fly') { L.done = true; continue }
    L.ux = u.x; L.uy = u.y - u.hh; L.uz = u.z
    if (L.phase === 'warn' && L.t > U.laserWarn) { L.phase = 'on'; L.t = 0; ev(R, { t: 'laserOn', id: L.id }) }
    else if (L.phase === 'on') {
      const s = Math.min(1, L.t / U.laserSweep)
      L.px = L.ax + (L.bx - L.ax) * s; L.pz = L.az + (L.bz - L.az) * s
      // 線分（UFO → 地面の点）からの距離
      if (!L.hit) {
        const ax = L.px - L.ux, ay = L.gy - L.uy, az = L.pz - L.uz, L2 = ax * ax + ay * ay + az * az
        const px = r.x - L.ux, py = r.y + 0.9 - L.uy, pz = r.z - L.uz, q = clamp((px * ax + py * ay + pz * az) / L2, 0, 1.05)
        const ex = px - ax * q, ey = py - ay * q, ez = pz - az * q
        if (ex * ex + ey * ey + ez * ez < U.laserHit * U.laserHit) { if (hurt(R, r, 'laser', L.px, L.pz)) L.hit = true }
        // すれすれ（線が近くを通り抜けた）
        else if (!L.near && ex * ex + ey * ey + ez * ez < 3.4 * 3.4 && s > 0.2) { L.near = true; nearMiss(R, r, L.px, L.pz, 'laser') }
      }
      if (L.t > U.laserSweep + 0.2) L.done = true
    }
  }
  for (const L of R.lasers) if (L.done) { const u = R.ufos.find(q => q.id === L.ufo); if (u && u.atk === 'laser') u.atk = null }
  R.lasers = R.lasers.filter(L => !L.done)
}

function stepDrones(R, r, dt) {
  const cx = r.x, cy = r.y + 1.0, cz = r.z
  for (const d of R.drones) {
    d.t += dt
    const dx = cx - d.x, dy = cy - d.y, dz = cz - d.z, l = Math.hypot(dx, dy, dz) || 1
    const v = d.t < 0.6 ? 4 : d.v
    d.vx += (dx / l * v - d.vx) * Math.min(1, dt * 2.4); d.vy += (dy / l * v - d.vy) * Math.min(1, dt * 2.4); d.vz += (dz / l * v - d.vz) * Math.min(1, dt * 2.4)
    d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt
    const fl = topAt(R.world, d.x, d.z); if (d.y < fl + 1.2) { d.y = fl + 1.2; d.vy = Math.max(0, d.vy) }
    if (l < U.droneR + 0.5 && !R.sucked) {
      const pv = Math.hypot(r.vx, r.vy, r.vz)
      d.done = true
      if (pv >= U.droneKillV && !r.grounded) { R.stats.drones++; R.combo++; R.stats.bestCombo = Math.max(R.stats.bestCombo, R.combo); ev(R, { t: 'droneKill', x: d.x, y: d.y, z: d.z, combo: R.combo }) }
      else { ev(R, { t: 'droneBoom', x: d.x, y: d.y, z: d.z, pv, g: r.grounded, rope: !!r.rope, st: r.stun > 0, cl: !!r.climbing }); hurt(R, r, 'drone', d.x, d.z) }
      continue
    }
    if (d.t > U.droneLife) { d.done = true; ev(R, { t: 'droneFizz', x: d.x, y: d.y, z: d.z }) }
  }
  R.drones = R.drones.filter(d => !d.done)
}

// 追尾弾: 曲がる速さに上限がある。速く飛んで急に向きを変えるとふり切れる。建物や別の UFO に当てられる
function fireMissile(R, u, r) {
  const C = cfg(R)
  const dx = r.x - u.x, dy = r.y + 1 - u.y, dz = r.z - u.z, l = Math.hypot(dx, dy, dz) || 1, v = C.mV || 15
  R.missiles.push({ id: R.nextId++, from: u.id, x: u.x, y: u.y - u.hh, z: u.z, vx: dx / l * v * 0.6, vy: dy / l * v * 0.6 - 2, vz: dz / l * v * 0.6, v, turn: C.mTurn || 1.5, t: 0, minD: 1e9, near: false })
  ev(R, { t: 'fire', id: u.id, x: u.x, y: u.y, z: u.z })
}
function stepMissiles(R, r, dt) {
  const cx = r.x, cy = r.y + 1.0, cz = r.z
  for (const m of R.missiles) {
    m.t += dt
    // 向きを自分へ寄せる（1歩で曲がれる角度は turn×dt まで）
    const sp = Math.hypot(m.vx, m.vy, m.vz) || 1, v = Math.min(m.v, sp + 12 * dt)
    let fx = m.vx / sp, fy = m.vy / sp, fz = m.vz / sp
    if (!R.sucked) {
      const dx = cx - m.x, dy = cy - m.y, dz = cz - m.z, l = Math.hypot(dx, dy, dz) || 1
      const tx = dx / l, ty = dy / l, tz = dz / l
      const dot = clamp(fx * tx + fy * ty + fz * tz, -1, 1), ang = Math.acos(dot), mx = m.turn * dt
      if (ang > 1e-4) {
        const k = Math.min(1, mx / ang)
        fx += (tx - fx) * k; fy += (ty - fy) * k; fz += (tz - fz) * k
        const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl
      }
    }
    m.vx = fx * v; m.vy = fy * v; m.vz = fz * v
    m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt
    const d = Math.hypot(cx - m.x, cy - m.y, cz - m.z)
    if (d < U.mR && !R.sucked) { m.done = true; ev(R, { t: 'mBoom', x: m.x, y: m.y, z: m.z, hit: true }); hurt(R, r, 'missile', m.x, m.z); continue }
    // すれすれ: 近くまで来て、離れ始めた
    if (d < m.minD) m.minD = d
    else if (!m.near && m.minD < U.mNear && d > m.minD + 0.8) { m.near = true; R.stats.near++; nearMiss(R, r, m.x, m.z, 'missile') }
    // 別の UFO に当たった（誘導した）
    let hitU = null
    for (const u of R.ufos) { if (u.state !== 'fly' || (u.id === m.from && m.t < 1.2)) continue; if (Math.hypot(u.x - m.x, (u.y - m.y) * 1.6, u.z - m.z) < u.r + 0.6) { hitU = u; break } }
    if (hitU) {
      m.done = true; R.stats.mBait++
      hitU.hp -= 1; hitU.flash = 1; hitU.wob = 1
      ev(R, { t: 'mBait', id: hitU.id, x: m.x, y: m.y, z: m.z, kill: hitU.hp <= 0, self: hitU.id === m.from })
      if (hitU.hp <= 0) downUfo(R, hitU, m.vx * 0.2, m.vz * 0.2, 'missile')
      continue
    }
    // 建物・地面に当たった
    if (insideSolid(R.world, m.x, m.y, m.z) || m.y <= floorAt(R.world, m.x, m.z, m.y + 0.5).h + 0.2) { m.done = true; if (m.t > 0.3) R.stats.mWall++; ev(R, { t: 'mBoom', x: m.x, y: m.y, z: m.z, wall: true }); continue }
    if (m.t > U.mLife) { m.done = true; ev(R, { t: 'mBoom', x: m.x, y: m.y, z: m.z, fizz: true }) }
  }
  R.missiles = R.missiles.filter(m => !m.done)
}

function nearMiss(R, r, x, z, src) {
  // ギリギリ: 進む向きへ少し勢い（長いスローは入れない。画面は光と音だけ）
  const h = Math.hypot(r.vx, r.vz)
  if (h > 2 && h < 34) { r.vx += r.vx / h * 2.5; r.vz += r.vz / h * 2.5 }
  if (src !== 'missile') R.stats.near++
  ev(R, { t: 'near', x, z, src })
}

// ---------------------------------------------------------------- 母船（どんぶり号）
function stepBoss(R, r, dt) {
  const B = R.boss
  B.t += dt; B.spin += dt * 0.35
  if (B.state === 'arrive') {
    B.y += (BOSS.y - B.y) * Math.min(1, dt * 0.9)
    if (B.t > 4.5) { B.state = 'fight'; ev(R, { t: 'bossFight' }) }
  } else if (B.state === 'fight' || B.state === 'core') {
    B.left -= dt
    B.ang += dt * 0.07
    B.x = ARENA.x + Math.sin(B.ang) * 22; B.z = ARENA.z + Math.cos(B.ang) * 22
    B.y = BOSS.y + Math.sin(B.t * 0.6) * 1.2
    // 母船そのもの: 吸い上げ光線とドローン
    B.atkCd -= dt
    if (B.atkCd <= 0 && !R.sucked && R.box > 0) {
      B.atkCd = 5 + R.rnd() * 2.5
      if (R.rnd() < 0.55 && busyCount(R) < BOSS.maxAtk) {
        const lead = 0.5, x = r.x + r.vx * lead, z = r.z + r.vz * lead
        const host = B.pods.find(p => p.state === 'fly') || B.core
        if (host && Math.hypot(r.x - B.x, r.z - B.z) < 60) { R.beams.push({ id: R.nextId++, ufo: host.id, x, z, gy: floorAt(R.world, x, z, Math.max(0, r.y) + 1).h, r: U.beamR + 0.8, t: 0, phase: 'warn' }); host.atk = 'beam'; ev(R, { t: 'beamWarn', id: host.id, x: host.x, y: host.y, z: host.z, n: 1 }) }
      } else if (R.drones.length < 4) {
        for (let i = 0; i < 2; i++) R.drones.push({ id: R.nextId++, x: B.x + (i - 0.5) * 6, y: B.y - 4, z: B.z, vx: 0, vy: -3, vz: 0, t: 0, v: BOSS.droneV })
        ev(R, { t: 'droneOut', x: B.x, y: B.y, z: B.z, n: 2 })
      }
    }
    if (B.left <= 0) { finish(R, 'escaped'); return }
  }
  // 砲台（pod）は縁に付いて回る
  B.pods.forEach((p, i) => {
    if (p.state !== 'fly') return
    const a = B.spin + i * Math.PI * 2 / BOSS.pods
    const nx = B.x + Math.sin(a) * BOSS.rimR, nz = B.z + Math.cos(a) * BOSS.rimR, ny = B.y - 3.2
    p.vx = (nx - p.x) / Math.max(dt, 1e-3); p.vy = (ny - p.y) / Math.max(dt, 1e-3); p.vz = (nz - p.z) / Math.max(dt, 1e-3)
    if (B.t < 0.05) { p.vx = p.vy = p.vz = 0 }
    p.x = nx; p.y = ny; p.z = nz
  })
  if (B.state === 'fight' && B.pods.every(p => p.state !== 'fly')) {
    B.state = 'core'
    B.core = addUfo(R, 'core', { x: B.x, y: B.y - 4, z: B.z }, { atkCd: 3 })
    ev(R, { t: 'coreOpen', x: B.x, y: B.y, z: B.z })
  }
  if (B.core && B.core.state === 'fly') {
    const c = B.core, ty = BOSS.coreY + Math.sin(B.t) * 1.5
    const nx = B.x, nz = B.z
    c.vx = (nx - c.x) * 1.5; c.vz = (nz - c.z) * 1.5; c.vy = (ty - c.y) * 1.2
    c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt
  }
  if (B.state === 'core' && B.core && B.core.state !== 'fly') {
    B.state = 'down'; B.down = 0; R.phase = 'rain'; R.phaseT = 0
    for (const m of R.missiles) m.done = true
    R.beams.length = 0; R.lasers.length = 0; R.drones.length = 0
    ev(R, { t: 'bossDown', x: B.x, y: B.y, z: B.z })
    // さらわれた丼が空から降ってくる。自分のまわりの取りに行ける所へ
    for (let i = 0; i < BOSS.rain; i++) {
      const a = i * Math.PI * 2 / BOSS.rain + R.rnd() * 0.6, d = 8 + R.rnd() * 22
      dropBowl(R, r.x + Math.sin(a) * d, 26 + i * 4 + R.rnd() * 6, r.z + Math.cos(a) * d, DISHES[Math.floor(R.rnd() * DISHES.length)], 70 + Math.round(R.rnd() * 30))
    }
  }
  if (B.state === 'down') { B.down += dt; B.y += dt * 4 * B.down; B.spin += dt * 2 }
}

function finish(R, how) {
  if (R.over) return
  R.over = true; R.end = how
  ev(R, { t: 'end', how })
}

// 結果の数字: 取り返したスープの量と、店主の判定
export function summary(R) {
  const S = R.stats, bowls = R.log
  const back = bowls.filter(b => b.how === 'caught' || b.how === 'picked').length
  const all = bowls.length + R.ufos.filter(u => u.bowl).length + R.bowls.length
  const score = S.total + S.downed * 40 + S.drones * 15 + S.mBait * 30 + S.near * 10 + (R.end === 'clear' ? 400 : 0) + S.bestCombo * 20
  return { score, back, all, ...S, end: R.end, wave: Math.min(R.wave + 1, WAVES.length + 1), box: R.box, t: R.t }
}
export const RANKS = [3200, 1800, 900, 300]   // 守り神・看板・見習い・皿洗い（それ未満は出禁）。tools/sim.mjs で決めた
