const ACHIEVEMENTS = {
  first_rite:         { name: 'First Rite',             desc: 'Complete your first game, in any Rite or Path.', icon: '✧' },
  perfect_memory:     { name: 'Perfect Memory',         desc: 'Clear a board without a single miss.', icon: '☉', unlocksTheme: 'sigils' },
  speed_demon:        { name: 'Speed Demon',            desc: "Win Chronomancer's Rite with 20 seconds or more still on the clock.", icon: '☄', unlocksTheme: 'zodiac' },
  iron_will:          { name: 'Iron Will',               desc: 'Complete Umbral Trial without losing a single sigil.', icon: '♦' },
  fates_favorite:     { name: "Fate's Favorite",         desc: "Win Fate's Gambit with moves still to spare.", icon: '⚹' },
  archmage_ascendant: { name: 'Archmage Ascendant',      desc: 'Complete an Archmage (6×6) board.', icon: '⚛' },
  streak_master:      { name: 'Streak Master',           desc: 'Reach a streak of 5 matches in a row.', icon: '★' },
  dedicated:          { name: 'Dedicated Seeker',        desc: 'Play 10 games.', icon: '◊' },
  century:            { name: 'Centurion of the Spheres', desc: 'Play 50 games.', icon: '❋' },
  flawless_master:    { name: 'Flawless Master',         desc: 'Complete an Archmage (6×6) board without a single miss.', icon: '✺' },
  night_owl:          { name: 'Night Owl',                desc: 'Complete a rite between midnight and 4am.', icon: '☾' },
  comeback:           { name: 'Comeback',                 desc: 'Win Umbral Trial after dropping to your last sigil.', icon: '♦' },
  celestial_devotee:  { name: 'Celestial Devotee',        desc: 'Win 15 games using the Celestial theme.', icon: '☉' },
  zodiac_devotee:     { name: 'Zodiac Devotee',           desc: 'Win 15 games using the Zodiac Wheel theme.', icon: '♈' },
  sigils_devotee:     { name: 'Sigils Devotee',           desc: 'Win 15 games using the Ornate Sigils theme.', icon: '❋' },
  daily_no_powerup:   { name: 'Unaided',                   desc: 'Win a Daily Rite without using any power-up.', icon: '🗓' },
  power_trio:         { name: 'Well Equipped',             desc: "Use both Seer's Glimpse and Fate's Pardon in the same game.", icon: '⚡' },
  sphinx_slayer:      { name: 'Riddle Solved',              desc: 'Beat the Sphinx (vs. AI Duel) with its memory set to 4 or lower.', icon: '🔮' },
  daily_streak_7:     { name: 'Seven Nights Running',       desc: 'Complete a Daily Rite 7 days in a row.', icon: '🗓' },
  weekly_victor:      { name: "Season's Champion",          desc: 'Complete the Weekly Rite.', icon: '⚔' },
  ascendant:          { name: 'Ascendant',                  desc: 'Ascend for the first time, resetting your Aether for a permanent bonus.', icon: '⚛' },
};

// ---- Lifetime progress (games played/won, achievements, unlocked themes) ----
const PROGRESS_KEY = 'arcanum_progress';

