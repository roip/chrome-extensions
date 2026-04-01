import {
  injectTypographyCSS,
  removeTypographyCSS,
  loadFont,
  measureLineHeight,
  getLineHeightPx,
  recalibrateBracket,
  applyBionicReading,
  removeBionicReading,
  cleanupAll,
} from './readability.js';

let active = false;
let overlays = {};
let currentSettings = null;
let isDragging = false;
let dragStartY = 0;
let dragStartX = 0;
let dragStartValue = 0;
let dragMode = null;
let initializationComplete = false;
let scrollHandler = null;
let scrollDebounceTimer = null;
let isScrolling = false;

// ─── Settings ───────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  topOffset: 40,
  bracketHeight: 20,
  leftPosition: 8,
  rightPosition: 8,
  sideShadingEnabled: true,
  bracketLinesEnabled: false,
  shadingColor: '#000000',
  shadingOpacity: 0.75,
  sideColor: '#000000',
  sideOpacity: 0.75,
  bracketColor: '#808080',
  bracketWidth: 7,
  autoDetectEnabled: true,
  lastDetectedLeft: null,
  lastDetectedRight: null,
  scrollMode: 'bracket-step',
  // Readability
  letterSpacingEnabled: false,
  lineHeightMode: 'default',
  bionicReadingEnabled: false,
  fontOverride: 'none',
  // Precision
  precisionMode: true,
  precisionLineCount: 3,
  // Appearance
  shadingMatchTheme: false,
};

async function loadSettings() {
  try {
    const result = await Promise.race([
      chrome.storage.sync.get('focusBracketSettings'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 5000)),
    ]);
    if (result.focusBracketSettings) {
      return { ...DEFAULT_SETTINGS, ...result.focusBracketSettings };
    }
    try {
      await chrome.storage.sync.set({ focusBracketSettings: DEFAULT_SETTINGS });
    } catch (_) { /* ignore */ }
    return DEFAULT_SETTINGS;
  } catch (_) {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(updates, immediate = false) {
  const current = await loadSettings();
  const newSettings = { ...current, ...updates };
  newSettings.topOffset = Math.max(0, Math.min(80, newSettings.topOffset));
  newSettings.bracketHeight = Math.max(2, Math.min(60, newSettings.bracketHeight));
  newSettings.leftPosition = Math.max(0, Math.min(40, newSettings.leftPosition));
  newSettings.rightPosition = Math.max(0, Math.min(40, newSettings.rightPosition));
  try {
    await chrome.storage.sync.set({ focusBracketSettings: newSettings });
  } catch (_) { /* ignore */ }
  return newSettings;
}

async function resetSettings() {
  try {
    await chrome.storage.sync.set({ focusBracketSettings: DEFAULT_SETTINGS });
  } catch (_) { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function onSettingsChanged(callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.focusBracketSettings) {
      callback(changes.focusBracketSettings.newValue);
    }
  });
}

// ─── Initialization ─────────────────────────────────────────────────────────

initialize();

async function initialize() {
  currentSettings = await loadSettings();
  onSettingsChanged((newSettings) => {
    currentSettings = newSettings;
    if (active) updateOverlay();
  });
  initializationComplete = true;
}

// ─── Overlay Positioning ────────────────────────────────────────────────────

function calculatePositions(settings) {
  const topHeight = settings.topOffset;
  const bottomHeight = 100 - settings.topOffset - settings.bracketHeight;
  const clearTop = settings.topOffset;
  const clearHeight = settings.bracketHeight;

  return {
    top: { height: `${topHeight}vh` },
    bottom: { height: `${bottomHeight}vh` },
    clearTop: `${clearTop}vh`,
    clearBottom: `${100 - clearTop - clearHeight}vh`,
    leftPos: `${settings.leftPosition}%`,
    rightPos: `${settings.rightPosition}%`,
  };
}

// ─── Readability Integration ────────────────────────────────────────────────

