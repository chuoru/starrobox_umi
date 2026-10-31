import type { EpisodeSummary, Status } from '../../api/client'

export type RangeKey = 'dur' | 'trk' | 'wid'
/** [lo, hi): hi may be Infinity (selection reaches the last bin). */
export type Range = [number, number]

export interface MetricDef {
	key: RangeKey
	label: string
	unit: string
	get: (e: EpisodeSummary) => number
}

export const METRICS: MetricDef[] = [
	{ key: 'dur', label: 'Duration', unit: 's', get: (e) => e.duration_s },
	{ key: 'trk', label: 'SLAM tracking', unit: '%', get: (e) => e.tracking_pct },
	{ key: 'wid', label: 'Max gripper width', unit: 'mm', get: (e) => e.gripper_max_mm },
]

export const STATUSES: { key: Status; label: string; color: string }[] = [
	{ key: 'imported', label: 'Imported', color: 'var(--imp)' },
	{ key: 'slam_ok', label: 'SLAM ok', color: 'var(--ok)' },
	{ key: 'slam_failed', label: 'SLAM failed', color: 'var(--bad)' },
	{ key: 'curated', label: 'Curated', color: 'var(--cur)' },
	{ key: 'excluded', label: 'Excluded', color: 'var(--exc)' },
]

export interface Filters {
	ranges: Record<RangeKey, Range | null>
	status: Set<Status>
	tasks: Set<string>
	q: string
}

export const emptyFilters = (): Filters => ({
	ranges: { dur: null, trk: null, wid: null },
	status: new Set(),
	tasks: new Set(),
	q: '',
})

export function isFiltered(f: Filters): boolean {
	return !!(f.ranges.dur || f.ranges.trk || f.ranges.wid || f.status.size || f.tasks.size || f.q.trim())
}

/** True when `e` passes every filter except the one named in `skip`. */
export function passes(e: EpisodeSummary, f: Filters, skip?: RangeKey | 'status' | 'task'): boolean {
	for (const m of METRICS) {
		if (skip === m.key) continue
		const r = f.ranges[m.key]
		if (!r) continue
		const v = m.get(e)
		if (v < r[0] || v >= r[1]) return false
	}
	if (skip !== 'status' && f.status.size && !f.status.has(e.status)) return false
	if (skip !== 'task' && f.tasks.size && !f.tasks.has(e.task)) return false
	const q = f.q.trim().toLowerCase()
	if (q && !`${e.id} ${e.scene} ${e.session} ${e.instruction} ${e.task} ${e.camera}`.toLowerCase().includes(q)) return false
	return true
}

export function median(values: number[]): number | null {
	if (!values.length) return null
	const s = values.slice().sort((a, b) => a - b)
	const m = s.length >> 1
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const num = (x: number) => (Number.isFinite(x) ? String(Math.round(x * 100) / 100) : 'max')

export function serializeRange(r: Range | null): string | undefined {
	return r ? `${num(r[0])}_${num(r[1])}` : undefined
}

export function parseRange(s: unknown): Range | null {
	if (typeof s !== 'string') return null
	const [a, b] = s.split('_')
	const lo = Number(a)
	const hi = b === 'max' ? Infinity : Number(b)
	return a !== '' && b !== undefined && Number.isFinite(lo) && !Number.isNaN(hi) ? [lo, hi] : null
}
