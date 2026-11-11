// 廃都迎撃（ufo-demae v2）。空中出前（sky-delivery）の街を侵攻のあとの廃墟にして、ワイヤーで UFO を落とすアクション
// UFO に体当たり（速いほど強い）・UFO をタッチして引っかけて引き寄せ体当たり・着地せずに当て続けると倍率が上がる
import * as THREE from 'three'
import { GAME } from '../shared/config.js?v=1'
import { createWorld } from '../shared/track.js?v=1'
import { buildScene } from './scene.js?v=1'
import { FX } from './fx.js?v=1'
import { setAniso, lazyStart } from './look.js?v=1'
import { Q, LOW } from './quality.js?v=1'
import { RunnerModel } from './runnermodel.js?v=1'
import { CharRunnerModel, loadCharAssets, charAssets } from './charmodel.js?v=1'
import { createRunner, stepRunner, findAnchor, rayHit, floorAt, blocked, RUN } from '../shared/runner.js?v=1'
import { createStreet, buildPoles } from '../shared/street.js?v=1'
import { addTown, clearShopFront } from '../shared/town.js?v=1'
import { buildPoles3d, buildHouses3d, trafficPool } from './street3d.js?v=1'
import { carLights } from './carmodel.js?v=1'
import { createRaid, stepRaid, syncRope, rayUfo, canDash, dashDist, startDash, addUfo, summary, BASE, RANKS, U, BOSS, WAVES, multOf } from '../shared/ufo.js?v=1'
import { createUfoBot, ufoBotInput } from '../shared/ufobot.js?v=1'
import { UfoView, MotherView, AttackView } from './ufo3d.js?v=1'
import { drawReport } from './report.js?v=1'
import { makeSky, buildRuin, PALETTE } from './ruin.js?v=1'
import { addRuinMap } from '../shared/ruinmap.js?v=1'
import { facadeTime } from './facade.js?v=1'

