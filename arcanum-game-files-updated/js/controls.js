/* ============================================================
   EVENT WIRING
   ============================================================ */
document.getElementById('musicToggle').addEventListener('click', (e) => {
  audio.init();
  audio.resume();
  const btn = e.currentTarget;
  const label = document.getElementById('musicLabel');
  if (audio.musicPlaying) {
    audio.stopMusic();
    btn.classList.remove('active');
    label.textContent = 'Music';
    window._userDisabledMusic = true;
  } else {
    audio.startMusic();
    btn.classList.add('active');
    label.textContent = 'Playing';
    window._userDisabledMusic = false;
  }
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (STATE.mode === 'mp' && STATE.gameStarted && !STATE.gameComplete && !STATE.gameOver) {
    if (!window.confirm("Leave this match? Your opponent will be notified and no result will be recorded.")) return;
    document.getElementById('modalOverlay').classList.remove('active');
    stopConfetti();
    crazySdk.game.gameplayStop();
    if (typeof leaveMultiplayerMatch === 'function') leaveMultiplayerMatch();
    return;
  }
  const inProgress = STATE.gameStarted && !STATE.gameComplete && !STATE.gameOver && STATE.moves > 0;
  if (inProgress && typeof SETTINGS !== 'undefined' && SETTINGS.confirmReset) {
    if (!window.confirm('Reset this rite? Your current progress will be lost.')) return;
  }
  document.getElementById('modalOverlay').classList.remove('active');
  stopConfetti();
  if (STATE.gameStarted) crazySdk.game.gameplayStop();
  initGame();
});

document.getElementById('playAgainBtn').addEventListener('click', () => {
  document.getElementById('modalOverlay').classList.remove('active');
  stopConfetti();
  if (STATE.mode === 'mp' && typeof startMultiplayerQueue === 'function') {
    setTimeout(() => startMultiplayerQueue(), 300);
  } else {
    setTimeout(() => initGame(), 300);
  }
});

const diffLabels = { apprentice: 'Initiate', adept: 'Seeker', master: 'Archmage', custom: 'Custom' };

document.querySelectorAll('[data-diff]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`[data-diff="${btn.dataset.diff}"]`).forEach(b => b.classList.add('active'));
    STATE.difficulty = btn.dataset.diff;
    const label = document.getElementById('pathsCurrentLabel');
    if (label) label.textContent = diffLabels[STATE.difficulty] || STATE.difficulty;
    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById('pathsModal').classList.remove('active');
    stopConfetti();
    if (STATE.gameStarted) crazySdk.game.gameplayStop();
    if (typeof abandonMpIfActive === 'function') abandonMpIfActive();
    initGame();
  });
});

document.getElementById('pathsBtn').addEventListener('click', () => {
  document.getElementById('pathsModal').classList.add('active');
});
document.getElementById('pathsCloseBtn').addEventListener('click', () => {
  document.getElementById('pathsModal').classList.remove('active');
});
document.getElementById('pathsModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('pathsModal').classList.remove('active');
});

document.getElementById('sigilsBtn').addEventListener('click', () => {
  document.getElementById('sigilsModal').classList.add('active');
});
document.getElementById('sigilsCloseBtn').addEventListener('click', () => {
  document.getElementById('sigilsModal').classList.remove('active');
});
document.getElementById('sigilsModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('sigilsModal').classList.remove('active');
});

const customPairsSlider = document.getElementById('customPairsSlider');
customPairsSlider.addEventListener('input', () => {
  document.getElementById('customPairsVal').textContent = `${customPairsSlider.value} pairs`;
});
document.getElementById('useCustomPathBtn').addEventListener('click', () => {
  const pairs = setCustomDifficulty(Number(customPairsSlider.value));
  document.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('active'));
  STATE.difficulty = 'custom';
  const label = document.getElementById('pathsCurrentLabel');
  if (label) label.textContent = `Custom (${pairs})`;
  document.getElementById('modalOverlay').classList.remove('active');
  document.getElementById('pathsModal').classList.remove('active');
  stopConfetti();
  if (STATE.gameStarted) crazySdk.game.gameplayStop();
  if (typeof abandonMpIfActive === 'function') abandonMpIfActive();
  initGame();
});

const modeLabels = {
  veil: 'Shifting Veil', classic: 'The Vigil', timed: "Chronomancer's Rite",
  hard: 'Umbral Trial', oracle: "Fate's Gambit", duel: 'Duel',
  aiduel: 'vs. Sphinx', mp: 'Duel Online', daily: 'Daily Rite', weekly: 'Weekly Rite',
};

document.querySelectorAll('[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`[data-mode="${btn.dataset.mode}"]`).forEach(b => b.classList.add('active'));
    STATE.mode = btn.dataset.mode;
    const label = document.getElementById('ritesCurrentLabel');
    if (label) label.textContent = modeLabels[STATE.mode] || STATE.mode;
    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById('ritesModal').classList.remove('active');
    stopConfetti();
    if (STATE.gameStarted) crazySdk.game.gameplayStop();
    if (STATE.mode === 'mp') {
      // Duel Online needs a server-issued seed before a board can be built —
      // js/multiplayer.js calls initGame() itself once matched.
      if (typeof startMultiplayerQueue === 'function') startMultiplayerQueue();
    } else {
      if (typeof abandonMpIfActive === 'function') abandonMpIfActive();
      initGame();
    }
  });
});

document.getElementById('ritesBtn').addEventListener('click', () => {
  document.getElementById('ritesModal').classList.add('active');
});
document.getElementById('ritesCloseBtn').addEventListener('click', () => {
  document.getElementById('ritesModal').classList.remove('active');
});
document.getElementById('ritesModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('ritesModal').classList.remove('active');
});

// Resize confetti canvas with window
window.addEventListener('resize', () => {
  const canvas = document.getElementById('confetti');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

