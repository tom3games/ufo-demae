// SNS 用の画像 og.png（1200x630）。ラーメンをすする UFO に体当たりする瞬間＋暖簾のタイトル。node og.mjs
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { muteContext, MUTE_LAUNCH } from './mute.mjs'
const PORT = 6421
const srv = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal'] })
const ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 1200, height: 630 } }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ufoReady, null, { timeout: 40000 })
await p.evaluate(() => ufo.start(11)); await p.waitForFunction(() => ufo.R.phase === 'wave' && ufo.R.ufos.length >= 2, null, { timeout: 15000 })
const CAM = JSON.parse(process.env.OGCAM || 'null')
await p.evaluate(() => {
  ufo.dbg.pause(true)
  const me = ufo.me
  ufo.dbg.teleport(60, 0, 866, Math.PI / 2)
  ufo.cam.hd = Math.PI / 2
  for (const u of ufo.R.ufos) { u.x += 400; u.frozen = true }
  const u = ufo.R.ufos[0]; u.frozen = true
  Object.assign(u, { x: 74, y: 17, z: 866, vx: 0, vy: 0, vz: 0, spin: 0.6 }); u.bowl.left = 64; u.atkCd = 99; u.hp = 9
  const u2 = ufo.R.ufos[1]; Object.assign(u2, { x: 98, y: 27, z: 850, frozen: true }); u2.atkCd = 99
  Object.assign(me, { x: 70.6, y: 13.6, z: 867.2, vx: 26, vy: 9, vz: -3, grounded: false, yaw: Math.PI / 2 })
  me.rope = { x: u.x, y: u.y, z: u.z, len: 6, t: 0.4, ground: true, ufo: u.id, cap: 30 }
  ufo.dbg.step(1)
})
// 体当たりした直後（火花・光）を撮る
await p.evaluate(CAM => {
  const me = ufo.me
  ufo.dbg.stepUntil("ufo.log.some(e => e.t === 'ram')", 120)
  window.__freeze = true; window.__holdFx = true
  Object.assign(me, { x: 70.9, y: 15.4, z: 866.6, vx: 20, vy: 2, vz: 0 }); const u0 = ufo.R.ufos[0]; me.rope = { x: u0.x, y: u0.y, z: u0.z, len: 4, t: 0.4, ground: true, ufo: u0.id, cap: 30 }; ufo.flashA = 0
  const c = ufo.camera
  const P = CAM || [62, 19.5, 877.5, 72.5, 15.5, 865, 46]
  c.position.set(P[0], P[1], P[2]); c.lookAt(P[3], P[4], P[5]); c.fov = P[6]; c.updateProjectionMatrix()
  ufo.R.ufos[0].flash = 0
  for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, b = Math.random() * 3.14, v = 4 + Math.random() * 10; ufo.fx.emit(71.2, 16.3, 867.4, { vx: Math.cos(a) * Math.sin(b) * v, vy: Math.cos(b) * v, vz: Math.sin(a) * Math.sin(b) * v, life: 0.6, size: 0.9, r: 1, g: 0.85, b: 0.4, a: 1, drag: 1, grav: 6, add: true }) }
  ufo.fx.emit(71.2, 16.3, 867.4, { life: 0.5, size: 7, grow: 4, r: 1, g: 0.9, b: 0.6, a: 0.95, add: true })
  ufo.dbg.render(2)
  for (const id of ['hud', 'pause', 'title']) document.getElementById(id).classList.add('hidden')
  document.getElementById('hitflash').style.opacity = '.5'
  const d = document.createElement('div')
  d.innerHTML = `<div style="position:fixed;left:40px;top:0;display:flex;gap:6px;height:236px;z-index:30">${['空', '中', '出', '前'].map(c => `<div style="width:80px;background:#1f2a44;display:flex;justify-content:center;padding-top:44px;box-shadow:inset 0 -20px 30px rgba(0,0,0,.25)"><span style="font-family:'Yuji Syuku',serif;color:#f6f1e4;font-size:64px;line-height:1">${c}</span></div>`).join('')}</div>
  <div style="position:fixed;left:40px;top:252px;z-index:30;font-family:'Yuji Syuku',serif;color:#ffe066;font-size:96px;line-height:1;-webkit-text-stroke:3px #3a1a00;text-shadow:0 6px 18px rgba(0,0,0,.7);letter-spacing:.04em">UFO襲来</div>
  <div style="position:fixed;left:44px;top:378px;z-index:30;font-family:'Klee One',sans-serif;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.9);font-size:34px;line-height:1.4">ラーメンをすするUFOに<br>ワイヤーで体当たり。<br>丼を取り返せ</div>`
  const P2 = ufo.pointXY(71.0, 16.0, 867.2)
  const pts = Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2, r = i % 2 ? 46 : 92; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r * 0.8).toFixed(1)}` }).join(' ')
  d.innerHTML += `<svg style="position:fixed;left:${P2.x - 150}px;top:${P2.y - 150}px;z-index:29" width="150" height="130" viewBox="-110 -95 220 190"><polygon points="${pts}" fill="#ffe066" stroke="#3a1a00" stroke-width="5" stroke-linejoin="round"/><text x="0" y="16" text-anchor="middle" font-family="Yuji Syuku, serif" font-size="50" fill="#b8211a">ドン</text></svg>`
  document.body.appendChild(d)
}, CAM)
await p.waitForTimeout(700)
await p.screenshot({ path: process.env.OGOUT || 'og.png' })
await b.close(); srv.kill()
console.log('og.png')
