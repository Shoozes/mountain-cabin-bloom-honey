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

## Loose sprites from a PNG

Choose **Loose sprites (transparent PNG)** and one static PNG, then **Find
pieces**. Detection defaults to eight neighbors (edges and diagonals); four
neighbors keeps diagonal pixels separate. The sheet preview marks the detected
pieces at integer enlargement. IDs follow the first opaque pixel in row order.

Each piece starts in its own sprite group. Give detached pieces the same group
number to join them; ascending group numbers set frame order. Every piece is
retained exactly once. Detection does not identify body parts, directions or
walk poses, remove backgrounds, or discard isolated pixels. An opaque background
is ordinary source coverage and can connect otherwise separate sprites.

Choose 0–32 pixels of padding. All output frames use the largest group's bounds
plus padding and place each crop at `[padding,padding]` without scaling. The
display shows shared dimensions and the default bottom-center anchor; **Custom
anchor** applies explicit frame-space coordinates to every frame. Crops include
only their group members, even when boxes overlap or a separate sprite lies
inside a ring. **Convert pieces to recipe** commits the reviewed result. Undo
restores the previous drawing; completed imports retain their recipes on reload.
Cancellation, rejected input and unapplied source edits preserve the current
drawing. The temporary file/review selection itself is not a saved draft.

The headless SDK uses the same deterministic conversion:

```js
import {detectSpriteComponents, importSpriteComponents} from './packages/grout-art/index.mjs';

const analysis = await detectSpriteComponents(pixels, {connectivity: 8}, {signal});
const recipe = await importSpriteComponents(pixels, {
  connectivity: 8,
  groups: analysis.components.map(piece => [piece.id]), // explicitly join IDs here
  padding: 2,
  anchor: [8, 15],
  sourceName: 'my-sheet.png',
}, {signal});
```

Both APIs yield for cancellation. Input must be tightly packed RGBA8 with binary
alpha, at most 1,048,576 source pixels and 256 connected pieces. Conversion keeps
the existing 256-color/mask/run budgets, limits shared frames to 512×512 and total
output frame pixels to 1,048,576. Empty sheets, partial alpha and missing,
duplicate or invalid group IDs reject explicitly. Transparent RGB becomes zero.

The editable recipe remains `grout-art/1`; its import metadata uses the additive
`sprite-components/1` format. It records the original source name/hash/dimensions,
connectivity, pieces, ordered groups, crop bounds, padding and frame offsets.
Reconstruct source positions as `region.x/y + framePixel - region.offset`; holes
stay transparent. A generic eight-fps frame sequence is provided for inspection,
with no inferred animation semantics. Atlas export retains this metadata,
original anchors and exact trim reconstruction. SDK and browser export identities
include the component generator source. Existing `sprite-import/1` grid/GIF
metadata and commands remain unchanged.

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

The component extraction batch passed 411 tests, typecheck, SDK runtime/type
consumers, lint and both builds. Dev/built browser checks qualified grouping,
anchors, exact source and atlas reconstruction, malformed input, cancellation
during decoding/conversion, source guards, undo/recovery and decoded browser/CLI
exports. Twenty new component CPU/GPU comparisons and 164 neighboring
grid/GIF/outline comparisons are exact. Desktop/narrow captures and source-bound
receipts are retained under `sprite-components-20261017` in the qualification
index. See [the completed batch](../work/done/SPRITE-COMPONENTS-20261017.md).

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

AI-edited: 2026-10-17 | agent=Codex/root | task=sprite-components | change=documented explicit lossless loose-sheet detection, grouping, anchors and source reconstruction
