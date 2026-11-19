// ===== 描画の土台・会場・画面全体（Canvas 2D。画像ファイルなし）=====
const $ = id => document.getElementById(id);
const cv = $('cv'); let g = cv.getContext('2d');
const FONT = '"Hiragino Maru Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans JP",sans-serif';
let S = 1, OX = 0, OY = 0, DPR = 1, vw = 0, vh = 0;
let shakeT = 0, shakeAmp = 0, flashT = 0, flashColor = '#fff';
const popups = [], parts = [], confetti = [];
const pressT = [0, 0, 0];          // 手のボタンを押したときの光り
const itemPress = { hammer: 0, hammerT: 0, helmet: 0 };
let react = null;                  // 直近の反応の秒数の表示 { sec, praise, correct }
let GALLERY = false;              // 見た目の確認用（debug）

// 見た目の状態（ロジックとは別。出来事に反応して動く）
const VS = {
  cpu: null,                       // 相手の反応 { kind, t0, lvl, final }
  ia: { hammer: null, helmet: null },   // 自分の道具の動き { t0, mode, pon }
  slam: null,                      // 相手の道具が来る動き { t0, kind, lvl }
  viewHelmetT: -9,                 // 自分がヘルメットを被った時刻
  introT: -9,                      // 相手が出てきた時刻
  starSky: false,                  // 最終戦で相手が星になった
  retT: { hammer: -9, helmet: -9 },// 道具が机に戻った時刻
  crowd: 0, murmur: 0,             // 会場の盛り上がり・ざわめき
  lastPhase: ''
};

// 画面の部品の位置（論理座標 幅 100 × 高さ 177.8）。タップの判定にも使う
const LAY = {
  face: { x: 50, y: 44, r: 11 },
  tableY: 68, floorY: 65,
  cpuHand: { x: 50, y: 78, size: 19 },
  myHand: { x: 50, y: 102, size: 19 },
  btnY: 148, btnH: 26,
  btns: [{ x: 4, w: 30 }, { x: 35, w: 30 }, { x: 66, w: 30 }],
  hammer: { x: 4, y: 116, w: 44, h: 30, cx: 26, cy: 131 },
  helmet: { x: 52, y: 116, w: 44, h: 30, cx: 74, cy: 131 }
};

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  vw = window.innerWidth; vh = window.innerHeight;
  cv.width = Math.round(vw * DPR); cv.height = Math.round(vh * DPR);
  S = Math.min(vw / CFG.W, vh / CFG.H) * DPR;
  OX = (cv.width - CFG.W * S) / 2; OY = (cv.height - CFG.H * S) / 2;
}
const sx = x => OX + x * S;
const sy = y => OY + y * S;
function view() { return { x0: -OX / S, x1: (cv.width - OX) / S, y0: -OY / S, y1: (cv.height - OY) / S }; }
// 画面の座標（clientX/Y）→ 論理座標
function toLogic(cx, cy) { return { x: (cx * DPR - OX) / S, y: (cy * DPR - OY) / S }; }

// 別のキャンバスに同じ絵を描く（結果カードの画像・結果の相手の顔）
function withCtx(canvas, scale, ox, oy, fn) {
  const sg = g, sS = S, sOX = OX, sOY = OY, scv = cv;
  g = canvas.getContext('2d'); S = scale; OX = ox; OY = oy;
  try { fn(); } finally { g = sg; S = sS; OX = sOX; OY = sOY; }
}

function addPopup(text, x, y, size, color, life) { popups.push({ text, x, y, size, color, life: life || 0.9, t: 0 }); }
function burst(x, y, color, n, speed, life, star) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.2832, v = (0.4 + Math.random() * 0.6) * (speed || 30);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 8, life: (life || 0.6) * (0.6 + Math.random() * 0.5), t: 0, color, size: 1.5 + Math.random() * 1.8, star: !!star, rot: Math.random() * 6 });
  }
}
function shake(amp, dur) { shakeAmp = amp; shakeT = dur; }
function flash(color, dur) { flashColor = color; flashT = dur; }
function startConfetti(n) {
  const v = view();
  const cols = ['#e23b3b', '#ffd23f', '#3d9bff', '#38c172', '#ff8ac0', '#fff'];
  for (let i = 0; i < n; i++) confetti.push({ x: v.x0 + Math.random() * (v.x1 - v.x0), y: v.y0 - Math.random() * 90, vx: (Math.random() - 0.5) * 14, vy: 18 + Math.random() * 24, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 9, w: 1.4 + Math.random() * 1.4, c: cols[i % cols.length], ph: Math.random() * 6 });
}

