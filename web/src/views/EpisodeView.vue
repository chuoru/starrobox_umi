<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api, type EpisodeDetail } from '../api/client'
import { lostSegments, useTimeCursor } from '../composables/useTimeCursor'
import ContentHeader from '../components/shared/ContentHeader.vue'
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
	<div class="ev p-3">
		<ContentHeader :title="id">
			<template #breadcrumbs>
				<span v-if="detail" class="small text-muted">
					{{ detail.scene }} / session {{ detail.session }} / {{ detail.camera }} / {{ detail.fps }} fps / {{ detail.duration_s.toFixed(1) }} s
				</span>
			</template>
			<div v-if="detail" class="d-flex align-items-center gap-3 me-3">
				<span v-if="detail.synthetic" class="badge text-bg-warning" title="Generated test data, not a real recording">SYNTHETIC</span>
				<span><span class="text-muted">Instruction:</span> <q class="fw-semibold">{{ detail.instruction }}</q></span>
			</div>
			<b-button variant="default" to="/overview">&larr; Overview</b-button>
		</ContentHeader>

		<div v-if="loading" class="state d-flex align-items-center justify-content-center gap-2 text-muted" role="status">
			<b-spinner small />Loading {{ id }}...
		</div>
		<b-alert v-else-if="error" variant="danger">
			<strong>Could not load {{ id }}</strong>
			<div>{{ error }}</div>
			<b-button size="sm" class="mt-2 me-2" @click="load">Retry</b-button>
			<b-button size="sm" variant="default" to="/overview">Back to overview</b-button>
		</b-alert>
		<b-alert v-else-if="detail && !detail.series" variant="info">
			<strong>{{ detail.id }} has no time series yet</strong>
			<div>Run SLAM on this episode to produce trajectory, speed and IMU data.</div>
		</b-alert>
		<template v-else-if="detail && detail.series">
			<div class="grid">
				<VideoPanel :detail="detail" :cursor="cursor" :count="count" />
				<TrajectoryPanel :series="detail.series" :cursor="cursor" />
				<TimelinePanel class="tl" :series="detail.series" :cursor="cursor" :lost="lost" />
			</div>
			<TransportBar class="mt-3" :cursor="cursor" :count="count" :has-lost="lost.length > 0" />
		</template>
	</div>
</template>

<style scoped>
.ev { flex: 1 0 auto; display: flex; flex-direction: column; min-height: 640px; }
.state { flex: 1; }
.grid { flex: 1; min-height: 0; display: grid; gap: 1rem; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) minmax(250px, 44%); }
.grid > * { min-height: 0; }
.grid .tl { grid-column: 1 / 3; }
@media (max-width: 760px) {
	.grid { grid-template-columns: 1fr; grid-template-rows: 220px 260px 300px; }
	.grid .tl { grid-column: 1; }
}
</style>
