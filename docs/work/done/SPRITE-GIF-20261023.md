# Grout Art GIF export

Status: Complete. Repo/run: mountain-cabin-bloom-honey / gif-export-20261023.
Base: existing main at `bb6b62fbfadcd5c15ba74ae82fcfb989ee3bfb26`.
Phase: completed local Dropin/Work, followed by the explicitly paired
Closeout/Publish phase below. Preserve the prior review's TODO/CSS-record edits
and unrelated untracked Riasmap note.

## Intake and boundary

No new architect packet or unprocessed inbox note is present. TODO and the
capability matrix correctly mark GIF import as delivered and GIF export as
future work. Implement that selected local format slice. No donor edits, SVG,
font/engine work, art changes, dependency changes or publication.

Add an opt-in animated GIF for each recipe clip to the existing atlas kit, with
the same frame order, holds, native dimensions and cutout pixels. Existing
recipes/default assets and optional CSS remain unchanged. Export source/cache
identities must include the new producer and GIF option. Use exact per-frame
palettes, explicit format/budget errors, cooperative cancellation and bounded
output; do not quantize colors or silently fall back. GIF's centisecond timing
requires cumulative rounding, recorded in metadata with source fps and delays.
Decode actual GIF output independently before claiming timing/alpha fidelity.

Owned surfaces: standalone SDK GIF encoder/tests, public index/types/consumer,
browser/CLI export and all source inventories, the existing Export options
checkbox, browser/decoder proof, GIF guide, TODO, capability matrix and bounded
Summary Bank routing. Worker owns only GIF producer/focused tests; main owns
integration, independent decoders, final checks and documentation.

## Done when

- Default browser/CLI exports stay GIF-free; explicit Include animated GIFs and
  CLI `--gif` add safe per-clip GIF assets, format metadata and file digests.
  CSS and GIF choices compose, with distinct validated cache identities.
- Independent decoding matches untrimmed native RGBA for ordered clip frames
  and repeated holds, including opaque/transparent transitions, blank frames,
  outlines and palette boundary cases. Looping and encoded delays are verified.
- Cumulative GIF delay rounding stays within 5 ms of source clip boundaries;
  actual decoder/viewer timing limitations are measured and documented.
- Invalid options, excess colors/partial alpha, decoded/output budgets and
  active/pre-abort fail explicitly without corrupting drafts or prior exports.
- Pre-change recipe/frame/PNG/CSS hashes stay exact. Focused tests, SDK consumers,
  full tests/typecheck/lint, both builds and dev/built desktop/narrow export,
  recovery and cancellation/retry proof pass. Update TODO/docs/Summary Bank and
  release owned test services/scratch at completion.

