# Overview screen

## Sub-features

- KPI header: episodes shown and total, hours, SLAM-usable, curated, median tracking.
- Status chips, three brushable histograms (duration, tracking, max gripper width), and task coverage bars.
- A virtualized grid of episode cards with an honest "No preview yet" tile.
- Selection by click or Shift-click, then bulk **Curate**, **Exclude**, **Reset**. Each calls `PATCH /api/episodes/<id>`.
- Filter state lives in the URL, for example `/overview?dur=27_57&status=curated,slam_ok`.

## How to get to it (user POV)

Open `http://localhost:5173/overview`. Seed data first with the command below, or the page reads "No episodes yet".

## Driving it with Playwright

From the repo root, with the stack up:

```sh
MSYS_NO_PATHCONV=1 docker compose exec -T backend python3 /workspace/backend/seed_synthetic.py --count 60 --clean --out /workspace/data/episodes
cd web && npm run e2e
```

`web/e2e/drive.mjs` drives real Edge through `playwright-core` and prints PASS or FAIL per step. For this screen it covers selection, bulk Curate (confirmed through the API), Escape, a failed `PATCH` (error alert, server unchanged, card rolled back), histogram drag (URL and N / 60 change), and the Open link. It saves `verification-evidence/web/overview-brushed.png`.

## Gotchas

- The grid is virtualized, so counting `article.card` in the DOM gives about 30, not the number of matches. Read the `N / 60` text instead.
- The bulk steps change statuses on disk. Re-run the seed command with `--clean` afterward.
- Not tested at 5,000 episodes. Keyboard arrow navigation between cards and the O shortcut are not driven.
