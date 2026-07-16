export const BUBBLE_WIDTH = 340

const MARGIN = 8
const GAP = 8

export interface AnchorRect {
  top: number
  bottom: number
  left: number
}

export interface Position {
  top: number
  left: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * Viewport coordinates for a fixed-position bubble of `height`, anchored under the start
 * of the selection. The result always lands inside the viewport: an anchor that is
 * scrolled out of view (select-all on a long page) falls back to the top centre.
 */
/**
 * Keeps an already-placed bubble inside the viewport as its content (and height) changes,
 * without re-anchoring it to a selection that may have been scrolled away meanwhile.
 */
export function clampTop(top: number, height: number, viewportHeight: number): number {
  return clamp(top, MARGIN, viewportHeight - height - MARGIN)
}

export function bubblePosition(
  anchor: AnchorRect | null,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
): Position {
  if (anchor === null || anchor.bottom < 0 || anchor.top > viewportHeight) {
    return { top: 16, left: Math.max(MARGIN, Math.round((viewportWidth - BUBBLE_WIDTH) / 2)) }
  }

  const left = clamp(anchor.left, MARGIN, viewportWidth - BUBBLE_WIDTH - MARGIN)
  const below = anchor.bottom + GAP
  if (below + height <= viewportHeight - MARGIN) return { top: below, left }

  const above = anchor.top - GAP - height
  if (above >= MARGIN) return { top: above, left }

  return { top: clamp(below, MARGIN, viewportHeight - height - MARGIN), left }
}
