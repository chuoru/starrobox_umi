import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'
import type { EpisodeSummary, Status } from '../../api/client'
import type { EpisodeStore } from './useEpisodes'

/** The episodes the user is about to act on, and the bulk action that uses them. The sole owner of all four fields. */
export interface BulkSelection {
	readonly selected: Readonly<ShallowRef<ReadonlySet<string>>>
	readonly busy: Readonly<Ref<boolean>>
	/** Each error reads `<id>: <message>`, which is what BulkBar shows. */
	readonly errors: Readonly<Ref<string[]>>
	/**
	 * A card click or Space. With Shift and an anchor, it adds every episode from the anchor to `index` and keeps the
	 * anchor. Otherwise it flips one episode and moves the anchor there.
	 */
	toggleAt(index: number, ev: { shiftKey: boolean }): void
	/** Empties the selection and drops the anchor. */
	clearSelection(): void
	applyStatus(status: Status): Promise<void>
	dismissErrors(): void
}

export function useBulkSelection(view: () => readonly EpisodeSummary[], write: EpisodeStore['setStatus']): BulkSelection {
	const selected = shallowRef<ReadonlySet<string>>(new Set())
	const busy = ref(false)
	const errors = ref<string[]>([])
	// An index into view(). It is not reactive and it is not pruned, as before.
	let anchor = -1

	function toggleAt(index: number, ev: { shiftKey: boolean }) {
		const list = view()
		const next = new Set(selected.value)
		if (ev.shiftKey && anchor >= 0) {
			// The anchor can be past the end after a filter shrinks the list, so clamp to what is still there.
			const last = list.length - 1
			const [a, b] = [Math.min(anchor, index, last), Math.min(Math.max(anchor, index), last)]
			for (let i = a; i <= b; i++) next.add(list[i].id)
		} else {
			const id = list[index].id
			if (next.has(id)) next.delete(id)
			else next.add(id)
			anchor = index
		}
		selected.value = next
	}

	function clearSelection() {
		selected.value = new Set()
		anchor = -1
	}

	async function applyStatus(status: Status) {
		if (busy.value) return
		errors.value = []
		const pending = write(selected.value, status)
		if (!pending) return clearSelection()
		busy.value = true
		const failed = await pending
		busy.value = false
		errors.value = failed.map((f) => `${f.id}: ${f.message}`)
		selected.value = new Set(failed.map((f) => f.id))
	}

	function onKey(ev: KeyboardEvent) {
		if (ev.key !== 'Escape' || !selected.value.size) return
		if ((ev.target as HTMLElement | null)?.closest?.('input, select')) return
		clearSelection()
	}
	onMounted(() => window.addEventListener('keydown', onKey))
	onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

	watch(view, (list) => {
		if (!selected.value.size) return
		const visible = new Set(list.map((e) => e.id))
		const keep = [...selected.value].filter((id) => visible.has(id))
		if (keep.length !== selected.value.size) selected.value = new Set(keep)
	})

	return { selected, busy, errors, toggleAt, clearSelection, applyStatus, dismissErrors: () => (errors.value = []) }
}
