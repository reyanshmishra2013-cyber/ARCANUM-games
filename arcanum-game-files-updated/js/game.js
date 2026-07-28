function initStarfield() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  let stars = [];
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    const count = Math.floor((w * h) / 7000);
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.3,
        baseAlpha: Math.random() * 0.5 + 0.25,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.6 + 0.2,
        hue: Math.random() < 0.15 ? 'gold' : 'cream',
      });
    }
  }
  window.addEventListener('resize', resize);
  resize();

  let t = 0;
  function animate() {
    ctx.clearRect(0, 0, w, h);
    t += 0.016;
    stars.forEach(s => {
      const alpha = Math.max(0, s.baseAlpha + Math.sin(t * s.speed + s.phase) * 0.4);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.hue === 'gold'
        ? `rgba(244, 210, 122, ${alpha})`
        : `rgba(245, 230, 211, ${alpha})`;
      ctx.fill();
      if (s.r > 1) {
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
        const color = s.hue === 'gold'
          ? `rgba(232, 182, 90, ${alpha * 0.35})`
          : `rgba(245, 230, 211, ${alpha * 0.25})`;
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    requestAnimationFrame(animate);
  }
  animate();
}

/* ============================================================
   GAME LOGIC
   ============================================================ */
function initGame() {
  // Daily Rite plays the same board for everyone on a given calendar day, and
  // Weekly Rite the same board for everyone in a given ISO week — so their
  // difficulty is forced (see effectiveDifficultyKey) rather than the
  // player's own pick, otherwise the seed wouldn't line up across players.
  const isDaily = STATE.mode === 'daily';
  const isWeekly = STATE.mode === 'weekly';
  const isMp = STATE.mode === 'mp';
  const isSeeded = isDaily || isWeekly || isMp;
  const diff = DIFFICULTIES[effectiveDifficultyKey()];
  const symbols = THEMES[PROGRESS.activeTheme].symbols.slice(0, diff.pairs);

  // Build paired deck
  let cards = [];
  symbols.forEach((sym, idx) => {
    cards.push({ id: idx * 2,     symbol: sym, matched: false });
    cards.push({ id: idx * 2 + 1, symbol: sym, matched: false });
  });

  if (isDaily || isWeekly) {
    STATE.dailySeed = isDaily ? getDailyDateString() : getWeeklySeedString();
    const rand = seededRandom(STATE.dailySeed);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  } else if (isMp) {
    // Duel Online — both players shuffle from the same server-issued seed
    // (see js/multiplayer.js), so their boards come out identical without
    // the server ever having to know a single card's symbol.
    STATE.dailySeed = null;
    const rand = seededRandom(STATE.mpSeed);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  } else {
    STATE.dailySeed = null;
    // Fisher-Yates shuffle
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }

  const banner = document.getElementById('challengeBanner');
  if (banner) {
    const challenge = (typeof INCOMING_CHALLENGE !== 'undefined') ? INCOMING_CHALLENGE : null;
    if (isSeeded && challenge && challenge.mode === STATE.mode && challenge.seed === STATE.dailySeed) {
      banner.textContent = `⚔ Challenge: beat ${challenge.moves} moves`;
      banner.style.display = '';
    } else {
      banner.style.display = 'none';
    }
  }

  STATE.cards = cards;
  STATE.flippedCards = [];
  STATE.matchedCount = 0;
  STATE.moves = 0;
  STATE.streak = 0;
  STATE.maxStreak = 0;
  STATE.elapsedTime = 0;
  STATE.timeRemaining = diff.timeLimit;
  STATE.lives = MAX_LIVES;
  STATE.wasAtOneLife = false;
  STATE.moveLimit = diff.pairs + 2 + Math.floor(Math.random() * (Math.ceil(diff.pairs * 0.5) + 2));
  STATE.locked = true;
  STATE.gameStarted = false;
  STATE.gameComplete = false;
  STATE.gameOver = false;
  STATE.veilNextShuffle = null;
  STATE.hiddenAt = null;
  STATE.currentPlayer = 1;
  STATE.p1Pairs = 0;
  STATE.p2Pairs = 0;
  STATE.aiMemory = [];
  STATE.aiThinking = false;
  STATE.powerupsUsed = new Set();
  STATE.frozenUntil = null;
  if (typeof loadAiMemoryCapacity === 'function') {
    STATE.aiMemoryCapacity = loadAiMemoryCapacity();
  }

  if (STATE.timerInterval) {
    clearInterval(STATE.timerInterval);
    STATE.timerInterval = null;
  }
  if (STATE.flipTimeout) {
    clearTimeout(STATE.flipTimeout);
    STATE.flipTimeout = null;
  }
  if (STATE.aiTurnTimeout) {
    clearTimeout(STATE.aiTurnTimeout);
    STATE.aiTurnTimeout = null;
  }
  if (STATE.aiSecondFlipTimeout) {
    clearTimeout(STATE.aiSecondFlipTimeout);
    STATE.aiSecondFlipTimeout = null;
  }

  // Toggle mode-specific HUD elements
  document.getElementById('timeLabel').textContent = STATE.mode === 'timed' ? 'Time Left' : 'Time';
  document.getElementById('timeVal').classList.remove('time-critical');
  document.getElementById('movesVal').classList.remove('time-critical');
  document.getElementById('livesStat').style.display = STATE.mode === 'hard' ? '' : 'none';
  const isDuelLike = STATE.mode === 'duel' || STATE.mode === 'aiduel' || STATE.mode === 'mp';
  document.getElementById('duelHud').style.display = isDuelLike ? 'flex' : 'none';
  const aiMemoryControl = document.getElementById('aiMemoryControl');
  if (aiMemoryControl) aiMemoryControl.style.display = STATE.mode === 'aiduel' ? '' : 'none';
  const p1NameEl = document.getElementById('duelP1Name');
  const p2NameEl = document.getElementById('duelP2Name');
  const mpP1Label = typeof mpSeatLabel === 'function' ? mpSeatLabel(1) : null;
  const mpP2Label = typeof mpSeatLabel === 'function' ? mpSeatLabel(2) : null;
  if (p1NameEl) p1NameEl.textContent = mpP1Label || 'Player 1';
  if (p2NameEl) p2NameEl.textContent = STATE.mode === 'aiduel' ? 'The Sphinx' : (mpP2Label || 'Player 2');
  if (isDuelLike) updateDuelHud();

  const powerupBar = document.getElementById('powerupBar');
  if (powerupBar) powerupBar.style.display = isDuelLike ? 'none' : 'flex';
  if (typeof updatePowerupButtons === 'function') updatePowerupButtons();

  document.querySelectorAll('[data-diff]').forEach(b => {
    b.classList.toggle('disabled-locked', isSeeded);
  });

  renderBoard();
  updateStats();
  if (typeof updateDailyPanelHint === 'function') updateDailyPanelHint();

  // Classic & Timed get a brief memorization preview; Hard mode skips it entirely
  if (STATE.mode === 'hard') {
    setTimeout(() => { STATE.locked = false; }, 700);
  } else {
    setTimeout(() => startPreview(), 700);
  }
}

function renderBoard() {
  const board = document.getElementById('board');
  const diff = DIFFICULTIES[effectiveDifficultyKey()];
  board.style.gridTemplateColumns = `repeat(${diff.cols}, minmax(0, 1fr))`;
  board.style.maxWidth = `${diff.maxWidth}px`;

  board.innerHTML = '';

  // role="gridcell" must live inside role="row" inside role="grid" per the
  // ARIA spec; rows are visual-only wrappers (display:contents) so they
  // don't affect the CSS grid layout on #board itself.
  let currentRow = null;

  STATE.cards.forEach((card, idx) => {
    if (idx % diff.cols === 0) {
      currentRow = document.createElement('div');
      currentRow.setAttribute('role', 'row');
      currentRow.style.display = 'contents';
      board.appendChild(currentRow);
    }

    const el = document.createElement('div');
    el.className = 'card dealing';
    el.dataset.index = idx;
    el.setAttribute('role', 'gridcell');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `Card ${idx + 1}`);
    el.setAttribute('aria-selected', 'false');
    el.style.animationDelay = `${idx * 0.035}s`;

    el.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back">
          <svg class="card-back-seal" viewBox="0 0 60 60" aria-hidden="true">
            <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(232,182,90,0.55)" stroke-width="0.6"/>
            <circle cx="30" cy="30" r="18" fill="none" stroke="rgba(232,182,90,0.4)" stroke-width="0.4"/>
            <circle cx="30" cy="30" r="12" fill="none" stroke="rgba(232,182,90,0.3)" stroke-width="0.4"/>
            <path d="M30 6 L33 27 L54 30 L33 33 L30 54 L27 33 L6 30 L27 27 Z"
                  fill="rgba(232,182,90,0.45)" stroke="rgba(244,210,122,0.7)" stroke-width="0.4"/>
            <circle cx="30" cy="30" r="2.5" fill="rgba(244,210,122,0.9)"/>
            <circle cx="30" cy="6" r="1" fill="rgba(232,182,90,0.7)"/>
            <circle cx="30" cy="54" r="1" fill="rgba(232,182,90,0.7)"/>
            <circle cx="6" cy="30" r="1" fill="rgba(232,182,90,0.7)"/>
            <circle cx="54" cy="30" r="1" fill="rgba(232,182,90,0.7)"/>
          </svg>
        </div>
        <div class="card-face card-front">
          ${cardFaceHTML(card.symbol)}
        </div>
      </div>
    `;

    el.addEventListener('animationend', () => el.classList.remove('dealing'), { once: true });
    el.addEventListener('click', () => cardActivated(idx));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cardActivated(idx);
        return;
      }
      const arrowDeltas = {
        ArrowRight: 1, ArrowLeft: -1,
        ArrowDown: diff.cols, ArrowUp: -diff.cols,
      };
      if (arrowDeltas[e.key] !== undefined) {
        e.preventDefault();
        const target = idx + arrowDeltas[e.key];
        if (target < 0 || target >= STATE.cards.length) return;
        // Don't let Left/Right wrap onto the previous/next row — stop at row edges.
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
            Math.floor(target / diff.cols) !== Math.floor(idx / diff.cols)) return;
        const targetEl = board.querySelector(`.card[data-index="${target}"]`);
        if (targetEl) targetEl.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        board.querySelector('.card[data-index="0"]')?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        board.querySelector(`.card[data-index="${STATE.cards.length - 1}"]`)?.focus();
      }
    });

    currentRow.appendChild(el);
  });
}

function startPreview() {
  const cards = document.querySelectorAll('.card');
  cards.forEach(c => c.classList.add('flipped'));
  setTimeout(() => {
    cards.forEach(c => c.classList.remove('flipped'));
    setTimeout(() => { STATE.locked = false; }, 350);
  }, 500);
}

function announceToBoard(message) {
  const el = document.getElementById('boardAnnouncer');
  if (el) el.textContent = message;
}

// Routes a card activation (click or keyboard) to the right handler: in
// Duel Online, a click only *requests* a flip from the server (see
// attemptMpFlip in js/multiplayer.js) — the actual flip only happens once
// the server's broadcast comes back, so both players stay in lockstep.
// Every other mode is unaffected and calls handleCardClick directly, same
// as before.
function cardActivated(idx) {
  if (STATE.mode === 'mp' && typeof attemptMpFlip === 'function') {
    attemptMpFlip(idx);
  } else {
    handleCardClick(idx);
  }
}

function handleCardClick(idx) {
  audio.init();
  audio.resume();

  if (STATE.locked || STATE.gameComplete || STATE.gameOver) return;
  if (STATE.flippedCards.includes(idx)) return;
  if (STATE.cards[idx].matched) return;
  if (STATE.mode === 'aiduel' && STATE.currentPlayer === 2 && !window._aiActing) return;
  if (STATE.mode === 'mp' && !window._mpApplying) return;

  if (!STATE.gameStarted) {
    STATE.gameStarted = true;
    startTimer();
    crazySdk.game.gameplayStart();
    // Auto-start music on first interaction unless user explicitly disabled or SDK muted
    if (!audio.musicPlaying && !window._userDisabledMusic && !window._sdkMuted) {
      audio.startMusic();
      document.getElementById('musicToggle').classList.add('active');
      document.getElementById('musicLabel').textContent = 'Playing';
    }
  }

  const cardEl = document.querySelector(`.card[data-index="${idx}"]`);
  audio.playFlip();
  cardEl.classList.add('flipped');
  cardEl.setAttribute('aria-selected', 'true');
  cardEl.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
    { duration: 320, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
  );
  STATE.flippedCards.push(idx);
  announceToBoard(`Card ${idx + 1} revealed: ${STATE.cards[idx].symbol}`);
  if (STATE.mode === 'aiduel' && typeof recordAiMemory === 'function') recordAiMemory(idx);

  if (STATE.flippedCards.length === 2) {
    STATE.locked = true;
    STATE.moves++;
    updateStats();
    STATE.flipTimeout = setTimeout(() => checkMatch(), 720);
  }
}

function checkMatch() {
  const [a, b] = STATE.flippedCards;
  if (a === undefined || b === undefined) return; // stale call from a game that was reset mid-resolution
  const cardA = STATE.cards[a];
  const cardB = STATE.cards[b];
  const elA = document.querySelector(`.card[data-index="${a}"]`);
  const elB = document.querySelector(`.card[data-index="${b}"]`);

  if (cardA.symbol === cardB.symbol) {
    // MATCH
    cardA.matched = true;
    cardB.matched = true;
    STATE.matchedCount++;
    STATE.streak++;
    STATE.maxStreak = Math.max(STATE.maxStreak, STATE.streak);

    // Chime pitch rises slightly with each match
    const baseFreq = 523.25 * Math.pow(2, Math.min(STATE.matchedCount - 1, 8) / 12);
    audio.playChime(baseFreq);
    hapticMatch();

    if (STATE.streak >= 3) {
      setTimeout(() => {
        audio.playStreakFanfare(STATE.streak);
        triggerStreakEffect(STATE.streak);
        // 5x+ combos get an extra flourish: a camera shake on top of the
        // usual fanfare/particle burst (skipped entirely if the player has
        // Screen Shake off or Reduced Motion on — see triggerScreenShake).
        if (STATE.streak % 5 === 0) triggerScreenShake(Math.min(2, 1 + STATE.streak / 15));
      }, 180);
    }

    // Rare match events — a small, uncommon flourish that doesn't affect
    // balance meaningfully but makes a lucky match feel special.
    maybeTriggerRareMatchEvent(elA, elB);

    // Float-fade after a brief beat
    setTimeout(() => {
      elA.classList.add('matched');
      elB.classList.add('matched');
      elA.setAttribute('aria-selected', 'false');
      elB.setAttribute('aria-selected', 'false');
      // Particle intensity ramps gently with the current streak
      const intensity = 1 + Math.min(STATE.streak, 6) * 0.12;
      burstParticles(elA, 'gold', intensity);
      burstParticles(elB, 'gold', intensity);
      showMatchScoreGain(elA, estimateMatchPoints());
    }, 320);

    announceToBoard(`Match found: ${cardA.symbol}`);
    STATE.flippedCards = [];
    STATE.locked = false;
    updateStats();
    if (typeof forgetAiMemory === 'function') { forgetAiMemory(a); forgetAiMemory(b); }

    if (STATE.mode === 'duel' || STATE.mode === 'aiduel' || STATE.mode === 'mp') {
      const activeSeat = STATE.currentPlayer;
      if (activeSeat === 1) STATE.p1Pairs++; else STATE.p2Pairs++;
      updateDuelHud();
      if (STATE.mode === 'mp' && typeof MP !== 'undefined' && activeSeat === MP.youAre) {
        reportMpPairResult(true);
      }
    }
    if (typeof maybeTriggerAiTurn === 'function') maybeTriggerAiTurn();

    if (STATE.matchedCount === DIFFICULTIES[effectiveDifficultyKey()].pairs) {
      // Stop the countdown immediately so a near-zero clock can't fire
      // timeUp()/loseGame() during the win-animation delay below.
      if (STATE.timerInterval) {
        clearInterval(STATE.timerInterval);
        STATE.timerInterval = null;
      }
      if (STATE.mode === 'duel' || STATE.mode === 'aiduel' || STATE.mode === 'mp') {
        setTimeout(() => completeDuel(), 1100);
      } else {
        setTimeout(() => completeGame(), 1100);
      }
    } else if (STATE.mode === 'oracle' && STATE.moves >= STATE.moveLimit) {
      setTimeout(() => loseGame('moves'), 500);
    }
  } else {
    // MISS
    STATE.streak = 0;
    audio.playMiss();
    triggerMissFlash();
    hapticMiss();

    elA.classList.add('miss');
    elB.classList.add('miss');
    announceToBoard('No match');

    if (STATE.mode === 'hard') {
      STATE.lives = Math.max(0, STATE.lives - 1);
      if (STATE.lives === 1) STATE.wasAtOneLife = true;
    }

    setTimeout(() => {
      elA.classList.remove('miss', 'flipped');
      elB.classList.remove('miss', 'flipped');
      elA.setAttribute('aria-selected', 'false');
      elB.setAttribute('aria-selected', 'false');
      STATE.flippedCards = [];
      updateStats();

      if (STATE.mode === 'duel' || STATE.mode === 'aiduel' || STATE.mode === 'mp') {
        const activeSeat = STATE.currentPlayer;
        STATE.currentPlayer = STATE.currentPlayer === 1 ? 2 : 1;
        updateDuelHud();
        if (STATE.mode === 'mp' && typeof MP !== 'undefined' && activeSeat === MP.youAre) {
          reportMpPairResult(false);
        }
      }

      if (STATE.mode === 'hard' && STATE.lives <= 0) {
        loseGame('lives');
      } else if (STATE.mode === 'oracle' && STATE.moves >= STATE.moveLimit) {
        loseGame('moves');
      } else {
        STATE.locked = false;
        if (typeof maybeTriggerAiTurn === 'function') maybeTriggerAiTurn();
      }
    }, 680);
  }
}

// Purely a feel-good preview of what this match is contributing toward the
// Aether earned at game end (see calcAetherEarned in progress.js) — it does
// NOT itself grant Aether, so it can't be farmed by matching and resetting.
function estimateMatchPoints() {
  const diffMult = { apprentice: 1, adept: 1.4, master: 2 }[effectiveDifficultyKey()] || 1.2;
  const streakBonus = STATE.streak >= 3 ? STATE.streak * 2 : 0;
  return Math.round(4 * diffMult) + streakBonus;
}

// Rare Match Events — a low-chance flourish on an ordinary match. Grants a
// small immediate Aether bonus (separate from the end-of-game payout) so it
// reads as a genuine "lucky" moment rather than just a visual effect.
const RARE_EVENT_CHANCE = 0.05;
function maybeTriggerRareMatchEvent(elA, elB) {
  if (STATE.mode === 'duel' || STATE.mode === 'aiduel' || STATE.mode === 'mp') return; // keep head-to-head scoring clean
  if (Math.random() > RARE_EVENT_CHANCE) return;

  const events = [
    { id: 'golden_sigil', label: 'Golden Sigil', bonus: () => 15 + Math.floor(Math.random() * 20) },
    { id: 'lucky_board', label: 'Lucky Board', bonus: () => 10 + Math.floor(Math.random() * 10) },
  ];
  const event = events[Math.floor(Math.random() * events.length)];
  const bonus = event.bonus();

  PROGRESS.aether += bonus;
  saveProgress();
  updateAetherDisplay();
  showAetherGain(bonus);
  audio.playChime(880);
  announceToBoard(`${event.label}! +${bonus} Aether`);

  [elA, elB].forEach(el => el.classList.add('rare-event-glow'));
  setTimeout(() => [elA, elB].forEach(el => el.classList.remove('rare-event-glow')), 1100);
}

function triggerMissFlash() {
  const flash = document.createElement('div');
  flash.className = 'miss-flash';
  flash.style.opacity = '0';
  document.body.appendChild(flash);
  flash.animate([
    { opacity: 0 }, { opacity: 1 }, { opacity: 0 }
  ], { duration: 420, easing: 'ease-out' }).onfinish = () => flash.remove();
}

/* ============================================================
   VISUAL EFFECTS
   ============================================================ */
function triggerStreakEffect(streak) {
  const streakStat = document.getElementById('streakStat');

  // Floating "STREAK ×N" text
  const text = document.createElement('div');
  text.className = 'streak-text';
  text.textContent = `STREAK ×${streak}`;
  document.body.appendChild(text);
  text.animate([
    { transform: 'translate(-50%, 20px) scale(0.4)', opacity: 0 },
    { transform: 'translate(-50%, -20px) scale(1.15)', opacity: 1, offset: 0.25 },
    { transform: 'translate(-50%, -60px) scale(1)', opacity: 1, offset: 0.65 },
    { transform: 'translate(-50%, -120px) scale(0.9)', opacity: 0 }
  ], { duration: 1700, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
  .onfinish = () => text.remove();

  // Golden particle burst from streak stat
  const rect = streakStat.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = 3 + Math.random() * 6;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${cx - size/2}px`;
    p.style.top = `${cy - size/2}px`;
    const hue = 30 + Math.random() * 30;
    p.style.background = `hsl(${hue}, 90%, 65%)`;
    p.style.boxShadow = `0 0 12px hsl(${hue}, 90%, 65%)`;
    document.body.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 130;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 40;

    p.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0)`, opacity: 0 }
    ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
    .onfinish = () => p.remove();
  }

  // Subtle screen-edge glow
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed; inset: 0; pointer-events: none; z-index: 30;
    background: radial-gradient(circle at center, transparent 50%, rgba(255,154,139,0.18) 100%);
    opacity: 0;
  `;
  document.body.appendChild(flash);
  flash.animate([
    { opacity: 0 }, { opacity: 1 }, { opacity: 0 }
  ], { duration: 600, easing: 'ease-out' }).onfinish = () => flash.remove();
}

function burstParticles(cardEl, kind = 'gold', intensity = 1) {
  const rect = cardEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const count = Math.round(22 * intensity);
  const cosmeticParticles = (typeof PROGRESS !== 'undefined' && PROGRESS.cosmetics && PROGRESS.cosmetics.matchParticles) || 'default';
  // Cosmetic only re-colors the default "gold" match burst — the coral
  // "miss" burst kind (unused today, kept for future use) stays untouched.
  const baseHue = kind !== 'gold' ? 0 : (cosmeticParticles === 'violet' ? 265 : cosmeticParticles === 'starburst' ? 45 : 40);
  const isStarburst = kind === 'gold' && cosmeticParticles === 'starburst';

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle' + (isStarburst ? ' particle-star' : '');
    const size = (3 + Math.random() * 6) * Math.min(intensity, 1.4);
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${cx - size/2}px`;
    p.style.top = `${cy - size/2}px`;
    const hue = baseHue + (Math.random() - 0.5) * 30;
    const sat = kind === 'gold' ? 90 : 80;
    const light = 60 + Math.random() * 15;
    p.style.background = `hsl(${hue}, ${sat}%, ${light}%)`;
    p.style.boxShadow = `0 0 12px hsl(${hue}, ${sat}%, ${light}%)`;
    document.body.appendChild(p);

    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const speed = (70 + Math.random() * 110) * Math.min(intensity, 1.5);
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 50;

    p.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0) rotate(90deg)`, opacity: 0 }
    ], { duration: 950 + Math.random() * 400, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
    .onfinish = () => p.remove();
  }
}

