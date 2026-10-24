# Texture authoring TODO

[SVG frame export](work/done/SPRITE-SVG-20261023.md) is locally complete and
qualified in SDK, Studio and CLI, preserving existing recipes and PNG/CSS/GIF
output. All 302 tests, SDK consumers, typecheck/lint and both builds pass.
Actual dev/root/Pages downloads complete with qualification true; 267 SVG frames
and 534 native/3x raster comparisons match exactly. The earlier download stall
no longer reproduces in the current checks; original failure evidence remains.
SVG import, other format work and owner art acceptance remain separate items.

The [Minecraft-style native16 type](work/done/MATERIAL-VOXEL-20261023.md) adds
eight original block families, contextual controls, integer preview fitting and
exact integer export enlargement. The owner selected Classic/default 16×16.
Current proof: 293 tests, typecheck/lint, both builds, dev/root/Pages desktop and
narrow browser flows, 306 exact channel previews and 144 exported channel cases
matching Node and CLI. All 232 frozen legacy channel hashes remain exact; all
192 family/size/channel maps preserve every native pixel. The
[study and guide](look-dev/minecraft-style.md) record reference observations and
original drawing decisions. Artwork remains unapproved pending owner review;
Minecraft packaging and receiving-engine proof remain separate.

Post-publication Review/Recheck at `90a750b` found no actionable native16 code
defects. Tile-period, hydration and source-inventory fixes remain closed;
fresh boundary/legacy probes and source-matched browser evidence pass. The
[review record](work/done/MATERIAL-VOXEL-20261023.md#post-publication-review-recheck-and-cleanup)
records coverage and proof. Cleanup updates these records only; owner art
acceptance remains the next step for these candidates.

The [GIF export pass](work/done/SPRITE-GIF-20261023.md) completes the latest
bounded Grout Art export batch. Optional GIF clips preserve native pixels,
transparency, holds and cumulatively rounded timing. Current proof: 281 tests,
typecheck, lint, SDK consumers, both builds and dev/root/Pages desktop/narrow
exports; Chrome and Pillow independently match all 258 decoded frames each.
Recipes, native pixels, PNGs and CSS retain exact pre-change hashes. GIF export
is complete; its paired closeout and guarded progress save are recorded in the
work record. Publication preserves progress without approving artwork.

The [CSS sprite export pass](work/done/SPRITE-CSS-20261023.md) remains qualified;
a fresh normal-build neighboring check adds 64 exact CSS frame/tick comparisons.
The [grass tuft refinement](work/done/MATERIAL-GRASS-20261023.md) and
[dirt clumps](work/done/MATERIAL-DIRT-20261023.md) remain implemented with exact
older recipes/pixels. **Priority 1 owner art review** and review of those
candidates remain open. Engine receiving and broader donor parity keep their
separate scopes. Guarded publication of current CSS/grass progress is recorded
in the CSS work record; publication does not change artwork acceptance.

Post-publication Review/Recheck at `bb6b62f` found no actionable grass/CSS code
defects. Prior encoder, source-inventory and narrow-header fixes remain closed;
read-only boundary probes and source-matched browser evidence pass. See the
[review record](work/done/SPRITE-CSS-20261023.md#post-publication-review-recheck-and-cleanup).
Cleanup updated the records only; owner artwork acceptance remains open.

## Character creator continuation

- [x] Implement native character assembly, reusable creators, original parts,
  deterministic compatible randomization, template edits/imports and exports.
- [x] Add reversible local Keep/Reject feedback, review history and unbiased
  sampling toggle. Verify feedback, locks and seeded reproduction.
- [x] Recovery milestone: 400 tests, typecheck, SDK consumers, lint and both builds.
- [x] Fix pre-hydration draft loss, preserve malformed source and last-valid
  documents across independent workspaces, and add delayed-hydration guards.
- [x] Qualify dev/built recovery, four-direction playback, in-flight export
  cancellation/retry and browser/CLI pixels; 1,296 exact GPU frame comparisons.
- [x] Apply pixel-art peer corrections to profile eye clearance, slim face opening
  and balanced side contacts with visible near/far shoes and a raised passing foot.
- [x] Replace the rejected creator hop with a steady upper body, compact contact/
  passing feet and smaller counter-swinging arms; preserve the accepted traveler.
- [x] Keep generated heads even-width and front/rear idle frames pixel-symmetrical;
  recover older odd-width rigs and preserve custom/imported source drawings.
- [x] Motion/symmetry milestone: 403 tests, typecheck, SDK consumers, lint, both
  builds and dev/built browser recovery/playback/export checks; 1,296 GPU matches.
- [x] Correct the reported profile face pixel, overwritten hair contours and
  skin-colored backpack stripe; finish built-in outlines after authored fills.
- [x] Draw planted/toe-off profile shoes with alternating support and a passing
  sole gap. Preserve even heads, symmetrical facing idles and imported palettes.
- [x] Contour/feet verification: 404 tests, typecheck, lint, SDK consumers, both
  builds, dev/built recovery/export/playback and 1,296 exact GPU frame matches.
- [x] Owner accepted the displayed Classic/Outlined 8-bit/Fern creator base and
  walk cycle on 2026-10-17. Pin its twelve decoded frames, palette and clips;
  other builds, styles and generated/custom designs retain their review boundary.
- [x] Review/recheck cleanup: preserve unreadable Sprite/Example recovery bytes,
  isolate example persistence, and restore outline-free arm silhouettes.
- [x] Cleanup qualification: 406 tests, typecheck, SDK consumers, lint and both
  builds; dev/built recovery/export/playback and 1,296 exact GPU comparisons.
- [x] Paired closeout refreshes character dev/built proof after extraction changed
  shared imports. Current suite: 411 tests; combined browser lanes: 1,480 exact
  GPU comparisons. Preserve scoped art acceptance and later roadmap work.

Draft recovery is verified. Earlier creator motion candidates remain rejected;
the accepted default and scoped cleanup are in [the continuation record](work/done/CHARACTER-CREATOR-20261017.md).

## Grout Art successor

The [sprite workflow](look-dev/grout-art.md) adds `/studio`, six local examples,
a private CPU/GLSL/WGSL SDK and a source-bound atlas baker. All 61 donor pages
are inventoried with migration status. The first traveler was rejected; the
revised native16 candidate follows the supplied art studies and pixel-art review.
The completed local [work record](work/done/GROUT-ART-SUCCESSOR-20261016.md)
and [qualification record](look-dev/grout-art-proof.json) bind 367 passing tests,
both builds, dev/built GPU equality and desktop/mobile authoring/export proof.

- [x] Traveler anatomy correction: hide the backpack in front views, tuck it
  behind profile shoulders, draw connected swinging arms and consistent dark
  outer contours on hands, sleeves, boots and gear. Preserve twelve frames,
  four layers, palette values, clip timing and feet anchor. Studio starts with
  a visible layer and identifies a selected layer hidden in the current frame.
- [x] Adventure-style traveler pass: redraw the sloped cap and tapered head,
  tuck the torso and three-pixel shoes, and narrow the passing silhouette.
  Review native drawings and the 8 fps cycle with the pixel-art agent; retain
  front backpack occlusion, consistent contours, original palette and anchor.
- [x] Owner selected the revised traveler and four-direction walk as the base
  on 2026-10-16, authorizing clothing and hat variants with fixed proportions.
- [x] Add two clothing and two hat drawings, nine editable/exportable combinations,
  and reversible Studio wardrobe controls. Pin accepted default pixels and retain
  painted corrections, palette edits, draft recovery, anchors and walk timing.
- [x] Owner accepted the linen tunic, trail vest, round cap and trail hat.
- [x] Add three coordinated apparel colorways alongside Fern; isolate garment
  panels from portrait roles. Refine feet in all four directions, preserve
  counter-swing and neutral passing, and center the rear backpack. Keep accepted
  proportions, face/arms, outlines, twelve frames, anchor and 8 fps timing.
- [x] Preserve historical recipes/pixels and old-draft recovery; expose an
  explicit undoable walk/backpack upgrade and retain editable/exportable variants.
- [x] Qualify all 36 combinations: 373 tests, typecheck, lint and both builds;
  dev/built desktop/mobile recovery and export checks, with 3,496 CPU/GPU
  comparisons and zero pixel differences. Retain original-only r3 walk studies
  in the `traveler-palette-feet-20261016` qualification record.
- [ ] Owner review of the new Cinder, Heather and Harbor palettes and revised
  four-direction feet. Pixel-art peer found no material flaw in r3; visual
  approval remains separate from local verification.
- [x] Correct profile far-shoe visibility with pixel-art peer review; preserve
  front/back pixels and recover prior r3 recipes without silent changes.
- [x] Import PNG/GIF sprites, grid sheets and aligned animated layers into editable
  recipes; preserve exact colors, hard alpha, source timing, layering and provenance.
  Keep outlining optional and normally bake it before engine receiving.
- [x] Verify all 144 supplied layer cells and 36 composites against independent
  GIF decoding; retain rough pixels unchanged and reference art outside fixtures.
- [x] Qualify the profile/import pass: 381 tests, typecheck, lint and both builds;
  3,516 CPU/GPU comparisons with zero differing bytes, dev/built desktop/mobile
  import, recovery, cancellation/retry and export parity. See the
  `traveler-profile-import-20261016` entry in the qualification record.
- [x] Add reversible Studio outline controls: enabled/color/1–3 px/corners,
  preview and baked export parity, editable source layers and walk timing retained.
  Fill/selection sample source pixels; fixed frame dimensions and anchors remain.
  Qualified with 388 tests, typecheck, lint, both builds and 3,660 exact CPU/GPU
  comparisons; dev/built desktop/mobile controls, playback, recovery and exports.
  See the `studio-outline-20261016` qualification entry.
- [x] Transparent PNG component extraction: explicit grouping, padding and anchors,
  isolated editable pixels, exact source/atlas reconstruction and browser/CLI
  exports. Qualified SDK and desktop/mobile dev/built flows, cancellation,
  undo/recovery and source guards; 411 tests, both builds and 184 exact neighboring
  GPU comparisons. See [the completed batch](work/done/SPRITE-COMPONENTS-20261017.md).
- [x] Richer sprite variation: reusable disjoint palette/animated-part families,
  96 opt-in traveler combinations, deterministic per-group streams, locks,
  individual rerolls and candidate selection with undo and draft recovery.
- [x] Lossless recipe optimization: shared-subtree transport restores the entire
  editable recipe and exact frames; browser/CLI kits retain readable sources,
  optimized sidecars and verification reports. Measure raw/gzip/full SDK costs
  independently. See [the batch record](work/done/SPRITE-VARIATION-20261017.md).
- [x] Qualify opt-in CSS sprite frame classes and clip playback from existing
  atlas pages: source-sized trim reconstruction, transparent frames, multiple
  pages, repeated holds, loop reset, native pixels and browser/CLI parity.
  Studio Export options and CLI `--css` preserve default atlas exports; see
  [the CSS guide](look-dev/css-sprites.md). The mobile header keeps Export visible.
- [x] Add opt-in native GIF clip export in Studio and CLI `--gif`, composable with
  CSS. Independently verify exact local palettes, cutout alpha, frame order/holds,
  infinite loops and cumulative centisecond delays; retain explicit color/budget
  errors, source/cache integrity and cancellation. See [the GIF guide](look-dev/gif-export.md).
- [x] Qualify optional SVG frame export with completed dev/root/Pages downloads,
  source-sized pixels, cutout alpha, anchors and preserved default exports. See
  [the SVG guide](look-dev/svg-export.md) and completed work record.
- [ ] Qualify SVG import, fonts/UI atlases, remaining donor demos, engine adapters
  and compact runtime delivery through the guide's capability matrix.
- [ ] Transfer Grout13 ownership or retire parent synchronization only after the
  relevant replacement is qualified. Preserve the donor in the meantime.

Current future work. Completed material/retro passes and their dated proof are
in [the retained history](work/done/TEXTURE-AUTHORING-20261011.md). Gknome's
project contracts describe the existing standalone app in `src/`; accounts,
connectors, database bootstrap and automatic migrations are retired.

The completed local [seven-material expansion](work/done/RETRO-TEXTURE-EXPANSION-20261012.md)
polishes terrain, adds moss/rock transitions, then masonry and timber. It starts
from the unpublished gravel candidate and preserves historical fixtures, both
earlier kits and the existing terrain ramps. Artwork remains unapproved.

- [x] Expansion pass 1: four grass/dirt/gravel compositions at both native sizes,
  with reviewed base drawings, unchanged ramps and quiet normal/weathered bands.
- [x] Expansion pass 2: four moss/rock drawings at both sizes, reviewed bases,
  original ramps and integrated dirt transition construction. Final connected
  proof follows at the frozen seven-family milestone.
- [x] Expansion pass 3 drawings: four masonry/timber compositions, reviewed bases,
  broader rock64 faces and primary/secondary masking repair.
- [x] Final expanded-kit proof: 342 tests, typecheck, lint, both builds and dev/built
  browser matrices with 6,192 decoded PNG pairs each. The
  [final study](look-dev/studies/retro-terrain-expanded-20261012-final/study.json)
  and [receipt](look-dev/retro-terrain-expansion-proof.json) bind this candidate.

## Realistic catalog candidates

- [x] Add a separate Minecraft-style native16 texture type with original grass,
  dirt, stone, cobble, sand, planks, bark and brick. Qualify source-bound browser/
  CLI exports, exact integer enlargement, legacy preservation and local recovery.
- [x] Review/recheck the published native16 batch, verify prior fixes and test
  boundary recipes without changing its drawings, recipes or export behavior.
- [ ] Owner-review the original block-family study and repeated tiles before
  selecting these candidates for a game. Keep native scale/lighting/receiving
  decisions with the actual game scene.

- [x] Add six original continuous material presets for soil, gravel, limestone,
  concrete, bark and timber, with 512px defaults, smooth repeats, a neutral lit
  preview and four matched export channels. Preserve the earlier material and
  retro recipes. The [recipe guide](look-dev/realistic-materials.md) describes
  controls and exports; [local proof](look-dev/realistic-materials-proof.json)
  records verification and the 184 unchanged legacy channel hashes.
- [ ] Owner-review these procedural candidates beside actual game foliage,
  ground, props, water and sky. Check color/value relationships, material scale
  and repeat visibility under the receiving scene's lighting. Keep artwork
  marked unapproved until accepted; engine receiving remains separate.

## Completed local gravel polish

- [x] Remove the fixed gravel crossing at native 16px, review that checkpoint
  with the pixel-art agent, then redraw the 64px aggregates with quiet shared
  bands and staggered gaps. Keep the existing three authored compositions.
- [x] Preserve matching two/four-pixel boundaries, original palettes and
  weathering, blob/path contracts and exact classic/growth pixels. Pin 72
  unaffected curated grass/soil compositions. Supplied OGA assets inform the
  study; exports retain original drawings and palettes.

The [gravel work record](work/done/RETRO-GRAVEL-POLISH-20261012.md) and
[current study](look-dev/retro-terrain-gravel.md) retain the local candidate.
Fixed seam marks are removed; finite composition and canonical path recurrence
remain visible. Native/integer artist review and normal/weathered boundary proof
support this pass. Artwork remains unapproved until owner acceptance.

## Rias ground selection

- [x] Coordinate the current five-role ground mapping with Rias and supply a
  source-bound Woodland grass/dirt/gravel shortlist: 48 exact native16/64
  normal/weathered PNGs, four compositions each. The
  [selection guide](look-dev/riasmap-terrain-selection.md) records the preferred
  compositions, provenance, sampling and preserved roles.
- [x] Finish Rias's 36 matched private original-kit views. Retain the current
  ground: native16 clashes with detailed trees/props, and native64 still has
  regular dots and overly dark gravel. Both remain unapproved; active selection
  is unchanged. Native64 supplies the next original-art refinement direction.
- [x] Finish Rias's separate owner-selected private pack comparison. Shortlist
  forest grass `GRASS_3A`, plain `DIRT_1A`, fine `GRAVEL_1C` and shore `SAND_2A`
  for owner review after 36 captured views and unchanged-mask receiving checks.
  Forest fits the existing trees better than the patterned meadow option, but
  the owner rejected that preview as repetitive and pixel-art styled.
  Purchased pixels and derivatives stay outside our original sources, fixtures
  and redistributable exports. Dusk lighting remains separately owned.
- [x] Incorporate the owner-selected coherent scene approach into our
  [future authoring workflow](look-dev/texture-authoring.md#game-facing-authoring-scene-coherence-first):
  actual camera and trees, shared ground/water/foliage/sky color and lighting,
  measured texture density, then a small real prototype before variants.
- [ ] Owner acceptance of Rias's coherent scene prototype after its receiving
  checks. Rias owns that active implementation; prior captures are historical
  comparisons. Model-specific cliff/masonry/timber work stays separately scoped.

## Priority 1: original retro art acceptance

- [ ] Owner review of the new [curated edition](look-dev/retro-terrain-curated.md):
  native 16px/64px drawings, seven materials, four compositions and three palettes, individual
  and mixed repeats, all 47 blob cases, and connected normal/weathered terrain.
  Both earlier kits remain exact and selectable. Keep artwork unapproved.
  Implemented criteria and current checks are recorded in the
  [curated closeout](work/done/RETRO-TERRAIN-CURATED-20261011.md) and
  [current expansion](work/done/RETRO-TEXTURE-EXPANSION-20261012.md).
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

- [x] Add the explicit Irregular clumps option for HD-2D dirt, replacing its
  row/ridge reading while preserving family ramps and all older recipes/pixels.
- [x] Compare 128px and 2×2 albedo, height, normals and roughness for seed 1204;
  verify wrapped normals, deterministic repeat behavior and legacy outputs for
  seeds 1204/1215/1233. All 129 frozen legacy cases remain exact; dev/root/Pages
  authoring, recovery, retry and export checks pass. See [the candidate guide](look-dev/dirt-clumps.md).
- [ ] Owner-review the clump candidate's native and repeated matched channels.
  Keep artwork unapproved; finite repetition and broad pigment patches remain
  visible. This local batch does not qualify a receiving engine or migrate art.

Owner: material generator/art direction. The [grass/dirt study](look-dev/grass-dirt-study.md)
provides the source-bound findings and matched-channel evidence.

## Priority 2: HD-2D grass tuft refinement

- [x] Add explicit Connected tufts for HD-2D grass: shared-root tapered blades,
  varied spacing/lean and quiet ground. Preserve green ramps and unlit pigment.
- [x] Preserve the 129 legacy recipe cases and six pre-change grass128/clump128
  pins; validate periodic fields, wrapped normals, flat relief and independent
  data channels. Original patches remains exact; drafts are never auto-upgraded.
- [x] Inspect native, exact 2×2 and integer 4× views; verify three seeds/four
  channels, keyboard/scale changes, recovery, family/style reset and export retry
  on dev/root/Pages, including desktop/narrow layouts. See the
  [candidate guide](look-dev/grass-tufts.md) and completed work record above.
- [ ] Owner-review the new native/repeated tuft drawing beside intended scene
  materials. Artwork stays unapproved; finite tuft arrangements still recur.
  Engine scale, lighting and runtime anti-tiling require their own qualification.

## After acceptance

- [ ] Grow accepted surfaces through metal and owner-selected weathering feedback.
- [ ] Qualify engine receiving, runtime anti-tiling and multi-channel terrain in
  their engine-owned batch. The Godot/jMonkeyEngine references remain sampling
  research; phase-offset CPU previews do not establish a runtime sampler.

## Repository cleanup

- [x] Rebuild WebGL geometry and repaint/restart thumbnails after display or
  utility context restoration. Release buffers/listeners on disposal and roll
  back partial startup; four lifecycle regressions run through `npm test`.
- [x] Recheck standalone dev, root-built and Pages-built routes, desktop/narrow
  layouts and candidate selection. Both lost contexts recover identical static
  preview pixels without interaction or browser errors. See the current record
  linked above; historical counts and receipts remain bound to their own source.
- [x] Retire the inherited Grok/Vercel shell, sandbox-only preview/auth QA tools
  and empty source pointer. Keep static local/Pages builds and Gknome operations.
- [x] Group lint/format configuration under `.tools/config/` and move historical
  screenshots beneath `docs/look-dev/`; preserve accepted artwork and source.
- [ ] Remove the quarantined obsolete platform files only after the filesystem
  deletion guard permits it. Recursive deletion was rejected with “blocked by
  policy”; `.runtime/retired-platform-20261017/` preserves them opaquely. The
  root is clear and active build/runtime paths no longer consume the old files.

Publication saves verified progress and leaves these acceptance criteria intact.
Deployment and releases are separate. Historical blocker commands remain in
dated records; use the current standalone/Gknome proof and guarded helper for
new publication.

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=standalone-gknome-setup | change=moved dated completed/blocker notes to history and kept current TODO focused on real future art/material work

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=curated-retro-terrain | change=recorded implemented compositions and native autotiles while retaining owner art acceptance

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=review-recheck-cleanup | change=prioritized remaining gravel seam polish after verified compositor, preview and shader resource repairs

AI-edited: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=curated-gravel-polish | change=recorded completed native gravel candidate while retaining owner acceptance and finite-repeat limitations

AI-edited: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=realistic-material-catalog | change=recorded six original realistic catalog candidates and retained actual-scene visual acceptance

AI-edited: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=curated-texture-expansion | change=recorded seven-material local completion, source-bound checks and remaining owner visual acceptance

AI-edited: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=riasmap-terrain-selection | change=recorded matched original-kit rejection and tree-compatible private pack selection while preserving art acceptance

AI-edited: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=scene-coherence-learning | change=recorded rejected preview and scene-first authoring criteria for the next game-facing batch

AI-edited: 2026-10-16 | agent=Codex/root | task=grout-art-successor | change=closed the first sprite pipeline and retained art acceptance and later migrations

AI-edited: 2026-10-16 | agent=Codex/root | task=traveler-anatomy | change=closed occlusion and contour corrections while retaining tutorial-style refinement and owner acceptance

AI-edited: 2026-10-16 | agent=Codex/root | task=traveler-style | change=recorded the reviewed Adventure-style candidate and held variants for owner walk-cycle acceptance

AI-edited: 2026-10-16 | agent=Codex/root | task=traveler-wardrobe | change=recorded owner acceptance of the base and the additive apparel review

AI-edited: 2026-10-16 | agent=Codex/root | task=traveler-palette-feet | change=recorded accepted garments, new colorways and foot refinement with owner review remaining

AI-edited: 2026-10-16 | agent=Codex/root | task=traveler-profile-import | change=recorded far-shoe correction and exact layered conversion

AI-edited: 2026-10-16 | agent=Codex/root | task=studio-outline | change=recorded Studio outline controls and preserved source ownership

AI-edited: 2026-10-17 | agent=Codex/root | task=character-motion | change=recorded owner motion rejection, symmetry requirements and replacement candidate

AI-edited: 2026-10-17 | agent=Codex/root | task=character-contours | change=recorded owner-reported face, outline, pack and gait repairs

AI-edited: 2026-10-17 | agent=Codex/root | task=character-review-cleanup | change=recorded scoped owner acceptance, recovery and arm fixes, and bounded extraction pass-down

AI-edited: 2026-10-17 | agent=Codex/root | task=sprite-components | change=completed the bounded extraction migration and retained later conversion/variation work

AI-edited: 2026-10-17 | agent=Codex/root | task=sprite-closeout-publish | change=recorded final shared-workspace qualification and scoped progress saving

AI-edited: 2026-10-17 | agent=Codex/root | task=sprite-variation | change=completed reusable variation and lossless transport scope; retained later migration and art acceptance boundaries

AI-edited: 2026-10-17 | agent=Codex/root | task=root-standalone-cleanup | change=retired obsolete preview-helper backlog and recorded guarded cleanup limitation

AI-edited: 2026-10-23 | agent=Codex/root | task=review-recheck-cleanup | change=recorded verified WebGL lifecycle repairs and retained dependency-ordered art/dirt pass-down

AI-edited: 2026-10-23 | agent=Codex/root | task=dirt-clumps | change=completed additive dirt refinement and qualification while retaining owner acceptance and scoped next recommendations

AI-edited: 2026-10-23 | agent=Codex/root | task=grass-tufts | change=completed optional grass refinement and local proof while retaining owner art review and engine boundaries

AI-edited: 2026-10-23 | agent=Codex/root | task=css-sprites | change=recorded qualified optional CSS export and mobile access while preserving remaining format and owner-review boundaries

AI-edited: 2026-10-23 | agent=Codex/root | task=grass-css-review | change=recorded completed published-source review/recheck with no actionable code defect

AI-edited: 2026-10-23 | agent=Codex/root | task=gif-export | change=completed the selected optional GIF batch, local decoder proof and exact export compatibility; retained remaining capability and owner-art work

AI-edited: 2026-10-23 | agent=Codex/root | task=gif-closeout-publish | change=recorded paired scoped closeout and guarded progress saving with artwork and receiving boundaries preserved

AI-edited: 2026-10-23 | agent=Codex/root | task=voxel-material | change=recorded completed classic16 texture type, original-art review boundary and exact local compatibility/export proof

AI-edited: 2026-10-23 | agent=Codex/root | task=voxel-review | change=recorded completed published-source review and recheck with no actionable code defect and retained owner acceptance

AI-edited: 2026-10-23 | agent=Codex/root | task=svg-export | change=selected optional SVG output, recorded implemented paths and retained the native browser download proof condition

AI-edited: 2026-10-23 | agent=Codex/root | task=svg-closeout-publish | change=closed SVG frame export after actual dev/root/Pages downloads and full local proof while preserving separate art and format work
