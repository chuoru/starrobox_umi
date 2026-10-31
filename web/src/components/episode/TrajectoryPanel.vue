<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { EpisodeSeries } from '../../api/client'
import type { TimeCursor } from '../../composables/useTimeCursor'
import { useCanvas } from './useCanvas'

const props = defineProps<{ series: EpisodeSeries; cursor: TimeCursor }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const cam = reactive({ yaw: -0.8, pitch: 0.9, zoom: 1 })
const dragging = ref(false)

const P = computed(() => props.series.position_m)
const bounds = computed(() => {
	const lo = [Infinity, Infinity, Infinity]
	const hi = [-Infinity, -Infinity, -Infinity]
	for (const p of P.value) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]) }
	const c = lo.map((v, k) => (v + hi[k]) / 2)
	const r = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 0.2)
	return { c, r, floor: lo[2] }
})
function heading(i: number): number {
	const p = P.value
	const a = p[Math.max(0, i - 3)], b = p[Math.min(p.length - 1, i + 3)]
	return Math.atan2(b[1] - a[1], b[0] - a[0])
}
const lostNow = computed(() => !props.series.tracking[props.cursor.frame.value])
const pose = computed(() => P.value[props.cursor.frame.value])
const lastGood = computed(() => {
	for (let i = props.cursor.frame.value; i >= 0; i--) if (props.series.tracking[i]) return P.value[i]
	return null
})
const fmt = (p: number[] | null) => (p ? p.map((v) => v.toFixed(3)).join(', ') : 'none')

useCanvas(canvas, (g, w, h, c) => {
	const frame = props.cursor.frame.value
	const { c: ctr, r, floor } = bounds.value
	const s = (Math.min(w, h) * 0.8 * cam.zoom) / (r * 1.4)
	const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch)
	const proj = (p: number[]): [number, number] => {
		const x = p[0] - ctr[0], y = p[1] - ctr[1], z = p[2] - ctr[2]
		const x1 = x * cy - y * sy, y1 = x * sy + y * cy
		return [w / 2 + x1 * s, h / 2 + 4 - (z * cp + y1 * sp) * s]
	}
	g.lineWidth = 1
	g.strokeStyle = c.line
	const step = r > 1.5 ? 0.25 : 0.1
	const n = Math.ceil((r * 0.9) / step)
	for (let k = -n; k <= n; k++) {
		const o = k * step
		let a = proj([ctr[0] + o, ctr[1] - n * step, floor]), b = proj([ctr[0] + o, ctr[1] + n * step, floor])
		g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke()
		a = proj([ctr[0] - n * step, ctr[1] + o, floor]); b = proj([ctr[0] + n * step, ctr[1] + o, floor])
		g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke()
	}
	const t = props.series.tracking
	const pts = P.value
	g.lineJoin = 'round'
	let st = 0
	for (let i = 1; i <= pts.length; i++) {
		if (i < pts.length && t[i] === t[i - 1]) continue
		const lost = !t[st]
		const a = lost ? Math.max(0, st - 1) : st
		const b = lost ? Math.min(pts.length - 1, i) : i - 1
		const split = Math.min(Math.max(frame, a), b)
		const stroke = (from: number, to: number, col: string, dash: number[], alpha: number, lw: number) => {
			if (to <= from) return
			g.strokeStyle = col; g.globalAlpha = alpha; g.lineWidth = lw; g.setLineDash(dash)
			g.beginPath()
			for (let j = from; j <= to; j++) { const q = proj(pts[j]); if (j === from) g.moveTo(...q); else g.lineTo(...q) }
			g.stroke()
		}
		if (lost) { stroke(a, split, c.lost, [6, 4], 1, 2.25); stroke(split, b, c.lost, [6, 4], 0.4, 2) }
		else { stroke(a, split, c.ok, [], 1, 2.5); stroke(split, b, c.mut, [], 0.5, 1.5) }
		g.setLineDash([]); g.globalAlpha = 1
		st = i
	}
	g.fillStyle = c.kf
	for (const k of props.series.keyframes) {
		if (!pts[k]) continue
		const q = proj(pts[k]); g.beginPath(); g.arc(q[0], q[1], 2.2, 0, 7); g.fill()
	}
	const p = pts[frame]
	if (!p) return
	const yw = heading(frame)
	const hw = Math.max(0.004, (props.series.gripper_width_mm[frame] ?? 40) / 1000) * 1.2 * Math.max(1, r / 0.6)
	const len = 0.12 * Math.max(1, r / 0.8) * 0.6
	const wp = (dx: number, dy: number, dz: number) => [p[0] + dx * Math.cos(yw) - dy * Math.sin(yw), p[1] + dx * Math.sin(yw) + dy * Math.cos(yw), p[2] + dz]
	const lost = !t[frame]
	const q = proj(p)
	g.lineWidth = 2.5; g.strokeStyle = lost ? c.lost : c.fg; g.setLineDash(lost ? [4, 3] : [])
	for (const [a, b] of [[wp(0, hw, 0), wp(len, hw, 0)], [wp(0, -hw, 0), wp(len, -hw, 0)], [wp(0, hw, 0), wp(0, -hw, 0)]]) {
		const A = proj(a), B = proj(b); g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.stroke()
	}
	g.setLineDash([])
	if (!lost) {
		g.lineWidth = 2
		for (const [d, col] of [[[len, 0, 0], '#ff5a5a'], [[0, len, 0], '#5ae07a'], [[0, 0, len], '#5a9bff']] as [number[], string][]) {
			const e = proj(wp(d[0], d[1], d[2])); g.strokeStyle = col; g.beginPath(); g.moveTo(...q); g.lineTo(...e); g.stroke()
		}
		g.fillStyle = c.ok; g.beginPath(); g.arc(q[0], q[1], 4, 0, 7); g.fill()
	} else {
		g.strokeStyle = c.lost; g.lineWidth = 2; g.beginPath(); g.arc(q[0], q[1], 7, 0, 7); g.stroke()
		g.fillStyle = c.lost; g.font = '11px system-ui, sans-serif'; g.textBaseline = 'alphabetic'; g.textAlign = 'left'
		g.fillText('estimate only (not SLAM)', q[0] + 12, q[1] - 8)
	}
})

