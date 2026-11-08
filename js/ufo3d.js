// UFO・母艦・攻撃の見た目。当たり判定は shared/ufo.js。ここは見せるだけ
// 2026-11-09 v2: 廃都の空に合う暗い金属の円盤。光は水色と赤紫だけ（橙の街の上で予告が埋もれないよう、街と反対の色に寄せる）
import * as THREE from 'three'

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
function radialTex(stops, size = 128) {
  return canvasTex(size, size, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); for (const [o, c] of stops) g.addColorStop(o, c); x.fillStyle = g; x.fillRect(0, 0, w, w) })
}
// 予告の輪: 太い縁＋内側の線＋斜線＋真ん中の印（下向きの矢印＝上から焼かれる）
function ringTex(edge, inner, hatch) {
  const S = 256
  const t = canvasTex(S, S, x => {
    x.translate(S / 2, S / 2)
    x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 26; x.beginPath(); x.arc(0, 0, S / 2 - 12, 0, Math.PI * 2); x.stroke()
    x.strokeStyle = edge; x.lineWidth = 15; x.beginPath(); x.arc(0, 0, S / 2 - 12, 0, Math.PI * 2); x.stroke()
    x.strokeStyle = inner; x.lineWidth = 5; x.beginPath(); x.arc(0, 0, S / 2 - 28, 0, Math.PI * 2); x.stroke()
    x.save(); x.beginPath(); x.arc(0, 0, S / 2 - 32, 0, Math.PI * 2); x.clip()
    x.strokeStyle = hatch; x.lineWidth = 10
    for (let i = -S; i < S; i += 26) { x.beginPath(); x.moveTo(i, -S); x.lineTo(i + S, S); x.stroke() }
    x.restore()
    x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 10; x.lineCap = 'round'; x.lineJoin = 'round'
    x.beginPath(); x.moveTo(0, -26); x.lineTo(0, 22); x.moveTo(-18, 4); x.lineTo(0, 24); x.lineTo(18, 4); x.stroke()
  })
  t.anisotropy = 4; return t
}

const KIND_SCALE = { saucer: 1, big: 1.6, scout: 0.56, hunter: 0.7, pod: 0.86, core: 1 }

