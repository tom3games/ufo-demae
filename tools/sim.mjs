// bot を種を変えて回し、結果の分布を出す。node tools/sim.mjs [回数] [性格]
import { createWorld } from '../shared/track.js?v=1'
import { createRunner, stepRunner } from '../shared/runner.js?v=1'
import { createStreet, buildPoles } from '../shared/street.js?v=1'
import { addTown, clearShopFront } from '../shared/town.js?v=1'
import { createRaid, stepRaid, syncRope, summary, SHOP, RANKS, startDash, U, BOSS } from '../shared/ufo.js?v=1'
// 調整の試し: RANGE=24 MOVEV=3.5 node tools/sim.mjs 40 clumsy
if (process.env.RANGE) U.dashRange = +process.env.RANGE
if (process.env.MOVEV) BOSS.moveV = +process.env.MOVEV
if (process.env.PIN) BOSS.patrolIn = +process.env.PIN
if (process.env.BY) BOSS.y = +process.env.BY
import { createUfoBot, ufoBotInput } from '../shared/ufobot.js?v=1'
const N = +(process.argv[2] || 10), only = process.argv[3]
const { addRuinMap } = await import('../shared/ruinmap.js?v=1')
const world = createWorld('city'); clearShopFront(world, SHOP); addTown(world, SHOP); addRuinMap(world); buildPoles(world, SHOP)
const dt = 1 / 60
export function play(kind, seed, verbose = false) {
  const r = createRunner({ id: 'me', spawn: { x: SHOP.x - 9, y: 0, z: SHOP.z, yaw: Math.PI / 2 } })
  const R = createRaid(world, seed), b = createUfoBot(kind, seed), st = createStreet(world, seed)
  const cnt = {}
  while (!R.over && R.t < 600) {
    const inp = ufoBotInput(b, r, R, world, dt)
    r.events.length = 0
    if (inp.dash != null) startDash(R, r, inp.dash)
    syncRope(R, r); stepRunner(r, inp, dt, world); st.collide(r)
    stepRaid(R, r, dt)
    for (const e of R.events) { cnt[e.t] = (cnt[e.t] || 0) + 1; if (e.t === 'bossFight') cnt.bossAt = R.t; if (e.t === 'bossDown') cnt.bossSec = R.t - cnt.bossAt; if (verbose && !['near'].includes(e.t)) console.log(R.t.toFixed(1), JSON.stringify(e)) }
    R.events.length = 0
  }
  return { ...summary(R), cnt }
}
const kinds = only === 'missile' ? [] : only ? [only] : ['skilled', 'clumsy', 'evader', 'runner', 'idle']
for (const k of kinds) {
  const rows = []
  for (let s = 1; s <= N; s++) rows.push(play(k, s, N === 1))
  const avg = f => (rows.reduce((a, x) => a + f(x), 0) / rows.length)
  const sc = rows.map(x => x.score).sort((a, b) => a - b)
  const ends = {}; rows.forEach(x => ends[x.end] = (ends[x.end] || 0) + 1)
  console.log(`${k.padEnd(8)} 点 平均${Math.round(avg(x => x.score))} 中央${sc[sc.length >> 1]} 最小${sc[0]} 最大${sc[sc.length - 1]}  終わり ${JSON.stringify(ends)}  時間${avg(x => x.t).toFixed(0)}秒 到達波${avg(x => x.wave).toFixed(1)}`)
  console.log(`         撃墜${avg(x => x.downed).toFixed(1)} 体当たり${avg(x => x.rams).toFixed(1)} 被弾${avg(x => x.hurt).toFixed(1)} 最高連鎖${avg(x => x.bestChain).toFixed(1)} 最高倍率${avg(x => x.bestMult).toFixed(2)} ドローン${avg(x => x.drones).toFixed(1)} 突撃${avg(x => x.cnt.dash || 0).toFixed(1)} 開いた所${avg(x => x.opens || 0).toFixed(1)} 迎え撃ち${avg(x => x.counters || 0).toFixed(1)} 振り切り${avg(x => x.shaken || 0).toFixed(1)} 激突${avg(x => x.crashes || 0).toFixed(1)} 盾${avg(x => x.cover || 0).toFixed(1)} 急降下${avg(x => x.dives || 0).toFixed(1)} 突撃の平均速さ${avg(x => x.rams ? x.vSum / x.rams : 0).toFixed(1)}m/s 無傷の波${avg(x => x.perfect).toFixed(1)} 波の秒数 ${rows[0].waveTimes.join('/')}`)
  console.log(`         追尾弾 撃たれ${avg(x => x.cnt.fire || 0).toFixed(1)} すれすれ${avg(x => x.near).toFixed(1)} 建物${avg(x => x.mWall).toFixed(1)} UFOに誘導${avg(x => x.mBait).toFixed(1)}  被弾の内訳 ${JSON.stringify(Object.fromEntries(['beam','laser','drone','missile','hunter'].map(s => [s, +avg(x => x.hurtBy[s] || 0).toFixed(1)])))}`)
  const ranks = RANKS.map(v => rows.filter(x => x.score >= v).length)
  const bw = rows.filter(x => x.cnt.bossAt != null), bd = rows.filter(x => x.cnt.bossSec != null)
  console.log(`         母艦まで来た ${bw.length}/${N}  母艦を倒した ${bd.length}/${N}（来た中 ${bw.length ? Math.round(bd.length / bw.length * 100) : 0}%）  母艦を倒すまで 平均${bd.length ? (bd.reduce((a, x) => a + x.cnt.bossSec, 0) / bd.length).toFixed(1) : '-'}秒 [${bd.map(x => x.cnt.bossSec.toFixed(0)).join(',')}]`)
  console.log(`         判定の境目 ${RANKS.join('/')}（S/A/B/C）以上の数 ${ranks.join('/')} / ${N}`)
}

// 追尾弾だけの試し: node tools/sim.mjs 12 missile（上の通しの後に回る）。40m 先から1発。上手い bot はふり切り、何もしないと当たる
if (process.argv.includes('missile') || !only) {
  const out = {}
  for (const k of ['skilled', 'clumsy', 'idle']) {
    let hit = 0, near = 0, wall = 0
    for (let s = 1; s <= N; s++) {
      const r = createRunner({ id: 'me', spawn: { x: 66, y: 0, z: 862, yaw: Math.PI / 2 } })
      const R = createRaid(world, s, { noAttack: true }); R.phase = 'test'
      const b = createUfoBot(k, s)
      const a = s * 2.4, M = { id: 999, from: -1, x: r.x + Math.sin(a) * 40, y: 30, z: r.z + Math.cos(a) * 40, v: 16, turn: 1.6, t: 0, minD: 1e9, near: false }
      const l = Math.hypot(r.x - M.x, 1 - M.y, r.z - M.z); M.vx = (r.x - M.x) / l * 9; M.vy = (1 - M.y) / l * 9; M.vz = (r.z - M.z) / l * 9
      R.missiles.push(M)
      for (let i = 0; i < 60 * 9 && R.missiles.length; i++) {
        const inp = ufoBotInput(b, r, R, world, dt); r.events.length = 0
        syncRope(R, r); stepRunner(r, inp, dt, world); stepRaid(R, r, dt)
        for (const e of R.events) { if (e.t === 'hurt') hit++; if (e.t === 'near') near++; if (e.t === 'mBoom' && e.wall) wall++ }
        R.events.length = 0
      }
    }
    out[k] = { hit, near, wall }
    console.log(`追尾弾1発 ${k.padEnd(8)} 当たった ${hit}/${N}  すれすれ ${near}  建物に当たった ${wall}`)
  }
}
