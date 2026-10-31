import assert from 'node:assert/strict'
import { test } from 'node:test'
import { layoutGrid, navTarget, revealTop } from './virtualGrid.ts'

// The old inline math from EpisodeGrid.vue, kept here as the oracle.
function oldWindow(count: number, width: number, height: number, top: number) {
	const CARD_H = 184, GAP = 10, MIN_W = 210, OVERSCAN = 2, PAD = 12
	const cols = Math.max(1, Math.floor((width - PAD * 2 + GAP) / (MIN_W + GAP)))
	const rowH = CARD_H + GAP
	const rows = Math.ceil(count / cols)
	const totalH = rows * rowH - GAP + PAD * 2
	const first = Math.max(0, Math.floor((top - PAD) / rowH) - OVERSCAN)
	const last = Math.min(rows, Math.ceil((top + height - PAD) / rowH) + OVERSCAN)
	return { cols, totalH, start: first * cols, end: last * cols, offsetY: PAD + first * rowH, pageRows: Math.max(1, Math.floor(height / rowH)) }
}

test('layoutGrid equals the old math for every reachable offset', () => {
	for (const count of [1, 7, 60, 1200, 5000]) {
		for (const width of [320, 700, 1210, 2000]) {
			for (const height of [300, 600, 950]) {
				const maxTop = Math.max(0, oldWindow(count, width, height, 0).totalH - height)
				for (let top = 0; top <= maxTop; top += 137) {
					assert.deepEqual(layoutGrid(count, { top, width, height }), oldWindow(count, width, height, top), `${count} ${width} ${height} ${top}`)
				}
				assert.deepEqual(layoutGrid(count, { top: maxTop, width, height }), oldWindow(count, width, height, maxTop))
			}
		}
	}
})

test('an offset past the content still renders the last rows (the stale-window case)', () => {
	const g = layoutGrid(60, { top: 99999, width: 1210, height: 600 })
	const cols = g.cols
	assert.ok(g.end > g.start, 'window is not empty')
	assert.equal(g.end, Math.ceil(60 / cols) * cols, 'ends at the last row')
	assert.ok(g.offsetY < g.totalH, 'window starts inside the content')
})

test('layoutGrid with no items has an empty window', () => {
	const g = layoutGrid(0, { top: 500, width: 1210, height: 600 })
	assert.equal(g.start, 0)
	assert.equal(g.end, 0)
})

test('revealTop: above, below, inside', () => {
	const vp = { top: 1000, width: 1210, height: 600 }
	const cols = layoutGrid(100, vp).cols
	assert.equal(revealTop(0, vp, cols), 0)
	assert.equal(revealTop(6 * cols, vp, cols), null)
	const below = revealTop(90, vp, cols)
	assert.ok(below !== null && below > 1000)
})

test('navTarget: every key, clamped', () => {
	assert.equal(navTarget('ArrowRight', 5, 10, 4, 3), 6)
	assert.equal(navTarget('ArrowRight', 9, 10, 4, 3), 9)
	assert.equal(navTarget('ArrowLeft', 0, 10, 4, 3), 0)
	assert.equal(navTarget('ArrowDown', 5, 10, 4, 3), 9)
	assert.equal(navTarget('ArrowDown', 8, 10, 4, 3), 9)
	assert.equal(navTarget('ArrowUp', 2, 10, 4, 3), 0)
	assert.equal(navTarget('Home', 7, 10, 4, 3), 0)
	assert.equal(navTarget('End', 2, 10, 4, 3), 9)
	assert.equal(navTarget('PageDown', 0, 100, 4, 3), 12)
	assert.equal(navTarget('PageUp', 50, 100, 4, 3), 38)
	assert.equal(navTarget('a', 5, 10, 4, 3), null)
})
