<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EpisodeSeries } from '../../api/client'
import type { LostSegment, TimeCursor } from '../../composables/useTimeCursor'
import { useCanvas } from './useCanvas'

const props = defineProps<{ series: EpisodeSeries; cursor: TimeCursor; lost: LostSegment[] }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const scrubbing = ref(false)
const GUT = 112
const RIGHT = 12

function range(vals: (number | null)[][], pad = 0.08): [number, number] {
	let lo = Infinity
	let hi = -Infinity
	for (const a of vals) for (const v of a) if (v !== null) { if (v < lo) lo = v; if (v > hi) hi = v }
	if (!isFinite(lo)) return [0, 1]
	if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5 }
	const p = (hi - lo) * pad
	return [lo - p, hi + p]
}
const axis = (a: [number, number, number][], k: number) => a.map((v) => v[k])
const ranges = computed(() => {
	const s = props.series
	return {
		w: [0, Math.max(1, ...s.gripper_width_mm) * 1.1] as [number, number],
		v: [0, Math.max(0.01, ...s.speed_mps.map((v) => v ?? 0)) * 1.1] as [number, number],
		a: range([0, 1, 2].map((k) => axis(s.imu_accel, k))),
		g: range([0, 1, 2].map((k) => axis(s.imu_gyro, k))),
	}
})

function hatch(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
	g.save()
	g.beginPath()
	g.rect(x, y, w, h)
	g.clip()
	g.strokeStyle = col
	g.lineWidth = 1
	g.globalAlpha = 0.5
	for (let k = -h; k < w; k += 7) {
		g.beginPath()
		g.moveTo(x + k, y + h)
		g.lineTo(x + k + h, y)
		g.stroke()
	}
	g.restore()
}

let layout = { x0: GUT, x1: 100, n: 1 }

