// ===== ゲームのロジック（画面を使わない。時刻は秒で明示的に渡す）=====
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 手：0 グー・1 チョキ・2 パー（グー＞チョキ＞パー＞グー）
const HAND_NAME = ['グー', 'チョキ', 'パー'];
const HAND_ICON = ['✊', '✌️', '✋'];
// a から見た b との勝ち負け
function rpsOf(a, b) {
  if (a === b) return 'draw';
  return ((b - a + 3) % 3 === 1) ? 'win' : 'lose';
}
// 反応の秒数 → ほめ言葉（なければ ''）
function praiseOf(sec) {
  for (const [lim, word] of CFG.praise) if (sec <= lim) return word;
  return '';
}

// 実況の一言
const COMM = {
  hit: '決まった！', guarded: 'ガード！', wrongHelmet: 'あれ？被っちゃった',
  cpuHit: '叩かれた！', guard: 'ナイスガード！', foul: '反則！', cpuFoul: '相手の反則！', nothing: '…様子見'
};

// 1 回の決着を決める純粋な関数（表の全部の行がここ）。時刻はすべて「ポン」からの秒数。
//   rps: 自分から見た 'win' | 'lose'
//   pItem: 自分が最初に取った道具 'hammer' | 'helmet' | null（取らなかった）、pT: その時刻
//   cItem / cT: 相手が取る道具と時刻（「ポン」の時点で決めておく）
// 返り値 { type, point('p' 自分 | 'c' 相手 | null), at }
//   type: hit 叩いた / guarded ガードされた / wrongHelmet 勝ったのに被った / cpuHit 叩かれた /
//         guard ガード成功 / foul 反則（負けたのにハンマー）/ cpuFoul 相手の反則 / nothing 何もなし
// 同時刻は守る側（ヘルメット）を優先する。
function resolveRound(rps, pItem, pT, cItem, cT, timeout) {
  // 相手が自分だけで決める出来事（相手がハンマーを取ったとき）
  let auto = null;
  if (cItem === 'hammer') {
    auto = rps === 'lose' ? { type: 'cpuHit', point: 'c', at: cT } : { type: 'cpuFoul', point: 'p', at: cT };
  }
  // 自分の出来事
  let pe = null;
  if (pItem === 'hammer') {
    if (rps === 'lose') pe = { type: 'foul', point: 'c', at: pT };
    else if (cItem === 'helmet' && cT <= pT) pe = { type: 'guarded', point: null, at: pT };
    else pe = { type: 'hit', point: 'p', at: pT };
  } else if (pItem === 'helmet') {
    if (rps === 'win') pe = { type: 'wrongHelmet', point: null, at: pT };
    else pe = { type: 'guard', point: null, at: pT };
  }
  if (pe && auto) {
    // 早い方。同時刻は自分（ヘルメットのガード）を先にする
    return auto.at < pe.at ? auto : pe;
  }
  if (pe) return pe;
  if (auto) return auto;
  // どちらも取らないまま時間切れ
  return rps === 'lose' ? { type: 'cpuHit', point: 'c', at: timeout, timeout: true } : { type: 'nothing', point: null, at: timeout, timeout: true };
}

// a に勝つ手
const winHand = h => (h + 2) % 3;
// 回戦の名前（最後は決勝）
function roundLabel(i) { return i === CFG.opps.length - 1 ? '決勝' : (i + 1) + '回戦'; }

// 相手のクセが「いま出したがっている手」（クセを読んだときの答え）。なければ null
//   goo: いつもグー寄り / loser: 前回負けた手に勝つ手 / repeat: 同じ手を続ける
//   counter: こちらの前回の手に勝つ手 / none: ばらばら
// hist は直前までの手の記録 [{ p: 自分の手, c: 相手の手 }]（この相手との試合の中だけ）
function habitHandOf(opp, hist) {
  const hb = opp.habit;
  if (!hb) return null;
  const last = hist[hist.length - 1];
  switch (hb.type) {
    case 'goo': return 0;
    case 'repeat': return last ? last.c : null;
    case 'loser': {
      if (!last) return null;
      const r = rpsOf(last.p, last.c);
      if (r === 'draw') return null;
      return winHand(r === 'win' ? last.c : last.p);
    }
    case 'counter': return last ? winHand(last.p) : null;
    default: return null;
  }
}

