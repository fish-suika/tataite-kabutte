// ===== 自動テスト（画面なし。時刻を渡して 1 回ずつ・ボットで勝ち抜き戦を回す）=====
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
  const pct = x => (x * 100).toFixed(1) + '%';

  // ---------- 1. 判定表（resolveRound）の全部の行 ----------
  head('1. 判定表');
  const TO = CFG.grabTimeout;
  const R = (rps, pItem, pT, cItem, cT) => resolveRound(rps, pItem, pT, cItem, cT, TO);
  function row(name, r, type, point) {
    check(name, r.type === type && r.point === point, '→ ' + r.type + '/' + r.point + '（期待 ' + type + '/' + point + '）');
  }
  row('勝ち＋ハンマー（相手がヘルメットを被るより速い）→ 自分の 1 本', R('win', 'hammer', 0.5, 'helmet', 0.9), 'hit', 'p');
  row('勝ち＋ハンマー（相手が先に被った）→ ガードされた・本数なし', R('win', 'hammer', 0.9, 'helmet', 0.5), 'guarded', null);
  row('勝ち＋ヘルメット → 間違い・本数なし', R('win', 'helmet', 0.5, 'helmet', 0.9), 'wrongHelmet', null);
  row('勝ち＋ハンマー（相手が負けたのにハンマーを取った・相手が先）→ 相手の反則で自分の 1 本', R('win', 'hammer', 0.9, 'hammer', 0.5), 'cpuFoul', 'p');
  row('勝ち＋ハンマー（相手が負けたのにハンマー・自分が先）→ 自分の 1 本', R('win', 'hammer', 0.4, 'hammer', 0.6), 'hit', 'p');
  row('勝ち＋何も取らない・相手が正しく被る → 時間切れで何もなし', R('win', null, null, 'helmet', 0.9), 'nothing', null);
  row('勝ち＋何も取らない・相手が負けたのにハンマー → 相手の反則で自分の 1 本', R('win', null, null, 'hammer', 0.9), 'cpuFoul', 'p');
  row('負け＋ヘルメット（相手が叩くより速い）→ ガード成功・本数なし', R('lose', 'helmet', 0.5, 'hammer', 0.9), 'guard', null);
  row('負け＋ヘルメット（相手が先に叩いた）→ 相手の 1 本', R('lose', 'helmet', 0.9, 'hammer', 0.5), 'cpuHit', 'c');
  row('負け＋ハンマー → 反則・相手の 1 本', R('lose', 'hammer', 0.3, 'hammer', 0.9), 'foul', 'c');
  row('負け＋ハンマー（相手が先に叩いていた）→ 相手の 1 本', R('lose', 'hammer', 0.9, 'hammer', 0.5), 'cpuHit', 'c');
  row('負け＋ハンマー（相手が取り違えてヘルメット）→ 反則・相手の 1 本', R('lose', 'hammer', 0.3, 'helmet', 0.9), 'foul', 'c');
  row('負け＋ヘルメット（相手が取り違えてヘルメット）→ 本数なし', R('lose', 'helmet', 1.2, 'helmet', 0.5), 'guard', null);
  row('負け＋何も取らない → 相手が叩く・相手の 1 本', R('lose', null, null, 'hammer', 1.2), 'cpuHit', 'c');
  row('負け＋何も取らない・相手が取り違えても時間切れで叩かれる', R('lose', null, null, 'helmet', 0.7), 'cpuHit', 'c');
  const rto = R('lose', null, null, 'helmet', 0.7);
  check('時間切れの決着は ' + TO + ' 秒', rto.at === TO, 'at=' + rto.at);
  row('同時刻（勝ち＋ハンマー vs 相手ヘルメット）→ 守る側が勝つ（ガードされた）', R('win', 'hammer', 0.6, 'helmet', 0.6), 'guarded', null);
  row('同時刻（負け＋ヘルメット vs 相手ハンマー）→ 守る側が勝つ（ガード成功）', R('lose', 'helmet', 0.6, 'hammer', 0.6), 'guard', null);

  // ---------- 2. 流れ（手を選んで始まる合図・タップ）----------
  head('2. 流れ（手を選ぶのを待つ → ジャン・ケン・ポン → 取り合い）');
  function fresh(seed) { Game.reset(seed || 1); Game.begin(0); }
  // 「ポン」まで進めて取り合いの状態にする（あいこなら選び直して進める）。強制的に手と相手の動きを決める
  function toGrab(o) {
    o = o || {};
    fresh(o.seed);
    if (o.cHand != null) Game.pickCpuHand = function () { ORIG_PICK.call(this); return o.cHand; };
    for (let n = 0; n < 30 && Game.phase !== 'grab'; n++) {
      if (Game.phase === 'wait') Game.selectHand(o.pHand != null ? o.pHand : 0, Game.time);
      else Game.advanceTo(Game.endT);
    }
    Game.pickCpuHand = ORIG_PICK;
    if (o.rps) Game.rps = o.rps;
    if (o.cItem) Game.cItem = o.cItem;
    if (o.cReact != null) Game.cReact = o.cReact;
    return Game.phase === 'grab';
  }
  function playRow(rps, which, react, cItem, cReact) {
    // 自分グー(0)、相手 チョキ(1)=勝ち / パー(2)=負け
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
  check('流れ：負けて何も取らないと叩かれる（相手の反応の時刻に決着）', r && r.outcome === 'cpuHit' && Math.abs(Game.resolveT - Game.ponT - 0.9) < 0.001, JSON.stringify(r));
  r = playRow('lose', null, 0, 'helmet', 0.9);
  check('流れ：負けて何も取らず相手も取り違え → ' + TO + ' 秒で叩かれる', r && r.outcome === 'cpuHit' && Math.abs(Game.resolveT - Game.ponT - TO) < 0.001, JSON.stringify(r));
  r = playRow('win', null, 0, 'helmet', 0.9);
  check('流れ：勝って何も取らなければ何もなし、スコア 0-0', r && r.outcome === 'nothing' && r.score.p === 0 && r.score.c === 0, JSON.stringify(r));
  r = playRow('win', null, 0, 'hammer', 0.7);
  check('流れ：相手が負けたのにハンマーを取ると相手の反則で自分の 1 本', r && r.outcome === 'cpuFoul' && r.score.p === 1, JSON.stringify(r));
  toGrab({ pHand: 0, cHand: 1, cItem: 'helmet', cReact: 0.6 }); Game.tapItem('hammer', Game.ponT + 0.6);
  check('流れ：同時刻（ハンマー vs 相手のヘルメット）はガードされる', Game.outcome === 'guarded', Game.outcome);
  toGrab({ pHand: 0, cHand: 2, cItem: 'hammer', cReact: 0.6 }); Game.tapItem('helmet', Game.ponT + 0.6);
  check('流れ：同時刻（ヘルメット vs 相手のハンマー）はガード成功', Game.outcome === 'guard', Game.outcome);

  toGrab({ pHand: 0, cHand: 1 });
  check('「ポン」の直後は勝ち負けの文字なし（実況が空・結果が未決）', Game.comm === '' && Game.outcome === '' && Game.pHand === 0 && Game.cHand === 1, 'comm="' + Game.comm + '"');
  Game.tapItem('hammer', Game.ponT + 0.55);
  check('道具を取った後に結果の実況が出る', Game.comm === COMM.hit, Game.comm);
  check('反応の秒数が記録される（0.55 秒）と、ほめ言葉は「速い」', Math.abs(Game.pReact - 0.55) < 1e-9 && Game.pPraise === '速い', Game.pReact + ' ' + Game.pPraise);
  check('ほめ言葉のしきい値（人間の速さ：0.45 神速 / 0.60 速い / 0.80 いいね / 0.90 なし）', praiseOf(0.45) === '神速' && praiseOf(0.55) === '速い' && praiseOf(0.60) === '速い' && praiseOf(0.75) === 'いいね' && praiseOf(0.80) === 'いいね' && praiseOf(0.90) === '', '');
  check('人間の目安（良い人 0.60 / ふつう 0.75 / ゆっくり 0.90 秒）が「速い」「いいね」「なし」に分かれる', praiseOf(0.60) === '速い' && praiseOf(0.75) === 'いいね' && praiseOf(0.90) === '');

  // --- 手を選ぶまで待つ。選んだ瞬間から「ジャン」が始まる ---
  fresh(3);
  Game.advanceTo(CFG.readyT);
  check('最初の間のあと、手を選ぶのを待つ状態（wait）になる', Game.phase === 'wait' && Game.endT === Infinity && Game.chosen == null, Game.phase);
  Game.events.length = 0;
  Game.advanceTo(CFG.readyT + 120);
  check('手を選ばないかぎり 120 秒たっても待ち続ける（ジャンもポンも始まらない・時間切れなし）', Game.phase === 'wait' && Game.events.length === 0 && Game.pHand == null && Game.score.c === 0, Game.phase);
  check('待っている間は道具のタップを無視', Game.tapItem('hammer', Game.time) === false && Game.tapItem('helmet', Game.time + 1) === false && Game.pItem === null);
  const tSel = Game.time + 0.5;
  check('手をタップすると「ジャン」が始まる', Game.selectHand(1, tSel) === true && Game.phase === 'call' && Game.callText === 'ジャン' && Game.chosen === 1 && Math.abs(Game.phaseT0 - tSel) < 1e-9, Game.phase + ' ' + Game.callText);
  check('ジャンの間も道具は取れない', Game.tapItem('hammer', Game.time + 0.1) === false);
  Game.advanceTo(tSel + CFG.janT + 0.05);
  check('0.4 秒後に「ケン」', Game.phase === 'call' && Game.callText === 'ケン', Game.callText);
  check('ケンの間も道具は取れない', Game.tapItem('helmet', Game.time) === false && Game.pItem === null);
  check('ケンの間は手を選び直せる（選び直しても合図は進み続ける）', Game.selectHand(2, Game.time) === true && Game.chosen === 2 && Game.phase === 'call' && Game.callText === 'ケン');
  const ponAt = tSel + CFG.janT + CFG.kenT;
  Game.advanceTo(ponAt - 0.001);
  check('ポンの直前まではまだ道具を取れない', Game.phase === 'call' && Game.tapItem('hammer', ponAt - 0.001) === false);
  Game.advanceTo(ponAt + 0.001);
  check('ジャン' + CFG.janT + '秒 → ケン' + CFG.kenT + '秒 → ポン。ポンで最後に選んだ手（パー）が出る', Math.abs(Game.ponT - ponAt) < 1e-9 && Game.pHand === 2 && (Game.phase === 'grab' || Game.phase === 'draw'), 'ponT=' + Game.ponT.toFixed(3) + ' pHand=' + Game.pHand);
  check('ポンの後は手を選び直せない', Game.selectHand(0, Game.time) === false);

  // --- 前回の手へのデフォルトはない。手を選ばずに「ポン」にはならない ---
  fresh(4);
  Game.advanceTo(30);
  check('手を選ばずに「ポン」になることはない（デフォルトの手はなし）', Game.phase === 'wait' && Game.hist.length === 0);

  // --- 次の回：結果のあとに手を選べる（前もって選んでもよい）---
  toGrab({ pHand: 0, cHand: 1 });
  Game.tapItem('hammer', Game.ponT + 0.3);                  // 勝ち：1 本
  Game.advanceTo(Game.endT);                                // 結果の表示が終わる → ready
  check('1 回のあとは少しの間（ready）のあと、また手を選ぶのを待つ', Game.phase === 'ready' && Game.chosen == null && Game.pHand == null);
  Game.selectHand(1, Game.time + 0.1);
  check('次の回の前の間に前もって手を選べる（まだジャンは始まらない）', Game.phase === 'ready' && Game.chosen === 1);
  Game.advanceTo(Game.endT);
  check('前もって選んでいたら、間が終わった瞬間に「ジャン」が始まる', Game.phase === 'call' && Game.callText === 'ジャン' && Game.chosen === 1, Game.phase);

  // --- あいこ：選び直しを待つ・道具は取れない・短い合図 ---
  fresh(7);
  Game.pickCpuHand = function () { return 1; };             // 相手はチョキ固定
  Game.advanceTo(CFG.readyT); Game.selectHand(1, Game.time);   // 自分もチョキ → あいこ
  Game.advanceTo(Game.endT); Game.advanceTo(Game.endT);
  check('同じ手ならあいこ（道具の取り合いにならない）', Game.phase === 'draw' && Game.rps === 'draw' && Game.cItem === null, Game.phase);
  check('あいこの間は道具を取れない', Game.tapItem('hammer', Game.time + 0.01) === false && Game.outcome === '');
  Game.advanceTo(Game.endT);
  check('あいこの手を見せたあと、手を選び直すのを待つ（時間制限なし）', Game.phase === 'wait' && Game.aiko === true && Game.endT === Infinity, Game.phase);
  Game.advanceTo(Game.time + 60);
  check('あいこの待ちも 60 秒たっても進まない', Game.phase === 'wait' && Game.chosen == null);
  const tA = Game.time + 0.2;
  check('手を選ぶと「あいこで」が始まる（短い合図）', Game.selectHand(0, tA) === true && Game.phase === 'call' && Game.callText === 'あいこで' && Math.abs(Game.endT - (tA + CFG.aikoCall)) < 1e-9, Game.phase + ' ' + Game.callText);
  check('あいこの合図はジャン＋ケンより短い', CFG.aikoCall < CFG.janT + CFG.kenT, CFG.aikoCall + ' < ' + (CFG.janT + CFG.kenT));
  check('「あいこで」の間も道具は取れない', Game.tapItem('hammer', Game.time) === false);
  Game.advanceTo(Game.endT + 0.0001);
  check('「しょ」で選んだ手（グー）が出る → グー vs チョキ＝勝ち、取り合いへ', Game.callText === 'しょ' && Game.pHand === 0 && Game.rps === 'win' && Game.phase === 'grab', Game.callText + ' pHand=' + Game.pHand + ' ' + Game.phase);
  check('あいこは本数に入らない', Game.score.p === 0 && Game.score.c === 0);
  Game.pickCpuHand = ORIG_PICK;

  // ---------- 3. 勝ち抜き戦の進み方 ----------
  head('3. 勝ち抜き戦');
  // 完璧なボットで進める（0.3 秒で正しい道具）
  function perfectStep(react) {
    if (Game.phase === 'wait') Game.selectHand(0, Game.time);
    else if (Game.phase === 'grab' && !Game.pItem) Game.tapItem(Game.rps === 'win' ? 'hammer' : 'helmet', Game.ponT + react);
    else Game.advanceTo(Game.endT);
  }
  fresh(9);
  let g1 = 0;
  while (Game.oppIdx === 0 && Game.mode === 'match' && g1++ < 500) perfectStep(0.3);
  check('1 回戦に 2 本先取で勝つと、2 回戦（学級委員長）が始まる（終わらない）', Game.mode === 'match' && Game.oppIdx === 1 && Game.opp.name === CFG.opps[1].name && Game.phase === 'ready', 'oppIdx=' + Game.oppIdx + ' phase=' + Game.phase + ' mode=' + Game.mode);
  check('次の相手ではスコアと手の記録がリセットされ、実況は「2回戦、はじめ」', Game.score.p === 0 && Game.score.c === 0 && Game.hist.length === 0 && Game.comm === '2回戦、はじめ', Game.comm);
  check('最速の反応は勝ち抜き戦を通して持ち越される（0.30 秒）', Game.fastest != null && Math.abs(Game.fastest - 0.3) < 1e-9 && Game.stats.hits >= 2, String(Game.fastest) + ' hits=' + Game.stats.hits);
  check('回戦の名前：1〜4 回戦と決勝', roundLabel(0) === '1回戦' && roundLabel(3) === '4回戦' && roundLabel(4) === '決勝' && CFG.opps.length === 5);
  let g2 = 0;
  while (Game.mode === 'match' && g2++ < 3000) perfectStep(0.3);
  check('0.3 秒の完璧なボットは 5 人抜いて優勝（over / champion）', Game.mode === 'over' && Game.tourney === 'champion' && Game.oppIdx === 4 && Game.score.p === CFG.winPoints, 'mode=' + Game.mode + ' tourney=' + Game.tourney + ' oppIdx=' + Game.oppIdx);
  check('優勝のあとは道具のタップを無視', Game.tapItem('hammer', Game.time + 1) === false);
  // 負けたら終わり
  fresh(10);
  let g3 = 0;
  while (Game.mode === 'match' && g3++ < 500) {
    if (Game.phase === 'wait') Game.selectHand(0, Game.time);
    else if (Game.phase === 'grab' && !Game.pItem) Game.tapItem('hammer', Game.ponT + 0.1);   // いつもハンマー（負けると反則）
    else Game.advanceTo(Game.endT);
  }
  check('負けたら終わり（over / out）。何回戦で負けたかが oppIdx に残る', Game.mode === 'over' && Game.tourney === 'out' && Game.matchResult === 'lose' && Game.score.c === CFG.winPoints, 'oppIdx=' + Game.oppIdx + ' tourney=' + Game.tourney);

  // ---------- 4. 相手のクセ ----------
  head('4. 相手のクセ（1000 回出して割合を確かめる）');
  const rngP = mulberry32(777);
  function throws(oppIdx, n, playerFn) {
    Game.reset(100 + oppIdx); Game.begin(0);
    Game.opp = CFG.opps[oppIdx]; Game.hist = [];
    const res = { n, habit: 0, hab: 0, win: 0, lose: 0, draw: 0, cnt: [0, 0, 0] };
    for (let i = 0; i < n; i++) {
      const exp = habitHandOf(Game.opp, Game.hist);
      const c = Game.pickCpuHand();
      res.cnt[c]++;
      if (exp != null) { res.habit++; if (c === exp) res.hab++; }
      const p = playerFn(exp);
      const rr = rpsOf(p, c);
      res[rr]++;
      Game.hist.push({ p, c });
    }
    return res;
  }
  const randHand = () => Math.floor(rngP() * 3);
  for (let i = 0; i < CFG.opps.length; i++) {
    const o = CFG.opps[i], hb = o.habit;
    const res = throws(i, 1000, randHand);
    if (hb.type === 'none') {
      const mx = Math.max(...res.cnt) / 1000, mn = Math.min(...res.cnt) / 1000;
      info(o.name + '（ばらばら）：グー ' + pct(res.cnt[0] / 1000) + ' / チョキ ' + pct(res.cnt[1] / 1000) + ' / パー ' + pct(res.cnt[2] / 1000));
      check(o.name + 'はばらばら（どの手も 28〜39%）', mn > 0.28 && mx < 0.39, pct(mn) + '〜' + pct(mx));
    } else {
      const expect = hb.s + (1 - hb.s) / 3, got = res.hab / res.habit;
      info(o.name + '（' + hb.type + '）：クセの手が出た割合 ' + pct(got) + '（期待 ' + pct(expect) + '、' + res.habit + ' 回中）');
      check(o.name + 'のクセの手は 1000 回で約 ' + pct(expect) + '（±5%）出る', Math.abs(got - expect) < 0.05 && expect >= 0.6 && expect <= 0.72, pct(got));
    }
  }
  // クセを読むボット vs ランダムのボット（ジャンケンだけの勝率。あいこは除く）
  for (let i = 0; i < CFG.opps.length; i++) {
    const o = CFG.opps[i];
    const rd = throws(i, 3000, exp => exp != null ? winHand(exp) : randHand());
    const rn = throws(i, 3000, randHand);
    const wr = rd.win / (rd.win + rd.lose), wn = rn.win / (rn.win + rn.lose);
    info(o.name + '：クセを読む ' + pct(wr) + ' / ランダム ' + pct(wn) + '（あいこを除いた勝率）');
    if (o.habit.type === 'none') check(o.name + 'はクセがない：読んでもランダムと同じ（差 5% 未満）', Math.abs(wr - wn) < 0.05, pct(wr) + ' vs ' + pct(wn));
    else check(o.name + 'のクセを読むと、ランダムよりジャンケンに勝ちやすい（+15% 以上）', wr > wn + 0.15 && Math.abs(wn - 0.5) < 0.04, pct(wr) + ' vs ' + pct(wn));
  }
  // 相手の反応の分布
  for (let i = 0; i < CFG.opps.length; i++) {
    const o = CFG.opps[i];
    Game.reset(200 + i); Game.begin(0); Game.opp = o;
    let sum = 0, mn = 9, mx = 0, mis = 0; const K = 3000;
    for (let k = 0; k < K; k++) { Game.hist = []; Game.pon(0); sum += Game.cReact; mn = Math.min(mn, Game.cReact); mx = Math.max(mx, Game.cReact); if (Game.cMistake) mis++; }
    info(o.name + '：反応 平均 ' + (sum / K).toFixed(2) + ' 秒（' + mn.toFixed(2) + '〜' + mx.toFixed(2) + '）、取り違え ' + pct(mis / K));
    check(o.name + 'の反応の平均は設定の ' + o.mean + ' 秒に近く（下限で切るぶん少し遅くなる）、ばらつきがあり、タイムアウトより前に動く', sum / K >= o.mean - 0.03 && sum / K < o.mean + 0.10 && mx - mn > 0.25 && mx < CFG.grabTimeout, '');
    check(o.name + 'は人間を超えて速くならない（下限 ' + o.min + ' 秒 ≥ 0.40 秒、実際の最速も 0.40 秒以上）', o.min >= 0.40 && mn >= 0.40 - 1e-9, 'min=' + mn.toFixed(3));
  }
  const meanOrder = CFG.opps.map(o => o.mean);
  check('回戦が進むほど相手は速い（反応の平均が小さくなっていく）。決勝がいちばん速い', meanOrder.every((v, i) => i === 0 || v < meanOrder[i - 1]) && meanOrder[4] === Math.min(...meanOrder), meanOrder.join(' > '));
  const minOrder = CFG.opps.map(o => o.min);
  check('下限も回戦が進むほど小さくなる（速い回が出やすくなる）', minOrder.every((v, i) => i === 0 || v <= minOrder[i - 1]), minOrder.join(' >= '));

  // ---------- 5. ボットで勝ち抜き戦 ----------
  head('5. 人間モデルのボットで勝ち抜き戦');
  // 人間モデル：反応 = 正規分布（平均 mean・標準偏差 sd）を min（0.35 秒）以上に切ったもの。mis の確率で道具を取り違える
  function playTournament(bot, seed) {
    Game.reset(seed); Game.begin(0);
    const brng = mulberry32(seed * 7919 + 13);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - brng())) * Math.cos(2 * Math.PI * brng());
    let n = 0;
    while (Game.mode === 'match' && n++ < 20000) {
      if (Game.phase === 'wait') {
        let h = null;
        if (bot.read) { const e = habitHandOf(Game.opp, Game.hist); if (e != null) h = winHand(e); }
        if (h == null) h = Math.floor(brng() * 3);
        Game.selectHand(h, Game.time);
      } else if (Game.phase === 'grab' && !Game.pItem) {
        let item = bot.item ? bot.item(Game.rps) : (Game.rps === 'win' ? 'hammer' : 'helmet');
        if (!bot.item && brng() < bot.mis) item = item === 'hammer' ? 'helmet' : 'hammer';   // 勝ち負けを見誤る
        const react = Math.max(bot.min, bot.mean + gauss() * bot.sd);
        Game.tapItem(item, Game.ponT + react);
      } else Game.advanceTo(Game.endT);
    }
    Game.events.length = 0;
    return { champ: Game.tourney === 'champion', out: Game.oppIdx, over: Game.mode === 'over' };
  }
  const bots = {
    good:  { name: '速い人（0.60 秒・ばらつき 0.10・見誤り 3%）＋クセを読む', read: true,  mean: 0.60, sd: 0.10, mis: 0.03, min: 0.35 },
    avg:   { name: 'ふつうの人（0.75 秒・ばらつき 0.12・見誤り 5%）＋クセを読む', read: true,  mean: 0.75, sd: 0.12, mis: 0.05, min: 0.35 },
    slow:  { name: 'ゆっくりな人（0.90 秒・ばらつき 0.15・見誤り 7%）＋クセを読む', read: true,  mean: 0.90, sd: 0.15, mis: 0.07, min: 0.35 },
    avgR:  { name: 'ふつうの人（0.75 秒）・クセを読まない（手はランダム）', read: false, mean: 0.75, sd: 0.12, mis: 0.05, min: 0.35 },
    ham03: { name: 'いつもハンマー 0.3 秒・手はランダム', read: false, item: () => 'hammer', mean: 0.30, sd: 0.05, min: 0.15 },
    hamRead: { name: 'いつもハンマー 0.3 秒＋クセを読む', read: true, item: () => 'hammer', mean: 0.30, sd: 0.05, min: 0.15 }
  };
  const N = 500, tour = {}, firstWin = {}, early = {};
  for (const k in bots) {
    const dist = [0, 0, 0, 0, 0]; let ch = 0, ok = 0;
    for (let s = 1; s <= N; s++) {
      const rr = playTournament(bots[k], s);
      if (rr.over) ok++;
      if (rr.champ) ch++; else dist[rr.out]++;
    }
    tour[k] = ch / N; firstWin[k] = 1 - dist[0] / N; early[k] = (dist[0] + dist[1]) / N;
    info(bots[k].name + '：優勝 ' + ch + ' / ' + N + '（' + pct(ch / N) + '）　敗退 1回戦 ' + dist[0] + ' / 2回戦 ' + dist[1] + ' / 3回戦 ' + dist[2] + ' / 4回戦 ' + dist[3] + ' / 決勝 ' + dist[4]);
    if (ok !== N) check('全部の勝ち抜き戦が終わる（' + k + '）', false);
  }
  check('速い人（0.60 秒＋読み）は半分以上〜7 割ほど優勝する（50〜75%）', tour.good >= 0.50 && tour.good <= 0.75, pct(tour.good));
  check('ふつうの人（0.75 秒＋読み）は 2〜4 割優勝する（20〜35%）', tour.avg >= 0.20 && tour.avg <= 0.35, pct(tour.avg));
  check('ふつうの人は、たいてい 3 回戦以降まで進む（1・2 回戦での敗退が 2 割未満）', early.avg < 0.20, '1・2 回戦敗退 ' + pct(early.avg));
  check('ゆっくりな人（0.90 秒＋読み）は 1 回戦を 7 割以上勝ち上がる', firstWin.slow >= 0.70, pct(firstWin.slow));
  check('ゆっくりな人の優勝はまれ（10% 以下）', tour.slow <= 0.10, pct(tour.slow));
  check('速さに意味がある（速い人 > ふつうの人 > ゆっくりな人）', tour.good > tour.avg + 0.2 && tour.avg > tour.slow + 0.1, pct(tour.good) + ' > ' + pct(tour.avg) + ' > ' + pct(tour.slow));
  check('クセを読むことに意味がある（ふつうの人：読む 優勝率が読まないの 3 倍以上）', tour.avg >= tour.avgR * 3 && tour.avg > tour.avgR + 0.10, pct(tour.avg) + ' vs ' + pct(tour.avgR));
  check('いつもハンマー（手はランダム）のボットはほぼ優勝できない（5% 未満）', tour.ham03 < 0.05, pct(tour.ham03));
  check('クセを読むだけのいつもハンマーも、速い人より優勝しにくい（判断に意味がある）', tour.hamRead < tour.good, pct(tour.hamRead) + ' < ' + pct(tour.good));

  // 同じシードで同じ勝ち抜き戦になる
  const sig = s => { playTournament(bots.avg, s); return Game.oppIdx + '/' + Game.score.p + '-' + Game.score.c + '/' + Game.hist.map(h => h.p + '' + h.c).join(','); };
  check('同じシードなら同じ勝ち抜き戦になる（再現できる）', sig(42) === sig(42) && sig(42) !== sig(43), sig(42));

  const sum2 = document.createElement('h2');
  sum2.id = 'summary';
  sum2.textContent = fail === 0 ? 'RESULT: ALL PASS（' + total + ' 件）' : 'RESULT: FAIL（' + fail + ' / ' + total + ' 件 NG）';
  sum2.className = fail === 0 ? 'ok' : 'ng';
  out.appendChild(sum2);
  window.__verifyFail = fail;
})();
