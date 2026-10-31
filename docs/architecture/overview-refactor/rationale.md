# Overview refactor: rationale

Status: implemented. The code is in `web/src/components/overview/`, and where it differs from the sketch the code is right. The type sketch is in [candidate-A.md](candidate-A.md), under "Type sketch". [candidate-B.md](candidate-B.md) holds the risk list and test plan that this design borrows. Read the amendments below first, because they override the sketch where the two differ.

## Problem

Three defects in `web/src/` come from one cause: no piece of state has a single owner.

1. `FilterRail.vue` receives the parent's reactive `filters` and mutates it through the prop. It also exports `HistData` and `TaskRow`, and the parent imports types from a child SFC.
2. `OverviewView.vue` is 325 lines. It is the only file that knows the URL format, the filter fields, the derived statistics, the selection rules, and the bulk-update protocol. Adding a filter means editing about seven lists by hand.
3. `EpisodeGrid.vue` keeps `top`, a copy of `scroller.scrollTop`, with four writers. The `watch(items.length)` that patches it runs in the prop pre-flush, before the spacer's height changes. It re-reads the old offset, so it does nothing. A width change that alters the column count also moves `scrollTop` and is not covered at all.

Constraints: `web/src/api/client.ts` is frozen, no new dependencies, and the 21 checks in `web/e2e/drive.mjs` must pass unchanged. The URL stays `dur`, `trk`, `wid` as `lo_hi` (hi may be `max`), then `status`, `task`, `q`, `sort`, `dir`, in that order, with defaults omitted, parsed once at setup and written with `router.replace`.

## Usage (caller's view)

`OverviewView.vue` after the change creates four owners, makes one pure call, and composes. It has no banners, no watchers, and no router. The full script and template are in candidate-A.md under "Usage".

```ts
const { episodes, loading, error, reload, setStatus } = useEpisodes()
const lens = useUrlLens()                                  // Ref<Lens>
const shown = computed(() => project(episodes.value, lens.value))
const { selected, busy, errors, toggleAt, clearSelection, applyStatus, dismissErrors } =
	useBulkSelection(() => shown.value.view, setStatus)
```

`FilterRail` and the toolbar take `v-model:lens` and emit a new `Lens`. A mutation such as `lens.status.add(s)` does not compile, because the set is a `ReadonlySet`.

## Shape

- **One immutable `Lens`.** It is everything the user chose about what to see and in what order, and its field names are the URL param names. A change is a new value, made only by `update`, `toggle`, and `clearFilters`. "Did it change" is an identity check, so the grid resets with `:reset-key="lens"` and the URL watch is `watch(lens)`.
- **One private `PARAMS` table** in `lens.ts` holds each field's decode, encode, and filter test. The compiler checks it against `Lens`. The URL format, the filter fields, `hasFilters`, `clearFilters`, and `matches` all iterate it, so they cannot drift. This replaces the seven hand-synced lists. `STATUSES` becomes a `Record<Status, ...>`, so a new API status fails the build until it has a label and a color.
- **One pure `project(episodes, lens)`** returns the visible list, the rail's counts and histograms, and the KPIs.
- **One writer per piece of state.** `useEpisodes` writes the list, including the optimistic patch and rollback. `useBulkSelection` writes selection, anchor, busy, and errors. `useUrlLens` owns the lens ref. `EpisodeGrid.measure()` writes the viewport.
- **The grid holds a measurement, not a copy.** `measure()` reads `scrollTop`, `clientWidth`, and `clientHeight` together from the DOM. It runs on scroll, on a resize of the scroller, on a resize of the content, and after each programmatic scroll. A pure `layoutGrid` clamps the offset to `totalH - height`, which is the clamp the browser applies, so a stale offset still renders the last rows. `top` and the length watch are deleted.

Interface depth: `lens.ts` exposes three vocabulary tables and seven functions, and hides the URL grammar, tolerant parsing, default omission, key order, rounding, `max`, half-open ranges, and identity-preserving no-ops. `useBulkSelection` exposes three refs and four functions, and hides the index anchor, the Shift range, the Escape guard, pruning, and narrowing to failures.

## Synthesis decision

Base: candidate A. Its `Lens` plus `PARAMS` table is a deeper module than B's `Filters` plus `query.ts` pair. It removes the hand-synced lists by construction and gives the grid a cheap identity signal. B's single `useOverview` owner puts every write behind one `commit()`, which is clean, but the owner file becomes a 150-line module that every future change touches, and a 12-verb action surface mirrors what A's child components already express with `v-model`.

Grafted from B:

1. **Structured failures** `{ id, message }` instead of parsing `id: message` strings. A already does this in `useEpisodes.setStatus`. Keep it.
2. **Clamp the Shift-range** to `view.length - 1`. Today a Shift-click after a filter shrinks the list throws a `TypeError` (`view[i].id` of undefined). A left this as `TODO(decision)`. The design clamps it. This is the one deliberate behavior change, and it fixes a crash.
3. **Pure leaves for testing.** Extract `forEachLimited(items, limit, task)` from `useEpisodes` as a pure function, so the "at most 6 in flight, each item once" rule has a test with no Vue.
4. **B's risk list and the added e2e checks** (see Test plan).

