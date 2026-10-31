# Candidate B: one Overview domain model, pure presentation, DOM-owned scroll offset

## Problem

`OverviewView.vue` is a 325-line file that owns seven concerns (load, filter state, sort state, URL sync, derived stats, selection, optimistic bulk update) with the template as an afterthought. `FilterRail.vue` receives the parent's reactive `filters` and mutates it through the prop, and it exports `HistData` and `TaskRow` from the SFC so the parent imports types from a child. `EpisodeGrid.vue` keeps `top`, a Vue copy of `scroller.scrollTop`, and patches it with `watch(items.length)` because the browser clamps `scrollTop` when the list shrinks.

Constraints the design must honor, all from the e2e and the brief:

- URL params `dur/trk/wid` (`lo_hi`, hi may be `max`), `status`, `task`, `q`, `sort`, `dir` are parsed once at setup and rewritten with `router.replace` on change.
- The KPI text `N / 60`, `article.card[aria-pressed]`, the `role=toolbar` 'Bulk actions' bar and the `role=alert` banner, and the histogram `role=group` 'Duration...' label all stay.
- Escape is a window-level handler. It has to be, because after Curate the focused button unmounts and focus falls to `body`, and the e2e presses Escape there.
- Click and Shift-click selection, and Open navigating to `/episode/<id>`, stay.
- `api/client.ts` is untouched. No new dependencies.

Two things make the shape non-obvious.

- Selection has an invariant, "selection is a subset of the visible view", enforced today by a watcher that runs after the fact. Anchor index, prune and bulk all touch the same state, so splitting them into per-concern composables creates split ownership.
- The scroll offset is state owned by the browser. It can change without Vue being told (clamping), and the grid keeps a copy.

## Usage (caller's view)

The whole screen is one model. The view is wiring plus the one window-level key binding.

```vue
<!-- OverviewView.vue, after (script ~14 lines, template ~40) -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useOverview } from '../components/overview/model'
import { inTextEntry, useWindowKey } from '../composables/useWindowKey'
import BulkBar from '../components/overview/BulkBar.vue'
import EpisodeGrid from '../components/overview/EpisodeGrid.vue'
import FilterRail from '../components/overview/FilterRail.vue'
import KpiHeader from '../components/overview/KpiHeader.vue'
import OverviewToolbar from '../components/overview/OverviewToolbar.vue'

const { state, actions } = useOverview()      // state: shallowReadonly snapshot; actions: intent-named
const router = useRouter()
const open = (id: string) => router.push(`/episode/${encodeURIComponent(id)}`)
useWindowKey('keydown', (ev) => {
	if (ev.key === 'Escape' && !inTextEntry(ev.target)) actions.clearSelection()
})
</script>

<template>
	<div class="ov">
		<KpiHeader v-bind="state.headline" />
		<div class="body">
			<FilterRail
				:rail="state.rail"
				@toggle-status="actions.toggleStatus" @clear-status="actions.clearStatus"
				@toggle-task="actions.toggleTask" @clear-tasks="actions.clearTasks"
				@set-range="actions.setRange" />
			<section class="main">
				<OverviewToolbar
					:query="state.query" :sort="state.sort" :sort-options="state.sortOptions"
					:disabled="state.inert" :filtered="state.isFiltered"
					@query="actions.setQuery" @sort-key="actions.setSortKey"
					@toggle-dir="actions.toggleSortDir" @reset="actions.resetFilters" />
				<BulkBar :count="state.selection.size" :busy="state.bulk.busy" :errors="state.bulk.errors"
					@apply="actions.applyStatus" @clear="actions.clearSelection" @dismiss-errors="actions.dismissBulkErrors" />
				<div v-if="state.load.kind === 'failed'" class="state" role="alert">
					<h2>Could not load episodes</h2><p>{{ state.load.message }}</p>
					<button type="button" @click="actions.reload">Try again</button>
				</div>
				<EpisodeGrid v-else :items="state.view" :selected="state.selection"
					:loading="state.load.kind === 'loading'" :reset-token="state.viewRev"
					@toggle="actions.toggleSelect" @open="open">
					<template #empty>... same two empty states, using state.headline.total / actions.resetFilters ...</template>
				</EpisodeGrid>
			</section>
		</div>
	</div>
</template>
```

