/* ============================================================
   DAILY RITE — a seeded board that's identical for every player
   on a given calendar day, with its own streak/record tracking.
   ============================================================ */

// Local calendar date (not UTC) so "today" matches what the player sees on their clock.
function getDailyDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Deterministic string -> 32-bit seed (djb2-ish) feeding a mulberry32 PRNG,
// so the same date string always produces the same shuffle order everywhere.
function seededRandom(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAILY_KEY = 'arcanum_daily';

function defaultDailyRecord() {
  return {
    lastCompletedDate: null,
    currentStreak: 0,
    bestStreak: 0,
    bestMoves: null,
    bestTime: null,
    history: {}, // { 'YYYY-MM-DD': { moves, time } }
  };
}

function loadDailyRecord() {
  try {
    const raw = crazySdk.data.getItem(DAILY_KEY);
    if (raw) return Object.assign(defaultDailyRecord(), JSON.parse(raw));
  } catch(e) {}
  return defaultDailyRecord();
}

function saveDailyRecord() {
  try { crazySdk.data.setItem(DAILY_KEY, JSON.stringify(DAILY_RECORD)); } catch(e) {}
}

let DAILY_RECORD = loadDailyRecord();

function isYesterday(dateStr, todayStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const prev = new Date(y, m - 1, d);
  prev.setDate(prev.getDate() + 1);
  const py = prev.getFullYear();
  const pm = String(prev.getMonth() + 1).padStart(2, '0');
  const pd = String(prev.getDate()).padStart(2, '0');
  return `${py}-${pm}-${pd}` === todayStr;
}

// Called from recordGameEnd() whenever a Daily Rite game is won.
function recordDailyResult() {
  const today = getDailyDateString();
  if (DAILY_RECORD.lastCompletedDate === today) {
    // Already completed today — still let a better run update the record.
  } else if (DAILY_RECORD.lastCompletedDate && isYesterday(DAILY_RECORD.lastCompletedDate, today)) {
    DAILY_RECORD.currentStreak += 1;
  } else {
    DAILY_RECORD.currentStreak = 1;
  }
  DAILY_RECORD.lastCompletedDate = today;
  DAILY_RECORD.bestStreak = Math.max(DAILY_RECORD.bestStreak, DAILY_RECORD.currentStreak);

  const prevBest = DAILY_RECORD.history[today];
  if (!prevBest || STATE.moves < prevBest.moves || (STATE.moves === prevBest.moves && STATE.elapsedTime < prevBest.time)) {
    DAILY_RECORD.history[today] = { moves: STATE.moves, time: STATE.elapsedTime };
  }
  if (DAILY_RECORD.bestMoves === null || STATE.moves < DAILY_RECORD.bestMoves) DAILY_RECORD.bestMoves = STATE.moves;
  if (DAILY_RECORD.bestTime === null || STATE.elapsedTime < DAILY_RECORD.bestTime) DAILY_RECORD.bestTime = STATE.elapsedTime;

  // Leaderboard submission (Rite Points — see js/leaderboard.js). Safe
  // no-op until LEADERBOARD_ENCRYPTION_KEY is configured in sdk.js.
  if (typeof submitRitePoints === 'function') {
    const points = computeDailyRitePoints({
      moves: STATE.moves,
      elapsedTime: STATE.elapsedTime,
      streak: DAILY_RECORD.currentStreak,
    });
    submitRitePoints('daily', points);
  }

  // Trim history to the most recent 60 days to keep the save small.
  const dates = Object.keys(DAILY_RECORD.history).sort();
  while (dates.length > 60) {
    delete DAILY_RECORD.history[dates.shift()];
  }
  saveDailyRecord();
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Small hint shown nowhere critical — kept as a no-op hook point in case a
// future HUD banner wants to reflect "already completed today" state live.
function updateDailyPanelHint() {}

function renderChronicleDaily() {
  const el = document.getElementById('chronicleDaily');
  if (!el) return;
  const today = getDailyDateString();
  const completedToday = DAILY_RECORD.history[today];
  el.innerHTML = `
    <div class="daily-summary">
      <div class="daily-summary-row">
        <span>Today</span>
        <span>${completedToday ? `${completedToday.moves} moves · ${fmtTime(completedToday.time)}` : 'Not yet completed'}</span>
      </div>
      <div class="daily-summary-row">
        <span>Current Streak</span>
        <span>${DAILY_RECORD.currentStreak} day${DAILY_RECORD.currentStreak === 1 ? '' : 's'}</span>
      </div>
      <div class="daily-summary-row">
        <span>Best Streak</span>
        <span>${DAILY_RECORD.bestStreak} day${DAILY_RECORD.bestStreak === 1 ? '' : 's'}</span>
      </div>
      <div class="daily-summary-row">
        <span>Best Ever</span>
        <span>${DAILY_RECORD.bestMoves !== null ? `${DAILY_RECORD.bestMoves} moves · ${fmtTime(DAILY_RECORD.bestTime)}` : '—'}</span>
      </div>
    </div>
  `;
}
