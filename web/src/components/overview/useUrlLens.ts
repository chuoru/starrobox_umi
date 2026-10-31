import { shallowRef, watch, type ShallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { readLens, writeLens, type Lens } from './lens'

/**
 * The lens, parsed once from the URL at setup and written back with router.replace on every change. It does not read
 * the URL again, so back and forward within the page leave the filters alone. The watcher is not immediate, so loading
 * the page never rewrites the URL.
 */
export function useUrlLens(): ShallowRef<Lens> {
	const route = useRoute()
	const router = useRouter()
	const lens = shallowRef(readLens(route.query))
	watch(lens, (next) => {
		router.replace({ query: writeLens(next) })
	})
	return lens
}