export class UfoView {
  constructor(scene) {
    this.scene = scene
    this.models = new Map()
    this.hull = new THREE.MeshStandardMaterial({ color: 0x5b6068, metalness: 0.85, roughness: 0.38 })
    this.hullDark = new THREE.MeshStandardMaterial({ color: 0x33363c, metalness: 0.8, roughness: 0.42 })
    this.dome = new THREE.MeshStandardMaterial({ color: 0x0c1418, metalness: 0.3, roughness: 0.08, emissive: 0x0b5e6a, emissiveIntensity: 0.9 })
    this.coreM = new THREE.MeshBasicMaterial({ color: 0xff3aa8 })
    this.lightM = [0x6ff7ff, 0x6ff7ff, 0xff4ab0].map(c => new THREE.MeshBasicMaterial({ color: c }))
    this.redLightM = new THREE.MeshBasicMaterial({ color: 0xff3a6a })
    this.podM = new THREE.MeshBasicMaterial({ color: 0xff7a2a })
    this.bottomM = new THREE.MeshBasicMaterial({ color: 0x86fff0, transparent: true, opacity: 0.9 })
    this.chargeM = new THREE.MeshBasicMaterial({ color: 0xff2a6a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    this.glowTex = radialTex([[0, 'rgba(160,255,255,.9)'], [0.35, 'rgba(80,220,255,.35)'], [1, 'rgba(40,120,255,0)']])
    const prof = [[0, -0.9], [1.2, -1.0], [2.6, -0.55], [3.3, -0.06], [3.36, 0.06], [2.7, 0.36], [1.6, 0.6], [0, 0.66]].map(([a, b]) => new THREE.Vector2(a, b))
    this.gHull = new THREE.LatheGeometry(prof, 32)
    this.gDome = new THREE.SphereGeometry(1.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
    this.gRim = new THREE.TorusGeometry(3.32, 0.11, 6, 40).rotateX(Math.PI / 2)
    this.gLight = new THREE.SphereGeometry(0.17, 8, 6)
    this.gBottom = new THREE.TorusGeometry(1.05, 0.16, 6, 24).rotateX(Math.PI / 2)
    this.gFin = new THREE.BoxGeometry(0.12, 0.5, 1.6)
    this.gCannon = new THREE.CylinderGeometry(0.35, 0.5, 1.4, 10)
    this.shieldM = new THREE.MeshBasicMaterial({ color: 0x6ff6ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
    this.gShield = new THREE.IcosahedronGeometry(1, 1)
    this.openM = new THREE.MeshBasicMaterial({ color: 0xff3aa0 })
    this.engineTex = radialTex([[0, 'rgba(255,240,200,1)'], [0.3, 'rgba(255,110,40,.9)'], [1, 'rgba(255,40,0,0)']])
    this._v = new THREE.Vector3()
  }
  build(u) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body)
    const s = KIND_SCALE[u.kind] || 1
    const hullMat = u.kind === 'big' || u.kind === 'pod' ? this.hullDark : this.hull
    const flashMat = hullMat.clone(); flashMat.emissive = new THREE.Color(0xffffff); flashMat.emissiveIntensity = 0
    const hull = new THREE.Mesh(this.gHull, flashMat); hull.castShadow = true
    body.add(hull)
    if (u.kind === 'core') {
      // 母艦の底から降りてくる芯（いちばん弱い所）。赤紫に脈打つ目
      hull.scale.set(1.3, 1.1, 1.3)
      const eye = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 12), this.coreM); eye.position.y = -1.2; eye.scale.y = 0.6; body.add(eye)
      g.userData.eye = eye
    } else {
      const rim = new THREE.Mesh(this.gRim, u.kind === 'pod' || u.kind === 'hunter' ? this.podM : u.kind === 'big' ? this.redLightM : this.lightM[0]); body.add(rim)
      g.userData.rim = rim; g.userData.rimM = rim.material
      const n = u.kind === 'scout' ? 6 : 12
      const lights = []
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, L = new THREE.Mesh(this.gLight, u.kind === 'big' ? this.redLightM : u.kind === 'pod' ? this.podM : this.lightM[i % 3]); L.position.set(Math.cos(a) * 3.0, 0.12, Math.sin(a) * 3.0); body.add(L); lights.push(L) }
      const bot = new THREE.Mesh(this.gBottom, this.bottomM); bot.position.y = -0.95; body.add(bot)
      if (u.kind !== 'pod') { const dome = new THREE.Mesh(this.gDome, this.dome); dome.position.y = 0.55; body.add(dome) }
      if (u.kind === 'big') { const c = new THREE.Mesh(this.gCannon, this.hullDark); c.position.y = -1.4; body.add(c); for (const sx of [-1, 1]) { const f = new THREE.Mesh(this.gFin, this.hullDark); f.position.set(sx * 3.1, 0.3, 0); body.add(f) } }
      if (u.kind === 'hunter') {
        // 追跡機: 後ろに橙の噴射（追ってくる時に大きくなる）。前に赤い目
        const eng = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.engineTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); eng.scale.setScalar(5); g.add(eng); g.userData.engine = eng
        for (const sx of [-1, 1]) { const f = new THREE.Mesh(this.gFin, this.hullDark); f.position.set(sx * 2.4, 0.2, -1); f.rotation.y = sx * 0.5; body.add(f) }
      }
      if (u.kind === 'scout') { for (const sx of [-1, 1]) { const f = new THREE.Mesh(this.gFin, this.hullDark); f.position.set(sx * 2.8, 0, 0); f.rotation.z = sx * 0.4; body.add(f) } }
      g.userData.lights = lights
    }
    // 下の光（遠くからでも UFO がどこにいるか分かる）
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7, fog: false }))
    glow.scale.setScalar(u.kind === 'core' ? 12 : 8); glow.position.y = -1.2; body.add(glow)
    // シールド（撃った直後と追跡中は消える）
    if (u.kind !== 'pod' && u.kind !== 'hunter') { const sh = new THREE.Mesh(this.gShield, this.shieldM); sh.scale.setScalar(u.kind === 'core' ? 5.6 : 4.2); sh.renderOrder = 3; g.add(sh); g.userData.shield = sh }
    // 光って撃つ合図（追尾弾の溜め）
    const charge = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 10), this.chargeM.clone()); charge.renderOrder = 4; body.add(charge)
    g.userData.charge = charge
    g.scale.setScalar(s)
    g.userData.body = body; g.userData.flash = flashMat
    this.scene.add(g)
    return g
  }
  update(R, dt, now) {
    const seen = new Set()
    for (const u of R.ufos) {
      let m = this.models.get(u.id)
      if (!m) { m = this.build(u); this.models.set(u.id, m) }
      seen.add(u.id)
      const U = m.userData
      m.visible = u.state !== 'gone'
      m.position.set(u.x, u.y, u.z)
      U.body.rotation.y = u.spin
      // 引っかけられると揺れる。落ちる時は傾いて回る
      const tilt = u.state === 'fall' ? 0.6 + u.t * 0.4 : u.wob * Math.sin(now * 22) * 0.18 + Math.sin(now * 1.7 + u.id) * 0.05
      m.rotation.set(tilt, 0, u.state === 'fall' ? u.t * 0.7 : Math.cos(now * 1.3 + u.id) * 0.05 + u.vx * -0.012)
      U.flash.emissiveIntensity = u.flash * 1.6
      if (U.lights) { const k = Math.floor(now * 6) % 3; U.lights.forEach((L, i) => { L.visible = u.state !== 'fall' || (i + k) % 2 === 0 }) }
      if (U.eye) U.eye.scale.setScalar(1 + 0.08 * Math.sin(now * 9))
      const open = u.open > 0 && u.kind !== 'pod' && u.kind !== 'hunter'
      if (U.shield) { U.shield.visible = u.state === 'fly' && u.open <= 0; U.shield.rotation.y = now * 0.6; U.shield.material.opacity = 0.1 + 0.06 * Math.sin(now * 3 + u.id) }
      if (U.rim) U.rim.material = open ? this.openM : U.rimM
      if (U.engine) {
        const hunting = u.hunt === 'chase' || u.hunt === 'lunge'
        const vl = Math.hypot(u.vx, u.vy, u.vz) || 1
        U.engine.position.set(-u.vx / vl * 2.6, -u.vy / vl * 2.6, -u.vz / vl * 2.6).divideScalar(m.scale.x)
        U.engine.scale.setScalar((hunting ? (u.hunt === 'lunge' ? 9 : 6) : 3) * (0.85 + 0.15 * Math.sin(now * 40)))
      }
      U.charge.material.opacity = u.atk === 'missile' ? 0.25 + 0.25 * Math.sin(now * 30) : 0
      U.charge.scale.setScalar(u.atk === 'missile' ? 0.6 + 0.4 * Math.max(0, u.charge) : 1)
    }
    for (const [id, m] of this.models) if (!seen.has(id)) { this.scene.remove(m); this.models.delete(id) }
  }
  modelOf(id) { return this.models.get(id) }
}

