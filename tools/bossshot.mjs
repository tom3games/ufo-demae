import '../mute-auto.mjs'
// 母艦の動きを撮る: node tools/bossshot.mjs（スマホ縦3サイズ・動いている所と攻撃の前に傾いた所）。shots/s-boss-<幅>-<場面>.png
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname
mkdirSync(ROOT + 'shots', { recursive: true })
const PORT = Number(process.env.VPORT || 6422)
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal'] })
const out = []
for (const [w, h] of [[360, 640], [390, 844], [430, 932]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'ja-JP', deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await muteContext(ctx)
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()) })
  await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ufoReady, null, { timeout: 40000 })
  await p.tap('#btnStart'); await p.waitForFunction(() => ufo.R && ufo.R.phase === 'wave')
  await p.evaluate(() => { ufo.dbg.pause(true); ufo.dbg.setHp(99); ufo.R.inv = 1e9; ufo.dbg.clearUfos(); ufo.R.wave = ufo.WAVES.length - 1; ufo.R.phase = 'between'; ufo.R.phaseT = 99; ufo.dbg.stepUntil("ufo.R.boss && ufo.R.boss.state === 'fight'", 900) })
  const view = () => p.evaluate(() => { const B = ufo.R.boss; ufo.R.inv = 1e9; ufo.dbg.teleport(B.x - 40, 0, B.z - 20); ufo.cam.hd = Math.atan2(B.x - ufo.me.x, B.z - ufo.me.z); ufo.cam.pitch = -0.4; ufo.dbg.render(20); const v = ufo.camera; const q = { x: B.x, y: B.y, z: B.z }; return { B: [Math.round(B.x), Math.round(B.z)], v: +Math.hypot(B.vx, B.vz).toFixed(1), windup: !!B.windup } })
  await p.evaluate(() => { const B = ufo.R.boss; ufo.dbg.stepUntil('Math.hypot(ufo.R.boss.vx, ufo.R.boss.vz) > 3.5', 1200) })
  const m = await view(); await p.screenshot({ path: ROOT + `shots/s-boss-${w}-move.png` })
  await p.evaluate(() => { ufo.dbg.stepUntil('ufo.R.boss.windup && ufo.R.boss.atkCd < 0.4', 1200) })
  const wu = await view(); await p.screenshot({ path: ROOT + `shots/s-boss-${w}-windup.png` })
  // 画面に母艦が収まっているか（真ん中と縁の砲台を画面座標で）
  const inView = await p.evaluate(() => { const B = ufo.R.boss, c = ufo.camera; c.updateMatrixWorld(); const pts = [[B.x, B.y, B.z], ...B.pods.map(q => [q.x, q.y, q.z])]; return pts.map(([x, y, z]) => { const v = new c.position.constructor(x, y, z).project(c); return Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1 }) })
  out.push({ w, h, move: m, windup: wu, inView, errs })
  await ctx.close()
}
console.log(JSON.stringify(out, null, 1))
await b.close(); server.kill()
