# Curated terrain and native autotiles

The curated edition is additive. Classic `retro-terrain` and
`retro-terrain-growth` retain their recipes, commands and decoded pixels; twelve
seed/palette combinations are pinned independently. Artwork remains **unapproved**.

## Native drawing

Grass uses branching sprigs and quiet gaps; soil uses shallow broken compaction
planes; gravel uses connected angular faces with restrained highlights. The
pixel-art agent reviewed and polished the initial bases before authoring two
alternatives per material. There are nine independent surface compositions at
each resolution, plus weathered counterparts. They change cluster counts,
footprints and negative space; they are not translated or rotated copies.

The editable source is `src/shader/retro-terrain-art.mjs`. Native 16px drawings
use three grass, three soil and four stone roles. The 64px edition stays within
the 8/12/12 limits. Woodland, Dry trail and Cool moor are original role palettes,
compared on identical geometry. Purchased pixels, ramps and masks are not inputs.

Compositions and weathering share two-pixel seam bands at 16px and four-pixel
bands at 64px. Seeds select authored compositions by cell, without sampling
noise or interpolation, including boundary cells. Canonical topology sheets use
composition zero; connected previews place the exported surface alternatives
inside those same silhouettes. Weathering removes complete features. Boundary masks
keep complete decorative clusters or omit them, preserving the terrain shape.
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
Grass/dirt and gravel/dirt each supply normal and weathered sets.

The 64px edition preserves the four-corner model: NW=1, NE=2, SE=4, SW=8,
with disconnected diagonal grass cases. Path bits are separately N=1, E=2,
S=4, W=8. All sixteen path pieces use hard alpha and zero transparent RGB;
mouths are six pixels at 16px and twenty pixels at 64px.

## Authoring and export

Open **Adjust → Retro terrain → Curated edition**. Choose native size,
palette and seed. Compare individual compositions, mixed 4×4 repeats, sheets,
connected grass or gravel terrain, and weathered paths. The two earlier kits
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

The 16px package has 250 PNGs; 64px has 88. Both include four additional
text/JSON files. The manifest records roles, topology, atlas coordinates,
composition and boundary rules, sampling, source hashes and original provenance.
Browser and CLI PNG encodings can differ; decoded RGBA is the shared contract.
CLI caches use source identity and exact regenerated-byte validation. Errors,
retry and cancellation remain visible in the existing exclusive-preview flow.

## Review and limits

Structural proof covers dimensions, palettes, opacity, all masks, adjoining
material profiles and fixed path mouths. Visual review covers native drawings,
integer enlargement, repeats and connected islands, holes, narrow links and
concave boundaries. The linked [pixel-art agent](codex://threads/01a10aa2-1783-7521-937e-2d3145e85f24)
identified clipped boundary marks and dotted path chips; those received the
whole-cluster/quiet-strip repair. Shared edge art can still reveal periodicity.
The additional polish shortened the showcase path before the isolated grass
cell, replaced 64px noisy scallops with authored broad corner runs, and regrouped
the existing grass/soil marks. Quiet grass/soil seam planes replace fixed repeated
landmarks; gravel keeps a small compatible crossing. No extra compositions were
added. The [current source-bound study](studies/retro-terrain-curated-20261011-r3/study.json)
retains ten original-only figures; earlier studies remain historical.

```powershell
node scripts/study-retro-terrain-curated.mjs --verify --out docs/look-dev/studies/retro-terrain-curated-20261011-r3
```

Technical verification does not approve the artwork. The [integration receipt](retro-terrain-curated-proof.json)
records checks and source identity.

Engine receiving, PBR channels and runtime shader anti-tiling remain separate.
Current acceptance and proof are linked from [TODO](../TODO.md).

AI-created: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=curated-retro-terrain | change=documented additive native drawings, Grout topology and original exports
