/* ============================================================
   DUEL ONLINE — real-time 1v1 via a small matchmaking/relay server
   ============================================================
   Design in short: the server hands both players the same shuffle
   seed (the same mechanism Daily/Weekly Rite already use so every
   player gets an identical board), then just relays "flip card N"
   messages and referees whose turn it is. Because both browsers run
   the exact same deterministic handleCardClick()/checkMatch() logic
   in js/game.js on the exact same sequence of flips, their boards —
   scores, matches, everything — stay in perfect lockstep without the
   server needing to know a single card symbol.

   See server/README.md for what this server is and how to deploy it.
   ============================================================ */

// Set this to your deployed relay's WebSocket URL once you've deployed
// server/ (see server/README.md) — e.g. 'wss://arcanum-mp.onrender.com'.
// Left blank, Duel Online tells the player it isn't set up yet instead
// of hanging on a connection that will never succeed.
const MP_SERVER_URL = '';

const MP_NICKNAME_KEY = 'arcanum_mp_nickname';
// Render's free tier spins a sleeping service back up on the next
// connection, which can take about a minute — this is generous on
// purpose so a cold server doesn't look "broken" mid-wake-up.
const MP_CONNECT_TIMEOUT_MS = 70_000;

const MP = {
  socket: null,
  youAre: null,          // 1 or 2 — which seat the server assigned us
  opponentName: null,
  status: 'idle',        // 'idle' | 'connecting' | 'queued' | 'matched' | 'error'
  connectTimeout: null,
};

function loadMpNickname() {
  try {
    const raw = crazySdk.data.getItem(MP_NICKNAME_KEY);
    if (raw && raw.trim()) return raw.trim().slice(0, 18);
  } catch (e) {}
  return '';
}

function saveMpNickname(name) {
  try { crazySdk.data.setItem(MP_NICKNAME_KEY, name); } catch (e) {}
}

// Returns 'You' / the opponent's name for whichever seat is asked about,
// or null outside Duel Online — used to relabel the existing duel HUD
// and victory modal without those files needing to know MP exists.
function mpSeatLabel(seat) {
  if (STATE.mode !== 'mp' || !MP.youAre) return null;
  return MP.youAre === seat ? 'You' : (MP.opponentName || 'Opponent');
}

function setMpStatus(status, text) {
  MP.status = status;
  const textEl = document.getElementById('mpStatusText');
  const spinner = document.getElementById('mpSpinner');
  const findBtn = document.getElementById('mpFindMatchBtn');
  const closeBtn = document.getElementById('mpCloseBtn');
  const nicknameRow = document.getElementById('mpNicknameRow');
  const searching = status === 'connecting' || status === 'queued';
  if (textEl) textEl.textContent = text;
  if (spinner) spinner.style.display = searching ? '' : 'none';
  if (findBtn) findBtn.style.display = (status === 'idle' || status === 'error') ? '' : 'none';
  if (closeBtn) closeBtn.textContent = searching ? 'Cancel' : 'Close';
  if (nicknameRow) nicknameRow.style.display = searching ? 'none' : '';
}

function openMpModal() {
  document.getElementById('mpModal').classList.add('active');
  const input = document.getElementById('mpNicknameInput');
  if (input && !input.value) input.value = loadMpNickname();
}

function closeMpModal() {
  document.getElementById('mpModal').classList.remove('active');
}

// Entry point — wired to the "Duel Online" rite button.
function startMultiplayerQueue() {
  openMpModal();
  if (!MP_SERVER_URL) {
    setMpStatus('error', "Duel Online isn't set up yet — no relay server has been deployed. See server/README.md.");
    return;
  }
  setMpStatus('idle', 'Find a real opponent for a live, real-time duel.');
}

function beginConnecting() {
  if (MP.socket) {
    try { MP.socket.close(); } catch (e) {}
    MP.socket = null;
  }

  const input = document.getElementById('mpNicknameInput');
  const nickname = (input && input.value.trim()) || 'Wanderer';
  saveMpNickname(nickname);

  setMpStatus('connecting', 'Connecting to the realm…');
  let socket;
  try {
    socket = new WebSocket(MP_SERVER_URL);
  } catch (e) {
    setMpStatus('error', "Couldn't reach the relay server. Check your connection and try again.");
    return;
  }
  MP.socket = socket;

  MP.connectTimeout = setTimeout(() => {
    if (MP.status === 'connecting' || MP.status === 'queued') {
      setMpStatus('error', "Couldn't find an opponent in time. The server may be waking up — try again in a moment.");
      try { socket.close(); } catch (e) {}
    }
  }, MP_CONNECT_TIMEOUT_MS);

  socket.addEventListener('open', () => {
    setMpStatus('queued', 'Searching for an opponent…');
    socket.send(JSON.stringify({ type: 'joinQueue', nickname }));
  });

  socket.addEventListener('message', (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch (e) { return; }
    handleMpMessage(msg);
  });

  socket.addEventListener('close', () => {
    if (MP.status === 'matched') {
      // A match was in progress — the game board (not this modal) shows
      // the "opponent left" state, handled in handleMpMessage/opponentLeft.
      return;
    }
    if (MP.status !== 'idle') {
      setMpStatus('error', 'Connection lost. Try again?');
    }
  });

  socket.addEventListener('error', () => {
    setMpStatus('error', "Couldn't reach the relay server. Check your connection and try again.");
  });
}

function cancelMultiplayerQueue() {
  if (MP.connectTimeout) { clearTimeout(MP.connectTimeout); MP.connectTimeout = null; }
  if (MP.socket) {
    try {
      if (MP.socket.readyState === WebSocket.OPEN) MP.socket.send(JSON.stringify({ type: 'leaveQueue' }));
      MP.socket.close();
    } catch (e) {}
  }
  MP.socket = null;
  closeMpModal();
  // No match was made yet, so falling back to the default rite is the
  // least surprising outcome rather than leaving the player on a mode
  // that can't actually start a game.
  revertToDefaultMode();
}