const $ = id => document.getElementById(id)
window.__bootSet && window.__bootSet(0.35)
const STEP = GAME.step
const URL_ = 'https://tom3games.github.io/ufo-demae/'
const store = { get: k => { try { return localStorage.getItem(k) } catch (e) { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch (e) {} } }
const pick = a => a[Math.floor(Math.random() * a.length)]

// ---------------------------------------------------------------- 文言（日英）
const T = {
  ja: {
    series: '侵攻から3日目', logo: '廃都迎撃', logoSub: 'UFOを落とせ', intro: '街に残ったのは、ワイヤー1本と、あなただけ',
    start: '出撃', how: '作戦指示', lang: 'EN', more: 'ほかのゲーム', muteOn: '音 入', muteOff: '音 切', loading: '通信を確立中',
    howTitle: '作戦指示書', ok: '了解',
    howItems: [
      'ビルや鉄塔にワイヤーを掛けて振る。速さ8以上で<b>突撃</b>（右下の大ボタン・近くのUFOをタッチ）',
      '突撃は<b>必ず当たる</b>。威力は速さ。落ちながらの<b>急降下</b>は1.4倍',
      'シールドは<b>ひび</b>で半分。撃った直後の赤紫の所は<b>2倍</b>',
      '<b>追跡機</b>はビルの隙間を抜けると激突する。光線は<b>ビルの陰</b>なら届かない'
    ],
    hintHook: '<small>管制</small>ビルに掛けて振れ。照準が水色になったら大ボタンで突撃', hintHookPc: '<small>管制</small>ビルをクリックして振れ（Eで前のビル）。照準が水色ならFかUFOをクリックで突撃',
    needSwing: 'ビルで振ってから', needSpeed: '速さが足りない', noLine: '建物の陰', dashL: '突撃', speedL: '速さ',
    hintShield: '<small>管制</small>シールドだ。撃った直後に開く。速く当たれば破れる', hintHunt: '<small>管制</small>追跡機だ。止まるな。ビルの隙間を抜けろ、ぶつけてやれ', hintZap: '<small>管制</small>掛けっぱなしにするな。切られるぞ',
    hintBeam: '<small>管制</small>足元の輪から離れろ。上から焼かれる', hintLock: '<small>管制</small>追尾弾だ。急に曲がるか、ビルの陰へ', hintLaser: '<small>管制</small>赤紫の線の上から横へ逃げろ', hintChain: '<small>管制</small>着地するな。当て続ければ倍率が上がる',
    keysPc: 'PC: WASD・矢印で移動　クリックでワイヤー（UFOなら引っかける）　E は前のUFOへ自動　Space ジャンプ　ドラッグで見回す',
    credit: '音: Kenney, rubberduck, artisticdude, bretbernhoft, aquinn, Effebit ほか（CC0・Public domain）。詳しくは CREDITS.md',
    waveL: n => `第${n}波 / 4`, bossW: '母艦', podsL: n => `砲台 ${n}`, coreL: '芯が露出', ufoLeft: n => `敵 ${n}機`, chainL: n => `${n}連鎖`,
    tooFar: '届かない', packCap: '電池', jump: '跳ぶ', lockOn: 'ロックオン', pause: '中断', paused: '作戦中断', resume: '再開', quit: '撤退する（やめる）',
    bossName: '母艦', bossLeft: s => `主砲まで ${s}秒`,
    waveS: n => n === 1 ? '敵影、接近' : n === 4 ? '最終波' : '次の敵影', waveB: n => `第${n}波`,
    bossS: '上空に巨大な反応', bossB: '母艦', clearS: '母艦 撃墜', clearB: '作戦完了', burnS: '主砲', burnB: '発射',
    extra: '<small>管制</small>増援を確認。まだ来る',
    radio: ['<small>管制</small>光線はビルの陰には届かない', '<small>管制</small>高い所から落ちながら突撃しろ。重いぞ', '<small>管制</small>撃った直後を狙え。シールドが開いている', '<small>管制</small>速く振ってから突撃しろ。一撃で落ちる', '<small>管制</small>突撃の後はすぐ次のビルに掛けろ', '<small>管制</small>着地するな。連鎖が切れる', '<small>管制</small>追尾弾はビルに当てて消せ', '<small>管制</small>赤紫の線は横に逃げろ', '<small>管制</small>小型は逃げる。先に落とせ', '<small>管制</small>…こちら管制。まだ生きてるか', '<small>管制</small>北の高台は無事だ。持ちこたえろ', '<small>管制</small>ドローンには飛んだまま当たれ'],
    ram: n => n >= 3 ? '会心' : n === 2 ? '直撃' : '命中', boing: '<small>管制</small>遅すぎる。もっと速く当てろ',
    down: { saucer: '撃墜', big: '砲艦 撃墜', scout: '小型 撃墜', pod: '砲台 破壊', core: '芯 破壊' },
    hurt: { beam: '焼かれた', laser: '切られた', drone: 'ドローンに被弾', missile: '追尾弾に被弾', hunter: '追跡機に衝突' },
    hunters: '<small>管制</small>母艦から追跡機が出た。挟まれるな',
    crack: 'ひび', open: '撃ち抜いた x2', counter: '迎え撃ち', dive: '急降下', shaken: '振り切った', hunterCrash: '激突', cover: 'ビルが盾に', lunge: '突っ込んでくる',
    mBait: '誘導命中', mWall: 'ビルでふり切った', near: 'ギリギリ', multUp: m => `倍率 x${m}`, droneKill: 'ドローン破壊', chainEnd: n => `${n}連鎖`,
    scouts: '<small>管制</small>小型がいる。逃げ足が速い', big: '<small>管制</small>砲艦だ。追尾弾に気をつけろ',
    boss: '<small>管制</small>母艦だ。動きを追って縁の砲台から落とせ', coreOpen: '<small>管制</small>芯が出た。そこが弱点だ', bossDown: '<small>管制</small>母艦が落ちる…！', mainCannon: '<small>管制</small>主砲が来る…街が…',
    taken: '<small>管制</small>応答しろ…応答…', lowHp: '<small>管制</small>電池が残りわずかだ',
    fix: '<small>管制</small>予備の電池を落とした。1本回復', clearLine: (n, s) => `<small>管制</small>第${n}波を排除（${s}秒）`, perfect: '無傷',
    again: '再出撃', save: '画像を保存', post: 'Xでポスト', toTitle: 'タイトル',
    report: {
      unit: '第7迎撃班', title: '作戦報告書', callsign: '迎撃員', dayLabel: '侵攻 3日目',
      sub: { clear: '母艦撃墜　作戦成功', taken: '迎撃員 消息不明', burned: '主砲発射　街は焼かれた', quit: '途中で撤退' },
      st: ['撃墜', '最高倍率', '最大連鎖', 'ギリギリ', '被弾', '到達'], reached: w => w > 4 ? '母艦' : `第${w}波`,
      scoreLabel: '戦果', caption: '最高の一撃', rankLabel: '評価', commander: '管制',
      rankName: ['廃都の英雄', '撃墜王', '迎撃員', '新兵', '訓練生'],
      comments: {
        clear: '母艦が落ちた。北の高台から歓声が聞こえる。よくやった', taken: '最後の通信は途中で切れた。君の電池は回収した', burned: '主砲は止められなかった。だが君の戦果は残る',
        few: '空を見上げているだけでは落ちない。当たりに行け', chain: '着地せずに落とし続けた。あれは見事だった', ok: '悪くない。次は母艦まで行け', quit: '撤退も判断のうちだ。次は最後まで'
      }
    },
    postText: (s, r, end) => `廃都迎撃で ${s.toLocaleString()}点（評価${r}${end === 'clear' ? '・母艦撃墜' : ''}）`
  },
  en: {
    series: 'Day 3 of the invasion', logo: 'RUIN INTERCEPT', logoSub: 'Bring the UFOs down', intro: 'All that is left in the city: one wire, and you.',
    start: 'Deploy', how: 'Briefing', lang: 'JP', more: 'More games', muteOn: 'Sound on', muteOff: 'Muted', loading: 'Establishing link',
    howTitle: 'BRIEFING', ok: 'Copy',
    howItems: [
      'Swing from buildings and towers. At 8 m/s or faster you can <b>dash</b> (big button, or tap a nearby UFO)',
      'The dash <b>always hits</b>. Power is your speed. Dashing while falling is a <b>dive</b> (x1.4)',
      'Shields <b>crack</b> for half damage. Hit the magenta glow right after it fires for <b>x2</b>',
      '<b>Hunters</b> crash into walls if you slip through gaps. Beams cannot reach you <b>behind buildings</b>'
    ],
    hintHook: '<small>HQ</small>Swing from buildings. When the reticle turns cyan, dash with the big button', hintHookPc: '<small>HQ</small>Click buildings to swing (E for the one ahead). Cyan reticle: F or click the UFO to dash',
    needSwing: 'Swing first', needSpeed: 'Too slow', noLine: 'Blocked', dashL: 'DASH', speedL: 'Speed',
    hintShield: '<small>HQ</small>Shielded. It opens after firing. A fast hit breaks through', hintHunt: '<small>HQ</small>Hunter. Keep moving. Thread the gaps and make it crash', hintZap: '<small>HQ</small>Do not hang on. It will cut your wire',
    hintBeam: '<small>HQ</small>Out of the ring. It burns from above', hintLock: '<small>HQ</small>Homing shot. Turn hard or break line of sight', hintLaser: '<small>HQ</small>Get off the magenta line, sideways', hintChain: '<small>HQ</small>Do not land. Keep hitting to raise the multiplier',
    keysPc: 'PC: WASD / arrows move · click to wire (click a UFO to hook it) · E hooks the UFO ahead · Space jump · drag to look',
    credit: 'Sounds: Kenney, rubberduck, artisticdude, bretbernhoft, aquinn, Effebit and others (CC0 / public domain). See CREDITS.md',
    waveL: n => `Wave ${n} / 4`, bossW: 'Mothership', podsL: n => `${n} turrets`, coreL: 'Core exposed', ufoLeft: n => `${n} hostiles`, chainL: n => `${n} chain`,
    tooFar: 'Too far', packCap: 'Cells', jump: 'Jump', lockOn: 'LOCKED', pause: 'Pause', paused: 'Paused', resume: 'Resume', quit: 'Retreat (quit)',
    bossName: 'Mothership', bossLeft: s => `Main cannon in ${s}s`,
    waveS: n => n === 1 ? 'Contacts inbound' : n === 4 ? 'Final wave' : 'More contacts', waveB: n => `Wave ${n}`,
    bossS: 'Massive signal overhead', bossB: 'Mothership', clearS: 'Mothership down', clearB: 'Mission complete', burnS: 'Main cannon', burnB: 'FIRING',
    extra: '<small>HQ</small>Reinforcements spotted',
    radio: ['<small>HQ</small>Beams cannot reach you behind buildings', '<small>HQ</small>Dash while falling from high up. It hits harder', '<small>HQ</small>Hit them right after they fire. The shield is open', '<small>HQ</small>Swing fast, then dash. One hit drops them', '<small>HQ</small>After a dash, wire the next building', '<small>HQ</small>Do not land. You will lose the chain', '<small>HQ</small>Lure homing shots into buildings', '<small>HQ</small>Magenta lines: move sideways', '<small>HQ</small>Small ones run. Take them first', '<small>HQ</small>...HQ here. Still alive?', '<small>HQ</small>The north hill is holding. Hang on', '<small>HQ</small>Hit drones while airborne'],
    ram: n => n >= 3 ? 'CRITICAL' : n === 2 ? 'DIRECT' : 'HIT', boing: '<small>HQ</small>Too slow. Hit it harder',
    down: { saucer: 'DOWN', big: 'GUNSHIP DOWN', scout: 'SCOUT DOWN', pod: 'TURRET DOWN', core: 'CORE DOWN' },
    hurt: { beam: 'Burned', laser: 'Cut', drone: 'Drone hit', missile: 'Homing hit', hunter: 'Rammed by hunter' },
    hunters: '<small>HQ</small>Hunters launched from the mothership. Do not get pinched',
    crack: 'CRACK', open: 'PIERCED x2', counter: 'HEAD-ON', dive: 'DIVE', shaken: 'SHOOK IT', hunterCrash: 'CRASHED', cover: 'COVER', lunge: 'INCOMING',
    mBait: 'LURED HIT', mWall: 'SHOOK IT OFF', near: 'CLOSE CALL', multUp: m => `x${m} MULTIPLIER`, droneKill: 'DRONE DOWN', chainEnd: n => `${n} chain`,
    scouts: '<small>HQ</small>Scouts. They are quick', big: '<small>HQ</small>Gunship. Watch for homing shots',
    boss: '<small>HQ</small>Mothership. Chase it and take out the rim turrets', coreOpen: '<small>HQ</small>The core is exposed. Hit it', bossDown: '<small>HQ</small>It is going down...!', mainCannon: '<small>HQ</small>Main cannon... the city...',
    taken: '<small>HQ</small>Respond... respond...', lowHp: '<small>HQ</small>Your cells are almost gone',
    fix: '<small>HQ</small>Dropped you a spare cell. +1', clearLine: (n, s) => `<small>HQ</small>Wave ${n} cleared (${s}s)`, perfect: 'NO DAMAGE',
    again: 'Redeploy', save: 'Save image', post: 'Post on X', toTitle: 'Title',
    report: {
      unit: '7th Intercept Unit', title: 'MISSION REPORT', callsign: 'Interceptor', dayLabel: 'Invasion day 3',
      sub: { clear: 'Mothership down / success', taken: 'Interceptor missing', burned: 'Main cannon fired / city burned', quit: 'Retreated' },
      st: ['Kills', 'Best mult', 'Best chain', 'Close calls', 'Hits taken', 'Reached'], reached: w => w > 4 ? 'Mothership' : `Wave ${w}`,
      scoreLabel: 'SCORE', caption: 'Best hit', rankLabel: 'RANK', commander: 'HQ',
      rankName: ['HERO OF THE RUINS', 'ACE', 'INTERCEPTOR', 'ROOKIE', 'CADET'],
      comments: {
        clear: 'The mothership is down. We can hear cheering from the north hill', taken: 'Your last transmission cut out. We recovered your cells', burned: 'We could not stop the cannon. Your kills still count',
        few: 'Looking up will not bring them down. Go hit them', chain: 'You kept them falling without landing. Beautiful', ok: 'Not bad. Reach the mothership next time', quit: 'Retreat is a call too. Finish it next time'
      }
    },
    postText: (s, r, end) => `I scored ${s.toLocaleString()} in RUIN INTERCEPT (rank ${r}${end === 'clear' ? ', mothership down' : ''})`
  }
}
let lang = store.get('ufo.lang') || ((navigator.language || 'ja').startsWith('ja') ? 'ja' : 'en')
const t = k => T[lang][k]
const touchMode = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
document.body.classList.toggle('is-touch', touchMode)
function applyLang() {
  document.documentElement.lang = lang
  for (const el of document.querySelectorAll('[data-t]')) { const v = t(el.dataset.t); if (typeof v === 'string') el.textContent = v }
  $('howList').innerHTML = t('howItems').map((s, i) => `<li data-n="0${i + 1}"><span>${s}</span></li>`).join('')
  $('howKeys').textContent = touchMode ? '' : t('keysPc')
  $('btnMute').textContent = Snd.muted ? t('muteOff') : t('muteOn')
}

// ---------------------------------------------------------------- 音（録音素材だけ）
Snd.muted = store.get('ufo.mute') === '1'
Snd.def({
  wire: ['snd/swish-1.mp3', 'snd/swish-2.mp3', 'snd/swish-3.mp3'], hook: ['snd/metalClick.mp3', 'snd/metal_02.mp3'], whoosh: 'snd/swish-5.mp3',
  land: ['snd/footstep_01.mp3', 'snd/footstep_02.mp3'], bonk: ['snd/thwack-01.mp3', 'snd/thwack-03.mp3'],
  clang: ['snd/clang_1.mp3', 'snd/clang_2.mp3'], zap: 'snd/zap.mp3', boom: 'snd/explosion.mp3', crash: 'snd/ufo_crash.mp3', ufoDown: 'snd/ufo_down.mp3', woo: 'snd/ufo_woo.mp3',
  laser: ['snd/laser_1.mp3', 'snd/laser_2.mp3'], charge: 'snd/beam_charge.mp3', burn: 'snd/beam_suck.mp3', drone: 'snd/drone_1.mp3', dpop: 'snd/drone_pop.mp3',
  siren: 'snd/siren.mp3', glass: 'snd/glass_breaking_01.mp3', grunt: ['snd/grunt_01.mp3', 'snd/grunt_02.mp3', 'snd/grunt_03.mp3', 'snd/grunt_04.mp3'],
  click: 'snd/click_001.mp3', tick: 'snd/tick_002.mp3', radio: ['snd/radio_1.mp3', 'snd/radio_2.mp3']
})
const sfx = (n, o) => Snd.play(n, o)
const sfxAt = (n, x, z, o = {}) => { const p = me || (demo && demo.r); const d = p ? Math.hypot(x - p.x, z - p.z) : 0, k = Math.max(0, 1 - d / 120); if (k > 0.05) sfx(n, { ...o, vol: (o.vol || 1) * (0.25 + 0.75 * k) }) }

// ---------------------------------------------------------------- 描画の土台
const renderer = new THREE.WebGLRenderer({ antialias: !LOW, powerPreference: 'high-performance', preserveDrawingBuffer: true })
renderer.setPixelRatio(Q.pixelRatio)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.12
setAniso(renderer)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
$('view').appendChild(renderer.domElement)
const scene = new THREE.Scene()
const FOG_D = 0.0052
scene.fog = new THREE.FogExp2(PALETTE.fog.getHex(), FOG_D)
// 低い夕日（煙越しの橙）と、空の紫・地面の焦げ茶の照り返し
const sun = new THREE.DirectionalLight(PALETTE.sun.getHex(), 1.9)
sun.userData.dir = new THREE.Vector3(-0.62, 0.32, -0.71).normalize()
sun.castShadow = true
sun.shadow.mapSize.set(Q.shadow, Q.shadow)
Object.assign(sun.shadow.camera, { left: -Q.shadowRange, right: Q.shadowRange, top: Q.shadowRange, bottom: -Q.shadowRange, near: 1, far: 400 })
sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.0004
scene.add(sun, sun.target)
const hemi = new THREE.HemisphereLight(PALETTE.hemiSky.getHex(), PALETTE.hemiGround.getHex(), 1.35)
scene.add(hemi)
const sky = makeSky(renderer, scene, sun.userData.dir)
const camera = new THREE.PerspectiveCamera(64, 1, 0.3, 2400)
const world = createWorld('city')
clearShopFront(world, BASE)
const built = buildScene(scene, world)
for (const g of built.gates) g.grp.visible = false
const fx = new FX(scene, world)
const town = addTown(world, BASE)
addRuinMap(world)
const poles3d = buildPoles3d(scene, buildPoles(world, BASE))
const houses3d = buildHouses3d(scene, town)
const carsDraw = trafficPool(scene, LOW)
// 街灯は全部消えている。家の窓も暗い。自販機だけ切れかけ
poles3d.bulbMat.emissiveIntensity = 0; houses3d.winMat.emissiveIntensity = 0; houses3d.winMat.color.setHex(0x0e1114); carLights(0)
const ruin = buildRuin(scene, world, { low: LOW })
ruin.setFog(FOG_D)
// 火花の散る電線（開始地点の近くの電柱から4本）
const sparkPosts = (town.fill.posts || []).filter(q => q.post === 'pole').sort((a, b) => Math.hypot(a.cx - BASE.x, a.cz - BASE.z) - Math.hypot(b.cx - BASE.x, b.cz - BASE.z)).slice(0, 4)
// 乗り捨てられた車（止まったまま・焼けた色）
let street = createStreet(world, 1)
function parkCars(st, seed) {
  const R0 = (seed * 9301 + 49297) % 233280
  st.traffic.update(30 + R0 % 200, 0, [[BASE.x, BASE.z]])
  st.traffic.cars.forEach((c, i) => {
    const h = ((i * 2654435761 + R0) >>> 0) / 4294967296
    c.yaw += (h - 0.5) * 1.4; c.x += Math.sin(c.yaw + 1.6) * (h - 0.5) * 3; c.vx = c.vz = 0; c.speed = 0
    c.color = [0x2a2624, 0x3a2e28, 0x4a4440, 0x5a3a2a, 0x23262a, 0x6a6460][i % 6]
  })
  st.peds.length = 0
}
parkCars(street, 1)
const ufoView = new UfoView(scene), motherView = new MotherView(scene), atkView = new AttackView(scene)
// ワイヤー: 明るい水色の芯＋外側の淡い光（2026-11-09 本人「ワイヤーが黒だと見にくい」。暗い廃都でも空でも見える）
const ropeMat = new THREE.MeshBasicMaterial({ color: 0xd8fbff, fog: false }), ropeUfoMat = ropeMat
const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5), ropeMat)
const ropeGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: 0x3fd8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))
ropeMesh.add(ropeGlow); ropeMesh.renderOrder = 4; ropeGlow.renderOrder = 4
ropeMesh.visible = false; scene.add(ropeMesh)
const aimMark = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0xffa04a, transparent: true, opacity: 0.9, depthTest: false }))
aimMark.renderOrder = 5; aimMark.visible = false; scene.add(aimMark)
// UFO の照準: 細い輪と4つの角
const aimUfoMark = new THREE.Group()
{
  const m = new THREE.MeshBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0.85, depthTest: false })
  aimUfoMark.add(new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 40), m))
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.32), m); const a = i * Math.PI / 2; b.position.set(Math.sin(a) * 1.12, Math.cos(a) * 1.12, 0); b.rotation.z = -a; aimUfoMark.add(b) }
  aimUfoMark.children.forEach(o => { o.renderOrder = 5 }); aimUfoMark.visible = false; scene.add(aimUfoMark)
}

