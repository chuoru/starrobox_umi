"""starrobox_umi backend. Serves the API and, when built, the web UI."""
import json
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

DATA_DIR = Path(os.environ.get("UMI_DATA_DIR", "/workspace/data"))
WEB_DIST = Path(os.environ.get("UMI_WEB_DIST", "/workspace/web/dist"))

app = FastAPI(title="starrobox_umi")


@app.get("/api/health")
def health() -> dict:
	return {"status": "ok", "orb_slam3_root": os.environ.get("ORB_SLAM3_ROOT")}


@app.get("/api/episodes")
def list_episodes() -> list[dict]:
	"""List episodes. Each episode is a folder under data/episodes/ with a meta.json."""
	episodes = []
	for meta in sorted((DATA_DIR / "episodes").glob("*/meta.json")):
		episodes.append({"id": meta.parent.name, **json.loads(meta.read_text())})
	return episodes


# Mount last so that /api routes win. Present only after `npm run build`.
if WEB_DIST.is_dir():
	app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
