// 廃都迎撃（UFO 迎撃戦）の中身。three.js に依存しない。画面と bot（tools/sim.mjs）で同じものが動く
// 固定ステップで stepRaid を呼ぶ。runner（shared/runner.js）の状態を読み、体当たり・はね返り・ふっ飛び・連れ去りだけ runner を書き換える
//
// 遊び: 侵攻で焼けた街に UFO が来る。ワイヤーで飛んで体当たりして落とす。4波＋母艦
//   v3（2026-11-09 本人「体当たりだと難しい。爽快感がなくなる」）: 攻撃はロックオン突撃。40m 以内の UFO へ一直線に飛び込み必ず当たる。
//   威力は発動した時の速さ（ビルで振って速いほど一撃）。速さ 8m/s 以上で、ビルのワイヤーで振った後だけ使える。シールドはひびでダメージ半分、撃った直後の開いた所は2倍
//   連鎖: 地面に立たずに当てる・ギリギリでよける・ドローンを壊す・追尾弾を当て返すと連鎖が伸び、点の倍率が上がる（被弾・着地・6秒何もしないで切れる）
//   敵の攻撃: 焼却光線（地面の輪で予告）・なぎ払いレーザー（地面の線で予告）・追いかけドローン・追尾弾（光って照準が出てから撃つ）
//   負け: 装備の電池（HP）が0になると、いちばん近い UFO に回収される。母艦の主砲が溜まりきると街ごと焼かれる

import { floorAt, blocked } from './runner.js?v=1'

export const BASE = { x: 30, y: 0, z: 842, r: 7 }   // 開始の空き地（街の真ん中の広場の西）
export const SHOP = BASE                             // town.js・street.js の中心（名前だけ残す）
export const ARENA = { x: 66, z: 862, r: 115 }       // UFO が飛ぶ範囲（広場と周りの通り）

export const U = {
  hp: 8,                  // 装備の電池（被弾できる回数）
  inv: 1.5,               // 当たった後の無敵（秒）
  ramMin: 10, ram2: 19, ram3: 30,   // 体当たりの強さの境目（UFO との相対の速さ m/s）
  bounceUp: 10, bounceOut: 7,       // 体当たり後に跳ね返る速さ
  beamR: 4.6, beamWarn: 1.3, beamOn: 0.9, beamReach: 40,   // 焼却光線
  laserWarn: 1.45, laserSweep: 0.9, laserLen: 46, laserHit: 1.4,
  droneR: 1.3, droneLife: 9, droneKillV: 6,
  mLock: 1.0, mLife: 7, mR: 1.35, mNear: 3.6,   // 追尾弾: 照準1秒→発射、7秒で消える、当たり1.35m、すれすれ3.6m
  groundGap: 0.6,         // 地面にこれだけ立つと連鎖が切れる
  chainIdle: 6,           // これだけ何も起きないと連鎖が切れる
  between: 3.5,           // 波と波のあいだ
  open: 2.6,              // 撃った直後にシールドが開いている秒数
  // v3 ロックオン突撃（届く距離: v3 42m → v4 25m → v5 23m。2026-11-11 本人「攻撃できる距離をほんの少しだけ短く」）
  dashRange: 23, dashMinV: 8, dashV: 30, dashMax: 2.2,   // 届く距離・使える速さ・突撃の速さ（発動時の速さ+6 と比べて大きい方）・打ち切り秒
  dashBounce: 12, dashShield: 0.5, dashOpen: 2,          // 当てた後に上へ跳ねる速さ・シールドの時の倍率・開いた所の倍率
  // 2026-11-09 本人「UFOも追いかけてくるように」: 追跡機（ハンター）
  huntV: 14, lungeV: 21, lungeR: 9, slowV: 10, huntHitR: 2.6, huntCool: 2.8,
  // v4（本人「もっとワイヤーの移動を楽しみたい。逃げたり、地形を活かしたり」）
  huntChase: 11, huntRest: 4, shakeD: 24, tailD: 16,   // 追跡は11秒で息切れ（離れていたら振り切った）・16m 以内は真後ろを追って建物をよけない
  diveV: -10, diveK: 1.4,                               // 落ちながら（下向き10m/s 以上）の突撃は1.4倍
  bossSec: 120            // 母艦の主砲が溜まりきるまで
}
// 倍率: 連鎖の数 → 倍率
export const MULT = [[15, 4], [10, 3], [6, 2], [3, 1.5], [0, 1]]
export const multOf = n => MULT.find(([k]) => n >= k)[1]
// 点（倍率を掛ける前）
export const PTS = { crash: 400, shaken: 120, cover: 60, dive: 80, hunter: 300, counter: 150, open: 60, hit: 20, saucer: 150, big: 400, scout: 250, pod: 300, core: 1500, drone: 50, near: 40, bait: 200, wall: 60, waveFast: 600, waveSecPt: 8, perfect: 300, clear: 2000, hpLeft: 250 }

