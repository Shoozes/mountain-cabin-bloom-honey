# Character creator continuation

Status: Paused at the owner's usage-limit closeout request. Save current verified
progress; the full accepted creator plan remains open. Artwork is unapproved.

## Current implementation

The private SDK compiles `grout-character-creator/1` and `grout-character/1` into
the existing recipe format. Three rigs, three styles, four coordinated palettes,
authored/adjustable/procedural parts, compatible seeded rolls, per-slot locks,
custom painted copies, explicit twelve-pose imports, creator exports and Studio
controls are implemented. The native body is 16px in 16/24/32px frames, with a
fixed feet anchor and four-direction 8 fps walks. Prior traveler, imported sprite
and terrain fixtures remain intact.

Keep/Reject feedback is local, reversible and exported with each creator. It
skips exact rejected combinations and modestly biases subsequent samples.
Turning preferences off restores ordinary deterministic rolls. It is not a
trained aesthetic classifier.

## Verified in this session

- `npm test`: 398 passing tests (373 script tests and 25 source tests).
- `npm run typecheck`, `npm run build:art-sdk`, `npm run build`, and
  `npm run build:pages`: passed on Node 26.5.0 / Windows / PowerShell 7.
- `npm run lint`: passed; historical terrain diagnostic warnings remain.
- Ten focused character tests cover all nine rigs/styles, all supplied option
  pairs, palettes/seeds, locks, custom copies, imports, bounds, reviews, export
  reconstruction and source-addressed caching.
- Current legacy Studio dev browser lane passed drawing, historical recovery,
  wardrobe, cancellation/retry, export pixel equality and mobile controls.
- The final character dev run passed selectors, locks/rerolls, painting with
  undo/redo, creator JSON failure/recovery and Keep/Reject/history controls.
  It stopped at `legacy source recovery key exceeded 7000 ms`.
- An earlier character run compared 324 frames per backend on CPU/WebGL2/WebGPU
  with zero pixel differences and passed browser/CLI export equality. That run
  predates final feedback/recovery changes and ended with a hydration warning;
  it does not qualify the final browser milestone.

## Next bounded work

1. Diagnose the character harness's Sprite-workspace source persistence timeout.
   Wait for hydration/recovery before opening or filling source; the title exists
   in server HTML and is insufficient readiness evidence. Compare its storage
   key and behavior with the passing legacy harness before changing product code.
   Preserve malformed source, last-valid preview and both independent drafts.
2. Finish same-workspace pending character source recovery, imports, mobile,
   cancellation/retry, rapid randomization and unavailable-GPU checks on the
   final source. Run the full character harness on both dev and built output.
   Do not convert failed assertions into successful receipts.
3. Apply the pixel-art peer's read-only findings (native body coordinates): west-1
   contacts span roughly x3-11 but west-2 collapses to x5-9. Balance both contacts
   around a shared hip axis and alternate near/far ownership; check east too.
   Classic west-0 pupil (5,6) touches cheek (4,6): inset to (6,6), restore skin
   at (5,6), mirror east. Chibi west pupil (4,6) is on the contour. Slim south
   pupils (6,5)/(8,5) touch the brim: retain skin spacing above and below eyes.
   Keep the accepted traveler untouched. Review native drawings and complete
   walk cycles before owner acceptance; the peer inspected stills, not playback.
4. Re-run only checks affected by fixes, then finish the full milestone gates.
   Preserve all accepted-plan criteria, especially exact GPU/export pixels,
   layered imports, undo/recovery, bounds and template round trips.

## Evidence and ownership

Evidence root:
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/character-creator-20261017/`.
Use `summary.json`, `logs/final-*`, `artifacts/final-study/`, and the failed
`artifacts/browser/dev-character-receipt.json`. Historical receipts remain
historical. The native/integer study is original-only. Local runtime disposition
and publication identity are recorded in the final summary receipt.

Implementation routes: `art_characters`, `art_studio`, `art_renderers`,
`art_atlases` in Summary Bank. Use the [guide](../../look-dev/character-creator.md)
for formats, controls and commands. Do not redesign the creator or broaden into
engine receiving, PBR, deployment or full donor parity in this continuation.

AI-created: 2026-10-17 | agent=Codex/root | task=character-creator-closeout
