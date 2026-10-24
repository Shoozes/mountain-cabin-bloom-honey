# SVG frame export

Under Studio's **Export options**, enable **Include SVG frames** to add one
standalone SVG per source frame to the existing atlas kit. The option defaults
off, resets on reload and composes with CSS and GIF exports. It does not edit
the recipe, drawing, palette, clips or PNG assets.

```powershell
npm run bake:art -- --recipe <recipe.json> --out <output> --svg
# Optional sidecars compose:
npm run bake:art -- --recipe <recipe.json> --out <output> --svg --css --gif
```

Headless consumers call `await buildArtSvgs(buildArtExport(recipe), {signal})`.
Browser/programmatic kit options use `includeSvg: true`. The result contains
`files` (safe `frame-<name>.svg` names and UTF-8 bytes) and `metadata`.
`atlas.json.vectors` stores `grout-art-svg/1`, the `pixel-run-paths`
representation and source-ordered frame names, paths, dimensions and pixel
anchors. Each SVG has the full source width/height and `viewBox`, including
transparent margins and completely blank frames. Anchors retain their source
coordinates in metadata; they do not shift the SVG image origin.

The producer groups adjacent opaque pixels of the same color into horizontal
run paths, grouped by exact RGB. Uncovered pixels stay transparent. It emits
only fixed SVG markup, numeric integer geometry and hexadecimal fills, with no
embedded raster, scripts, external URLs, text, fonts or styles. Outlines are the
same baked source-frame pixels as the PNG export. Clip order, holds and fps
remain in `atlas.json`; these SVGs are static frames.

The format follows [SVG path data](https://www.w3.org/TR/SVG2/paths.html#PathData)
and [viewBox coordinates](https://www.w3.org/TR/SVG2/coords.html#ViewBoxAttribute).
Its [`crispEdges` rendering hint](https://www.w3.org/TR/SVG2/painting.html#ShapeRendering)
does not replace actual pixel comparison. Fidelity is checked at native and
integer scales; fractional zoom and other receiving applications need their
own qualification. This is pixel geometry export, not traced/smoothed artwork
or SVG import. Existing donor conversion and engine owners are unchanged.

The producer accepts the existing cutout profile (alpha 0/255), validates frame
names/order/dimensions/data, and rejects partial alpha explicitly. Total SVG
file bytes are bounded to 32 MiB, in addition to the recipe's existing decoded
pixel limits. Cooperative checkpoints permit active cancellation. Invalid
options, source failures and cancelled bakes preserve drafts and prior caches;
retry or export without the optional sidecar. New producer/source and option
identities are included in browser/CLI manifests and measured SDK runtime cost.

## Verification status

Completed local qualification is recorded in the
[work record](../work/done/SPRITE-SVG-20261023.md). All 302 tests, copied SDK
consumers, typecheck/lint and root/Pages builds pass. The actual dev/root/Pages
browser lanes complete default-off, SVG-only, combined CSS/GIF/SVG and narrow
downloads, source failure/cancel/retry and recovery checks. Together they verify
267 SVG frames with 534 native/3x raster comparisons and no differing bytes or
unexpected browser errors. Desktop and narrow captures were inspected.

The default browser producer uses actual downloads and fails if they do not
finish. `--diagnostic-blobs` inspects the exact UI-generated ZIP and SVG rendering
while cancelling native downloads. That explicit diagnostic reports
`qualification: false` and cannot replace completed-download proof. Existing
artwork remains unapproved.

```powershell
node scripts/test-art-svg-browser.mjs --dev --proof-out <proof>
node scripts/test-art-svg-browser.mjs --mode root --proof-out <proof>
node scripts/test-art-svg-browser.mjs --mode pages --proof-out <proof>
# Diagnostic only, when native download finalization is unavailable:
node scripts/test-art-svg-browser.mjs --dev --diagnostic-blobs --proof-out <proof>
```

Build the matching root/Pages output before each built lane. Compact retained
proof lives in `D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/svg-export-20261023/`;
`closeout/browser/` holds the completed-download receipts and captures. Earlier
download-finalization failures are retained separately; the current checks pass
with the same installed Chrome 155 and normal download/security settings.

AI-created: 2026-10-23 | agent=Codex/root | task=svg-export | change=documented optional source-sized SVG geometry, preserved export contracts and explicit browser qualification boundary

AI-edited: 2026-10-23 | agent=Codex/root | task=svg-closeout-publish | change=recorded completed download qualification and exact raster results without weakening diagnostic-mode boundaries
