// UFO・母船・攻撃・丼の見た目。当たり判定は shared/ufo.js。ここは見せるだけ
import * as THREE from 'three'

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
function radialTex(stops, size = 128) {
  return canvasTex(size, size, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); for (const [o, c] of stops) g.addColorStop(o, c); x.fillStyle = g; x.fillRect(0, 0, w, w) })
}
// 予告の輪（隕石の日の輪と同じ作り。吸い上げは水色の縁に赤の斜線）
function ringTex(edge, inner, hatch) {
  const S = 256
  const t = canvasTex(S, S, x => {
    x.translate(S / 2, S / 2)
    x.strokeStyle = edge; x.lineWidth = 16; x.beginPath(); x.arc(0, 0, S / 2 - 10, 0, Math.PI * 2); x.stroke()
    x.strokeStyle = inner; x.lineWidth = 5; x.beginPath(); x.arc(0, 0, S / 2 - 24, 0, Math.PI * 2); x.stroke()
    x.save(); x.beginPath(); x.arc(0, 0, S / 2 - 28, 0, Math.PI * 2); x.clip()
    x.strokeStyle = hatch; x.lineWidth = 10
    for (let i = -S; i < S; i += 26) { x.beginPath(); x.moveTo(i, -S); x.lineTo(i + S, S); x.stroke() }
    x.restore()
    // 真ん中の印（上向きの矢印＝吸い上げ）
    x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 10; x.lineCap = 'round'; x.lineJoin = 'round'
    x.beginPath(); x.moveTo(0, 26); x.lineTo(0, -22); x.moveTo(-18, -4); x.lineTo(0, -24); x.lineTo(18, -4); x.stroke()
  })
  t.anisotropy = 4; return t
}
const NARUTO_TEX = () => canvasTex(128, 128, (x, w) => {
  x.fillStyle = '#f6f2ea'; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill()
  // ギザギザのふち
  x.strokeStyle = '#e9e1d2'; x.lineWidth = 6; x.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, r = i % 2 ? 58 : 62; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r) } x.stroke()
  x.strokeStyle = '#e0457a'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath()
  for (let a = 0; a < Math.PI * 6; a += 0.08) { const r = 4 + a * 2.6; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r) } x.stroke()
})
// 雷文（ラーメン丼のふちの模様）
const RAIMON_TEX = () => {
  const t = canvasTex(512, 64, (x, w, h) => {
    x.fillStyle = '#b8211a'; x.fillRect(0, 0, w, h)
    x.strokeStyle = '#f4eadb'; x.lineWidth = 5; x.lineCap = 'square'
    for (let i = 0; i < 8; i++) {
      const o = i * 64 + 8
      x.beginPath(); x.moveTo(o, 54); x.lineTo(o, 10); x.lineTo(o + 46, 10); x.lineTo(o + 46, 46); x.lineTo(o + 14, 46); x.lineTo(o + 14, 20); x.lineTo(o + 36, 20); x.lineTo(o + 36, 36); x.lineTo(o + 24, 36); x.stroke()
    }
  })
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1); return t
}
const STRAW_TEX = () => { const t = canvasTex(16, 64, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f5f0e8' : '#d8342a'; x.fillRect(0, i * 8, w, 8) } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6); return t }

const KIND_SCALE = { saucer: 1, big: 1.6, naruto: 0.52, pod: 0.86, core: 1 }

export class UfoView {
  constructor(scene) {
    this.scene = scene
    this.models = new Map()
    this.hull = new THREE.MeshStandardMaterial({ color: 0x858d97, metalness: 0.9, roughness: 0.3 })
    this.hullDark = new THREE.MeshStandardMaterial({ color: 0x4b525c, metalness: 0.8, roughness: 0.3 })
    this.glass = new THREE.MeshStandardMaterial({ color: 0xbfeaff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.38, emissive: 0x1f5a6e, emissiveIntensity: 0.6, depthWrite: false })
    this.alienM = new THREE.MeshStandardMaterial({ color: 0x9fcf8e, roughness: 0.55 })
    this.eyeM = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.15, metalness: 0.3 })
    this.bibM = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.9 })
    this.strawM = new THREE.MeshStandardMaterial({ map: STRAW_TEX(), roughness: 0.6 })
    this.bowlM = new THREE.MeshStandardMaterial({ color: 0xb8211a, roughness: 0.5 })
    this.bowlIn = new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.6, side: THREE.BackSide })
    this.soupM = new THREE.MeshStandardMaterial({ color: 0xd99a3f, roughness: 0.35, emissive: 0x3a2008, emissiveIntensity: 0.3 })
    this.noodleM = new THREE.MeshStandardMaterial({ color: 0xf2d27a, roughness: 0.6 })
    this.bubbleM = new THREE.MeshBasicMaterial({ color: 0x9ff3ff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending })
    this.holdM = new THREE.MeshBasicMaterial({ color: 0x8ff7ff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    this.narutoM = new THREE.MeshStandardMaterial({ map: NARUTO_TEX(), roughness: 0.6 })
    this.lightM = [0x6ff7ff, 0xffe066, 0xff5ba8].map(c => new THREE.MeshBasicMaterial({ color: c }))
    this.redLightM = new THREE.MeshBasicMaterial({ color: 0xff3a2a })
    this.orangeM = new THREE.MeshBasicMaterial({ color: 0xffa23a })
    this.bottomM = new THREE.MeshBasicMaterial({ color: 0x86ffd8, transparent: true, opacity: 0.9 })
    this.chargeM = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    const prof = [[0, -0.9], [1.2, -1.0], [2.6, -0.55], [3.3, -0.06], [3.36, 0.06], [2.7, 0.36], [1.6, 0.6], [0, 0.66]].map(([a, b]) => new THREE.Vector2(a, b))
    this.gHull = new THREE.LatheGeometry(prof, 40)
    this.gDome = new THREE.SphereGeometry(1.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)
    this.gRim = new THREE.TorusGeometry(3.32, 0.11, 6, 48).rotateX(Math.PI / 2)
    this.gLight = new THREE.SphereGeometry(0.17, 8, 6)
    this.gBottom = new THREE.TorusGeometry(1.05, 0.16, 6, 28).rotateX(Math.PI / 2)
    this.gHead = new THREE.SphereGeometry(0.42, 14, 10)
    this.gEye = new THREE.SphereGeometry(0.13, 10, 8)
    this.gBody = new THREE.CylinderGeometry(0.3, 0.42, 0.6, 12)
    const bowlProf = [[0.15, -0.5], [0.55, -0.48], [0.95, -0.2], [1.1, 0.28], [1.04, 0.28]].map(([a, b]) => new THREE.Vector2(a, b))
    this.gBowl = new THREE.LatheGeometry(bowlProf, 28)
    this.gSoup = new THREE.CircleGeometry(1.0, 24).rotateX(-Math.PI / 2)
    this.gBubble = new THREE.SphereGeometry(1.45, 18, 12)
    this.gHold = new THREE.CylinderGeometry(0.7, 1.35, 2.2, 18, 1, true)
    this.gNaruto = new THREE.CylinderGeometry(0.9, 0.9, 0.22, 24)
    this.gStraw = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0.35, 0.95, 0.2], [1.6, 2.4, 0.2], [3.7, 1.4, 0.2], [3.9, -0.6, 0.2], [2.6, -2.7, 0.1], [0.35, -3.1, 0]].map(p => new THREE.Vector3(...p))), 40, 0.07, 6)
    this.gCannon = new THREE.CylinderGeometry(0.35, 0.5, 1.4, 10)
    this.dmgSmoke = 0
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
      // 母船の底から出てくるナルトの芯（いちばん弱い所）
      hull.scale.set(1.3, 1.1, 1.3)
      const nar = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.narutoM.map }))
      nar.position.y = -1.18; body.add(nar)
    } else {
      const rim = new THREE.Mesh(this.gRim, u.kind === 'big' || u.kind === 'pod' ? (u.kind === 'pod' ? this.orangeM : this.redLightM) : this.lightM[0]); body.add(rim)
      const n = 12
      const lights = []
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, L = new THREE.Mesh(this.gLight, u.kind === 'big' ? this.redLightM : u.kind === 'pod' ? this.orangeM : this.lightM[i % 3]); L.position.set(Math.cos(a) * 3.0, 0.12, Math.sin(a) * 3.0); body.add(L); lights.push(L) }
      const bot = new THREE.Mesh(this.gBottom, this.bottomM); bot.position.y = -0.95; body.add(bot)
      if (u.kind !== 'pod') {
        const dome = new THREE.Mesh(this.gDome, this.glass); dome.position.y = 0.55; dome.renderOrder = 2
        // 宇宙人（紙エプロンをつけてストローですする）
        const al = new THREE.Group(); al.position.y = 0.55
        const bd = new THREE.Mesh(this.gBody, this.bibM); bd.position.y = 0.25; al.add(bd)
        const hd = new THREE.Mesh(this.gHead, this.alienM); hd.scale.set(1, 1.18, 0.95); hd.position.y = 0.82; al.add(hd)
        for (const sx of [-1, 1]) { const e = new THREE.Mesh(this.gEye, this.eyeM); e.scale.set(1.25, 0.75, 0.6); e.position.set(sx * 0.17, 0.86, 0.33); e.rotation.z = sx * 0.4; al.add(e) }
        body.add(al)
        g.userData.alien = al
        body.add(dome)
      }
      if (u.kind === 'big') { const c = new THREE.Mesh(this.gCannon, this.hullDark); c.position.y = -1.4; body.add(c) }
      g.userData.lights = lights
    }
    // 光って撃つ合図（追尾弾の溜め）
    const charge = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 10), this.chargeM.clone()); charge.renderOrder = 4; body.add(charge)
    g.userData.charge = charge
    // さらった丼（泡の中）
    if (u.kind !== 'pod' && u.kind !== 'core') {
      const hold = new THREE.Group(); hold.position.y = -3.3
      const beam = new THREE.Mesh(this.gHold, this.holdM); beam.position.y = 1.4; hold.add(beam)
      const bub = new THREE.Mesh(this.gBubble, this.bubbleM); hold.add(bub)
      if (u.kind === 'naruto') { const nr = new THREE.Mesh(this.gNaruto, [this.narutoM, this.narutoM, this.narutoM]); nr.rotation.x = Math.PI / 2; hold.add(nr) }
      else {
        const bowl = new THREE.Mesh(this.gBowl, this.bowlM), inner = new THREE.Mesh(this.gBowl, this.bowlIn); inner.scale.setScalar(0.97)
        const soup = new THREE.Mesh(this.gSoup, this.soupM); soup.position.y = 0.18
        const nd = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.12, 6, 16).rotateX(Math.PI / 2), this.noodleM); nd.position.y = 0.2
        hold.add(bowl, inner, soup, nd); g.userData.soup = soup; g.userData.noodle = nd
        const straw = new THREE.Mesh(this.gStraw, this.strawM); straw.position.y = 3.3; hold.add(straw)
      }
      body.add(hold); g.userData.hold = hold
    }
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
      U.charge.material.opacity = u.atk === 'missile' ? 0.25 + 0.25 * Math.sin(now * 30) : 0
      U.charge.scale.setScalar(u.atk === 'missile' ? 0.6 + 0.4 * Math.max(0, u.charge) : 1)
      if (U.hold) {
        U.hold.visible = !!u.bowl && u.state !== 'fall'
        if (U.soup && u.bowl) { const k = u.bowl.left / 100; U.soup.position.y = -0.3 + 0.48 * k; U.soup.scale.setScalar(0.6 + 0.4 * k); U.noodle.position.y = U.soup.position.y + 0.03; U.noodle.visible = k > 0.08 }
        U.hold.rotation.y = -u.spin + now * 0.6
      }
      if (U.alien) { U.alien.rotation.y = -u.spin + Math.atan2(R.lastR ? R.lastR.x - u.x : 0, R.lastR ? R.lastR.z - u.z : 1); U.alien.position.y = 0.55 + Math.abs(Math.sin(now * 5 + u.id)) * 0.08 }
    }
    for (const [id, m] of this.models) if (!seen.has(id)) { this.scene.remove(m); this.models.delete(id) }
  }
  modelOf(id) { return this.models.get(id) }
}