Not taken from B: the single `useOverview` owner, `ports` injection, and `commit()`. The pure parts are tested as pure functions, and a fake-ports model test adds a layer this screen does not need.

Not taken from A: moving the O-key navigation into `EpisodeCard`. It removes a pass-through, but it is outside the three refactors requested. Leave `open` as it is now and record it as follow-up.

## Amendments to the sketch in candidate-A.md

- Resolve `TODO(decision)` in `useBulkSelection.toggleAt`: clamp `i` to `list.length - 1`.
- Keep the `open` emit on `EpisodeCard` and `EpisodeGrid`. Do not change `EpisodeCard.vue` beyond `STATUSES[status]` and the `Range` import in `HistogramBrush.vue`.
- Add `forEachLimited` as an exported pure function in a new `components/overview/pool.ts`. `useEpisodes.setStatus` calls it.

## Tradeoffs accepted

- We accept that `{ ...lens, q }` compiles, because `Lens` is plain readonly data. The cost of a spread that skips idempotency is one duplicate `router.replace` and a scroll reset.
- We accept recomputing facet counts on a sort change, in exchange for one `project()` with one test surface. The cost is negligible at thousands of episodes.
- We accept duplicated input, select, and button CSS in the new `LensBar`, because a parent's scoped styles do not reach a child's inner elements.
- We accept a second `ResizeObserver` target (the spacer), so that correctness does not depend on the browser firing `scroll` when it clamps.
- We accept that the selection anchor stays a view index, as today. An id anchor would survive re-sorting but would change behavior.
- We accept `.ts` extensions inside the pure-module graph and one `tsconfig` flag, so unit tests need no new dependency.

## Alternatives considered

- **The URL as the only state** (`lens = computed(() => readLens(route.query))`). It is the strongest single source of truth, but route updates are asynchronous, so a histogram drag would read a stale selection. It would also round brush edges to two decimals on every step and trim a trailing space out of the search box.
- **A mutable reactive `FilterModel` with intent methods**, handed to children as `readonly()`. Viable. It loses on depth (about nine methods against three functions), has no before-and-after value for idempotency, and has no identity to drive the grid reset.
- **One composable per concern** (`useFilters`, `useSort`, `useQuerySync`, `useFacets`, `useSelection`, `useBulkStatus`). Each would be shallow, the URL format would split across three of them, and bulk would write an `episodes` ref owned elsewhere.
- **Grid: keep `top` and move the patch to a post-flush watch on `totalH`.** It fixes the symptom but keeps four writers and a proxy for "content changed".

## Open questions and risks

1. Is adding `allowImportingTsExtensions: true` to `web/tsconfig.json`, plus a `"test": "node --test \"src/**/*.test.ts\""` script, acceptable? Node 22.23 strips types without a flag. The repo has no test runner today.
2. Is replacing the exposed `scrollToTop()` with a `reset-key` prop acceptable? If not, keep `defineExpose({ scrollToTop })` and call it from a lens watcher in the view. Nothing else changes.
3. Is the Shift-range clamp acceptable as a deliberate behavior change?
4. Risk: a `ResizeObserver loop` error could surface as a `pageerror` in `drive.mjs` if a column-count change flips the scrollbar and changes `clientWidth`. The old single-target observer has the same exposure. Watch for it in the e2e run.
5. Risk: the language tools must type `v-for="(m, key) in METRICS"` keys as `MetricKey`. If they type them as `string`, add a `METRIC_KEYS` constant derived from `METRICS`.
6. Risk: moving the toolbar into `LensBar` changes where scoped CSS applies. Compare the `overview-brushed.png` screenshot before and after.

## Test plan

Gate 1 is `npm run build`, which enforces the `PARAMS` and `Lens` agreement and the `STATUSES` exhaustiveness. Gate 2 is `npm run e2e` with `drive.mjs` unchanged. Gate 3 is new unit tests in `lens.test.ts`, `projection.test.ts`, `virtualGrid.test.ts`, and `pool.test.ts`.

- `lens.test.ts`: golden URL strings taken from the current `readQuery` and `writeQuery`, a read-then-write fixed point, `update` with an equal value returns the same object, and `toggle` keeps insertion order. Quirks to pin: `'5_'` parses as `[5, 0]`, `status=constructor` is rejected, and `dir` is ascending unless exactly `desc`.
- `virtualGrid.test.ts`: the old inline formulas as an oracle for every `top` in `[0, maxTop]`, and for `top > maxTop` a non-empty window that ends at the last row. This is the regression test for problem 3.
- One-time parity test, in the refactor commit only: run the old `passes`, `parseRange`, and `serializeRange` against the new `matches` and codecs over a generated grid of episodes and lenses, then delete it with `filters.ts`.
- Added e2e checks: scroll the grid to the bottom, then brush the Duration histogram, and assert `article.card[data-index="0"]` exists. Press Escape while the search input is focused with a selection, and assert the bulk bar is still there.

## Next implementation step

Write `lens.ts` and `lens.test.ts`. Pin the golden URL strings from the old `readQuery` and `writeQuery`, and add the one-time parity test against `filters.ts`. Then move `OverviewView` onto `useUrlLens` and `project`, with `FilterRail` on `v-model:lens`.