`FilterRail` props and emits after the change. No prop is ever written to.

```ts
const props = defineProps<{ rail: RailView }>()          // RailView from model/types.ts, not from the SFC
const emit = defineEmits<{
	toggleStatus: [Status]; clearStatus: []
	toggleTask: [string]; clearTasks: []
	setRange: [RangeKey, Range | null]
}>()
// template: :aria-pressed="rail.status.has(s.key)"  @click="emit('toggleStatus', s.key)"
//           HistogramBrush @update:model-value="emit('setRange', m.key, $event)"
```

Other call sites:

```ts
// a unit test, no router and no DOM
const m = useOverview({ readQuery: () => ({ status: 'curated', dur: '0_30' }), writeQuery: spy,
                        loadEpisodes: async () => FIXTURE, setStatus: fakeSend })
m.actions.toggleSelect(2, false); m.actions.toggleSelect(5, true)   // range 2..5
await m.actions.applyStatus('excluded')

// the grid, pure math: the stale-window bug is a one-line test
computeGrid(7, { scrollTop: 5000, width: 1000, height: 600 }).scrollTop   // clamped to maxScroll, not 5000
```

## Shape

### Data structures first

`Core` is one immutable record, the only mutable state of the screen, held in a single `shallowRef` inside `useOverview`. It holds the episode list, the filters, the sort, the selection and the anchor index.

```ts
// model/types.ts
export const SORTS = [
	{ key: 'id', label: 'Episode id' }, { key: 'dur', label: 'Duration' }, { key: 'trk', label: 'Tracking' },
	{ key: 'wid', label: 'Gripper width' }, { key: 'task', label: 'Task' },
] as const
export type SortKey = (typeof SORTS)[number]['key']        // one list: the type, the select options and the URL validator all derive from it
export interface SortState { readonly key: SortKey; readonly asc: boolean }

export interface Filters {                                   // filters.ts, now fully immutable
	readonly ranges: Readonly<Record<RangeKey, Range | null>>
	readonly status: ReadonlySet<Status>
	readonly tasks: ReadonlySet<string>
	readonly q: string
}
export interface Core {
	readonly episodes: readonly EpisodeSummary[]
	readonly filters: Filters
	readonly sort: SortState
	readonly selection: ReadonlySet<string>                  // invariant: subset of selectView(...) ids, enforced in commit()
	readonly anchor: number                                  // view index of last plain click, -1 none (identical semantics to lastIndex)
}
export type LoadPhase = { kind: 'loading' } | { kind: 'failed'; message: string } | { kind: 'ready' }

export interface HistData { all: number[]; match: number[]; lo: number; hi: number }
export interface TaskRow { task: string; count: number; total: number; curated: number }
export interface RailView {
	readonly status: ReadonlySet<Status>; readonly tasks: ReadonlySet<string>
	readonly ranges: Readonly<Record<RangeKey, Range | null>>
	readonly statusCounts: Readonly<Record<Status, number>>
	readonly hists: Readonly<Record<RangeKey, HistData>> | null
	readonly taskRows: readonly TaskRow[]
}
export interface Headline {                                   // KpiHeader's props; KpiHeader does defineProps<Headline>()
	loading: boolean; synthetic: boolean; shown: number; total: number
	hoursShown: number; hoursTotal: number; slamUsable: number
	curated: number; curatedHours: number; medianTracking: number | null
}
export interface OverviewState {
	readonly load: LoadPhase
	readonly inert: boolean                                   // load.kind !== 'ready'; disables the toolbar
	readonly headline: Headline
	readonly rail: RailView
	readonly query: string
	readonly sort: SortState
	readonly sortOptions: typeof SORTS
	readonly isFiltered: boolean
	readonly view: readonly EpisodeSummary[]
	readonly selection: ReadonlySet<string>
	readonly bulk: { readonly busy: boolean; readonly errors: readonly string[] }
	readonly viewRev: number                                  // bumps on every filter or sort change; the grid resets scroll on it
}
export interface OverviewActions {
	reload(): Promise<void>
	toggleStatus(s: Status): void; clearStatus(): void
	toggleTask(t: string): void;   clearTasks(): void
	setRange(key: RangeKey, r: Range | null): void
	setQuery(q: string): void
	setSortKey(k: SortKey): void;  toggleSortDir(): void
	resetFilters(): void
	toggleSelect(index: number, extend: boolean): void
	clearSelection(): void                                    // no-op when empty (see "silent change" 1)
	dismissBulkErrors(): void
	applyStatus(to: Status): Promise<void>
}
export interface OverviewPorts {                             // the only I/O seams; domain types in, domain types out
	loadEpisodes(): Promise<EpisodeSummary[]>
	setStatus(id: string, to: Status): Promise<unknown>
	readQuery(): Record<string, unknown>
	writeQuery(query: Record<string, string>): void
}
export function useOverview(ports?: OverviewPorts): { state: Readonly<OverviewState>; actions: OverviewActions }
```

