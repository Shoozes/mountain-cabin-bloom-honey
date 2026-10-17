# Sprite images to editable recipes

In `/studio`, open **Import sprites & layers**. Choose a PNG or GIF, or select
multiple aligned files. The list runs bottom to top; use its arrows to change
stacking. Choose **Grid sheet** for regular cells (16×16 by default), with explicit
margin and spacing. Single sprite imports the whole image.

Conversion preserves visible colors and hard transparency, creates editable
palette roles and mask parts, and keeps each supplied file as an independent
layer. Identical masks share parts; painting forks frame corrections. It does
not infer body parts from a flattened image, remove rough pixels, recolor,
quantize, or add an outline. Undo restores the previous recipe. Recovery retains
the imported recipe; export uses the existing atlas/sheet/recipe workflow.

Animated GIF layers must share image size, frame count and durations; a static
PNG/GIF layer can remain fixed under an animation. Each grid cell receives its
own clip, preserving exact source durations through integer-fps frame holds.
Frames are ordered by source animation time, then sheet row. A static sheet gets
a row-major clip at 8 fps; edit clip semantics and timing in the recipe as needed.
The fixed export sheet remains three columns, with source grid metadata retained.

The headless SDK exposes `importSpritePixels(rgba, options, {signal})` and
`importSpriteLayers(layers, options, {signal})`. Layers provide `frames` of RGBA8
pixels and, for animation, `durationsMs`; browser decoding is separate. PNG and
GIF imports require binary alpha, at most 256 visible colors, 16 layers,
1,048,576 decoded source pixels, 256 output frames and 256 unique layer masks.
Additional run budgets bound generated shader work. Unsupported input fails
visibly and leaves the current drawing intact. Transparent RGB becomes zero.
No embedded script or automatic cleanup runs during conversion.

GIF decoding uses [ImageDecoder](https://developer.mozilla.org/en-US/docs/Web/API/ImageDecoder).
Browsers without it receive a PNG-sheet alternative. Animated PNG is rejected
explicitly. Timings not exactly representable at 1–60 fps are rejected; SDK
callers can explicitly override fps. Source filenames and SHA-256 identities
stay in `importedSprite`; export provenance identifies user-supplied artwork
rather than claiming independent authorship. Rights and attribution remain
with those sources. Reference files are not bundled into the repository.

## Outlines

Open **Outline** in Studio and enable **Preview & export outline**. Choose a
color, a width of 1–3 native pixels, and Stepped or Square corners. The effect
follows the combined visible layers in every frame; it fills only transparent
pixels near the source coverage. It never recolors an opaque source pixel or
changes parts, layers, frame ordering, anchors, palettes or clip timing.

Stepped corners use Manhattan distance (a cross at width 1); Square corners
include diagonals (a square footprint). Preview, thumbnails, timeline and PNG
exports use the same settings on CPU, WebGL2 and WebGPU. Turn the effect off to
restore original pixels exactly. Undo/redo, local recovery and recipe export
retain the settings. Unapplied source edits disable the controls. Fill and move
selection read the underlying layer, so the generated border does not become
painted source data accidentally.

**Export atlas kit** bakes the displayed outline into atlas and sheet PNGs while
keeping the original layers and optional effect editable in `recipe.json`.
`atlas.json` records the settings, whether they were baked, and fixed source-frame
bounds. Canvas dimensions and anchors stay fixed: outlines clip at frame edges.
Leave room in your source grid when a complete outer border is required. Existing
pixel outlines remain in the source; enabling this effect can make them thicker.

The optional `grout-art/1` recipe field is:

```json
"outline": {"enabled": true, "color": "#26323f", "width": 1, "corners": "stepped"}
```

Omit it for older recipes. Outline color is independent of the source palette.
The existing per-part `outline` graph operation still supports authored
four-neighbor borders inside a recipe. Runtime engine outlines remain a separate
choice; normally these borders are finished before export.

## Qualification

The Studio outline follow-up passed 388 tests, typecheck, lint and both builds.
Dev/built browser checks include 144 animated outline CPU/GPU comparisons and
3,516 neighboring sprite/import comparisons, all exact. Controls, playback,
source-edit guards, undo/recovery, mobile layout and baked browser/CLI exports
passed. The `studio-outline-20261016` qualification entry retains the source
identity, commands, captures and a supplied-layer before/after animation.

The 2026-10-16 profile/import pass passed 381 tests, typecheck, lint and both
builds, plus 3,516 exact CPU/GPU comparisons and dev/built desktop/mobile checks.
The [qualification index](grout-art-proof.json) binds the source and retained
receipts. Four existing lint warnings belong to historical terrain artifacts.

`node --test scripts/art-import.test.mjs` verifies exact colors, alpha, grids,
layer editing, timing, cancellation, palette budgets, atlas reconstruction and
optional outlining. `scripts/test-art-import-browser.mjs` exercises actual file
uploads on desktop/mobile, GPU parity, recovery, cancellation/retry, unavailable
GIF decoding and browser/CLI exports. Its original rectangle fixtures contain no
reference artwork. Use `--dev-url http://127.0.0.1:8080/` for dev, or omit it for
the current Pages build; `--proof-out` selects the evidence folder.

The supplied chibi GIF study is retained externally: four layers, four 250 ms
animation frames, nine 16×16 cells, nine clips, 36 composed frames. Its layer
order is 3,2,1,0 from bottom to top (hair above face). All 144 layer cells and 36
composites match an independent GIF decode exactly. Layer 0's rough pixels
remain editable and unaltered.

AI-edited: 2026-10-16 | agent=Codex/root | task=traveler-profile-import | change=documented exact layered sprite conversion and optional pre-export outlines

AI-edited: 2026-10-16 | agent=Codex/root | task=studio-outline | change=documented reversible outline controls, fixed bounds and baked exports preserving editable source
