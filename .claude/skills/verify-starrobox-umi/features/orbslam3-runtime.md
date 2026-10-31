# ORB-SLAM3 runtime in Docker

## Sub-features

- The `starrobox-umi:dev` image builds on Ubuntu 22.04.
- Pangolin and ORB-SLAM3 `v1.0-release` compile in the image.
- The vocabulary file `Vocabulary/ORBvoc.txt` is unpacked.

## How to get to it (user POV)

A developer on Windows runs `docker compose build`, then starts a shell with `docker compose run --rm backend bash`. The ORB-SLAM3 tree is at `$ORB_SLAM3_ROOT` (`/opt/ORB_SLAM3`).

## Driving it with the harness

1. `bash .claude/skills/verify-starrobox-umi/scripts/doctor.sh` exits 0.
2. `bash .claude/skills/verify-starrobox-umi/scripts/smoke.sh` writes evidence. `mono_inertial_usage.txt` shows the usage line, and `ldd_missing_count.txt` holds `0`.

## Gotchas

- Windows line endings break the shell scripts inside the container. Keep `*.sh` files on LF endings.
- ORB-SLAM3 needs C++14 on Ubuntu 22.04. The Dockerfile patches the upstream `std=c++11` flags with `sed`.
- If `smoke.sh` reports `libpango_windowing.so` or `libpango_image.so` as not found, the image's `ldconfig` cache is stale. The libraries exist in `/usr/local/lib`. An `apt-get` step later in the Dockerfile refreshes the cache as a side effect, so removing that step breaks the binaries. `ldd` with `LD_LIBRARY_PATH=/usr/local/lib` shows 0 missing when this is the cause.
- The smoke run does not track a real sequence. A tracking proof needs a EuRoC sequence in `data/`, which this skill does not download.
