/* ============================================================
   WEEKLY RITE — like Daily Rite, but a bigger seeded board shared
   by everyone for the calendar week (ISO week number), with its
   own personal-record tracking.
   ============================================================ */

// ISO 8601 week string, e.g. "2026-W30" — stable across the whole week
// regardless of which day the player logs in.
function getWeeklySeedString() {
  const d = new Date();
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNr = (target.getDay() + 6) % 7; // Monday = 0
  target.setDate(target.getDate() - dayNr + 3); // Thursday of this ISO week
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  const weekNumber = 1 + Math.round((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

const WEEKLY_KEY = 'arcanum_weekly';

function defaultWeeklyRecord() {
  return { lastWeek: null, bestMoves: null, bestTime: null, completedWeeks: 0 };
}

function loadWeeklyRecord() {
  try {
    const raw = crazySdk.data.getItem(WEEKLY_KEY);
    if (raw) return Object.assign(defaultWeeklyRecord(), JSON.parse(raw));
  } catch(e) {}
  return defaultWeeklyRecord();
}

function saveWeeklyRecord() {
  try { crazySdk.data.setItem(WEEKLY_KEY, JSON.stringify(WEEKLY_RECORD)); } catch(e) {}
}

let WEEKLY_RECORD = loadWeeklyRecord();

// Called from recordGameEnd() whenever a Weekly Rite game is won.
function recordWeeklyResult() {
  const week = getWeeklySeedString();
  if (WEEKLY_RECORD.lastWeek !== week) {
    WEEKLY_RECORD.completedWeeks += 1;
    WEEKLY_RECORD.lastWeek = week;
    WEEKLY_RECORD.bestMoves = STATE.moves;
    WEEKLY_RECORD.bestTime = STATE.elapsedTime;
  } else if (STATE.moves < WEEKLY_RECORD.bestMoves ||
             (STATE.moves === WEEKLY_RECORD.bestMoves && STATE.elapsedTime < WEEKLY_RECORD.bestTime)) {
    WEEKLY_RECORD.bestMoves = STATE.moves;
    WEEKLY_RECORD.bestTime = STATE.elapsedTime;
  }
  saveWeeklyRecord();

  // Leaderboard submission (Rite Points — see js/leaderboard.js). Safe
  // no-op until LEADERBOARD_ENCRYPTION_KEY is configured in sdk.js.
  if (typeof submitRitePoints === 'function') {
    const points = computeWeeklyRitePoints({ moves: STATE.moves, elapsedTime: STATE.elapsedTime });
    submitRitePoints('weekly', points);
  }
}

function renderChronicleWeekly() {
  const el = document.getElementById('chronicleWeekly');
  if (!el) return;
  const currentWeek = getWeeklySeedString();
  const completedThisWeek = WEEKLY_RECORD.lastWeek === currentWeek;
  el.innerHTML = `
    <div class="daily-summary">
      <div class="daily-summary-row">
        <span>This Week</span>
        <span>${completedThisWeek ? `${WEEKLY_RECORD.bestMoves} moves · ${fmtTime(WEEKLY_RECORD.bestTime)}` : 'Not yet completed'}</span>
      </div>
      <div class="daily-summary-row">
        <span>Weeks Completed</span>
        <span>${WEEKLY_RECORD.completedWeeks}</span>
      </div>
    </div>
  `;
}
