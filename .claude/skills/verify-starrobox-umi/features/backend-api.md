# Backend API

## Sub-features

- `GET /api/health` returns `{"status":"ok","orb_slam3_root":"/opt/ORB_SLAM3"}`.
- `GET /api/episodes` lists every folder under `data/episodes/` that has a `meta.json`. Each item is `{"id": <folder name>, ...<meta.json fields>}`.
- `GET /docs` serves the interactive API explorer.

## How to get to it (user POV)

Run `docker compose up -d`. The API listens on `http://localhost:8000`. The web UI reaches it through `/api` on port 5173.

## Driving it with curl

1. `curl -s localhost:5173/api/health` returns the health JSON. This proves the Vite proxy and the backend together.
2. `curl -s localhost:8000/api/episodes` returns `[]` on an empty `data/`.
3. Create `data/episodes/ep_verify/meta.json` containing `{"duration_s": 12.5}`. The same call now returns `[{"id":"ep_verify","duration_s":12.5}]`.
4. Delete `data/episodes/ep_verify` before you finish. It is verification scaffolding.

## Gotchas

- The first `docker compose up` takes about a minute before port 5173 answers, because the `web` service runs `npm install`.
- A `meta.json` that is not valid JSON makes `json.loads` raise in `list_episodes`, so `/api/episodes` should return a 500 for all episodes. Read from source and not driven.
- There is no import, ORB-SLAM3 job, or write endpoint yet.
