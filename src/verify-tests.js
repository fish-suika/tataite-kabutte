// ===== 自動テスト（画面なし。時刻を渡して 1 回ずつ・ボットで試合を回す）=====
(function () {
  const out = document.getElementById('out');
  let fail = 0, total = 0;
  function check(name, cond, note) {
    total++;
    if (!cond) fail++;
    const p = document.createElement('div');
    p.className = cond ? 'ok' : 'ng';
    p.textContent = (cond ? 'PASS  ' : 'FAIL  ') + name + (note ? '  [' + note + ']' : '');
    out.appendChild(p);
  }
  function info(text) {
    const p = document.createElement('div');
    p.className = 'info'; p.textContent = '    ' + text;
    out.appendChild(p);
  }
  function head(text) {
    const p = document.createElement('h3'); p.textContent = text; out.appendChild(p);
  }
  const ORIG_PICK = Game.pickCpuHand;

  // ---------- 1. 判定表（resolveRound）の全部の行 ----------
  head('1. 判定表');
  const TO = CFG.grabTimeout;
  const R = (rps, pItem, pT, cItem, cT) => resolveRound(rps, pItem, pT, cItem, cT, TO);
  function row(name, r, type, point) {
    check(name, r.type === type && r.point === point, '→ ' + r.type + '/' + r.point + '（期待 ' + type + '/' + point + '）');
  }
  // 勝ち
  row('勝ち＋ハンマー（相手がヘルメットを被るより速い）→ 自分の 1 本', R('win', 'hammer', 0.5, 'helmet', 0.9), 'hit', 'p');
  row('勝ち＋ハンマー（相手が先に被った）→ ガードされた・本数なし', R('win', 'hammer', 0.9, 'helmet', 0.5), 'guarded', null);
  row('勝ち＋ヘルメット → 間違い・本数なし', R('win', 'helmet', 0.5, 'helmet', 0.9), 'wrongHelmet', null);
  row('勝ち＋ハンマー（相手が負けたのにハンマーを取った・相手が先）→ 相手の反則で自分の 1 本', R('win', 'hammer', 0.9, 'hammer', 0.5), 'cpuFoul', 'p');
  row('勝ち＋ハンマー（相手が負けたのにハンマー・自分が先）→ 自分の 1 本', R('win', 'hammer', 0.4, 'hammer', 0.6), 'hit', 'p');
  row('勝ち＋何も取らない・相手が正しく被る → 時間切れで何もなし', R('win', null, null, 'helmet', 0.9), 'nothing', null);
  row('勝ち＋何も取らない・相手が負けたのにハンマー → 相手の反則で自分の 1 本', R('win', null, null, 'hammer', 0.9), 'cpuFoul', 'p');
  // 負け
  row('負け＋ヘルメット（相手が叩くより速い）→ ガード成功・本数なし', R('lose', 'helmet', 0.5, 'hammer', 0.9), 'guard', null);
  row('負け＋ヘルメット（相手が先に叩いた）→ 相手の 1 本', R('lose', 'helmet', 0.9, 'hammer', 0.5), 'cpuHit', 'c');
  row('負け＋ハンマー → 反則・相手の 1 本', R('lose', 'hammer', 0.3, 'hammer', 0.9), 'foul', 'c');
  row('負け＋ハンマー（相手が先に叩いていた）→ 相手の 1 本', R('lose', 'hammer', 0.9, 'hammer', 0.5), 'cpuHit', 'c');
  row('負け＋ハンマー（相手が取り違えてヘルメット）→ 反則・相手の 1 本', R('lose', 'hammer', 0.3, 'helmet', 0.9), 'foul', 'c');
  row('負け＋ヘルメット（相手が取り違えてヘルメット）→ 本数なし', R('lose', 'helmet', 1.2, 'helmet', 0.5), 'guard', null);
  row('負け＋何も取らない → 約 1.5 秒で相手が叩く・相手の 1 本', R('lose', null, null, 'hammer', 1.2), 'cpuHit', 'c');
  row('負け＋何も取らない・相手が取り違えても時間切れで叩かれる', R('lose', null, null, 'helmet', 0.7), 'cpuHit', 'c');
  const rto = R('lose', null, null, 'helmet', 0.7);
  check('時間切れの決着は ' + TO + ' 秒', rto.at === TO, 'at=' + rto.at);
  // 同時刻：ヘルメット（守る側）が勝つ
  row('同時刻（勝ち＋ハンマー vs 相手ヘルメット）→ 守る側が勝つ（ガードされた）', R('win', 'hammer', 0.6, 'helmet', 0.6), 'guarded', null);
  row('同時刻（負け＋ヘルメット vs 相手ハンマー）→ 守る側が勝つ（ガード成功）', R('lose', 'helmet', 0.6, 'hammer', 0.6), 'guard', null);

  // ---------- 2. 実際の流れ（時刻を渡して 1 回ずつ進める）----------
  head('2. 流れ（合図・手の選択・タップ）');
  function fresh(seed) { Game.reset(seed || 1); Game.begin(0); }
  // 「ポン」まで進めて取り合いの状態にする（あいこなら進める）。強制的に手と相手の動きを決める
  function toGrab(o) {
    o = o || {};
    fresh(o.seed);
    const orig = Game.pickCpuHand;
    if (o.cHand != null) Game.pickCpuHand = function () { orig.call(this); return o.cHand; };
    Game.advanceTo(Game.endT - 0.0001);            // ready の終わり直前
    if (o.pHand != null) { Game.advanceTo(Game.endT + 0.0001); Game.selectHand(o.pHand, Game.time); }
    let n = 0;
    while (Game.phase !== 'grab' && n++ < 20) Game.advanceTo(Game.endT);
    Game.pickCpuHand = orig;
    // 相手の動きを上書き
    if (o.rps) Game.rps = o.rps;
    if (o.cItem) Game.cItem = o.cItem;
    if (o.cReact != null) Game.cReact = o.cReact;
    return Game.phase === 'grab';
  }
  function playRow(rps, which, react, cItem, cReact) {
    // rps に合う手の組を選ぶ：自分グー(0)、相手 チョキ(1)=勝ち / パー(2)=負け
    const ok = toGrab({ pHand: 0, cHand: rps === 'win' ? 1 : 2, cItem, cReact });
    if (!ok) return null;
    if (which) Game.tapItem(which, Game.ponT + react);
    else Game.advanceTo(Game.ponT + TO + 0.01);
    return { outcome: Game.outcome, point: Game.point, score: { ...Game.score }, phase: Game.phase };
  }
  let r;
  r = playRow('win', 'hammer', 0.5, 'helmet', 0.9);
  check('流れ：勝ち＋ハンマーで自分の 1 本、スコア 1-0', r && r.outcome === 'hit' && r.score.p === 1 && r.score.c === 0 && r.phase === 'result', JSON.stringify(r));
  r = playRow('win', 'hammer', 0.9, 'helmet', 0.5);
  check('流れ：先に被られたらガードされ、スコア 0-0', r && r.outcome === 'guarded' && r.score.p === 0 && r.score.c === 0, JSON.stringify(r));
  r = playRow('win', 'helmet', 0.5, 'helmet', 0.9);
  check('流れ：勝ったのにヘルメットは間違い、スコア 0-0', r && r.outcome === 'wrongHelmet' && r.score.p === 0 && r.score.c === 0, JSON.stringify(r));
  r = playRow('lose', 'helmet', 0.5, 'hammer', 0.9);
  check('流れ：負け＋速いヘルメットでガード成功、スコア 0-0', r && r.outcome === 'guard' && r.score.p === 0 && r.score.c === 0, JSON.stringify(r));
  r = playRow('lose', 'helmet', 1.2, 'hammer', 0.6);
  check('流れ：負け＋遅いヘルメットは叩かれる（タップ前に相手の 1 本が決まる）、スコア 0-1', r && r.outcome === 'cpuHit' && r.score.c === 1 && r.score.p === 0, JSON.stringify(r));
  r = playRow('lose', 'hammer', 0.3, 'hammer', 0.9);
  check('流れ：負け＋ハンマーは反則で相手の 1 本、スコア 0-1', r && r.outcome === 'foul' && r.score.c === 1, JSON.stringify(r));
  r = playRow('lose', null, 0, 'hammer', 0.9);
  check('流れ：負けて何も取らないと叩かれる（相手の反応の時刻に決着）', r && r.outcome === 'cpuHit' && Game.resolveT - Game.ponT > 0.89 && Game.resolveT - Game.ponT < 0.91, JSON.stringify(r) + ' at=' + (Game.resolveT - Game.ponT).toFixed(3));
  r = playRow('lose', null, 0, 'helmet', 0.9);
  check('流れ：負けて何も取らず相手も取り違え → ' + TO + ' 秒で叩かれる', r && r.outcome === 'cpuHit' && Math.abs(Game.resolveT - Game.ponT - TO) < 0.001, JSON.stringify(r));
  r = playRow('win', null, 0, 'helmet', 0.9);
  check('流れ：勝って何も取らなければ何もなし、スコア 0-0', r && r.outcome === 'nothing' && r.score.p === 0 && r.score.c === 0, JSON.stringify(r));
  r = playRow('win', null, 0, 'hammer', 0.7);
  check('流れ：相手が負けたのにハンマーを取ると相手の反則で自分の 1 本', r && r.outcome === 'cpuFoul' && r.score.p === 1, JSON.stringify(r));
  // タップの同時刻
  toGrab({ pHand: 0, cHand: 1, cItem: 'helmet', cReact: 0.6 }); Game.tapItem('hammer', Game.ponT + 0.6);
  check('流れ：同時刻（ハンマー vs 相手のヘルメット）はガードされる', Game.outcome === 'guarded', Game.outcome);
  toGrab({ pHand: 0, cHand: 2, cItem: 'hammer', cReact: 0.6 }); Game.tapItem('helmet', Game.ponT + 0.6);
  check('流れ：同時刻（ヘルメット vs 相手のハンマー）はガード成功', Game.outcome === 'guard', Game.outcome);

  // --- 実況・結果の文字は道具を取るまで出ない / 手は「ポン」で両方出る ---
  toGrab({ pHand: 0, cHand: 1 });
  check('「ポン」の直後は勝ち負けの文字なし（実況が空・結果が未決）', Game.comm === '' && Game.outcome === '' && Game.pHand === 0 && Game.cHand === 1, 'comm="' + Game.comm + '"');
  Game.tapItem('hammer', Game.ponT + 0.4);
  check('道具を取った後に結果の実況が出る', Game.comm === COMM.hit, Game.comm);
  check('反応の秒数が記録される（0.40 秒）と、ほめ言葉は「速い」', Math.abs(Game.pReact - 0.4) < 1e-9 && Game.pPraise === '速い', Game.pReact + ' ' + Game.pPraise);
  check('ほめ言葉のしきい値（0.30 神速 / 0.40 速い / 0.55 いいね / 0.70 なし）', praiseOf(0.30) === '神速' && praiseOf(0.40) === '速い' && praiseOf(0.55) === 'いいね' && praiseOf(0.70) === '', praiseOf(0.30) + praiseOf(0.40) + praiseOf(0.55) + '[' + praiseOf(0.7) + ']');

  // --- 「ポン」より前のタップは無視 ---
  fresh(3);
  Game.advanceTo(CFG.readyT + 0.1);   // ジャンの途中
  check('ジャンの間は道具のタップを無視', Game.phase === 'call' && Game.tapItem('hammer', Game.time) === false && Game.pItem === null);
  Game.advanceTo(CFG.readyT + CFG.janT + 0.1);
  check('ケンの間も道具のタップを無視', Game.phase === 'call' && Game.callText === 'ケン' && Game.tapItem('helmet', Game.time) === false && Game.pItem === null);
  check('手を選ぶのは「ケン」の間もできる（選び直せる）', Game.selectHand(1, Game.time) === true && Game.chosen === 1 && Game.selectHand(2, Game.time) === true && Game.chosen === 2);
  const t0 = CFG.readyT, ponAt = t0 + CFG.janT + CFG.kenT;
  Game.advanceTo(ponAt - 0.001);
  check('ポンの直前まではまだ道具を取れない', Game.phase === 'call' && Game.tapItem('hammer', ponAt - 0.001) === false);
  Game.advanceTo(ponAt + 0.001);
  check('合図は ジャン' + CFG.janT + '秒 → ケン' + CFG.kenT + '秒 → ポン、ポンで選んだ手（パー）が出る', Math.abs(Game.ponT - ponAt) < 1e-9 && Game.pHand === 2 && (Game.phase === 'grab' || Game.phase === 'draw'), 'ponT=' + Game.ponT.toFixed(3) + ' pHand=' + Game.pHand);
  check('ポンの後は手を選び直せない', Game.selectHand(0, Game.time) === false);

  // --- 手を選ばなかったら前回と同じ手（最初はグー）---
  function toNextPon(hand) {
    const before = Game.hist.length;
    for (let n = 0; n < 50; n++) {
      if (Game.phase === 'call' && Game.chosen == null && hand != null) Game.selectHand(hand, Game.time);
      Game.advanceTo(Game.endT);
      if (Game.hist.length !== before) return;
    }
  }
  fresh(5);
  Game.pickCpuHand = function () { return 2; };            // 相手はパー固定
  toNextPon(null);
  check('手を選ばず「ポン」→ 最初はグー（罰なし）', Game.pHand === 0 && Game.defaulted === true && Game.rps === 'lose', 'pHand=' + Game.pHand);
  Game.tapItem('helmet', Game.ponT + 0.1);
  toNextPon(1);                                              // チョキを選ぶ
  check('手を選ぶとその手が出て、「前回の手」になる', Game.pHand === 1 && Game.defaulted === false && Game.lastHand === 1, 'pHand=' + Game.pHand);
  Game.tapItem('hammer', Game.ponT + 0.1);                  // チョキ vs パー＝勝ち
  toNextPon(null);
  check('手を選ばなければ前回と同じ手（チョキ）', Game.pHand === 1 && Game.defaulted === true, 'pHand=' + Game.pHand + ' phase=' + Game.phase);
  Game.pickCpuHand = ORIG_PICK;

  // --- あいこ：選び直し・道具は取れない・短い合図 ---
  fresh(7);
  Game.pickCpuHand = function () { return 1; };             // 相手はチョキ固定
  Game.advanceTo(CFG.readyT); Game.selectHand(1, Game.time);   // 自分もチョキ → あいこ
  Game.advanceTo(CFG.readyT + CFG.janT + CFG.kenT + 0.001);
  check('同じ手ならあいこ（道具の取り合いにならない）', Game.phase === 'draw' && Game.rps === 'draw' && Game.cItem === null, Game.phase);
  check('あいこの間は道具を取れない', Game.tapItem('hammer', Game.time + 0.01) === false && Game.outcome === '');
  const dEnd = Game.endT;
  Game.advanceTo(dEnd + 0.001);
  check('あいこのあとは「あいこで」の短い合図で、手を選び直せる', Game.phase === 'call' && Game.aiko === true && Game.callText === 'あいこで' && Game.selectHand(0, Game.time) === true && Game.chosen === 0, Game.phase + ' ' + Game.callText);
  check('あいこの合図はジャン＋ケンより短い', CFG.aikoCall < CFG.janT + CFG.kenT, CFG.aikoCall + ' < ' + (CFG.janT + CFG.kenT));
  check('「あいこで」の間も道具は取れない', Game.tapItem('hammer', Game.time) === false);
  const aEnd = Game.endT;
  Game.advanceTo(aEnd + 0.001);
  check('「しょ」で選び直した手（グー）が出る → グー vs チョキ＝勝ち、取り合いへ', Game.callText === 'しょ' && Game.pHand === 0 && Game.rps === 'win' && Game.phase === 'grab', Game.callText + ' pHand=' + Game.pHand + ' ' + Game.phase);
  check('あいこは本数に入らず、1 回戦の回数も増えない', Game.score.p === 0 && Game.score.c === 0);
  // あいこで選ばなかったら、あいこになった手（前回）と同じ
  fresh(8);
  Game.pickCpuHand = function () { return 1; };
  Game.advanceTo(CFG.readyT); Game.selectHand(1, Game.time);
  Game.advanceTo(CFG.readyT + CFG.janT + CFG.kenT + 0.001);   // あいこ
  Game.advanceTo(Game.endT); Game.advanceTo(Game.endT);       // あいこで → しょ（選ばない）
  check('あいこで選ばなければ前回と同じ手（チョキ）→ またあいこ', Game.pHand === 1 && Game.defaulted === true && Game.phase === 'draw', 'pHand=' + Game.pHand + ' ' + Game.phase);
  Game.pickCpuHand = ORIG_PICK;

  // --- 試合：2 本先取で終わる ---
  fresh(9);
  let guard = 0;
  while (Game.mode === 'match' && guard++ < 200) {
    if (Game.phase === 'call' && Game.chosen == null) Game.selectHand(0, Game.time);
    if (Game.phase === 'grab' && !Game.pItem) Game.tapItem(Game.rps === 'win' ? 'hammer' : 'helmet', Game.ponT + 0.3);
    Game.advanceTo(Game.endT);
  }
  check('2 本先取で試合が終わり、結果の画面（over）になる', Game.mode === 'over' && Game.matchResult === 'win' && Game.score.p === CFG.winPoints, 'mode=' + Game.mode + ' score=' + Game.score.p + '-' + Game.score.c);
  check('最速の反応が記録される（0.30 秒）', Game.fastest != null && Math.abs(Game.fastest - 0.3) < 1e-9, String(Game.fastest));
  check('試合が終わると道具のタップは無視', Game.tapItem('hammer', Game.time + 1) === false);

  // ---------- 3. ボットで 200 試合 ----------
  head('3. ボットで試合（相手 1：近所の小学生）');
  function playMatch(bot, seed) {
    Game.reset(seed); Game.begin(0);
    const brng = mulberry32(seed * 7919 + 13);
    let n = 0;
    while (Game.mode === 'match' && n++ < 2000) {
      if (Game.phase === 'call' && Game.chosen == null) Game.selectHand(Math.floor(brng() * 3), Game.time);
      if (Game.phase === 'grab' && !Game.pItem) {
        const item = bot.item(Game.rps);
        if (item) {
          const react = Math.max(0.15, bot.react + (brng() + brng() + brng() - 1.5) * bot.jitter);
          Game.tapItem(item, Game.ponT + react);
        }
      }
      Game.advanceTo(Game.endT);
    }
    Game.events.length = 0;
    return { win: Game.matchResult === 'win', over: Game.mode === 'over', score: Game.score };
  }
  const N = 200;
  const bots = {
    always03: { name: 'いつもハンマー（0.3 秒で即）', item: () => 'hammer', react: 0.3, jitter: 0.05 },
    judge05: { name: '正しく判断（0.5 秒）', item: rps => rps === 'win' ? 'hammer' : 'helmet', react: 0.5, jitter: 0.1 },
    judge07: { name: '正しく判断（0.7 秒）', item: rps => rps === 'win' ? 'hammer' : 'helmet', react: 0.7, jitter: 0.1 },
    judge12: { name: '正しく判断（1.2 秒）', item: rps => rps === 'win' ? 'hammer' : 'helmet', react: 1.2, jitter: 0.1 },
    none: { name: '何も取らない', item: () => null, react: 0, jitter: 0 }
  };
  const rate = {};
  for (const k in bots) {
    let w = 0, ok = 0;
    for (let s = 1; s <= N; s++) { const r = playMatch(bots[k], s); if (r.win) w++; if (r.over) ok++; }
    rate[k] = w / N;
    info(bots[k].name + '：' + w + ' / ' + N + ' 勝（勝率 ' + (w / N * 100).toFixed(1) + '%）' + (ok === N ? '' : '  ※終わらない試合あり ' + (N - ok)));
    if (ok !== N) check('全試合が終わる（' + k + '）', false);
  }
  check('いつもハンマー（0.3 秒）は確実には勝てない（勝率 70% 未満。ジャンケンの勝ち負けで運任せ）', rate.always03 < 0.7, (rate.always03 * 100).toFixed(1) + '%');
  check('いつもハンマーより、正しく判断する 0.5 秒のボットのほうがずっと勝つ（勝率 90% 以上）', rate.judge05 >= 0.9 && rate.judge05 > rate.always03 + 0.3, (rate.judge05 * 100).toFixed(1) + '% vs ' + (rate.always03 * 100).toFixed(1) + '%');
  check('正しく判断する 0.7 秒のボットも勝つことが多い（勝率 70% 以上）', rate.judge07 >= 0.7, (rate.judge07 * 100).toFixed(1) + '%');
  check('正しく判断しても 1.2 秒では遅くて、ほとんど負ける（勝率 20% 未満）', rate.judge12 < 0.2, (rate.judge12 * 100).toFixed(1) + '%');
  check('何も取らないボットはほとんど負ける（勝率 20% 未満）', rate.none < 0.2, (rate.none * 100).toFixed(1) + '%');

  // --- 同じシードで同じ試合になる ---
  const sig = s => { playMatch(bots.judge07, s); return Game.score.p + '-' + Game.score.c + '/' + Game.hist.map(h => h.p + '' + h.c).join(','); };
  check('同じシードなら同じ試合になる（再現できる）', sig(42) === sig(42) && sig(42) !== sig(43), sig(42));

  // 相手の手のクセ：グーが多い（Phase 2 の下準備）
  Game.reset(11); Game.begin(0);
  let goo = 0; const M = 3000;
  for (let i = 0; i < M; i++) if (Game.pickCpuHand() === 0) goo++;
  const expect = CFG.opps[0].habit.s + (1 - CFG.opps[0].habit.s) / 3;
  info('相手 1 のグーの割合：' + (goo / M * 100).toFixed(1) + '%（期待 ' + (expect * 100).toFixed(1) + '%）');
  check('相手 1 はグーを多く出す（クセの強さどおり ±4%）', Math.abs(goo / M - expect) < 0.04);

  // 相手の反応の分布
  Game.reset(12); Game.begin(0);
  let sum = 0, mn = 9, mx = 0, mis = 0; const K = 3000;
  for (let i = 0; i < K; i++) { Game.pon(0); sum += Game.cReact; mn = Math.min(mn, Game.cReact); mx = Math.max(mx, Game.cReact); if (Game.cMistake) mis++; }
  info('相手 1 の反応：平均 ' + (sum / K).toFixed(2) + ' 秒（最速 ' + mn.toFixed(2) + '・最遅 ' + mx.toFixed(2) + '）、取り違え ' + (mis / K * 100).toFixed(1) + '%');
  check('相手 1 の反応の平均は設定の ' + CFG.opps[0].mean + ' 秒に近い（±0.03）', Math.abs(sum / K - CFG.opps[0].mean) < 0.03);
  check('相手 1 は反応にばらつきがあり、タイムアウトより前に必ず動く', mx - mn > 0.3 && mx < CFG.grabTimeout);

  const sum2 = document.createElement('h2');
  sum2.id = 'summary';
  sum2.textContent = fail === 0 ? 'RESULT: ALL PASS（' + total + ' 件）' : 'RESULT: FAIL（' + fail + ' / ' + total + ' 件 NG）';
  sum2.className = fail === 0 ? 'ok' : 'ng';
  out.appendChild(sum2);
  window.__verifyFail = fail;
})();
