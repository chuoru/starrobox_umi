<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type EpisodeSummary, type Status } from '../api/client'
import BulkBar from '../components/overview/BulkBar.vue'
import EpisodeGrid from '../components/overview/EpisodeGrid.vue'
import FilterRail, { type HistData, type TaskRow } from '../components/overview/FilterRail.vue'
import KpiHeader from '../components/overview/KpiHeader.vue'
import {
	METRICS,
	STATUSES,
	emptyFilters,
	isFiltered,
	median,
	parseRange,
	passes,
	serializeRange,
	type Filters,
	type RangeKey,
} from '../components/overview/filters'

const route = useRoute()
const router = useRouter()

// ---- data ---------------------------------------------------------------------------------
const episodes = shallowRef<EpisodeSummary[]>([])
const loading = ref(true)
const loadError = ref('')

async function load() {
	loading.value = true
	loadError.value = ''
	try {
		episodes.value = await api.episodes()
	} catch (e) {
		loadError.value = e instanceof Error ? e.message : String(e)
	} finally {
		loading.value = false
	}
}

// ---- filters (state lives in the URL query so a filtered view can be shared / reloaded) ----
type SortKey = 'id' | 'dur' | 'trk' | 'wid' | 'task'
const SORTS: { key: SortKey; label: string }[] = [
	{ key: 'id', label: 'Episode id' },
	{ key: 'dur', label: 'Duration' },
	{ key: 'trk', label: 'Tracking' },
	{ key: 'wid', label: 'Gripper width' },
	{ key: 'task', label: 'Task' },
]
const filters = reactive<Filters>(emptyFilters())
const sortKey = ref<SortKey>('id')
const sortAsc = ref(true)

function readQuery() {
	const q = route.query
	const one = (v: unknown) => (typeof v === 'string' ? v : '')
	for (const m of METRICS) filters.ranges[m.key] = parseRange(q[m.key])
	one(q.status).split(',').filter((s) => STATUSES.some((x) => x.key === s)).forEach((s) => filters.status.add(s as Status))
	one(q.task).split(',').filter(Boolean).forEach((t) => filters.tasks.add(t))
	filters.q = one(q.q)
	if (SORTS.some((s) => s.key === q.sort)) sortKey.value = q.sort as SortKey
	sortAsc.value = q.dir !== 'desc'
}
function writeQuery() {
	const query: Record<string, string> = {}
	for (const m of METRICS) {
		const s = serializeRange(filters.ranges[m.key])
		if (s) query[m.key] = s
	}
	if (filters.status.size) query.status = [...filters.status].join(',')
	if (filters.tasks.size) query.task = [...filters.tasks].join(',')
	if (filters.q.trim()) query.q = filters.q.trim()
	if (sortKey.value !== 'id') query.sort = sortKey.value
	if (!sortAsc.value) query.dir = 'desc'
	router.replace({ query })
}
readQuery()

const filtered = computed(() => isFiltered(filters))
function clearAll() {
	Object.assign(filters, emptyFilters())
}

// ---- derived ------------------------------------------------------------------------------
const domains = computed(() => {
	const d = {} as Record<RangeKey, { lo: number; hi: number }>
	for (const m of METRICS) {
		const vals = episodes.value.map(m.get)
		if (m.key === 'trk') d.trk = { lo: 0, hi: 100 }
		else {
			const mx = vals.length ? Math.max(...vals) : 5
			d[m.key] = { lo: m.key === 'dur' ? 0 : Math.floor(Math.min(...vals, mx) / 5) * 5, hi: Math.max(Math.ceil(mx / 5) * 5, 5) }
			if (d[m.key].hi <= d[m.key].lo) d[m.key].hi = d[m.key].lo + 5
		}
	}
	return d
})

const hists = computed<Record<RangeKey, HistData> | null>(() => {
	if (!episodes.value.length) return null
	const out = {} as Record<RangeKey, HistData>
	const BINS = 20
	for (const m of METRICS) {
		const { lo, hi } = domains.value[m.key]
		const all = new Array<number>(BINS).fill(0)
		const match = new Array<number>(BINS).fill(0)
		for (const e of episodes.value) {
			const b = Math.max(0, Math.min(BINS - 1, Math.floor(((m.get(e) - lo) / (hi - lo)) * BINS)))
			all[b]++
			if (passes(e, filters, m.key)) match[b]++
		}
		out[m.key] = { all, match, lo, hi }
	}
	return out
})

