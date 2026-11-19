// ===== 結果カードの画像と X への共有 =====
const SHARE_URL = 'https://fish-suika.github.io/tataite-kabutte/';
let shareFile = null, shareBlobWait = false;

function resultLabel() { return Game.tourney === 'champion' ? '優勝' : roundLabel(Game.oppIdx) + '敗退'; }
function shareText() {
  return '叩いて被ってジャンケンポン ' + resultLabel() + (Game.fastest != null ? '／最速' + Game.fastest.toFixed(2) + '秒' : '');
}
function isMobileDevice() {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

// 結果カード（1200×630）を Canvas で描く
function makeCard() {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
  const champ = Game.tourney === 'champion';
  withCtx(c, 1, 0, 0, () => {
    // 背景
    const bg = g.createLinearGradient(0, 0, 0, 630); bg.addColorStop(0, '#fff6e0'); bg.addColorStop(1, '#ffdca0');
    g.fillStyle = bg; g.fillRect(0, 0, 1200, 630);
    for (let x = 0; x < 1200; x += 60) {
      const col = (x / 60) % 2 ? '#e23b3b' : '#ffffff';
      g.fillStyle = col; g.fillRect(x, 0, 61, 52); g.beginPath(); g.arc(x + 30, 52, 30.5, 0, Math.PI); g.fill();
    }
    g.fillStyle = '#ffd23f'; g.fillRect(0, 48, 1200, 6);
    txt('町内　叩いて被って大会', 60, 108, 40, '#7a1a1a', { align: 'left' });
    txt('叩いて被ってジャンケンポン', 60, 168, 58, '#e23b3b', { align: 'left', stroke: '#fff', sw: 8 });
    // 結果
    if (champ) {
      txt('優勝！', 60, 318, 176, '#ffc21a', { align: 'left', stroke: '#7a1a1a', sw: 26 });
      T(620, 255, 46, 0.1); lStar(0, 0, 1, '#ffd23f', 0, '#c98a00', 0.08); lEll(-0.25, -0.05, 0.09, 0.12, '#3a2a1a'); lEll(0.25, -0.05, 0.09, 0.12, '#3a2a1a'); lArc(0, 0.12, 0.24, 0.25, Math.PI - 0.25, '#8a3a2a', 0.07); U();
    } else {
      txt(roundLabel(Game.oppIdx) + 'で', 60, 262, 80, '#4a2a10', { align: 'left' });
      txt('敗退…', 60, 372, 150, '#e23b3b', { align: 'left', stroke: '#fff', sw: 20 });
    }
    txt('最速の反応', 64, 488, 40, '#7a4a22', { align: 'left' });
    txt(Game.fastest != null ? Game.fastest.toFixed(2) + ' 秒' : '—', 316, 484, 82, '#4a2a10', { align: 'left', stroke: '#fff', sw: 12 });
    txt('fish-suika.github.io/tataite-kabutte', 600, 596, 28, '#7a4a22');
    // 右：人物
    if (champ) {
      for (let i = 0; i < 5; i++) { T(800 + (i % 3) * 150 + (i > 2 ? 75 : 0) - 20, 400 + (i > 2 ? 135 : 0), 44, 0); drawChar(i, 'dizzy', 0, { spin: 3 + i }); U(); }
      for (let i = 0; i < 14; i++) { g.fillStyle = ['#e23b3b', '#ffd23f', '#3d9bff', '#38c172', '#ff8ac0'][i % 5]; g.save(); g.translate(740 + ((i * 97) % 440), 90 + ((i * 53) % 220)); g.rotate(i); g.fillRect(-9, -5, 18, 10); g.restore(); }
    } else {
      T(960, 330, 150, 0); drawChar(Math.min(Game.oppIdx, 4), 'smug', 0); U();
    }
  });
  return c;
}
function prepareShareImage() {
  shareFile = null;
  try {
    const c = makeCard();
    c.toBlob(b => { if (b) { try { shareFile = new File([b], 'tataite-kabutte.png', { type: 'image/png' }); } catch (_) { shareFile = null; } } }, 'image/png');
  } catch (_) { shareFile = null; }
}

function openIntent(text) {
  const u = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(SHARE_URL);
  window.open(u, '_blank', 'noopener');
}
function doShare() {
  const text = shareText();
  // スマホ：Web Share API（結果カードの画像つき）。PC：X の投稿画面（文章＋URL）
  if (isMobileDevice() && navigator.share) {
    let data = { text, url: SHARE_URL };
    try {
      if (shareFile && navigator.canShare && navigator.canShare({ files: [shareFile] })) data = { text, url: SHARE_URL, files: [shareFile] };
    } catch (_) {}
    navigator.share(data).catch(err => { if (!err || err.name !== 'AbortError') openIntent(text); });
    return;
  }
  openIntent(text);
}