// 波の中身。毎回どちらかの組み合わせ（v）を選ぶ。kind: saucer（偵察円盤 3発）/ big（砲艦 7発・レーザーと追尾弾）/ scout（小型 1発・速く逃げてドローンを落とす）
// atk: その波で使う攻撃。maxM: 同時に飛ぶ追尾弾の上限
export const WAVES = [
  { v: [{ ufos: ['saucer', 'saucer', 'saucer'], extra: ['saucer', 'hunter'] }, { ufos: ['saucer', 'saucer', 'scout'], extra: ['saucer', 'hunter', 'saucer'] }], atk: ['beam'], first: 6, cd: [5.5, 8], maxAtk: 1, maxM: 0, droneV: 0 },
  { v: [{ ufos: ['saucer', 'saucer', 'saucer', 'hunter', 'hunter'], extra: ['saucer', 'saucer', 'scout'] }, { ufos: ['saucer', 'scout', 'scout', 'saucer', 'hunter'], extra: ['saucer', 'hunter', 'saucer'] }], atk: ['beam', 'drone'], first: 4, cd: [5, 7.5], maxAtk: 2, maxM: 0, droneV: 9.5 },
  { v: [{ ufos: ['saucer', 'saucer', 'saucer', 'big', 'hunter'], extra: ['saucer', 'saucer', 'scout'] }, { ufos: ['big', 'scout', 'scout', 'saucer', 'saucer'], extra: ['hunter', 'hunter', 'saucer'] }], atk: ['beam', 'drone', 'laser', 'missile'], first: 4, cd: [4.6, 7], maxAtk: 2, maxM: 1, droneV: 10, mV: 14.5, mTurn: 1.45 },
  { v: [{ ufos: ['saucer', 'saucer', 'saucer', 'saucer', 'big', 'hunter'], extra: ['saucer', 'big', 'saucer'] }, { ufos: ['big', 'big', 'saucer', 'saucer', 'hunter'], extra: ['scout', 'hunter', 'saucer', 'saucer'] }], atk: ['beam', 'drone', 'laser', 'missile'], first: 3, cd: [4.2, 6.5], maxAtk: 3, maxM: 2, droneV: 10.5, mV: 15.5, mTurn: 1.55 }
]
// v5（2026-11-11 本人「母艦もある程度動き回るように」）: 広場の上を巡回。moveV で次の地点へ動き、着いたら dwell 秒止まる。攻撃の windup 秒前から止まって自分の方へ傾く
export const BOSS = { moveV: 4.5, acc: 1.6, patrolIn: 14, patrolR: 32, patrolMin: 16, dwell: [1.2, 3], windup: 1.1, clear: 31, hunterEvery: 22, maxHunters: 2, y: 36, rimR: 15, pods: 3, podHp: 3, coreHp: 7, coreY: 22, droneV: 11, mV: 16, mTurn: 1.6, maxM: 2, maxAtk: 3, cd: [3.6, 5.6] }
const KIND = {
  saucer: { hp: 1, r: 3.3, hh: 1.3, v: 7, alt: [12, 22] },
  big: { hp: 4, r: 5.2, hh: 1.9, v: 5, alt: [16, 26] },
  scout: { hp: 1, r: 1.9, hh: 0.9, v: 12, alt: [10, 18] },
  hunter: { hp: 1.5, r: 2.3, hh: 1.0, v: 14, alt: [12, 20] },
  pod: { hp: BOSS.podHp, r: 2.8, hh: 1.6, v: 0 },
  core: { hp: BOSS.coreHp, r: 4.4, hh: 2.2, v: 3 }
}

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
  const rnd = rng(seed)
  const R = {
    world, seed, rnd, t: 0, wave: -1, phase: 'intro', phaseT: 2.5, hp: U.hp, inv: 0,
    ufos: [], beams: [], lasers: [], drones: [], missiles: [], events: [], nextId: 1,
    taken: null, dash: null, dashReady: false, chain: 0, mult: 1, chainT: 0, groundT: 0, boss: null, over: false, end: null,
    plan: WAVES.map(W => Math.floor(rnd() * W.v.length)),   // 毎回ちがう組み合わせ
    waveHurt: 0,
    stats: { score: 0, downed: 0, rams: 0, hooks: 0, hurt: 0, hurtBy: {}, bestChain: 0, bestMult: 1, near: 0, mBait: 0, mWall: 0, drones: 0, bestRam: 0, waveTimes: [], perfect: 0, kills: {} },
    tut: !!opt.tut, noAttack: !!opt.noAttack
  }
  return R
}
const ev = (R, e) => R.events.push(e)

// 点を足す（倍率を掛ける）。連鎖を伸ばすものは chain を true に
function score(R, base, why, at, chain = false) {
  if (chain) { R.chain++; R.chainT = 0; R.stats.bestChain = Math.max(R.stats.bestChain, R.chain) }
  const m = multOf(R.chain)
  if (m > R.mult) ev(R, { t: 'multUp', mult: m, chain: R.chain })
  R.mult = m; R.stats.bestMult = Math.max(R.stats.bestMult, m)
  const pts = Math.round(base * (why === 'wave' || why === 'clear' || why === 'hpLeft' || why === 'perfect' ? 1 : m))
  R.stats.score += pts
  ev(R, { t: 'pts', pts, why, mult: m, chain: R.chain, ...(at || {}) })
  return pts
}
function breakChain(R, why) {
  if (R.chain >= 3) ev(R, { t: 'chainEnd', n: R.chain, why })
  R.chain = 0; R.mult = 1; R.chainT = 0
}

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

export function addUfo(R, kind, at, extra = {}) {
  const K = KIND[kind]
  const alt = K.alt ? K.alt[0] + R.rnd() * (K.alt[1] - K.alt[0]) : 0
  const u = {
    id: R.nextId++, kind, x: at.x, y: (at.y != null ? at.y : alt) + (at.drop || 0), z: at.z, vx: 0, vy: 0, vz: 0, hp: K.hp, maxHp: K.hp, r: K.r, hh: K.hh, alt,
    tx: at.x, tz: at.z, state: 'fly', t: 0, atk: null, hitCd: 0, hooked: 0, wob: 0, flash: 0, spin: R.rnd() * 6, charge: 0, fall: 0,
    open: 0, dodgeCd: 1 + R.rnd() * 2, side: R.rnd() < 0.5 ? 1 : -1, hunt: kind === 'hunter' ? 'stalk' : null, cool: 0, lunge: 0,
    atkCd: (R.wave >= 0 && WAVES[R.wave] ? WAVES[R.wave].first : 3) + R.rnd() * 2.5, ...extra
  }
  R.ufos.push(u)
  return u
}

function startWave(R, i) {
  R.wave = i; R.phase = 'wave'; R.phaseT = 0; R.extraIn = false; R.waveHurt = 0; R.huntIn = 0
  const V = WAVES[i].v[R.plan[i]]
  const kinds = [...V.ufos]
  const used = []
  for (const k of kinds) {
    // 自分の近く（30〜95m）の、ばらけた所に出す。高い所から降りてくる
    let p = null
    for (let j = 0; j < 12; j++) { p = pickSpot(R, R.lastR || BASE, 30, 95); if (used.every(q => Math.hypot(q.x - p.x, q.z - p.z) > 26)) break }
    used.push(p)
    addUfo(R, k, { ...p, drop: 40 })
  }
  const hs = R.ufos.filter(u => u.kind === 'hunter'); hs.forEach((u, k) => { u.side = k % 2 ? 1 : -1 })
  ev(R, { t: 'wave', n: i + 1, count: kinds.length, hunters: hs.length, scouts: kinds.filter(k => k === 'scout').length, big: kinds.includes('big') })
}

