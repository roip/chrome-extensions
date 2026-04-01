import { prepare, layout } from '@chenglou/pretext';

const CONTENT_SELECTORS = [
  'article p',
  'main p',
  '[role="main"] p',
  '.content p',
  '.post-content p',
  '.article-content p',
  '.entry-content p',
  'p',
];

const STYLE_ID = 'focus-reader-readability-css';
const BIONIC_ATTR = 'data-fr-bionic';
const BIONIC_ORIGINAL_ATTR = 'data-fr-original';

let cachedLineHeightPx = null;

/**
 * Find the best representative content paragraph on the page.
 * Picks the first paragraph with substantial text from the most specific selector.
 */
function findContentParagraph() {
  for (const selector of CONTENT_SELECTORS) {
    const els = document.querySelectorAll(selector);
    for (const el of els) {
      const text = el.textContent?.trim();
      if (text && text.length > 100) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 20) {
          return el;
        }
      }
    }
  }
  return null;
}

/**
 * Build the CSS selector string that targets all content text elements.
 */
function contentSelector() {
  return CONTENT_SELECTORS.slice(0, -1).join(', ') + ', p';
}

/**
 * Inject or update a <style> element with typography overrides based on settings.
 */
export function injectTypographyCSS(settings) {
  let style = document.getElementById(STYLE_ID);
  const rules = [];

  if (settings.letterSpacingEnabled) {
    rules.push('letter-spacing: 0.35em !important;');
  }

  if (settings.lineHeightMode && settings.lineHeightMode !== 'default') {
    rules.push(`line-height: ${settings.lineHeightMode} !important;`);
  }

  if (settings.fontOverride && settings.fontOverride !== 'none') {
    const fontFamily = getFontFamily(settings.fontOverride);
    if (fontFamily) {
      rules.push(`font-family: ${fontFamily} !important;`);
    }
  }

  if (rules.length === 0) {
    if (style) style.remove();
    return;
  }

  const css = `${contentSelector()} { ${rules.join(' ')} }`;

  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
}

/**
 * Remove all injected typography CSS.
 */
export function removeTypographyCSS() {
  document.getElementById(STYLE_ID)?.remove();
}

/**
 * Map font override key to a CSS font-family value.
 */
function getFontFamily(fontOverride) {
  switch (fontOverride) {
    case 'atkinson':
      return '"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", sans-serif';
    case 'opendyslexic':
      return '"OpenDyslexic", sans-serif';
    default:
      return null;
  }
}

/**
 * Inject @font-face rules for bundled fonts and wait for them to load.
 */
export async function loadFont(fontOverride) {
  if (!fontOverride || fontOverride === 'none') return;

  const existingFontStyle = document.getElementById('focus-reader-font-face');
  if (existingFontStyle) existingFontStyle.remove();

  const extensionURL = (path) => chrome.runtime.getURL(path);
  let fontFaceCSS = '';

  if (fontOverride === 'atkinson') {
    fontFaceCSS = `
      @font-face {
        font-family: 'Atkinson Hyperlegible Next';
        src: url('${extensionURL('fonts/AtkinsonHyperlegibleNext-Regular.woff2')}') format('woff2');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Atkinson Hyperlegible Next';
        src: url('${extensionURL('fonts/AtkinsonHyperlegibleNext-Bold.woff2')}') format('woff2');
        font-weight: 700;
        font-style: normal;
        font-display: swap;
      }
    `;
  } else if (fontOverride === 'opendyslexic') {
    fontFaceCSS = `
      @font-face {
        font-family: 'OpenDyslexic';
        src: url('${extensionURL('fonts/OpenDyslexic-Regular.woff2')}') format('woff2');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'OpenDyslexic';
        src: url('${extensionURL('fonts/OpenDyslexic-Bold.woff2')}') format('woff2');
        font-weight: 700;
        font-style: normal;
        font-display: swap;
      }
    `;
  }

  if (fontFaceCSS) {
    const style = document.createElement('style');
    style.id = 'focus-reader-font-face';
    style.textContent = fontFaceCSS;
    document.head.appendChild(style);
    await document.fonts.ready;
  }
}

/**
 * Measure the exact line height in pixels of the page's content text
 * using pretext's canvas-based measurement (no DOM reflow).
 * Returns null if measurement fails.
 */
