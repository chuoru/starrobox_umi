# Episode viewer

## Sub-features

- One time cursor drives the video panel, the trajectory canvas, and five timeline lanes (SLAM status, gripper width, linear speed, IMU accel, IMU gyro).
- Lost-tracking segments are hatched, speed reads "not measured" there, and the path is dashed red with a hollow "estimate only" marker.
- With no `video.mp4`, the video panel says "No video imported for this episode".
- `?t=<seconds>` sets the initial cursor.

## How to get to it (user POV)

Click a card's **Open** link on Overview, or open `http://localhost:5173/episode/syn_0002`. `syn_0002` has three lost segments.

## Driving it with Playwright

`npm run e2e` in `web/` (see [overview.md](overview.md)) drives these keys on `syn_0002` and checks the frame counter after each: Right (+1 frame), Shift+Right (+30), Space (play, then pause), Home (shown as frame 1), N (next lost edge), `]` (next keyframe), End, and a drag on the timeline. Frames display 1-indexed.

## Gotchas

- Real `<video>` playback is not driven, because no seeded episode has a video.
- Orbit by drag, wheel zoom, resize, and the `[`, B, L, `-`, `+` keys are not driven.
- Loading and error states were reviewed in code only.
