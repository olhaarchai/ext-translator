import { describe, expect, it } from 'vitest'
import { BUBBLE_WIDTH, bubblePosition, clampTop } from './bubble-position'

const VIEWPORT_W = 1200
const VIEWPORT_H = 800

describe('bubblePosition', () => {
  it('sits just below the anchor when there is room', () => {
    const position = bubblePosition({ top: 100, bottom: 120, left: 200 }, 160, VIEWPORT_W, VIEWPORT_H)
    expect(position).toEqual({ top: 128, left: 200 })
  })

  it('flips above the anchor when it does not fit below', () => {
    const position = bubblePosition({ top: 600, bottom: 620, left: 200 }, 300, VIEWPORT_W, VIEWPORT_H)
    expect(position).toEqual({ top: 292, left: 200 })
  })

  it('stays fully inside the viewport when it fits neither below nor above', () => {
    const height = 700
    const position = bubblePosition({ top: 300, bottom: 320, left: 200 }, height, VIEWPORT_W, VIEWPORT_H)
    expect(position.top).toBeGreaterThanOrEqual(8)
    expect(position.top + height).toBeLessThanOrEqual(VIEWPORT_H - 8)
  })

  it('centres near the top when there is no anchor at all', () => {
    const position = bubblePosition(null, 160, VIEWPORT_W, VIEWPORT_H)
    expect(position).toEqual({ top: 16, left: (VIEWPORT_W - BUBBLE_WIDTH) / 2 })
  })

  it('centres near the top when the anchor is scrolled above the viewport', () => {
    // Select-all on a long page: the selection starts far above what the user can see.
    const position = bubblePosition({ top: -4000, bottom: -3980, left: 0 }, 160, VIEWPORT_W, VIEWPORT_H)
    expect(position).toEqual({ top: 16, left: (VIEWPORT_W - BUBBLE_WIDTH) / 2 })
  })

  it('centres near the top when the anchor is below the viewport', () => {
    const position = bubblePosition({ top: 900, bottom: 920, left: 0 }, 160, VIEWPORT_W, VIEWPORT_H)
    expect(position).toEqual({ top: 16, left: (VIEWPORT_W - BUBBLE_WIDTH) / 2 })
  })

  it('clamps a right-edge anchor so the bubble never overflows horizontally', () => {
    const position = bubblePosition({ top: 100, bottom: 120, left: 1190 }, 160, VIEWPORT_W, VIEWPORT_H)
    expect(position.left).toBe(VIEWPORT_W - BUBBLE_WIDTH - 8)
  })

  it('clamps a negative left anchor to the viewport margin', () => {
    const position = bubblePosition({ top: 100, bottom: 120, left: -50 }, 160, VIEWPORT_W, VIEWPORT_H)
    expect(position.left).toBe(8)
  })

  it('never returns a position above the viewport top', () => {
    const position = bubblePosition({ top: 10, bottom: 30, left: 100 }, 780, VIEWPORT_W, VIEWPORT_H)
    expect(position.top).toBeGreaterThanOrEqual(8)
  })
})

describe('clampTop', () => {
  it('leaves a position that already fits untouched', () => {
    expect(clampTop(200, 160, VIEWPORT_H)).toBe(200)
  })

  it('pulls the bubble up when taller content would overflow the bottom', () => {
    // Result replaced a short status line, so the bubble grew in place.
    expect(clampTop(700, 300, VIEWPORT_H)).toBe(VIEWPORT_H - 300 - 8)
  })

  it('never pushes the bubble above the viewport top', () => {
    expect(clampTop(700, 900, VIEWPORT_H)).toBe(8)
  })
})
