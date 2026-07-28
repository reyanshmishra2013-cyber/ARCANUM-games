/* ============================================================
   ARCANUM — Memory of the Spheres
   A celestial memory-matching game
   ============================================================ */

// ---- Leaderboard config (Rite Points — see js/leaderboard.js for the
// Daily/Weekly Rite scoring formula that feeds this) ----
// CrazyGames only enables leaderboards for games manually invited into their
// MVP program via the Developer Portal, which issues a 32-byte base64
// Encryption Key. It's unset until you have one; submitScore() safely no-ops
// until then. See https://docs.crazygames.com/sdk/leaderboards-client/.
//
// When requesting access, ask for these portal settings (see
// js/leaderboard.js for why):
//   scoreLabel: 'POINTS', scoreSorting: 'DESC', isIncremental: true,
//   minValue: 0, maxValue: 999999
// CrazyGames' MVP supports exactly one leaderboard per game (no per-mode
// boards yet), so Daily and Weekly Rite both feed this same one as "Rite
// Points" — see js/leaderboard.js for how those are combined.
const LEADERBOARD_ENCRYPTION_KEY = null; // e.g. 'dGhpcyBpcyBhIDMyLWJ5dGUga2V5IGZvciB0ZXN0aW4='

// Real AES-GCM implementation, matching CrazyGames' documented client-side
// encryption exactly (Web Crypto, 12-byte random IV prepended to the
// ciphertext, base64-encoded). Not a placeholder — safe to use as soon as
// LEADERBOARD_ENCRYPTION_KEY above is filled in.
async function encryptLeaderboardScore(score, encryptionKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const algorithm = { name: 'AES-GCM', iv };

  const keyBytes = new Uint8Array(
    atob(encryptionKey).split('').map(c => c.charCodeAt(0))
  );
  const cryptoKey = await window.crypto.subtle.importKey('raw', keyBytes, algorithm, false, ['encrypt']);

  const dataBuffer = new TextEncoder().encode(score.toString());
  const encryptedBuffer = await window.crypto.subtle.encrypt(algorithm, cryptoKey, dataBuffer);

  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/* ============================================================
   Invite-link fallbacks — used only when the real CrazyGames SDK
   isn't available (local dev/testing, or before crazySdk.init()
   resolves), so the Duel Online "Invite a Friend" flow in
   js/multiplayer.js is still testable outside the CrazyGames iframe.
   The real SDK overrides all of this once it initializes.
   ============================================================ */
function readFallbackInviteParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (![...params.keys()].length) return null;
    const obj = {};
    params.forEach((v, k) => { obj[k] = v; });
    return obj;
  } catch (e) { return null; }
}

function buildFallbackInviteLink(params) {
  try {
    const url = new URL(window.location.href);
    url.search = '';
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  } catch (e) { return null; }
}

/* ============================================================
   CRAZY GAMES SDK INTEGRATION
   ============================================================ */
