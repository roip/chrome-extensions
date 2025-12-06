# Focus Reader Bracket

A Chrome extension that helps users with dyslexia and ADHD focus on reading by creating an adjustable reading bracket with automatic content detection and side shading.

## Features

- **Adjustable Reading Bracket**: Create a clear horizontal reading zone on any webpage
- **Automatic Content Detection**: Automatically detects paragraph margins and adjusts side shading
- **Side Shading**: Block distracting content on the sides (auto-sized to content width)
- **Green Bracket Lines**: Optional visual markers at content boundaries
- **Draggable Controls**: Move and resize the bracket by dragging handles
- **Keyboard Shortcuts**: Quick adjustments without breaking reading flow
- **Settings Panel**: Toggle features and customize colors

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `focus-reader` folder
5. The extension icon should appear in your toolbar

## Usage

### Basic Operation

- **Activate**: Click the extension icon in your toolbar
- The overlay will appear with:
  - Top and bottom shading
  - Side shading (automatically sized to content)
  - Green bracket lines at content edges
  - Drag handles (top and bottom center)
  - Settings button (top-right of clear area)

### Drag Controls

- **Top Handle**: Drag to move the reading bracket up or down
- **Bottom Handle**: Drag to resize the height of the reading bracket
- Handles fade when not in use and appear on hover

### Keyboard Shortcuts

Chrome limits extensions to 4 keyboard shortcuts. Use these for quick adjustments:

- `Alt+Up` - Move bracket up
- `Alt+Down` - Move bracket down
- `Alt+Shift+Up` - Make bracket taller
- `Alt+Shift+Down` - Make bracket shorter

**Note:** Additional features (toggle side shading, bracket lines, reset settings) are available via the settings panel (gear icon ⚙)

### Settings Panel

Click the gear icon (⚙) in the top-right of the clear area to access:

- **Side Shading Toggle**: Turn side shading on/off
- **Bracket Lines Toggle**: Turn green bracket lines on/off
- **Side Color Picker**: Change the color of side shading
- **Reset Button**: Restore all default settings

## How Auto-Detection Works

When you activate the overlay, the extension automatically:

1. Analyzes paragraph elements on the page
2. Calculates the median left and right boundaries
3. Adjusts side shading to match content width
4. Falls back to 8% margins if detection fails

This works best on:
- News articles
- Blog posts
- Documentation pages
- Any page with clear paragraph structure

## Default Settings

- Top offset: 40vh
- Bracket height: 20vh
- Side shading: ON (auto-sized)
- Bracket lines: ON
- Shading color: Black (#000000)
- Shading opacity: 0.75
- Bracket color: Green (#00ff00)

## Troubleshooting

**Extension doesn't activate:**
- Make sure you clicked the extension icon
- Check that the page has loaded completely
- Try refreshing the page

**Auto-detect not working well:**
- Some websites have complex layouts that are hard to detect
- You can manually adjust using drag handles or keyboard shortcuts
- Your adjustments are saved automatically

**Controls not visible:**
- Hover over the top/bottom center of the clear area
- The handles fade to 30% opacity when inactive
- Move your mouse near them to make them visible

## Development

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for technical details and development roadmap.

### File Structure

```
focus-reader/
├── README.md               # This file
├── IMPLEMENTATION_PLAN.md  # Technical implementation details
├── manifest.json           # Extension configuration
├── background.js           # Service worker (handles icon clicks and shortcuts)
├── content.js              # Main overlay logic and UI
├── detector.js             # Auto-detection algorithm
└── settings.js             # Settings storage management
```

## Privacy

This extension:
- ✅ Works completely locally (no data sent to servers)
- ✅ Only stores your preferences in Chrome sync storage
- ✅ Does not track your browsing
- ✅ Does not collect any personal information
- ✅ Only activates when you click the extension icon

## License

Created for personal use. Feel free to modify and adapt to your needs.

## Feedback

If you encounter issues or have suggestions, please create an issue in the repository.
