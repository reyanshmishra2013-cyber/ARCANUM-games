/* ============================================================
   VS. AI DUEL — a bot opponent with an adjustable "memory":
   how many recently-revealed cards it can keep track of.
   ============================================================ */
const AI_MEMORY_KEY = 'arcanum_ai_memory';

function loadAiMemoryCapacity() {
  try {
    const raw = crazySdk.data.getItem(AI_MEMORY_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) return Math.max(2, Math.min(16, n));
    }
  } catch(e) {}
  return 6;
}

function saveAiMemoryCapacity(n) {
  try { crazySdk.data.setItem(AI_MEMORY_KEY, String(n)); } catch(e) {}
}

const aiMemorySlider = document.getElementById('aiMemorySlider');
const aiMemoryVal = document.getElementById('aiMemoryVal');
if (aiMemorySlider) {
  const initial = loadAiMemoryCapacity();
  aiMemorySlider.value = initial;
  if (aiMemoryVal) aiMemoryVal.textContent = initial;
  aiMemorySlider.addEventListener('input', (e) => {
    const n = Number(e.target.value);
    if (aiMemoryVal) aiMemoryVal.textContent = n;
    saveAiMemoryCapacity(n);
    STATE.aiMemoryCapacity = n; // takes effect next game
  });
}

// Records that the bot has now seen `idx`'s symbol. Capacity-limited FIFO —
// the oldest remembered card is forgotten once the bank is full, so a lower
// "memory" setting makes for a more forgetful (easier) opponent.
function recordAiMemory(idx) {
  const symbol = STATE.cards[idx].symbol;
  if (STATE.aiMemory.some(m => m.idx === idx)) return;
  STATE.aiMemory.push({ idx, symbol });
  while (STATE.aiMemory.length > STATE.aiMemoryCapacity) {
    STATE.aiMemory.shift();
  }
}

function forgetAiMemory(idx) {
  STATE.aiMemory = STATE.aiMemory.filter(m => m.idx !== idx);
}

function findKnownPair() {
  const bySymbol = {};
  STATE.aiMemory.forEach(m => {
    if (!STATE.cards[m.idx] || STATE.cards[m.idx].matched) return;
    (bySymbol[m.symbol] = bySymbol[m.symbol] || []).push(m.idx);
  });
  for (const sym in bySymbol) {
    const idxs = Array.from(new Set(bySymbol[sym]));
    if (idxs.length >= 2) return [idxs[0], idxs[1]];
  }
  return null;
}

function findKnownMatchFor(idx) {
  const symbol = STATE.cards[idx].symbol;
  const found = STATE.aiMemory.find(m => m.idx !== idx && m.symbol === symbol && STATE.cards[m.idx] && !STATE.cards[m.idx].matched);
  return found ? found.idx : null;
}

function pickRandomUnmatched(excludeIdx) {
  const candidates = STATE.cards
    .map((c, i) => i)
    .filter(i => !STATE.cards[i].matched && i !== excludeIdx && !STATE.flippedCards.includes(i));
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Called after every card resolution — no-ops unless it's genuinely the
// bot's turn with an empty, unlocked board.
function maybeTriggerAiTurn() {
  if (STATE.mode !== 'aiduel') return;
  if (STATE.currentPlayer !== 2) return;
  if (STATE.locked || STATE.gameComplete || STATE.gameOver || STATE.aiThinking) return;
  if (STATE.flippedCards.length !== 0) return;
  STATE.aiTurnTimeout = setTimeout(botTakeTurn, 500 + Math.random() * 400);
}

function botTakeTurn() {
  if (STATE.mode !== 'aiduel' || STATE.currentPlayer !== 2 || STATE.locked || STATE.gameComplete || STATE.gameOver) return;
  STATE.aiThinking = true;

  const knownPair = findKnownPair();
  let firstIdx, secondIdx;
  if (knownPair) {
    [firstIdx, secondIdx] = knownPair;
  } else {
    firstIdx = pickRandomUnmatched(-1);
    secondIdx = null;
  }

  if (firstIdx === undefined) { STATE.aiThinking = false; return; }

  window._aiActing = true;
  handleCardClick(firstIdx);
  window._aiActing = false;

  STATE.aiSecondFlipTimeout = setTimeout(() => {
    if (STATE.mode !== 'aiduel' || STATE.currentPlayer !== 2 || STATE.gameComplete || STATE.gameOver) { STATE.aiThinking = false; return; }
    if (secondIdx === null) {
      const known = findKnownMatchFor(firstIdx);
      secondIdx = known !== null ? known : pickRandomUnmatched(firstIdx);
    }
    if (secondIdx !== undefined) {
      window._aiActing = true;
      handleCardClick(secondIdx);
      window._aiActing = false;
    }
    STATE.aiThinking = false;
  }, 550 + Math.random() * 500);
}