`defaultPorts()` wires `api.episodes`, `api.setStatus`, `route.query` and `router.replace`. `api/client.ts` stays as is, and `EpisodeSummary` and `Status` are already domain types, so nothing from the wire leaks.

### Flow

Every action is `commit(pureTransition(core.value, ...))`. `commit` is the single writer of `Core` and applies two rules after each transition:

```ts
// model/useOverview.ts
function commit(next: Core): void {
	// not implemented
	// prev = core.value
	// if (next.selection.size && (next.episodes !== prev.episodes || next.filters !== prev.filters))
	//     next = { ...next, selection: intersect(next.selection, idsOf(selectView(next))) }   // invariant: selection ⊆ view
	// if (next.filters !== prev.filters || next.sort !== prev.sort) viewRev.value++
	// core.value = next
}
```

- **Invariant by construction.** The old `watch(view, prune)` ran after the fact. `selectView` is memoised on the identity of `(episodes, filters, sort)` (a single-entry `memoLast`), so the `view` computed and `commit` share one filter-and-sort pass.
- **Selectors keep recompute narrow.** `const episodes = computed(() => core.value.episodes)`, and likewise `filters`, `sort` and `selection`. A computed returns the same reference when unchanged, so toggling selection does not recompute histograms.
- **One `watch` remains**, for the single side effect: `watch([filters, sort], () => ports.writeQuery(encodeQuery(filters.value, sort.value)))`. It is non-immediate and batches per tick like the original. `viewRev` is bumped in `commit`, not in the watch.

Pure modules, none of which import Vue:

```ts
// model/derive.ts: pure, unit-testable
export function metricDomains(eps: readonly EpisodeSummary[]): Record<RangeKey, { lo: number; hi: number }>
export function histograms(eps, f: Filters, domains): Record<RangeKey, HistData> | null   // BINS = 20, null if empty
export function statusCounts(eps, f): Record<Status, number>
export function taskRows(eps, f): TaskRow[]
export const selectView: (eps, f: Filters, s: SortState) => EpisodeSummary[]             // memoLast over compareBy(sort)
export function headline(eps, view, load: LoadPhase): Headline

// model/query.ts: the only knowledge of URL param names
export function decodeQuery(q: Record<string, unknown>): { filters: Filters; sort: SortState }
export function encodeQuery(f: Filters, s: SortState): Record<string, string>
//   same key order and trim rules as writeQuery. Keys come from METRICS and SORTS, not a copy.

// model/core.ts: pure transitions, Core -> Core
export function toggleSelect(core: Core, view: readonly EpisodeSummary[], index: number, extend: boolean): Core
//   if (extend && core.anchor >= 0) { add ids view[min..max] (clamped to view.length-1); anchor unchanged }
//   else { toggle view[index].id; anchor = index }
export function clearSelection(core: Core): Core                     // returns same object if selection empty
export function patchStatus(core: Core, ids: ReadonlySet<string>, to: Status, onlyIf?: Status): Core

// model/bulk.ts
export interface BulkTarget { id: string; from: Status }
export function planBulk(core: Core, to: Status): BulkTarget[]       // selected ∧ status != to, in selection order
export function forEachLimited<T>(items: readonly T[], limit: number, task: (t: T) => Promise<void>): Promise<void>
//   min(limit, n) workers share one cursor, exactly as before
```

