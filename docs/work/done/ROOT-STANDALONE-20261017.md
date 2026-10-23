# Standalone root cleanup

Status: Complete with verified limitations. Filesystem deletion remains blocked;
root organization and standalone behavior are verified. Initial delivery was local;
the later combined publication scope is recorded below.
Base: `b3ff9912bbf00c0413edb6259278dc12856f5149`.

The owner requested a simple Gknome-style root, explicitly removed the need for
Grok/Vercel and requested obsolete files/storage cleanup. Root app entrypoints,
Gknome contracts, runtime dependencies and all accepted artwork remain protected.

## Changes

- Vite/TanStack Start produce portable static output for root-hosted and Pages
  builds. Removed Nitro and unused adapter dependencies without upgrading any
  retained package version. Existing app routes and bake/SDK commands stay.
- Removed the runtime preview bridge, dynamic platform manifest, PWA/branding
  injector and sandbox auth/environment wrappers. npm runs Vite directly.
- Retired sandbox-only QA/unsafe Linux preview helpers and their tests together
  with their platform behavior. Existing product/browser/foundation tests stay;
  replacement tests assert the actual standalone build/runtime contract.
- Grouped ESLint/Prettier config under `.tools/config/`; retained framework root
  configs, package/lock, README/AGENTS, Summary Bank, version and run entrypoints.
- Moved root screenshots to `docs/look-dev/screenshots/` byte-for-byte. Historical
  receipts may still name the former root location; resolve `screenshots/*` to
  this new folder. Dated historical proof content and original provenance are
  unchanged. The empty `source/README.md` compatibility pointer is retired by
  this explicit reviewed layout change; `src/` remains the real product source.

## Storage and guard limitation

npm pruned 54 installed packages; the lockfile removed 15 package entries and
changed no retained dependency versions. Recursive filesystem deletion of the
obsolete folders was rejected by automatic approval review with only “blocked
by policy”. No bypass or alternate deletion command was used. Reversible named
moves isolated old `.grok`, `.vercel`, `server`, `source`, public platform assets
and old scripts under ignored `.runtime/retired-platform-20261017/` on C:.
These quarantined bytes are retained, not counted as reclaimed space. Credential-
shaped logs/config are opaque; they were not opened, hashed or copied off C:.
User deletion intent is recorded, but the execution guard remains the blocker.

Current `.artifacts` junction, accepted/current proof, SDK, fixtures, source
recipes, `.tools` publication/security machinery and unrelated Riasmap note are
preserved. Existing source histories and screenshots remain recoverable.

## Qualification

- `node --test scripts/standalone.test.mjs scripts/pages-404.test.mjs`: seven pass.
- `npm test`: 251 pass (226 script tests plus 25 source tests). The preceding
  total was 420: 172 tests for removed platform behavior retire with that code,
  and three tests establish the standalone contract. Product tests stay intact.
- `npm run typecheck`, `npm run lint`, `npm run build` and `npm run build:pages`:
  pass. Both builds prerender all four routes and produce no Vercel output.
- `Test-ProjectBinding.ps1 -AsJson`: 57 assertions pass. Summary Bank Audit:
  43 groups, zero missing/over-budget groups; historical provenance unchanged.
- `test-standalone-browser.mjs`: dev, root build and Pages build pass. All routes,
  static assets, desktop/narrow layouts and candidate selection work without
  retired host requests or browser errors. Captures inspected.
- `test-art-browser.mjs --variations-only`: dev/built pass, including recovery,
  undo, cancellation/retry, exact browser/CLI exports, accepted default character
  optimization and 196 exact CPU/WebGL2/WebGPU frame comparisons.
- Fourteen protected sources/fixtures are unchanged. Thirty-four relocated
  capture files match Git bytes exactly; two JSON receipts retain identical
  content under repository CRLF/LF normalization. Existing dated proof is retained.
- `git diff --check`: passes. No commit/push, unrelated-file edits or new source
  art changes. Owned previews stop after identity checks and port release.

Root entries reduced from 35 to 26, including hidden framework/runtime folders.
`storage.json` records actual npm pruning and the 25,035,903 bytes quarantined;
those roughly 24 MiB are **not** claimed as freed. Net drive-free readings are
machine observations and cannot be attributed entirely to this task.

Current asset/runtime checks, compact receipts and storage accounting are under
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/root-standalone-20261017/`.
Retired platform-specific tests are removed with the implementation; product
checks remain mandatory. No art acceptance, commit, push or deployment is implied.

AI-edited: 2026-10-17 | agent=Codex/root | task=root-standalone-cleanup | change=recorded standalone layout, retired platform scope and filesystem guard limitation

## Combined closeout and publication

On 2026-10-23 the owner explicitly authorized publishing this standalone batch
together with the WebGL lifecycle and dirt-clump batches. The
[current work record](MATERIAL-DIRT-20261023.md#combined-closeout-and-publication)
owns the combined scope, current proof and authoritative publication receipt.
Retained quarantine bytes are preserved; publishing their tracked retirement
does not claim filesystem reclamation or art approval. The unrelated Riasmap
note remains excluded.

AI-edited: 2026-10-23 | agent=Codex/root | task=combined-closeout-publish | change=linked explicit combined publication and preserved quarantine/acceptance boundaries
