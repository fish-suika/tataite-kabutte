// ===== 描画（仮の絵：丸・四角・文字・絵文字）。Phase 3 で本番の絵にする =====
const $ = id => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d');
const FONT = '"Hiragino Maru Gothic ProN","Yu Gothic UI","Meiryo","Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
let S = 1, OX = 0, OY = 0, DPR = 1, vw = 0, vh = 0;
let shakeT = 0, shakeAmp = 0, flashT = 0, flashColor = '#fff';
const popups = [], parts = [];
const pressT = [0, 0, 0];          // 手のボタンを押したときの光り
const itemPress = { hammer: 0, helmet: 0 };
let react = null;                  // 直近の反応の秒数の表示 { sec, praise, correct }
let faceMood = 'normal', faceT = 0;

// 画面の部品の位置（論理座標）。タップの判定にも使う
const LAY = {
  cpuHand: { x: 50, y: 67, size: 21 },
  myHand:  { x: 50, y: 92, size: 21 },
  face:    { x: 50, y: 42, r: 9 },
  tableY: 106,
  btnY: 146, btnH: 27,
  btns: [{ x: 4, w: 30 }, { x: 35, w: 30 }, { x: 66, w: 30 }],
  hammer: { x: 4, y: 110, w: 44, h: 34, cx: 26, cy: 126 },
  helmet: { x: 52, y: 110, w: 44, h: 34, cx: 74, cy: 126 }
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

function addPopup(text, x, y, size, color, life) { popups.push({ text, x, y, size, color, life: life || 0.9, t: 0 }); }
function burst(x, y, color, n, speed, life, star) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.2832, v = (0.4 + Math.random() * 0.6) * (speed || 30);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 8, life: (life || 0.6) * (0.6 + Math.random() * 0.5), t: 0, color, size: 1.5 + Math.random() * 1.8, star: !!star, rot: Math.random() * 6 });
  }
}
function shake(amp, dur) { shakeAmp = amp; shakeT = dur; }
function flash(color, dur) { flashColor = color; flashT = dur; }

function updateVisual(dt) {
  shakeT = Math.max(0, shakeT - dt);
  flashT = Math.max(0, flashT - dt);
  faceT = Math.max(0, faceT - dt);
  for (let i = 0; i < 3; i++) pressT[i] = Math.max(0, pressT[i] - dt);
  itemPress.hammer = Math.max(0, itemPress.hammer - dt);
  itemPress.helmet = Math.max(0, itemPress.helmet - dt);
  for (const p of popups) p.t += dt;
  for (let i = popups.length - 1; i >= 0; i--) if (popups[i].t > popups[i].life) popups.splice(i, 1);
  for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 50 * dt; p.rot += dt * 6; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t > parts[i].life) parts.splice(i, 1);
}

// ---------- 基本の図形 ----------
function rr(x, y, w, h, r) {
  const X = sx(x), Y = sy(y), W = w * S, H = h * S, R = r * S;
  g.beginPath(); g.moveTo(X + R, Y); g.arcTo(X + W, Y, X + W, Y + H, R); g.arcTo(X + W, Y + H, X, Y + H, R);
  g.arcTo(X, Y + H, X, Y, R); g.arcTo(X, Y, X + W, Y, R); g.closePath();
}
function fillRR(x, y, w, h, r, fill, stroke, lw) {
  rr(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = (lw || 0.6) * S; g.stroke(); }
}
function circle(x, y, r, fill, stroke, lw) {
  g.beginPath(); g.arc(sx(x), sy(y), r * S, 0, 6.2832);
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
function star(x, y, r, fill, rot) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + i * Math.PI / 5 - Math.PI / 2, rad = (i % 2 ? r * 0.45 : r) * S;
    const px = sx(x) + Math.cos(a) * rad, py = sy(y) + Math.sin(a) * rad;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath(); g.fillStyle = fill; g.fill();
}