// Reconciles two progress objects (e.g. the pre-init local snapshot and the
// freshly-loaded cloud save) without ever silently discarding real progress
// from either side. Achievements/unlocked themes are monotonic — once
// earned, never lost — so we union them. Cumulative counters take the max
// of both sides: if the two saves diverged (played on two devices before
// either synced), this never regresses a player's numbers, at worst it's
// slightly generous. activeTheme prefers whichever value is actually
// unlocked in the merged result.
function mergeProgress(a, b) {
  const merged = defaultProgress();
  merged.gamesPlayed = Math.max(a.gamesPlayed || 0, b.gamesPlayed || 0);
  merged.gamesWon = Math.max(a.gamesWon || 0, b.gamesWon || 0);
  merged.totalMoves = Math.max(a.totalMoves || 0, b.totalMoves || 0);
  merged.bestStreakEver = Math.max(a.bestStreakEver || 0, b.bestStreakEver || 0);
  merged.aether = Math.max(a.aether || 0, b.aether || 0);
  merged.achievements = Array.from(new Set([...(a.achievements || []), ...(b.achievements || [])]));
  merged.unlockedThemes = Array.from(new Set([...(a.unlockedThemes || []), ...(b.unlockedThemes || [])]));
  merged.themeWins = {};
  Object.keys(THEMES).forEach(id => {
    const av = (a.themeWins && Number.isFinite(a.themeWins[id])) ? a.themeWins[id] : 0;
    const bv = (b.themeWins && Number.isFinite(b.themeWins[id])) ? b.themeWins[id] : 0;
    merged.themeWins[id] = Math.max(av, bv);
  });
  const preferredActive = b.activeTheme || a.activeTheme;
  merged.activeTheme = merged.unlockedThemes.includes(preferredActive) ? preferredActive : 'celestial';

  merged.ownedCosmetics = {};
  Object.keys(SHOP_ITEMS).forEach(cat => {
    const av = (a.ownedCosmetics && Array.isArray(a.ownedCosmetics[cat])) ? a.ownedCosmetics[cat] : ['default'];
    const bv = (b.ownedCosmetics && Array.isArray(b.ownedCosmetics[cat])) ? b.ownedCosmetics[cat] : ['default'];
    merged.ownedCosmetics[cat] = Array.from(new Set([...av, ...bv]));
  });
  merged.cosmetics = {};
  Object.keys(SHOP_ITEMS).forEach(cat => {
    const preferred = (b.cosmetics && b.cosmetics[cat]) || (a.cosmetics && a.cosmetics[cat]) || 'default';
    merged.cosmetics[cat] = merged.ownedCosmetics[cat].includes(preferred) ? preferred : 'default';
  });
  merged.prestige = { level: Math.max((a.prestige && a.prestige.level) || 0, (b.prestige && b.prestige.level) || 0) };

  return merged;
}

function defaultProgress() {
  const themeWins = {};
  Object.keys(THEMES).forEach(id => { themeWins[id] = 0; });
  const ownedCosmetics = {};
  const cosmetics = {};
  Object.keys(SHOP_ITEMS).forEach(cat => {
    ownedCosmetics[cat] = ['default'];
    cosmetics[cat] = 'default';
  });
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    totalMoves: 0,
    bestStreakEver: 0,
    achievements: [],
    unlockedThemes: ['celestial'],
    activeTheme: 'celestial',
    aether: 0,
    themeWins,
    ownedCosmetics,
    cosmetics,
    prestige: { level: 0 },
  };
}

function loadProgress() {
  try {
    const raw = crazySdk.data.getItem(PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge themeWins per-key (not a wholesale overwrite) so a save from
      // before a new theme existed doesn't leave that theme's count
      // undefined — which would turn `PROGRESS.themeWins[theme]++` into NaN
      // the first time it's touched, permanently blocking that Devotee
      // achievement until the save is cleared.
      const merged = Object.assign(defaultProgress(), parsed);
      merged.themeWins = Object.assign(defaultProgress().themeWins, parsed.themeWins || {});
      merged.ownedCosmetics = Object.assign(defaultProgress().ownedCosmetics, parsed.ownedCosmetics || {});
      merged.cosmetics = Object.assign(defaultProgress().cosmetics, parsed.cosmetics || {});
      merged.prestige = Object.assign(defaultProgress().prestige, parsed.prestige || {});
      return merged;
    }
  } catch(e) {}
  return defaultProgress();
}

function saveProgress() {
  try { crazySdk.data.setItem(PROGRESS_KEY, JSON.stringify(PROGRESS)); } catch(e) {}
}

let PROGRESS = loadProgress();

let toastQueue = [];
let toastShowing = false;
function queueAchievementToast(ach) {
  toastQueue.push(ach);
  if (!toastShowing) showNextToast();
}
function showNextToast() {
  if (toastQueue.length === 0) { toastShowing = false; return; }
  toastShowing = true;
  const ach = toastQueue.shift();
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';

  // Built via textContent (not innerHTML) because ach.name can come from an
  // untrusted source (the player's CrazyGames account username in the
  // "Welcome back" toast) — never interpolate that into markup.
  const iconEl = document.createElement('span');
  iconEl.className = 'achievement-toast-icon';
  iconEl.textContent = `${ach.icon}\uFE0E`;

  const textWrap = document.createElement('div');
  const titleEl = document.createElement('div');
  titleEl.className = 'achievement-toast-title';
  titleEl.textContent = ach.title || 'Achievement Unlocked';
  const nameEl = document.createElement('div');
  nameEl.className = 'achievement-toast-name';
  nameEl.textContent = ach.name;
  textWrap.appendChild(titleEl);
  textWrap.appendChild(nameEl);

  toast.appendChild(iconEl);
  toast.appendChild(textWrap);
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toast.remove(); showNextToast(); }, 400);
  }, 2600);
}

