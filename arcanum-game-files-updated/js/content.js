// Sigils used as card faces (celestial / alchemical glyphs)
// Sigil themes — celestial/alchemical glyph sets, some unlocked via achievements
const THEMES = {
  celestial: {
    name: 'Celestial',
    symbols: ['☉','☽','★','✦','♄','♃','♂','♀','☿','♆','♅','⚸','⚹','✧','☄','❋','⚛','◊'].map(s => s + '\uFE0E'),
  },
  zodiac: {
    name: 'Zodiac Wheel',
    unlockedBy: 'speed_demon',
    aetherCost: 400,
    symbols: ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','☀','☾','♁','⛎','☍','☌'].map(s => s + '\uFE0E'),
  },
  sigils: {
    name: 'Ornate Sigils',
    unlockedBy: 'perfect_memory',
    aetherCost: 400,
    symbols: ['❀','❁','❂','❃','❄','❅','❆','❇','❈','❉','❊','❋','✤','✥','✦','✧','●','◆'].map(s => s + '\uFE0E'),
  },
};

// Hand-illustrated vector icons for the default Celestial theme (100x100 viewBox,
// currentColor so they inherit the card's gold/coral color + glow automatically).
// Keyed by the base glyph before the \uFE0E text-presentation suffix is appended.
const ICON_PATHS = {
  celestial: {
    '☉': '<circle cx="50" cy="50" r="16" fill="currentColor"/><g stroke="currentColor" stroke-width="6" stroke-linecap="round"><line x1="50" y1="6" x2="50" y2="18"/><line x1="50" y1="82" x2="50" y2="94"/><line x1="6" y1="50" x2="18" y2="50"/><line x1="82" y1="50" x2="94" y2="50"/><line x1="19" y1="19" x2="27" y2="27"/><line x1="73" y1="73" x2="81" y2="81"/><line x1="81" y1="19" x2="73" y2="27"/><line x1="19" y1="81" x2="27" y2="73"/></g>',
    '☽': '<path fill-rule="evenodd" fill="currentColor" d="M 50,50 m -32,0 a 32,32 0 1,0 64,0 a 32,32 0 1,0 -64,0 Z M 66,50 m -26,0 a 26,26 0 1,0 52,0 a 26,26 0 1,0 -52,0 Z"/>',
    '★': '<polygon points="50,6 61,37 94,37 67,57 78,90 50,70 22,90 33,57 6,37 39,37" fill="currentColor"/>',
    '✦': '<path d="M50,4 L58,42 L96,50 L58,58 L50,96 L42,58 L4,50 L42,42 Z" fill="currentColor"/>',
    '♄': '<circle cx="46" cy="46" r="20" fill="currentColor"/><ellipse cx="46" cy="50" rx="38" ry="10" fill="none" stroke="currentColor" stroke-width="5" transform="rotate(-18 46 50)"/>',
    '♃': '<circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="6"/><line x1="20" y1="42" x2="80" y2="42" stroke="currentColor" stroke-width="5"/><line x1="20" y1="58" x2="80" y2="58" stroke="currentColor" stroke-width="5"/>',
    '♂': '<circle cx="42" cy="58" r="22" fill="none" stroke="currentColor" stroke-width="7"/><line x1="58" y1="42" x2="86" y2="14" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><polyline points="62,14 86,14 86,38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
    '♀': '<circle cx="50" cy="38" r="22" fill="none" stroke="currentColor" stroke-width="7"/><line x1="50" y1="60" x2="50" y2="92" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><line x1="34" y1="78" x2="66" y2="78" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    '☿': '<path d="M36,16 Q50,0 64,16" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="42" r="20" fill="none" stroke="currentColor" stroke-width="7"/><line x1="50" y1="62" x2="50" y2="90" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><line x1="36" y1="76" x2="64" y2="76" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    '♆': '<line x1="50" y1="28" x2="50" y2="88" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><line x1="30" y1="70" x2="70" y2="70" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M28,10 Q28,34 50,34 Q72,34 72,10" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    '♅': '<line x1="50" y1="18" x2="50" y2="68" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><line x1="24" y1="36" x2="76" y2="36" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="24" cy="36" r="8" fill="currentColor"/><circle cx="76" cy="36" r="8" fill="currentColor"/><circle cx="50" cy="82" r="12" fill="none" stroke="currentColor" stroke-width="6"/>',
    '⚸': '<path fill-rule="evenodd" fill="currentColor" d="M 34,32 m -20,0 a 20,20 0 1,0 40,0 a 20,20 0 1,0 -40,0 Z M 46,32 m -16,0 a 16,16 0 1,0 32,0 a 16,16 0 1,0 -32,0 Z"/><line x1="66" y1="55" x2="66" y2="90" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><line x1="50" y1="72" x2="82" y2="72" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    '⚹': '<polygon points="50,10 85,72 15,72" fill="none" stroke="currentColor" stroke-width="6"/><polygon points="50,90 15,28 85,28" fill="none" stroke="currentColor" stroke-width="6"/>',
    '✧': '<path d="M50,4 L58,42 L96,50 L58,58 L50,96 L42,58 L4,50 L42,42 Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>',
    '☄': '<circle cx="66" cy="34" r="14" fill="currentColor"/><path d="M56,44 Q30,60 8,92 Q40,74 60,56 Z" fill="currentColor" opacity="0.55"/>',
    '❋': '<g fill="currentColor"><ellipse cx="50" cy="22" rx="8" ry="16"/><ellipse cx="50" cy="22" rx="8" ry="16" transform="rotate(60 50 50)"/><ellipse cx="50" cy="22" rx="8" ry="16" transform="rotate(120 50 50)"/><ellipse cx="50" cy="22" rx="8" ry="16" transform="rotate(180 50 50)"/><ellipse cx="50" cy="22" rx="8" ry="16" transform="rotate(240 50 50)"/><ellipse cx="50" cy="22" rx="8" ry="16" transform="rotate(300 50 50)"/><circle cx="50" cy="50" r="9"/></g>',
    '⚛': '<circle cx="50" cy="50" r="6" fill="currentColor"/><ellipse cx="50" cy="50" rx="42" ry="16" fill="none" stroke="currentColor" stroke-width="5"/><ellipse cx="50" cy="50" rx="42" ry="16" fill="none" stroke="currentColor" stroke-width="5" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="42" ry="16" fill="none" stroke="currentColor" stroke-width="5" transform="rotate(120 50 50)"/>',
    '◊': '<polygon points="50,8 88,50 50,92 12,50" fill="none" stroke="currentColor" stroke-width="6"/><polygon points="50,26 70,50 50,74 30,50" fill="currentColor" opacity="0.55"/>',
  },

  // Hand-illustrated Zodiac Wheel glyphs — the 12 signs plus 6 celestial fillers,
  // drawn in the same stroke-weight / currentColor language as Celestial above.
  zodiac: {
    '♈': '<path d="M22,20 Q22,50 40,58 Q50,62 50,74" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M78,20 Q78,50 60,58 Q50,62 50,74" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><line x1="50" y1="74" x2="50" y2="92" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    '♉': '<circle cx="50" cy="64" r="24" fill="none" stroke="currentColor" stroke-width="7"/><path d="M24,18 Q24,42 50,42 Q76,42 76,18" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    '♊': '<g stroke="currentColor" stroke-width="7" stroke-linecap="round"><line x1="24" y1="16" x2="76" y2="16"/><line x1="24" y1="84" x2="76" y2="84"/><line x1="34" y1="16" x2="34" y2="84"/><line x1="66" y1="16" x2="66" y2="84"/></g>',
    '♋': '<circle cx="30" cy="62" r="14" fill="none" stroke="currentColor" stroke-width="6"/><path d="M30,48 Q30,20 62,20" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="70" cy="38" r="14" fill="none" stroke="currentColor" stroke-width="6"/><path d="M70,52 Q70,80 38,80" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    '♌': '<circle cx="34" cy="30" r="16" fill="none" stroke="currentColor" stroke-width="6"/><path d="M34,46 Q34,66 54,66 Q74,66 74,50 Q74,36 62,36 Q54,36 54,48 Q54,60 68,60 Q80,60 80,74" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    '♍': '<g fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"><path d="M20,18 L20,58 Q20,72 32,72"/><path d="M38,18 L38,58 Q38,72 50,72"/><path d="M56,18 L56,58 Q56,72 68,72 Q80,72 80,60 Q80,48 68,48 Q60,48 60,56"/></g><line x1="68" y1="72" x2="68" y2="92" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    '♎': '<line x1="16" y1="34" x2="84" y2="34" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M22,66 Q22,44 50,44 Q78,44 78,66" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><line x1="16" y1="80" x2="84" y2="80" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    '♏': '<g fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"><path d="M18,18 L18,58 Q18,72 30,72"/><path d="M36,18 L36,58 Q36,72 48,72"/><path d="M54,18 L54,58 Q54,72 66,72 L78,72"/></g><path d="M78,64 L90,72 L78,80" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    '♐': '<line x1="20" y1="80" x2="76" y2="24" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><polyline points="54,20 80,20 80,46" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><line x1="38" y1="46" x2="54" y2="62" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    '♑': '<path d="M20,24 Q20,54 38,54 Q50,54 50,40 L50,80" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M50,60 Q60,50 70,60 Q80,70 70,82 Q62,90 58,80" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/>',
    '♒': '<path d="M10,38 Q22,24 34,38 Q46,52 58,38 Q70,24 82,38 Q94,52 94,52" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M10,66 Q22,52 34,66 Q46,80 58,66 Q70,52 82,66 Q94,80 94,80" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    '♓': '<path d="M28,14 Q14,34 28,50 Q14,66 28,86" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M72,14 Q86,34 72,50 Q86,66 72,86" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><line x1="20" y1="50" x2="80" y2="50" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    '☀': '<circle cx="50" cy="50" r="14" fill="currentColor"/><g stroke="currentColor" stroke-width="6" stroke-linecap="round"><line x1="50" y1="4" x2="50" y2="20"/><line x1="50" y1="80" x2="50" y2="96"/><line x1="4" y1="50" x2="20" y2="50"/><line x1="80" y1="50" x2="96" y2="50"/><line x1="16" y1="16" x2="27" y2="27"/><line x1="73" y1="73" x2="84" y2="84"/><line x1="84" y1="16" x2="73" y2="27"/><line x1="16" y1="84" x2="27" y2="73"/></g>',
    '☾': '<path fill-rule="evenodd" fill="currentColor" d="M 46,50 m -34,0 a 34,34 0 1,0 68,0 a 34,34 0 1,0 -68,0 Z M 64,50 m -27,0 a 27,27 0 1,0 54,0 a 27,27 0 1,0 -54,0 Z"/>',
    '♁': '<circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width="7"/><line x1="50" y1="16" x2="50" y2="84" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><line x1="16" y1="50" x2="84" y2="50" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    '⛎': '<circle cx="50" cy="30" r="14" fill="none" stroke="currentColor" stroke-width="6"/><line x1="50" y1="44" x2="50" y2="86" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M22,58 Q50,42 78,58" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M22,72 Q50,88 78,72" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    '☍': '<circle cx="32" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="6.5"/><circle cx="68" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="6.5"/><line x1="18" y1="18" x2="82" y2="82" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity="0.6"/>',
    '☌': '<circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="50" cy="50" r="8" fill="currentColor"/>',
  },
};

