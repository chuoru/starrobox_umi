<script setup lang="ts">
import { computed } from 'vue'
import type { EpisodeSummary } from '../../api/client'
import { STATUSES } from './lens'

const props = defineProps<{
	episode: EpisodeSummary
	index: number
	selected: boolean
	active: boolean
}>()
const emit = defineEmits<{ toggle: [index: number, ev: MouseEvent | KeyboardEvent]; open: [id: string] }>()

const st = computed(() => STATUSES[props.episode.status])
const trkColor = computed(() => {
	const t = props.episode.tracking_pct
	return t < 50 ? 'var(--bad)' : t < 75 ? 'var(--imp)' : 'var(--ok)'
})
const dur = computed(() => {
	const s = props.episode.duration_s
	return s >= 60 ? `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s` : `${s.toFixed(1)}s`
})

function key(ev: KeyboardEvent) {
	if (ev.target !== ev.currentTarget) return
	if (ev.key === ' ' || ev.key === 'Enter') {
		ev.preventDefault()
		emit('toggle', props.index, ev)
	} else if (ev.key === 'o' || ev.key === 'O') {
		emit('open', props.episode.id)
	}
}
</script>

<template>
	<article
		class="card"
		:class="{ sel: selected, excl: episode.status === 'excluded' }"
		:data-index="index"
		:tabindex="active ? 0 : -1"
		role="button"
		:aria-pressed="selected"
		:aria-label="`${episode.id}, ${st.label}, ${dur}, tracking ${Math.round(episode.tracking_pct)} percent. Space selects, O opens.`"
		@click="emit('toggle', index, $event)"
		@keydown="key"
	>
		<div class="tile" aria-hidden="true">
			<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="6" width="18" height="13" rx="2" />
				<circle cx="12" cy="12.5" r="3.5" />
				<path d="M8 6l1.5-2h5L16 6" />
			</svg>
			<span class="nopv">No preview yet</span>
			<span class="dur">{{ dur }}</span>
			<span class="cb" :class="{ on: selected }">{{ selected ? '✓' : '' }}</span>
		</div>
		<div class="meta">
			<div class="r1">
				<b class="id">{{ episode.id }}</b>
				<span class="badge" :style="{ background: st.color }">{{ st.label }}</span>
			</div>
			<div class="mu" :title="episode.instruction">{{ episode.scene }} / {{ episode.session }} · {{ episode.camera }}</div>
			<div class="mu num">track {{ Math.round(episode.tracking_pct) }}% · grip max {{ Math.round(episode.gripper_max_mm) }} mm</div>
			<div class="tq"><i :style="{ width: episode.tracking_pct + '%', background: trkColor }" /></div>
		</div>
		<RouterLink
			class="open"
			:to="`/episode/${encodeURIComponent(episode.id)}`"
			:tabindex="active ? 0 : -1"
			:aria-label="`Open ${episode.id}`"
			@click.stop
			>Open</RouterLink
		>
	</article>
</template>

<style scoped>
.card { position: relative; display: flex; flex-direction: column; height: 100%; background: var(--pn); border: 1px solid var(--ln); border-radius: 8px; overflow: hidden; cursor: pointer; user-select: none; transition: border-color 0.12s, box-shadow 0.12s, transform 0.12s; }
.card:hover { border-color: var(--mu); }
.card:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.card.sel { border-color: var(--ac); box-shadow: 0 0 0 1px var(--ac); }
.tile { position: relative; flex: none; height: 104px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #4a5365; background: repeating-linear-gradient(135deg, #10131a 0 10px, #131720 10px 20px); }
.excl .tile { opacity: 0.45; filter: grayscale(1); }
.nopv { font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; }
.dur { position: absolute; right: 6px; bottom: 6px; background: rgba(0, 0, 0, 0.6); color: #dfe3ea; font-size: 11px; padding: 1px 6px; border-radius: 4px; font-variant-numeric: tabular-nums; }
.cb { position: absolute; top: 6px; left: 6px; width: 18px; height: 18px; border-radius: 5px; border: 1px solid #6b7588; background: rgba(0, 0, 0, 0.45); color: #0b0d12; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; opacity: 0; transition: opacity 0.12s, background 0.12s; }
.card:hover .cb, .card:focus-visible .cb, .cb.on { opacity: 1; }
.cb.on { background: var(--ac); border-color: var(--ac); }
.meta { padding: 7px 10px 0; font-size: 12px; min-width: 0; flex: 1; }
.r1 { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.id { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 8px; color: #0b0d12; white-space: nowrap; }
.mu { color: var(--mu); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.num { font-variant-numeric: tabular-nums; }
.tq { height: 3px; background: var(--ln); margin-top: 6px; border-radius: 2px; overflow: hidden; }
.tq i { display: block; height: 100%; }
.open { position: absolute; right: 6px; top: 6px; font-size: 11px; color: var(--ac); text-decoration: none; padding: 1px 9px; border: 1px solid var(--ln); border-radius: 10px; opacity: 0; transition: opacity 0.12s, border-color 0.12s; background: rgba(11, 13, 18, 0.85); }
.card:hover .open, .card:focus-visible .open, .open:focus-visible { opacity: 1; }
.open:hover, .open:focus-visible { border-color: var(--ac); }
.open:focus-visible { outline: 2px solid var(--ac); outline-offset: 1px; }
@media (prefers-reduced-motion: reduce) { .card, .cb, .open { transition: none; } }
</style>
