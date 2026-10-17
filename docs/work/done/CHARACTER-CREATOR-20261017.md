# Character creator recovery, motion and symmetry

Status: Complete with verified limitations. The owner accepted the displayed
Classic/Outlined 8-bit/Fern base and walk cycle on 2026-10-17. Other creator
designs remain candidates. The accepted traveler is unchanged.

## Result

Studio now completes hydration and local recovery before enabling authoring or
export. The lost draft was an early edit to server-rendered controls: the title
already existed, but recovery had not populated the source. Recovery then
replaced the edit. The workbench is inert during startup, readiness is exposed
through `aria-busy`, and tests wait for the durable state instead of a title or
a transient message.

Malformed recipe text survives reloads and Sprite/Character switches. It retains
the last valid recipe/document and preview, disables conflicting controls only
in its own workspace, and supports reset. Keep/Reject feedback, painted custom
parts, locks and imports remain recoverable.

The pixel-art agent inset profile eyes, created skin clearance beneath narrow
hair/headwear, balanced both profile contact reaches, distinguished near/far
shoes and raised the passing foot. All nine default build/style combinations
were inspected at native size, exact 4x and in walk order. The native 16px body,
24px default frame, fixed feet anchor, palettes and 8 fps sequence remain intact.
Twelve character tests include composited eye clearance and visible alternating
shoe material. Eleven protected traveler/terrain source and fixture hashes match
the starting baseline exactly; historical traveler pixel tests also pass.

## Recovery milestone qualification

- `npm test`: 400 passed (375 script tests and 25 source tests).
- `npm run typecheck`, `npm run build:art-sdk`, `npm run lint`, `npm run build`
  and `npm run build:pages`: passed. Four lint warnings remain in historical
  retained terrain diagnostics; changed source has no lint errors.
- `node scripts/test-character-browser.mjs --dev-url http://127.0.0.1:8080/ --proof-out <run>/artifacts/browser-complete`
  and the same command without `--dev-url`: passed on Chrome 155.
- Each lane rendered 324 frames per backend across nine builds/styles and three
  seeds. CPU, WebGL2 and WebGPU agree exactly: 1,296 GPU frame comparisons across
  both lanes, zero differing bytes. All four Studio walks play the ordered
  contact/passing/opposite-contact/passing sequence with exact CPU poses and a
  stable anchor.
- Dev/built desktop and mobile viewport checks cover generation, locks, painting,
  undo/redo, creator JSON errors, Keep/Reject history, twelve-pose imports,
  delayed hydration, independent draft recovery, malformed-source reload/reset,
  export errors, in-flight cancellation, retry and decoded browser/CLI PNG equality.
- The legacy Studio browser harness passed on dev and built output, including
  historical recovery, wardrobe, exact export pixels and unavailable GPU fallback.

The character harness now uses an isolated SDK page for the long renderer
matrix and verifies the authoring document, raw source and pixels afterward.
A diagnostic navigation-count assertion was replaced by actual state/preview
preservation: development history/HMR events are not themselves data loss.
Export fault injection now matches hashed built filenames as well as dev source
paths and proves a request was intercepted. Cancellation waits for an actual
in-flight fetch and releases test-owned waits during cleanup.

## Owner motion feedback and replacement candidate

The owner rejected the earlier walk as odd, then required even head widths and
symmetrical standing sprites facing up/down. The replacement removes the
passing-key head/torso jump, shortens the shirt to reveal the knee interval,
redraws the arm counter-swing and keeps profile near/far shoes separated in
depth. Shoe volume remains constant across both contacts and passing. The arm
no longer occludes the far shoe. Front/rear foot support alternates; frame names,
twelve-frame mapping, 8 fps timing, anchors and palette values are retained.

Generated head widths are even and centered in all directions. The slim rig is
now eight pixels wide; profiles narrow by two down to six. Custom contour cuts
retain a full-width temple and readable face plane. Torso widths also stay even
so the front/rear idle can be centered on the same native axis. Older odd-width
v1 rig values round up on parse, and Studio uses that same canonical document
for its controls, editable source, persistence and exports. Imported/custom
source pixels are not rewritten.

Built-in front/rear idle frames are exactly mirrored RGBA, including shoe
placement, hands/cuffs, hair fringe, centered ponytails, hood width, clothing
panels and shading planes. Idle cuffs occlude both arms equally. Walking keeps
the near arm in front for its counter-swing. Authored option pairs and seeded
adjustable/procedural designs are covered; arbitrary author edits and imported
parts remain editable rather than being destructively mirrored.

