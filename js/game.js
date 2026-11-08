// 空中出前 UFO襲来。空中出前（sky-delivery）の街とワイヤーで、出前のラーメンをさらった UFO と戦う
// UFO に体当たり（速いほど強い）・UFO をタッチして引っかけて引き寄せ体当たり・落ちてくる丼を空中で取る
import * as THREE from 'three'
import { GAME } from '../shared/config.js?v=1'
import { createWorld } from '../shared/track.js?v=1'
import { buildScene } from './scene.js?v=1'
import { FX } from './fx.js?v=1'
import { loadSky, setAniso } from './look.js?v=1'
import { Q, LOW } from './quality.js?v=1'
import { RunnerModel } from './runnermodel.js?v=1'
import { CharRunnerModel, loadCharAssets, charAssets } from './charmodel.js?v=1'
import { createRunner, stepRunner, findAnchor, rayHit, floorAt, blocked, RUN } from '../shared/runner.js?v=1'
import { createStreet, buildPoles } from '../shared/street.js?v=1'
import { addTown, clearShopFront } from '../shared/town.js?v=1'
import { buildPoles3d, buildHouses3d, trafficPool, pedPool } from './street3d.js?v=1'
import { carLights } from './carmodel.js?v=1'
import { createRaid, stepRaid, syncRope, rayUfo, aimUfo, summary, SHOP, RANKS, U, BOSS } from '../shared/ufo.js?v=1'
import { createUfoBot, ufoBotInput } from '../shared/ufobot.js?v=1'
import { UfoView, MotherView, AttackView } from './ufo3d.js?v=1'
import { drawSlip } from './slip.js?v=1'