The bulk orchestration lives in `useOverview` because it must write `Core` and `bulk`. It is pseudocode over the pure parts:

```ts
async function applyStatus(to: Status) {
	// not implemented
	// if (bulk.value.busy) return                                    // idempotent re-entry guard
	// targets = planBulk(core.value, to)
	// if (!targets.length) { bulk = {busy:false, errors:[]}; return commit(clearSelection(core.value)) }
	// bulk = { busy: true, errors: [] }
	// commit(patchStatus(core.value, ids(targets), to))                 // optimistic
	// failures: {id, message}[] = []
	// await forEachLimited(targets, 6, async ({ id, from }) => {
	//     try { await ports.setStatus(id, to) }
	//     catch (err) { commit(patchStatus(core.value, new Set([id]), from, /*onlyIf*/ to)); failures.push({ id, message: errMsg(err) }) }
	// })
	// bulk = { busy: false, errors: failures.map(f => `${f.id}: ${f.message}`) }
	// commit({ ...core.value, selection: new Set(failures.map(f => f.id)) })   // narrowed to failed ids
}
```

Failures are structured `{ id, message }`. The old code re-parsed ids out of `"id: message"` with `split(':')[0]`.

### The grid: a pure window over a DOM-owned offset

The root cause of problem 3 is two sources of truth for the scroll offset. `scroller.scrollTop` is the real one, and the browser changes it without telling Vue (clamping when content shrinks). `top` is a cached copy. The `items.length` watcher patches one trigger and misses the rest: a width change that alters `cols`, the loading-skeleton swap, or any layout change.

The fix is to store no copy.

- `scrollTop`, `clientWidth` and `clientHeight` are read from the element inside one computed. A `tick` counter, bumped by the scroll event and the ResizeObserver, is only an invalidation signal and holds no value.
- `computeGrid(count, viewport)` clamps the offset to `[0, maxScroll]`. That is exactly what the browser does to the real offset when the content shrinks, so the prediction equals reality even before any scroll event arrives.
- Programmatic movement goes through one function, `scrollTo(y)`, which assigns `el.scrollTop` and bumps `tick`. It stores nothing.
- The `watch(items.length)` is deleted.
- The rAF throttle is deleted too. Browsers already coalesce `scroll` events to one per frame. `firstRow` and `lastRow` stay separate computeds, so a scroll event that does not cross a row boundary does not re-render.

```ts
// EpisodeGrid.vue gridMath.ts: pure, no Vue, no DOM
export const CARD_H = 184, GAP = 10, MIN_W = 210, OVERSCAN = 2, PAD = 12
export interface Viewport { scrollTop: number; width: number; height: number }
export interface GridWindow {
	cols: number; rowH: number; rows: number; totalH: number; maxScroll: number
	scrollTop: number                    // clamped
	firstRow: number; lastRow: number    // rows [firstRow, lastRow); item slice = [firstRow*cols, lastRow*cols)
}
export function computeGrid(count: number, vp: Viewport): GridWindow {
	// not implemented
	// cols      = max(1, floor((width - 2*PAD + GAP) / (MIN_W + GAP)))
	// rowH      = CARD_H + GAP ; rows = ceil(count / cols) ; totalH = rows*rowH - GAP + 2*PAD
	// maxScroll = count === 0 ? 0 : max(0, totalH - height)
	// top       = clamp(vp.scrollTop, 0, maxScroll)
	// firstRow  = max(0, floor((top - PAD)/rowH) - OVERSCAN)
	// lastRow   = min(rows, ceil((top + height - PAD)/rowH) + OVERSCAN)
}
export function focusTarget(key: string, index: number, count: number, g: GridWindow, height: number): number | null
//   Arrow/Home/End/PageUp/PageDown -> clamped index; any other key -> null. PageDown step = cols * max(1, floor(height/rowH)).
export function revealOffset(index: number, g: GridWindow, height: number): number | null
//   y0 = PAD + floor(index/cols)*rowH
//   y0 < top -> y0 - PAD ; y0 + CARD_H > top + height -> y0 + CARD_H - height + PAD ; else null (no scroll)
```

