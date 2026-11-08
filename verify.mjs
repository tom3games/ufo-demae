import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
// 検証: node verify.mjs（Chromium と WebKit。本物のマウス・指で UFO とビルを押す）
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, statSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const ROOT = import.meta.dirname
execFileSync(process.execPath, ['tools/build.mjs'], { cwd: ROOT, stdio: 'inherit' })   // 公開するのは1つにまとめた dist/game.js。先に作り直す
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 6417
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
  if (process.env.LIVE) console.log(results[results.length - 1])
}
const expect = (c, msg) => { if (!c) throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)) }
async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED/.test(m.text())) p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)|googletagmanager/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__ufoReady, null, { timeout: 40000 })
  // 検証用: 空中で速さ v のまま UFO へ当たりに行く（ビルで振った勢いの代わり）。毎歩速さを保つ
  await p.evaluate(() => { window.__ramAt = (u, v, from = 'front') => {
    const fx = Math.sin(ufo.cam.hd), fz = Math.cos(ufo.cam.hd), me = ufo.me
    me.rope = null; me.climbing = null; me.stun = 0
    me.x = u.x - fx * 7; me.z = u.z - fz * 7; me.y = u.y - 1; me.grounded = false
    const n0 = ufo.log.length
    for (let i = 0; i < 90; i++) { const dx = u.x - me.x, dy = u.y - 1 - me.y, dz = u.z - me.z, l = Math.hypot(dx, dy, dz) || 1; me.vx = dx / l * v; me.vy = dy / l * v; me.vz = dz / l * v; me.grounded = false; ufo.dbg.step(1); const e = ufo.log.slice(n0).find(e => e.t === 'ram' || e.t === 'boing' || (e.t === 'hurt')); if (e) return e }
    return null
  } })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('section:not(.hidden) *')) {
    if (el.closest('.hidden') || el.closest('.tags') || el.closest('#lock') || el.closest('#miss') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, W = innerWidth, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('section:not(.hidden) button, section:not(.hidden) a, section:not(.hidden) canvas, #tmSupport')) {
    if (!el.offsetParent || el.closest('.hidden')) continue
    const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom))
  }
  return { H, over: over.slice(0, 6) }
})
// 2つの要素が重なっているか（HUD の札どうし）
const overlap = (q, a, b) => q.evaluate(([a, b]) => { const A = document.querySelector(a).getBoundingClientRect(), B = document.querySelector(b).getBoundingClientRect(); return !(A.right <= B.left || B.right <= A.left || A.bottom <= B.top || B.bottom <= A.top) }, [a, b])
const variance = (p, sel) => p.evaluate(sel => {
  const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 13) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
}, sel)
// 遊び中を止めて、目の前に UFO を置き、画面の座標を返す
const setupUfo = (p, dist = 22, up = 9) => p.evaluate(([dist, up]) => {
  ufo.dbg.pause(true)
  ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.R.taken = null; ufo.R.inv = 99
  ufo.dbg.clearUfos()
  const u = ufo.R.ufos.find(q => q.state === 'fly'); u.frozen = false
  const id = ufo.dbg.placeUfo(u.id, dist, up, 0); u.atkCd = 99; u.open = 30; u.dodgeCd = 99   // 撃った直後（シールドが開いている）にする
  ufo.dbg.step(2); ufo.dbg.render(30)   // 前のワイヤーの押しっぱなしを離す（runner は押した瞬間だけ見る）
  return { id, xy: ufo.ufoXY(id), hp: u.hp }
}, [dist, up])

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', r); return r
})
await t('OGP 一式がある・og.png が 1200x630 で取れる', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => document.querySelector(`meta[property="${k}"]`)?.content || '').concat(document.querySelector('meta[name="twitter:card"]')?.content || ''))
  expect(r.every(Boolean) && /ufo-demae\/og\.png/.test(r[2]) && /ufo-demae\/$/.test(r[3]), r)
  const res = await p.request.get(URL0 + 'og.png'); expect(res.status() === 200, res.status())
  const b = await res.body(); expect(b.readUInt32BE(16) === 1200 && b.readUInt32BE(20) === 630, [b.readUInt32BE(16), b.readUInt32BE(20)])
})
await t('ラーメン・丼・出前の文字が画面と文言に残っていない', async () => {
  const s = await p.evaluate(() => document.body.innerText + document.title + [...document.querySelectorAll('meta')].map(m => m.content || '').join(' '))
  const src = readFileSync(ROOT + '/js/game.js', 'utf8').split('const T = {')[1].split('let lang')[0] + readFileSync(ROOT + '/js/facade.js', 'utf8').match(/text\('[^']*'/g).join(' ') + readFileSync(ROOT + '/js/ruin.js', 'utf8').match(/\['[^\]]*'\]/g).join(' ')
  const bad = (s + src).match(/.{0,12}(ラーメン|丼|出前|宙吊軒|麺|すす|ramen|noodle|bowl|slurp|delivery|宇宙人|店主).{0,12}/gi)
  expect(!bad, bad); return true
})
await t('使う文字だけのフォントの読み込みが最新（足りない字がない）', async () => {
  const { fontHref } = await import('./tools/fontlink.mjs')
  const h = readFileSync(ROOT + '/index.html', 'utf8'), m = h.match(/<link id="gfonts" href="([^"]+)"[^>]*>/)
  expect(m && m[1].replace(/&amp;/g, '&') === fontHref() && /media="print"/.test(m[0]), 'node tools/fontlink.mjs を回す'); return { chars: decodeURIComponent(fontHref().split('text=')[1]).length }
})
await t('画面に「AI」「画像生成」が出ない', async () => { const s = await p.evaluate(() => document.body.innerText + JSON.stringify([...document.querySelectorAll('[data-t]')].map(e => e.textContent))); expect(!/\bAI\b|画像生成/.test(s), s.match(/.{0,20}(AI|画像生成).{0,20}/)) })
await t('廃都の見た目が入っている（墜ちた UFO・煙の柱・瓦礫）。描画回数が多すぎない', async () => { const r = await p.evaluate(() => ({ wrecks: ufo.ruin.wrecks.length, fires: ufo.ruin.fires.length, calls: ufo.renderer.info.render.calls })); expect(r.wrecks >= 2 && r.fires >= 8 && r.calls < 260, r); return r })
await t('タイトルの後ろで CPU が UFO と戦っている（デモ）', async () => { await p.waitForTimeout(4000); const r = await p.evaluate(() => ({ t: ufo.R.t, ufos: ufo.R.ufos.length })); expect(r.t > 1 && r.ufos > 0, r); return r })
await p.screenshot({ path: ROOT + '/shots/v-title.png' })
await t('遊び方を開いて閉じられる', async () => { await p.click('#btnHow'); const n = await p.locator('#howList li').count(); await p.screenshot({ path: ROOT + '/shots/v-how.png' }); await p.click('#how [data-close]'); expect(n === 4, n) })

