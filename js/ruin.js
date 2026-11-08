// 廃都の見た目（2026-11-09 v2「もっと退廃した雰囲気で」）。当たり判定は増やさない（墜ちた UFO だけ箱を足す）
// 空・霧・光・街の色を落とす・瓦礫・焼けたビルの崩れ・傾いた看板・墜ちた UFO・遠くの探照光・灰と火の粉・煙の柱
// 描画回数を増やさないよう、形は全部まとめて1つにし、粒は Points 1つずつにする
import * as THREE from 'three'
import { Builder } from './geo.js?v=1'
import { ARENA } from '../shared/ufo.js?v=1'

const _c = new THREE.Color(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3()
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// 傾いた箱を Builder に足す（中心・半寸法・回転）
function obox(b, cx, cy, cz, hw, hh, hl, rx, ry, rz, color, opts) {
  _q.setFromEuler(_e.set(rx, ry, rz))
  const P = (u, y, v) => { _v.set(u, y, v).applyQuaternion(_q); return [cx + _v.x, cy + _v.y, cz + _v.z] }
  b.hexa([P(-hw, -hh, -hl), P(hw, -hh, -hl), P(hw, -hh, hl), P(-hw, -hh, hl), P(-hw, hh, -hl), P(hw, hh, -hl), P(hw, hh, hl), P(-hw, hh, hl)], color, opts)
}

// ---------------------------------------------------------------- 空（夕焼けと煙。画像は読まない）
export const PALETTE = {
  zenith: new THREE.Color(0x1d1a26), mid: new THREE.Color(0x4f3c52), horizon: new THREE.Color(0xb0563a), glow: new THREE.Color(0xff8a3c),
  fog: new THREE.Color(0x6a4a48), sun: new THREE.Color(0xff9a5c), hemiSky: new THREE.Color(0x8a6a86), hemiGround: new THREE.Color(0x2a2224)
}
const SKY_V = 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }'
const SKY_F = `
uniform vec3 cZ, cM, cH, cG; uniform vec3 sunD; uniform float uT, uBoss;
varying vec3 vD;
float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n(p); p *= 2.07; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vD); float y = d.y;
  vec3 c = mix(cH, cM, smoothstep(0.0, 0.22, y)); c = mix(c, cZ, smoothstep(0.18, 0.75, y));
  float s = max(0.0, dot(d, sunD));
  c += cG * (pow(s, 6.0) * 0.55 + pow(s, 60.0) * 0.8) * (1.0 - smoothstep(0.0, 0.5, y));
  // 地平線の火事の照り返し（方角ごとにむら）
  float az = atan(d.z, d.x);
  float fire = smoothstep(0.55, 0.95, n(vec2(az * 3.0, 0.0) + 7.0)) * (1.0 - smoothstep(-0.02, 0.12, y));
  c += vec3(0.9, 0.32, 0.08) * fire * 0.6;
  // 煙の帯（ゆっくり流れる）
  vec2 q = vec2(az * 2.2 + uT * 0.004, y * 5.0);
  float sm = fbm(q * vec2(2.0, 1.4) + vec2(uT * 0.01, 0.0));
  c = mix(c, c * vec3(0.38, 0.33, 0.36), smoothstep(0.45, 0.8, sm) * smoothstep(-0.05, 0.25, y) * 0.85);
  c = mix(c, c * vec3(0.7, 0.55, 0.8), uBoss * 0.5);
  if (y < 0.0) c = mix(cH * 0.7, c, 0.4);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`
