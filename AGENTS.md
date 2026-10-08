# AGENTS.md

## Content Lab development

Preserve the existing edit-plan contracts and keep generic renderer features
separate from DiazVerso-specific editorial choices.

### Required validation

For backend/parser/schema-only changes, run the relevant unit tests.

For changes that affect rendered pixels or the web UI (text, caption, layout,
camera, filters, chroma, motion, transitions, overlays, visual editor), do not
claim visual correctness from code inspection alone.

Run:

```bash
python -m unittest discover -s tests -q
python -m tests.visual_acceptance
```

Then start the app and inspect the matching fixture at:

```text
http://127.0.0.1:5000/visual-tests
```

If Iris MCP is available, use it as the visual camera. Prefer direct
checkpoint URLs such as `?case=word-stack` or `?case=crt-dim-png`, wait for
`data-visual-ready=true`, capture `#visual-frame`, and inspect the actual
pixels before reporting success.

For temporal behavior, inspect multiple checkpoints or play the generated
preview. Iris is not an audio validator; use the normal preview/render for
mixing and synchronization.

See `VISUAL_TESTING.md` for setup, checkpoint names and agent workflow.
