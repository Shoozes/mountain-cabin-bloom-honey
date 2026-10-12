# Texture authoring history before standalone setup

Historical source-bound progress and blocker notes retained during the
2026-10-11 standalone/Gknome setup. These notes describe their dated source
identities; later setup supersedes the old auth blocker and scaffold ownership.
Current future work is in [TODO](../../TODO.md). Original artwork acceptance
remains open.

---

# Texture tool TODO

Updated 2026-10-11. Requested phases: read-only review, read-only recheck, then
scoped cleanup and this TODO update. The selected local cleanup batch is complete.
The subsequent dropin/work batch completed the grass/dirt visual study below.
Local closeout is complete. Guarded publication is blocked by an unchanged
platform OAuth credential; the verified snapshot remains staged and the next
dirt refinement remains open.

The subsequent accepted **original retro terrain** plan is implemented locally.
Its color kit is independent of the earlier multi-channel grass/dirt refinement;
both the older staged snapshot and its publication blocker remain preserved.
The latest paired Closeout/Publish request revalidated the current retro kit and
its retained proof. The publication owner's secret preflight still fails; no
index mutation, commit or push was attempted after that failed gate.

## Review baseline and coverage

Source identity: `c26d117c6de03432b469abbfc55e061778512735` plus the available
staged, unstaged and untracked working-tree sources. Existing owner changes and
the index were preserved. There is no Summary Bank in this repository; direct
source reads supplied the route map, and no native Summary Bank commands ran.

Coverage included the mill/material panel, generator and browser export,
material/environment/vertex-color bakers and tests, catalog/corpus and gallery
consumers, route shell, build/environment wrappers, verification scripts and
owning documentation. Existing auth/data changes were inspected and their
neighboring tests passed; this is not a fresh security audit of unused platform
helpers. GaimEngine, Willowmere, Grout-Library and Grout13 were not edited or
independently requalified. Their earlier receiving claims retain their dated,
separately owned scope.

The prior review baseline is the tool guide's 2026-10-08 material-cache repair
and the source-bound 2026-10-11 material closeout receipt. The material generator,
panel and baker matched the earlier build receipt before cleanup. Current
regression tests and full browser checks establish closure against the actual
working tree, rather than HEAD alone. Exact checked source hashes and command
results are retained in
[the compact closeout record](../../look-dev/closeout-20261011.json).

## Findings and recheck results

- [x] **Verified closed, prior:** coordinated channel/contact-sheet tampering
  with matching manifest hashes is rejected; cache metadata, provenance and
  cancellation checks remain enforced. Legacy cliff channel hashes remain exact
  for seeds 1204, 1215 and 1233.
- [x] **Verified closed, prior:** edits during export remain unsaved and recover
  after reload; all 40 family/style selections and recipe drafts still work.
- [x] **Closed resource risk, P2:** environment cache manifests and buffers were read without
  pre-read byte bounds. The reader now caps manifests at 1 MiB, requires exact
  expected buffer sizes, detects growth during reads, and bounds HDR path input
  at 64 MiB. Oversized-input rejection preserves completed caches and leaves no
  pending output. Generated environment math was not changed.
- [x] **Closed, P1:** a failed mill `localStorage.setItem` escaped a React effect.
  The mill now shows a visible saving warning and still supports editing and PNG
  export when storage is full.
- [x] **Closed, P2:** reference-load failure left the judge busy with an uncaught
  rejection. Loads now have explicit errors, abort/deadline handling and resource
  cleanup; closing or unmounting cancels owned work, and retry succeeds. Healthy
  shader scoring has no arbitrary 30-second whole-run cutoff.
- [x] **Closed, P2:** every material preview was labelled HD-2D cliff. The active
  heading and disclosure now follow the actual recipe/family/style; the channel
  canvas has a generic material label.
- [x] **Closed, P2:** catalog rendering continued behind material preview and
  judging. Hidden display/thumbnail work now pauses and resumes from retained
  progress. Browser checks verify pause/resume and concurrent export. The final
  Pages export reached the held source read in 63 ms; this is one local latency
  observation, not a general performance benchmark.
- [x] **Closed, P2:** the browser harness used timeout options in the wrong
  `waitForFunction` argument and coupled the held-route test to a separate request
  event. It now uses explicit timeout options and the route handler's handshake,
  waits for recovered drafts after hydration, and saves failure diagnostics.
- [x] **Closed, P3:** the document description falsely called the catalog approved.
  It now describes studies/candidates and explicitly retains unapproved status.
