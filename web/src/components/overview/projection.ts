import type { EpisodeSummary, Status } from '../../api/client.ts'
import { METRIC_KEYS, METRICS, SORTS, STATUS_KEYS, matches, type Lens, type MetricKey, type Scale } from './lens.ts'

const BINS = 20

export interface Histogram {
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
export interface Facets {
	/** Per status: episodes that pass every facet except status. */
	status: Record<Status, number>
	/** Null while there are no episodes, so the rail shows skeletons. */
	hists: Record<MetricKey, Histogram> | null
	/** Every task seen, most episodes first, then by name. count is the episodes that pass every facet except task. */
	tasks: TaskRow[]
}
/** The field names are KpiHeader's props. */
export interface Kpi {
	shown: number
	total: number
	hoursShown: number
	hoursTotal: number
	slamUsable: number
	curated: number
	curatedHours: number
	medianTracking: number | null
}
export interface Projection {
	/** Episodes that pass every facet, in lens order. The grid and the selection use indices into this list. */
	view: readonly EpisodeSummary[]
	facets: Facets
	kpi: Kpi
	/** Some episode in the whole list is flagged synthetic. */
	synthetic: boolean
}

export function median(values: number[]): number | null {
	if (!values.length) return null
	const s = values.slice().sort((a, b) => a - b)
	const m = s.length >> 1
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function domainOf(scale: Scale, values: number[]): { lo: number; hi: number } {
	if (scale === 'percent') return { lo: 0, hi: 100 }
	const mx = values.length ? values.reduce((a, b) => Math.max(a, b)) : 5
	const mn = values.reduce((a, b) => Math.min(a, b), mx)
	const lo = scale === 'zero' ? 0 : Math.floor(mn / 5) * 5
	let hi = Math.max(Math.ceil(mx / 5) * 5, 5)
	if (hi <= lo) hi = lo + 5
	return { lo, hi }
}

function histogram(episodes: readonly EpisodeSummary[], lens: Lens, key: MetricKey): Histogram {
	const get = METRICS[key].get
	const { lo, hi } = domainOf(METRICS[key].scale, episodes.map(get))
	const all = new Array<number>(BINS).fill(0)
	const match = new Array<number>(BINS).fill(0)
	for (const e of episodes) {
		const b = Math.max(0, Math.min(BINS - 1, Math.floor(((get(e) - lo) / (hi - lo)) * BINS)))
		all[b]++
		if (matches(e, lens, key)) match[b]++
	}
	return { all, match, lo, hi }
}

function byLens(lens: Lens): (a: EpisodeSummary, b: EpisodeSummary) => number {
	const get = SORTS[lens.sort].get as (e: EpisodeSummary) => number | string
	const dir = lens.dir === 'asc' ? 1 : -1
	return (a, b) => {
		const x = get(a)
		const y = get(b)
		const c = typeof x === 'string' ? x.localeCompare(y as string, undefined, { numeric: true }) : (x as number) - (y as number)
		return (c || a.id.localeCompare(b.id, undefined, { numeric: true })) * dir
	}
}

const hours = (list: readonly EpisodeSummary[]) => list.reduce((s, e) => s + e.duration_s, 0) / 3600

export function project(episodes: readonly EpisodeSummary[], lens: Lens): Projection {
	const view = episodes.filter((e) => matches(e, lens)).sort(byLens(lens))

	const status = Object.fromEntries(STATUS_KEYS.map((s) => [s, 0])) as Record<Status, number>
	for (const e of episodes) if (matches(e, lens, 'status')) status[e.status]++

	const hists = episodes.length
		? (Object.fromEntries(METRIC_KEYS.map((k) => [k, histogram(episodes, lens, k)])) as Record<MetricKey, Histogram>)
		: null

	const byTask = new Map<string, TaskRow>()
	for (const e of episodes) {
		const r = byTask.get(e.task) ?? { task: e.task, count: 0, total: 0, curated: 0 }
		r.total++
		if (e.status === 'curated') r.curated++
		if (matches(e, lens, 'task')) r.count++
		byTask.set(e.task, r)
	}
	const tasks = [...byTask.values()].sort((a, b) => b.total - a.total || a.task.localeCompare(b.task))

	const curated = episodes.filter((e) => e.status === 'curated')
	return {
		view,
		facets: { status, hists, tasks },
		kpi: {
			shown: view.length,
			total: episodes.length,
			hoursShown: hours(view),
			hoursTotal: hours(episodes),
			slamUsable: episodes.filter((e) => e.status === 'slam_ok' || e.status === 'curated').length,
			curated: curated.length,
			curatedHours: hours(curated),
			medianTracking: median(view.map((e) => e.tracking_pct)),
		},
		synthetic: episodes.some((e) => e.synthetic),
	}
}
