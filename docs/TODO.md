# Texture authoring TODO

Current future work. Completed material/retro passes and their dated proof are
in [the retained history](work/done/TEXTURE-AUTHORING-20261011.md). Gknome's
project contracts describe the existing standalone app in `src/`; accounts,
connectors, database bootstrap and automatic migrations are retired.

## Priority 1: curated gravel boundary polish

- [ ] Remove recognizable gravel seam landmarks, especially the repeated small
  marks in native 16px 4×4 repeats. Start with a quieter shared strip and reshape
  interior stone aggregates using the existing three authored compositions.
  Review that base with the pixel-art agent before extending the change to 64px.
- [ ] Preserve matching two/four-pixel boundaries, all palettes and weathering,
  blob/path contracts, recipes and exact classic/growth pixels. No purchased
  pixels, palette extraction, runtime sampler or engine integration in this pass.

Owner: pixel-art craft. Done when native and integer views, individual/mixed
repeats and connected normal/weathered terrain no longer emphasize the fixed
seam marks; relevant palette, boundary, deterministic export and preservation
checks pass. Keep artwork unapproved until owner visual acceptance.
See the [review and cleanup handoff](work/done/RETRO-TERRAIN-REVIEW-CLEANUP-20261011.md)
for current proof and the bounded next pass.

## Priority 2: original retro art acceptance

- [ ] Owner review of the new [curated edition](look-dev/retro-terrain-curated.md):
  native 16px/64px drawings, three compositions and three palettes, individual
  and mixed repeats, all 47 blob cases, and connected normal/weathered terrain.
  Both earlier kits remain exact and selectable. Keep artwork unapproved.
  Implemented criteria and current checks are recorded in the
  [curated closeout](work/done/RETRO-TERRAIN-CURATED-20261011.md) and
  [current cleanup](work/done/RETRO-TERRAIN-REVIEW-CLEANUP-20261011.md).
- [ ] Owner review of the curated base: native 64px tiles, exact 3× viewing,
  4×4 repetition and connected normal/weathered paths. Check grass colonies,
  soil rims, stone faces and earthen shoulders. Preserve the original kit.
- [ ] Keep the manifest and artwork marked unapproved until that review passes.
  The linked pixel-art agent's critique and motif polish are implemented.
  Recognizable periodic landmarks remain; seed phase previews are diagnostic
  and do not constitute independent authored layout variants.

Owner: art direction. Completion: explicit visual acceptance of the source-bound
candidates in [the growth study](look-dev/retro-terrain-growth.md), or a bounded
feedback batch with native before/after proof. Technical tests cannot approve art.

## Priority 3: multi-channel dirt structure

- [ ] Replace the regular row/ridge reading in the HD-2D dirt candidate with
  irregular structure, preserving family color roles and existing style recipes.
- [ ] Compare 128px and 2×2 albedo, height, normals and roughness for seed 1204;
  verify wrapped normals, deterministic repeat behavior and legacy outputs for
  seeds 1204/1215/1233. Keep artwork unapproved until reviewed.

Owner: material generator/art direction. The [grass/dirt study](look-dev/grass-dirt-study.md)
provides the source-bound findings and matched-channel evidence.

## After acceptance

- [ ] Grow accepted surfaces through masonry, timber and metal.
- [ ] Qualify engine receiving, runtime anti-tiling and multi-channel terrain in
  their engine-owned batch. The Godot/jMonkeyEngine references remain sampling
  research; phase-offset CPU previews do not establish a runtime sampler.

## Separate runtime maintenance

- [ ] Qualify process ownership in the inherited Linux `preview:restart` helper
  before it signals a port listener. Preserve command contracts and unrelated
  services; verify owned stop/restart and a foreign listener without signaling it.
  Current terrain browser proof uses its own ephemeral server and closes it.

Publication saves verified progress and leaves these acceptance criteria intact.
Deployment and releases are separate. Historical blocker commands remain in
dated records; use the current standalone/Gknome proof and guarded helper for
new publication.

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=standalone-gknome-setup | change=moved dated completed/blocker notes to history and kept current TODO focused on real future art/material work

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=curated-retro-terrain | change=recorded implemented compositions and native autotiles while retaining owner art acceptance

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=review-recheck-cleanup | change=prioritized remaining gravel seam polish after verified compositor, preview and shader resource repairs