const Game = {
  mode: 'title',        // title → match（勝ち抜き戦の全体）→ over
  phase: '',            // ready → wait（手を選ぶのを待つ）→ call → grab → result → ready … / あいこ: draw → wait …
  time: 0, endT: 0, phaseT0: 0,
  seed: 1, rand: null,
  events: [],

  reset(seed) {
    this.seed = seed == null ? (Date.now() & 0xffffff) : seed;
    this.rand = mulberry32(this.seed);
    this.mode = 'title'; this.phase = ''; this.time = 0; this.endT = 0; this.phaseT0 = 0;
    this.oppIdx = 0; this.opp = CFG.opps[0];
    this.score = { p: 0, c: 0 };
    this.matchResult = '';         // いまの相手との試合：'win' | 'lose'
    this.tourney = '';             // 勝ち抜き戦の結果：'champion' | 'out'
    this.comm = '';
    this.hist = [];                // この相手との試合で出した手の記録 { p, c }
    this.fastest = null;           // 通しての最速（正しい道具を取ったときだけ）
    this.stats = { hits: 0, fouls: 0, guards: 0, wrong: 0 };
    this.clearRound();
    this.events = [];
  },

  clearRound() {
    this.aiko = false; this.callIdx = 0; this.callText = '';
    this.chosen = null;
    this.pHand = null; this.cHand = null; this.rps = '';
    this.ponT = 0; this.cpuDone = false;
    this.cItem = null; this.cReact = 0; this.cMistake = false;
    this.pItem = null; this.pReact = null; this.pCorrect = false; this.pPraise = '';
    this.outcome = ''; this.point = null; this.resolveT = 0;
  },

  emit(e) { e.t = this.time; this.events.push(e); },
  enter(phase, t, dur) { this.phase = phase; this.phaseT0 = t; this.endT = t + dur; },

  // タイトルのタップ。すぐ 1 回戦が始まる
  begin(t) {
    if (this.mode !== 'title') return false;
    this.time = Math.max(this.time, t || 0);
    this.mode = 'match';
    this.oppIdx = 0;
    this.fastest = null;
    this.stats = { hits: 0, fouls: 0, guards: 0, wrong: 0 };
    this.tourney = '';
    this.beginOpp(this.time, CFG.readyT, 'start');
    return true;
  },

  // 相手との試合を始める（最初の相手も、次の相手もここ）
  beginOpp(t, dur, evType) {
    this.opp = CFG.opps[this.oppIdx];
    this.score = { p: 0, c: 0 };
    this.matchResult = '';
    this.hist = [];
    this.clearRound();
    this.comm = roundLabel(this.oppIdx) + '、はじめ';
    this.enter('ready', t, dur);
    this.emit({ type: evType, idx: this.oppIdx });
  },

  // 手を選ぶのを待つ（時間制限なし）。選んだ時刻から「ジャン」が始まる
  startWait(t) {
    this.phase = 'wait'; this.phaseT0 = t; this.endT = Infinity;
    this.emit({ type: 'wait', aiko: this.aiko });
  },

  startCall(t) {
    this.callIdx = 0;
    this.callText = this.aiko ? 'あいこで' : 'ジャン';
    this.enter('call', t, this.aiko ? CFG.aikoCall : CFG.janT);
    this.emit({ type: 'call', idx: 0, text: this.callText, aiko: this.aiko });
  },

  // 時刻 t まで進める。strict のときは t ちょうどの出来事は先に処理しない（同時は守る側が勝つため）
  advanceTo(t, strict) {
    if (!isFinite(t)) return;
    if (this.mode === 'match') {
      for (let guard = 0; guard < 1000; guard++) {
        let evT = this.endT, kind = 'phase';
        if (this.phase === 'grab' && !this.cpuDone) {
          const ct = this.ponT + this.cReact;
          if (ct <= evT) { evT = ct; kind = 'cpu'; }
        }
        if (strict ? evT >= t : evT > t) break;
        this.time = Math.max(this.time, evT);
        if (kind === 'cpu') this.cpuEvent(evT); else this.phaseEnd();
        if (this.mode !== 'match') break;
      }
    }
    this.time = Math.max(this.time, t);
  },

  phaseEnd() {
    const t = this.endT;
    switch (this.phase) {
      case 'ready':
        if (this.chosen != null) this.startCall(t);   // 前もって選んでいたらすぐ「ジャン」
        else this.startWait(t);
        break;
      case 'call':
        if (!this.aiko && this.callIdx === 0) {
          this.callIdx = 1; this.callText = 'ケン';
          this.enter('call', t, CFG.kenT);
          this.emit({ type: 'call', idx: 1, text: 'ケン', aiko: false });
        } else this.pon(t);
        break;
      case 'draw':
        this.clearRound(); this.aiko = true;
        this.startWait(t);
        break;
      case 'grab':   // 時間切れ
        if (!this.outcome) this.finish(resolveRound(this.rps, this.pItem, this.pReact, this.cItem, this.cReact, CFG.grabTimeout), t);
        break;
      case 'result':
        if (this.matchResult === 'win' && this.oppIdx < CFG.opps.length - 1) {
          this.oppIdx++;
          this.beginOpp(t, CFG.readyT + CFG.nextOppT, 'nextOpp');
        } else if (this.matchResult) {
          this.tourney = this.matchResult === 'win' ? 'champion' : 'out';
          this.mode = 'over'; this.phase = 'over';
          this.emit({ type: 'over', tourney: this.tourney });
        } else {
          this.clearRound();
          this.comm = '';
          this.enter('ready', t, CFG.gapT);
        }
        break;
    }
  },

  // 相手のジャンケンのクセ。クセの強さ s の確率でクセの手、外れたら気まぐれ（3 つから）
  pickCpuHand() {
    const r = this.rand;
    const a = r(), b = r();
    const h = habitHandOf(this.opp, this.hist);
    if (h != null && a < this.opp.habit.s) return h;
    return Math.floor(b * 3);
  },

  // 「ポン」（あいこのときは「しょ」）
  pon(t) {
    this.ponT = t;
    this.pHand = this.chosen != null ? this.chosen : 0;
    this.cHand = this.pickCpuHand();
    this.rps = rpsOf(this.pHand, this.cHand);
    this.hist.push({ p: this.pHand, c: this.cHand });
    this.callText = this.aiko ? 'しょ' : 'ポン';
    // 相手の反応は「ポン」の時点で決めておく
    const r = this.rand, o = this.opp;
    const z = (r() + r() + r() - 1.5) / 0.5;           // ほぼ正規分布（標準偏差 1）
    this.cReact = Math.round(clamp(o.mean + z * o.spread, o.min, CFG.grabTimeout - 0.1) * 1e6) / 1e6;
    this.cMistake = r() < o.mistake;
    this.cpuDone = false; this.pItem = null;
    this.emit({ type: 'pon', text: this.callText, aiko: this.aiko, pHand: this.pHand, cHand: this.cHand, rps: this.rps });
    if (this.rps === 'draw') {
      this.cItem = null;
      this.comm = 'あいこ';
      this.enter('draw', t, CFG.drawHold);
      this.emit({ type: 'draw' });
      return;
    }
    const cWins = this.rps === 'lose';                  // 相手が勝ったなら正解はハンマー
    this.cItem = (cWins !== this.cMistake) ? 'hammer' : 'helmet';
    this.comm = '';
    this.enter('grab', t, CFG.grabTimeout);
  },

  // 相手が道具を取る
  cpuEvent(t) {
    this.cpuDone = true;
    this.emit({ type: 'cpuTake', item: this.cItem, mistake: this.cMistake });
    if (this.cItem === 'hammer' && !this.outcome) {
      this.finish(resolveRound(this.rps, this.pItem, this.pReact, this.cItem, this.cReact, CFG.grabTimeout), t);
    }
  },

  // 手を選ぶ。待っているとき（wait）はここから「ジャン」が始まる。「ジャン」「ケン」の間は選び直せる。
  // 次の回の前の間（ready）に前もって選んでおくこともできる
  selectHand(h, t) {
    if (t != null) this.advanceTo(t, true);
    if (this.mode !== 'match') return false;
    if (this.phase === 'wait') {
      this.chosen = h;
      this.emit({ type: 'select', hand: h });
      this.startCall(Math.max(t == null ? this.time : t, this.time));
      return true;
    }
    if (this.phase === 'call' || this.phase === 'ready') {
      this.chosen = h;
      this.emit({ type: 'select', hand: h });
      return true;
    }
    return false;
  },

  // 道具をタップ（pointerdown の時刻 t で即判定）
  tapItem(which, t) {
    if (t == null) t = this.time;
    this.advanceTo(t, true);
    if (this.mode !== 'match' || this.phase !== 'grab' || this.pItem || this.outcome) return false;
    if (t < this.ponT) return false;                    // 「ポン」より前の分は無効
    const rel = Math.round((t - this.ponT) * 1e6) / 1e6;   // 浮動小数の誤差で同時刻がずれないように
    this.pItem = which; this.pReact = rel;
    this.pCorrect = (this.rps === 'win' && which === 'hammer') || (this.rps === 'lose' && which === 'helmet');
    this.pPraise = this.pCorrect ? praiseOf(rel) : '';
    if (this.pCorrect && (this.fastest == null || rel < this.fastest)) this.fastest = rel;
    this.emit({ type: 'tap', item: which, react: rel, correct: this.pCorrect, praise: this.pPraise });
    const r = resolveRound(this.rps, which, rel, this.cItem, this.cReact, CFG.grabTimeout);
    this.finish(r, this.ponT + r.at);
    return true;
  },

  finish(r, t) {
    this.time = Math.max(this.time, t);
    this.outcome = r.type; this.point = r.point; this.resolveT = t;
    if (r.point === 'p') this.score.p++;
    if (r.point === 'c') this.score.c++;
    if (r.type === 'hit') this.stats.hits++;
    if (r.type === 'foul') this.stats.fouls++;
    if (r.type === 'guard') this.stats.guards++;
    if (r.type === 'wrongHelmet') this.stats.wrong++;
    this.comm = COMM[r.type] || '';
    if (this.score.p >= CFG.winPoints) this.matchResult = 'win';
    else if (this.score.c >= CFG.winPoints) this.matchResult = 'lose';
    this.enter('result', t, CFG.resultHold);
    this.emit({ type: 'outcome', outcome: r.type, point: r.point, timeout: !!r.timeout, score: { p: this.score.p, c: this.score.c }, matchResult: this.matchResult, oppIdx: this.oppIdx });
  }
};
