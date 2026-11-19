// ===== 効果音（WebAudio で合成。音声ファイルなし・BGMなし）=====
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
  function tone(f, dur, o) {
    if (!ac) return;
    o = o || {};
    const t0 = now() + (o.delay || 0);
    const osc = ac.createOscillator(), gn = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f * o.slide), t0 + dur);
    const v = o.vol == null ? 0.4 : o.vol;
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(v, t0 + 0.006);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gn); gn.connect(master);
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
    const gn = ac.createGain(); gn.gain.setValueAtTime(o.vol || 0.3, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl); fl.connect(gn); gn.connect(master);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  }
  return {
    init,
    // 合図：ジャン・ケン（同じ高さ）→ ポン（高い）
    call(idx, aiko) { const f = aiko ? 740 : 660; tone(f, 0.12, { type: 'triangle', vol: 0.4 }); },
    pon() { tone(990, 0.2, { type: 'triangle', vol: 0.5 }); tone(1980, 0.12, { type: 'sine', vol: 0.16 }); },
    select(h) { tone([523, 659, 784][h] || 600, 0.08, { type: 'square', vol: 0.12 }); },
    tapItem() { noise(0.04, { f: 2200, q: 2, vol: 0.2 }); },
    draw() { tone(330, 0.16, { type: 'sine', vol: 0.3 }); tone(330, 0.16, { type: 'sine', vol: 0.3, delay: 0.14 }); },
    // 叩いた「ピコッ」
    pico(big) {
      tone(900, 0.09, { type: 'square', vol: 0.3, slide: 0.55 });
      tone(1500, 0.07, { type: 'sine', vol: 0.3, delay: 0.05, slide: 1.4 });
      if (big) noise(0.08, { f: 1800, q: 1.5, vol: 0.2, delay: 0.02 });
    },
    // 叩かれた
    pico2() { tone(500, 0.12, { type: 'square', vol: 0.34, slide: 0.4 }); noise(0.12, { f: 600, vol: 0.34 }); tone(110, 0.2, { type: 'sine', vol: 0.4, slide: 0.5 }); },
    // ガード「コン」
    guard() { tone(420, 0.1, { type: 'triangle', vol: 0.55, slide: 0.7 }); noise(0.03, { f: 3500, q: 3, vol: 0.3 }); },
    // 反則（ブー）
    foul() { tone(130, 0.5, { type: 'sawtooth', vol: 0.3 }); tone(138, 0.5, { type: 'sawtooth', vol: 0.25 }); },
    whiff() { tone(300, 0.2, { type: 'sine', vol: 0.3, slide: 0.6 }); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.4, delay: i * 0.1 })); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.4, delay: i * 0.16 })); }
  };
})();
