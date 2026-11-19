// ===== 操作・ループ・演出の出し分け・結果 =====
const BEST_KEY = 'tataite-kabutte-best-v2';   // { r: 到達（優勝 = 6）, f: 最速の反応 }
function loadBest() { try { const v = JSON.parse(localStorage.getItem(BEST_KEY)); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
function saveBest(v) { try { localStorage.setItem(BEST_KEY, JSON.stringify(v)); } catch (_) {} }

let shownResult = false, lastNow = 0, overAt = 0, FROZEN = null;
const timers = [];
const later = (nt, delay, fn) => timers.push({ at: nt + delay, fn });
const nowSec = () => FROZEN != null ? FROZEN : performance.now() / 1000;
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
  popups.length = 0; parts.length = 0; confetti.length = 0; timers.length = 0; react = null; shakeT = 0; flashT = 0;
  VS.cpu = null; VS.ia = { hammer: null, helmet: null }; VS.slam = null; VS.starSky = false; VS.viewHelmetT = -9; VS.introT = -9;
  VS.crowd = 0; VS.murmur = 0; VS.retT = { hammer: -9, helmet: -9 };
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
  $('share').addEventListener('click', () => doShare());
}

// 文を文節ごとの span にして入れる（| が文節の切れ目）
function setPhrases(el, text) {
  el.textContent = '';
  text.split('|').forEach(s => { const sp = document.createElement('span'); sp.className = 'ph'; sp.textContent = s; el.appendChild(sp); });
}

function showResult() {
  shownResult = true;
  const champ = Game.tourney === 'champion';
  const reach = champ ? CFG.opps.length + 1 : Game.oppIdx + 1;     // 優勝は 6
  const fastTxt = Game.fastest != null ? Game.fastest.toFixed(2) + ' 秒' : '—';
  $('cert').classList.toggle('hide', !champ);
  $('bracket').classList.toggle('hide', champ);
  if (champ) {
    $('cFast').textContent = fastTxt;
    $('cPraise').textContent = Game.fastest != null ? praiseOf(Game.fastest) : '';
  } else {
    const idx = Game.oppIdx, opp = CFG.opps[idx];
    $('bHead').textContent = roundLabel(idx) + 'で 敗退…';
    const rows = $('bRows'); rows.textContent = '';
    CFG.opps.forEach((o, i) => {
      const li = document.createElement('li');
      li.className = i < idx ? 'ok' : (i === idx ? 'lost' : '');
      const mk = (cls, t) => { const s = document.createElement('span'); s.className = cls; s.textContent = t; li.appendChild(s); };
      mk('dot', i < idx ? '✓' : (i === idx ? '✕' : ''));
      mk('rl', roundLabel(i)); mk('rn', o.name); mk('rs', i < idx ? '勝ち' : (i === idx ? '敗退' : ''));
      rows.appendChild(li);
    });
    $('tWho').textContent = opp.name;
    setPhrases($('tText'), opp.taunt || '');
    const ic = $('oppIcon'), ig = ic.getContext('2d');
    ig.clearRect(0, 0, ic.width, ic.height);
    withCtx(ic, 1, 0, 0, () => { T(80, 92, 58, 0); drawChar(Math.min(idx, 4), 'smug', 0); U(); });
  }
  $('rFast').textContent = fastTxt;
  $('rHits').textContent = Game.stats.hits;
  $('rFouls').textContent = Game.stats.fouls;
  const best = loadBest();
  const nb = { r: Math.max(best.r || 0, reach), f: Game.fastest != null && (!best.f || Game.fastest < best.f) ? Game.fastest : best.f };
  const newReach = reach > (best.r || 0) && (best.r || 0) > 0, newFast = Game.fastest != null && best.f && Game.fastest < best.f - 1e-9;
  saveBest(nb);
  const lab = r => r > CFG.opps.length ? '優勝' : roundLabel(r - 1);
  const bt = (newReach || newFast ? 'ベスト こうしん！|' : '') + '自己ベスト ' + lab(nb.r) + (nb.f ? '|最速 ' + nb.f.toFixed(2) + ' 秒' : '');
  setPhrases($('rBest'), bt);
  prepareShareImage();
  const el = $('result');
  el.classList.add('show', 'wait');   // 指が離れる前にボタンを押してしまわないように、少しの間は触れない
  el.scrollTop = 0;
  setTimeout(() => el.classList.remove('wait'), 700);
}

// ロジックの出来事 → 音と動き
function reactToEvents(nt) {
  for (const e of Game.events) {
    if (e.type === 'start') {
      $('title').classList.add('hide');
      react = null; VS.cpu = null; VS.introT = nt;
    } else if (e.type === 'nextOpp') {
      Snd.win();
      addPopup(roundLabel(e.idx), 50, 123, 13, '#ffd23f', 1.6);
      react = null; VS.cpu = null; VS.slam = null; VS.introT = nt; VS.ia = { hammer: null, helmet: null };
    } else if (e.type === 'call') {
      Snd.call(e.idx, e.aiko);
      react = null;
    } else if (e.type === 'pon') {
      Snd.pon(e.aiko);
    } else if (e.type === 'draw') {
      Snd.draw();
      addPopup('あいこ', 50, 123, 11, '#fff', 0.7);
    } else if (e.type === 'cpuTake') {
      Snd.tapItem();
    } else if (e.type === 'tap') {
      react = { sec: e.react, praise: e.praise, correct: e.correct };
    } else if (e.type === 'outcome') {
      onOutcome(e, nt);
    } else if (e.type === 'over') {
      overAt = nt;
      if (e.tourney === 'champion') { later(nt, 0.1, () => { Snd.fanfare(); startConfetti(110); }); }
    }
  }
  Game.events.length = 0;
}

const HIT_WORDS = ['ピコッ！', 'ピコッ！', 'ずぼっ！', 'ずーん！', 'ぴゅーん！'];
function onOutcome(e, nt) {
  const f = LAY.face, lvl = Math.min(e.oppIdx, CFG.opps.length - 1);
  const final = e.matchResult === 'win' && lvl === CFG.opps.length - 1;
  // 自分の道具の動き
  if (Game.pItem === 'helmet') {
    VS.ia.helmet = { t0: nt, mode: 'don', pon: Game.ponT };
    if (e.outcome === 'guard' || e.outcome === 'wrongHelmet') VS.viewHelmetT = nt;
  } else if (Game.pItem === 'hammer') {
    VS.ia.hammer = { t0: nt, mode: e.outcome === 'foul' ? 'foul' : 'swing', pon: Game.ponT, guarded: e.outcome === 'guarded' };
  }
  switch (e.outcome) {
    case 'hit':
      VS.cpu = { kind: 'hit', t0: nt + 0.1, lvl, final };
      later(nt, 0.1, () => {
        Snd.pico(true); shake(1.4 + lvl * 0.8, 0.2 + lvl * 0.04); flash('#fff', 0.2);
        burst(f.x, f.y - 6, '#ffd23f', 10 + lvl * 4, 38 + lvl * 7, 0.8, true);
        addPopup(lvl === 4 && !final ? 'ぼよーん！' : HIT_WORDS[lvl], 50, 123, 13 + lvl * 1.2, '#ffd23f', 1.1);
        if (lvl === 2 || lvl === 3) { Snd.sink(); burst(f.x, LAY.floorY, '#d9a463', 10 + lvl * 4, 26 + lvl * 6, 0.7); }
        if (final) Snd.zoom();
        VS.crowd = 1;
        Snd.cheer(false);
      });
      if (final) later(nt, 1.25, () => { VS.starSky = true; VS.starT = nt + 1.25; Snd.twinkle(); });
      break;
    case 'cpuFoul':
      Snd.foul();
      VS.cpu = { kind: 'nervous', t0: nt, lvl };
      addPopup('相手の反則！', 50, 123, 10, '#ffd23f', 1.2);
      burst(f.x, f.y - 6, '#ffd23f', 8, 30, 0.6, true); VS.crowd = 0.8;
      break;
    case 'guarded':
      VS.cpu = { kind: 'smug', t0: nt + 0.12, lvl };
      later(nt, 0.12, () => { Snd.guard(); burst(f.x, f.y - 12, '#9bd0ff', 8, 28, 0.5); addPopup('ガードされた！', 50, 123, 10, '#9bd0ff', 1.1); });
      break;
    case 'wrongHelmet':
      Snd.whiff(); Snd.murmur();
      VS.cpu = { kind: 'confused', t0: nt, lvl };
      VS.murmur = 1;
      addPopup('ざわ…ざわ…', 50, 123, 9, '#e8e0d0', 1.4);
      break;
    case 'guard':
      VS.cpu = { kind: 'nervous', t0: nt + 0.12, lvl };
      if (Game.cItem === 'hammer') VS.slam = { kind: 'guard', t0: nt, lvl };
      later(nt, 0.12, () => {
        Snd.guard(); burst(50, 30, '#9bd0ff', 10, 30, 0.5); flash('#9bd0ff', 0.15); shake(0.8, 0.12);
        addPopup('ナイスガード！', 50, 123, 11, '#9bd0ff', 1.1); VS.crowd = 0.6; Snd.cheer(false);
      });
      break;
    case 'cpuHit':
    case 'foul': {
      const isFoul = e.outcome === 'foul';
      if (isFoul) { Snd.foul(); VS.murmur = 0.6; }
      VS.slam = { kind: 'hit', t0: nt, lvl };
      VS.cpu = { kind: 'smug', t0: nt + 0.11, lvl };
      later(nt, 0.11, () => {
        Snd.pico2(); shake(3.2 + lvl * 1.5, 0.35 + lvl * 0.06); flash(isFoul ? '#ff3b3b' : '#ff6b6b', 0.3);
        burst(50, 96, '#ffd23f', 12 + lvl * 6, 44 + lvl * 9, 0.9, true);
        if (lvl >= 3) burst(50, 80, '#fff', 8 + lvl * 3, 50 + lvl * 8, 0.8, true);
        addPopup(isFoul ? '反則！' : (e.timeout ? 'ぼーっとしてた！' : 'ピコッ！'), 50, 123, isFoul ? 14 : (e.timeout ? 9 : 14), '#ff6b6b', 1.1);
        VS.crowd = 0.7;
      });
      break;
    }
    case 'nothing':
      Snd.whiff(); addPopup('…', 50, 123, 9, '#e8e0d0', 0.9); break;
  }
  if (e.matchResult === 'lose') later(nt, 0.5, () => Snd.lose());
  else if (e.matchResult === 'win' && !final) later(nt, 0.45, () => Snd.cheer(true));
}

function stepFrame(nt, dt) {
  Game.advanceTo(nt);
  reactToEvents(nt);
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= nt) { const t = timers.splice(i, 1)[0]; t.fn(); }
  if (Game.mode === 'over' && !shownResult && nt - overAt > CFG.overDelay) showResult();
  updateVisual(dt, nt);
}

