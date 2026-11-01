# starrobox_umi

starrobox_umi turns recordings from Insta360 and GoPro cameras into training data for robot learning. You import a recording, the app runs ORB-SLAM3 on its images and IMU data, and you inspect the resulting camera trajectory in the app's user interface.

> **Status:** This README is a draft written before the code exists. Every `TODO` marks a fact to fill in once the code lands. Replace each one with the real command, path, or version, and delete this note.

## What the app does

1. **Import.** You select a recording from an Insta360 or GoPro camera. The app extracts the video frames and the IMU samples (accelerometer and gyroscope) from it.
2. **Convert.** The app runs ORB-SLAM3 in visual-inertial mode on the frames and IMU samples. ORB-SLAM3 estimates the camera pose for each frame.
3. **Visualize.** The user interface shows the frames, the estimated trajectory, and the IMU signals so that you can judge the result before you use it.
4. **Export.** The app writes the poses and frames as a training dataset. TODO: name the output format.

## Supported cameras

| Camera | Recording format | IMU source |
| --- | --- | --- |
| Insta360 | TODO: for example `.insv` | TODO |
| GoPro | TODO: for example `.mp4` | TODO: for example GPMF telemetry in the `.mp4` |

TODO: list the tested camera models and firmware versions.

## Requirements

- Docker with Compose. On Windows, use Docker Desktop with WSL2.
- A browser.
- Node.js 22, only if you run the frontend outside Docker.

## Architecture

- `backend/`: FastAPI. It exposes `/api/*` and runs ORB-SLAM3, which is built into the Ubuntu 22.04 image from `docker/Dockerfile`.
- `web/`: Vue 3 with Vite and TypeScript, styled with Bootstrap 5 and Sass. The design follows `FCC_DASHBOARD/client`: `B*` wrapper components in `src/components/bootstrap/`, shared components in `src/components/shared/`, and `src/layouts/MainLayout.vue`. The Vite dev server proxies `/api` to the backend. In Docker it polls for file changes, so edits made on Windows show up.
- `docs/ux/`: design sketches for each screen. Build the screens from them.

## Install and start

```sh
docker compose up -d --build
```

The first build compiles ORB-SLAM3 and takes about 20 minutes. Later builds use the cache.

Open `http://localhost:5173`. The header shows `backend: up` when the API answers. The API explorer is at `http://localhost:8000/docs`. To stop the stack, run `docker compose down`.

TODO: document how to build the frontend into `web/dist` so the backend serves it in one container.

## Convert a recording

To convert a recording and view the result:

1. Start the app.
2. Click **Import**, then select the recording from your camera.
3. TODO: select the camera calibration, or state that the app detects it.
4. Click **Run ORB-SLAM3**. TODO: describe the progress indicator.
5. When the run finishes, open the trajectory view. You should see TODO: describe the expected result.

ORB-SLAM3 in visual-inertial mode needs a calibration for the camera: the lens intrinsics, the transform between the camera and the IMU, and the IMU noise values. TODO: state where the app reads these values from and how to create them for a new camera.

## Output

TODO: document the files the app writes, with their paths and fields. Link to a sample dataset.

Dataset layout, for example:

```text
TODO
```

## Project layout

TODO: generate this section with a command, and paste the command here so the tree stays true. For example, `tree -L 2`.

## Troubleshooting

TODO: add the failures you hit in practice. A common one for ORB-SLAM3 is a lost track at the start of a recording, which usually means too little camera motion for the IMU to initialize.

## License

TODO. ORB-SLAM3 is licensed under GPLv3, so check how that affects this project.
