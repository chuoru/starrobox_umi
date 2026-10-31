# Candidate A: immutable lens, one projection, single-writer owners

Glossary used throughout. A **lens** is everything the user chose about which episodes to see and in what order. It is exactly what the URL encodes: the three ranges, status, task, q, sort and dir. A **facet** is a lens field that narrows the list. sort and dir only order it.

## Problem

The Overview screen is a client-side faceted browser over the episode list. Three defects share one cause: no piece of state has a single owner.

1. **FilterRail mutates parent state.** It receives the parent's `reactive` filters and mutates them through the prop. It also exports `HistData` and `TaskRow` from the SFC, although OverviewView produces those values.
2. **OverviewView owns everything.** It is the only file that knows the URL format, the filter fields, the derived data, the selection rules and the bulk protocol. Several of those are hand-synced lists. Adding a filter means editing `Filters`, `emptyFilters`, `isFiltered`, `passes`, `readQuery`, `writeQuery`, the 8-source `watch` and FilterRail. Adding a sort means editing `SortKey`, `SORTS` and the `get` record inside `view`. The histogram domain policy is hidden in `m.key === 'trk'` and `m.key === 'dur'` branches.
3. **EpisodeGrid keeps a second copy of the scroll offset.** `top` is a copy of `scroller.scrollTop`, and four code paths write it: the rAF scroll handler, `scrollToTop` (a literal 0), `ensureVisible` (a read-back) and the `items.length` watch. The browser can also move the real value without any of them running: it clamps `scrollTop` when the content gets shorter, either because the list shrank or because a width change altered `cols`.

    The `items.length` patch is a default (`pre`) watcher on a prop. Vue runs it in `updateComponentPreRender`, before the spacer's height is patched. So it re-reads the old, unclamped offset and in practice does nothing. Whatever correction users see comes from the later `scroll` event.

**Constraints the design must honor:**
- `api/client.ts` is frozen.
- Vue and vue-router only.
- URL params dur, trk and wid are spelled `lo_hi`, with `max` allowed for hi. The others are status, task, q, sort and dir. Defaults are omitted, the key order is fixed, and the query is parsed once at setup and rewritten with `router.replace` on every change.
- The DOM contracts `drive.mjs` reads: `N / 60`, `article.card[aria-pressed]`, the `Bulk actions` toolbar with Curate, Exclude and Reset, `role=alert`, the `Duration…` histogram group, Escape, click and Shift-click, and the Open link.
- The grid's row math: CARD_H 184, GAP 10, MIN_W 210, OVERSCAN 2, PAD 12.

## Usage (caller's view)

### `views/OverviewView.vue` after the change

The view creates four owners, makes one pure call, and the template composes them. It has no section banners, no watchers and no router.

```vue
<script setup lang="ts">
import { computed } from 'vue'
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

const { episodes, loading, error, reload, setStatus } = useEpisodes()
const lens = useUrlLens()
const shown = computed(() => project(episodes.value, lens.value))
const { selected, busy, errors, toggleAt, clearSelection, applyStatus, dismissErrors } = useBulkSelection(() => shown.value.view, setStatus)
const blocked = computed(() => loading.value || !!error.value)
</script>

<template>
	<div class="ov">
		<KpiHeader v-bind="shown.kpi" :loading="blocked" :synthetic="shown.synthetic" />
		<div class="body">
			<FilterRail v-model:lens="lens" :facets="shown.facets" />
			<section class="main">
				<LensBar v-model:lens="lens" :disabled="blocked" />
				<BulkBar :count="selected.size" :busy :errors @apply="applyStatus" @clear="clearSelection" @dismiss-errors="dismissErrors" />
				<div v-if="error" class="state" role="alert">
					<h2>Could not load episodes</h2>
					<p>{{ error }}</p>
					<button type="button" @click="reload">Try again</button>
				</div>
				<EpisodeGrid v-else :items="shown.view" :selected :loading :reset-key="lens" @toggle="toggleAt">
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
```

### FilterRail and LensBar: controlled by an immutable value

```ts
// FilterRail.vue: the whole public surface
const lens = defineModel<Lens>('lens', { required: true }) // emits update:lens with a NEW Lens
defineProps<{ facets: Facets }>() // status counts, histograms (or null), task rows; produced by project()

// A status chip:
//   @click="lens = toggle(lens, 'status', key)"
// A histogram:
//   :model-value="lens[key]" @update:model-value="lens = update(lens, key, $event)"
// lens.status.add(s)   <- compile error: ReadonlySet has no add
```

```ts
// LensBar.vue: search, sort, direction, reset, hint
const lens = defineModel<Lens>('lens', { required: true })
defineProps<{ disabled: boolean }>()
```

### Pure call sites (unit tests, and anyone else who needs the URL)

```ts
import { readLens, writeLens, toggle, update } from './lens.ts'
import { project } from './projection.ts'
import { layoutGrid } from './virtualGrid.ts'

const lens = toggle(readLens({ dur: '10_max', sort: 'trk' }), 'status', 'curated')
writeLens(lens) // { dur: '10_max', status: 'curated', sort: 'trk' }   key order fixed
update(lens, 'q', lens.q) === lens // true: a no-op change keeps the identity
project(episodes, lens).facets.hists?.dur.match // leave-one-out counts for the brush
layoutGrid(60, { top: 99999, width: 1210, height: 600 }).end > 0 // a stale offset still renders the last rows
```

## Shape

### Data structures

- **`Lens`** is a deeply readonly plain value, held in one `shallowRef`. Its field names are the URL param names. Ranges are `readonly [lo, hi]` and half-open; `hi === Infinity` is spelled `max`. The two set facets are `ReadonlySet`s whose insertion order is the URL order. `q` holds the raw typed text. Every change produces a new Lens, so "did the lens change" is an identity check.
- **`PARAMS`** is a private table with one entry per Lens field: `{ empty, decode, encode }`, plus `test` for facets. Its type is `{ [K in keyof Lens]: Param<Lens[K]> }`, so a field without a codec, or a codec without a field, fails the build. The range entries are generated from `METRICS`. `readLens`, `writeLens`, `hasFilters`, `clearFilters` and `matches` all iterate this one table.
- **`Projection`** is `{ view, facets, kpi, synthetic }`, returned by one pure `project(episodes, lens)`. `facets` bundles the three things the rail draws: status counts, histograms (or null) and task rows.
- **`Viewport`** is `{ top, width, height }`, a measurement of the scroller. `layoutGrid(count, viewport)` turns it into a **`GridWindow`** `{ cols, totalH, start, end, offsetY, pageRows }`. Both are pure, and the layout is a total function.
- **Owners**, one writer each:
  - `useEpisodes` owns `episodes`, `loading` and `error`.
  - The `useUrlLens` ref owns `lens`.
  - `useBulkSelection` owns `selected`, the anchor, `busy` and `errors`.
  - `EpisodeGrid.measure()` owns `viewport`.

### Flow

