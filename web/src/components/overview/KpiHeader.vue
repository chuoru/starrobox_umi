<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
	loading: boolean
	shown: number
	total: number
	hoursShown: number
	hoursTotal: number
	slamUsable: number
	curated: number
	curatedHours: number
	medianTracking: number | null
}>()

const fmtH = (h: number) => (h < 10 ? h.toFixed(2) : h.toFixed(1))

const cards = computed(() => [
	{ label: 'episodes (shown / total)', value: `${props.shown} / ${props.total}` },
	{ label: 'hours (shown / total)', value: `${fmtH(props.hoursShown)} / ${fmtH(props.hoursTotal)}` },
	{ label: 'SLAM usable (ok + curated)', value: String(props.slamUsable) },
	{ label: 'curated for training', value: `${props.curated} (${fmtH(props.curatedHours)} h)` },
	{ label: 'median tracking (shown)', value: props.medianTracking === null ? '–' : `${Math.round(props.medianTracking)}%` },
])
</script>

<template>
	<section class="row g-3 mb-3" aria-label="Dataset summary">
		<div v-for="k in cards" :key="k.label" class="col">
			<b-card class="h-100">
				<div class="kpi-v">{{ loading ? '–' : k.value }}</div>
				<div class="text-muted small">{{ k.label }}</div>
			</b-card>
		</div>
	</section>
</template>

<style scoped>
.kpi-v { font-size: 1.5rem; font-weight: 700; line-height: 1.25; font-variant-numeric: tabular-nums; }
</style>
