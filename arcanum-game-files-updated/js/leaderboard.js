/* ============================================================
   RITE POINTS — the single combined score CrazyGames' leaderboard
   MVP allows per game (multiple leaderboards per game isn't
   supported yet, so Daily and Weekly Rite both feed this one).

   Design: each Rite completion earns a batch of points based on
   how well you did, and that batch is submitted as an incremental
   delta (CrazyGames sums submissions into a running total for the
   season on their end — see scoreLabel/isIncremental notes below).
   CrazyGames' own leaderboard season resets weekly (Mondays 7AM
   UTC), so "Rite Points" naturally reads as a weekly leaderboard
   without this game needing to manage that reset itself.

   Weekly Rite is worth more per completion (bigger board, once a
   week) than Daily Rite (smaller board, but repeatable every day),
   so a full week of daily play and a single weekly win are roughly
   comparable in value — tune the constants below to taste.

   Requested CrazyGames Developer Portal settings for this game:
     scoreLabel: 'POINTS'
     scoreSorting: 'DESC'       (higher Rite Points = better)
     isIncremental: true        (submissions add up over the season)
     minValue: 0
     maxValue: 999999
     leaderboardGuide: 'Complete Daily & Weekly Rites for points'
   ============================================================ */

const RITE_POINTS_CONFIG = {
  daily:  { minMoves: 8,  base: 250, movesPenalty: 6, timePenalty: 1, floor: 30, streakBonusPerDay: 8, streakBonusCap: 25 },
  weekly: { minMoves: 12, base: 600, movesPenalty: 8, timePenalty: 1, floor: 60 },
};

function computeDailyRitePoints({ moves, elapsedTime, streak }) {
  const c = RITE_POINTS_CONFIG.daily;
  const streakBonus = Math.min(streak || 0, c.streakBonusCap) * c.streakBonusPerDay;
  const raw = c.base - (moves - c.minMoves) * c.movesPenalty - elapsedTime * c.timePenalty + streakBonus;
  return Math.max(c.floor, Math.round(raw));
}

function computeWeeklyRitePoints({ moves, elapsedTime }) {
  const c = RITE_POINTS_CONFIG.weekly;
  const raw = c.base - (moves - c.minMoves) * c.movesPenalty - elapsedTime * c.timePenalty;
  return Math.max(c.floor, Math.round(raw));
}

// ---- Local "this week's total" tally, purely for the in-game display —
// CrazyGames tracks the authoritative leaderboard total on their side once
// LEADERBOARD_ENCRYPTION_KEY is configured (see js/sdk.js).
const RITE_POINTS_KEY = 'arcanum_rite_points';

function defaultRitePointsRecord() {
  return { week: null, total: 0, dailyEarned: 0, weeklyEarned: 0 };
}

function loadRitePointsRecord() {
  try {
    const raw = crazySdk.data.getItem(RITE_POINTS_KEY);
    if (raw) return Object.assign(defaultRitePointsRecord(), JSON.parse(raw));
  } catch(e) {}
  return defaultRitePointsRecord();
}

function saveRitePointsRecord() {
  try { crazySdk.data.setItem(RITE_POINTS_KEY, JSON.stringify(RITE_POINTS_RECORD)); } catch(e) {}
}

let RITE_POINTS_RECORD = loadRitePointsRecord();

// Called from daily.js / weekly.js after computing points for a completion.
function submitRitePoints(mode, points) {
  const week = getWeeklySeedString();
  if (RITE_POINTS_RECORD.week !== week) {
    RITE_POINTS_RECORD = { week, total: 0, dailyEarned: 0, weeklyEarned: 0 };
  }
  RITE_POINTS_RECORD.total += points;
  if (mode === 'daily') RITE_POINTS_RECORD.dailyEarned += points;
  if (mode === 'weekly') RITE_POINTS_RECORD.weeklyEarned += points;
  saveRitePointsRecord();
  if (typeof updateRitePointsChip === 'function') updateRitePointsChip();

  // Safe no-op until CrazyGames issues LEADERBOARD_ENCRYPTION_KEY (js/sdk.js).
  if (typeof crazySdk !== 'undefined' && crazySdk.user && typeof crazySdk.user.submitScore === 'function') {
    crazySdk.user.submitScore(points).catch(() => {});
  }
}

// In-game weekly Rite Points chip — CrazyGames' leaderboard MVP doesn't
// expose a "your current rank" read endpoint in the SDK, only score
// submission (see js/sdk.js), so this shows the same local weekly total the
// Chronicle tracks rather than a true cross-player rank. Once
// LEADERBOARD_ENCRYPTION_KEY is issued and a rank-lookup call becomes
// available, swap the text below for the real rank.
function updateRitePointsChip() {
  const el = document.getElementById('ritePointsVal');
  if (!el) return;
  const week = getWeeklySeedString();
  const record = RITE_POINTS_RECORD.week === week ? RITE_POINTS_RECORD : defaultRitePointsRecord();
  el.textContent = `${record.total} pts`;
}

document.addEventListener('DOMContentLoaded', updateRitePointsChip);
updateRitePointsChip();

const ritePointsStat = document.getElementById('ritePointsStat');
if (ritePointsStat) {
  ritePointsStat.addEventListener('click', () => {
    if (typeof renderChronicle === 'function') renderChronicle();
    document.getElementById('chronicleModal').classList.add('active');
  });
}

function renderChronicleRitePoints() {
  const el = document.getElementById('chronicleRitePoints');
  if (!el) return;
  const week = getWeeklySeedString();
  const record = RITE_POINTS_RECORD.week === week ? RITE_POINTS_RECORD : defaultRitePointsRecord();
  el.innerHTML = `
    <div class="daily-summary">
      <div class="daily-summary-row">
        <span>This Week</span>
        <span>${record.total} pts</span>
      </div>
      <div class="daily-summary-row">
        <span>From Daily Rite</span>
        <span>${record.dailyEarned} pts</span>
      </div>
      <div class="daily-summary-row">
        <span>From Weekly Rite</span>
        <span>${record.weeklyEarned} pts</span>
      </div>
    </div>
  `;
}
