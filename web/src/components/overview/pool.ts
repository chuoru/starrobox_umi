/** Runs `task` once per item with at most `limit` in flight. Workers share one cursor, so items start in order. */
export async function forEachLimited<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
	let cursor = 0
	const worker = async () => {
		while (cursor < items.length) await task(items[cursor++])
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}