```
GET /api/episodes ─► useEpisodes.episodes ───────────┐
route.query ─readLens (once)─► lens ─────────────────┼─► project() ─┬─► view ──► EpisodeGrid, useBulkSelection (indices, prune)
                     ▲   └─watch─► writeLens ─► router.replace       ├─► facets ► FilterRail ─► HistogramBrush
                     │                                               └─► kpi ───► KpiHeader
FilterRail / LensBar / empty state ── update:lens (new Lens from lens.ts) ──┘
BulkBar ─apply─► useBulkSelection.applyStatus ─► useEpisodes.setStatus (optimistic, 6 in flight, per-id rollback) ─► episodes
lens identity ─► EpisodeGrid :reset-key ─► scroll to 0, first card active
```

### Load-bearing decisions

1. **Children cannot mutate the filter state; the types make it impossible.** FilterRail and LensBar get a readonly Lens and emit a new one. The only producers of a new Lens are `update`, `toggle` and `clearFilters`. (encode-lessons-in-structure)
2. **The URL format exists only in `PARAMS`.** Query strings are parsed into domain types at `readLens`, and nothing else ever sees a query string. The type, the parser and the serializer cannot drift: the compiler checks the table against `Lens`, and each entry holds its own decode and encode. (boundary-discipline; single source of truth)
3. **Transitions are idempotent.** If a value is `Object.is`-equal to the current one, the same Lens comes back. This mirrors Vue's `hasChanged`, which the old reactive mutations relied on. A no-op therefore never rewrites the URL or rewinds the grid, and the old 8-source watch list becomes `watch(lens)`. (make-operations-idempotent; derive instead of sync)
4. **All derived data is one pure function.** `project(episodes, lens)` holds the domains, the 20 bins, leave-one-out counts, task rows, filter and sort, KPIs and the synthetic flag. The view only holds `computed(() => project(...))`. (business logic as pure functions)
5. **Each piece of state has one writer.** `episodes` is written only inside `useEpisodes`: by load, by the optimistic patch and by the rollback. The bulk flow asks the store; it never patches the array itself. Selection narrowing after a bulk run happens in `useBulkSelection`, the selection's owner. (split-ownership flag; separate-before-serializing-shared-state)
6. **Each policy sits with the state it governs:**
   - The URL mirror lives in `useUrlLens`.
   - "A new lens starts at the top" is declared on the grid with `:reset-key="lens"`, instead of an imperative `grid.value?.scrollToTop()` inside the URL watcher.
   - Escape handling and pruning live with the selection.
   - The O key navigates from the card that already renders the Open link. This removes the card → grid → view `open` pass-through and the second copy of the `/episode/<id>` path.
7. **The grid holds a measurement, not a copy.** `viewport` is written only by `measure()`, which reads `scrollTop`, `clientWidth` and `clientHeight` together from the DOM.
   - `measure()` runs on every browser input that can move `scrollTop`: the scroll event, the scroller's box and the content (spacer) box. One ResizeObserver watches both boxes.
   - It also runs after every programmatic scroll, through the single `scrollTo(y)`.
   - Separately, `layoutGrid` clamps the offset to `totalH - height`, which is exactly the clamp the browser will apply. So the render that runs before layout is already right, and the rendered window can never extend past the spacer.

### Interface depth

| Module | Public surface | Hides |
|---|---|---|
| `lens.ts` | 3 vocabulary tables, `Lens` and 5 small types, 7 functions | 8-param URL grammar, tolerant parsing, default omission, key order, 2-decimal rounding, `max`, half-open and NaN-tolerant ranges, trimmed case-insensitive search, set order, leave-one-out, idempotency |
| `projection.ts` | `project` and its output types | domain policy per scale, binning, counting, collation, tie-breaks, KPI math |
| `virtualGrid.ts` | `layoutGrid`, `revealTop`, `navTarget`, 3 constants | row math, clamp, reveal policy, key-to-index map, page size |
| `useEpisodes.ts` | 3 readonly refs, `reload`, `setStatus` | fetch and error text, optimistic patch, 6-worker pool, rollback-only-if-still-ours |
| `useBulkSelection.ts` | 3 readonly refs, 4 functions | index anchor, Shift-range, Escape listener and its input/select guard, pruning to the view, no-op detection, narrowing to failures |
| `useUrlLens.ts` | one `Ref<Lens>` | router, codec, parse-once, write-on-change |

Every surface is no larger than its callers need. BulkBar and KpiHeader are unchanged. FilterRail goes from 4 props to 1 model plus 1 prop. EpisodeGrid loses its `open` emit and its exposed method.

### What the design deliberately does not do

- It does not read the URL back after setup, as before.
- It does not stop `{ ...lens, q }` from compiling (see tradeoffs).
- It does not validate that `lo < hi`, as before.
- It does not cancel an in-flight bulk run.
- It does not move the selection anchor from an index to an id.

## How the three problems disappear

1. **FilterRail.** There is nothing mutable to reach: `lens` is readonly, so `status.add` does not compile, and the only output is `update:lens`. `Histogram` and `TaskRow` move to `projection.ts`, the module that creates them. FilterRail imports types from a `.ts` file, and OverviewView imports none from an SFC.
2. **OverviewView.** The script is 5 statements:
   - URL read and write is `useUrlLens`.
   - Filter and sort state is one Lens.
   - Derived data is `project`.
   - Selection, Shift-range, Escape, pruning and the bulk flow are `useBulkSelection` plus `useEpisodes.setStatus`.
   - The toolbar is `LensBar`.
   - Scroll reset is a prop.

   No banners are needed because each concern is one line that names its owner. Most hand-synced lists collapse into the facet table (`PARAMS`) plus `METRICS`, `STATUSES` and `SORTS`. `STATUSES` is now a `Record<Status, …>`, so a new API status fails the build until it has a label and a color.
3. **EpisodeGrid.** There is one source of truth for the offset, the DOM, and one function that reads it. Nothing writes an intended value into the copy. `scrollTo` writes the DOM and then measures, and the `items.length` watch is deleted. The refresh set is now complete: scroll, viewport box and content box. The old code missed width-driven row changes entirely, and its patch read the DOM before the DOM changed. The clamp makes the pure layout correct even with an offset that is out of range for one frame.

## Behavior that could silently change

