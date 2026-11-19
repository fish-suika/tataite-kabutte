// ===== 演出：相手のやられ方（回戦ごとに大げさに）・叩かれる動き・星 =====
let CP = null;   // いまの相手のポーズ（1 フレームに 1 回計算）

function flyPos(v) {   // 最終戦：左上へ飛んでいく
  return { dx: -(40 * v + 120 * v * v), dy: -(70 * v + 120 * v * v) };
}

function hitPose(P, u, lvl, final) {
  if (u > 1.5) { P.mood = 'normal'; if (lvl >= 4 && final) P.hide = true; return; }
  P.mood = 'dizzy';
  const amp = 1 + lvl * 0.18;
  const sq = u < 0.09 ? u / 0.09 : Math.max(0, 1 - (u - 0.09) / 0.32);
  P.kx = 1 + 0.2 * sq * amp; P.ky = 1 - 0.25 * sq * amp; P.dy += 3 * sq * amp;
  P.rot = Math.sin(u * (13 + lvl * 2)) * 0.17 * Math.exp(-u * 1.5);
  P.spin = u * (9 + lvl * 4);
  P.stars = u > 0.08 ? 3 + lvl * 2 : 0;
  P.lump = lvl >= 1 ? 1 : 0;
  if (lvl === 1) P.dy -= Math.abs(Math.sin(u * 9)) * 6 * Math.exp(-u * 2.2);
  if (lvl === 2 || lvl === 3) {
    const depth = lvl === 2 ? 17 : 27;
    let s = easeOut((u - 0.06) / 0.13);
    if (u > 1.05) s *= 1 - clamp((u - 1.05) / 0.3, 0, 1);       // ひょっこり戻る
    P.dy += depth * s; P.sink = s > 0.01; P.sinkAmt = s;
    P.stars = u > 0.2 && u < 1.2 ? 4 + lvl * 2 : 0;
  }
  if (lvl >= 4) {
    if (final) {
      const v = clamp((u - 0.12) / 0.93, 0, 1);
      if (u > 0.12) {
        const p = flyPos(v);
        P.dx += p.dx; P.dy += p.dy; P.rot = u * 16; P.scale = 1 - 0.5 * v; P.stars = 0; P.trail = v;
        if (v >= 1) P.hide = true;
      }
    } else {
      const v = clamp((u - 0.1) / 0.95, 0, 1);
      if (u > 0.1) { P.dy -= 40 * Math.sin(Math.PI * v) * (1 - v * 0.2); P.dx += 8 * Math.sin(Math.PI * v); P.rot = (1 - v) * u * 11; P.scale = 1 + 0.12 * Math.sin(Math.PI * v); }
      if (v >= 1) { const q = clamp((u - 1.05) / 0.2, 0, 1); P.ky -= 0.2 * (1 - q); P.kx += 0.2 * (1 - q); }
      P.stars = 8;
    }
  }
}

function cpuPose(nowT) {
  const P = { dx: 0, dy: Math.sin(nowT * 2.6) * 0.5, rot: 0, kx: 1, ky: 1, scale: 1, sink: false, sinkAmt: 0, mood: 'normal', stars: 0, lump: 0, spin: null, hide: false, trail: 0 };
  if (Game.mode === 'match' && Game.phase === 'call') { const b = Math.abs(Math.sin((nowT - Game.phaseT0) * 7.5)); P.dy -= b * 1.8; P.rot = Math.sin((nowT - Game.phaseT0) * 7.5) * 0.04; }
  const iu = nowT - VS.introT;
  if (iu >= 0 && iu < 0.6) { const e = easeOut(iu / 0.6); P.dx += (1 - e) * 75; P.dy -= Math.abs(Math.sin(iu * 15)) * (1 - e) * 5; }
  const f = VS.cpu;
  if (f) {
    const u = nowT - f.t0;
    if (u >= 0) {
      switch (f.kind) {
        case 'hit': hitPose(P, u, f.lvl, f.final); break;
        case 'smug': if (u < 1.3) { P.mood = 'smug'; P.dy -= 1.4; P.ky += 0.03; P.rot = Math.sin(u * 8) * 0.03; } break;
        case 'confused': if (u < 1.5) { P.mood = 'confused'; P.rot = Math.sin(u * 5) * 0.06; P.dy += Math.sin(u * 3) * 0.5; } break;
        case 'nervous': if (u < 1.2) { P.mood = 'nervous'; P.dx += Math.sin(u * 45) * 0.45; } break;
      }
    }
  }
  return P;
}

