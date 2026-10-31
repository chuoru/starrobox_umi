#!/usr/bin/env bash
# Drive ORB-SLAM3 inside the container and save evidence to verification-evidence/<timestamp>/.
# Run from the repo root: bash .claude/skills/verify-starrobox-umi/scripts/smoke.sh
set -u
ts=$(date +%Y%m%d-%H%M%S)
out="verification-evidence/$ts"; mkdir -p "$out"
name="umi-verify-$ts"
# Start our own container so cleanup removes only what this run created.
docker run -d --name "$name" -v "$PWD:/workspace" starrobox-umi:dev sleep 600 >/dev/null || exit 1
trap 'docker rm -f "$name" >/dev/null 2>&1' EXIT
# The binary prints usage and exits non-zero when called without arguments. That proves it loads all its shared libraries.
docker exec "$name" bash -c 'cd $ORB_SLAM3_ROOT && ./Examples/Monocular-Inertial/mono_inertial_euroc' > "$out/mono_inertial_usage.txt" 2>&1
echo "exit=$?" >> "$out/mono_inertial_usage.txt"
docker exec "$name" bash -c 'ldd $ORB_SLAM3_ROOT/Examples/Monocular-Inertial/mono_inertial_euroc | grep -c "not found" || true' > "$out/ldd_missing_count.txt"
echo "evidence: $out"; cat "$out/mono_inertial_usage.txt"; echo "missing libs: $(cat "$out/ldd_missing_count.txt")"
