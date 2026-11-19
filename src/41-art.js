// ===== 絵：手・ハンマー・ヘルメット・相手の人物（すべて Canvas で描く）=====
// T(x,y,k,rot) で「その場所を原点、k 倍の大きさ」の座標系にして描く。U() で戻す。
function T(x, y, k, rot, ky) { g.save(); g.translate(sx(x), sy(y)); if (rot) g.rotate(rot); g.scale(k * S, (ky == null ? k : ky) * S); }
function U() { g.restore(); }
function fs(fill, stroke, lw) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
}
function lEll(x, y, rx, ry, fill, stroke, lw, rot) { g.beginPath(); g.ellipse(x, y, Math.max(0.0001, rx), Math.max(0.0001, ry), rot || 0, 0, 6.2832); fs(fill, stroke, lw); }
function lPoly(pts, fill, stroke, lw) { g.beginPath(); for (let i = 0; i < pts.length; i++) i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]); g.closePath(); fs(fill, stroke, lw); }
function lLine(x1, y1, x2, y2, w, color) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.stroke(); }
function lRR(x, y, w, h, r, fill, stroke, lw) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); fs(fill, stroke, lw);
}
function lArc(x, y, r, a0, a1, color, lw) { g.beginPath(); g.arc(x, y, r, a0, a1); g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.stroke(); }
function lTxt(str, x, y, size, fill, stroke) {   // T 座標系の中の文字（小さい単位でも崩れないように 100 倍で描く）
  g.save(); g.translate(x, y); g.scale(0.01, 0.01);
  g.font = 'bold ' + (size * 100) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (stroke) { g.lineJoin = 'round'; g.lineWidth = size * 18; g.strokeStyle = stroke; g.strokeText(str, 0, 0); }
  g.fillStyle = fill; g.fillText(str, 0, 0); g.restore();
}
function lStar(x, y, r, fill, rot, stroke, lw) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rad = i % 2 ? r * 0.45 : r; const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.closePath(); fs(fill, stroke, lw);
}

// ---------- 手（グー・チョキ・パー：形と色で見分ける）----------
const HAND_COL = ['#ff6b5e', '#33c070', '#3d9bff'];
const HAND_DARK = ['#a8281d', '#17794a', '#1c5fb8'];
const SKIN = '#ffd9b0', SKIN_OL = '#8a4b22', SKIN_DT = '#e0a468';
// 手の部品：cap = 丸い指 [x1,y1,x2,y2,太さ]、dot = 丸 [x,y,半径]。T 座標系で高さ約 1.1
const HAND_PARTS = [
  { // グー：にぎりこぶし
    back: [['d', 0, 0.12, 0.43], ['c', -0.27, -0.2, -0.27, 0.04, 0.2], ['c', -0.09, -0.24, -0.09, 0.04, 0.2], ['c', 0.09, -0.24, 0.09, 0.04, 0.2], ['c', 0.27, -0.2, 0.27, 0.04, 0.2]],
    front: [['c', -0.3, 0.26, 0.2, 0.2, 0.18]],
    detail: [[-0.18, -0.26, -0.18, -0.08], [0, -0.3, 0, -0.1], [0.18, -0.26, 0.18, -0.08]]
  },
  { // チョキ：人差し指と中指だけ立てる
    back: [['d', 0.02, 0.22, 0.32], ['c', -0.1, 0.02, -0.27, -0.52, 0.17], ['c', 0.13, 0.02, 0.29, -0.52, 0.17], ['d', 0.26, 0.2, 0.12], ['d', 0.31, 0.34, 0.1]],
    front: [['c', -0.3, 0.3, 0.08, 0.17, 0.16]],
    detail: [[0.0, 0.06, 0.02, 0.0]]
  },
  { // パー：全部の指をひらく
    back: [['c', -0.3, 0.05, -0.46, -0.3, 0.15], ['c', -0.12, 0.0, -0.17, -0.55, 0.15], ['c', 0.12, 0.0, 0.17, -0.55, 0.15], ['c', 0.3, 0.05, 0.46, -0.3, 0.15], ['c', -0.28, 0.3, -0.6, 0.12, 0.16], ['d', 0, 0.22, 0.38]],
    front: [],
    detail: []
  }
];
function drawHandShape(h) {
  const P = HAND_PARTS[h], ol = 0.07;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const part = (p, ex) => {
    if (p[0] === 'd') { lEll(p[1], p[2], p[3] + ex, p[3] + ex, null); g.fillStyle = ex ? SKIN_OL : SKIN; g.fill(); }
    else { g.beginPath(); g.moveTo(p[1], p[2]); g.lineTo(p[3], p[4]); g.lineWidth = p[5] + ex * 2; g.strokeStyle = ex ? SKIN_OL : SKIN; g.stroke(); }
  };
  for (const p of P.back) part(p, ol);
  for (const p of P.back) part(p, 0);
  for (const p of P.front) { part(p, ol); part(p, 0); }
  for (const d of P.detail) lLine(d[0], d[1], d[2], d[3], 0.035, SKIN_DT);
}

