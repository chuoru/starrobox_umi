<script setup lang="ts">
import { RATES, type TimeCursor } from '../../composables/useTimeCursor'

defineProps<{ cursor: TimeCursor; count: number; hasLost: boolean }>()
</script>

<template>
	<b-card no-body>
		<div class="d-flex flex-wrap align-items-center gap-2 px-3 py-2">
			<b-button size="sm" variant="primary" class="play" :aria-label="cursor.playing.value ? 'Pause' : 'Play'" title="Space" @click="cursor.toggle()">
				{{ cursor.playing.value ? 'Pause' : 'Play' }}
			</b-button>
			<b-button size="sm" variant="default" title="Left" aria-label="Previous frame" @click="cursor.step(-1)">&#9664; frame</b-button>
			<b-button size="sm" variant="default" title="Right" aria-label="Next frame" @click="cursor.step(1)">frame &#9654;</b-button>
			<span class="clock small font-monospace ms-2">
				frame {{ cursor.frame.value + 1 }}/{{ count }} &nbsp; {{ cursor.time.value.toFixed(2) }} / {{ cursor.duration.value.toFixed(2) }} s
				<span v-if="cursor.lostSegment.value" class="badge text-bg-danger ms-1">LOST</span>
			</span>
			<span class="d-inline-flex align-items-center gap-1 ms-2 small">
				Speed
				<b-button size="sm" variant="none" aria-label="Slower" title="-" :disabled="cursor.rateIndex.value === 0" @click="cursor.slower()">-</b-button>
				<b class="rate text-center font-monospace">{{ cursor.rate.value }}x</b>
				<b-button size="sm" variant="none" aria-label="Faster" title="+" :disabled="cursor.rateIndex.value === RATES.length - 1" @click="cursor.faster()">+</b-button>
			</span>
			<b-button size="sm" :variant="cursor.loop.value ? 'primary' : 'default'" :aria-pressed="cursor.loop.value" title="L" @click="cursor.loop.value = !cursor.loop.value">Loop</b-button>
			<span class="ms-auto d-flex flex-wrap gap-3 align-items-center small text-muted">
				<span><i class="sw bg-success" />tracked</span>
				<span v-if="hasLost"><i class="sw hatch" />tracking lost</span>
				<span><i class="sw kf" />keyframe</span>
			</span>
		</div>
		<div class="d-flex flex-wrap gap-3 px-3 pb-2 small text-muted">
			<span><kbd>Space</kbd> play</span>
			<span><kbd>&larr;</kbd><kbd>&rarr;</kbd> frame</span>
			<span><kbd>Shift</kbd>+<kbd>&larr;</kbd><kbd>&rarr;</kbd> 1 s</span>
			<span><kbd>[</kbd><kbd>]</kbd> keyframe</span>
			<span><kbd>N</kbd><kbd>B</kbd> lost edge</span>
			<span><kbd>Home</kbd><kbd>End</kbd></span>
			<span><kbd>-</kbd><kbd>+</kbd> speed</span>
			<span><kbd>L</kbd> loop</span>
		</div>
	</b-card>
</template>

<style scoped>
.play { min-width: 72px; }
.clock { min-width: 240px; }
.rate { min-width: 36px; }
.sw { display: inline-block; width: 14px; height: 8px; margin-right: 4px; border-radius: 2px; }
.sw.kf { background: #d99100; }
.sw.hatch { background: repeating-linear-gradient(45deg, var(--bs-danger) 0 2px, transparent 2px 5px); border: 1px solid var(--bs-danger); }
kbd { border: 1px solid var(--bs-gray-300); border-bottom-width: 2px; border-radius: 3px; padding: 0 4px; margin-right: 2px; font-size: 11px; background: var(--bs-gray-100); color: var(--bs-gray-800); }
</style>
