# Minecraft-style native block textures

Status: Complete. Repo/run: mountain-cabin-bloom-honey / voxel-material-20261023.
Base: main `cb65ea8e67ec42a64d727451b52e9648fe9428ec`.
Requested outcome: study Minecraft resource-pack textures and make them a texture
type. The owner selected Classic/default 16×16, then explicitly authorized paired
Closeout/Publish for this batch. Existing destination: repository main.

## Boundary and drawing contract

Study official Minecraft texture imagery and its artist's discussion of crisp
pixels and pack consistency. Add original native16 block materials as a separate
`voxel-surface` recipe, with grass, dirt, stone, cobble, sand, planks, bark and
brick. References inform design; their pixels, ramps and code are not inputs to
our generator, fixtures or exports. Preserve all existing recipe defaults,
validation and channel pixels. Preserve the unrelated untracked Riasmap note.

Use deliberate finite-palette material clusters on a fixed 16×16 grid. Larger
outputs enlarge that grid by integer nearest sampling, including height and
native-derived +Y normals. Pigment has no fixed directional light. Existing
seed/palette/structure/wear/relief/roughness controls stay meaningful; native,
integer and multi-tile studies judge craft separately from format correctness.
Artwork remains a candidate pending owner acceptance.

## Done when

- A discoverable Minecraft-style texture type opens the material authoring path;
  all eight families preview at native16 and repeat, with contextual controls,
  usable desktop/narrow access and draft recovery.
- Browser and CLI export the same four channel pixels, native dimensions and
  complete recipe. New module/version source identities and cache guards cover
  the new type; failures preserve the draft and prior export.
- Native16 drawings are visually reviewed with integer and repeated views;
  all enlarged channels preserve exact native texels. Finite palettes, opaque
  alpha, deterministic seeds, wrapped normals and meaningful controls pass.
- Frozen legacy recipes/pixels remain exact. Focused tests, full npm test,
  typecheck/lint, normal/Pages builds and real dev/built browser export checks
  pass. Update TODO, guide and bounded Summary Bank routes; release task-owned
  services and scratch. Guarded publication follows local proof; Minecraft
  engine packaging remains separate.

Retained proof: `D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/voxel-material-20261023/`.
Reference-only captures are labelled separately from original generated studies.

AI-created: 2026-10-23 | agent=Codex/root | task=voxel-material | change=bound classic16 reference study, original block family and local acceptance proof

## Delivered and verified

The `voxel-surface` registry entry/version, strict recipe union and native16
producer add eight original finite-palette families. Every export size from
16 through 512 enlarges the native grid by an integer, including floating-point
height and native-derived normals. Source binding includes the new module in
both browser and CLI kits; ordinary material assets, provenance, cache/tamper
guards and default recipe validation remain intact.

The catalog shortcut opens the existing material drawer; recipe/family/export
size labels are contextual. The main preview uses integer device-pixel fitting
for native blocks. Existing photorealistic/style routes keep their own defaults.
Both material shortcuts wait for hydration/recovery, preventing an ignored
early click observed during the first browser check. A later narrow navigation
diagnostic was a harness error: the open Adjust drawer correctly covered the
catalog. The harness now closes that owner before clicking the catalog. No
forced-click bypass or product hit-testing change was made.

Reference study used eight official Mojang block textures and the artist's
crispness/consistency discussion linked in the guide. The source grass image is
grayscale; our own green ramp is used. The initial broad/flat draft was refined
with smaller stepped marks, quieter sand contrast, wood grain, contrasting
mortar and clearer cobble joints. Native, 8× and repeated studies were inspected.
Reference screenshots remain separate from the original generated study and
are absent from fixtures, source and exports. Owner artwork approval is open.

Observed final local commands, all exit 0:

- `node --test scripts/material-voxel.test.mjs scripts/material-voxel-export.test.mjs`:
  12 pass. Strict new-only sizes/schema, eight deterministic opaque finite-palette
  families, controls/seed/normal behavior, enlargement, actual CLI/default/version,
  decoded PNG bytes, cache/source tampering and abort/pending cleanup are covered.
