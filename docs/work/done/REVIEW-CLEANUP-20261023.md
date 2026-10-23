# Repository review, recheck and scoped cleanup

Status: Complete. Requested order: read-only review, read-only
recheck, then reversible repairs and TODO update. Initial delivery was local;
the later combined publication scope is recorded below.
Repo/run: mountain-cabin-bloom-honey / review-cleanup-20261023.
Base: `b3ff9912bbf00c0413edb6259278dc12856f5149` plus the existing unpublished
standalone-root changes, relocated captures and Riasmap note. Those owner changes
are preserved; HEAD alone does not identify this candidate.

## Coverage and selected batch

Summary Bank List and direct selected source reads covered project/runtime
contracts, Vite/static output and Pages routing, app routes, texture mill,
material/terrain preview and exports, sprite SDK variation/transport/optimization,
their UI consumers and relevant tests. The bounded independent worker reviewed
the sprite SDK and confirmed the WebGL lifecycle findings. Foundation controller
internals, dependency vulnerabilities and external engine receiving were not
independently re-audited. No saved context packs were generated.

| Finding | Recheck and disposition |
| --- | --- |
| P1: restored contexts retain an invalid quad buffer; a static preview also has no restoration redraw | New, repaired. Recreate/upload geometry, clear invalid caches, repaint the mill and restart thumbnails. |
| P2: disposal retains two buffers and context listeners; utility startup failure leaves display resources allocated | New, repaired. Idempotent target disposal and partial-construction rollback release owned resources. |
| Prior invalid-fragment program/shader leak | Verified closed in current source; exception-safe compilation remains intact. Prior browser regression is retained. |
| Prior unsafe legacy preview helper | Closed by the existing standalone retirement; no remaining active imports found. Quarantined files remain retained. |
| Sprite variation/optimization outcome at `b3ff991` | No confirmed defect in the bounded independent review; assigned implementation is unchanged. Full local tests exercise its current contracts. |
| Owner art acceptance, further donor capability qualification and engine receiving | Still open in their existing TODO scope; this technical cleanup supplies no visual approval. |

A read-only in-memory lifecycle probe confirmed the original stale-buffer bind
and zero buffer deletions before edits. Baseline typecheck and lint passed.
Cleanup owns `src/shader/engine.ts`, the mill restoration callback, four lifecycle
regressions and test-runner wiring, extensions to the existing standalone browser
harness, the affected Summary Bank route, this record and TODO. No art recipes,
palettes, export formats, dependency versions or owner files are replaced.

## Verification

- `node --experimental-strip-types --test src/shader/engine.test.ts`: four pass.
  Covers both restored contexts and thumbnail invalidation, repeated disposal,
  utility context/buffer/upload failure rollback and visible restoration errors.
  The first attempt exposed an unsupported TS parameter property; explicit field
  assignment fixed compatibility with the existing strip-only test runtime.
- `npm test`: 255 pass (226 script tests and 29 source tests).
- `npm run typecheck` and `npm run lint`: pass.
- `npm run build` and `npm run build:pages`: pass; all four routes prerender.
- `node scripts/test-standalone-browser.mjs --dev --proof-out <run>/browser`,
  then `--mode root` against the normal build and `--mode pages` against the
  Pages build: all pass, including real display/utility context loss
  and automatic identical static-preview pixels, all routes, desktop/narrow
  layouts and sprite candidate selection; no browser errors or retired requests.

- `pwsh -NoProfile -File .tools/context.ps1 -Mode Audit -AsJson`: all 43 groups
  pass with zero missing patterns or over-budget active groups. The changed
  `shader_preview` route includes its new test, runner and work record.
- `pwsh -NoProfile -File tests/foundation/Test-ProjectBinding.ps1 -AsJson`:
  57 assertions pass. `git diff --check`: pass. Final task diff inspected.

The root-built restored mill and narrow Studio captures were visually inspected;
pixel comparison is exact for the current static brick fixture, not every shader.
Browser test servers/browsers close through their harness. Final endpoint and
task-process release is recorded in `resources.json`; no service is retained.
Runtime: Node 26.5.0, npm 11.6.2, PowerShell 7.6.6 and installed
Chrome 155.0.8059.86. Commands, logs, source identities and browser captures are
retained under
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/review-cleanup-20261023/`.
Existing `.artifacts` placement and historical proof retain their prior ownership.

## Next bounded pass-down

The existing Priority 1 remains owner review of the source-bound original terrain
and traveler candidates. Acceptance requires explicit owner approval or concrete
native-scale feedback; tests cannot close it.

The next implementation candidate remains TODO's Priority 2 dirt-structure pass:
replace the regular row/ridge reading in the HD-2D dirt candidate, using the
existing grass/dirt study as evidence. The material generator/art-direction owner
must preserve family color roles, legacy recipes and deterministic wrapped output.
Done when seed 1204 has matched 128px/2×2 channel review, seeds 1204/1215/1233
preserve determinism/wrapped normals and legacy outputs, and local checks pass.
Keep artwork unapproved until reviewed. External engine work, donor migration,
quarantine deletion and publication remain separate; do not expand this batch.

AI-created: 2026-10-23 | agent=Codex/root | task=review-recheck-cleanup | change=recorded ordered review, lifecycle repairs, bounded proof and next pass-down

## Combined closeout and publication

The owner subsequently paired Closeout/Publish and explicitly included the
standalone cleanup, this lifecycle repair and the dirt-clump work. The
[current work record](MATERIAL-DIRT-20261023.md#combined-closeout-and-publication)
binds all three to the named allowlist and retained remote-verification receipt.
Source-current dev/Pages route and context-recovery checks were refreshed for
that combined closeout. Art acceptance and engine qualification remain separate.

AI-edited: 2026-10-23 | agent=Codex/root | task=combined-closeout-publish | change=recorded later publication authorization and shared closeout owner