// ---------------------------------------------------------------- 状態
let mode = 'title'
let me = null, R = null, model = null, demo = null
let paused = false, dbgPause = false, endAt = 0, photo = null, photoScore = -1, quitEnd = false
let hitStop = 0, fovKick = 0, flashA = 0, redA = 0, whiteA = 0
let tut = false, tutSeen = {}
const cam = { hd: -Math.PI / 2, pitch: 0.15, userT: -1e9, pos: new THREE.Vector3(), off: new THREE.Vector3(-6, 3, 0), look: new THREE.Vector3(), lookOff: new THREE.Vector3(), fov: 64 }
const _v = new THREE.Vector3(), _w = new THREE.Vector3()
function spawnRunner(id) { return createRunner({ id, spawn: { x: BASE.x - 9, y: 0, z: BASE.z, yaw: Math.PI / 2 } }) }
function newModel() { if (model) { scene.remove(model.group); model.dispose() } model = charAssets.ready ? new CharRunnerModel() : new RunnerModel(); scene.add(model.group); return model }

// ---------------------------------------------------------------- 入力
const keys = new Set()
const press = { jump: false }
let pendingWire = null, pendingDash = null, lockId = null, slowT = 0, needT = 0
addEventListener('keydown', e => {
  if (mode !== 'play') return
  if (e.repeat) return
  keys.add(e.code)
  if (e.code === 'KeyE') pendingWire = { at: null, key: true }
  if (e.code === 'KeyF') tryDash(lockId)
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
  if (hu) { tryDash(hu.u.id); return }   // UFO を押したら突撃（掛けない）
  if (me && me.rope) { pendingWire = { at: null, sx: cx, sy: cy }; return }
  const minT = me ? Math.max(0, (me.x - o.x) * d.x + (me.y + 1 - o.y) * d.y + (me.z - o.z) * d.z - 1) : 0
  const b = rayHit(world, o.x, o.y, o.z, d.x, d.y, d.z, 400, minT)
  const tb = b ? Math.hypot(b.x - o.x, b.y - o.y, b.z - o.z) : Infinity

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
    if (k === 'wire') { if (!tryDash(lockId, true)) pendingWire = { at: null, key: true } }
    else press[k] = true
  })
}
// 突撃: 照準の UFO へ。使えない時は理由を短く出す（大ボタンの時はビルへのワイヤーに回すので黙る）
function tryDash(id, quiet = false) {
  if (!me || !R || mode !== 'play' || paused) return false
  const u = id != null && R.ufos.find(q => q.id === id)
  if (u && canDash(R, me, u)) { pendingDash = id; return true }
  if (!quiet && u && needT <= 0) { needT = 1; { const sv = Math.hypot(me.vx, me.vy, me.vz), far = dashDist(me, u) > U.dashRange; pop(!R.dashReady || me.grounded ? t('needSwing') : sv < U.dashMinV ? t('needSpeed') : far ? t('tooFar') : t('noLine'), Math.round(sv) + ' m/s') }; hint('swing', touchMode ? t('hintHook') : t('hintHookPc')) }
  return false
}
function screenBasis() { const e = camera.matrixWorld.elements; let rx = e[0], rz = e[2], fx = -e[8], fz = -e[10]; const a = Math.hypot(rx, rz) || 1, b = Math.hypot(fx, fz) || 1; return { r: { x: rx / a, z: rz / a }, f: { x: fx / b, z: fz / b } } }
const blockedFn = (ax, ay, az, bx, by, bz) => blocked(world, ax, ay, az, bx, by, bz)
// 大きいボタン（E）: 画面の真ん中あたりのビルだけ（UFO には掛けない。2026-11-09「繋ぐだけで簡単すぎた」）
function autoTarget() { return null }
void blockedFn
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
    else if (pendingWire.key && !me.rope) { const a = findAnchor(world, me, Math.atan2(SF.x, SF.z)); if (a) inp.wireAt = a }
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
  Snd.loop('amb', 'snd/wind_loop.wav', 0.12); Snd.loop('hum', 'snd/loop_machine_03.mp3', 0.0001); Snd.loop('wind', null); Snd.loop('mother', null)
  sirenT = 3
}
function startRaid(seed = Math.floor(Math.random() * 1e6)) {
  Snd.init(); sfx('click')
  if (window.TM) TM.start()
  tut = store.get('ufo.tut2') !== '1'; tutSeen = {}
  mode = 'play'; paused = false; demo = null; photo = null; photoScore = -1; endAt = 0; quitEnd = false; whiteA = 0
  me = spawnRunner('me'); R = createRaid(world, seed, { tut }); R.seed = seed; street = createStreet(world, seed); parkCars(street, seed)
  log.length = 0
  newModel()
  cam.hd = Math.PI / 2; cam.pitch = 0.12; cam.userT = -1e9
  show(null); $('touch').classList.toggle('hidden', !touchMode)
  Snd.loop('amb', 'snd/wind_loop.wav', 0.1); Snd.loop('wind', 'snd/wind_loop.wav', 0.0001); Snd.loop('hum', 'snd/loop_machine_03.mp3', 0.0001); Snd.loop('mother', null)
  radio(`<small>${lang === 'ja' ? '管制' : 'HQ'}</small>${t('intro')}`, 2.8)
  sfx('woo', { vol: 0.5, rate: 0.8 })
  radioT = 14; sirenT = 6
}
function setPause(p) { if (mode !== 'play') return; paused = p; $('pause').classList.toggle('hidden', !p) }