export function measureLineHeight() {
  const el = findContentParagraph();
  if (!el) return null;

  const text = el.textContent?.trim();
  if (!text || text.length < 50) return null;

  try {
    const style = getComputedStyle(el);
    const font = `${style.fontSize} ${style.fontFamily}`;
    const fontSize = parseFloat(style.fontSize);
    let lineHeight = parseFloat(style.lineHeight);
    const contentWidth = el.getBoundingClientRect().width;

    // getComputedStyle returns "normal" for most pages → NaN
    // Browser default for "normal" is ~1.2× font size
    if (isNaN(lineHeight) || lineHeight <= 0) {
      lineHeight = fontSize * 1.2;
    }

    if (contentWidth <= 0 || fontSize <= 0) return null;

    const prepared = prepare(text, font);
    const result = layout(prepared, contentWidth, lineHeight);

    if (result.lineCount <= 0) return null;

    const exactLineHeightPx = result.height / result.lineCount;
    cachedLineHeightPx = exactLineHeightPx;
    console.log('Focus Reader: measured line height =', exactLineHeightPx.toFixed(1), 'px',
      '(font:', fontSize, 'px, lineHeight:', lineHeight.toFixed(1), 'px, lines:', result.lineCount, ')');
    return exactLineHeightPx;
  } catch (err) {
    console.error('Focus Reader: pretext measurement failed:', err);
    return null;
  }
}

/**
 * Get the cached line height measurement, or measure fresh.
 */
export function getLineHeightPx() {
  if (cachedLineHeightPx !== null) return cachedLineHeightPx;
  return measureLineHeight();
}

/**
 * Recalibrate the bracket height based on pretext measurement.
 * Returns updated settings fields if precision mode is active, or null if no change needed.
 */
export function recalibrateBracket(settings) {
  if (!settings.precisionMode) return null;

  const lineHeightPx = measureLineHeight();
  if (!lineHeightPx) return null;

  const lineCount = settings.precisionLineCount || 3;
  const bracketHeightPx = lineHeightPx * lineCount;
  const bracketHeightVh = (bracketHeightPx / window.innerHeight) * 100;

  const clamped = Math.max(2, Math.min(60, bracketHeightVh));

  return {
    bracketHeight: clamped,
    _measuredLineHeightPx: lineHeightPx,
  };
}

/**
 * Apply bionic reading to content elements.
 * Wraps the first ~40-50% of each word in <strong> tags.
 */
export function applyBionicReading() {
  const selector = contentSelector();
  const elements = document.querySelectorAll(selector);

  for (const el of elements) {
    if (el.getAttribute(BIONIC_ATTR)) continue;

    el.setAttribute(BIONIC_ORIGINAL_ATTR, el.innerHTML);
    el.setAttribute(BIONIC_ATTR, 'true');

    bionicifyElement(el);
  }
}

/**
 * Remove bionic reading from all content elements, restoring original HTML.
 */
export function removeBionicReading() {
  const bioniced = document.querySelectorAll(`[${BIONIC_ATTR}]`);
  for (const el of bioniced) {
    const original = el.getAttribute(BIONIC_ORIGINAL_ATTR);
    if (original !== null) {
      el.innerHTML = original;
    }
    el.removeAttribute(BIONIC_ATTR);
    el.removeAttribute(BIONIC_ORIGINAL_ATTR);
  }
}

/**
 * Process an element's text nodes to apply bionic bold formatting.
 */
function bionicifyElement(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent.trim().length > 0) {
      textNodes.push(node);
    }
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent;
    const fragment = document.createDocumentFragment();
    const words = text.split(/(\s+)/);

    for (const word of words) {
      if (/^\s+$/.test(word)) {
        fragment.appendChild(document.createTextNode(word));
        continue;
      }

      if (word.length <= 1) {
        const strong = document.createElement('strong');
        strong.textContent = word;
        fragment.appendChild(strong);
        continue;
      }

      const boldLen = Math.ceil(word.length * 0.45);
      const boldPart = word.slice(0, boldLen);
      const restPart = word.slice(boldLen);

      const strong = document.createElement('strong');
      strong.textContent = boldPart;
      fragment.appendChild(strong);
      if (restPart) {
        fragment.appendChild(document.createTextNode(restPart));
      }
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }
}

/**
 * Clean up all readability modifications from the page.
 */
export function cleanupAll() {
  removeTypographyCSS();
  removeBionicReading();
  document.getElementById('focus-reader-font-face')?.remove();
  cachedLineHeightPx = null;
}
