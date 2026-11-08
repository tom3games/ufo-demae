import '../mute-auto.mjs'
// fps: 第4波（UFO 5機・攻撃あり）と母艦で、5秒の平均と最悪のフレーム。CPU 4倍遅くした回も。node tools/fps.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname
const PORT = 6419
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--disable-gpu-vsync=false'] })
for (const [cpu, w, h, mob] of [[1, 390, 844, true], [4, 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, deviceScaleFactor: 3, locale: 'ja-JP' }); await muteContext(ctx)
  const p = await ctx.newPage()
  await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ufoReady, null, { timeout: 40000 })
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await p.evaluate(() => ufo.start(3)); await p.waitForTimeout(500)
  const out = {}
  for (const scene of ['wave4', 'boss']) {
    await p.evaluate(sc => {
      const R = ufo.R; ufo.dbg.setHp(99)
      // その場面まで進める（bot が戦う）
      const until = sc === 'wave4' ? "ufo.R.wave >= 3 && ufo.R.phase === 'wave' && ufo.R.ufos.length >= 4" : "ufo.R.boss && ufo.R.boss.state === 'fight'"
      for (let i = 0; i < 12; i++) { for (const u of R.ufos) if (u.state === 'fly' && !(sc === 'boss' && R.boss)) u.hp = sc === 'wave4' && R.wave >= 3 ? u.hp : 0; ufo.dbg.stepUntil(`(${until}) || ufo.R.ufos.some(u => u.state === 'fly' && u.hp <= 0)`, 600); for (const u of R.ufos) if (u.state === 'fly' && u.hp <= 0) { u.state = 'gone' } if (new Function('ufo', 'return ' + until)(ufo)) break }
      R.inv = 999
    }, scene)
    const r = await p.evaluate(() => new Promise(res => { const ts = []; let last = performance.now(); const t0 = last; function f() { const n = performance.now(); ts.push(n - last); last = n; if (n - t0 < 5000) requestAnimationFrame(f); else res(ts) } requestAnimationFrame(f) }))
    const avg = 1000 / (r.reduce((a, x) => a + x, 0) / r.length), worst = Math.max(...r.slice(5))
    const info = await p.evaluate(() => ({ ufos: ufo.R.ufos.filter(u => u.state === 'fly').length, calls: ufo.renderer.info.render.calls, tris: ufo.renderer.info.render.triangles, wave: ufo.R.wave, boss: !!ufo.R.boss }))
    out[scene] = { fps: Math.round(avg), worstMs: Math.round(worst), ...info }
  }
  console.log(`CPU x${cpu} ${w}x${h}`, JSON.stringify(out))
  await ctx.close()
}
await b.close(); server.kill()