const $ = id => document.getElementById(id)
// ---------------------------------------------------------------- 読み込みの進み具合（ロード画面）
const LM = THREE.DefaultLoadingManager, bootP = { done: 0, total: 0 }
LM.onStart = LM.onProgress = (url, a, b) => { bootP.done = a; bootP.total = b; bootP.at = performance.now(); window.__bootSet && window.__bootSet(0.2 + 0.8 * (b ? a / b : 0)) }
// 人物の GLB（自分・通行人）は待たない（読めるまで仮の人形。読めたら差し替える）。待つのは街の画像だけ
const bootPend = new Set()
{ const st = LM.itemStart.bind(LM), en = LM.itemEnd.bind(LM); LM.itemStart = u => { if (!/\.glb/i.test(u)) bootPend.add(u); st(u) }; LM.itemEnd = u => { bootPend.delete(u); en(u) } }
window.__bootDbg = () => ({ ...bootP, ch: charAssets.ready, chFail: charAssets.failed, now: Math.round(performance.now()) })
function bootWatch(onReady) {
  const t0 = performance.now()
  const tick = () => {
    const quiet = performance.now() - (bootP.at || 0) > 1500
    const done = bootP.total > 0 && (bootP.pend0 = bootPend.size, bootPend.size === 0 || bootP.done >= bootP.total || quiet)
    if (done || performance.now() - t0 > 12000) {   // 遅い回線でも12秒で必ず消す（人物は読めたら差し替える）
      window.__bootDone = true; window.__bootSet && window.__bootSet(1)
      const b = $('boot'); b.classList.add('out'); setTimeout(() => b.classList.add('hidden'), 380)
      onReady(); return
    }
    setTimeout(tick, 120)
  }
  tick()
}
const STEP = GAME.step
const URL_ = 'https://tom3games.github.io/ufo-demae/'
const store = { get: k => { try { return localStorage.getItem(k) } catch (e) { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch (e) {} } }
const pick = a => a[Math.floor(Math.random() * a.length)]

// ---------------------------------------------------------------- 文言（日英）
const T = {
  ja: {
    series: '宙吊軒の丼を取り返せ', logo: '空中出前 UFO襲来', masterName: '店主', masterLine: '出前のラーメン、UFOにさらわれた。すすられる前に取り返してこい',
    start: '取り返しに行く', how: '遊び方', lang: 'EN', more: 'ほかのゲーム', muteOn: '音 入', muteOff: '音 切', loading: 'UFOが近づいています',
    howTitle: '取り返し方', ok: 'わかった',
    howItems: [
      '<b>UFOをタッチ</b>で引っかけて体当たり。大きいボタンは前のUFOへ自動で',
      'ビルをタッチでワイヤー。<b>速く飛んで当てるほど強い</b>',
      '落とした<b>丼に近づいて取る</b>。空中で取ると満点',
      '<b>足元の輪・赤い線</b>から出る。追尾弾は急に曲がってふり切る'
    ],
    hintHook: '<small>こつ</small>UFOをタッチすると引っかけて体当たり', hintHookPc: '<small>こつ</small>UFOをクリック（E なら前のUFOへ自動）で体当たり',
    hintBeam: '<small>こつ</small>足元の輪から出ろ！ 吸われるで', hintBowl: '<small>こつ</small>落ちてくる丼に近づいて取れ', hintLock: '<small>こつ</small>追尾弾や。速く飛んで急に曲がればふり切れる', hintLaser: '<small>こつ</small>赤い線の上から離れろ',
    keysPc: 'PC: WASD・矢印で移動　クリックでワイヤー（UFOなら引っかける）　E は前のUFOへ自動　Space ジャンプ　ドラッグで見回す',
    credit: '音: Kenney, rubberduck, artisticdude, Effebit, poinl, Almitory ほか（CC0・Public domain）。詳しくは CREDITS.md',
    ticketHead: 'UFO被害の伝票', wave: n => `第${n}波`, bossW: '母船', ufoLeft: n => `UFO 残り${n}機`, backN: n => `取り返した ${n}杯`, eatingW: p => `いちばん減ってる丼 ${p}%`,
    tooFar: '届かない', okCap: '岡持ちの耐久', jump: '跳ぶ', lockOn: 'ロックオン', pause: '休憩', paused: '休憩中', resume: '戻る', quit: '店に帰る（やめる）',
    bossName: '母船どんぶり号', bossLeft: s => `完食まで ${s}秒`,
    waveS: n => n === 1 ? '出前のラーメンがさらわれた' : n === 4 ? '最後の波' : 'まだ来る', waveB: n => `第${n}波`,
    bossS: '上空に', bossB: '母船どんぶり号', clearS: 'UFO撃退', clearB: '丼が降ってくる',
    extra: '<small>店主</small>増援や！ まだ来るで',
    master: ['<small>店主</small>そのUFO、チャーシュー多めのやつや！', '<small>店主</small>スープ飲むな！ 8時間炊いとんねん', '<small>店主</small>器は店のや！ 丼ごと返せ', '<small>店主</small>岡持ちへこませたら給料から引くで', '<small>店主</small>ナルトは返さんでもええ！', '<small>店主</small>のびる前に取り返せ！', '<small>店主</small>ワイヤーは振ってから当てるんや'],
    film: ['<small>通行人</small>（スマホで撮ってる）', '<small>通行人</small>やば、UFOがラーメンすすってる', '<small>通行人</small>出前の人、飛んでる…', '<small>通行人</small>ライブ配信します'],
    ram: n => n >= 3 ? '会心！' : n === 2 ? 'ドン！' : 'コツン', boing: '<small>宇宙人</small>ポヨン（遅すぎて効いてない）',
    down: ['<small>宇宙人</small>ピギャー！', '<small>宇宙人</small>マダ スッテナイ！', '<small>宇宙人</small>オカワリ ガ…'],
    catchAir: (d, p) => `空中で取った！ ${d} 残り${p}%`, catchGround: (d, p) => `取った！ ${d} 残り${p}%`, pick: (d) => `拾った（半分） ${d}`, cat: '<small>野良猫</small>ニャ（丼を持っていった）',
    eaten: '<small>宇宙人</small>ゲェーップ…ゴチソウサマ', eatenNaruto: '<small>宇宙人</small>ナルト ウマイ',
    narutoCatch: 'ナルト1枚、取り返した', narutoWave: '<small>店主</small>ナルトだけ盗る小さいのもおるで',
    sucked: '吸われる！', spit: '<small>宇宙人</small>ペッ（まずかったらしい）',
    hurt: { beam: '<small>店主</small>吸われとる場合か！', laser: '<small>店主</small>熱っ！ 岡持ちが焦げた', drone: '<small>店主</small>ちっこいのに当たっとる', missile: '<small>店主</small>追尾弾や、ふり切れ！' },
    mBait: '誘導成功！ UFOに当てた', mWall: 'ビルでふり切った！', near: 'ギリギリ！', combo: n => `${n}つなぎ`,
    boss: '<small>店主</small>なんやあのでかい丼…うちの丼より大きい', coreOpen: '<small>店主</small>底のナルトが弱点や！ 叩け！', bossDown: '<small>店主</small>落ちた！ さらわれた丼が降ってくるで！',
    abduct: '<small>宇宙人</small>コノ デマエ…ズズッ…ウマイ', escaped: '<small>宇宙人</small>ゼンブ タベタ。マタクル',
    fix: '<small>店主</small>岡持ち、トンカチで直しといたで', clearLine: '<small>店主</small>ようやった。次来るで',
    again: 'もう一回', save: '画像を保存', post: 'Xでポスト', toTitle: 'タイトル',
    slip: {
      shop: '町中華 宙吊軒', title: '出前伝票（UFO被害）', boss: '店主', scoreLabel: '取り返した点数', logTitle: '今日の丼', more: n => `ほか ${n}杯`,
      st: ['取り返した丼', '撃墜したUFO', '最高つなぎ', '岡持ちのへこみ'], unit: ['杯', '機', '', '回'],
      how: { caught: p => `取った 残り${p}%`, air: p => `空中で取った ${p}%`, picked: p => `拾った ${p}%`, eaten: () => '食べられた', cat: () => '猫が持っていった', taken: () => '持ち帰られた' },
      sub: { clear: '母船 撃墜', abducted: '配達員が連れ去られた', escaped: '母船に逃げられた', quit: '途中で帰った' },
      caption: '体当たりの瞬間',
      stamps: ['店の守り神', '看板バイト', '見習い', '皿洗い', '出禁'],
      comments: {
        clear: '母船まで落とすとは。明日から出前やなくて防衛隊や', abducted: '宇宙で出前の続きしとけ。伝票は置いていけ', escaped: '丼ごと持って帰られた。器代は給料から引く',
        few: '空ばっかり見とらんと、UFOに当たれ', eaten: 'ほとんどすすられとるやないか。スープ代返せ', naruto: 'ナルト1枚のために命かけたんか', air: '空中で受け取るとは。出前の鑑や', ok: 'まあまあや。次は全部取り返せ'
      }
    },
    postText: (s, n, end) => `空中出前 UFO襲来で、UFOにさらわれた丼を${n}杯取り返した（${s.toLocaleString()}点${end === 'clear' ? '・母船撃墜' : ''}）`
  },
  en: {
    series: 'Take back the noodles', logo: 'Sky Delivery: UFO Raid', masterName: 'Chef', masterLine: 'UFOs stole our ramen deliveries. Get them back before they slurp them up.',
    start: 'Go get them', how: 'How to play', lang: 'JP', more: 'More games', muteOn: 'Sound on', muteOff: 'Muted', loading: 'UFOs approaching',
    howTitle: 'How to take them back', ok: 'Got it',
    howItems: [
      '<b>Tap a UFO</b> to hook it and ram it. The big button hooks the UFO ahead',
      'Tap buildings to swing. <b>The faster you hit, the harder it hurts</b>',
      'Downed UFOs drop the <b>bowl. Grab it</b>. Mid-air catches score full',
      'Get out of <b>rings and red lines</b>. Shake homing shots with sharp turns'
    ],
    hintHook: '<small>Tip</small>Tap a UFO to hook it and ram it', hintHookPc: '<small>Tip</small>Click a UFO (or E for the one ahead) to ram it',
    hintBeam: '<small>Tip</small>Get out of the ring! It will suck you up', hintBowl: '<small>Tip</small>Grab the falling bowl', hintLock: '<small>Tip</small>Homing shot. Fly fast and turn sharp to shake it', hintLaser: '<small>Tip</small>Get off the red line',
    keysPc: 'PC: WASD / arrows move · click to wire (click a UFO to hook it) · E hooks the UFO ahead · Space jump · drag to look',
    credit: 'Sounds: Kenney, rubberduck, artisticdude, Effebit, poinl, Almitory and others (CC0 / public domain). See CREDITS.md',
    ticketHead: 'UFO DAMAGE SLIP', wave: n => `Wave ${n}`, bossW: 'Mothership', ufoLeft: n => `${n} UFOs left`, backN: n => `${n} bowls back`, eatingW: p => `Emptiest bowl ${p}%`,
    tooFar: 'Too far', okCap: 'Box strength', jump: 'Jump', lockOn: 'LOCKED', pause: 'Break', paused: 'On break', resume: 'Back', quit: 'Go home (quit)',
    bossName: 'Mothership DONBURI', bossLeft: s => `Done eating in ${s}s`,
    waveS: n => n === 1 ? 'They took our ramen' : n === 4 ? 'Last wave' : 'More incoming', waveB: n => `Wave ${n}`,
    bossS: 'Overhead', bossB: 'Mothership DONBURI', clearS: 'UFOs repelled', clearB: 'Bowls incoming',
    extra: '<small>Chef</small>More of them!',
    master: ['<small>Chef</small>That one has extra chashu!', '<small>Chef</small>Stop drinking the soup! It took 8 hours!', '<small>Chef</small>The bowls are ours! Bring them back!', '<small>Chef</small>Dent the box and it comes out of your pay', '<small>Chef</small>Forget the naruto!', '<small>Chef</small>Get them before the noodles go soggy!', '<small>Chef</small>Swing first, then hit'],
    film: ['<small>Passer-by</small>(filming)', '<small>Passer-by</small>That UFO is slurping ramen', '<small>Passer-by</small>The delivery guy is flying...', '<small>Passer-by</small>Going live'],
    ram: n => n >= 3 ? 'CRITICAL!' : n === 2 ? 'BAM!' : 'tap', boing: '<small>Alien</small>Boing (too slow to hurt)',
    down: ['<small>Alien</small>PIGYAA!', '<small>Alien</small>STILL SLURPING!', '<small>Alien</small>MY SECONDS...'],
    catchAir: (d, p) => `Mid-air catch! ${d} ${p}% left`, catchGround: (d, p) => `Got it! ${d} ${p}% left`, pick: (d) => `Picked up (half) ${d}`, cat: '<small>Stray cat</small>Meow (took the bowl)',
    eaten: '<small>Alien</small>BUUURP... THANK YOU FOR THE MEAL', eatenNaruto: '<small>Alien</small>NARUTO GOOD',
    narutoCatch: 'Got the one naruto back', narutoWave: '<small>Chef</small>A tiny one only takes the naruto',
    sucked: 'Being sucked up!', spit: '<small>Alien</small>Ptui (tasted bad)',
    hurt: { beam: '<small>Chef</small>No time to get abducted!', laser: '<small>Chef</small>Hot! The box is scorched', drone: '<small>Chef</small>You got hit by a tiny one', missile: '<small>Chef</small>Homing shot, shake it!' },
    mBait: 'Lured it into a UFO!', mWall: 'Shook it off on a building!', near: 'CLOSE CALL!', combo: n => `x${n} chain`,
    boss: '<small>Chef</small>What is that giant bowl... bigger than ours', coreOpen: '<small>Chef</small>The naruto on the bottom is the weak spot!', bossDown: '<small>Chef</small>It is down! The stolen bowls are falling!',
    abduct: '<small>Alien</small>THIS DELIVERY... SLURP... TASTY', escaped: '<small>Alien</small>ATE EVERYTHING. WE WILL BE BACK',
    fix: '<small>Chef</small>I hammered the box back into shape', clearLine: '<small>Chef</small>Nice. Here comes the next lot',
    again: 'Again', save: 'Save image', post: 'Post on X', toTitle: 'Title',
    slip: {
      shop: 'Chuzuri-ken Chinese Diner', title: 'Delivery slip (UFO damage)', boss: 'Chef', scoreLabel: 'Recovery score', logTitle: "Today's bowls", more: n => `${n} more`,
      st: ['Bowls recovered', 'UFOs downed', 'Best chain', 'Dents in the box'], unit: ['', '', '', ''],
      how: { caught: p => `caught ${p}%`, air: p => `mid-air ${p}%`, picked: p => `picked up ${p}%`, eaten: () => 'eaten', cat: () => 'taken by a cat', taken: () => 'taken away' },
      sub: { clear: 'Mothership down', abducted: 'Courier abducted', escaped: 'Mothership escaped', quit: 'Went home early' },
      caption: 'The ram',
      stamps: ['GUARDIAN', 'STAR CREW', 'TRAINEE', 'DISHWASH', 'BANNED'],
      comments: {
        clear: 'You downed the mothership. You are defense now, not delivery', abducted: 'Keep delivering in space. Leave the slip', escaped: 'They took the bowls too. That comes out of your pay',
        few: 'Stop sightseeing and hit something', eaten: 'They slurped nearly all of it', naruto: 'You risked your life for one naruto slice', air: 'Catching bowls mid-air. A true courier', ok: 'Not bad. Get them all next time'
      }
    },
    postText: (s, n, end) => `I took back ${n} stolen bowls from UFOs in Sky Delivery: UFO Raid (${s.toLocaleString()} pts${end === 'clear' ? ', mothership down' : ''})`
  }
}
let lang = store.get('ufo.lang') || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en')
const t = k => T[lang][k]
const touchMode = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
document.body.classList.toggle('is-touch', touchMode)
function applyLang() {
  document.documentElement.lang = lang
  for (const el of document.querySelectorAll('[data-t]')) { const v = t(el.dataset.t); if (typeof v === 'string') el.textContent = v }
  $('howList').innerHTML = t('howItems').map((s, i) => `<li data-n="${'一二三四五'[i]}"><span>${s}</span></li>`).join('')
  $('howKeys').textContent = touchMode ? '' : t('keysPc')
  $('btnMute').textContent = Snd.muted ? t('muteOff') : t('muteOn')
}

// ---------------------------------------------------------------- 音（録音素材だけ）
Snd.muted = store.get('ufo.mute') === '1'
Snd.def({
  wire: ['snd/swish-1.mp3', 'snd/swish-2.mp3', 'snd/swish-3.mp3'], hook: ['snd/metalClick.mp3', 'snd/metal_02.mp3'], whoosh: 'snd/swish-5.mp3',
  land: ['snd/footstep_01.mp3', 'snd/footstep_02.mp3'], bonk: ['snd/thwack-01.mp3', 'snd/thwack-03.mp3'],
  clang: ['snd/clang_1.mp3', 'snd/clang_2.mp3'], zap: 'snd/zap.mp3', boom: 'snd/explosion.mp3', crash: 'snd/ufo_crash.mp3', ufoDown: 'snd/ufo_down.mp3', woo: 'snd/ufo_woo.mp3',
  laser: ['snd/laser_1.mp3', 'snd/laser_2.mp3'], charge: 'snd/beam_charge.mp3', suck: 'snd/beam_suck.mp3', drone: 'snd/drone_1.mp3', dpop: 'snd/drone_pop.mp3',
  siren: 'snd/siren.mp3', burp: 'snd/burp.mp3', shutter: 'snd/shutter.mp3', pop: 'snd/pop.mp3', squeak: ['snd/squeak_1.mp3', 'snd/squeak_2.mp3', 'snd/squeak_3.mp3'],
  glass: 'snd/glass_breaking_01.mp3', grunt: ['snd/grunt_01.mp3', 'snd/grunt_02.mp3', 'snd/grunt_03.mp3', 'snd/grunt_04.mp3'],
  ding: 'snd/bell_ding1.mp3', shop: 'snd/bell_01.mp3', click: 'snd/click_001.mp3', tick: 'snd/tick_002.mp3', meow: 'snd/meow.mp3',
  win: 'snd/jingles_SAX01.mp3', meh: 'snd/jingles_SAX03.mp3', lose: 'snd/jingles_PIZZA07.mp3'
})
const sfx = (n, o) => Snd.play(n, o)
const sfxAt = (n, x, z, o = {}) => { const p = me || (demo && demo.r); const d = p ? Math.hypot(x - p.x, z - p.z) : 0, k = Math.max(0, 1 - d / 120); if (k > 0.05) sfx(n, { ...o, vol: (o.vol || 1) * (0.25 + 0.75 * k) }) }

// ---------------------------------------------------------------- 描画の土台
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
renderer.setPixelRatio(Q.pixelRatio)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
setAniso(renderer)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
$('view').appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0xc9d6e2, 0.0022)
scene.background = new THREE.Color(0xa9c4e0)
const sun = new THREE.DirectionalLight(0xfff1dc, 3.0)
sun.userData.dir = new THREE.Vector3(-0.45, 0.62, -0.64).normalize()
sun.castShadow = true
sun.shadow.mapSize.set(Q.shadow, Q.shadow)
Object.assign(sun.shadow.camera, { left: -Q.shadowRange, right: Q.shadowRange, top: Q.shadowRange, bottom: -Q.shadowRange, near: 1, far: 400 })
sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.0004
scene.add(sun, sun.target)
const hemi = new THREE.HemisphereLight(0xc4d8ff, 0x6a5a48, 1.8)
scene.add(hemi)
let dayK = -1, hemiBase = 1.8
loadSky(renderer, scene, sun, () => { hemiBase = 0.4; hemi.intensity = 0.4; dayK = -1 })
const camera = new THREE.PerspectiveCamera(64, 1, 0.3, 2400)
const world = createWorld('city')
clearShopFront(world, SHOP)
const built = buildScene(scene, world)
for (const g of built.gates) g.grp.visible = false
const fx = new FX(scene, world)