function startBoss(R) {
  R.wave = WAVES.length; R.phase = 'boss'; R.phaseT = 0; R.waveHurt = 0
  const B = { x: ARENA.x, y: BOSS.y + 60, z: ARENA.z, ang: R.rnd() * 6, dirA: R.rnd() < 0.5 ? 1 : -1, t: 0, left: U.bossSec, pods: [], core: null, state: 'arrive', spin: 0, atkCd: 4, down: 0 }
  for (let i = 0; i < BOSS.pods; i++) {
    const u = addUfo(R, 'pod', { x: B.x, y: B.y, z: B.z }, { slot: i, atkCd: 5 + i * 1.7 })
    B.pods.push(u)
  }
  R.boss = B
  R.hp = Math.min(U.hp, R.hp + 2)   // 母艦の前に予備の電池2本
  ev(R, { t: 'boss', fix: 2 })
}

// ---------------------------------------------------------------- 毎歩
export function stepRaid(R, r, dt) {
  if (R.over) return
  R.t += dt; R.lastR = { x: r.x, y: r.y, z: r.z }
  if (R.inv > 0) R.inv -= dt
  R.phaseT += dt
  // 連鎖（地面に立たずに当て続けた数）。着地して少し立つ・しばらく何もしないと切れる
  if (R.chain) {
    R.chainT += dt
    if (r.grounded) { R.groundT += dt; if (R.groundT > U.groundGap) breakChain(R, 'ground') } else R.groundT = 0
    if (R.chain && R.chainT > U.chainIdle) breakChain(R, 'idle')
  } else R.groundT = 0

  if (R.phase === 'intro' && R.phaseT > 2.5) startWave(R, 0)
  else if (R.phase === 'between' && R.phaseT > U.between) { if (R.wave + 1 < WAVES.length) startWave(R, R.wave + 1); else startBoss(R) }
  else if (R.phase === 'wave') {
    // 残りが1機になったら増援（波ごとに1回）
    const V = WAVES[R.wave].v[R.plan[R.wave]]
    if (V.extra && !R.extraIn && R.ufos.filter(u => u.state === 'fly').length <= 1) {
      R.extraIn = true
      for (const k of V.extra) { const p = pickSpot(R, R.lastR || BASE, 35, 90); addUfo(R, k, { ...p, drop: 45 }) }
      ev(R, { t: 'extra', n: V.extra.length })
    }
    // 長引くと追跡機が来る（60秒から25秒ごと。逃げ回るだけでは終わらない）
    if (R.phaseT > 60 && R.phaseT - (R.huntIn || 0) > 25 && R.ufos.filter(u => u.kind === 'hunter' && u.state === 'fly').length < 2) {
      R.huntIn = R.phaseT
      const p = pickSpot(R, R.lastR || BASE, 50, 90); addUfo(R, 'hunter', { ...p, drop: 30 })
      ev(R, { t: 'extra', n: 1, hunter: true })
    }
    const alive = R.ufos.some(u => u.state !== 'gone')
    if (!alive && R.phaseT > 2) {
      R.phase = 'between'
      const sec = R.phaseT, fast = Math.max(0, Math.round(PTS.waveFast - sec * PTS.waveSecPt))
      R.stats.waveTimes.push(Math.round(sec))
      if (fast) score(R, fast, 'wave')
      const perfect = R.waveHurt === 0
      if (perfect) { R.stats.perfect++; score(R, PTS.perfect, 'perfect') }
      R.phaseT = 0
      const fix = R.hp < U.hp
      if (fix) R.hp++
      ev(R, { t: 'waveClear', n: R.wave + 1, fix, last: R.wave + 1 >= WAVES.length, sec: Math.round(sec), fast, perfect })
    }
  } else if (R.phase === 'outro' && R.phaseT > 4.2) finish(R, 'clear')

  // ビルのワイヤーで振ったら突撃の準備ができる
  if (r.rope && r.rope.ufo == null) R.dashReady = true
  if (R.dash) stepDash(R, r, dt)
  // 回収されている間は自分の動きを上書きする
  if (R.taken) { R.dash = null; stepTaken(R, r, dt) }

  if (R.boss) stepBoss(R, r, dt)
  for (const u of R.ufos) stepUfo(R, u, r, dt)
  R.ufos = R.ufos.filter(u => !(u.state === 'gone' && u.t > 0.1))
  stepBeams(R, r, dt); stepLasers(R, r, dt); stepDrones(R, r, dt); stepMissiles(R, r, dt)
}

