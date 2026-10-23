# Grout Art: native sprite authoring

The first successor slice lives in this repository: `/studio` authors original
sprites, `/examples` routes six working recipes and inventories all 61 donor
pages. The texture mill, gallery, material recipes and classic/growth terrain
keep their existing commands and pixel contracts. The owner accepted the
Adventure-style traveler and wardrobe drawings as the base on 2026-10-16.
New apparel colorways, feet and centered backpack remain **unapproved until
owner visual acceptance**.

The [character creator](character-creator.md) is an additive workspace at
/studio?workspace=character: reusable creator definitions, nine build/style
combinations, compatible part randomization, and preserved custom drawing options.
It compiles to the same sprite recipe/export contract; the existing traveler
remains available unchanged in the ordinary sprite workspace.

## Start, edit and export

Run `npm run dev`, open `/studio`, and choose a native integer zoom. Pencil,
eraser, fill and rectangular selection operate on the selected layer and frame.
Move selected pixels with the Move tool; arrows position the drawing cursor.
Undo/redo retains up to 120
recipe states. Cap and backpack can be hidden independently. The backpack is
fully occluded in front-facing frames; its frame visibility is explicit. Studio
starts on a visible layer and explains when a selected layer is hidden in the
current frame. The timeline uses the
selected clip; the repeated middle pose is an intentional separate clip slot.
Onion skinning is a translucent previous-frame guide, excluded from exports.

The original 16×16 Fern traveler has four directions and three distinct poses
per direction, separate bag/body/clothing/cap layers, direction-specific
ordering and a fixed feet anchor `[8,15]`. Walking runs at eight fps; idle clips
reference the same authored full frames. A turntable clip compares directional
proportions using those same images. The revised NES-inspired candidate uses
four actual colors mapped to fourteen editable semantic roles, a larger outlined
hat, lower eyes and balanced contact soles. No Moss Post or purchased artwork is
included. Visible draft state, local recovery and source errors stay in the
workbench. Recipe JSON and shader diagnostics are behind disclosure. Export
packs the current valid recipe; cancellation retains the editable document.

Unreadable Sprite and Example recovery documents keep both their original draft
and source bytes. A fresh starter opens with local saving paused, including after
edits and reloads. **Replace saved draft** explicitly saves the current recipe and
source to that workspace only. Exports remain available while saving is paused.
An unreadable example never writes into the ordinary Sprite draft.

Open **Clothing & hats** beside the canvas to combine the travel coat, linen
tunic or trail vest with the wool cap, round cap or trail hat. **Colors** offers
Fern (original green), Cinder (teal/rust), Heather (violet/ochre), and Harbor
(blue/linen): 36 combinations. Apparel-only roles separate tunic and vest panels
from skin/hair. Presets keep portrait, leather and outline colors fixed; garment
selection preserves custom palette edits. The original preset retains its four
actual colors; the richer colorways use up to seven.

The revised feet use shaped contacts, a neutral repeated passing pose, profile
counter-swing and distinct rear heels. The rear backpack is centered on the
torso. Face, head, arms, garment drawings, outlines, twelve-frame structure,
`[8,15]` anchor and 8 fps clips retain the accepted base. Historical decoded
pixels and the pre-refinement editable recipe remain pinned in fixtures; the
new drawing expectations are separate and do not imply visual approval.

Selections preserve frame painting, visibility and unrelated drawings; Undo/redo
restores them. Old drafts keep their saved feet/backpack on load. The explicit
**Refine walk & backpack** button applies the new drawing reversibly, retaining
painted corrections and custom packs. Colorway selection also migrates old
known garment ink references without recoloring skin or hair. Unapplied recipe
text must be applied or reset before these controls. Other recipes remain
editable without conversion. Drafts and exports still use `grout-art/1`.

Reusable palette/animated-part families, locked seeded candidates and source-preserving
lossless transport are documented in [Sprite variations](sprite-variation.md).

