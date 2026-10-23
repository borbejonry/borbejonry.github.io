# Surface Lab — Markerless WebAR reconstruction

This is the first reconstruction milestone for the WebXR project linked from the portfolio. It lives under `website/webXR/` so the GitHub Pages route can be `/website/webXR/`.

## Current milestone

- Three.js renderer and WebXR session lifecycle
- Runtime feature detection (does not infer support from user agent)
- WebXR hit testing for a reticle on real-world geometry
- Place multiple cubes on detected hit points
- Estimate floor-like / wall-like / angled surfaces from hit-pose orientation
- Reset placed objects
- Responsive mobile HUD and unsupported-device messaging

## Important distinction

This milestone does **not** yet reconstruct an entire room or paint textures across complete wall/floor polygons. The surface label is an orientation heuristic based on the hit pose, not semantic understanding. Native plane detection is requested as an optional capability but is not required for the basic hit-test workflow. A future milestone can consume plane polygon data on devices that expose it, draw surface boundaries, and fit Halloween panels to measured surfaces.

## Run / deploy

The page uses an ES module import from jsDelivr, so no build step is required. Serve the repository via GitHub Pages (HTTPS), then open:

`https://borbejonry.github.io/website/webXR/`

Use a supported Android device/browser with immersive WebXR AR and hit testing. Availability varies by device, browser version, installed AR services, permissions, and browser policy. iOS Safari does not currently offer equivalent immersive WebXR AR support.

## QA checklist

1. Open over HTTPS in supported Android Chrome.
2. Confirm the capability check enables Start AR.
3. Start AR and grant spatial tracking/camera permissions.
4. Sweep slowly across textured, well-lit surfaces.
5. Confirm the reticle appears and follows a surface.
6. Place a cube on a floor, then on a wall.
7. Reset the scene and end the AR session.
8. Verify unsupported browsers receive a clear message rather than a blank page.

## Next milestones

1. Inspect and port any reusable behavior from the old Bitbucket-hosted WebXR source if it becomes available.
2. Add native plane detection where exposed and visualize wall/floor polygon bounds.
3. Add an environment/surface abstraction so effects can target `floor`, `wall`, or `unknown`.
4. Add Halloween wall panels, floor decals, and spatially anchored props.
5. Add persistence/anchors and occlusion/depth where supported.
6. Add device testing notes and automated lint/build checks.
