/* ============================================================
   AETHER SHOP — cosmetics purchasable with Aether: card backs,
   board backgrounds, victory frames, confetti colors.
   ============================================================ */
function applyCosmetics() {
  const html = document.documentElement;
  html.setAttribute('data-cardback', PROGRESS.cosmetics.cardBacks || 'default');
  html.setAttribute('data-boardbg', PROGRESS.cosmetics.boardBgs || 'default');
  html.setAttribute('data-frame', PROGRESS.cosmetics.frames || 'default');
  html.setAttribute('data-cursor', PROGRESS.cosmetics.cursorEffects || 'default');
  html.setAttribute('data-matchparticles', PROGRESS.cosmetics.matchParticles || 'default');
  html.setAttribute('data-boardframe', PROGRESS.cosmetics.boardFrames || 'default');
  initCursorEffect();
  initCursorFrame();
  renderEquippedBadges();
}

// Cursor Effects — a light trail of particles following the pointer,
// distinct per cosmetic. No-op (and fully cleaned up) when set to Default,
// and skipped on touch-only devices where there's no persistent pointer.
let cursorEffectHandler = null;
function initCursorEffect() {
  if (cursorEffectHandler) {
    document.removeEventListener('mousemove', cursorEffectHandler);
    cursorEffectHandler = null;
  }
  const kind = PROGRESS.cosmetics.cursorEffects || 'default';
  if (kind === 'default' || !window.matchMedia('(pointer: fine)').matches) return;

  let lastSpawn = 0;
  cursorEffectHandler = (e) => {
    const now = Date.now();
    if (now - lastSpawn < 45) return; // throttle
    lastSpawn = now;
    const p = document.createElement('div');
    p.className = 'cursor-trail-particle';
    const isEmber = kind === 'ember';
    p.style.left = `${e.clientX}px`;
    p.style.top = `${e.clientY}px`;
    p.style.background = isEmber ? 'hsl(20, 90%, 60%)' : 'hsl(45, 90%, 75%)';
    p.style.boxShadow = isEmber ? '0 0 8px hsl(20,90%,55%)' : '0 0 8px hsl(45,90%,70%)';
    document.body.appendChild(p);
    p.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.9 },
      { transform: `translate(-50%,-50%) translateY(${isEmber ? '-14px' : '-8px'}) scale(0)`, opacity: 0 }
    ], { duration: isEmber ? 550 : 450, easing: 'ease-out' }).onfinish = () => p.remove();
  };
  document.addEventListener('mousemove', cursorEffectHandler);
}

// Cursor Frames — a single ring that tracks the pointer, distinct from the
// spawned-particle Cursor Effects trail above. Same cleanup/touch-skip
// rules: no-op on Default, and skipped where there's no persistent pointer.
let cursorFrameHandler = null;
let cursorFrameEl = null;
function initCursorFrame() {
  if (cursorFrameHandler) {
    document.removeEventListener('mousemove', cursorFrameHandler);
    cursorFrameHandler = null;
  }
  if (cursorFrameEl) {
    cursorFrameEl.remove();
    cursorFrameEl = null;
  }
  const kind = PROGRESS.cosmetics.cursorFrames || 'default';
  if (kind === 'default' || !window.matchMedia('(pointer: fine)').matches) return;

  cursorFrameEl = document.createElement('div');
  cursorFrameEl.className = `cursor-frame-ring cursor-frame-${kind}`;
  document.body.appendChild(cursorFrameEl);

  cursorFrameHandler = (e) => {
    cursorFrameEl.style.left = `${e.clientX}px`;
    cursorFrameEl.style.top = `${e.clientY}px`;
  };
  document.addEventListener('mousemove', cursorFrameHandler);
}

