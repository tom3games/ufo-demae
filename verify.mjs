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
const PORT = Number(process.env.VPORT || 6417)
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
  if (process.env.VNAV) ctx.setDefaultNavigationTimeout(+process.env.VNAV)   // 他の検証で重い時だけ読み込みを長く待つ
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
await t('廃都の見た目が入っている（墜ちた UFO・煙の柱・瓦礫）。描画回数が多すぎない', async () => {
  // タイトルの裏の CPU 戦（爆発・破片・追尾弾）で1コマの回数は 170〜360 で揺れる（v4 の時点から。2026-11-11 に旧版と比べて確認）。街そのものの重さは、0.3秒ごと6コマの一番少ない所で見る
  const calls = []; for (let i = 0; i < 6; i++) { calls.push(await p.evaluate(() => ufo.renderer.info.render.calls)); await p.waitForTimeout(300) }
  const r = await p.evaluate(() => ({ wrecks: ufo.ruin.wrecks.length, fires: ufo.ruin.fires.length })); r.calls = Math.min(...calls); r.all = calls.join('/')
  expect(r.wrecks >= 2 && r.fires >= 8 && r.calls < 260, r); return r })
await t('タイトルの後ろで CPU が UFO と戦っている（デモ）', async () => { await p.waitForTimeout(4000); const r = await p.evaluate(() => ({ t: ufo.R.t, ufos: ufo.R.ufos.length })); expect(r.t > 1 && r.ufos > 0, r); return r })
await p.screenshot({ path: ROOT + '/shots/v-title.png' })
await t('遊び方を開いて閉じられる', async () => { await p.click('#btnHow'); const n = await p.locator('#howList li').count(); await p.screenshot({ path: ROOT + '/shots/v-how.png' }); await p.click('#how [data-close]'); expect(n === 4, n) })

