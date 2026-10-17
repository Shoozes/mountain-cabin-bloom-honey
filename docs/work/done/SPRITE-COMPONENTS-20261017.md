# Transparent-sheet sprite extraction

Status: Complete with verified limitations. Implementation proof and the
subsequently authorized publication are recorded separately.
Repo/run: mountain-cabin-bloom-honey / sprite-components-20261017.
Base: `612585e1bb657e73bfc4ce67543a32cf9dbc99fc` plus preserved unpublished work.

## Selected outcome

TODO's next bounded migration is actionable: grid/GIF imports already exist, but
the current importer has no connected-component detection or reviewed grouping.
There are no unprocessed research-inbox notes. Prior recovery/character fixes
are complete against their source-bound proof; they need no repeat redesign.

Add transparent static PNG extraction to the headless SDK and existing Studio
import disclosure. Detect four/eight-neighbor pieces, review explicit grouping,
padding and anchors, then convert to editable recipes. Preserve source colors
and cutout coverage, including holes and overlapping component bounding boxes.
No inferred directions, semantic layers, cleanup, recoloring or new artwork.

Owners: `packages/grout-art/components.mjs`, SDK exports/declarations,
`src/art/sprite-import.ts`, the import component and shared Studio styles,
source-bound bakers/exports, focused import tests/browser harnesses and guides.
Accepted traveler, creator and terrain drawings/fixtures remain protected.
One worker owns the disjoint headless module/tests/types; root owns integration.

## Done when

- Deterministic detection and explicit component groups retain every source
  opaque pixel once. Partial alpha, invalid groups and exceeded budgets reject
  visibly. Group crops never include unrelated pieces inside their bounds.
- Editable recipe round trips, source placement metadata, anchors and atlas
  reconstruction remain exact; browser and CLI decoded exports agree.
- Studio supports detection/review, grouping, padding, anchors, cancel/retry,
  undo, source guards and recovery on desktop and narrow layouts. Old grid/GIF
  behavior and accepted artwork remain unchanged.
- Focused tests, headless/declaration consumers, full tests, typecheck, lint,
  both builds and dev/built browser checks pass. Update TODO, guides and useful
  Summary Bank ownership. Retain compact original-only evidence and stop owned
  browser/preview resources.

## Delivered and verified

`detectSpriteComponents` and `importSpriteComponents` provide bounded,
cancellable eight/four-neighbor detection and explicit groups, padding and
anchors. The SDK reuses the exact mask importer and retains `grout-art/1`, with
additive `sprite-components/1` source/placement metadata. Every group isolates
its own pixels, including rings enclosing another piece. No source art changes
or animation directions are inferred.

Studio adds **Loose sprites (transparent PNG)** within the existing importer.
Detection, group review and conversion remain separate actions; integer preview,
visible failures, cancellation, source guards, undo/redo and completed-import
recovery work on desktop and narrow layouts. One transparent source is reviewed
at a time. Temporary file/group choices are not draft-persisted; the completed
recipe, its source metadata and artwork are persisted normally.

The first full-suite run exposed an old fixed source-file count after the SDK
grew; the regression now checks exact registered paths, including the component
module. A browser test exposed deferred React event access in the new group
field; handlers now capture values before queuing updates. Focused reproductions
passed before the full dev/built browser reruns. Initial diagnostics remain
historical beside the final receipts.

- Focused component/import tests: 13 passed, including normalized source
  reconstruction, overlapping bounds, palette index zero, grouping/order,
  dimensions/budgets, metadata round trips and real cancellation.
- `npm test`: 411 passed (386 script tests and 25 source tests).
- `npm run typecheck`, `npm run lint`, `npm run build:art-sdk`, `npm run build`
  and `npm run build:pages`: passed. Four existing lint warnings remain in
  historical terrain evidence; no new warnings or errors.
- Dev/built `test-art-import-browser.mjs`: passed with zero page errors. Each
  lane proves explicit grouping, four/eight connectivity, padding/custom anchor,
  cancellation during decode/conversion, invalid input, source guards,
  undo/recovery, browser/CLI decoded PNG equality and source reconstruction.
  Twenty new component GPU comparisons match exactly; 164 neighboring
  grid/GIF/outline comparisons remain exact (184 total across both lanes).
- Desktop and 390×844 captures were inspected. This is local Chrome viewport
  proof, not physical-device qualification. The fixture contains original
  geometric shapes only. Accepted traveler/creator and terrain hashes remain
  unchanged; no purchased/reference pixels enter fixtures or exports.

Current source-bound logs, receipts and compact captures:
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/sprite-components-20261017/`.
Owned resources are recorded in `.runtime/sprite-components-20261017.json`.
Richer variation, optimization and broader conversion remain future TODO work.
The implementation phase made no Git publication, deployment or donor changes.

## Paired closeout and publication

The owner subsequently requested Closeout + Publish for the verified character
and extraction progress. The 411-test suite, typecheck, lint, SDK consumers and
both builds remain current for their inputs. Fresh character dev/built browser
checks qualify the shared Studio/import changes: 1,296 exact GPU comparisons,
recovery, playback, painting/imports and export failure/cancel/retry with decoded
CLI equality. Together with the extraction/import lane, 1,480 GPU comparisons
have zero differing bytes. Accepted artwork is preserved.

Publication selects 32 named task paths on existing `main`, using only the
guarded helper. The unrelated Riasmap note is preserved outside that selection.
Current browser receipts are in `closeout-character-browser/`; candidate hashes,
the guarded result and the confirmed remote commit are bound separately in
`publication.json` under this run's evidence root. Owned preview processes are
stopped; compact proof and SDK output are deliberately retained. Remaining
roadmap work and unapproved artwork retain their existing TODO boundaries.

AI-created: 2026-10-17 | agent=Codex/root | task=sprite-components

AI-edited: 2026-10-17 | agent=Codex/root | task=sprite-components | change=qualified lossless extraction, browser integration and preserved accepted art

AI-edited: 2026-10-17 | agent=Codex/root | task=sprite-closeout-publish | change=bound fresh shared-workspace proof, scoped publication and retained owner work