- [ ] **Still open, art:** technical authoring/export proof does not approve the
  generated material families or the existing corpus. The grass/dirt study now
  recommends refining both candidates, beginning with dirt.

## Local verification

Runtime: Windows, PowerShell 7, Node v26.5.0, npm 11.6.2. All commands below exited 0.
The [portable record](../../look-dev/closeout-20261011.json) preserves the command results
and browser summaries; detailed logs and screenshots at the paths below remain
local and are deliberately excluded from publication.

| Command | Observed result / retained proof |
| --- | --- |
| `npm test` | 313 passed, zero failures; `.artifacts/proof/review-cleanup/tests.log` (local retained proof) |
| `npm run typecheck` | `.artifacts/proof/review-cleanup/typecheck.log` (local retained proof) |
| `npm run lint` | `.artifacts/proof/review-cleanup/lint.log` (local retained proof) |
| `npm run build` | Production build passed; DB migration skipped with no configured database; `.artifacts/proof/review-cleanup/build.log` (local retained proof) |
| `npm run build:pages` | Both routes prerendered; `.artifacts/proof/review-cleanup/build-pages.log` (local retained proof) |
| `node scripts/test-material-browser.mjs --playwright-root node_modules/playwright` | Full Pages browser matrix; `.artifacts/proof/material-browser/1791738388485-32596/receipt.json` (local retained proof) |
| `node scripts/test-material-browser.mjs --playwright-root node_modules/playwright --dev-url http://127.0.0.1:8080/` | Full dev browser matrix; `.artifacts/proof/material-browser/1791738471168-27400/receipt.json` (local retained proof) |
| `git diff --check` | No whitespace errors |

Desktop and 390×844 mobile captures were visually inspected. Browser checks have
no unexpected console/page errors; the intentional missing-reference 404 is
recorded separately. Earlier failed browser receipts remain under
`.artifacts/proof/material-browser/` for diagnosis. The repository's sandbox-only
`browser-smoke.mjs`/`preview:restart` paths were not run on Windows; the existing
material harness exercised the actual dev and built output instead. Node 22,
hosted deployment and external engine receiving were not rerun.

The live dev server is retained under the repository's preview contract; its
owner, process identity, endpoint and stop route are in ignored
`.runtime/review-cleanup-dev.json`. Test-owned preview servers and browsers closed.

## Completed pass: grass/dirt visual study

- [x] **Desired result:** a small, source-identified HD-2D grass/dirt study with
  concrete keep/refine/reject recommendations before further generator changes.
  Start with seed 1204, earth palette and 128-pixel output, using the existing
  recipe controls rather than adding families or dependencies.
- [x] **Done When:** inspect both candidates at native scale and 2×2 repetition,
  inspect their matched height/normal/roughness channels, retain one compact
  recipe/source record and useful captures, and write an actionable visual
  recommendation for each candidate. Artwork stays unapproved until its owner
  explicitly approves it.
- [x] **Sequencing and ownership:** the texture mill owns the local study.
  Any later dry/wet/night terrain receiving comparison belongs to GaimEngine/the
  game and follows candidate selection under separately authorized scope.