useCanvas(canvas, (g, w, h, c) => {
	const s = props.series
	const n = s.tracking.length
	const frame = props.cursor.frame.value
	const fps = s.fps
	const top = 20
	const bot = 20
	const x0 = GUT
	const x1 = w - RIGHT
	const plotH = h - top - bot
	layout = { x0, x1, n }
	const X = (i: number) => x0 + ((x1 - x0) * i) / Math.max(1, n - 1)
	const dur = n / fps
	const span = x1 - x0
	g.font = '11px system-ui, sans-serif'
	g.textBaseline = 'middle'

	const stepS = [1, 2, 5, 10, 15, 30, 60].find((t) => (t / dur) * span >= 48) ?? 60
	g.textAlign = 'center'
	for (let t = 0; t <= dur; t += stepS) {
		const x = Math.round(X(t * fps)) + 0.5
		g.fillStyle = c.mut
		g.fillText(t + 's', x, 9)
		g.strokeStyle = c.line
		g.lineWidth = 1
		g.beginPath()
		g.moveTo(x, top - 4)
		g.lineTo(x, h - bot)
		g.stroke()
	}

	const lanes = [
		{ id: 'slam', label: 'SLAM status', f: 0.13, unit: '', hatchLost: true },
		{ id: 'w', label: 'Gripper width', f: 0.2, unit: 'mm', hatchLost: false },
		{ id: 'v', label: 'Linear speed', f: 0.2, unit: 'm/s', hatchLost: true },
		{ id: 'a', label: 'IMU accel', f: 0.235, unit: 'm/s2', hatchLost: false },
		{ id: 'g', label: 'IMU gyro', f: 0.235, unit: 'rad/s', hatchLost: false },
	]
	let y = top
	for (const L of lanes) {
		const ly = y
		const lh = plotH * L.f - 4
		y += plotH * L.f
		g.fillStyle = c.bg
		g.globalAlpha = 0.5
		g.fillRect(x0, ly, span, lh)
		g.globalAlpha = 1
		for (const r of props.lost) {
			const xa = X(r.start)
			const xb = X(r.end + 1)
			if (L.hatchLost) hatch(g, xa, ly, xb - xa, lh, c.lost)
			else {
				g.fillStyle = c.lost
				g.globalAlpha = 0.1
				g.fillRect(xa, ly, xb - xa, lh)
				g.globalAlpha = 1
			}
		}
		const plot = (get: (i: number) => number | null, lo: number, hi: number, col: string) => {
			g.strokeStyle = col
			g.lineWidth = 1.5
			g.lineJoin = 'round'
			g.beginPath()
			let pen = false
			const stride = Math.max(1, Math.floor(n / (span * 2)))
			for (let i = 0; i < n; i += stride) {
				const v = get(i)
				if (v === null) {
					pen = false
					continue
				}
				const yy = ly + lh - ((v - lo) / (hi - lo)) * (lh - 8) - 4
				if (!pen) {
					g.moveTo(X(i), yy)
					pen = true
				} else g.lineTo(X(i), yy)
			}
			g.stroke()
		}
		let txt = ''
		const sub: { t: string; col: string }[] = []
		if (L.id === 'slam') {
			g.fillStyle = c.ok
			g.globalAlpha = 0.55
			g.fillRect(x0, ly + lh * 0.35, span, lh * 0.3)
			g.globalAlpha = 1
			for (const r of props.lost) {
				const xa = X(r.start)
				const xb = X(r.end + 1)
				g.fillStyle = c.lost
				g.fillRect(xa, ly + lh * 0.15, xb - xa, lh * 0.7)
				const label = 'LOST ' + ((r.end - r.start + 1) / fps).toFixed(1) + 's'
				if (xb - xa > g.measureText(label).width + 8) {
					g.fillStyle = '#fff'
					g.textAlign = 'center'
					g.fillText(label, (xa + xb) / 2, ly + lh / 2)
				}
			}
			g.fillStyle = c.kf
			for (const k of s.keyframes) g.fillRect(X(k) - 0.5, ly + 2, 1.5, lh * 0.2)
			txt = s.tracking[frame] ? 'tracked' : 'LOST'
		} else if (L.id === 'w') {
			plot((i) => s.gripper_width_mm[i], ranges.value.w[0], ranges.value.w[1], c.c1)
			txt = s.gripper_width_mm[frame].toFixed(1)
		} else if (L.id === 'v') {
			plot((i) => s.speed_mps[i], ranges.value.v[0], ranges.value.v[1], c.c1)
			const label = 'not measured'
			const tw = g.measureText(label).width + 8
			for (const r of props.lost) {
				const xa = X(r.start)
				const xb = X(r.end + 1)
				if (xb - xa > tw + 4) {
					g.fillStyle = c.panel
					g.fillRect((xa + xb) / 2 - tw / 2, ly + lh / 2 - 8, tw, 16)
					g.fillStyle = c.lost
					g.textAlign = 'center'
					g.fillText(label, (xa + xb) / 2, ly + lh / 2)
				}
			}
			const v = s.speed_mps[frame]
			txt = v === null ? 'not measured' : v.toFixed(2)
		} else {
			const arr = L.id === 'a' ? s.imu_accel : s.imu_gyro
			const rg = L.id === 'a' ? ranges.value.a : ranges.value.g
			;[c.c1, c.c2, c.c3].forEach((col, k) => plot((i) => arr[i][k], rg[0], rg[1], col))
			txt = arr[frame].map((v) => v.toFixed(L.id === 'a' ? 1 : 2)).join(' ')
			sub.push({ t: 'x', col: c.c1 }, { t: 'y', col: c.c2 }, { t: 'z', col: c.c3 })
		}
		g.textAlign = 'left'
		g.fillStyle = c.fg
		g.fillText(L.label, 8, ly + 10)
		const unmeasured = txt === 'not measured'
		g.fillStyle = unmeasured ? c.lost : c.mut
		g.fillText(txt + (L.unit && !unmeasured ? ' ' + L.unit : ''), 8, ly + 26)
		sub.forEach((q, k) => {
			g.fillStyle = q.col
			g.fillText(q.t, 8 + k * 12, ly + 42)
		})
		if ((L.id === 'a' || L.id === 'g') && lh > 62 && props.lost.length) {
			g.fillStyle = c.mut
			g.font = '10px system-ui, sans-serif'
			g.fillText('still measured when lost', 8, ly + 56)
			g.font = '11px system-ui, sans-serif'
		}
		g.strokeStyle = c.line
		g.lineWidth = 1
		g.strokeRect(x0 + 0.5, ly + 0.5, span, lh)
	}
	const cx = Math.round(X(frame)) + 0.5
	g.strokeStyle = c.fg
	g.lineWidth = 1.5
	g.beginPath()
	g.moveTo(cx, top - 4)
	g.lineTo(cx, h - bot)
	g.stroke()
	g.fillStyle = c.fg
	g.beginPath()
	g.moveTo(cx - 5, h - bot + 7)
	g.lineTo(cx + 5, h - bot + 7)
	g.lineTo(cx, h - bot)
	g.fill()
	g.fillStyle = c.mut
	g.textAlign = 'left'
	g.font = '10px system-ui, sans-serif'
	g.fillText('Yellow ticks = SLAM keyframes. Hatched = no SLAM pose; IMU and width stay measured.', x0, h - 5)
})

function at(e: PointerEvent) {
	const el = canvas.value
	if (!el) return
	const r = el.getBoundingClientRect()
	props.cursor.seek(((e.clientX - r.left - layout.x0) / (layout.x1 - layout.x0)) * (layout.n - 1))
}
function down(e: PointerEvent) {
	scrubbing.value = true
	props.cursor.pause()
	;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
	at(e)
}
function move(e: PointerEvent) {
	if (scrubbing.value) at(e)
}
function up() {
	scrubbing.value = false
}
</script>

<template>
	<section class="panel" aria-label="Timeline">
		<canvas ref="canvas" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" />
	</section>
</template>

<style scoped>
canvas { width: 100%; height: 100%; display: block; cursor: ew-resize; touch-action: none; }
</style>
