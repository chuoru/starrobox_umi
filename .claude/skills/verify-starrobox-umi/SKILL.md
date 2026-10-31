---
name: verify-starrobox-umi
description: Verify starrobox_umi, the app that converts Insta360 and GoPro recordings into training data with ORB-SLAM3. Use when you need to prove that the Ubuntu Docker runtime builds and that ORB-SLAM3 runs, or when you change anything under docker/. The app's desktop GUI does not exist yet, so this skill covers the runtime layer only.
---

# Verify starrobox_umi

Developers work on Windows. The app runs on Ubuntu 22.04 inside the Docker image `starrobox-umi:dev`. Every verification runs in that container, never on the Windows host.

**Current scope.** The repo has no application code yet. This skill proves the runtime: the image builds and ORB-SLAM3 binaries load. When the desktop GUI lands, add its launch and drive steps under **Drive** and add feature files under `features/`.

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

### Drive the GUI on the Windows desktop

The Qt window (`app/main.py`) runs in the container and draws on the Windows desktop through VcXsrv. VcXsrv must be running first (`tasklist | grep -i vcxsrv`).

```sh
MSYS_NO_PATHCONV=1 docker run -d --name umi-gui -e DISPLAY=host.docker.internal:0.0 -e QT_QPA_PLATFORM=xcb -v "$PWD:/workspace" starrobox-umi:dev python3 app/main.py
```

Wait about 6 seconds, then capture the screen with PowerShell (`System.Drawing` `CopyFromScreen`) into `verification-evidence/gui/desktop.png`. The window title reads `starrobox_umi@<container id>`. Remove the container with `docker rm -f umi-gui`. The screenshot captures the whole desktop, so check it for unrelated windows before you share it.

For headless runs, use `xvfb-run` (already in the image).

## Evidence

Each smoke run writes to `verification-evidence/<timestamp>/` in the repo root:

- `mono_inertial_usage.txt`: the binary output and its exit code.
- `ldd_missing_count.txt`: the number of unresolved shared libraries. It must be `0`.

Standards for any proof:

- Run the real binary or the real UI path. Do not call internal functions.
- Capture the action and the resulting state. For file outputs, list the files written.
- When the app writes trajectories, check that the files exist and have rows. A zero-byte output is a failure.

## Cleanup

`smoke.sh` removes its own container through a `trap`. To remove anything else the run created, remove it by name:

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
