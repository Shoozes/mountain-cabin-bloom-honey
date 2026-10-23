# Animated GIFs from an atlas kit

Open **Export options** in Studio, check **Include animated GIFs**, then use
**Export atlas kit**. The option starts off and resets when the workspace is
reloaded. It affects export only; the editable recipe and saved draft stay
unchanged. It can be combined with **Include CSS sprites**.

CLI equivalent:

```powershell
npm run bake:art -- --recipe <recipe.json> --out <explicit-output> --gif
# Include both optional formats:
npm run bake:art -- --recipe <recipe.json> --out <explicit-output> --gif --css
```

Each recipe clip produces `clip-<clip-name>.gif`, using its native, untrimmed
dimensions, frame order and repeated holds. GIFs loop indefinitely. They include
the same cutout pixels and baked outline as PNG export. The existing PNGs,
readable/optimized recipes, source attribution and unapproved-art status remain.
Default kits contain no GIF files or animation metadata.

`atlas.json.animations` records `grout-art-gif/1`, exact per-frame palettes,
infinite looping and cumulative centisecond timing. Its clips include the file
path, source fps, dimensions, ordered frame names, individual `delaysCs`, total
`durationCs` and transparency. The ordinary file list includes each GIF's bytes
and SHA-256. GIF/CSS combinations have separate validated cache identities, and
source identity includes the GIF producer. Anchors remain authoritative in the
recipe/atlas metadata; GIF is a visual animation file without engine pivots.

## Timing and exact-color limits

GIF stores delay in hundredths of a second, as specified by
[GIF89a](https://www.w3.org/Graphics/GIF/spec-gif89a.txt). Export rounds each
cumulative frame boundary, then differences consecutive boundaries. For example,
8 fps alternates 130/120 ms; 60 fps uses 20/10/20 ms. Each encoded boundary is
within 5 ms of the source schedule. The loop duration is rounded to the same
10 ms grid; this does not promise exact long-running phase alignment with a
separate source-fps clock.

Chrome ImageDecoder and Pillow independently verify pixels, loop count and
stored delays, including 1–60 fps boundary cases. This qualifies the file and
those decoders. Display playback scheduling in other viewers and physical
devices is outside that proof. Preserve the recipe and atlas clips when the
receiving application needs their original fps.

Each frame uses an exact local palette, with no color quantization. Fully opaque
clips permit 256 visible colors per frame. If any frame has transparency, every
frame reserves index zero and permits 255 visible colors. A recipe with 256
visible colors plus transparency can still export PNG, but GIF fails with a
visible explanation. Partial alpha, missing clips and invalid kit data also
fail explicitly. Export supports at most 16,777,216 aggregate decoded clip
pixels (including holds) and 32 MiB of GIF bytes. Existing recipes are not
rewritten to fit these limits; turn GIF off to retain the ordinary export.

## Reusable SDK

```js
import { buildArtExport, buildArtGifs } from "grout-art";
const kit = buildArtExport(recipe, { signal });
const { files, metadata } = await buildArtGifs(kit, { signal });
// files: [{ name: "clip-walk-south.gif", data: Uint8Array }, ...]
// Write beside the PNGs and retain metadata as atlas.json.animations.
```

Programmatic `bakeArt`, browser `exportArtFiles` and `exportArtZip` accept the
boolean `includeGif: true`. Omission preserves the default asset set. The async
producer checks cancellation during frame analysis, indexing and compression;
cancelled exports do not publish a partial download or reusable cache directory.

The [work record](../work/done/SPRITE-GIF-20261023.md) binds local checks and the
original-only decoder corpus under
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/gif-export-20261023/`.
`scripts/test-art-gif-browser.mjs` exercises actual desktop/narrow downloads on
dev, normal and Pages builds. `scripts/verify-art-gif-pillow.py --index <index>`
is an optional independent Pillow verification of those retained files; Python
and Pillow are not application or npm-test dependencies. SVG, fonts/UI atlases,
broader donor parity and engine receiving remain separate batches.

AI-created: 2026-10-23 | agent=Codex/root | task=gif-export | change=documented opt-in clips, exact palettes, cumulative timing, decoder proof and receiving limits