// ---------- ピコピコハンマー（持ち手の先が原点。頭は上に 3 の位置）----------
function drawHammerShape() {
  const OL = '#6a2a10';
  lRR(-0.2, -3.2, 0.4, 3.3, 0.2, '#ffd23f', OL, 0.12);          // 柄
  lRR(-0.26, -1.0, 0.52, 0.5, 0.1, '#e8a800');
  lRR(-1.15, -3.65, 2.3, 1.3, 0.38, '#e23b3b', OL, 0.14);        // 頭（赤）
  lRR(-1.15, -3.65, 0.5, 1.3, 0.22, '#ffd23f', OL, 0.14);        // 頭の両はし（黄色）
  lRR(0.65, -3.65, 0.5, 1.3, 0.22, '#ffd23f', OL, 0.14);
  lRR(-0.55, -3.48, 1.1, 0.2, 0.1, 'rgba(255,255,255,0.55)');   // つや
}
// ---------- 工事用ヘルメット（ドームの中心が原点）----------
function drawHelmetShape() {
  const OL = '#8a5a00';
  lRR(-1.3, 0.05, 2.6, 0.42, 0.2, '#f0b400', OL, 0.08);          // つば
  g.beginPath(); g.arc(0, 0.1, 1.05, Math.PI, 0); g.closePath(); fs('#ffd23f', OL, 0.08);
  lRR(-0.17, -1.07, 0.34, 1.12, 0.1, '#f0b400');                  // 中央のうね
  lRR(-0.5, -0.8, 0.14, 0.7, 0.07, '#f0b400'); lRR(0.36, -0.8, 0.14, 0.7, 0.07, '#f0b400');
  lEll(-0.62, -0.55, 0.2, 0.1, 'rgba(255,255,255,0.7)', null, 0, -0.6);   // つや
  lEll(0, -0.35, 0.22, 0.2, '#e23b3b', OL, 0.05);                  // バッジ
}

// ---------- 相手の人物：頭の半径が 1、頭の中心が原点 ----------
// 0 近所の小学生 / 1 学級委員長 / 2 体育の先生 / 3 商店街のおばあちゃん / 4 町内チャンピオン
const OL = '#5a3320', LW = 0.07;
const CHAR_SKIN = ['#ffd9b0', '#ffe3cc', '#f0b585', '#ffe6d2', '#f5c08c'];

function hairCap(color, a0, a1, bang, ol) {
  // 頭の上の半円の髪。bang = 生え際の高さ（小さいほど深い）
  const r = 1.045;
  g.beginPath();
  g.arc(0, 0, r, Math.PI * a0, Math.PI * a1);
  const ex = Math.cos(Math.PI * a1) * r, ey = Math.sin(Math.PI * a1) * r, sx0 = Math.cos(Math.PI * a0) * r, sy0 = Math.sin(Math.PI * a0) * r;
  g.quadraticCurveTo(0, 2 * bang - ey, sx0, sy0);
  g.closePath(); fs(color, ol || OL, LW);
}
function spikes(color, n, a0, a1, len, base) {
  // 頭のふちから外へ向かうとげとげ
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), a = Math.PI * (a0 + (a1 - a0) * t);
    const w = (a1 - a0) * Math.PI / n * 0.62;
    const r0 = 0.96, r1 = 1.04 + len * (1 - Math.abs(t - 0.5) * 0.7);
    lPoly([[Math.cos(a - w) * r0, Math.sin(a - w) * r0], [Math.cos(a + 0.04) * r1, Math.sin(a + 0.04) * r1], [Math.cos(a + w) * r0, Math.sin(a + w) * r0]], color, OL, LW);
  }
}