| Risk | How the sketch keeps it identical |
|---|---|
| URL string: key order, rounding, `max`, defaults | `PARAMS` key order is METRICS (dur, trk, wid), then status, task, q, sort, dir, the same order as `writeQuery`. The codecs reuse the old `num`, `parseRange`, `trim`, `dir === 'desc'` and `sort !== 'id'` logic verbatim. Pinned by golden tests. |
| Tolerant parsing quirks | `'5_'` still parses as `[5, 0]`. Arrays and null become defaults through `one()`. `dir` is asc unless exactly `'desc'`. Status uses `Object.hasOwn`, not `in`, so `status=constructor` is still rejected, as with the old `STATUSES.some`. |
| When the URL is rewritten and the grid rewinds | The old watch fired exactly when a filter or sort value changed under Vue's `hasChanged`. `update` uses `Object.is`, and a set clear on an empty set returns the same Lens, like reactive `Set.clear`. Typing a trailing space still changes raw `q`, so it still triggers a duplicate replace and a rewind, as before. The watch is not immediate, so loading never rewrites the URL. |
| Brush feedback during a drag | The lens keeps the brush's exact edges in memory; only the URL is rounded. That is why the URL is a mirror and not the state. |
| IME composition in search | `LensBar` keeps `v-model` on a writable computed. A `:value`/`@input` pair would commit text mid-composition. |
| NaN metrics pass range filters | The range test keeps the negated form `!(v < lo \|\| v >= hi)`. |
| Rewind timing | The child's pre-flush prop watcher runs in `updateComponentPreRender`, before the grid renders the new items. That is the same frame and order as the old parent watcher (URL write first, then rewind). `activeIndex` still resets to 0. |
| Rewind on bulk updates | Bulk updates must not rewind. `reset-key` is the lens, not the view, so a status change that drops cards does not rewind, as before. |
| Prune and selection timing | The prune watch observes `shown.value.view`. It has the same dependencies as the old `view` computed (episodes, filters, sort), so it fires on the same changes. |
| Bulk sequence | Unchanged: clear errors, early `clearSelection()` when nothing differs (anchor reset), otherwise optimistic patch, 6 workers in selection order, rollback only if the status is still the optimistic one, then `busy=false`, then errors as `` `${id}: ${message}` ``, then selection set to the failed ids (anchor kept). The optimistic patch and `busy=true` happen synchronously, as before. |
| Facets recompute on sort | Sorting now also recomputes facets. Values are identical, so no transitions fire. |
| Measuring on resize | The ResizeObserver callback now also refreshes `top`. Before, it set only width and height. The extra value is the true DOM value, so only previously stale states differ. |
| Status chip order and sort option order | Record insertion order equals the old array order. |
| Scoped CSS | The toolbar's input, select and button rules move into `LensBar`, because a parent's scoped styles do not reach a child's inner elements. OverviewView keeps the button rule for the state buttons in the error and empty states. |

## Test plan

- **Gate 1: `npm run build`** (`vue-tsc`). It enforces the `PARAMS` and `Lens` agreement, `STATUSES` exhaustiveness, and the readonly Lens (any leftover `filters.status.add` fails).
- **Gate 2: `npm run e2e`** (`drive.mjs` unchanged). It covers:
  - cards render;
  - click and Shift-click select, and the bulk bar appears;
  - bulk Curate persists through the API;
  - Escape clears the selection;
  - an aborted PATCH shows the `role=alert` banner, leaves the server status unchanged and rolls the card back;
  - a histogram drag writes `dur=` and reduces `N / 60`;
  - the Open link navigates;
  - no console errors.
- **Gate 3: unit tests with no new dependency.** Use Node's built-in runner, `node --test "src/**/*.test.ts"`. Node 22.23 strips TypeScript types. The pure modules use only `import type` for client types and `.ts` extensions between themselves, which needs `allowImportingTsExtensions: true` (valid because `noEmit` is set). Cases:
  - `lens.test.ts`:
    - Golden strings for read→write: the full example in the Usage section, plus `1.234567_2` → `1.23_2`, `10_max`, bogus status values dropped with order kept, `sort=bogus` → id, `dir=asc` omitted, arrays → defaults, `'5_'` → `[5,0]`, `'_5'` and `'5'` → null.
    - `writeLens(readLens(writeLens(l)))` is a fixed point.
    - `update` with an equal value returns `===` the input.
    - `toggle` keeps insertion order.
    - `clearFilters` keeps sort and dir, and `clearFilters(l,'status')` on an empty set returns `===`.
    - `hasFilters` is false for whitespace-only q.
    - `matches`: half-open bounds, an `Infinity` hi, a NaN metric passing, case-insensitive search over all six fields, and `except`.
  - `projection.test.ts`:
    - Domains for each scale, including the empty list and the `hi <= lo` bump.
    - `v === hi` lands in bin 19.
    - Leave-one-out status, task and histogram counts.
    - Task rows ordered by total, then name.
    - Numeric id collation (`syn_2 < syn_10`), with the tie-break flipping under desc.
    - KPIs, including a null median; `hists` is null on an empty list.
  - `virtualGrid.test.ts`:
    - The old formulas, copied into the test as an oracle, match `layoutGrid` for every `top` in `[0, maxTop]` across a grid of widths, heights and counts.
    - For `top > maxTop`, the window is non-empty and ends at the last row.
    - `revealTop` above, below and inside the viewport.
    - `navTarget` for each of the 8 keys, with clamping and with unknown keys returning null.
  - **One-time parity test (refactor commit only):** run the old `passes`, `parseRange` and `serializeRange` against the new `matches` and codecs over a generated grid of episodes and lenses, then delete it together with `filters.ts`.
- **Optional e2e step** for the stale-window case:
  1. Filter `status=slam_ok`.
  2. Scroll the grid to the bottom.
  3. Select the last cards and Curate.
  4. Assert `article.card` count > 0 straight away.

  This is the scenario the old patch targeted, and no lens change happens in it.

## Tradeoffs accepted

- We accept that facet counts recompute on a sort change in exchange for one pure `project()` with one test surface. At this list size the cost is negligible.
- We accept that `{ ...lens, q }` compiles, because Lens is plain readonly data, in exchange for Lens working with Vue props, `shallowRef`, the codec and tests without ceremony. The worst misuse is a spread that skips idempotency, which costs one duplicate `router.replace` and a rewind.
- We accept `.ts` extensions inside the pure-module graph and one tsconfig flag in exchange for unit tests with no new dependency.
- We accept duplicated input, select and button CSS in `LensBar` and OverviewView in exchange for a view template that only composes.
- We accept a second ResizeObserver target (the spacer) in exchange for not depending on whether the browser fires `scroll` when it clamps. The clamp in `layoutGrid` is not a second mechanism for the same thing. It makes the pure layout total; the observer keeps the measurement true.
- We accept that the selection anchor stays an index into `view` and is not reset by pruning or narrowing, because that is the current Shift-range behavior. An id anchor would survive re-sorting, but that would be a behavior change.
- We accept that the lens is read from the URL once. Clicking the "Overview" nav link while on `/overview?dur=…` still leaves the filters in place until the next change, as before.

## Alternatives considered

- **The URL as the only state.** `lens = computed(() => readLens(route.query))`, with every intent calling `router.replace`. This is the strongest single source of truth, but it loses:
  - Route updates are asynchronous, so `HistogramBrush.up()` reads a stale `sel`.
  - Every drag step would round edges to 2 decimals and feed them back.
  - Typed trailing spaces would be trimmed out of the search box.
  - It breaks "parsed once".

  It hides the codec but exposes navigation timing to every caller.
- **A mutable reactive `FilterModel` with intent methods,** handed to children as `readonly()`. This is viable. Children can't mutate it, and `watch(model, { deep: true })` removes the hand-synced list. It loses on depth: about 9 methods instead of 3 functions, no before/after snapshot, so idempotency is left to Vue's internals, and tests need the reactivity runtime. Identity-as-change, which the grid's `reset-key` relies on, does not exist.
- **One composable per concern** (`useFilters`, `useSort`, `useQuerySync`, `useFacets`, `useSelection`, `useBulkStatus`, `useEscapeKey`). Each would be shallow. The query format would be split across three of them (hand-synced). Bulk would write an `episodes` ref owned elsewhere (split ownership). Callers would still coordinate the scroll reset.
- **An opaque Lens class with a `#brand` field,** so that spreading it doesn't compile. This would make the transitions the only constructors. Rejected because it adds getters and constructor ceremony, risks private-field access through Vue proxies, and only buys idempotency enforcement.
- **For the grid: keep `top` and move the patch to `watch(totalH, …, { flush: 'post' })`.** This fixes the symptom but keeps four writers and a proxy for "the content changed". **IntersectionObserver sentinels or `content-visibility`** would change the row math, which must stay exact.

