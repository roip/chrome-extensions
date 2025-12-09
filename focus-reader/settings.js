// Settings management for Focus Reader Bracket extension

const DEFAULT_SETTINGS = {
  // Position & Dimensions
  topOffset: 40,              // vh units (0-80)
  bracketHeight: 20,          // vh units (2-60)
  leftPosition: 8,            // percentage from left edge
  rightPosition: 8,           // percentage from right edge

  // Feature toggles
  sideShadingEnabled: true,   // Default ON (auto-sized to content)
  bracketLinesEnabled: true,  // Default ON (can be toggled off)

  // Styling
  shadingColor: '#000000',
  shadingOpacity: 0.75,
  sideColor: '#000000',       // For side shading (same as top/bottom initially)
  sideOpacity: 0.75,
  bracketColor: '#00ff00',
  bracketWidth: 7,            // pixels

  // Auto-detect
  autoDetectEnabled: true,    // Run auto-detect on overlay activation
  lastDetectedLeft: null,     // Cache last detected values
  lastDetectedRight: null
};

// Debounce timer for storage saves
let saveTimeout = null;

/**
 * Load settings from chrome.storage.sync
 * @returns {Promise<Object>} Settings object
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('focusBracketSettings');

    if (result.focusBracketSettings) {
      // Merge with defaults to handle new settings in updates
      return { ...DEFAULT_SETTINGS, ...result.focusBracketSettings };
    }

    // First time user - initialize with defaults
    await saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error loading settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to chrome.storage.sync with debouncing
 * @param {Object} updates - Settings to save (will be merged with existing)
 * @param {boolean} immediate - Skip debouncing if true
 * @returns {Promise<Object>} Updated settings object
 */
async function saveSettings(updates, immediate = false) {
  // Load current settings first
  const current = await loadSettings();
  const newSettings = { ...current, ...updates };

  // Validate bounds
  newSettings.topOffset = Math.max(0, Math.min(80, newSettings.topOffset));
  newSettings.bracketHeight = Math.max(2, Math.min(60, newSettings.bracketHeight));
  newSettings.leftPosition = Math.max(0, Math.min(40, newSettings.leftPosition));
  newSettings.rightPosition = Math.max(0, Math.min(40, newSettings.rightPosition));
  newSettings.shadingOpacity = Math.max(0, Math.min(1, newSettings.shadingOpacity));
  newSettings.sideOpacity = Math.max(0, Math.min(1, newSettings.sideOpacity));

  const save = async () => {
    try {
      await chrome.storage.sync.set({ focusBracketSettings: newSettings });
      return newSettings;
    } catch (error) {
      console.error('Error saving settings:', error);
      return newSettings;
    }
  };

  if (immediate) {
    return await save();
  } else {
    // Debounce saves (wait 500ms after last change)
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    return new Promise((resolve) => {
      saveTimeout = setTimeout(async () => {
        const result = await save();
        resolve(result);
      }, 500);
    });
  }
}

/**
 * Reset settings to defaults
 * @returns {Promise<Object>} Default settings object
 */
async function resetSettings() {
  try {
    await chrome.storage.sync.set({ focusBracketSettings: DEFAULT_SETTINGS });
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error resetting settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Listen for settings changes from other tabs/windows
 * @param {Function} callback - Called when settings change with new settings object
 */
function onSettingsChanged(callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.focusBracketSettings) {
      callback(changes.focusBracketSettings.newValue);
    }
  });
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_SETTINGS,
    loadSettings,
    saveSettings,
    resetSettings,
    onSettingsChanged
  };
}