- Final `npm test`: 293 pass (264 script, 29 source). The preceding run passed
  292; the final run includes the diagnostic selection guard added afterward.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run build:pages`:
  pass. Final lint also covers the finished browser runner. Both builds
  prerender all four routes. Existing art SDK source was unaffected.
- `node scripts/test-material-voxel-browser.mjs --dev --proof-out <run>/browser`,
  `--mode root` after the normal build and `--mode pages` after the Pages build:
  each passes four grouped flow checks, 102 exact channel canvas comparisons
  and 48 browser PNG channel cases also matching CLI and Node. Totals: 306
  previews and 144 export cases, zero differing bytes/unexpected browser errors.
  Every lane covers all eight families, three seeds and four channels; native,
  32/512px actual downloads; source failure/retry; recovery; integer repeat
  fitting; real 390px export; keyboard, reduced-motion and forced-colors access;
  and neighboring realistic/style defaults and size restrictions.
- The explicit `--quick` diagnostic on that same runner passed nine previews
  and sixteen PNG cases before the full matrix. It preserves the same browser,
  controls, export/cache producer and assertions while reducing families/seeds/
  sizes. It is not release proof. The default full selection, exact quick
  selection and invalid/duplicate flags have a focused regression guard.
- Frozen pre-change compatibility: 58 complete recipes and 232 channel hashes
  remain exact, across legacy/style/realistic/tuft/clump owners. An independent
  full-byte native-row replication check verifies all eight families × six
  sizes × four maps (192 maps / 11,182,080 pixels).
- `node scripts/study-material-voxel.mjs --out <run>/study` produces 28 original
  files and 24 three-seed cases. Native, integer, repeated and channel views
  retain current producer/source hashes. Desktop and narrow dev/built captures
  were inspected. Chromium was Chrome 155.0.8059.86 at device scale 1; this is
  browser emulation, not physical-device or Minecraft receiving proof.

`<run>` is the compact evidence directory above. `verification.json` binds
actual input bytes, commands, exit codes and receipt locations. The repository
uses Node 26.5.0, npm 11.6.2 and PowerShell 7.6.6 for this proof. The focused
`material_voxel` Summary Bank route links generator, contracts, exporters,
tests, study and guide; shared catalog/control ownership stays in `product_ui`.
TODO retains owner acceptance and the prior format/engine roadmap.

## Owned resources and publication

The reference browser session closed through its named CLI owner. Its receipt
remains under ignored `.runtime/voxel-material-study.json`. Each dev/preview
test server and browser closes in `finally`; task-owned scratch bakes/downloads
are removed by their owners. Current referenced compact proof, the current
ignored build, existing SDK output and quarantine remain retained. No unrelated
source or Riasmap note is read, hashed, deleted or absorbed.

The explicit paired Closeout/Publish request authorizes these scoped changes
on existing main at `Shoozes/mountain-cabin-bloom-honey`. At intake local main,
origin/main and exact remote main matched `cb65ea8`; the index was empty and no
prior outgoing commit existed. `publication-paths.json` is the exact 16-file
allowlist, excluding the unrelated untracked Riasmap note. Only the unchanged
`.tools/gitpush.ps1` may create the named local candidate and then push it.
Verify canonical Git blobs against the reviewed inputs before push, respecting
required LF normalization; retained proof binds the tested working bytes.

`closeout.json` binds final source/records, gates and owned-resource disposition.
`publication.json` records the actual helper commands/results, exact confirmed
remote commit and verification command. A local candidate or attempted push
alone does not establish publication. No deployment, release, policy, dependency,
donor-art redistribution, game acceptance or Minecraft packaging is part of this
batch. Blockers for this verified local format/type outcome: none.

AI-edited: 2026-10-23 | agent=Codex/root | task=voxel-material-closeout-publish | change=recorded finished native16 type, visual refinement, current local proof, owned cleanup and scoped guarded publication

## Post-publication review, recheck and cleanup

Status: Complete. Reviewed source: published
`90a750be9dbda2b805760f9fdf08a9538e185ea3`, with no tracked working changes
at intake. Exact remote main matched through `git ls-remote --heads`. The
unrelated untracked Riasmap note was preserved without opening its contents.
Review/Recheck stayed read-only; Cleanup updates this record and TODO only.
No publication is part of this pass.

Coverage: the Summary Bank's material_voxel route and affected product_ui
owners, native generator/validation, registry and types, control/reset/recovery
paths, integer preview fitting, browser/CLI channel and source identity,
cache/abort ownership, focused tests, study/browser producers and authoring
guide. Retained original-family and narrow Pages captures were inspected.
This establishes a focused review of the published native16 batch, not a new
whole-repository audit. There was no earlier formal published-batch review;
the recheck baseline is the implementation diagnostics recorded above.

Recheck dispositions:

- Verified closed: board/brick row dimensions divide 16 and alternating offsets
  wrap with an even row count; bark groove periods also divide the native grid.
- Verified closed: both material catalog shortcuts wait for hydration/recovery,
  and the selected recipe request reaches the existing material owner.
- Verified closed: browser and CLI source inventories include the native16
  module. Cache validation and source-fetch failure/retry remain covered.
- Verified closed as a harness correction: narrow catalog navigation closes
  the covering Adjust drawer before using the next catalog shortcut.
- New/still-open actionable code findings: none. Artwork acceptance and
  receiving-engine qualification remain outside this technical review.

Fresh read-only `node --input-type=module` probes (Node 26.5.0, exit 0) matched
all 28 retained publication inputs before these documentation edits. All three
full dev/root/Pages browser receipts matched their 11 current behavior inputs
and retain zero unexpected errors, 306 exact previews and 144 PNG cases.
The frozen baseline still matches 58 complete legacy recipes and 232 channel
hashes. Boundary probes cover all eight families at uint32 seeds 0/4294967295
and cluster scales 1/8 with maximum wear/relief and minimum roughness: 32 recipes,
128 full-byte 512px enlarged channel maps, 32 enlarged floating-point height
maps, 128 wrapped corner normals, opaque finite palettes, deterministic repeats
and flat relief-zero normals. Twenty-nine invalid boundary/type inputs fail
validation. All assertions passed.

The existing 293-test, typecheck/lint and normal/Pages build qualification
remains applicable to unchanged behavior inputs. Those full gates and browser
flows were not rerun for this documentation-only cleanup. Existing Summary Bank
routes still own the affected files; no routing rewrite or new implementation
task is justified. No new server, process, bake, capture or temporary output was
created. The retained proof above remains protected. Owner review of the
original native/repeated drawings remains the next candidate-acceptance step.

AI-edited: 2026-10-23 | agent=Codex/root | task=voxel-review | change=recorded focused published-source review, verified-closed diagnostics and read-only boundary/compatibility proof without inventing repairs

## Review records closeout and publication

The subsequent paired Closeout/Publish request authorizes the review updates in
`docs/TODO.md` and this work record on existing main, based on `90a750b`.
The index is empty at intake; local main, origin/main and exact remote main
match. These two documentation paths are the complete publication allowlist.
The unrelated untracked Riasmap note remains excluded and unopened.

Closeout verifies the final diff, review link/anchor, existing Summary Bank
routes and unchanged qualification inputs. The review probes above remain
current. The 293-test, typecheck/lint, both builds and full dev/root/Pages browser
proof are reused against unchanged product inputs; this documentation batch
does not rerun them. No new process, server or scratch cleanup is required;
existing referenced proof/build output remains retained under its owner.

`review-publication.json` under the retained run above binds the final candidate
paths/bytes, checks, guarded helper results and exact remote-main verification.
Only `.tools/gitpush.ps1 -CommitOnly -Path <two-file allowlist> -Message <message>
-Yes`, followed by verified push-only `.tools/gitpush.ps1 -Yes`, may publish this
batch. The receipt records the actual outcome; a local commit alone is not
publication. Owner artwork acceptance remains open. No deployment or release.

AI-edited: 2026-10-23 | agent=Codex/root | task=voxel-review-closeout-publish | change=bound the documentation-only review batch to reused proof, exact paths, owned-resource accounting and guarded publication