function updateVisual(dt, nowT) {
  shakeT = Math.max(0, shakeT - dt);
  flashT = Math.max(0, flashT - dt);
  for (let i = 0; i < 3; i++) pressT[i] = Math.max(0, pressT[i] - dt);
  itemPress.hammer = Math.max(0, itemPress.hammer - dt);
  itemPress.helmet = Math.max(0, itemPress.helmet - dt);
  VS.crowd = Math.max(0, VS.crowd - dt * 0.6);
  VS.murmur = Math.max(0, VS.murmur - dt * 0.5);
  for (const p of popups) p.t += dt;
  for (let i = popups.length - 1; i >= 0; i--) if (popups[i].t > popups[i].life) popups.splice(i, 1);
  for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 50 * dt; p.rot += dt * 6; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t > parts[i].life) parts.splice(i, 1);
  const v = view();
  for (const c of confetti) { c.ph += dt * 3; c.x += (c.vx + Math.sin(c.ph) * 6) * dt; c.y += c.vy * dt; c.rot += c.vr * dt; }
  for (let i = confetti.length - 1; i >= 0; i--) {
    if (confetti[i].y > v.y1 + 4) {
      if (Game.tourney === 'champion' && Game.mode === 'over') { const c = confetti[i]; c.y = v.y0 - 4; c.x = v.x0 + Math.random() * (v.x1 - v.x0); } else confetti.splice(i, 1);
    }
  }
  // 机に戻った道具のぽん
  const ph = Game.mode === 'title' ? '' : Game.phase;
  if (VS.lastPhase === 'result' && ph !== 'result' && ph !== 'over') { VS.retT.hammer = nowT; VS.retT.helmet = nowT; }
  VS.lastPhase = ph;
}

// ---------- 基本の図形（論理座標）----------
function rr(x, y, w, h, r) {
  const X = sx(x), Y = sy(y), W = w * S, H = h * S, R = Math.min(r, w / 2, h / 2) * S;
  g.beginPath(); g.moveTo(X + R, Y); g.arcTo(X + W, Y, X + W, Y + H, R); g.arcTo(X + W, Y + H, X, Y + H, R);
  g.arcTo(X, Y + H, X, Y, R); g.arcTo(X, Y, X + W, Y, R); g.closePath();
}
function fillRR(x, y, w, h, r, fill, stroke, lw) {
  rr(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = (lw || 0.6) * S; g.stroke(); }
}
function circle(x, y, r, fill, stroke, lw) {
  g.beginPath(); g.arc(sx(x), sy(y), Math.max(0, r) * S, 0, 6.2832);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = (lw || 0.6) * S; g.stroke(); }
}
function rect(x, y, w, h, fill) { g.fillStyle = fill; g.fillRect(sx(x), sy(y), w * S, h * S); }
function txt(str, x, y, size, fill, o) {
  o = o || {};
  g.font = (o.weight || 'bold') + ' ' + (size * S) + 'px ' + FONT;
  g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'middle';
  if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = (o.sw || size * 0.18) * S; g.strokeStyle = o.stroke; g.strokeText(str, sx(x), sy(y)); }
  g.fillStyle = fill; g.fillText(str, sx(x), sy(y));
}
function star(x, y, r, fill, rot, stroke) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + i * Math.PI / 5 - Math.PI / 2, rad = (i % 2 ? r * 0.45 : r) * S;
    const px = sx(x) + Math.cos(a) * rad, py = sy(y) + Math.sin(a) * rad;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath(); g.fillStyle = fill; g.fill();
  if (stroke) { g.lineJoin = 'round'; g.lineWidth = 0.5 * S; g.strokeStyle = stroke; g.stroke(); }
}

// ---------- 会場 ----------
const AUD_COLS = ['#e8604c', '#4c8fe8', '#3fae6a', '#f0b429', '#a86ad8', '#ec7fb0', '#35b5c4'];
const AUD_HAIR = ['#2a1a14', '#5a3a22', '#1a1a2a', '#8a8a8a', '#c9a24a'];

