<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import ContentHeader from '../components/shared/ContentHeader.vue'
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
		<ContentHeader title="Overview">
			<span v-if="shown.synthetic" class="badge text-bg-warning" title="At least one listed episode is flagged synthetic">SYNTHETIC</span>
		</ContentHeader>
		<KpiHeader v-bind="shown.kpi" :loading="blocked" />
		<div class="body">
			<FilterRail v-model:lens="lens" :facets="shown.facets" />
			<b-card no-body class="main">
				<LensBar v-model:lens="lens" :disabled="blocked" />
				<BulkBar :count="selected.size" :busy="busy" :errors="errors" @apply="applyStatus" @clear="clearSelection" @dismiss-errors="dismissErrors" />
				<div v-if="error" class="state" role="alert">
					<h5>Could not load episodes</h5>
					<p class="text-muted">{{ error }}</p>
					<b-button variant="primary" @click="reload">Try again</b-button>
				</div>
				<EpisodeGrid v-else :items="shown.view" :selected="selected" :loading="loading" :reset-key="lens" @toggle="toggleAt" @open="open">
					<template #empty>
						<div class="state">
							<template v-if="!episodes.length">
								<h5>No episodes yet</h5>
								<p class="text-muted mb-0">Import a recording to create the first episode.</p>
							</template>
							<template v-else>
								<h5>No episodes match these filters</h5>
								<p class="text-muted">{{ episodes.length }} episodes are hidden by the current filters.</p>
								<b-button variant="primary" @click="lens = clearFilters(lens)">Reset all filters</b-button>
							</template>
						</div>
					</template>
				</EpisodeGrid>
			</b-card>
		</div>
	</div>
</template>

<style scoped>
.ov {
	--imp: #8f5500;
	--ok: #278020;
	--bad: #dc3545;
	--cur: #6f42c1;
	--exc: #6c757d;
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	padding: 1.25rem 1.5rem 1.5rem;
}
.body { flex: 1; display: flex; gap: 1rem; min-height: 0; }
.main { flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
.state { margin: auto; text-align: center; padding: 3rem 1.5rem; }
</style>