// ---------------------------------------------------------------- 店
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx }
const shopGroup = new THREE.Group()
{
  const wall = new THREE.MeshStandardMaterial({ color: 0xd8cdb6, roughness: 0.9 })
  const roofM = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.7 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(7, 3.6, 5), wall); body.position.set(0, 1.8, 0); body.castShadow = body.receiveShadow = true
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.35, 5.8), roofM); roof.position.set(0, 3.75, 0)
  const sign = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.1, 0.15), new THREE.MeshStandardMaterial({ map: canvasTex(512, 104, (x, w, h) => { x.fillStyle = '#2b1d10'; x.fillRect(0, 0, w, h); x.fillStyle = '#f3ead2'; x.font = '72px "Yuji Syuku", serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('町中華 宙吊軒', w / 2, h / 2 + 4) }), roughness: 0.8 }))
  sign.position.set(0, 4.4, -2.55); sign.rotation.y = Math.PI
  const norenTex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#1f2a44'; x.fillRect(0, 0, w, h); x.fillStyle = '#f3ead2'; x.font = '64px "Yuji Syuku", serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; ['ら', 'ー', 'め'].forEach((c, i) => x.fillText(c, w * (i + 0.5) / 3, h * 0.45)); x.fillStyle = '#16203a'; for (let i = 1; i < 3; i++) x.fillRect(w * i / 3 - 2, 0, 4, h) })
  const noren = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), new THREE.MeshStandardMaterial({ map: norenTex, side: THREE.DoubleSide, roughness: 1 }))
  noren.position.set(-3.52, 2.6, 0); noren.rotation.y = -Math.PI / 2
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 14), new THREE.MeshStandardMaterial({ color: 0xc8341f, emissive: 0xc8341f, emissiveIntensity: 0.9 }))
  lantern.position.set(-3.7, 2.6, 2.1)
  const lamp = new THREE.PointLight(0xffb070, 6, 10); lamp.position.set(-4.2, 2.6, 0)
  shopGroup.add(body, roof, sign, noren, lantern, lamp)
  shopGroup.position.set(SHOP.x + 6, 0, SHOP.z)
}
scene.add(shopGroup)
const town = addTown(world, SHOP)
const poles3d = buildPoles3d(scene, buildPoles(world, SHOP))
const houses3d = buildHouses3d(scene, town)
const carsDraw = trafficPool(scene, LOW), pedsDraw = pedPool(scene, LOW)
let street = createStreet(world, 1)
const ufoView = new UfoView(scene), motherView = new MotherView(scene), atkView = new AttackView(scene)
const skyTint = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 12), new THREE.MeshBasicMaterial({ color: 0xff8a3c, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false }))
skyTint.renderOrder = -1; scene.add(skyTint)
const DAY = { fog: new THREE.Color(0xc9d6e2), dusk: new THREE.Color(0xd99a6a), night: new THREE.Color(0x141c33), sunDay: new THREE.Color(0xfff1dc), sunDusk: new THREE.Color(0xffa060), sunNight: new THREE.Color(0x9fb4ff), tDusk: new THREE.Color(0xff7a30), tNight: new THREE.Color(0x0b1430) }
const _c1 = new THREE.Color()
function applyDayTime(k) {
  if (Math.abs(k - dayK) < 0.002) return
  dayK = k
  const dusk = Math.max(0, Math.min(1, (k - 0.35) / 0.3)), night = Math.max(0, Math.min(1, (k - 0.65) / 0.3))
  _c1.copy(DAY.fog).lerp(DAY.dusk, dusk).lerp(DAY.night, night); scene.fog.color.copy(_c1)
  sun.color.copy(DAY.sunDay).lerp(DAY.sunDusk, dusk).lerp(DAY.sunNight, night)
  sun.intensity = 3.0 - dusk * 1.3 - night * 1.35
  hemi.intensity = hemiBase * (1 - night * 0.45)
  scene.environmentIntensity = 1 - dusk * 0.25 - night * 0.45
  scene.backgroundIntensity = 1 - dusk * 0.2 - night * 0.55
  skyTint.material.color.copy(DAY.tDusk).lerp(DAY.tNight, night)
  skyTint.material.opacity = dusk * 0.5 * (1 - night) + night * 0.8
  renderer.toneMappingExposure = 1 + night * 0.18
  const lit = Math.max(0, Math.min(1, (k - 0.55) / 0.2))
  poles3d.bulbMat.emissiveIntensity = lit * 2.4
  houses3d.winMat.emissiveIntensity = lit * 1.6
  houses3d.vendMat.emissiveIntensity = 0.3 + lit * 1.1
  shopGroup.children.forEach(o => { if (o.isPointLight) o.intensity = 6 + lit * 10 })
  carLights(lit)
}
const ropeMat = new THREE.MeshBasicMaterial({ color: 0x2b2b2b }), ropeUfoMat = new THREE.MeshBasicMaterial({ color: 0xffd27a })
const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5), ropeMat)
ropeMesh.visible = false; scene.add(ropeMesh)
const aimMark = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.9, depthTest: false }))
aimMark.renderOrder = 5; aimMark.visible = false; scene.add(aimMark)
// UFO の照準: 細い赤い輪と4つの角
const aimUfoMark = new THREE.Group()
{
  const m = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.75, depthTest: false })
  aimUfoMark.add(new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 40), m))
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.32), m); const a = i * Math.PI / 2; b.position.set(Math.sin(a) * 1.12, Math.cos(a) * 1.12, 0); b.rotation.z = -a; aimUfoMark.add(b) }
  aimUfoMark.children.forEach(o => { o.renderOrder = 5 }); aimUfoMark.visible = false; scene.add(aimUfoMark)
}

// ---------------------------------------------------------------- 状態
let mode = 'title'
let me = null, R = null, model = null, demo = null
let paused = false, dbgPause = false, endAt = 0, photo = null, photoScore = -1, quitEnd = false
let hitStop = 0, fovKick = 0, flashA = 0, redA = 0
let tut = false, tutSeen = {}
const cam = { hd: -Math.PI / 2, pitch: 0.15, userT: -1e9, pos: new THREE.Vector3(), off: new THREE.Vector3(-6, 3, 0), look: new THREE.Vector3(), lookOff: new THREE.Vector3(), fov: 64 }
const _v = new THREE.Vector3(), _w = new THREE.Vector3()
function spawnRunner(id) { return createRunner({ id, spawn: { x: SHOP.x - 9, y: 0, z: SHOP.z, yaw: Math.PI / 2 } }) }
function newModel() { if (model) { scene.remove(model.group); model.dispose() } model = charAssets.ready ? new CharRunnerModel() : new RunnerModel(); scene.add(model.group); return model }
loadCharAssets().then(() => { if (charAssets.ready && model && !(model instanceof CharRunnerModel)) newModel() })

