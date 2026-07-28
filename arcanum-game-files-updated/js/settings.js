/* ============================================================
   SETTINGS — volume sliders, reduced motion, colorblind palette
   ============================================================ */
const SETTINGS_KEY = 'arcanum_settings';

function defaultSettings() {
  return {
    musicVolume: 80,
    sfxVolume: 85,
    reducedMotion: false,
    colorblind: false,
    highContrast: false,
    screenShake: true,
    uiScale: 100,
    confirmReset: true,
    hapticsIntensity: 2, // 0 = off, 1 = low, 2 = full
  };
}

function loadSettings() {
  try {
    const raw = crazySdk.data.getItem(SETTINGS_KEY);
    if (raw) return Object.assign(defaultSettings(), JSON.parse(raw));
  } catch(e) {}
  return defaultSettings();
}

function saveSettings() {
  try { crazySdk.data.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch(e) {}
}

let SETTINGS = loadSettings();

function applySettings() {
  audio.setMusicVolume(SETTINGS.musicVolume);
  audio.setSfxVolume(SETTINGS.sfxVolume);
  document.body.classList.toggle('reduced-motion', SETTINGS.reducedMotion);
  document.body.classList.toggle('colorblind-mode', SETTINGS.colorblind);
  document.body.classList.toggle('high-contrast-mode', SETTINGS.highContrast);
  document.documentElement.style.setProperty('--ui-scale', SETTINGS.uiScale / 100);

  const musicSlider = document.getElementById('musicVolumeSlider');
  const sfxSlider = document.getElementById('sfxVolumeSlider');
  const musicVal = document.getElementById('musicVolumeVal');
  const sfxVal = document.getElementById('sfxVolumeVal');
  if (musicSlider) musicSlider.value = SETTINGS.musicVolume;
  if (sfxSlider) sfxSlider.value = SETTINGS.sfxVolume;
  if (musicVal) musicVal.textContent = `${SETTINGS.musicVolume}%`;
  if (sfxVal) sfxVal.textContent = `${SETTINGS.sfxVolume}%`;

  const reducedBtn = document.getElementById('reducedMotionToggle');
  const colorblindBtn = document.getElementById('colorblindToggle');
  if (reducedBtn) {
    reducedBtn.classList.toggle('on', SETTINGS.reducedMotion);
    reducedBtn.setAttribute('aria-checked', String(SETTINGS.reducedMotion));
  }
  if (colorblindBtn) {
    colorblindBtn.classList.toggle('on', SETTINGS.colorblind);
    colorblindBtn.setAttribute('aria-checked', String(SETTINGS.colorblind));
  }

  const highContrastBtn = document.getElementById('highContrastToggle');
  const screenShakeBtn = document.getElementById('screenShakeToggle');
  if (highContrastBtn) {
    highContrastBtn.classList.toggle('on', SETTINGS.highContrast);
    highContrastBtn.setAttribute('aria-checked', String(SETTINGS.highContrast));
  }
  if (screenShakeBtn) {
    screenShakeBtn.classList.toggle('on', SETTINGS.screenShake);
    screenShakeBtn.setAttribute('aria-checked', String(SETTINGS.screenShake));
  }
  const uiScaleSlider = document.getElementById('uiScaleSlider');
  const uiScaleVal = document.getElementById('uiScaleVal');
  if (uiScaleSlider) uiScaleSlider.value = SETTINGS.uiScale;
  if (uiScaleVal) uiScaleVal.textContent = `${SETTINGS.uiScale}%`;

  const confirmResetBtn = document.getElementById('confirmResetToggle');
  if (confirmResetBtn) {
    confirmResetBtn.classList.toggle('on', SETTINGS.confirmReset);
    confirmResetBtn.setAttribute('aria-checked', String(SETTINGS.confirmReset));
  }
  const hapticsSlider = document.getElementById('hapticsSlider');
  const hapticsVal = document.getElementById('hapticsVal');
  const hapticsLabels = ['Off', 'Low', 'Full'];
  if (hapticsSlider) hapticsSlider.value = SETTINGS.hapticsIntensity;
  if (hapticsVal) hapticsVal.textContent = hapticsLabels[SETTINGS.hapticsIntensity];
}

applySettings();

document.getElementById('settingsBtn').addEventListener('click', () => {
  applySettings();
  document.getElementById('settingsModal').classList.add('active');
});
document.getElementById('settingsCloseBtn').addEventListener('click', () => {
  document.getElementById('settingsModal').classList.remove('active');
});
document.getElementById('settingsModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) document.getElementById('settingsModal').classList.remove('active');
});

