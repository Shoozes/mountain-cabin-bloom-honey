# Texture authoring TODO

Current future work. Completed material/retro passes and their dated proof are
in [the retained history](work/done/TEXTURE-AUTHORING-20261011.md). Gknome's
project contracts describe the existing standalone app in `src/`; accounts,
connectors, database bootstrap and automatic migrations are retired.

## Priority 1: original retro art acceptance

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

## Priority 2: multi-channel dirt structure

- [ ] Replace the regular row/ridge reading in the HD-2D dirt candidate with
  irregular structure, preserving family color roles and existing style recipes.
- [ ] Compare 128px and 2×2 albedo, height, normals and roughness for seed 1204;
  verify wrapped normals, deterministic repeat behavior and legacy outputs for
  seeds 1204/1215/1233. Keep artwork unapproved until reviewed.

Owner: material generator/art direction. The [grass/dirt study](look-dev/grass-dirt-study.md)
provides the source-bound findings and matched-channel evidence.

## After acceptance

- [ ] Author distinct native layout variants to reduce recognizable repetition;
  verify palette budgets, connected masks and native/repeated terrain together.
- [ ] Grow accepted surfaces through masonry, timber and metal.
- [ ] Qualify engine receiving, runtime anti-tiling and multi-channel terrain in
  their engine-owned batch. The Godot/jMonkeyEngine references remain sampling
  research; phase-offset CPU previews do not establish a runtime sampler.

Publication saves verified progress and leaves these acceptance criteria intact.
Deployment and releases are separate. Historical blocker commands remain in
dated records; use the current standalone/Gknome proof and guarded helper for
new publication.

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=standalone-gknome-setup | change=moved dated completed/blocker notes to history and kept current TODO focused on real future art/material work