// 床の穴・ひび（めり込んだとき）
function drawStageFx(nowT) {
  CP = cpuPose(nowT);
  const f = LAY.face;
  if (CP.sinkAmt > 0.01) {
    const a = CP.sinkAmt, fy = LAY.floorY + 0.6, f0 = VS.cpu;
    g.globalAlpha = Math.min(1, a * 1.6);
    lEllAbs(f.x, fy, 14 + 5 * a, 3.2, '#4a2a14', '#8f5a2c', 0.8);
    // ひび（3 回戦以降は大きく）
    const n = 6, len = 10 + (f0 && f0.lvl >= 3 ? 14 : 4) * a;
    g.strokeStyle = '#5a3418'; g.lineWidth = 0.7 * S; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const ang = Math.PI * (0.06 + i * 0.176), r0 = 15 + 5 * a;
      g.beginPath(); g.moveTo(sx(f.x + Math.cos(ang) * r0 * 1.1 - (ang > 1.57 ? 0 : 0)), sy(fy - Math.sin(ang) * 3.2 * 0.0 + (i % 2 ? 0.5 : 1.2)));
      g.lineTo(sx(f.x + Math.cos(ang) * (r0 + len * 0.5)), sy(fy + 1 + Math.abs(Math.sin(ang * 3)) * 2.2 + (i % 2) * 1.5));
      g.lineTo(sx(f.x + Math.cos(ang) * (r0 + len)), sy(fy + 0.8 + (i % 3) * 1.6));
      g.stroke();
    }
    g.globalAlpha = 1;
  }
}
function lEllAbs(x, y, rx, ry, fill, stroke, lw) {
  g.beginPath(); g.ellipse(sx(x), sy(y), rx * S, ry * S, 0, 0, 6.2832);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw * S; g.stroke(); }
}

function drawOpponent(nowT) {
  const P = CP || cpuPose(nowT), f = LAY.face, idx = Math.min(Game.oppIdx, CFG.opps.length - 1);
  if (P.hide) return;
  const v = view();
  // 最終戦：飛んでいく途中の星のしっぽ
  if (P.trail > 0) {
    for (let j = 1; j <= 5; j++) {
      const vv = P.trail - j * 0.07; if (vv < 0) break;
      const p = flyPos(vv);
      g.globalAlpha = 0.9 - j * 0.15;
      star(f.x + p.dx, f.y + p.dy, 3.4 - j * 0.35, '#ffe066', nowT * 6 + j, '#c98a00');
    }
    g.globalAlpha = 1;
  }
  g.save();
  if (P.sink) { g.beginPath(); g.rect(sx(v.x0 - 300), sy(v.y0 - 300), (v.x1 - v.x0 + 600) * S, (LAY.floorY - (v.y0 - 300)) * S); g.clip(); }
  const R = f.r * P.scale;
  T(f.x + P.dx, f.y + P.dy, R * P.kx, P.rot, R * P.ky);
  drawChar(idx, P.mood, nowT, { spin: P.spin });
  // 相手が取った道具
  const act = Game.mode === 'match' && (Game.phase === 'grab' || Game.phase === 'result' || Game.phase === 'over');
  if (act && Game.cpuDone && Game.cItem === 'helmet') {
    const drop = clamp(1 - (nowT - (Game.ponT + Game.cReact)) / 0.12, 0, 1);
    g.save(); g.translate(0, -1.04 - drop * 1.4); g.scale(1.2, 1.2); drawHelmetShape(); g.restore();
  } else if (act && Game.cpuDone && Game.cItem === 'hammer' && !VS.slam) {
    g.save(); g.translate(1.9, 1.5); g.rotate(0.45); g.scale(1.1, 1.1); drawHammerShape(); g.restore();
  }
  if (P.lump) { lEll(-0.62, -0.78, 0.3, 0.27, '#ff9d8a', OL, 0.06); lEll(-0.7, -0.86, 0.09, 0.06, 'rgba(255,255,255,0.7)'); }
  U();
  // 頭の上をまわる星
  if (P.stars > 0) {
    const hx = f.x + P.dx, hy = f.y + P.dy - f.r * P.scale * 1.15;
    for (let i = 0; i < P.stars; i++) {
      const a = nowT * 6 + i * 6.2832 / P.stars, rx = f.r * (1.0 + P.stars * 0.03);
      const spd = Math.sin(a);
      star(hx + Math.cos(a) * rx, hy + spd * 3, 1.9 + (spd > 0 ? 0.5 : 0), '#ffe066', nowT * 3 + i, '#c98a00');
    }
  }
  g.restore();
}