document.getElementById('musicVolumeSlider').addEventListener('input', (e) => {
  audio.init();
  SETTINGS.musicVolume = Number(e.target.value);
  audio.setMusicVolume(SETTINGS.musicVolume);
  document.getElementById('musicVolumeVal').textContent = `${SETTINGS.musicVolume}%`;
  saveSettings();
});
document.getElementById('sfxVolumeSlider').addEventListener('input', (e) => {
  audio.init();
  SETTINGS.sfxVolume = Number(e.target.value);
  audio.setSfxVolume(SETTINGS.sfxVolume);
  document.getElementById('sfxVolumeVal').textContent = `${SETTINGS.sfxVolume}%`;
  saveSettings();
  audio.playFlip();
});
document.getElementById('reducedMotionToggle').addEventListener('click', (e) => {
  SETTINGS.reducedMotion = !SETTINGS.reducedMotion;
  document.body.classList.toggle('reduced-motion', SETTINGS.reducedMotion);
  e.currentTarget.classList.toggle('on', SETTINGS.reducedMotion);
  e.currentTarget.setAttribute('aria-checked', String(SETTINGS.reducedMotion));
  saveSettings();
});
document.getElementById('colorblindToggle').addEventListener('click', (e) => {
  SETTINGS.colorblind = !SETTINGS.colorblind;
  document.body.classList.toggle('colorblind-mode', SETTINGS.colorblind);
  e.currentTarget.classList.toggle('on', SETTINGS.colorblind);
  e.currentTarget.setAttribute('aria-checked', String(SETTINGS.colorblind));
  saveSettings();
});
document.getElementById('highContrastToggle').addEventListener('click', (e) => {
  SETTINGS.highContrast = !SETTINGS.highContrast;
  document.body.classList.toggle('high-contrast-mode', SETTINGS.highContrast);
  e.currentTarget.classList.toggle('on', SETTINGS.highContrast);
  e.currentTarget.setAttribute('aria-checked', String(SETTINGS.highContrast));
  saveSettings();
});
document.getElementById('screenShakeToggle').addEventListener('click', (e) => {
  SETTINGS.screenShake = !SETTINGS.screenShake;
  e.currentTarget.classList.toggle('on', SETTINGS.screenShake);
  e.currentTarget.setAttribute('aria-checked', String(SETTINGS.screenShake));
  saveSettings();
});
document.getElementById('uiScaleSlider').addEventListener('input', (e) => {
  SETTINGS.uiScale = Number(e.target.value);
  document.documentElement.style.setProperty('--ui-scale', SETTINGS.uiScale / 100);
  document.getElementById('uiScaleVal').textContent = `${SETTINGS.uiScale}%`;
  saveSettings();
});
document.getElementById('confirmResetToggle').addEventListener('click', (e) => {
  SETTINGS.confirmReset = !SETTINGS.confirmReset;
  e.currentTarget.classList.toggle('on', SETTINGS.confirmReset);
  e.currentTarget.setAttribute('aria-checked', String(SETTINGS.confirmReset));
  saveSettings();
});
document.getElementById('hapticsSlider').addEventListener('input', (e) => {
  const hapticsLabels = ['Off', 'Low', 'Full'];
  SETTINGS.hapticsIntensity = Number(e.target.value);
  document.getElementById('hapticsVal').textContent = hapticsLabels[SETTINGS.hapticsIntensity];
  saveSettings();
});
