chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }, () => {
    // After making sure content.js is injected, send the toggle message
    chrome.tabs.sendMessage(tab.id, { action: "toggle" });
  });
});