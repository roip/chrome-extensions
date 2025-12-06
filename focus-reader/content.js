// Focus Reader Bracket - Content Script
// Manages overlay display, user controls, and settings integration

let active = false;
let overlays = {};  // Store overlay elements by ID for easy access
let currentSettings = null;
let isDragging = false;
let dragStartY = 0;
let dragStartValue = 0;
let dragMode = null; // 'move' or 'resize'
let initializationComplete = false;  // Guard flag to prevent race conditions

// Initialize on script load
initialize();

async function initialize() {
  console.log('Focus Reader: Initializing...');

  // Load settings.js functions (injected inline since we can't import in content scripts)
  await loadSettingsModule();
  console.log('Focus Reader: Settings module loaded');

  // Load current settings
  currentSettings = await loadSettings();
  console.log('Focus Reader: Settings loaded', currentSettings);

  // Listen for settings changes from other tabs
  onSettingsChanged((newSettings) => {
    currentSettings = newSettings;
    if (active) {
      updateOverlay();
    }
  });

  // Mark initialization as complete
  initializationComplete = true;
  console.log('Focus Reader: Initialization complete');
}

/**
 * Calculate overlay positions based on settings
 */
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
    rightPos: `${settings.rightPosition}%`
  };
}

/**
 * Create all overlay elements
 */
async function createOverlay() {
  // Remove any existing overlay elements first
  removeOverlay();

  // Run auto-detect if enabled
  if (currentSettings.autoDetectEnabled) {
    await runAutoDetect();
  }

  const pos = calculatePositions(currentSettings);

  // Create container
  const container = document.createElement('div');
  container.id = 'focus-bracket-container';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
    pointer-events: none;
  `;

  // Top shade
  const top = document.createElement('div');
  top.id = 'focus-bracket-top';
  top.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: ${pos.top.height};
    background: ${currentSettings.shadingColor};
    opacity: ${currentSettings.shadingOpacity};
    z-index: 9999;
    pointer-events: none;
  `;

  // Bottom shade
  const bottom = document.createElement('div');
  bottom.id = 'focus-bracket-bottom';
  bottom.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: ${pos.bottom.height};
    background: ${currentSettings.shadingColor};
    opacity: ${currentSettings.shadingOpacity};
    z-index: 9999;
    pointer-events: none;
  `;

  // No side shading - user wants gray all around (top/bottom/left/right)

  // Left bracket line (if enabled)
  let leftLine = null;
  if (currentSettings.bracketLinesEnabled) {
    leftLine = document.createElement('div');
    leftLine.id = 'focus-bracket-left-line';
    leftLine.style.cssText = `
      position: fixed;
      top: ${pos.clearTop};
      bottom: ${pos.clearBottom};
      left: ${pos.leftPos};
      width: ${currentSettings.bracketWidth}px;
      background: ${currentSettings.bracketColor};
      box-shadow: 0 0 15px ${currentSettings.bracketColor};
      z-index: 10000;
      pointer-events: none;
    `;
  }

  // Right bracket line (if enabled)
  let rightLine = null;
  if (currentSettings.bracketLinesEnabled) {
    rightLine = document.createElement('div');
    rightLine.id = 'focus-bracket-right-line';
    rightLine.style.cssText = `
      position: fixed;
      top: ${pos.clearTop};
      bottom: ${pos.clearBottom};
      right: ${pos.rightPos};
      width: ${currentSettings.bracketWidth}px;
      background: ${currentSettings.bracketColor};
      box-shadow: 0 0 15px ${currentSettings.bracketColor};
      z-index: 10000;
      pointer-events: none;
    `;
  }

  // Create drag handles
  const topHandle = createDragHandle('top', pos.clearTop);
  const bottomHandle = createDragHandle('bottom', pos.clearBottom);

  // Create close button and settings button
  const closeButton = createCloseButton();
  const settingsButton = createSettingsButton(pos);

  // Append all elements
  document.body.append(top, bottom);
  if (leftLine) document.body.append(leftLine);
  if (rightLine) document.body.append(rightLine);
  document.body.append(topHandle, bottomHandle, closeButton, settingsButton);

  // Store references
  overlays = {
    container,
    top,
    bottom,
    leftLine,
    rightLine,
    topHandle,
    bottomHandle,
    closeButton,
    settingsButton
  };
}

/**
 * Create a drag handle for moving/resizing
 */
function createDragHandle(position, offset) {
  const handle = document.createElement('div');
  handle.id = `focus-bracket-handle-${position}`;
  handle.className = 'focus-bracket-handle';

  const isTop = position === 'top';
  // Position handles INSIDE the gray area (above/below the clear bracket)
  handle.style.cssText = `
    position: fixed;
    ${isTop ? 'top' : 'bottom'}: ${isTop ? `calc(${offset} - 30px)` : `calc(${offset} - 30px)`};
    left: 50%;
    transform: translateX(-50%);
    width: 60px;
    height: 20px;
    background: rgba(0, 255, 0, 0.3);
    border: 2px solid rgba(0, 255, 0, 0.6);
    border-radius: 10px;
    z-index: 10001;
    pointer-events: auto;
    cursor: ${isTop ? 'ns-resize' : 'ns-resize'};
    opacity: 0.3;
    transition: opacity 0.2s;
  `;

  // Show on hover
  handle.addEventListener('mouseenter', () => {
    handle.style.opacity = '0.8';
  });

  handle.addEventListener('mouseleave', () => {
    if (!isDragging) {
      handle.style.opacity = '0.3';
    }
  });

  // Drag functionality
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

/**
 * Create close button to turn off overlay
 */
function createCloseButton() {
  const button = document.createElement('div');
  button.id = 'focus-bracket-close-btn';
  button.innerHTML = '×';
  button.style.cssText = `
    position: fixed;
    top: 10px;
    right: 60px;
    width: 30px;
    height: 30px;
    background: rgba(0, 0, 0, 0.7);
    color: #00ff00;
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    z-index: 10001;
    pointer-events: auto;
    cursor: pointer;
    opacity: 0.4;
    transition: opacity 0.2s;
    font-weight: bold;
    line-height: 1;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.opacity = '1';
  });

  button.addEventListener('mouseleave', () => {
    button.style.opacity = '0.4';
  });

  button.addEventListener('click', () => {
    active = false;
    removeOverlay();
  });

  return button;
}