const statusCounts = computed(() => {
	const c = Object.fromEntries(STATUSES.map((s) => [s.key, 0])) as Record<Status, number>
	for (const e of episodes.value) if (passes(e, filters, 'status')) c[e.status]++
	return c
})

const taskRows = computed<TaskRow[]>(() => {
	const m = new Map<string, TaskRow>()
	for (const e of episodes.value) {
		const r = m.get(e.task) ?? { task: e.task, count: 0, total: 0, curated: 0 }
		r.total++
		if (e.status === 'curated') r.curated++
		if (passes(e, filters, 'task')) r.count++
		m.set(e.task, r)
	}
	return [...m.values()].sort((a, b) => b.total - a.total || a.task.localeCompare(b.task))
})

const view = computed(() => {
	const list = episodes.value.filter((e) => passes(e, filters))
	const get: Record<SortKey, (e: EpisodeSummary) => number | string> = {
		id: (e) => e.id,
		dur: (e) => e.duration_s,
		trk: (e) => e.tracking_pct,
		wid: (e) => e.gripper_max_mm,
		task: (e) => e.task,
	}
	const f = get[sortKey.value]
	const dir = sortAsc.value ? 1 : -1
	return list.sort((a, b) => {
		const x = f(a)
		const y = f(b)
		const c = typeof x === 'string' ? x.localeCompare(y as string, undefined, { numeric: true }) : (x as number) - (y as number)
		return (c || a.id.localeCompare(b.id, undefined, { numeric: true })) * dir
	})
})

const hours = (list: EpisodeSummary[]) => list.reduce((s, e) => s + e.duration_s, 0) / 3600
const kpi = computed(() => {
	const all = episodes.value
	const cur = all.filter((e) => e.status === 'curated')
	return {
		shown: view.value.length,
		total: all.length,
		hoursShown: hours(view.value),
		hoursTotal: hours(all),
		slamUsable: all.filter((e) => e.status === 'slam_ok' || e.status === 'curated').length,
		curated: cur.length,
		curatedHours: hours(cur),
		medianTracking: median(view.value.map((e) => e.tracking_pct)),
	}
})
const synthetic = computed(() => episodes.value.some((e) => e.synthetic))

// ---- selection ----------------------------------------------------------------------------
const selected = shallowRef(new Set<string>())
let lastIndex = -1

