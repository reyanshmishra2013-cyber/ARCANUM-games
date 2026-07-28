/* ============================================================
   HAPTICS — safe no-op on unsupported devices/browsers
   ============================================================ */
function vibrateSafe(pattern) {
  try {
    const intensity = (typeof SETTINGS !== 'undefined' && SETTINGS.hapticsIntensity !== undefined) ? SETTINGS.hapticsIntensity : 2;
    if (intensity === 0) return; // haptics off
    const scale = intensity === 1 ? 0.4 : 1; // low = shorter pulses, full = as authored
    const scaled = Array.isArray(pattern) ? pattern.map(ms => Math.round(ms * scale)) : Math.round(pattern * scale);
    if (navigator.vibrate) navigator.vibrate(scaled);
  } catch (e) {}
}
function hapticMatch() { vibrateSafe(35); }
function hapticMiss() { vibrateSafe([30, 60, 30]); }
function hapticWin() { vibrateSafe([20, 40, 20, 40, 60]); }

/* ============================================================
   SCREEN SHAKE — big-combo camera shake, off via Settings or
   Reduced Motion
   ============================================================ */
function triggerScreenShake(intensity = 1) {
  const settingsAllow = typeof SETTINGS === 'undefined' || (SETTINGS.screenShake && !SETTINGS.reducedMotion);
  if (!settingsAllow) return;
  const stage = document.getElementById('board') || document.body;
  const px = 4 * intensity;
  stage.animate([
    { transform: 'translate(0, 0)' },
    { transform: `translate(${px}px, ${-px}px)` },
    { transform: `translate(${-px}px, ${px}px)` },
    { transform: `translate(${px * 0.6}px, ${px * 0.6}px)` },
    { transform: 'translate(0, 0)' },
  ], { duration: 260, easing: 'ease-out' });
}

/* ============================================================
   FLOATING MATCH SCORE — small "+N" text rising from a matched card
   ============================================================ */
function showMatchScoreGain(cardEl, amount) {
  if (!cardEl || amount <= 0) return;
  const rect = cardEl.getBoundingClientRect();
  const text = document.createElement('div');
  text.className = 'match-score-text';
  text.textContent = `+${amount}`;
  text.style.left = `${rect.left + rect.width / 2}px`;
  text.style.top = `${rect.top}px`;
  document.body.appendChild(text);
  text.animate([
    { transform: 'translate(-50%, 0) scale(0.7)', opacity: 0 },
    { transform: 'translate(-50%, -14px) scale(1)', opacity: 1, offset: 0.25 },
    { transform: 'translate(-50%, -46px) scale(0.95)', opacity: 0 }
  ], { duration: 900, easing: 'ease-out' }).onfinish = () => text.remove();
}

/* ============================================================
   AETHER GAIN — floating "+N" text above the header stat
   ============================================================ */
function showAetherGain(amount) {
  if (amount <= 0) return;
  const stat = document.getElementById('aetherStat');
  if (!stat) return;
  stat.classList.remove('aether-gain');
  void stat.offsetWidth; // restart animation
  stat.classList.add('aether-gain');

  const rect = stat.getBoundingClientRect();
  const text = document.createElement('div');
  text.className = 'aether-gain-text';
  text.textContent = `+${amount}`;
  text.style.left = `${rect.left + rect.width / 2}px`;
  text.style.top = `${rect.top}px`;
  document.body.appendChild(text);
  text.animate([
    { transform: 'translate(-50%, 0) scale(0.8)', opacity: 0 },
    { transform: 'translate(-50%, -14px) scale(1.05)', opacity: 1, offset: 0.3 },
    { transform: 'translate(-50%, -38px) scale(1)', opacity: 0 }
  ], { duration: 1100, easing: 'ease-out' }).onfinish = () => text.remove();
}

function addStarSparkles(starEl) {
  const rect = starEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = 3 + Math.random() * 3;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.left = `${cx - size/2}px`;
      p.style.top = `${cy - size/2}px`;
      p.style.background = '#fff5d6';
      p.style.boxShadow = '0 0 10px #f4d27a';
      document.body.appendChild(p);
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 50;
      p.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px) scale(0)`, opacity: 0 }
      ], { duration: 800, easing: 'ease-out' }).onfinish = () => p.remove();
    }, i * 60);
  }
}

/* ============================================================
   VICTORY ANIMATIONS — a full-screen cosmetic sweep/pulse layered on
   top of confetti + the victory frame border. One appended div, styled
   entirely by the CSS keyframes for its data-victoryanim variant, then
   removed once the animation has had time to finish.
   ============================================================ */
function playVictoryAnimation() {
  // Confetti + the lit stars already read as a clear win; skip the extra
  // full-screen motion when the player has asked for less of it.
  if (typeof SETTINGS !== 'undefined' && SETTINGS.reducedMotion) return;
  const kind = (typeof PROGRESS !== 'undefined' && PROGRESS.cosmetics && PROGRESS.cosmetics.victoryAnimations) || 'default';
  const el = document.createElement('div');
  el.className = `victory-anim victory-anim-${kind}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