// ---- 遊び: 本物のマウスで UFO を押す
await p.click('#btnStart')
await p.waitForFunction(() => ufo.R.phase === 'wave' && ufo.R.ufos.length >= 2, null, { timeout: 15000 })
await t('始めると第1波の UFO が出る（丼は持っていない）', async () => { const r = await p.evaluate(() => ufo.R.ufos.map(u => ({ k: u.kind, bowl: 'bowl' in u, y: Math.round(u.y) }))); expect(r.length >= 2 && r.every(u => !u.bowl), r); return r })
await t('シールドが開いた UFO をクリックすると引っかかって引き寄せられ、体当たりで体力が減る', async () => {
  const s = await setupUfo(p)
  expect(s.xy && s.xy.z < 1 && s.xy.x > 0 && s.xy.x < 390 && s.xy.y > 0 && s.xy.y < 844, s)
  await p.mouse.click(s.xy.x, s.xy.y)
  const hooked = await p.evaluate(() => { ufo.dbg.step(1); return ufo.me.rope && ufo.me.rope.ufo })
  expect(hooked === s.id, { hooked, s })
  const n = await p.evaluate(() => ufo.dbg.stepUntil("ufo.log.some(e => e.t === 'ram')", 400))
  const r = await p.evaluate(id => ({ ram: ufo.log.find(e => e.t === 'ram'), hp: (ufo.R.ufos.find(u => u.id === id) || {}).hp, flash: ufo.flashA }), s.id)
  expect(n > 0 && r.ram.dmg >= 1 && (r.hp == null || r.hp < s.hp), r)
  await p.evaluate(() => ufo.dbg.render(2)); await p.screenshot({ path: ROOT + '/shots/v-ram.png' })
  return { steps: n, v: Math.round(r.ram.v), dmg: r.ram.dmg }
})
await t('ビルをクリックするとビルにワイヤーが掛かる（UFO ではない）', async () => {
  const a = await p.evaluate(() => { ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.dbg.clearUfos(); ufo.dbg.render(30); return ufo.dbg.screenAnchor() })
  expect(a && a.x > 0 && a.x < 390 && a.y > 0 && a.y < 844, a)
  await p.mouse.click(a.x, a.y)
  const r = await p.evaluate(() => { ufo.dbg.step(2); return ufo.me.rope && { ufo: ufo.me.rope.ufo ?? null } })
  expect(r && r.ufo === null, r); return { x: Math.round(a.x), y: Math.round(a.y) }
})
await t('シールドを張った遠くの UFO をクリックしても弾かれて掛からない', async () => {
  const s = await setupUfo(p, 20, 8)
  await p.evaluate(id => { const u = ufo.R.ufos.find(q => q.id === id); u.open = 0 }, s.id)
  await p.mouse.click(s.xy.x, s.xy.y)
  const r = await p.evaluate(() => { ufo.dbg.step(3); return { rope: ufo.me.rope ? ufo.me.rope.ufo ?? 'building' : null, deflect: ufo.log.some(e => e.t === 'deflect') } })
  expect(r.rope == null && r.deflect, r); return r
})
await t('引き寄せだけの体当たりはシールドに弾かれる（ビルで振った勢いが要る）', async () => {
  const s = await setupUfo(p, 9, 3)
  const r = await p.evaluate(id => { const u = ufo.R.ufos.find(q => q.id === id); u.open = 0; u.hp = 3; const n0 = ufo.log.length; ufo.dbg.hook(id); ufo.dbg.stepUntil("ufo.log.slice(" + n0 + ").some(e => e.t === 'ram' || e.t === 'boing')", 300); const e = ufo.log.slice(n0).find(e => e.t === 'ram' || e.t === 'boing'); return { t: e && e.t, v: e && Math.round(e.v), hp: u.hp } }, s.id)
  expect(r.t === 'boing' && r.hp === 3, r); return r
})
await t('速く当たればシールドを破れる（25m/s で1以上）', async () => {
  const s = await setupUfo(p, 8, 1.5)
  const r = await p.evaluate(id => { const u = ufo.R.ufos.find(q => q.id === id); u.open = 0; u.hp = 3; u.dodgeCd = 99; const e = window.__ramAt(u, 25); return { t: e && e.t, dmg: e && e.dmg, v: e && Math.round(e.v) } }, s.id)
  expect(r.t === 'ram' && r.dmg >= 1, r); return r
})
await t('E（大きいボタンと同じ）は UFO ではなくビルに掛かる', async () => {
  const s = await setupUfo(p, 30, 12)
  await p.keyboard.down('KeyE'); await p.keyboard.up('KeyE')
  const r = await p.evaluate(() => { ufo.dbg.step(2); return ufo.me.rope && { ufo: ufo.me.rope.ufo ?? null } })
  expect(r && r.ufo === null, { r, s }); return r
})
await t('掛けたままだと UFO が暴れて、電撃でワイヤーを切られる', async () => {
  const s = await setupUfo(p, 30, 14)
  const r = await p.evaluate(id => { const u = ufo.R.ufos.find(q => q.id === id); u.frozen = false; u.x += 0; ufo.dbg.hook(id); ufo.dbg.step(1); const hooked = ufo.me.rope && ufo.me.rope.ufo === id; ufo.me.rope && (ufo.me.rope.t = -9); for (let i = 0; i < 200; i++) { ufo.dbg.step(1); if (ufo.me.rope) ufo.me.rope.t = Math.min(ufo.me.rope.t, 0); if (ufo.log.some(e => e.t === 'zapCut')) break } return { hooked, cut: ufo.log.some(e => e.t === 'zapCut') } }, s.id)
  expect(r.hooked && r.cut, r); return r
})
await t('追跡機: 止まっていると追いつかれて当たる', async () => {
  const r = await p.evaluate(() => {
    ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.dbg.clearUfos(); ufo.R.inv = 0; ufo.R.taken = null
    const u = ufo.dbg.spawn('hunter', 60 - 35, 14, 866)
    const hp = ufo.R.hp, n = ufo.dbg.stepUntil("ufo.log.some(e => e.t === 'hurt' && e.src === 'hunter')", 60 * 12)
    return { n, hp, after: ufo.R.hp, lunge: ufo.log.some(e => e.t === 'lunge') }
  })
  expect(r.n > 0 && r.after === r.hp - 1 && r.lunge, r); return r
})
await t('追跡機: 向き直って正面から当たると迎え撃ちで落とせる', async () => {
  const r = await p.evaluate(() => {
    ufo.dbg.teleport(60, 12, 866, Math.PI / 2); ufo.dbg.clearUfos(); ufo.R.inv = 99
    const u = ufo.dbg.spawn('hunter', 60 + 20, 13, 866, { hunt: 'chase', vx: -14 })
    // 自分は 16m/s で向かう（追跡機は 14m/s で来る）
    const n0 = ufo.log.length
    for (let i = 0; i < 200; i++) { const dx = u.x - ufo.me.x, dy = u.y - 1 - ufo.me.y, dz = u.z - ufo.me.z, l = Math.hypot(dx, dy, dz) || 1; Object.assign(ufo.me, { vx: dx / l * 16, vy: dy / l * 16, vz: dz / l * 16, grounded: false }); ufo.dbg.step(1); if (ufo.log.slice(n0).some(e => e.t === 'ram' || e.t === 'hurt')) break }
    const e = ufo.log.slice(n0).find(e => e.t === 'ram' || e.t === 'hurt'); return { t: e && e.t, counter: e && e.counter, dmg: e && e.dmg, v: e && Math.round(e.v) }
  })
  expect(r.t === 'ram' && r.counter && r.dmg >= 1, r); return r
})
await t('着地せずに続けて当てると連鎖と倍率が上がり、着地すると切れる', async () => {
  const r = await p.evaluate(() => {
    ufo.dbg.pause(true); ufo.dbg.teleport(60, 12, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.R.inv = 99; ufo.dbg.clearUfos()
    ufo.R.chain = 0; ufo.R.mult = 1
    const hits = []
    for (let i = 0; i < 4; i++) {
      const u = ufo.R.ufos.find(q => q.state === 'fly'); if (!u) break
      u.frozen = true; u.hp = 99; u.open = 30; u.dodgeCd = 99; u.atkCd = 99; u.hitCd = 0
      u.x = ufo.me.x + 10; u.z = ufo.me.z; u.y = 14
      const e = window.__ramAt(u, 22); hits.push([e && e.t, ufo.R.chain, ufo.R.mult])
      for (let k = 0; k < 10; k++) { ufo.me.y = Math.max(ufo.me.y, 12); ufo.me.grounded = false; ufo.dbg.step(1) }
    }
    const top = { chain: ufo.R.chain, mult: ufo.R.mult }
    ufo.dbg.teleport(ufo.me.x, 0, ufo.me.z); ufo.dbg.step(60)
    return { hits, top, after: { chain: ufo.R.chain, mult: ufo.R.mult } }
  })
  expect(r.top.chain >= 3 && r.top.mult >= 1.5 && r.after.chain === 0 && r.after.mult === 1, r); return r
})
const FRESH = `ufo.start(11); ufo.dbg.pause(true); ufo.dbg.stepUntil("ufo.R.phase === 'wave' && ufo.R.ufos.length >= 2", 600);`
await t('焼却光線: 足元の輪が先に出て、動かないと焼かれて電池が1本減る', async () => {
  const r = await p.evaluate(new Function(FRESH + 'return 0')).then(() => p.evaluate(() => {
    ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.dbg.clearUfos(); ufo.R.inv = 0
    const u = ufo.R.ufos.find(q => q.state === 'fly'); u.frozen = false
    ufo.dbg.placeUfo(u.id, 12, 18, 0); u.atkCd = 0; u.atk = null
    const box = ufo.R.hp
    const nw = ufo.dbg.stepUntil("ufo.R.beams.length > 0", 200)
    const warnFirst = ufo.R.beams[0] && ufo.R.beams[0].phase
    ufo.dbg.render(3)
    const n = ufo.dbg.stepUntil("ufo.log.some(e => e.t === 'hurt' && e.src === 'beam')", 300)
    return { nw, warnFirst, n, box, after: ufo.R.hp }
  }))
  expect(r.nw > 0 && r.warnFirst === 'warn' && r.n > 0 && r.after === r.box - 1, r); return r
})
await t('焼却光線: 輪から走って出ればよけられる', async () => {
  await p.evaluate(new Function(FRESH + 'return 0'))
  const r = await p.evaluate(() => {
    ufo.R.inv = 0
    ufo.dbg.teleport(ufo.me.x, 0, ufo.me.z); ufo.dbg.clearUfos()
    const u = ufo.R.ufos.find(q => q.state === 'fly'); u.frozen = false
    ufo.dbg.placeUfo(u.id, 12, 18, 0); u.atkCd = 0; u.atk = null
    const box = ufo.R.hp
    ufo.dbg.stepUntil("ufo.R.beams.length > 0", 200)
    ufo.me.yaw = -Math.PI / 2; ufo.dbg.keys.add('KeyW')   // UFO と反対へ走って逃げる
    ufo.dbg.stepUntil("ufo.R.beams.length === 0", 300)
    ufo.dbg.keys.clear()
    return { box, after: ufo.R.hp }
  })
  expect(r.after === r.box, r); return r
})
await t('追尾弾: UFO が光って照準が出てから撃つ。止まっていると当たる', async () => {
  await p.evaluate(new Function(FRESH + 'return 0'))
  const r = await p.evaluate(() => {
    ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.dbg.clearUfos(); ufo.R.inv = 0; ufo.R.taken = null
    const u = ufo.R.ufos.find(q => q.state === 'fly'); u.frozen = false
    ufo.dbg.placeUfo(u.id, 30, 24, 0); u.atk = 'missile'; u.charge = 1.0; u.atkCd = 99
    ufo.dbg.render(2)
    const lockShown = !document.getElementById('lock').classList.contains('hidden')
    const box = ufo.R.hp
    const nf = ufo.dbg.stepUntil("ufo.R.missiles.length > 0", 120)
    const n = ufo.dbg.stepUntil("ufo.log.some(e => e.t === 'hurt' && e.src === 'missile')", 600)
    return { lockShown, nf, n, box, after: ufo.R.hp }
  })
  expect(r.lockShown && r.nf > 30 && r.n > 0 && r.after === r.box - 1, r); return r
})
await t('追尾弾は建物に当たると消える（誘導してふり切れる）', async () => {
  const r = await p.evaluate(() => {
    const M = { id: 9999, from: -1, x: ufo.me.x, y: 5, z: ufo.me.z, vx: 0, vy: 0, vz: 0, v: 15, turn: 0, t: 0, minD: 1e9, near: false }
    // 近くのビルの壁へまっすぐ向かわせる
    const o = ufo.world.colliders.filter(c => c.kind === 'building' && c.y1 > 20).sort((a, b) => Math.hypot(a.cx - ufo.me.x, a.cz - ufo.me.z) - Math.hypot(b.cx - ufo.me.x, b.cz - ufo.me.z))[0]
    const dx = o.cx - M.x, dz = o.cz - M.z, l = Math.hypot(dx, dz); M.vx = dx / l * 15; M.vz = dz / l * 15
    ufo.dbg.teleport(ufo.me.x + 400, 0, ufo.me.z)   // 自分は遠くへ（追いかけない）
    ufo.R.missiles.push(M)
    const n = ufo.dbg.stepUntil("ufo.log.some(e => e.t === 'mBoom' && e.wall)", 900)
    return { n }
  })
  expect(r.n > 0, r); return r
})
await t('何もしないと電池が尽きて回収され、いちばん下の評価（D）・0点になる', async () => {
  await p.evaluate(() => { ufo.start(42); ufo.dbg.pause(true) })
  const r = await p.evaluate(() => {
    const n = ufo.dbg.stepUntil('ufo.R.over', 60 * 120)
    ufo.dbg.render(120)
    return { n, end: ufo.R.end, mode: ufo.mode, sum: window.__lastSummary }
  })
  expect(r.end === 'taken' && r.mode === 'result' && r.sum.rank === 4 && r.sum.score === 0, r)
  const v = await variance(p, '#slip'); expect(v > 500, v)
  await p.screenshot({ path: ROOT + '/shots/v-result-idle.png' })
  return { sec: Math.round(r.n / 60), score: r.sum.score, v }
})
await t('結果に支援リンク「作者に缶コーヒーをおごる」と Xでポスト', async () => {
  const r = await p.evaluate(() => ({ s: document.getElementById('tmSupport')?.textContent, href: document.getElementById('tmSupport')?.href, x: document.getElementById('btnPost').href }))
  expect(r.s === '作者に缶コーヒーをおごる' && /ofuse/.test(r.href) && /twitter\.com\/intent/.test(r.x), r); return r.s
})
await t('中断から撤退すると報告書が出る（途中で撤退）', async () => {
  await p.evaluate(() => { ufo.start(7); ufo.dbg.pause(false) }); await p.waitForTimeout(800)
  await p.click('#btnPause'); await p.click('#btnQuit')
  const r = await p.evaluate(() => ({ mode: ufo.mode, end: window.__lastSummary.end })); expect(r.mode === 'result' && r.end === 'quit', r)
})
await t('英語に切り替えられる', async () => {
  await p.evaluate(() => { ufo.toTitle(); ufo.setLang('en') })
  const s = await p.textContent('#btnStart'); await p.evaluate(() => ufo.setLang('ja')); expect(s === 'Deploy', s); return s
})
await t('Chromium: 実際には無音（音を鳴らした後）', async () => { const r = await p.evaluate(() => window.__muteOk()); expect(r, r) })
await t('Chromium: エラーなし（通しの後）', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---- スマホ縦3サイズ × 全画面で一画面に収まる
for (const [w, h, name] of [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'max']]) {
  const q = await open(browser, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true })
  const views = {}
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.tap('#btnHow'); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` }); await q.tap('#how [data-close]')
  await q.tap('#btnStart'); await q.waitForFunction(() => ufo.R.phase === 'wave', null, { timeout: 15000 }); await q.waitForTimeout(2500)
  views.play = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await t(`${name}: 遊び中の表示（作戦・電池・方角・ボタン）が重ならない`, async () => {
    const a = await overlap(q, '#ops', '#pack'), b = await overlap(q, '#ops', '#btnPause'), c = await overlap(q, '.tbtn[data-k=wire]', '.tbtn[data-k=jump]'), d = await overlap(q, '#pack', '#btnPause'), e = await overlap(q, '#stick', '.tbtn[data-k=jump]'), f = await overlap(q, '#arrow', '#ops'), g = await overlap(q, '#arrow', '#pack')
    expect(!a && !b && !c && !d && !e && !f && !g, { a, b, c, d, e, f, g })
  })
  await t(`${name}: 母艦の帯が電池・作戦の表示と重ならない`, async () => {
    await q.evaluate(() => { document.getElementById('bossbar').classList.remove('hidden') })
    const a = await overlap(q, '#bossbar', '#pack'), b = await overlap(q, '#bossbar', '#ops')
    await q.evaluate(() => { document.getElementById('bossbar').classList.add('hidden') })
    expect(!a && !b, { a, b })
  })
  await q.evaluate(() => { ufo.dbg.pause(true); ufo.dbg.stepUntil('ufo.R.over', 60 * 120); ufo.dbg.render(120) })
  await q.waitForTimeout(400)
  views.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, r) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await q.close()
}
await browser.close()

// ---- WebKit（iPhone 相当）で本物の指の通し
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: 指で始めて、指で UFO をタッチすると引っかかる', async () => {
  await wp.tap('#btnStart'); await wp.waitForFunction(() => ufo.R.phase === 'wave' && ufo.R.ufos.length >= 2, null, { timeout: 15000 })
  const s = await setupUfo(wp)
  await wp.touchscreen.tap(s.xy.x, s.xy.y)
  const r = await wp.evaluate(() => { ufo.dbg.step(1); return ufo.me.rope && ufo.me.rope.ufo })
  expect(r === s.id, { r, s }); return r
})
await t('WebKit: 右下の大きいボタンを指で押すと、前のビルにワイヤーが掛かる（UFO には掛けない）', async () => {
  await setupUfo(wp, 26, 16)
  await wp.evaluate(() => ufo.dbg.render(4))
  const box = await wp.locator('.tbtn[data-k=wire]').boundingBox()
  await wp.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  const r = await wp.evaluate(() => { ufo.dbg.step(2); return ufo.me.rope && { ufo: ufo.me.rope.ufo ?? null } })
  expect(r && r.ufo === null, r); return r
})
await t('WebKit: 左のスティックを指で倒すと走る', async () => {
  const r = await wp.evaluate(async () => { ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.dbg.clearUfos(); ufo.R.inv = 99; ufo.me.stun = 0; ufo.dbg.pause(false); return window.__stickCenter() })
  const x0 = await wp.evaluate(() => [ufo.me.x, ufo.me.z])
  const cdp = null; void cdp
  // touchscreen は tap しか無いので、pointer の down/move/up で指を倒す
  await wp.evaluate(c => { const el = document.getElementById('stick'); const ev = (t, x, y) => new PointerEvent(t, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }); el.dispatchEvent(ev('pointerdown', c.x, c.y)); window.dispatchEvent(ev('pointermove', c.x, c.y - 50)) }, r)
  await wp.waitForTimeout(1500)
  await wp.evaluate(c => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: c.x, clientY: c.y, bubbles: true })), r)
  const x1 = await wp.evaluate(() => [ufo.me.x, ufo.me.z])
  const d = Math.hypot(x1[0] - x0[0], x1[1] - x0[1]); expect(d > 2, d); return Math.round(d)
})
await t('WebKit: 実際には無音（タップで音を鳴らした後）', async () => { const r = await wp.evaluate(() => window.__muteOk()); expect(r, r) })
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
if (!process.env.LIVE) console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
void statSync
process.exit(fail ? 1 : 0)