// のぼり旗（縦書き）。x,y は左上
function nobori(x, y, w, h, color, chars, sway) {
  const sw = Math.sin(sway) * 0.8;
  rect(x - 0.5, y - 1.6, w + 1, 1.2, '#7a4a22');
  g.beginPath();
  g.moveTo(sx(x), sy(y)); g.lineTo(sx(x + w), sy(y)); g.lineTo(sx(x + w + sw), sy(y + h));
  g.lineTo(sx(x + w / 2 + sw), sy(y + h - 2)); g.lineTo(sx(x + sw), sy(y + h)); g.closePath();
  g.fillStyle = color; g.fill(); g.lineWidth = 0.4 * S; g.strokeStyle = '#7a1a1a'; g.stroke();
  const cs = Array.from(chars), n = cs.length, sz = Math.min(w * 0.62, (h - 6) / n);
  for (let i = 0; i < n; i++) txt(cs[i], x + w / 2 + sw * (i / n), y + 3.2 + sz * (i + 0.5), sz, color === '#fff' ? '#c62828' : '#fff', { weight: '900' });
}

function drawAudience(x0, x1, nowT) {
  // 床（体育館）＋観客の列。x0〜x1 の間だけ描く
  if (x1 - x0 < 1) return;
  const exc = VS.crowd, mur = VS.murmur;
  for (let row = 0; row < 3; row++) {
    const sc = 0.85 + row * 0.2, y = 82 + row * 24, step = 15 * sc;
    const i0 = Math.floor(x0 / step) - 1, i1 = Math.ceil(x1 / step) + 1;
    for (let i = i0; i <= i1; i++) {
      const hsh = (i * 7 + row * 13 + 1000) % 17;
      const px = i * step + (row % 2) * step * 0.5;
      if (px < x0 - step || px > x1 + step) continue;
      const bob = Math.sin(nowT * (2.4 + (hsh % 5) * 0.3) + hsh) * (0.5 + exc * 2.2) * sc - exc * Math.abs(Math.sin(nowT * 7 + hsh)) * 2.2 * sc;
      const sway = mur * Math.sin(nowT * 5 + hsh) * 1.2;
      const py = y + bob, c = AUD_COLS[hsh % AUD_COLS.length], hc = AUD_HAIR[hsh % AUD_HAIR.length];
      // 体
      g.beginPath(); g.ellipse(sx(px + sway), sy(py + 11 * sc), 8 * sc * S, 9 * sc * S, 0, Math.PI, 0); g.lineTo(sx(px + 8 * sc + sway), sy(py + 21 * sc)); g.lineTo(sx(px - 8 * sc + sway), sy(py + 21 * sc)); g.closePath();
      g.fillStyle = c; g.fill(); g.lineWidth = 0.4 * S; g.strokeStyle = 'rgba(60,30,10,0.55)'; g.stroke();
      // 手を上げる（盛り上がっているとき）
      if (exc > 0.25 && hsh % 2 === 0) { g.lineCap = 'round'; g.strokeStyle = '#ffd9b0'; g.lineWidth = 2.2 * sc * S; g.beginPath(); g.moveTo(sx(px - 7 * sc + sway), sy(py + 12 * sc)); g.lineTo(sx(px - 10 * sc + sway), sy(py + 2 * sc - Math.sin(nowT * 12 + hsh) * 2 * exc)); g.stroke(); }
      // 頭
      circle(px + sway, py + 2 * sc, 5.6 * sc, '#ffd9b0', 'rgba(60,30,10,0.6)', 0.4);
      g.beginPath(); g.arc(sx(px + sway), sy(py + 2 * sc), 5.7 * sc * S, Math.PI * 1.02, Math.PI * 1.98); g.fillStyle = hc; g.fill();
      circle(px - 1.9 * sc + sway, py + 2.6 * sc, 0.65 * sc, '#2a1a14'); circle(px + 1.9 * sc + sway, py + 2.6 * sc, 0.65 * sc, '#2a1a14');
      if (mur > 0.2 && hsh % 3 === 0) txt('？', px + 5 * sc + sway, py - 5 * sc, 5 * sc, '#c62828', { stroke: '#fff' });
      else { g.beginPath(); g.arc(sx(px + sway), sy(py + 4 * sc), 1.4 * sc * S, 0.15, Math.PI - 0.15); g.strokeStyle = '#a33'; g.lineWidth = 0.5 * S; g.stroke(); }
    }
  }
}

