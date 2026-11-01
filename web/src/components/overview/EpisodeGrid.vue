<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type ComponentPublicInstance } from 'vue'
import type { EpisodeSummary } from '../../api/client'
import EpisodeCard from './EpisodeCard.vue'
import { CARD_H, GAP, PAD, layoutGrid, navTarget, revealTop, type Viewport } from './virtualGrid'

const props = defineProps<{
	items: readonly EpisodeSummary[]
	selected: ReadonlySet<string>
	loading: boolean
	/** Compared by identity. When it changes, the grid scrolls to the top and the first card becomes active. */
	resetKey: unknown
}>()
const emit = defineEmits<{ toggle: [index: number, ev: MouseEvent | KeyboardEvent]; open: [id: string] }>()

const scroller = ref<HTMLElement | null>(null)
/** The only copy of the scroller's geometry. Only measure() writes it, and it reads it from the DOM. */
const viewport = shallowRef<Viewport>({ top: 0, width: 1000, height: 600 })
const grid = computed(() => layoutGrid(props.items.length, viewport.value))
const windowItems = computed(() =>
	props.items.slice(grid.value.start, grid.value.end).map((e, i) => ({ e, index: grid.value.start + i })),
)
const activeIndex = ref(0)
const active = computed(() => Math.min(activeIndex.value, Math.max(0, props.items.length - 1)))

function measure() {
	const el = scroller.value
	if (!el) return
	const v = viewport.value
	if (v.top !== el.scrollTop || v.width !== el.clientWidth || v.height !== el.clientHeight) {
		viewport.value = { top: el.scrollTop, width: el.clientWidth, height: el.clientHeight }
	}
}

/** The only programmatic scroll. It writes the DOM, then reads it back, because the browser may clamp the value. */
function scrollTo(y: number) {
	if (!scroller.value) return
	scroller.value.scrollTop = y
	measure()
}

let raf = 0
function onScroll() {
	if (raf) return
	raf = requestAnimationFrame(() => {
		raf = 0
		measure()
	})
}

// The scroller's box and the content's box both change what scrollTop can be, so both are observed.
const resizeObserver = new ResizeObserver(measure)
let content: Element | null = null
/** A function ref on the spacer, which only exists once loading ends. Vue calls it on every patch, so repeats are ignored. */
function observeContent(el: Element | ComponentPublicInstance | null) {
	if (el === content) return
	if (content) resizeObserver.unobserve(content)
	content = el as Element | null
	if (content) resizeObserver.observe(content)
}
onMounted(() => {
	resizeObserver.observe(scroller.value!)
	measure()
})
onBeforeUnmount(() => {
	resizeObserver.disconnect()
	if (raf) cancelAnimationFrame(raf)
})

watch(
	() => props.resetKey,
	() => {
		scrollTo(0)
		activeIndex.value = 0
	},
)

async function focusIndex(index: number) {
	activeIndex.value = index
	measure()
	const y = revealTop(index, viewport.value, grid.value.cols)
	if (y !== null) scrollTo(y)
	await nextTick()
	scroller.value?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus({ preventScroll: true })
}

function onKey(ev: KeyboardEvent) {
	const t = ev.target as HTMLElement
	if (!t.classList.contains('card')) return
	const next = navTarget(ev.key, Number(t.dataset.index), props.items.length, grid.value.cols, grid.value.pageRows)
	if (next === null) return
	ev.preventDefault()
	focusIndex(next)
}

function onToggle(index: number, ev: MouseEvent | KeyboardEvent) {
	activeIndex.value = index
	emit('toggle', index, ev)
}
</script>

<template>
	<div ref="scroller" class="scroller" @scroll.passive="onScroll" @keydown="onKey">
		<div v-if="loading" class="skel-grid" aria-busy="true" aria-label="Loading episodes">
			<div v-for="i in 18" :key="i" class="skel" />
		</div>
		<div v-else-if="!items.length" class="empty-slot"><slot name="empty" /></div>
		<div v-else :ref="observeContent" class="spacer" :style="{ height: grid.totalH + 'px' }">
			<div
				class="win"
				:style="{
					transform: `translateY(${grid.offsetY}px)`,
					gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
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
.scroller { flex: 1; overflow: auto; position: relative; min-height: 0; background: var(--bs-body-bg); }
.spacer { position: relative; }
.win { position: absolute; top: 0; left: 0; right: 0; display: grid; box-sizing: border-box; }
.skel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; padding: 12px; }
.skel { height: 184px; border-radius: var(--bs-border-radius); border: 1px solid var(--bs-border-color); background: linear-gradient(90deg, #fff, var(--bs-gray-200), #fff); background-size: 200% 100%; animation: sh 1.4s linear infinite; }
@keyframes sh { to { background-position: -200% 0; } }
.empty-slot { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
@media (prefers-reduced-motion: reduce) { .skel { animation: none; } }
</style>
