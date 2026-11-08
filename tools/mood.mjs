import '../mute-auto.mjs'
// 雰囲気の確認用: 自由なカメラで街を撮る。node tools/mood.mjs [出力dir]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const ROOT = new URL('..', import.meta.url).pathname, OUT = process.argv[2] || ROOT + 'shots'
const PORT = 6419
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP', deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()) })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__ufoReady, null, { timeout: 40000 })
await p.waitForTimeout(4000)   // 画像が届くまで
await p.evaluate(() => { ufo.start(3); ufo.dbg.pause(true); ufo.dbg.stepUntil("ufo.R.phase === 'wave'", 600); ufo.dbg.step(200); document.getElementById('hud').classList.add('hidden') })
const cams = { high: [10, 46, 820, 90, 18, 880, 70], street: [44, 3, 830, 80, 8, 900, 75], wide: [-20, 30, 760, 120, 10, 900, 70] }
for (const [n, c] of Object.entries(cams)) {
  await p.evaluate(c => { window.__freeze = true; const k = ufo.camera; k.position.set(c[0], c[1], c[2]); k.lookAt(c[3], c[4], c[5]); k.fov = c[6]; k.updateProjectionMatrix(); ufo.dbg.render(20) }, c)
  await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/mood-${n}.png` })
}
const info = await p.evaluate(() => ({ calls: ufo.renderer.info.render.calls, tris: ufo.renderer.info.render.triangles }))
console.log(JSON.stringify(info), errs.join('\n') || 'no errors')
await b.close(); server.kill()