function frame() {
  const nt = nowSec();
  const dt = FROZEN != null ? 0 : (lastNow ? Math.min(nt - lastNow, 0.1) : 0);
  lastNow = nt;
  stepFrame(nt, dt);
  render(nt);
  requestAnimationFrame(frame);
}

// ---------- 見た目の確認用（URL の # で場面を指定。通常のプレイでは使われない）----------
//  例: index.html#dbg&s=hit&opp=2&u=0.3   s: hit foul guard cpuhit guarded wrong cfoul pon call wait / opp: 0〜4 / u: 出来事からの秒 / p,c: 先に取った本数
function debugBoot() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (!q.has('dbg')) return false;
  document.documentElement.classList.add('dbg');
  const s = q.get('s') || 'title', k = +(q.get('opp') || 0), u = +(q.get('u') || 0.3);
  if (s === 'title') { FROZEN = 1000 + u; return true; }
  if (s === 'bot') { debugBot(q); return true; }
  if (s === 'audio') { try { Snd.init(); for (const k of Object.keys(Snd)) if (k !== 'init') Snd[k](1, true); document.title = 'audio:ok'; } catch (er) { document.title = 'audio:ERR ' + er.message; } return true; }
  if (s === 'gallery') { GALLERY = true; FROZEN = 1000 + u; return true; }
  const SC = {
    hit: { ph: 0, ch: 1, item: 'hammer', after: 0.3, cr: 1.2 }, foul: { ph: 0, ch: 2, item: 'hammer', after: 0.3, cr: 1.2 },
    guard: { ph: 0, ch: 2, item: 'helmet', after: 0.3, cr: 0.9 }, cpuhit: { ph: 0, ch: 2, item: null, cr: 0.5 },
    guarded: { ph: 0, ch: 1, item: 'hammer', after: 0.7, cr: 0.25 }, wrong: { ph: 0, ch: 1, item: 'helmet', after: 0.3, cr: 1.2 },
    cfoul: { ph: 0, ch: 1, item: null, cr: 0.4, mistake: 1 }, pon: { ph: 0, ch: 1, item: null, cr: 1.4 }, call: { ph: 0, ch: 1, item: null, cr: 1.4 }, wait: { ph: 0, ch: 1, item: null, cr: 1.4 }
  };
  const cfg = SC[s] || SC.hit;
  let t = 1000;
  Game.reset(7);
  CFG.opps[k] = Object.assign({}, CFG.opps[k], { mean: cfg.cr, spread: 0.0001, min: 0.01, mistake: cfg.mistake || 0 });
  Game.begin(t);
  Game.oppIdx = k; Game.beginOpp(t, CFG.readyT, 'start');
  Game.score = { p: +(q.get('p') || 0), c: +(q.get('c') || 0) };
  Game.pickCpuHand = () => cfg.ch;
  let sel = false, tapped = false, evT = null;
  for (let i = 0; i < 4000; i++) {
    t += 1 / 60;
    if (Game.phase === 'wait') {
      if (s === 'wait' && evT == null) evT = t;
      if (!sel && s !== 'wait') { Game.selectHand(cfg.ph, t); sel = true; if (s === 'call') evT = t; }
    }
    if (Game.phase === 'grab') {
      if (s === 'pon' && evT == null) evT = Game.ponT;
      if (cfg.item && !tapped && !Game.pItem && t - Game.ponT >= cfg.after) { Game.tapItem(cfg.item, t); tapped = true; evT = t; }
    }
    if (evT == null && Game.outcome) evT = Game.resolveT;
    stepFrame(t, 1 / 60);
    if (evT != null && t >= evT + u) break;
  }
  FROZEN = t;
  return true;
}

