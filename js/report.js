// 結果の紙: 第7迎撃班の作戦報告書。焼けた紙に写真・数字・評価の判。1枚の画像にして保存・SNS に貼れる
const W = 1080, H = 1350
const HEAD = '"M PLUS 1p", "Hiragino Sans", sans-serif', SANS = '"BIZ UDPGothic", "Hiragino Sans", sans-serif', MONO = '"Share Tech Mono", ui-monospace, monospace'

export function drawReport(cv, d) {
  cv.width = W; cv.height = H
  const x = cv.getContext('2d')
  // 背景: 煤けた机
  const bg = x.createRadialGradient(W / 2, H * 0.4, 100, W / 2, H / 2, 900); bg.addColorStop(0, '#2a2422'); bg.addColorStop(1, '#0e0c0c')
  x.fillStyle = bg; x.fillRect(0, 0, W, H)
  // 紙（少し傾けて、縁が焦げている）
  x.save(); x.translate(W / 2, H / 2); x.rotate(-0.01); x.translate(-W / 2, -H / 2)
  const L = 64, T = 46, PW = W - 128, PH = H - 96
  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(L + 12, T + 16, PW, PH)
  x.fillStyle = '#d9d2c3'; x.fillRect(L, T, PW, PH)
  // 紙のしみと焦げ（決まった場所に。毎回同じ見た目）
  let sd = 7; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 26; i++) { const cx = L + rr() * PW, cy = T + rr() * PH, g = x.createRadialGradient(cx, cy, 2, cx, cy, 40 + rr() * 120); g.addColorStop(0, 'rgba(120,96,70,.16)'); g.addColorStop(1, 'rgba(120,96,70,0)'); x.fillStyle = g; x.fillRect(L, T, PW, PH) }
  for (const [cx, cy, r] of [[L + PW, T + PH, 260], [L, T + PH * 0.7, 160], [L + PW * 0.8, T, 140]]) { const g = x.createRadialGradient(cx, cy, r * 0.2, cx, cy, r); g.addColorStop(0, 'rgba(20,12,8,.95)'); g.addColorStop(0.5, 'rgba(60,34,18,.55)'); g.addColorStop(1, 'rgba(60,34,18,0)'); x.fillStyle = g; x.fillRect(L, T, PW, PH) }
  const ink = '#1c1a18', red = '#9a2418', mute = '#5d564c', line = '#9c9384'
  x.textBaseline = 'alphabetic'
  // 見出しの帯
  x.fillStyle = '#26282c'; x.fillRect(L, T, PW, 120)
  x.fillStyle = '#d9d2c3'; x.font = `700 26px ${SANS}`; x.textAlign = 'left'; x.fillText(d.unit, L + 40, T + 46)
  x.font = `900 58px ${HEAD}`; x.fillText(d.title, L + 40, T + 100)
  x.textAlign = 'right'; x.font = `400 26px ${MONO}`; x.fillText(d.date, L + PW - 40, T + 46)
  x.font = `700 24px ${SANS}`; x.fillText(d.dayLabel, L + PW - 40, T + 96)
  // 結果の一行
  x.textAlign = 'left'; x.fillStyle = d.end === 'clear' ? '#1f5a3a' : red; x.font = `800 36px ${HEAD}`; x.fillText(d.sub, L + 40, T + 178)
  x.strokeStyle = line; x.lineWidth = 2; x.beginPath(); x.moveTo(L + 40, T + 198); x.lineTo(L + PW - 40, T + 198); x.stroke()
  // 写真（いちばんいい一撃）
  const PY = T + 226, PWd = 420, PHh = 300
  const px = L + PW - 40 - PWd
  if (d.photo) {
    x.save(); x.translate(px, PY); x.rotate(0.025)
    x.fillStyle = '#efeae0'; x.fillRect(-12, -12, PWd + 24, PHh + 60)
    const iw = d.photo.width, ih = d.photo.height, s = Math.max(PWd / iw, PHh / ih)
    x.save(); x.beginPath(); x.rect(0, 0, PWd, PHh); x.clip(); x.drawImage(d.photo, (PWd - iw * s) / 2, (PHh - ih * s) / 2, iw * s, ih * s)
    x.fillStyle = 'rgba(40,30,20,.12)'; x.fillRect(0, 0, PWd, PHh); x.restore()
    x.fillStyle = mute; x.font = `700 22px ${SANS}`; x.textAlign = 'center'; x.fillText(d.caption, PWd / 2, PHh + 36)
    // 留めたテープ
    x.fillStyle = 'rgba(190,180,150,.75)'; x.save(); x.translate(PWd / 2, -10); x.rotate(-0.05); x.fillRect(-60, -14, 120, 28); x.restore()
    x.restore()
  }
  // 数字（左の列）
  x.textAlign = 'left'
  const sx = L + 40, colW = d.photo ? PW - 80 - PWd - 40 : PW - 80
  let y = PY + 34
  for (const [k, v, good] of d.stats) {
    x.fillStyle = mute; x.font = `700 28px ${SANS}`; x.fillText(k, sx, y)
    x.fillStyle = good ? '#1f5a3a' : ink; x.font = `400 44px ${MONO}`; x.textAlign = 'right'; x.fillText(v, sx + colW, y + 4); x.textAlign = 'left'
    x.strokeStyle = line; x.setLineDash([5, 7]); x.beginPath(); x.moveTo(sx, y + 18); x.lineTo(sx + colW, y + 18); x.stroke(); x.setLineDash([])
    y += 58
  }
  // 波ごとの秒数（小さな棒）
  y = Math.max(y, d.photo ? PY + PHh + 80 : 0) + 12
  if (d.waves && d.waves.length) {
    x.fillStyle = mute; x.font = `700 24px ${SANS}`; x.fillText(d.ja ? '波ごとの排除時間' : 'Time per wave', sx, y); y += 16
    const bw = (PW - 80) / 4
    d.waves.forEach((s, i) => {
      const h = Math.min(70, s * 1.4)
      x.fillStyle = '#3a3c40'; x.fillRect(sx + i * bw + 8, y + 76 - h, bw - 16, h)
      x.fillStyle = ink; x.font = `400 26px ${MONO}`; x.textAlign = 'center'; x.fillText(`${s}s`, sx + i * bw + bw / 2, y + 108); x.textAlign = 'left'
    })
    y += 130
  }
  // 戦果と評価
  const bottom = T + PH - 54
  x.fillStyle = mute; x.font = `700 28px ${SANS}`; x.fillText(d.scoreLabel, sx, bottom - 210)
  x.fillStyle = ink; x.font = `400 104px ${MONO}`; x.fillText(d.score, sx - 4, bottom - 116)
  // 管制の一言
  x.fillStyle = '#26282c'; x.fillRect(sx, bottom - 82, 76, 34)
  x.fillStyle = '#d9d2c3'; x.font = `700 22px ${SANS}`; x.textAlign = 'center'; x.fillText(d.commander, sx + 38, bottom - 57); x.textAlign = 'left'
  x.fillStyle = ink; x.font = `700 28px ${SANS}`
  wrap(x, d.comment, sx + 92, bottom - 56, PW - 92 - 360, 38)
  // 評価の判（四角い朱の判）
  x.save(); x.translate(L + PW - 170, bottom - 150); x.rotate(-0.12)
  x.strokeStyle = red; x.lineWidth = 9; x.strokeRect(-118, -118, 236, 236); x.lineWidth = 3; x.strokeRect(-104, -104, 208, 208)
  x.fillStyle = red; x.textAlign = 'center'
  x.font = `700 22px ${SANS}`; x.fillText(d.rankLabel, 0, -70)
  x.font = `900 130px ${HEAD}`; x.fillText(d.rank, 0, 46)
  const nm = d.rankName
  x.font = `800 ${nm.length > 10 ? 18 : 26}px ${HEAD}`; x.fillText(nm, 0, 92)
  // 判のかすれ
  x.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(0,0,0,${0.2 + rr() * 0.5})`; x.fillRect(-120 + rr() * 240, -120 + rr() * 240, 2 + rr() * 6, 1 + rr() * 3) }
  x.globalCompositeOperation = 'source-over'
  x.restore()
  x.fillStyle = mute; x.font = `400 20px ${MONO}`; x.textAlign = 'right'; x.fillText(d.footer, L + PW - 40, T + PH - 20)
  x.restore()
}
function wrap(x, s, X, Y, w, lh) {
  let line = '', y = Y
  const parts = /[^\x00-\x7f]/.test(s) ? [...s] : s.split(/(?<= )/)
  for (const c of parts) { if (x.measureText(line + c).width > w && line) { x.fillText(line, X, y); line = c.trimStart(); y += lh } else line += c }
  if (line) x.fillText(line, X, y)
}