// ---------------------------------------------------------------- 入力
const keys = new Set()
const press = { jump: false }
let pendingWire = null
addEventListener('keydown', e => {
  if (mode !== 'play') return
  if (e.repeat) return
  keys.add(e.code)
  if (e.code === 'KeyE') pendingWire = { at: null, key: true }
  if (e.code === 'Space') { press.jump = true; e.preventDefault() }
  if (e.code === 'Escape' || e.code === 'KeyP') setPause(!paused)
})
addEventListener('keyup', e => keys.delete(e.code))
const gest = new Map()
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
renderer.domElement.addEventListener('pointerdown', e => {
  Snd.init()
  if (mode !== 'play' || paused) return
  gest.set(e.pointerId, { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: false })
})
addEventListener('pointermove', e => {
  const g = gest.get(e.pointerId); if (!g) return
  const dx = e.clientX - g.lx, dy = e.clientY - g.ly; g.lx = e.clientX; g.ly = e.clientY
  if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12) g.moved = true
  if (!g.moved) return
  cam.hd -= dx * 0.00792; cam.pitch = Math.max(-0.9, Math.min(1, cam.pitch + dy * 0.00528)); cam.userT = performance.now()
})
addEventListener('pointerup', e => {
  const g = gest.get(e.pointerId); if (!g) return
  gest.delete(e.pointerId)
  if (!g.moved && performance.now() - g.t < 450 && mode === 'play' && !paused) aimAt(e.clientX, e.clientY)
})
addEventListener('pointercancel', e => gest.delete(e.pointerId))
// 画面のタップ: UFO に当たればそれを引っかける（ビルより手前なら UFO）。ほかはビル・地面のワイヤー。ワイヤー中なら外す
function aimAt(cx, cy) {
  const rc = renderer.domElement.getBoundingClientRect()
  ndc.set((cx - rc.left) / rc.width * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const o = ray.ray.origin, d = ray.ray.direction
  const hu = R && rayUfo(R, o.x, o.y, o.z, d.x, d.y, d.z, 400)
  if (me && me.rope && !(hu && me.rope.ufo !== hu.u.id && me.rope.ufo == null)) { pendingWire = { at: null, sx: cx, sy: cy }; return }
  const minT = me ? Math.max(0, (me.x - o.x) * d.x + (me.y + 1 - o.y) * d.y + (me.z - o.z) * d.z - 1) : 0
  const b = rayHit(world, o.x, o.y, o.z, d.x, d.y, d.z, 400, minT)
  const tb = b ? Math.hypot(b.x - o.x, b.y - o.y, b.z - o.z) : Infinity
  if (hu && hu.t < tb + 2) {
    // ビルのワイヤー中に UFO をタッチ: いったん外して、次の歩で UFO へ
    if (me && me.rope) { me.rope = null; me.events.push({ t: 'unwire', auto: true }) }
    pendingWire = { at: { ufo: hu.u.id, x: hu.u.x, y: hu.u.y, z: hu.u.z }, sx: cx, sy: cy }; return
  }
  let at = b
  if (me && !me.grounded && !me.climbing) {
    const g = groundRay(o, d, RUN.wireRange + 60)
    if (g && !(tb < g.t + 6)) at = { x: g.x, y: g.y, z: g.z, ground: true }
  }
  pendingWire = { at, sx: cx, sy: cy }
}
function groundRay(o, d, maxT) {
  const below = t => { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; return y <= floorAt(world, x, z, y).h }
  for (let t = 1; t < maxT; t += 1) {
    if (!below(t)) continue
    let a = t - 1, b2 = t
    for (let i = 0; i < 6; i++) { const m = (a + b2) / 2; if (below(m)) b2 = m; else a = m }
    const x = o.x + d.x * b2, z = o.z + d.z * b2
    return { x, y: floorAt(world, x, z, o.y + d.y * b2 + 0.5).h, z, t: b2 }
  }
  return null
}
const stick = { x: 0, y: 0, id: null }
{
  const el = $('stick'), knob = el.querySelector('.knob')
  const ctr = () => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width / 2 } }
  const upd = e => {
    const c = ctr()
    let dx = (e.clientX - c.x) / c.R, dy = (e.clientY - c.y) / c.R
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l }
    stick.x = dx; stick.y = dy; knob.style.transform = `translate(${dx * 36}px,${dy * 36}px)`
  }
  const grab = e => { stick.id = e.pointerId; el.classList.add('held'); upd(e) }
  el.addEventListener('pointerdown', e => { Snd.init(); if (stick.id != null) return; e.preventDefault(); e.stopPropagation(); grab(e) })
  addEventListener('pointermove', e => {
    if (e.pointerId === stick.id) { upd(e); return }
    if (stick.id == null && gest.has(e.pointerId)) { const c = ctr(); if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < c.R) { gest.delete(e.pointerId); grab(e) } }
  }, true)
  const end = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; el.classList.remove('held') }
  addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true)
  window.__stickCenter = () => ctr()
  for (const b of document.querySelectorAll('.tbtn')) b.addEventListener('pointerdown', e => {
    e.preventDefault(); Snd.init()
    const k = b.dataset.k
    if (k === 'wire') pendingWire = { at: null, key: true }
    else press[k] = true
  })
}
function screenBasis() { const e = camera.matrixWorld.elements; let rx = e[0], rz = e[2], fx = -e[8], fz = -e[10]; const a = Math.hypot(rx, rz) || 1, b = Math.hypot(fx, fz) || 1; return { r: { x: rx / a, z: rz / a }, f: { x: fx / b, z: fz / b } } }
const blockedFn = (ax, ay, az, bx, by, bz) => blocked(world, ax, ay, az, bx, by, bz)
// 大きいボタン（E）: 前の UFO があればそれ、無ければ前の上のビル
function autoTarget(yaw) {
  if (!me || !R) return null
  const u = aimUfo(R, me, yaw, RUN.wireRange - 2, blockedFn)
  return u ? { ufo: u.id, x: u.x, y: u.y, z: u.z } : null
}
function gather() {
  let thr = 0, brk = 0, steer = 0, wallY = null, wallX = null
  if (keys.has('KeyW') || keys.has('ArrowUp')) thr = 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) brk = 1
  if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1
  const B = screenBasis(), SR = B.r, SF = B.f
  let moveDir = null
  if (stick.id != null) {
    const mag = Math.min(1, Math.hypot(stick.x, stick.y))
    if (mag > 0.15) {
      const dx = SR.x * stick.x - SF.x * stick.y, dz = SR.z * stick.x - SF.z * stick.y, l = Math.hypot(dx, dz) || 1
      moveDir = { x: dx / l, z: dz / l }; steer = 0; thr = Math.max(thr, Math.min(1, mag * 1.3))
    }
    if (me.climbing) {
      const cl = me.climbing, sideSign = SR.x * cl.nz - SR.z * cl.nx >= 0 ? 1 : -1
      wallY = Math.abs(stick.y) > 0.25 ? -stick.y : 0; wallX = Math.abs(stick.x) > 0.25 ? stick.x * sideSign : 0
    }
  }
  const inp = { throttle: thr, brake: brk, steer, jump: press.jump, wire: false, wallY, wallX, moveDir }
  inp.wireYaw = moveDir ? Math.atan2(moveDir.x, moveDir.z) : touchMode ? Math.atan2(SF.x, SF.z) : undefined
  if (pendingWire) {
    inp.wire = true
    if (pendingWire.at) inp.wireAt = pendingWire.at
    else if (pendingWire.key && !me.rope) { const a = autoTarget(Math.atan2(SF.x, SF.z)); if (a) inp.wireAt = a }
    me._tap = pendingWire; pendingWire = null
  }
  press.jump = false
  return inp
}

// ---------------------------------------------------------------- 画面の切り替え
function show(id) { for (const s of ['title', 'how', 'pause', 'result']) $(s).classList.toggle('hidden', s !== id); $('hud').classList.toggle('hidden', mode !== 'play') }
function newDemo() { const s = Math.floor(Math.random() * 1000); demo = { r: spawnRunner('demo'), b: createUfoBot('skilled', s) }; R = createRaid(world, s) }
function toTitle() {
  mode = 'title'; paused = false; me = null
  newDemo(); newModel()
  for (const [, el] of tagEls) el.remove(); tagEls.clear()
  show('title'); $('touch').classList.add('hidden')
  Snd.loop('bgm', 'snd/bgm_title.mp3', 0.22); Snd.loop('amb', 'snd/city_street_loop.wav', 0.2); Snd.loop('hum', null); Snd.loop('wind', null)
}
function startRaid(seed = Math.floor(Math.random() * 1e6)) {
  Snd.init(); sfx('click')
  if (window.TM) TM.start()
  tut = store.get('ufo.tut') !== '1'; tutSeen = {}
  mode = 'play'; paused = false; demo = null; photo = null; photoScore = -1; endAt = 0; quitEnd = false
  me = spawnRunner('me'); R = createRaid(world, seed, { tut }); R.seed = seed; street = createStreet(world, seed)
  log.length = 0
  newModel()
  cam.hd = Math.PI / 2; cam.pitch = 0.12; cam.userT = -1e9
  show(null); $('touch').classList.toggle('hidden', !touchMode)
  Snd.loop('bgm', 'snd/bgm_play.mp3', 0.16); Snd.loop('amb', 'snd/city_street_loop.wav', 0.24); Snd.loop('wind', 'snd/wind_loop.wav', 0.0001); Snd.loop('hum', 'snd/loop_machine_03.mp3', 0.0001)
  say(`<small>${t('masterName')}</small>${t('masterLine')}`, 2.6)
  sfx('woo', { vol: 0.7 })
  masterT = 12; filmT = 9
}
function setPause(p) { if (mode !== 'play') return; paused = p; $('pause').classList.toggle('hidden', !p) }

