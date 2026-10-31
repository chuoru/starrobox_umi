<script setup lang="ts">
import { RATES, type TimeCursor } from '../../composables/useTimeCursor'

defineProps<{ cursor: TimeCursor; count: number; hasLost: boolean }>()
</script>

<template>
	<footer class="transport">
		<button class="primary" :aria-label="cursor.playing.value ? 'Pause' : 'Play'" title="Space" @click="cursor.toggle()">
			{{ cursor.playing.value ? 'Pause' : 'Play' }}
		</button>
		<button title="Left" aria-label="Previous frame" @click="cursor.step(-1)">&#9664; frame</button>
		<button title="Right" aria-label="Next frame" @click="cursor.step(1)">frame &#9654;</button>
		<span class="clock mono">
			frame {{ cursor.frame.value + 1 }}/{{ count }} &nbsp; {{ cursor.time.value.toFixed(2) }} / {{ cursor.duration.value.toFixed(2) }} s
			<span v-if="cursor.lostSegment.value" class="lost">LOST</span>
		</span>
		<span class="speed">
			Speed
			<button aria-label="Slower" title="-" :disabled="cursor.rateIndex.value === 0" @click="cursor.slower()">-</button>
			<b class="mono">{{ cursor.rate.value }}x</b>
			<button aria-label="Faster" title="+" :disabled="cursor.rateIndex.value === RATES.length - 1" @click="cursor.faster()">+</button>
		</span>
		<button :class="{ on: cursor.loop.value }" :aria-pressed="cursor.loop.value" title="L" @click="cursor.loop.value = !cursor.loop.value">Loop</button>
		<span class="legend">
			<span><i class="sw" style="background: var(--ok)" />tracked</span>
			<span v-if="hasLost"><i class="sw hatch" />tracking lost</span>
			<span><i class="sw" style="background: var(--kf)" />keyframe</span>
		</span>
		<span class="keys">
			<span><kbd>Space</kbd> play</span>
			<span><kbd>&larr;</kbd><kbd>&rarr;</kbd> frame</span>
			<span><kbd>Shift</kbd>+<kbd>&larr;</kbd><kbd>&rarr;</kbd> 1 s</span>
			<span><kbd>[</kbd><kbd>]</kbd> keyframe</span>
			<span><kbd>N</kbd><kbd>B</kbd> lost edge</span>
			<span><kbd>Home</kbd><kbd>End</kbd></span>
			<span><kbd>-</kbd><kbd>+</kbd> speed</span>
			<span><kbd>L</kbd> loop</span>
		</span>
	</footer>
</template>

<style scoped>
.transport { display: flex; gap: 8px 14px; align-items: center; flex-wrap: wrap; padding: 8px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }
button { background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 4px; padding: 4px 10px; cursor: pointer; font: inherit; transition: border-color 0.12s, background 0.12s; }
button:hover:not(:disabled) { border-color: var(--accent); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
button:disabled { opacity: 0.4; cursor: default; }
button.primary { min-width: 64px; background: var(--accent); border-color: var(--accent); color: #06121f; font-weight: 600; }
button.on { border-color: var(--accent); color: var(--accent); }
.mono { font: 12px ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums; }
.clock { min-width: 250px; }
.lost { background: var(--lost); color: #fff; border-radius: 9px; padding: 1px 7px; font-weight: 700; margin-left: 6px; }
.speed { display: inline-flex; gap: 6px; align-items: center; }
.speed b { min-width: 36px; text-align: center; }
.legend, .keys { display: flex; gap: 12px; font-size: 11px; color: var(--mut); align-items: center; flex-wrap: wrap; }
.legend { margin-left: auto; }
.keys { flex-basis: 100%; gap: 14px; }
.sw { display: inline-block; width: 14px; height: 8px; margin-right: 4px; border-radius: 2px; }
.sw.hatch { background: repeating-linear-gradient(45deg, var(--lost) 0 2px, transparent 2px 5px); border: 1px solid var(--lost); }
kbd { border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 3px; padding: 0 4px; font: 11px ui-monospace, Consolas, monospace; background: var(--bg); color: var(--fg); }
</style>
