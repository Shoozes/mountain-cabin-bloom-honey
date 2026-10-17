# Curated terrain and native autotiles

The curated edition is additive. Classic `retro-terrain` and
`retro-terrain-growth` retain their recipes, commands and decoded pixels; twelve
seed/palette combinations are pinned independently. Artwork remains **unapproved**.

## Native drawing

The expanded candidate supplies dirt, grass, gravel, moss, exposed rock, stone
masonry and timber. Each material has four independent compositions at native
16px and independently drawn 64px, with normal and weathered counterparts.
The pixel-art agent reviews each 16px base at native size and integer enlargement
before its alternatives. Grouped leaves, unequal soil planes and angular stone
aggregates replace recurring hooks, paired scuffs and aligned marks. Moss uses
irregular mats; rock uses broad fractures; masonry and timber use shared courses
and unequal planks. Compositions change forms and negative space, without
translation, rotation or palette swaps masquerading as new drawings.

The editable source is `src/shader/retro-terrain-art.mjs`. Native 16px drawings
use three grass, three soil and four gravel roles. Those original RGB ramps stay
exact in all three moods. Moss adds three original roles; rock, masonry and timber
add four each. The 64px grass/soil/gravel budgets remain 8/12/12; new material
budgets stay 3/4/4/4. Woodland, Dry trail and Cool moor compare identical geometry.
Purchased pixels, extracted ramps and reference artwork are not inputs.

Natural compositions and weathering share quiet two-pixel seam bands at 16px
and four-pixel bands at 64px. Manufactured surfaces share primary course/plank
structure across those bands, with interior chips, grain and knots kept away
from fixed seam anchors. Seeds select authored compositions by cell, without sampling
noise or interpolation, including boundary cells. Canonical topology sheets use
composition zero; connected previews place the exported surface alternatives
inside those same silhouettes, with soil selected independently at every boundary.
Weathering removes complete secondary features and preserves primary forms;
editable tuples can mark features as `structure` or `detail`. Terrain and path
masks clip primary rock planes to the terrain shape, then retain or omit whole
secondary clusters. Native blob detail resolves after quadrant assembly so an
8px cut cannot leave half a leaf or stone.
Straight small paths use quiet compressed earth; occasional whole chips belong
to other pieces rather than repeating at every cell center.

## Topology and source sheets

The native 16px edition adapts Grout-Library's mask table and template layout
from commit `34016ee18a7e9b072495d728a0be1e02caf232a6`. Its MIT notice is retained
in [the repository](../licenses/grout-autotile-MIT.txt) and every exported kit.
No bundled Grout artwork or sibling-repository runtime dependency is used.

Blob bits are N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128.
Diagonals require both adjoining cardinal neighbors. All 256 input masks
normalize to 47 cases. The 12×4 atlas is 192×64; mask zero is canonical at
column 10, row 1, with an identical alias at column 0, row 3.

Source sheets are 96×96: base 3×3 at (0,0), overlay 3×3 at (0,48), inner
corner 2×2 at (48,0), and outer corner 2×2 at (48,32). Eight-pixel quadrants
copy at native scale. Inner patches and four convex whole-tile replacements
use explicit orientation; the original demo's 4×4 enlargement is not used.
Grass/dirt, gravel/dirt, moss/dirt and rock/dirt each supply normal and weathered
sets. Manufactured surfaces are repeatable material tiles without terrain sets.

The 64px edition preserves the four-corner model: NW=1, NE=2, SE=4, SW=8,
for grass/dirt, moss/dirt and rock/dirt, with disconnected diagonal foreground
cases. Gravel remains surfaces and paths at this size. Path bits are separately N=1, E=2,
S=4, W=8. All sixteen path pieces use hard alpha and zero transparent RGB;
mouths are six pixels at 16px and twenty pixels at 64px.

## Authoring and export

Open **Adjust → Retro terrain → Curated edition**. Choose native size,
palette and seed; composition selection is `mixed | 0 | 1 | 2 | 3`. Compare all
seven surfaces, individual and mixed normal/weathered 4×4 repeats, source sheets,
supported connected terrain relationships and gravel paths. Preview canvases use
integer device-pixel scales; large scenes scroll horizontally when needed.
The two earlier kits
remain selectable; old local drafts recover without migration.

