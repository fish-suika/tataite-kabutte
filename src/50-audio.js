// ===== 効果音（WebAudio で合成。音声ファイルなし・BGMなし。「ジャン・ケン・ポン」の拍がそのまま音楽）=====
const Snd = (() => {
  let ac = null, master = null, noiseBuf = null;
  function init() {
    if (!ac) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 6;
        master = ac.createGain(); master.gain.value = 0.55;
        master.connect(comp); comp.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (_) { ac = null; return; }
    }
    if (ac.state === 'suspended') ac.resume();
  }
  const now = () => ac.currentTime;
  // 音の高さが動く 1 音。o: type / vol / delay / slide（終わりの周波数の倍率）/ attack / lp（ローパス）/ vib（ビブラート）
  function tone(f, dur, o) {
    if (!ac) return;
    o = o || {};
    const t0 = now() + (o.delay || 0);
    const osc = ac.createOscillator(), gn = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f * o.slide), t0 + dur);
    const v = o.vol == null ? 0.4 : o.vol, at = o.attack || 0.006;
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(v, t0 + at);
    if (o.hold) gn.gain.setValueAtTime(v, t0 + o.hold);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let out = osc;
    if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; osc.connect(fl); out = fl; }
    if (o.vib) { const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = o.vib; lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t0); lfo.stop(t0 + dur + 0.03); }
    out.connect(gn); gn.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  function noise(dur, o) {
    if (!ac) return;
    o = o || {};
    const t0 = now() + (o.delay || 0);
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = o.type || 'bandpass';
    fl.frequency.setValueAtTime(o.f || 1200, t0); fl.Q.value = o.q || 1;
    if (o.sweep) fl.frequency.exponentialRampToValueAtTime(o.sweep, t0 + dur);
    const gn = ac.createGain();
    if (o.swell) { gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(o.vol || 0.3, t0 + dur * o.swell); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); }
    else { gn.gain.setValueAtTime(o.vol || 0.3, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); }
    src.connect(fl); fl.connect(gn); gn.connect(master);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  }
  const NOTE = { c5: 523.25, d5: 587.33, e5: 659.25, f5: 698.46, g5: 783.99, a5: 880, b5: 987.77, c6: 1046.5, e6: 1318.5, g6: 1568 };
  return {
    init,
    // 合図：ジャン（低め）→ ケン（中）→ ポン（高い・明るい）。あいこで／しょ は少し高い
    call(idx, aiko) {
      const f = aiko ? 587 : (idx === 0 ? 440 : 523);
      tone(f, 0.16, { type: 'triangle', vol: 0.42 }); tone(f * 2, 0.08, { type: 'sine', vol: 0.12 });
      noise(0.03, { f: 2500, q: 2, vol: 0.12 });
    },
    pon(aiko) {
      tone(aiko ? 1175 : 988, 0.24, { type: 'triangle', vol: 0.5 }); tone(1480, 0.2, { type: 'sine', vol: 0.2 }); tone(1976, 0.12, { type: 'sine', vol: 0.12 });
      noise(0.05, { f: 3000, q: 1.5, vol: 0.2 });
    },
    // 手を選ぶ：形ごとに高さが違う（グー 低・チョキ 中・パー 高）ぽちっ
    select(h) {
      const f = [392, 523, 698][h] || 500;
      tone(f, 0.09, { type: 'square', vol: 0.12, lp: 2600 }); tone(f * 1.5, 0.07, { type: 'sine', vol: 0.12, delay: 0.03 });
    },
    tapItem() { tone(180, 0.07, { type: 'sine', vol: 0.3, slide: 0.6 }); noise(0.04, { f: 2200, q: 2, vol: 0.18 }); },
    draw() { tone(330, 0.16, { type: 'sine', vol: 0.3 }); tone(330, 0.16, { type: 'sine', vol: 0.3, delay: 0.14 }); },
    // 叩いた「ピコッ」：ゴムの空気がぬける高い音
    pico(big) {
      tone(700, 0.05, { type: 'square', vol: 0.22, slide: 2.1, lp: 3000 });
      tone(1500, 0.11, { type: 'square', vol: 0.26, delay: 0.05, slide: 0.55, lp: 3500 });
      tone(2200, 0.06, { type: 'sine', vol: 0.12, delay: 0.05 });
      noise(0.06, { f: 1800, q: 1.5, vol: 0.18, delay: 0.02 });
      if (big) tone(260, 0.12, { type: 'sine', vol: 0.3, slide: 0.5 });
    },
    // 叩かれた：どすっ＋ぴこっ
    pico2() {
      tone(500, 0.12, { type: 'square', vol: 0.34, slide: 0.4, lp: 2500 }); noise(0.14, { f: 600, vol: 0.4 });
      tone(110, 0.28, { type: 'sine', vol: 0.5, slide: 0.45 }); tone(1300, 0.08, { type: 'square', vol: 0.2, delay: 0.03, slide: 0.6 });
    },
    // ガード「コン」：硬いものにぽこっ
    guard() {
      tone(420, 0.11, { type: 'triangle', vol: 0.6, slide: 0.7 }); tone(1180, 0.2, { type: 'sine', vol: 0.18, slide: 0.9 });
      noise(0.03, { f: 3500, q: 3, vol: 0.3 });
    },
    // 反則のブザー「ブー」
    foul() {
      tone(150, 0.6, { type: 'sawtooth', vol: 0.3, hold: 0.45, lp: 1500 }); tone(157, 0.6, { type: 'sawtooth', vol: 0.26, hold: 0.45, lp: 1500 });
      tone(75, 0.6, { type: 'square', vol: 0.16, hold: 0.45 });
    },
    whiff() { tone(300, 0.2, { type: 'sine', vol: 0.3, slide: 0.6 }); },
    // 会場のどよめき「ざわ…ざわ…」
    murmur() {
      for (let i = 0; i < 4; i++) {
        noise(0.34, { f: 380 + (i % 2) * 90, q: 0.9, vol: 0.2, swell: 0.4, delay: i * 0.24 });
        noise(0.3, { f: 900 + i * 60, q: 1.2, vol: 0.1, swell: 0.5, delay: i * 0.24 + 0.05 });
      }
      tone(190, 0.7, { type: 'sawtooth', vol: 0.05, lp: 500, vib: 5, attack: 0.15 });
      tone(240, 0.7, { type: 'sawtooth', vol: 0.04, lp: 500, vib: 4, attack: 0.2, delay: 0.1 });
    },
    // 拍手と歓声
    cheer(big) {
      noise(big ? 1.1 : 0.55, { f: 1700, q: 0.7, vol: big ? 0.3 : 0.18, swell: 0.3 });
      const n = big ? 26 : 10;
      for (let i = 0; i < n; i++) noise(0.025, { f: 2500 + Math.random() * 2500, q: 2, vol: 0.12, delay: Math.random() * (big ? 1.0 : 0.5) });
    },
    // 回戦に勝ったときの短いファンファーレ
    win() {
      [[NOTE.c5, 0], [NOTE.e5, 0.09], [NOTE.g5, 0.18], [NOTE.c6, 0.27]].forEach(([f, d]) => { tone(f, 0.22, { type: 'sawtooth', vol: 0.16, delay: d, lp: 2800 }); tone(f, 0.22, { type: 'triangle', vol: 0.22, delay: d }); });
    },
    // 優勝のファンファーレ「パパパパーン」
    fanfare() {
      const seq = [[NOTE.c5, 0, 0.12], [NOTE.c5, 0.14, 0.12], [NOTE.c5, 0.28, 0.12], [NOTE.e5, 0.42, 0.34], [NOTE.d5, 0.8, 0.12], [NOTE.e5, 0.94, 0.12], [NOTE.g5, 1.12, 0.9]];
      for (const [f, d, du] of seq) {
        tone(f, du, { type: 'sawtooth', vol: 0.2, delay: d, lp: 2600, attack: 0.012 });
        tone(f * 2, du, { type: 'square', vol: 0.06, delay: d, lp: 3000 });
        tone(f / 2, du, { type: 'triangle', vol: 0.2, delay: d });
      }
      [NOTE.c5, NOTE.e5, NOTE.g5, NOTE.c6].forEach(f => tone(f, 1.0, { type: 'sawtooth', vol: 0.08, delay: 1.12, lp: 2400 }));
      this.cheer(true);
    },
    // 敗退：ワーワーと下がるトロンボーン
    lose() {
      [[392, 0], [349, 0.32], [330, 0.64]].forEach(([f, d]) => tone(f, 0.3, { type: 'sawtooth', vol: 0.2, delay: d, lp: 1200, slide: 0.92, vib: 7 }));
      tone(262, 0.9, { type: 'sawtooth', vol: 0.22, delay: 0.96, lp: 1100, slide: 0.7, vib: 6, attack: 0.04 });
    },
    // 星になって飛んでいく「ひゅーん」
    zoom() { tone(400, 0.9, { type: 'sine', vol: 0.25, slide: 6, attack: 0.04 }); tone(800, 0.9, { type: 'triangle', vol: 0.1, slide: 5, attack: 0.04 }); },
    // めり込む「ずぼっ」
    sink() { tone(260, 0.3, { type: 'sine', vol: 0.4, slide: 0.3 }); noise(0.25, { f: 400, vol: 0.3, sweep: 120 }); },
    twinkle() { [1568, 2093, 2637].forEach((f, i) => tone(f, 0.25, { type: 'sine', vol: 0.12, delay: i * 0.08 })); }
  };
})();