// ---------------------------------------------------------------- 画面の文字
let sayT = 0, sayPri = 0
function say(html, sec = 1.8, pri = 0) { if (sayT > 0.4 && pri < sayPri) return; const el = $('say'); el.className = 'say'; el.innerHTML = html; sayT = sec; sayPri = pri }
let bannerT = 0
function banner(s, b) { $('bannerS').textContent = s; $('bannerB').textContent = b; const el = $('banner'); el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop'); bannerT = 2.2 }
let nearT = 0
function pop(txt, sub = '') { const el = $('near'); $('nearTxt').textContent = txt; $('nearN').textContent = sub; el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop'); nearT = 0.9 }
function hint(k, txt) { if (!tut || tutSeen[k] || mode !== 'play') return; tutSeen[k] = true; say(txt, 3, 2) }
const dishName = d => d[lang]
let masterT = 12, filmT = 9
const tagEls = new Map()
function updateHud(dt) {
  const S = R.stats, inBoss = !!R.boss
  $('tWave').textContent = inBoss ? t('bossW') : t('wave')(Math.max(1, R.wave + 1))
  const fly = R.ufos.filter(u => u.state === 'fly' && u.kind !== 'pod' && u.kind !== 'core')
  $('tLine1').textContent = inBoss ? t('bossName') : t('ufoLeft')(fly.length)
  const worst = fly.filter(u => u.bowl).reduce((a, u) => Math.min(a, u.bowl.left), 101)
  $('tLine2').textContent = worst <= 100 ? t('eatingW')(Math.round(worst)) : ''
  $('tBack').textContent = t('backN')(S.caught + S.picked)
  const sc = summary(R).score; if ($('tScore')._v !== sc) { $('tScore')._v = sc; $('tScore').textContent = sc.toLocaleString() }
  const pips = $('okPips'), ok = $('okamochi')
  if (pips._b !== R.box) {
    pips._b = R.box
    pips.innerHTML = Array.from({ length: U.box }, (_, i) => `<i class="${i < R.box ? 'on' : ''}"></i>`).join('')
    const dents = U.box - R.box
    $('okDents').innerHTML = Array.from({ length: dents }, (_, i) => { const x = 18 + i * 15, y = 26 + (i % 2) * 36; return `<path d="M${x} ${y} l7 5 l-4 4 l8 3" fill="none" stroke="#4a4f56" stroke-width="2.6" stroke-linejoin="round"/><ellipse cx="${x + 5}" cy="${y + 6}" rx="7" ry="5" fill="#000" opacity=".12"/>` }).join('')
    ok.classList.toggle('low', R.box <= 2)
  }
  const bb = $('bossbar')
  bb.classList.toggle('hidden', !inBoss || R.boss.state === 'arrive'); $('hud').classList.toggle('boss', inBoss)
  if (inBoss) {
    const B = R.boss, hp = B.pods.reduce((a, p) => a + Math.max(0, p.hp), 0) + (B.core ? Math.max(0, B.core.hp) : BOSS.coreHp), max = BOSS.pods * BOSS.podHp + BOSS.coreHp
    $('bbHp').style.transform = `scaleX(${(hp / max).toFixed(3)})`
    $('bbLeft').textContent = t('bossLeft')(Math.max(0, Math.ceil(B.left)))
  }
  if (sayT > 0) { sayT -= dt; $('say').classList.toggle('hidden', sayT <= 0) }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.add('hidden') }
  if (nearT > 0) { nearT -= dt; if (nearT <= 0) $('near').classList.add('hidden') }
  // いちばん近い UFO（落ちている丼が近ければ丼）の方角
  let tgt = null, td = 1e9
  for (const u of R.ufos) { if (u.state !== 'fly') continue; const d = Math.hypot(u.x - me.x, u.z - me.z); if (d < td) { td = d; tgt = u } }
  const bw = R.bowls.find(b => b.state === 'fall' || b.state === 'ground'); if (bw) { const d = Math.hypot(bw.x - me.x, bw.z - me.z); if (d < td + 25) { tgt = bw; td = d } }
  const ar = $('arrow')
  ar.classList.toggle('hidden', !tgt)
  ar.classList.toggle('bowl', !!bw && tgt === bw)
  if (tgt) { $('arrowD').textContent = Math.round(td) + 'm'; ar.querySelector('svg').style.transform = `rotate(${compassAng(tgt.x, tgt.z)}rad)` }
  // 方角の矢印は伝票と岡持ちのあいだ（画面の大きさが変わった時だけ測る）
  if (ar._W !== innerWidth || ar._H !== innerHeight) { ar._W = innerWidth; ar._H = innerHeight; const a = $('ticket').getBoundingClientRect(), b = $('okamochi').getBoundingClientRect(); ar.style.left = Math.round((a.right + b.left) / 2) + 'px' }
  // UFO の上の札（すすられている丼の残りと体力）
  const W = innerWidth, H = innerHeight, seen = new Set()
  for (const u of R.ufos) {
    if (u.state !== 'fly' || (R.boss && R.boss.state === 'arrive')) continue
    _v.set(u.x, u.y + u.hh * (u.kind === 'big' ? 1.6 : 1) + 2.4, u.z).project(camera)
    if (_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) continue
    if (camera.position.distanceTo(_w.set(u.x, u.y, u.z)) > 170) continue
    seen.add(u.id)
    let el = tagEls.get(u.id)
    if (!el) { el = document.createElement('div'); el.className = 'tag'; el.innerHTML = '<span class="tg-bowl"><i></i></span><span class="tg-hp"></span>'; $('tags').appendChild(el); tagEls.set(u.id, el) }
    el.style.transform = `translate(${((_v.x + 1) / 2 * W).toFixed(0)}px,${((1 - _v.y) / 2 * H).toFixed(0)}px) translate(-50%,-100%)`
    const k = u.bowl ? u.bowl.left : -1, key = Math.round(k) + ':' + u.hp
    if (el._k !== key) {
      el._k = key
      const bo = el.querySelector('.tg-bowl')
      bo.style.display = k < 0 ? 'none' : ''
      bo.querySelector('i').style.transform = `scaleX(${Math.max(0, k / 100).toFixed(2)})`
      bo.classList.toggle('low', k >= 0 && k < 35)
      el.querySelector('.tg-hp').innerHTML = '<b></b>'.repeat(Math.max(0, u.hp))
    }
  }
  for (const [id, el] of tagEls) if (!seen.has(id)) { el.remove(); tagEls.delete(id) }
  // 照準（追尾弾の溜め・近くを飛んでいる追尾弾）
  const locking = R.ufos.some(u => u.atk === 'missile') || R.missiles.some(m => Math.hypot(m.x - me.x, m.y - me.y, m.z - me.z) < 45)
  const lk = $('lock'); lk.classList.toggle('hidden', !locking)
  if (locking) { _v.set(me.x, me.y + 1.1, me.z).project(camera); lk.style.transform = `translate(${((_v.x + 1) / 2 * W).toFixed(0)}px,${((1 - _v.y) / 2 * H).toFixed(0)}px) translate(-50%,-50%)` }
}
function compassAng(gx, gz) {
  camera.updateMatrixWorld()
  const e = camera.matrixWorld.elements, fx = -e[8], fz = -e[10], rx = -fz, rz = fx
  const dx = gx - me.x, dz = gz - me.z
  return Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz)
}