## Open questions and risks

- The brief lists `scrollToTop` as public behavior. Is replacing the exposed method with a declarative `reset-key` prop acceptable? If not, keep `defineExpose({ scrollToTop })` and call it from a lens watcher in the view; nothing else in the sketch changes.
- Today, Shift-click with an anchor beyond the current view length throws a TypeError (`view[i].id` of undefined) after a filter shrinks the list. Should the refactor keep that, or clamp the range to the view? The sketch marks it `TODO(decision)` and suggests clamping.
- The selection is now narrowed from structured `{ id, message }` failures instead of parsing `id: message` strings. The result is identical unless an id contains `:`. Is that acceptable as a latent-bug fix?
- Is moving the O-key navigation into EpisodeCard in scope? It deletes a two-hop pass-through and the duplicated route string.
- Is the tsconfig flag plus a `"test"` script acceptable, or should unit tests wait until the repo chooses a runner?
- Risk: an RO-loop error from scrollbar oscillation (when a cols change flips the scrollbar and changes `clientWidth` again) would surface as a `pageerror` in `drive.mjs`. The old single-target observer has the same exposure. The spacer target adds no new oscillation path, because `top` doesn't affect any observed size. Watch for it in the e2e run.
- Risk: Vue's language tools must type `v-for="(m, key) in METRICS"` keys as `MetricKey`. If they type them as `string`, add a typed `METRIC_KEYS` constant derived from `METRICS`.

## Next implementation step

Write `lens.ts` and `lens.test.ts`. Pin golden URL strings taken from the old `readQuery`/`writeQuery`, and add the one-time parity test against `filters.ts`. Then move OverviewView onto `useUrlLens` and `project`, with FilterRail on `v-model:lens`.

## Module map

All paths are under `web/src/`. Line counts are approximate.

| File | Status | Lines | Role |
|---|---|---|---|
| `views/OverviewView.vue` | changed | ~85 (was 325) | Composes the four owners and one projection. The template is composition only. Styles: `.ov` tokens, layout, state blocks. |
| `components/overview/lens.ts` | new, replaces `filters.ts` | ~150 | Pure. Vocabulary (`METRICS` with scale, `STATUSES` as an exhaustive record, `SORTS`), the `Lens` type, the private `PARAMS`/`FACETS` table, `readLens`, `writeLens`, `update`, `toggle`, `clearFilters`, `hasFilters`, `matches`. |
| `components/overview/projection.ts` | new | ~110 | Pure. `project(episodes, lens)`, which returns view, facets (status, hists, tasks), kpi and synthetic. Owns the `Histogram`, `TaskRow`, `Facets` and `Kpi` types. |
| `components/overview/virtualGrid.ts` | new | ~55 | Pure. Row-math constants, `layoutGrid` (with the clamp), `revealTop`, `navTarget`. |
| `components/overview/useEpisodes.ts` | new | ~65 | Sole writer of `episodes`. Load, reload, and optimistic `setStatus` with 6 in flight and per-id conditional rollback. |
| `components/overview/useBulkSelection.ts` | new | ~70 | Sole writer of the selection, anchor, busy and errors. Click and Shift-range, the Escape listener, pruning to the view, and the bulk flow over `setStatus`. |
| `components/overview/useUrlLens.ts` | new | ~15 | `Ref<Lens>` parsed once from `route.query` and mirrored with `router.replace`. |
| `components/overview/LensBar.vue` | new | ~55 | Search, sort, direction, "Reset all filters" and the hint, on `v-model:lens`. Toolbar styles moved here. |
| `components/overview/FilterRail.vue` | changed | ~125 (was 141) | `v-model:lens` plus `facets`. No mutation, no exported types. |
| `components/overview/EpisodeGrid.vue` | changed | ~150 (was 160) | Single-writer `viewport` from `measure()`, one RO over scroller and spacer, `reset-key` prop, pure layout and keyboard navigation. `top` and the length watch are deleted. |
| `components/overview/EpisodeCard.vue` | changed | ~103 | `STATUSES[status]` lookup. The O key pushes the same `href` the RouterLink uses. The `open` emit is removed. |
| `components/overview/HistogramBrush.vue` | changed | 1 line | `import type { Range } from './lens'`. |
| `components/overview/BulkBar.vue`, `KpiHeader.vue` | unchanged | | |
| `components/overview/filters.ts` | deleted | | Absorbed into `lens.ts` and `projection.ts`. |
| `components/overview/{lens,projection,virtualGrid}.test.ts` | new | ~90 / ~80 / ~60 | `node --test`, no dependencies. |
| `tsconfig.json` | changed | | Adds `"allowImportingTsExtensions": true`. |
| `package.json` | changed | | Adds `"test": "node --test \"src/**/*.test.ts\""`. No new packages. |
| `api/client.ts`, `e2e/drive.mjs` | unchanged | | |

## Type sketch

### `components/overview/lens.ts`