// ---------- 背景（仮：体育館の舞台と机）----------
function drawBackground() {
  const v = view();
  rect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0, '#2a1a14');
  rect(v.x0, v.y0, v.x1 - v.x0, LAY.tableY - v.y0, '#fff1d6');          // 壁
  rect(v.x0, LAY.tableY, v.x1 - v.x0, v.y1 - LAY.tableY, '#b9783c');    // 机
  rect(v.x0, LAY.tableY, v.x1 - v.x0, 1.2, '#7a4a22');
  rect(v.x0, LAY.btnY - 2.5, v.x1 - v.x0, v.y1 - LAY.btnY + 2.5, '#8f5a2c');
  // 紅白幕
  const x0 = Math.floor(v.x0 / 10) * 10;
  for (let x = x0; x < v.x1; x += 10) rect(x, v.y0, 10, 9 - v.y0, (Math.round(x / 10) % 2) ? '#e23b3b' : '#ffffff');
  rect(v.x0, 9, v.x1 - v.x0, 0.8, '#b22a2a');
}

// ---------- 手（グー・チョキ・パーは色と絵文字と名前で見分ける）----------
const HAND_COL = ['#ff8a80', '#8be39a', '#8ec9ff'];
function drawHand(h, cx, cy, size, a, label) {
  g.globalAlpha = a;
  circle(cx, cy, size * 0.62, HAND_COL[h], '#fff', 1);
  g.font = (size * 0.95 * S) + 'px ' + FONT;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
  g.fillText(HAND_ICON[h], sx(cx), sy(cy + size * 0.04));
  if (label) txt(HAND_NAME[h], cx, cy + size * 0.78, 4.4, '#fff', { stroke: '#4a2a10' });
  g.globalAlpha = 1;
}
function drawUnknown(cx, cy, size, nowT) {
  circle(cx, cy, size * 0.6, '#e8dcc8', '#b9a98c', 1);
  txt('？', cx, cy + Math.sin(nowT * 8) * 0.8, size * 0.8, '#8a7a5c');
}