function revertToDefaultMode() {
  STATE.mode = 'classic';
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === 'classic'));
  const label = document.getElementById('ritesCurrentLabel');
  if (label) label.textContent = 'The Vigil';
}

// Closes any live Duel Online connection — called whenever the player
// navigates away from mp mode by any route (menu, reset, difficulty
// change) so the opponent finds out immediately rather than after a
// 30-second heartbeat timeout on the server.
function abandonMpIfActive() {
  if (MP.socket) {
    try { MP.socket.close(); } catch (e) {}
  }
  MP.socket = null;
  MP.youAre = null;
  MP.opponentName = null;
  if (MP.connectTimeout) { clearTimeout(MP.connectTimeout); MP.connectTimeout = null; }
}

// Used by the header's Reset/Leave control while a Duel Online match is
// in progress — forfeits the match (the opponent is told immediately)
// and drops the player into a fresh Classic game rather than a dead end.
function leaveMultiplayerMatch() {
  abandonMpIfActive();
  revertToDefaultMode();
  initGame();
}

function handleMpMessage(msg) {
  switch (msg.type) {
    case 'queued':
      setMpStatus('queued', 'Searching for an opponent…');
      break;

    case 'matchStart': {
      if (MP.connectTimeout) { clearTimeout(MP.connectTimeout); MP.connectTimeout = null; }
      MP.youAre = msg.youAre;
      MP.opponentName = msg.opponentName;
      MP.status = 'matched';
      STATE.mode = 'mp';
      STATE.mpSeed = msg.seed;
      closeMpModal();
      initGame();
      break;
    }

    case 'flip': {
      window._mpApplying = true;
      handleCardClick(msg.idx);
      window._mpApplying = false;
      break;
    }

    case 'turnChanged': {
      STATE.currentPlayer = msg.turn;
      if (typeof updateDuelHud === 'function') updateDuelHud();
      break;
    }

    case 'opponentLeft': {
      announceMpOpponentLeft();
      break;
    }

    case 'queueTimeout': {
      setMpStatus('error', "No opponents found right now. Try again in a bit?");
      MP.socket = null;
      break;
    }
  }
}

// A live match's opponent disconnected — lock the board, tell the
// player plainly, and let them start a fresh game with one click.
// Deliberately doesn't touch Aether/achievements/stats: the match
// never finished, so nothing should be recorded either way.
function announceMpOpponentLeft() {
  if (STATE.gameComplete || STATE.gameOver) return; // match had already finished normally
  STATE.gameOver = true;
  STATE.locked = true;
  if (STATE.timerInterval) { clearInterval(STATE.timerInterval); STATE.timerInterval = null; }
  MP.socket = null;

  document.getElementById('modalTitle').textContent = 'Opponent Left';
  document.getElementById('modalSubtitle').textContent = 'They disconnected — no result was recorded';
  const badgeSlot = document.getElementById('modalProfileBadge');
  if (badgeSlot) { badgeSlot.style.display = 'none'; badgeSlot.innerHTML = ''; }
  document.getElementById('modalChallengeResult').style.display = 'none';
  document.getElementById('finalMoves').textContent = STATE.moves;
  const mins = Math.floor(STATE.elapsedTime / 60);
  const secs = STATE.elapsedTime % 60;
  document.getElementById('finalTime').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  document.getElementById('finalStreak').textContent = STATE.maxStreak;
  const accuracyEl = document.getElementById('finalAccuracy');
  if (accuracyEl) accuracyEl.closest('div').style.display = 'none';
  const aetherEl = document.getElementById('finalAetherEarned');
  if (aetherEl) aetherEl.closest('div').style.display = 'none';
  const bestBadge = document.getElementById('modalPersonalBest');
  if (bestBadge) bestBadge.style.display = 'none';
  const challengeBtn = document.getElementById('challengeLinkBtn');
  if (challengeBtn) challengeBtn.style.display = 'none';
  const starsContainer = document.getElementById('starsContainer');
  if (starsContainer) starsContainer.innerHTML = '';

  document.getElementById('modalOverlay').classList.add('active');
}

// A player-initiated flip attempt during Duel Online: validated locally
// for a snappy no/instant response, then handed to the server, which is
// the actual authority — nothing is applied here until its 'flip' echo
// comes back (see handleMpMessage), keeping both boards in lockstep.
function attemptMpFlip(idx) {
  if (!MP.socket || MP.socket.readyState !== WebSocket.OPEN) return;
  if (STATE.locked || STATE.gameComplete || STATE.gameOver) return;
  if (STATE.flippedCards.includes(idx)) return;
  if (STATE.cards[idx] && STATE.cards[idx].matched) return;
  if (STATE.currentPlayer !== MP.youAre) return;
  MP.socket.send(JSON.stringify({ type: 'flip', idx }));
}

// Called by checkMatch() in game.js right after it resolves a pair, but
// only actually sent by whichever client owns the turn that just
// resolved — see the mp branches added to checkMatch().
function reportMpPairResult(matched) {
  if (!MP.socket || MP.socket.readyState !== WebSocket.OPEN) return;
  MP.socket.send(JSON.stringify({ type: 'pairResult', matched }));
}

const mpFindBtn = document.getElementById('mpFindMatchBtn');
const mpCloseBtn = document.getElementById('mpCloseBtn');
if (mpFindBtn) mpFindBtn.addEventListener('click', beginConnecting);
if (mpCloseBtn) mpCloseBtn.addEventListener('click', cancelMultiplayerQueue);
document.getElementById('mpModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) cancelMultiplayerQueue();
});
