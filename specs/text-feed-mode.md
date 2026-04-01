# Text Feed Mode — Pretext-Powered Reading Viewport

## Problem

The current bracket overlay sits fixed on the viewport while the page scrolls underneath. Scroll-based navigation (bracket-step, smooth) constantly desyncs because:

- `scrollBy` with `behavior: 'smooth'` queues animations that stack and overshoot
- Different sites have different scroll behaviors, sticky headers, lazy-loaded content
- The bracket has no relationship to actual text lines — it's a viewport window, not a text-aware reader

## Concept

Replace scroll-based reading with a **text feed**: the bracket becomes a text viewport that displays exactly N lines of content. Navigation advances the line index, swapping in the next set of lines. The page doesn't scroll — text flows through the bracket.

This is the core use case pretext enables: `layoutWithLines()` gives us every line as a string with exact measurements, so we know precisely what text fits at any width.

## How It Works

### Activation Flow

```
User enables Focus Reader
  → detector.js finds content bounds (existing)
  → Extract article content as block elements (paragraphs, headings, lists)
  → For each block: prepareWithSegments(text, font) + layoutWithLines(prepared, width, lineHeight)
  → Build a flat array of all lines across all blocks, with metadata (block type, index)
  → Display lines [0..N-1] in the bracket zone
  → Hide original page content behind the shading overlay
```

### Navigation

| Action | Behavior |
|--------|----------|
| Scroll wheel down | Advance by N lines (one bracket-full) |
| Scroll wheel up | Go back N lines |
| Arrow down | Advance by 1 line |
| Arrow up | Go back 1 line |
| Page Down | Advance by N lines |
| Page Up | Go back N lines |

N = precisionLineCount (1, 2, 3, or 5 from settings).

### Pretext APIs Used

| API | Purpose |
|-----|---------|
| `prepareWithSegments(text, font)` | One-time text analysis, returns prepared state with segment data |
| `layoutWithLines(prepared, maxWidth, lineHeight)` | Returns `{ lines: [{ text, width, start, end }], lineCount, height }` |
| `layoutNextLine(prepared, cursor, maxWidth)` | Iterator API — can lazily compute lines on demand for very long articles |

### Rendering

The bracket clear zone currently shows the page content through a transparent area. In text feed mode:

1. **Fill the bracket zone with an opaque background** (white or page background color)
2. **Render the current N lines** as styled text inside the bracket zone
3. **Apply readability settings** directly to the rendered text (letter-spacing, line-height, font, bionic reading)
4. **Show a progress indicator** (e.g., "Line 45 of 312" or a thin progress bar)

The rendered text inherits the page's typography by default, or uses the font override if set. Since we control the rendering, readability features apply perfectly — no CSS specificity battles with site styles.

## Architecture

### New Module: `src/textfeed.js`

```
textfeed.js
├── extractContent(document) → ContentBlock[]
│   Find article/main content, extract as ordered blocks
│   Each block: { type: 'p'|'h1'|'h2'|'li'|..., text, element, links[] }
│
├── layoutContent(blocks, width, font, lineHeight) → FeedLine[]
│   Run prepareWithSegments + layoutWithLines per block
│   Flatten into a single ordered line array
│   Each line: { text, width, blockIndex, blockType, lineInBlock }
│
├── createFeedView(settings) → HTMLElement
│   Create the text rendering container inside the bracket zone
│   Styled div with proper font, colors, padding
│
├── renderLines(feedView, lines, startIndex, count)
│   Clear and render the current set of lines
│   Apply bionic reading inline if enabled
│   Preserve links as clickable spans (map back to original hrefs)
│
├── advance(delta) → newStartIndex
│   Move the reading position by delta lines
│   Clamp to [0, totalLines - count]
│
└── getProgress() → { current, total, percent }
    For the progress indicator
```

### Integration with content.js

Text feed mode is a new scroll mode option alongside the existing ones:

```js
// Settings
scrollMode: 'text-feed'  // new option, alongside 'bracket-step', 'smooth', 'normal'
```

When `scrollMode === 'text-feed'`:
- `createOverlay()` calls `textfeed.extractContent()` + `textfeed.layoutContent()`
- The bracket zone gets a feed view instead of being transparent
- Wheel/keyboard events call `textfeed.advance()` instead of `window.scrollBy()`
- Readability changes trigger `textfeed.layoutContent()` re-run (pretext re-layout is ~0.09ms)

When switching away from text-feed mode, the feed view is removed and normal page scroll resumes.

### Content Extraction Strategy

Reuse the selector list from `detector.js` / `readability.js`:

1. Find the main content container (`article`, `main`, `[role="main"]`, etc.)
2. Walk its child elements in DOM order
3. For each element, classify as block type and extract:
   - **Paragraphs** (`p`): text content, inline links with href
   - **Headings** (`h1`-`h6`): text content, rendered with bold/size
   - **List items** (`li`): text content with bullet prefix
   - **Block quotes** (`blockquote`): text content, rendered with indent
   - **Images** (`img`): skip or show as `[Image: alt text]` placeholder
   - **Code blocks** (`pre`, `code`): preserve as-is, skip pretext layout
4. Skip nav, footer, sidebar, ad containers

### Handling Rich Content (Links, Bold, Italic)

Pretext works on plain text strings, but the rendered output needs to preserve inline formatting. Approach:

1. Extract text content for pretext measurement (plain string)
2. Separately track inline markup ranges: `[{ start, end, type: 'link', href }, { start, end, type: 'bold' }, ...]`
3. When rendering a line, map character ranges back to markup and wrap in appropriate elements
4. Links become clickable `<a>` tags, bold/italic preserved as `<strong>`/`<em>`

This is the most complex part. A simpler v1 could render plain text only with a "view original" link per paragraph.

## Phases

### Phase 1: Plain Text Feed (MVP)
- Extract article paragraphs as plain text
- Layout with pretext, build line array
- Render in bracket zone with opaque background
- Wheel navigation advances by N lines
- Progress indicator
- Works with existing readability settings (font, letter-spacing, line-height, bionic)

### Phase 2: Rich Content
- Preserve links (clickable in feed view)
- Headings rendered with appropriate sizing
- List items with bullets
- Block quotes with indent styling

### Phase 3: Polish
- Smooth line transition animation (fade or slide)
- "View in context" — click to jump to that position in the original page
- Handle dynamic/lazy-loaded content (re-extract on mutation)
- Keyboard shortcut to toggle between text-feed and scroll modes

## Risks

- **Content extraction quality** — every site structures HTML differently. The selector-based approach works for standard articles but will miss edge cases (SPAs, custom components, shadow DOM).
- **Inline markup mapping** — mapping character offsets from pretext lines back to DOM nodes with nested formatting is non-trivial. Phase 1 avoids this by using plain text.
- **Performance on very long articles** — `layoutWithLines()` on 10,000+ words. Pretext benchmarks show ~0.09ms for 500 texts, so this should be fine, but worth testing. Can use `layoutNextLine()` iterator for lazy computation if needed.
- **User expectation** — text feed mode fundamentally changes how the page looks. Need a clear toggle and easy way to go back to normal scroll mode.