async function applyReadability() {
  // Font loading (must happen before CSS injection so font-family resolves)
  if (currentSettings.fontOverride && currentSettings.fontOverride !== 'none') {
    await loadFont(currentSettings.fontOverride);
  }

  // CSS injection: letter-spacing, line-height, font
  injectTypographyCSS(currentSettings);

  // Bionic reading DOM manipulation
  if (currentSettings.bionicReadingEnabled) {
    applyBionicReading();
  } else {
    removeBionicReading();
  }

  // Wait for any font loads to settle
  await document.fonts.ready;

  // Precision mode: measure with pretext and recalibrate bracket
  const calibration = recalibrateBracket(currentSettings);
  if (calibration) {
    console.log('Focus Reader: Precision calibration —',
      `lineHeight: ${calibration._measuredLineHeightPx.toFixed(1)}px,`,
      `bracket: ${calibration.bracketHeight.toFixed(2)}vh`,
      `(${currentSettings.precisionLineCount} lines)`);
    currentSettings = await saveSettings({
      bracketHeight: calibration.bracketHeight,
    }, true);
  }
}

function removeReadability() {
  cleanupAll();
}

// ─── Overlay Creation ───────────────────────────────────────────────────────

async function createOverlay() {
  removeOverlay();

  if (currentSettings.autoDetectEnabled) {
    await runAutoDetect();
  }

  await applyReadability();

  const pos = calculatePositions(currentSettings);

  const container = document.createElement('div');
  container.id = 'focus-bracket-container';
  container.style.cssText = `
    position: fixed; top: 0; left: 0;
    width: 100vw; height: 100vh;
    z-index: 9999; pointer-events: none;
  `;

  const top = document.createElement('div');
  top.id = 'focus-bracket-top';
  top.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0;
    height: ${pos.top.height};
    background: ${currentSettings.shadingColor};
    opacity: ${currentSettings.shadingOpacity};
    z-index: 9999; pointer-events: none;
  `;

  const bottom = document.createElement('div');
  bottom.id = 'focus-bracket-bottom';
  bottom.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0;
    height: ${pos.bottom.height};
    background: ${currentSettings.shadingColor};
    opacity: ${currentSettings.shadingOpacity};
    z-index: 9999; pointer-events: none;
  `;

  const leftShade = document.createElement('div');
  leftShade.id = 'focus-bracket-left-shade';
  leftShade.style.cssText = `
    position: fixed; top: ${pos.clearTop};
    height: ${currentSettings.bracketHeight}vh;
    left: 0; width: ${pos.leftPos};
    background: ${currentSettings.shadingColor};
    opacity: ${currentSettings.shadingOpacity};
    z-index: 9999; pointer-events: none;
  `;

  const rightShade = document.createElement('div');
  rightShade.id = 'focus-bracket-right-shade';
  rightShade.style.cssText = `
    position: fixed; top: ${pos.clearTop};
    height: ${currentSettings.bracketHeight}vh;
    right: 0; width: ${pos.rightPos};
    background: ${currentSettings.shadingColor};
    opacity: ${currentSettings.shadingOpacity};
    z-index: 9999; pointer-events: none;
  `;

  const topHandle = createDragHandle('top', pos.clearTop);
  const bottomHandle = createDragHandle('bottom', pos.clearBottom);
  const leftHandle = createWidthHandle('left', pos);
  const rightHandle = createWidthHandle('right', pos);
  const closeButton = createCloseButton();
  const settingsButton = createSettingsButton();

  document.body.append(top, bottom, leftShade, rightShade);
  document.body.append(topHandle, bottomHandle, leftHandle, rightHandle, closeButton, settingsButton);

  overlays = {
    container, top, bottom, leftShade, rightShade,
    topHandle, bottomHandle, leftHandle, rightHandle,
    closeButton, settingsButton,
  };

  setupScrollHandler();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createDragHandle(position, offset) {
  const handle = document.createElement('div');
  handle.id = `focus-bracket-handle-${position}`;
  handle.className = 'focus-bracket-handle';

  const isTop = position === 'top';
  const themeColor = currentSettings.bracketColor || '#888888';
  handle.style.cssText = `
    position: fixed;
    ${isTop ? 'top' : 'bottom'}: ${isTop ? `calc(${offset} - 30px)` : `calc(${offset} - 30px)`};
    left: 50%; transform: translateX(-50%);
    width: 60px; height: 20px;
    background: ${hexToRgba(themeColor, 0.3)};
    border: 2px solid ${hexToRgba(themeColor, 0.5)};
    border-radius: 10px;
    z-index: 10001; pointer-events: auto;
    cursor: ns-resize; opacity: 0.3;
    transition: opacity 0.2s;
  `;

  handle.addEventListener('mouseenter', () => { handle.style.opacity = '0.8'; });
  handle.addEventListener('mouseleave', () => { if (!isDragging) handle.style.opacity = '0.3'; });
  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartY = e.clientY;
    dragMode = isTop ? 'move' : 'resize';
    dragStartValue = isTop ? currentSettings.topOffset : currentSettings.bracketHeight;
    handle.style.opacity = '1';
    e.preventDefault();
  });

  return handle;
}

