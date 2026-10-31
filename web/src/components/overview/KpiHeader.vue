<script setup lang="ts">
defineProps<{
	loading: boolean
	synthetic: boolean
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
</script>

<template>
	<header class="kpis" aria-label="Dataset summary">
		<span v-if="synthetic" class="syn" title="At least one listed episode is flagged synthetic">SYNTHETIC</span>
		<div class="kpi">
			<b>{{ loading ? '–' : `${shown} / ${total}` }}</b>
			<span>episodes (shown / total)</span>
		</div>
		<div class="kpi">
			<b>{{ loading ? '–' : `${fmtH(hoursShown)} / ${fmtH(hoursTotal)}` }}</b>
			<span>hours (shown / total)</span>
		</div>
		<div class="kpi">
			<b>{{ loading ? '–' : slamUsable }}</b>
			<span>SLAM usable (ok + curated)</span>
		</div>
		<div class="kpi">
			<b>{{ loading ? '–' : `${curated} (${fmtH(curatedHours)} h)` }}</b>
			<span>curated for training</span>
		</div>
		<div class="kpi">
			<b>{{ loading || medianTracking === null ? '–' : `${Math.round(medianTracking)}%` }}</b>
			<span>median tracking (shown)</span>
		</div>
	</header>
</template>

<style scoped>
.kpis { display: flex; gap: 28px; align-items: center; padding: 10px 16px; background: var(--pn); border-bottom: 1px solid var(--ln); flex-wrap: wrap; }
.kpi b { font-size: 18px; display: block; font-variant-numeric: tabular-nums; line-height: 1.25; }
.kpi span { color: var(--mu); font-size: 11px; }
.syn { background: rgba(229, 199, 90, 0.14); color: #f0d36e; border: 1px solid rgba(229, 199, 90, 0.5); padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; }
</style>
