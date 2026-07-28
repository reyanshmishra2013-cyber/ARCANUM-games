/* ============================================================
   ARCANUM — Duel Online relay server
   ============================================================
   What this is: a tiny matchmaking + turn-order referee for the
   game's "Duel Online" mode. It does NOT know the card symbols and
   does NOT run the memory-match game logic — both players' browsers
   already do that identically, because they both build their board
   from the same random seed (the exact mechanism the game already
   uses for Daily/Weekly Rite, where everyone gets the same board).

   This server's only jobs:
     1. Pair up two waiting sockets ("matchmaking").
     2. Hand both sides the same seed + who moves first.
     3. Relay "I flipped card N" messages between the two players,
        rejecting a flip if it's not that player's turn or the card
        is already used.
     4. Track whose turn it is (told the result of each pair by
        whichever client owns that turn) and broadcast turn changes.
     5. Tell the other player if their opponent disconnects.

   Deliberate simplification (documented, not hidden): because the
   deck isn't secret from the client, a determined player could open
   devtools and peek at unflipped symbols. For a free casual game
   that's an acceptable trade-off for keeping this server this small.
   A fully server-authoritative version (dealing cards server-side
   and only telling each client what's been revealed) is a natural
   follow-up if cheating turns out to matter in practice.
   ============================================================ */

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3001;
const MAX_NICKNAME_LEN = 18;
const QUEUE_TIMEOUT_MS = 60_000; // give up waiting for a second player after a minute

// ---- tiny HTTP server (also serves as Render's health check target) ----
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Arcanum Duel Online relay is running.\n');
});

const wss = new WebSocketServer({ server: httpServer });

let queue = []; // sockets waiting for an opponent, FIFO
const roomWaiters = new Map(); // roomCode -> waiting socket (for direct friend joins via CrazyGames invites)
const matches = new Map(); // matchId -> match state

let nextMatchId = 1;

function safeSend(socket, payload) {
  if (socket.readyState !== socket.OPEN) return;
  try { socket.send(JSON.stringify(payload)); } catch (e) { /* socket died mid-send, ignore */ }
}

function sanitizeNickname(raw) {
  const trimmed = (typeof raw === 'string' ? raw : '').trim().slice(0, MAX_NICKNAME_LEN);
  return trimmed || 'Wanderer';
}

function sanitizeRoomCode(raw) {
  if (typeof raw !== 'string') return null;
  // Client-generated — either a short alphanumeric code (generateRoomCode()
  // in js/multiplayer.js) or a "rematch-<matchId>" code for reconnecting
  // with a previous opponent.
  const trimmed = raw.trim().slice(0, 24);
  return /^[A-Za-z0-9-]+$/.test(trimmed) ? trimmed : null;
}