function drawBackground(nowT) {
  const v = view();
  const W0 = v.x0, W1 = v.x1;
  // 壁（公民館の白い壁）
  const grd = g.createLinearGradient(0, sy(v.y0), 0, sy(LAY.floorY));
  grd.addColorStop(0, '#fff6e0'); grd.addColorStop(1, '#ffe7bd');
  g.fillStyle = grd; g.fillRect(sx(W0), sy(v.y0), (W1 - W0) * S, (LAY.floorY - v.y0) * S);
  g.strokeStyle = 'rgba(160,110,60,0.13)'; g.lineWidth = 0.4 * S;
  for (let x = Math.floor(W0 / 12) * 12; x < W1; x += 12) { g.beginPath(); g.moveTo(sx(x), sy(v.y0)); g.lineTo(sx(x), sy(LAY.floorY)); g.stroke(); }
  // 舞台の床
  rect(W0, LAY.floorY - 11, W1 - W0, 11 + (v.y1 - LAY.floorY), '#d9a463');
  g.strokeStyle = 'rgba(110,60,20,0.25)'; g.lineWidth = 0.35 * S;
  for (let y = LAY.floorY - 7; y < LAY.floorY; y += 3.5) { g.beginPath(); g.moveTo(sx(W0), sy(y)); g.lineTo(sx(W1), sy(y)); g.stroke(); }
  rect(W0, LAY.floorY - 11, W1 - W0, 1, '#8f5a2c');
  // 横のスペース：観客席（横長の画面のとき広がる）
  if (W0 < -1) { rect(W0, 72, -4 - W0, v.y1 - 72, '#c98f52'); drawAudience(W0 - 10, -4, nowT); }
  if (W1 > 101) { rect(104, 72, W1 - 104, v.y1 - 72, '#c98f52'); drawAudience(104, W1 + 10, nowT); }
  // 横のスペース：のぼり
  for (let i = 0; i < 4; i++) {
    const lx = -17 - i * 26, rx = 105 + i * 26;
    if (lx > W0 - 6) nobori(lx, 27, 9, 40, i % 2 ? '#fff' : '#e23b3b', '町内大会', nowT * 1.4 + i);
    if (rx < W1 + 6) nobori(rx, 27, 9, 40, i % 2 ? '#e23b3b' : '#fff', '叩いて被って', nowT * 1.4 + i + 2);
  }
  // 中央の舞台の横の柱（横長のとき、舞台の端が分かるように）
  if (W0 < -1) { rect(-3, v.y0, 3, v.y1 - v.y0, 'rgba(160,30,30,0.9)'); rect(-3, v.y0, 0.6, v.y1 - v.y0, '#ffd23f'); }
  if (W1 > 101) { rect(100, v.y0, 3, v.y1 - v.y0, 'rgba(160,30,30,0.9)'); rect(102.4, v.y0, 0.6, v.y1 - v.y0, '#ffd23f'); }
  // 紅白幕（上）
  const x0 = Math.floor(W0 / 10) * 10;
  for (let x = x0; x < W1; x += 10) {
    const c = (Math.round(x / 10) % 2) ? '#e23b3b' : '#ffffff';
    rect(x, v.y0, 10.2, 6 - v.y0, c);
    g.beginPath(); g.arc(sx(x + 5), sy(6), 5.1 * S, 0, Math.PI); g.fillStyle = c; g.fill();
    g.lineWidth = 0.35 * S; g.strokeStyle = 'rgba(122,26,26,0.5)'; g.stroke();
  }
  rect(W0, 5.2, W1 - W0, 0.9, '#ffd23f');
  // 左のぼり（舞台の中）
  nobori(4, 29, 9.5, 34, '#e23b3b', '町内大会', nowT * 1.4);
}

// 机（相手の前に重なる。相手のあとに描く）
function drawTableTop(nowT, noMat) {
  const v = view(), W0 = v.x0, W1 = v.x1;
  // 机（テーブルクロス）
  const tx0 = Math.max(W0, 0), tx1 = Math.min(W1, 100);
  const tg = g.createLinearGradient(0, sy(LAY.tableY), 0, sy(LAY.btnY));
  tg.addColorStop(0, '#fffaf0'); tg.addColorStop(1, '#ffe9c4');
  g.fillStyle = tg; g.fillRect(sx(tx0), sy(LAY.tableY), (tx1 - tx0) * S, (v.y1 - LAY.tableY) * S);
  rect(tx0, LAY.tableY, tx1 - tx0, 2.4, '#e23b3b');
  rect(tx0, LAY.tableY + 2.4, tx1 - tx0, 0.7, '#a82020');
  // 対戦の敷物
  if (!noMat) fillRR(24, LAY.tableY + 5, 52, 46, 5, '#e3f1ff', '#8bb8e8', 0.5);
  // 手前の台（ボタン）
  rect(tx0, LAY.btnY - 3, tx1 - tx0, v.y1 - LAY.btnY + 3, '#a0602c');
  rect(tx0, LAY.btnY - 3, tx1 - tx0, 1, '#7a4a22');
  // 机の側面の影（横長のとき）
  if (W0 < -1) { rect(-0.01, LAY.tableY, -1.5, v.y1 - LAY.tableY, 'rgba(0,0,0,0.2)'); }
}

