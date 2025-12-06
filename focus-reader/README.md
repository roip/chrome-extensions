# Focus Reader Bracket

A Chrome extension that helps users with dyslexia and ADHD focus on reading by creating an adjustable reading bracket with shading above and below the reading area.

## Features

- **Adjustable Reading Bracket**: Create a clear horizontal reading zone on any webpage
- **Top/Bottom Shading**: Block distracting content above and below your reading area
- **Green Bracket Lines**: Optional visual markers at the left and right edges of content
- **Draggable Controls**: Move and resize the bracket by dragging handles
- **Keyboard Shortcuts**: Quick adjustments without breaking reading flow
- **Theme Customization**: Choose your preferred bracket line and button color
- **Close Button**: Quickly dismiss the overlay with the X button

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
  - Top and bottom shading (blocks content above/below reading area)
  - Green bracket lines at left and right edges (optional, can be toggled off)
  - Drag handles (top and bottom center, inside the gray shading)
  - Close button (× at top-right of screen)
  - Settings button (⚙ at top-right of screen)

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

**Note:** Additional features (toggle bracket lines, customize theme color, reset settings) are available via the settings panel (gear icon ⚙)

### Controls

**Close Button (×)**
- Located at top-right of screen
- Click to dismiss the overlay and return to normal reading
- Alternatively, click the extension icon again to toggle off

**Settings Panel (⚙)**
- Click the gear icon at top-right of screen to access:
  - **Bracket Lines Toggle**: Turn green bracket lines on/off
  - **Theme Color Picker**: Customize the color of bracket lines and buttons
  - **Reset Button**: Restore all default settings

## Default Settings

- Top offset: 40vh (40% from top of screen)
- Bracket height: 20vh (20% of screen height)
- Bracket lines: ON (green lines at left and right edges)
- Shading color: Black (#000000)
- Shading opacity: 0.75
- Theme color: Green (#00ff00)

## Troubleshooting

**Extension doesn't activate:**
- Make sure you clicked the extension icon
- Check that the page has loaded completely
- Try refreshing the page
- Note: Extension cannot run on browser internal pages (chrome://, edge://, about:)

**Bracket not moving:**
- Ensure the overlay is active (click extension icon)
- Try using keyboard shortcuts (Alt+Up/Down)
- Drag the handles inside the gray shaded areas

**Controls not visible:**
- **Close button (×)**: Fixed at top-right of screen, left of settings button
- **Settings button (⚙)**: Fixed at top-right of screen
- **Drag handles**: Located inside the gray shading at top and bottom center
  - Handles fade to 30% opacity when inactive
  - Hover over them to make them fully visible

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