/* ============================================================
   TIMER & STATS
   ============================================================ */
function startTimer() {
  STATE.startTime = Date.now();
  STATE.hiddenAt = null;
  runTimerInterval();
}

function runTimerInterval() {
  const diff = DIFFICULTIES[effectiveDifficultyKey()];
  STATE.timerInterval = setInterval(() => {
    STATE.elapsedTime = Math.floor((Date.now() - STATE.startTime) / 1000);
    if (STATE.mode === 'timed') {
      STATE.timeRemaining = Math.max(0, diff.timeLimit - STATE.elapsedTime);
      if (STATE.timeRemaining <= 0) {
        updateStats();
        timeUp();
        return;
      }
    }
    updateStats();

    if (STATE.mode === 'veil' && !STATE.locked && STATE.flippedCards.length === 0 && !STATE.gameComplete && !STATE.gameOver) {
      if (!STATE.veilNextShuffle) STATE.veilNextShuffle = Date.now() + VEIL_INTERVAL;
      if (Date.now() >= STATE.veilNextShuffle) {
        shiftVeil();
        STATE.veilNextShuffle = Date.now() + VEIL_INTERVAL;
      }
    }
  }, 250);
}

// Called when the tab/app is backgrounded — stops the countdown/clock outright
// rather than letting it burn real wall-clock time while the player is away
// (previously Chronomancer's Rite could silently lose while backgrounded).
function pauseGameTimer() {
  if (STATE.timerInterval) {
    clearInterval(STATE.timerInterval);
    STATE.timerInterval = null;
  }
  STATE.hiddenAt = Date.now();
}