/* ============================================================
   CONFETTI — multi-burst canvas particles
   ============================================================ */
let confettiActive = false;
let confettiParticles = [];

function startConfetti() {
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  confettiActive = true;
  confettiParticles = [];

  const CONFETTI_PALETTES = {
    default:  ['#f4d27a','#e8b65a','#fff5d6','#3dd68c','#6ff0b0','#ff9a8b','#ff6b6b','#f5e6d3'],
    violet:   ['#a78bfa','#c4b5fd','#f0abfc','#f9a8d4','#e879f9','#fff5d6'],
    emerald:  ['#3dd68c','#6ff0b0','#2dd4bf','#5eead4','#a7f3d0','#fff5d6'],
    rainbow:  ['#ff6b6b','#f4d27a','#3dd68c','#6ff0b0','#60a5fa','#a78bfa','#f0abfc'],
  };
  const cosmeticConfetti = (typeof PROGRESS !== 'undefined' && PROGRESS.cosmetics && PROGRESS.cosmetics.confetti) || 'default';
  const colors = CONFETTI_PALETTES[cosmeticConfetti] || CONFETTI_PALETTES.default;

  // Top-center burst
  for (let i = 0; i < 220; i++) {
    confettiParticles.push(makeConfetti(
      window.innerWidth / 2 + (Math.random() - 0.5) * 240,
      -20,
      (Math.random() - 0.5) * 10,
      Math.random() * 4 + 2,
      colors
    ));
  }
  // Side bursts (staggered)
  setTimeout(() => {
    if (!confettiActive) return;
    for (let i = 0; i < 80; i++) {
      confettiParticles.push(makeConfetti(
        0,
        window.innerHeight * 0.45,
        Math.random() * 8 + 3,
        -(Math.random() * 9 + 3),
        colors
      ));
      confettiParticles.push(makeConfetti(
        window.innerWidth,
        window.innerHeight * 0.45,
        -(Math.random() * 8 + 3),
        -(Math.random() * 9 + 3),
        colors
      ));
    }
  }, 450);

  // Continuous gentle rain
  let rainCount = 0;
  const rainInterval = setInterval(() => {
    if (!confettiActive || rainCount > 30) { clearInterval(rainInterval); return; }
    for (let i = 0; i < 12; i++) {
      confettiParticles.push(makeConfetti(
        Math.random() * window.innerWidth,
        -20,
        (Math.random() - 0.5) * 4,
        Math.random() * 2 + 1,
        colors
      ));
    }
    rainCount++;
  }, 400);

  animateConfetti();
}

function makeConfetti(x, y, vx, vy, colors) {
  return {
    x, y, vx, vy,
    gravity: 0.18,
    friction: 0.99,
    size: Math.random() * 8 + 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.35,
    shape: Math.random() < 0.4 ? 'rect' : (Math.random() < 0.7 ? 'circle' : 'star'),
    life: 1,
    flutter: Math.random() * Math.PI * 2,
    flutterSpeed: 0.05 + Math.random() * 0.05,
  };
}

function drawConfettiShape(ctx, p) {
  ctx.fillStyle = p.color;
  if (p.shape === 'rect') {
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
  } else if (p.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 5-point star
    const r1 = p.size / 2;
    const r2 = r1 * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? r1 : r2;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function stopConfetti() {
  confettiActive = false;
  const canvas = document.getElementById('confetti');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  confettiParticles = [];
}

function animateConfetti() {
  if (!confettiActive) {
    stopConfetti();
    return;
  }
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  confettiParticles = confettiParticles.filter(p => {
    p.vy += p.gravity;
    p.vx *= p.friction;
    p.flutter += p.flutterSpeed;
    p.x += p.vx + Math.sin(p.flutter) * 0.8;
    p.y += p.vy;
    p.rotation += p.rotationSpeed;
    p.life -= 0.004;

    if (p.y > canvas.height + 60 || p.life <= 0) return false;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    drawConfettiShape(ctx, p);
    ctx.restore();
    return true;
  });

  if (confettiParticles.length > 0) {
    requestAnimationFrame(animateConfetti);
  } else {
    confettiActive = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

