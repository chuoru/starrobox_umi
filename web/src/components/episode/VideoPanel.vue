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
	<b-card no-body class="overflow-hidden" role="region" aria-label="Video">
		<div class="px-3 pt-2 pb-1">
			<h6 class="mb-0 text-uppercase small fw-semibold">Video</h6>
		</div>
		<div class="flex-grow-1 position-relative">
			<video
				v-if="detail.has_video && !failed"
				ref="video"
				class="position-absolute top-0 start-0 w-100 h-100"
				:src="src"
				muted
				playsinline
				preload="auto"
				@loadeddata="onReady"
				@error="failed = true"
			/>
			<div v-else class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3">
				<div class="d-flex flex-column align-items-center gap-2 text-center text-muted rounded border bg-white px-5 py-4">
					<b-icon icon="camera-video-off" class="fs-2" />
					<strong class="text-body">{{ detail.has_video ? 'Video could not be loaded' : 'No video imported for this episode' }}</strong>
					<span class="small font-monospace">{{ cursor.time.value.toFixed(2) }} s · frame {{ cursor.frame.value + 1 }}/{{ count }}</span>
				</div>
			</div>
			<span v-if="cursor.lostSegment.value" class="badge text-bg-danger position-absolute start-50 bottom-0 mb-3 translate-middle-x fs-6">TRACKING LOST - pose not measured</span>
		</div>
	</b-card>
</template>

<style scoped>
video { object-fit: contain; display: block; background: #000; }
</style>
