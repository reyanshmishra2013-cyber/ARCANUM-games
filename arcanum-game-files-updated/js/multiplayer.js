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
const MP_SERVER_URL = 'wss://arcanum-server-x48a.onrender.com';

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
  roomCode: null,          // this player's own waiting-room code, once queued
  pendingJoinRoomCode: null, // set when joining a *specific* friend's room instead of random matchmaking
  crazyUsername: null,      // signed-in CrazyGames username, when available — see openMpModal()
  lastMatchId: null,        // id of the most recently completed match, for rematch()
  rematchRoomCode: null,    // set right before reconnecting, to find the same opponent again
};

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

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

async function openMpModal() {
  document.getElementById('mpModal').classList.add('active');
  const input = document.getElementById('mpNicknameInput');
  if (!input) return;

  // CrazyGames' multiplayer guidelines require real CrazyGames usernames to
  // be shown in-game so friends can recognize each other — prefer that over
  // the freeform nickname whenever the player is signed in.
  if (crazySdk.user.isUserAccountAvailable) {
    try {
      const user = await crazySdk.user.getUser();
      if (user && user.username) {
        MP.crazyUsername = user.username;
        input.value = user.username;
        input.disabled = true;
        return;
      }
    } catch (e) {}
  }
  input.disabled = false;
  if (!input.value) input.value = loadMpNickname();
}

function closeMpModal() {
  document.getElementById('mpModal').classList.remove('active');
}

// Entry point — wired to the "Duel Online" rite button.
function startMultiplayerQueue() {
  if (typeof stopConfetti === 'function') stopConfetti();
  if (STATE.gameStarted) crazySdk.game.gameplayStop();
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
  const nickname = MP.crazyUsername || (input && input.value.trim()) || 'Wanderer';
  if (!MP.crazyUsername) saveMpNickname(nickname);

  setMpStatus('connecting', 'Connecting to the realm…');
  let socket;
  try {
    socket = new WebSocket(MP_SERVER_URL);
  } catch (e) {
    setMpStatus('error', "Couldn't connect. Check your connection and try again.");
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
    if (MP.pendingJoinRoomCode) {
      setMpStatus('queued', "Joining your friend's match…");
      socket.send(JSON.stringify({ type: 'joinRoom', roomCode: MP.pendingJoinRoomCode, nickname }));
    } else if (MP.rematchRoomCode) {
      setMpStatus('queued', 'Reconnecting with your last opponent…');
      socket.send(JSON.stringify({ type: 'joinRoom', roomCode: MP.rematchRoomCode, nickname }));
    } else {
      setMpStatus('queued', 'Searching for an opponent…');
      MP.roomCode = generateRoomCode();
      socket.send(JSON.stringify({ type: 'joinQueue', nickname, roomCode: MP.roomCode }));
    }
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
    setMpStatus('error', "Couldn't connect right now. Check your connection and try again.");
  });
}

