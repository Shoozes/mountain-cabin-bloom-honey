# Native gravel polish

Complete with verified limitations. Baseline is
`4c15058c5e39ef4a0c9fdf6d411f3a7372b06061`. This is a verified local candidate;
artwork remains unapproved and this batch has not been published.

## Delivered

- [x] Study the supplied references for grouped masses, angular planes and quiet
  gaps; author original geometry using our existing palette roles.
- [x] Remove the fixed horizontal seam crossing at native 16px; review that
  checkpoint with the pixel-art agent before drawing the 64px treatment.
- [x] Redraw all three gravel compositions at both sizes, preserving shared
  two/four-pixel quiet bands and whole-feature weathering. Stagger a 64px stone
  group after the first path review exposed an aligned beat.
- [x] Preserve all twelve classic/growth output fixtures, 72 curated grass/soil
  compositions and all three original palettes. No extra compositions or recipes.
- [x] Expose weathered connected gravel at 16px in the existing disclosure.
  Keep 64px grass/dirt corner terrain and its gravel path model unchanged.
- [x] Verify normal/weathered connected terrain, all masks and path mouths,
  finite palettes, deterministic pixels and browser/CLI decoded equality.
- [x] Update TODO, guides, source-bound study and focused Summary Bank routing.

The first art checkpoint was `7f54c39b…`; final editable art is
`fc21f554ed799a1924425c58ad7a955ffaae7888b83b5c77c5ecac24dd3641c5`.
The artist reviewed native and integer repeats, connected normal/weathered terrain,
all three palettes and path details. Integration inspected the native studies and
desktop/mobile browser captures. The [reference and drawing guide](../../look-dev/retro-terrain-gravel.md)
records source attribution and the distinctions between the two terrain models.

## Verification

`npm test` passes 321 tests (296 scripts and 25 shader/material). Typecheck, lint,
normal build and Pages build pass. The focused artist suite passes 60 checks.
Both final dev and built browser runs pass eighteen size/palette/seed cases,
3,042 decoded PNG pairs each, with clean consoles. Native gravel's normal/weathered
preview matches CPU output for all nine palette/seed combinations. Desktop/mobile
DPR 1/2, preview ownership, old drafts, failure/retry, cancellation and captured
export revision are exercised. The [proof](../../look-dev/retro-terrain-gravel-proof.json)
binds commands, current sources, retained logs and actual browser receipts.

The 64px legal-neighbor test now compares Boolean corner presence instead of
unequal weighted bit values, covering all 64 legal pairs in each direction and
both weathering states. It required no generator-mask change.

A first dev attempt found the previously retained preview absent. A tool-owned
`npm run dev` session restored it with a new identity-bound runtime receipt. A
later dev export timed out after fifteen cases; its capture showed the drawer
closed without a console error. The export harness now uses stable hit-tested
clicks and bounded navigation/click diagnostics. The isolated failing case and
both complete final matrices pass. The initial trigger was not established;
failed evidence is retained rather than described as a proven product defect.

## Evidence and remaining work

The [current study](../../look-dev/studies/retro-terrain-gravel-20261012/study.json)
contains twenty original-only native PNGs (78,261 bytes), including individual and
mixed normal/weathered repeats, three-palette boards, native gravel/dirt blobs and
64px gravel paths. Rendered figures use seed 1204; verification covers 1204/1215/1233.
Earlier studies and the artist's intermediate critique remain historical.

The fixed seam landmarks are removed. Finite authored layouts and canonical path
pieces still recur, and whole-feature masking can leave narrow areas bare. Owner
visual acceptance remains the next criterion in [TODO](../../TODO.md); tests cannot
approve the art. Engine receiving, PBR channels, runtime anti-tiling and the
separate inherited preview-helper repair remain outside this batch.

Browser runs and temporary CLI case directories are released. The live authoring
preview is deliberately retained under `.runtime/gravel-polish-dev-20261012.json`,
with PID, creation time, executable, session and an identity-qualified stop route.
Referenced original studies, diagnostics and build outputs are retained. No owner
files were deleted and no Git publication was performed.

AI-created: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=curated-gravel-polish | change=recorded sequential native drawing review, verified local integration and remaining art acceptance
