export interface Episode {
	id: string
	[key: string]: unknown
}

async function get<T>(path: string): Promise<T> {
	const response = await fetch(path)
	if (!response.ok) throw new Error(`${path} returned ${response.status}`)
	return response.json() as Promise<T>
}

export const api = {
	health: () => get<{ status: string }>('/api/health'),
	episodes: () => get<Episode[]>('/api/episodes'),
}
