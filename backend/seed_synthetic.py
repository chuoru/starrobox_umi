import argparse
import json
import math
import random
import shutil
from pathlib import Path

TASKS = {
	"pick up the red cup and place it on the tray": "cup",
	"fold the towel in half": "towel",
	"open the drawer and put the spoon inside": "drawer",
	"wipe the table with the sponge": "wipe",
}
SCENES = ["kitchen_a", "kitchen_b", "office_1"]


def make_episode(rng: random.Random, index: int) -> tuple[dict, dict]:
	fps = 30
	duration = round(rng.uniform(12, 60), 1)
	n = int(duration * fps)
	lost = []
	for _ in range(rng.choice([0, 0, 1, 2, 3])):
		start = rng.randint(n // 8, n - n // 5)
		lost.append((start, min(n, start + rng.randint(fps // 2, fps * 3))))
	tracking = [not any(a <= i < b for a, b in lost) for i in range(n)]
	tracking_pct = round(100 * sum(tracking) / n, 1)

	phase = rng.uniform(0, math.tau)
	pos, last = [], None
	for i in range(n):
		u = i / n
		p = [0.4 * math.sin(u * 5 + phase), 0.3 * math.cos(u * 4 + phase), 0.2 + 0.15 * math.sin(u * 9)]
		pos.append(p)
	gripper = [round(43 - 38 * max(0.0, math.sin(math.pi * i / n) ** 2) + rng.gauss(0, 0.2), 2) for i in range(n)]
	speed = []
	for i in range(n):
		if not tracking[i]:
			speed.append(None)
		else:
			j = max(0, i - 1)
			speed.append(round(math.dist(pos[i], pos[j]) * fps, 4))
	keyframes = [i for i in range(0, n, 12) if tracking[i]]
	accel = [[round(rng.gauss(0, 0.15), 3), round(rng.gauss(0, 0.15), 3), round(9.8 + rng.gauss(0, 0.1), 3)] for _ in range(n)]
	gyro = [[round(rng.gauss(0, 0.08), 3) for _ in range(3)] for _ in range(n)]

	if tracking_pct < 70:
		status = "slam_failed"
	else:
		status = rng.choice(["imported", "slam_ok", "slam_ok", "curated", "excluded"])
	task = rng.choice(list(TASKS))
	meta = {
		"synthetic": True,
		"scene": rng.choice(SCENES),
		"session": f"s{rng.randint(1, 8):02d}",
		"camera": rng.choice(["Insta360 X4", "GoPro HERO12"]),
		"fps": fps,
		"duration_s": duration,
		"instruction": task,
		"task": TASKS[task],
		"status": status,
		"tracking_pct": tracking_pct,
		"gripper_min_mm": min(gripper),
		"gripper_max_mm": max(gripper),
	}
	series = {
		"fps": fps,
		"gripper_width_mm": gripper,
		"speed_mps": speed,
		"position_m": [[round(v, 4) for v in p] for p in pos],
		"tracking": tracking,
		"keyframes": keyframes,
		"imu_accel": accel,
		"imu_gyro": gyro,
	}
	return meta, series


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument("--count", type=int, default=60)
	parser.add_argument("--seed", type=int, default=7)
	parser.add_argument("--out", default="data/episodes")
	parser.add_argument("--clean", action="store_true", help="delete only existing synthetic episodes first")
	args = parser.parse_args()
	out = Path(args.out)
	out.mkdir(parents=True, exist_ok=True)
	if args.clean:
		for meta in out.glob("*/meta.json"):
			if json.loads(meta.read_text()).get("synthetic"):
				shutil.rmtree(meta.parent)
	rng = random.Random(args.seed)
	for i in range(args.count):
		meta, series = make_episode(rng, i)
		folder = out / f"syn_{i + 1:04d}"
		folder.mkdir(exist_ok=True)
		(folder / "meta.json").write_text(json.dumps(meta, indent=2))
		(folder / "series.json").write_text(json.dumps(series, separators=(",", ":")))
	print(f"wrote {args.count} synthetic episodes to {out}")


if __name__ == "__main__":
	main()