// ---------- 画面の描画 ----------
function render(nowT) {
  if (GALLERY) { drawGallery(nowT); return; }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  g.save();
  if (shakeT > 0) g.translate((Math.random() - 0.5) * shakeAmp * S, (Math.random() - 0.5) * shakeAmp * S);
  drawBackground(nowT);
  const title = Game.mode === 'title';
  if (title) { drawTableTop(nowT, true); drawLineup(nowT); }
  else {
    drawStageFx(nowT);
    drawOpponent(nowT);
    drawTableTop(nowT);
    drawViewHelmet(nowT);
    drawHud(nowT);
    drawHands(nowT);
    drawTable(nowT);
    drawButtons(nowT);
    drawCallText(nowT);
    drawSlam(nowT);
    drawSkyStar(nowT);
  }
  // 紙吹雪・粒・文字
  for (const c of confetti) {
    g.save(); g.translate(sx(c.x), sy(c.y)); g.rotate(c.rot); g.scale(1, Math.abs(Math.sin(c.rot * 1.3)) * 0.9 + 0.15);
    g.fillStyle = c.c; g.fillRect(-c.w * S, -c.w * 0.55 * S, c.w * 2 * S, c.w * 1.1 * S); g.restore();
  }
  for (const p of parts) {
    g.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
    if (p.star) star(p.x, p.y, p.size, p.color, p.rot); else circle(p.x, p.y, p.size * 0.5, p.color);
  }
  g.globalAlpha = 1;
  for (const p of popups) {
    const k = p.t / p.life;
    g.globalAlpha = k > 0.7 ? clamp((1 - k) / 0.3, 0, 1) : 1;
    const sc = k < 0.15 ? 0.6 + k / 0.15 * 0.55 : 1.15 - Math.min(0.15, (k - 0.15) * 0.4);
    txt(p.text, p.x, p.y - k * 5, p.size * sc, p.color, { stroke: '#3a1a08', sw: p.size * 0.22 });
  }
  g.globalAlpha = 1;
  g.restore();
  if (flashT > 0) { g.globalAlpha = clamp(flashT / 0.25, 0, 1) * 0.35; g.fillStyle = flashColor; g.fillRect(0, 0, cv.width, cv.height); g.globalAlpha = 1; }
}

// タイトル：相手 5 人が並んで出迎える
function drawLineup(nowT) {
  for (let i = 0; i < 5; i++) {
    const x = 14 + i * 18, y = 112 + (i % 2) * 3, bob = Math.sin(nowT * 3 + i * 1.3) * 0.9;
    T(x, y + bob, 6.6, 0); drawChar(i, 'normal', nowT + i, { lineup: true }); U();
  }
  rect(0, 140, 100, 1, 'rgba(0,0,0,0.0)');
  // 机の上のハンマーとヘルメット
  T(30, 172, 8, 0.8); drawHammerShape(); U();
  T(70, 158, 11, 0); drawHelmetShape(); U();
}

// 相手の直前の手の記録（小さく 3 回分。新しい順に左から）
function drawCpuHistory() {
  fillRR(71, 30, 27, 25, 2.5, '#fff', '#7a4a22', 0.6);
  fillRR(71, 30, 27, 6.4, 2.5, '#7a4a22');
  rect(71, 33.4, 27, 3, '#7a4a22');
  txt('さっきの手', 84.5, 33.4, 3.5, '#fff');
  const shown = Game.hist || [];   // 「ポン」で出た手もすぐ記録に入る
  for (let i = 0; i < 3; i++) {
    const e = shown[shown.length - 1 - i];
    const x = 77 + i * 7.6, y = 46.2;
    if (e) { circle(x, y, 3.6, HAND_COL[e.c], HAND_DARK[e.c], 0.4); T(x, y + 0.3, 5.6, 0); drawHandShape(e.c); U(); }
    else { circle(x, y, 3.4, '#eee', '#ccc', 0.4); }
  }
}