// v3: UFO にワイヤーは掛けない（突撃に一本化）。古い呼び出しのために残す
export function syncRope(R, r) {
  if (r.rope && r.rope.ufo != null) { r.rope = null }
}
// 突撃の届く距離の測り方（判定・照準の表示・「遠い」の案内・bot で同じもの）
export const dashDist = (r, u) => Math.hypot(u.x - r.x, u.y - (r.y + 1), u.z - r.z)
// 突撃できるか（ビルで振った後・速さ 8m/s 以上・空中・40m 以内で見通せる）
export function canDash(R, r, u) {
  if (!u || u.state !== 'fly' || R.dash || R.taken || R.over || !R.dashReady || r.grounded || r.climbing) return false
  if (R.boss && R.boss.state === 'arrive') return false
  if (Math.hypot(r.vx, r.vy, r.vz) < U.dashMinV) return false
  if (dashDist(r, u) > U.dashRange) return false
  return !blocked(R.world, r.x, r.y + 1.2, r.z, u.x, u.y, u.z) || !blocked(R.world, r.x, r.y + 1.2, r.z, u.x, u.y + u.hh + 1, u.z)
}
// bot と画面の既定の狙い: 前（yaw）寄りで近い UFO
export function lockTarget(R, r, yaw = null) {
  let best = null, bs = -1e9
  for (const u of R.ufos) {
    if (u.state !== 'fly') continue
    const dx = u.x - r.x, dz = u.z - r.z, d = dashDist(r, u)
    if (d > U.dashRange) continue
    let s2 = -d / U.dashRange + (u.kind === 'core' ? 0.6 : 0) + (u.kind === 'hunter' && u.hunt === 'chase' ? 0.3 : 0)
    if (yaw != null) s2 += ((dx * Math.sin(yaw) + dz * Math.cos(yaw)) / (Math.hypot(dx, dz) || 1)) * 0.8
    if (s2 > bs && canDash(R, r, u)) { bs = s2; best = u }
  }
  return best
}
export function startDash(R, r, id) {
  const u = R.ufos.find(q => q.id === id)
  if (!canDash(R, r, u)) return false
  const v0 = Math.hypot(r.vx, r.vy, r.vz)
  R.dash = { id, v0, t: 0, V: Math.max(U.dashV, v0 + 6), dive: r.vy < U.diveV }
  R.dashReady = false
  if (r.rope) { r.rope = null; r.events.push({ t: 'unwire', auto: true }) }
  ev(R, { t: 'dash', dive: R.dash.dive, id, v0, x: r.x, y: r.y, z: r.z, open: u.open > 0 && u.kind !== 'pod' && u.kind !== 'hunter' })
  return true
}
function stepDash(R, r, dt) {
  const D = R.dash; D.t += dt
  const u = R.ufos.find(q => q.id === D.id && q.state === 'fly')
  if (!u || D.t > U.dashMax) { R.dash = null; return }
  const dx = u.x - r.x, dy = u.y - (r.y + 1), dz = u.z - r.z, d = Math.hypot(dx, dy, dz) || 1
  r.vx = dx / d * D.V; r.vy = dy / d * D.V; r.vz = dz / d * D.V; r.grounded = false; r.climbing = null; r.stun = 0
  R.inv = Math.max(R.inv, 0.12)
  if (d < u.r + 1.8 || d < D.V * dt * 1.5) dashHit(R, u, r)
}
function dashHit(R, u, r) {
  const D = R.dash; R.dash = null
  const counter = u.kind === 'hunter' && (u.vx * (r.x - u.x) + u.vy * (r.y - u.y) + u.vz * (r.z - u.z)) > 0
  const eff = D.v0 + (counter ? Math.hypot(u.vx, u.vy, u.vz) : 0)
  const open = u.open > 0 && u.kind !== 'pod' && u.kind !== 'hunter'
  const crack = !open && u.kind !== 'pod' && u.kind !== 'hunter'
  let dmg = Math.max(1, eff / 10) * (open ? U.dashOpen : crack ? U.dashShield : 1) * (D.dive ? U.diveK : 1)
  if (D.dive) R.stats.dives = (R.stats.dives || 0) + 1
  dmg = Math.round(dmg * 10) / 10
  // 跳ね返る: 少し上と後ろへ（次のビルに掛けて次の突撃へ）
  const l = Math.hypot(r.vx, r.vz) || 1
  r.vx = -r.vx / l * 4 + u.vx * 0.3; r.vz = -r.vz / l * 4 + u.vz * 0.3; r.vy = U.dashBounce
  u.hitCd = 0.5; u.hp -= dmg; u.flash = 1; u.wob = 1
  if (u.kind === 'hunter') { u.cool = U.huntCool; u.hunt = 'back' }
  R.stats.rams++; R.stats.vSum = (R.stats.vSum || 0) + D.v0; R.stats.bestRam = Math.max(R.stats.bestRam, D.v0); R.groundT = 0
  if (open) R.stats.opens = (R.stats.opens || 0) + 1
  if (counter) R.stats.counters = (R.stats.counters || 0) + 1
  const kill = u.hp <= 0.01
  // 速いほど点も連鎖も伸びる（20m/s 以上は連鎖+2）
  if (D.v0 >= 20) { R.chain++; R.chainT = 0 }
  const pts = score(R, PTS.hit * Math.ceil(dmg) + Math.round(D.v0 * 3) + (open ? PTS.open : 0) + (counter ? PTS.counter : 0) + (D.dive ? PTS.dive : 0), 'hit', { x: u.x, y: u.y, z: u.z }, true)
  ev(R, { t: 'ram', dive: D.dive, id: u.id, kind: u.kind, x: u.x, y: u.y, z: u.z, cx: (r.x + u.x) / 2, cy: (r.y + 1 + u.y) / 2, cz: (r.z + u.z) / 2, v: D.v0, dmg, kill, open, crack, counter, chain: R.chain, mult: R.mult, pts })
  if (kill) downUfo(R, u, -r.vx * 0.5, -r.vz * 0.5)
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
    const s = cos * 2 - d * 0.02 + (u.hp <= 1 ? 0.3 : 0)
    if (s > bs) { bs = s; best = u }
  }
  return best
}

