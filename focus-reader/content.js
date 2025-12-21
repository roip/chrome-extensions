// Focus Reader Bracket - Content Script
// Manages overlay display, user controls, and settings integration

let active = false;
let overlays = {};  // Store overlay elements by ID for easy access
let currentSettings = null;
let isDragging = false;
let dragStartY = 0;
let dragStartX = 0;
let dragStartValue = 0;
let dragMode = null; // 'move', 'resize', 'width-left', or 'width-right'
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

  // Left margin shade - covers left side of page
  const leftShade = document.createElement('div');
  leftShade.id = 'focus-bracket-left-shade';
  leftShade.style.cssText = `
    position: fixed;
    top: ${pos.clearTop};
    height: ${currentSettings.bracketHeight}vh;
    left: 0;
    width: ${pos.leftPos};
    background: ${currentSettings.shadingColor};
    opacity: ${currentSettings.shadingOpacity};
    z-index: 9999;
    pointer-events: none;
  `;

  // Right margin shade - covers right side of page
  const rightShade = document.createElement('div');
  rightShade.id = 'focus-bracket-right-shade';
  rightShade.style.cssText = `
    position: fixed;
    top: ${pos.clearTop};
    height: ${currentSettings.bracketHeight}vh;
    right: 0;
    width: ${pos.rightPos};
    background: ${currentSettings.shadingColor};
    opacity: ${currentSettings.shadingOpacity};
    z-index: 9999;
    pointer-events: none;
  `;

  // Create drag handles (top/bottom for height, left/right for width)
  const topHandle = createDragHandle('top', pos.clearTop);
  const bottomHandle = createDragHandle('bottom', pos.clearBottom);
  const leftHandle = createWidthHandle('left', pos);
  const rightHandle = createWidthHandle('right', pos);

  // Create close button and settings button
  const closeButton = createCloseButton();
  const settingsButton = createSettingsButton();

  // Append all elements
  document.body.append(top, bottom, leftShade, rightShade);
  document.body.append(topHandle, bottomHandle, leftHandle, rightHandle, closeButton, settingsButton);

  // Store references
  overlays = {
    container,
    top,
    bottom,
    leftShade,
    rightShade,
    topHandle,
    bottomHandle,
    leftHandle,
    rightHandle,
    closeButton,
    settingsButton
  };
}

/**
 * Convert hex color to rgba
 */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Create a drag handle for moving/resizing (top/bottom)
 */
