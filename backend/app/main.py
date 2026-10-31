"""starrobox_umi backend. Serves the API and, when built, the web UI."""
import json
import os
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

DATA_DIR = Path(os.environ.get("UMI_DATA_DIR", "/workspace/data"))
WEB_DIST = Path(os.environ.get("UMI_WEB_DIST", "/workspace/web/dist"))

Status = Literal["imported", "slam_ok", "slam_failed", "curated", "excluded"]

app = FastAPI(title="starrobox_umi")


def episode_dir(episode_id: str) -> Path:
	"""Resolve an episode folder. Reject ids that could leave data/episodes/."""
	if not episode_id or "/" in episode_id or "\\" in episode_id or episode_id.startswith("."):
		raise HTTPException(status_code=400, detail="invalid episode id")
	path = DATA_DIR / "episodes" / episode_id
	if not (path / "meta.json").is_file():
		raise HTTPException(status_code=404, detail="episode not found")
	return path


def read_meta(path: Path) -> dict:
	return {"id": path.name, **json.loads((path / "meta.json").read_text())}


@app.get("/api/health")
def health() -> dict:
	return {"status": "ok", "orb_slam3_root": os.environ.get("ORB_SLAM3_ROOT")}


@app.get("/api/episodes")
def list_episodes() -> list[dict]:
	"""Summaries of every episode: the fields in meta.json, without time series."""
	return [read_meta(m.parent) for m in sorted((DATA_DIR / "episodes").glob("*/meta.json"))]


@app.get("/api/episodes/{episode_id}")
def get_episode(episode_id: str) -> dict:
	"""One episode: meta.json plus series.json, and whether video.mp4 exists."""
	path = episode_dir(episode_id)
	series_file = path / "series.json"
	return {
		**read_meta(path),
		"has_video": (path / "video.mp4").is_file(),
		"series": json.loads(series_file.read_text()) if series_file.is_file() else None,
	}


@app.get("/api/episodes/{episode_id}/video")
def get_video(episode_id: str) -> FileResponse:
	video = episode_dir(episode_id) / "video.mp4"
	if not video.is_file():
		raise HTTPException(status_code=404, detail="no video for this episode")
	return FileResponse(video, media_type="video/mp4")


class StatusUpdate(BaseModel):
	status: Status


@app.patch("/api/episodes/{episode_id}")
def update_status(episode_id: str, update: StatusUpdate) -> dict:
	"""Set the curation status. Used by bulk Curate, Exclude, and Reset."""
	path = episode_dir(episode_id)
	meta = json.loads((path / "meta.json").read_text())
	meta["status"] = update.status
	(path / "meta.json").write_text(json.dumps(meta, indent=2))
	return read_meta(path)


# Mount last so that /api routes win. Present only after `npm run build`.
if WEB_DIST.is_dir():
	app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