// Profile Badges — unlike the CSS-attribute cosmetics above, a badge is
// rendered content (icon + name), so every badge-slot placeholder already
// sitting in the DOM (victory/loss modal, the Chronicle) gets refreshed
// here rather than via a data-* attribute + stylesheet rule.
function renderEquippedBadges() {
  const key = (PROGRESS.cosmetics && PROGRESS.cosmetics.profileBadges) || 'default';
  const item = SHOP_ITEMS.profileBadges.items[key];
  const icon = PROFILE_BADGE_ICONS[key];
  document.querySelectorAll('.profile-badge-slot').forEach(slot => {
    if (key === 'default' || !item || !icon) {
      slot.innerHTML = '';
      slot.style.display = 'none';
      return;
    }
    slot.innerHTML = `
      <span class="profile-badge" title="${item.name}">
        <span class="profile-badge-icon">${icon}\uFE0E</span>
        <span class="profile-badge-name">${item.name}</span>
      </span>
    `;
    slot.style.display = 'block';
  });
}

function renderShop() {
  const el = document.getElementById('shopContent');
  if (!el) return;
  el.innerHTML = Object.entries(SHOP_ITEMS).map(([catKey, cat]) => {
    const owned = (PROGRESS.ownedCosmetics && PROGRESS.ownedCosmetics[catKey]) || ['default'];
    const equipped = (PROGRESS.cosmetics && PROGRESS.cosmetics[catKey]) || 'default';
    const items = Object.entries(cat.items).map(([itemKey, item]) => {
      const isOwned = owned.includes(itemKey);
      const isEquipped = equipped === itemKey;
      const label = isEquipped ? 'Equipped' : (isOwned ? 'Equip' : `${item.cost}✦`);
      return `
        <button class="btn rite-option shop-item ${isEquipped ? 'active' : ''}" data-shop-cat="${catKey}" data-shop-item="${itemKey}">
          <span class="rite-option-name">${item.name}</span>
          <span class="rite-option-desc">${label}</span>
        </button>
      `;
    }).join('');
    return `
      <div class="tutorial-section">
        <h3>${cat.label}</h3>
        <div class="rites-option-list">${items}</div>
      </div>
    `;
  }).join('');
}

const SHOP_EQUIP_HINTS = {
  cardBacks: 'Look at the board',
  boardBgs: 'Look behind the board',
  frames: "Shows on your next victory",
  confetti: "Shows on your next win",
  boardFrames: 'Shows around the board',
  cursorFrames: 'Follows your pointer',
  victoryAnimations: 'Shows on your next win',
  profileBadges: 'Shows on your profile',
};

document.getElementById('shopContent').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-shop-item]');
  if (!btn) return;
  const catKey = btn.dataset.shopCat;
  const itemKey = btn.dataset.shopItem;
  const item = SHOP_ITEMS[catKey].items[itemKey];
  const owned = PROGRESS.ownedCosmetics[catKey] || (PROGRESS.ownedCosmetics[catKey] = ['default']);

  if (owned.includes(itemKey)) {
    if (PROGRESS.cosmetics[catKey] === itemKey) return; // already equipped, nothing to do
    PROGRESS.cosmetics[catKey] = itemKey;
    saveProgress();
    applyCosmetics();
    renderShop();
    if (catKey === 'confetti' && typeof audio !== 'undefined') audio.playChime(700);
    queueAchievementToast({ icon: '✦', title: 'Equipped', name: `${item.name} — ${SHOP_EQUIP_HINTS[catKey] || ''}` });
    return;
  }

  if (PROGRESS.aether >= item.cost) {
    PROGRESS.aether -= item.cost;
    owned.push(itemKey);
    PROGRESS.cosmetics[catKey] = itemKey;
    saveProgress();
    updateAetherDisplay();
    applyCosmetics();
    renderShop();
    queueAchievementToast({ icon: '✦', title: 'Acquired & Equipped', name: `${item.name} — spent ${item.cost} Aether · ${SHOP_EQUIP_HINTS[catKey] || ''}` });
  } else {
    queueAchievementToast({
      icon: '◊',
      title: 'Not Enough Aether',
      name: `${item.name} needs ${item.cost - PROGRESS.aether} more Aether`,
    });
  }
});

document.getElementById('shopBtn').addEventListener('click', () => {
  renderShop();
  document.getElementById('shopModal').classList.add('active');
});
document.getElementById('shopCloseBtn').addEventListener('click', () => {
  document.getElementById('shopModal').classList.remove('active');
});
document.getElementById('shopModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('shopModal').classList.remove('active');
});

applyCosmetics();