function stepUfo(R, u, r, dt) {
  u.t += dt; u.spin += dt * (u.kind === 'scout' || u.kind === 'hunter' ? 7 : 2.2); u.flash = Math.max(0, u.flash - dt * 3); u.hitCd = Math.max(0, u.hitCd - dt)
  u.open = Math.max(0, u.open - dt); u.dodgeCd -= dt
  if (u.kind === 'pod') u.open = Math.max(u.open, 1)   // 母艦の砲台は弱点（シールドの外）
  if (u.state === 'gone') return
  if (u.state === 'fall') {
    // 落ちていく: 回りながら煙を吐いて落ちる。地面か屋上に着いたら爆発
    u.vy -= 18 * dt; u.x += u.vx * dt; u.y += u.vy * dt; u.z += u.vz * dt; u.spin += dt * 14
    if (u.y <= topAt(R.world, u.x, u.z) + 0.6 || insideSolid(R.world, u.x, u.y, u.z) || u.t > 6) { u.state = 'gone'; u.t = 0; ev(R, { t: 'crash', id: u.id, x: u.x, y: Math.max(u.y, topAt(R.world, u.x, u.z)), z: u.z, kind: u.kind }) }
    return
  }
  const K = KIND[u.kind]
  // 動き。pod は母艦に付いている（stepBoss が置く）
  if (u.kind === 'hunter' && !u.frozen) stepHunter(R, u, r, dt)
  else if (u.kind !== 'pod' && u.kind !== 'core' && !u.frozen) {
    const dT = Math.hypot(u.tx - u.x, u.tz - u.z)
    const pl = { x: r.x, z: r.z }
    if (u.kind === 'scout' && Math.hypot(r.x - u.x, r.z - u.z) < 26 && R.rnd() < dt * 1.6) {
      const p = pickSpot(R, u, 25, 45); u.tx = p.x; u.tz = p.z   // 小型は近づくと逃げる
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
    // 横ゆれ（止まって見えないように）と、まっすぐ近づかれた時の回避
    u.vx += -ddz / l * Math.sin(u.t * 0.9 + u.id) * K.v * 0.6 * dt; u.vz += ddx / l * Math.sin(u.t * 0.9 + u.id) * K.v * 0.6 * dt
    // 高さ: 決めた高さ。下の建物より 10m 上。降りてくる時は速く。引っかけられている間は少し下がる
    const floor = topAt(R.world, u.x, u.z)
    const ty = Math.max(u.alt, floor + 7) - (hooked ? 6 : 0) + Math.sin(u.t * 1.3 + u.id) * 0.8
    u.vy += ((ty - u.y) * (u.y > ty + 8 ? 1.4 : 0.9) - u.vy) * Math.min(1, dt * 2)
    u.x += u.vx * dt; u.y += u.vy * dt; u.z += u.vz * dt
  }
  { u.hooked = 0; u.wob = Math.max(0, u.wob - dt * 2) }
  ramCheck(R, u, r)
  if (!R.noAttack && R.phase !== 'outro') ufoAttack(R, u, r, dt)
}

// 追跡機: 自分を追ってくる。泳ぐ速さ 14m/s（ビルで振れば振り切れる）。遅い・地面にいると近くで突っ込んでくる（突進 21m/s）
// 挟み撃ち: 2機は自分の左右から回り込む。当たったら少し離れてまた追う。追跡中はシールドが無い（向き直って迎え撃てる）
function stepHunter(R, u, r, dt) {
  u.cool = Math.max(0, u.cool - dt); u.open = 9   // シールド無し
  const pv = Math.hypot(r.vx, r.vy, r.vz)
  let tx = r.x, ty = r.y + 1.5, tz = r.z, sp = U.huntV
  const dx0 = r.x - u.x, dz0 = r.z - u.z, dh = Math.hypot(dx0, dz0) || 1
  const d3 = Math.hypot(r.x - u.x, r.y + 1 - u.y, r.z - u.z)
  let tail = false
  if (u.cool > 0) { tx = u.x - dx0 / dh * 10; tz = u.z - dz0 / dh * 10; ty = r.y + 14; sp = 10; u.hunt = 'back' }
  else {
    u.chaseT = (u.chaseT || 0) + dt; u.minD = Math.min(u.minD == null ? 1e9 : u.minD, d3)
    // 振り切られた: 一度は近くまで迫ったのに、長く追って離されている・大きく離された
    if (u.minD < 20 && u.chaseT > 2 && ((u.chaseT > U.huntChase && d3 > U.shakeD) || d3 > 45)) {
      u.minD = 1e9
      u.cool = U.huntRest; u.hunt = 'back'; u.chaseT = 0
      if (!R.taken) { R.stats.shaken = (R.stats.shaken || 0) + 1; const pts = score(R, PTS.shaken, 'shaken', { x: r.x, y: r.y + 2, z: r.z }, true); ev(R, { t: 'shaken', id: u.id, x: u.x, y: u.y, z: u.z, pts }) }
    } else if (u.chaseT > U.huntChase + 6) { u.cool = 1.5; u.chaseT = 0; u.minD = 1e9; u.hunt = 'back' }
    if (dh > 14) { tx += -dz0 / dh * u.side * Math.min(18, dh * 0.4); tz += dx0 / dh * u.side * Math.min(18, dh * 0.4); ty = Math.max(r.y + 4, topAt(R.world, u.x, u.z) + 6) }   // 回り込む
    else if (d3 < U.tailD) { tail = true; tx = r.x - r.vx * 0.25; ty = r.y + 1.2 - r.vy * 0.25; tz = r.z - r.vz * 0.25 }   // 真後ろを追う（建物をよけない）
    if (u.hunt !== 'lunge' && d3 < U.lungeR && (pv < U.slowV || r.grounded)) { u.hunt = 'lunge'; u.lunge = 0; ev(R, { t: 'lunge', id: u.id, x: u.x, y: u.y, z: u.z }) }
    if (u.hunt === 'lunge') { u.lunge += dt; sp = U.lungeV; tail = true; if (u.lunge > 1.1) u.hunt = 'chase' }
    else if (u.hunt !== 'chase') { u.hunt = 'chase'; u.chaseT = 0; ev(R, { t: 'hunt', id: u.id, x: u.x, y: u.y, z: u.z }) }
  }
  const dx = tx - u.x, dy = ty - u.y, dz = tz - u.z, l = Math.hypot(dx, dy, dz) || 1
  const k = Math.min(1, dt * (u.hunt === 'lunge' ? 4 : tail ? 3 : 1.8))
  u.vx += (dx / l * sp - u.vx) * k; u.vy += (dy / l * sp * (tail ? 1 : 0.8) - u.vy) * k; u.vz += (dz / l * sp - u.vz) * k
  // 遠くを追う時は前の建物を上へよける。真後ろを追う時はよけない
  if (!tail && insideSolid(R.world, u.x + u.vx * 0.6, u.y + u.vy * 0.6, u.z + u.vz * 0.6)) u.vy = Math.max(u.vy, 9)
  u.x += u.vx * dt; u.y += u.vy * dt; u.z += u.vz * dt
  const fl = topAt(R.world, u.x, u.z) + 2.5; if (u.y < fl && !tail) { u.y = fl; u.vy = Math.max(0, u.vy) }
  if (insideSolid(R.world, u.x, u.y, u.z) || u.y < floorAt(R.world, u.x, u.z, u.y + 0.5).h + 0.6) {
    if (tail && u.cool <= 0) {
      // 建物（か地面）に激突して落ちる
      R.stats.crashes = (R.stats.crashes || 0) + 1
      const pts = score(R, PTS.crash, 'crash', { x: u.x, y: u.y, z: u.z }, true)
      ev(R, { t: 'hunterCrash', id: u.id, x: u.x, y: u.y, z: u.z, pts })
      downUfo(R, u, -u.vx * 0.2, -u.vz * 0.2, 'wall'); return
    }
    u.y += 6 * dt * 4; u.vy = Math.max(u.vy, 6)
  }
  if (u.cool <= 0 && !R.taken && !R.dash && u.hitCd <= 0) {
    if (d3 < U.huntHitR) { u.cool = U.huntCool; u.hunt = 'back'; u.chaseT = 0; hurt(R, r, 'hunter', u.x, u.z) }
  }
}

// 突撃でない接触: 跳ね返るだけ（ダメージ無し）。追跡機には当てられる
function ramCheck(R, u, r) {
  if (u.hitCd > 0 || u.state !== 'fly' || R.taken || R.dash) return
  const cx = r.x, cy = r.y + 1.0, cz = r.z
  const dx = cx - u.x, dy = cy - u.y, dz = cz - u.z, dh = Math.hypot(dx, dz)
  const k = (dh / (u.r + 0.8)) ** 2 + (dy / (u.hh + 1.0)) ** 2
  if (k >= 1) return
  const l = Math.hypot(dx, dy, dz) || 1
  r.vx = dx / l * U.bounceOut + u.vx * 0.5; r.vz = dz / l * U.bounceOut + u.vz * 0.5; r.vy = Math.max(U.bounceUp * 0.6, dy / l * U.bounceOut)
  r.grounded = false; r.climbing = null
  u.hitCd = 0.45
  if (u.kind === 'hunter' && u.cool <= 0) { u.cool = U.huntCool; u.hunt = 'back'; hurt(R, r, 'hunter', u.x, u.z); return }
  ev(R, { t: 'boing', id: u.id, x: u.x, y: u.y, z: u.z, v: Math.hypot(r.vx, r.vy, r.vz) })
}

function downUfo(R, u, pvx = 0, pvz = 0, by = 'ram') {
  u.state = 'fall'; u.t = 0; u.vx = u.vx * 0.3 + pvx; u.vz = u.vz * 0.3 + pvz; u.vy = 4; u.hp = 0
  if (u.kind !== 'pod' && u.kind !== 'core') R.stats.downed++
  R.stats.kills[u.kind] = (R.stats.kills[u.kind] || 0) + 1
  const pts = score(R, PTS[u.kind] || 100, 'kill', { x: u.x, y: u.y, z: u.z })
  ev(R, { t: 'down', id: u.id, kind: u.kind, x: u.x, y: u.y, z: u.z, by, pts, mult: R.mult })
}

// ---------------------------------------------------------------- 攻撃
function cfg(R) { return R.boss ? BOSS : WAVES[Math.max(0, R.wave)] }
function busyCount(R) { return R.beams.length + R.lasers.length + R.ufos.filter(u => u.atk === 'missile' && u.charge > 0).length }
function ufoAttack(R, u, r, dt) {
  if (u.state !== 'fly' || u.kind === 'hunter' || (R.boss && R.boss.state === 'arrive')) return
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
  const C = cfg(R)
  const list = u.kind === 'pod' ? ['missile', 'laser'] : u.kind === 'core' ? ['beam3', 'missile'] : u.kind === 'big' ? ['laser', 'missile', 'missile', 'drone'] : u.kind === 'scout' ? ['drone'] : C.atk.filter(a => a === 'beam' || a === 'drone' || (a === 'missile' && u.id % 2 === 0))
  const opts = list.filter(a => (R.boss || C.atk.includes(a.replace('3', ''))) || u.kind === 'pod' || u.kind === 'core' || u.kind === 'scout')
  u.atkCd = C.cd[0] + R.rnd() * (C.cd[1] - C.cd[0])
  if (u.kind === 'scout') u.atkCd *= 1.4
  if (!opts.length || r.wreck > 0 || R.taken || R.hp <= 0) return
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
    if (R.drones.length >= 6) { u.atkCd = 1.5; return }
    const n = u.kind === 'big' ? 2 : 1
    for (let i = 0; i < n; i++) R.drones.push({ id: R.nextId++, x: u.x + (i - 0.5) * 2, y: u.y - u.hh - 0.8, z: u.z, vx: 0, vy: -3, vz: 0, t: 0, v: C.droneV || 10 })
    u.open = U.open
    ev(R, { t: 'droneOut', id: u.id, x: u.x, y: u.y, z: u.z, n })
  } else if (a === 'missile') {
    const alive = R.missiles.length + R.ufos.filter(q => q.atk === 'missile').length
    if (alive >= (C.maxM || 0) || dh > 80) { u.atkCd = 1.2; return }
    u.atk = 'missile'; u.charge = U.mLock
    ev(R, { t: 'lock', id: u.id, x: u.x, y: u.y, z: u.z })
  }
}

