# CSS sprites from an atlas kit

Studio can include a stylesheet with the existing atlas kit. Open **Export
options** in the inspector, check **Include CSS sprites**, then use **Export
atlas kit**. The choice starts off and affects export only; it does not change
the recipe, preview pixels or saved draft. Existing exports stay CSS-free.

CLI equivalent:

```powershell
npm run bake:art -- --recipe <recipe.json> --out <explicit-output> --css
```

The optional `atlas.css` references the kit's `atlas-N.png` pages in the same
directory. `atlas.json.stylesheet` records `grout-art-css/1`, the class prefix,
source dimensions, frame selectors/trim/anchors and clip order/fps/duration.
The ordinary file list includes the CSS byte length and SHA-256. Source edits
produce new cache identities; CSS and default kits have separate identities.
The existing readable recipe, optimized sidecar, PNGs and provenance remain.

## Use in a page

```html
<link rel="stylesheet" href="my-kit/atlas.css">
<span class="grout-art-frame-south-0" role="img" aria-label="Traveler"></span>
<span class="grout-art-clip-walk-south" role="img" aria-label="Traveler walking south"></span>
```

Use the actual selectors in the stylesheet metadata for other recipes. Each
element is an untrimmed source-sized box. Its pseudo-element positions the
packed rectangle at the original trim offset, including transparent margins.
Frames on different pages use their own PNG and page dimensions. Alpha remains
cutout and sampling nearest. Clip classes play infinitely with discrete frame
steps at the recipe's fps, including repeated frame holds. Applying a frame
class alone displays a still image. Host CSS may pause animations or adjust
layout; retain the generated pixel geometry for native rendering.

Boxes use the source frame's top-left corner. Pixel anchors remain unchanged in
metadata; they are not CSS layout offsets or engine pivots. Display at native
size or an integer enlargement when crisp pixels matter. This qualification
does not establish a receiving engine adapter or approve artwork.

## Reusable SDK

```js
import { buildArtExport, buildArtCss } from "grout-art";
const kit = buildArtExport(recipe);
const { css, metadata } = buildArtCss(kit, { classPrefix: "hero", signal });
```

Write `css` beside the atlas PNGs and keep `metadata` with the kit. A separate
prefix allows multiple kits in one page. Prefixes contain 1–64 ASCII letters,
digits, underscores or hyphens and start with a letter or underscore. Invalid
geometry/prefixes, aborted work and output above 2 MiB fail explicitly. Existing
PNG-only export remains available for recipes whose CSS exceeds that budget.

The API and CLI use `includeCss: true` in their programmatic options; browser
`exportArtFiles` / `exportArtZip` accept that same boolean. Omitting it keeps
the existing asset set. Exports retain source identity, original/imported
attribution and unapproved-art status. No donor implementation or pixels are
copied by this feature.

The [work record](../work/done/SPRITE-CSS-20261023.md) binds current local gates,
actual browser CSS pixels, cancellation/retry and desktop/narrow captures.
Compact original-only evidence is retained while referenced under
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/css-sprites-20261023/`.
GIF export, SVG, fonts/UI atlases, broader donor parity and engine receiving
retain their existing future scope.

AI-created: 2026-10-23 | agent=Codex/root | task=css-sprites | change=documented opt-in atlas CSS, native frame/clip playback and local fidelity boundary