function createWidthHandle(side, pos) {
  const handle = document.createElement('div');
  handle.id = `focus-bracket-handle-${side}`;
  handle.className = 'focus-bracket-handle';

  const isLeft = side === 'left';
  const themeColor = currentSettings.bracketColor || '#808080';
  handle.style.cssText = `
    position: fixed;
    top: ${pos.clearTop};
    height: ${currentSettings.bracketHeight}vh;
    ${isLeft ? 'left' : 'right'}: calc(${isLeft ? pos.leftPos : pos.rightPos} - 8px);
    width: 16px; background: transparent;
    border-${isLeft ? 'right' : 'left'}: 3px solid ${themeColor};
    border-radius: 0;
    z-index: 10001; pointer-events: auto;
    cursor: ew-resize; opacity: 0;
    transition: opacity 0.2s;
  `;

  handle.addEventListener('mouseenter', () => { handle.style.opacity = '0.6'; });
  handle.addEventListener('mouseleave', () => { if (!isDragging) handle.style.opacity = '0'; });
  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragMode = isLeft ? 'width-left' : 'width-right';
    dragStartValue = isLeft ? currentSettings.leftPosition : currentSettings.rightPosition;
    handle.style.opacity = '0.8';
    e.preventDefault();
  });

  return handle;
}

function createCloseButton() {
  const button = document.createElement('div');
  button.id = 'focus-bracket-close-btn';
  button.innerHTML = '\u00D7';
  const themeColor = currentSettings.bracketColor || '#888888';
  button.style.cssText = `
    position: fixed; top: 10px; right: 60px;
    width: 30px; height: 30px;
    background: rgba(0, 0, 0, 0.7); color: ${themeColor};
    font-size: 24px; display: flex;
    align-items: center; justify-content: center;
    border-radius: 50%;
    z-index: 10001; pointer-events: auto;
    cursor: pointer; opacity: 0.4;
    transition: opacity 0.2s;
    font-weight: bold; line-height: 1;
  `;

  button.addEventListener('mouseenter', () => { button.style.opacity = '1'; });
  button.addEventListener('mouseleave', () => { button.style.opacity = '0.4'; });
  button.addEventListener('click', () => { active = false; removeOverlay(); });
  return button;
}

function createSettingsButton() {
  const button = document.createElement('div');
  button.id = 'focus-bracket-settings-btn';
  button.innerHTML = '\u2699';
  const themeColor = currentSettings.bracketColor || '#888888';
  button.style.cssText = `
    position: fixed; top: 10px; right: 20px;
    width: 30px; height: 30px;
    background: rgba(0, 0, 0, 0.7); color: ${themeColor};
    font-size: 18px; display: flex;
    align-items: center; justify-content: center;
    border-radius: 50%;
    z-index: 10001; pointer-events: auto;
    cursor: pointer; opacity: 0.4;
    transition: opacity 0.2s;
  `;

  button.addEventListener('mouseenter', () => { button.style.opacity = '1'; });
  button.addEventListener('mouseleave', () => { button.style.opacity = '0.4'; });
  button.addEventListener('click', () => { toggleSettingsPanel(); });
  return button;
}

// ─── Settings Panel ─────────────────────────────────────────────────────────

function toggleSettingsPanel() {
  const panel = document.getElementById('focus-bracket-settings-panel');
  if (panel) { panel.remove(); } else { createSettingsPanel(); }
}