export function makeSky(renderer, scene, sunDir) {
  const u = { cZ: { value: PALETTE.zenith }, cM: { value: PALETTE.mid }, cH: { value: PALETTE.horizon }, cG: { value: PALETTE.glow }, sunD: { value: sunDir.clone() }, uT: { value: 0 }, uBoss: { value: 0 } }
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, fog: false })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), mat)
  mesh.renderOrder = -10; mesh.frustumCulled = false
  scene.add(mesh)
  // 金属の映り込み用の環境（同じ色の小さな絵から作る。1回だけ）
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64
  const x = cv.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64)
  g.addColorStop(0, '#1d1a26'); g.addColorStop(0.35, '#4f3c52'); g.addColorStop(0.5, '#b0563a'); g.addColorStop(0.56, '#3a2c2c'); g.addColorStop(1, '#151214')
  x.fillStyle = g; x.fillRect(0, 0, 128, 64)
  const et = new THREE.CanvasTexture(cv); et.mapping = THREE.EquirectangularReflectionMapping; et.colorSpace = THREE.SRGBColorSpace
  const pm = new THREE.PMREMGenerator(renderer)
  scene.environment = pm.fromEquirectangular(et).texture
  scene.environmentIntensity = 0.6
  pm.dispose(); et.dispose()
  scene.background = PALETTE.fog.clone()
  return { mesh, u, update(cam, t, boss) { mesh.position.copy(cam); u.uT.value = t; u.uBoss.value += ((boss ? 1 : 0) - u.uBoss.value) * 0.02 } }
}

