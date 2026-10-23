# HD-2D grass tuft refinement

Status: Complete. Repo/run: mountain-cabin-bloom-honey / grass-tufts-20261023.
Base: `5478f302543b78cc168149078f2b4293b398342c` on existing main; the unrelated
untracked Riasmap note is preserved. Phase: authorized local Work, no publication.

## Selected outcome

Address the earlier grass/dirt study's grass recommendation: reduce dominant
broad pigment islands and replace isolated flecks with connected blade/tuft
clusters at native 128px. Preserve the existing green ramp, unlit pigment,
matched channels and original recipes. Do not increase relief as a substitute
for readable shapes. The explicit `structure: "tufts"` option is supported only
for `style-surface` / `grass` / `hd2d`; omission keeps every legacy recipe exact.
The released dirt-clump option remains unchanged.

Drawing contract: opaque 128px periodic tile, existing six-role green palette,
three tapered curved blades sharing each root, locally varied direction/spacing,
quiet lower-contrast ground, no painted directional illumination. Review native,
integer enlargement and exact 2×2 repeats before claiming a refined candidate.
Artwork stays unapproved until owner acceptance; engine receiving is separate.

Owned paths: material generator/declarations and contextual material control,
focused grass tests and six-case pre-change fixture, source-bound study/browser
proof, grass guide, TODO and affected Summary Bank routing. A bounded worker
authored the focused tests/fixture and separate grass browser harness; main owns
drawing, integration and final verification.

## Done when

- The opt-in tuft recipe validates, edits/reverses, persists and exports through
  the existing material flow; older drafts are not silently upgraded.
- Shared-root blade groups read at 128px and integer zoom. Native and exact 2×2
  albedo/height/+Y normal/roughness comparisons for seed 1204 are inspectable.
- Seeds 1204/1215/1233 are deterministic and periodic, edge normals match wrapped
  height derivatives, flat relief is flat, and palette edits preserve data maps.
- The existing 129 legacy cases plus new pre-change grass128/dirt-clump128 pins
  remain exact; prior recipe/schema/CLI/cache/error and provenance behavior stays.
- Relevant tests, typecheck/lint, both builds and dev/built desktop/narrow browser
  recovery/export proof pass; work history, TODO and Summary Bank are current.

Compact evidence:
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/grass-tufts-20261023/`.
Existing proof and `.artifacts` placement retain their prior ownership.

## Delivered and verified

`structure: "tufts"` adds periodic, jittered shared-root groups with three
tapered curved blades. The first visual draft retained dark ground islands;
narrowing the ground pigment range kept the ground in one existing palette
band, leaving the blade groups readable at native 128px and integer 4×. No ramp
colors or older generator branch changed. Relief remains shallow; albedo is
unlit. Native/repeated four-channel strips and all three seed strips were
inspected, alongside dev/Pages desktop and narrow app captures. Repeating tuft
arrangements remain visible; this is an unapproved candidate, not an engine render.

The contextual Grass structure control selects and reverses the option.
Tuft scale retains the existing `strataScale` recipe key. Draft recovery, browser
ZIP/CLI bakes, source identity and unapproved provenance use the existing flow.
Changing family/style clears unsupported options; dirt clumps remain available
and exact. Existing recipes are never migrated automatically.

Local commands and results (all exit 0):

- `node --test scripts/material-grass.test.mjs scripts/material-dirt.test.mjs`:
  11 tests pass. The final `npm test` includes these with 266 passing tests
  (237 script and 29 source). All 129 frozen legacy cases/516 channel hashes
  and six pre-change grass128/dirt-clump128 cases/24 hashes remain exact.
  Tuft tests cover three-seed determinism/periodicity, mask ranges, wrapped
  border normals, every flat-relief normal, independent data maps, schema, CLI/cache
  identities, tamper detection and cancellation cleanup.
- `npm run typecheck`, `npm run lint`, `npm run build` and
  `npm run build:pages`: pass; both builds prerender all four routes.
  After final harness-only corrections, targeted ESLint on that script passes.
- `node scripts/test-material-grass-browser.mjs --dev --mode root --proof-out <run>/browser`,
  then `--mode root` against the normal build and `--mode pages` against the
  Pages build: seven flow checks pass per lane. Twelve seed/channel canvas
  comparisons and four decoded export PNGs per lane match Node exactly.
  Keyboard reversal, scale 4→6→4, reload, style/family reset, clump pixels,
  injected 503 source failure/retry, ZIP recipe/provenance and desktop/narrow
  controls pass; zero unexpected browser errors. Harness development corrected
  a selected-channel expectation and 503 console-text assertion; final receipts
  bind the corrected harness and current source.
- `node scripts/test-material-dirt-browser.mjs --mode root --proof-out <run>/browser-dirt`:
  seven neighboring dirt flow checks pass against the normal build.
- `node scripts/study-material-grass.mjs --out <run>/study`: six normalized
  old/new recipes and 22 PNGs, including eight native maps, eight exact 2×2
  repeats, three seed strips, two comparisons and the nearest-neighbor 4× plate.
  `study/study.json` records source/file hashes and channel identities.

`<run>` is the compact evidence root above. Test/build logs, three grass browser
receipts, neighboring dirt receipt, context audit and final source/resource
summary remain there. Browser/study source hashes match the final inputs.
Runtime: Node 26.5.0, npm 11.6.2, PowerShell 7.6.6, Chrome 155.0.8059.86.
Test-owned services/browsers closed through their harness; resource verification
confirms the recorded endpoints are released. No persistent service is retained.
The related Summary Bank group is bounded; TODO records completed technical
work and open owner review. The completed item leaves active queue routing.

## Remaining boundary

Owner art acceptance remains open for this candidate and the earlier dirt/
terrain work. Engine scale/lighting, runtime anti-tiling and donor migration
remain separately scoped. Current proof does not qualify a receiving engine.
The implementation phase completed locally; later publication is recorded
below. The unrelated untracked
Riasmap note and all prior retained proof/quarantine remain protected.

AI-created: 2026-10-23 | agent=Codex/root | task=grass-tufts | change=bound explicit grass refinement, native drawing contract and preservation/proof criteria

AI-edited: 2026-10-23 | agent=Codex/root | task=grass-tufts | change=recorded completed authoring, local native/browser proof and remaining owner review

## Paired closeout and publication

The owner's 2026-10-23 Closeout/Publish request includes this verified grass
batch and the subsequent CSS batch on existing main. Shared TODO/Summary Bank
edits belong to those two batches; the unrelated Riasmap note remains excluded.
All 24 non-shared grass proof inputs match at closeout. Current 273-test
qualification includes the grass compatibility tests. The
[CSS work record](SPRITE-CSS-20261023.md#paired-closeout-and-publication) owns
the combined exact-path publication boundary and confirmed receipt location.
Owner artwork acceptance and engine receiving remain open.

AI-edited: 2026-10-23 | agent=Codex/root | task=grass-css-closeout-publish | change=bound combined scoped publication while preserving local proof and owner art review