```ts
// Pure: no Vue, no router. Client types are `import type` (erased), so `node --test` loads this file directly.
import type { EpisodeSummary, Status } from '../../api/client'

const notImplemented = (): never => {
	throw new Error('not implemented')
}

// Vocabulary. Each table is the only list of its kind. Lens fields, URL params, predicates, rail and toolbar derive from it.

/** How a metric's histogram domain is chosen (projection.domainOf). Replaces the old key === 'trk' / 'dur' branches. */
export type Scale = 'percent' | 'zero' | 'fit'

export const METRICS = {
	dur: { label: 'Duration', unit: 's', scale: 'zero', get: (e: EpisodeSummary) => e.duration_s },
	trk: { label: 'SLAM tracking', unit: '%', scale: 'percent', get: (e: EpisodeSummary) => e.tracking_pct },
	wid: { label: 'Max gripper width', unit: 'mm', scale: 'fit', get: (e: EpisodeSummary) => e.gripper_max_mm },
} as const satisfies Record<string, { label: string; unit: string; scale: Scale; get: (e: EpisodeSummary) => number }>
/** Key order is URL order and rail order. The histogram aria-label starts with `label` (e2e: "Duration"). */
export type MetricKey = keyof typeof METRICS

/** Exhaustive over Status: a new API status fails the build until it has a label and color. Key order is chip order. */
export const STATUSES = {
	imported: { label: 'Imported', color: 'var(--imp)' },
	slam_ok: { label: 'SLAM ok', color: 'var(--ok)' },
	slam_failed: { label: 'SLAM failed', color: 'var(--bad)' },
	curated: { label: 'Curated', color: 'var(--cur)' },
	excluded: { label: 'Excluded', color: 'var(--exc)' },
} as const satisfies Record<Status, { label: string; color: string }>

/** Label and key in one entry (the old code had SORTS plus a separate `get` record inside `view`). Key order is option order. */
export const SORTS = {
	id: { label: 'Episode id', get: (e: EpisodeSummary) => e.id },
	dur: { label: 'Duration', get: METRICS.dur.get },
	trk: { label: 'Tracking', get: METRICS.trk.get },
	wid: { label: 'Gripper width', get: METRICS.wid.get },
	task: { label: 'Task', get: (e: EpisodeSummary) => e.task },
} as const satisfies Record<string, { label: string; get: (e: EpisodeSummary) => number | string }>
export type SortKey = keyof typeof SORTS

// The lens

/** Half-open [lo, hi). hi === Infinity means "to the end of the scale" and is spelled `max` in the URL. */
export type Range = readonly [lo: number, hi: number]
export type SortDir = 'asc' | 'desc'

/**
 * What the user chose to see and in what order; exactly what the URL encodes. Field names are URL param names.
 * Immutable: a change is a new Lens, so "changed" means "not ===". Make new ones with update / toggle / clearFilters.
 */
export type Lens = { readonly [K in MetricKey]: Range | null } & {
	readonly status: ReadonlySet<Status>
	readonly task: ReadonlySet<string>
	/** As typed (v-model). Matching and the URL use it trimmed. */
	readonly q: string
	readonly sort: SortKey
	readonly dir: SortDir
}
/** Lens fields that narrow the list. The rest only order it. */
export type FacetKey = Exclude<keyof Lens, 'sort' | 'dir'>
export type SetFacetKey = 'status' | 'task'
type ItemOf<K extends SetFacetKey> = Lens[K] extends ReadonlySet<infer T> ? T : never

// The codec table (private). One entry per Lens field, checked against Lens by the compiler.

/** How one Lens field is spelled in the URL. */
interface Param<T> {
	readonly empty: T
	/** Tolerant: absent, non-string (array or null) or malformed input decodes to `empty`. Never throws. */
	decode(raw: unknown): T
	/** undefined means omit the param; returned exactly when the value is equivalent to `empty`. hasFilters relies on this. */
	encode(value: T): string | undefined
}
/** A Param that also narrows the list. */
interface Facet<T> extends Param<T> {
	/** Must be true for every value that encodes to undefined. */
	test(e: EpisodeSummary, value: T): boolean
}

const one = (raw: unknown): string => (typeof raw === 'string' ? raw : '')

function rangeFacet(get: (e: EpisodeSummary) => number): Facet<Range | null> {
	// decode: verbatim old parseRange. typeof raw !== 'string' -> null; [a, b] = raw.split('_');
	//         lo = Number(a); hi = b === 'max' ? Infinity : Number(b);
	//         a !== '' && b !== undefined && isFinite(lo) && !isNaN(hi) ? [lo, hi] : null   ('5_' -> [5, 0], keep)
	// encode: r ? `${num(r[0])}_${num(r[1])}` : undefined, where num = isFinite(x) ? String(Math.round(x * 100) / 100) : 'max'
	// test:   v = get(e); !r || !(v < r[0] || v >= r[1])   <- keep the negated form: a NaN metric passes, as before
	return notImplemented()
}
function setFacet<T extends string>(accept: (s: string) => s is T, get: (e: EpisodeSummary) => T): Facet<ReadonlySet<T>> {
	// empty: one shared empty Set (ReadonlySet, so sharing it is safe)
	// decode: new Set(one(raw).split(',').filter(accept))   URL order kept, duplicates collapse
	// encode: s.size ? [...s].join(',') : undefined           insertion order, as before
	// test:   !s.size || s.has(get(e))
	return notImplemented()
}
function searchFacet(haystack: (e: EpisodeSummary) => string): Facet<string> {
	// decode: one(raw). encode: q.trim() || undefined.
	// test: t = q.trim().toLowerCase(); !t || haystack(e).toLowerCase().includes(t)
	return notImplemented()
}
function oneOf<T extends string>(values: readonly T[], empty: T): Param<T> {
	// decode: typeof raw === 'string' && values.includes(raw) ? raw : empty   (dir: anything but 'desc' -> 'asc')
	// encode: v === empty ? undefined : v
	return notImplemented()
}
/** Object.hasOwn, not `in`: status=constructor must be rejected, as the old STATUSES.some(...) did. */
const isStatus = (s: string): s is Status => Object.hasOwn(STATUSES, s)

/** One cast, hidden here: the range facets are generated from METRICS, in METRICS order. */
const RANGE_FACETS = Object.fromEntries(Object.entries(METRICS).map(([k, m]) => [k, rangeFacet(m.get)])) as {
	readonly [K in MetricKey]: Facet<Range | null>
}
const FACETS: { readonly [K in FacetKey]: Facet<Lens[K]> } = {
	...RANGE_FACETS,
	status: setFacet(isStatus, (e) => e.status),
	task: setFacet((s): s is string => s !== '', (e) => e.task),
	q: searchFacet((e) => `${e.id} ${e.scene} ${e.session} ${e.instruction} ${e.task} ${e.camera}`),
}
/** Spread order is URL order: dur, trk, wid, status, task, q, sort, dir (identical to the old writeQuery). */
const PARAMS: { readonly [K in keyof Lens]: Param<Lens[K]> } = {
	...FACETS,
	sort: oneOf(Object.keys(SORTS) as SortKey[], 'id'),
	dir: oneOf(['asc', 'desc'] as const, 'asc'),
}

// Public operations

/** Parse a route query once. Unknown params are ignored, malformed values become defaults. */
export function readLens(query: Readonly<Record<string, unknown>>): Lens {
	// for each key of PARAMS: out[key] = PARAMS[key].decode(query[key])
	return notImplemented()
}
/** The `query` for router.replace: defaults omitted, keys in PARAMS order. A fresh object (unrelated params are dropped, as before). */
export function writeLens(lens: Lens): Record<string, string> {
	// for each key of PARAMS: s = PARAMS[key].encode(lens[key]); if (s !== undefined) out[key] = s
	return notImplemented()
}
/** Same Lens back when Object.is(value, lens[key]) (mirrors Vue's hasChanged), so a no-op never rewrites the URL or rewinds the grid. */
export function update<K extends keyof Lens>(lens: Lens, key: K, value: Lens[K]): Lens {
	return notImplemented()
}
/** Adds `item` if absent, else removes it, keeping insertion order (that order is the URL order). Always a new Lens. */
export function toggle<K extends SetFacetKey>(lens: Lens, key: K, item: ItemOf<K>): Lens {
	return notImplemented()
}
/** Resets one facet, or every facet when `only` is omitted. Sort and dir are kept. A facet already empty (null, size 0, '') is left alone; same Lens back if none changed. */
export function clearFilters(lens: Lens, only?: FacetKey): Lens {
	return notImplemented()
}
/** True when some facet narrows the list, i.e. some facet param would appear in the URL. Whitespace-only q is false, as before. */
export function hasFilters(lens: Lens): boolean {
	// FACET_KEYS.some(k => FACETS[k].encode(lens[k]) !== undefined)
	return notImplemented()
}
/** Whether `e` passes every facet except `except` (leave-one-out, so each rail section counts against the others). */
export function matches(e: EpisodeSummary, lens: Lens, except?: FacetKey): boolean {
	// FACET_KEYS.every(k => k === except || FACETS[k].test(e, lens[k]))
	return notImplemented()
}
```

