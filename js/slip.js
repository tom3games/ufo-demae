// 結果の紙: 宙吊軒の出前伝票（UFO被害の分）。1枚の画像にして保存・SNS に貼れる
const W = 1080, H = 1350
const BRUSH = '"Yuji Syuku", serif', HAND = '"Klee One", serif', SANS = '"BIZ UDPGothic", sans-serif'

export function drawSlip(cv, d) {
  cv.width = W; cv.height = H
  const x = cv.getContext('2d')
  x.fillStyle = '#211a14'; x.fillRect(0, 0, W, H)
  // 紙（少し傾けた伝票。上に赤い帯、下はミシン目）
  x.save(); x.translate(W / 2, H / 2); x.rotate(-0.012); x.translate(-W / 2, -H / 2)
  const L = 70, T = 50, PW = W - 140, PH = H - 110
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(L + 10, T + 14, PW, PH)
  x.fillStyle = '#f4eee0'; x.fillRect(L, T, PW, PH)
  x.fillStyle = '#b8211a'; x.fillRect(L, T, PW, 18)
  x.fillStyle = '#211a14'; for (let i = 0; i < PW / 24; i++) { x.beginPath(); x.arc(L + 12 + i * 24, T + PH, 8, 0, Math.PI * 2); x.fill() }
  const ink = '#1d1a16', red = '#b8211a', mute = '#6b6252'
  x.textBaseline = 'alphabetic'
  // 見出し
  x.fillStyle = red; x.font = `34px ${BRUSH}`; x.textAlign = 'left'; x.fillText(d.shop, L + 40, T + 74)
  x.fillStyle = ink; x.font = `64px ${BRUSH}`; x.fillText(d.title, L + 40, T + 146)
  x.fillStyle = mute; x.font = `600 26px ${HAND}`; x.textAlign = 'right'; x.fillText(d.date, L + PW - 40, T + 74)
  x.textAlign = 'left'; x.fillStyle = red; x.font = `600 28px ${HAND}`; x.fillText(d.sub, L + 40, T + 190)
  // 写真（いちばんいい体当たりの瞬間）
  const PY = T + 226, PHh = 290
  if (d.photo) {
    x.save(); x.translate(L + PW - 40 - 400, PY); x.rotate(0.03)
    x.fillStyle = '#fff'; x.fillRect(-10, -10, 420, PHh + 54)
    const iw = d.photo.width, ih = d.photo.height, s = Math.max(400 / iw, PHh / ih)
    x.save(); x.beginPath(); x.rect(0, 0, 400, PHh); x.clip(); x.drawImage(d.photo, (400 - iw * s) / 2, (PHh - ih * s) / 2, iw * s, ih * s); x.restore()
    x.fillStyle = mute; x.font = `600 22px ${HAND}`; x.textAlign = 'center'; x.fillText(d.caption, 200, PHh + 32)
    x.restore()
  }
  // 数字
  x.textAlign = 'left'
  const sx = L + 40, colW = d.photo ? PW - 500 : PW - 80
  let y = PY + 30
  for (const [k, v, bad] of d.stats) {
    x.fillStyle = mute; x.font = `600 34px ${HAND}`; x.fillText(k, sx, y)
    x.fillStyle = bad ? red : ink; x.font = `600 46px ${HAND}`; x.textAlign = 'right'; x.fillText(v, sx + colW, y + 2); x.textAlign = 'left'
    x.strokeStyle = '#cfc4ac'; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(sx, y + 16); x.lineTo(sx + colW, y + 16); x.stroke(); x.setLineDash([])
    y += 70
  }
  // 丼の一覧
  y = Math.max(y, d.photo ? PY + PHh + 70 : 0) + 10
  x.fillStyle = red; x.font = `34px ${BRUSH}`; x.fillText(d.logTitle, sx, y); y += 18
  x.strokeStyle = red; x.lineWidth = 3; x.beginPath(); x.moveTo(sx, y); x.lineTo(L + PW - 40, y); x.stroke(); y += 44
  const rows = d.rows, maxRows = d.photo ? 7 : 8
  const shown = rows.length > maxRows ? rows.slice(0, maxRows - 1) : rows
  for (const r of shown) {
    x.fillStyle = r.bad ? mute : ink; x.font = `600 36px ${HAND}`; x.textAlign = 'left'; x.fillText(r.text, sx, y)
    x.fillStyle = r.bad ? red : r.good ? '#2a6b3a' : ink; x.font = `600 32px ${HAND}`; x.textAlign = 'right'; x.fillText(r.note, L + PW - 40, y)
    y += 52
  }
  if (rows.length > maxRows) { x.fillStyle = mute; x.font = `600 26px ${HAND}`; x.textAlign = 'left'; x.fillText(d.more(rows.length - shown.length), sx, y); y += 44 }
  x.textAlign = 'left'
  // 点数
  const by = L + 0, bottom = T + PH - 60
  x.fillStyle = ink; x.font = `600 30px ${HAND}`; x.fillText(d.scoreLabel, sx, bottom - 150)
  x.font = `600 84px ${HAND}`; x.fillText(d.score, sx, bottom - 70)
  // 店主の一言
  x.fillStyle = red; x.font = `24px ${BRUSH}`; x.fillText(d.boss, sx, bottom - 18)
  x.fillStyle = ink; x.font = `600 28px ${HAND}`
  wrap(x, d.comment, sx + 90, bottom - 18, PW - 420, 36)
  // ハンコ
  x.save(); x.translate(L + PW - 170, bottom - 110); x.rotate(-0.18)
  x.strokeStyle = red; x.lineWidth = 8; x.beginPath(); x.arc(0, 0, 100, 0, Math.PI * 2); x.stroke()
  x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 86, 0, Math.PI * 2); x.stroke()
  x.fillStyle = red; x.textAlign = 'center'; x.font = `${d.stamp.length > 4 ? 40 : 52}px ${BRUSH}`
  const st = d.stamp
  if (st.length > 4 && /[^\x00-\x7f]/.test(st)) { x.fillText(st.slice(0, Math.ceil(st.length / 2)), 0, -6); x.fillText(st.slice(Math.ceil(st.length / 2)), 0, 42) } else x.fillText(st, 0, 18)
  x.restore()
  x.fillStyle = mute; x.font = `600 20px ${SANS}`; x.textAlign = 'right'; x.fillText(d.footer, L + PW - 40, T + PH - 22)
  x.restore()
  void by
}
function wrap(x, s, X, Y, w, lh) {
  let line = '', y = Y
  const parts = /[^\x00-\x7f]/.test(s) ? [...s] : s.split(/(?<= )/)
  for (const c of parts) { if (x.measureText(line + c).width > w && line) { x.fillText(line, X, y); line = c.trimStart(); y += lh } else line += c }
  if (line) x.fillText(line, X, y)
}
