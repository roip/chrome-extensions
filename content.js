let active = false;
let overlays = [];

function createOverlay() {
  // Remove any old ones first
  overlays.forEach(el => el?.remove());
  overlays = [];

  // Top dim
  const top = document.createElement('div');
  top.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 40vh;
    background: black;
    opacity: 0.75;
    z-index: 9999;
    pointer-events: none;
  `;
  // Bottom dim
  const bottom = document.createElement('div');
  bottom.style.cssText = `
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 40vh;
    background: black;
    opacity: 0.75;
    z-index: 9999;
    pointer-events: none;
  `;
  // Left bracket line
  const left = document.createElement('div');
  left.style.cssText = `
    position: fixed;
    top: 40vh; bottom: 40vh;
    left: 8%;
    width: 6px;
    background: #00ff00;
    box-shadow: 0 0 10px #00ff00;
    z-index: 10000;
    pointer-events: none;
  `;
  // Right bracket line
  const right = document.createElement('div');
  right.style.cssText = `
    position: fixed;
    top: 40vh; bottom: 40vh;
    right: 8%;
    width: 6px;
    background: #00ff00;
    box-shadow: 0 0 10px #00ff00;
    z-index: 10000;
    pointer-events: none;
  `;

  document.body.append(top, bottom, left, right);
  overlays = [top, bottom, left, right];
}

function removeOverlay() {
  overlays.forEach(el => el?.remove());
  overlays = [];
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "toggle") {
    active = !active;
    if (active) createOverlay();
    else removeOverlay();
  }
});