// Called when the tab/app regains focus — shifts startTime forward by however
// long the tab was hidden, so the hidden duration is excluded from elapsed
// time entirely, then resumes ticking from exactly where it left off.
function resumeGameTimer() {
  if (STATE.hiddenAt) {
    STATE.startTime += Date.now() - STATE.hiddenAt;
    STATE.hiddenAt = null;
  }
  if (!STATE.timerInterval && STATE.gameStarted && !STATE.gameComplete && !STATE.gameOver && !STATE.frozenUntil) {
    runTimerInterval();
  }
}

// Shifting Veil: quietly reshuffle the symbols of unmatched, face-down cards
function shiftVeil() {
  const idxs = STATE.cards.map((c, i) => i).filter(i => !STATE.cards[i].matched);
  if (idxs.length < 2) return;
  const syms = idxs.map(i => STATE.cards[i].symbol);
  for (let i = syms.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [syms[i], syms[j]] = [syms[j], syms[i]];
  }
  idxs.forEach((idx, k) => {
    STATE.cards[idx].symbol = syms[k];
    const span = document.querySelector(`.card[data-index="${idx}"] .card-symbol`);
    if (span) applySymbolToSpan(span, syms[k]);
  });
  triggerVeilRipple();
}

function triggerVeilRipple() {
  const board = document.getElementById('board');
  const ripple = document.createElement('div');
  ripple.className = 'veil-ripple';
  ripple.style.opacity = '0';
  board.appendChild(ripple);
  ripple.animate(
    [{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.04)' }],
    { duration: 900, easing: 'ease-out' }
  ).onfinish = () => ripple.remove();
}

function updateStats() {
  document.getElementById('streakVal').textContent = STATE.streak;
  const movesVal = document.getElementById('movesVal');
  if (STATE.mode === 'oracle') {
    movesVal.textContent = `${STATE.moves}/${STATE.moveLimit}`;
    if (STATE.moveLimit - STATE.moves <= 3) movesVal.classList.add('time-critical');
    else movesVal.classList.remove('time-critical');
  } else {
    movesVal.textContent = STATE.moves;
    movesVal.classList.remove('time-critical');
  }
  const diff = DIFFICULTIES[effectiveDifficultyKey()];
  document.getElementById('pairsVal').textContent = `${STATE.matchedCount}/${diff.pairs}`;

  const timeVal = document.getElementById('timeVal');
  const displaySeconds = STATE.mode === 'timed' ? STATE.timeRemaining : STATE.elapsedTime;
  const mins = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;
  timeVal.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  if (STATE.mode === 'timed' && STATE.timeRemaining <= 10) timeVal.classList.add('time-critical');
  else timeVal.classList.remove('time-critical');

  if (STATE.mode === 'hard') {
    document.getElementById('livesVal').textContent = '♦'.repeat(STATE.lives) + '♢'.repeat(MAX_LIVES - STATE.lives);
  }

  const streakStat = document.getElementById('streakStat');
  if (STATE.streak >= 3) streakStat.classList.add('streak-active');
  else streakStat.classList.remove('streak-active');

  if (typeof updatePowerupButtons === 'function') updatePowerupButtons();
}

/* ============================================================
   DUEL MODE — pass-and-play HUD
   ============================================================ */
function updateDuelHud() {
  const banner = document.getElementById('duelTurnBanner');
  const p1Card = document.getElementById('duelP1Card');
  const p2Card = document.getElementById('duelP2Card');
  if (!banner || !p1Card || !p2Card) return;

  document.getElementById('duelP1Score').textContent = STATE.p1Pairs;
  document.getElementById('duelP2Score').textContent = STATE.p2Pairs;
  const p1Label = (typeof mpSeatLabel === 'function' && mpSeatLabel(1)) || 'Player 1';
  const p2Label = STATE.mode === 'aiduel' ? 'The Sphinx' : ((typeof mpSeatLabel === 'function' && mpSeatLabel(2)) || 'Player 2');
  banner.textContent = STATE.currentPlayer === 1 ? `${p1Label}'s Turn` : `${p2Label}'s Turn`;
  p1Card.classList.toggle('active', STATE.currentPlayer === 1);
  p2Card.classList.toggle('active', STATE.currentPlayer === 2);
}

/* ============================================================
   GAME COMPLETION
   ============================================================ */
function completeGame() {
  if (STATE.gameComplete || STATE.gameOver) return;
  STATE.gameComplete = true;
  clearInterval(STATE.timerInterval);

  crazySdk.game.gameplayStop();
  crazySdk.game.happytime();
  crazySdk.game.reportGameCompletedPercentage(100);

  // Snapshot the previous best BEFORE saveBestStats() overwrites it, so we
  // can tell whether this run just set a new one.
  const diffKey = STATE.difficulty;
  const prevBest = (loadBestStats()[diffKey] || {});
  const hadPrevBest = prevBest.moves !== undefined;
  const isNewBest = STATE.mode !== 'daily' && STATE.mode !== 'weekly' &&
    (!hadPrevBest || STATE.moves < prevBest.moves ||
      (STATE.moves === prevBest.moves && STATE.elapsedTime < prevBest.time));

  saveBestStats();
  const aetherEarned = recordGameEnd(true);

  audio.playCompletion();
  hapticWin();

  // Calculate star rating
  const diff = DIFFICULTIES[effectiveDifficultyKey()];
  const minMoves = diff.pairs;
  const ratio = STATE.moves / minMoves;
  let stars = 1;
  if (ratio <= 1.6) stars = 3;
  else if (ratio <= 2.3) stars = 2;

  // Update modal content
  document.getElementById('modalSubtitle').textContent = STATE.mode === 'daily' ? 'The Daily Rite is complete' : 'The cosmos align in your favor';
  document.getElementById('modalTitle').textContent = STATE.mode === 'daily' ? 'Daily Rite Complete' : diff.title;
  document.getElementById('finalMoves').textContent = STATE.moves;
  const mins = Math.floor(STATE.elapsedTime / 60);
  const secs = STATE.elapsedTime % 60;
  document.getElementById('finalTime').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  document.getElementById('finalStreak').textContent = STATE.maxStreak;
  const accuracy = STATE.moves > 0 ? Math.min(100, Math.round((diff.pairs / STATE.moves) * 100)) : 100;
  const finalAccuracyEl = document.getElementById('finalAccuracy');
  if (finalAccuracyEl) {
    finalAccuracyEl.closest('div').style.display = '';
    finalAccuracyEl.textContent = `${accuracy}%`;
  }
  document.getElementById('finalAetherEarned').textContent = `${aetherEarned}✦`;
  const bestBadge = document.getElementById('modalPersonalBest');
  if (bestBadge) bestBadge.style.display = isNewBest ? '' : 'none';

  const isSeededMode = STATE.mode === 'daily' || STATE.mode === 'weekly';
  const challengeBtn = document.getElementById('challengeLinkBtn');
  if (challengeBtn) challengeBtn.style.display = isSeededMode ? '' : 'none';

  const challengeResultEl = document.getElementById('modalChallengeResult');
  if (challengeResultEl) {
    const challenge = (typeof INCOMING_CHALLENGE !== 'undefined') ? INCOMING_CHALLENGE : null;
    if (isSeededMode && challenge && challenge.mode === STATE.mode && challenge.seed === STATE.dailySeed) {
      const beat = STATE.moves < challenge.moves || (STATE.moves === challenge.moves && STATE.elapsedTime < challenge.time);
      const tied = STATE.moves === challenge.moves && STATE.elapsedTime === challenge.time;
      challengeResultEl.textContent = tied
        ? `Tied your friend's challenge — ${challenge.moves} moves`
        : beat
          ? `You beat the challenge! (${challenge.moves} moves to beat)`
          : `Your friend's challenge: ${challenge.moves} moves — try again to beat it`;
      challengeResultEl.style.display = '';
    } else {
      challengeResultEl.style.display = 'none';
    }
  }

  // Render stars
  const starsContainer = document.getElementById('starsContainer');
  starsContainer.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.innerHTML = `
      <svg viewBox="0 0 60 60" width="64" height="64">
        <defs>
          <linearGradient id="starGrad${i}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#fff5d6"/>
            <stop offset="0.5" stop-color="#f4d27a"/>
            <stop offset="1" stop-color="#a87a30"/>
          </linearGradient>
        </defs>
        <path d="M30 4 L37 22 L56 22 L41 33 L47 52 L30 41 L13 52 L19 33 L4 22 L23 22 Z"
              fill="url(#starGrad${i})"
              stroke="#fff5d6"
              stroke-width="1.2"/>
      </svg>
    `;
    starsContainer.appendChild(star);
    setTimeout(() => {
      if (i < stars) {
        star.classList.add('lit');
        addStarSparkles(star);
      }
    }, 700 + i * 320);
  }

  setTimeout(() => {
    document.getElementById('modalOverlay').classList.add('active');
    startConfetti();
    playVictoryAnimation();
  }, 900);
}