// ---------------------------------------------------------------- 画面の文字
let sayT = 0, sayPri = 0
function say(html, sec = 1.8, pri = 0) { if (sayT > 0.4 && pri < sayPri) return; const el = $('say'); el.className = 'say'; el.innerHTML = html; sayT = sec; sayPri = pri }
function radio(html, sec = 2.2, pri = 0) { if (sayT > 0.4 && pri < sayPri) return; say(html, sec, pri); sfx('radio', { vol: 0.35 }) }
let bannerT = 0
function banner(s, b) { $('bannerS').textContent = s; $('bannerB').textContent = b; const el = $('banner'); el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop'); bannerT = 2.2 }
let nearT = 0
function pop(txt, sub = '') { const el = $('near'); $('nearTxt').textContent = txt; $('nearN').textContent = sub; el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop'); nearT = 0.9 }
function hint(k, txt) { if (!tut || tutSeen[k] || mode !== 'play') return; tutSeen[k] = true; radio(txt, 3, 2) }
let radioT = 14, sirenT = 6, sparkT = 2, boomT = 8
const tagEls = new Map()
function updateHud(dt) {
  const S = R.stats, inBoss = !!R.boss
  $('oWave').textContent = inBoss ? t('bossW') : t('waveL')(Math.max(1, R.wave + 1))
  const fly = R.ufos.filter(u => u.state === 'fly' && u.kind !== 'pod' && u.kind !== 'core')
  $('oLeft').textContent = inBoss ? (R.boss.core ? t('coreL') : t('podsL')(R.boss.pods.filter(q => q.state === 'fly').length)) : t('ufoLeft')(fly.length)
  const sc = S.score; if ($('oScore')._v !== sc) { $('oScore')._v = sc; $('oScore').textContent = sc.toLocaleString() }
  const ch = $('oChain'), key = R.chain + ':' + R.mult
  if (ch._k !== key) { ch._k = key; $('oMult').textContent = 'x' + R.mult; $('oChainN').textContent = R.chain ? t('chainL')(R.chain) : ''; ch.classList.toggle('hot', R.mult >= 2); ch.classList.toggle('on', R.chain > 0) }
  $('oChainBar').style.transform = `scaleX(${R.chain ? Math.max(0, 1 - R.chainT / U.chainIdle).toFixed(3) : 0})`
  // 電池（HUD の絵は背中のパックと同じ並び）
  const pk = $('pack')
  if (pk._h !== R.hp) {
    pk._h = R.hp
    $('packCells').innerHTML = Array.from({ length: U.hp }, (_, i) => { const col = i % 2, row = 2 - Math.floor(i / 2), on = i < R.hp; return `<rect x="${12 + col * 30}" y="${14 + row * 22}" width="26" height="17" rx="2" fill="${on ? (R.hp <= 2 ? '#ff4a3a' : '#6ff6ff') : '#1a1c20'}"${on ? ' filter="url(#cellGlow)"' : ''}/>` }).join('')
    pk.classList.toggle('low', R.hp <= 2)
  }
  const bb = $('bossbar')
  bb.classList.toggle('hidden', !inBoss || R.boss.state === 'arrive'); $('hud').classList.toggle('boss', inBoss)
  if (inBoss) {
    const B = R.boss, hp = B.pods.reduce((a, p) => a + Math.max(0, p.hp), 0) + (B.core ? Math.max(0, B.core.hp) : BOSS.coreHp), max = BOSS.pods * BOSS.podHp + BOSS.coreHp
    $('bbHp').style.transform = `scaleX(${(hp / max).toFixed(3)})`
    $('bbLeft').textContent = t('bossLeft')(Math.max(0, Math.ceil(B.left)))
    bb.classList.toggle('urgent', B.left < 25)
  }
  if (sayT > 0) { sayT -= dt; $('say').classList.toggle('hidden', sayT <= 0) }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.add('hidden') }
  if (nearT > 0) { nearT -= dt; if (nearT <= 0) $('near').classList.add('hidden') }
  // いちばん近い UFO の方角
  let tgt = null, td = 1e9
  for (const u of R.ufos) { if (u.state !== 'fly') continue; const d = Math.hypot(u.x - me.x, u.z - me.z); if (d < td) { td = d; tgt = u } }
  const ar = $('arrow')
  ar.classList.toggle('hidden', !tgt)
  if (tgt) { $('arrowD').textContent = Math.round(td) + 'm'; ar.querySelector('svg').style.transform = `rotate(${compassAng(tgt.x, tgt.z)}rad)` }
  // 方角の矢印は左上の表示と右の電池のあいだ（画面の大きさが変わった時だけ測る）
  if (ar._W !== innerWidth || ar._H !== innerHeight) { ar._W = innerWidth; ar._H = innerHeight; const a = $('ops').getBoundingClientRect(), b = $('pack').getBoundingClientRect(); ar.style.left = Math.round((a.right + b.left) / 2) + 'px' }
  // UFO の上の札（体力）
  const W = innerWidth, H = innerHeight, seen = new Set()
  for (const u of R.ufos) {
    if (u.state !== 'fly' || (R.boss && R.boss.state === 'arrive')) continue
    _v.set(u.x, u.y + u.hh * (u.kind === 'big' ? 1.6 : 1) + 2.4, u.z).project(camera)
    if (_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) continue
    if (camera.position.distanceTo(_w.set(u.x, u.y, u.z)) > 170) continue
    seen.add(u.id)
    let el = tagEls.get(u.id)
    if (!el) { el = document.createElement('div'); el.className = 'tag'; el.innerHTML = '<span class="tg-hp"></span>'; $('tags').appendChild(el); tagEls.set(u.id, el) }
    el.style.transform = `translate(${((_v.x + 1) / 2 * W).toFixed(0)}px,${((1 - _v.y) / 2 * H).toFixed(0)}px) translate(-50%,-100%)`
    if (el._k !== u.hp) { el._k = u.hp; el.querySelector('.tg-hp').innerHTML = '<b></b>'.repeat(Math.max(0, u.hp)); el.classList.toggle('weak', u.hp === 1) }
    const op = u.open > 0 && u.kind !== 'pod' ? (u.kind === 'hunter' ? 'h' : 'o') : ''; if (el._o !== op) { el._o = op; el.classList.toggle('open', op === 'o'); el.classList.toggle('hunter', op === 'h') }
  }
  for (const [id, el] of tagEls) if (!seen.has(id)) { el.remove(); tagEls.delete(id) }
  // 照準（追尾弾の溜め・近くを飛んでいる追尾弾）
  const locking = R.ufos.some(u => u.atk === 'missile') || R.missiles.some(m => Math.hypot(m.x - me.x, m.y - me.y, m.z - me.z) < 45)
  // 追ってくる追跡機の方角（画面の外・後ろから来る時だけ、画面の縁に赤い矢印）
  let ci = 0
  for (const u of R.ufos) {
    if (u.kind !== 'hunter' || u.state !== 'fly' || !(u.hunt === 'chase' || u.hunt === 'lunge') || ci >= 3) continue
    const d = Math.hypot(u.x - me.x, u.y - me.y, u.z - me.z); if (d > 55) continue
    _v.set(u.x, u.y, u.z).project(camera)
    const on = _v.z < 1 && Math.abs(_v.x) < 0.9 && Math.abs(_v.y) < 0.9
    if (on) continue
    const a = compassAng(u.x, u.z), el = $('chase' + ci++)
    const cx = W / 2 + Math.sin(a) * (W / 2 - 34), cy = H * 0.5 - Math.cos(a) * (H * 0.5 - 90)
    el.classList.remove('hidden'); el.classList.toggle('near', d < 15)
    el.style.transform = `translate(${cx.toFixed(0)}px,${cy.toFixed(0)}px) translate(-50%,-50%)`; el.querySelector('svg').style.transform = `rotate(${a}rad)`
    el.querySelector('b').textContent = Math.round(d) + 'm'
  }
  for (; ci < 3; ci++) $('chase' + ci).classList.add('hidden')
  const lk = $('lock'); lk.classList.toggle('hidden', !locking)
  if (locking) { _v.set(me.x, me.y + 1.1, me.z).project(camera); lk.style.transform = `translate(${((_v.x + 1) / 2 * W).toFixed(0)}px,${((1 - _v.y) / 2 * H).toFixed(0)}px) translate(-50%,-50%)` }
}
function compassAng(gx, gz) {
  camera.updateMatrixWorld()
  const e = camera.matrixWorld.elements, fx = -e[8], fz = -e[10], rx = -fz, rz = fx
  const dx = gx - me.x, dz = gz - me.z
  return Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz)
}
// 点の数字が当たった所から浮く
const floats = []
function floatPts(x, y, z, txt, cls = '') {
  if (floats.length > 8) { const o = floats.shift(); o.el.remove() }
  const el = document.createElement('div'); el.className = 'fpts ' + cls; el.textContent = txt; $('tags').appendChild(el)
  floats.push({ el, x, y, z, t: 0 })
}
function updateFloats(dt) {
  const W = innerWidth, H = innerHeight
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt
    if (f.t > 0.9) { f.el.remove(); floats.splice(i, 1); continue }
    _v.set(f.x, f.y + f.t * 3, f.z).project(camera)
    if (_v.z > 1) { f.el.style.opacity = '0'; continue }
    f.el.style.opacity = String(Math.min(1, (0.9 - f.t) * 3))
    f.el.style.transform = `translate(${((_v.x + 1) / 2 * W).toFixed(0)}px,${((1 - _v.y) / 2 * H).toFixed(0)}px) translate(-50%,-50%)`
  }
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
  else if (e.t === 'car') { sfx('bonk', { vol: 1, rate: 0.8 }); fx.addShake(0.7) }
}
function onRaidEvent(e) {
  log.push({ src: 'u', ...e, at: +R.t.toFixed(2) })
  if (mode !== 'play') { if (e.t === 'crash') boomFx(e.x, e.y, e.z, 0.6); return }
  if (e.t === 'wave') {
    banner(t('waveS')(e.n), t('waveB')(e.n)); sfx('woo', { vol: 0.7, rate: 0.85 }); sfx('siren', { vol: 0.18, rate: 0.9, delay: 0.4 })
    if (e.scouts) setTimeout(() => { if (mode === 'play') radio(t('scouts'), 2.2) }, 2400)
    else if (e.big && e.n >= 3) setTimeout(() => { if (mode === 'play') radio(t('big'), 2.2) }, 2400)
    if (e.n === 1) setTimeout(() => hint('hook', touchMode ? t('hintHook') : t('hintHookPc')), 2600)
  }
  else if (e.t === 'extra') { radio(t('extra'), 2); sfx('woo', { vol: 0.5, rate: 1.1 }) }
  else if (e.t === 'waveClear') {
    radio(e.fix ? t('fix') : t('clearLine')(e.n, e.sec), 2.4, 1); if (e.fix) sfx('hook', { vol: 0.6, delay: 0.3 })
    if (e.perfect) setTimeout(() => { if (mode === 'play') pop(t('perfect'), '+' + 300) }, 500)
    if (e.n === 1 && tut) store.set('ufo.tut2', '1')
    if (e.n === 1) setTimeout(() => hint('chain', t('hintChain')), 2600)
  }
  else if (e.t === 'ram') {
    sfx('clang', { vol: 0.9, rate: e.dmg >= 3 ? 0.8 : 1 }); sfx('zap', { vol: 0.5 })
    const k = Math.min(3, e.dmg)
    hitStop = 0.06 + k * 0.025; flashA = Math.min(1, 0.5 + k * 0.2); fovKick = -6 - k * 2; fx.addShake(0.4 + k * 0.25)
    fx.sparks(e.cx, e.cy, e.cz, 18 + k * 10, null, 10 + k * 4); fx.flash(e.cx, e.cy, e.cz); fx.debrisAt(e.cx, e.cy, e.cz, 8 + Math.round(k * 4), 0x6a6e76, { speed: 9, up: 5, size: 0.25 })
    if (e.open) { slowT = 0.3; sfx('zap', { vol: 0.7, rate: 0.6 }); flashA = 1 }
    pop(e.counter ? t('counter') : e.dive ? t('dive') : e.open ? t('open') : e.crack && !e.kill ? t('crack') : t('ram')(Math.ceil(e.dmg)), (e.chain >= 2 ? t('chainL')(e.chain) + '  ' : '') + Math.round(e.v) + ' m/s')
    floatPts(e.cx, e.cy + 1, e.cz, '+' + e.pts, e.mult >= 2 ? 'hot' : '')
    const sc = e.dmg * 40 + e.v + (e.kill ? 60 : 0); if (sc > photoScore) { photoScore = sc; snapNext = 2 }
  }
  else if (e.t === 'boing') { sfx('bonk', { vol: 0.6, rate: 1.4 }) }
  else if (e.t === 'shaken') { sfx('whoosh', { vol: 1, rate: 0.75 }); fovKick = Math.max(fovKick, 8); flashA = Math.max(flashA, 0.3); pop(t('shaken'), '+' + e.pts) }
  else if (e.t === 'hunterCrash') { sfxAt('crash', e.x, e.z, { vol: 1 }); sfxAt('boom', e.x, e.z, { vol: 0.9 }); boomFx(e.x, e.y, e.z, 1.2); hitStop = 0.06; pop(t('hunterCrash'), '+' + e.pts) }
  else if (e.t === 'cover') { sfx('clang', { vol: 0.5, rate: 1.3 }); pop(t('cover'), '+' + e.pts) }
  else if (e.t === 'dash') { sfx('whoosh', { vol: 0.9, rate: 0.8 }); sfx('zap', { vol: 0.4, rate: 1.6 }); fovKick = 10; flashA = Math.max(flashA, 0.25) }
  else if (e.t === 'hunt') { sfxAt('drone', e.x, e.z, { vol: 0.7, rate: 0.7 }); hint('hunt', t('hintHunt')) }
  else if (e.t === 'lunge') { sfx('charge', { vol: 0.7, rate: 1.6 }); redA = Math.max(redA, 0.35); pop(t('lunge'), '') }
  else if (e.t === 'hunters') { radio(t('hunters'), 2.4, 1); sfx('woo', { vol: 0.6, rate: 1.2 }) }
  else if (e.t === 'down') { sfx('ufoDown', { vol: 0.8 }); sfx('boom', { vol: 0.7, rate: 1.2 }); boomFx(e.x, e.y, e.z, e.kind === 'big' || e.kind === 'pod' ? 1.3 : 0.9); floatPts(e.x, e.y + 3, e.z, (t('down')[e.kind] || '') + ' +' + e.pts, 'kill') }
  else if (e.t === 'crash') { boomFx(e.x, e.y, e.z, e.kind === 'big' || e.kind === 'core' ? 1.4 : 1); sfxAt('boom', e.x, e.z, { vol: 1 }); sfxAt('crash', e.x, e.z, { vol: 0.7, delay: 0.1 }); sfxAt('glass', e.x, e.z, { vol: 0.35, rate: 0.8, delay: 0.25 }) }
  else if (e.t === 'beamWarn') { sfxAt('charge', e.x, e.z, { vol: 0.7 }); hint('beam', t('hintBeam')) }
  else if (e.t === 'beamOn') { sfxAt('burn', e.x, e.z, { vol: 0.7, rate: 0.8 }); fx.smoke(e.x, e.y + 0.5, e.z, { size: 3, life: 1.4, dark: 0.1 }) }
  else if (e.t === 'hurt') {
    redA = 0.9; hitStop = 0.07; fx.addShake(1); sfx('grunt', { vol: 0.9 }); sfx('clang', { vol: 0.6, rate: 0.7 })
    const pk = $('pack'); pk.classList.remove('hit'); void pk.offsetWidth; pk.classList.add('hit')
    if (e.hp > 0) { pop(t('hurt')[e.src] || '', ''); if (e.hp === 2) setTimeout(() => { if (mode === 'play') radio(t('lowHp'), 2, 1) }, 900) }
    packFlash = 0.3
  }
  else if (e.t === 'laserWarn') { sfxAt('tick', e.x, e.z, { vol: 0.8 }); sfxAt('tick', e.x, e.z, { vol: 0.8, delay: 0.25 }); hint('laser', t('hintLaser')) }
  else if (e.t === 'laserOn') { sfx('laser', { vol: 0.8 }) }
  else if (e.t === 'droneOut') { sfxAt('drone', e.x, e.z, { vol: 0.6 }) }
  else if (e.t === 'droneKill') { sfx('dpop', { vol: 0.8 }); fx.sparks(e.x, e.y, e.z, 14, null, 9); hitStop = 0.03; floatPts(e.x, e.y, e.z, '+' + e.pts) }
  else if (e.t === 'droneBoom' || e.t === 'droneFizz') { sfxAt('dpop', e.x, e.z, { vol: 0.6, rate: 0.7 }); fx.smoke(e.x, e.y, e.z, { size: 1.2, life: 0.8 }) }
  else if (e.t === 'lock') { sfxAt('charge', e.x, e.z, { vol: 0.9, rate: 1.5 }); hint('lock', t('hintLock')) }
  else if (e.t === 'fire') { sfxAt('laser', e.x, e.z, { vol: 0.7, rate: 0.8 }) }
  else if (e.t === 'mBoom') { boomFx(e.x, e.y, e.z, 0.4); sfxAt('boom', e.x, e.z, { vol: 0.5, rate: 1.4 }); if (e.mine) { pop(t('mWall'), '+' + e.pts); floatPts(e.x, e.y, e.z, '+' + e.pts) } }
  else if (e.t === 'mBait') { pop(t('mBait'), '+' + e.pts); sfx('zap', { vol: 0.7, rate: 0.7 }); fx.addShake(0.4) }
  else if (e.t === 'near') { flashA = Math.max(flashA, 0.4); fovKick = -5; sfx('whoosh', { vol: 0.8, rate: 0.85 }); sfx('zap', { vol: 0.3, rate: 1.7 }); pop(t('near'), '+' + e.pts) }
  else if (e.t === 'multUp') { sfx('hook', { vol: 0.6, rate: 1.3 }); multPulse = 1; if (e.mult >= 2) banner(t('multUp')(e.mult), t('chainL')(e.chain)) }
  else if (e.t === 'chainEnd') { /* 連鎖が切れた: HUD の倍率が戻るだけ */ }
  else if (e.t === 'boss') { cam.pitch = Math.min(cam.pitch, -0.45); banner(t('bossS'), t('bossB')); sfx('siren', { vol: 0.4, rate: 0.8 }); sfx('woo', { vol: 0.9, rate: 0.6 }); radio(t('boss'), 3, 2); Snd.loop('mother', 'snd/mother_hum.mp3', 0.0001) }
  else if (e.t === 'coreOpen') { radio(t('coreOpen'), 2.6, 2); sfx('siren', { vol: 0.3, rate: 1.1 }) }
  else if (e.t === 'bossDown') {
    banner(t('clearS'), t('clearB')); radio(t('bossDown'), 3, 2); hitStop = 0.12; flashA = 1; fx.addShake(1.4)
    for (let i = 0; i < 8; i++) setTimeout(() => { const B = R && R.boss; if (B && mode === 'play') { boomFx(B.x + (Math.random() - 0.5) * 34, B.y + (Math.random() - 0.5) * 6, B.z + (Math.random() - 0.5) * 34, 1.5); sfx('boom', { vol: 0.9, rate: 0.6 + Math.random() * 0.3 }) } }, i * 300)
  }
  else if (e.t === 'mainCannon') { banner(t('burnS'), t('burnB')); radio(t('mainCannon'), 3, 3); sfx('charge', { vol: 1, rate: 0.5 }); sfx('woo', { vol: 1, rate: 0.5, delay: 0.5 }) }
  else if (e.t === 'taken') { radio(t('taken'), 3.4, 3); sfx('burn', { vol: 1, rate: 0.6 }); sfx('woo', { vol: 0.8, rate: 0.7, delay: 0.6 }); setTimeout(() => sfx('radio', { vol: 0.6 }), 2600) }
  else if (e.t === 'end') { endAt = e.how === 'taken' ? 0.6 : e.how === 'burned' ? 1.2 : 2.6 }
}
function boomFx(x, y, z, k = 1) {
  fx.flash(x, y, z); fx.sparks(x, y, z, Math.round(18 * k), null, 12 * k)
  for (let i = 0; i < 5 * k; i++) fx.smoke(x, y + 0.5, z, { size: 3 * k, life: 1.8, vy: 2.4, dark: 0.12 })
  fx.debrisAt(x, y, z, Math.round(10 * k), 0x4a4c50, { speed: 8 * k, up: 6, size: 0.3 })
  const p = me || (demo && demo.r)
  if (p) fx.addShake(Math.max(0, 0.9 * k - Math.hypot(x - p.x, z - p.z) / 80))
}
let snapNext = 0, multPulse = 0, packFlash = 0

