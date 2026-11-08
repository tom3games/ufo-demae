import '../mute-auto.mjs'
// 撮影と目視用: node tools/shot.mjs。場面を台本どおりに進めて shots/s-*.png に撮る
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname
mkdirSync(ROOT + 'shots', { recursive: true })
const PORT = 6418
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP', deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()) })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ufoReady, null, { timeout: 40000 })
await p.waitForTimeout(1500)
await p.screenshot({ path: ROOT + 'shots/s-title.png' })
await p.tap('#btnStart'); await p.waitForFunction(() => ufo.R.phase === 'wave' && ufo.R.ufos.length >= 2); await p.waitForTimeout(2500)
await p.screenshot({ path: ROOT + 'shots/s-wave1.png' })
const shot = async (name, fn, arg) => { await p.evaluate(fn, arg); await p.waitForTimeout(250); await p.screenshot({ path: ROOT + `shots/s-${name}.png` }) }
const base = `ufo.dbg.pause(true); ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.cam.pitch = 0.08; ufo.R.inv = 99; ufo.dbg.clearUfos();`
// 吸い上げ光線の予告
await shot('beam', new Function(base + `const u = ufo.R.ufos[0]; u.frozen = false; ufo.dbg.placeUfo(u.id, 14, 16, 3); u.atkCd = 0; u.atk = null; ufo.dbg.stepUntil('ufo.R.beams.length > 0', 300); ufo.dbg.step(40); ufo.dbg.render(30)`))
// レーザーの予告（大型）
await shot('laser', new Function(base + `ufo.R.beams.length = 0; const u = ufo.R.ufos[1]; u.kind = 'big'; u.frozen = false; u.r = 5.2; ufo.dbg.placeUfo(u.id, 30, 20, -6); ufo.R.lasers.push({ id: 777, ufo: u.id, ax: 66, az: 852, bx: 70, bz: 884, gy: 0, t: 0.5, phase: 'warn' }); ufo.dbg.step(1); ufo.dbg.render(30)`))
// 追尾弾の照準と飛んでいる弾
await shot('missile', new Function(base + `ufo.R.lasers.length = 0; const u = ufo.R.ufos[0]; u.frozen = false; ufo.dbg.placeUfo(u.id, 40, 26, 8); u.atk = 'missile'; u.charge = 0.4; ufo.dbg.stepUntil('ufo.R.missiles.length > 0', 100); ufo.dbg.step(40); ufo.dbg.render(20)`))
// 体当たりで落とした直後（落ちていく UFO と点）
await shot('down', new Function(base + `ufo.R.missiles.length = 0; const u = ufo.R.ufos[0]; u.frozen = false; ufo.dbg.placeUfo(u.id, 16, 12, 0); u.hp = 1; u.open = 9; u.dodgeCd = 99; ufo.dbg.hook(u.id); ufo.dbg.stepUntil("ufo.log.some(e => e.t === 'down')", 300); ufo.dbg.step(20); ufo.dbg.render(10)`))
// 母艦
await shot('boss', () => { ufo.start(5); ufo.dbg.pause(true); ufo.dbg.setHp(99); const R = ufo.R; for (let i = 0; i < 10 && !R.boss; i++) { for (const u of R.ufos) if (u.state === 'fly') { u.state = 'gone' } ufo.dbg.stepUntil('ufo.R.boss || ufo.R.phase === "wave" && ufo.R.ufos.some(u => u.state === "fly")', 1500) } ufo.dbg.stepUntil("ufo.R.boss && ufo.R.boss.state === 'fight'", 900); ufo.dbg.teleport(60, 0, 866); ufo.cam.hd = Math.atan2(ufo.R.boss.x - 60, ufo.R.boss.z - 866); ufo.cam.pitch = -0.35; ufo.R.inv = 99; ufo.dbg.step(30); ufo.dbg.render(40) })
// 芯
await shot('core', () => { const B = ufo.R.boss; for (const p of B.pods) { p.hp = 0; p.state = 'gone' } ufo.dbg.stepUntil("ufo.R.boss.core && ufo.R.boss.core.y < 34", 600); ufo.dbg.teleport(60, 0, 866); ufo.cam.hd = Math.atan2(B.x - 60, B.z - 866); ufo.cam.pitch = -0.35; ufo.dbg.step(20); ufo.dbg.render(30) })
// 電池が尽きて回収される
await shot('taken', () => { ufo.start(9); ufo.dbg.pause(true); ufo.dbg.stepUntil("ufo.R.ufos.length >= 2 && ufo.R.phase === 'wave'", 600); ufo.dbg.setHp(1); ufo.R.inv = 0; const u = ufo.R.ufos[0]; u.frozen = true; u.x = ufo.me.x + 3; u.z = ufo.me.z; u.y = 22; ufo.R.beams.push({ id: 1, ufo: u.id, x: ufo.me.x, z: ufo.me.z, gy: 0, r: 5, t: 0, phase: 'on' }); ufo.dbg.step(100); ufo.dbg.render(30) })
// 街の見回し（雰囲気を見る）: 屋上から広場
await shot('city', () => { ufo.start(3); ufo.dbg.pause(true); ufo.dbg.teleport(40, 0, 850); ufo.cam.hd = 1.2; ufo.cam.pitch = 0.25; ufo.dbg.step(10); ufo.dbg.render(60) })
await shot('city2', () => { ufo.dbg.teleport(90, 0, 900); ufo.cam.hd = -2.4; ufo.cam.pitch = 0.1; ufo.dbg.step(10); ufo.dbg.render(60) })
// 結果（作戦報告書）: 少し戦ってから回収される
await shot('result', () => { ufo.start(21); ufo.dbg.pause(true); const R = ufo.R; ufo.dbg.stepUntil("ufo.R.phase === 'wave' && ufo.R.ufos.length >= 2", 600); R.inv = 99; for (let i = 0; i < 3; i++) { const u = R.ufos.find(q => q.state === 'fly'); if (!u) break; u.frozen = false; ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.dbg.placeUfo(u.id, 16, 10, 0); u.hp = 1; u.open = 9; u.dodgeCd = 99; ufo.dbg.hook(u.id); ufo.dbg.stepUntil("ufo.log.filter(e => e.t === 'down').length > " + i, 300); ufo.dbg.step(30) } R.inv = 0; ufo.dbg.setHp(1); ufo.dbg.stepUntil('ufo.R.over', 60 * 90); ufo.dbg.render(120) })
// 追跡機に追われる（後ろから来る・画面の縁の矢印）
await shot('hunter', () => { ufo.start(4); ufo.dbg.pause(true); ufo.dbg.stepUntil("ufo.R.phase === 'wave'", 600); ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.R.inv = 99; ufo.dbg.clearUfos(); ufo.dbg.spawn('hunter', 60 + 14, 7, 866 + 6, { hunt: 'chase' }); ufo.dbg.spawn('hunter', 60 - 30, 8, 866, { hunt: 'chase', side: 1 }); ufo.dbg.step(20); ufo.dbg.render(10) })
console.log(errs.join('\n') || 'no errors')
await b.close(); server.kill()
