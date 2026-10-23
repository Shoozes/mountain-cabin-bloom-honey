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