A focused pixel-art reviewer inspected the native, integer and temporal-order
sheets and found no material regression in the final nine default appearances.
This is a candidate craft review, not owner acceptance. The previous art loop
is retained as a rejected baseline. Current original-only studies and the
four-direction preview are under
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/character-motion-20261017/art/`.
Use `final/native.png`, `final/integer-4x.png`, `final/walk-order.png`, `walk.gif`
and `art-review.json`. No variants were added during this correction.

## Motion and symmetry qualification

- `npm test`: 403 passed (378 script tests and 25 source tests), including 15
  character tests. Coverage includes all authored option pairs, seeded designs,
  exact facing-idle RGBA symmetry, even head bounds/centering, old odd-width rigs,
  composited pupils, visible shoe materials and limb counter-swing.
- `npm run typecheck`, `npm run build:art-sdk`, `npm run lint`, `npm run build`
  and `npm run build:pages`: passed. SDK headless/declaration consumers passed.
  The same four historical lint warnings remain; no new lint errors.
- `node scripts/test-character-browser.mjs --dev-url http://127.0.0.1:8080/ --proof-out <run>/browser-final`
  and the same command without `--dev-url`: passed at the current product and
  harness source identities. Desktop/mobile viewport captures were inspected.
- Both lanes pass all four actual walk cycles, width controls and canonical
  source/document agreement, odd-width v1 recovery, independent malformed drafts,
  imports/painting/undo, export failure/cancellation/retry and decoded browser/CLI
  PNG equality. Each lane passes 324 frames per CPU/WebGL2/WebGPU backend:
  1,296 GPU comparisons total, zero differing bytes.
- All eleven protected traveler/terrain source and fixture hashes are unchanged.
  The native context audit passes with no missing routes or over-budget groups.

Current source identities, commands, logs, protected hashes and browser receipts
are retained in `D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/character-motion-20261017/`.
Use `summary.json`, `sources.json`, `protected-check.json`, `browser-final/` and
`logs/*-final.txt`. Earlier preliminary checks remain historical in the same run.

## Profile contour and shoe correction

The owner reported another concrete set of defects: odd profile feet, a loose
skin pixel on the face, inconsistent outlines, and a backpack reading as skin.
The previous visual review missed these. Source inspection confirmed a skin
write over the leading head contour, sideburn fills over their outer edge, an
accent stripe equal to skin, and a repeated two-row shoe stamp.

Built-in outlined drawings now finish their ink after authored fills, highlights
and material planes. The face no longer overwrites its outer contour. The inner
sideburn plane joins the filled head while its outer/lower edge stays inked.
This finishing applies only to generated parts; imported/painted custom masks
retain their source pixels. Outline-free remains a separate style.

Profile shoes have explicit native three-row shaft, material and sole masks.
The leading toe plants at the anchor, the trailing heel lifts, and the opposite
contact exchanges support. Knees and arms use bent clusters. The gathered key
keeps a one-pixel gap between its soles; it no longer makes one broad flat boot.
Heel articulation changes at most one silhouette pixel. Both directions retain
the same twelve-frame/8 fps contract, even heads and exact facing-idle symmetry.

Backpacks use only leather, leather-shadow and outline roles. Leather shadow
aliases existing ink, preserving the eight-color budget for an imported eighth
color even with an accent-bearing vest. A dedicated regression exercises this
case across all four palettes. No skin/apparel accent stripe is used on the bag.