### `components/overview/projection.ts`

```ts
// Pure. Everything the screen shows for (episodes, lens).
import type { EpisodeSummary, Status } from '../../api/client'
import { METRICS, SORTS, STATUSES, matches, type Lens, type MetricKey, type Scale } from './lens.ts'

const BINS = 20

export interface Histogram { all: number[]; match: number[]; lo: number; hi: number }
export interface TaskRow { task: string; count: number; total: number; curated: number }
export interface Facets {
	/** Per status: episodes passing every facet except status. */
	status: Record<Status, number>
	/** null while there are no episodes (the rail shows skeletons). */
	hists: Record<MetricKey, Histogram> | null
	/** Every task seen, most episodes first, then by name. count = passes every facet except task. */
	tasks: TaskRow[]
}
/** Field names are KpiHeader's props (v-bind). */
export interface Kpi {
	shown: number; total: number; hoursShown: number; hoursTotal: number
	slamUsable: number; curated: number; curatedHours: number; medianTracking: number | null
}
export interface Projection {
	/** Episodes passing every facet, in lens order. Indices into this are what the grid and the selection use. */
	view: readonly EpisodeSummary[]
	facets: Facets
	kpi: Kpi
	/** Some episode in the whole list is flagged synthetic. */
	synthetic: boolean
}

export function project(episodes: readonly EpisodeSummary[], lens: Lens): Projection {
	// view   = episodes.filter(e => matches(e, lens)).sort(byLens(lens))
	// status = for each key of STATUSES: count of e with matches(e, lens, 'status')
	// hists  = episodes.length ? for each key of METRICS: histogram(episodes, lens, key) : null
	// tasks  = Map by e.task: total++, curated += status === 'curated', count += matches(e, lens, 'task');
	//          sort by (b.total - a.total) || a.task.localeCompare(b.task)
	// kpi    = shown/total, hours (sum of duration_s / 3600) of view and of all, slamUsable = slam_ok + curated over all,
	//          curated count and hours over all, median(view.map(tracking_pct))
	return notImplemented()
}

function domainOf(scale: Scale, values: number[]): { lo: number; hi: number } {
	// percent -> { lo: 0, hi: 100 }
	// else mx = values.length ? max(values) : 5; lo = scale === 'zero' ? 0 : floor(min(...values, mx) / 5) * 5
	//      hi = max(ceil(mx / 5) * 5, 5); if (hi <= lo) hi = lo + 5
	return notImplemented()
}
function histogram(episodes: readonly EpisodeSummary[], lens: Lens, key: MetricKey): Histogram {
	// { lo, hi } = domainOf(METRICS[key].scale, episodes.map(METRICS[key].get))
	// b = max(0, min(BINS - 1, floor(((v - lo) / (hi - lo)) * BINS)))   verbatim, including NaN behavior
	// all[b]++; if (matches(e, lens, key)) match[b]++
	return notImplemented()
}
function byLens(lens: Lens): (a: EpisodeSummary, b: EpisodeSummary) => number {
	// f = SORTS[lens.sort].get; d = lens.dir === 'asc' ? 1 : -1
	// c = typeof x === 'string' ? x.localeCompare(y, undefined, { numeric: true }) : x - y
	// return (c || a.id.localeCompare(b.id, undefined, { numeric: true })) * d   <- the tie-break flips with dir, as before
	return notImplemented()
}
function median(values: number[]): number | null {
	return notImplemented()
}
```

### `components/overview/virtualGrid.ts`

```ts
// Pure row math for EpisodeGrid. Constants are unchanged.
export const CARD_H = 184
export const GAP = 10
export const PAD = 12
const MIN_W = 210
const OVERSCAN = 2
const ROW_H = CARD_H + GAP

/** A reading of the scroller: scrollTop, clientWidth, clientHeight. Only EpisodeGrid.measure() produces one from the DOM. */
export interface Viewport { readonly top: number; readonly width: number; readonly height: number }
export interface GridWindow {
	readonly cols: number
	/** Spacer height. */
	readonly totalH: number
	/** items.slice(start, end) are rendered. */
	readonly start: number
	readonly end: number
	/** translateY of the rendered window. */
	readonly offsetY: number
	/** Rows moved by PageUp and PageDown. */
	readonly pageRows: number
}

/**
 * Total: for any viewport, including an offset beyond the content, the window lies inside the content, and it is
 * non-empty when count > 0. Identical to the old math whenever top <= totalH - height.
 */
export function layoutGrid(count: number, vp: Viewport): GridWindow {
	// cols   = max(1, floor((vp.width - PAD * 2 + GAP) / (MIN_W + GAP)))
	// rows   = ceil(count / cols); totalH = rows * ROW_H - GAP + PAD * 2
	// top    = min(vp.top, max(0, totalH - vp.height))   <- NEW. The browser clamps scrollTop to this when the content
	//                                                        shrinks; clamping first means the pre-layout render is right.
	//                                                        Upper bound only, so rubber-band (negative) offsets behave as before.
	// first  = max(0, floor((top - PAD) / ROW_H) - OVERSCAN); last = min(rows, ceil((top + vp.height - PAD) / ROW_H) + OVERSCAN)
	// return { cols, totalH, start: first * cols, end: last * cols, offsetY: PAD + first * ROW_H, pageRows: max(1, floor(vp.height / ROW_H)) }
	throw new Error('not implemented')
}
/** The scrollTop that brings card `index` fully into view, or null when it already is (old ensureVisible). */
export function revealTop(index: number, vp: Viewport, cols: number): number | null {
	// y0 = PAD + floor(index / cols) * ROW_H
	// y0 < vp.top -> y0 - PAD; y0 + CARD_H > vp.top + vp.height -> y0 + CARD_H - vp.height + PAD; else null
	throw new Error('not implemented')
}
/** Index that focus moves to for a key, clamped to [0, count - 1]; null when the key is not grid navigation. */
export function navTarget(key: string, index: number, count: number, cols: number, pageRows: number): number | null {
	// ArrowRight +1, ArrowLeft -1, ArrowDown +cols, ArrowUp -cols, Home 0, End count - 1,
	// PageDown +cols * pageRows, PageUp -cols * pageRows
	throw new Error('not implemented')
}
```

### `components/overview/useEpisodes.ts`

