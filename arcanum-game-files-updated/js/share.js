/* ============================================================
   SHARE RESULT — renders the completion modal as a canvas image,
   no backend required.
   ============================================================ */
function drawShareStar(ctx, cx, cy, r, lit) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * rad;
    const y = Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (lit) {
    const grad = ctx.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, '#fff5d6');
    grad.addColorStop(0.5, '#f4d27a');
    grad.addColorStop(1, '#a87a30');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(244,210,122,0.8)';
    ctx.shadowBlur = 18;
  } else {
    ctx.fillStyle = 'rgba(139,163,184,0.25)';
  }
  ctx.fill();
  ctx.restore();
}

function buildShareCard() {
  const canvas = document.getElementById('shareCanvas');
  const W = 640, H = 800;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background — echoes the game's cosmic gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a1620');
  bg.addColorStop(1, '#050d15');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const aurora = ctx.createRadialGradient(W * 0.25, H * 0.2, 0, W * 0.25, H * 0.2, W * 0.6);
  aurora.addColorStop(0, 'rgba(61,214,140,0.14)');
  aurora.addColorStop(1, 'rgba(61,214,140,0)');
  ctx.fillStyle = aurora;
  ctx.fillRect(0, 0, W, H);
  const aurora2 = ctx.createRadialGradient(W * 0.8, H * 0.75, 0, W * 0.8, H * 0.75, W * 0.6);
  aurora2.addColorStop(0, 'rgba(232,182,90,0.14)');
  aurora2.addColorStop(1, 'rgba(232,182,90,0)');
  ctx.fillStyle = aurora2;
  ctx.fillRect(0, 0, W, H);

  // Border frame
  ctx.strokeStyle = 'rgba(232,182,90,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  // Wordmark
  ctx.textAlign = 'center';
  ctx.font = '700 20px Cinzel, serif';
  ctx.fillStyle = '#8ba3b8';
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.font = '600 13px Outfit, sans-serif';
  ctx.fillStyle = '#8ba3b8';
  ctx.letterSpacing = '6px';
  ctx.fillText('A R C A N U M', W / 2, 78);
  ctx.restore();

  const goldGrad = ctx.createLinearGradient(0, 90, 0, 150);
  goldGrad.addColorStop(0, '#fff5d6');
  goldGrad.addColorStop(0.5, '#f4d27a');
  goldGrad.addColorStop(1, '#a87a30');
  ctx.fillStyle = goldGrad;
  ctx.font = '900 40px Cinzel, serif';
  const title = document.getElementById('modalTitle').textContent || 'Rite Complete';
  ctx.fillText(title, W / 2, 140);

  ctx.font = '400 15px Outfit, sans-serif';
  ctx.fillStyle = '#f5e6d3';
  const subtitle = document.getElementById('modalSubtitle').textContent || '';
  ctx.fillText(subtitle, W / 2, 168);

  // Stars
  const litCount = document.querySelectorAll('#starsContainer .star.lit').length;
  const hasStars = document.querySelectorAll('#starsContainer .star').length > 0;
  if (hasStars) {
    const starY = 240, spacing = 90;
    for (let i = 0; i < 3; i++) {
      drawShareStar(ctx, W / 2 + (i - 1) * spacing, starY, 34, i < litCount);
    }
  }

  // Stats row
  const stats = [
    { label: 'MOVES', value: document.getElementById('finalMoves').textContent },
    { label: 'TIME', value: document.getElementById('finalTime').textContent },
    { label: 'BEST STREAK', value: document.getElementById('finalStreak').textContent },
  ];
  const boxY = hasStars ? 320 : 260;
  const boxH = 130;
  ctx.fillStyle = 'rgba(10,22,32,0.6)';
  ctx.strokeStyle = 'rgba(232,182,90,0.22)';
  ctx.lineWidth = 1;
  roundRect(ctx, 60, boxY, W - 120, boxH, 14);
  ctx.fill();
  ctx.stroke();

  const colW = (W - 120) / 3;
  stats.forEach((s, i) => {
    const cx = 60 + colW * i + colW / 2;
    ctx.font = '700 30px Cinzel, serif';
    ctx.fillStyle = '#f4d27a';
    ctx.fillText(s.value, cx, boxY + 62);
    ctx.font = '600 11px Outfit, sans-serif';
    ctx.fillStyle = '#8ba3b8';
    ctx.fillText(s.label, cx, boxY + 90);
  });

  // Mode / difficulty / theme footer
  ctx.font = '500 13px Outfit, sans-serif';
  ctx.fillStyle = '#8ba3b8';
  const diffLabels = { apprentice: 'Initiate · 4×4', adept: 'Seeker · 6×4', master: 'Archmage · 6×6' };
  const modeLabels = { veil: 'Shifting Veil', classic: 'The Vigil', timed: "Chronomancer's Rite", hard: 'Umbral Trial', oracle: "Fate's Gambit", duel: 'Duel', aiduel: 'vs. The Sphinx', daily: 'Daily Rite', weekly: 'Weekly Rite' };
  const modeText = modeLabels[STATE.mode] || 'The Vigil';
  const effKey = effectiveDifficultyKey();
  const diffText = effKey === 'custom' && DIFFICULTIES.custom
    ? `Custom · ${DIFFICULTIES.custom.pairs} pairs`
    : (diffLabels[effKey] || '');
  ctx.fillText(`${modeText}${diffText ? ' · ' + diffText : ''}`, W / 2, boxY + boxH + 40);

  // Seal
  drawSealMark(ctx, W / 2, H - 90, 34);

  ctx.font = '400 11px Outfit, sans-serif';
  ctx.fillStyle = '#5c7186';
  ctx.fillText('Unveil the Sacred Sigils', W / 2, H - 34);

  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSealMark(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(232,182,90,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.globalAlpha = 0.6; ctx.stroke();
  ctx.globalAlpha = 1;
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, '#fff5d6');
  grad.addColorStop(0.5, '#e8b65a');
  grad.addColorStop(1, '#a87a30');
  ctx.fillStyle = grad;
  ctx.beginPath();
  const spikes = 8, outer = r * 0.55, inner = r * 0.22;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const angle = (i / (spikes * 2)) * Math.PI * 2;
    const x = Math.cos(angle) * rad, y = Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fillStyle = '#fff5d6'; ctx.fill();
  ctx.restore();
}

