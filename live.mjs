import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = 'https://tom3games.github.io/ufo-demae/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? { ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal'] } : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__ufoReady, null, { timeout: 15000 })
  // 遊びの通し: 始める → 空中で速い時に UFO を本物の指・マウスで押して突撃 → 何もせず回収されて報告書
  if (opts.hasTouch) await p.tap('#btnStart'); else await p.click('#btnStart')
  await p.waitForFunction(() => ufo.R.phase === 'wave' && ufo.R.ufos.length >= 2, null, { timeout: 15000 })
  const s = await p.evaluate(() => { ufo.dbg.pause(true); ufo.dbg.clearUfos(); const u = ufo.R.ufos[0]; u.frozen = false; ufo.dbg.placeUfo(u.id, 16, 9, 0); u.atkCd = 99; ufo.me.y = 7; ufo.me.grounded = false; ufo.me.vx = Math.sin(ufo.cam.hd) * 20; ufo.me.vz = Math.cos(ufo.cam.hd) * 20; ufo.R.dashReady = true; ufo.R.inv = 99; ufo.dbg.render(3); return { id: u.id, xy: ufo.ufoXY(u.id) } })
  if (opts.hasTouch) await p.touchscreen.tap(s.xy.x, s.xy.y); else await p.mouse.click(s.xy.x, s.xy.y)
  const flow = await p.evaluate(id => {
    ufo.dbg.step(1); const hooked = ufo.log.some(e => e.t === 'dash' && e.id === id)
    const ram = ufo.dbg.stepUntil("ufo.log.some(e => e.t === 'ram')", 400) > 0
    if (!hooked || !ram) throw new Error('hook/ram failed ' + JSON.stringify({ hooked, ram }))
    ufo.start(42); ufo.dbg.pause(true); ufo.dbg.stepUntil('ufo.R.over', 60 * 120); ufo.dbg.render(120)
    return { hooked, ram, end: ufo.R.end }
  }, s.id)
  await p.waitForTimeout(1000)
  const res = await p.evaluate(() => ({ mode: ufo.mode, score: window.__lastScore, support: document.getElementById('tmSupport')?.textContent, mute: window.__muteOk() }))
  out.push(`${name}: flow=${JSON.stringify(flow)} result=${JSON.stringify(res)}`)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/ufo-demae', 'https://github.com/tom3games/ufo-demae/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} owner=${OWNER && (await p.content()).toLowerCase().includes(OWNER) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