function drawHud(nowT) {
  const opp = Game.opp || CFG.opps[0];
  const fin = Game.oppIdx === CFG.opps.length - 1;
  // 見出し：〇回戦 相手の名前
  fillRR(13, 2.6, 74, 10, 3, fin ? '#ffd23f' : '#fffaf0', fin ? '#a86a00' : '#e23b3b', 0.9);
  txt(roundLabel(Game.oppIdx) + '　' + opp.name, 50, 7.8, 4.8, fin ? '#7a3a00' : '#7a1a1a');
  // 本数の丸（左：あなた、右：相手）
  for (const side of ['p', 'c']) {
    const x0 = side === 'p' ? 3 : 81;
    fillRR(x0, 14.4, 16, 11, 2.5, 'rgba(255,255,255,0.92)', '#7a4a22', 0.5);
    txt(side === 'p' ? 'あなた' : '相手', x0 + 8, 17.5, 3, '#7a4a22');
    for (let i = 0; i < CFG.winPoints; i++) {
      const got = i < Game.score[side];
      const cx = x0 + 8 + (i - (CFG.winPoints - 1) / 2) * 6.2;
      circle(cx, 22, 2.4, got ? (side === 'p' ? '#ffd23f' : '#ff6b6b') : '#e8dcc8', '#7a4a22', 0.5);
      if (got) star(cx, 22, 1.7, '#fff', nowT * 2);
    }
  }
  drawCpuHistory();
  // 実況（上に一言）
  fillRR(21, 14.4, 58, 10.4, 4, 'rgba(255,255,255,0.95)', '#7a4a22', 0.5);
  // マイク
  fillRR(24, 17.7, 1.5, 3.6, 0.7, '#555'); circle(24.75, 17.7, 1.5, '#888', '#555', 0.3);
  if (Game.comm) txt(Game.comm, 51, 19.7, 4.8, Game.comm.indexOf('反則') >= 0 ? '#c62828' : '#4a2a10');
}

function drawUnknown(cx, cy, size, nowT) {
  circle(cx, cy, size * 0.6, '#f0e6d2', '#b9a98c', 0.8);
  txt('？', cx, cy + Math.sin(nowT * 8) * 0.8, size * 0.75, '#8a7a5c');
}
function drawNameTag(h, x, y) {
  fillRR(x - 7.2, y - 2.8, 14.4, 5.6, 2.8, HAND_COL[h], '#fff', 0.5);
  txt(HAND_NAME[h], x, y + 0.1, 3.7, '#fff', { stroke: HAND_DARK[h], sw: 0.7 });
}
function drawHandBadge(h, cx, cy, size, a, tag, ox) {
  g.globalAlpha = a;
  circle(cx, cy, size * 0.62, HAND_COL[h], '#fff', 0.9);
  circle(cx, cy, size * 0.62 - 0.5, null, HAND_DARK[h], 0.5);
  T(cx, cy + size * 0.02, size * 0.88, 0); drawHandShape(h); U();
  if (tag) drawNameTag(h, ox == null ? 28.5 : ox, cy);
  g.globalAlpha = 1;
}

function drawHands(nowT) {
  const c = LAY.cpuHand, m = LAY.myHand;
  const inCall = Game.mode === 'match' && Game.phase === 'call';
  const revealed = Game.mode !== 'title' && Game.pHand != null && (Game.phase === 'grab' || Game.phase === 'draw' || Game.phase === 'result' || Game.phase === 'over');
  if (revealed) {
    const k = clamp((nowT - Game.ponT) / 0.14, 0, 1);
    const sc = 0.5 + 0.5 * (1 - Math.pow(1 - k, 3)) + (k < 1 ? 0.15 * k : 0);
    drawHandBadge(Game.cHand, c.x, c.y, c.size * sc, 1, true);
    drawHandBadge(Game.pHand, m.x, m.y, m.size * sc, 1, true);
  } else {
    // 「ジャン」「ケン」では両方がこぶしでぽんぽん上下する。待っているときは？
    const pump = inCall ? Math.abs(Math.sin((nowT - Game.phaseT0) * 7.5)) * 3 : 0;
    if (inCall) drawHandBadge(0, c.x, c.y - pump * (Game.callIdx + 1) * 0.5, c.size * 0.95, 1, false);
    else drawUnknown(c.x, c.y, c.size, nowT);
    if ((inCall || (Game.mode === 'match' && Game.phase === 'ready')) && Game.chosen != null) drawHandBadge(Game.chosen, m.x, m.y - pump * 0.6, m.size * 0.95, 0.55, false);
    else drawUnknown(m.x, m.y, m.size * 0.9, nowT + 1);
  }
  // 反応の秒数とほめ言葉（自分の手のよこ）
  if (react && Game.mode !== 'title') {
    const rx = 82.5, ry = m.y - 3;
    txt(react.sec.toFixed(2) + '秒', rx, ry, 7, react.correct ? '#fff' : '#d8d0c4', { stroke: '#3a1a08', sw: 1.6 });
    if (react.praise) txt(react.praise, rx, ry + 8, react.correct ? 6.4 : 5, '#ffd23f', { stroke: '#3a1a08', sw: 1.4 });
  }
}