```vue
<script setup lang="ts">
// EpisodeGrid.vue (~110 lines script+template)
const props = defineProps<{ items: readonly EpisodeSummary[]; selected: ReadonlySet<string>; loading: boolean; resetToken: number }>()
const emit = defineEmits<{ toggle: [index: number, extend: boolean]; open: [id: string] }>()

const scroller = ref<HTMLElement | null>(null)
const tick = ref(0)                                           // invalidation only; holds no scroll value
const viewport = computed<Viewport>(() => {
	void tick.value
	const el = scroller.value
	return el ? { scrollTop: el.scrollTop, width: el.clientWidth, height: el.clientHeight } : { scrollTop: 0, width: 1000, height: 600 }
})
const count = computed(() => (props.loading ? 0 : props.items.length))   // the skeleton replaces the spacer, so the browser clamps to 0
const grid = computed(() => computeGrid(count.value, viewport.value))
const firstRow = computed(() => grid.value.firstRow)                       // primitive selectors keep re-render at row granularity
const lastRow = computed(() => grid.value.lastRow)
const windowItems = computed(() => { /* slice(firstRow*cols, lastRow*cols).map((e,i) => ({ e, index: start+i })) */ })

function scrollTo(y: number) { /* el.scrollTop = y; tick.value++ : the only writer */ }
watch(() => props.resetToken, () => { scrollTo(0); activeIndex.value = 0 })    // replaces defineExpose({ scrollToTop })
// onMounted: ResizeObserver(() => tick.value++) ; onBeforeUnmount: disconnect
// onKey: const next = focusTarget(...); if (next !== null) { preventDefault; focusIndex(next) }
// focusIndex: activeIndex = i; const y = revealOffset(i, grid.value, viewport.value.height); if (y !== null) scrollTo(y); await nextTick(); focus [data-index]
</script>
```

### Problem 1 and 2, how they disappear

- **Problem 1.** `FilterRail` takes one readonly prop and emits five intent events, and it has no write path to parent state. `Filters` is immutable, and toggles replace the Set (`toggled(set, v)` copies, so Set insertion order and the URL order are preserved). `HistData` and `TaskRow` live in `model/types.ts`, and nothing imports from an SFC.
- **Problem 2.** The view's script is about 14 lines and its template reads as composition. The logic splits by the knowledge each piece owns:
  - the model owns state and the single writer;
  - `derive` owns statistics;
  - `query` owns URL keys;
  - `core` owns selection algebra;
  - `bulk` owns the plan and the pool.
- **Escape** is 3 lines in the view. The DOM guard (`inTextEntry`) is a DOM concern, and the model exposes only `clearSelection`.

### Interface depth

`useOverview()` hides load and retry, URL decode and encode, 20-bin histograms, status and task facets, sort, the selection invariant, anchor ranges, optimistic bulk with a six-worker pool and per-id conditional rollback, and render-grouped URL writes. It exposes a snapshot of 12 fields and 12 verbs. A caller never coordinates two calls to finish one operation. `applyStatus` is one call.

`computeGrid` hides clamping and row math behind one function of `(count, viewport)`, and the grid's template only slices.

### Red-flag screen