// ---------------------------------------------------------------- 出来事
const log = []
function onRunnerEvent(e) {
  log.push({ src: 'r', ...e, at: R ? +R.t.toFixed(2) : 0 })
  if (e.t === 'wire') { sfx('wire', { vol: 0.7 }); sfx('hook', { vol: 0.5, delay: 0.06 }); if (e.ufo != null) { sfx('zap', { vol: 0.35, rate: 1.4 }); fovKick = 4 } }
  else if (e.t === 'wireMiss') {
    sfx('wire', { vol: 0.4, rate: 1.3 })
    const tp = me._tap
    if (e.far && tp && tp.sx != null) { const el = $('miss'); el.style.left = tp.sx + 'px'; el.style.top = tp.sy + 'px'; el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 800) }
  }
  else if (e.t === 'land') { sfx('land', { vol: Math.min(1, 0.3 + e.impact / 20) }); if (e.impact > 14) { sfx('bonk', { vol: 0.5 }); fx.addShake(Math.min(0.6, e.impact / 40)) } }
  else if (e.t === 'bonk') { sfx('bonk', { vol: 0.8 }); fx.addShake(0.4) }
  else if (e.t === 'unwire' && !e.auto) { const v = Math.hypot(me.vx, me.vy, me.vz); if (v > 16) { sfx('whoosh', { vol: Math.min(0.8, v / 50), rate: 0.9 + Math.random() * 0.2 }); fovKick = Math.min(6, (v - 16) * 0.3) } }
  else if (e.t === 'ped') { sfx('bonk', { vol: 0.6, rate: 1.2 }); fx.addShake(0.3) }
  else if (e.t === 'car') { sfx('bonk', { vol: 1, rate: 0.8 }); fx.addShake(0.7) }
}
function onRaidEvent(e) {
  log.push({ src: 'u', ...e, at: +R.t.toFixed(2) })
  if (mode !== 'play') { if (e.t === 'crash') boomFx(e.x, e.y, e.z, 0.6); return }
  if (e.t === 'wave') {
    banner(t('waveS')(e.n), t('waveB')(e.n)); sfx('woo', { vol: 0.8 }); sfx('shop', { vol: 0.5, delay: 0.3 })
    if (e.naruto) setTimeout(() => { if (mode === 'play') say(t('narutoWave'), 2.4) }, 2400)
    if (e.n === 1) setTimeout(() => hint('hook', touchMode ? t('hintHook') : t('hintHookPc')), 2600)
  }
  else if (e.t === 'extra') { say(t('extra'), 2); sfx('woo', { vol: 0.6, rate: 1.1 }) }
  else if (e.t === 'waveClear') { sfx('ding', { vol: 0.8 }); say(e.fix ? t('fix') : t('clearLine'), 2.4, 1); if (e.fix) sfx('clang', { vol: 0.4, delay: 0.3 }); if (e.n === 1 && tut) store.set('ufo.tut', '1') }
  else if (e.t === 'ram') {
    sfx('clang', { vol: 0.9, rate: e.dmg >= 3 ? 0.8 : 1 }); sfx('zap', { vol: 0.5 })
    hitStop = 0.04 + e.dmg * 0.025; flashA = Math.min(1, 0.4 + e.dmg * 0.2); fovKick = -4 - e.dmg * 2; fx.addShake(0.25 + e.dmg * 0.18)
    fx.sparks(e.cx, e.cy, e.cz, 10 + e.dmg * 8, null, 8 + e.dmg * 4); fx.flash(e.cx, e.cy, e.cz)
    pop(t('ram')(e.dmg), e.combo >= 2 ? t('combo')(e.combo) : Math.round(e.v) + ' m/s')
    const sc = e.dmg * 40 + e.v + (e.kill ? 60 : 0); if (sc > photoScore) { photoScore = sc; snapNext = 2 }
  }
  else if (e.t === 'boing') { sfx('squeak', { vol: 0.7 }); if (Math.random() < 0.5) say(t('boing'), 1.4) }
  else if (e.t === 'down') { sfx('ufoDown', { vol: 0.8 }); sfx('grunt', { vol: 0.6, rate: 1.9, delay: 0.1 }); if (e.kind !== 'pod' && e.kind !== 'core') say(pick(t('down')), 1.5); setTimeout(() => hint('bowl', t('hintBowl')), 900) }
  else if (e.t === 'crash') { boomFx(e.x, e.y, e.z, e.kind === 'big' || e.kind === 'core' ? 1.4 : 1); sfxAt('boom', e.x, e.z, { vol: 1 }); sfxAt('crash', e.x, e.z, { vol: 0.7, delay: 0.1 }) }
  else if (e.t === 'catch') {
    sfx('pop', { vol: 0.9 }); sfx('ding', { vol: 0.8, delay: 0.05 }); hitStop = 0.06; flashA = 0.8; fovKick = -6; fx.addShake(0.3)
    fx.debrisAt(e.x, e.y, e.z, 14, 0xffe2a0, { speed: 6, up: 4, size: 0.1 })
    say(e.naruto ? t('narutoCatch') : (e.air ? t('catchAir') : t('catchGround'))(dishName(e.dish), e.left), 1.8, 1)
    if (e.combo >= 2) pop(t('combo')(e.combo), '+' + e.pts)
  }
  else if (e.t === 'pick') { sfx('pop', { vol: 0.7, rate: 0.9 }); say(t('pick')(dishName(e.dish)), 1.6, 1) }
  else if (e.t === 'cat') { sfx('meow', { vol: 0.8 }); say(t('cat'), 1.8, 1) }
  else if (e.t === 'bowlLand') { sfxAt('glass', e.x, e.z, { vol: 0.4, rate: 1.3 }) }
  else if (e.t === 'eaten') { sfxAt('burp', e.x, e.z, { vol: 1 }); say(e.naruto ? t('eatenNaruto') : t('eaten'), 2, 1) }
  else if (e.t === 'beamWarn') { sfxAt('charge', e.x, e.z, { vol: 0.7 }); hint('beam', t('hintBeam')) }
  else if (e.t === 'beamOn') { sfxAt('suck', e.x, e.z, { vol: 0.7 }) }
  else if (e.t === 'sucked') { sfx('suck', { vol: 0.9, rate: 0.8 }); say(t('sucked'), 1.2, 2) }
  else if (e.t === 'spit') { sfx('squeak', { vol: 0.7, rate: 0.7 }); say(t('spit'), 1.6, 1) }
  else if (e.t === 'hurt') {
    redA = 0.9; hitStop = 0.07; fx.addShake(1); sfx('grunt', { vol: 0.9 }); sfx('clang', { vol: 0.6, rate: 0.7 })
    const ok = $('okamochi'); ok.classList.remove('hit'); void ok.offsetWidth; ok.classList.add('hit')
    if (e.box > 0 && e.src !== 'beam') say(t('hurt')[e.src] || '', 1.4, 1)
  }
  else if (e.t === 'laserWarn') { sfxAt('tick', e.x, e.z, { vol: 0.8 }); sfxAt('tick', e.x, e.z, { vol: 0.8, delay: 0.25 }); hint('laser', t('hintLaser')) }
  else if (e.t === 'laserOn') { sfx('laser', { vol: 0.8 }) }
  else if (e.t === 'droneOut') { sfxAt('drone', e.x, e.z, { vol: 0.6 }) }
  else if (e.t === 'droneKill') { sfx('dpop', { vol: 0.8 }); fx.sparks(e.x, e.y, e.z, 14, null, 9); hitStop = 0.03; if (e.combo >= 2) pop(t('combo')(e.combo)) }
  else if (e.t === 'droneBoom' || e.t === 'droneFizz') { sfxAt('dpop', e.x, e.z, { vol: 0.6, rate: 0.7 }); fx.smoke(e.x, e.y, e.z, { size: 1.2, life: 0.8 }) }
  else if (e.t === 'lock') { sfxAt('charge', e.x, e.z, { vol: 0.9, rate: 1.5 }); hint('lock', t('hintLock')) }
  else if (e.t === 'fire') { sfxAt('laser', e.x, e.z, { vol: 0.7, rate: 0.8 }) }
  else if (e.t === 'mBoom') { boomFx(e.x, e.y, e.z, 0.4); sfxAt('boom', e.x, e.z, { vol: 0.5, rate: 1.4 }); if (e.wall && me && Math.hypot(e.x - me.x, e.z - me.z) < 30) pop(t('mWall')) }
  else if (e.t === 'mBait') { pop(t('mBait')); sfx('ding', { vol: 0.7 }); fx.addShake(0.4) }
  else if (e.t === 'near') { flashA = Math.max(flashA, 0.4); fovKick = -5; sfx('whoosh', { vol: 0.8, rate: 0.85 }); sfx('ding', { vol: 0.35, rate: 1.3 }); pop(t('near')) }
  else if (e.t === 'boss') { cam.pitch = Math.min(cam.pitch, -0.45); banner(t('bossS'), t('bossB')); sfx('siren', { vol: 0.5 }); sfx('woo', { vol: 0.9, rate: 0.7 }); say(t('boss'), 3, 2) }
  else if (e.t === 'coreOpen') { say(t('coreOpen'), 2.6, 2); sfx('siren', { vol: 0.4, rate: 1.2 }) }
  else if (e.t === 'bossDown') {
    banner(t('clearS'), t('clearB')); say(t('bossDown'), 3, 2); hitStop = 0.12; flashA = 1; fx.addShake(1.4)
    for (let i = 0; i < 6; i++) setTimeout(() => { const B = R && R.boss; if (B && mode === 'play') { boomFx(B.x + (Math.random() - 0.5) * 30, B.y + (Math.random() - 0.5) * 6, B.z + (Math.random() - 0.5) * 30, 1.3); sfx('boom', { vol: 0.9, rate: 0.7 + Math.random() * 0.3 }) } }, i * 260)
  }
  else if (e.t === 'abduct') { say(t('abduct'), 3.4, 3); sfx('suck', { vol: 1, rate: 0.6 }); sfx('woo', { vol: 0.8, delay: 0.6 }) }
  else if (e.t === 'end') { if (e.how === 'escaped') { say(t('escaped'), 3, 3); sfx('woo', { vol: 0.9, rate: 0.6 }) } endAt = e.how === 'abducted' ? 0.8 : 2.4 }
}
function boomFx(x, y, z, k = 1) {
  fx.flash(x, y, z); fx.sparks(x, y, z, Math.round(18 * k), null, 12 * k)
  for (let i = 0; i < 5 * k; i++) fx.smoke(x, y + 0.5, z, { size: 3 * k, life: 1.8, vy: 2.4, dark: 0.18 })
  fx.debrisAt(x, y, z, Math.round(10 * k), 0x8a929c, { speed: 8 * k, up: 6, size: 0.3 })
  const p = me || (demo && demo.r)
  if (p) fx.addShake(Math.max(0, 0.9 * k - Math.hypot(x - p.x, z - p.z) / 80))
}
let snapNext = 0

