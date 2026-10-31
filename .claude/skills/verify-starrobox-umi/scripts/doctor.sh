#!/usr/bin/env bash
# Read-only check: is the Docker image present and does ORB-SLAM3 exist in it?
# Run from the repo root: bash .claude/skills/verify-starrobox-umi/scripts/doctor.sh
set -u
fail=0
docker info >/dev/null 2>&1 && echo "ok   docker engine up" || { echo "FAIL docker engine down"; exit 1; }
docker image inspect starrobox-umi:dev >/dev/null 2>&1 && echo "ok   image starrobox-umi:dev exists" || { echo "FAIL image missing: run docker compose build"; exit 1; }
docker run --rm starrobox-umi:dev bash -c '
	. /etc/os-release; echo "ok   ubuntu $VERSION_ID"
	for f in Examples/Monocular-Inertial/mono_inertial_euroc Examples/Stereo-Inertial/stereo_inertial_euroc Vocabulary/ORBvoc.txt lib/libORB_SLAM3.so; do
		[ -e "$ORB_SLAM3_ROOT/$f" ] && echo "ok   $f" || { echo "FAIL missing $f"; exit 1; }
	done' || fail=1
exit $fail
