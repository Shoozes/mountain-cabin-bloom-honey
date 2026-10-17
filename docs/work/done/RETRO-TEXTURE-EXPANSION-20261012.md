# Expand and refine the curated texture kit

Complete with verified limitations. The local implementation starts from HEAD
`4c15058c5e39ef4a0c9fdf6d411f3a7372b06061` plus the unpublished
[gravel candidate](../../look-dev/retro-terrain-gravel-proof.json). Its art source
is `fc21f554ed799a1924425c58ad7a955ffaae7888b83b5c77c5ecac24dd3641c5`;
the scoped input snapshot is retained in
`.artifacts/retro-terrain-expansion/baseline-20261012/`. Historical fixtures,
studies and owner changes are preserved. Publication is outside this batch.
The 108 original surface hashes and three legacy palette maps are retained in
`scripts/fixtures/retro-terrain-gravel-baseline-20261012.json`; these are historical
pins, while classic/growth output and existing palette preservation stay active
requirements.

## Ordered drawing passes

- [x] Polish grass, dirt and gravel; deliver four independent compositions.
- [x] Add moss and exposed rock drawings; integrate dirt transitions at both resolutions.
- [x] Add repeatable stone masonry and timber, without terrain transitions.

Each material's composition zero receives native 16px and integer review with
the pixel-art agent before alternatives. The 64px treatment is authored
independently. All seven families have four compositions and normal/weathered
versions. Existing grass/dirt/gravel ramps stay exact in all three moods.
Natural surfaces retain quiet two/four-pixel bands; manufactured surfaces retain
shared primary course/plank structure. Weathering preserves those boundaries.

Pass 1 checkpoint is `46fa73601999804119e26aa3db02128fd471f7493fc4a24d286098a06d9ece16`.
The artist reviewed native/integer bases before alternatives; root's family
comparison prompted sharper 64px leaf tips to distinguish grass from stones.
The immutable `artist/pass1-source.mjs` and native review PNGs remain under
`.artifacts/retro-terrain-expansion/`. The pass receipt verifies 144 size,
material, composition, weathering and palette cases, including exact old ramps,
distinct compositions and quiet boundaries. Full connected/export proof follows
after all drawing families are frozen.

Pass 2 checkpoint is `603588c22af96d248a14dadeb20c9f78181ecf4652f0b270bbb7080af9e580ab`.
The artist removed small interior dot holes from moss's first 64px view and
reviewed rock as broad fractured faces, distinct from gravel aggregates. Root's
immutable pass check covers 240 five-family drawing/palette cases. Moss/rock
blob and corner construction is integrated; its exhaustive connected proof is
part of the final frozen-source gate. Native checkpoints remain original-only.

The linked art chat was redirected to a separate closeout request and explicitly
returned ownership at `63d713f1…`, without staging or publishing expansion files.
Masonry's four compositions at both sizes and timber's native base were retained.
The scoped finishing worker reviews that timber base before alternatives, then
completes timber and the broader 64px rock refinement. Root retains integration
and final proof. This handoff does not change the selected batch or art approval.

Pass 3 freezes editable art at `8dc422050f75bd39a9f75a0cc0fa86a9d3975dc04f65911c615ac0132f724c64`.
The finishing review expanded rock64 into broad faceted planes and timber64 into
clearer plank planes and larger restrained knot/grain groups. A scoped edit's
accidental loss of the 64px section was recovered from original checkpoints;
unaffected drawings, palettes, masonry and timber16 base were compared exactly.
All 336 drawing/palette cases pass at the final art identity. No donor pixels
enter the candidate.

Connected review exposed two integration defects: primary rock planes were
erased by whole-decoration masking, and native quadrant assembly could split
larger grass features. The compositor now clips authored primary planes and
resolves whole secondary groups after quadrant assembly. The targeted four-test
recheck passes. The first 52-figure study is historical; the current original-only
study is `docs/look-dev/studies/retro-terrain-expanded-20261012-r2/` (52 PNGs,
288,134 bytes). Active v2 expectations deliberately pin all 688 generated PNG
pixels at the default recipe for both sizes; older fixtures remain historical.

