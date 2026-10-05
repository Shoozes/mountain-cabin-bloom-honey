# Grout donor inventory — pixel art for the tile mill

Owner: Tessera (Technical). Partner: Swatch (Look-dev / Visual Director) owns PALETTES and Show decisions.
Repo tip at review: `main` @ `b11435574d608b5633a2b05db5798a3bf49a3636` (Cut C, stronger seam harness). Console palettes (`pico8`, `gameboy`, `nes`) are already on `main` via Swatch #4. This lane does not edit `PALETTES`.
Donors were read without submodules and without an npm dependency on `grout-render`.

## How the donors were read

| Donor | Access | What this pass actually saw |
| --- | --- | --- |
| `Shoozes/Grout-Library` | `gh api repos/Shoozes/Grout-Library` → **404** (not visible to this integration). jsDelivr and raw GitHub for `src/palettes.js` → **404**. | Public package `grout-render@0.2.0` (homepage `https://github.com/Shoozes/Grout-Library`). Tarball has `dist/` plus a few assets. It does **not** ship `src/palettes.js` or `docs/TEXTURE_32X32_COOKBOOK.md`. |
| `Shoozes/grout13` | `gh api` tree + README + `src/grout13.mjs` (public). | Atlas compiler, decoder, generated runtime, optional font atlas. No mill fragment looks. |

`grout-render` dist comments say the first 16 entries of `DEFAULT_PALETTE_RGB24` match `DEFAULT_PALETTE` in `palettes.js`. Those 16 values are listed below as a citation only. **Swatch owns PALETTES. This lane does not add palette rows, including console palettes.**

## Rank

- **must-fit** — small change inside the mill’s 4-color recipe and existing looks. Safe for export.
- **maybe** — useful later, after Swatch Show-check or a dedicated import/export cut.
- **skip** — wrong shape for the mill shader, or explicitly out of scope.

## Must-fit

| Idea | Where it lives | Mill fit | This draft |
| --- | --- | --- | --- |
| Nearest-palette snap | `quantizeImageDataToSpriteStep` and `findClosestPaletteIndex` in `grout-render` `dist/grout.mjs`. Squared Euclidean distance in RGB, index written back. | Pixel look (`uLook < 0.5`) used luma bands (`pick4`). That collapses different hues. Snap the shaded color to the closest of `uC0`–`uC3` and the export stays a 4-color recipe. | **Ported** in `src/shader/glsl.ts` `nearest4` inside `finish()`. |
| Ordered dither before the index | `ditheredGradient` in `dist/texture-utils.mjs`: 2×2 ordered threshold, then a hard color choice. Not a post-pass blur. | A short Bayer bias before `nearest4` breaks flat bands without leaving the four recipe colors. Continuous grain after quantization was pulling pixels off-palette. | **Ported** as a 4×4 Bayer (finer than the donor 2×2 on a 32 grid) scaled by wear. Pixel look no longer adds post-quant grain. |
| Pixel grid matches sampling resolution | Mill `MAIN` already forced a 32 grid when pixel look had no size. `RES()` still fell through to 96, so mortar AA and `RES()`-based styles did not sit on that grid. | One `pixelGrid()` helper used by `RES()` and `MAIN`. | **Ported.** Painted / real / poster and explicit pixel sizes are unchanged. |

## Maybe

| Idea | Where it lives | Why it waits |
| --- | --- | --- |
| `src/palettes.js` / named retro sets | Cited by the bundle, file not in the public tarball, repo 404. First 16 RGB24 values in the bundle (the `palettes.js` head): `#000000 #FFFFFF #888888 #444444 #CCCCCC #FFA500 #FF0000 #00FF00 #0000FF #FFFF00 #FF00FF #00FFFF #8B4513 #FFC0CB #800080 #008000`. The other 240 entries are spectra (gray, earth, pastel, neon, web-safe, metal). | **Swatch owns PALETTES.** Do not import these, and do not add pico-8 / Game Boy / NES rows, in this lane. |
| Image → palette | `getPalette`, `medianCutPalette`, `kMeansClustering`, `extractPaletteWithNames`. | A future import tool. The live mill already has a 4-color recipe. Median-cut would change the recipe format. |
| Palette generators | `generateComplementaryPalette`, `generateAnalogousPalette`, `generateTriadicPalette`, `shiftPaletteHue`. | Look-dev / Swatch. Not a shader fix. |
| 32×32 cookbook presets | README links `docs/TEXTURE_32X32_COOKBOOK.md` (not in the tarball). The code behind it is `createRetroPreset` in `texture-utils.mjs`: brick, stone, metal, wood, grass, checkerboard, water, lava, sand. Stone is layered noise plus a few dark crack lines. | Do not add catalog rows. The same layered-noise and sparse-crack habit is a **needs-ref polish** on existing `dirt`, `concrete`, `rust`, and `ice` only. Further cookbook notes wait until the private repo (or the markdown) is readable and Swatch Show-checks them. |
| Shader hooks | `drawIndexBufferToCanvas` throws if `customShader` is set; it points at `WebGLRenderer` / `WebGPURenderer`. | Not a drop-in for the mill’s one fragment. Later, if a look needs a second pass. |
| grout13 indexed atlas | `compileGrout13Atlas`, `decodeGrout13Atlas`, runtime source, font glyphs, 256-color cap, `DEFAULT_PALETTE_RGB24` copied into the runtime bundle. | **Later fetch/export**, not the first shader merge. A mill PNG/GLSL export could someday emit an indexed atlas. Do not vendor the runtime. |

## Skip

| Idea | Why |
| --- | --- |
| Vendor `grout13` or depend on `grout-render` | Explicitly out of scope. The mill keeps its own GLSL. |
| 256-color runtime palette as the recipe | Breaks the 4-color export (`uC0`–`uC3`). |
| Console palettes (pico-8, Game Boy, NES, and similar) | Already on `main` via Swatch #4. Left untouched. |
| Atlas compiler, font atlas, sprite packing, variation engine, SVG convert, protocol/versioning | grout13 / library runtime. No mill-shader fit. |
| Catalog deletes, new catalog rows, SEAM / MATCH threshold edits, PBR | Out of scope. `SEAM_MAX` stays 0.16. Seam scoring lives in `src/shader/seam.ts` after Cut C; this diff does not touch it. |
| Research-only grout13 encoders | README says they are excluded from the public facade. |

## What this draft ports

1. Pixel look quantize: Euclidean nearest of the four recipe colors, 4×4 ordered dither before the snap, wear drives dither amount, no off-palette grain. `MAIN` and `RES()` share `pixelGrid()`.
2. Cookbook-style polish of existing bodies only: `dirt` (clod + grit + pit + pale stone), `concrete` (aggregate specks + skipped crack), `rust` (flake band + pits), `ice` (facet + darker hairline). Ids, names, palettes, and categories stay.

## What waits for Swatch Show-check / later cuts

- Any further palette catalog change. Console sets are already on `main` (Swatch #4). The `palettes.js` head stays unimported.
- Image quantize / median-cut as an import path.
- Reading `TEXTURE_32X32_COOKBOOK.md` itself once `Grout-Library` is visible, then deciding which other needs-ref styles get the same layered-noise pass.
- grout13 atlas export.

---
Work: 2026-10-05T09:40:00-04:00 | agent=Tessera | role=Technical | where=Shoozes/mountain-cabin-bloom-honey | what=grout donor inventory and pixel-look quantize slice