// Duel mode: board cleared — declare the winner (or a tie) instead of star rating
function completeDuel() {
  if (STATE.gameComplete || STATE.gameOver) return;
  STATE.gameComplete = true;
  clearInterval(STATE.timerInterval);

  crazySdk.game.gameplayStop();
  crazySdk.game.happytime();
  crazySdk.game.reportGameCompletedPercentage(100);
  const duelAetherEarned = recordGameEnd(true);

  audio.playCompletion();
  hapticWin();

  const p1Label = (typeof mpSeatLabel === 'function' && mpSeatLabel(1)) || 'Player 1';
  const p2Label = STATE.mode === 'aiduel' ? 'The Sphinx' : ((typeof mpSeatLabel === 'function' && mpSeatLabel(2)) || 'Player 2');
  let title, subtitle;
  if (STATE.p1Pairs > STATE.p2Pairs) {
    title = `${p1Label} Triumphs`;
    subtitle = `${STATE.p1Pairs} pairs to ${STATE.p2Pairs}`;
  } else if (STATE.p2Pairs > STATE.p1Pairs) {
    title = `${p2Label} Triumphs`;
    subtitle = `${STATE.p2Pairs} pairs to ${STATE.p1Pairs}`;
  } else {
    title = 'The Spheres Are Tied';
    subtitle = `${STATE.p1Pairs} pairs apiece`;
  }

  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalSubtitle').textContent = subtitle;
  document.getElementById('finalMoves').textContent = STATE.moves;
  const mins = Math.floor(STATE.elapsedTime / 60);
  const secs = STATE.elapsedTime % 60;
  document.getElementById('finalTime').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  document.getElementById('finalStreak').textContent = STATE.maxStreak;
  const finalAccuracyEl = document.getElementById('finalAccuracy');
  if (finalAccuracyEl) finalAccuracyEl.closest('div').style.display = 'none';
  const finalAetherEl = document.getElementById('finalAetherEarned');
  if (finalAetherEl) {
    finalAetherEl.closest('div').style.display = '';
    finalAetherEl.textContent = `${duelAetherEarned}✦`;
  }
  const duelBestBadge = document.getElementById('modalPersonalBest');
  if (duelBestBadge) duelBestBadge.style.display = 'none';
  const duelChallengeEl = document.getElementById('modalChallengeResult');
  if (duelChallengeEl) duelChallengeEl.style.display = 'none';
  const duelChallengeBtn = document.getElementById('challengeLinkBtn');
  if (duelChallengeBtn) duelChallengeBtn.style.display = 'none';

  // Stars don't mean anything in a head-to-head duel — leave them dark
  const starsContainer = document.getElementById('starsContainer');
  starsContainer.innerHTML = '';

  setTimeout(() => {
    document.getElementById('modalOverlay').classList.add('active');
    startConfetti();
    playVictoryAnimation();
  }, 900);
}

