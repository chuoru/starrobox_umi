<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api, type EpisodeDetail } from '../api/client'
import { lostSegments, useTimeCursor } from '../composables/useTimeCursor'
import TimelinePanel from '../components/episode/TimelinePanel.vue'
import TrajectoryPanel from '../components/episode/TrajectoryPanel.vue'
import TransportBar from '../components/episode/TransportBar.vue'
import VideoPanel from '../components/episode/VideoPanel.vue'

const route = useRoute()
const id = computed(() => String(route.params.id))
const detail = ref<EpisodeDetail | null>(null)
const error = ref('')
const loading = ref(true)

const count = computed(() => detail.value?.series?.tracking.length ?? 0)
const fps = computed(() => detail.value?.fps ?? 30)
const keyframes = computed(() => detail.value?.series?.keyframes ?? [])
const lost = computed(() => lostSegments(detail.value?.series?.tracking ?? []))
const cursor = useTimeCursor(count, fps, keyframes, lost)
cursor.attachKeys()

async function load() {
	loading.value = true
	error.value = ''
	detail.value = null
	cursor.pause()
	try {
		const d = await api.episode(id.value)
		detail.value = d
		const t = Number(route.query.t)
		cursor.seek(Number.isFinite(t) && route.query.t !== undefined ? t * d.fps : 0)
	} catch (e) {
		error.value = e instanceof Error ? e.message : String(e)
	} finally {
		loading.value = false
	}
}
onMounted(load)
watch(id, load)
</script>

<template>
	<div class="ev">
		<header class="head">
			<RouterLink to="/overview" class="back">&larr; Overview</RouterLink>
			<template v-if="detail">
				<span v-if="detail.synthetic" class="badge" title="Generated test data, not a real recording">SYNTHETIC</span>
				<span class="ep">{{ detail.id }}
					<span class="mut">/ {{ detail.scene }} / session {{ detail.session }} / {{ detail.camera }} / {{ detail.fps }} fps / {{ detail.duration_s.toFixed(1) }} s</span>
				</span>
				<span class="instr"><span class="mut">Instruction:</span> <q>{{ detail.instruction }}</q></span>
			</template>
			<span v-else class="ep">{{ id }}</span>
		</header>

		<div v-if="loading" class="state" role="status"><i class="spin" />Loading {{ id }}...</div>
		<div v-else-if="error" class="state err" role="alert">
			<strong>Could not load {{ id }}</strong>
			<span class="mut">{{ error }}</span>
			<span><button @click="load">Retry</button> <RouterLink to="/overview">Back to overview</RouterLink></span>
		</div>
		<div v-else-if="detail && !detail.series" class="state">
			<strong>{{ detail.id }} has no time series yet</strong>
			<span class="mut">Run SLAM on this episode to produce trajectory, speed and IMU data.</span>
			<RouterLink to="/overview">Back to overview</RouterLink>
		</div>
		<template v-else-if="detail && detail.series">
			<main class="grid">
				<VideoPanel :detail="detail" :cursor="cursor" :count="count" />
				<TrajectoryPanel :series="detail.series" :cursor="cursor" />
				<TimelinePanel class="tl" :series="detail.series" :cursor="cursor" :lost="lost" />
			</main>
			<TransportBar :cursor="cursor" :count="count" :has-lost="lost.length > 0" />
		</template>
	</div>
</template>

<style>
.ev {
	--bg: #14171c; --panel: #1b1f26; --line: #2c323c; --fg: #e4e8ee; --mut: #8c96a5;
	--accent: #4da3ff; --ok: #4cc38a; --lost: #ff6b5e; --kf: #f5c451;
	--c1: #4da3ff; --c2: #4cc38a; --c3: #e08cf0;
	display: flex; flex-direction: column; gap: 8px; color: var(--fg); font: 13px/1.4 system-ui, 'Segoe UI', sans-serif;
	height: calc(100vh - 92px); min-height: 620px;
}
.ev .mut { color: var(--mut); }
.ev .head { display: flex; gap: 8px 16px; align-items: center; flex-wrap: wrap; padding: 8px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }
.ev .back { color: var(--accent); text-decoration: none; font-weight: 600; }
.ev .back:hover { text-decoration: underline; }
.ev .ep { font-weight: 600; }
.ev .ep .mut { font-weight: 400; }
.ev .instr { flex: 1; min-width: 240px; font-size: 14px; }
.ev .instr q { font-style: normal; font-weight: 600; }
.ev .badge { background: #b8860b; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; }
.ev .grid { flex: 1; min-height: 0; display: grid; gap: 8px; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) minmax(250px, 44%); }
.ev .grid .tl { grid-column: 1 / 3; }
.ev .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; position: relative; min-height: 0; overflow: hidden; animation: fade 0.2s ease-out; }
.ev .panel h2 { position: absolute; left: 10px; top: 8px; margin: 0; font-size: 11px; font-weight: 600; color: var(--mut); text-transform: uppercase; letter-spacing: 0.06em; z-index: 2; pointer-events: none; }
.ev .stat { position: absolute; right: 10px; top: 8px; font: 11px ui-monospace, Consolas, monospace; z-index: 2; text-align: right; pointer-events: none; line-height: 1.6; }
.ev .pill { display: inline-block; padding: 1px 7px; border-radius: 9px; font-weight: 700; color: #fff; }
.ev .pill.ok { background: #2d8f63; }
.ev .pill.lost { background: #d23b2c; }
.ev .state { flex: 1; display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; color: var(--mut); background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }
.ev .state strong { color: var(--fg); font-size: 15px; }
.ev .state.err strong { color: var(--lost); }
.ev .state a { color: var(--accent); }
.ev .state button { background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 4px; padding: 4px 12px; cursor: pointer; font: inherit; }
.ev .spin { width: 18px; height: 18px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: rot 0.8s linear infinite; }
@keyframes rot { to { transform: rotate(360deg); } }
@keyframes fade { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .ev * { animation: none !important; transition: none !important; } }
@media (max-width: 760px) {
	.ev { height: auto; }
	.ev .grid { grid-template-columns: 1fr; grid-template-rows: 220px 260px 300px; }
	.ev .grid .tl { grid-column: 1; }
}
</style>