/**
 * Create settings button
 */
function createSettingsButton(pos) {
  const button = document.createElement('div');
  button.id = 'focus-bracket-settings-btn';
  button.innerHTML = '⚙';
  button.style.cssText = `
    position: fixed;
    top: 10px;
    right: 20px;
    width: 30px;
    height: 30px;
    background: rgba(0, 0, 0, 0.7);
    color: #00ff00;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    z-index: 10001;
    pointer-events: auto;
    cursor: pointer;
    opacity: 0.4;
    transition: opacity 0.2s;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.opacity = '1';
  });

  button.addEventListener('mouseleave', () => {
    button.style.opacity = '0.4';
  });

  button.addEventListener('click', () => {
    toggleSettingsPanel();
  });

  return button;
}

/**
 * Toggle settings panel visibility
 */
function toggleSettingsPanel() {
  let panel = document.getElementById('focus-bracket-settings-panel');

  if (panel) {
    panel.remove();
  } else {
    createSettingsPanel();
  }
}

/**
 * Create settings panel
 */
function createSettingsPanel() {
  const panel = document.createElement('div');
  panel.id = 'focus-bracket-settings-panel';
  panel.style.cssText = `
    position: fixed;
    top: 50px;
    right: 20px;
    width: 250px;
    background: rgba(0, 0, 0, 0.9);
    color: #00ff00;
    padding: 20px;
    border-radius: 10px;
    border: 2px solid #00ff00;
    z-index: 10002;
    pointer-events: auto;
    font-family: Arial, sans-serif;
    font-size: 14px;
  `;

  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div style="font-weight: bold; font-size: 16px;">Settings</div>
      <button id="close-settings-btn" style="background: none; border: none; color: #00ff00; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px;">×</button>
    </div>

    <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
      <input type="checkbox" id="bracket-lines-toggle" ${currentSettings.bracketLinesEnabled ? 'checked' : ''} style="margin-right: 8px;">
      Bracket Lines
    </label>

    <div style="margin-bottom: 10px;">
      <label style="display: block; margin-bottom: 5px;">Theme Color</label>
      <input type="color" id="theme-color-picker" value="${currentSettings.bracketColor}" style="width: 100%; height: 30px; border: 1px solid #00ff00; border-radius: 5px; cursor: pointer;">
    </div>

    <button id="reset-settings-btn" style="
      width: 100%;
      padding: 8px;
      margin-top: 15px;
      background: #00ff00;
      color: black;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-weight: bold;
    ">Reset to Defaults</button>

    <div style="margin-top: 10px; font-size: 11px; opacity: 0.7; text-align: center;">
      Use Alt+Arrow keys to adjust<br/>
      Drag handles to reposition
    </div>
  `;

  document.body.append(panel);

  // Add event listeners
  document.getElementById('close-settings-btn').addEventListener('click', () => {
    panel.remove();
  });

  document.getElementById('bracket-lines-toggle').addEventListener('change', async (e) => {
    currentSettings = await saveSettings({ bracketLinesEnabled: e.target.checked }, true);
    updateOverlay();
  });

  document.getElementById('theme-color-picker').addEventListener('input', async (e) => {
    currentSettings = await saveSettings({ bracketColor: e.target.value }, true);
    updateOverlay();
    // Update settings button and panel colors
    if (overlays.settingsButton) overlays.settingsButton.style.color = e.target.value;
    panel.style.borderColor = e.target.value;
    panel.style.color = e.target.value;
  });

  document.getElementById('reset-settings-btn').addEventListener('click', async () => {
    currentSettings = await resetSettings();
    updateOverlay();
    panel.remove();
  });
}

