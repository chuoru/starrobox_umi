import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EpisodeSummary } from '../../api/client.ts'
import { clearFilters, hasFilters, matches, readLens, toggle, update, writeLens } from './lens.ts'

const ep = (over: Partial<EpisodeSummary> = {}): EpisodeSummary => ({
	id: 'syn_0001',
	scene: 'kitchen_a',
	session: 's01',
	camera: 'GoPro HERO12',
	fps: 30,
	duration_s: 30,
	instruction: 'Pick up the Red cup',
	task: 'cup',
	status: 'slam_ok',
	tracking_pct: 90,
	gripper_min_mm: 5,
	gripper_max_mm: 43,
	...over,
})

test('golden URL strings: read then write', () => {
	const cases: [Record<string, unknown>, Record<string, string>][] = [
		[{}, {}],
		[{ dur: '10_max', sort: 'trk' }, { dur: '10_max', sort: 'trk' }],
		[{ dur: '1.234567_2' }, { dur: '1.23_2' }],
		[{ status: 'curated,bogus,slam_ok', task: 'cup,,towel', q: '  red  ' }, { status: 'curated,slam_ok', task: 'cup,towel', q: 'red' }],
		[{ sort: 'bogus', dir: 'asc' }, {}],
		[{ dir: 'desc', sort: 'id' }, { dir: 'desc' }],
		[{ dur: ['1_2'], status: null, q: 5 }, {}],
		[{ status: 'constructor' }, {}],
		[{ wid: '40_45', trk: '0_50', dur: '3_4' }, { dur: '3_4', trk: '0_50', wid: '40_45' }],
	]
	for (const [query, want] of cases) assert.deepEqual(writeLens(readLens(query)), want, JSON.stringify(query))
})

test('range parsing quirks are kept', () => {
	assert.deepEqual(readLens({ dur: '5_' }).dur, [5, 0])
	assert.equal(readLens({ dur: '_5' }).dur, null)
	assert.equal(readLens({ dur: '5' }).dur, null)
	assert.equal(readLens({ dur: 'a_b' }).dur, null)
	assert.deepEqual(readLens({ dur: '5_max' }).dur, [5, Infinity])
})

test('write then read then write is a fixed point', () => {
	const q = { dur: '2.5_max', trk: '10_90', status: 'excluded,curated', task: 'towel,cup', q: 'x', sort: 'wid', dir: 'desc' }
	const once = writeLens(readLens(q))
	assert.deepEqual(writeLens(readLens(once)), once)
})

test('update returns the same Lens for an equal value', () => {
	const lens = readLens({ q: 'abc' })
	assert.equal(update(lens, 'q', 'abc'), lens)
	assert.notEqual(update(lens, 'q', 'abcd'), lens)
	assert.equal(update(lens, 'dur', null), lens)
})

test('toggle keeps insertion order and never mutates', () => {
	const a = readLens({})
	const b = toggle(toggle(toggle(a, 'status', 'curated'), 'status', 'imported'), 'status', 'excluded')
	assert.deepEqual([...b.status], ['curated', 'imported', 'excluded'])
	assert.equal(a.status.size, 0)
	const c = toggle(b, 'status', 'imported')
	assert.deepEqual([...c.status], ['curated', 'excluded'])
	assert.deepEqual([...b.status], ['curated', 'imported', 'excluded'])
})

test('clearFilters keeps sort and dir, and returns the same Lens when nothing changed', () => {
	const lens = readLens({ dur: '1_2', status: 'curated', q: 'x', sort: 'trk', dir: 'desc' })
	const cleared = clearFilters(lens)
	assert.deepEqual(writeLens(cleared), { sort: 'trk', dir: 'desc' })
	assert.equal(clearFilters(cleared), cleared)
	const empty = readLens({})
	assert.equal(clearFilters(empty, 'status'), empty)
	assert.equal(clearFilters(empty), empty)
	const only = clearFilters(lens, 'status')
	assert.equal(only.status.size, 0)
	assert.deepEqual(only.dur, [1, 2])
	assert.equal(clearFilters(only, 'status'), only)
})

test('clearFilters resets a whitespace-only search, as the old reset did', () => {
	const lens = update(readLens({}), 'q', '   ')
	assert.equal(hasFilters(lens), false)
	assert.equal(clearFilters(lens).q, '')
})

test('hasFilters', () => {
	assert.equal(hasFilters(readLens({})), false)
	assert.equal(hasFilters(readLens({ sort: 'trk', dir: 'desc' })), false)
	assert.equal(hasFilters(readLens({ dur: '1_2' })), true)
	assert.equal(hasFilters(readLens({ q: 'x' })), true)
})

test('matches: half-open range, max, NaN, and search fields', () => {
	const lens = (q: Record<string, unknown>) => readLens(q)
	assert.equal(matches(ep({ duration_s: 10 }), lens({ dur: '10_20' })), true)
	assert.equal(matches(ep({ duration_s: 20 }), lens({ dur: '10_20' })), false)
	assert.equal(matches(ep({ duration_s: 1e9 }), lens({ dur: '10_max' })), true)
	assert.equal(matches(ep({ duration_s: NaN }), lens({ dur: '10_20' })), true)
	assert.equal(matches(ep(), lens({ q: 'RED CUP' })), true)
	assert.equal(matches(ep(), lens({ q: 'kitchen_a' })), true)
	assert.equal(matches(ep(), lens({ q: 'gopro' })), true)
	assert.equal(matches(ep(), lens({ q: 'towel' })), false)
})

test('matches: except skips exactly one facet', () => {
	const lens = readLens({ status: 'curated', task: 'towel' })
	assert.equal(matches(ep(), lens), false)
	assert.equal(matches(ep(), lens, 'status'), false)
	assert.equal(matches(ep({ task: 'towel' }), lens, 'status'), true)
	assert.equal(matches(ep({ status: 'curated' }), lens, 'task'), true)
})