| Flag | Verdict |
|---|---|
| Shallow module | `model/index.ts` exposes only `useOverview` and types. `derive`, `core`, `bulk`, `query` are pure internals with 4 to 6 functions each, behind the model. `gridMath` is internal to the grid. Not shallow. |
| Split ownership | `Core` has one writer, `commit`. The scroll offset has one owner, the DOM, with no copy. `Filters` is no longer mutated by a child. |
| Hand-synced list | `SORTS` drives the type, the options and the URL validation. `METRICS` and `STATUSES` already drive the facets, the encode, the decode and the rail. `Headline` is used by both the model and `KpiHeader` via `defineProps<Headline>()`, so the prop list is no longer hand-listed in two places. |
| Importable internals | Rule: outside `components/overview/model/`, import only `model/index.ts`. Enforced by a `grep` guard (see Next step). Unit tests may import internals. |
| Temporal decomposition | No load, validate, transform, save stages. Files are split by knowledge (URL, stats, selection algebra, bulk), not by phase. |
| Pass-through | The view has no methods that forward arguments. Template event bindings reference actions directly. `useWindowKey` adds policy-free but generic cleanup, so it is a utility rather than a layer. `ports` adapts router and api to domain types (adaptation, not forwarding). |
| Two ways to do one task | `v-model` on `filters.*`, `Object.assign(filters, ...)`, `filters.status.add` and `grid.scrollToTop()` are all deleted. |

## Silent-behavior risks and how the sketch holds them

1. **Escape with an empty selection.** The original returns before touching `lastIndex`, so click A, click A (deselect), Escape, then Shift-click D still ranges from A. The model's `clearSelection` returns the same `Core` object when the selection is empty, so the anchor is kept. A unit test pins this. The other path, bulk with no targets, did reset the anchor, and it still does.
2. **IME composition in the search box.** Replacing `v-model` with `:value` plus `@input` would filter mid-composition, which breaks Vietnamese Telex input. `OverviewToolbar` keeps `<input v-model="q">`, where `q` is a `computed({get: props.query, set: emit('query')})`. Vue's v-model composition guard is preserved. Same for the select.
3. **Selection pruning timing.** The old prune ran in a watcher after the view recomputed. `commit` does it synchronously, as an invariant. One deliberate tightening: the old final `selected = failedIds` was not pruned, so a failed id hidden by a filter change made during the bulk stayed selected but invisible. The new code narrows it. (Open question 1.)
4. **Scroll reset ordering.** The old watch called `scrollToTop` in the parent's pre-flush, before render. The grid's `resetToken` watcher runs in the grid's pre-flush after props update and before the grid renders, so the first painted frame is the same. The e2e brush check covers it.
5. **Anchor staleness.** `anchor` stays a view *index*, as before, for identical semantics. The one change is a bounds clamp so a stale index cannot throw `undefined.id`, which the old code did. (Open question 2.)
6. **Query write batching and initial read.** Kept: `watch([filters, sort])` is non-immediate and batched. `decodeQuery` runs once, at model creation. Back/forward within `/overview` is still ignored, as before.
7. **Load kick-off.** The model starts `reload()` at creation instead of in `onMounted`. The request fires a few milliseconds earlier. `loading` is initially true in both. Pure model tests need no mount.
8. **Card toggle emit.** `EpisodeCard` and the grid emit `(index, extend: boolean)` instead of `(index, MouseEvent|KeyboardEvent)`. Space or Enter with Shift still extends, because `ev.shiftKey` is read at the card.
9. **Scroll rAF removal.** The `scroll` event is already once per frame. `firstRow` and `lastRow` are stable-valued computeds, so render frequency matches the old code. Reading `el.scrollTop` inside a computed can force layout, but only on a scroll, a resize or an items change, which are the same triggers as before.
10. **Negative `scrollTop` (Safari rubber-band).** It is now clamped to 0. `lastRow` differs by at most one overscanned row, with no visible effect.
11. **Error ids containing `:`.** The old code split on `:` and mis-selected them. The new code uses structured failures.
12. **CSS scoping.** Moving the toolbar into its own SFC changes where the `input/select/button` rules apply, because scoped styles don't reach non-root children. `OverviewToolbar` carries its own copies. The view keeps only `.state` and the layout. Compare screenshots before and after (the e2e already writes `overview-brushed.png`).
13. **Domain `Math.max(...vals)`.** Rewritten as a loop for large N, with identical results. Golden-tested.

## Module map