// 人物と表情の一覧（見た目の確認用）
function drawGallery(nowT) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  drawBackground(nowT); drawTableTop(nowT);
  const moods = ['normal', 'nervous', 'dizzy', 'confused', 'smug'];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    const x = 11 + j * 19, y = 22 + i * 30;
    T(x, y, 7.4, 0); drawChar(i, moods[j], nowT + 0.5, { spin: nowT * 9 }); U();
  }
}

// 自動で最後まで遊ぶ（動作確認用。#dbg&s=bot&seed=3&rt=0.4）
function debugBot(q) {
  const seed = +(q.get('seed') || 1), rt = +(q.get('rt') || 0.4);
  Game.reset(seed); let t = 1000; Game.begin(t);
  let tapAt = null, endAt = null;
  for (let i = 0; i < 60 * 600; i++) {
    t += 1 / 60;
    if (Game.mode === 'match') {
      if (Game.phase === 'wait') Game.selectHand(Math.floor(Game.rand() * 3), t);
      if (Game.phase === 'grab' && !Game.pItem && Game.rps && t - Game.ponT >= rt) Game.tapItem(Game.rps === 'win' ? 'hammer' : 'helmet', t);
    }
    stepFrame(t, 1 / 60);
    if (i % 4 === 0) render(t);
    if (Game.mode === 'over' && endAt == null) endAt = t;
    if (endAt != null && t > endAt + 3) break;
  }
  FROZEN = t;
  document.title = 'bot:' + Game.tourney + ':' + (Game.oppIdx + 1) + ':' + JSON.stringify(Game.stats);
}