// ---------- 机の上の道具とそのアニメ ----------
function popIn(which, nowT) {
  const u = nowT - VS.retT[which];
  if (u < 0 || u > 0.35) return 1;
  const k = u / 0.35;
  return 1 + Math.sin(k * Math.PI) * 0.25 * (1 - k) + (k < 0.35 ? (k / 0.35 - 1) * 0.5 * (1 - k / 0.35) : 0);
}
function lerp(a, b, t) { return a + (b - a) * t; }
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

function drawTable(nowT) {
  const m = Game.mode === 'match';
  const inGrab = m && Game.phase === 'grab' && !Game.pItem;
  const act = Game.mode !== 'title' && (Game.phase === 'grab' || Game.phase === 'result' || Game.phase === 'over');
  for (const which of ['hammer', 'helmet']) {
    const L = LAY[which];
    const ia = VS.ia[which];
    const moving = act && ia && ia.pon === Game.ponT;
    // 置き場
    fillRR(L.x, L.y, L.w, L.h, 5, inGrab ? 'rgba(255,255,255,0.7)' : 'rgba(130,90,40,0.12)', inGrab ? '#e23b3b' : 'rgba(130,90,40,0.35)', inGrab ? 1 : 0.4);
    if (inGrab) { const pu = 0.5 + 0.5 * Math.sin(nowT * 9); g.globalAlpha = 0.25 * pu; fillRR(L.x - 1, L.y - 1, L.w + 2, L.h + 2, 6, '#ffd23f'); g.globalAlpha = 1; }
    const press = itemPress[which] > 0 ? 1.12 : 1;
    const dim = act && (Game.pItem && Game.pItem !== which) ? 0.45 : 1;
    if (!moving) {
      const k = popIn(which, nowT) * press;
      if (which === 'hammer') { T(L.cx - 1, L.cy + 5, 7.2 * k, 0.8); g.globalAlpha = dim; drawHammerShape(); g.globalAlpha = 1; U(); }
      else { T(L.cx, L.cy + 3, 10.5 * k, 0); g.globalAlpha = dim; drawHelmetShape(); g.globalAlpha = 1; U(); }
    } else {
      const u = nowT - ia.t0;
      if (which === 'hammer') drawMyHammer(ia, u, L);
      else drawMyHelmet(ia, u, L);
    }
  }
}