// 母艦: 街の上を覆う黒い円盤。下面に光の継ぎ目、真ん中の目が主砲（溜まるほど赤紫に明るくなる）
export class MotherView {
  constructor(scene) {
    const g = new THREE.Group()
    const prof = [[0, 4.2], [6, 4.0], [11, 3.0], [16, 1.4], [19, 0.3], [19.4, -0.4], [17, -1.2], [10, -1.9], [5, -2.6], [0, -2.8]].map(([a, b]) => new THREE.Vector2(a, b))
    const hullM = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.55, metalness: 0.75 })
    const hull = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), hullM); hull.castShadow = true
    // 背の板（放射状の骨）
    const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1.0, 12), hullM, 16)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; q.setFromEuler(e.set(0, a, -0.0)); m4.compose(new THREE.Vector3(Math.sin(a) * 10, 3.6, Math.cos(a) * 10), q, new THREE.Vector3(1, 1, 1)); ribs.setMatrixAt(i, m4) }
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.6, 5, 8), hullM); tower.position.y = 6.3
    const seamM = new THREE.MeshBasicMaterial({ color: 0x5ff2ff })
    const seams = new THREE.Group()
    for (const [r, y] of [[17.6, -0.9], [11.5, -1.75], [6.2, -2.45]]) { const s = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 4, 64).rotateX(Math.PI / 2), seamM); s.position.y = y; seams.add(s) }
    const lights = new THREE.Group()
    const lm = new THREE.MeshBasicMaterial({ color: 0xff4ab0 })
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, L = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), lm); L.position.set(Math.cos(a) * 18.6, -0.5, Math.sin(a) * 18.6); lights.add(L) }
    this.eyeM = new THREE.MeshBasicMaterial({ color: 0x4a0a2a })
    const eye = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 12), this.eyeM); eye.position.y = -2.8; eye.scale.y = 0.45
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,120,220,1)'], [0.3, 'rgba(255,40,140,.55)'], [1, 'rgba(120,0,80,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }))
    glow.position.y = -4; glow.scale.setScalar(16)
    // 主砲の光の柱（溜まりきった時だけ）
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 1, 24, 1, true).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffb0f0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }))
    cannon.visible = false
    g.add(hull, ribs, tower, seams, lights, eye, glow, cannon)
    g.visible = false
    scene.add(g)
    this.g = g; this.lights = lights; this.glow = glow; this.cannon = cannon; this.seamM = seamM
  }
  update(B, now) {
    this.g.visible = !!B
    if (!B) return
    this.g.position.set(B.x, B.y, B.z)
    this.g.rotation.y = B.spin * 0.5
    this.g.rotation.z = B.state === 'down' ? B.down * 0.18 : Math.sin(now * 0.5) * 0.02
    this.lights.rotation.y = now * 0.4
    // 主砲が溜まるほど目が明るくなる（残り120秒→0秒）
    const k = B.state === 'fire' ? 1 : Math.max(0, Math.min(1, 1 - B.left / 120))
    this.eyeM.color.setRGB(0.3 + 0.7 * k, 0.05 + 0.25 * k * k, 0.18 + 0.5 * k)
    this.glow.material.opacity = 0.25 + 0.6 * k + (k > 0.8 ? 0.15 * Math.sin(now * 20) : 0)
    this.glow.scale.setScalar(12 + 16 * k)
    this.seamM.color.setHex(B.state === 'down' ? (Math.sin(now * 30) > 0 ? 0xffffff : 0x203040) : 0x5ff2ff)
    const on = B.state === 'fire'
    this.cannon.visible = on
    if (on) { const h = B.y + 2; this.cannon.scale.set(1 + B.fireT * 0.6, h, 1 + B.fireT * 0.6); this.cannon.position.y = -2.8; this.cannon.material.opacity = Math.min(1, B.fireT * 1.2) * (0.8 + 0.2 * Math.sin(now * 40)) }
  }
}