// 母船（どんぶり号）: 伏せたラーメン丼の形。ふちに雷文、箸が2本刺さっている
export class MotherView {
  constructor(scene) {
    const g = new THREE.Group()
    const prof = [[0, 7.5], [9, 7.2], [13, 5.5], [17, 1.2], [18.4, 0], [18.6, -0.6], [16, -1.4], [6, -1.8], [0, -1.9]].map(([a, b]) => new THREE.Vector2(a, b))
    const hull = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.42, metalness: 0.05 }))
    hull.castShadow = true
    const band = new THREE.Mesh(new THREE.CylinderGeometry(15.4, 18.0, 3.6, 64, 1, true), new THREE.MeshStandardMaterial({ map: RAIMON_TEX(), roughness: 0.5, side: THREE.DoubleSide }))
    band.position.y = 2.4
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.2, 1.6, 40), new THREE.MeshStandardMaterial({ color: 0xb8211a, roughness: 0.5 })); foot.position.y = 7.9
    const under = new THREE.Mesh(new THREE.CircleGeometry(18, 48).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3b3f48, roughness: 0.6, metalness: 0.5 })); under.position.y = -1.85
    const lights = new THREE.Group()
    const lm = new THREE.MeshBasicMaterial({ color: 0xffd26a })
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, L = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lm); L.position.set(Math.cos(a) * 17.6, -0.9, Math.sin(a) * 17.6); lights.add(L) }
    const chopM = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.7 })
    for (const [x, rz] of [[-2.2, 0.32], [1.6, 0.42]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 26, 8), chopM); c.position.set(x, 14, -1.5); c.rotation.z = rz; c.castShadow = true; g.add(c) }
    g.add(hull, band, foot, under, lights)
    g.visible = false
    scene.add(g)
    this.g = g; this.lights = lights
  }
  update(B, now) {
    this.g.visible = !!B
    if (!B) return
    this.g.position.set(B.x, B.y, B.z)
    this.g.rotation.y = B.spin * 0.5
    this.g.rotation.z = B.state === 'down' ? B.down * 0.15 : Math.sin(now * 0.5) * 0.02
    this.lights.rotation.y = now * 0.4
  }
}