```ts
import { onMounted, ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import { api, type EpisodeSummary, type Status } from '../../api/client'

const MAX_IN_FLIGHT = 6

export interface StatusFailure { readonly id: string; readonly message: string }

/** Sole owner of the episode list. Nothing else writes `episodes`. */
export interface EpisodeStore {
	readonly episodes: Readonly<ShallowRef<readonly EpisodeSummary[]>>
	readonly loading: Readonly<Ref<boolean>>
	/** '' when the last load succeeded. */
	readonly error: Readonly<Ref<string>>
	/** Same as the old load(). The list is kept on failure. */
	reload(): Promise<void>
	/**
	 * Optimistic bulk write. Synchronously sets `to` on every listed episode whose status differs, then persists each
	 * (in `ids` order, at most 6 in flight). A failed id is rolled back to its previous status only if it still shows `to`.
	 * Returns null, writing nothing, when no listed episode needs a change. Otherwise resolves to the failures in completion order.
	 */
	setStatus(ids: Iterable<string>, to: Status): Promise<StatusFailure[]> | null
}

export function useEpisodes(): EpisodeStore {
	// episodes = shallowRef([]); loading = ref(true); error = ref('')
	// reload: loading = true; error = ''; try episodes = await api.episodes() catch error = message finally loading = false
	// setStatus(ids, to):
	//   want = new Set(ids); prev = Map(id -> status) for e in episodes with want.has(e.id) && e.status !== to
	//   targets = [...want].filter(id => prev.has(id)); if (!targets.length) return null
	//   episodes = episodes.map(e => targetsSet.has(e.id) ? { ...e, status: to } : e)      <- synchronous, before any await
	//   return (async () => {
	//     failed = []; cursor = 0
	//     worker = async () => { while (cursor < targets.length) { id = targets[cursor++]
	//       try { await api.setStatus(id, to) } catch (err) {
	//         episodes = episodes.map(e => e.id === id && e.status === to ? { ...e, status: prev.get(id)! } : e)
	//         failed.push({ id, message: err instanceof Error ? err.message : String(err) }) } } }
	//     await Promise.all(Array.from({ length: Math.min(MAX_IN_FLIGHT, targets.length) }, worker)); return failed
	//   })()
	// onMounted(reload)
	throw new Error('not implemented')
}
```

### `components/overview/useBulkSelection.ts`

```ts
import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'
import type { EpisodeSummary, Status } from '../../api/client'
import type { EpisodeStore } from './useEpisodes'

/** The episodes the user is about to act on, and the bulk action that consumes them. Sole owner of all four fields. */
export interface BulkSelection {
	readonly selected: Readonly<ShallowRef<ReadonlySet<string>>>
	readonly busy: Readonly<Ref<boolean>>
	/** Formatted `${id}: ${message}` for BulkBar. */
	readonly errors: Readonly<Ref<string[]>>
	/** Card click or Space. With Shift and an anchor, adds anchor..index and keeps the anchor; otherwise flips one id and moves the anchor. */
	toggleAt(index: number, ev: { shiftKey: boolean }): void
	/** Empties the selection and drops the anchor. */
	clearSelection(): void
	applyStatus(status: Status): Promise<void>
	dismissErrors(): void
}

export function useBulkSelection(view: () => readonly EpisodeSummary[], write: EpisodeStore['setStatus']): BulkSelection {
	// selected = shallowRef(new Set()); let anchor = -1 (an index into view(), not reactive, as before); busy; errors
	//
	// toggleAt(index, ev): list = view(); next = new Set(selected)
	//   if (ev.shiftKey && anchor >= 0) for i in min(anchor, index)..max(anchor, index): next.add(list[i].id)
	//     TODO(decision): list[i] is undefined when anchor >= list.length (old code throws). Clamp to list.length - 1?
	//   else { id = list[index].id; next.has(id) ? next.delete(id) : next.add(id); anchor = index }
	//   selected = next
	//
	// applyStatus(status):
	//   if (busy) return; errors = []
	//   pending = write(selected, status); if (!pending) return clearSelection()
	//   busy = true; failed = await pending; busy = false
	//   errors = failed.map(f => `${f.id}: ${f.message}`); selected = new Set(failed.map(f => f.id))   <- anchor kept, as before
	//
	// Escape: window keydown; if (key !== 'Escape' || !selected.size) return
	//         if (target?.closest?.('input, select')) return; clearSelection()   (HistogramBrush stops propagation itself)
	// prune:  watch(view, list => { if (!selected.size) return; keep = ids visible in list; if (keep.length !== size) selected = new Set(keep) })
	throw new Error('not implemented')
}
```

### `components/overview/useUrlLens.ts`

```ts
import { shallowRef, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { readLens, writeLens, type Lens } from './lens'

/** The lens, parsed once from the URL at setup and mirrored back with router.replace on every change. */
export function useUrlLens(): Ref<Lens> {
	// const route = useRoute(), router = useRouter()
	// const lens = shallowRef(readLens(route.query))
	// watch(lens, l => { router.replace({ query: writeLens(l) }) })   <- not immediate: loading never rewrites the URL
	// return lens
	throw new Error('not implemented')
}
```

### `components/overview/FilterRail.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import HistogramBrush from './HistogramBrush.vue'
import { METRICS, STATUSES, clearFilters, toggle, update, type Lens } from './lens'
import type { Facets } from './projection'

const lens = defineModel<Lens>('lens', { required: true })
const props = defineProps<{ facets: Facets }>()
const taskPeak = computed(() => Math.max(1, ...props.facets.tasks.map((r) => r.total)))
</script>

<template>
	<aside class="rail" aria-label="Filters">
		<h3>
			<span>Status</span>
			<button v-if="lens.status.size" type="button" class="link" @click="lens = clearFilters(lens, 'status')">clear</button>
		</h3>
		<div class="chips">
			<button
				v-for="(s, key) in STATUSES" :key="key" type="button" class="chip"
				:class="{ on: lens.status.has(key) }" :aria-pressed="lens.status.has(key)"
				@click="lens = toggle(lens, 'status', key)"
			>
				<span class="dot" :style="{ background: s.color }" />{{ s.label }}
				<span class="cnt">{{ facets.status[key] }}</span>
			</button>
		</div>

		<template v-if="facets.hists">
			<HistogramBrush
				v-for="(m, key) in METRICS" :key="key" :label="m.label" :unit="m.unit" v-bind="facets.hists[key]"
				:model-value="lens[key]" @update:model-value="lens = update(lens, key, $event)"
			/>
		</template>
		<template v-else>
			<div v-for="(m, key) in METRICS" :key="key" class="hb-skel"><h3>{{ m.label }}</h3><div class="sk" /></div>
		</template>

		<h3 class="tasks-h">
			<span>Task coverage</span>
			<button v-if="lens.task.size" type="button" class="link" @click="lens = clearFilters(lens, 'task')">clear</button>
		</h3>
		<ul class="tasks">
			<li v-for="t in facets.tasks" :key="t.task">
				<button
					type="button" class="task" :class="{ on: lens.task.has(t.task), thin: t.curated === 0 }"
					:aria-pressed="lens.task.has(t.task)"
					:title="`${t.count} matching other filters, ${t.total} total, ${t.curated} curated`"
					@click="lens = toggle(lens, 'task', t.task)"
				>
					<span class="name">{{ t.task }}</span>
					<span class="bar">
						<i class="all" :style="{ width: (t.total / taskPeak) * 100 + '%' }" />
						<i class="now" :style="{ width: (t.count / taskPeak) * 100 + '%' }" />
					</span>
					<span class="n">{{ t.count }}</span>
				</button>
			</li>
			<li v-if="!facets.tasks.length" class="none">No tasks yet.</li>
		</ul>
		<p class="hint"><!-- unchanged --></p>
	</aside>
</template>
<!-- <style scoped>: unchanged -->
```

### `components/overview/LensBar.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { SORTS, clearFilters, hasFilters, update, type Lens, type SortKey } from './lens'

