# Curated terrain review, recheck and cleanup

Baseline: `cc95c0790d48d2b7846889636f313e7a10968d20`, initially clean.
Review and recheck were read-only; the subsequent scoped cleanup repaired four
confirmed defects. The operator subsequently authorized Closeout + Publish for
this same scoped batch. Publication preserves verified progress; artwork remains
unapproved.

## Coverage and findings

Summary Bank routed actual terrain generators, editable drawings, autotiles,
browser exports, CLI bakers, authoring panels and their tests. Inspection expanded
to preview ownership, WebGL compilation, app routes/gallery, environment wrappers,
Vite build contracts and current docs. Independent export review found no confirmed
recipe, cache, manifest or atlas-coordinate defect. Foundation internals, third-party
packages and external engine receiving were not independently re-audited.

| Finding | Recheck and disposition |
| --- | --- |
| Earlier thin island, noisy 64px contours and clipped terrain-boundary features | Closed at the published source; retained in the current study. |
| Boundary soil forced to composition zero when foreground selected zero | Fixed: choose the soil independently for every boundary. |
| Paths cut grass features into partial remnants | Fixed: keep or omit complete visible clusters after path occlusion. |
| Side preview stretches a 96px sheet to 256px and shrinks a 448px scene to 256px | Fixed: integer device-pixel scaling with contained horizontal scrolling. |
| Invalid fragment compilation leaks one program and the successful vertex shader | Fixed: exception-safe program/shader release, with valid drawing preserved. |
| Shared gravel marks expose repetition, especially at 16px | Open art finding; next bounded pass below. |

The pixel-art agent owns the two compositor changes and their four new regressions.
Integration owns preview sizing, the actual browser regression and documentation.
Editable art, composition counts, palettes and both older kit generators are unchanged.
No owner files were deleted; historical studies and release proof are retained.

## Proof and limits

The [cleanup receipt](../../look-dev/retro-terrain-cleanup-proof.json) records source
hashes, commands and observed results. `npm test` passes 317 tests (292 script,
25 shader/material); typecheck, lint, normal build and Pages build pass.
The focused artist suite passes 56 tests, including twelve exact classic/growth
fixture comparisons. Dev and built browser checks cover both resolutions, three
palettes and seeds 1204/1215/1233, plus draft recovery, preview ownership, failure/retry,
captured export revision and cancellation. Preview checks cover desktop/mobile DPR
1 and 2, source sheets and large normal/weathered connected scenes.

The [current study](../../look-dev/studies/retro-terrain-curated-20261011-cleanup/study.json)
contains ten original-only PNGs, 35,862 bytes, at source identity
`cae2e9e008fd05da5966a81caf05a20121ea5dc071aabaf5c822a7216a50fdb7`.
Native connected/repeat images and browser desktop/mobile captures were inspected;
the pixel-art review also inspected exact integer enlargements. Earlier proof stays
historical at its recorded source identity and does not verify this new worktree.

An inherited Linux-only `scripts/preview.mjs` helper still selects every listener
on its fixed port as an owner. A harmless direct call confirmed an unrelated PID
would be selected; no signals were sent and the helper was not used. Browser proof
uses an ephemeral server it owns and closes. Qualifying that legacy helper's process
identity is a separate runtime-maintenance batch, not part of the terrain repair.
The existing owner-retained dev preview remains retained.

## Next bounded pass

Owner: pixel-art craft, in this repository. Desired result: quieter curated gravel
repeats without recognizable fixed seam landmarks. Start at native 16px, review the
base with the linked pixel-art agent, then extend the accepted drawing treatment
to 64px. Likely source is `src/shader/retro-terrain-art.mjs`; the worker should select
the concrete changes from current drawings rather than introduce a sampling effect.

Preserve the three compositions, original palette roles, shared two/four-pixel
boundaries, normal/weathered compatibility, mask and path contracts, public recipes,
and exact classic/growth pixels. Engine integration, PBR, shader anti-tiling and
publication are excluded. No purchased pixels or extracted palettes.

Done when native/integer views, individual/mixed 4×4 repeats and connected terrain
no longer emphasize fixed gravel seam marks; palette, boundary, deterministic export
and preservation checks pass. Keep candidates unapproved until explicit owner review.
Current priorities are maintained in [TODO](../../TODO.md).

AI-created: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=review-recheck-cleanup | change=recorded review coverage, scoped repairs and dependency-ordered gravel handoff

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=curated-terrain-cleanup-publication | change=recorded explicit scoped publication authorization while retaining art acceptance and gravel follow-up
