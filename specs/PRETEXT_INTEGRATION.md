# Focus Reader × Pretext — Readability Integration Research

## Overview

This document evaluates `chenglou/pretext` — a TypeScript library for DOM-reflow-free text measurement — and how it can be used to extend Focus Reader with evidence-based readability features for dyslexia and ADHD readers.

---

## Focus Reader — Current Architecture

Focus Reader creates a viewport overlay with:

- **Top/bottom dark shading** to isolate a horizontal reading bracket zone
- **Left/right margin shading** auto-detected via paragraph `getBoundingClientRect()` analysis (`detector.js`)
- **Draggable handles**, keyboard shortcuts (`Alt+Arrow`), and three scroll modes
- **Settings** persisted in Chrome sync storage

**Key limitation**: all sizing is in `vh` units. The bracket has no awareness of actual text lines, font sizes, or line heights on the page. Every CSS typography change breaks bracket calibration.

---

## Pretext — What It Is

[`chenglou/pretext`](https://github.com/chenglou/pretext) is a pure TypeScript library for multiline text measurement and layout that avoids DOM reflow by using the browser's Canvas font engine as ground truth.

### Two-Phase Architecture

| Phase | Function | Description |
|-------|----------|-------------|
| Prepare | `prepare(text, font)` | One-time: normalize whitespace, segment text, measure via canvas. ~19ms for 500 texts. |
| Layout | `layout(prepared, maxWidth, lineHeight)` | Fast: pure arithmetic over cached widths. Returns `{ height, lineCount }`. ~0.09ms for 500 texts. |

### Key APIs

| Function | Purpose |
|----------|---------|
| `prepare()` | One-time text analysis; returns opaque prepared state |
| `layout()` | Calculate height / line count from prepared text |
| `layoutWithLines()` | Get all lines as strings with measurements |
| `walkLineRanges()` | Iterate line boundaries without building strings |
| `layoutNextLine()` | Iterator-style API for variable-width-per-line layouts |

Supports multilingual text, emojis, bidirectional text, `pre-wrap`, and browser quirk accommodations.

---

## Research: Evidence-Backed Reading Assist Techniques

### 1. Extra Letter Spacing
**Evidence level: Strong** — published in *PNAS* (2012), replicated

Extra letter spacing substantially improved reading in dyslexic children without training, by reducing **crowding** — the perceptual phenomenon where adjacent letters interfere with each other's recognition.

- Reduces reading errors and increases reading speed
- Recommended: `letter-spacing: 0.35em` (Dyslexia Style Guide)
- Effect is mechanistically well-understood, not just correlational

### 2. Line & Word Spacing
**Evidence level: Strong** — WCAG mandated, broad research support

- WCAG 2.1 requires ≥1.5× line height for accessibility compliance
- Dyslexia Style Guide: word spacing ≥ 3.5× letter spacing
- Reduces visual crowding between lines, prevents the "rivers" of whitespace that trigger ADHD mind-wandering

### 3. Font Choice
**Evidence level: Moderate**

| Font | Notes |
|------|-------|
| **Sans-serif** (Arial, Verdana) | Reduces inter-letter crowding vs. serif; broadly recommended |
| **Atkinson Hyperlegible** | Designed by Braille Institute; strong accessibility design; free |
| **OpenDyslexic** | Heavy bottoms prevent letter flipping; good for reading speed but poor fixation rate and reader preference in studies |

### 4. Bionic Reading (Bold Fixation Points)
**Evidence level: Mixed** — promising for ADHD, not proven for general use

Bolds the first ~40–50% of each word (e.g., **exa**mple) to create artificial fixation anchors the brain uses to autocomplete the word.

- 2024 *Acta Psychologica* peer-reviewed study: **no significant speed benefit** for general readers
- 2024 Utrecht University EEG study (ADHD-specific): signal that comprehension was maintained at higher speeds
- 2025 eye-tracking study: no benefit for print, but strong anecdotal self-reporting from ADHD community
- **Verdict**: Scientifically unproven but widely reported as helpful by ADHD readers. Worth offering as an opt-in.

### 5. Single-Line Focus / Reading Ruler
**Evidence level: Strong for ADHD** — attention anchoring

Isolating one or a few lines reduces distraction from surrounding text. Research on selective attention consistently shows narrowing the visual field reduces ADHD re-reading and mind-wandering. This is the core premise of Focus Reader's bracket — pretext enables pushing it to single-line precision.

### 6. Tinted Overlay Color
**Evidence level: Moderate** — Meares-Irlen syndrome

A subset of dyslexic readers experience visual stress where text appears to move or shimmer on high-contrast white backgrounds. Tinted overlays (yellow, rose, blue) reduce this. Current Focus Reader uses black shading only.

---

## Where Pretext Is the Enabler

Focus Reader currently applies a **viewport overlay** and does not touch the page's text. Adding readability features means injecting CSS typography changes, which cause text to **reflow** — changing line heights, content height, and bracket calibration.

Pretext solves this as a recalibration layer:

| Feature | Problem Without Pretext | How Pretext Solves It |
|---------|------------------------|----------------------|
| **Letter spacing injection** | `letter-spacing: 0.35em` → words take more space → more lines → bracket step wrong | Measure new line height with `layout()`, recalibrate bracket step |
| **Line height injection** | `line-height: 1.8` changes where each line sits → bracket is wrong size | `layout()` returns exact new line height → bracket snaps to real lines |
| **Bionic reading markup** | Wrapping word prefixes in `<strong>` shifts line break positions | Predict new line layout, keep bracket correctly aligned |
| **Font swap** | Different font → different character widths → reflow | Re-measure with new font string, update bracket calibration |
| **Single-line precision mode** | Need exact px height of one text line | `layout()` → `height / lineCount` = exact line height |

### The Core Pattern

```js
// 1. User enables "letter spacing" in settings
injectCSS('letter-spacing: 0.35em');

// 2. Get main content font via getComputedStyle
const el = document.querySelector('article p');
const style = getComputedStyle(el);
const font = `${style.fontSize} ${style.fontFamily}`;
const lineHeight = parseFloat(style.lineHeight);
const contentWidth = el.getBoundingClientRect().width;

// 3. Measure with pretext (no DOM reflow)
const prepared = prepare(el.textContent, font);
const { height, lineCount } = layout(prepared, contentWidth, lineHeight);
const exactLineHeightPx = height / lineCount;

// 4. Recalibrate bracket
const exactLineHeightVh = (exactLineHeightPx / window.innerHeight) * 100;
saveSettings({ bracketHeight: exactLineHeightVh * targetLines });
```

---

## Feature Roadmap

### Tier 1 — High impact, strong evidence, achievable
- **Letter spacing toggle** — inject `letter-spacing: 0.35em` on content elements; pretext recalibrates bracket
- **Line height toggle** — inject `line-height: 1.5` or `1.8`; pretext recalibrates bracket
- **Single-line precision mode** — pretext measures exact line height → bracket = exactly 1, 2, or 3 lines
- **Line-accurate Bracket Step scroll** — scroll advances by exact measured line height, not approximate `vh`

### Tier 2 — High demand, mixed evidence, achievable
- **Bionic reading toggle** — wrap word prefixes in `<strong>` via DOM manipulation; pretext re-measures layout
- **Font swap** — inject Atkinson Hyperlegible or OpenDyslexic via `@font-face`; pretext remeasures after load

### Tier 3 — Speculative / more complex
- **Tint color overlay** — replace black shading with warm/cool tints (yellow `#fef9c3`, blue `#dbeafe`, rose `#fce7f3`) for visual stress relief
- **Word-by-word highlight mode** — pretext `walkLineRanges()` to get line positions → advance a highlight span as the user reads
- **Reading speed pacer** — pretext line positions → auto-advance bracket at a user-set WPM rate

---

## Integration Notes

- **Bundling**: Pretext is a pure JS/TS library with no dependencies. It can be bundled into the extension via a build step (`bun build` / `esbuild`) and injected as a content script. Manifest V3 does not allow CDN imports.
- **Font acquisition**: `getComputedStyle(el).font` gives the full font shorthand string that pretext accepts. `system-ui` is less accurate on macOS — prefer resolved font family names.
- **Timing**: Run pretext measurement after any CSS injection and after fonts are confirmed loaded (`document.fonts.ready`).
- **Scope**: Pretext is the recalibration layer — it does not replace the bracket overlay mechanism, only keeps it correctly sized after typography changes.

---

## Sources

- [chenglou/pretext on GitHub](https://github.com/chenglou/pretext)
- [Pretext: TypeScript library for multiline text measurement | Hacker News](https://news.ycombinator.com/item?id=47556290)
- [Extra-large letter spacing improves reading in dyslexia — PNAS](https://www.pnas.org/doi/10.1073/pnas.1205566109)
- [Inter-letter spacing, inter-word spacing, and font with dyslexia-friendly features — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7188700/)
- [No, Bionic Reading does not work — PubMed / Acta Psychologica 2024](https://pubmed.ncbi.nlm.nih.gov/38723450/)
- [Guiding the Gaze: How Bionic Reading Influences Eye Movements — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12565662/)
- [Usability of Bionic Reading on Different Mediums: Eye-Tracking Study 2025](https://journals.sagepub.com/doi/10.1177/21582440251376158)
- [Bionic Reading for ADHD: Can It Help? — Healthline](https://www.healthline.com/health/adhd/social-bionic-reading-for-adhd)
- [Inclusive Typography: Fonts That Support Dyslexia, Low Vision, and ADHD](https://medium.com/@blessingokpala/inclusive-typography-fonts-that-support-dyslexia-low-vision-and-adhd-1f6bc13aff50)