function unlockAchievement(id) {
  if (PROGRESS.achievements.includes(id)) return;
  PROGRESS.achievements.push(id);
  const ach = ACHIEVEMENTS[id];
  if (ach.unlocksTheme && !PROGRESS.unlockedThemes.includes(ach.unlocksTheme)) {
    PROGRESS.unlockedThemes.push(ach.unlocksTheme);
  }
  saveProgress();
  queueAchievementToast(ach);
  renderThemeBar();
}

// Aether earned at the end of a game — scaled by board size and performance,
// with partial credit on a loss so a losing run still isn't a total waste.
function calcAetherEarned(won) {
  const diffMult = { apprentice: 1, adept: 1.4, master: 2 }[effectiveDifficultyKey()] || (effectiveDifficultyKey() === 'custom' ? 1.2 : 1);
  const perPair = 4;
  let earned = STATE.matchedCount * perPair * diffMult;
  if (won) {
    earned += 15 * diffMult;          // completion bonus
    earned += STATE.maxStreak * 2;    // reward clean streaks
  } else {
    earned *= 0.6;                    // partial credit for progress made before losing
  }
  const prestigeLevel = (PROGRESS.prestige && PROGRESS.prestige.level) || 0;
  earned *= 1 + prestigeLevel * 0.1;  // +10% Aether per Ascension, permanent
  return Math.max(0, Math.round(earned));
}

function updateAetherDisplay() {
  const el = document.getElementById('aetherVal');
  if (el) el.textContent = PROGRESS.aether;
}

// Called at the end of every game, win or lose, to update lifetime stats and check achievements
function recordGameEnd(won) {
  const diff = DIFFICULTIES[effectiveDifficultyKey()];
  PROGRESS.gamesPlayed++;
  if (won) PROGRESS.gamesWon++;
  PROGRESS.totalMoves += STATE.moves;
  if (STATE.maxStreak > PROGRESS.bestStreakEver) PROGRESS.bestStreakEver = STATE.maxStreak;

  const earned = calcAetherEarned(won);
  PROGRESS.aether += earned;
  saveProgress();
  updateAetherDisplay();
  showAetherGain(earned);

  unlockAchievement('first_rite');
  if (PROGRESS.gamesPlayed >= 10) unlockAchievement('dedicated');
  if (PROGRESS.gamesPlayed >= 50) unlockAchievement('century');
  if (STATE.maxStreak >= 5) unlockAchievement('streak_master');

  if (won && STATE.mode === 'daily' && typeof recordDailyResult === 'function') {
    recordDailyResult();
  }
  if (won && STATE.mode === 'weekly' && typeof recordWeeklyResult === 'function') {
    recordWeeklyResult();
  }

  if (won) {
    if (STATE.moves === diff.pairs) unlockAchievement('perfect_memory');
    if (effectiveDifficultyKey() === 'master') unlockAchievement('archmage_ascendant');
    if (STATE.mode === 'timed' && STATE.timeRemaining >= 20) unlockAchievement('speed_demon');
    if (STATE.mode === 'hard' && STATE.lives === MAX_LIVES) unlockAchievement('iron_will');
    if (STATE.mode === 'oracle' && STATE.moves < STATE.moveLimit) unlockAchievement('fates_favorite');
  }

  checkNewAchievements(won);
  return earned;
}

// Checks the 6 newer achievements — kept separate from the original set above
// so the win-condition logic for each is easy to scan on its own.
function checkNewAchievements(won) {
  const diff = DIFFICULTIES[effectiveDifficultyKey()];

  if (won) {
    if (effectiveDifficultyKey() === 'master' && STATE.moves === diff.pairs) {
      unlockAchievement('flawless_master');
    }
    if (STATE.mode === 'hard' && STATE.wasAtOneLife) {
      unlockAchievement('comeback');
    }
    if (STATE.powerupsUsed && STATE.powerupsUsed.size >= 2) {
      unlockAchievement('power_trio');
    }
    if (STATE.mode === 'daily' && (!STATE.powerupsUsed || STATE.powerupsUsed.size === 0)) {
      unlockAchievement('daily_no_powerup');
    }
    if (STATE.mode === 'daily' && typeof DAILY_RECORD !== 'undefined' && DAILY_RECORD.currentStreak >= 7) {
      unlockAchievement('daily_streak_7');
    }
    if (STATE.mode === 'weekly') {
      unlockAchievement('weekly_victor');
    }
    if (STATE.mode === 'aiduel' && STATE.p1Pairs > STATE.p2Pairs && STATE.aiMemoryCapacity <= 4) {
      unlockAchievement('sphinx_slayer');
    }

    const theme = PROGRESS.activeTheme;
    if (!PROGRESS.themeWins) PROGRESS.themeWins = {};
    if (!Number.isFinite(PROGRESS.themeWins[theme])) PROGRESS.themeWins[theme] = 0;
    PROGRESS.themeWins[theme]++;
    saveProgress();
    if (PROGRESS.themeWins[theme] >= 15) {
      unlockAchievement(`${theme}_devotee`);
    }
  }

  const hour = new Date().getHours();
  if (hour >= 0 && hour < 4) unlockAchievement('night_owl');
}