function hurt(R, r, src, x, z, knock = true) {
  if (R.inv > 0 || R.dash || R.taken || R.over || r.wreck > 0) return false
  R.hp--; R.inv = U.inv; R.stats.hurt++; R.waveHurt++; R.stats.hurtBy[src] = (R.stats.hurtBy[src] || 0) + 1
  breakChain(R, 'hurt')
  if (knock) {
    let dx = r.x - x, dz = r.z - z, l = Math.hypot(dx, dz); if (l < 0.3) { dx = -Math.sin(r.yaw); dz = -Math.cos(r.yaw); l = 1 }
    r.rope = null; r.climbing = null; r.grounded = false
    r.vx = dx / l * 10 + r.vx * 0.2; r.vz = dz / l * 10 + r.vz * 0.2; r.vy = Math.max(r.vy, 6); r.y += 0.15; r.stun = Math.max(r.stun || 0, 0.35)
  }
  ev(R, { t: 'hurt', src, x: r.x, y: r.y, z: r.z, hp: R.hp })
  if (R.hp <= 0) takeAway(R, r)
  return true
}
function takeAway(R, r) {
  // 電池が尽きた: いちばん近い UFO（いなければ空の上）の光に吸い上げられて回収される
  const u = R.ufos.filter(q => q.state === 'fly').sort((a, b) => Math.hypot(a.x - r.x, a.z - r.z) - Math.hypot(b.x - r.x, b.z - r.z))[0]
  R.taken = { t: 0, ufo: u ? u.id : null, x: u ? u.x : r.x, y: u ? u.y : r.y + 40, z: u ? u.z : r.z, y0: r.y }
  r.rope = null; r.climbing = null
  for (const m of R.missiles) m.done = true
  R.beams.length = 0; R.lasers.length = 0
  ev(R, { t: 'taken', x: r.x, y: r.y, z: r.z, ufo: R.taken.ufo })
}
function stepTaken(R, r, dt) {
  const S = R.taken
  S.t += dt
  const u = S.ufo != null && R.ufos.find(q => q.id === S.ufo)
  if (u) { S.x = u.x; S.y = u.y; S.z = u.z; u.vx *= 0.9; u.vz *= 0.9 }
  const k = Math.min(1, dt * 2.2)
  r.x += (S.x - r.x) * k; r.z += (S.z - r.z) * k
  r.y = Math.min(S.y - 2.5, r.y + (S.t < 0.8 ? 1.5 : 5) * dt)
  r.vx = r.vy = r.vz = 0; r.grounded = false; r.rope = null; r.climbing = null
  r.yaw += dt * (2 + S.t * 3)
  if (S.t > 3.4) finish(R, 'taken')
}