/**
 * Update existing overlay without recreating
 */
function updateOverlay() {
  if (!active) return;

  const pos = calculatePositions(currentSettings);

  // Update top/bottom shades - height only (they're already positioned at top: 0 and bottom: 0)
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

  // No side shading - removed per user request

  // Update or create/remove bracket lines
  if (currentSettings.bracketLinesEnabled) {
    if (!overlays.leftLine) {
      overlays.leftLine = document.createElement('div');
      overlays.leftLine.id = 'focus-bracket-left-line';
      document.body.append(overlays.leftLine);
    }
    overlays.leftLine.style.cssText = `
      position: fixed;
      top: ${pos.clearTop};
      bottom: ${pos.clearBottom};
      left: ${pos.leftPos};
      width: ${currentSettings.bracketWidth}px;
      background: ${currentSettings.bracketColor};
      box-shadow: 0 0 15px ${currentSettings.bracketColor};
      z-index: 10000;
      pointer-events: none;
    `;

    if (!overlays.rightLine) {
      overlays.rightLine = document.createElement('div');
      overlays.rightLine.id = 'focus-bracket-right-line';
      document.body.append(overlays.rightLine);
    }
    overlays.rightLine.style.cssText = `
      position: fixed;
      top: ${pos.clearTop};
      bottom: ${pos.clearBottom};
      right: ${pos.rightPos};
      width: ${currentSettings.bracketWidth}px;
      background: ${currentSettings.bracketColor};
      box-shadow: 0 0 15px ${currentSettings.bracketColor};
      z-index: 10000;
      pointer-events: none;
    `;
  } else {
    overlays.leftLine?.remove();
    overlays.rightLine?.remove();
    overlays.leftLine = null;
    overlays.rightLine = null;
  }

  // Update handles - position them 30px inside gray area
  if (overlays.topHandle) {
    overlays.topHandle.style.top = `calc(${pos.clearTop} - 30px)`;
  }
  if (overlays.bottomHandle) {
    overlays.bottomHandle.style.bottom = `calc(${pos.clearBottom} - 30px)`;
  }

  // Settings button stays in top-right - no need to update position
}

/**
 * Remove all overlay elements
 */
function removeOverlay() {
  Object.values(overlays).forEach(el => el?.remove());
  overlays = {};

  // Remove settings panel if open
  document.getElementById('focus-bracket-settings-panel')?.remove();
}

/**
 * Run auto-detect and update settings
 */
async function runAutoDetect() {
  if (typeof window.detectContentBounds !== 'function') {
    console.warn('Auto-detect not available - detectContentBounds not found');
    return;
  }

  const detected = window.detectContentBounds();

  if (detected && detected.leftPercent !== null && detected.rightPercent !== null) {
    currentSettings = await saveSettings({
      leftPosition: Math.round(detected.leftPercent),
      rightPosition: Math.round(detected.rightPercent),
      lastDetectedLeft: detected.leftPercent,
      lastDetectedRight: detected.rightPercent
    }, true);
  }
}

// Global mouse event handlers for dragging
document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  const deltaY = e.clientY - dragStartY;
  const viewportHeight = window.innerHeight;
  const deltaVh = (deltaY / viewportHeight) * 100;

  if (dragMode === 'move') {
    // Move the bracket up/down
    const newTopOffset = Math.max(0, Math.min(80, dragStartValue + deltaVh));
    currentSettings.topOffset = newTopOffset;
  } else if (dragMode === 'resize') {
    // Resize the bracket height - drag down increases height
    const newHeight = Math.max(10, Math.min(60, dragStartValue + deltaVh));
    currentSettings.bracketHeight = newHeight;
  }

  updateOverlay();
});

