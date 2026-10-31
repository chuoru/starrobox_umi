<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Range } from './lens'

const props = defineProps<{
	label: string
	unit: string
	all: number[]
	match: number[]
	lo: number
	hi: number
	modelValue: Range | null
}>()
const emit = defineEmits<{ 'update:modelValue': [Range | null] }>()

const n = computed(() => props.all.length)
const w = computed(() => (props.hi - props.lo) / n.value)
const peak = computed(() => Math.max(1, ...props.all))
const edge = (b: number) => props.lo + b * w.value

const sel = computed<[number, number] | null>(() => {
	const r = props.modelValue
	if (!r) return null
	const a = Math.max(0, Math.round((r[0] - props.lo) / w.value))
	const b = Number.isFinite(r[1]) ? Math.min(n.value - 1, Math.round((r[1] - props.lo) / w.value) - 1) : n.value - 1
	return [a, Math.max(a, b)]
})

function emitBins(a: number, b: number) {
	const lo = Math.min(a, b)
	const hi = Math.max(a, b)
	emit('update:modelValue', [edge(lo), hi >= n.value - 1 ? Infinity : edge(hi + 1)])
}

const box = ref<HTMLElement | null>(null)
const dragging = ref(false)
let anchor: number | null = null
let last = -1
let wasSingle = false

function binAt(ev: PointerEvent): number {
	const r = box.value!.getBoundingClientRect()
	return Math.max(0, Math.min(n.value - 1, Math.floor(((ev.clientX - r.left) / r.width) * n.value)))
}
function down(ev: PointerEvent) {
	if (ev.button !== 0) return
	const s = sel.value
	wasSingle = !!s && s[0] === s[1]
	anchor = binAt(ev)
	last = anchor
	dragging.value = true
	box.value!.setPointerCapture(ev.pointerId)
	emitBins(anchor, anchor)
}
function move(ev: PointerEvent) {
	if (!dragging.value || anchor === null) return
	const b = binAt(ev)
	if (b !== last) {
		last = b
		emitBins(anchor, b)
	}
}
function up(ev: PointerEvent) {
	if (!dragging.value) return
	dragging.value = false
	const s = sel.value
	if (anchor !== null && last === anchor && wasSingle && s && s[0] === anchor) emit('update:modelValue', null)
	anchor = null
	if (box.value?.hasPointerCapture(ev.pointerId)) box.value.releasePointerCapture(ev.pointerId)
}

function key(ev: KeyboardEvent) {
	const s = sel.value
	if (ev.key === 'Escape' && s) {
		emit('update:modelValue', null)
		ev.stopPropagation()
		return
	}
	if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return
	ev.preventDefault()
	const d = ev.key === 'ArrowLeft' ? -1 : 1
	const clamp = (b: number) => Math.max(0, Math.min(n.value - 1, b))
	if (!s) {
		const b = d < 0 ? n.value - 1 : 0
		return emitBins(b, b)
	}
	if (ev.shiftKey) emitBins(s[0], clamp(s[1] + d))
	else emitBins(clamp(s[0] + d), clamp(s[1] + d))
}

const fmt = (x: number) => (Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10)
const rangeText = computed(() => {
	const r = props.modelValue
	if (!r) return null
	return `${fmt(r[0])} to ${Number.isFinite(r[1]) ? fmt(r[1]) : fmt(props.hi)} ${props.unit}`
})
</script>

<template>
	<section class="hb">
		<h3>
			<span>{{ label }} <small>({{ unit }})</small></span>
			<button v-if="modelValue" type="button" class="link" @click="emit('update:modelValue', null)">clear</button>
		</h3>
		<div
			ref="box"
			class="hist"
			:class="{ dragging }"
			tabindex="0"
			role="group"
			:aria-label="`${label} histogram. Drag to filter, arrow keys to adjust, Escape to clear.`"
			@pointerdown="down"
			@pointermove="move"
			@pointerup="up"
			@pointercancel="up"
			@keydown="key"
		>
			<div
				v-for="(a, b) in all"
				:key="b"
				class="bin"
				:class="{ off: sel && (b < sel[0] || b > sel[1]), sel: sel && b >= sel[0] && b <= sel[1] }"
				:title="`${fmt(edge(b))} to ${fmt(edge(b + 1))} ${unit}: ${match[b]} matching of ${a}`"
			>
				<i :style="{ height: (a / peak) * 100 + '%' }" />
				<u :style="{ height: (match[b] / peak) * 100 + '%' }" />
			</div>
		</div>
		<div class="rng">
			<template v-if="rangeText"><span class="active">{{ rangeText }}</span><span>filtered</span></template>
			<template v-else><span>{{ fmt(lo) }}{{ unit }}</span><span>{{ fmt(hi) }}{{ unit }}</span></template>
		</div>
	</section>
</template>

<style scoped>
.hb { margin-top: 16px; }
h3 { margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--mu); display: flex; justify-content: space-between; align-items: center; font-weight: 600; min-height: 22px; }
h3 small { text-transform: none; letter-spacing: 0; font-weight: 400; }
.link { background: none; border: 0; color: var(--ac); cursor: pointer; font: inherit; font-size: 12px; text-transform: none; letter-spacing: 0; padding: 2px 6px; border-radius: 4px; }
.link:hover { text-decoration: underline; }
.link:focus-visible, .hist:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.hist { display: flex; align-items: flex-end; height: 58px; gap: 1px; cursor: col-resize; touch-action: none; user-select: none; border-bottom: 1px solid var(--ln); }
.bin { flex: 1; position: relative; height: 100%; border-radius: 2px 2px 0 0; transition: background 0.12s; }
.bin:hover { background: rgba(122, 162, 255, 0.08); }
.bin.sel { background: rgba(122, 162, 255, 0.14); }
.bin i, .bin u { position: absolute; bottom: 0; left: 0; right: 0; border-radius: 1px 1px 0 0; transition: height 0.18s ease, background 0.12s; text-decoration: none; }
.bin i { background: var(--ln); }
.bin u { background: var(--ac); opacity: 0.9; }
.bin.off u { background: var(--mu); opacity: 0.3; }
.dragging .bin i, .dragging .bin u { transition: none; }
.rng { color: var(--mu); font-size: 11px; margin-top: 3px; display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; }
.rng .active { color: var(--ink); }
@media (prefers-reduced-motion: reduce) { .bin i, .bin u, .bin { transition: none; } }
</style>