const crazySdk = {
  initialized: false,
  environment: 'disabled',

  async init() {
    if (typeof window.CrazyGames === 'undefined' || !window.CrazyGames.SDK) {
      console.log('CrazyGames SDK not available, using localStorage fallback');
      return false;
    }
    try {
      await window.CrazyGames.SDK.init();
      this.initialized = true;
      this.environment = window.CrazyGames.SDK.environment;

      const sdk = window.CrazyGames.SDK;

      // Re-bind default no-ops to real SDK methods
      const g = sdk.game;
      this.game.gameplayStart = () => { try { g.gameplayStart() } catch(e) {} };
      this.game.gameplayStop = () => { try { g.gameplayStop() } catch(e) {} };
      this.game.happytime = () => { try { g.happytime() } catch(e) {} };
      this.game.reportGameCompletedPercentage = p => { try { g.reportGameCompletedPercentage(p) } catch(e) {} };
      this.game.loadingStart = () => { try { g.loadingStart() } catch(e) {} };
      this.game.loadingStop = () => { try { g.loadingStop() } catch(e) {} };
      this.game.settings = g.settings;

      // Multiplayer room/invite functionality (see js/multiplayer.js) — lets
      // CrazyGames' own Invite button and Join-a-friend UI activate whenever
      // a player is waiting for or playing a Duel Online match.
      this.game.updateRoom = (data) => { try { g.updateRoom(data) } catch(e) {} };
      this.game.leftRoom = () => { try { g.leftRoom() } catch(e) {} };
      this.game.addJoinRoomListener = (fn) => { try { g.addJoinRoomListener(fn) } catch(e) {} };
      this.game.removeJoinRoomListener = (fn) => { try { g.removeJoinRoomListener(fn) } catch(e) {} };
      this.game.getInviteParam = (key) => { try { return g.getInviteParam(key) } catch(e) { return null } };
      this.game.inviteParams = g.inviteParams || null;
      this.game.isInstantMultiplayer = !!g.isInstantMultiplayer;
      // Generates the shareable invite link for the in-game "Invite a
      // Friend" button (see js/multiplayer.js's copyMpInviteLink()) — not
      // the same thing as the deprecated showInviteButton/hideInviteButton
      // pair, which the updateRoom() calls above already replace.
      this.game.inviteLink = (params) => { try { return g.inviteLink(params) } catch(e) { return buildFallbackInviteLink(params) } };

      this.game.loadingStart();

      // Data module — localStorage-compatible API
      const d = sdk.data;
      this.data.getItem = k => { try { return d.getItem(k) } catch(e) { return localStorage.getItem(k) } };
      this.data.setItem = (k, v) => { try { d.setItem(k, v) } catch(e) { localStorage.setItem(k, v) } };
      this.data.removeItem = k => { try { d.removeItem(k) } catch(e) { localStorage.removeItem(k) } };
      this.data.clear = () => { try { d.clear() } catch(e) { localStorage.clear() } };

      g.addSettingsChangeListener(s => {
        this.game.settings = s;
        if (s.muteAudio !== undefined) {
          window._sdkMuted = s.muteAudio;
          applySdkMute();
        }
      });

      // Apply initial muteAudio
      if (g.settings.muteAudio) {
        window._sdkMuted = true;
        applySdkMute();
      }

      // Get user info
      const u = sdk.user;
      this.user.isUserAccountAvailable = u ? u.isUserAccountAvailable : false;
      this.user.getUser = async () => { try { return await u.getUser() } catch(e) { return null } };

      // Leaderboard — CrazyGames' leaderboard API exists (sdk.user.submitScore)
      // but is an invite-only MVP: it only works once this game has been
      // manually enabled for leaderboards in the CrazyGames Developer Portal
      // and issued an Encryption Key, which score submission requires
      // client-side. That key doesn't exist for this build, so this stays a
      // real integration point that no-ops safely rather than a guess at a
      // credential we don't have. Fill in LEADERBOARD_ENCRYPTION_KEY above
      // once issued and this starts working with no other changes needed.
      if (u && typeof u.submitScore === 'function') {
        this.user.submitScore = async (score) => {
          if (!LEADERBOARD_ENCRYPTION_KEY) return false;
          try {
            const encryptedScore = await encryptLeaderboardScore(score, LEADERBOARD_ENCRYPTION_KEY);
            // CrazyGames wants both the encrypted and plain score.
            await u.submitScore({ encryptedScore, score });
            return true;
          } catch(e) { return false; }
        };
      }

      return true;
    } catch (e) {
      console.log('CrazyGames SDK init error:', e);
      return false;
    }
  },

  data: {
    getItem: k => { try { return localStorage.getItem(k) } catch(e) { return null } },
    setItem: (k, v) => { try { localStorage.setItem(k, v) } catch(e) {} },
    removeItem: k => { try { localStorage.removeItem(k) } catch(e) {} },
    clear: () => { try { localStorage.clear() } catch(e) {} },
  },

  game: {
    gameplayStart: () => {},
    gameplayStop: () => {},
    happytime: () => {},
    reportGameCompletedPercentage: () => {},
    loadingStart: () => {},
    loadingStop: () => {},
    settings: { muteAudio: false, disableChat: false },
    updateRoom: () => {},
    leftRoom: () => {},
    addJoinRoomListener: () => {},
    removeJoinRoomListener: () => {},
    getInviteParam: (key) => {
      const p = readFallbackInviteParams();
      return p ? (p[key] ?? null) : null;
    },
    inviteParams: readFallbackInviteParams(),
    isInstantMultiplayer: false,
    inviteLink: (params) => buildFallbackInviteLink(params),
  },

  user: {
    isUserAccountAvailable: false,
    getUser: async () => null,
    // No-op until the real SDK is initialized (or forever, if leaderboards
    // were never enabled for this game in the Developer Portal). Takes a
    // single numeric score — see js/leaderboard.js for callers.
    submitScore: async (score) => false,
  },
};

// Apply SDK mute setting to the audio engine
function applySdkMute() {
  if (window._sdkMuted) {
    if (audio.musicPlaying) audio.stopMusic();
    audio.muted = true;
    const btn = document.getElementById('musicToggle');
    btn.classList.remove('active');
    document.getElementById('musicLabel').textContent = 'Music';
  } else {
    audio.muted = false;
  }
}

// Persist best stats using the data module
const DATA_KEY = 'arcanum_best';

function loadBestStats() {
  try {
    const raw = crazySdk.data.getItem(DATA_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return {};
}

function saveBestStats() {
  if (STATE.mode === 'daily') return; // tracked separately in daily.js's DAILY_RECORD
  const data = loadBestStats();
  const diff = STATE.difficulty;
  if (!data[diff]) data[diff] = {};
  const b = data[diff];
  if (b.moves === undefined || STATE.moves < b.moves) b.moves = STATE.moves;
  if (b.time === undefined || STATE.elapsedTime < b.time) b.time = STATE.elapsedTime;
  if (b.streak === undefined || STATE.maxStreak > b.streak) b.streak = STATE.maxStreak;
  try { crazySdk.data.setItem(DATA_KEY, JSON.stringify(data)); } catch(e) {}
}

