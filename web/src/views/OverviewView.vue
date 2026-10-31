<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BulkBar from '../components/overview/BulkBar.vue'
import EpisodeGrid from '../components/overview/EpisodeGrid.vue'
import FilterRail from '../components/overview/FilterRail.vue'
import KpiHeader from '../components/overview/KpiHeader.vue'
import LensBar from '../components/overview/LensBar.vue'
import { clearFilters } from '../components/overview/lens'
import { project } from '../components/overview/projection'
import { useBulkSelection } from '../components/overview/useBulkSelection'
import { useEpisodes } from '../components/overview/useEpisodes'
import { useUrlLens } from '../components/overview/useUrlLens'

const router = useRouter()
const { episodes, loading, error, reload, setStatus } = useEpisodes()
const lens = useUrlLens()
const shown = computed(() => project(episodes.value, lens.value))
const { selected, busy, errors, toggleAt, clearSelection, applyStatus, dismissErrors } = useBulkSelection(() => shown.value.view, setStatus)
const blocked = computed(() => loading.value || !!error.value)

const open = (id: string) => router.push(`/episode/${encodeURIComponent(id)}`)
</script>

<template>
	<div class="ov">
		<KpiHeader v-bind="shown.kpi" :loading="blocked" :synthetic="shown.synthetic" />
		<div class="body">
			<FilterRail v-model:lens="lens" :facets="shown.facets" />
			<section class="main">
				<LensBar v-model:lens="lens" :disabled="blocked" />
				<BulkBar :count="selected.size" :busy="busy" :errors="errors" @apply="applyStatus" @clear="clearSelection" @dismiss-errors="dismissErrors" />
				<div v-if="error" class="state" role="alert">
					<h2>Could not load episodes</h2>
					<p>{{ error }}</p>
					<button type="button" @click="reload">Try again</button>
				</div>
				<EpisodeGrid v-else :items="shown.view" :selected="selected" :loading="loading" :reset-key="lens" @toggle="toggleAt" @open="open">
					<template #empty>
						<div class="state">
							<template v-if="!episodes.length">
								<h2>No episodes yet</h2>
								<p>Import a recording to create the first episode.</p>
							</template>
							<template v-else>
								<h2>No episodes match these filters</h2>
								<p>{{ episodes.length }} episodes are hidden by the current filters.</p>
								<button type="button" @click="lens = clearFilters(lens)">Reset all filters</button>
							</template>
						</div>
					</template>
				</EpisodeGrid>
			</section>
		</div>
	</div>
</template>

<style scoped>
.ov {
	--bg: #12151b; --pn: #1b2029; --ink: #e6e9ef; --mu: #98a1b2; --ln: #2d3441; --ac: #7aa2ff;
	--ok: #4cc27f; --bad: #ff7b6b; --cur: #b78cff; --exc: #8d97a8; --imp: #e0b052;
	margin: -16px; height: calc(100vh - 45px); display: flex; flex-direction: column; background: var(--bg); color: var(--ink); font-size: 13px; line-height: 1.4;
}
.body { flex: 1; display: flex; min-height: 0; }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
button:focus-visible { outline: 2px solid var(--ac); outline-offset: 1px; }
button { padding: 5px 12px; border: 1px solid var(--ln); border-radius: 6px; background: var(--pn); color: var(--ink); cursor: pointer; font: inherit; transition: border-color 0.12s; }
button:hover:not(:disabled) { border-color: var(--ac); }
.state { margin: auto; text-align: center; color: var(--mu); padding: 48px 24px; }
.state h2 { margin: 0 0 6px; font-size: 16px; color: var(--ink); font-weight: 600; }
.state p { margin: 0 0 14px; }
.main > .state { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; }
</style>
