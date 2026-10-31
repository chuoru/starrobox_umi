<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EpisodeDetail } from '../../api/client'
import { api } from '../../api/client'
import type { TimeCursor } from '../../composables/useTimeCursor'

const props = defineProps<{ detail: EpisodeDetail; cursor: TimeCursor; count: number }>()
const video = ref<HTMLVideoElement | null>(null)
const failed = ref(false)
const ready = ref(false)
const src = computed(() => api.videoUrl(props.detail.id))

// The cursor is the clock; the video follows it. While playing we only correct drift.
watch(() => props.cursor.frame.value, (f) => {
	const v = video.value
	if (!v || !ready.value) return
	const want = f / props.detail.fps
	const tol = props.cursor.playing.value ? 0.25 : 0.001
	if (Math.abs(v.currentTime - want) > tol) v.currentTime = want
})
watch(() => props.cursor.playing.value, (p) => {
	const v = video.value
	if (!v || !ready.value) return
	if (p) void v.play().catch(() => {})
	else v.pause()
})
watch(() => props.cursor.rate.value, (r) => {
	if (video.value) video.value.playbackRate = r
}, { immediate: true })
function onReady() {
	ready.value = true
	const v = video.value
	if (v) {
		v.playbackRate = props.cursor.rate.value
		v.currentTime = props.cursor.frame.value / props.detail.fps
	}
}
</script>

<template>
	<section class="panel" aria-label="Video">
		<h2>Video</h2>
		<video
			v-if="detail.has_video && !failed"
			ref="video"
			:src="src"
			muted
			playsinline
			preload="auto"
			@loadeddata="onReady"
			@error="failed = true"
		/>
		<div v-else class="ph">
			<div class="tile">
				<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M4 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm13 3 5-3v10l-5-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 21 21 3" stroke="currentColor" stroke-width="1.5"/></svg>
				<strong>{{ detail.has_video ? 'Video could not be loaded' : 'No video imported for this episode' }}</strong>
				<span class="mono">{{ cursor.time.value.toFixed(2) }} s · frame {{ cursor.frame.value + 1 }}/{{ count }}</span>
			</div>
		</div>
		<span v-if="cursor.lostSegment.value" class="warn">TRACKING LOST - pose not measured</span>
	</section>
</template>

<style scoped>
video { width: 100%; height: 100%; object-fit: contain; display: block; background: #000; }
.ph { position: absolute; inset: 0; display: grid; place-items: center; background: repeating-linear-gradient(135deg, transparent 0 14px, rgb(255 255 255 / 0.015) 14px 28px); }
.tile { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--mut); text-align: center; padding: 16px; }
.tile strong { color: var(--fg); font-weight: 600; font-size: 14px; }
.mono { font: 12px ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums; }
.warn { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); background: color-mix(in srgb, var(--lost) 88%, #000); color: #fff; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 4px; animation: pop 0.15s ease-out; }
@keyframes pop { from { opacity: 0; transform: translate(-50%, 4px); } }
</style>