// 攻撃の見た目: 焼却光線（地面の輪＋光の円すい）・なぎ払い（地面の線＋光線）・ドローン・追尾弾・回収の光
export class AttackView {
  constructor(scene) {
    this.scene = scene
    const plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)
    this.ringMat = new THREE.MeshBasicMaterial({ map: ringTex('rgba(110,250,255,1)', 'rgba(255,255,255,1)', 'rgba(120,240,255,.42)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false })
    const coneTex = canvasTex(4, 128, (x) => { const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(230,255,255,.95)'); g.addColorStop(1, 'rgba(90,230,255,.4)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128) })
    this.coneMat = new THREE.MeshBasicMaterial({ map: coneTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })
    this.beams = []
    for (let i = 0; i < 7; i++) {
      const ring = new THREE.Mesh(plane, this.ringMat.clone()); ring.renderOrder = 4
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, -0.5, 0), this.coneMat.clone()); cone.renderOrder = 5
      ring.visible = cone.visible = false; scene.add(ring, cone)
      this.beams.push({ ring, cone })
    }
    // なぎ払い: 地面の赤紫と白の破線の帯・UFO から扇の予告・本番の光線
    const stripeTex = canvasTex(64, 16, (x) => { x.fillStyle = 'rgba(255,40,140,1)'; x.fillRect(0, 0, 40, 16); x.fillStyle = 'rgba(255,255,255,1)'; x.fillRect(40, 0, 24, 16) }); stripeTex.wrapS = THREE.RepeatWrapping
    this.lasers = []
    for (let i = 0; i < 4; i++) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: stripeTex.clone(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false }))
      strip.material.map.wrapS = THREE.RepeatWrapping; strip.renderOrder = 4
      const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: 0xff3aa0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff2fa, fog: false }))
      const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3))
      const fan = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff2a90, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }))
      const scorch = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(255,240,250,1)'], [0.4, 'rgba(255,90,170,.8)'], [1, 'rgba(255,0,120,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
      for (const o of [strip, ray, core, fan, scorch]) { o.visible = false; scene.add(o) }
      this.lasers.push({ strip, ray, core, fan, scorch })
    }
    // ドローン: 小さい黒い玉に赤い目と回る輪
    this.drones = []
    const dm = new THREE.MeshStandardMaterial({ color: 0x1e2128, metalness: 0.7, roughness: 0.35 }), eye = new THREE.MeshBasicMaterial({ color: 0xff2a5a }), ringM = new THREE.MeshBasicMaterial({ color: 0x7ef2ff })
    const dGlow = new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,90,120,.9)'], [1, 'rgba(255,0,60,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), dm))
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), eye); e.position.z = 0.48; g.add(e)
      const rg = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 6, 20).rotateX(Math.PI / 2), ringM); g.add(rg)
      const gl = new THREE.Sprite(dGlow); gl.scale.setScalar(2.6); g.add(gl)
      g.userData.ring = rg; g.visible = false; scene.add(g); this.drones.push(g)
    }
    // 追尾弾: 光る玉と尾
    const glowTex = radialTex([[0, 'rgba(255,255,240,1)'], [0.25, 'rgba(255,120,210,.95)'], [0.6, 'rgba(200,40,255,.4)'], [1, 'rgba(120,0,255,0)']])
    this.missiles = []
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group()
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe0ff }))
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.scale.setScalar(3.6)
      g.add(core, glow); g.visible = false; scene.add(g)
      this.missiles.push({ g })
    }
    // 尾は1つの Points（描画1回）
    this.trailN = 60
    const tg = new THREE.BufferGeometry()
    this.trailPos = new Float32Array(this.trailN * 3).fill(0); this.trailLife = new Float32Array(this.trailN)
    tg.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3))
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.trailN * 3), 3))
    this.trail = new THREE.Points(tg, new THREE.PointsMaterial({ size: 1.6, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
    this.trail.frustumCulled = false; scene.add(this.trail)
    this.ti = 0
    // 回収の光（電池が尽きた時、UFO から自分へ）
    this.tractor = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, -0.5, 0), this.coneMat.clone())
    this.tractor.visible = false; this.tractor.renderOrder = 5; scene.add(this.tractor)
  }
  update(R, dt, now, groundAt, me) {
    // 光線
    for (let i = 0; i < this.beams.length; i++) {
      const V = this.beams[i], b = R.beams[i]
      if (!b || b.ux == null) { V.ring.visible = V.cone.visible = false; continue }
      V.ring.visible = true; V.ring.position.set(b.x, b.gy + 0.25, b.z)
      const warn = b.phase === 'warn', k = warn ? Math.min(1, b.t / 1.3) : 1
      V.ring.scale.setScalar(b.r * (warn ? 1.2 - 0.2 * k : 1))
      V.ring.rotation.y = now * (warn ? 1.2 : 3)
      V.ring.material.opacity = warn ? (k > 0.7 ? (Math.sin(now * 40) > 0 ? 1 : 0.4) : 0.6 + 0.4 * k) : 1
      const dx = b.x - b.ux, dy = b.gy - b.uy, dz = b.z - b.uz, L = Math.hypot(dx, dy, dz)
      V.cone.visible = true
      V.cone.position.set(b.ux, b.uy, b.uz)
      V.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dx / L, dy / L, dz / L))
      V.cone.scale.set(warn ? 0.6 + 0.4 * k : b.r, L, warn ? 0.6 + 0.4 * k : b.r)
      V.cone.material.opacity = warn ? 0.1 + 0.12 * k : 0.8 + 0.2 * Math.sin(now * 30)
    }
    // なぎ払い
    for (let i = 0; i < this.lasers.length; i++) {
      const V = this.lasers[i], L = R.lasers[i]
      if (!L || L.ux == null) { V.strip.visible = V.ray.visible = V.core.visible = V.fan.visible = V.scorch.visible = false; continue }
      const mx = (L.ax + L.bx) / 2, mz = (L.az + L.bz) / 2, len = Math.hypot(L.bx - L.ax, L.bz - L.az)
      V.strip.visible = true; V.strip.position.set(mx, L.gy + 0.22, mz); V.strip.scale.set(len, 1, 1.5)
      V.strip.rotation.y = -Math.atan2(L.bz - L.az, L.bx - L.ax)
      V.strip.material.map.repeat.set(len / 3, 1); V.strip.material.map.offset.x = -now * 2
      const warn = L.phase === 'warn'
      V.strip.material.opacity = warn ? (L.t > 1.0 ? (Math.sin(now * 40) > 0 ? 1 : 0.35) : 0.9) : 0.5
      V.fan.visible = warn
      if (warn) { const p = V.fan.geometry.attributes.position; p.setXYZ(0, L.ux, L.uy, L.uz); p.setXYZ(1, L.ax, L.gy, L.az); p.setXYZ(2, L.bx, L.gy, L.bz); p.needsUpdate = true; V.fan.geometry.computeBoundingSphere(); V.fan.material.opacity = 0.08 + 0.12 * Math.min(1, L.t / 1.4) }
      const on = !warn && L.px != null
      V.ray.visible = V.core.visible = V.scorch.visible = on
      if (on) {
        const dx = L.px - L.ux, dy = L.gy - L.uy, dz = L.pz - L.uz, d = Math.hypot(dx, dy, dz)
        for (const o of [V.ray, V.core]) { o.position.set(L.ux, L.uy, L.uz); o.lookAt(L.px, L.gy, L.pz); o.scale.set(1, 1, d) }
        V.ray.scale.x = V.ray.scale.y = 1 + 0.3 * Math.sin(now * 50)
        V.scorch.position.set(L.px, L.gy + 0.3, L.pz); V.scorch.scale.setScalar(2.4 + Math.random())
      }
    }
    // ドローン
    for (let i = 0; i < this.drones.length; i++) {
      const g = this.drones[i], d = R.drones[i]
      g.visible = !!d; if (!d) continue
      g.position.set(d.x, d.y, d.z); g.lookAt(R.lastR ? R.lastR.x : d.x, R.lastR ? R.lastR.y + 1 : d.y, R.lastR ? R.lastR.z : d.z + 1)
      g.userData.ring.rotation.y = now * 12
    }
    // 追尾弾と尾
    const tp = this.trailPos, tc = this.trail.geometry.attributes.color.array
    for (let i = 0; i < this.missiles.length; i++) {
      const V = this.missiles[i], m = R.missiles[i]
      V.g.visible = !!m; if (!m) continue
      V.g.position.set(m.x, m.y, m.z)
      const j = this.ti; this.ti = (this.ti + 1) % this.trailN
      tp[j * 3] = m.x; tp[j * 3 + 1] = m.y; tp[j * 3 + 2] = m.z; this.trailLife[j] = 0.45
    }
    for (let j = 0; j < this.trailN; j++) { const l = this.trailLife[j] = Math.max(0, this.trailLife[j] - dt); const k = l / 0.45; tc[j * 3] = k; tc[j * 3 + 1] = k * 0.5; tc[j * 3 + 2] = k }
    this.trail.geometry.attributes.position.needsUpdate = true; this.trail.geometry.attributes.color.needsUpdate = true
    // 回収の光
    const T = R.taken, u = T && R.ufos.find(q => q.id === T.ufo)
    this.tractor.visible = !!(T && me)
    if (T && me) {
      const ux = u ? u.x : T.x, uy = u ? u.y - 1 : T.y, uz = u ? u.z : T.z, L = Math.max(1, uy - groundAt(me.x, me.z, me.y))
      this.tractor.position.set(ux, uy, uz); this.tractor.quaternion.identity()
      const w = 1.2 + Math.min(1, T.t) * 2.2
      this.tractor.scale.set(w, L, w); this.tractor.material.opacity = Math.min(1, T.t * 1.5) * (0.75 + 0.25 * Math.sin(now * 25))
    }
  }
}
