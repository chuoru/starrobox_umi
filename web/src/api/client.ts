export type Status = 'imported' | 'slam_ok' | 'slam_failed' | 'curated' | 'excluded'

export interface EpisodeSummary {
	id: string
	synthetic?: boolean
	scene: string
	session: string
	camera: string
	fps: number
	duration_s: number
	instruction: string
	task: string
	status: Status
	tracking_pct: number
	gripper_min_mm: number
	gripper_max_mm: number
}

/** Per-sample arrays, all the same length. speed_mps is null where tracking is lost: not measured. */
export interface EpisodeSeries {
	fps: number
	gripper_width_mm: number[]
	speed_mps: (number | null)[]
	position_m: [number, number, number][]
	tracking: boolean[]
	keyframes: number[]
	imu_accel: [number, number, number][]
	imu_gyro: [number, number, number][]
}

export interface EpisodeDetail extends EpisodeSummary {
	has_video: boolean
	series: EpisodeSeries | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, init)
	if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${path} returned ${response.status}`)
	return response.json() as Promise<T>
}

export const api = {
	health: () => request<{ status: string }>('/api/health'),
	episodes: () => request<EpisodeSummary[]>('/api/episodes'),
	episode: (id: string) => request<EpisodeDetail>(`/api/episodes/${encodeURIComponent(id)}`),
	videoUrl: (id: string) => `/api/episodes/${encodeURIComponent(id)}/video`,
	setStatus: (id: string, status: Status) =>
		request<EpisodeSummary>(`/api/episodes/${encodeURIComponent(id)}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ status }),
		}),
}
