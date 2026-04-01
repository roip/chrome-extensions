# Focus Reader Bracket - Enhancement Plan

## Summary
Enhance the reading focus Chrome extension with draggable positioning, resizable height, automatic side shading that detects paragraph margins, and low-noise on-screen controls. Side shading auto-sizes to content width on startup for seamless reading experience.

## Core Features to Add
1. **Vertical Movement** - Drag handles or keyboard shortcuts to move bracket up/down
2. **Height Resizing** - Drag handles or keyboard shortcuts to adjust clear area height
3. **Side Shading** - Block sides with same shading as top/bottom (default ON)
4. **Green Bracket Lines** - Toggle current green lines on/off (default ON, can be toggled off)
5. **On-Screen Controls** - Minimal drag handles + mini settings panel (automatic, no button)
6. **Auto-Detect Width** - Automatically detect paragraph margins on startup and set side shading width accordingly

## Current Implementation
- **Location**: `/home/roipa/source/chrome-extensions/focus-reader/`
- **Files**: manifest.json, background.js, content.js
- **Overlay**: 4 fixed divs (top/bottom shading at 40vh, left/right green bracket lines at 8%)
- **Controls**: Single browser icon click toggles overlay on/off
- **Storage**: None (all values hardcoded)

## New Project Structure
```
/home/roipa/source/chrome-extensions/
└── focus-reader/                    # Extension folder
    ├── IMPLEMENTATION_PLAN.md       # This plan (moved from .claude/plans/)
    ├── manifest.json                # Extension config
    ├── background.js                # Service worker
    ├── content.js                   # Content script
    ├── settings.js                  # NEW - Settings management
    └── detector.js                  # NEW - Auto-detect algorithm
```

## Proposed Architecture

### User Interface Approach
**On-Screen Controls** (primary) - Minimal, visually masked but clickable:
- Semi-transparent draggable control areas at edges of clear zone
- Top/bottom drag handles for vertical movement
- Corner drag handles for height resizing
- Small settings button (gear icon) to access:
  - Toggle side shading on/off
  - Toggle green bracket lines on/off
  - Color picker for side shading
  - Auto-detect paragraph width button (if easy to implement)
- Controls fade when not in use, appear on hover
- Visually low-noise (match shaded overlay aesthetic)

**Keyboard Shortcuts** (secondary) - Alternative quick adjustments:
- `Alt+Up/Down` - Move bracket vertically (10vh increments)
- `Alt+Shift+Up/Down` - Resize bracket height (5vh increments)
- `Alt+S` - Toggle side shading on/off
- `Alt+B` - Toggle green bracket lines on/off
- `Alt+D` - Trigger auto-detect (if implemented)
- `Alt+R` - Reset to defaults

**Icon Click** - Left-click toggles overlay on/off (preserve current behavior)

### Settings Storage Schema
```javascript
{
  topOffset: 40,              // vh units (default 40)
  bracketHeight: 20,          // vh units (default 20)
  leftPosition: 8,            // percentage from left
  rightPosition: 8,           // percentage from right

  // Feature toggles
  sideShadingEnabled: true,   // Default ON (auto-sized to content)
  bracketLinesEnabled: true,  // Default ON (can be toggled off)

  // Styling
  shadingColor: "#000000",
  shadingOpacity: 0.75,
  sideColor: "#000000",       // For side shading (same as top/bottom initially)
  sideOpacity: 0.75,
  bracketColor: "#00ff00",
  bracketWidth: 7,

  // Auto-detect (if implemented)
  autoDetectEnabled: false
}
```

### Modified Overlay Structure
**Current**: 4 elements (top, bottom, left line, right line)
**Proposed**: 6-8 elements with dynamic positioning:
1. Top shade - height: `${topOffset}vh`
2. Bottom shade - height: `${100 - topOffset - bracketHeight}vh`
3. Left side shade (optional) - shows if `sideShadingEnabled`
4. Right side shade (optional) - shows if `sideShadingEnabled`
5. Left bracket line (optional) - shows if `bracketLinesEnabled`
6. Right bracket line (optional) - shows if `bracketLinesEnabled`
7. On-screen controls container (NEW) - drag handles and settings button
8. Settings panel (NEW) - appears when settings button clicked

## Implementation Phases

### Phase 1: Foundation & Settings System
**Goal**: Establish storage without breaking existing functionality

1. **Create settings.js** (NEW)
   - Default settings matching current hardcoded values
   - `loadSettings()` - Load from chrome.storage.sync
   - `saveSettings(updates)` - Save with debouncing
   - `resetSettings()` - Restore defaults

2. **Update manifest.json**
   - Add `"storage"` permission
   - Add keyboard command declarations

3. **Update content.js**
   - Load settings at initialization
   - Modify `createOverlay()` to use settings values
   - Maintain backward compatibility

**Verification**: Extension works identically but uses settings system

### Phase 2: Dynamic Positioning & Resizing
**Goal**: Make bracket movable and resizable

4. **Refactor content.js**
   - Extract position calculation: `calculatePositions(settings)`
   - Create `updateOverlay(settings)` to update without recreating
   - Add bounds checking (topOffset: 0-80vh, height: 10-60vh)

5. **Implement keyboard shortcuts**
   - Update background.js to handle command messages
   - Add keyboard command handlers in content.js
   - Implement adjustment logic with debounced storage saves
   - Add visual feedback indicator (fades after 2 seconds)

**Verification**: Arrow keys move and resize bracket smoothly

### Phase 3: Side Shading System
**Goal**: Add configurable side shading

6. **Update content.js side elements**
   - Implement `renderSideElement(side, settings)` helper
   - Support three modes:
     - **brackets**: Thin green line with glow (current)
     - **shading**: Full shade from edge to position with custom color
     - **both**: Shade + bracket line overlay
   - Apply side color and opacity from settings

