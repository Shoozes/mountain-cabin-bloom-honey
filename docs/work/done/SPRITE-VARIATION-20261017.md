# Richer sprite variation and lossless recipe optimization

Status: Complete with verified limitations. Guarded publication authorized on
2026-10-17; its confirmed remote result is recorded separately below.
Repo/run: mountain-cabin-bloom-honey / sprite-variation-20261017.
Base: `bcf42bfb139d588bce64c8b7d05031765d63cf78`.

## Selected outcome

TODO's next migration is reusable sprite variation and lossless optimization.
Implement complete palette/animated-part families, deterministic group streams,
locks, rerolls and four-candidate Studio selection. Preserve accepted traveler
and character source/pixels, existing drafts and commands. Add a lossless
transport that restores the full authoring document, with per-frame CPU proof,
source-bound exports/cache and honest raw/gzip/runtime measurements.

The built-in opt-in family combines existing clothing, hat/color drawings and
optional equipment (96 choices); it introduces no newly drawn anatomy. Generic
imports expose their existing palette as a starter for explicitly authored
alternatives. Character variation remains owned by its creator compiler.

## Delivered contracts

- Headless typed family parse/apply/randomize/batch APIs. Disjoint complete
  group patches and final graphs validate before replacement. Locks persist;
  targeted rerolls exclude their current option. Seeds remain separate from
  the drawing seed, and stable group IDs isolate random streams.
- Studio disclosures, following the existing sprite bench: native candidate
  thumbnails, choice/locks, undo/recovery, retained invalid family source,
  cancellable optimization and visible retry errors. Main canvas/timeline,
  ordinary recipe edits and character workspace retain their ownership.
- Bounded backward-reference transport shares repeated subtrees and restores
  exact authoring objects with independent editable copies. No drawing changes,
  palette loss, hidden-source deletion or character-integrity bypass.
- Browser/CLI kits retain readable recipe/creator/character/PNG/Phaser assets and
  append optimized transport/report. Existing CLI accepts either input; source
  identity and validated caches include all new modules.
- Runtime cost basis now includes character and sprite-component modules that
  the prior browser measurement omitted. Gzip and full SDK-plus-recipe costs are
  measured independently. Optimization targets uncompressed bytes; it can cost
  more under gzip. Compact runtime migration remains separate.

## Verification

- `node --test scripts/art-variation.test.mjs`: nine focused tests pass. All
  96 built-in combinations preserve anatomy/frames/layers/clips. Seeds
  1204/1215/1233, stable group streams, persisted locks (including batch defaults),
  explicit rerolls, invalid scopes and graph failures are covered.
- `npm test`: 420 pass (395 script tests plus 25 source tests). Accepted/default,
  historical traveler and classic/growth/curated terrain pixel contracts pass.
- `npm run build:art-sdk`, `npm run typecheck`, `npm run lint`, `npm run build`
  and `npm run build:pages`: pass. SDK declarations/headless consumers accept
  family APIs and optimized transport. Context Audit: 42 groups, zero missing
  patterns or over-budget groups. `git diff --check`: pass.
- Dev and built `scripts/test-art-browser.mjs --ui-only`: complete existing
  wardrobe/playback/recovery, editing, examples, unavailable-GPU fallback and
  export failure/cancel/retry flows pass. New variation checks include candidate
  selection, locks/rerolls, undo, malformed family persistence, desktop/narrow
  layouts, last-valid character optimization and exact browser/CLI PNGs.
- Final source-current `scripts/test-art-browser.mjs --variations-only` receipts
  cover all new controls again, plus 196 CPU/WebGL2/WebGPU frame comparisons
  (three seeds, accepted default character and custom technique), zero differences.
- Neighboring `scripts/test-art-import-browser.mjs` dev/built lanes cover grid/GIF,
  components and outlines: 184 exact GPU comparisons, no page errors, exact
  source/atlas/browser/CLI pixels. Final source-current dev refresh passes after
  restarting the dev server; a transient execution-context navigation during the
  preceding refresh is retained as a failed environment attempt, not counted.
- Fourteen protected source/fixture hashes match the prior baseline, including
  accepted traveler and character drawings/recipes/pixel pins. No protected art
  or palette source changed. Native-grid desktop and narrow captures inspected.

The default traveler minified source shrinks from 15,810 to 10,464 bytes; the
accepted character source from 39,115 to 29,807, restoring all twelve frames.
Measured gzip may favor the original; no ZIP-size or compact-runtime claim.

Retained receipts: `browser-current/{dev,built}-receipt.json`, neighboring import
receipts (`import-clean-dev/dev-import-receipt.json` and
`import-browser/built-import-receipt.json`), full command logs, `protected-check.json`, `artifact-relocation.json`,
`summary.json` and `sources.json`. Earlier failed/superseded browser attempts are
kept separately: a selector assumed the first textarea; it now names recipe
source explicitly. They are not counted as completed qualification. A broad
unchanged GPU matrix was deliberately stopped and excluded from current totals.
Evidence root: `D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/sprite-variation-20261017/`.

## Storage and boundaries

The owner explicitly approved relocating generated `.artifacts` to
`D:/RepoGenerated/mountain-cabin-bloom-honey/.artifacts`. Verified 4,675 files /
223,798,715 bytes before removing the original copy and creating the original-path
junction. Publisher fixtures were moved opaquely within C: to ignored
`.runtime/retained-publisher-artifact-fixtures`; a nested junction preserves
`.artifacts/foundation-publisher-fixtures`. Credential-shaped contents were never
opened, copied or hashed. `artifact-relocation.json` records the local exception.
This relocation grants no future deletion authority. Source/dependencies remain C:.

Owned previews are stopped, browser harnesses have exited and port 8080 is free.
SDK/bakes and compact proof are deliberately retained for continuation.

## Closeout and publication

The owner explicitly paired Closeout/Publish for this verified batch on
2026-10-17. Closeout confirmed all 49 scoped proof inputs and fourteen protected
art inputs match, main/origin/main/remote main start at the base commit, and the
index is empty. The existing 420-test, typecheck, lint, SDK, two-build and
380-comparison browser proof remains current; only these publication notes change.
Nine focused variation/optimization tests are rechecked before committing.

Publish only the 25 named task files through `.tools/gitpush.ps1` to existing
`origin/main` in `Shoozes/mountain-cabin-bloom-honey`. The guarded helper must
pass its source/history/security/destination guards. The exact file allowlist,
commit, confirmed remote SHA and verification command/result are retained in
`publication.json` under the evidence root. This receipt is authoritative for
whether publication succeeded; local completion alone does not establish it.

Current SDK/bakes, proof and ownership receipts are deliberately retained. No
unreferenced task scratch or active preview remains to remove. No deployment,
release, donor modification or expansion of art acceptance is authorized.
Unrelated `docs/look-dev/riasmap-terrain-selection.md` remains untouched.

AI-edited: 2026-10-17 | agent=Codex/root | task=sprite-variation | change=recorded bounded deliverable, verification route and approved storage relocation

AI-edited: 2026-10-17 | agent=Codex/root | task=sprite-variation-publish | change=bound current proof reuse, scoped publication and owned-resource closeout