let drag: { x: number; y: number; yaw: number; pitch: number } | null = null
function down(e: PointerEvent) {
	drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch }
	dragging.value = true
	;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
	if (!drag) return
	cam.yaw = drag.yaw + (e.clientX - drag.x) * 0.01
	cam.pitch = Math.max(0.05, Math.min(1.5, drag.pitch + (e.clientY - drag.y) * 0.01))
}
function up() { drag = null; dragging.value = false }
function wheel(e: WheelEvent) {
	cam.zoom = Math.max(0.4, Math.min(4, cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9)))
}
function reset() { cam.yaw = -0.8; cam.pitch = 0.9; cam.zoom = 1 }
</script>

<template>
	<section class="panel" aria-label="SLAM trajectory">
		<h2>SLAM trajectory <span class="hint">drag to orbit, wheel to zoom, double-click to reset</span></h2>
		<div class="stat">
			<template v-if="lostNow">
				<span class="pill lost">NO POSE</span><br>last good ({{ fmt(lastGood) }}) m
			</template>
			<template v-else>
				<span class="pill ok">SLAM pose</span><br>xyz ({{ fmt(pose) }}) m
			</template>
		</div>
		<canvas ref="canvas" :class="{ grabbing: dragging }" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @wheel.prevent="wheel" @dblclick="reset" />
		<span class="note">Dashed red = tracking lost; position is an estimate, orientation from path heading.</span>
	</section>
</template>

<style scoped>
canvas { width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
canvas.grabbing { cursor: grabbing; }
.hint { text-transform: none; letter-spacing: 0; font-weight: 400; opacity: 0.7; margin-left: 6px; }
.note { position: absolute; left: 10px; bottom: 6px; font-size: 10px; color: var(--mut); pointer-events: none; }
</style>