function makeToggleRow(label, id, checked) {
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <label for="${id}">${label}</label>
      <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}
        style="width: 18px; height: 18px; cursor: pointer; accent-color: currentColor;">
    </div>
  `;
}

function makeSelectRow(label, id, options, currentValue) {
  const opts = options.map(o =>
    `<option value="${o.value}" ${o.value === currentValue ? 'selected' : ''}>${o.label}</option>`
  ).join('');
  return `
    <div style="margin-bottom: 10px;">
      <label for="${id}" style="display: block; margin-bottom: 4px;">${label}</label>
      <select id="${id}" style="width: 100%; padding: 5px; background: #222; color: inherit; border: 1px solid currentColor; border-radius: 5px; cursor: pointer;">
        ${opts}
      </select>
    </div>
  `;
}

function createSettingsPanel() {
  const themeColor = currentSettings.bracketColor || '#888888';
  const panel = document.createElement('div');
  panel.id = 'focus-bracket-settings-panel';
  panel.style.cssText = `
    position: fixed; top: 50px; right: 20px;
    width: 270px; max-height: 80vh; overflow-y: auto;
    background: rgba(0, 0, 0, 0.93); color: ${themeColor};
    padding: 20px; border-radius: 10px;
    border: 2px solid ${themeColor};
    z-index: 10002; pointer-events: auto;
    font-family: Arial, sans-serif; font-size: 13px;
  `;

  const scrollMode = currentSettings.scrollMode || 'bracket-step';
  const opacity = currentSettings.shadingOpacity;
  const matchTheme = currentSettings.shadingMatchTheme || false;

  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div style="font-weight: bold; font-size: 15px;">Settings</div>
      <button id="close-settings-btn" style="background: none; border: none; color: ${themeColor}; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px;">\u00D7</button>
    </div>

    <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; opacity: 0.6;">READABILITY</div>

    ${makeToggleRow('Letter Spacing', 'fr-letter-spacing', currentSettings.letterSpacingEnabled)}

    ${makeToggleRow('Bionic Reading', 'fr-bionic', currentSettings.bionicReadingEnabled)}

    <hr style="border: none; border-top: 1px solid ${themeColor}; opacity: 0.2; margin: 12px 0;">
    <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; opacity: 0.6;">FONT</div>

    ${makeSelectRow('Font', 'fr-font', [
      { value: 'none', label: 'Page Default' },
      { value: 'atkinson', label: 'Atkinson Hyperlegible' },
      { value: 'opendyslexic', label: 'OpenDyslexic' },
    ], currentSettings.fontOverride || 'none')}

    <hr style="border: none; border-top: 1px solid ${themeColor}; opacity: 0.2; margin: 12px 0;">
    <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; opacity: 0.6;">PRECISION READING</div>

    ${makeToggleRow('Precision Mode', 'fr-precision', currentSettings.precisionMode)}

    ${makeSelectRow('Lines', 'fr-precision-lines', [
      { value: '1', label: '1 line' },
      { value: '2', label: '2 lines' },
      { value: '3', label: '3 lines' },
      { value: '5', label: '5 lines' },
    ], String(currentSettings.precisionLineCount || 3))}

    ${makeSelectRow('Line Height', 'fr-line-height', [
      { value: 'default', label: 'Default' },
      { value: '1.5', label: '1.5\u00D7' },
      { value: '1.8', label: '1.8\u00D7' },
      { value: '2.0', label: '2.0\u00D7' },
    ], currentSettings.lineHeightMode)}

    ${makeSelectRow('Scroll Mode', 'scroll-mode-select', [
      { value: 'bracket-step', label: 'Bracket Step' },
      { value: 'smooth', label: 'Smooth Controlled' },
      { value: 'normal', label: 'Normal (free scroll)' },
    ], scrollMode)}

    <hr style="border: none; border-top: 1px solid ${themeColor}; opacity: 0.2; margin: 12px 0;">
    <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; opacity: 0.6;">APPEARANCE</div>

    <div style="margin-bottom: 10px;">
      <label style="display: block; margin-bottom: 4px;">Theme Color</label>
      <input type="color" id="theme-color-picker" value="${themeColor}" style="width: 100%; height: 28px; border: 1px solid ${themeColor}; border-radius: 5px; cursor: pointer;">
    </div>

    ${makeToggleRow('Match Theme Color', 'fr-match-theme', matchTheme)}

    <div style="margin-bottom: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <label>Darkness</label>
        <span id="fr-opacity-value" style="font-size: 11px; opacity: 0.6;">${Math.round(opacity * 100)}%</span>
      </div>
      <input type="range" id="fr-opacity" min="10" max="95" value="${Math.round(opacity * 100)}"
        style="width: 100%; cursor: pointer; accent-color: ${themeColor};">
    </div>

    <hr style="border: none; border-top: 1px solid ${themeColor}; opacity: 0.2; margin: 12px 0;">

    <button id="reset-settings-btn" style="
      width: 100%; padding: 8px;
      background: ${themeColor}; color: black;
      border: none; border-radius: 5px;
      cursor: pointer; font-weight: bold;
    ">Reset to Defaults</button>

    <div style="margin-top: 10px; font-size: 11px; opacity: 0.7; text-align: center;">
      Alt+Arrow keys to adjust &middot; Drag handles to reposition
    </div>
  `;

  document.body.append(panel);

  // ─── Event listeners ────────────────────────────────────────────────────

  document.getElementById('close-settings-btn').addEventListener('click', () => panel.remove());

  // Readability
  document.getElementById('fr-letter-spacing').addEventListener('change', async (e) => {
    currentSettings = await saveSettings({ letterSpacingEnabled: e.target.checked }, true);
    await applyReadability();
    updateOverlay();
  });

  document.getElementById('fr-line-height').addEventListener('change', async (e) => {
    currentSettings = await saveSettings({ lineHeightMode: e.target.value }, true);
    await applyReadability();
    updateOverlay();
  });

  document.getElementById('fr-bionic').addEventListener('change', async (e) => {
    currentSettings = await saveSettings({ bionicReadingEnabled: e.target.checked }, true);
    await applyReadability();
    updateOverlay();
  });

  // Font
  document.getElementById('fr-font').addEventListener('change', async (e) => {
    currentSettings = await saveSettings({ fontOverride: e.target.value }, true);
    await applyReadability();
    updateOverlay();
  });

  // Precision
  document.getElementById('fr-precision').addEventListener('change', async (e) => {
    currentSettings = await saveSettings({ precisionMode: e.target.checked }, true);
    await applyReadability();
    updateOverlay();
    setupScrollHandler();
  });

  document.getElementById('fr-precision-lines').addEventListener('change', async (e) => {
    currentSettings = await saveSettings({ precisionLineCount: parseInt(e.target.value, 10) }, true);
    await applyReadability();
    updateOverlay();
  });

  document.getElementById('scroll-mode-select').addEventListener('change', async (e) => {
    currentSettings = await saveSettings({ scrollMode: e.target.value }, true);
    setupScrollHandler();
  });

  // Appearance
  document.getElementById('theme-color-picker').addEventListener('input', async (e) => {
    const newColor = e.target.value;
    const updates = { bracketColor: newColor };
    if (currentSettings.shadingMatchTheme) {
      updates.shadingColor = newColor;
      updates.sideColor = newColor;
    }
    currentSettings = await saveSettings(updates, true);
    panel.style.color = newColor;
    panel.style.borderColor = newColor;
    document.getElementById('close-settings-btn').style.color = newColor;
    document.getElementById('reset-settings-btn').style.background = newColor;
    e.target.style.borderColor = newColor;
    const opacitySlider = document.getElementById('fr-opacity');
    if (opacitySlider) opacitySlider.style.accentColor = newColor;
    if (overlays.closeButton) overlays.closeButton.style.color = newColor;
    if (overlays.settingsButton) overlays.settingsButton.style.color = newColor;
    const handleBg = hexToRgba(newColor, 0.3);
    const handleBorder = hexToRgba(newColor, 0.5);
    [overlays.topHandle, overlays.bottomHandle].forEach(h => {
      if (h) { h.style.background = handleBg; h.style.borderColor = handleBorder; }
    });
    if (overlays.leftHandle) overlays.leftHandle.style.borderRightColor = newColor;
    if (overlays.rightHandle) overlays.rightHandle.style.borderLeftColor = newColor;
    updateOverlay();
  });

  document.getElementById('fr-opacity').addEventListener('input', async (e) => {
    const val = parseInt(e.target.value, 10) / 100;
    document.getElementById('fr-opacity-value').textContent = e.target.value + '%';
    currentSettings = await saveSettings({ shadingOpacity: val, sideOpacity: val }, true);
    updateOverlay();
  });

  document.getElementById('fr-match-theme').addEventListener('change', async (e) => {
    const match = e.target.checked;
    const updates = { shadingMatchTheme: match };
    if (match) {
      updates.shadingColor = currentSettings.bracketColor;
      updates.sideColor = currentSettings.bracketColor;
    } else {
      updates.shadingColor = '#000000';
      updates.sideColor = '#000000';
    }
    currentSettings = await saveSettings(updates, true);
    updateOverlay();
  });

  // Reset — recreate overlay so auto-detect runs fresh
  document.getElementById('reset-settings-btn').addEventListener('click', async () => {
    currentSettings = await resetSettings();
    panel.remove();
    await createOverlay();
  });
}

