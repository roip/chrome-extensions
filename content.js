let active = false;
let overlays = [];

function createOverlay() {
  overlays.forEach(el => el?.remove());
  overlays = [];

  const styles = `
    position: fixed;
    background: black;
    opacity: 0.75;
    z-index: 9999;
    pointer-events: none;
  `;

  const top = Object.assign(document.createElement('div'), {
    style: styles + `top:0; left:0; right:0; height:40vh;`
  });
  const bottom = Object.assign(document.createElement('div'), {
    style: styles + `bottom:0; left:0; right:0; height:40vh;`
  });
  const left = Object.assign(document.createElement('div'), {
    style: `
      position:fixed; top:40vh; bottom:40vh; left:8%;
      width:7px; background:#00ff00;
      box-shadow:0 0 15px #00ff00;
      z-index:10000; pointer-events:none;
    `
  });
  const right = Object.assign(document.createElement('div'), {
    style: `
      position:fixed; top:40vh; bottom:40vh; right:8%;
      width:7px; background:#00ff00;
      box-shadow:0 0 15px #00ff00;
      z-index:10000; pointer-events:none;
    `
  });

  document.body.append(top, bottom, left, right);
  overlays = [top, bottom, left, right];
}

function removeOverlay() {
  overlays.forEach(el => el?.remove());
  overlays = [];
}

// Listen for toggle message
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "toggle") {
    active = !active;
    active ? createOverlay() : removeOverlay();
  }
});

// If the script was already injected before, make sure we start off
if (active) createOverlay();