function renderThemeBar() {
  const bar = document.getElementById('themeBar');
  bar.querySelectorAll('[data-theme]').forEach(b => b.remove());
  Object.keys(THEMES).forEach(id => {
    const unlocked = PROGRESS.unlockedThemes.includes(id);
    const btn = document.createElement('button');
    btn.className = 'btn rite-option' + (id === PROGRESS.activeTheme ? ' active' : '') + (unlocked ? '' : ' locked');
    btn.dataset.theme = id;

    let desc;
    if (unlocked) {
      const devoteeId = `${id}_devotee`;
      const hasDevotee = PROGRESS.achievements.includes(devoteeId);
      const wins = (PROGRESS.themeWins && PROGRESS.themeWins[id]) || 0;
      desc = (!hasDevotee && ACHIEVEMENTS[devoteeId]) ? `${Math.min(wins, 15)}/15 wins toward Devotee` : 'Unlocked';
    } else {
      const cost = THEMES[id].aetherCost;
      desc = cost ? `Locked · ${cost}✦ to unlock` : 'Locked';
    }
    btn.innerHTML = `<span class="rite-option-name">${THEMES[id].name}</span><span class="rite-option-desc">${desc}</span>`;
    bar.appendChild(btn);
  });
  const sigilsLabel = document.getElementById('sigilsCurrentLabel');
  if (sigilsLabel) sigilsLabel.textContent = THEMES[PROGRESS.activeTheme].name;
}

document.getElementById('themeBar').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-theme]');
  if (!btn) return;
  const id = btn.dataset.theme;
  if (!PROGRESS.unlockedThemes.includes(id)) {
    const cost = THEMES[id].aetherCost;
    if (cost && PROGRESS.aether >= cost) {
      PROGRESS.aether -= cost;
      PROGRESS.unlockedThemes.push(id);
      saveProgress();
      updateAetherDisplay();
      queueAchievementToast({ icon: '✦', title: 'Sigil Unlocked', name: `${THEMES[id].name} — spent ${cost} Aether` });
      renderThemeBar();
    } else {
      const lockedAch = Object.values(ACHIEVEMENTS).find(a => a.unlocksTheme === id);
      const shortfall = cost ? ` (need ${cost - PROGRESS.aether} more Aether)` : '';
      queueAchievementToast({
        icon: '◊',
        title: 'Sigil Locked',
        name: lockedAch ? `Earn "${lockedAch.name}"${cost ? ` or spend ${cost} Aether` : ''}${shortfall}` : 'Not yet unlocked',
      });
    }
    return;
  }
  if (PROGRESS.activeTheme === id) {
    document.getElementById('sigilsModal').classList.remove('active');
    return;
  }
  PROGRESS.activeTheme = id;
  saveProgress();
  renderThemeBar();
  document.getElementById('sigilsModal').classList.remove('active');
  if (STATE.gameStarted) crazySdk.game.gameplayStop();
  initGame();
});