function cancelMultiplayerQueue() {
  if (MP.socket && MP.socket.readyState === WebSocket.OPEN) {
    try { MP.socket.send(JSON.stringify({ type: 'leaveQueue' })); } catch (e) {}
  }
  abandonMpIfActive();
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
  MP.roomCode = null;
  MP.pendingJoinRoomCode = null;
  MP.rematchRoomCode = null;
  if (MP.connectTimeout) { clearTimeout(MP.connectTimeout); MP.connectTimeout = null; }
  crazySdk.game.leftRoom();
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
    case 'matchStart': {
      if (MP.connectTimeout) { clearTimeout(MP.connectTimeout); MP.connectTimeout = null; }
      MP.youAre = msg.youAre;
      MP.opponentName = msg.opponentName;
      MP.status = 'matched';
      STATE.mode = 'mp';
      STATE.mpSeed = msg.seed;
      closeMpModal();
      
     
      if (window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
          window.CrazyGames.SDK.game.updateRoom({
              roomId: String(msg.seed),
              isJoinable: true
          });
      }

      initGame();
      break;
    }

    case 'matchStart': {
      if (MP.connectTimeout) { clearTimeout(MP.connectTimeout); MP.connectTimeout = null; }
      MP.youAre = msg.youAre;
      MP.opponentName = msg.opponentName;
      MP.status = 'matched';
      MP.pendingJoinRoomCode = null;
      MP.rematchRoomCode = null;
      MP.lastMatchId = msg.matchId || null;
      crazySdk.game.updateRoom({ isJoinable: false });
      STATE.mode = 'mp';
      STATE.mpSeed = msg.seed;
      closeMpModal();
      initGame();
      break;
    }

    case 'roomNotFound': {
      // Either a friend's invited room is gone (already matched, or they
      // left), or we tried to reconnect for a rematch and our old opponent
      // hasn't clicked "Play Again" yet.
      const wasRematch = !!MP.rematchRoomCode && !MP.pendingJoinRoomCode;
      const waitCode = MP.pendingJoinRoomCode || MP.rematchRoomCode;
      MP.pendingJoinRoomCode = null;
      MP.rematchRoomCode = null;
      if (MP.socket && MP.socket.readyState === WebSocket.OPEN) {
        const input = document.getElementById('mpNicknameInput');
        const nickname = MP.crazyUsername || (input && input.value.trim()) || 'Wanderer';
        if (wasRematch) {
          // Wait under the same shared code instead of jumping straight to
          // a stranger — if our old opponent also clicks "Play Again" soon,
          // they'll land in this same room and we'll reconnect.
          setMpStatus('queued', 'Waiting for your last opponent to rejoin…');
          MP.roomCode = waitCode;
        } else {
          setMpStatus('queued', "That match already started — searching for a new opponent…");
          MP.roomCode = generateRoomCode();
        }
        MP.socket.send(JSON.stringify({ type: 'joinQueue', nickname, roomCode: MP.roomCode }));
      }
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
  crazySdk.game.leftRoom();

  try {
    document.getElementById('modalTitle').textContent = 'Opponent Left';
    document.getElementById('modalSubtitle').textContent = 'They disconnected — no result was recorded';
    const badgeSlot = document.getElementById('modalProfileBadge');
    if (badgeSlot) { badgeSlot.style.display = 'none'; badgeSlot.innerHTML = ''; }
    const challengeResultEl = document.getElementById('modalChallengeResult');
    if (challengeResultEl) challengeResultEl.style.display = 'none';
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
  } catch (e) {
    // A single missing/renamed element must never prevent the "opponent
    // left" notice itself from showing — see the matching note in
    // completeDuel()/completeGame() in game.js.
    console.error('announceMpOpponentLeft: modal population error', e);
  }

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

// Takes the player straight into a specific friend's waiting room instead
// of random matchmaking — used both when CrazyGames tells us about a join
// while we're already in the game, and when the game was freshly loaded
// from an invite link (see initMultiplayerSdkHooks below).
function joinSpecificMpRoom(roomCode) {
  if (typeof abandonMpIfActive === 'function') abandonMpIfActive();
  if (typeof stopConfetti === 'function') stopConfetti();
  if (STATE.gameStarted) crazySdk.game.gameplayStop();
  STATE.mode = 'mp';
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === 'mp'));
  const label = document.getElementById('ritesCurrentLabel');
  if (label) label.textContent = 'Duel Online';
  openMpModal();
  MP.pendingJoinRoomCode = roomCode;
  beginConnecting();
}

// CrazyGames calls this when a friend accepts an invite/clicks Join while
// this tab is already open — see js/sdk.js's addJoinRoomListener wrapper.
function handleCrazyJoinRoom(inviteParams) {
  const roomCode = inviteParams && inviteParams.roomCode;
  if (roomCode) joinSpecificMpRoom(roomCode);
}

// Called once from legal-tutorial.js right after crazySdk.init() resolves —
// wires up the parts of Duel Online that depend on the real CrazyGames SDK
// being ready: listening for friends joining mid-session, jumping straight
// into a friend's room if we were launched from an invite link, and
// honoring "Instant Multiplayer" launches from CrazyGames' Multiplayer UI.
function initMultiplayerSdkHooks() {
  crazySdk.game.addJoinRoomListener(handleCrazyJoinRoom);

  const invitedRoomCode = crazySdk.game.getInviteParam('roomCode');
  if (invitedRoomCode) {
    joinSpecificMpRoom(invitedRoomCode);
  } else if (crazySdk.game.isInstantMultiplayer) {
    // "The first player in a party should be placed directly into a new
    // private room" — skip the menu and go straight to a joinable match.
    startMultiplayerQueue();
    beginConnecting();
  }
}

// Play Again in Duel Online — CrazyGames' round-based-games guideline asks
// that players be able to keep playing with the same group without
// navigating back through their UI, so this tries to reconnect specifically
// with the last opponent (via a shared code derived from the finished
// match's id) before the roomNotFound handler above falls back to random
// matchmaking if they haven't also clicked "Play Again" yet.
function rematchMultiplayer() {
  MP.rematchRoomCode = MP.lastMatchId ? `rematch-${MP.lastMatchId}` : null;
  startMultiplayerQueue();
  beginConnecting();
}

const mpFindBtn = document.getElementById('mpFindMatchBtn');
const mpCloseBtn = document.getElementById('mpCloseBtn');
if (mpFindBtn) mpFindBtn.addEventListener('click', beginConnecting);
if (mpCloseBtn) mpCloseBtn.addEventListener('click', cancelMultiplayerQueue);
document.getElementById('mpModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) cancelMultiplayerQueue();
});