Exclude public corpus promotion, purchased/derived private inputs, engine edits,
Grout13 ownership transfer, new HTTP/MCP services, broad refactoring and Git
publication from this pass. The other roadmap items remain in
[the tool guide](../../look-dev/texture-tools.md#priorities) and README.

The [completed study](../../look-dev/grass-dirt-study.md) records exact recipes/source,
native and repeated maps, channel measurements and actionable recommendations.
Source-matching canonical packages were verified and reused; the study retained
only eight new repeated views and one compact recipe/source index. Closeout now
retains the referenced native maps/manifests and repeated views as a compact
repository review fixture so its links work after publication. Grass needs
more coherent tuft clusters; dirt's height/normal maps reveal regular horizontal
bands. Neither repeat showed a prominent hard border seam. Both remain unapproved.

Dropin dispositions: there was no newly supplied feedback/inbox packet; the
existing selected handoff was actionable and is complete. Prior cleanup proof
is reused only after all 14 source hashes matched. The observed study producer
command exited 0 and verified exact package reuse, PNG bytes and repeated texels.
No app source, dependencies, public corpus or other checkout changed. The earlier
build/test/browser commands were not rerun for this evidence/docs batch.

## Closeout and publication

- [x] Current source matches all 14 retained cleanup proof hashes; the existing
  313-test, typecheck, lint, production/Pages builds and full dev/Pages browser
  proof remain applicable. No app source changed during this closeout.
- [x] The portable original procedural fixture verifies all 21 references and
  regenerates eight native/eight repeated PNGs in memory. Artwork remains
  unapproved. Current study and closeout links resolve inside the repository.
- [x] No Summary Bank exists, so no bank or pack was created. Current owners,
  implementation/test paths and the next bounded pass remain in this work record
  and the tool guide.
- [x] Test-owned previews/browsers exited. The live preview and referenced local
  proof are deliberately retained with ownership and a shutdown route; no bulk
  deletion or unknown-owner cleanup was performed.

The named-file guarded helper was invoked for the coherent material,
environment, vertex-color, integrity and visual-study progress:

```powershell
pwsh -NoProfile -File .tools/gitpush.ps1 -PublisherRoot C:/DevStuff/Grout-Library -StagedOnly -Yes -Allowlist .artifacts/publication-paths.json -Message 'Save verified texture authoring tools and material review'
```

It exited 1 before committing: `Secret scan failed with 1 finding(s).`
The value-free diagnostic identifies `src/lib/auth/preview.ts` with the rule
`assigned_secret`. That file is unchanged from the starting commit and contains
the platform's shared preview OAuth client credential. Its source contract
requires coordinated broker configuration/rotation; this texture-tool batch
does not authorize that credential or account change. No credential value was
printed or retained in this record, and the guard was not bypassed.

- [ ] **Publication blocker, owner: platform/auth broker.** Supply a supported
  environment-injected preview credential path and matching broker configuration
  that preserves preview sign-in and passes the existing secret scan. Then
  revalidate affected auth behavior and rerun the guarded helper for this named
  snapshot. No commit or push was created by the failed attempt; the reviewed
  58-file candidate remains staged on `main` at the starting commit.

This record does not claim deployment or completed dirt/grass refinement.

## Completed pass: original retro terrain kit

- [x] Independently author opaque 64×64 dirt, grass and gravel using original
  periodic clusters and ramps with budgets of 12/8/12 colors respectively.
  Purchased assets are local study references only; generation reads no images,
  extracted palettes, masks or training inputs.
- [x] Generate sixteen grass/dirt corner cases (NW=1, NE=2, SE=4, SW=8), a
  256×256 atlas and a connected-patch preview. All compatible edge profiles and
  separate diagonal grass corners pass for seeds 1204, 1215 and 1233.
- [x] Deliver editable recipe, `retro-terrain-pack/1` metadata, source identity,
  encoded/raw hashes and browser ZIP export. The separate CLI command uses
  content-addressed caches, regenerated-byte validation, bounded recipe/cache
  reads and cleanup of owned pending output. Completed historical bakes remain.
- [x] Integrate the quiet Retro terrain disclosure with exclusive material/retro
  preview ownership, seed/draft recovery, repeat/view selection, visible errors,
  export snapshot preservation and cancellation/retry. Fixed-size PNG encodes
  run together; the new touch controls have targets of at least 44 pixels.
- [x] Inspect native images, exact 3× enlargement, 4×4 surface repeats, all
  transition cases and the connected patch. Retain seven original-only images
  (92,109 bytes), recipes/source hashes and a read-only verifier in
  [the study](../../look-dev/retro-terrain.md). These remain unapproved artwork.
- [x] Preserve existing generators, catalog/corpus output and export formats.
  Full unit proof retains legacy cliff hashes. The existing full Pages material
  browser matrix passes all forty family/style controls and judge recovery;
  final retro browser proof also exercises exclusive switching between panels.
- [x] Update this work record and owning guides. No Summary Bank exists; no
  routes, packs, dependencies, Phaser integration, Git index or publication were
  changed during this implementation.

Runtime: Windows, Node v26.5.0, npm 11.6.2 and PowerShell 7.6.6. Commands below
exited 0. The [portable receipt](../../look-dev/retro-terrain-proof.json) records
candidate hashes, exact commands and compact browser result summaries. Full
logs/captures and earlier failed harness diagnostics remain local under
`.artifacts/proof/retro-terrain*`; local paths are not published document links.

| Check | Observed result |
| --- | --- |
| `npm test` | 325 passed: 245 script and 80 source tests; no failures |
| `npm run typecheck`, `npm run lint` | Passed; lint has no warnings |
| `npm run build`, `npm run build:pages` | Production build passed; Pages prerendered both routes; no configured DB migration |
| `node scripts/test-retro-terrain-browser.mjs --playwright-root node_modules/playwright --dev-url http://127.0.0.1:8080/` | Final dev receipt `1791750221647-38732`; twenty decoded PNGs match CPU RGBA, ZIP/metadata, persistence, failure/retry, cancellation and touch targets pass |
| `node scripts/test-retro-terrain-browser.mjs --playwright-root node_modules/playwright` | Final built receipt `1791750227580-52476`; same full checks pass |
| `node scripts/test-material-browser.mjs --playwright-root node_modules/playwright` | Legacy full built receipt `1791749707455-26104`; passed before final retro-only encoding/CSS polish |
| `npm run bake:retro-terrain -- --seed <1204/1215/1233> --out .artifacts/retro-terrain` | Three current source-bound kits; twenty PNGs plus recipe/manifest each |
| `node docs/look-dev/studies/retro-terrain-20261011/verify.mjs` | Seven retained originals regenerate exactly |
| `git diff --check` | Passed |

Final desktop and 390×844 mobile browser captures were inspected. Only the
intentional missing-source 404 appears in the expected-console-error list;
unexpected error arrays are empty. Test-owned browser/preview instances closed.
The previously retained live preview keeps its owner and shutdown route in
`.runtime/review-cleanup-dev.json`. No external engine receiving, hosted
deployment, Node 22 lane or art approval is claimed.

The subsequent growth batch adds gravel paths and weathered drawings below.
Masonry, timber and metal follow visual acceptance. Multi-channel maps and engine
receiving remain separate work. The earlier HD-2D dirt outcome below stays open.

## Current pass: retro paths, weathering and drawing curation

- [x] Keep the original generator, recipe, nineteen tile pixels and atlas exact
  for seeds 1204/1215/1233. Regression pins and the old seven-image verifier pass.
  The new growth recipe uses its own drawings; choosing **Original tiles** still
  recovers the earlier kit. The existing 58-file staged owner snapshot is unchanged.
- [x] Supply 70 native tiles and four atlases: base/worn surfaces and corner
  cases, plus all sixteen normal/worn path masks. Path bits N=1/E=2/S=4/W=8,
  twenty-pixel boundary mouths, hard alpha and zero RGB outside are explicit.
  Paths narrow inside the tile; connected footprints and compatible ports pass.
- [x] Add independently authored Heath and Riverbed ramps, keeping finite
  8/12/12 grass/dirt/gravel roles. Palette changes preserve geometry/opacity;
  weathered grass and gravel declare their soil color roles. No purchased images,
  extracted palettes or training inputs enter generation or evidence.
- [x] Replace the rejected noisy growth draft with editable native symbol maps,
  distinct ground-plane silhouettes and curated cluster layouts. Weathering
  removes whole features. Independent art critique prompted smaller angular
  gravel aggregates, varied anchors and narrower rough path interiors.
  The requested Phaser agent's consultation led to earth-filled paths, open
  grass colonies, connected gravel faces and broken soil rims. Its follow-up
  motif polish preserves classic tiles, gravel and path drawings.
- [x] Assess the supplied Godot/jMonkeyEngine repetition references. Add native
  multi-seed previews while preserving palette colors and matching topology.
  Record the four seed recipes in the manifest; previews are not extra kit PNGs.
  Phase previews diagnose alignment; they are not independent layout variants
  and do not establish craft or eliminate repetition.
- [x] Extend seed/palette draft recovery, ZIP export and the separate bounded
  CLI/cache. All 74 PNG exports match CPU pixels. A reproduced Windows publication
  lock now has a four-attempt atomic retry; transient, persistent, cancellation
  and non-lock failures preserve completed output and clean only owned pending data.
- [x] Retain twelve original-only review PNGs (55,787 bytes), source/recipe
  hashes and a read-only verifier in [the growth study](../../look-dev/retro-terrain-growth.md).
  Inspect native/3× drawings, four-by-four repeats and connected terrain.
- [x] Keep the large retro stage on integer device pixels. Desktop and phone
  DPR 1 use 3× magnification; a separate DPR 2 phone context uses 1× device
  magnification and closes after proof. Oversized native sheets can scroll.
- [ ] **Visual acceptance:** owner review of the curated candidates remains.
  The requested Phaser agent has reviewed the board and connected scene, and
  its accepted feedback and motif polish are implemented. Repeated 64-pixel
  landmarks remain visible; new layout variants wait for base approval.
  Art stays unapproved; technical tests cannot close this item.

Local proof: 341 tests passed (261 script, 80 source), typecheck/lint, production
build and Pages prerender. Final growth dev/Pages and classic Pages checks cover
decoded RGBA, palette/view changes, exclusive previews, persistence, snapshot
exports, missing-source retry, cancel/retry and desktop/mobile rendering.
Classic dev proof is reused for its unchanged pixels and integration. Exact
commands, final receipts, source identities and remaining limitations are in
[the growth proof record](../../look-dev/retro-terrain-growth-proof.json).

The live preview retains its existing owner and shutdown route; test browsers
and temporary preview servers close. No Summary Bank exists. No dependencies,
engine receiving, PBR channels, public corpus promotion, Git staging, commit or
push occurred during that local growth batch. Publication is now explicitly
requested and remains blocked as recorded below.

## Current retro closeout and publication

- [x] Revalidate all twenty current code/recipe/test source hashes, five retained
  check logs and sixteen browser evidence hashes. The existing 341-test,
  typecheck, lint, production/Pages build and browser results remain current;
  no app code changed during this closeout. The classic and growth study
  verifiers pass again for seven and twelve original-only images respectively.
- [x] Confirm existing local `main`, tracking `origin/main` and actual remote
  `main` all resolve to `c26d117c6de03432b469abbfc55e061778512735`; there are no
  outgoing commits. Preserve the exact earlier 58-file staged snapshot and
  current unstaged/untracked task work. No Summary Bank exists.
- [x] Verify the retained live-preview wrapper/server PID, exact creation time
  and executable, listener ownership and HTTP 200. It remains deliberately
  retained under `.runtime/review-cleanup-dev.json`. Browser/Pages test resources
  are closed; no pending bake directories remain. Original-only study files,
  source-bound bakes and bounded local proof remain retained for acceptance and
  the unresolved publication gate; no bulk cleanup is appropriate.
- [ ] **Publication, owner: platform/auth broker.** The current publication
  owner's value-free scan exits 1 with one `assigned_secret` finding in
  `src/lib/auth/preview.ts`. It is the same previously recorded baseline
  platform credential. Supply its supported environment-injected credential
  path and matching broker configuration, preserve preview sign-in, and pass
  the existing secret guard. Then refresh affected auth proof and use the
  documented guarded helper for the named verified snapshot. Do not bypass the
  guard, move credentials, or publish the unrelated index indiscriminately.

The exact current command/result, source identity, prospective retro task paths,
remote state and retained resources are in
[the publication closeout record](../../look-dev/retro-terrain-publication-20261011.json).
The current owner scan failed before helper commit/authentication; the full
helper was not repeated after this known failed prerequisite. No commit, push,
deployment or art approval is claimed. Visual acceptance remains open above.

## Still-open material pass: dirt structure refinement

- [ ] **Desired result:** a more irregular HD-2D dirt candidate that removes the
  regular row/ridge reading identified by the study. Change only dirt structure
  and its matched channels; retain family color intent and existing style profiles.
- [ ] **Done When:** compare current and refined dirt at 128 pixels and 2×2
  repetition using seed 1204, inspect matched height/normal/roughness, and show
  that dark/local crack features agree with intended relief. Verify deterministic
  repeat behavior and wrapped normals for seeds 1204/1215/1233, preserve the legacy
  cliff hashes and unaffected families, and exercise all four dirt styles through
  the existing authoring/export contracts. Retain a compact before/after record
  and keep artwork unapproved pending owner approval.
- [ ] **Order and exclusions:** refine dirt first, then reassess grass tuft
  readability. Preserve commands, schemas and source-bound cache identity;
  new-source outputs do not overwrite historical bakes. No engine edits, public
  promotion, new families, dependencies, broad rewrite or Git publication.

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=review-recheck-cleanup | change=recorded source coverage, closed findings, proof and bounded visual-study handoff

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=grass-dirt-study | change=closed selected study criteria and ordered the evidenced dirt/grass refinement work

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=closeout-publish | change=recorded scoped progress closeout, portable evidence, owned retention and remaining refinement

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=retro-terrain | change=recorded implemented color kit, source-bound proof, unchanged staged ownership and remaining art/engine work

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=retro-terrain-growth | change=recorded path/palette growth, curated drawing correction, proof and pending visual acceptance

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=retro-terrain-closeout-publish | change=revalidated current proof, preserved staged ownership and recorded the current publication guard failure
