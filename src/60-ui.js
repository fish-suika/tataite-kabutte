// ===== 操作・ループ・結果 =====
const BEST_KEY = 'tataite-kabutte-best-v2';   // { r: 到達（優勝 = 6）, f: 最速の反応 }
function loadBest() { try { const v = JSON.parse(localStorage.getItem(BEST_KEY)); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
function saveBest(v) { try { localStorage.setItem(BEST_KEY, JSON.stringify(v)); } catch (_) {} }

let shownResult = false, lastNow = 0, overAt = 0;
const nowSec = () => performance.now() / 1000;
// pointerdown の時刻（performance.now と同じ時計）。おかしい値のときは今の時刻
function evTime(e) {
  const n = performance.now(), t = e.timeStamp;
  return (t > 0 && Math.abs(n - t) < 2000 ? t : n) / 1000;
}

function pickHand(h, t) {
  pressT[h] = 0.15;
  if (Game.selectHand(h, t)) Snd.select(h);
}
function pickItem(which, t) {
  if (Game.tapItem(which, t)) { itemPress[which] = 0.15; Snd.tapItem(); }
  else itemPress[which] = 0.08;   // 無効なときも小さく動く（反応なしにしない）
}

function startOrRetry(t) {
  Game.reset();
  shownResult = false;
  popups.length = 0; parts.length = 0; react = null; faceT = 0; shakeT = 0; flashT = 0;
  $('result').classList.remove('show', 'wait');
  Game.begin(t);
}

function bindUI() {
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    Snd.init();
    const t = evTime(e);
    if (Game.mode === 'title') { startOrRetry(t); return; }
    if (Game.mode !== 'match') return;
    const p = toLogic(e.clientX, e.clientY);
    // 手のボタン
    if (p.y >= LAY.btnY - 2) {
      for (let h = 0; h < 3; h++) {
        const b = LAY.btns[h];
        if (p.x >= b.x - 1 && p.x <= b.x + b.w + 1) { pickHand(h, t); return; }
      }
      return;
    }
    // 道具（広めに取る）
    if (p.y >= LAY.hammer.y - 4 && p.y < LAY.btnY - 2) {
      pickItem(p.x < 50 ? 'hammer' : 'helmet', t);
    }
  });
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = e.key, t = evTime(e);
    if (Game.mode === 'title') {
      if (k === '1' || k === '2' || k === '3' || k === ' ' || k === 'Enter' || k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); Snd.init(); startOrRetry(t); }
      return;
    }
    if (Game.mode === 'over') {
      if ((k === ' ' || k === 'Enter') && !$('result').classList.contains('wait')) { e.preventDefault(); Snd.init(); startOrRetry(t); }
      return;
    }
    if (k === '1' || k === '2' || k === '3') { e.preventDefault(); pickHand(+k - 1, t); }
    else if (k === 'ArrowLeft') { e.preventDefault(); pickItem('hammer', t); }
    else if (k === 'ArrowRight') { e.preventDefault(); pickItem('helmet', t); }
  });
  window.addEventListener('resize', resize);
  window.addEventListener('contextmenu', e => e.preventDefault());
  $('retry').addEventListener('click', () => { Snd.init(); startOrRetry(nowSec()); });
}

function showResult() {
  shownResult = true;
  const champ = Game.tourney === 'champion';
  const reach = champ ? CFG.opps.length + 1 : Game.oppIdx + 1;     // 優勝は 6
  $('rHead').textContent = champ ? '優勝！' : roundLabel(Game.oppIdx) + 'で 敗退…';
  $('rSub').textContent = champ ? '町内 叩いて被って大会' : Game.opp.name + 'に 敗れた';
  $('rFast').textContent = Game.fastest != null ? Game.fastest.toFixed(2) + ' 秒' : '—';
  $('rHits').textContent = Game.stats.hits;
  $('rFouls').textContent = Game.stats.fouls;
  const best = loadBest();
  const nb = { r: Math.max(best.r || 0, reach), f: Game.fastest != null && (!best.f || Game.fastest < best.f) ? Game.fastest : best.f };
  const newReach = reach > (best.r || 0) && (best.r || 0) > 0, newFast = Game.fastest != null && best.f && Game.fastest < best.f - 1e-9;
  saveBest(nb);
  const lab = r => r > CFG.opps.length ? '優勝' : roundLabel(r - 1);
  $('rBest').textContent = (newReach || newFast ? 'ベスト こうしん！　' : '') + '自己ベスト ' + lab(nb.r) + (nb.f ? '・最速 ' + nb.f.toFixed(2) + ' 秒' : '');
  const el = $('result');
  el.classList.add('show', 'wait');   // 指が離れる前にボタンを押してしまわないように、少しの間は触れない
  setTimeout(() => el.classList.remove('wait'), 700);
}

