/* ============================================================
   POWER-UPS — spend Aether for a one-time boost, mid-game
   ============================================================ */
const POWERUP_COSTS = { peek: 40, swap: 50, freeze: 45, ward: 60 };

function canUsePowerup(kind) {
  if (!STATE.gameStarted || STATE.gameComplete || STATE.gameOver) return false;
  if (PROGRESS.aether < POWERUP_COSTS[kind]) return false;
  if (kind === 'peek' && STATE.locked) return false;
  if (kind === 'swap' && STATE.moves <= 0) return false;
  if (kind === 'freeze' && (STATE.mode !== 'timed' || STATE.frozenUntil)) return false;
  if (kind === 'ward' && (STATE.mode !== 'hard' || STATE.lives >= MAX_LIVES)) return false;
  return true;
}

function updatePowerupButtons() {
  ['peek', 'swap', 'freeze', 'ward'].forEach(kind => {
    const btn = document.getElementById(`${kind}Btn`);
    if (!btn) return;
    const relevant = kind === 'freeze' ? STATE.mode === 'timed' : kind === 'ward' ? STATE.mode === 'hard' : true;
    btn.style.display = relevant ? '' : 'none';
    btn.disabled = !canUsePowerup(kind);
    btn.classList.toggle('disabled-locked', btn.disabled);
  });
}

function spendAether(amount) {
  PROGRESS.aether -= amount;
  saveProgress();
  updateAetherDisplay();
}

// Seer's Glimpse — briefly reveals every unmatched sigil on the board.
function usePeek() {
  if (!canUsePowerup('peek')) return;
  spendAether(POWERUP_COSTS.peek);
  STATE.powerupsUsed.add('peek');
  audio.playFlip();
  STATE.locked = true;
  const cards = document.querySelectorAll('.card:not(.matched):not(.flipped)');
  cards.forEach(c => c.classList.add('flipped', 'peeking'));
  announceToBoard("Seer's Glimpse: all sigils briefly revealed");
  setTimeout(() => {
    cards.forEach(c => {
      // Only unflip cards that weren't legitimately flipped/matched in the meantime.
      if (!c.classList.contains('matched') && STATE.flippedCards.indexOf(Number(c.dataset.index)) === -1) {
        c.classList.remove('flipped', 'peeking');
      }
    });
    STATE.locked = false;
    updatePowerupButtons();
  }, 3000);
  updatePowerupButtons();
}

// Fate's Pardon — forgives your last move, erasing 1 from the move count.
function useSwap() {
  if (!canUsePowerup('swap')) return;
  spendAether(POWERUP_COSTS.swap);
  STATE.powerupsUsed.add('swap');
  audio.playChime(660);
  STATE.moves = Math.max(0, STATE.moves - 1);
  updateStats();
  announceToBoard("Fate's Pardon: your last move has been forgiven");
  updatePowerupButtons();
}

// Chronomancer's Freeze — pauses the Chronomancer's Rite countdown for 5 seconds.
const FREEZE_DURATION_MS = 5000;
function useFreeze() {
  if (!canUsePowerup('freeze')) return;
  spendAether(POWERUP_COSTS.freeze);
  STATE.powerupsUsed.add('freeze');
  audio.playChime(392);
  announceToBoard("Chronomancer's Freeze: the hourglass pauses");

  if (STATE.timerInterval) {
    clearInterval(STATE.timerInterval);
    STATE.timerInterval = null;
  }
  STATE.frozenUntil = Date.now() + FREEZE_DURATION_MS;
  const timeVal = document.getElementById('timeVal');
  if (timeVal) timeVal.classList.add('time-frozen');
  updatePowerupButtons();

  setTimeout(() => {
    if (STATE.gameComplete || STATE.gameOver) return;
    // Shift startTime forward by the freeze duration so the frozen window
    // is excluded from elapsed/remaining time entirely, same technique used
    // for tab-hidden pauses (see resumeGameTimer in game.js).
    STATE.startTime += FREEZE_DURATION_MS;
    STATE.frozenUntil = null;
    if (timeVal) timeVal.classList.remove('time-frozen');
    if (!STATE.timerInterval && STATE.gameStarted) runTimerInterval();
    updatePowerupButtons();
  }, FREEZE_DURATION_MS);
}

// Umbral Ward — restores one lost sigil (life) in Umbral Trial.
function useWard() {
  if (!canUsePowerup('ward')) return;
  spendAether(POWERUP_COSTS.ward);
  STATE.powerupsUsed.add('ward');
  STATE.lives = Math.min(MAX_LIVES, STATE.lives + 1);
  audio.playChime(587);
  updateStats();
  announceToBoard("Umbral Ward: a sigil is restored");
  updatePowerupButtons();
}

document.getElementById('peekBtn').addEventListener('click', usePeek);
document.getElementById('swapBtn').addEventListener('click', useSwap);
document.getElementById('freezeBtn').addEventListener('click', useFreeze);
document.getElementById('wardBtn').addEventListener('click', useWard);