| File | Lines (approx.) | Role |
|---|---|---|
| `web/src/views/OverviewView.vue` | ~90 (was 325) | Composition: `useOverview`, window Escape key, open-navigation, and the layout CSS |
| `web/src/components/overview/model/index.ts` | 8 | Public surface: `useOverview` and types only |
| `.../model/useOverview.ts` | ~150 | The owner. `Core` ref, `commit`, selectors, derived computeds, load, bulk orchestration, the URL watch, and `defaultPorts()` |
| `.../model/types.ts` | ~90 | `Core`, `RailView`, `Headline`, `OverviewState`, `OverviewActions`, `OverviewPorts`, `SORTS`, `HistData`, `TaskRow` |
| `.../model/derive.ts` | ~110 | Pure statistics, `selectView` (memoLast), `headline` |
| `.../model/core.ts` | ~70 | Pure `Core` transitions: select, anchor range, clear, `patchStatus` |
| `.../model/bulk.ts` | ~40 | `planBulk`, `forEachLimited` |
| `.../model/query.ts` | ~50 | `decodeQuery` and `encodeQuery` (the only owner of the URL param names) |
| `web/src/components/overview/filters.ts` | ~95 (was 80) | Existing metric and status tables and `passes`, `median`, `parseRange`, `serializeRange`. `Filters` becomes readonly, and `toggled()` is added. `emptyFilters` is kept |
| `.../FilterRail.vue` | ~125 script+template (was 108) | One `rail` prop and 5 emits. No type exports |
| `.../OverviewToolbar.vue` | ~75 | Search, sort, direction and reset. Its own control CSS |
| `.../EpisodeGrid.vue` | ~110 (was 116) | Viewport-metrics computed, `computeGrid`, keyboard via `focusTarget`, no `top` ref, no rAF, no expose |
| `.../gridMath.ts` | ~70 | Constants, `computeGrid`, `focusTarget`, `revealOffset` |
| `.../EpisodeCard.vue` | +2 lines | Emits `extend: boolean` |
| `.../KpiHeader.vue` | -12 lines | `defineProps<Headline>()` |
| `.../HistogramBrush.vue`, `BulkBar.vue` | 0 | Unchanged |
| `web/src/composables/useWindowKey.ts` | ~15 | `useWindowKey(type, handler)` with auto-cleanup, and `inTextEntry(target)` |
| `web/e2e/units.mjs` | ~150 | `node --test` unit suite for the pure modules |
| `web/e2e/drive.mjs` | +2 checks | Existing checks unchanged |

Call chain: view, then `model/useOverview`, then one pure file. At most three files.

## Test plan

**Existing e2e (`drive.mjs`), unchanged, must pass.** Coverage by feature:

- cards render
- click and Shift-click, with the bar and `aria-pressed`
- Curate persisted
- Escape clears
- failed PATCH shows the alert, rolls back, and leaves the server unchanged
- histogram drag writes `dur=` and reduces `N / 60`
- Open navigates
- no console errors

**Added e2e, two checks.**

- Scroll `.scroller` to its bottom, then brush the Duration histogram. Assert `article.card[data-index="0"]` exists, so a stale window would fail. Also assert that no blank gap renders.
- Press Escape while the search input is focused with a selection. Assert the bulk bar is still present.

**Pure unit tests** (`web/e2e/units.mjs`, run with `node --test --experimental-strip-types`; no new dependency, and the pure files import no Vue):

- `gridMath`, differential. For random `(count, width, height, scrollTop ≤ maxScroll)`, `computeGrid` equals the old inline formulas (copied into the test as an oracle). For `scrollTop > maxScroll` it equals `maxScroll`. This is the regression test for problem 3. Also cover `focusTarget` for every key and edge, and `revealOffset` for above, below and inside.
- `query`. Round trip, including `hi=max`, an invalid sort, an unknown status, and key order. Check that `q` is trimmed and that `dir=desc` only appears when descending.
- `derive`. Golden domains (including empty, trk fixed at 0..100, and hi ≤ lo bumped by 5), bin edge clamping, and `passes` with the skip key. Check that a status filter does not change `statusCounts` for its own facet.
- `core`/`bulk`:
  - Shift-range with and without an anchor.
  - The anchor is not moved by a Shift-click.
  - `clearSelection` on an empty selection returns the same object.
  - `patchStatus` with `onlyIf` is a no-op if the status has changed.
  - `forEachLimited` never exceeds 6 in flight and visits each item once.
