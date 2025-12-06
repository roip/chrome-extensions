# Chrome Extensions - Deployment Guide

This repository contains Chrome extensions with easy deployment to Windows host filesystem.

## Quick Start

### Deploy to Windows

```bash
cd /home/roipa/source/chrome-extensions
./deploy-to-windows.sh
```

This will:
- Copy only the essential extension files to `C:\source\chrome-extensions\focus-reader`
- Skip documentation files (*.md) to keep deployment clean
- Override any existing deployment
- Display next steps for loading in Chrome

**Files deployed:**
- manifest.json
- background.js
- content.js
- detector.js
- settings.js

### Load Extension in Chrome

1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select: `C:\source\chrome-extensions\focus-reader`

### Update Extension

After making changes:

```bash
# Deploy updated files
./deploy-to-windows.sh

# In Chrome, go to chrome://extensions/
# Click the "Reload" button (↻) on the Focus Reader Extension card
```

## Project Structure

```
/home/roipa/source/chrome-extensions/
├── deploy-to-windows.sh      # Deployment script
├── DEPLOYMENT.md              # This file
└── focus-reader/              # Focus Reader Extension
    ├── README.md              # Extension documentation
    ├── manifest.json          # Extension configuration
    ├── background.js          # Service worker
    ├── content.js             # Main overlay logic
    ├── detector.js            # Auto-detect algorithm
    └── settings.js            # Settings management
```

## Workflow

### Development Cycle

1. **Edit** files in WSL: `/home/roipa/source/chrome-extensions/focus-reader/`
2. **Deploy** to Windows: `./deploy-to-windows.sh`
3. **Reload** in Chrome: Click reload button on extension
4. **Test** on websites

### Adding New Extensions

To add more extensions to this repository:

1. Create a new folder: `mkdir /home/roipa/source/chrome-extensions/my-new-extension`
2. Add your extension files
3. Update deployment script if needed (or create extension-specific script)

## Troubleshooting

**Script permission denied:**
```bash
chmod +x deploy-to-windows.sh
```

**Windows directory not found:**
```bash
mkdir -p /mnt/c/source/chrome-extensions
```

**Extension not updating in Chrome:**
- Click the "Reload" button (↻) on the extension card
- Or remove and re-add the extension
- Check Chrome console for errors (F12 → Console)

**WSL can't access Windows filesystem:**
- Ensure WSL 2 is properly configured
- Check if `/mnt/c` is accessible: `ls /mnt/c`

## Extensions in This Repository

### Focus Reader Bracket
**Location:** `focus-reader/`
**Description:** Adjustable reading bracket with automatic content detection for dyslexia and ADHD users
**Version:** 2.0
**Documentation:** [focus-reader/README.md](focus-reader/README.md)

---

## Tips

- **Fast iterations**: Keep Chrome DevTools open to see console logs and errors
- **Test on multiple sites**: Different layouts may behave differently
- **Use keyboard shortcuts**: Faster than clicking for repetitive testing
- **Check permissions**: Make sure manifest.json has required permissions

## Git Workflow (Optional)

If you want to version control your extensions:

```bash
cd /home/roipa/source/chrome-extensions
git init
git add .
git commit -m "Initial commit: Focus Reader Extension v2.0"
```

---

**Last Updated:** December 5, 2024
**WSL Path:** `/home/roipa/source/chrome-extensions/`
**Windows Path:** `C:\source\chrome-extensions\`
