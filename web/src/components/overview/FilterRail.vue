<script setup lang="ts">
import type { Status } from '../../api/client'
import HistogramBrush from './HistogramBrush.vue'
import { METRICS, STATUSES, type Filters, type RangeKey } from './filters'

export interface HistData {
	all: number[]
	match: number[]
	lo: number
	hi: number
}
export interface TaskRow {
	task: string
	count: number
	total: number
	curated: number
}

const props = defineProps<{
	filters: Filters
	statusCounts: Record<Status, number>
	hists: Record<RangeKey, HistData> | null
	tasks: TaskRow[]
}>()
// The rail edits the shared reactive filter object directly (it is the single source of truth).

function toggleStatus(s: Status) {
	if (props.filters.status.has(s)) props.filters.status.delete(s)
	else props.filters.status.add(s)
}
function toggleTask(t: string) {
	if (props.filters.tasks.has(t)) props.filters.tasks.delete(t)
	else props.filters.tasks.add(t)
}
const taskPeak = (rows: TaskRow[]) => Math.max(1, ...rows.map((r) => r.total))
</script>

<template>
	<aside class="rail" aria-label="Filters">
		<h3>
			<span>Status</span>
			<button v-if="filters.status.size" type="button" class="link" @click="filters.status.clear()">clear</button>
		</h3>
		<div class="chips">
			<button
				v-for="s in STATUSES"
				:key="s.key"
				type="button"
				class="chip"
				:class="{ on: filters.status.has(s.key) }"
				:aria-pressed="filters.status.has(s.key)"
				@click="toggleStatus(s.key)"
			>
				<span class="dot" :style="{ background: s.color }" />{{ s.label }}
				<span class="cnt">{{ statusCounts[s.key] }}</span>
			</button>
		</div>

		<template v-if="hists">
			<HistogramBrush
				v-for="m in METRICS"
				:key="m.key"
				:label="m.label"
				:unit="m.unit"
				:all="hists[m.key].all"
				:match="hists[m.key].match"
				:lo="hists[m.key].lo"
				:hi="hists[m.key].hi"
				:model-value="filters.ranges[m.key]"
				@update:model-value="filters.ranges[m.key] = $event"
			/>
		</template>
		<template v-else>
			<div v-for="m in METRICS" :key="m.key" class="hb-skel">
				<h3>{{ m.label }}</h3>
				<div class="sk" />
			</div>
		</template>

		<h3 class="tasks-h">
			<span>Task coverage</span>
			<button v-if="filters.tasks.size" type="button" class="link" @click="filters.tasks.clear()">clear</button>
		</h3>
		<ul class="tasks">
			<li v-for="t in tasks" :key="t.task">
				<button
					type="button"
					class="task"
					:class="{ on: filters.tasks.has(t.task), thin: t.curated === 0 }"
					:aria-pressed="filters.tasks.has(t.task)"
					:title="`${t.count} matching other filters, ${t.total} total, ${t.curated} curated`"
					@click="toggleTask(t.task)"
				>
					<span class="name">{{ t.task }}</span>
					<span class="bar">
						<i class="all" :style="{ width: (t.total / taskPeak(tasks)) * 100 + '%' }" />
						<i class="now" :style="{ width: (t.count / taskPeak(tasks)) * 100 + '%' }" />
					</span>
					<span class="n">{{ t.count }}</span>
				</button>
			</li>
			<li v-if="!tasks.length" class="none">No tasks yet.</li>
		</ul>
		<p class="hint">
			Drag across a histogram to filter. Grey bars: all episodes. Blue: episodes matching the other filters. Red task
			counts: no curated episodes yet.
		</p>
	</aside>
</template>

<style scoped>
.rail { width: 290px; flex: none; overflow-y: auto; background: var(--pn); border-right: 1px solid var(--ln); padding: 12px 14px 20px; }
h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--mu); display: flex; justify-content: space-between; align-items: center; font-weight: 600; min-height: 22px; }
.tasks-h { margin-top: 20px; }
.link { background: none; border: 0; color: var(--ac); cursor: pointer; font: inherit; font-size: 12px; text-transform: none; letter-spacing: 0; padding: 2px 6px; border-radius: 4px; }
.link:hover { text-decoration: underline; }
.link:focus-visible, .chip:focus-visible, .task:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border: 1px solid var(--ln); border-radius: 13px; cursor: pointer; background: var(--pn); color: var(--ink); font: inherit; font-size: 12px; transition: border-color 0.12s, background 0.12s; }
.chip:hover { border-color: var(--mu); }
.chip.on { border-color: var(--ac); background: rgba(122, 162, 255, 0.14); }
.chip .cnt { color: var(--mu); font-variant-numeric: tabular-nums; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.tasks { list-style: none; margin: 0; padding: 0; }
.task { display: flex; align-items: center; gap: 8px; width: 100%; padding: 4px 6px; margin: 0 -6px; width: calc(100% + 12px); background: none; border: 0; border-radius: 6px; color: var(--ink); font: inherit; font-size: 12px; cursor: pointer; text-align: left; transition: background 0.12s; }
.task:hover { background: rgba(255, 255, 255, 0.04); }
.task.on { background: rgba(122, 162, 255, 0.14); font-weight: 600; }
.task .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task .bar { flex: 0 0 70px; height: 8px; background: var(--ln); border-radius: 4px; overflow: hidden; position: relative; }
.task .bar i { position: absolute; left: 0; top: 0; bottom: 0; transition: width 0.18s ease; }
.task .bar .all { background: rgba(152, 161, 178, 0.35); }
.task .bar .now { background: var(--ac); }
.task .n { flex: 0 0 26px; text-align: right; color: var(--mu); font-variant-numeric: tabular-nums; }
.task.thin .n { color: var(--bad); }
.none, .hint { color: var(--mu); font-size: 11px; }
.hint { margin: 16px 0 0; line-height: 1.5; }
.hb-skel { margin-top: 16px; }
.sk { height: 58px; border-radius: 4px; background: linear-gradient(90deg, var(--ln), #232a36, var(--ln)); background-size: 200% 100%; animation: sh 1.4s linear infinite; }
@keyframes sh { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .sk { animation: none; } .task .bar i, .chip, .task { transition: none; } }
</style>
