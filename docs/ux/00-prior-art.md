# Prior art: presenting robot-learning episode datasets

Scope: how existing tools show episode datasets, and what is missing for UMI-style data (fisheye wrist video, SLAM 6DoF trajectory, gripper width, IMU, language). Surveyed 2026-11-01.

Verification key: **V** = read on the cited page. **U** = not verified (page did not say, or not opened). Several pages were summarized by a fetch tool, not read verbatim; screenshots were not seen.

## 1. Tool notes

### LeRobot dataset visualizer
Source: https://github.com/huggingface/lerobot-dataset-visualizer
- V: Web app. Sidebar plus navigation controls to move between org, dataset, episode.
- V: Video playback synchronized with interactive charts of sensor/control signals.
- V: Panels: Overview (metadata, cameras, episode details), Statistics (episode count, total time, fps, episode-length histogram), Action Insights (autocorrelation, state-action alignment, speed distribution, cross-episode variance heatmap), Filtering, 3D URDF Viewer (joint poses per frame, end-effector trail; SO-100, SO-101, OpenArm only), Annotations.
- V: Filtering flags episodes for low movement, jerky motion, outlier length; exports flagged IDs as a LeRobot CLI command (curation output is a command, not a mutation).
- V: Annotations edits the v3.1 language schema (subtasks, plans, memory, interjections, speech, VQA); bbox/keypoint overlays on video; save to parquet / Hub push needs an optional FastAPI backend, otherwise session storage only.
- V: Panels lazy-load; data paginated/chunked.
- U: exact screen layout, whether there is a dedicated episode list.
- Missing for UMI: no SLAM tracking-quality concept, no free-form 6DoF camera trajectory view (URDF viewer needs a known robot), no gripper-width-specific view (it would be one more plot line), no IMU view, no fisheye awareness.

### Rerun
Sources: https://rerun.io/docs/getting-started/data-in/python , https://rerun.io/examples/integrations/lerobot_loader , web search result listing LeRobot's older `visualize_dataset.py`
- V: Data model is entity paths (hierarchy; parent transforms apply to children) logged against one or more named timelines; viewer shows latest-at value per entity at the current time. Custom timelines are deterministic; default `log_time` is wall-clock.
- V: Views named: Spatial 2D, Spatial 3D, Time Series, plus a timeline/time panel and blueprint panel. A stable ApplicationId preserves UI state across runs.
- V: Built-in LeRobot loader: open a dataset dir in the viewer or `rerun <dataset_dir>`.
- V (search snippet only): old LeRobot script could stream over websocket (`rerun ws://localhost:9087`) or save `.rrd`.
- U: blueprint details, scrubbing behavior, which views the LeRobot loader creates (page text did not say).
- Missing for UMI: generic; no notion of an "episode list", dataset-level stats, curation/accept-reject, or language annotation. SLAM quality would have to be logged as scalars by us.

### Foxglove
Source: https://docs.foxglove.dev/docs/visualization/panels/introduction
- V: Modular panels arranged into saved/importable layouts; panel top bar (split, change type, expand, settings); settings in a sidebar, editable as JSON; selected panel has a purple border.
- V: Topics tab filters topics and nested fields; results can be dragged into Raw Messages, Table, Image, Plot, State Transitions panels.
- U: playback bar, synchronized timeline, annotations (the fetched page did not cover them). Foxglove is primarily ROS/MCAP-oriented; not verified here.
- Missing for UMI: needs data converted to MCAP/ROS-style topics; no episode-level dataset browsing, no curation.

### UMI's own tooling
Sources: https://github.com/real-stanford/universal_manipulation_interface , .../tree/main/scripts_slam_pipeline , .../tree/main/scripts , .../blob/main/scripts/slam_pose_replay.py
- V: Pipeline scripts `00_process_videos.py` ... `07_generate_replay_buffer.py` (listing may be truncated). Output is zipped zarr (`dataset.zarr.zip`).
- V: Quality feedback is console text: README example shows camera serial table, fraction of raw data used (99%), dropped demos (0). README calls ORB-SLAM3 "the most fragile part of UMI pipeline" and says low success suggests collection problems.
- V: `scripts/` has `slam_pose_replay.py` (replays pose pickle on a UR arm via RTDE; console output only), `replay_real_robot.py`, `draw_aurco_detection.py`, `draw_charuco_detection.py`, `detect_bad_rotation.py`, `check_gopro_orientation.py`, `filter_videos.py`, `generate_video_thumbnail*.py`, `count_dataset_videos.py`.
- V: file names only for most of these; contents not read except `slam_pose_replay.py`.
- U: whether any script shows a GUI trajectory or video-with-overlay viewer. None found by name. Gripper-width handling not described in README (`calibrate_gripper_range.py` exists by name).
- Missing: effectively no dataset viewer. This is the gap the app fills.

### RLDS / Open X-Embodiment
Sources: https://github.com/google-research/rlds , https://github.com/google-deepmind/open_x_embodiment
- V: RLDS defines Episode (dict with a Dataset of Steps plus metadata such as `episode_id`, `invalid`) and Step (`is_first`, `is_last`, observation, action, reward...). Its README mentions no viewer.
- V: OXE offers a Colab that visualizes a few episodes per dataset and builds batches; dataset list/metadata lives in a separate spreadsheet; no standalone browser mentioned.
- U: Colab contents beyond the description; any third-party RLDS web viewers.
- Missing: notebook-level inspection only; no episode list, filtering, or curation UI.

