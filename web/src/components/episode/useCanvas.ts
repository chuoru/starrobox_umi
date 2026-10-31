import { onBeforeUnmount, onMounted, ref, watchEffect, type Ref } from 'vue'

export interface Palette {
	[k: string]: string
}

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
			const c: Palette = {}
			for (const k of ['bg', 'panel', 'line', 'fg', 'mut', 'accent', 'ok', 'lost', 'kf', 'c1', 'c2', 'c3'])
				c[k] = cs.getPropertyValue('--' + k).trim() || '#888'
			g.setTransform(dpr, 0, 0, dpr, 0, 0)
			g.clearRect(0, 0, w, h)
			draw(g, w, h, c)
		},
		{ flush: 'post' },
	)
	return { size }
}