function createDragHandle(position, offset) {
  const handle = document.createElement('div');
  handle.id = `focus-bracket-handle-${position}`;
  handle.className = 'focus-bracket-handle';

  const isTop = position === 'top';
  const themeColor = currentSettings.bracketColor || '#888888';
  // Position handles INSIDE the gray area (above/below the clear bracket)
  handle.style.cssText = `
    position: fixed;
    ${isTop ? 'top' : 'bottom'}: ${isTop ? `calc(${offset} - 30px)` : `calc(${offset} - 30px)`};
    left: 50%;
    transform: translateX(-50%);
    width: 60px;
    height: 20px;
    background: ${hexToRgba(themeColor, 0.3)};
    border: 2px solid ${hexToRgba(themeColor, 0.5)};
    border-radius: 10px;
    z-index: 10001;
    pointer-events: auto;
    cursor: ns-resize;
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
 * Create a width drag handle (left/right sides) - thin line, hidden by default
 */
function createWidthHandle(side, pos) {
  const handle = document.createElement('div');
  handle.id = `focus-bracket-handle-${side}`;
  handle.className = 'focus-bracket-handle';

  const isLeft = side === 'left';
  const themeColor = currentSettings.bracketColor || '#808080';
  // Thin line positioned at the edge of the clear area
  handle.style.cssText = `
    position: fixed;
    top: ${pos.clearTop};
    height: ${currentSettings.bracketHeight}vh;
    ${isLeft ? 'left' : 'right'}: ${isLeft ? pos.leftPos : pos.rightPos};
    width: 3px;
    background: ${themeColor};
    border: none;
    border-radius: 0;
    z-index: 10001;
    pointer-events: auto;
    cursor: ew-resize;
    opacity: 0;
    transition: opacity 0.2s;
  `;

  // Show on hover
  handle.addEventListener('mouseenter', () => {
    handle.style.opacity = '0.6';
  });

  handle.addEventListener('mouseleave', () => {
    if (!isDragging) {
      handle.style.opacity = '0';
    }
  });

  // Drag functionality
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

/**
 * Create close button to turn off overlay
 */
function createCloseButton() {
  const button = document.createElement('div');
  button.id = 'focus-bracket-close-btn';
  button.innerHTML = '×';
  const themeColor = currentSettings.bracketColor || '#888888';
  button.style.cssText = `
    position: fixed;
    top: 10px;
    right: 60px;
    width: 30px;
    height: 30px;
    background: rgba(0, 0, 0, 0.7);
    color: ${themeColor};
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
function createSettingsButton() {
  const button = document.createElement('div');
  button.id = 'focus-bracket-settings-btn';
  button.innerHTML = '⚙';
  const themeColor = currentSettings.bracketColor || '#888888';
  button.style.cssText = `
    position: fixed;
    top: 10px;
    right: 20px;
    width: 30px;
    height: 30px;
    background: rgba(0, 0, 0, 0.7);
    color: ${themeColor};
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
  const themeColor = currentSettings.bracketColor || '#888888';
  const panel = document.createElement('div');
  panel.id = 'focus-bracket-settings-panel';
  panel.style.cssText = `
    position: fixed;
    top: 50px;
    right: 20px;
    width: 250px;
    background: rgba(0, 0, 0, 0.9);
    color: ${themeColor};
    padding: 20px;
    border-radius: 10px;
    border: 2px solid ${themeColor};
    z-index: 10002;
    pointer-events: auto;
    font-family: Arial, sans-serif;
    font-size: 14px;
  `;

  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div style="font-weight: bold; font-size: 16px;">Settings</div>
      <button id="close-settings-btn" style="background: none; border: none; color: ${themeColor}; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px;">×</button>
    </div>

    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 5px;">Theme Color</label>
      <input type="color" id="theme-color-picker" value="${themeColor}" style="width: 100%; height: 30px; border: 1px solid ${themeColor}; border-radius: 5px; cursor: pointer;">
    </div>

    <button id="reset-settings-btn" style="
      width: 100%;
      padding: 8px;
      background: ${themeColor};
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

  document.getElementById('theme-color-picker').addEventListener('input', async (e) => {
    const newColor = e.target.value;
    currentSettings = await saveSettings({ bracketColor: newColor }, true);

    // Update panel colors
    panel.style.color = newColor;
    panel.style.borderColor = newColor;
    document.getElementById('close-settings-btn').style.color = newColor;
    document.getElementById('reset-settings-btn').style.background = newColor;
    e.target.style.borderColor = newColor;

    // Update buttons
    if (overlays.closeButton) overlays.closeButton.style.color = newColor;
    if (overlays.settingsButton) overlays.settingsButton.style.color = newColor;

    // Update top/bottom handles with new theme color (with transparency)
    const handleBg = hexToRgba(newColor, 0.3);
    const handleBorder = hexToRgba(newColor, 0.5);
    [overlays.topHandle, overlays.bottomHandle].forEach(handle => {
      if (handle) {
        handle.style.background = handleBg;
        handle.style.borderColor = handleBorder;
      }
    });

    // Update left/right handles (thin lines, solid color)
    [overlays.leftHandle, overlays.rightHandle].forEach(handle => {
      if (handle) {
        handle.style.background = newColor;
      }
    });
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

  // Update left/right margin shades
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

  // Update top/bottom handles - position them 30px inside gray area
  if (overlays.topHandle) {
    overlays.topHandle.style.top = `calc(${pos.clearTop} - 30px)`;
  }
  if (overlays.bottomHandle) {
    overlays.bottomHandle.style.bottom = `calc(${pos.clearBottom} - 30px)`;
  }

  // Update left/right width handles - thin lines at the edge
  if (overlays.leftHandle) {
    overlays.leftHandle.style.top = pos.clearTop;
    overlays.leftHandle.style.height = bracketHeightVh;
    overlays.leftHandle.style.left = pos.leftPos;
  }
  if (overlays.rightHandle) {
    overlays.rightHandle.style.top = pos.clearTop;
    overlays.rightHandle.style.height = bracketHeightVh;
    overlays.rightHandle.style.right = pos.rightPos;
  }
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

  if (dragMode === 'move' || dragMode === 'resize') {
    // Vertical dragging (top/bottom handles)
    const deltaY = e.clientY - dragStartY;
    const viewportHeight = window.innerHeight;
    const deltaVh = (deltaY / viewportHeight) * 100;

    if (dragMode === 'move') {
      // Move the bracket up/down
      const newTopOffset = Math.max(0, Math.min(80, dragStartValue + deltaVh));
      currentSettings.topOffset = newTopOffset;
    } else if (dragMode === 'resize') {
      // Resize the bracket height - drag down increases height
      const newHeight = Math.max(2, Math.min(60, dragStartValue + deltaVh));
      currentSettings.bracketHeight = newHeight;
    }
  } else if (dragMode === 'width-left' || dragMode === 'width-right') {
    // Horizontal dragging (left/right handles)
    const deltaX = e.clientX - dragStartX;
    const viewportWidth = window.innerWidth;
    const deltaPercent = (deltaX / viewportWidth) * 100;

    if (dragMode === 'width-left') {
      // Dragging left handle: drag right = increase left margin (narrower content)
      const newLeftPos = Math.max(0, Math.min(40, dragStartValue + deltaPercent));
      currentSettings.leftPosition = newLeftPos;
    } else if (dragMode === 'width-right') {
      // Dragging right handle: drag left = increase right margin (narrower content)
      const newRightPos = Math.max(0, Math.min(40, dragStartValue - deltaPercent));
      currentSettings.rightPosition = newRightPos;
    }
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
      bracketHeight: currentSettings.bracketHeight,
      leftPosition: currentSettings.leftPosition,
      rightPosition: currentSettings.rightPosition
    }, true);

    // Reset handle opacities (top/bottom visible, left/right hidden)
    if (overlays.topHandle) overlays.topHandle.style.opacity = '0.3';
    if (overlays.bottomHandle) overlays.bottomHandle.style.opacity = '0.3';
    if (overlays.leftHandle) overlays.leftHandle.style.opacity = '0';
    if (overlays.rightHandle) overlays.rightHandle.style.opacity = '0';
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
      currentSettings = await saveSettings({ bracketHeight: Math.max(2, currentSettings.bracketHeight - 5) }, true);
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
    bracketLinesEnabled: false,  // No longer using bracket lines
    shadingColor: '#000000',
    shadingOpacity: 0.75,
    sideColor: '#000000',
    sideOpacity: 0.75,
    bracketColor: '#808080',  // 50% gray - minimal saturation for less visual distraction
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
    newSettings.bracketHeight = Math.max(2, Math.min(60, newSettings.bracketHeight));  // Min 2vh for single-line reading
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