### FiftyOne (general ML curation)
Source: https://docs.voxel51.com/user_guide/app.html (only first ~100k of 221k chars read)
- V: Grid of samples with sort-by field; sidebar with per-field filters and overlay toggles (labels, tags, scalars); grid updates live as filters change; tags can be overlaid; a bookmark icon turns active filters into view-bar stages; sample modal; group datasets (multi-view samples); video datasets with frame-level filtering that is slow without summary fields.
- U: saved views, similarity search, embeddings (pages listed in nav but not read).
- Missing: no robot-trajectory or time-aligned multi-signal view; sample = image/video, not an episode with aligned streams.

Weights & Biases Tables: not opened; no claims made.

## 2. Comparison

| Tool | Unit shown | Layout | Key interactions | Time-synced video + signals | 3D pose / trajectory | Curation | Language | SLAM quality / gripper width / IMU |
|---|---|---|---|---|---|---|---|---|
| LeRobot visualizer | Episode | Sidebar + tabbed panels | Navigate org/dataset/episode; filter flagged episodes; draw annotations | Yes (V) | URDF robots only | Flag + export CLI command | Yes, editable | None built in |
| Rerun | Recording | Dockable views + time panel | Scrub timelines, latest-at | Yes (V, general) | Yes, Spatial 3D | No | No | Only as logged scalars |
| Foxglove | Log/topics | Panel layouts, saved | Drag topic into panel; edit settings | U | Panel exists (not verified) | No | No | Only as topics |
| UMI scripts | Session/folder | CLI, console text | Run scripts | No GUI found | No GUI found | Scripts drop demos (`filter_videos.py`, name only) | No | Console % used / dropped |
| RLDS / OXE | Episode | Colab notebook | Code | Notebook frames | No | No | Dataset-dependent (U) | No |
| FiftyOne | Sample | Grid + sidebar + modal | Filter, tag, sort, saved view | Video only | No | Tags, views | Label fields | No |

## 3. Steal-this patterns

1. **Synchronized scrub: one playhead drives video, signal plots, and 3D pose** (LeRobot visualizer, Rerun latest-at semantics). Show a cursor on every plot; gripper width and IMU as stacked strips under the video.
2. **Dataset-level statistics page before episode view** (LeRobot Statistics, Action Insights): episode-length histogram, speed distribution, cross-episode variance. For us add SLAM-success rate, tracked-frame fraction, width-range coverage.
3. **Auto-flagging with explicit export, not silent deletion** (LeRobot Filtering: low movement, jerk, outlier length, exported as a command). Apply to SLAM lost segments, pose jumps, width saturation; keep flags reversible.
4. **Sidebar filters + tags + grid of thumbnails -> modal** (FiftyOne): episode grid with a poster frame, live filters, bookmark filters into saved views. UMI ships thumbnail scripts (name only), so thumbnails are a known need.
5. **Free-form 3D trajectory with end-effector trail** (LeRobot 3D viewer trail, Rerun Spatial 3D): do this without a URDF, as a camera frustum plus trail colored by tracking state or gripper width.
6. **Language annotation as time-ranged spans on the timeline, with overlays editable on video** (LeRobot Annotations: subtasks, plans, bbox overlays). Keep session-local drafts with explicit save.
7. **Saved panel layouts and persisted UI state** (Foxglove layouts, Rerun stable ApplicationId): remember the user's panel arrangement across episodes.
8. **Lazy-load and paginate** (LeRobot): load only the visible episode's video/arrays; relevant for large fisheye footage.

## 4. Gaps none of these cover (for UMI-style data)

- Per-frame SLAM tracking state (tracking / lost / relocalized), map-point counts, scale/initialization status, shown on the timeline and on the trajectory. Not found in any surveyed tool (only UMI's console percentage).
- Gripper width as a first-class signal with calibrated range and saturation markers. Not found.
- Fisheye-aware video (masks, undistortion toggle, gripper-finger mask). Not found.
- IMU vs. SLAM consistency view. Not found.
- Link from episode to the raw source recording and to the zarr replay-buffer index. Not found.
- Single place combining curation (accept/reject), language annotation, and quality metrics. LeRobot's visualizer is the closest.

## 5. URLs opened

- https://github.com/huggingface/lerobot-dataset-visualizer
- https://rerun.io/docs/getting-started/data-in/python
- https://rerun.io/examples/integrations/lerobot_loader
- https://docs.foxglove.dev/docs/visualization/panels/introduction
- https://github.com/real-stanford/universal_manipulation_interface
- https://github.com/real-stanford/universal_manipulation_interface/tree/main/scripts_slam_pipeline
- https://github.com/real-stanford/universal_manipulation_interface/tree/main/scripts
- https://github.com/real-stanford/universal_manipulation_interface/blob/main/scripts/slam_pose_replay.py
- https://github.com/google-research/rlds
- https://github.com/google-deepmind/open_x_embodiment
- https://docs.voxel51.com/user_guide/app.html (partial)
- Failed: https://rerun.io/docs/concepts/visualization/overview (404)