async function shareResultImage() {
  const canvas = buildShareCard();
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], 'arcanum-result.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'ARCANUM', text: 'My result in ARCANUM — Unveil the Sacred Sigils' });
        return;
      } catch(e) { /* fall through to download */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arcanum-result.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}

const shareBtn = document.getElementById('shareResultBtn');
if (shareBtn) shareBtn.addEventListener('click', shareResultImage);

/* ============================================================
   CHALLENGE LINK — "Beat my score": encodes a Daily/Weekly result
   into the URL so a friend opening it plays the same seed and sees
   how they compare. No backend — just query params.
   ============================================================ */
function buildChallengeLink() {
  const params = new URLSearchParams();
  params.set('challengeMode', STATE.mode);
  params.set('challengeMoves', STATE.moves);
  params.set('challengeTime', STATE.elapsedTime);
  params.set('challengeSeed', STATE.dailySeed || '');
  const url = `${location.origin}${location.pathname}?${params.toString()}`;
  return url;
}

async function copyChallengeLink() {
  const url = buildChallengeLink();
  try {
    await navigator.clipboard.writeText(url);
    queueAchievementToast({ icon: '⚔', title: 'Challenge Link Copied', name: 'Send it to a friend — same seed, same board' });
  } catch (e) {
    window.prompt('Copy this challenge link:', url);
  }
}

const challengeBtn = document.getElementById('challengeLinkBtn');
if (challengeBtn) challengeBtn.addEventListener('click', copyChallengeLink);

// On load: if the URL carries a challenge, remember it so the completion
// modal can show "beat their score" once this Daily/Weekly game ends.
function readChallengeFromURL() {
  const params = new URLSearchParams(location.search);
  if (!params.has('challengeMoves')) return null;
  return {
    mode: params.get('challengeMode'),
    moves: Number(params.get('challengeMoves')),
    time: Number(params.get('challengeTime')),
    seed: params.get('challengeSeed') || '',
  };
}
const INCOMING_CHALLENGE = readChallengeFromURL();