// Timed mode: countdown reached zero before the board was cleared
function timeUp() {
  loseGame('time');
}

// Shared loss handler for Hard mode (out of sigils), Timed mode (time's up), and Oracle's Wager (out of moves)
function loseGame(reason) {
  if (STATE.gameComplete || STATE.gameOver) return;
  STATE.gameOver = true;
  STATE.locked = true;
  clearInterval(STATE.timerInterval);

  const diff = DIFFICULTIES[effectiveDifficultyKey()];
  const pct = Math.round((STATE.matchedCount / diff.pairs) * 100);
  crazySdk.game.gameplayStop();
  crazySdk.game.reportGameCompletedPercentage(pct);
  const lossAetherEarned = recordGameEnd(false);

  audio.playMiss();

  const titles = { time: "Time's Up", lives: 'Out of Sigils', moves: "Fate's Wager Lost" };
  const subtitles = {
    time: 'The hourglass runs empty',
    lives: 'The spheres slip from your grasp',
    moves: 'The oracle\'s moves are spent',
  };
  document.getElementById('modalTitle').textContent = titles[reason] || 'Game Over';
  document.getElementById('modalSubtitle').textContent = subtitles[reason] || '';
  document.getElementById('finalMoves').textContent = STATE.moves;
  const mins = Math.floor(STATE.elapsedTime / 60);
  const secs = STATE.elapsedTime % 60;
  document.getElementById('finalTime').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  document.getElementById('finalStreak').textContent = STATE.maxStreak;
  const lossAccuracyEl = document.getElementById('finalAccuracy');
  if (lossAccuracyEl) {
    lossAccuracyEl.closest('div').style.display = '';
    lossAccuracyEl.textContent = `${STATE.moves > 0 ? Math.min(100, Math.round((diff.pairs / STATE.moves) * 100)) : 0}%`;
  }
  const lossAetherEl = document.getElementById('finalAetherEarned');
  if (lossAetherEl) {
    lossAetherEl.closest('div').style.display = '';
    lossAetherEl.textContent = `${lossAetherEarned}✦`;
  }
  const lossBestBadge = document.getElementById('modalPersonalBest');
  if (lossBestBadge) lossBestBadge.style.display = 'none';
  const lostChallengeEl = document.getElementById('modalChallengeResult');
  if (lostChallengeEl) lostChallengeEl.style.display = 'none';
  const lostChallengeBtn = document.getElementById('challengeLinkBtn');
  if (lostChallengeBtn) lostChallengeBtn.style.display = 'none';

  // No stars lit on a loss
  const starsContainer = document.getElementById('starsContainer');
  starsContainer.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.innerHTML = `
      <svg viewBox="0 0 60 60" width="64" height="64">
        <defs>
          <linearGradient id="starGradLoss${i}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#fff5d6"/>
            <stop offset="0.5" stop-color="#f4d27a"/>
            <stop offset="1" stop-color="#a87a30"/>
          </linearGradient>
        </defs>
        <path d="M30 4 L37 22 L56 22 L41 33 L47 52 L30 41 L13 52 L19 33 L4 22 L23 22 Z"
              fill="url(#starGradLoss${i})"
              stroke="#fff5d6"
              stroke-width="1.2"/>
      </svg>
    `;
    starsContainer.appendChild(star);
  }

  setTimeout(() => {
    document.getElementById('modalOverlay').classList.add('active');
  }, 500);
}