function renderChronicle() {
  const winRate = PROGRESS.gamesPlayed ? Math.round((PROGRESS.gamesWon / PROGRESS.gamesPlayed) * 100) : 0;
  document.getElementById('chronicleStats').innerHTML = `
    <div><div class="modal-stat-value">${PROGRESS.gamesPlayed}</div><div class="modal-stat-label">Played</div></div>
    <div><div class="modal-stat-value">${PROGRESS.gamesWon}</div><div class="modal-stat-label">Won</div></div>
    <div><div class="modal-stat-value">${winRate}%</div><div class="modal-stat-label">Win Rate</div></div>
    <div><div class="modal-stat-value">${PROGRESS.bestStreakEver}</div><div class="modal-stat-label">Best Streak</div></div>
    <div><div class="modal-stat-value">${PROGRESS.totalMoves}</div><div class="modal-stat-label">Total Moves</div></div>
  `;

  const bestsEl = document.getElementById('chronicleBests');
  if (bestsEl) {
    const bestData = loadBestStats();
    const diffOrder = [['apprentice', 'Initiate · 4×4'], ['adept', 'Seeker · 6×4'], ['master', 'Archmage · 6×6']];
    bestsEl.innerHTML = diffOrder.map(([id, label]) => {
      const b = bestData[id];
      const mins = b && b.time !== undefined ? Math.floor(b.time / 60) : 0;
      const secs = b && b.time !== undefined ? b.time % 60 : 0;
      const line = b
        ? `Best: ${b.moves ?? '—'} moves · ${mins}:${secs.toString().padStart(2, '0')} · streak ${b.streak ?? 0}`
        : 'No rite completed yet';
      return `
        <div class="best-stat-row">
          <span class="best-stat-diff">${label}</span>
          <span class="best-stat-line">${line}</span>
        </div>
      `;
    }).join('');
  }

  if (typeof renderChronicleDaily === 'function') renderChronicleDaily();
  if (typeof renderChronicleWeekly === 'function') renderChronicleWeekly();
  if (typeof renderChronicleRitePoints === 'function') renderChronicleRitePoints();
  renderPrestigeSection();

  const list = document.getElementById('achievementList');
  list.innerHTML = Object.entries(ACHIEVEMENTS).map(([id, ach]) => {
    const unlocked = PROGRESS.achievements.includes(id);
    return `
      <div class="achievement-row ${unlocked ? '' : 'locked'}">
        <div class="achievement-icon">${ach.icon}\uFE0E</div>
        <div>
          <span class="achievement-name">${ach.name}</span>
          <span class="achievement-desc">${ach.desc}</span>
        </div>
      </div>
    `;
  }).join('');
}

// "ascendant" is excluded from the eligibility check since it's only
// granted BY ascending — including it would make Ascend permanently
// unreachable (need the achievement to ascend, need to ascend to get it).
function isAscendEligible() {
  const requiredAchievements = Object.keys(ACHIEVEMENTS).filter(id => id !== 'ascendant');
  const hasAllAchievements = requiredAchievements.every(id => PROGRESS.achievements.includes(id));
  const hasAllThemes = Object.keys(THEMES).every(id => PROGRESS.unlockedThemes.includes(id));
  return hasAllAchievements && hasAllThemes;
}

function renderPrestigeSection() {
  const section = document.getElementById('prestigeSection');
  if (!section) return;
  const level = (PROGRESS.prestige && PROGRESS.prestige.level) || 0;
  document.getElementById('prestigeRankLabel').textContent = prestigeTitle(level);
  document.getElementById('prestigeBonusLabel').textContent = `+${level * 10}%`;

  const eligible = isAscendEligible();
  const ascendBtn = document.getElementById('ascendBtn');
  const note = document.getElementById('prestigeNote');
  section.style.display = (level > 0 || eligible) ? '' : 'none';
  ascendBtn.style.display = eligible ? '' : 'none';
  note.textContent = eligible
    ? 'Every sigil and achievement is yours. Ascend to reset your Aether for a permanent +10% earn rate and a new rank.'
    : (level > 0 ? 'Unlock every theme and achievement to Ascend again.' : '');
}

document.getElementById('ascendBtn').addEventListener('click', () => {
  if (!isAscendEligible()) return;
  if (!window.confirm('Ascend now? Your Aether balance will reset to 0 in exchange for a permanent +10% Aether earn rate and a new rank.')) return;
  PROGRESS.prestige.level = (PROGRESS.prestige.level || 0) + 1;
  PROGRESS.aether = 0;
  saveProgress();
  updateAetherDisplay();
  unlockAchievement('ascendant');
  renderChronicle();
  queueAchievementToast({ icon: '⚛', title: 'Ascended', name: `You are now ${prestigeTitle(PROGRESS.prestige.level)}` });
});

document.getElementById('chronicleBtn').addEventListener('click', () => {
  renderChronicle();
  document.getElementById('chronicleModal').classList.add('active');
});
document.getElementById('chronicleCloseBtn').addEventListener('click', () => {
  document.getElementById('chronicleModal').classList.remove('active');
});
document.getElementById('chronicleModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) document.getElementById('chronicleModal').classList.remove('active');
});