/* ============================================================
   CHRONICLE EXPORT — full stats page as a downloadable image
   ============================================================ */
function buildChronicleCard() {
  const canvas = document.getElementById('shareCanvas');
  const W = 640, H = 960;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a1620');
  bg.addColorStop(1, '#050d15');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(232,182,90,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  ctx.textAlign = 'center';
  ctx.save();
  ctx.font = '600 13px Outfit, sans-serif';
  ctx.fillStyle = '#8ba3b8';
  ctx.letterSpacing = '6px';
  ctx.fillText('A R C A N U M · C H R O N I C L E', W / 2, 66);
  ctx.restore();

  const level = (PROGRESS.prestige && PROGRESS.prestige.level) || 0;
  const goldGrad = ctx.createLinearGradient(0, 80, 0, 130);
  goldGrad.addColorStop(0, '#fff5d6');
  goldGrad.addColorStop(0.5, '#f4d27a');
  goldGrad.addColorStop(1, '#a87a30');
  ctx.fillStyle = goldGrad;
  ctx.font = '900 34px Cinzel, serif';
  ctx.fillText(prestigeTitle(level), W / 2, 122);

  const winRate = PROGRESS.gamesPlayed ? Math.round((PROGRESS.gamesWon / PROGRESS.gamesPlayed) * 100) : 0;
  const stats = [
    ['GAMES PLAYED', PROGRESS.gamesPlayed], ['GAMES WON', PROGRESS.gamesWon],
    ['WIN RATE', `${winRate}%`], ['BEST STREAK', PROGRESS.bestStreakEver],
    ['AETHER', PROGRESS.aether], ['ACHIEVEMENTS', `${PROGRESS.achievements.length}/${Object.keys(ACHIEVEMENTS).length}`],
  ];
  const gridY = 160, cellW = (W - 120) / 3, cellH = 90;
  stats.forEach(([label, value], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const cx = 60 + col * cellW + cellW / 2;
    const cy = gridY + row * cellH;
    ctx.fillStyle = 'rgba(10,22,32,0.6)';
    ctx.strokeStyle = 'rgba(232,182,90,0.2)';
    roundRect(ctx, 60 + col * cellW + 6, cy - 4, cellW - 12, cellH - 12, 10);
    ctx.fill(); ctx.stroke();
    ctx.font = '700 24px Cinzel, serif';
    ctx.fillStyle = '#f4d27a';
    ctx.fillText(String(value), cx, cy + 34);
    ctx.font = '600 9px Outfit, sans-serif';
    ctx.fillStyle = '#8ba3b8';
    ctx.fillText(label, cx, cy + 52);
  });

  ctx.textAlign = 'left';
  ctx.font = '700 15px Outfit, sans-serif';
  ctx.fillStyle = '#f5e6d3';
  ctx.fillText('Achievements Unlocked', 60, gridY + 220);

  const unlocked = Object.entries(ACHIEVEMENTS).filter(([id]) => PROGRESS.achievements.includes(id));
  ctx.font = '400 13px Outfit, sans-serif';
  unlocked.slice(0, 14).forEach(([id, ach], i) => {
    const y = gridY + 250 + i * 26;
    if (y > H - 90) return;
    ctx.fillStyle = '#f4d27a';
    ctx.fillText('✦', 62, y);
    ctx.fillStyle = '#f5e6d3';
    ctx.fillText(ach.name, 84, y);
  });

  ctx.textAlign = 'center';
  drawSealMark(ctx, W / 2, H - 70, 30);
  ctx.font = '400 11px Outfit, sans-serif';
  ctx.fillStyle = '#5c7186';
  ctx.fillText('Unveil the Sacred Sigils', W / 2, H - 30);

  return canvas;
}

async function exportChronicleImage() {
  const canvas = buildChronicleCard();
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arcanum-chronicle.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}

const exportBtn = document.getElementById('exportChronicleBtn');
if (exportBtn) exportBtn.addEventListener('click', exportChronicleImage);