function onToggle(index: number, ev: MouseEvent | KeyboardEvent) {
	const next = new Set(selected.value)
	if (ev.shiftKey && lastIndex >= 0) {
		const [a, b] = [Math.min(lastIndex, index), Math.max(lastIndex, index)]
		for (let i = a; i <= b; i++) next.add(view.value[i].id)
	} else {
		const id = view.value[index].id
		if (next.has(id)) next.delete(id)
		else next.add(id)
		lastIndex = index
	}
	selected.value = next
}
function clearSelection() {
	selected.value = new Set()
	lastIndex = -1
}
function onKey(ev: KeyboardEvent) {
	if (ev.key !== 'Escape' || !selected.value.size) return
	if ((ev.target as HTMLElement | null)?.closest?.('input, select')) return
	clearSelection()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// ---- bulk status change: optimistic, rolled back per episode on failure ------------------
const busy = ref(false)
const bulkErrors = ref<string[]>([])

async function applyStatus(status: Status) {
	if (busy.value) return
	const ids = [...selected.value]
	const prev = new Map<string, Status>()
	for (const e of episodes.value) if (selected.value.has(e.id) && e.status !== status) prev.set(e.id, e.status)
	const targets = ids.filter((id) => prev.has(id))
	bulkErrors.value = []
	if (!targets.length) return clearSelection()

	const patch = (id: string, to: Status, onlyIf?: Status) => {
		episodes.value = episodes.value.map((e) => (e.id === id && (!onlyIf || e.status === onlyIf) ? { ...e, status: to } : e))
	}
	busy.value = true
	// optimistic: one pass
	const set = new Set(targets)
	episodes.value = episodes.value.map((e) => (set.has(e.id) ? { ...e, status } : e))

	const failed: string[] = []
	let cursor = 0
	const worker = async () => {
		while (cursor < targets.length) {
			const id = targets[cursor++]
			try {
				await api.setStatus(id, status)
			} catch (err) {
				patch(id, prev.get(id)!, status) // rollback unless the user changed it meanwhile
				failed.push(`${id}: ${err instanceof Error ? err.message : String(err)}`)
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(6, targets.length) }, worker))
	busy.value = false
	bulkErrors.value = failed
	// keep only the failed ones selected so the action can be retried
	selected.value = new Set(failed.map((f) => f.split(':')[0]))
}

// ---- side effects of filter changes ------------------------------------------------------
const grid = ref<InstanceType<typeof EpisodeGrid> | null>(null)
watch(
	[() => filters.ranges.dur, () => filters.ranges.trk, () => filters.ranges.wid, () => [...filters.status], () => [...filters.tasks], () => filters.q, sortKey, sortAsc],
	() => {
		writeQuery()
		grid.value?.scrollToTop()
	},
)
// Drop selected episodes that are no longer visible so bulk actions never touch hidden rows.
watch(view, (list) => {
	if (!selected.value.size) return
	const visible = new Set(list.map((e) => e.id))
	const keep = [...selected.value].filter((id) => visible.has(id))
	if (keep.length !== selected.value.size) selected.value = new Set(keep)
})

function open(id: string) {
	router.push(`/episode/${encodeURIComponent(id)}`)
}

onMounted(load)
</script>

<template>
	<div class="ov">
		<KpiHeader v-bind="kpi" :loading="loading || !!loadError" :synthetic="synthetic" />
		<div class="body">
			<FilterRail :filters="filters" :status-counts="statusCounts" :hists="hists" :tasks="taskRows" />
			<section class="main">
				<div class="tools">
					<input v-model="filters.q" type="search" placeholder="Search id, scene, instruction" aria-label="Search episodes" :disabled="loading || !!loadError" />
					<label>
						Sort
						<select v-model="sortKey" :disabled="loading || !!loadError">
							<option v-for="s in SORTS" :key="s.key" :value="s.key">{{ s.label }}</option>
						</select>
					</label>
					<button type="button" :disabled="loading || !!loadError" :aria-label="sortAsc ? 'Ascending' : 'Descending'" @click="sortAsc = !sortAsc">
						{{ sortAsc ? 'Asc' : 'Desc' }}
					</button>
					<button v-if="filtered" type="button" class="reset" @click="clearAll">Reset all filters</button>
					<span class="hint">Click to select, Shift-click for a range, arrows to move, O to open.</span>
				</div>
				<BulkBar :count="selected.size" :busy="busy" :errors="bulkErrors" @apply="applyStatus" @clear="clearSelection" @dismiss-errors="bulkErrors = []" />
				<div v-if="loadError" class="state" role="alert">
					<h2>Could not load episodes</h2>
					<p>{{ loadError }}</p>
					<button type="button" @click="load">Try again</button>
				</div>
				<EpisodeGrid v-else ref="grid" :items="view" :selected="selected" :loading="loading" @toggle="onToggle" @open="open">
					<template #empty>
						<div class="state">
							<template v-if="!episodes.length">
								<h2>No episodes yet</h2>
								<p>Import a recording to create the first episode.</p>
							</template>
							<template v-else>
								<h2>No episodes match these filters</h2>
								<p>{{ episodes.length }} episodes are hidden by the current filters.</p>
								<button type="button" @click="clearAll">Reset all filters</button>
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
.tools { display: flex; gap: 10px; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--ln); background: var(--pn); flex-wrap: wrap; }
.tools label { display: flex; align-items: center; gap: 6px; color: var(--mu); }
input[type='search'], select { padding: 5px 9px; border: 1px solid var(--ln); border-radius: 6px; background: var(--bg); color: var(--ink); font: inherit; }
input[type='search'] { width: 260px; }
input:focus-visible, select:focus-visible, button:focus-visible { outline: 2px solid var(--ac); outline-offset: 1px; }
button { padding: 5px 12px; border: 1px solid var(--ln); border-radius: 6px; background: var(--pn); color: var(--ink); cursor: pointer; font: inherit; transition: border-color 0.12s; }
button:hover:not(:disabled) { border-color: var(--ac); }
button:disabled, input:disabled, select:disabled { opacity: 0.5; cursor: default; }
.reset { color: var(--ac); }
.hint { margin-left: auto; color: var(--mu); font-size: 11px; }
.state { margin: auto; text-align: center; color: var(--mu); padding: 48px 24px; }
.state h2 { margin: 0 0 6px; font-size: 16px; color: var(--ink); font-weight: 600; }
.state p { margin: 0 0 14px; }
.main > .state { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; }
</style>
