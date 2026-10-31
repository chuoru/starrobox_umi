import { onMounted, ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import { api, type EpisodeSummary, type Status } from '../../api/client'
import { forEachLimited } from './pool'

const MAX_IN_FLIGHT = 6

export interface StatusFailure {
	readonly id: string
	readonly message: string
}

/** The sole owner of the episode list. Nothing else writes `episodes`. */
export interface EpisodeStore {
	readonly episodes: Readonly<ShallowRef<readonly EpisodeSummary[]>>
	readonly loading: Readonly<Ref<boolean>>
	/** Empty when the last load succeeded. */
	readonly error: Readonly<Ref<string>>
	/** Reloads the list. The list is kept when the load fails. */
	reload(): Promise<void>
	/**
	 * Optimistic bulk write. It sets `to` on every listed episode whose status differs, before any await, then saves
	 * each one in `ids` order with at most 6 requests in flight. A failed episode goes back to its previous status
	 * only if it still shows `to`. Returns null, and writes nothing, when no listed episode needs a change. Otherwise
	 * it resolves to the failures in completion order.
	 */
	setStatus(ids: Iterable<string>, to: Status): Promise<StatusFailure[]> | null
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err))

export function useEpisodes(): EpisodeStore {
	const episodes = shallowRef<readonly EpisodeSummary[]>([])
	const loading = ref(true)
	const error = ref('')

	async function reload() {
		loading.value = true
		error.value = ''
		try {
			episodes.value = await api.episodes()
		} catch (e) {
			error.value = messageOf(e)
		} finally {
			loading.value = false
		}
	}

	function setStatus(ids: Iterable<string>, to: Status): Promise<StatusFailure[]> | null {
		const want = new Set(ids)
		const previous = new Map<string, Status>()
		for (const e of episodes.value) if (want.has(e.id) && e.status !== to) previous.set(e.id, e.status)
		const targets = [...want].filter((id) => previous.has(id))
		if (!targets.length) return null

		const targetSet = new Set(targets)
		episodes.value = episodes.value.map((e) => (targetSet.has(e.id) ? { ...e, status: to } : e))

		return (async () => {
			const failed: StatusFailure[] = []
			await forEachLimited(targets, MAX_IN_FLIGHT, async (id) => {
				try {
					await api.setStatus(id, to)
				} catch (err) {
					episodes.value = episodes.value.map((e) => (e.id === id && e.status === to ? { ...e, status: previous.get(id)! } : e))
					failed.push({ id, message: messageOf(err) })
				}
			})
			return failed
		})()
	}

	onMounted(reload)
	return { episodes, loading, error, reload, setStatus }
}
