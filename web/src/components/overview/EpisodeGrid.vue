<script setup lang="ts">
// Virtualisation: row windowing. Only the rows intersecting the viewport (+ overscan) are in the DOM;
// a spacer gives the scrollbar its full height and the window is a CSS grid translated to its first row.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { EpisodeSummary } from '../../api/client'
import EpisodeCard from './EpisodeCard.vue'

const props = defineProps<{
	items: EpisodeSummary[]
	selected: Set<string>
	loading: boolean
}>()
const emit = defineEmits<{ toggle: [index: number, ev: MouseEvent | KeyboardEvent]; open: [id: string] }>()

const CARD_H = 184
const GAP = 10
const MIN_W = 210
const OVERSCAN = 2
const PAD = 12

const scroller = ref<HTMLElement | null>(null)
const width = ref(1000)
const height = ref(600)
const top = ref(0)
const activeIndex = ref(0)

const cols = computed(() => Math.max(1, Math.floor((width.value - PAD * 2 + GAP) / (MIN_W + GAP))))
const rowH = CARD_H + GAP
const rows = computed(() => Math.ceil(props.items.length / cols.value))
const totalH = computed(() => rows.value * rowH - GAP + PAD * 2)
const firstRow = computed(() => Math.max(0, Math.floor((top.value - PAD) / rowH) - OVERSCAN))
const lastRow = computed(() => Math.min(rows.value, Math.ceil((top.value + height.value - PAD) / rowH) + OVERSCAN))
const windowItems = computed(() => {
	const start = firstRow.value * cols.value
	return props.items.slice(start, lastRow.value * cols.value).map((e, i) => ({ e, index: start + i }))
})
const active = computed(() => Math.min(activeIndex.value, Math.max(0, props.items.length - 1)))

let raf = 0
function onScroll() {
	if (raf) return
	raf = requestAnimationFrame(() => {
		raf = 0
		if (scroller.value) top.value = scroller.value.scrollTop
	})
}
let ro: ResizeObserver | null = null
onMounted(() => {
	const el = scroller.value!
	ro = new ResizeObserver(() => {
		width.value = el.clientWidth
		height.value = el.clientHeight
	})
	ro.observe(el)
	width.value = el.clientWidth
	height.value = el.clientHeight
})
onBeforeUnmount(() => {
	ro?.disconnect()
	if (raf) cancelAnimationFrame(raf)
})

function scrollToTop() {
	if (scroller.value) scroller.value.scrollTop = 0
	top.value = 0
	activeIndex.value = 0
}
defineExpose({ scrollToTop })

function ensureVisible(index: number) {
	const el = scroller.value!
	const r = Math.floor(index / cols.value)
	const y0 = PAD + r * rowH
	if (y0 < el.scrollTop) el.scrollTop = y0 - PAD
	else if (y0 + CARD_H > el.scrollTop + el.clientHeight) el.scrollTop = y0 + CARD_H - el.clientHeight + PAD
	top.value = el.scrollTop
}

async function focusIndex(index: number) {
	activeIndex.value = index
	ensureVisible(index)
	await nextTick()
	scroller.value?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus({ preventScroll: true })
}

function onKey(ev: KeyboardEvent) {
	const t = ev.target as HTMLElement
	if (!t.classList.contains('card')) return
	const i = Number(t.dataset.index)
	const n = props.items.length
	const c = cols.value
	let next = -1
	if (ev.key === 'ArrowRight') next = i + 1
	else if (ev.key === 'ArrowLeft') next = i - 1
	else if (ev.key === 'ArrowDown') next = i + c
	else if (ev.key === 'ArrowUp') next = i - c
	else if (ev.key === 'Home') next = 0
	else if (ev.key === 'End') next = n - 1
	else if (ev.key === 'PageDown') next = i + c * Math.max(1, Math.floor(height.value / rowH))
	else if (ev.key === 'PageUp') next = i - c * Math.max(1, Math.floor(height.value / rowH))
	else return
	ev.preventDefault()
	focusIndex(Math.max(0, Math.min(n - 1, next)))
}

function onToggle(index: number, ev: MouseEvent | KeyboardEvent) {
	activeIndex.value = index
	emit('toggle', index, ev)
}

// Keep the window valid when the list shrinks beneath the current scroll position.
watch(
	() => props.items.length,
	() => {
		const el = scroller.value
		if (el) top.value = el.scrollTop
	},
)
</script>

<template>
	<div ref="scroller" class="scroller" @scroll.passive="onScroll" @keydown="onKey">
		<div v-if="loading" class="skel-grid" aria-busy="true" aria-label="Loading episodes">
			<div v-for="i in 18" :key="i" class="skel" />
		</div>
		<div v-else-if="!items.length" class="empty-slot"><slot name="empty" /></div>
		<div v-else class="spacer" :style="{ height: totalH + 'px' }">
			<div
				class="win"
				:style="{
					transform: `translateY(${PAD + firstRow * rowH}px)`,
					gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
					gridAutoRows: CARD_H + 'px',
					gap: GAP + 'px',
					padding: `0 ${PAD}px`,
				}"
			>
				<EpisodeCard
					v-for="w in windowItems"
					:key="w.e.id"
					:episode="w.e"
					:index="w.index"
					:selected="selected.has(w.e.id)"
					:active="w.index === active"
					@toggle="onToggle"
					@open="emit('open', $event)"
				/>
			</div>
		</div>
	</div>
</template>

<style scoped>
.scroller { flex: 1; overflow: auto; position: relative; min-height: 0; }
.spacer { position: relative; }
.win { position: absolute; top: 0; left: 0; right: 0; display: grid; box-sizing: border-box; }
.skel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; padding: 12px; }
.skel { height: 184px; border-radius: 8px; border: 1px solid var(--ln); background: linear-gradient(90deg, var(--pn), #222936, var(--pn)); background-size: 200% 100%; animation: sh 1.4s linear infinite; }
@keyframes sh { to { background-position: -200% 0; } }
.empty-slot { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
@media (prefers-reduced-motion: reduce) { .skel { animation: none; } }
</style>