// 相手の道具が自分に来る動き（叩かれる・ガード）
function drawSlam(nowT) {
  const s = VS.slam; if (!s) return;
  const u = nowT - s.t0;
  if (u < 0 || u > 0.75) return;
  const lvl = s.lvl, guard = s.kind === 'guard';
  const kk = easeOut(u / 0.11);
  const kmax = guard ? 12 : 17 + lvl * 2.2;
  const k = lerp(7, kmax, kk) * (u > 0.11 ? 1 - Math.min(0.12, (u - 0.11) * 0.3) : 1);
  const headY = guard ? 33 : 90 - lvl * 1.5;                 // 頭の中心がたどり着く高さ
  const gy = lerp(14, headY - 3 * kmax, kk) + (guard && u > 0.11 ? -clamp((u - 0.11) / 0.2, 0, 1) * 14 : 0);
  const gx = lerp(64, 50, kk);
  let rot = lerp(3.14 + 0.55, 3.14, kk) + (guard && u > 0.11 ? clamp((u - 0.11) / 0.2, 0, 1) * 0.5 : 0);
  const alpha = u > 0.3 ? clamp(1 - (u - 0.3) / 0.2, 0, 1) : 1;
  g.globalAlpha = alpha;
  T(gx, gy, k, rot); drawHammerShape(); U();
  // 当たった瞬間のぎざぎざ
  if (u > 0.1 && u < 0.4) {
    const q = (u - 0.1) / 0.3, cx = 50, cy = headY + (guard ? 0 : 6), n = 8 + lvl * 3, R0 = 12 + lvl * 2;
    g.globalAlpha = (1 - q) * alpha;
    g.strokeStyle = guard ? '#9bd0ff' : '#fff'; g.lineWidth = (0.9 + lvl * 0.15) * S; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.2832 + 0.2, r0 = R0 * (0.8 + q * 0.6), r1 = R0 * (1.4 + q * 1.3 + (i % 2) * 0.5 + lvl * 0.15);
      g.beginPath(); g.moveTo(sx(cx + Math.cos(a) * r0), sy(cy + Math.sin(a) * r0 * 0.8)); g.lineTo(sx(cx + Math.cos(a) * r1), sy(cy + Math.sin(a) * r1 * 0.8)); g.stroke();
    }
  }
  g.globalAlpha = 1;
}

// 最終戦で相手が星になった
function drawSkyStar(nowT) {
  if (!VS.starSky) return;
  const u = nowT - VS.starT;
  if (u < 0) return;
  const pop = u < 0.3 ? easeOut(u / 0.3) * 1.25 - 0.25 * easeOut(u / 0.3) : 1;
  const tw = 1 + Math.sin(nowT * 5) * 0.08;
  const x = 22, y = 38;
  // きらきら
  for (let i = 0; i < 4; i++) {
    const a = nowT * 1.5 + i * 1.57, r = 9 + Math.sin(nowT * 4 + i) * 1.5;
    g.globalAlpha = 0.5 + 0.5 * Math.sin(nowT * 6 + i * 2);
    star(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r, 1.4, '#fff7b0', 0);
  }
  g.globalAlpha = 1;
  T(x, y, 7.6 * pop * tw, Math.sin(nowT * 2) * 0.12);
  lStar(0, 0, 1, '#ffd23f', 0, '#c98a00', 0.1);
  lEll(-0.27, -0.05, 0.1, 0.13, '#3a2a1a'); lEll(0.27, -0.05, 0.1, 0.13, '#3a2a1a');
  lArc(0, 0.12, 0.26, 0.25, Math.PI - 0.25, '#8a3a2a', 0.07);
  lEll(-0.5, 0.2, 0.13, 0.08, 'rgba(255,100,100,0.5)'); lEll(0.5, 0.2, 0.13, 0.08, 'rgba(255,100,100,0.5)');
  U();
}