## Done when

- [x] Generator `retro-terrain-curated/2`, unchanged recipe/default/CLI, expanded
  `retro-terrain-pack/2`, editable sources and all composition exports.
- [x] Native 16px grass/gravel/moss/rock blobs: all 256 normalized inputs, 47
  masks, 12×4 mapping, alias, native quadrants and MIT notice.
- [x] 64px grass/moss/rock corner sets: sixteen masks, disconnected diagonals
  and compatible legal neighbors. Gravel surfaces and paths retain their model.
- [x] All sixteen paths, six/twenty-pixel mouths and hard alpha; normal/weathered
  connected previews and all new controls integrated with existing recovery,
  cancellation, retry and exclusive preview ownership.
- [x] Deterministic pixels, dimensions, finite palettes, four distinct
  compositions, shared boundaries and complete decorative clusters at both
  sizes, three palettes and seeds 1204/1215/1233. Classic/growth fixtures exact.
- [x] Native/integer drawing, individual/mixed 4×4 repeats and connected islands,
  holes, narrow links, concave boundaries and paths inspected.
- [x] Actual dev/built browser and CLI decoded equality; desktop/mobile DPR 1/2,
  switching, old drafts and export recovery exercised.
- [x] Focused checks, full tests, typecheck, lint and both builds pass. TODO,
  guides, Summary Bank and compact original-only proof updated.

Artwork remains unapproved until owner visual acceptance. Engine receiving,
PBR channels, runtime shader anti-tiling and preview-helper repair are separate.

## Final verification and retained candidate

Final editable source is `1cbe6256136ba7d402ace1a0c3652ba9342f3ba9c8a8485de007cefd7089e911`.
Unused draft helpers were removed after comparing every drawing, ramp and
normal/weathered rendered row exactly. The artist's earlier frozen source remains
retained; this source organization changes no pixels.

`npm test` passes 342 checks (317 scripts and 25 shader/material); typecheck,
lint, normal build and Pages build pass. The focused terrain milestone passes
81 checks and the final full suite repeats that coverage. Lint has four warnings
in retained ignored recovery evidence and none in product source. Build output
retains upstream module-directive notices without a failed build.

Both final actual dev and Pages browser runs pass eighteen recipes and 6,192
decoded PNG pairs each, with clean consoles and released owned resources. They
exercise all supported connected relationships in normal/weathered form, seven
materials, fourth composition, mixed repeats, desktop/mobile DPR 1/2, prior
classic/growth and curated drafts, preview switching, source failure/retry,
cancellation and captured export revisions. Root inspected all eight final
desktop/mobile captures and the native, repeat, palette and connected studies.

The [source-bound proof](../../look-dev/retro-terrain-expansion-proof.json) binds
commands, source hashes and receipts. The [final study](../../look-dev/studies/retro-terrain-expanded-20261012-final/study.json)
has 52 original-only PNGs, 288,134 bytes. It verifies exactly at the final source.
Figures use seed 1204; tests and both browser matrices cover 1204/1215/1233.
Default Woodland exports are retained in `.artifacts/retro-terrain-expansion/kits/`:
490 PNGs at 16px and 198 at 64px, each with recipe, editable art, MIT notice and
manifest. Source-addressed caches and earlier outputs remain intact.

Finite layouts and shared bands still reveal periodicity, especially rock and
timber; whole secondary masking can leave narrow natural regions bare. Owner
visual acceptance remains in TODO. These are verified local candidates, without
Git publication. Earlier failed gates, restored source and intermediate studies
remain diagnostic history. Only owned scratch was repaired; no owner files were
deleted. The identity-qualified authoring preview remains deliberately retained
under `.runtime/gravel-polish-dev-20261012.json` for this candidate.

AI-created: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=curated-texture-expansion | change=bound accepted local batch to unpublished baseline and executable completion criteria