The private ESM package is `packages/grout-art`, with declarations and separate
headless and browser entrypoints. It has no runtime dependency on the sibling
Grout checkout, a generated donor bundle or browser globals during Node import.

```powershell
npm run build:art-sdk
npm run bake:art -- --recipe .artifacts/grout-art-sdk/traveler.json --out .artifacts/art
npm run bake:art -- --recipe .artifacts/grout-art-sdk/traveler-wardrobe/tunic-trail.json --out .artifacts/art
```

`build:art-sdk` copies the private package, emits a readable starter recipe and
proves headless/declaration consumers. The CPU baker creates a source-addressed
folder and reuses it only after validating every expected byte, file and source
identity. It rejects damaged caches instead of silently accepting stale output.
Readable recipe JSON is kept apart from packed PNG output and compact metrics.
The SDK build also writes all 36 editable wardrobe recipes under
`.artifacts/grout-art-sdk/traveler-wardrobe/`. Use
`createTravelerRecipe({clothing: 'tunic', hat: 'trail', palette: 'cinder'})` for a fresh combination,
or `setTravelerWardrobe(recipe, {hat: 'round'})` to change one garment in an
existing accepted-anatomy recipe. `getTravelerWardrobe` detects current drawings,
including custom apparel and palette edits, without trusting extra metadata.
Original preset filenames remain unchanged; new colorways append their palette
id, for example `tunic-trail-cinder.json`. `refineTravelerWalk(recipe)` is the
explicit old-draft upgrade; it never runs automatically during recovery.

```js
import {parseRecipe, createRenderer, buildArtExport, extractFrame}
  from './packages/grout-art/index.mjs';
const recipe = parseRecipe(jsonText);
const renderer = await createRenderer({backend: 'auto'});
try {
  const rgba = await renderer.render(recipe, 0, {signal});
  const kit = buildArtExport(recipe, {signal});
  const originalSize = extractFrame(kit.atlas, recipe.frames[0].name);
} finally {
  renderer.dispose();
}
```

Import existing PNG/GIF sprites and aligned animated layers through the
[conversion workflow](sprite-import.md). Pixel masks stay editable; optional
recipe outlines are normally baked before engine receiving. The Studio
**Outline** disclosure previews color, 1–3 pixel width and stepped/square corners,
then bakes the same effect on export while retaining source layers and clips.
Existing pixel outlines are preserved; the effect clips to the source frame.

The latest profile correction changes only the far shoe in each side pose,
exposing it below the arm. Front/back decoded pixels, near shoes, palette values,
proportions, anchor and timing are unchanged. The pixel-art peer reviewed native
and enlarged contacts/passing poses without further correction. Owner approval
remains pending; preceding r3 recipes and hashes remain historical fixtures.

## Recipe and technique contract

`grout-art/1` stores dimensions, uint32 seed, named hex palette roles, reusable
parts, ordered layers, frame overrides, pixel-space anchors, clips and optional
portable technique modules. Frame order lists every layer exactly once. Each
override can change a part, visibility, integer offset or ordered correction
operations. Palette slot zero is a real opaque color; empty coverage is separate.
Erasing clears the selected layer and reveals lower layers.

Operations are integer rectangles, circles, authored character masks, reusable
part transforms, clipping, four-neighbor outlines, plane/hatch shading, seeded
clusters and custom techniques. Mask `.`/space is uncovered; other characters
map to palette roles. Built-in cluster hashing uses wrapping uint32 arithmetic.
Transforms use integer scale and optional axis flips. Nested part/clip groups
are isolated coverage groups. All generated pixels use alpha 0 or 255 and
nearest sampling. There is no legacy Grout-format importer or JavaScript eval.