function charBody(idx) {
  switch (idx) {
    case 0: // 黄色い T シャツ
      lRR(-1.4, 0.92, 2.8, 2.6, 0.85, '#ffd23f', OL, LW);
      lEll(0, 1.0, 0.36, 0.17, '#ffe9c2', OL, 0.05);
      lStar(0, 1.95, 0.34, '#e23b3b', 0, OL, 0.04);
      break;
    case 1: // 白いブラウス・セーラーえり・赤いリボン・腕章
      lRR(-1.4, 0.92, 2.8, 2.6, 0.85, '#ffffff', OL, LW);
      lPoly([[-0.45, 0.95], [0.45, 0.95], [0, 1.7]], '#33417d', OL, 0.05);
      lEll(-0.2, 1.3, 0.26, 0.17, '#e23b3b', OL, 0.04, -0.4); lEll(0.2, 1.3, 0.26, 0.17, '#e23b3b', OL, 0.04, 0.4); lEll(0, 1.3, 0.1, 0.1, '#b82020', OL, 0.03);
      lRR(-1.38, 1.35, 0.56, 0.8, 0.12, '#2ea05a', OL, 0.05); lTxt('委', -1.1, 1.75, 0.46, '#fff');
      break;
    case 2: // 赤いジャージ・白いライン・ホイッスル
      lRR(-1.95, 0.9, 3.9, 2.7, 0.9, '#e23b3b', OL, LW);
      lPoly([[-1.95, 1.35], [-1.55, 1.2], [-1.55, 3.5], [-1.95, 3.5]], '#ffffff'); lPoly([[1.95, 1.35], [1.55, 1.2], [1.55, 3.5], [1.95, 3.5]], '#ffffff');
      lLine(0, 1.0, 0, 3.5, 0.06, '#8f1f1f');
      lPoly([[-0.5, 0.95], [-0.15, 1.9], [0.15, 1.9], [0.5, 0.95]], null, '#ffd23f', 0.08);
      lRR(-0.2, 1.75, 0.45, 0.28, 0.12, '#cfd8dc', OL, 0.05); lEll(-0.2, 1.9, 0.12, 0.12, '#90a4ae', OL, 0.04);
      break;
    case 3: // 紫のカーディガン・ピンクのエプロン・真珠
      lRR(-1.55, 0.92, 3.1, 2.6, 0.9, '#b79be0', OL, LW);
      lRR(-0.82, 1.35, 1.64, 2.3, 0.35, '#ffb3c8', OL, 0.06);
      lLine(-0.62, 1.2, -0.78, 1.6, 0.1, '#ff8fb0'); lLine(0.62, 1.2, 0.78, 1.6, 0.1, '#ff8fb0');
      lRR(-0.4, 2.2, 0.8, 0.55, 0.12, '#ff97b6', OL, 0.04); lEll(0, 2.45, 0.16, 0.14, '#e23b3b', OL, 0.03);
      for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + i * 0.12); lEll(Math.cos(a) * 0.62, 0.78 + Math.sin(a) * 0.5, 0.075, 0.075, '#fff', '#c9b9a0', 0.02); }
      break;
    case 4: // 赤いタンクトップ・金のメダル・はだの肩
      lRR(-1.95, 0.9, 3.9, 2.7, 0.9, CHAR_SKIN[4], OL, LW);
      lRR(-1.15, 0.9, 2.3, 2.7, 0.5, '#d82a2a', OL, 0.06);
      lPoly([[-0.45, 0.92], [0.45, 0.92], [0, 1.55]], CHAR_SKIN[4], OL, 0.04);
      lLine(-0.5, 0.95, -0.2, 1.7, 0.07, '#ffd23f'); lLine(0.5, 0.95, 0.2, 1.7, 0.07, '#ffd23f');
      lEll(0, 1.95, 0.42, 0.42, '#ffd23f', '#a86a00', 0.07); lStar(0, 1.95, 0.27, '#e23b3b', 0);
      break;
  }
}

