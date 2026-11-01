import { onBeforeUnmount, onMounted, ref, watchEffect, type Ref } from 'vue'

export interface Palette {
	[k: string]: string
}

const TOKENS: Record<string, [string, string]> = {
	bg: ['--bs-gray-100', '#f6f9fc'],
	panel: ['--bs-white', '#ffffff'],
	line: ['--bs-gray-200', '#e9ecef'],
	edge: ['--bs-gray-400', '#ced4da'],
	fg: ['--bs-gray-900', '#212529'],
	mut: ['--bs-gray-600', '#6a7785'],
	ok: ['--bs-success', '#41b432'],
	lost: ['--bs-danger', '#f44337'],
}
const LITERALS: Palette = { kf: '#d99100', c1: '#1f6feb', c2: '#e8590c', c3: '#8e44ad' }

export function useCanvas(
	canvas: Ref<HTMLCanvasElement | null>,
	draw: (g: CanvasRenderingContext2D, w: number, h: number, c: Palette) => void,
) {
	const size = ref({ w: 0, h: 0, dpr: 1 })
	let ro: ResizeObserver | null = null

	function measure() {
		const el = canvas.value
		if (!el) return
		const r = el.getBoundingClientRect()
		const dpr = window.devicePixelRatio || 1
		const w = Math.max(1, Math.round(r.width))
		const h = Math.max(1, Math.round(r.height))
		if (w !== size.value.w || h !== size.value.h || dpr !== size.value.dpr) size.value = { w, h, dpr }
	}
	onMounted(() => {
		measure()
		ro = new ResizeObserver(measure)
		if (canvas.value) ro.observe(canvas.value)
		window.addEventListener('resize', measure)
	})
	onBeforeUnmount(() => {
		ro?.disconnect()
		window.removeEventListener('resize', measure)
	})

	watchEffect(
		() => {
			const el = canvas.value
			const { w, h, dpr } = size.value
			if (!el || w < 2) return
			const bw = Math.round(w * dpr)
			const bh = Math.round(h * dpr)
			if (el.width !== bw || el.height !== bh) {
				el.width = bw
				el.height = bh
			}
			const g = el.getContext('2d')
			if (!g) return
			const cs = getComputedStyle(el)
			const c: Palette = { ...LITERALS }
			for (const [k, [v, fallback]] of Object.entries(TOKENS)) c[k] = cs.getPropertyValue(v).trim() || fallback
			g.setTransform(dpr, 0, 0, dpr, 0, 0)
			g.clearRect(0, 0, w, h)
			draw(g, w, h, c)
		},
		{ flush: 'post' },
	)
	return { size }
}