// ---------------------------------------------------------------- 粒（灰・火の粉・煙）: 大きさと透明度を粒ごとに持つ Points
const PUFF_V = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
varying float vA; varying vec3 vC; varying float vFog;
uniform float uScale; uniform float uFogD; uniform float uFogK;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / max(0.5, -mv.z);
  float d = length(mv.xyz); float fd = uFogD * uFogK; vFog = 1.0 - exp(-fd * fd * d * d); vA = aAlpha; vC = aColor; }`
const PUFF_F = `
varying float vA; varying vec3 vC; varying float vFog; uniform vec3 uFogC; uniform float uSoft; uniform float uAdd;
void main(){ vec2 p = gl_PointCoord - 0.5; float r = length(p) * 2.0; if (r > 1.0) discard;
  float a = vA * pow(1.0 - r, uSoft);
  vec3 c = mix(vC, uFogC, vFog * (1.0 - uAdd)); a *= 1.0 - vFog * uAdd * 0.85;
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`
class Puffs {
  constructor(scene, n, { add = false, soft = 1.5, fogK = 1 } = {}) {
    this.n = n
    const g = new THREE.BufferGeometry()
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.col = new Float32Array(n * 3)
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3))
    this.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 }, uFogD: { value: 0.005 }, uFogK: { value: fogK }, uFogC: { value: PALETTE.fog }, uSoft: { value: soft }, uAdd: { value: add ? 1 : 0 } }, vertexShader: PUFF_V, fragmentShader: PUFF_F, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false
    scene.add(this.pts)
    this.g = g
  }
  dirty() { for (const k of ['position', 'aSize', 'aAlpha', 'aColor']) this.g.attributes[k].needsUpdate = true }
}

// ---------------------------------------------------------------- 本体
export function buildRuin(scene, world, opt = {}) {
  const rnd = rng(77), low = !!opt.low
  // 街の頂点色を落とす（彩度を半分に・少し暗く）。建物の外壁は facade.js のシェーダーで同じことをする
  scene.traverse(o => {
    const a = o.isMesh && o.geometry && o.geometry.attributes.color
    if (!a || o.userData.keepColor) return
    for (let i = 0; i < a.count; i++) {
      const r = a.getX(i), g = a.getY(i), b = a.getZ(i), l = r * 0.3 + g * 0.59 + b * 0.11
      a.setXYZ(i, (l + (r - l) * 0.42) * 0.8, (l + (g - l) * 0.42) * 0.78, (l + (b - l) * 0.42) * 0.76)
    }
    a.needsUpdate = true
  })
  // 材質の色も少し落とす（木・水・草）
  scene.traverse(o => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return
    const m = o.material
    if (m.isMeshStandardMaterial && !m.userData.ruined) {
      m.userData.ruined = true
      if (m.transparent && m.opacity > 0.8 && m.metalness > 0.2) m.color.setHex(0x14191c)   // 運河の水（濁って暗い）
      else if (m.alphaTest > 0) m.color.multiply(_c.setHex(0x6a5a4a))   // 木の葉・草（枯れて茶色）
    }
  })

  const solid = new Builder(), glowB = new Builder()
  const blds = world.colliders.filter(o => o.kind === 'building' && !o.small && !o.yaw && o.y1 - o.y0 > 14 && Math.hypot(o.cx - ARENA.x, o.cz - ARENA.z) < 420)
  // ---- 焼けて崩れたビル: 屋上の角が欠けて黒い穴・垂れた床板・むき出しの鉄骨
  const picked = blds.filter((o, i) => (i * 7 + 3) % 3 === 0)
  for (const o of picked) {
    const top = o.y1, sx = rnd() < 0.5 ? -1 : 1, sz = rnd() < 0.5 ? -1 : 1
    const hw = Math.min(o.hw * 0.55, 13), hl = Math.min(o.hl * 0.55, 13), hh = 4 + rnd() * 6
    // 欠けた角（黒く焼けた中身）。外壁より少しだけ外に出して、壁の模様を隠す
    const cx = o.cx + sx * (o.hw - hw + 0.08), cz = o.cz + sz * (o.hl - hl + 0.08)
    solid.box(cx, top - hh + 0.02, cz, hw, hh, hl, 0x141213, 0, { shade: false })
    // 中で燃えている（4つに1つ）
    if (rnd() < 0.5) glowB.box(cx, top - hh * 2 + 0.6, cz, hw * 0.92, 0.5, hl * 0.92, 0xff5a18, 0)
    // 欠けた所から垂れた床板
    obox(solid, cx + sx * hw * 0.3, top - hh * 0.6, cz, hw * 0.75, 0.22, hl * 0.9, 0, 0, sx * (0.5 + rnd() * 0.4), 0x5a5552)
    // むき出しの鉄骨（3〜5本、少し曲がっている）
    const n = 3 + Math.floor(rnd() * 3)
    for (let k = 0; k < n; k++) obox(solid, cx + (rnd() - 0.5) * hw * 1.6, top - hh + 1.6 + rnd() * 1.4, cz + (rnd() - 0.5) * hl * 1.6, 0.12, 1.8 + rnd() * 1.6, 0.12, (rnd() - 0.5) * 0.7, 0, (rnd() - 0.5) * 0.7, 0x2b2622)
  }
  // ---- 傾いた看板（屋上の枠が折れて斜め）
  const signs = []
  for (const o of blds.filter((o, i) => i % 5 === 1).slice(0, low ? 6 : 10)) {
    const w = 6 + rnd() * 4, h = 2.4 + rnd() * 1.2, tilt = (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.35), face = rnd() < 0.5 ? 1 : -1
    const x = o.cx + (rnd() - 0.5) * o.hw, z = o.cz + face * (o.hl - 1.5), y = o.y1 + h * 0.6 + 0.6
    obox(solid, x, y, z - face * 0.12, w / 2 + 0.2, h / 2 + 0.2, 0.1, 0.08 * face, 0, tilt, 0x2a2826)
    for (const s of [-1, 1]) obox(solid, x + s * w * 0.35, o.y1 + 0.8, z - face * 0.3, 0.1, 0.9, 0.1, 0, 0, s === 1 ? tilt * 1.4 : 0, 0x3a3634)
    signs.push({ x, y, z, w, h, tilt, face, i: signs.length % 4 })
  }
  // ---- 瓦礫の山（遊ぶ範囲の道の端とビルの足元）: 1つの InstancedMesh。山ごとに 6〜14 個
  const chunks = low ? 380 : 620
  const rub = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true }), chunks)
  rub.receiveShadow = true; rub.castShadow = !low
  const m4 = new THREE.Matrix4(), sc = new THREE.Vector3()
  const RUB_C = [0x6b6560, 0x58524e, 0x7a716a, 0x48433f, 0x3a3532, 0x6a5a4c, 0x2a2624]
  const nearB = world.colliders.filter(o => o.kind === 'building' && !o.yaw && !o.wreck && Math.hypot(o.cx - ARENA.x, o.cz - ARENA.z) < ARENA.r + 60)
  let ri = 0
  for (let tries = 0; ri < chunks && tries < 900 && nearB.length; tries++) {
    const o = nearB[Math.floor(rnd() * nearB.length)]
    const side = Math.floor(rnd() * 4), t = rnd() * 1.8 - 0.9, out = 0.6 + rnd() * 3
    const px = side < 2 ? o.cx + t * o.hw : o.cx + (side === 2 ? 1 : -1) * (o.hw + out)
    const pz = side < 2 ? o.cz + (side === 0 ? 1 : -1) * (o.hl + out) : o.cz + t * o.hl
    if (world.groundAt(px, pz, 2).h > 0.6) continue
    const big = !o.small, n = big ? 8 + Math.floor(rnd() * 7) : 4 + Math.floor(rnd() * 4), R = big ? 2.6 : 1.4
    for (let k = 0; k < n && ri < chunks; k++) {
      const a = rnd() * 6.28, d = rnd() * R, x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d
      const s = (big ? 0.35 : 0.22) + rnd() * rnd() * (big ? 1.3 : 0.6) * (1 - d / R * 0.5)
      _q.setFromEuler(_e.set(rnd() * 3, rnd() * 3, rnd() * 3))
      m4.compose(_v.set(x, s * 0.25 + (R - d) * 0.15, z), _q, sc.set(s * (0.8 + rnd() * 0.8), s * (0.5 + rnd() * 0.5), s * (0.8 + rnd() * 0.8)))
      rub.setMatrixAt(ri, m4); rub.setColorAt(ri, _c.setHex(RUB_C[(ri * 7 + k) % RUB_C.length])); ri++
    }
    // 山に刺さった鉄骨と板（大きい山だけ）
    if (big && rnd() < 0.6) { obox(solid, px, 0.6, pz, 0.08, 1.4, 0.08, (rnd() - 0.5) * 1.2, 0, (rnd() - 0.5) * 1.2, 0x2b2622); obox(solid, px + 0.8, 0.5, pz - 0.5, 1.4, 0.12, 0.9, rnd() * 0.5, rnd() * 3, 0.3, 0x55504c) }
  }
  rub.count = ri
  scene.add(rub)
  // ---- 墜ちた UFO（3機）: 地面に半分めり込んだ円盤。当たり判定の箱を足す
  const wrecks = []
  const wreckSpots = world.ruinMap ? world.ruinMap.wrecks : []
  const wHull = new THREE.LatheGeometry([[0, -0.9], [1.2, -1.0], [2.6, -0.55], [3.3, -0.06], [3.36, 0.06], [2.7, 0.36], [1.6, 0.6], [0, 0.66]].map(([a, b]) => new THREE.Vector2(a * 1.25, b * 1.25)), 28)
  const wM = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, metalness: 0.7, roughness: 0.6 })
  const wLight = new THREE.MeshBasicMaterial({ color: 0x6ff7ff })
  const sc2 = document.createElement('canvas'); sc2.width = sc2.height = 128
  { const x = sc2.getContext('2d'), g = x.createRadialGradient(64, 64, 6, 64, 64, 64); g.addColorStop(0, 'rgba(8,6,6,.92)'); g.addColorStop(0.5, 'rgba(14,10,9,.6)'); g.addColorStop(1, 'rgba(14,10,9,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128) }
  const scorchM = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc2), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })
  for (const w of wreckSpots) {
    const g = new THREE.Group()
    const hull = new THREE.Mesh(wHull, wM); hull.castShadow = true; hull.receiveShadow = true
    hull.rotation.set(0.42, w.a, 0.18); hull.position.y = 0.6
    g.add(hull)
    // 割れたドームと、まだ点いている光
    for (let i = 0; i < 5; i++) { const L = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), wLight); const a = i / 5 * 4 + 1; L.position.set(Math.cos(a) * 3.7, 0.15, Math.sin(a) * 3.7); hull.add(L) }
    // えぐれた地面（黒い焦げ跡）
    const scorch = new THREE.Mesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), scorchM)
    scorch.position.y = 0.06; g.add(scorch)
    const gy = world.groundAt(w.x, w.z, 3).h
    g.position.set(w.x, gy, w.z)
    scene.add(g)
    wrecks.push({ x: w.x, y: gy + 2, z: w.z, light: wLight })
  }
  world._anchorBoxes = null
  // ---- 看板の板（1枚の絵に4種）
  if (signs.length) {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256
    const x = cv.getContext('2d')
    const TX = [['避難所', '→ 北の高台', '#2a5a3a'], ['立入禁止', 'KEEP OUT', '#7a2a1a'], ['大売出し', '全品半額', '#6a4a1a'], ['生存者は', '屋上で光を', '#3a3a5a']]
    TX.forEach(([a, b, bg], i) => {
      const ox = i * 256
      x.fillStyle = bg; x.fillRect(ox, 0, 256, 256)
      x.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k < 40; k++) x.fillRect(ox + Math.random() * 256, Math.random() * 256, 4 + Math.random() * 30, 2 + Math.random() * 40)
      x.fillStyle = '#d8d0c0'; x.textAlign = 'center'; x.font = '900 64px "M PLUS 1p", sans-serif'; x.fillText(a, ox + 128, 110)
      x.font = '700 40px "M PLUS 1p", sans-serif'; x.fillText(b, ox + 128, 180)
      // 焼け焦げと破れ
      const gr = x.createRadialGradient(ox + 40 + Math.random() * 170, 200, 4, ox + 128, 200, 160); gr.addColorStop(0, 'rgba(10,8,6,.9)'); gr.addColorStop(1, 'rgba(10,8,6,0)')
      x.fillStyle = gr; x.fillRect(ox, 0, 256, 256)
    })
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace
    const P = [], UV = [], N = []
    for (const s of signs) {
      _q.setFromEuler(_e.set(0.08 * s.face, s.face > 0 ? 0 : Math.PI, s.tilt))
      const cs = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]
      for (const [u, v] of cs) {
        _v.set(u * s.w / 2, v * s.h / 2, 0).applyQuaternion(_q); P.push(s.x + _v.x, s.y + _v.y, s.z + _v.z + s.face * 0.02)
        UV.push((s.i + (u + 1) / 2) / 4, (v + 1) / 2)
        _v.set(0, 0, 1).applyQuaternion(_q); N.push(_v.x, _v.y, _v.z)
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
    scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide })))
  }
  // 広場の鉄塔（shared/ruinmap.js の当たり判定と同じ所）: 4本の柱と横桟、てっぺんで折れて曲がる
  for (const T of (world.ruinMap ? world.ruinMap.towers : [])) {
    const H = T.h, w = 0.8
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) obox(solid, T.x + sx * w, T.y + H / 2, T.z + sz * w, 0.09, H / 2, 0.09, T.tilt, 0, T.tilt * 0.5, 0x3a3532)
    for (let y = 2.5; y < H; y += 3) { obox(solid, T.x, T.y + y, T.z + w, w, 0.06, 0.06, 0, 0, 0, 0x4a4440); obox(solid, T.x, T.y + y, T.z - w, w, 0.06, 0.06, 0, 0, 0, 0x4a4440); obox(solid, T.x + w, T.y + y, T.z, 0.06, 0.06, w, 0, 0, 0, 0x4a4440); obox(solid, T.x - w, T.y + y, T.z, 0.06, 0.06, w, 0, 0, 0, 0x4a4440); obox(solid, T.x, T.y + y + 1.4, T.z + w, 0.05, 1.7, 0.05, 0, 0, 0.9, 0x3a3532) }
    obox(solid, T.x + 1.2, T.y + H + 0.8, T.z, 0.12, 2, 0.12, 0, 0, 1.1, 0x2b2622)
    glowB.box(T.x, T.y + H - 0.4, T.z, 0.25, 0.25, 0.25, 0xff3a2a, 0)   // てっぺんの赤い航空灯（ワイヤーの目印）
  }
  const solidMesh = new THREE.Mesh(solid.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.1 }))
  solidMesh.castShadow = true; solidMesh.userData.keepColor = true
  scene.add(solidMesh)
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff })
  if (!glowB.empty) { const gm = new THREE.Mesh(glowB.geometry(), glowMat); gm.userData.keepColor = true; scene.add(gm) }

  // ---- 遠くの探照光（街の外の UFO が地上を探している）
  const far = []
  const bc = document.createElement('canvas'); bc.width = 4; bc.height = 128
  { const x = bc.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(160,250,255,.55)'); g.addColorStop(0.6, 'rgba(120,230,255,.12)'); g.addColorStop(1, 'rgba(120,230,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128) }
  const beamMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide, fog: false })
  const discM = new THREE.MeshBasicMaterial({ color: 0x0e0f12, fog: false }), dotM = new THREE.MeshBasicMaterial({ color: 0x8ff7ff, fog: false })
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + 0.6, d = 330 + i * 70, h = 90 + i * 18
    const g = new THREE.Group(); g.position.set(ARENA.x + Math.sin(a) * d, h, ARENA.z + Math.cos(a) * d)
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 2.4, 16), discM); g.add(disc)
    for (let k = 0; k < 6; k++) { const L = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 4), dotM); L.position.set(Math.cos(k) * 11, -0.6, Math.sin(k) * 11); g.add(L) }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2, 18, h, 16, 1, true).translate(0, -h / 2, 0), beamMat); g.add(beam)
    scene.add(g); far.push({ g, beam, a, ph: i * 2.1 })
  }

  // ---- 灰（ゆっくり降る）と火の粉（舞い上がる）。カメラのまわり 40m の箱でくり返す
  const ASH = low ? 260 : 420, EMB = low ? 70 : 120
  const ash = new Puffs(scene, ASH, { soft: 0.6 }), emb = new Puffs(scene, EMB, { add: true, soft: 1.2 })
  const BOX = 40
  for (let i = 0; i < ASH; i++) { ash.pos.set([(rnd() - 0.5) * BOX * 2, rnd() * 30, (rnd() - 0.5) * BOX * 2], i * 3); ash.size[i] = 0.05 + rnd() * 0.08; ash.alpha[i] = 0.45 + rnd() * 0.35; const k = 0.32 + rnd() * 0.25; ash.col.set([k, k * 0.95, k * 0.92], i * 3) }
  for (let i = 0; i < EMB; i++) { emb.pos.set([(rnd() - 0.5) * BOX * 2, rnd() * 30, (rnd() - 0.5) * BOX * 2], i * 3); emb.size[i] = 0.08 + rnd() * 0.1; emb.alpha[i] = 1; emb.col.set([1, 0.45 + rnd() * 0.3, 0.12], i * 3) }
  ash.dirty(); emb.dirty()
  const ashV = Array.from({ length: ASH }, () => [(rnd() - 0.5) * 0.6, -0.4 - rnd() * 0.6, (rnd() - 0.5) * 0.6, rnd() * 6])
  const embV = Array.from({ length: EMB }, () => [(rnd() - 0.5) * 1.2, 0.8 + rnd() * 1.8, (rnd() - 0.5) * 1.2, rnd() * 6])

  // ---- 煙の柱（燃えている所から）: Points 1つ。火のゆらぎは別の加算の Points
  const fires = []
  for (const o of picked.filter(o => Math.hypot(o.cx - ARENA.x, o.cz - ARENA.z) < 260).slice(0, low ? 6 : 9)) fires.push({ x: o.cx + (o.hw * 0.4), y: o.y1, z: o.cz, k: 1.4 })
  for (const w of wrecks) fires.push({ x: w.x, y: w.y - 1.2, z: w.z, k: 0.9 })
  // 開始地点の近くの燃えている家（3軒）: 屋根の火と煙
  const homes = world.colliders.filter(o => o.kind === 'building' && o.small && !o.wreck && !o.shop && Math.hypot(o.cx - 30, o.cz - 842) < 110 && Math.hypot(o.cx - 30, o.cz - 842) > 18)
  for (let i = 0; i < Math.min(3, homes.length); i++) { const o = homes[(i * 5 + 2) % homes.length]; fires.push({ x: o.cx, y: o.y1 + (o.gable || 0) * 0.5, z: o.cz, k: 0.8 }) }
  // 街の外の大きな火事（地平線の柱）
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.9, d = 240 + (i % 3) * 60; fires.push({ x: ARENA.x + Math.sin(a) * d, y: 0, z: ARENA.z + Math.cos(a) * d, k: 3.2 }) }
  const PER = low ? 12 : 16
  const smoke = new Puffs(scene, fires.length * PER, { soft: 1.1, fogK: 0.4 }), flame = new Puffs(scene, fires.length * 3, { add: true, soft: 1.6, fogK: 0.5 })
  const smokeT = new Float32Array(fires.length * PER).map((_, i) => (i % PER) / PER)
  fires.forEach((f, i) => { for (let j = 0; j < 3; j++) { const n = i * 3 + j; flame.pos.set([f.x + (j - 1) * 1.6 * f.k, f.y + 1 + j * 0.6, f.z], n * 3); flame.col.set([1, 0.45, 0.12], n * 3) } })

  const ret = {
    wrecks, fires, sparks: [],
    update(camPos, t, dt) {
      // 灰と火の粉
      for (let i = 0; i < ASH; i++) {
        const v = ashV[i]; let x = ash.pos[i * 3] + (v[0] + Math.sin(t * 0.7 + v[3]) * 0.5) * dt, y = ash.pos[i * 3 + 1] + v[1] * dt, z = ash.pos[i * 3 + 2] + (v[2] + Math.cos(t * 0.6 + v[3]) * 0.5) * dt
        if (x - camPos.x > BOX) x -= BOX * 2; else if (x - camPos.x < -BOX) x += BOX * 2
        if (z - camPos.z > BOX) z -= BOX * 2; else if (z - camPos.z < -BOX) z += BOX * 2
        if (y < camPos.y - 18) y += 40; else if (y > camPos.y + 22) y -= 40
        ash.pos[i * 3] = x; ash.pos[i * 3 + 1] = y; ash.pos[i * 3 + 2] = z
      }
      for (let i = 0; i < EMB; i++) {
        const v = embV[i]; let x = emb.pos[i * 3] + (v[0] + Math.sin(t * 2 + v[3]) * 0.8) * dt, y = emb.pos[i * 3 + 1] + v[1] * dt, z = emb.pos[i * 3 + 2] + v[2] * dt
        if (x - camPos.x > BOX) x -= BOX * 2; else if (x - camPos.x < -BOX) x += BOX * 2
        if (z - camPos.z > BOX) z -= BOX * 2; else if (z - camPos.z < -BOX) z += BOX * 2
        if (y > camPos.y + 22) y -= 40; else if (y < camPos.y - 18) y += 40
        emb.pos[i * 3] = x; emb.pos[i * 3 + 1] = y; emb.pos[i * 3 + 2] = z
        emb.alpha[i] = 0.5 + 0.5 * Math.sin(t * 9 + v[3] * 7)
      }
      ash.dirty(); emb.dirty()
      // 煙の柱: 下から湧いて広がりながら上がって消える
      fires.forEach((f, i) => {
        for (let j = 0; j < PER; j++) {
          const n = i * PER + j
          let s = smokeT[n] + dt * 0.05 / Math.sqrt(f.k); if (s > 1) s -= 1; smokeT[n] = s
          const h = s * 55 * f.k, drift = s * s * 22 * f.k
          smoke.pos[n * 3] = f.x + drift + Math.sin(n * 3.1 + t * 0.3) * 1.5 * f.k; smoke.pos[n * 3 + 1] = f.y + 1 + h; smoke.pos[n * 3 + 2] = f.z + drift * 0.4 + Math.cos(n * 1.7) * 1.2 * f.k
          smoke.size[n] = (7 + s * 30) * f.k; smoke.alpha[n] = Math.min(1, s * 5) * Math.pow(1 - s, 1.3) * 0.85
          const k = 0.02 + s * 0.06, fire = Math.max(0, 1 - s * 4) * 0.12; smoke.col.set([k * 1.1 + fire, k * 0.95 + fire * 0.35, k * 0.95], n * 3)
        }
        for (let j = 0; j < 3; j++) { const n = i * 3 + j; flame.size[n] = (4.5 + Math.sin(t * 11 + n * 2) * 1.2) * f.k; flame.alpha[n] = 0.6 + 0.35 * Math.sin(t * 17 + n * 5) }
      })
      smoke.dirty(); flame.dirty()
      // 遠くの探照光が地上をなめる
      for (const F of far) { F.beam.rotation.x = Math.sin(t * 0.21 + F.ph) * 0.35; F.beam.rotation.z = Math.cos(t * 0.17 + F.ph) * 0.35; F.g.rotation.y = t * 0.1 }
      // 墜ちた UFO の光が切れかける
      wLight.color.setHex(Math.sin(t * 13) * Math.sin(t * 5.3) > 0.2 ? 0x6ff7ff : 0x0d2a2e)
      glowMat.color.setScalar(0.75 + 0.25 * Math.sin(t * 7) * Math.sin(t * 3.1))
    },
    setScale(h) { for (const p of [ash, emb, smoke, flame]) p.mat.uniforms.uScale.value = h * 0.9 },
    setFog(d) { for (const p of [ash, emb, smoke, flame]) p.mat.uniforms.uFogD.value = d }
  }
  return ret
}
