# Web UI shell

## Sub-features

- A header with the navigation links Overview, Triage, Episode, Annotate and export, and Model view.
- A backend status indicator that reads `backend: up` or `backend: down` from `/api/health`.
- The Overview screen, which lists episode ids from `/api/episodes`. With none it reads "No episodes yet. Import a recording to create one."
- Four placeholder screens (`/triage`, `/episode`, `/export`, `/model-view`). Each names the sketch in `docs/ux/` to build from.

## How to get to it (user POV)

Open `http://localhost:5173`. It redirects to `/overview`.

## Driving it with headless Edge or Chrome

1. Start the stack and wait for `curl -sf localhost:5173/api/health`.
2. Screenshot `http://localhost:5173/overview` and `http://localhost:5173/triage` with `--headless=new --virtual-time-budget=5000`, as in the skill's **Drive the web app** section.
3. Overview shows `backend: up` and either the empty message or the episode ids. Triage shows "Not built yet" and `docs/ux/03-quality-curation.html`.

## Gotchas

- Navigation by click is not driven. The headless command loads each route directly.
- With the backend stopped, the header reads `backend: down` and Overview shows "Could not load episodes". Not driven in the last pass.