```json
{"id":"retro-terrain-curated","tileSize":16,"seed":1204,"palette":"woodland"}
```

```powershell
npm run bake:retro-terrain-curated -- --tile-size 16 --seed 1204 --palette woodland --out .artifacts/retro-terrain-curated
```

Sizes are 16 or 64; palettes are `woodland`, `dry-trail`, `cool-moor`. The
default recipe is 16px Woodland with seed 1204. CLI seed and output are required;
explicit flags must agree with a supplied recipe. Unknown settings fail before
output mutation. Exports include every composition, transitions, path layers,
atlases, original source sheets at 16px, connected previews, editable
`art-source.json`, recipe, MIT notice and `retro-terrain-pack/2` manifest.

The 16px package has 490 PNGs; 64px has 198. Both include four additional
text/JSON files. The manifest records roles, topology, atlas coordinates,
composition and boundary rules, sampling, source hashes and original provenance.
Browser and CLI PNG encodings can differ; decoded RGBA is the shared contract.
Generator identity is `retro-terrain-curated/2`; the recipe and pack schema stay
unchanged. Source identity prevents reuse of earlier generator outputs as the new
candidate. CLI caches use exact regenerated-byte validation. Errors,
retry and cancellation remain visible in the existing exclusive-preview flow.

## Review and limits

Structural proof covers dimensions, palettes, opacity, all masks, adjoining
material profiles and fixed path mouths. Visual review covers native drawings,
integer enlargement, repeats and connected islands, holes, narrow links and
concave boundaries. The linked [pixel-art agent](codex://threads/01a10aa2-1783-7521-937e-2d3145e85f24)
identified clipped boundary marks and dotted path chips; those received the
whole-cluster/quiet-strip repair. Shared edge art can still reveal periodicity.
Earlier polish shortened the showcase path before the isolated grass
cell, replaced 64px noisy scallops with authored broad corner runs, and regrouped
the existing grass/soil marks. Quiet grass/soil seam planes replace fixed repeated
landmarks. The subsequent [gravel polish](retro-terrain-gravel.md) removes its shared
crossing at both sizes and redraws the interior aggregates after the native 16px
review. That historical pass kept three compositions. Its
[source-bound study](studies/retro-terrain-gravel-20261012/study.json)
retains twenty original-only figures, including normal/weathered gravel repeats,
palette comparisons and connected terrain/paths. Earlier studies remain historical.

```powershell
node scripts/study-retro-terrain-curated.mjs --verify --out docs/look-dev/studies/retro-terrain-expanded-20261012-final
```

Technical verification does not approve the artwork. The
[expansion work](../work/done/RETRO-TEXTURE-EXPANSION-20261012.md) binds the new
candidate's progress and verification. The [gravel receipt](retro-terrain-gravel-proof.json),
[cleanup receipt](retro-terrain-cleanup-proof.json) and
[integration receipt](retro-terrain-curated-proof.json) retain evidence at their
own source identities. Gravel is the unpublished starting candidate; earlier
cleanup/integration publication does not approve this artwork.

Engine receiving, PBR channels and runtime shader anti-tiling remain separate.
Current acceptance and proof are linked from [TODO](../TODO.md).

The expansion's first two drawing checkpoints are retained as `46fa7360…`
(terrain) and `603588c2…` (moss/rock). Their immutable source and native review
figures live under `.artifacts/retro-terrain-expansion/artist/`; root's pass checks
cover 144 and 240 drawing/palette cases. The final seven-family source adds 336
drawing/palette cases. [Final proof](retro-terrain-expansion-proof.json) records
342 tests, both builds and dev/built browser matrices (6,192 PNG pairs each).
The [current 52-figure study](studies/retro-terrain-expanded-20261012-final/study.json)
includes normal/weathered terrain, every composition's 4×4 repeat, mixed repeats,
palette boards and topology sheets. Shared quiet bands, finite forms and timber
structure still show periodicity; owner visual acceptance remains separate.

AI-edited: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=curated-texture-expansion | change=recorded seven-family contracts and sequential native drawing checkpoints

AI-created: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=curated-retro-terrain | change=documented additive native drawings, Grout topology and original exports

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=review-recheck-cleanup | change=linked current compositor study and integer preview behavior while retaining historical proof

AI-edited: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=curated-gravel-polish | change=linked current original gravel drawings and extended connected study