// ─── Overlay Updates ────────────────────────────────────────────────────────

function updateOverlay() {
  if (!active) return;
  const pos = calculatePositions(currentSettings);

  if (overlays.top) {
    overlays.top.style.height = pos.top.height;
    overlays.top.style.background = currentSettings.shadingColor;
    overlays.top.style.opacity = currentSettings.shadingOpacity;
  }
  if (overlays.bottom) {
    overlays.bottom.style.height = pos.bottom.height;
    overlays.bottom.style.background = currentSettings.shadingColor;
    overlays.bottom.style.opacity = currentSettings.shadingOpacity;
  }
  const bracketHeightVh = `${currentSettings.bracketHeight}vh`;
  if (overlays.leftShade) {
    overlays.leftShade.style.top = pos.clearTop;
    overlays.leftShade.style.height = bracketHeightVh;
    overlays.leftShade.style.width = pos.leftPos;
    overlays.leftShade.style.background = currentSettings.shadingColor;
    overlays.leftShade.style.opacity = currentSettings.shadingOpacity;
  }
  if (overlays.rightShade) {
    overlays.rightShade.style.top = pos.clearTop;
    overlays.rightShade.style.height = bracketHeightVh;
    overlays.rightShade.style.width = pos.rightPos;
    overlays.rightShade.style.background = currentSettings.shadingColor;
    overlays.rightShade.style.opacity = currentSettings.shadingOpacity;
  }
  if (overlays.topHandle) overlays.topHandle.style.top = `calc(${pos.clearTop} - 30px)`;
  if (overlays.bottomHandle) overlays.bottomHandle.style.bottom = `calc(${pos.clearBottom} - 30px)`;
  if (overlays.leftHandle) {
    overlays.leftHandle.style.top = pos.clearTop;
    overlays.leftHandle.style.height = bracketHeightVh;
    overlays.leftHandle.style.left = `calc(${pos.leftPos} - 8px)`;
  }
  if (overlays.rightHandle) {
    overlays.rightHandle.style.top = pos.clearTop;
    overlays.rightHandle.style.height = bracketHeightVh;
    overlays.rightHandle.style.right = `calc(${pos.rightPos} - 8px)`;
  }
}