7. **Add Alt+S toggle**
   - Cycle through modes: brackets → shading → both
   - Update overlay in real-time
   - Save preference

**Verification**: Side shading toggles correctly with visual confirmation

### Phase 4: On-Screen Controls UI
**Goal**: Low-noise, draggable controls for adjustments

8. **Create controls.js** (NEW) or add to content.js
   - Drag handle components:
     - Top edge handle (centered) - drag to move bracket up/down
     - Bottom edge handle (centered) - drag to resize height
     - Corner handles (optional) - drag for fine control
   - Settings button (gear icon, bottom-right of clear area)
   - Mini settings panel that appears when button clicked:
     - Toggle: Side shading on/off
     - Toggle: Green bracket lines on/off
     - Color picker: Side shading color
     - Button: Auto-detect width (if implemented)
     - Button: Reset to defaults

9. **Style controls in content.js**
   - Semi-transparent drag handles (match shading opacity)
   - Fade controls when inactive (appear on hover/mouse near edges)
   - Settings panel: minimal, matches overlay aesthetic
   - Ensure clickable despite `pointer-events: none` on main overlay

10. **Implement drag functionality**
    - Add mouse event listeners to drag handles
    - Calculate new positions based on drag distance
    - Update overlay in real-time during drag
    - Debounce storage saves until drag complete
    - Show visual feedback (position/height values)

**Verification**: Drag handles move bracket smoothly, settings panel works

### Phase 5: Auto-Detect Paragraph Width (CORE FEATURE)
**Goal**: Automatically detect and set side shading to content margins
**Status**: Run on every overlay activation

11. **Create detector.js** (NEW) - Simple approach
    - `detectContentBounds()` function:
      - Query common content containers: `article`, `main`, `p` tags
      - Find paragraphs with substantial text (>100 chars)
      - Calculate median left/right bounds (robust against outliers)
      - Convert to percentages with padding
      - Return `{leftPercent, rightPercent}`
    - Keep algorithm simple - just find text column bounds

12. **Integrate into overlay activation**
    - Run auto-detect IMMEDIATELY when overlay is created
    - Apply detected values to side shading positions
    - Fallback to default 8% if detection fails or finds nothing
    - Save detected values to settings (can be manually adjusted later)
    - No button needed - fully automatic

**Verification**: Works on common websites (news articles, blogs)
**Behavior**: Seamlessly adjusts side shading to match content width

### Phase 6: Polish & Edge Cases
**Goal**: Smooth user experience

13. **Visual feedback**
    - Show current position/height values during drag
    - Smooth fade animations for controls
    - Confirmation when settings changed

14. **Edge case handling**
    - Page navigation detection (re-apply overlay)
    - Very small viewport handling (minimum sizes)
    - Ensure controls don't block content

15. **Performance optimization**
    - Debounce storage saves during drag
    - Minimize reflows during overlay updates
    - Smooth animations (CSS transitions)

## Auto-Detect Algorithm (If Implemented)
Simple approach - find text column boundaries:
```javascript
1. Query: article p, main p, or all p tags
2. Filter: text length > 100 chars, visible on screen
3. Get bounding boxes, calculate median left/right edges
4. Convert to percentages from viewport edges
5. Add small padding (20-30px)
6. Apply detected values
```

## File Structure

### Files to CREATE:
- **settings.js** (~80 lines) - Storage management, shared utilities
- **detector.js** (~80 lines, REQUIRED) - Auto-detect algorithm for paragraph margin detection

### Files to MODIFY:
- **manifest.json** - Add storage permission, keyboard commands
- **background.js** (~80 lines after) - Command handlers for keyboard shortcuts
- **content.js** (~400-500 lines after) - Main changes:
  - Dynamic overlay rendering with toggleable side shading
  - On-screen drag handles and controls
  - Mini settings panel (inline HTML/CSS)
  - Drag functionality for positioning/resizing
  - Keyboard shortcut handlers
  - Settings integration

## Critical Files for Implementation
1. [focus-reader/content.js](focus-reader/content.js) - Core overlay rendering, drag controls, auto-detect integration (most changes)
2. [focus-reader/manifest.json](focus-reader/manifest.json) - Permissions, keyboard commands
3. focus-reader/settings.js (NEW) - Storage management
4. focus-reader/detector.js (NEW, REQUIRED) - Auto-detect algorithm for content margins
5. [focus-reader/background.js](focus-reader/background.js) - Keyboard command routing

## Backward Compatibility
- Default settings match current behavior (40vh top, 20vh height, green brackets on)
- Icon click remains toggle on/off (preserve current UX)
- **NEW**: Side shading ON by default, auto-sized to content margins
- Smooth migration for existing users

## Implementation Order
1. **Phase 1**: Foundation & Settings (storage system)
2. **Phase 2**: Dynamic Positioning (keyboard shortcuts first)
3. **Phase 3**: Side Shading (always-on feature with toggles)
4. **Phase 4**: On-Screen Controls (drag handles + mini settings panel)
5. **Phase 5**: Auto-Detect Width (CORE - runs automatically on startup)
6. **Phase 6**: Polish (animations, edge cases)

## Key Design Decisions Based on User Feedback
- **On-screen drag controls** - Primary UI (user requested), visually masked but clickable
- **Side shading default ON** - Auto-sized to content margins on startup
- **Auto-detect runs automatically** - No manual button, seamless experience
- **Green brackets stay ON** - Can be toggled off via settings panel
- **Simple toggle switches** - Side shading on/off, bracket lines on/off
- **Minimal controls** - Low visual noise, fade when inactive
- **Icon click toggle preserved** - Original behavior maintained