A module has `id`, parameter definitions (`int` with bounds, or `role`), `cpu`
fallback operations and explicit `glsl`/`wgsl` function bodies. Coordinates are
`p`, the seed is `seed`, role parameters are integer palette indices. Return
`-1` for uncovered pixels or a valid palette index. The custom hatch example
shows the complete contract. CPU graphs use `$parameter` references. Register
with `registerTechnique(recipe, module)`; shader languages are not translated.
Module bodies are trusted author-supplied shader code and can fail compilation.

Parsing bounds recipe bytes, dimensions, frame pixels, operation expansion,
recursion and references before replacing source state. Drawing APIs validate
frame/layer/selection bounds. Renderer creation reports unavailable GPU paths
and falls back to CPU. A shader edit error reports its module and preserves the
last successful preview; source remains editable. Context/device loss reports a
recoverable error; select CPU or recreate the renderer. Stale results are
suppressed, active exports are abortable and route departure disposes renderers.

GLSL ES 3 uses integer geometry and RGBA8UI output; WGSL computes packed RGBA
into a storage buffer. Both evaluate the recipe graph directly; neither uploads
a completed CPU raster. Exactness applies to this qualified integer profile.
Continuous floating-point techniques need separate device qualification under
the [GLSL ES 3 specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
and [WGSL accuracy rules](https://www.w3.org/TR/WGSL/#floating-point-accuracy).

## Export contract

Exports contain `recipe.json`, required portable modules in `techniques.json`,
`atlas-N.png`, `atlas.json` (`grout-atlas/1`), `sheet.png` and
`phaser-atlas.json`. Source-preserving `recipe.optimized.json` and
`optimization.json` are additive sidecars. CLI output also includes `metrics.json`. Packing defaults
are trimming, one-pixel padding and extrusion, no rotation and pages at most
1024×1024. The untrimmed traveler sheet is three columns by four rows (48×64).
The manifest retains original names/dimensions, trim offsets, page rectangles,
pixel-space anchors, clips/fps, straight cutout alpha, nearest sampling,
provenance, source identity and asset digests. Browser and CLI source identities
describe their respective entrypoints; decoded pixels must agree.

`extractFrame` restores transparent margins to the original frame size. Anchor
coordinates remain in source space and do not move with trimming. Phaser 4
single-page output is JSON hash atlas metadata; multipage output is multiatlas
`textures` metadata. Phaser pivots are normalized from pixel anchors; clips and
pixel anchors remain authoritative in `atlas.json`. Engine receiving is a later
batch; this pass proves metadata and lossless reconstruction locally.

An optional [CSS sprite sidecar](css-sprites.md) adds source-sized frame classes
and discrete clip playback. Enable Include CSS sprites under Studio's Export
options or pass `--css` to the atlas baker. Default kits retain their existing
asset set; native PNGs and editable recipes remain exact.

Optional [animated GIF export](gif-export.md) adds one native-sized GIF per clip
with exact local palettes, cutout transparency and recorded centisecond delays.
Enable Include animated GIFs under Export options or pass `--gif`; it composes
with CSS without changing the recipe or existing PNG exports.

## Measurements and migration ownership

The comparison example measures readable/minified recipes, gzip, expanded frame
graphs, RGBA frames, actual atlas PNGs and the complete distributable SDK source.
Shared runtime is counted once; modules are already included in recipe cost.
Runtime cost includes the shipped starter definitions and source, not a claimed
optimized/minified runtime bundle. Raw and gzip totals use a stated source basis.
The packed PNG alternative includes reconstruction/clip metadata and names the
host PNG decoder basis; receiving engine code is excluded from that alternative.
Shader representations are not presumed smaller than PNG. Its renderer probe
reports actual backend, elapsed time and differing bytes against CPU for the
selected first frame; the broader test harness qualifies all twelve frames.

The single registry is `src/art/examples.mjs`: 61 donor pages, 13 topical groups,
source paths/commit, detailed tags, backend requirements, provenance and migration
status. Donor links may require repository access. Only local working recipes
receive launch actions; partial ports do not claim donor parity.

| Capability | Current owner/status | Next qualification |
| --- | --- | --- |
| Native geometry, palette roles, layers, frame mapping | SDK integer graph; delivered | Richer independent art |
| Original animation and equipment layering | Traveler and Studio; delivered | Owner art acceptance |
| CPU, GLSL and WGSL generation | Direct graph execution; delivered integer profile | Continuous math per device |
| Portable custom modules | Both shader bodies plus CPU graph; delivered | Module packaging/version policy |
| RGBA packing, trim, extrusion, extraction | Adapted donor algorithm; delivered | Consumer engine receiving |
| Painting, fill, selection, undo/redo | New Studio state; delivered | Larger-canvas interaction study |
| Seeded variations and measured compactness | Reusable palette/part families, locks, candidate batches and lossless authoring transport delivered | Compact consumer runtime and broader donor parity |
| Conversion and sprite extraction | PNG/GIF grids, aligned layers and reviewed transparent-sheet components delivered | Broader conversion workflows |
| GIF/SVG/CSS workflows | Animated GIF import, opt-in exact-color GIF clip export and native CSS frame/clip export qualified | SVG fidelity; broader donor parity |
| Fonts, UI atlases and remaining examples | Inventoried; donor retained | Native layout and consumer parity |
| Engine adapters and compact runtime delivery | Donor retained | Actual receiving application proof |
| Grout13 ownership and parent synchronization | Unchanged in donor | Transfer only after relevant replacement qualification |

Atlas code was adapted from `Grout-Library/src/atlas/rgba-atlas.js` at
`34016ee18a7e9b072495d728a0be1e02caf232a6`; its MIT notice is retained in
`packages/grout-art/LICENSE.grout-library.txt`. Other recipes, artwork and graph
execution are independently authored. The donor repository remains unchanged.

## Drawing study and references

The owner rejected the first thin, over-detailed traveler. We redrew native
masses and contours, then applied the pixel-art agent's concrete review:
reconnect coat clusters, put skin between eyes and brim, balance planted soles
and separate the hand from the satchel. Pixel equality is a technical property;
it does not establish visual quality or owner acceptance.

Study sources supplied by the owner:

- [SLYNYRD: introduction to animation](https://www.slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation): readable stride/pass keyframes and careful looping clusters.
- [SLYNYRD: top-down characters](https://www.slynyrd.com/blog/2019/10/21/pixelblog-22-top-down-character-sprites): condensed head/body proportions and consistent facing.
- [Sandro Maglione: top-down design and animation](https://www.sandromaglione.com/articles/pixel-art-top-down-game-sprite-design-and-animation): low-set eyes, simple alternating steps and readable small silhouettes.
- [SLYNYRD: top-down animation](https://www.slynyrd.com/blog/2025/3/24/pixelblog-55-top-down-character-animation): compare orientations in rotation and synchronized motion; simplify equipment shapes that become noise.

- [Saint11 tutorial index](https://saint11.art/blog/pixel-art-tutorials/): further technique study, including the owner-supplied animated walk/contact references.

The supplied example sheets and helmet characters inform visual study only;
their pixels, palettes and drawings are not imported into this package.

The anatomy/outline follow-up applies the owner's specific corrections:

- Front-facing poses completely hide the backpack; profiles tuck it behind the
  shoulder and the rear view exposes it.
- Profile arms follow a fixed shoulder through a connected sleeve, wrist and
  hand. The hand swings forward and back opposite the near leg, with the same
  body bob as the shoulder. Front/rear arms also have drawn sleeve/hand contours.
- Skin, sleeves, boot highlights and gear use the same dark outer contour. A
  decoded-pixel check covers all twelve poses and all cap/backpack combinations;
  interior color planes retain their grouped fills.

[SLYNYRD's 8-bit Adventure](https://www.slynyrd.com/blog/2022/1/25/pixelblog-36-8-bit-adventure)
informs the native16, three-colors-plus-outline economy and emphasis on readable
key poses. The larger anatomy study informs shoulder pivots, counter-swing and
consistent limb proportions. These are technique references, with no imported
art or palettes. The owner judged the correction better and technically correct,
but prefers the tutorial styles.

The subsequent Adventure-style pass keeps one traveler and the existing four
colors. An asymmetric sloped cap, broader head and tapered cheeks dominate a
shorter coat. Three-pixel shoes tuck inward at contact and overlap in passing;
the near sole remains at y15 and the far shoe lifts to y14. Shoulder-based arms
counter the legs without detached hands. All twelve native drawings retain the
same frame names, editable layers, fixed anchor and 8 fps walk clips.

The pixel-art agent reviewed the native sheet, integer comparison and all four
walk-cycle frames, requested narrower contact shoes, and found no blocking
visual regression in the revised candidate. Their independent decoded export
check matched its sheet exactly. The original-only study and actual walk GIF
are bound in the `traveler-style-20261016` follow-up qualification record.
The owner subsequently selected this cycle as the base and requested clothing
and hat variants. The wardrobe pass preserved that base byte-for-byte and
adds two garments and two hats. The pixel-art review narrowed the tunic's light
panel and named the rounded silhouette a cap rather than a hood. The study
applies proportion and animation techniques without
importing tutorial pixels, palettes or character designs.

## Local verification

Run focused `node --test scripts/art.test.mjs`, `npm run build:art-sdk`, then
`node scripts/test-art-browser.mjs --dev-url http://127.0.0.1:8080/`.
After `npm run build:pages`, run `node scripts/test-art-browser.mjs` for built
output. The harness serves copied SDK modules through an exact test allowlist,
with executable MIME and unknown paths rejected, and exercises the actual app
separately. It records actual GPU backend/adapter information, exact pixel
comparisons, exports/recovery and desktop/mobile captures under ignored
`.artifacts/proof/grout-art-browser` by default (the existing verifier-path
exception). `--proof-out <directory>` supports the shared evidence run location
for new retained output; old evidence is not moved. Required repository tests, typecheck, lint
and both existing builds remain closeout gates. Durable proof is summarized in
`grout-art-proof.json`; retained native/integer art studies contain original art.

AI-edited: 2026-10-16 | agent=Codex/root | task=grout-art-successor | change=documented the first original sprite pipeline and explicit migration boundaries

AI-edited: 2026-10-16 | agent=Codex/root | task=traveler-anatomy | change=recorded backpack occlusion, connected arms, consistent contours and the owner's remaining style preference

AI-edited: 2026-10-16 | agent=Codex/root | task=traveler-style | change=recorded the reviewed single-character silhouette and walk refinement before variants

AI-edited: 2026-10-16 | agent=Codex/root | task=traveler-wardrobe | change=recorded accepted base, additive apparel combinations, editable exports and reversible wardrobe controls

AI-edited: 2026-10-16 | agent=Codex/root | task=traveler-palette-feet | change=documented apparel palettes, authored gait, centered pack and explicit draft upgrade

AI-edited: 2026-10-17 | agent=Codex/root | task=character-review-cleanup | change=documented protected unreadable Sprite and Example drafts and explicit replacement

AI-edited: 2026-10-17 | agent=Codex/root | task=sprite-components | change=recorded the delivered transparent-sheet extraction capability

AI-edited: 2026-10-16 | agent=Codex/root | task=traveler-profile-import | change=added layered import route and far-shoe qualification boundaries

AI-edited: 2026-10-16 | agent=Codex/root | task=studio-outline | change=linked non-destructive outline controls and export behavior

AI-edited: 2026-10-17 | agent=Codex/root | task=sprite-variation | change=routed variation/optimization and additive export contracts

AI-edited: 2026-10-23 | agent=Codex/root | task=css-sprites | change=linked optional CSS frame/clip export and scoped capability qualification

AI-edited: 2026-10-23 | agent=Codex/root | task=gif-export | change=linked optional GIF clips and qualified file/decoder boundaries
