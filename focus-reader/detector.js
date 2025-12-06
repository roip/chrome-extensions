// Auto-detect paragraph width algorithm for Focus Reader Bracket

/**
 * Detect content boundaries by analyzing paragraph positions
 * @returns {Object|null} - {leftPercent, rightPercent} or null if detection fails
 */
function detectContentBounds() {
  try {
    // Query common content containers and paragraphs
    const selectors = [
      'article p',
      'main p',
      '[role="main"] p',
      '.content p',
      '.post-content p',
      '.article-content p',
      '.entry-content p',
      'p'  // Fallback to all paragraphs
    ];

    let paragraphs = [];

    // Try each selector in order until we find enough paragraphs
    for (const selector of selectors) {
      paragraphs = Array.from(document.querySelectorAll(selector));
      if (paragraphs.length >= 5) break;  // Need at least 5 paragraphs for good detection
    }

    if (paragraphs.length === 0) {
      console.log('Auto-detect: No paragraphs found');
      return null;
    }

    // Filter valid paragraphs
    const validParagraphs = paragraphs.filter(p => {
      const rect = p.getBoundingClientRect();
      const textLength = p.textContent.trim().length;

      // Check if paragraph is valid for detection
      return (
        textLength > 100 &&                           // Substantial text
        rect.width > 200 &&                           // Reasonable width
        rect.width < window.innerWidth * 0.9 &&      // Not full-width
        rect.height > 20 &&                           // Has actual height
        rect.top < window.innerHeight * 3 &&         // Visible or near-visible (within 3 viewports)
        rect.left >= 0 &&                             // Not off-screen left
        rect.right <= window.innerWidth              // Not off-screen right
      );
    });

    if (validParagraphs.length < 3) {
      console.log('Auto-detect: Not enough valid paragraphs found:', validParagraphs.length);
      return null;
    }

    // Calculate left and right edges
    const leftEdges = validParagraphs.map(p => p.getBoundingClientRect().left);
    const rightEdges = validParagraphs.map(p => p.getBoundingClientRect().right);

    // Calculate median (more robust than average against outliers)
    const medianLeft = calculateMedian(leftEdges);
    const medianRight = calculateMedian(rightEdges);

    // Convert to percentages from viewport edges
    const viewportWidth = window.innerWidth;

    // Add padding (20-30px) to give some breathing room
    const padding = 25;
    const leftPercent = Math.max(0, ((medianLeft - padding) / viewportWidth) * 100);
    const rightPercent = Math.max(0, ((viewportWidth - medianRight - padding) / viewportWidth) * 100);

    // Sanity check: ensure we have a reasonable reading width
    const contentWidthPercent = 100 - leftPercent - rightPercent;
    if (contentWidthPercent < 30 || contentWidthPercent > 90) {
      console.log('Auto-detect: Detected width seems unreasonable:', contentWidthPercent + '%');
      return null;
    }

    // Calculate confidence based on consistency
    const confidence = calculateConfidence(leftEdges, rightEdges, validParagraphs.length);

    console.log('Auto-detect results:', {
      paragraphsAnalyzed: validParagraphs.length,
      leftPercent: leftPercent.toFixed(1),
      rightPercent: rightPercent.toFixed(1),
      contentWidth: contentWidthPercent.toFixed(1) + '%',
      confidence: confidence.toFixed(0) + '%'
    });

    // Only return results if confidence is reasonable
    if (confidence < 40) {
      console.log('Auto-detect: Confidence too low, using defaults');
      return null;
    }

    return {
      leftPercent: Math.round(leftPercent * 10) / 10,  // Round to 1 decimal
      rightPercent: Math.round(rightPercent * 10) / 10,
      confidence: confidence
    };

  } catch (error) {
    console.error('Auto-detect error:', error);
    return null;
  }
}

/**
 * Calculate median of an array
 * @param {number[]} values
 * @returns {number}
 */
function calculateMedian(values) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Calculate standard deviation
 * @param {number[]} values
 * @returns {number}
 */
function calculateStdDev(values) {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Calculate confidence score based on consistency and sample size
 * @param {number[]} leftEdges
 * @param {number[]} rightEdges
 * @param {number} sampleSize
 * @returns {number} Confidence percentage (0-100)
 */
function calculateConfidence(leftEdges, rightEdges, sampleSize) {
  // Calculate standard deviations
  const leftStdDev = calculateStdDev(leftEdges);
  const rightStdDev = calculateStdDev(rightEdges);

  // Lower deviation = higher confidence
  // Normalize std dev to 0-100 scale (assume 100px std dev = 0 confidence)
  const deviationScore = Math.max(0, 100 - ((leftStdDev + rightStdDev) / 2));

  // More samples = higher confidence
  // 3 samples = 30%, 10+ samples = 100%
  const sampleScore = Math.min(100, (sampleSize / 10) * 100);

  // Weight: 70% deviation consistency, 30% sample size
  const confidence = (deviationScore * 0.7) + (sampleScore * 0.3);

  return confidence;
}

/**
 * Detect if content layout has changed significantly
 * (useful for re-running detection on SPAs or dynamic content)
 * @param {Object} previousBounds - Previous detection results
 * @returns {boolean} True if significant change detected
 */
function hasLayoutChanged(previousBounds) {
  if (!previousBounds) return true;

  const current = detectContentBounds();
  if (!current) return false;

  // Check if left/right positions changed by more than 5%
  const leftDiff = Math.abs(current.leftPercent - previousBounds.leftPercent);
  const rightDiff = Math.abs(current.rightPercent - previousBounds.rightPercent);

  return leftDiff > 5 || rightDiff > 5;
}

// Make functions available globally for content.js
if (typeof window !== 'undefined') {
  window.detectContentBounds = detectContentBounds;
  window.hasLayoutChanged = hasLayoutChanged;
}
