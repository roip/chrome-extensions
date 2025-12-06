// Background service worker for Focus Reader Bracket extension

// Handle extension icon click - toggle overlay
chrome.action.onClicked.addListener(async (tab) => {
  // Check if we can access this tab (not chrome:// or edge:// URLs)
  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
    console.log('Cannot inject content script into browser internal pages');
    return;
  }

  try {
    // First, try to send a message to see if content script is already loaded
    await chrome.tabs.sendMessage(tab.id, { action: "toggle" });
  } catch (error) {
    // Content script not loaded yet, inject it first
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['detector.js', 'content.js']  // Inject detector first, then content
      });

      // After injection completes, send the toggle message
      await chrome.tabs.sendMessage(tab.id, { action: "toggle" });
    } catch (injectionError) {
      console.error('Failed to inject content script:', injectionError);
    }
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command, tab) => {
  // Send command to content script
  chrome.tabs.sendMessage(tab.id, {
    action: "keyboard-command",
    command: command
  });
});
