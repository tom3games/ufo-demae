// SNS 用の画像 og.png（1200x630）。焼けた街で UFO に体当たりする瞬間＋題字。node og.mjs
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
  Object.assign(u, { x: 74, y: 17, z: 866, vx: 0, vy: 0, vz: 0, spin: 0.6, open: 9, dodgeCd: 99 }); u.atkCd = 99; u.hp = 9
  const u2 = ufo.R.ufos[1]; Object.assign(u2, { x: 98, y: 27, z: 850, frozen: true }); u2.atkCd = 99
  Object.assign(me, { x: 70.6, y: 13.6, z: 867.2, vx: 26, vy: 9, vz: -3, grounded: false, yaw: Math.PI / 2 })
  me.rope = { x: u.x, y: u.y, z: u.z, len: 6, t: 0.4, ground: true, ufo: u.id, cap: 30 }
  ufo.dbg.step(1)
})
// 体当たりした直後（火花・光）を撮る
await p.evaluate(CAM => {
  const me = ufo.me
  window.__freeze = true; window.__holdFx = true
  // 迎撃員が UFO の縁に横から突っ込んだ瞬間（UFO は 74,17,866。自分はその左手前）
  const u0 = ufo.R.ufos[0]; Object.assign(u0, { x: 75, y: 18, z: 866, flash: 0.5, wob: 1, spin: 0.3 })
  Object.assign(me, { x: 70.6, y: 16.2, z: 867.4, vx: 24, vy: 4, vz: -2, grounded: false, yaw: 1.65, rope: null })
  ufo.dbg.render(1)
  const c = ufo.camera
  const P = CAM || [64.5, 14.2, 873, 73, 18.5, 864, 50]
  c.position.set(P[0], P[1], P[2]); c.lookAt(P[3], P[4], P[5]); c.fov = P[6]; c.updateProjectionMatrix()
  const X = 72.1, Y = 16.9, Z = 867.2
  for (let i = 0; i < 90; i++) { const a = Math.random() * 6.28, b = Math.random() * 3.14, v = 5 + Math.random() * 12; ufo.fx.emit(X, Y, Z, { vx: Math.cos(a) * Math.sin(b) * v - 4, vy: Math.cos(b) * v, vz: Math.sin(a) * Math.sin(b) * v + 3, life: 0.7, size: 0.7, r: 1, g: 0.8, b: 0.4, a: 1, drag: 1, grav: 6, add: true }) }
  ufo.fx.emit(X, Y, Z, { life: 0.6, size: 9, grow: 3, r: 1, g: 0.85, b: 0.6, a: 0.95, add: true })
  ufo.fx.emit(X, Y, Z, { life: 0.6, size: 4, grow: 2, r: 0.6, g: 1, b: 1, a: 0.9, add: true })
  ufo.dbg.render(2)
  for (const id of ['hud', 'pause', 'title']) document.getElementById(id).classList.add('hidden')
  document.getElementById('hitflash').style.opacity = '.5'
  const d = document.createElement('div')
  d.innerHTML = `<div style="position:fixed;inset:0;z-index:28;background:linear-gradient(90deg,rgba(12,8,12,.82) 0%,rgba(12,8,12,.55) 34%,rgba(12,8,12,0) 58%)"></div>
  <div style="position:fixed;left:52px;top:74px;z-index:30;font-family:'Share Tech Mono',monospace;color:#ff8a3c;font-size:26px;letter-spacing:.3em">侵攻から3日目</div>
  <div style="position:fixed;left:44px;top:118px;z-index:30;font-family:'M PLUS 1p',sans-serif;font-weight:900;color:#f2e9de;font-size:132px;line-height:1;letter-spacing:.04em;text-shadow:0 6px 24px rgba(0,0,0,.85)">廃都迎撃</div>
  <div style="position:fixed;left:52px;top:270px;z-index:30;font-family:'M PLUS 1p',sans-serif;font-weight:800;color:#6ff6ff;font-size:44px;letter-spacing:.3em;text-shadow:0 0 18px rgba(111,246,255,.55),0 2px 8px rgba(0,0,0,.9)">UFOを落とせ</div>
  <div style="position:fixed;left:54px;top:360px;z-index:30;font-family:'BIZ UDPGothic',sans-serif;font-weight:700;color:#e8e0d4;text-shadow:0 2px 10px rgba(0,0,0,.95);font-size:30px;line-height:1.55">焼けた街をワイヤーで飛び、<br>勢いのまま体当たり。<br>追ってくる機体は迎え撃て</div>`
  // 当たった所の光と火花（画面の上に重ねる）
  const P2 = ufo.pointXY(72.1, 16.9, 867.2)
  const rays = Array.from({ length: 18 }, (_, i) => { const a = i / 18 * Math.PI * 2 + (i % 3) * 0.1, r0 = 30, r1 = 90 + (i % 4) * 40; return `<line x1="${(Math.cos(a) * r0).toFixed(0)}" y1="${(Math.sin(a) * r0).toFixed(0)}" x2="${(Math.cos(a) * r1).toFixed(0)}" y2="${(Math.sin(a) * r1).toFixed(0)}" stroke="${i % 2 ? '#ffd27a' : '#ffffff'}" stroke-width="${i % 3 ? 3 : 5}" stroke-linecap="round" opacity=".9"/>` }).join('')
  d.innerHTML += `<div style="position:fixed;left:${P2.x - 150}px;top:${P2.y - 150}px;width:300px;height:300px;z-index:27;background:radial-gradient(circle,rgba(255,250,230,.95) 0%,rgba(255,170,80,.6) 22%,rgba(255,90,40,0) 60%);mix-blend-mode:screen"></div><svg style="position:fixed;left:${P2.x - 200}px;top:${P2.y - 200}px;z-index:27" width="400" height="400" viewBox="-200 -200 400 400">${rays}</svg>`
  document.body.appendChild(d)
}, CAM)
await p.waitForTimeout(700)
await p.screenshot({ path: process.env.OGOUT || 'og.png' })
await b.close(); srv.kill()
console.log('og.png')