function charHeadBack(idx) {
  if (idx === 1) { // おかっぱの後ろ髪
    g.beginPath(); g.moveTo(-1.2, 0); g.arc(0, 0, 1.2, Math.PI, 0); g.lineTo(1.2, 0.95); g.quadraticCurveTo(0, 1.25, -1.2, 0.95); g.closePath(); fs('#2a2a3a', OL, LW);
  } else if (idx === 3) { // おだんご
    lEll(0, -1.2, 0.42, 0.36, '#e8e8f0', OL, LW);
    lEll(0, -1.2, 0.3, 0.24, null, '#c0c0d0', 0.03);
    lEll(-0.99, 0.1, 0.22, 0.5, '#e8e8f0', OL, 0.06); lEll(0.99, 0.1, 0.22, 0.5, '#e8e8f0', OL, 0.06);
  } else if (idx === 4) { // 金髪のとげ（後ろ）
    spikes('#ffc21a', 9, 1.02, 1.98, 0.55, 0);
  } else if (idx === 0) {
    lEll(-1.0, 0.1, 0.16, 0.26, CHAR_SKIN[0], OL, 0.06); lEll(1.0, 0.1, 0.16, 0.26, CHAR_SKIN[0], OL, 0.06);   // 耳
  } else if (idx === 2) {
    lEll(-1.02, 0.15, 0.16, 0.26, CHAR_SKIN[2], OL, 0.06); lEll(1.02, 0.15, 0.16, 0.26, CHAR_SKIN[2], OL, 0.06);
  }
}

function charHeadShape(idx) {
  if (idx === 2) lRR(-0.88, 0.05, 1.76, 1.0, 0.5, CHAR_SKIN[2], OL, LW);   // 四角いあご
  lEll(0, 0, idx === 3 ? 1.08 : (idx === 2 ? 1.04 : 1), idx === 3 ? 0.98 : 1, CHAR_SKIN[idx], OL, LW);
  if (idx === 2) lRR(-0.82, 0.12, 1.64, 0.85, 0.42, CHAR_SKIN[2]);        // 縫い目消し
}

function charHairFront(idx) {
  switch (idx) {
    case 0: // ツンツン短髪
      hairCap('#3a2a1a', 1.04, 1.96, -0.62);
      spikes('#3a2a1a', 5, 1.15, 1.85, 0.28, 0);
      break;
    case 1: // 前髪ぱっつん
      hairCap('#2a2a3a', 1.0, 2.0, -0.55);
      lLine(-0.3, -0.5, -0.32, -0.28, 0.05, '#4a4a5a'); lLine(0.3, -0.5, 0.32, -0.28, 0.05, '#4a4a5a');
      break;
    case 2: // 角刈り
      hairCap('#252525', 1.1, 1.9, -0.82);
      break;
    case 3: // 白髪まじりの前髪
      hairCap('#e8e8f0', 1.02, 1.98, -0.66);
      break;
    case 4: // 金髪リーゼント＋赤いはちまき
      hairCap('#ffc21a', 1.02, 1.98, -0.85);
      lPoly([[-0.2, -0.9], [0.2, -0.9], [0.95, -1.9], [0.2, -1.65], [-0.5, -1.9]], '#ffc21a', OL, LW);
      lRR(-1.0, -0.84, 2.0, 0.22, 0.1, '#d82a2a', OL, 0.05);
      lLine(0.92, -0.75, 1.4, -0.45, 0.13, '#d82a2a'); lLine(0.95, -0.75, 1.35, -0.95, 0.1, '#d82a2a');
      break;
  }
}