function removeOverlay() {
  Object.values(overlays).forEach(el => el?.remove());
  overlays = {};
  document.getElementById('focus-bracket-settings-panel')?.remove();
  removeScrollHandler();
  removeReadability();
}

// ─── Auto-detect ────────────────────────────────────────────────────────────

async function runAutoDetect() {
  if (typeof window.detectContentBounds !== 'function') return;
  const detected = window.detectContentBounds();
  if (detected && detected.leftPercent !== null && detected.rightPercent !== null) {
    currentSettings = await saveSettings({
      leftPosition: Math.round(detected.leftPercent),
      rightPosition: Math.round(detected.rightPercent),
      lastDetectedLeft: detected.leftPercent,
      lastDetectedRight: detected.rightPercent,
    }, true);
  }
}

// ─── Scroll Handling ────────────────────────────────────────────────────────

function setupScrollHandler() {
  removeScrollHandler();
  const mode = currentSettings.scrollMode || 'normal';
  if (mode === 'normal') return;

  scrollHandler = (e) => {
    if (!active) return;
    if (e.target.closest('#focus-bracket-settings-panel') ||
        e.target.closest('.focus-bracket-handle')) return;
    e.preventDefault();

    const direction = e.deltaY > 0 ? 1 : -1;

    if (mode === 'bracket-step') {
      // Debounce: ignore rapid-fire wheel events while a step is animating
      if (isScrolling) return;
      isScrolling = true;

      let scrollPx;
      if (currentSettings.precisionMode) {
        const lineH = getLineHeightPx();
        scrollPx = lineH ? lineH * (currentSettings.precisionLineCount || 3) : null;
      }
      if (!scrollPx) {
        scrollPx = (currentSettings.bracketHeight / 100) * window.innerHeight;
      }
      window.scrollBy({ top: direction * scrollPx, behavior: 'smooth' });

      // Block next step until this one settles
      setTimeout(() => { isScrolling = false; }, 350);
    } else if (mode === 'smooth') {
      // Debounce smooth mode too — accumulate direction, fire once per frame
      if (scrollDebounceTimer) return;
      const scrollAmount = Math.abs(e.deltaY) * 0.33;
      scrollDebounceTimer = requestAnimationFrame(() => {
        window.scrollBy({ top: direction * scrollAmount, behavior: 'smooth' });
        scrollDebounceTimer = null;
      });
    }
  };

  window.addEventListener('wheel', scrollHandler, { passive: false });
}