// ---- 遊び: 本物のマウスで UFO を押す
await p.click('#btnStart')
await p.waitForFunction(() => ufo.R.phase === 'wave' && ufo.R.ufos.length >= 2, null, { timeout: 15000 })
await t('始めると第1波の UFO が出る（丼は持っていない）', async () => { const r = await p.evaluate(() => ufo.R.ufos.map(u => ({ k: u.kind, bowl: 'bowl' in u, y: Math.round(u.y) }))); expect(r.length >= 2 && r.every(u => !u.bowl), r); return r })
await t('ビルをクリックするとビルにワイヤーが掛かる（UFO ではない）', async () => {
  const a = await p.evaluate(() => { ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.dbg.clearUfos(); ufo.dbg.render(30); return ufo.dbg.screenAnchor() })
  expect(a && a.x > 0 && a.x < 390 && a.y > 0 && a.y < 844, a)
  await p.mouse.click(a.x, a.y)
  const r = await p.evaluate(() => { ufo.dbg.step(2); return ufo.me.rope && { ufo: ufo.me.rope.ufo ?? null } })
  expect(r && r.ufo === null, r); return { x: Math.round(a.x), y: Math.round(a.y) }
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

// 空中で速さ v（前向き）にして、突撃の準備をしたことにする（ビルで振った後）
const ufo_moveV = 4.5
const AIR = `ufo.me.y = Math.max(ufo.me.y, 7); ufo.me.grounded = false; ufo.me.rope = null; ufo.R.dashReady = true; const fx = Math.sin(ufo.cam.hd), fz = Math.cos(ufo.cam.hd); ufo.me.vx = fx * V; ufo.me.vz = fz * V; ufo.me.vy = 0; ufo.R.inv = 99;`
await t('地面に立ったまま UFO をクリックしても突撃しない（ビルで振ってから）', async () => {
  const s = await setupUfo(p, 20, 8)
  await p.evaluate(() => { ufo.R.dashReady = false })
  await p.mouse.click(s.xy.x, s.xy.y)
  const r = await p.evaluate(() => { ufo.dbg.step(3); return { dash: ufo.log.some(e => e.t === 'dash'), rope: ufo.me.rope ? ufo.me.rope.ufo ?? 'building' : null, msg: document.getElementById('nearTxt').textContent } })
  expect(!r.dash && r.rope == null && r.msg, r); return r
})
await t('ビルで振って速い時に UFO をクリックすると突撃して必ず当たる（ワイヤーは掛けない）', async () => {
  const s = await setupUfo(p, 16, 9)
  const xy = await p.evaluate(new Function('V', AIR.replace(/V/g, '20') + 'ufo.dbg.render(2); return ufo.ufoXY(' + s.id + ')'))
  await p.mouse.click(xy.x, xy.y)
  const r = await p.evaluate(id => { ufo.dbg.step(1); const dash = ufo.log.some(e => e.t === 'dash' && e.id === id), rope = ufo.me.rope; const n = ufo.dbg.stepUntil("ufo.log.some(e => e.t === 'ram')", 200); const e = ufo.log.find(e => e.t === 'ram'); return { dash, rope: !!rope, n, v: e && Math.round(e.v), dmg: e && e.dmg, kill: e && e.kill } }, s.id)
  expect(r.dash && !r.rope && r.n > 0 && r.v >= 19, r)
  await p.evaluate(() => ufo.dbg.render(2)); await p.screenshot({ path: ROOT + '/shots/v-ram.png' })
  return r
})
await t('威力は突撃した時の速さ（10m/s と 30m/s）。シールドはひびで半分、開いた所は2倍', async () => {
  const one = (V, open) => p.evaluate(([V, open, AIR]) => {
    ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.dbg.clearUfos()
    const u = ufo.R.ufos.find(q => q.state === 'fly'); u.frozen = false; ufo.dbg.placeUfo(u.id, 14, 6, 0); u.hp = 99; u.open = open ? 9 : 0; u.atkCd = 99; u.hitCd = 0
    new Function('V', AIR)(V); const n0 = ufo.log.length; ufo.dbg.dash(u.id); ufo.dbg.stepUntil("ufo.log.slice(" + n0 + ").some(e => e.t === 'ram')", 200)
    const e = ufo.log.slice(n0).find(e => e.t === 'ram'); return { dmg: e && e.dmg, open: e && e.open, crack: e && e.crack, vy: Math.round(ufo.me.vy), ready: ufo.R.dashReady }
  }, [V, open, AIR])
  const slow = await one(10, false), fast = await one(30, false), win = await one(10, true)
  expect(slow.crack && slow.dmg === 0.5 && fast.dmg === 1.5 && win.open && win.dmg === 2 && fast.vy > 5 && !fast.ready, { slow, fast, win }); return { slow: slow.dmg, fast: fast.dmg, open: win.dmg }
})
await t('雑魚の円盤は速い突撃1発で落ちる', async () => {
  const r = await p.evaluate(AIR => {
    ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.dbg.clearUfos()
    const u = ufo.R.ufos.find(q => q.state === 'fly' && q.kind === 'saucer'); u.frozen = false; ufo.dbg.placeUfo(u.id, 14, 6, 0); u.hp = u.maxHp; u.open = 0; u.hitCd = 0
    new Function('V', AIR)(22); const n0 = ufo.log.length; ufo.dbg.dash(u.id); ufo.dbg.stepUntil("ufo.log.slice(" + n0 + ").some(e => e.t === 'down')", 200)
    return { down: ufo.log.slice(n0).some(e => e.t === 'down'), maxHp: u.maxHp }
  }, AIR)
  expect(r.down, r); return r
})
await t('突撃の後は上に跳ね、ビルで振るまで次の突撃はできない', async () => {
  const r = await p.evaluate(AIR => {
    ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.dbg.clearUfos()
    const us = ufo.R.ufos.filter(q => q.state === 'fly'); const u = us[0], v = us[1]
    u.frozen = false; ufo.dbg.placeUfo(u.id, 12, 6, 0); u.hp = 99; u.hitCd = 0
    new Function('V', AIR)(18); const n0 = ufo.log.length; ufo.dbg.dash(u.id); ufo.dbg.stepUntil("ufo.log.slice(" + n0 + ").some(e => e.t === 'ram')", 200)
    const after = { vy: Math.round(ufo.me.vy), ready: ufo.R.dashReady }
    v.frozen = true; v.x = ufo.me.x + 10; v.y = ufo.me.y + 2; v.z = ufo.me.z; ufo.dbg.dash(v.id); ufo.dbg.step(2); const second = ufo.log.slice(n0).filter(e => e.t === 'dash').length
    return { after, second }
  }, AIR)
  expect(r.after.vy > 5 && !r.after.ready && r.second === 1, r); return r
})
await t('E（ビルへのワイヤー）は UFO に掛からない。UFO をクリックしてもワイヤーは掛からない', async () => {
  const s = await setupUfo(p, 30, 12)
  await p.keyboard.down('KeyE'); await p.keyboard.up('KeyE')
  const r = await p.evaluate(() => { ufo.dbg.step(2); return ufo.me.rope && { ufo: ufo.me.rope.ufo ?? null } })
  expect(r && r.ufo === null, { r, s }); return r
})
await t('追跡機: 正面から突撃すると迎え撃ちで落とせる', async () => {
  const r = await p.evaluate(AIR => {
    ufo.dbg.teleport(60, 12, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.dbg.clearUfos(); ufo.R.inv = 99
    const u = ufo.dbg.spawn('hunter', 60 + 22, 13, 866, { hunt: 'chase', vx: -14 })
    new Function('V', AIR)(14); const n0 = ufo.log.length; ufo.dbg.dash(u.id); ufo.dbg.stepUntil("ufo.log.slice(" + n0 + ").some(e => e.t === 'ram')", 200)
    const e = ufo.log.slice(n0).find(e => e.t === 'ram'); return { counter: e && e.counter, kill: e && e.kill, dmg: e && e.dmg }
  }, AIR)
  expect(r.counter && r.kill, r); return r
})
await t('着地せずに突撃を続けると連鎖と倍率が上がり、着地すると切れる', async () => {
  const r = await p.evaluate(AIR => {
    ufo.dbg.teleport(60, 12, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.R.inv = 99; ufo.dbg.clearUfos()
    ufo.R.chain = 0; ufo.R.mult = 1
    const hits = []
    for (let i = 0; i < 4; i++) {
      const u = ufo.R.ufos.find(q => q.state === 'fly'); if (!u) break
      u.frozen = true; u.hp = 99; u.atkCd = 99; u.hitCd = 0; u.x = ufo.me.x + 12; u.z = ufo.me.z; u.y = ufo.me.y + 3
      new Function('V', AIR)(22); const n0 = ufo.log.length; ufo.dbg.dash(u.id); ufo.dbg.stepUntil("ufo.log.slice(" + n0 + ").some(e => e.t === 'ram')", 200)
      hits.push([ufo.R.chain, ufo.R.mult])
    }
    const top = { chain: ufo.R.chain, mult: ufo.R.mult }
    ufo.dbg.teleport(ufo.me.x, 0, ufo.me.z); ufo.dbg.step(60)
    return { hits, top, after: { chain: ufo.R.chain, mult: ufo.R.mult } }
  }, AIR)
  expect(r.top.chain >= 4 && r.top.mult >= 2 && r.after.chain === 0 && r.after.mult === 1, r); return r
})
await t('ロックオンは 23m まで（照準の印・水色・突撃の判定が同じ境目。30m と 23.5m は不可、22.5m は可）', async () => {
  const r = await p.evaluate(AIR => {
    ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.dbg.clearUfos()
    const u = ufo.R.ufos.find(q => q.state === 'fly'); u.frozen = false
    const wb = () => document.querySelector('.tbtn[data-k=wire]').classList.contains('aim-ufo')
    const at = d => { ufo.dbg.placeUfo(u.id, d, 1, 0); new Function('V', AIR)(20); ufo.dbg.placeUfo(u.id, d, 1, 0); ufo.dbg.render(4); return { lock: ufo.dbg.lockId === u.id, blue: wb(), d: +Math.hypot(u.x - ufo.me.x, u.y - ufo.me.y - 1, u.z - ufo.me.z).toFixed(2) } }
    const far = at(30), out = at(23.5), inn = at(22.5)
    const n0 = ufo.log.length; ufo.dbg.placeUfo(u.id, 23.5, 1, 0); ufo.dbg.tryDash(u.id); const dashOut = ufo.log.slice(n0).some(e => e.t === 'dash')
    return { range: ufo.U.dashRange, far, out, inn, dashOut }
  }, AIR)
  expect(r.range === 23 && !r.far.lock && !r.out.lock && !r.out.blue && !r.dashOut && r.inn.lock && r.inn.blue, r); return r
})
await t('母艦は広場の上を巡回する（止まらない・速すぎない・広場から出ない・攻撃の前は止まってこちらへ傾く・砲台が付いてくる・カメラは勝手に回らない）', async () => {
  const r = await p.evaluate(() => {
    ufo.dbg.teleport(60, 0, 850, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.dbg.clearUfos(); ufo.R.inv = 1e9
    for (const u of ufo.R.ufos) u.state = 'gone'   // 本番と同じく、前の波の UFO が残らない状態で母艦を出す
    ufo.R.wave = ufo.WAVES.length - 1; ufo.R.phase = 'between'; ufo.R.phaseT = 99
    ufo.dbg.stepUntil("ufo.R.boss && ufo.R.boss.state === 'fight'", 600)
    const B = ufo.R.boss, A = { x: 66, z: 862 }, hd0 = ufo.cam.hd
    ufo.dbg.pause(true)
    const keep = "(ufo.R.inv = 1e9, ufo.R.hp = 8, ufo.R.taken = null, ufo.R.boss.left = 100, false)"
    let path = 0, maxV = 0, maxR = 0, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, px = B.x, pz = B.z, podOff = 0, still = 0
    for (let i = 0; i < 80; i++) {   // 40秒を0.5秒ごとに見る（毎歩は描かない）
      ufo.dbg.stepUntil(keep, 30)
      const v = Math.hypot(B.vx, B.vz); path += Math.hypot(B.x - px, B.z - pz); maxV = Math.max(maxV, v); px = B.x; pz = B.z
      if (v < 0.2) still++
      maxR = Math.max(maxR, Math.hypot(B.x - A.x, B.z - A.z)); minX = Math.min(minX, B.x); maxX = Math.max(maxX, B.x); minZ = Math.min(minZ, B.z); maxZ = Math.max(maxZ, B.z)
      for (const q of B.pods) if (q.state === 'fly') podOff = Math.max(podOff, Math.abs(Math.hypot(q.x - B.x, q.z - B.z) - ufo.BOSS.rimR))
    }
    let wind = 0, windV = 0, windTilt = 0
    for (let k = 0; k < 3; k++) {   // 攻撃の直前: 止まって、こちらへ傾いている
      if (ufo.dbg.stepUntil("(ufo.R.inv = 1e9, ufo.R.hp = 8, ufo.R.boss.left = 100, ufo.R.boss.windup && ufo.R.boss.atkCd < 0.2)", 900) < 0) break
      wind++; windV = Math.max(windV, Math.hypot(B.vx, B.vz)); const tx = ufo.me.x - B.x, tz = ufo.me.z - B.z, l = Math.hypot(tx, tz); windTilt += (B.tiltX * tx + B.tiltZ * tz) / l > 0.08 ? 1 : 0
      ufo.dbg.stepUntil("!ufo.R.boss.windup", 600)
    }
    ufo.dbg.pause(false)
    return { path: Math.round(path), span: Math.round(Math.max(maxX - minX, maxZ - minZ)), maxV: +maxV.toFixed(2), maxR: Math.round(maxR), stillPct: Math.round(still / 0.8), podOff: +podOff.toFixed(2), wind, windV: +windV.toFixed(2), windTilt, camTurn: +Math.abs(ufo.cam.hd - hd0).toFixed(3) }
  })
  expect(r.path > 60 && r.span > 20 && r.maxV <= ufo_moveV + 0.3 && r.maxR <= 36 && r.stillPct < 70 && r.podOff < 0.05 && r.wind > 0 && r.windV < 1.5 && r.windTilt === r.wind && r.camTurn < 0.05, r); return r
})
await t('落ちながらの突撃は急降下（1.4倍）', async () => {
  const r = await p.evaluate(AIR => {
    ufo.dbg.teleport(60, 0, 866, Math.PI / 2); ufo.cam.hd = Math.PI / 2; ufo.dbg.clearUfos()
    const u = ufo.R.ufos.find(q => q.state === 'fly'); u.frozen = false; ufo.dbg.placeUfo(u.id, 10, -2, 0); u.y = 6; u.hp = 99; u.open = 0; u.hitCd = 0
    new Function('V', AIR)(10); ufo.me.y = 14; ufo.me.vy = -14; const n0 = ufo.log.length; ufo.dbg.dash(u.id); ufo.dbg.stepUntil("ufo.log.slice(" + n0 + ").some(e => e.t === 'ram')", 200)
    const e = ufo.log.slice(n0).find(e => e.t === 'ram'); return { dive: e && e.dive, dmg: e && e.dmg, v: e && Math.round(e.v) }
  }, AIR)
  expect(r.dive && r.dmg > 0.5 * Math.max(1, r.v / 10) * 1.3, r); return r
})
await t('ビルの陰にいると焼却光線は届かない（盾）', async () => {
  const r = await p.evaluate(() => {
    const o = ufo.world.colliders.filter(c => c.kind === 'building' && !c.small && c.y1 > 30 && c.hl > 8 && Math.hypot(c.cx - 66, c.cz - 862) < 160).sort((a, b) => Math.hypot(a.cx - 66, a.cz - 862) - Math.hypot(b.cx - 66, b.cz - 862))[0]
    ufo.dbg.clearUfos(); ufo.R.inv = 0; ufo.R.taken = null
    const px = o.cx - o.hw - 1.5, pz = o.cz
    ufo.dbg.teleport(px, ufo.world.groundAt(px, pz, 2).h, pz, Math.PI / 2)
    const u = ufo.R.ufos.find(q => q.state === 'fly'); Object.assign(u, { frozen: true, x: o.cx + o.hw + 8, y: 20, z: o.cz, atkCd: 99, atk: 'beam' })
    ufo.R.beams.push({ id: 991, ufo: u.id, x: px, z: pz, gy: ufo.me.y, r: 5, t: 0, phase: 'warn' })
    const hp = ufo.R.hp, n0 = ufo.log.length
    ufo.dbg.stepUntil("ufo.R.beams.length === 0", 300)
    return { hp, after: ufo.R.hp, cover: ufo.log.slice(n0).some(e => e.t === 'cover') }
  })
  expect(r.cover && r.after === r.hp, r); return r
})
await t('真後ろを追ってくる追跡機は、細い鉄塔の向こうへ抜けると激突して落ちる', async () => {
  const r = await p.evaluate(() => {
    const T = ufo.world.ruinMap.towers[0]; ufo.dbg.clearUfos(); ufo.R.inv = 99
    ufo.dbg.teleport(T.x + 3, 8, T.z, Math.PI / 2); ufo.me.grounded = false; ufo.me.vx = 2
    const h = ufo.dbg.spawn('hunter', T.x - 7, 9, T.z, { hunt: 'chase', vx: 14 })
    const n0 = ufo.log.length; for (let i = 0; i < 90; i++) { ufo.me.y = 8; ufo.me.vy = 0; ufo.dbg.step(1); if (ufo.log.slice(n0).some(e => e.t === 'hunterCrash')) break }
    return { crash: ufo.log.slice(n0).some(e => e.t === 'hunterCrash'), state: h.state }
  })
  expect(r.crash, r); return r
})
await t('ワイヤーは明るい芯と光で、暗い背景でも見える', async () => {
  // 光は 0.18〜0.38 で脈打つので、1コマだけ見ると低い所に当たって落ちる。0.1秒ごと8回の平均で見る
  const one = () => p.evaluate(() => { let core = null, glow = null; ufo.scene.traverse(o => { if (o.isMesh && o.geometry.parameters && o.geometry.parameters.radiusTop === 0.045) { core = o.material.color.getHSL({}); glow = o.children[0] && o.children[0].material.opacity } }); return { l: core && core.l, glow } })
  const xs = []; for (let i = 0; i < 8; i++) { xs.push(await one()); await p.waitForTimeout(100) }
  const r = { l: xs[0].l, glow: +(xs.reduce((a, x) => a + x.glow, 0) / xs.length).toFixed(3) }
  expect(r.l > 0.8 && r.glow > 0.2, r); return r
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
await t('何もしないと電池が尽きて回収され、いちばん下の評価（D）になる', async () => {
  await p.evaluate(() => { ufo.start(42); ufo.dbg.pause(true) })
  const r = await p.evaluate(() => {
    const n = ufo.dbg.stepUntil('ufo.R.over', 60 * 120)
    ufo.dbg.render(120)
    return { n, end: ufo.R.end, mode: ufo.mode, sum: window.__lastSummary }
  })
  expect(r.end === 'taken' && r.mode === 'result' && r.sum.rank === 4 && r.sum.score < 500, r)
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
await t('WebKit: 指で始めて、速い時に指で UFO をタッチすると突撃して当たる', async () => {
  await wp.tap('#btnStart'); await wp.waitForFunction(() => ufo.R.phase === 'wave' && ufo.R.ufos.length >= 2, null, { timeout: 15000 })
  const s = await setupUfo(wp, 16, 9)
  const xy = await wp.evaluate(new Function('V', AIR.replace(/V/g, '20') + 'ufo.dbg.render(2); return ufo.ufoXY(' + s.id + ')'))
  await wp.touchscreen.tap(xy.x, xy.y)
  const r = await wp.evaluate(() => { ufo.dbg.step(1); const dash = ufo.log.some(e => e.t === 'dash'); const n = ufo.dbg.stepUntil("ufo.log.some(e => e.t === 'ram')", 200); return { dash, n } })
  expect(r.dash && r.n > 0, { r, s }); return r
})
await t('WebKit: 照準が水色の時に右下の大きいボタンを指で押すと突撃する', async () => {
  const s = await setupUfo(wp, 14, 7)
  await wp.evaluate(new Function('V', AIR.replace(/V/g, '18') + 'ufo.dbg.render(4)'))
  const lock = await wp.evaluate(() => ({ id: ufo.dbg.lockId, cls: document.querySelector('.tbtn[data-k=wire]').className, n0: ufo.log.filter(e => e.t === 'dash').length }))
  const box = await wp.locator('.tbtn[data-k=wire]').boundingBox()
  await wp.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  const r = await wp.evaluate(() => { ufo.dbg.step(1); return { dash: ufo.log.filter(e => e.t === 'dash').length } })
  expect(lock.id === s.id && /aim-ufo/.test(lock.cls) && r.dash === lock.n0 + 1, { lock, r }); return { lock: lock.id, r }
})
await t('WebKit: 地面で右下の大きいボタンを指で押すと、前のビルにワイヤーが掛かる', async () => {
  await setupUfo(wp, 26, 16)
  await wp.evaluate(() => { ufo.R.dashReady = false; ufo.dbg.render(4) })
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
// ---- ページを離れた時の音（2026-11-11 横丁へ移っても BGM が鳴り続けた。sfx.js に止める処理が無かった）。音は鳴らさず、再生中のループの数で見る
await (async (ap, other, ready, tapXY) => {
  const e0 = ap.errs.length
  await t('WebKit: 裏に回ると BGM と環境音が止まり suspend。戻っても触るまで鳴らない（bfcache の pageshow でも）', async () => {
    await ap.waitForFunction(() => Snd.playing().length >= 1, null, { timeout: 15000 })
    const r = await ap.evaluate(async () => {
      const c = Snd.ctx; let sus = 0; const os = c.suspend; c.suspend = function () { sus++; return os.call(this) }
      const before = Snd.playing().length, w0 = Snd.life.wake
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'))
      const hid = { away: Snd.away, playing: Snd.playing().length, sus, gain: Snd.master.gain.value }
      const fx = Object.keys(Snd.files)[0], url = Object.values(Snd.loops).find(l => l && l.url).url
      const pl = fx ? Snd.play(fx) : null; Snd.loop('awayTest', url, 0.2)   // 裏にいる間の音は鳴らさない
      await new Promise(r => setTimeout(r, 400)); const quiet = Snd.playing().length
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
      await new Promise(r => setTimeout(r, 400)); const back = { away: Snd.away, playing: Snd.playing().length, gain: Snd.master.gain.value, state: c.state }
      Snd.loop('awayTest', null); c.suspend = os
      return { before, w0, hid, pl: pl === null, quiet, back }
    })
    const xy = await tapXY(ap); await ap.touchscreen.tap(xy.x, xy.y); await ap.waitForTimeout(700)
    const after = await ap.evaluate(() => ({ away: Snd.away, playing: Snd.playing().length, wake: Snd.life.wake, mute: window.__muteOk() }))
    expect(r.before >= 1 && r.hid.away && r.hid.playing === 0 && r.hid.sus >= 1 && r.hid.gain === 0 && r.pl && r.quiet === 0 && r.back.away && r.back.playing === 0 && r.back.gain === 0 && r.back.state !== 'running' && !after.away && after.playing >= 1 && after.wake === r.w0 + 1 && after.mute, JSON.stringify({ r, after }))
    return { before: r.before, hidden: r.hid.playing, back: r.back.playing, touched: after.playing }
  })
  await t('WebKit: 横丁へ移る（pagehide）と止まり、戻るで戻っても鳴っていない', async () => {
    await ap.evaluate(() => addEventListener('pagehide', () => { try { sessionStorage.setItem('awayHide', JSON.stringify({ away: Snd.away, playing: Snd.playing().length })) } catch (e) {} }))
    await ap.goto(URL0 + other); await ap.waitForTimeout(300)
    const h = JSON.parse(await ap.evaluate(() => sessionStorage.getItem('awayHide')) || '{}')
    await ap.goBack(); await ap.waitForFunction(ready, null, { timeout: 30000 }); await ap.waitForTimeout(800)
    const back = await ap.evaluate(() => ({ playing: Snd.playing().length, ctx: Snd.ctx ? Snd.ctx.state : 'none' }))
    expect(h.away && h.playing === 0 && back.playing === 0 && back.ctx !== 'running', JSON.stringify({ h, back })); return { h, back }
  })
  // 移る時に読み込み途中の音が中断されるのは数えない
  await t('WebKit: 離れる・戻るでエラーなし', async () => { const e = ap.errs.slice(e0).filter(s => !/^reqfail |__away__|status of 404/.test(s)); expect(!e.length, e.join('|')) })
})(wp, 'privacy.html', () => window.__ufoReady, p => ({ x: Math.round(p.viewportSize().width / 2), y: 6 }))
await wb.close()
server.kill()
if (!process.env.LIVE) console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
void statSync
process.exit(fail ? 1 : 0)