// ---------------------------------------------------------------- 結果
function rankOf(score) { return score >= RANKS[0] ? 0 : score >= RANKS[1] ? 1 : score >= RANKS[2] ? 2 : score >= RANKS[3] ? 3 : 4 }
function showResult() {
  if (mode !== 'play') return
  mode = 'result'
  Snd.loop('wind', null); Snd.loop('hum', null); Snd.loop('mother', null)
  const s = summary(R), L = t('report'), ja = lang === 'ja'
  const end = quitEnd ? 'quit' : R.end || 'quit'
  const rank = rankOf(s.score), C = L.comments
  const comment = end === 'clear' ? C.clear : end === 'quit' ? C.quit : s.downed <= 1 ? C.few : s.bestChain >= 10 ? C.chain : end === 'taken' ? C.taken : end === 'burned' ? C.burned : C.ok
  const d0 = new Date()
  const d = {
    unit: L.unit, title: L.title, dayLabel: L.dayLabel, sub: L.sub[end] || '', end,
    date: `${d0.getFullYear()}.${String(d0.getMonth() + 1).padStart(2, '0')}.${String(d0.getDate()).padStart(2, '0')}`,
    photo, caption: L.caption,
    stats: [[L.st[0], String(s.downed), false], [L.st[1], 'x' + s.bestMult, s.bestMult >= 3], [L.st[2], String(s.bestChain), s.bestChain >= 10], [L.st[3], String(s.near), false], [L.st[4], String(s.hurt), false], [L.st[5], L.reached(s.wave), end === 'clear']],
    waves: s.waveTimes, scoreLabel: L.scoreLabel, score: s.score.toLocaleString(), rankLabel: L.rankLabel, rank: 'SABCD'[rank], rankName: L.rankName[rank],
    commander: L.commander, comment, footer: 'tom3games.github.io/ufo-demae', ja
  }
  drawReport($('slip'), d)
  sfx('radio', { vol: 0.5 }); if (end === 'clear') sfx('ufoDown', { vol: 0.6, rate: 0.7, delay: 0.3 })
  $('btnPost').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(t('postText')(s.score, 'SABCD'[rank], end)) + '&url=' + encodeURIComponent(URL_)
  $('touch').classList.add('hidden')
  for (const [, el] of tagEls) el.remove(); tagEls.clear()
  for (const f of floats) f.el.remove(); floats.length = 0
  show('result')
  window.__lastScore = s.score; window.__lastSummary = { ...s, end, rank }
  if (window.TM) TM.end(s.score, end === 'clear')
}
$('btnPost').addEventListener('click', () => { if (window.TM) TM.share('x') })
$('btnSave').onclick = () => { if (window.TM) TM.share('save'); $('slip').toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'ruin-intercept-report.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }) }
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
  const taken = R && R.taken
  if (!manual && !taken) { cam.hd = lerpAngle(cam.hd, Math.atan2(hx, hz), 1 - Math.exp(-dt * (touchMode ? 2.2 : 5))); cam.pitch += ((R && R.boss ? -0.45 : 0.08) - cam.pitch) * (1 - Math.exp(-dt * 1.5)) }
  if (taken) cam.hd += dt * 0.35   // 回収される場面: ゆっくり回り込みながら見上げる
  hx = Math.sin(cam.hd); hz = Math.cos(cam.hd)
  let back = 5.6 + Math.min(2.4, v * 0.07), up = 2.1
  if (camera.aspect < 1) { back += 0.8; up += 0.5 }
  if (taken) { back += 7 + Math.min(6, taken.t * 2); up -= 4 }
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
  cam.off.lerp(_v.set(tx - pos.x, ty - pos.y, tz - pos.z), 1 - Math.exp(-dt * (taken ? 2 : 10)))
  cam.pos.set(pos.x + cam.off.x, pos.y + cam.off.y, pos.z + cam.off.z)
  cam.lookOff.lerp(_v.set(hx * 10, (camera.aspect < 1 ? 3.4 : 2.6) + 1.3 - cam.pitch * 1.6 + Math.max(0, -cam.pitch) * 12 + (taken ? 5 : 0), hz * 10), 1 - Math.exp(-dt * 12))
  if (taken) cam.lookOff.set(0, 2 + Math.min(4, taken.t * 2), 0)
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
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); fx.setScale && fx.setScale(h); ruin.setScale(h * Q.pixelRatio) }
addEventListener('resize', resize); resize()
let last = performance.now(), acc = 0, frameN = 0
function stepOnce() {
  if (mode === 'play' && !paused && me && !R.over) {
    const inp = gather()
    me.events.length = 0
    if (pendingDash != null) { startDash(R, me, pendingDash); pendingDash = null }
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
    if (inp.dash != null) startDash(R, demo.r, inp.dash)
    syncRope(R, demo.r); stepRunner(demo.r, inp, STEP, world); street.collide(demo.r)
    stepRaid(R, demo.r, STEP)
    for (const e of R.events) onRaidEvent(e)
    R.events.length = 0
    if (R.over || R.t > 70 || R.taken) newDemo()
  } else if (mode === 'play' && R && R.over) {
    if (R.taken) { me.y += STEP * 6; me.yaw += STEP * 9 }   // 回収されていく（結果の前に少し見せる）
  }
}
function frame() {
  requestAnimationFrame(frame)
  const now = performance.now()
  let dt = Math.min(0.1, (now - last) / 1000); last = now
  if (hitStop > 0) { hitStop -= dt; acc = 0 }
  else if (!dbgPause) { if (slowT > 0) slowT -= dt; acc += dt * (slowT > 0 ? 0.3 : 1); let n = 0; while (acc >= STEP && n < 6) { stepOnce(); acc -= STEP; n++ } if (n >= 6) acc = 0 }
  else dt = 0
  render(dt || 0.016)
}
const spd = $('speedfx'), sctx = spd.getContext('2d'), hf = $('hitflash'), rf = $('redflash'), wf = $('whiteflash')
const lines = Array.from({ length: 46 }, () => ({ a: Math.random() * Math.PI * 2, p: Math.random(), s: 0.6 + Math.random() * 0.8, w: 1 + Math.random() * 2 }))
let spdOn = false
function drawSpeed(v, dt) {
  if (!window.__holdFx) { flashA = Math.max(0, flashA - dt * 5); redA = Math.max(0, redA - dt * 2.4) }
  hf.style.opacity = flashA.toFixed(2); rf.style.opacity = redA.toFixed(2); wf.style.opacity = whiteA.toFixed(2)
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
    sctx.strokeStyle = `rgba(255,236,220,${(0.1 + 0.3 * k) * Math.min(1, L.p * 4)})`; sctx.lineWidth = L.w
    sctx.beginPath(); sctx.moveTo(cx + ca * r0, cy + sa * r0); sctx.lineTo(cx + ca * r1, cy + sa * r1); sctx.stroke()
  }
}
const groundAtFn = (x, z, y) => floorAt(world, x, z, y + 0.5).h
function render(dt) {
  const c = mode === 'title' ? demo && demo.r : me
  const now = performance.now() / 1000
  facadeTime.value = now
  if (c && model) {
    model.update(c, dt)
    if (model.okamochi && model.okamochi.userData.set) { packFlash = Math.max(0, packFlash - dt); model.okamochi.userData.set(R ? R.hp : U.hp, packFlash) }
    if (c.rope) {
      const h = model.handWorld, isU = c.rope.ufo != null
      ropeMesh.visible = true; ropeMesh.material = isU ? ropeUfoMat : ropeMat
      ropeMesh.position.copy(h); ropeMesh.lookAt(c.rope.x, c.rope.y, c.rope.z); ropeMesh.scale.set(1, 1, Math.max(0.1, h.distanceTo(_v.set(c.rope.x, c.rope.y, c.rope.z)))); ropeGlow.material.opacity = 0.28 + 0.1 * Math.sin(now * 14)
    } else ropeMesh.visible = false
    updateCamera(dt, c)
    const d = sun.userData.dir; sun.position.set(c.x + d.x * 150, c.y + d.y * 150, c.z + d.z * 150); sun.target.position.set(c.x, c.y, c.z)
  }
  if (R) {
    ufoView.update(R, dt, now); motherView.update(R.boss, now); atkView.update(R, dt, now, groundAtFn, c)
    if (frameN % 3 === 0) for (const u of R.ufos) if (u.state === 'fall') fx.smoke(u.x, u.y, u.z, { size: 2, life: 1.2, vy: 1, dark: 0.1 })
    // 主砲が撃たれた: 画面が白く焼ける
    if (R.boss && R.boss.state === 'fire') whiteA = Math.min(1, R.boss.fireT / 2.6)
  }
  // ロックオン: 画面の中・40m 以内で、真ん中寄りで近い UFO。突撃できる時は水色、できない時は灰色
  aimMark.visible = false; aimUfoMark.visible = false
  if (mode === 'play' && me && R && frameN % 2 === 0) {
    let best = null, bs = 1e9
    camera.updateMatrixWorld()
    for (const u of R.ufos) {
      if (u.state !== 'fly' || (R.boss && R.boss.state === 'arrive')) continue
      const d = dashDist(me, u); if (d > U.dashRange) continue
      _v.set(u.x, u.y, u.z).project(camera); if (_v.z > 1 || Math.abs(_v.x) > 0.92 || Math.abs(_v.y) > 0.92) continue
      const sc = Math.hypot(_v.x, _v.y * 0.7) + d / U.dashRange * 0.6 - (u.kind === 'hunter' && u.hunt === 'chase' ? 0.2 : 0)
      if (sc < bs) { bs = sc; best = u }
    }
    lockId = best ? best.id : null
    aimMark.userData.ready = !!best && canDash(R, me, best)
    if (!me.rope && frameN % 4 === 0) { const SF = screenBasis().f; aimMark.userData.p = findAnchor(world, me, Math.atan2(SF.x, SF.z)) }
  }
  needT = Math.max(0, needT - dt)
  const lu = mode === 'play' && lockId != null && R && R.ufos.find(q => q.id === lockId && q.state === 'fly'), ready = !!(lu && aimMark.userData.ready)
  if (lu && !(R.dash)) {
    aimUfoMark.visible = true; aimUfoMark.position.set(lu.x, lu.y, lu.z); aimUfoMark.lookAt(camera.position); aimUfoMark.rotateZ(now * (ready ? 3 : 0.8))
    aimUfoMark.scale.setScalar(lu.r * 1.25 * (ready ? 1 + Math.sin(now * 12) * 0.08 : 1))
    aimUfoMark.children.forEach(o => { o.material.color.setHex(ready ? 0x7ff6ff : 0x8a8478); o.material.opacity = ready ? 0.95 : 0.5 })
  }
  if (mode === 'play' && me && !me.rope && !ready && aimMark.userData.p) { const p = aimMark.userData.p; aimMark.visible = true; aimMark.position.set(p.x, p.y, p.z); aimMark.lookAt(camera.position); aimMark.scale.setScalar(Math.max(1, camera.position.distanceTo(aimMark.position) * 0.04)) }
  const wb = document.querySelector('.tbtn[data-k=wire]'); if (wb) { const k = ready ? 'u' : (mode === 'play' && me && !me.rope && aimMark.userData.p ? 'b' : ''); if (wb._aim !== k) { wb._aim = k; wb.classList.toggle('aim', !!k); wb.classList.toggle('aim-ufo', k === 'u'); wb.querySelector('.dash-l').textContent = k === 'u' ? t('dashL') : '' } }
  if (mode === 'play' && me) { const sv = Math.hypot(me.vx, me.vy, me.vz), el = $('oSpeed'); const key = Math.round(sv) + (R.dashReady ? 'r' : ''); if (el._k !== key) { el._k = key; el.textContent = t('speedL') + ' ' + Math.round(sv); el.classList.toggle('ok', sv >= U.dashMinV && R.dashReady && !me.grounded) } }
  if (mode === 'play' && me) {
    const v3 = Math.hypot(me.vx, me.vy, me.vz); const wl = Snd.loops.wind; if (wl && wl.g) { const gv = me.grounded ? 0 : Math.min(0.35, Math.max(0, (v3 - 16) / 40)); wl.g.gain.value = Number.isFinite(gv) ? gv : 0 }
    const hl = Snd.loops.hum; if (hl && hl.g) { let nd = 1e9, hd = 1e9; for (const u of R.ufos) if (u.state === 'fly') { const d = Math.hypot(u.x - me.x, u.y - me.y, u.z - me.z); nd = Math.min(nd, d); if (u.kind === 'hunter' && u.hunt !== 'back') hd = Math.min(hd, d) } const gv = Math.min(0.4, Math.max(0, 1 - nd / 50) * 0.22 + Math.max(0, 1 - hd / 40) * 0.25); hl.g.gain.value = Number.isFinite(gv) ? gv : 0 }
    const ml = Snd.loops.mother; if (ml && ml.g && R.boss) { const gv = R.boss.state === 'down' ? Math.max(0, 0.3 - R.boss.down * 0.1) : 0.3; ml.g.gain.value = gv }
  }
  drawSpeed(mode === 'play' && me ? Math.hypot(me.vx, me.vy, me.vz) : 0, dt)
  carsDraw.draw(street.traffic.cars, camera.position, dt)
  sky.update(camera.position, now, R && R.boss && R.boss.state !== 'down')
  ruin.update(camera.position, now, dt)
  fx.update(dt)
  fx.shake = Math.max(0, fx.shake - dt * 2.5)
  // 街の音と火花: 遠くのサイレン・電線の火花・遠くの爆発
  if (dt > 0 && !paused && mode !== 'result') {
    sirenT -= dt; if (sirenT <= 0) { sirenT = 16 + Math.random() * 14; sfx('siren', { vol: 0.08 + Math.random() * 0.06, rate: 0.82 + Math.random() * 0.12 }) }
    sparkT -= dt
    if (sparkT <= 0 && sparkPosts.length) {
      sparkT = 1.2 + Math.random() * 2.5
      const q = pick(sparkPosts), p = c || { x: BASE.x, z: BASE.z }
      if (Math.hypot(q.cx - p.x, q.cz - p.z) < 90) { fx.sparks(q.cx + (Math.random() - 0.5), q.y1 - 0.4, q.cz + (Math.random() - 0.5), 8, null, 5); fx.flash(q.cx, q.y1 - 0.4, q.cz); if (Math.hypot(q.cx - p.x, q.cz - p.z) < 35) sfx('zap', { vol: 0.12, rate: 1.8 + Math.random() * 0.4 }) }
    }
    for (const w of ruin.wrecks) if (Math.random() < dt * 0.6) fx.sparks(w.x + (Math.random() - 0.5) * 3, w.y, w.z + (Math.random() - 0.5) * 3, 5, null, 4)
    boomT -= dt
    if (boomT <= 0) { boomT = 9 + Math.random() * 10; const f = pick(ruin.fires); if (f && f.k > 2) { fx.flash(f.x, f.y + 20, f.z); sfx('boom', { vol: 0.12, rate: 0.55 + Math.random() * 0.15 }) } }
  }
  if (mode === 'play' && R) {
    updateHud(dt); updateFloats(dt)
    multPulse = Math.max(0, multPulse - dt * 3); $('oChain').style.setProperty('--pulse', multPulse.toFixed(2))
    if (!paused && !R.over && dt > 0) {
      radioT -= dt; if (radioT <= 0) { radioT = 16 + Math.random() * 8; if (R.phase === 'wave' || R.phase === 'boss') radio(pick(t('radio')), 2.4) }
    }
    if (endAt > 0) { endAt -= dt; if (endAt <= 0) showResult() }
  }
  renderer.render(scene, camera)
  if (snapNext > 0 && --snapNext === 0) { const c2 = document.createElement('canvas'); c2.width = 640; c2.height = Math.round(640 * innerHeight / innerWidth); c2.getContext('2d').drawImage(renderer.domElement, 0, 0, c2.width, c2.height); photo = c2 }
  frameN++
}

