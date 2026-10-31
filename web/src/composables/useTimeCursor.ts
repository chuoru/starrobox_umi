import { computed, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'

export const RATES = [0.25, 0.5, 1, 2, 4]

export interface LostSegment {
	start: number
	end: number
}

/** Contiguous runs where tracking is false, as inclusive frame ranges. */
export function lostSegments(tracking: boolean[]): LostSegment[] {
	const out: LostSegment[] = []
	let start = -1
	for (let i = 0; i <= tracking.length; i++) {
		const lost = i < tracking.length && !tracking[i]
		if (lost && start < 0) start = i
		if (!lost && start >= 0) {
			out.push({ start, end: i - 1 })
			start = -1
		}
	}
	return out
}

/** The single time cursor. Everything on the screen reads `frame`; nothing else owns time. */
export function useTimeCursor(
	count: Ref<number>,
	fps: Ref<number>,
	keyframes: Ref<number[]>,
	lost: Ref<LostSegment[]>,
) {
	const frame = ref(0)
	const playing = ref(false)
	const rateIndex = ref(2)
	const loop = ref(false)
	const rate = computed(() => RATES[rateIndex.value])
	const time = computed(() => frame.value / fps.value)
	const duration = computed(() => count.value / fps.value)
	const lostSegment = computed(() => lost.value.find((s) => frame.value >= s.start && frame.value <= s.end) ?? null)
	const scrubbing = shallowRef(false)

	let raf = 0
	let last = 0
	let carry = 0

	function seek(f: number) {
		frame.value = Math.max(0, Math.min(count.value - 1, Math.round(f)))
	}
	function seekTime(s: number) {
		seek(s * fps.value)
	}
	function tick(now: number) {
		if (!playing.value) return
		carry += ((now - last) / 1000) * fps.value * rate.value
		last = now
		const n = Math.floor(carry)
		if (n > 0) {
			carry -= n
			const next = frame.value + n
			if (next >= count.value - 1) {
				if (loop.value) seek(0)
				else {
					seek(count.value - 1)
					pause()
					return
				}
			} else seek(next)
		}
		raf = requestAnimationFrame(tick)
	}
	function play() {
		if (playing.value || count.value < 2) return
		if (frame.value >= count.value - 1) seek(0)
		playing.value = true
		last = performance.now()
		carry = 0
		raf = requestAnimationFrame(tick)
	}
	function pause() {
		playing.value = false
		cancelAnimationFrame(raf)
	}
	function toggle() {
		if (playing.value) pause()
		else play()
	}
	function step(frames: number) {
		pause()
		seek(frame.value + frames)
	}
	function faster() {
		rateIndex.value = Math.min(RATES.length - 1, rateIndex.value + 1)
	}
	function slower() {
		rateIndex.value = Math.max(0, rateIndex.value - 1)
	}
	function jump(list: number[], dir: 1 | -1) {
		const t = dir > 0 ? list.find((v) => v > frame.value) : [...list].reverse().find((v) => v < frame.value)
		if (t !== undefined) {
			pause()
			seek(t)
		}
	}
	function nextKeyframe(dir: 1 | -1) {
		jump(keyframes.value, dir)
	}
	function nextLostEdge(dir: 1 | -1) {
		jump(lost.value.flatMap((s) => [s.start, s.end]), dir)
	}

	function onKey(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey) return
		const el = e.target as HTMLElement | null
		if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
		const k = e.key
		const f = Math.round(fps.value)
		let handled = true
		if (k === ' ') {
			// Space on a focused button would also click it; the cursor owns Space.
			if (el && el.tagName === 'BUTTON') el.blur()
			toggle()
		} else if (k === 'ArrowRight') step(e.shiftKey ? f : 1)
		else if (k === 'ArrowLeft') step(e.shiftKey ? -f : -1)
		else if (k === ']') nextKeyframe(1)
		else if (k === '[') nextKeyframe(-1)
		else if (k === 'n' || k === 'N') nextLostEdge(1)
		else if (k === 'b' || k === 'B') nextLostEdge(-1)
		else if (k === 'Home') {
			pause()
			seek(0)
		} else if (k === 'End') {
			pause()
			seek(count.value - 1)
		} else if (k === '+' || k === '=') faster()
		else if (k === '-' || k === '_') slower()
		else if (k === 'l' || k === 'L') loop.value = !loop.value
		else handled = false
		if (handled) e.preventDefault()
	}
	function attachKeys() {
		window.addEventListener('keydown', onKey)
	}
	function detachKeys() {
		window.removeEventListener('keydown', onKey)
	}
	onBeforeUnmount(() => {
		pause()
		detachKeys()
	})

	return {
		frame, time, duration, playing, rate, rateIndex, loop, lostSegment, scrubbing,
		seek, seekTime, play, pause, toggle, step, faster, slower, nextKeyframe, nextLostEdge,
		attachKeys, detachKeys,
	}
}

export type TimeCursor = ReturnType<typeof useTimeCursor>