// ---------- 道具（仮：ピコピコハンマーと工事用ヘルメット）----------
function drawHammer(cx, cy, k, rot, alpha) {
  g.save(); g.globalAlpha = alpha == null ? 1 : alpha;
  g.translate(sx(cx), sy(cy)); g.rotate(rot || 0); g.scale(k, k);
  // 柄
  g.fillStyle = '#f2c14e'; g.strokeStyle = '#7a4a22'; g.lineWidth = 0.5 * S;
  g.fillRect(-1.4 * S, -2 * S, 2.8 * S, 15 * S); g.strokeRect(-1.4 * S, -2 * S, 2.8 * S, 15 * S);
  // 頭（赤と黄色）
  g.fillStyle = '#e23b3b'; g.fillRect(-11 * S, -12 * S, 22 * S, 10 * S); g.strokeRect(-11 * S, -12 * S, 22 * S, 10 * S);
  g.fillStyle = '#ffd23f'; g.fillRect(-11 * S, -12 * S, 3 * S, 10 * S); g.fillRect(8 * S, -12 * S, 3 * S, 10 * S);
  g.restore();
}
function drawHelmet(cx, cy, k, alpha) {
  g.save(); g.globalAlpha = alpha == null ? 1 : alpha;
  g.translate(sx(cx), sy(cy)); g.scale(k, k);
  g.fillStyle = '#ffd23f'; g.strokeStyle = '#8a6a00'; g.lineWidth = 0.6 * S;
  g.beginPath(); g.arc(0, 2 * S, 12 * S, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
  g.fillRect(-15 * S, 2 * S, 30 * S, 3.4 * S); g.strokeRect(-15 * S, 2 * S, 30 * S, 3.4 * S);
  g.fillStyle = '#fff3a8'; g.fillRect(-1.6 * S, -9 * S, 3.2 * S, 11 * S);
  g.restore();
}

// ---------- 相手の顔（仮：丸）----------
function drawFace(nowT) {
  const f = LAY.face;
  const mood = faceT > 0 ? faceMood : 'normal';
  let bob = Math.sin(nowT * 3) * 0.4, ox = 0, oy = bob;
  if (mood === 'dizzy') ox = Math.sin(nowT * 30) * 0.6;
  // 体
  fillRR(f.x - 15, f.y + f.r - 2, 30, 14, 6, '#4a88d8', '#2a4c80', 0.6);
  circle(f.x + ox, f.y + oy, f.r, '#ffd9b3', '#7a4a22', 0.7);
  // 髪
  g.beginPath(); g.arc(sx(f.x + ox), sy(f.y + oy), f.r * S, Math.PI * 1.05, Math.PI * 1.95); g.fillStyle = '#3a2a1a'; g.fill();
  const ex = 3.2, ey = f.y + oy - 0.5;
  if (mood === 'dizzy') {
    txt('@', f.x + ox - ex, ey, 4.2, '#333'); txt('@', f.x + ox + ex, ey, 4.2, '#333');
    txt('ー', f.x + ox, f.y + oy + 4.5, 3.4, '#a33');
  } else if (mood === 'huh') {
    circle(f.x - ex, ey, 1.1, '#333'); circle(f.x + ex, ey, 1.1, '#333');
    txt('？', f.x + 11, f.y - 7, 7, '#e23b3b', { stroke: '#fff' });
    circle(f.x, f.y + 4.5, 1, '#a33');
  } else if (mood === 'grin') {
    txt('＾', f.x - ex, ey, 4, '#333'); txt('＾', f.x + ex, ey, 4, '#333');
    fillRR(f.x - 2.6, f.y + 3.4, 5.2, 2.6, 1.2, '#a33');
  } else if (mood === 'sweat') {
    circle(f.x - ex, ey, 1.1, '#333'); circle(f.x + ex, ey, 1.1, '#333');
    txt('💦', f.x + 10, f.y - 5, 5);
    txt('～', f.x, f.y + 4.5, 3, '#a33');
  } else {
    circle(f.x - ex, ey, 1.1, '#333'); circle(f.x + ex, ey, 1.1, '#333');
    fillRR(f.x - 2, f.y + 4, 4, 1, 0.5, '#a33');
  }
  // 相手が取った道具
  if (Game.mode === 'match' && Game.cItem && (Game.cpuDone || Game.outcome) && Game.phase !== 'ready' && Game.cpuDone) {
    if (Game.cItem === 'helmet') drawHelmet(f.x + ox, f.y + oy - f.r + 3.2, 0.95);
    else drawHammer(f.x + 22, f.y + 6, 0.8, 0.5);
  }
}

// ---------- 画面の描画 ----------
function render(nowT) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  g.save();
  if (shakeT > 0) g.translate((Math.random() - 0.5) * shakeAmp * S, (Math.random() - 0.5) * shakeAmp * S);
  drawBackground();
  drawFace(nowT);
  if (Game.mode !== 'title') { drawHud(nowT); drawHands(nowT); drawTable(nowT); drawButtons(nowT); drawCallText(nowT); }
  else { drawHands(nowT); drawTable(nowT); drawButtons(nowT); }
  // 粒・文字
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

function drawHud(nowT) {
  const opp = Game.opp || CFG.opps[0];
  txt((Game.oppIdx + 1) + '回戦　' + opp.name, 50, 4.6, 4.6, '#fff', { stroke: '#7a1a1a' });
  // 本数の丸（左：あなた、右：相手）
  for (let i = 0; i < CFG.winPoints; i++) {
    circle(10 + i * 8, 16, 3, i < Game.score.p ? '#ffd23f' : 'rgba(255,255,255,0.5)', '#7a4a22', 0.6);
    circle(90 - i * 8, 16, 3, i < Game.score.c ? '#ff6b6b' : 'rgba(255,255,255,0.5)', '#7a4a22', 0.6);
  }
  txt('あなた', 14, 22.5, 3.2, '#5a3a1a'); txt('相手', 86, 22.5, 3.2, '#5a3a1a');
  // 実況（上に一言）
  fillRR(22, 14, 56, 9.5, 4, 'rgba(255,255,255,0.92)', '#7a4a22', 0.5);
  if (Game.comm) txt(Game.comm, 50, 18.9, 4.8, '#4a2a10');
}

function drawHands(nowT) {
  const c = LAY.cpuHand, m = LAY.myHand;
  const inCall = Game.mode === 'match' && Game.phase === 'call';
  const revealed = Game.mode === 'match' && Game.pHand != null && (Game.phase === 'grab' || Game.phase === 'draw' || Game.phase === 'result' || Game.phase === 'over');
  if (revealed) {
    const k = clamp((nowT - Game.ponT) / 0.14, 0, 1);
    const sc = 0.5 + 0.5 * (1 - Math.pow(1 - k, 3)) + (k < 1 ? 0.15 * k : 0);
    drawHand(Game.cHand, c.x, c.y, c.size * sc, 1, true);
    drawHand(Game.pHand, m.x, m.y, m.size * sc, 1, true);
    if (Game.defaulted && Game.phase === 'grab') { /* 前回と同じ手。罰はなし */ }
  } else {
    drawUnknown(c.x, c.y, c.size, nowT);
    if (inCall && Game.chosen != null) drawHand(Game.chosen, m.x, m.y, m.size, 0.35, false);
    else drawUnknown(m.x, m.y, m.size * 0.9, nowT + 1);
  }
  // 反応の秒数とほめ言葉（自分の手のよこ）
  if (react && Game.mode !== 'title') {
    const rx = 82, ry = m.y - 2;
    txt(react.sec.toFixed(2) + '秒', rx, ry, 7.2, react.correct ? '#fff' : '#d8d0c4', { stroke: '#3a1a08' });
    if (react.praise) txt(react.praise, rx, ry + 8, react.correct ? 6.4 : 5, '#ffd23f', { stroke: '#3a1a08' });
  }
}

function drawTable(nowT) {
  const live = Game.mode === 'match' && Game.phase === 'grab' && !Game.pItem;
  const mine = Game.mode === 'match' ? Game.pItem : null;
  for (const which of ['hammer', 'helmet']) {
    const L = LAY[which];
    const taken = mine === which;
    const dim = mine && !taken ? 0.4 : 1;
    // 置き場
    fillRR(L.x, L.y, L.w, L.h, 5, live ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)', live ? '#fff' : 'rgba(0,0,0,0.25)', live ? 0.7 : 0.4);
    const press = itemPress[which] > 0 ? 1.12 : 1;
    const lift = taken ? -6 : 0;
    const k = (taken ? 1.25 : 1) * press;
    if (which === 'hammer') drawHammer(L.cx, L.cy + 4 + lift, 1.05 * k, -0.35, dim);
    else drawHelmet(L.cx, L.cy + 3 + lift, 1.2 * k, dim);
    if (taken) circle(L.cx, L.cy, 17, null, '#ffd23f', 1.2);
  }
  // 叩く・叩かれる動き
  if (Game.mode === 'match' && (Game.phase === 'result' || Game.phase === 'over') && Game.outcome) {
    const k = clamp((nowT - Game.resolveT) / 0.18, 0, 1);
    const o = Game.outcome;
    if (o === 'hit' || o === 'cpuFoul') {
      drawHammer(LAY.face.x + 4, LAY.face.y - 14 + k * 8, 1.5, -0.5 + k * 0.7);
    } else if (o === 'cpuHit' || o === 'foul') {
      drawHammer(50, 40 + k * 55, 2.1, 0.1 - k * 0.2);
    }
  }
}

function drawButtons(nowT) {
  const live = Game.mode === 'match' && Game.phase === 'call';
  for (let h = 0; h < 3; h++) {
    const b = LAY.btns[h];
    const sel = Game.mode === 'match' && Game.phase === 'call' && Game.chosen === h;
    const down = pressT[h] > 0;
    const y = LAY.btnY + (down ? 1.2 : 0);
    fillRR(b.x, y + 1.2, b.w, LAY.btnH, 5, '#4a2a10');
    fillRR(b.x, y, b.w, LAY.btnH, 5, sel ? '#fff7c2' : (live || Game.mode === 'title' ? '#fff' : '#d8cdb8'), sel ? '#ffb300' : '#7a4a22', sel ? 1.5 : 0.6);
    g.globalAlpha = live || sel || Game.mode === 'title' ? 1 : 0.75;
    circle(b.x + b.w / 2, y + 10, 7, HAND_COL[h]);
    g.font = (11 * S) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
    g.fillText(HAND_ICON[h], sx(b.x + b.w / 2), sy(y + 10.4));
    txt(HAND_NAME[h], b.x + b.w / 2, y + 21.5, 4.6, '#4a2a10');
    g.globalAlpha = 1;
  }
}

function drawCallText(nowT) {
  if (Game.mode !== 'match') return;
  if (Game.phase === 'call') {
    const k = clamp((nowT - Game.phaseT0) / 0.12, 0, 1);
    txt(Game.callText, 50, 80, 12 + 3 * (1 - k), '#fff', { stroke: '#c62828', sw: 2.4 });
  } else if (Game.phase === 'draw' || (Game.phase === 'grab' && nowT - Game.ponT < 0.35)) {
    txt(Game.callText, 50, 80, 10, '#fff', { stroke: '#c62828', sw: 2 });
  }
}