// 目：mood は normal / nervous / dizzy / confused / smug。t は時間（まばたき・目を回す）
function charEyes(idx, mood, t, o) {
  const ex = 0.4, ey = -0.02;
  const blink = (Math.sin(t * 1.3 + idx * 2) > 0.985) || (idx === 3 && mood === 'normal');
  for (const s of [-1, 1]) {
    const x = ex * s;
    if (mood === 'dizzy') {
      lEll(x, ey, 0.25, 0.26, '#fff', OL, 0.05);
      g.beginPath();
      const spin = (o && o.spin != null ? o.spin : t * 9) * s;
      for (let i = 0; i <= 28; i++) { const a = i * 0.55 + spin, r = 0.02 + i * 0.0072; const px = x + Math.cos(a) * r, py = ey + Math.sin(a) * r; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.strokeStyle = '#2a2a2a'; g.lineWidth = 0.045; g.lineCap = 'round'; g.stroke();
    } else if (mood === 'confused') {
      lEll(x, ey, 0.24, 0.26, '#fff', OL, 0.05);            // 目がまっしろ
      lEll(x + 0.02 * s, ey + 0.02, 0.045, 0.045, '#2a2a2a');
    } else if (blink && mood !== 'smug') {
      lArc(x, ey + (idx === 3 ? 0.06 : 0.02), 0.2, Math.PI * 1.12, Math.PI * 1.88, '#3a2a1a', 0.075);
    } else if (mood === 'smug') {
      lEll(x, ey, 0.23, 0.25, '#fff', OL, 0.05);
      lEll(x - 0.03 * s, ey + 0.05, 0.11, 0.12, '#2a2a2a');
      lEll(x - 0.06 * s, ey + 0.0, 0.035, 0.035, '#fff');
      g.beginPath(); g.rect(x - 0.3, ey - 0.3, 0.6, 0.32); g.fillStyle = CHAR_SKIN[idx]; g.fill();                 // まぶたがはんぶん下りる
      lLine(x - 0.26, ey + 0.01, x + 0.26, ey + 0.01, 0.07, '#3a2a1a');
    } else if (mood === 'nervous') {
      lEll(x, ey, 0.23, 0.26, '#fff', OL, 0.05);
      lEll(x + 0.02 * s, ey - 0.06, 0.075, 0.085, '#2a2a2a');
    } else {
      lEll(x, ey, 0.21, 0.26, '#fff', OL, 0.05);
      lEll(x + 0.015 * s, ey + 0.02, 0.115, 0.14, '#2a2a2a');
      lEll(x - 0.02 + 0.015 * s, ey - 0.04, 0.04, 0.04, '#fff');
    }
  }
}
function charMouth(idx, mood, t) {
  const my = 0.5;
  if (mood === 'dizzy') {
    const w = 0.12 + Math.sin(t * 9) * 0.03;
    lEll(0, my + 0.05, w + 0.06, 0.11, '#a33', OL, 0.04);
    lEll(0, my + 0.1, w, 0.05, '#e66');
  } else if (mood === 'confused') {
    lEll(0, my + 0.06, 0.07, 0.07, '#a33', OL, 0.035);
  } else if (mood === 'nervous') {
    g.beginPath(); g.moveTo(-0.26, my + 0.04);
    for (let i = 1; i <= 6; i++) g.lineTo(-0.26 + i * 0.087, my + 0.04 + (i % 2 ? -0.045 : 0.045));
    g.strokeStyle = '#8a3a2a'; g.lineWidth = 0.055; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
  } else if (mood === 'smug') {
    g.beginPath(); g.moveTo(-0.38, my - 0.02); g.quadraticCurveTo(0.05, my + 0.5, 0.42, my - 0.1); g.quadraticCurveTo(0.05, my + 0.12, -0.38, my - 0.02); g.closePath(); fs('#fff', OL, 0.05);
    lLine(-0.2, my + 0.08, 0.28, my + 0.02, 0.025, '#d0b0a0');
  } else {
    if (idx === 0) { g.beginPath(); g.arc(0, my - 0.12, 0.3, 0.2, Math.PI - 0.2); g.closePath(); fs('#fff', OL, 0.05); lRR(-0.09, my + 0.1, 0.09, 0.12, 0.02, '#fff', OL, 0.03); lRR(0.0, my + 0.1, 0.09, 0.12, 0.02, '#fff', OL, 0.03); }   // 前歯
    else if (idx === 2) { g.beginPath(); g.moveTo(-0.3, my); g.quadraticCurveTo(0, my + 0.35, 0.3, my); g.closePath(); fs('#fff', OL, 0.05); }
    else lArc(0, my - 0.14, 0.26, 0.25, Math.PI - 0.25, '#8a3a2a', 0.06);
  }
}
function charBrows(idx, mood) {
  const th = idx === 2 || idx === 4 ? 0.12 : 0.06, col = idx === 3 ? '#b0b0b8' : '#2a1a10';
  let ay = -0.42;
  for (const s of [-1, 1]) {
    const x = 0.4 * s;
    if (mood === 'nervous') lLine(x - 0.2 * s, ay + 0.02, x + 0.16 * s, ay - 0.1, th, col);
    else if (mood === 'smug') lLine(x - 0.2 * s, ay - (s < 0 ? 0.1 : 0.0), x + 0.2 * s, ay + (s < 0 ? 0.0 : 0.08), th, col);
    else if (mood === 'confused') lLine(x - 0.18 * s, ay - 0.08, x + 0.18 * s, ay - 0.08, th * 0.8, col);
    else if (mood === 'dizzy') lLine(x - 0.18 * s, ay + 0.04, x + 0.18 * s, ay - 0.06, th, col);
    else if (idx === 2 || idx === 4) lLine(x - 0.22 * s, ay + 0.1, x + 0.2 * s, ay - 0.05, th, col);
    else lLine(x - 0.18 * s, ay, x + 0.18 * s, ay - 0.02, th, col);
  }
}
function charExtras(idx, mood) {
  // ほほ・めがね・ひげなど
  for (const s of [-1, 1]) lEll(0.66 * s, 0.32, 0.17, 0.1, idx === 3 ? 'rgba(255,120,140,0.6)' : 'rgba(255,130,120,0.38)');
  if (idx === 0) { lRR(0.5, 0.38, 0.34, 0.16, 0.05, '#f6d7a8', '#c9a070', 0.03, 0); lLine(0.62, 0.38, 0.62, 0.54, 0.02, '#c9a070'); lLine(0.72, 0.38, 0.72, 0.54, 0.02, '#c9a070'); }   // ばんそうこう
  if (idx === 1) {
    for (const s of [-1, 1]) lEll(0.4 * s, -0.02, 0.31, 0.31, 'rgba(255,255,255,0.28)', '#2a2a3a', 0.06);
    lLine(-0.1, -0.05, 0.1, -0.05, 0.05, '#2a2a3a'); lLine(-0.71, -0.05, -0.99, -0.12, 0.05, '#2a2a3a'); lLine(0.71, -0.05, 0.99, -0.12, 0.05, '#2a2a3a');
  }
  if (idx === 2) { for (let i = 0; i < 9; i++) lEll(-0.42 + i * 0.105, 0.78 + (i % 3) * 0.03, 0.018, 0.018, '#6a4a3a'); }   // ひげのあと
  if (idx === 3) { lArc(0.6, 0.55, 0.22, 2.6, 3.7, '#c9a090', 0.03); lArc(-0.6, 0.55, 0.22, -0.55, 0.55, '#c9a090', 0.03); lArc(-0.1, -0.52, 0.5, 3.8, 5.6, '#d8c8c0', 0.03); }   // しわ
  if (idx === 4) { lPoly([[-0.34, 0.37], [0, 0.31], [0.34, 0.37], [0.22, 0.46], [0, 0.4], [-0.22, 0.46]], '#ffc21a', OL, 0.04); }   // ひげ
}

// 人物 1 人を描く。mood と、まわる目の角度などを o で渡す
function drawChar(idx, mood, t, o) {
  o = o || {};
  charBody(idx);
  charHeadBack(idx);
  charHeadShape(idx);
  charExtras(idx, mood);
  charEyes(idx, mood, t, o);
  charBrows(idx, mood);
  charMouth(idx, mood, t);
  charHairFront(idx);
  // 汗・？
  if (mood === 'nervous') { lEll(0.95, -0.3 + Math.sin(t * 6) * 0.04, 0.1, 0.16, '#9bd8ff', '#3a86c8', 0.04); }
  if (mood === 'confused') {
    lTxt('？', -1.45 + Math.sin(t * 5) * 0.05, -0.95 + Math.sin(t * 4) * 0.06, 0.85, '#e23b3b', '#fff');
    lTxt('？', 1.5, -1.25 + Math.sin(t * 4.5 + 1) * 0.06, 0.62, '#e23b3b', '#fff');
  }
}