// ---------------------------------------------------------------- 検証用の窓口
window.ufo = {
  get mode() { return mode }, log, get hitStop() { return hitStop }, get flashA() { return flashA }, get fovKick() { return fovKick }, get me() { return me }, get R() { return R }, RUN, U, world, camera, touchMode, cam, renderer, fx, scene, ruin,
  start: seed => startRaid(seed), toTitle, showResult, setLang: l => { lang = l; applyLang() }, get lang() { return lang }, multOf, WAVES, BOSS,
  // 画面の座標（検証で本物の指・マウスで押すため）
  ufoXY: id => { const u = R && R.ufos.find(q => q.id === id); if (!u) return null; camera.updateMatrixWorld(); _v.set(u.x, u.y, u.z).project(camera); return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight, z: _v.z } },
  pointXY: (x, y, z) => { camera.updateMatrixWorld(); _v.set(x, y, z).project(camera); return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight, z: _v.z } },
  dbg: {
    pause: on => { dbgPause = on }, step: n => { for (let i = 0; i < n; i++) stepOnce(); render(STEP) },
    teleport: (x, y, z, yaw) => { Object.assign(me, { x, y, z, vx: 0, vy: 0, vz: 0, rope: null, climbing: null, grounded: y < 0.1 }); if (yaw != null) me.yaw = yaw },
    pressWire: (sx, sy) => aimAt(sx, sy), wireAuto: () => { pendingWire = { at: null, key: true } },
    spawn: (kind, x, y, z, extra = {}) => addUfo(R, kind, { x, y, z }, extra),
    dash: id => { pendingDash = id }, tryDash: id => tryDash(id), get lockId() { return lockId }, pressJump: () => { press.jump = true },
    keys, stick, say, get model() { return model },
    render: n => { for (let i = 0; i < n; i++) render(1 / 30) },
    placeUfo: (id, dist = 14, up = 6, side = 0) => {
      const u = R.ufos.find(q => q.id === id) || R.ufos.find(q => q.state === 'fly'); if (!u) return null
      const fx = Math.sin(cam.hd), fz = Math.cos(cam.hd)
      u.x = me.x + fx * dist + fz * side; u.z = me.z + fz * dist - fx * side; u.y = me.y + up; u.tx = u.x; u.tz = u.z; u.vx = u.vy = u.vz = 0; u.alt = u.y; u.retarget = u.t + 999; u.frozen = true
      return u.id
    },
    lookAt: (x, z) => { cam.hd = Math.atan2(x - me.x, z - me.z); cam.userT = performance.now() },
    setHp: n => { R.hp = n },
    anchor: () => findAnchor(world, me, cam.hd),
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
// 準備完了: 最初の画面を2回描いたら（画像・人物・音は裏で読む。届くまでは仮の色と手続きの人形）
requestAnimationFrame(() => requestAnimationFrame(() => {
  window.__bootDone = true; window.__bootSet && window.__bootSet(1)
  const b = $('boot'); b.classList.add('out'); setTimeout(() => b.classList.add('hidden'), 380)
  window.__ufoReady = true
  lazyStart()
  loadCharAssets().then(() => { if (charAssets.ready && model && !(model instanceof CharRunnerModel)) newModel() })
}))
requestAnimationFrame(frame)