- The `useOverview` model with fake ports (Vue reactivity runs under node):
  - Two same-tick filter commands produce one `writeQuery`.
  - `viewRev` bumps on a filter or sort change, but not on selection or bulk.
  - Bulk with 1 failure out of 3 gives a rollback only for the failed id, an error string, and a selection equal to `{failed}`.
  - Narrowing: with the status filter set, an optimistic patch that hides items removes them from the selection.

## Tradeoffs accepted

- We accept one large owner file (`useOverview.ts`, about 150 lines) in exchange for a single writer and a pure core. The pure leaves keep it small.
- We accept that `OverviewState` is a wide snapshot (12 fields) in exchange for children needing no model knowledge. A narrower per-child type would hand-sync lists.
- We accept the grid reading `scrollTop` from the DOM inside a computed, instead of caching it, in exchange for the stale window being impossible by construction. The cost is a possible forced layout on scroll, resize and items changes.
- We accept `FilterRail` having five emits instead of one `v-model`-like prop. Each is an intent the model names.
- We accept the `resetToken` prop where an exposed `scrollToTop()` might look more direct. A declarative reset removes the template ref and `defineExpose` and makes the reset ownership live in the grid.
- We accept `Core` as one ref with narrow `computed` selectors rather than separate refs, in exchange for atomic transitions. This is not an oversight: the selectors exist so that selection changes don't recompute histograms.
- We accept a tiny duplication of control CSS in `OverviewToolbar`, because scoped styles would otherwise leak differently. This could look like an oversight.

## Alternatives considered

1. **Per-concern composables over shared reactive state** (`useFilters`, `useSelection`, `useBulk`, `useUrlSync`). Rejected. Each is a shallow wrapper over the same objects. Selection pruning needs to know the view, and bulk needs both the episodes and the selection, so ownership splits and the call graph becomes view → 5 composables → one another. The caller still coordinates (`readQuery` then `watch`, then `scrollToTop`).
2. **A module-singleton store, Pinia-style.** Rejected. It is not allowed (no dependency), and a hand-rolled singleton outlives the route and is harder to fake in tests. Passing `ports` is the explicit seam.
3. **Grid keeps a `top` ref and adds clamp-on-change watchers** (`watch(count)`, `watch(cols)`, `watch(loading)`). Rejected. Every new layout trigger needs another patch, and each patch is hand-synced with the clamp. Deriving the clamp covers all triggers.
4. **Grid derives the offset from Vue state, with the DOM as a sink.** Rejected. Wheel and touch scrolling originate in the DOM, so Vue state would still need to read it and then write it back, which brings the second copy back and invites jitter loops. DOM-as-owner plus pure window is the minimal shape.
5. **Drop the virtual window** (CSS `content-visibility`). Rejected for this scope. It changes focus and `data-index` behavior and the DOM count the e2e probes.

## Open questions and risks

1. Should a failed id hidden by a mid-bulk filter change stay selected-but-invisible (old behavior) or be dropped (new invariant)? The sketch drops it.
2. Should the Shift-range anchor become an episode id instead of a view index? It would survive re-sorts, but it changes behavior, so the sketch keeps the index.
3. Does `tsconfig` allow `.ts` extension imports (`allowImportingTsExtensions`) and which Node version runs CI? `node --test --experimental-strip-types` needs both. If not, is a one-file esbuild step via the existing Vite acceptable for tests?
4. Does the importable-internals rule need ESLint? The repo has none. A 10-line grep guard in `npm run build` seems enough. Do you want it?
5. Is starting `reload()` at model creation instead of `onMounted` acceptable if some other consumer later mounts the view twice (keep-alive)?
6. Should the control CSS (`input/select/button`) become one shared stylesheet to remove the toolbar copy? That would need an audit of scoped-style precedence in `BulkBar`.

## Next implementation step

Write `gridMath.ts` and `derive.ts` with their differential unit tests against the current inline formulas first (they are pure and pin behavior), then move `EpisodeGrid` onto `computeGrid` and delete `top`.
