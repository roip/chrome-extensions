# Pretext Readability Integration Plan

## Overview

Add evidence-based readability features to Focus Reader using the pretext library for reflow-free text measurement and bracket recalibration.

- **Tier 1** (strong evidence): letter spacing, line height, single-line precision, line-accurate scroll
- **Tier 2** (high demand, mixed evidence): bionic reading, font swap

The spec is written here before any code changes. This document is the source of truth for the implementation.

---

## Current State

- **No build/bundle step** — `build.sh` copies raw JS files into a zip. No npm install, no bundler.
- **No module imports** — `content.js` inlines all settings logic (line 805-890) because MV3 content scripts can't use ES modules. `background.js` injects files via `chrome.scripting.executeScript({ files: ['detector.js', 'content.js'] })`.
- **All sizing in `vh` units** — bracket height, top offset, and positions are all viewport-relative with no awareness of actual text line heights.
- **Settings schema** — stored in `chrome.storage.sync` under `focusBracketSettings` with keys for positioning, shading, and styling (see `content.js` lines 806-823).
- **package.json is bare** — name, version, license only. No dependencies.

---

## Phase 1: Add Build Step and Bundle Pretext

The extension currently has no bundler. Pretext is a TS/JS library that must be bundled into the content script since MV3 forbids CDN imports.

- Add `pretext` as a dependency in `focus-reader/package.json`
- Add `esbuild` as a dev dependency for bundling
- Create an esbuild config that bundles `content.js` + `detector.js` + new modules into a single output file (or keep detector separate and bundle content + readability modules)
- Update `build.sh` to run `npm install && npx esbuild ...` before zipping
- Update `manifest.json` and `background.js` to reference bundled output file(s)
- Ensure the current extension behavior is preserved after bundling (no feature changes in this phase)

---

## Phase 2: Typography Module + Settings Schema

Create a new `readability.js` module that handles CSS injection and pretext-based measurement.

### New settings keys to add to DEFAULT_SETTINGS:

```js
// Readability - Tier 1
letterSpacingEnabled: false,    // 0.35em letter-spacing
lineHeightMode: 'default',     // 'default' | '1.5' | '1.8' | '2.0'
precisionMode: false,          // single-line precision bracket sizing
precisionLineCount: 3,         // number of lines in precision mode (1, 2, or 3)
// Readability - Tier 2
bionicReadingEnabled: false,
fontOverride: 'none',          // 'none' | 'atkinson' | 'opendyslexic'
```

### New readability.js module responsibilities:

- **`injectTypographyCSS(settings)`** — inject/remove a `<style>` element targeting content elements (`article p, main p, [role="main"] p, .content p, p`) with letter-spacing, line-height, and font-family overrides
- **`measureLineHeight(element)`** — use pretext's `prepare()` + `layout()` on the target element to get exact pixel line height without DOM reflow
- **`recalibrateBracket(settings)`** — after CSS injection, measure new line heights and return updated bracket sizing in `vh`
- **`applyBionicReading(element)` / `removeBionicReading(element)`** — DOM manipulation to wrap word prefixes in `<strong>` tags; must be cleanly reversible
- **`loadFont(fontName)`** — inject `@font-face` for Atkinson Hyperlegible or OpenDyslexic, wait for `document.fonts.ready`

### Core measurement pattern (from PRETEXT_INTEGRATION.md):

```js
const el = document.querySelector('article p');
const style = getComputedStyle(el);
const font = `${style.fontSize} ${style.fontFamily}`;
const lineHeight = parseFloat(style.lineHeight);
const contentWidth = el.getBoundingClientRect().width;

const prepared = prepare(el.textContent, font);
const { height, lineCount } = layout(prepared, contentWidth, lineHeight);
const exactLineHeightPx = height / lineCount;
const exactLineHeightVh = (exactLineHeightPx / window.innerHeight) * 100;
```

### Integration point in content.js

The `createOverlay()` function (content.js line 64) currently calls `runAutoDetect()` then `calculatePositions()`. After Phase 2:

