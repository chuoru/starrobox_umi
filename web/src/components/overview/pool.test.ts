import assert from 'node:assert/strict'
import { test } from 'node:test'
import { forEachLimited } from './pool.ts'

test('visits each item once and never exceeds the limit', async () => {
	let inFlight = 0
	let peak = 0
	const seen: number[] = []
	await forEachLimited(Array.from({ length: 20 }, (_, i) => i), 6, async (i) => {
		inFlight++
		peak = Math.max(peak, inFlight)
		seen.push(i)
		await new Promise((r) => setTimeout(r, 2))
		inFlight--
	})
	assert.equal(peak, 6)
	assert.deepEqual(seen.sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i))
})

test('starts items in order and handles fewer items than the limit', async () => {
	const started: string[] = []
	await forEachLimited(['a', 'b'], 6, async (s) => void started.push(s))
	assert.deepEqual(started, ['a', 'b'])
	await forEachLimited([], 6, async () => assert.fail('no items'))
})