// ロジックの出来事 → 音と動き
function reactToEvents() {
  for (const e of Game.events) {
    if (e.type === 'start') {
      $('title').classList.add('hide');
      react = null;
    } else if (e.type === 'nextOpp') {
      Snd.win();
      addPopup(roundLabel(e.idx), 50, 78, 13, '#ffd23f', 1.6);
      faceT = 0; react = null;
    } else if (e.type === 'call') {
      Snd.call(e.idx, e.aiko);
      react = null;
    } else if (e.type === 'pon') {
      Snd.pon();
    } else if (e.type === 'draw') {
      Snd.draw();
      addPopup('あいこ', 50, 80, 11, '#fff', 0.7);
    } else if (e.type === 'cpuTake') {
      Snd.tapItem();
    } else if (e.type === 'tap') {
      react = { sec: e.react, praise: e.praise, correct: e.correct };
    } else if (e.type === 'outcome') {
      onOutcome(e);
    } else if (e.type === 'over') {
      overAt = nowSec();
    }
  }
  Game.events.length = 0;
}

function onOutcome(e) {
  const f = LAY.face;
  switch (e.outcome) {
    case 'hit':
      Snd.pico(true); shake(2.2, 0.25); flash('#fff', 0.2);
      burst(f.x, f.y, '#ffd23f', 14, 40, 0.7, true);
      addPopup('ピコッ！', 50, 78, 14, '#ffd23f', 1.1);
      faceMood = 'dizzy'; faceT = 1.4; break;
    case 'cpuFoul':
      Snd.foul(); Snd.pico(false);
      burst(f.x, f.y, '#ffd23f', 10, 34, 0.6, true);
      addPopup('相手の反則！', 50, 78, 10, '#ffd23f', 1.2);
      faceMood = 'dizzy'; faceT = 1.4; break;
    case 'guarded':
      Snd.guard(); burst(f.x, f.y - 8, '#9bd0ff', 8, 28, 0.5);
      addPopup('ガードされた！', 50, 78, 10, '#9bd0ff', 1.1);
      faceMood = 'grin'; faceT = 1.2; break;
    case 'wrongHelmet':
      Snd.whiff(); addPopup('勝ったのに…', 50, 78, 9, '#e8e0d0', 1.1);
      faceMood = 'huh'; faceT = 1.4; break;
    case 'guard':
      Snd.guard(); burst(50, 100, '#9bd0ff', 10, 30, 0.5);
      addPopup('ナイスガード！', 50, 78, 11, '#9bd0ff', 1.1); flash('#9bd0ff', 0.15);
      faceMood = 'sweat'; faceT = 1.2; break;
    case 'cpuHit':
      Snd.pico2(); shake(4.5, 0.4); flash('#ff6b6b', 0.25);
      burst(50, 95, '#ffd23f', 14, 44, 0.8, true);
      addPopup(e.timeout ? 'ぼーっとしてた！' : 'ピコッ！', 50, 78, e.timeout ? 9 : 14, '#ff6b6b', 1.1);
      faceMood = 'grin'; faceT = 1.4; break;
    case 'foul':
      Snd.foul(); shake(4, 0.35); flash('#ff3b3b', 0.3);
      burst(50, 95, '#ffd23f', 12, 40, 0.7, true);
      addPopup('反則！', 50, 78, 14, '#ff6b6b', 1.2);
      faceMood = 'grin'; faceT = 1.4; break;
    case 'nothing':
      Snd.whiff(); addPopup('…', 50, 78, 9, '#e8e0d0', 0.9); break;
  }
  if (e.matchResult === 'lose') setTimeout(() => Snd.lose(), 500);
  else if (e.matchResult === 'win' && e.oppIdx === CFG.opps.length - 1) setTimeout(() => Snd.win(), 500);
}

function frame() {
  const nt = nowSec();
  const dt = lastNow ? Math.min(nt - lastNow, 0.1) : 0;
  lastNow = nt;
  Game.advanceTo(nt);
  reactToEvents();
  if (Game.mode === 'over' && !shownResult && nt - overAt > CFG.overDelay) showResult();
  updateVisual(dt);
  render(nt);
  requestAnimationFrame(frame);
}
