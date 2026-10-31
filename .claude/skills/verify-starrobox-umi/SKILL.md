---
name: verify-starrobox-umi
description: Verify starrobox_umi, the app that converts Insta360 and GoPro recordings into training data with ORB-SLAM3. Use when you need to prove that the Ubuntu Docker runtime builds and that ORB-SLAM3 runs, or when you change anything under docker/. The web UI is a shell with one screen wired, so this skill covers the runtime, the API, and the UI shell.
---

# Verify starrobox_umi

Developers work on Windows. The backend (FastAPI) runs on Ubuntu 22.04 inside the Docker image `starrobox-umi:dev`. The web UI (Vue 3 and Vite) runs in a Node container and opens in a browser on Windows. No X server is needed.

**Current scope.** This skill proves the runtime (the image builds and the ORB-SLAM3 binaries load), the API (`/api/health`, `/api/episodes`), and the UI shell (header and navigation), plus the Overview and Episode screens. The other three screens are placeholders. When a screen is built, add its drive steps under **Drive** and a feature file under `features/`.

## Launch

Run from the repo root, in Git Bash:

```sh
docker compose build
```

The build is ready when the command exits 0. A cold build takes about 20 minutes because it compiles Pangolin and ORB-SLAM3. Docker caches the layers, so a rebuild without changes takes seconds.

There is no long-running server. `scripts/smoke.sh` starts its own short-lived container for each drive.

## Doctor

```sh
bash .claude/skills/verify-starrobox-umi/scripts/doctor.sh
```

It is read-only. It checks that the Docker engine is up, that the image exists, that the container reports Ubuntu, and that the ORB-SLAM3 binaries, library, and vocabulary exist. Run it first whenever a drive fails.

## Drive

```sh
bash .claude/skills/verify-starrobox-umi/scripts/smoke.sh
```

It starts a container named `umi-verify-<timestamp>`, runs `Examples/Monocular-Inertial/mono_inertial_euroc` with no arguments, and runs `ldd` on it. The binary prints its usage line and exits non-zero. That outcome is the pass condition. A missing shared library is a failure.

This proves that ORB-SLAM3 and its dependencies link on Ubuntu. It does not prove tracking quality. For that, run the binary on a EuRoC sequence. Download the sequence into `data/` first, because `data/` is ignored by git.

### Drive the web app

```sh
docker compose up -d
```

Wait until `curl -sf localhost:5173/api/health` prints `{"status":"ok",...}`. The first start takes about a minute because the `web` service runs `npm install`. That request goes through the Vite proxy to the backend, so one call proves both services.

Then screenshot the UI in headless Edge or Chrome and save it to `verification-evidence/web/`:

```sh
msedge --headless=new --disable-gpu --virtual-time-budget=5000 --window-size=1200,500 --screenshot=<abs path>/verification-evidence/web/overview.png http://localhost:5173/overview
```

For the Overview and Episode screens, run `npm run e2e` in `web/` instead. It drives real interactions and keys. See [features/overview.md](features/overview.md). The page must show `backend: up` in the header. Open `http://localhost:8000/docs` for the API explorer. Run `docker compose down` when you finish.

## Evidence

Each smoke run writes to `verification-evidence/<timestamp>/` in the repo root:

- `mono_inertial_usage.txt`: the binary output and its exit code.
- `ldd_missing_count.txt`: the number of unresolved shared libraries. It must be `0`.

Standards for any proof:

- Run the real binary or the real UI path. Do not call internal functions.
- Capture the action and the resulting state. For file outputs, list the files written.
- When the app writes trajectories, check that the files exist and have rows. A zero-byte output is a failure.

## Cleanup

`smoke.sh` removes its own container through a `trap`. Stop the web stack with `docker compose down`. To remove anything else the run created, remove it by name:

```sh
docker rm -f umi-verify-<timestamp>
```

Never run `docker rm` or `docker kill` on all containers or by image name. Cleanup never touches `verification-evidence/`.

## Helpers

| Script | Purpose |
| --- | --- |
| `scripts/doctor.sh` | Read-only readiness check. Exit 0 means ready. |
| `scripts/smoke.sh` | Drive ORB-SLAM3 and save evidence. |

## Feature map

See [features/README.md](features/README.md).
