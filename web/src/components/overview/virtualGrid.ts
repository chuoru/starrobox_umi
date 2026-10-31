export const CARD_H = 184
export const GAP = 10
export const PAD = 12
const MIN_W = 210
const OVERSCAN = 2
const ROW_H = CARD_H + GAP

/** A reading of the scroller: scrollTop, clientWidth, clientHeight. */
export interface Viewport {
	readonly top: number
	readonly width: number
	readonly height: number
}
export interface GridWindow {
	readonly cols: number
	/** Spacer height. */
	readonly totalH: number
	/** items.slice(start, end) are rendered. */
	readonly start: number
	readonly end: number
	/** translateY of the rendered window. */
	readonly offsetY: number
	/** Rows moved by PageUp and PageDown. */
	readonly pageRows: number
}

/**
 * Total: for any viewport, including an offset past the content, the window lies inside the content. Identical to the
 * unclamped row math whenever top <= totalH - height.
 */
export function layoutGrid(count: number, vp: Viewport): GridWindow {
	const cols = Math.max(1, Math.floor((vp.width - PAD * 2 + GAP) / (MIN_W + GAP)))
	const rows = Math.ceil(count / cols)
	const totalH = rows * ROW_H - GAP + PAD * 2
	// The browser clamps scrollTop to this when the content shrinks. Clamping first makes the render that runs before
	// layout correct. Upper bound only, so a negative rubber-band offset behaves as before.
	const top = Math.min(vp.top, Math.max(0, totalH - vp.height))
	const first = Math.max(0, Math.floor((top - PAD) / ROW_H) - OVERSCAN)
	const last = Math.min(rows, Math.ceil((top + vp.height - PAD) / ROW_H) + OVERSCAN)
	return {
		cols,
		totalH,
		start: first * cols,
		end: last * cols,
		offsetY: PAD + first * ROW_H,
		pageRows: Math.max(1, Math.floor(vp.height / ROW_H)),
	}
}

/** The scrollTop that brings card `index` fully into view, or null when it already is. */
export function revealTop(index: number, vp: Viewport, cols: number): number | null {
	const y0 = PAD + Math.floor(index / cols) * ROW_H
	if (y0 < vp.top) return y0 - PAD
	if (y0 + CARD_H > vp.top + vp.height) return y0 + CARD_H - vp.height + PAD
	return null
}

/** The index focus moves to for a key, clamped to [0, count - 1]. Null when the key is not grid navigation. */
export function navTarget(key: string, index: number, count: number, cols: number, pageRows: number): number | null {
	let next: number
	if (key === 'ArrowRight') next = index + 1
	else if (key === 'ArrowLeft') next = index - 1
	else if (key === 'ArrowDown') next = index + cols
	else if (key === 'ArrowUp') next = index - cols
	else if (key === 'Home') next = 0
	else if (key === 'End') next = count - 1
	else if (key === 'PageDown') next = index + cols * pageRows
	else if (key === 'PageUp') next = index - cols * pageRows
	else return null
	return Math.max(0, Math.min(count - 1, next))
}