function stepBeams(R, r, dt) {
  for (const b of R.beams) {
    b.t += dt
    const u = R.ufos.find(q => q.id === b.ufo)
    if (!u || u.state !== 'fly') { b.done = true; continue }
    b.ux = u.x; b.uy = u.y - u.hh; b.uz = u.z
    if (b.phase === 'warn' && b.t > U.beamWarn) { b.phase = 'on'; b.t = 0; u.open = U.open + U.beamOn; ev(R, { t: 'beamOn', id: b.id, x: b.x, y: b.gy, z: b.z }) }
    else if (b.phase === 'on') {
      if (b.t > U.beamOn) { b.done = true; continue }
      // 円すいの中か: UFO の底 → 地面の輪 の軸からの距離が、その高さでの半径より小さい
      const ax = b.x - b.ux, ay = b.gy - b.uy, az = b.z - b.uz, L2 = ax * ax + ay * ay + az * az
      const px = r.x - b.ux, py = r.y + 0.9 - b.uy, pz = r.z - b.uz
      const s = clamp((px * ax + py * ay + pz * az) / L2, 0, 1)
      const ex = px - ax * s, ey = py - ay * s, ez = pz - az * s, rad = 1.2 + (b.r - 1.2) * s, d2 = ex * ex + ey * ey + ez * ez
      if (s > 0.02 && d2 < rad * rad) {
        // ビルの陰（UFO から自分まで建物がある）なら光線は届かない
        if (blocked(R.world, b.ux, b.uy - 0.5, b.uz, r.x, r.y + 1.2, r.z)) { if (!b.cover) { b.cover = true; R.stats.cover = (R.stats.cover || 0) + 1; const pts = score(R, PTS.cover, 'cover', { x: r.x, y: r.y + 2, z: r.z }, true); ev(R, { t: 'cover', x: r.x, y: r.y, z: r.z, pts }) } }
        else if (!b.hit && hurt(R, r, 'beam', b.x, b.z)) b.hit = true
      }
      else if (!b.near && !b.hit && s > 0.3 && d2 < (rad + 2.2) ** 2 && !r.grounded) { b.near = true; nearMiss(R, r, b.x, b.z, 'beam') }
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
    if (L.phase === 'warn' && L.t > U.laserWarn) { L.phase = 'on'; L.t = 0; u.open = U.open + U.laserSweep; ev(R, { t: 'laserOn', id: L.id }) }
    else if (L.phase === 'on') {
      const s = Math.min(1, L.t / U.laserSweep)
      L.px = L.ax + (L.bx - L.ax) * s; L.pz = L.az + (L.bz - L.az) * s
      // 線分（UFO → 地面の点）からの距離
      if (!L.hit) {
        const ax = L.px - L.ux, ay = L.gy - L.uy, az = L.pz - L.uz, L2 = ax * ax + ay * ay + az * az
        const px = r.x - L.ux, py = r.y + 0.9 - L.uy, pz = r.z - L.uz, q = clamp((px * ax + py * ay + pz * az) / L2, 0, 1.05)
        const ex = px - ax * q, ey = py - ay * q, ez = pz - az * q
        if (ex * ex + ey * ey + ez * ez < U.laserHit * U.laserHit) {
          if (blocked(R.world, L.ux, L.uy - 0.5, L.uz, r.x, r.y + 1.2, r.z)) { if (!L.cover) { L.cover = true; R.stats.cover = (R.stats.cover || 0) + 1; const pts = score(R, PTS.cover, 'cover', { x: r.x, y: r.y + 2, z: r.z }, true); ev(R, { t: 'cover', x: r.x, y: r.y, z: r.z, pts }) } }
          else if (hurt(R, r, 'laser', L.px, L.pz)) L.hit = true
        }
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
    if (l < U.droneR + 0.5 && !R.taken) {
      const pv = Math.hypot(r.vx, r.vy, r.vz)
      d.done = true
      if (pv >= U.droneKillV && !r.grounded) { R.stats.drones++; const pts = score(R, PTS.drone, 'drone', { x: d.x, y: d.y, z: d.z }, true); ev(R, { t: 'droneKill', x: d.x, y: d.y, z: d.z, chain: R.chain, pts }) }
      else { ev(R, { t: 'droneBoom', x: d.x, y: d.y, z: d.z }); hurt(R, r, 'drone', d.x, d.z) }
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
  u.open = U.open
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
    if (!R.taken) {
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
    if (d < U.mR && !R.taken) { m.done = true; ev(R, { t: 'mBoom', x: m.x, y: m.y, z: m.z, hit: true }); hurt(R, r, 'missile', m.x, m.z); continue }
    // すれすれ: 近くまで来て、離れ始めた
    if (d < m.minD) m.minD = d
    else if (!m.near && m.minD < U.mNear && d > m.minD + 0.8) { m.near = true; nearMiss(R, r, m.x, m.z, 'missile') }
    // 別の UFO に当たった（誘導した）
    let hitU = null
    for (const u of R.ufos) { if (u.state !== 'fly' || (u.id === m.from && m.t < 1.2)) continue; if (Math.hypot(u.x - m.x, (u.y - m.y) * 1.6, u.z - m.z) < u.r + 0.6) { hitU = u; break } }
    if (hitU) {
      m.done = true; R.stats.mBait++
      hitU.hp -= 1; hitU.flash = 1; hitU.wob = 1
      const pts = score(R, PTS.bait, 'bait', { x: m.x, y: m.y, z: m.z }, true)
      ev(R, { t: 'mBait', id: hitU.id, x: m.x, y: m.y, z: m.z, kill: hitU.hp <= 0, self: hitU.id === m.from, pts })
      if (hitU.hp <= 0) downUfo(R, hitU, m.vx * 0.2, m.vz * 0.2, 'missile')
      continue
    }
    // 建物・地面に当たった（自分の近くで当てた時だけ点）
    if (insideSolid(R.world, m.x, m.y, m.z) || m.y <= floorAt(R.world, m.x, m.z, m.y + 0.5).h + 0.2) {
      m.done = true
      const mine = m.t > 0.3 && m.minD < 26
      let pts = 0
      if (mine) { R.stats.mWall++; pts = score(R, PTS.wall, 'wall', { x: m.x, y: m.y, z: m.z }, true) }
      ev(R, { t: 'mBoom', x: m.x, y: m.y, z: m.z, wall: true, mine, pts }); continue
    }
    if (m.t > U.mLife) { m.done = true; ev(R, { t: 'mBoom', x: m.x, y: m.y, z: m.z, fizz: true }) }
  }
  R.missiles = R.missiles.filter(m => !m.done)
}

function nearMiss(R, r, x, z, src) {
  // ギリギリ: 進む向きへ少し勢い（長いスローは入れない。画面は光と音だけ）
  const h = Math.hypot(r.vx, r.vz)
  if (h > 2 && h < 34) { r.vx += r.vx / h * 2.5; r.vz += r.vz / h * 2.5 }
  R.stats.near++
  const pts = score(R, PTS.near, 'near', { x, y: r.y + 1, z }, true)
  ev(R, { t: 'near', x, z, src, pts, chain: R.chain })
}

// ---------------------------------------------------------------- 母艦
// 巡回の次の地点: 広場の真ん中から patrolIn〜patrolR（真ん中は周りのビルが低く、砲台まで上がれない）・今の所から patrolMin 以上・真下に高い建物が無い所（船体がビルにめり込まない）
function bossSpot(R, B) {
  let best = null, bh = 1e9
  for (let i = 0; i < 24; i++) {
    const a = R.rnd() * Math.PI * 2, d = BOSS.patrolIn + R.rnd() * (BOSS.patrolR - BOSS.patrolIn)
    const x = ARENA.x + Math.sin(a) * d, z = ARENA.z + Math.cos(a) * d
    if (Math.hypot(x - B.x, z - B.z) < BOSS.patrolMin) continue
    let hi = 0
    for (let k = 0; k < 13; k++) { const aa = k / 12 * Math.PI * 2, dd = k ? 17 : 0; hi = Math.max(hi, topAt(R.world, x + Math.sin(aa) * dd, z + Math.cos(aa) * dd)) }
    if (hi <= BOSS.clear) return { x, z }
    if (hi < bh) { bh = hi; best = { x, z } }
  }
  return best || { x: ARENA.x, z: ARENA.z }
}
// 母艦の動き: 次の地点へゆっくり進み、着いたら少し止まる。攻撃の直前は止まって、こちらへ傾く（向きを変える）
function moveBoss(R, B, r, dt) {
  if (!B.goal) { B.goal = bossSpot(R, B); B.vx = B.vx || 0; B.vz = B.vz || 0; B.wait = 0 }
  const windup = B.atkCd < BOSS.windup
  let wx = 0, wz = 0
  if (B.wait > 0) { B.wait -= dt; if (B.wait <= 0) B.goal = bossSpot(R, B) }
  else {
    const dx = B.goal.x - B.x, dz = B.goal.z - B.z, d = Math.hypot(dx, dz)
    if (d < 2) { B.wait = BOSS.dwell[0] + R.rnd() * (BOSS.dwell[1] - BOSS.dwell[0]) }
    else { const v = BOSS.moveV * Math.min(1, d / 8); wx = dx / d * v; wz = dz / d * v }
  }
  if (windup) { wx = 0; wz = 0 }
  const k = Math.min(1, dt * BOSS.acc)
  B.vx += (wx - B.vx) * k; B.vz += (wz - B.vz) * k
  B.x += B.vx * dt; B.z += B.vz * dt
  // 傾き（画面用）: 進む向きへ前のめり、攻撃の前はこちらへ
  const px = r.x - B.x, pz = r.z - B.z, pl = Math.hypot(px, pz) || 1
  const tx = windup ? px / pl * 0.13 : B.vx / BOSS.moveV * 0.07, tz = windup ? pz / pl * 0.13 : B.vz / BOSS.moveV * 0.07
  B.tiltX = (B.tiltX || 0) + (tx - (B.tiltX || 0)) * Math.min(1, dt * 3); B.tiltZ = (B.tiltZ || 0) + (tz - (B.tiltZ || 0)) * Math.min(1, dt * 3)
  B.windup = windup
}
function stepBoss(R, r, dt) {
  const B = R.boss
  B.t += dt; B.spin += dt * 0.35
  if (B.state === 'arrive') {
    B.y += (BOSS.y - B.y) * Math.min(1, dt * 0.9)
    if (B.t > 4.5) { B.state = 'fight'; ev(R, { t: 'bossFight' }) }
  } else if (B.state === 'fight' || B.state === 'core') {
    if (!R.taken) B.left -= dt
    moveBoss(R, B, r, dt)
    B.y = BOSS.y + Math.sin(B.t * 0.6) * 1.2
    // 母艦そのもの: 焼却光線とドローン
    B.atkCd -= dt
    if (B.atkCd <= 0 && !R.taken && R.hp > 0) {
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
    B.huntT = (B.huntT || 0) + dt
    if (B.huntT > BOSS.hunterEvery && R.ufos.filter(q => q.kind === 'hunter' && q.state === 'fly').length < BOSS.maxHunters && !R.taken) {
      B.huntT = 0
      for (let i = 0; i < 2; i++) { const h = addUfo(R, 'hunter', { x: B.x + (i ? 8 : -8), y: B.y - 6, z: B.z }); h.side = i ? 1 : -1 }
      ev(R, { t: 'hunters', x: B.x, y: B.y, z: B.z })
    }
    if (B.left <= 0) { B.state = 'fire'; B.fireT = 0; for (const m of R.missiles) m.done = true; R.beams.length = 0; R.lasers.length = 0; R.drones.length = 0; ev(R, { t: 'mainCannon', x: B.x, y: B.y, z: B.z }); return }
  } else if (B.state === 'fire') {
    B.fireT += dt
    if (B.fireT > 3) { finish(R, 'burned'); return }
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
    c.vx = (B.x - c.x) * 1.5; c.vz = (B.z - c.z) * 1.5; c.vy = (ty - c.y) * 1.2
    c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt
  }
  if (B.state === 'core' && B.core && B.core.state !== 'fly') {
    B.state = 'down'; B.down = 0; R.phase = 'outro'; R.phaseT = 0
    for (const m of R.missiles) m.done = true
    R.beams.length = 0; R.lasers.length = 0; R.drones.length = 0
    score(R, PTS.clear, 'clear')
    if (R.hp > 0) score(R, PTS.hpLeft * R.hp, 'hpLeft')
    if (R.waveHurt === 0) { R.stats.perfect++; score(R, PTS.perfect, 'perfect') }
    ev(R, { t: 'bossDown', x: B.x, y: B.y, z: B.z, left: Math.round(B.left) })
  }
  if (B.state === 'down') { B.down += dt; B.y -= dt * 3 * B.down; B.spin += dt * 1.5 }
}

function finish(R, how) {
  if (R.over) return
  R.over = true; R.end = how
  ev(R, { t: 'end', how })
}

export function summary(R) {
  const S = R.stats
  return { ...S, end: R.end, wave: Math.min(R.wave + 1, WAVES.length + 1), hp: R.hp, t: R.t, mult: R.mult, chain: R.chain }
}
export const RANKS = [45000, 35000, 22000, 8000]   // S・A・B・C（それ未満は D）。tools/sim.mjs で決める