const lens = defineModel<Lens>('lens', { required: true })
defineProps<{ disabled: boolean }>()

// Writable views keep real v-model semantics on the inputs (IME composition is not committed mid-word).
const q = computed({ get: () => lens.value.q, set: (v: string) => (lens.value = update(lens.value, 'q', v)) })
const sort = computed({ get: () => lens.value.sort, set: (v: SortKey) => (lens.value = update(lens.value, 'sort', v)) })
const flipDir = () => (lens.value = update(lens.value, 'dir', lens.value.dir === 'asc' ? 'desc' : 'asc'))
</script>

<template>
	<div class="tools">
		<input v-model="q" type="search" placeholder="Search id, scene, instruction" aria-label="Search episodes" :disabled />
		<label>
			Sort
			<select v-model="sort" :disabled>
				<option v-for="(s, key) in SORTS" :key="key" :value="key">{{ s.label }}</option>
			</select>
		</label>
		<button type="button" :disabled :aria-label="lens.dir === 'asc' ? 'Ascending' : 'Descending'" @click="flipDir">
			{{ lens.dir === 'asc' ? 'Asc' : 'Desc' }}
		</button>
		<button v-if="hasFilters(lens)" type="button" class="reset" @click="lens = clearFilters(lens)">Reset all filters</button>
		<span class="hint">Click to select, Shift-click for a range, arrows to move, O to open.</span>
	</div>
</template>
<!-- <style scoped>: .tools, .tools label, input[type=search], select, button, .reset, .hint, moved from OverviewView -->
```

### `components/overview/EpisodeGrid.vue`

```vue
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type ComponentPublicInstance } from 'vue'
import type { EpisodeSummary } from '../../api/client'
import EpisodeCard from './EpisodeCard.vue'
import { CARD_H, GAP, PAD, layoutGrid, navTarget, revealTop, type Viewport } from './virtualGrid'

const props = defineProps<{
	items: readonly EpisodeSummary[]
	selected: ReadonlySet<string>
	loading: boolean
	/** Compared by identity. When it changes, the grid scrolls to the top and the first card becomes active (old scrollToTop). */
	resetKey: unknown
}>()
const emit = defineEmits<{ toggle: [index: number, ev: MouseEvent | KeyboardEvent] }>()

const scroller = ref<HTMLElement | null>(null)
/** The only copy of the scroller's geometry. Written only by measure(), which reads it from the DOM. */
const viewport = shallowRef<Viewport>({ top: 0, width: 1000, height: 600 })
const grid = computed(() => layoutGrid(props.items.length, viewport.value))
const windowItems = computed(() =>
	props.items.slice(grid.value.start, grid.value.end).map((e, i) => ({ e, index: grid.value.start + i })),
)
const activeIndex = ref(0)
const active = computed(() => Math.min(activeIndex.value, Math.max(0, props.items.length - 1)))

function measure(): void {
	// el = scroller.value; if (!el) return
	// next = { top: el.scrollTop, width: el.clientWidth, height: el.clientHeight }
	// if (any field differs from viewport.value) viewport.value = next      <- skipping equal writes keeps an idle grid from re-rendering
	throw new Error('not implemented')
}
/** The only programmatic scroll: write the DOM, then read it back (the browser may clamp). */
function scrollTo(y: number): void {
	// if (!scroller.value) return; scroller.value.scrollTop = y; measure()
	throw new Error('not implemented')
}

// measure() runs on every browser input that can move scrollTop: scroll events, the scroller's box, the content's box.
let raf = 0
function onScroll() {
	// if (raf) return; raf = requestAnimationFrame(() => { raf = 0; measure() })   <- same throttle as before
}
const ro = new ResizeObserver(() => measure()) // created at setup: the spacer's ref callback can run before onMounted
let content: Element | null = null
/** Function ref on the spacer (v-if'd). Vue calls it on every patch, so ignore repeats. */
function observeContent(el: Element | ComponentPublicInstance | null) {
	// if (el === content) return; if (content) ro.unobserve(content); content = el as Element | null; if (content) ro.observe(content)
}
onMounted(() => {
	// ro.observe(scroller.value!); measure()
})
onBeforeUnmount(() => {
	// ro.disconnect(); if (raf) cancelAnimationFrame(raf)
})

watch(() => props.resetKey, () => {
	// scrollTo(0); activeIndex.value = 0
	// Pre-flush prop watcher: runs in updateComponentPreRender, before this grid renders the new items (same order as before).
})

async function focusIndex(index: number) {
	// activeIndex.value = index
	// measure(); y = revealTop(index, viewport.value, grid.value.cols); if (y !== null) scrollTo(y)
	// await nextTick(); scroller.value?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus({ preventScroll: true })
}
function onKey(ev: KeyboardEvent) {
	// t = ev.target as HTMLElement; if (!t.classList.contains('card')) return
	// next = navTarget(ev.key, Number(t.dataset.index), props.items.length, grid.value.cols, grid.value.pageRows)
	// if (next === null) return; ev.preventDefault(); focusIndex(next)
}
function onToggle(index: number, ev: MouseEvent | KeyboardEvent) {
	// activeIndex.value = index; emit('toggle', index, ev)
}
// Deleted: `top`, its four writers, the items.length watch, defineExpose({ scrollToTop }), the `open` re-emit.
</script>

<template>
	<div ref="scroller" class="scroller" @scroll.passive="onScroll" @keydown="onKey">
		<div v-if="loading" class="skel-grid" aria-busy="true" aria-label="Loading episodes">
			<div v-for="i in 18" :key="i" class="skel" />
		</div>
		<div v-else-if="!items.length" class="empty-slot"><slot name="empty" /></div>
		<div v-else :ref="observeContent" class="spacer" :style="{ height: grid.totalH + 'px' }">
			<div
				class="win"
				:style="{
					transform: `translateY(${grid.offsetY}px)`,
					gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
					gridAutoRows: CARD_H + 'px',
					gap: GAP + 'px',
					padding: `0 ${PAD}px`,
				}"
			>
				<EpisodeCard
					v-for="w in windowItems" :key="w.e.id" :episode="w.e" :index="w.index"
					:selected="selected.has(w.e.id)" :active="w.index === active" @toggle="onToggle"
				/>
			</div>
		</div>
	</div>
</template>
<!-- <style scoped>: unchanged -->
```

### `components/overview/EpisodeCard.vue` (changes only)

```ts
import { useRouter } from 'vue-router'
import { STATUSES } from './lens'

const emit = defineEmits<{ toggle: [index: number, ev: MouseEvent | KeyboardEvent] }>() // `open` removed
const st = computed(() => STATUSES[props.episode.status]) // was STATUSES.find(...)!
/** The only spelling of an episode's route on this screen: used by the Open link and by the O key. */
const href = computed(() => `/episode/${encodeURIComponent(props.episode.id)}`)
const router = useRouter()
// key(): 'o' | 'O' -> router.push(href.value)   (was emit('open', id), re-emitted by the grid and pushed by the view)
// template: <RouterLink class="open" :to="href" ...>
```

### `components/overview/HistogramBrush.vue` (change only)

```ts
import type { Range } from './lens' // was './filters'. Range is now readonly; the brush only reads it and emits new tuples.
```
