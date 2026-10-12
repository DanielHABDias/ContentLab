# Content Lab development — Node / Remotion migration

Read `README.md`, `EDIT_PLAN_REFERENCE.md`, `MOTION_ENGINE_STRATEGY.md`
and `SCENE_CACHE.md` before changing the automatic editor.

## Architecture

- Target backend: Node.js 22+; web UI: JavaScript; visual scene renderer: Remotion React/TypeScript.
- FFmpeg is retained for audio, source cuts, transitions and final assembly.
- There is **one JSON schema**, `schemas/edit_plan.schema.json`, and no top-level version field.
- Treat scene IDs as stable keys for persistent caches.
- The backend is Node-only. Protect the currently working project API, scene cache,
  renderer and media workflows. Review real media downloads, audio, overlays, the editor
  and distribution whenever making release changes.
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


## Studio UI

Follow `STUDIO_UI.md` for navigation and scene-editing conventions.
Keep existing DOM IDs when reworking `frontend/templates/index.html`, since
`frontend/static/app.js` and `visual_editor.js` bind controls by ID.
The new `studio.css` layers visual design over existing functional CSS.
Never render video as a side effect of merely selecting or previewing a scene.
The scene playback API must validate project IDs, manifest entries and file
metadata. Preserve the distinction between a cached previous version and a
newly edited draft. Run browser and backend tests before merging UI changes.

## Documentação e skill

Atualize `server/docs-fields.mjs` sempre que acrescentar campos no schema e `server/docs-content.mjs` quando mudar comportamentos. Os diagramas são produzidos em JS por `server/docs-diagrams.mjs`. Execute `npm run docs:generate` e `npm run docs:check` e mantenha os três downloads oficiais apenas na aba de documentação: MD, HTML e skill ZIP. A skill usa as mesmas funções de geração do site; nunca copie manuais estáticos inconsistentes para ela.
