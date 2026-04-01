chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url) {
    if (tab.url.startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai')) return;
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
  } catch (_) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['dist/detector.js', 'dist/content.js'],
      });
      await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
    } catch (err) {
      console.error('Failed to inject content script:', err);
    }
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  chrome.tabs.sendMessage(tab.id, { action: 'keyboard-command', command });
});