The focused peer checked each reported defect and confirmed the final sole gap.
At this milestone it was a new local candidate awaiting acceptance. Original-only native,
integer and temporal sheets, the before/revised side poses and animation live in
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/character-contours-20261017/art/`.
Use `final/`, `side-poses.png`, `walk.gif` and `review.json`; prior studies remain
historical and the earlier motion candidate remains rejected.

## Contour and shoe qualification

- `npm test`: 404 passed (379 script tests and 25 source tests), including 16
  character tests. New checks cover exposed ink across built-in outlined options
  and seeded designs, material-only bag roles, alternating support, shaft/sole
  geometry and the passing sole gap. The existing symmetry, even-head, import,
  custom-paint, preservation, export and cache checks remain passing.
- `npm run typecheck`, `npm run lint`, `npm run build:art-sdk`, `npm run build`
  and `npm run build:pages`: passed. Four historical lint warnings remain.
- Dev/built `test-character-browser.mjs` passed at the final source identity,
  including desktop/mobile viewport captures, actual four-direction playback,
  recovery, editing, imports, export failure/cancel/retry and decoded CLI equality.
  Each lane passes 324 frames per CPU/WebGL2/WebGPU backend: 1,296 GPU comparisons
  total, zero differing bytes. SDK runtime/declaration consumers also pass.
- Eleven protected traveler/terrain hashes are unchanged. Native context audit
  passes with no missing patterns or over-budget packs. Current receipts and
  source identities are in `character-contours-20261017/summary.json`,
  `sources.json`, `protected-check.json`, `browser-final/` and `logs/*-final.txt`
  beneath the existing `D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/` root.

## Review, recheck and bounded cleanup

The read-only review used HEAD `612585e1bb657e73bfc4ce67543a32cf9dbc99fc`
plus the actual unpublished working tree. All 23 files in the contour milestone's
source inventory matched at review entry. Coverage followed `art_characters`,
`art_character_verification`, `art_studio`, shared recipes/exports and their
consumers, declarations and tests. Legacy terrain/material behavior is covered by
the full local regression suite; this was not a new foundation migration.
Ownership remains in this repository, with no donor or receiving-engine edits.

Recheck closed the prior hydration/source recovery, even-head and idle symmetry,
profile shoe, face pixel, overwritten outline and backpack-role findings against
current source and matching dev/built proof. The owner accepted the displayed
default after inspecting its contour/feet walk. Earlier rejected motion studies
remain historical; acceptance does not extend to arbitrary generated designs.

The review found and cleanup repaired:

- **P1: unreadable Sprite/Example draft loss.** The Sprite autosave overwrote a
  failed recovery with its starter; an Example parse failure also left the save
  scope on the ordinary Sprite key. Bind example identity before parsing and
  pause draft/source writes after failure. Keep original bytes through edits and
  reloads until **Replace saved draft** explicitly saves the current workspace.
- **P2: outline-free arm coverage.** Arm masks mapped contour cells to null,
  reducing a 3×4 arm to two skin pixels. Use skin coverage for those cells when
  outlines are off. Custom/imported options bypass the authored drawing routine.
- **P3: stale acceptance notes.** Record the owner's approval of the shown default
  and pin its palette, twelve decoded frames, anchors and clips before cleanup.
  The new fixture and regression prove the accepted default remains unchanged.

The next bounded migration is transparent-sheet connected-component extraction,
with explicit grouping/anchors, exact editable pixels and export reconstruction.
It is routed in TODO; richer variation and optimization remain later work. This
cleanup makes no publication or deployment claim and removes no owner files.

Cleanup qualification (`character-review-cleanup-20261017`):

- `node --test scripts/character.test.mjs`: 18 passed, including accepted default
  preservation and complete outline-free arm coverage across every rig/pose.
- `npm test`: 406 passed (381 script tests and 25 source tests).
- `npm run typecheck`, `npm run build:art-sdk`, `npm run lint`, `npm run build`
  and `npm run build:pages`: passed. Lint retains four historical warnings in
  existing retained terrain evidence; no new errors or warnings.
- Dev and built character browser harnesses: passed. Both exercise corrupt
  Sprite/Example draft and source preservation through edits/reload, explicit
  scope-local replacement, creator recovery, playback, imports, painting and
  export failure/cancellation/retry with decoded browser/CLI equality.
- Each lane matches 324 frames per CPU/WebGL2/WebGPU backend, giving 1,296 GPU
  comparisons with zero differing bytes. SDK runtime/declaration consumers pass.
- Native, integer and temporal art sheets were inspected. The recovery notice
  and replacement action were checked at desktop and narrow widths, including
  touch emulation. Current captures, receipts, source identity and command logs
  live in `D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/character-review-cleanup-20261017/`.

## Evidence and remaining acceptance

Recovery milestone receipts, original art studies and the earlier walk
are retained in `D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/character-recovery-art-20261017/`. These qualify recovery and the historical candidate; the owner later rejected that motion.
Use `summary.json`, `sources.json`, `artifacts/browser-complete/`,
`artifacts/art/art-result.json`, `artifacts/art/walk-before-after.gif` and the
corresponding logs. Earlier failed diagnostics remain historical. The starting
progress snapshot is retained under `character-creator-20261017`.

Owner acceptance of the shown Classic/Outlined 8-bit/Fern base is recorded in
TODO and `scripts/fixtures/character-accepted-20261017.json`. Peer visual review
covers nine default appearances; other custom/generated designs remain editable
candidates. Browser proof is
local Chrome desktop/mobile viewport evidence, not physical touch-device or
cross-device GPU qualification. Engine receiving, PBR, deployment and full Grout
parity remain separate outcomes.

The broader creator formats, parts, generation modes and template editing are
explained in [the guide](../../look-dev/character-creator.md). Summary Bank routes
implementation through `art_characters`, verification through
`art_character_verification`, and shared execution through `art_studio`,
`art_renderers` and `art_atlases`. The implementation and verification groups are
separate to keep their context packs within the existing 128 KiB budget.

## Publication closeout

After extraction changed shared Studio/import sources, the final closeout reran
the character browser harness on dev and built output. Both lanes pass current
recovery, four-direction playback, editing/imports, cancellation/retry and
decoded browser/CLI exports, with 1,296 exact GPU comparisons. The current full
suite has 411 passing tests. Earlier receipts remain historical at their source
identities; current receipts and the guarded publication result are in
`sprite-components-20261017/closeout-character-browser/` and `publication.json`
under the shared evidence root. Owner acceptance remains scoped to the shown
Classic/Outlined 8-bit/Fern base and walk cycle.

AI-created: 2026-10-17 | agent=Codex/root | task=character-creator-closeout
AI-edited: 2026-10-17 | agent=Codex/root | task=character-recovery-art | change=qualified recovery and peer drawing repairs; retained owner acceptance boundary

AI-edited: 2026-10-17 | agent=Codex/root | task=character-motion | change=recorded owner rejection, replacement gait, even widths and symmetrical facing idles

AI-edited: 2026-10-17 | agent=Codex/root | task=character-contours | change=recorded reported defects, corrected authored masks and preserved import palette space

AI-edited: 2026-10-17 | agent=Codex/root | task=character-review-cleanup | change=recorded read-only review and recheck, scoped repairs, owner acceptance and next bounded migration

AI-edited: 2026-10-17 | agent=Codex/root | task=sprite-closeout-publish | change=refreshed shared-workspace browser proof for the authorized publication