Compact original-only proof:
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/gif-export-20261023/`.
Retain while referenced; existing proof/quarantine ownership stays intact.

AI-created: 2026-10-23 | agent=Codex/root | task=gif-export | change=bound selected optional GIF output, exact pixels, timing limits and local qualification

## Delivered and verified

`buildArtGifs` writes one GIF89a per recipe clip, with native full frames, exact
local palettes, infinite looping and disposal that clears transparent frames.
Metadata retains source fps/order, rounded per-frame delays and loop duration.
Palette/alpha validation, 16,777,216 aggregate clip pixels, a 32 MiB encoded-byte
ceiling and cooperative aborts bound the optional producer. No quantization or
recipe migration occurs. Public ESM declarations and copied SDK consumers pass.

Studio's default-off Include animated GIFs checkbox lives in Export options.
The CLI accepts `--gif`; programmatic/browser options use `includeGif`. CSS/GIF
combinations have separate source-bound cache identities. GIF files and their
SHA-256/byte counts appear in the existing manifest; original exports remain.

Observed commands, all exit 0 at their final source identity:

- `node --test scripts/art-gif.test.mjs`: 5 focused producer tests, including a
  real imported recipe that reaches the 32 MiB ceiling while below decoded
  pixel/recipe limits. Its synthetic timing acceleration preserves async
  checkpoints; active cancellation is tested separately with real timers.
- `node --test scripts/art-gif-export.test.mjs`: 3 tests for all four option/cache
  variants, CLI parity, tamper rejection, invalid/no-clips/CLI syntax, pre-abort
  and active pending-directory cleanup.
- Final `npm test`: 281 pass (252 script, 29 source), including accepted
  art/legacy material fixtures. The first full run passed 280; the second includes
  the subsequently added output-budget regression.
- `npm run typecheck`, `npm run lint`, `npm run build:art-sdk`, `npm run build`
  and `npm run build:pages`: pass. Both builds prerender four routes; the copied
  SDK headless and strict declaration consumers pass. Targeted ESLint also
  passes the final output-budget test added after the first gates began.
- `node scripts/test-art-gif-browser.mjs --dev --proof-out <run>/browser`,
  `--mode root` after the normal build and `--mode pages` after the Pages build:
  each passes four grouped checks, 28 actual GIFs and 86 independent Chrome
  decoded frame comparisons. Total: 84 GIFs/258 frame comparisons, zero differing
  bytes and no unexpected browser errors. Every lane exercises default-off and
  combined CSS/GIF downloads, manifest/CLI/PNG parity, injected source failure,
  cancel/retry, real narrow export, keyboard/reduced-motion/forced-colors access,
  unchanged draft recovery and a visible palette error with PNG fallback.
- `python scripts/verify-art-gif-pillow.py --index <run>/browser/<lane>-index.json`
  for dev, root and pages: Pillow 12.3 independently verifies those same 84 GIFs
  and 258 frames, exact RGBA, frame counts, infinite looping and stored delays.
  The explicit Python runtime is recorded in `verification.json`; it is an
  optional proof tool, not a project dependency.
- `node scripts/test-art-css-browser.mjs --mode root --proof-out <run>/css-neighbor`:
  existing CSS flows plus 64 native frame/tick/loop screenshot comparisons pass.
- A pre-change hash comparison against `bb6b62f` preserves three complete
  normalized recipes, 25 native frames, six PNG payloads and three stylesheets.

The browser corpus covers outlines, opaque/transparent clearing, entirely blank
frames, repeated holds, 1/3/7/8/25/50/60 fps and high-entropy 255/256-color local
palettes. Chrome ImageDecoder reports encoded 20/10/20 ms at 60 fps without
clamping. Each encoded boundary is within 5 ms of the source schedule. GIF's
10 ms timing grid rounds loop duration, so exact long-running source-clock phase
and playback scheduling in other viewers/physical devices are not claimed.

`<run>` is the compact root above. `verification.json` binds commands, runtime,
source hashes, compatibility and decoder receipts. Dev/built desktop/narrow
captures were inspected. The new `art_gif` Summary Bank group routes actual
producer, integration, tests, decoder workflow and guide within the existing
128 KiB budget. The capability matrix and TODO retain SVG/consumer work.

Independent decoding initially found an LZW width-growth error; it was repaired
before qualification. Structural fixtures alone are not GIF decoder proof. The
first probe and corrected small probe remain retained. Browser diagnostic
fixtures were corrected to supply the required anchor and respect the existing
4,096-run import budget; product limits were not weakened. The final retained
receipts bind the corrected harness and encoder.

All test-owned browsers/servers closed in `finally`; owned scratch packages and
downloads were removed. `resources.json` records released endpoints and absent
task processes. Current Pages build/SDK output remains with its existing ignored
owner, and compact evidence remains retained while referenced. Prior review
edits, the unrelated untracked Riasmap note and existing quarantine are preserved.
This completed item leaves the active queue. The implementation phase made no
commit, push, donor change, dependency change, art approval or receiving-engine
qualification. The subsequent publication phase is recorded below.

AI-edited: 2026-10-23 | agent=Codex/root | task=gif-export | change=recorded completed local GIF export, exact independent decoder/compatibility proof, diagnostics and remaining viewer/receiving boundaries

## Paired closeout and publication

The owner's explicit 2026-10-23 Closeout/Publish request authorizes this verified
GIF batch on existing main at `Shoozes/mountain-cabin-bloom-honey`. At intake,
local main, origin/main and exact remote main all resolve to
`bb6b62fbfadcd5c15ba74ae82fcfb989ee3bfb26`. The index is empty and no outgoing
commit predates this batch. The unrelated untracked Riasmap note remains
preserved and excluded, without opening or hashing its contents.

All 39 inputs in the existing verification receipt match before the closeout
documentation update. Reuse the source-matching 281 tests, SDK/type/lint checks,
both builds, compatibility hashes, dev/root/Pages GIF flows and independent
Chrome/Pillow corpus checks. Eight focused GIF tests pass again at closeout.
An independent read-only check finds no missing/stale proof or actionable defect.
Only TODO and this work record change for this phase; the GIF context route is
validated at its final documentation size. Fresh resource checks confirm the
owned endpoints are released and no test services or scratch remain.

`publication-paths.json` in this run records the exact 19-path allowlist. It
includes GIF implementation/integration/tests/docs, the Summary Bank route, and
the linked prior CSS review record already referenced by TODO. Those review
notes were produced by the earlier authorized Review/Recheck/Cleanup request;
including them keeps the published documentation link complete. No unrelated
owner change is absorbed. Existing compact evidence, build/SDK output and
quarantine retain their owners.

Use `.tools/gitpush.ps1 -CommitOnly -Path <allowlist> -Message <message> -Yes`,
verify the candidate's exact changed paths and canonical Git blobs against
the reviewed files, then use the same helper's documented push-only route to
the configured repository. Git's required LF normalization is checked through
the repository attributes; the retained proof still binds the actual tested
working bytes. No helper, security policy, branch, remote configuration,
credential material, deployment or release changes are included.

`closeout.json` binds the final candidate inputs, reused/fresh proof and resource
dispositions. `publication.json` records actual helper commands/exit results,
the confirmed remote commit, verification command/result and final task-file
state. A local commit or attempted push alone is not publication success.
Artwork acceptance, other-viewer scheduling, SVG and receiving-engine work
remain under their existing boundaries; none blocks this verified format batch.

AI-edited: 2026-10-23 | agent=Codex/root | task=gif-closeout-publish | change=bound paired closeout and scoped guarded publication to current proof, exact paths and remote verification