// ---------------------------------------------------------------- 結果
function showResult() {
  if (mode !== 'play') return
  mode = 'result'
  Snd.loop('wind', null); Snd.loop('bgm', null); Snd.loop('hum', null)
  const s = summary(R), L = t('slip'), ja = lang === 'ja'
  const end = quitEnd ? 'quit' : R.end || 'quit'
  const rows = R.log.map(b => {
    const p = b.left
    const note = b.how === 'caught' ? (b.air ? L.how.air(p) : L.how.caught(p)) : b.how === 'picked' ? L.how.picked(Math.round(p / 2)) : L.how[b.how] ? L.how[b.how]() : b.how
    return { text: dishName(b.dish), note, bad: b.how === 'eaten' || b.how === 'cat', good: b.how === 'caught' && b.air }
  })
  for (const u of R.ufos) if (u.bowl) rows.push({ text: dishName(u.bowl.dish), note: L.how.taken(), bad: true })
  const rank = s.score >= RANKS[0] ? 0 : s.score >= RANKS[1] ? 1 : s.score >= RANKS[2] ? 2 : s.score >= RANKS[3] ? 3 : 4
  const C = L.comments
  const narutoOnly = R.log.some(b => b.dish.id === 'naruto' && b.how === 'caught') && s.back <= 2
  const comment = end === 'clear' ? C.clear : s.back <= 1 && !narutoOnly ? C.few : narutoOnly ? C.naruto : end === 'abducted' ? C.abducted : end === 'escaped' ? C.escaped : s.eaten >= 3 ? C.eaten : s.caught >= 6 ? C.air : C.ok
  const d0 = new Date()
  const d = {
    shop: L.shop, title: L.title, boss: L.boss, scoreLabel: L.scoreLabel, logTitle: L.logTitle, more: L.more,
    date: `${d0.getFullYear()}.${String(d0.getMonth() + 1).padStart(2, '0')}.${String(d0.getDate()).padStart(2, '0')}`, sub: L.sub[end] || '',
    photo, caption: L.caption,
    stats: [[L.st[0], `${s.back}${L.unit[0]}`, false], [L.st[1], `${s.downed}${L.unit[1]}`, false], [L.st[2], `${s.bestCombo}${L.unit[2]}`, false], [L.st[3], `${s.hurt}${L.unit[3]}`, s.hurt >= 4]],
    rows, score: s.score.toLocaleString() + (ja ? '点' : ' pts'), comment, stamp: L.stamps[rank], footer: 'tom3games.github.io/ufo-demae'
  }
  drawSlip($('slip'), d)
  sfx(rank <= 1 ? 'win' : rank <= 2 ? 'meh' : 'lose', { vol: 0.8 })
  $('btnPost').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(t('postText')(s.score, s.back, end)) + '&url=' + encodeURIComponent(URL_)
  $('touch').classList.add('hidden')
  for (const [, el] of tagEls) el.remove(); tagEls.clear()
  show('result')
  window.__lastScore = s.score; window.__lastSummary = { ...s, end, rank }
  if (window.TM) TM.end(s.score, end === 'clear')
}
$('btnPost').addEventListener('click', () => { if (window.TM) TM.share('x') })
$('btnSave').onclick = () => { if (window.TM) TM.share('save'); $('slip').toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'ufo-demae-slip.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }) }
$('btnStart').onclick = () => startRaid()
$('btnAgain').onclick = () => startRaid()
$('btnTitle').onclick = () => toTitle()
$('btnHow').onclick = () => { Snd.init(); show('how') }
for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => show('title')
$('btnLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; store.set('ufo.lang', lang); applyLang() }
$('btnMute').onclick = () => { Snd.init(); Snd.setMute(!Snd.muted); store.set('ufo.mute', Snd.muted ? '1' : '0'); applyLang() }
$('btnPause').onclick = () => setPause(true)
$('btnResume').onclick = () => setPause(false)
$('btnQuit').onclick = () => { setPause(false); quitEnd = true; R.over = true; showResult() }

// ---------------------------------------------------------------- カメラ
const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k }
function updateCamera(dt, c) {
  if (window.__freeze) return
  const pos = model.group.position
  const v = Math.hypot(c.vx, c.vz)
  let hx = Math.sin(c.yaw), hz = Math.cos(c.yaw)
  if (v > 8) { const k = c.grounded ? 0.25 : 0.45; hx = hx * (1 - k) + (c.vx / v) * k; hz = hz * (1 - k) + (c.vz / v) * k; const l = Math.hypot(hx, hz); hx /= l; hz /= l }
  const manual = touchMode || performance.now() - cam.userT < 1800
  if (!manual) { cam.hd = lerpAngle(cam.hd, Math.atan2(hx, hz), 1 - Math.exp(-dt * (touchMode ? 2.2 : 5))); cam.pitch += ((R && R.boss ? -0.45 : 0.08) - cam.pitch) * (1 - Math.exp(-dt * 1.5)) }
  hx = Math.sin(cam.hd); hz = Math.cos(cam.hd)
  let back = 5.6 + Math.min(2.4, v * 0.07), up = 2.1
  if (camera.aspect < 1) { back += 0.8; up += 0.5 }
  const abd = R && R.sucked && R.sucked.final
  if (abd) { back += 6; up -= 3 }   // 連れ去られる場面: 下から見上げる
  up += cam.pitch * 4.2; back *= 1 - Math.max(0, cam.pitch) * 0.15
  let tx = pos.x - hx * back, tz = pos.z - hz * back, ty = pos.y + up
  for (let i = 1; i <= 6; i++) {
    const f = i / 6, px = pos.x + (tx - pos.x) * f, pz = pos.z + (tz - pos.z) * f, py = pos.y + (ty - pos.y) * f
    let hit = false
    for (const o of world.nearby(px, pz)) {
      if (o.slab || o.kind === 'bound' || o.y0 == null || py < o.y0 || py > o.y1) continue
      const cs = Math.cos(o.yaw || 0), sn = Math.sin(o.yaw || 0), dx = px - o.cx, dz = pz - o.cz
      if (Math.abs(dx * cs - dz * sn) < o.hw + 0.4 && Math.abs(dx * sn + dz * cs) < o.hl + 0.4) { hit = true; break }
    }
    if (hit) { const ff = Math.max(0.25, (i - 1) / 6); tx = pos.x + (tx - pos.x) * ff; tz = pos.z + (tz - pos.z) * ff; ty = pos.y + up * 0.8 + (1 - ff) * 2; break }
  }
  const gy = world.groundAt(tx, tz, ty).h + 0.8
  if (ty < gy) ty = gy
  cam.off.lerp(_v.set(tx - pos.x, ty - pos.y, tz - pos.z), 1 - Math.exp(-dt * 10))
  cam.pos.set(pos.x + cam.off.x, pos.y + cam.off.y, pos.z + cam.off.z)
  cam.lookOff.lerp(_v.set(hx * 10, (camera.aspect < 1 ? 3.4 : 2.6) + 1.3 - cam.pitch * 1.6 + Math.max(0, -cam.pitch) * 12 + (abd ? 6 : 0), hz * 10), 1 - Math.exp(-dt * 12))
  cam.look.set(pos.x + cam.lookOff.x, pos.y + cam.lookOff.y, pos.z + cam.lookOff.z)
  camera.position.copy(cam.pos)
  const sh_ = fx.shake
  if (sh_ > 0) camera.position.add(_v.set((Math.random() - 0.5) * sh_, (Math.random() - 0.5) * sh_ * 0.7, (Math.random() - 0.5) * sh_))
  camera.lookAt(cam.look)
  const asp = camera.aspect
  const base = asp >= 1 ? 60 : Math.min(84, 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(37)) / asp) * 180 / Math.PI)
  const fov = base + Math.min(18, Math.max(0, Math.hypot(c.vx, c.vy, c.vz) - 6) * 0.5)
  cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 4))
  fovKick *= Math.exp(-dt * 6)
  camera.fov = cam.fov + fovKick; camera.updateProjectionMatrix()
  const me_ = camera.matrixWorld.elements, rl = Math.hypot(me_[0], me_[2]) || 1, lat = (c.vx * me_[0] + c.vz * me_[2]) / rl
  cam.bank = (cam.bank || 0) + (Math.max(-0.1, Math.min(0.1, (c.rope ? lat : 0) * -0.004)) - (cam.bank || 0)) * (1 - Math.exp(-dt * 3))
  camera.rotateZ(cam.bank)
}

