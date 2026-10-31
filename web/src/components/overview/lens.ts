import type { EpisodeSummary, Status } from '../../api/client.ts'

export type Scale = 'percent' | 'zero' | 'fit'

export const METRICS = {
	dur: { label: 'Duration', unit: 's', scale: 'zero', get: (e: EpisodeSummary) => e.duration_s },
	trk: { label: 'SLAM tracking', unit: '%', scale: 'percent', get: (e: EpisodeSummary) => e.tracking_pct },
	wid: { label: 'Max gripper width', unit: 'mm', scale: 'fit', get: (e: EpisodeSummary) => e.gripper_max_mm },
} as const satisfies Record<string, { label: string; unit: string; scale: Scale; get: (e: EpisodeSummary) => number }>
export type MetricKey = keyof typeof METRICS
export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[]

export const STATUSES = {
	imported: { label: 'Imported', color: 'var(--imp)' },
	slam_ok: { label: 'SLAM ok', color: 'var(--ok)' },
	slam_failed: { label: 'SLAM failed', color: 'var(--bad)' },
	curated: { label: 'Curated', color: 'var(--cur)' },
	excluded: { label: 'Excluded', color: 'var(--exc)' },
} as const satisfies Record<Status, { label: string; color: string }>
export const STATUS_KEYS = Object.keys(STATUSES) as Status[]

export const SORTS = {
	id: { label: 'Episode id', get: (e: EpisodeSummary) => e.id },
	dur: { label: 'Duration', get: METRICS.dur.get },
	trk: { label: 'Tracking', get: METRICS.trk.get },
	wid: { label: 'Gripper width', get: METRICS.wid.get },
	task: { label: 'Task', get: (e: EpisodeSummary) => e.task },
} as const satisfies Record<string, { label: string; get: (e: EpisodeSummary) => number | string }>
export type SortKey = keyof typeof SORTS
export const SORT_KEYS = Object.keys(SORTS) as SortKey[]

/** Half-open [lo, hi). hi === Infinity means "to the end of the scale" and is spelled `max` in the URL. */
export type Range = readonly [lo: number, hi: number]
export type SortDir = 'asc' | 'desc'

/**
 * What the user chose to see and in what order. It is exactly what the URL encodes, and its field names are the URL
 * param names. Immutable: a change is a new Lens, so "changed" means "not ===". Make new ones with update, toggle, and
 * clearFilters.
 */
export type Lens = { readonly [K in MetricKey]: Range | null } & {
	readonly status: ReadonlySet<Status>
	readonly task: ReadonlySet<string>
	/** As typed. Matching and the URL use it trimmed. */
	readonly q: string
	readonly sort: SortKey
	readonly dir: SortDir
}
/** Lens fields that narrow the list. The rest only order it. */
export type FacetKey = Exclude<keyof Lens, 'sort' | 'dir'>
export type SetFacetKey = 'status' | 'task'
type ItemOf<K extends SetFacetKey> = Lens[K] extends ReadonlySet<infer T> ? T : never

interface Param<T> {
	readonly empty: T
	/** Absent, non-string, or malformed input decodes to `empty`. Never throws. */
	decode(raw: unknown): T
	/** undefined means omit the param. It is returned exactly when the value is equivalent to `empty`. */
	encode(value: T): string | undefined
}
interface Facet<T> extends Param<T> {
	/** True for every value that encodes to undefined. */
	test(e: EpisodeSummary, value: T): boolean
}

const one = (raw: unknown): string => (typeof raw === 'string' ? raw : '')
const num = (x: number) => (Number.isFinite(x) ? String(Math.round(x * 100) / 100) : 'max')

function rangeFacet(get: (e: EpisodeSummary) => number): Facet<Range | null> {
	return {
		empty: null,
		decode(raw) {
			if (typeof raw !== 'string') return null
			const [a, b] = raw.split('_')
			const lo = Number(a)
			const hi = b === 'max' ? Infinity : Number(b)
			return a !== '' && b !== undefined && Number.isFinite(lo) && !Number.isNaN(hi) ? [lo, hi] : null
		},
		encode: (r) => (r ? `${num(r[0])}_${num(r[1])}` : undefined),
		// The negated form on purpose: a NaN metric passes the range.
		test: (e, r) => !r || !(get(e) < r[0] || get(e) >= r[1]),
	}
}