// 攻撃の見た目: 吸い上げ光線（地面の輪＋光の円すい）・なぎ払い（地面の線＋光線）・ドローン・追尾弾
export class AttackView {
  constructor(scene) {
    this.scene = scene
    const plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)
    this.ringMat = new THREE.MeshBasicMaterial({ map: ringTex('rgba(80,240,255,1)', 'rgba(255,240,120,1)', 'rgba(255,70,40,.4)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false })
    const coneTex = canvasTex(4, 128, (x) => { const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(200,255,255,.95)'); g.addColorStop(1, 'rgba(90,240,255,.35)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128) })
    this.coneMat = new THREE.MeshBasicMaterial({ map: coneTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })
    this.beams = []
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(plane, this.ringMat.clone()); ring.renderOrder = 4
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, -0.5, 0), this.coneMat.clone()); cone.renderOrder = 5
      ring.visible = cone.visible = false; scene.add(ring, cone)
      this.beams.push({ ring, cone })
    }
    // なぎ払い: 地面の赤い破線の帯・UFO から2本の細い予告線・本番の光線
    const stripeTex = canvasTex(64, 16, (x) => { x.fillStyle = 'rgba(255,40,30,1)'; x.fillRect(0, 0, 40, 16); x.fillStyle = 'rgba(255,230,90,1)'; x.fillRect(40, 0, 24, 16) }); stripeTex.wrapS = THREE.RepeatWrapping
    this.lasers = []
    for (let i = 0; i < 4; i++) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: stripeTex.clone(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false }))
      strip.material.map.wrapS = THREE.RepeatWrapping; strip.renderOrder = 4
      const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff2e0, fog: false }))
      const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3))
      const fan = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }))
      const scorch = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(255,240,200,1)'], [0.4, 'rgba(255,120,40,.8)'], [1, 'rgba(255,40,0,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
      for (const o of [strip, ray, core, fan, scorch]) { o.visible = false; scene.add(o) }
      this.lasers.push({ strip, ray, core, fan, scorch })
    }
    // ドローン: 小さい玉に赤い目と回る輪
    this.drones = []
    const dm = new THREE.MeshStandardMaterial({ color: 0x2b2f38, metalness: 0.7, roughness: 0.35 }), eye = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), ringM = new THREE.MeshBasicMaterial({ color: 0x7ef2ff })
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), dm))
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), eye); e.position.z = 0.48; g.add(e)
      const rg = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 6, 20).rotateX(Math.PI / 2), ringM); g.add(rg)
      g.userData.ring = rg; g.visible = false; scene.add(g); this.drones.push(g)
    }
    // 追尾弾: 光る玉と尾
    const glowTex = radialTex([[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,120,200,.95)'], [0.6, 'rgba(200,40,255,.4)'], [1, 'rgba(120,0,255,0)']])
    this.missiles = []
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group()
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe0ff }))
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.scale.setScalar(3.4)
      g.add(core, glow); g.visible = false; scene.add(g)
      this.missiles.push({ g, trail: [] })
    }
    this.trailMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5, fog: false })
    this.trails = []
    for (let i = 0; i < 60; i++) { const s = new THREE.Sprite(this.trailMat.clone()); s.visible = false; scene.add(s); this.trails.push({ s, life: 0 }) }
    this.ti = 0
    // 落ちてくる丼: 泡と丼・落ちる所の輪（取りやすく）
    this.bowls = []
    const ui = new UfoView(scene)
    this._ui = ui
    const landTex = radialTex([[0, 'rgba(255,230,120,0)'], [0.7, 'rgba(255,220,110,.15)'], [0.86, 'rgba(255,214,90,.95)'], [1, 'rgba(255,200,80,0)']])
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group()
      const bowl = new THREE.Mesh(ui.gBowl, ui.bowlM), inner = new THREE.Mesh(ui.gBowl, ui.bowlIn); inner.scale.setScalar(0.97)
      const soup = new THREE.Mesh(ui.gSoup, ui.soupM); soup.position.y = 0.15
      const nar = new THREE.Mesh(ui.gNaruto, [ui.narutoM, ui.narutoM, ui.narutoM]); nar.rotation.x = Math.PI / 2
      const bub = new THREE.Mesh(ui.gBubble, ui.bubbleM)
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,240,180,.9)'], [1, 'rgba(255,200,80,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); glow.scale.setScalar(5)
      g.add(bowl, inner, soup, nar, bub, glow)
      const mark = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: landTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false })); mark.renderOrder = 4
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 6).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.55, depthWrite: false, fog: false }))
      g.visible = mark.visible = col.visible = false; scene.add(g, mark, col)
      this.bowls.push({ g, bowl, inner, soup, nar, bub, mark, col })
    }
  }
  update(R, dt, now, groundAt) {
    // 光線
    for (let i = 0; i < this.beams.length; i++) {
      const V = this.beams[i], b = R.beams[i]
      if (!b || b.ux == null) { V.ring.visible = V.cone.visible = false; continue }
      V.ring.visible = true; V.ring.position.set(b.x, b.gy + 0.25, b.z)
      const warn = b.phase === 'warn', k = warn ? Math.min(1, b.t / 1.35) : 1
      V.ring.scale.setScalar(b.r * (warn ? 1.2 - 0.2 * k : 1))
      V.ring.rotation.y = now * (warn ? 1.2 : 3)
      V.ring.material.opacity = warn ? (k > 0.7 ? (Math.sin(now * 40) > 0 ? 1 : 0.4) : 0.55 + 0.4 * k) : 1
      // 円すい: UFO の底 → 地面
      const dx = b.x - b.ux, dy = b.gy - b.uy, dz = b.z - b.uz, L = Math.hypot(dx, dy, dz)
      V.cone.visible = true
      V.cone.position.set(b.ux, b.uy, b.uz)
      V.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dx / L, dy / L, dz / L))
      V.cone.geometry.parameters // 半径は scale で
      V.cone.scale.set(warn ? 0.6 + 0.4 * k : b.r, L, warn ? 0.6 + 0.4 * k : b.r)
      V.cone.material.opacity = warn ? 0.12 + 0.12 * k : 0.75 + 0.2 * Math.sin(now * 30)
    }
    // なぎ払い
    for (let i = 0; i < this.lasers.length; i++) {
      const V = this.lasers[i], L = R.lasers[i]
      if (!L || L.ux == null) { V.strip.visible = V.ray.visible = V.core.visible = V.fan.visible = V.scorch.visible = false; continue }
      const mx = (L.ax + L.bx) / 2, mz = (L.az + L.bz) / 2, len = Math.hypot(L.bx - L.ax, L.bz - L.az)
      V.strip.visible = true; V.strip.position.set(mx, L.gy + 0.22, mz); V.strip.scale.set(len, 1, 1.4)
      V.strip.rotation.y = -Math.atan2(L.bz - L.az, L.bx - L.ax)
      V.strip.material.map.repeat.set(len / 3, 1); V.strip.material.map.offset.x = -now * 2
      const warn = L.phase === 'warn'
      V.strip.material.opacity = warn ? (L.t > 1.0 ? (Math.sin(now * 40) > 0 ? 1 : 0.35) : 0.85) : 0.5
      // 予告の扇（UFO と地面の線の三角）
      V.fan.visible = warn
      if (warn) { const p = V.fan.geometry.attributes.position; p.setXYZ(0, L.ux, L.uy, L.uz); p.setXYZ(1, L.ax, L.gy, L.az); p.setXYZ(2, L.bx, L.gy, L.bz); p.needsUpdate = true; V.fan.geometry.computeBoundingSphere(); V.fan.material.opacity = 0.08 + 0.1 * Math.min(1, L.t / 1.4) }
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
    for (let i = 0; i < this.missiles.length; i++) {
      const V = this.missiles[i], m = R.missiles[i]
      V.g.visible = !!m; if (!m) continue
      V.g.position.set(m.x, m.y, m.z)
      const T = this.trails[this.ti]; this.ti = (this.ti + 1) % this.trails.length
      T.s.visible = true; T.s.position.set(m.x, m.y, m.z); T.life = 0.45; T.s.scale.setScalar(2)
    }
    for (const T of this.trails) { if (!T.s.visible) continue; T.life -= dt; if (T.life <= 0) { T.s.visible = false; continue } T.s.material.opacity = T.life * 1.1; T.s.scale.setScalar(0.6 + T.life * 3) }
    // 丼
    for (let i = 0; i < this.bowls.length; i++) {
      const V = this.bowls[i], b = R.bowls[i]
      const on = !!b; V.g.visible = V.mark.visible = V.col.visible = on
      if (!on) continue
      V.g.position.set(b.x, b.y, b.z)
      V.g.rotation.set(Math.sin(now * 2 + i) * 0.2, now * 0.8, Math.cos(now * 1.7 + i) * 0.2)
      const nr = !!b.naruto
      V.bowl.visible = V.inner.visible = V.soup.visible = !nr; V.nar.visible = nr
      V.soup.position.y = -0.3 + 0.45 * b.left / 100
      V.bub.visible = b.state === 'fall'
      const gy = b.state === 'ground' ? b.y - 0.3 : groundAt(b.x, b.z, b.y)
      V.mark.position.set(b.x, gy + 0.2, b.z); V.mark.scale.setScalar(2.4 + Math.sin(now * 6) * 0.25)
      V.col.position.set(b.x, gy, b.z); V.col.scale.set(1, Math.max(0.1, b.y - gy), 1); V.col.visible = b.state === 'fall'
      if (b.state === 'ground') { V.g.rotation.set(0, now * 0.4, 0); V.mark.material.opacity = Math.sin(now * (6 + b.t * 3)) > 0 ? 1 : 0.4 }
      else V.mark.material.opacity = 1
    }
  }
}