document.addEventListener('mouseup', async () => {
  if (isDragging) {
    isDragging = false;
    dragMode = null;

    // Save settings after drag complete
    currentSettings = await saveSettings({
      topOffset: currentSettings.topOffset,
      bracketHeight: currentSettings.bracketHeight
    }, true);

    // Reset handle opacity
    if (overlays.topHandle) overlays.topHandle.style.opacity = '0.3';
    if (overlays.bottomHandle) overlays.bottomHandle.style.opacity = '0.3';
  }
});

// Listen for toggle message from background script
chrome.runtime.onMessage.addListener(async (msg) => {
  console.log('Focus Reader: Received message', msg);

  if (msg.action === 'toggle') {
    console.log('Focus Reader: Toggle action, initializationComplete:', initializationComplete);

    // Wait for initialization to complete before proceeding
    if (!initializationComplete) {
      console.log('Focus Reader: Waiting for initialization...');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (initializationComplete) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
      });
      console.log('Focus Reader: Initialization complete');
    }

    active = !active;
    console.log('Focus Reader: Active state:', active);

    if (active) {
      console.log('Focus Reader: Creating overlay...');
      await createOverlay();
      console.log('Focus Reader: Overlay created');
    } else {
      console.log('Focus Reader: Removing overlay...');
      removeOverlay();
      console.log('Focus Reader: Overlay removed');
    }
  } else if (msg.action === 'keyboard-command') {
    await handleKeyboardCommand(msg.command);
  }
});

/**
 * Handle keyboard shortcuts
 * Note: Chrome limits extensions to 4 keyboard commands
 * Additional toggles available via settings panel (gear icon)
 */
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
      currentSettings = await saveSettings({ bracketHeight: Math.max(10, currentSettings.bracketHeight - 5) }, true);
      break;
  }

  updateOverlay();
}

// Inline settings.js functions (since we can't import modules in content scripts)
async function loadSettingsModule() {
  const DEFAULT_SETTINGS = {
    topOffset: 40,
    bracketHeight: 20,
    leftPosition: 8,
    rightPosition: 8,
    sideShadingEnabled: true,
    bracketLinesEnabled: true,
    shadingColor: '#000000',
    shadingOpacity: 0.75,
    sideColor: '#000000',
    sideOpacity: 0.75,
    bracketColor: '#00ff00',
    bracketWidth: 7,
    autoDetectEnabled: true,
    lastDetectedLeft: null,
    lastDetectedRight: null
  };

  window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;

  window.loadSettings = async function() {
    try {
      console.log('Focus Reader: Calling chrome.storage.sync.get...');
      const result = await Promise.race([
        chrome.storage.sync.get('focusBracketSettings'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 5000))
      ]);
      console.log('Focus Reader: Storage result:', result);

      if (result.focusBracketSettings) {
        return { ...DEFAULT_SETTINGS, ...result.focusBracketSettings };
      }

      // No saved settings - save defaults WITHOUT calling loadSettings again
      console.log('Focus Reader: No saved settings, saving defaults');
      try {
        await chrome.storage.sync.set({ focusBracketSettings: DEFAULT_SETTINGS });
      } catch (error) {
        console.error('Focus Reader: Error saving default settings:', error);
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Focus Reader: Error loading settings:', error);
      return DEFAULT_SETTINGS;
    }
  };

  window.saveSettings = async function(updates, immediate = false) {
    const current = await loadSettings();
    const newSettings = { ...current, ...updates };

    // Validate bounds
    newSettings.topOffset = Math.max(0, Math.min(80, newSettings.topOffset));
    newSettings.bracketHeight = Math.max(10, Math.min(60, newSettings.bracketHeight));
    newSettings.leftPosition = Math.max(0, Math.min(40, newSettings.leftPosition));
    newSettings.rightPosition = Math.max(0, Math.min(40, newSettings.rightPosition));

    try {
      await chrome.storage.sync.set({ focusBracketSettings: newSettings });
      return newSettings;
    } catch (error) {
      console.error('Error saving settings:', error);
      return newSettings;
    }
  };

  window.resetSettings = async function() {
    try {
      await chrome.storage.sync.set({ focusBracketSettings: DEFAULT_SETTINGS });
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error resetting settings:', error);
      return DEFAULT_SETTINGS;
    }
  };

  window.onSettingsChanged = function(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes.focusBracketSettings) {
        callback(changes.focusBracketSettings.newValue);
      }
    });
  };
}