function drawMyHammer(ia, u, L) {
  const gx0 = L.cx - 8, gy0 = L.cy + 11;     // 机の上の持ち手の位置
  const f = LAY.face;
  if (ia.mode === 'swing') {          // 叩く・ガードされる：相手の頭へ振り下ろす
    const k = clamp(u / 0.11, 0, 1), e = easeOut(k);
    const tx = f.x + 3, ty = f.y - f.r - 2 - 24;   // 持ち手の位置（頭が相手の頭に当たる）
    const rot = lerp(0.8, 3.14, e) + (u > 0.11 ? Math.min(0.15, (u - 0.11) * 3) * (ia.guarded ? -1 : 0) : 0);
    let kk = lerp(7.2, 8.2, e), gx = lerp(gx0, tx, e), gy = lerp(gy0, ty, e);
    if (ia.guarded && u > 0.11) { const b = clamp((u - 0.11) / 0.25, 0, 1); gx += b * 24; gy -= b * 6; }
    const alpha = u > 0.28 ? clamp(1 - (u - 0.28) / 0.17, 0, 1) : 1;
    T(gx, gy, kk, rot); g.globalAlpha = alpha; drawHammerShape(); g.globalAlpha = 1; U();
  } else {                            // 反則：持ち上げてふるふる
    const e = easeOut(u / 0.12);
    const gx = lerp(gx0, L.cx, e), gy = lerp(gy0, L.cy + 4, e);
    const rot = lerp(0.8, 0.2, e) + Math.sin(u * 40) * 0.12 * e;
    const alpha = u > 0.5 ? clamp(1 - (u - 0.5) / 0.3, 0.25, 1) : 1;
    T(gx, gy, lerp(7.2, 9.5, e), rot); g.globalAlpha = alpha; drawHammerShape(); g.globalAlpha = 1; U();
  }
}
function drawMyHelmet(ia, u, L) {
  // 机から自分の頭の上へ（画面の上のほうへ飛んでいって被る）
  const e = easeOut(u / 0.14);
  if (u < 0.2) {
    T(lerp(L.cx, 50, e), lerp(L.cy + 3, 26, e), lerp(10.5, 20, e), 0); drawHelmetShape(); U();
  }
}
function drawViewHelmet(nowT) {
  // 自分が被ったヘルメット：画面の上から下りてくる（見出しの後ろ）
  const u = nowT - VS.viewHelmetT;
  if (u < 0 || u > 1.1) return;
  const e = easeOut((u - 0.1) / 0.12), a = u > 0.8 ? clamp(1 - (u - 0.8) / 0.3, 0, 1) : 1;
  if (e <= 0) return;
  const v = view();
  g.globalAlpha = a * 0.95;
  const yb = lerp(v.y0 - 20, 22, e);
  g.beginPath(); g.ellipse(sx(50), sy(yb - 20), 60 * S, 26 * S, 0, 0, Math.PI);
  g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 1 * S; g.strokeStyle = '#8a6a00'; g.stroke();
  g.fillStyle = '#ffe680'; g.beginPath(); g.ellipse(sx(34), sy(yb - 8), 14 * S, 3.4 * S, -0.35, 0, 6.2832); g.fill();
  rect(40, yb - 6, 20, 1.4, '#e8b500');
  fillRR(-6, yb + 6, 112, 5, 2.5, '#f0b400', '#8a6a00', 0.8);
  g.globalAlpha = 1;
}

function drawButtons(nowT) {
  const m = Game.mode === 'match';
  const waiting = m && (Game.phase === 'wait' || (Game.phase === 'ready' && Game.chosen == null));   // 手を選ぶのを待っている
  const live = m && (Game.phase === 'call' || waiting || Game.phase === 'ready');
  const pulse = 0.5 + 0.5 * Math.sin(nowT * 7);
  for (let h = 0; h < 3; h++) {
    const b = LAY.btns[h];
    const sel = m && (Game.phase === 'call' || Game.phase === 'ready') && Game.chosen === h;
    const down = pressT[h] > 0;
    const y = LAY.btnY + (down ? 1.2 : 0) - (waiting ? pulse * 1.0 : 0);
    if (waiting) {   // 手のボタンがやわらかく光って弾む（文字の説明は出さない）
      g.globalAlpha = 0.25 + 0.45 * pulse;
      fillRR(b.x - 1.2, y - 1.2, b.w + 2.4, LAY.btnH + 2.4, 6.2, '#ffd23f');
      g.globalAlpha = 1;
    }
    fillRR(b.x, y + 1.4, b.w, LAY.btnH, 5, '#4a2a10');
    g.globalAlpha = live || sel ? 1 : 0.8;
    fillRR(b.x, y, b.w, LAY.btnH, 5, HAND_COL[h], sel ? '#fff' : HAND_DARK[h], sel ? 1.6 : 0.8);
    fillRR(b.x + 2, y + 1.6, b.w - 4, 3.2, 1.6, 'rgba(255,255,255,0.35)');
    circle(b.x + b.w / 2, y + 10.6, 8.4, '#fff', null);
    T(b.x + b.w / 2, y + 10.8, 13, 0); drawHandShape(h); U();
    txt(HAND_NAME[h], b.x + b.w / 2, y + 22.6, 5, '#fff', { stroke: HAND_DARK[h], sw: 1.2 });
    g.globalAlpha = 1;
  }
}

function drawCallText(nowT) {
  if (Game.mode !== 'match') return;
  if (Game.phase === 'call') {
    const k = clamp((nowT - Game.phaseT0) / 0.12, 0, 1);
    txt(Game.callText, 50, 62, 12 + 3 * (1 - k), '#fff', { stroke: '#c62828', sw: 2.4 });
  } else if (Game.phase === 'draw' || (Game.phase === 'grab' && nowT - Game.ponT < 0.35)) {
    txt(Game.callText, 50, 62, 10, '#fff', { stroke: '#c62828', sw: 2 });
  }
}