// ---------------------------------------------------------------- ループ
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); fx.setScale && fx.setScale(h) }
addEventListener('resize', resize); resize()
let last = performance.now(), acc = 0, frameN = 0
function stepOnce() {
  if (mode === 'play' && !paused && me && !R.over) {
    const inp = gather()
    me.events.length = 0
    street.update(STEP, me)
    syncRope(R, me)
    stepRunner(me, inp, STEP, world)
    street.collide(me)
    stepRaid(R, me, STEP)
    for (const e of me.events) onRunnerEvent(e)
    for (const e of R.events) onRaidEvent(e)
    R.events.length = 0
  } else if (mode === 'title' && demo) {
    const inp = ufoBotInput(demo.b, demo.r, R, world, STEP)
    demo.r.events.length = 0
    street.update(STEP, demo.r); syncRope(R, demo.r); stepRunner(demo.r, inp, STEP, world); street.collide(demo.r)
    stepRaid(R, demo.r, STEP)
    for (const e of R.events) onRaidEvent(e)
    R.events.length = 0
    if (R.over || R.t > 70 || R.sucked) newDemo()
  } else if (mode === 'play' && R && R.over) {
    if (R.sucked) { me.y += STEP * 5; me.yaw += STEP * 9 }   // 連れ去られていく（結果の前に少し見せる）
    if (R.end === 'escaped' && R.boss) { R.boss.y += STEP * 16; R.boss.spin += STEP * 2 }   // 母船が丼を持って帰っていく
  }
}
function frame() {
  requestAnimationFrame(frame)
  const now = performance.now()
  let dt = Math.min(0.1, (now - last) / 1000); last = now
  if (hitStop > 0) { hitStop -= dt; acc = 0 }
  else if (!dbgPause) { acc += dt; let n = 0; while (acc >= STEP && n < 6) { stepOnce(); acc -= STEP; n++ } if (n >= 6) acc = 0 }
  else dt = 0
  render(dt || 0.016)
}
const spd = $('speedfx'), sctx = spd.getContext('2d'), hf = $('hitflash'), rf = $('redflash')
const lines = Array.from({ length: 46 }, () => ({ a: Math.random() * Math.PI * 2, p: Math.random(), s: 0.6 + Math.random() * 0.8, w: 1 + Math.random() * 2 }))
let spdOn = false
function drawSpeed(v, dt) {
  if (!window.__holdFx) { flashA = Math.max(0, flashA - dt * 5); redA = Math.max(0, redA - dt * 2.4) }
  hf.style.opacity = flashA.toFixed(2); rf.style.opacity = redA.toFixed(2)
  const k = Math.max(0, Math.min(1, (v - 20) / 18))
  window.__speedK = k
  if (k <= 0) { if (spdOn) { sctx.clearRect(0, 0, spd.width, spd.height); spdOn = false } return }
  spdOn = true
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1)
  if (spd.width !== Math.round(W * dpr) || spd.height !== Math.round(H * dpr)) { spd.width = Math.round(W * dpr); spd.height = Math.round(H * dpr) }
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.clearRect(0, 0, W, H)
  const cx = W / 2, cy = H * 0.45, Rr = Math.hypot(W, H) * 0.55
  sctx.lineCap = 'round'
  const n = Math.round(lines.length * (0.35 + 0.65 * k))
  for (let i = 0; i < n; i++) {
    const L = lines[i]
    L.p += dt * L.s * (1.6 + k * 2.4); if (L.p > 1) { L.p -= 1; L.a = Math.random() * Math.PI * 2 }
    const r1 = Rr * (1.05 - L.p * 0.45), r0 = r1 - Rr * (0.12 + 0.2 * k) * L.s
    const ca = Math.cos(L.a), sa = Math.sin(L.a)
    sctx.strokeStyle = `rgba(255,255,255,${(0.1 + 0.32 * k) * Math.min(1, L.p * 4)})`; sctx.lineWidth = L.w
    sctx.beginPath(); sctx.moveTo(cx + ca * r0, cy + sa * r0); sctx.lineTo(cx + ca * r1, cy + sa * r1); sctx.stroke()
  }
}
function render(dt) {
  const c = mode === 'title' ? demo && demo.r : me
  const now = performance.now() / 1000
  if (c && model) {
    model.update(c, dt)
    model.okamochi.visible = true
    if (c.rope) {
      const h = model.handWorld, isU = c.rope.ufo != null
      ropeMesh.visible = true; ropeMesh.material = isU ? ropeUfoMat : ropeMat
      ropeMesh.position.copy(h); ropeMesh.lookAt(c.rope.x, c.rope.y, c.rope.z); ropeMesh.scale.set(isU ? 2.2 : 1, isU ? 2.2 : 1, Math.max(0.1, h.distanceTo(_v.set(c.rope.x, c.rope.y, c.rope.z))))
    } else ropeMesh.visible = false
    updateCamera(dt, c)
    const d = sun.userData.dir; sun.position.set(c.x + d.x * 150, c.y + d.y * 150, c.z + d.z * 150); sun.target.position.set(c.x, c.y, c.z)
  }
  if (R) {
    ufoView.update(R, dt, now); motherView.update(R.boss, now); atkView.update(R, dt, now, (x, z, y) => floorAt(world, x, z, y + 0.5).h)
    if (frameN % 3 === 0) for (const u of R.ufos) if (u.state === 'fall') fx.smoke(u.x, u.y, u.z, { size: 2, life: 1.2, vy: 1, dark: 0.15 })
  }
  // 大きいボタン（E）で掛かる所に輪（UFO なら赤い照準）
  aimMark.visible = false; aimUfoMark.visible = false
  if (mode === 'play' && me && !me.rope && frameN % 4 === 0) {
    const SF = screenBasis().f, u = autoTarget(Math.atan2(SF.x, SF.z))
    aimMark.userData.p = u || findAnchor(world, me, touchMode ? Math.atan2(SF.x, SF.z) : undefined); aimMark.userData.ufo = !!u
  }
  const aimOn = mode === 'play' && me && !me.rope && !!aimMark.userData.p
  if (aimOn) {
    const p = aimMark.userData.p, isU = aimMark.userData.ufo
    const uu = isU && R.ufos.find(q => q.id === p.ufo)
    if (uu && Math.hypot(uu.x - me.x, uu.y - me.y, uu.z - me.z) > 10) { aimUfoMark.visible = true; aimUfoMark.position.set(uu.x, uu.y, uu.z); aimUfoMark.lookAt(camera.position); aimUfoMark.rotateZ(now * 1.5); aimUfoMark.scale.setScalar(uu.r * 1.15 * (1 + Math.sin(now * 8) * 0.05)) }
    else if (!isU) { aimMark.visible = true; aimMark.position.set(p.x, p.y, p.z); aimMark.lookAt(camera.position); aimMark.scale.setScalar(Math.max(1, camera.position.distanceTo(aimMark.position) * 0.04)) }
  }
  const wb = document.querySelector('.tbtn[data-k=wire]'); if (wb) { const k = aimOn ? (aimMark.userData.ufo ? 'u' : 'b') : ''; if (wb._aim !== k) { wb._aim = k; wb.classList.toggle('aim', !!k); wb.classList.toggle('aim-ufo', k === 'u') } }
  if (mode === 'play' && me) {
    const v3 = Math.hypot(me.vx, me.vy, me.vz); const wl = Snd.loops.wind; if (wl && wl.g) { const gv = me.grounded ? 0 : Math.min(0.35, Math.max(0, (v3 - 16) / 40)); wl.g.gain.value = Number.isFinite(gv) ? gv : 0 }
    const hl = Snd.loops.hum; if (hl && hl.g) { let nd = 1e9; for (const u of R.ufos) if (u.state === 'fly') nd = Math.min(nd, Math.hypot(u.x - me.x, u.y - me.y, u.z - me.z)); const gv = Math.min(0.22, Math.max(0, 1 - nd / 50) * 0.22); hl.g.gain.value = Number.isFinite(gv) ? gv : 0 }
  }
  drawSpeed(mode === 'play' && me ? Math.hypot(me.vx, me.vy, me.vz) : 0, dt)
  carsDraw.draw(street.traffic.cars, camera.position, dt); pedsDraw.draw(street.peds, camera.position, dt)
  applyDayTime(R ? (R.boss ? 0.62 + Math.min(0.2, R.boss.t / 400) : Math.max(0, R.wave) * 0.14) : 0)
  skyTint.position.copy(camera.position)
  fx.update(dt)
  fx.shake = Math.max(0, fx.shake - dt * 2.5)
  if (mode === 'play' && R) {
    updateHud(dt)
    if (!paused && !R.over && dt > 0) {
      masterT -= dt; if (masterT <= 0) { masterT = 13 + Math.random() * 7; if (R.phase === 'wave') say(pick(t('master')), 2.2) }
      filmT -= dt
      if (filmT <= 0) {
        filmT = 10 + Math.random() * 8
        const p = street.peds.find(q => Math.hypot(q.x - me.x, q.z - me.z) < 45)
        if (p && (R.phase === 'wave' || R.phase === 'boss')) { sfxAt('shutter', p.x, p.z, { vol: 0.5 }); fx.emit(p.x, 1.6, p.z, { life: 0.25, size: 3, grow: 2, r: 1, g: 1, b: 1, a: 0.9, add: true }); if (Math.random() < 0.6) say(pick(t('film')), 1.8) }
      }
    }
    if (endAt > 0) { endAt -= dt; if (endAt <= 0) showResult() }
  }
  renderer.render(scene, camera)
  if (snapNext > 0 && --snapNext === 0) { const c2 = document.createElement('canvas'); c2.width = 640; c2.height = Math.round(640 * innerHeight / innerWidth); c2.getContext('2d').drawImage(renderer.domElement, 0, 0, c2.width, c2.height); photo = c2 }
  frameN++
}

// ---------------------------------------------------------------- 検証用の窓口
window.ufo = {
  get mode() { return mode }, log, get hitStop() { return hitStop }, get flashA() { return flashA }, get fovKick() { return fovKick }, get me() { return me }, get R() { return R }, RUN, U, world, camera, touchMode, cam, renderer, fx,
  start: seed => startRaid(seed), toTitle, showResult, setLang: l => { lang = l; applyLang() }, get lang() { return lang },
  // 画面の座標（検証で本物の指・マウスで押すため）
  ufoXY: id => { const u = R && R.ufos.find(q => q.id === id); if (!u) return null; camera.updateMatrixWorld(); _v.set(u.x, u.y, u.z).project(camera); return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight, z: _v.z } },
  pointXY: (x, y, z) => { camera.updateMatrixWorld(); _v.set(x, y, z).project(camera); return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight, z: _v.z } },
  dbg: {
    pause: on => { dbgPause = on }, step: n => { for (let i = 0; i < n; i++) stepOnce(); render(STEP) },
    teleport: (x, y, z, yaw) => { Object.assign(me, { x, y, z, vx: 0, vy: 0, vz: 0, rope: null, climbing: null, grounded: y < 0.1 }); if (yaw != null) me.yaw = yaw },
    pressWire: (sx, sy) => aimAt(sx, sy), wireAuto: () => { pendingWire = { at: null, key: true } }, pressJump: () => { press.jump = true },
    keys, stick, say, get model() { return model },
    render: n => { for (let i = 0; i < n; i++) render(1 / 30) },
    // 目の前に UFO を置く（撮影と検証用）
    placeUfo: (id, dist = 14, up = 6, side = 0) => {
      const u = R.ufos.find(q => q.id === id) || R.ufos.find(q => q.state === 'fly'); if (!u) return null
      const fx = Math.sin(cam.hd), fz = Math.cos(cam.hd)
      u.x = me.x + fx * dist + fz * side; u.z = me.z + fz * dist - fx * side; u.y = me.y + up; u.tx = u.x; u.tz = u.z; u.vx = u.vy = u.vz = 0; u.alt = u.y; u.retarget = u.t + 999; u.frozen = true
      return u.id
    },
    lookAt: (x, z) => { cam.hd = Math.atan2(x - me.x, z - me.z); cam.userT = performance.now() },
    setBox: n => { R.box = n },
    anchor: () => findAnchor(world, me, cam.hd),
    // 画面上で、タップするとビルに掛かる点を探す（検証で本物のクリックに使う）
    screenAnchor: () => {
      camera.updateMatrixWorld()
      for (let sy = 0.18; sy < 0.6; sy += 0.04) for (let sx = 0.15; sx < 0.86; sx += 0.05) {
        ndc.set(sx * 2 - 1, -(sy * 2 - 1)); ray.setFromCamera(ndc, camera)
        const o = ray.ray.origin, d = ray.ray.direction, h = rayHit(world, o.x, o.y, o.z, d.x, d.y, d.z, 400, Math.max(0, (me.x - o.x) * d.x + (me.y + 1 - o.y) * d.y + (me.z - o.z) * d.z - 1))
        if (h && !h.pole && h.y > me.y + 4 && Math.hypot(h.x - me.x, h.y - me.y - 1.5, h.z - me.z) < RUN.wireRange - 5 && !(R && rayUfo(R, o.x, o.y, o.z, d.x, d.y, d.z, 400))) return { x: sx * innerWidth, y: sy * innerHeight, hit: h }
      }
      return null
    },
    clearUfos: () => { for (const u of R.ufos) { u.x += 400; u.tx = u.x; u.frozen = true } R.beams.length = 0; R.lasers.length = 0; R.drones.length = 0; R.missiles.length = 0 },
    stepUntil: (fn, max = 3000) => { const f = new Function('ufo', 'return ' + fn); for (let i = 0; i < max; i++) { stepOnce(); if (f(window.ufo)) { render(STEP); return i + 1 } } render(STEP); return -1 }
  }
}
applyLang()
toTitle()
requestAnimationFrame(frame)
bootWatch(() => { window.__ufoReady = true })