1. `runAutoDetect()` (existing — width detection)
2. **`injectTypographyCSS(currentSettings)`** (new — apply letter spacing / line height / font)
3. **`await document.fonts.ready`** (new — wait for font swap if applicable)
4. **`recalibrateBracket(currentSettings)`** (new — measure with pretext, update bracket height)
5. `calculatePositions()` (existing — now uses calibrated values)

---

## Phase 3: Tier 1 Features

### 3a: Letter Spacing Toggle
- Setting: `letterSpacingEnabled` (boolean)
- CSS: `letter-spacing: 0.35em` on content elements
- After injection: pretext re-measures, bracket recalibrates

### 3b: Line Height Toggle
- Setting: `lineHeightMode` (`'default'` | `'1.5'` | `'1.8'` | `'2.0'`)
- CSS: `line-height: <value>` on content elements
- After injection: pretext re-measures, bracket recalibrates

### 3c: Single-Line Precision Mode
- Setting: `precisionMode` (boolean), `precisionLineCount` (1, 2, or 3)
- Uses pretext measurement to set bracket height to exactly N text lines
- Overrides the `vh`-based `bracketHeight` with a pixel-accurate value converted to `vh`

### 3d: Line-Accurate Bracket Step Scroll
- Enhances the existing `'bracket-step'` scroll mode (content.js line 647)
- Currently scrolls by `bracketHeight` in vh — change to scroll by exact measured line height in pixels
- Only active when `precisionMode` is enabled

---

## Phase 4: Tier 2 Features

### 4a: Bionic Reading Toggle
- Setting: `bionicReadingEnabled` (boolean)
- DOM manipulation: find text nodes in content, wrap first ~40-50% of each word in `<strong>`
- Must be reversible (store original innerHTML, or use a marker attribute to identify injected spans)
- After injection: pretext re-measures (bold text may cause reflow), bracket recalibrates

### 4b: Font Swap
- Setting: `fontOverride` (`'none'` | `'atkinson'` | `'opendyslexic'`)
- Bundle font files with the extension (add to manifest `web_accessible_resources`)
- Inject `@font-face` rule + `font-family` override on content elements
- Wait for `document.fonts.ready` before measuring with pretext
- After load: pretext re-measures with new font string, bracket recalibrates

---

## Phase 5: Settings Panel UI

Extend the settings panel (content.js line 400, `createSettingsPanel()`) with a **"Readability"** section below the existing controls:

- Toggle: Letter Spacing (on/off)
- Dropdown: Line Height (Default / 1.5x / 1.8x / 2.0x)
- Toggle: Precision Mode (on/off) + line count selector (1/2/3)
- Toggle: Bionic Reading (on/off)
- Dropdown: Font (Default / Atkinson Hyperlegible / OpenDyslexic)

Each toggle/dropdown change triggers: inject CSS -> measure with pretext -> recalibrate bracket -> update overlay.

---

## Phase 6: Build + Packaging Updates

- Update `build.sh` `REQUIRED_FILES` array to include bundled output and font files
- Add font files to `web_accessible_resources` in `manifest.json` (needed for `@font-face` to reference them from injected CSS)
- Test that the zip output works correctly when loaded as unpacked extension

---

## Key Files Changed

- **`focus-reader/package.json`** — add pretext + esbuild dependencies
- **`focus-reader/manifest.json`** — add web_accessible_resources for fonts, update script references
- **`focus-reader/background.js`** — update script injection to use bundled file
- **`focus-reader/content.js`** — integrate readability module, extend settings schema, extend settings panel UI
- **`focus-reader/readability.js`** (NEW) — typography CSS injection, pretext measurement, bionic reading, font loading
- **`build.sh`** — add npm install + esbuild bundling step

---

## Risks / Open Questions

- **Font file size** — Atkinson Hyperlegible and OpenDyslexic add weight to the extension package. May want to lazy-load or offer as optional download.
- **Bionic reading reversibility** — wrapping text nodes in `<strong>` is invasive. Need a robust apply/revert strategy that doesn't break page interactivity (event listeners, etc.).
- **Cross-site CSS specificity** — injected `letter-spacing` / `line-height` / `font-family` may be overridden by site CSS with `!important`. May need `!important` on injected styles.
- **Pretext accuracy with `system-ui`** — resolved font names vary by OS. May need to resolve `system-ui` to actual font name before passing to pretext.
