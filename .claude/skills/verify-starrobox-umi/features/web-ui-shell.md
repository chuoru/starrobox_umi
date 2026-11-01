# Web UI shell

## Sub-features

- `MainLayout`: a white header with the menu button, the `STARROBOX` name with a `UMI` badge, and the backend status. Below it, a dark sidebar that starts collapsed with the links Overview, Triage, Annotate and export, and Model view. The active link is a white pill. Episode opens from an Overview card and keeps Overview lit.
- A backend status indicator that reads `backend: up` or `backend: down` from `/api/health`.
- The Overview and Episode screens. See [overview.md](overview.md) and [episode-viewer.md](episode-viewer.md).
- Three placeholder screens (`/triage`, `/export`, `/model-view`). Each names the sketch in `docs/ux/` to build from.

## How to get to it (user POV)

Open `http://localhost:5173`. It redirects to `/overview`.

## Driving it with headless Edge or Chrome

1. Start the stack and wait for `curl -sf localhost:5173/api/health`.
2. Screenshot `http://localhost:5173/overview` and `http://localhost:5173/triage` with `--headless=new --virtual-time-budget=5000`, as in the skill's **Drive the web app** section.
3. Overview shows `backend: up` and the episode grid. Triage shows "Not built yet" and `docs/ux/03-quality-curation.html`.

## Gotchas

- Navigation by click is not driven. The headless command loads each route directly.
- With the backend stopped, the header reads `backend: down` and Overview shows "Could not load episodes". Not driven in the last pass.

## Measured audit

`npm run audit` in `web/` measures what the main drive does not: WCAG contrast of every visible text element on five routes (and of the hover-revealed Open link), the error, empty, and unknown-episode states, no horizontal scroll at 700 px, and the whole `<video>` path (it generates a test video with `ffmpeg`, checks load, seek, play, pause, rewind, and frame sync, then deletes it). It does not measure text drawn on canvases or backgrounds that are images or gradients.

Known failure: white text on the brand green `#41b432` (the `UMI` badge and `btn-primary` buttons) is 2.69:1. The audit reports it until the fill color is decided.
