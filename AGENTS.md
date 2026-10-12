# Content Lab development — Node / Remotion migration

Read `README.md`, `EDIT_PLAN_REFERENCE.md`, `MOTION_ENGINE_STRATEGY.md`
and `SCENE_CACHE.md` before changing the automatic editor.

## Architecture

- Target backend: Node.js 22+; web UI: JavaScript; visual scene renderer: Remotion React/TypeScript.
- FFmpeg is retained for audio, source cuts, transitions and final assembly.
- There is **one JSON schema**, `schemas/edit_plan.schema.json`, and no top-level version field.
- Treat scene IDs as stable keys for persistent caches.
- The migration branch is not production-ready; do not remove the current stable backend
  or merge before checking media downloads, audio, overlays, editor and packaging parity.
- Use official Remotion documentation and HyperFrames composition/animation skills as
  references. Avoid introducing a second mandatory visual renderer.
- Do not reintroduce the obsolete full-encode Preview.

## Required validation

```bash
node --test server/*.test.mjs
node server/smoke.mjs
npm start
```

Verify `http://127.0.0.1:5000/health`, and inspect a rendered MP4 and its scene cache.
Review multiple frame checkpoints and listen to the audio before declaring visual
parity. Check both Windows and Linux. Tests alone do not prove correct pixels.