// Ornate Sigils — parametric rosette / burst generator. Runs once at load time
// (safer and less error-prone than hand-authoring 18 more bezier paths) and
// caches its computed SVG markup into ICON_PATHS.sigils, keyed by the same
// base glyphs used in THEMES.sigils.symbols.
(function generateSigilIcons() {
  const sigilKeys = THEMES.sigils.symbols.map(s => s.replace(/\uFE0E$/, ''));
  const out = {};

  function petalRosette(count, innerR, outerR, rot, filled) {
    let g = '';
    for (let i = 0; i < count; i++) {
      const a = rot + (i / count) * 360;
      g += `<ellipse cx="50" cy="${50 - outerR}" rx="${innerR}" ry="${outerR}" ` +
           `transform="rotate(${a} 50 50)" ` +
           (filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="4"') + '/>';
    }
    return g;
  }

  function starPolygon(points, outerR, innerR, rot) {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = ((i / (points * 2)) * 360 + rot) * Math.PI / 180;
      pts.push(`${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="currentColor"/>`;
  }

  function ring(r, w) {
    return `<circle cx="50" cy="50" r="${r}" fill="none" stroke="currentColor" stroke-width="${w}"/>`;
  }

  sigilKeys.forEach((key, i) => {
    const petals = 5 + (i % 8);              // 5..12 petals
    const rot = (i * 137.5) % 360;            // golden-angle stagger so no two rosettes align
    const filled = i % 3 === 0;
    const innerR = 6 + (i % 4) * 1.5;
    const outerR = 30 + (i % 5) * 2;
    let svg = petalRosette(petals, innerR, outerR, rot, filled);
    if (i % 2 === 0) svg += ring(38, 3);
    if (i % 4 === 1) svg += starPolygon(petals > 8 ? 6 : petals, 14, 6, rot / 2);
    svg += `<circle cx="50" cy="50" r="${5 + (i % 3)}" fill="currentColor"/>`;
    out[key] = svg;
  });

  ICON_PATHS.sigils = out;
})();

// Returns inline SVG markup for a symbol in the currently active theme, or
// null to fall back to the plain text glyph.
function getIconMarkup(symbol) {
  const themeIcons = ICON_PATHS[PROGRESS.activeTheme];
  if (!themeIcons) return null;
  const base = symbol.replace(/\uFE0E$/, '');
  return themeIcons[base] || null;
}
function cardFaceHTML(symbol) {
  const icon = getIconMarkup(symbol);
  return icon
    ? `<span class="card-symbol icon-symbol"><svg viewBox="0 0 100 100" aria-hidden="true">${icon}</svg></span>`
    : `<span class="card-symbol">${symbol}</span>`;
}
function applySymbolToSpan(span, symbol) {
  const icon = getIconMarkup(symbol);
  if (icon) {
    span.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${icon}</svg>`;
    span.classList.add('icon-symbol');
  } else {
    span.textContent = symbol;
    span.classList.remove('icon-symbol');
  }
}

const DIFFICULTIES = {
  apprentice: { cols: 4, rows: 4, pairs: 8,  maxWidth: 480, title: 'Initiate Complete',   timeLimit: 75 },
  adept:      { cols: 6, rows: 4, pairs: 12, maxWidth: 660, title: 'Seeker Ascended',      timeLimit: 130 },
  master:     { cols: 6, rows: 6, pairs: 18, maxWidth: 720, title: 'Archmage of the Arcane', timeLimit: 210 },
};

// Daily Rite always uses the Initiate (4x4) board regardless of the player's
// chosen difficulty, so its seed lines up the same way for everyone. Weekly
// Rite steps up to Seeker (6x4) — a bigger, longer-form seeded challenge.
function effectiveDifficultyKey() {
  if (STATE.mode === 'daily') return 'apprentice';
  if (STATE.mode === 'weekly') return 'adept';
  return STATE.difficulty;
}

const MAX_LIVES = 3;
const VEIL_INTERVAL = 11000; // ms between Shifting Veil reshuffles

// ---- Custom Path (Aether Shop-adjacent QoL: a board size between the 3 fixed
// Paths). Capped at 18 pairs since every theme only has 18 unique symbols.
function computeCustomLayout(pairs) {
  const totalCards = pairs * 2;
  // Requiring cols to exactly divide totalCards is what produced the
  // degenerate 17x2 / 13x2 grids for prime pair counts — there's often no
  // reasonable divisor. Instead, search a landscape-biased range of column
  // counts and pick whichever leaves the fewest empty cells in the last row,
  // breaking ties by how close it lands to a pleasant width/height ratio.
  const idealCols = Math.sqrt(totalCards * 1.3);
  let best = null;
  for (let cols = 4; cols <= 8; cols++) {
    const rows = Math.ceil(totalCards / cols);
    const wasted = cols * rows - totalCards;
    const aspectPenalty = Math.abs(cols - idealCols);
    const score = wasted * 2 + aspectPenalty;
    if (!best || score < best.score) best = { cols, rows, score };
  }
  return { cols: best.cols, rows: best.rows };
}
function setCustomDifficulty(pairs) {
  pairs = Math.max(6, Math.min(18, Math.round(pairs)));
  const { cols, rows } = computeCustomLayout(pairs);
  DIFFICULTIES.custom = {
    cols, rows, pairs,
    maxWidth: Math.min(720, cols * 112),
    title: 'Custom Rite Complete',
    timeLimit: Math.round(50 + pairs * 9),
  };
  return pairs;
}

// ---- Prestige ranks — cosmetic titles earned by Ascending once every theme
// and achievement is owned. Rank 4+ just keeps numbering "Ascendant".
const PRESTIGE_TITLES = ['Initiate', 'Seeker', 'Archmage', 'Ascendant'];
function prestigeTitle(level) {
  if (level <= 0) return PRESTIGE_TITLES[0];
  if (level < PRESTIGE_TITLES.length) return PRESTIGE_TITLES[level];
  return `Ascendant ${level - PRESTIGE_TITLES.length + 2}`; // Ascendant, Ascendant 2, Ascendant 3...
}
// there's still something to spend Aether on. Applied via a data attribute
// on <html> that the corresponding CSS in styles.css keys off of.
const SHOP_ITEMS = {
  cardBacks: {
    label: 'Card Backs',
    items: {
      default:  { name: 'Classic Seal',   cost: 0 },
      violet:   { name: 'Violet Sigil',   cost: 150 },
      emerald:  { name: 'Emerald Sigil',  cost: 150 },
      crimson:  { name: 'Crimson Sigil',  cost: 150 },
    },
  },
  boardBgs: {
    label: 'Board Backgrounds',
    items: {
      default: { name: 'Cosmos (Default)', cost: 0 },
      nebula:  { name: 'Violet Nebula',     cost: 200 },
      aurora:  { name: 'Emerald Aurora',    cost: 200 },
      ember:   { name: 'Ember Skies',       cost: 200 },
    },
  },
  frames: {
    label: 'Victory Frames',
    items: {
      default: { name: 'Gilded (Default)', cost: 0 },
      silver:  { name: 'Silver Rite',       cost: 180 },
      obsidian:{ name: 'Obsidian Rite',     cost: 180 },
    },
  },
  confetti: {
    label: 'Confetti Colors',
    items: {
      default: { name: 'Gold & Cream (Default)', cost: 0 },
      violet:  { name: 'Violet & Rose',           cost: 120 },
      emerald: { name: 'Emerald & Teal',          cost: 120 },
      rainbow: { name: 'Full Spectrum',           cost: 220 },
    },
  },
  cursorEffects: {
    label: 'Cursor Effects',
    items: {
      default: { name: 'None (Default)',    cost: 0 },
      sparkle: { name: 'Sparkle Trail',      cost: 140 },
      ember:   { name: 'Ember Trail',        cost: 140 },
    },
  },
  matchParticles: {
    label: 'Match Particle Effects',
    items: {
      default: { name: 'Golden Burst (Default)', cost: 0 },
      violet:  { name: 'Violet Burst',            cost: 130 },
      starburst: { name: 'Starburst',             cost: 160 },
    },
  },
  boardFrames: {
    label: 'Board Frames',
    items: {
      default:   { name: 'None (Default)',   cost: 0 },
      starlit:   { name: 'Starlit Border',    cost: 170 },
      thornvine: { name: 'Thornvine Border',  cost: 170 },
      runic:     { name: 'Runic Border',      cost: 170 },
    },
  },
  cursorFrames: {
    label: 'Cursor Frames',
    items: {
      default: { name: 'None (Default)', cost: 0 },
      halo:    { name: 'Halo Ring',       cost: 140 },
      ember:   { name: 'Ember Ring',      cost: 140 },
    },
  },
  victoryAnimations: {
    label: 'Victory Animations',
    items: {
      default:   { name: 'Radiant Burst (Default)', cost: 0 },
      aurora:    { name: 'Aurora Sweep',             cost: 190 },
      shockwave: { name: 'Golden Shockwave',         cost: 190 },
      eclipse:   { name: 'Eclipse Pulse',            cost: 220 },
    },
  },
  profileBadges: {
    label: 'Profile Badges',
    items: {
      default:     { name: 'None (Default)', cost: 0 },
      sigilbearer: { name: 'Sigil Bearer',    cost: 150 },
      archmage:    { name: "Archmage's Mark", cost: 220 },
      ascendant:   { name: 'Ascendant Crest', cost: 260 },
    },
  },
};

// Icon glyph shown on each equippable Profile Badge (rendered next to the
// player's stats in the Chronicle and on the victory/loss modal). Keyed by
// the same item keys as SHOP_ITEMS.profileBadges.items; 'default' (no
// badge) intentionally has no entry.
const PROFILE_BADGE_ICONS = {
  sigilbearer: '✦',
  archmage: '⚛',
  ascendant: '⚜',
};

// ---- Achievements ----