function setFacet<T extends string>(accept: (s: string) => s is T, get: (e: EpisodeSummary) => string): Facet<ReadonlySet<T>> {
	return {
		empty: new Set<T>(),
		decode: (raw) => new Set(one(raw).split(',').filter(accept)),
		encode: (s) => (s.size ? [...s].join(',') : undefined),
		test: (e, s) => !s.size || (s as ReadonlySet<string>).has(get(e)),
	}
}

const searchFacet: Facet<string> = {
	empty: '',
	decode: one,
	encode: (q) => q.trim() || undefined,
	test(e, q) {
		const t = q.trim().toLowerCase()
		return !t || `${e.id} ${e.scene} ${e.session} ${e.instruction} ${e.task} ${e.camera}`.toLowerCase().includes(t)
	},
}

function oneOf<T extends string>(values: readonly T[], empty: T): Param<T> {
	return {
		empty,
		decode: (raw) => (typeof raw === 'string' && (values as readonly string[]).includes(raw) ? (raw as T) : empty),
		encode: (v) => (v === empty ? undefined : v),
	}
}

/** Object.hasOwn, not `in`: status=constructor must be rejected. */
const isStatus = (s: string): s is Status => Object.hasOwn(STATUSES, s)

const RANGE_FACETS = Object.fromEntries(METRIC_KEYS.map((k) => [k, rangeFacet(METRICS[k].get)])) as {
	readonly [K in MetricKey]: Facet<Range | null>
}
const FACETS: { readonly [K in FacetKey]: Facet<Lens[K]> } = {
	...RANGE_FACETS,
	status: setFacet(isStatus, (e) => e.status),
	task: setFacet((s): s is string => s !== '', (e) => e.task),
	q: searchFacet,
}
/** Spread order is URL order: dur, trk, wid, status, task, q, sort, dir. */
const PARAMS: { readonly [K in keyof Lens]: Param<Lens[K]> } = {
	...FACETS,
	sort: oneOf(SORT_KEYS, 'id'),
	dir: oneOf(['asc', 'desc'] as const, 'asc'),
}
const PARAM_KEYS = Object.keys(PARAMS) as (keyof Lens)[]
const FACET_KEYS = Object.keys(FACETS) as FacetKey[]

/** Parse a route query once. Unknown params are ignored and malformed values become defaults. */
export function readLens(query: Readonly<Record<string, unknown>>): Lens {
	const out: Record<string, unknown> = {}
	for (const k of PARAM_KEYS) out[k] = PARAMS[k].decode(query[k])
	return out as Lens
}

/** The query for router.replace: defaults omitted, keys in URL order. */
export function writeLens(lens: Lens): Record<string, string> {
	const out: Record<string, string> = {}
	for (const k of PARAM_KEYS) {
		const s = (PARAMS[k] as Param<unknown>).encode(lens[k])
		if (s !== undefined) out[k] = s
	}
	return out
}

/** Returns the same Lens when the value is Object.is-equal, so a no-op never rewrites the URL or resets the grid. */
export function update<K extends keyof Lens>(lens: Lens, key: K, value: Lens[K]): Lens {
	return Object.is(lens[key], value) ? lens : { ...lens, [key]: value }
}

/** Adds the item if absent, else removes it. Insertion order is kept, because it is the URL order. */
export function toggle<K extends SetFacetKey>(lens: Lens, key: K, item: ItemOf<K>): Lens {
	const next = new Set<string>(lens[key])
	const value = item as string
	if (!next.delete(value)) next.add(value)
	return { ...lens, [key]: next }
}

const isEmpty = (v: unknown, empty: unknown) => v === empty || (v instanceof Set && v.size === 0)

/** Resets one facet, or every facet when `only` is omitted. Sort and dir are kept. Returns the same Lens when nothing changed. */
export function clearFilters(lens: Lens, only?: FacetKey): Lens {
	let next: Record<string, unknown> | null = null
	for (const k of only ? [only] : FACET_KEYS) {
		if (isEmpty(lens[k], FACETS[k].empty)) continue
		next ??= { ...lens }
		next[k] = FACETS[k].empty
	}
	return (next as Lens | null) ?? lens
}

/** True when some facet narrows the list. A whitespace-only search does not. */
export function hasFilters(lens: Lens): boolean {
	return FACET_KEYS.some((k) => (FACETS[k] as Param<unknown>).encode(lens[k]) !== undefined)
}

/** Whether the episode passes every facet except `except`, so each rail section counts against the others. */
export function matches(e: EpisodeSummary, lens: Lens, except?: FacetKey): boolean {
	return FACET_KEYS.every((k) => k === except || (FACETS[k] as Facet<unknown>).test(e, lens[k]))
}