function makeSeed() {
  // Doesn't need to be cryptographically strong — it's a shuffle seed,
  // not a secret (see the module-level note on the deck not being secret).
  return `mp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function removeFromQueue(socket) {
  queue = queue.filter(s => s !== socket);
  if (socket.roomCode) {
    roomWaiters.delete(socket.roomCode);
    socket.roomCode = null;
  }
}

function tryMatchmake() {
  while (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();
    if (a.readyState !== a.OPEN) { queue.unshift(b); continue; }
    if (b.readyState !== b.OPEN) { queue.unshift(a); continue; }
    startMatch(a, b);
  }
}

function startMatch(socketA, socketB) {
  removeFromQueue(socketA);
  removeFromQueue(socketB);

  const matchId = String(nextMatchId++);
  const seed = makeSeed();
  const match = {
    id: matchId,
    players: [socketA, socketB], // index 0 = seat 1, index 1 = seat 2
    turn: 1,
    pendingIdx: [],
    matchedIdx: new Set(),
  };
  matches.set(matchId, match);
  socketA.matchId = matchId;
  socketA.seat = 1;
  socketB.matchId = matchId;
  socketB.seat = 2;

  safeSend(socketA, { type: 'matchStart', matchId, seed, youAre: 1, opponentName: socketB.nickname });
  safeSend(socketB, { type: 'matchStart', matchId, seed, youAre: 2, opponentName: socketA.nickname });
}

function endMatch(matchId, reason, disconnectedSeat) {
  const match = matches.get(matchId);
  if (!match) return;
  matches.delete(matchId);
  match.players.forEach((sock, i) => {
    const seat = i + 1;
    if (seat === disconnectedSeat) return;
    safeSend(sock, { type: 'opponentLeft', reason: reason || 'disconnected' });
    sock.matchId = null;
  });
}

wss.on('connection', (socket) => {
  socket.isAlive = true;
  socket.matchId = null;
  socket.seat = null;
  socket.nickname = 'Wanderer';
  socket.roomCode = null;

  socket.on('pong', () => { socket.isAlive = true; });

  socket.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'joinQueue') {
      socket.nickname = sanitizeNickname(msg.nickname);
      if (socket.matchId || queue.includes(socket)) return;
      socket.queuedAt = Date.now();
      queue.push(socket);
      const roomCode = sanitizeRoomCode(msg.roomCode);
      if (roomCode && !roomWaiters.has(roomCode)) {
        socket.roomCode = roomCode;
        roomWaiters.set(roomCode, socket);
      }
      safeSend(socket, { type: 'queued' });
      tryMatchmake();
      return;
    }

    if (msg.type === 'joinRoom') {
      // A friend accepted a CrazyGames invite (or clicked Join) for a
      // specific waiting player's room, rather than random matchmaking.
      socket.nickname = sanitizeNickname(msg.nickname);
      const roomCode = sanitizeRoomCode(msg.roomCode);
      const target = roomCode ? roomWaiters.get(roomCode) : null;
      if (!target || target === socket || target.readyState !== target.OPEN || target.matchId) {
        safeSend(socket, { type: 'roomNotFound' });
        return;
      }
      startMatch(target, socket);
      return;
    }

    if (msg.type === 'leaveQueue') {
      removeFromQueue(socket);
      return;
    }

    if (msg.type === 'flip') {
      const match = matches.get(socket.matchId);
      if (!match || socket.seat !== match.turn) return; // not your turn / not in a match
      const idx = Number(msg.idx);
      if (!Number.isInteger(idx) || idx < 0) return;
      if (match.matchedIdx.has(idx) || match.pendingIdx.includes(idx)) return;
      if (match.pendingIdx.length >= 2) return; // already awaiting this pair's result

      match.pendingIdx.push(idx);
      match.players.forEach(sock => safeSend(sock, { type: 'flip', idx, by: match.turn }));
      return;
    }

    if (msg.type === 'pairResult') {
      const match = matches.get(socket.matchId);
      if (!match || socket.seat !== match.turn) return; // only the active player's client reports
      if (match.pendingIdx.length !== 2) return; // nothing pending to resolve

      if (msg.matched) {
        match.pendingIdx.forEach(i => match.matchedIdx.add(i));
      } else {
        match.turn = match.turn === 1 ? 2 : 1;
      }
      match.pendingIdx = [];
      match.players.forEach(sock => safeSend(sock, { type: 'turnChanged', turn: match.turn }));
      return;
    }
  });

  socket.on('close', () => {
    removeFromQueue(socket);
    if (socket.matchId) endMatch(socket.matchId, 'disconnected', socket.seat);
  });

  socket.on('error', () => {
    // 'close' fires right after; cleanup happens there.
  });
});

// Drop dead connections (e.g. a laptop that went to sleep) so they don't
// linger in the queue or a match forever.
const heartbeat = setInterval(() => {
  wss.clients.forEach((socket) => {
    if (socket.isAlive === false) {
      removeFromQueue(socket);
      if (socket.matchId) endMatch(socket.matchId, 'timed out', socket.seat);
      return socket.terminate();
    }
    socket.isAlive = false;
    socket.ping();
  });
}, 30_000);

// Sockets that queue up and never get paired (e.g. the only player online)
// shouldn't wait forever — let them know so the client can show a message
// instead of spinning indefinitely.
setInterval(() => {
  const now = Date.now();
  queue.forEach((socket) => {
    if (now - socket.queuedAt > QUEUE_TIMEOUT_MS) {
      safeSend(socket, { type: 'queueTimeout' });
      removeFromQueue(socket);
    }
  });
}, 5_000);

wss.on('close', () => clearInterval(heartbeat));

httpServer.listen(PORT, () => {
  console.log(`Arcanum Duel Online relay listening on port ${PORT}`);
});