function removeScrollHandler() {
  if (scrollHandler) {
    window.removeEventListener('wheel', scrollHandler);
    scrollHandler = null;
  }
  isScrolling = false;
  if (scrollDebounceTimer) {
    cancelAnimationFrame(scrollDebounceTimer);
    scrollDebounceTimer = null;
  }
}

// ─── Drag Handling ──────────────────────────────────────────────────────────

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  if (dragMode === 'move' || dragMode === 'resize') {
    const deltaVh = ((e.clientY - dragStartY) / window.innerHeight) * 100;
    if (dragMode === 'move') {
      currentSettings.topOffset = Math.max(0, Math.min(80, dragStartValue + deltaVh));
    } else {
      currentSettings.bracketHeight = Math.max(2, Math.min(60, dragStartValue + deltaVh));
    }
  } else if (dragMode === 'width-left' || dragMode === 'width-right') {
    const deltaPercent = ((e.clientX - dragStartX) / window.innerWidth) * 100;
    if (dragMode === 'width-left') {
      currentSettings.leftPosition = Math.max(0, Math.min(40, dragStartValue + deltaPercent));
    } else {
      currentSettings.rightPosition = Math.max(0, Math.min(40, dragStartValue - deltaPercent));
    }
  }
  updateOverlay();
});

document.addEventListener('mouseup', async () => {
  if (isDragging) {
    isDragging = false;
    dragMode = null;
    currentSettings = await saveSettings({
      topOffset: currentSettings.topOffset,
      bracketHeight: currentSettings.bracketHeight,
      leftPosition: currentSettings.leftPosition,
      rightPosition: currentSettings.rightPosition,
    }, true);
    if (overlays.topHandle) overlays.topHandle.style.opacity = '0.3';
    if (overlays.bottomHandle) overlays.bottomHandle.style.opacity = '0.3';
    if (overlays.leftHandle) overlays.leftHandle.style.opacity = '0';
    if (overlays.rightHandle) overlays.rightHandle.style.opacity = '0';
  }
});

// ─── Message Handling ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.action === 'toggle') {
    if (!initializationComplete) {
      await new Promise(resolve => {
        const check = setInterval(() => {
          if (initializationComplete) { clearInterval(check); resolve(); }
        }, 50);
      });
    }
    active = !active;
    if (active) { await createOverlay(); } else { removeOverlay(); }
  } else if (msg.action === 'keyboard-command') {
    await handleKeyboardCommand(msg.command);
  }
});

async function handleKeyboardCommand(command) {
  if (!active) return;
  switch (command) {
    case 'move-up':
      currentSettings = await saveSettings({ topOffset: Math.max(0, currentSettings.topOffset - 10) }, true);
      break;
    case 'move-down':
      currentSettings = await saveSettings({ topOffset: Math.min(80, currentSettings.topOffset + 10) }, true);
      break;
    case 'resize-taller':
      currentSettings = await saveSettings({ bracketHeight: Math.min(60, currentSettings.bracketHeight + 5) }, true);
      break;
    case 'resize-shorter':
      currentSettings = await saveSettings({ bracketHeight: Math.max(2, currentSettings.bracketHeight - 5) }, true);
      break;
  }
  updateOverlay();
}
