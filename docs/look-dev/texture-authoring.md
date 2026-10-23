# Grout Shader: tile / texture mill

The recipes, catalog and export details below were moved from the original root
README during standalone/Gknome setup. Dated verification/publication notes
retain their original source scope; current setup and guarded publication live
in the [root entrypoint](../../README.md) and [proof guide](../PROOF.md).

All existing catalog artwork is **unapproved for our games/GaimEngine**. `keep`
means catalog retention; seam/judge scores establish technical properties, not
visual approval. See [tool ownership and materials](../../docs/look-dev/texture-tools.md).

## Game-facing authoring: scene coherence first

The goal is coherence of **colors, lighting, textures and forms across the
scene**. When supplying a game, begin with its actual camera and existing
trees/props, terrain, characters, water and sky. Record the visual roles,
brightness/warmth relationships, detail density and world-space texture scale.
Choose the asset treatment from that context; native resolution alone does not
determine whether a pixel tile, procedural material or supplied texture fits.

Use the current accepted art direction. A same-camera mockup can help establish
shared palette, composition and lighting: Rias's current direction coordinates
warmer olive foliage, muted blue-green water and a softly lit sky. A mockup may
repaint ground, tree shapes, shadows or reflections beyond the available engine
inputs, so it is a concept target rather than a runtime preview. Record those
differences before translating it into assets and renderer settings.

Before expanding compositions, palettes or material families:

1. **Prototype the scene together.** Place one candidate material beside the
   actual tree/prop textures, water and sky in a small real game slice. Use the
   engine's supported material and lighting controls; keep editable authoring
   source separate from receiving assets. Do not increase painted shading to
   compensate for mismatched lighting.
2. **Measure the receiving scale.** Record source dimensions, source texels per
   world cell, baked texels per cell, repeat footprint, filtering and mipmaps.
   Rias's native64-over-two-cells prototype has 32 source texels per cell;
   native64 over one cell needs explicit filtered minification into its 32px
   cell bake. Label resampling honestly. More compositions do not remove a
   fixed motif cadence or shared seam landmark.
3. **Compare at the game camera.** Use matched baseline/candidate views over a
   gameplay-sized area, including tree-rich ground, paths, water/horizon and
   portrait. Ground should have readable quiet planes beneath the canopy;
   reject conspicuous stamps, repeated slash marks and detail that competes
   with trees or characters. Native and integer sheets remain drawing checks.
4. **Check color and light as one system.** Compare hue, value and contrast
   relationships across ground, foliage, water, sky and props under Golden
   Day, Dusk and Mist. Include water movement/reflections and camera movement.
   Separate a material defect from ambient, sun, sky or post-processing response;
   correct each through its owning input. Albedo should retain pigment rather
   than a fixed directional sun/shadow from the concept image.
5. **Expand after the small scene fits.** Then complete alternatives and native
   drawing/technical export checks. Keep concepts, structurally valid exports,
   real loaded assets and owner artwork acceptance distinct. A coherent mockup
   or passing PNG/geometry tests cannot approve the rendered result.

The [Rias comparison and feedback](riasmap-terrain-selection.md) supplies the
evidence: isolated native16 selection looked like repeated stamps in the game,
and the later purchased-pack preview still received an owner rejection for
repetition and pixel-art-styled presentation. The current remedy is a coherent
scene prototype; its runtime result is still being qualified. Purchased source
and its derivatives remain in the game's private intake, outside our original
recipes, fixtures and redistributable exports.

## Retro terrain color kit

For original 64×64 color tiles, open **Adjust → Retro terrain · 64 px**. The
separate kit supplies dirt, grass, gravel, sixteen grass/dirt transitions and a
4×4 atlas, with seed selection, repeat/connected previews and PNG/recipe ZIP
export. It uses original drawing code and finite palettes, with no purchased
pixels or masks as inputs. See [retro terrain authoring](../../docs/look-dev/retro-terrain.md).

**Paths and weathering** adds curated native drawings, sixteen gravel path
shapes, worn variants and original Heath/Riverbed palettes. Inspect connected
and multi-seed variation previews; the original tiles remain separately
selectable. See [growth and drawing craft](../../docs/look-dev/retro-terrain-growth.md).

```powershell
npm run bake:retro-terrain -- --seed 1204 --out .artifacts/retro-terrain
npm run bake:retro-terrain-growth -- --seed 1204 --palette heath --out .artifacts/retro-terrain-growth
```

Retro color tiles remain unapproved; existing four-channel recipes below are
unchanged. The authoring kit adds no Phaser dependency or public corpus entries.

## Multi-channel material authoring

The existing Adjust drawer includes **Material channels · HD-2D cliff**. Inspect
albedo, height, +Y tangent normals and grayscale roughness at 1×/2×/4× repetition;
tune seed, palette, strata, fractures, relief and roughness; save the maps and
recipe together. Material drafts survive reopening the mill. This separate
original recipe uses a shared numerical surface field, not the old catalog's
color-only finish filter. Both browser and CLI evaluate that same implementation.

```sh
npm run bake:material -- --recipe hd2d-cliff --seed 1204 --out .artifacts/materials
npm run bake:material -- --recipe hd2d-cliff-strata --seed 1204 --out .artifacts/materials
node --test src/shader/material.test.mjs
```

The CLI is dependency-free, writes a content-addressed completed directory,
three seeded variants, `channels.png` and `material.json` (`texture-material/1`).
Each map records dimensions, sampling, color space and SHA-256; the manifest
binds exact authoring source hashes and recipe values. Height is authoring data;
GaimEngine currently consumes albedo, normal and roughness. Palette changes do
not change height/normals/roughness. The old PNG/corpus formats remain available.
Cancellation releases owned pending output and retains completed bakes.
`hd2d-cliff-strata` is an additive recipe ID; the existing `hd2d-cliff` ID and
its raw channel output remain unchanged. The material regression test pins the
legacy channel hashes for seeds 1204, 1215 and 1233 while checking the new recipe
through both material and vertex-color bake commands.

### Style surface families

The same authoring tool also generates ten repeating surface families—grass,
dirt, moss, cliff, stone, cobble, bark, timber, plaster and roof—in four styles:
`hd2d`, `cel-ink`, `soft-cartoon` and `pbr` (40 combinations). Default output
sizes are 128, 256, 256 and 512 pixels respectively. The family defines the
repeating surface structure and its own pigment ramp; the style adjusts pigment
quantization and relief. The recipe palette (`earth`, `slate` or `ochre`) shifts
pigment only. Palette changes leave height, +Y tangent normals and grayscale
roughness unchanged. Albedo is unlit pigment; generated maps contain no baked
directional lighting. Height remains authoring data, while engine receiving
uses albedo, normal and roughness.

Choose a family, style, and optional valid size in a recipe JSON file; the CLI
accepts that file through `--recipe`:

```json
{
  "id": "style-surface",
  "family": "grass",
  "style": "hd2d",
  "seed": 1204,
  "size": 128,
  "palette": "earth",
  "strataScale": 4,
  "fracture": 0.28,
  "relief": 0.55,
  "roughness": 0.84
}
```

`--variant-set single` writes only the requested seed. The default `catalog`
preserves the existing three-seed behavior at offsets 0, 11 and 29. Both modes
write the same `texture-material/1` recipe, channel metadata and source hashes;
the single set is explicit in its manifest and cache identity. Recipe examples
and output details are in [the texture-tool guide](../../docs/look-dev/texture-tools.md).
The ten-by-four set is procedural candidate material, not approved art. Source
hash changes produce new cache identities even where a legacy recipe's encoded
channel bytes remain unchanged; old source-bound outputs are historical bakes,
not reusable current-source cache entries.

HD-2D dirt also offers an explicit [irregular clump structure](dirt-clumps.md),
with matching height, wrapped normals and roughness. Original recipes and saved
drafts remain exact unless the new Dirt structure option is selected.

### Realistic material options

The catalog's **Photorealistic materials** entry opens six original continuous
recipes for soil, gravel, limestone, concrete, bark and timber. They start at
512px and provide smooth repeats, three color moods and a neutral lit preview
alongside unlit albedo, height, +Y normals and roughness. The existing recipes
and their pixels are preserved. See the [recipe and export guide](realistic-materials.md)
for preset controls, CLI examples and source-bound local verification. These
procedural candidates remain unapproved until owner visual acceptance.

To bake generated albedo onto an ordinary mesh offline, pass mesh JSON with
`positions`, triangle `indices`, and one authored `uvs` pair per vertex:

```sh
npm run bake:vertex-colors -- --mesh ./mesh.json --recipe hd2d-cliff --seed 1204 --out .artifacts/vertex-colors
npm run bake:vertex-colors -- --mesh ./mesh.json --recipe hd2d-cliff-strata --seed 1204 --out .artifacts/vertex-colors
```

The output directory contains a replacement `mesh.json` and a
`vertex-colors.json` manifest. The bake preserves topology and metadata,
replaces `colors` with one linear-sRGB RGB triplet per vertex, and records the
recipe, sampling settings, input hashes, and usage restrictions. See
[`docs/look-dev/texture-tools.md`](../../docs/look-dev/texture-tools.md) for limits,
sampling, and provenance details.

Windows builds use the environment wrapper's direct locked Vite entrypoint.
This lockfile requires `npm ci --legacy-peer-deps --ignore-scripts`; no version
upgrade is part of the material batch.

The 2026-10-11 review/cleanup passes the full `npm test` suite (233 script and 80
source tests), `npm run typecheck`, `npm run lint`, `npm run build` and
`npm run build:pages`. Dev and production browser proof covers all 40 family/style
selections, channel export, draft recovery, judge failure/cancellation/retry,
and export when local storage is full. See [our TODO](../../docs/TODO.md) for the closed
findings, exact proof and next bounded pass. The engine-owned snapshot boundary
remains recorded in the [tool guide](../../docs/look-dev/texture-tools.md).
Generated artwork remains unapproved.
The [grass/dirt visual study](../../docs/look-dev/grass-dirt-study.md) inspects native
and repeated matched channels and recommends dirt structure refinement first,
then grass tuft readability. It reuses verified original candidate packages.
The study's compact review fixture is retained in the repository, together with
a [source-bound closeout record](../../docs/look-dev/closeout-20261011.json); full logs
and browser captures remain local. Dirt and grass refinement are still open.
The environment-module JSDoc repair changed its source hash but preserved the
exact HDR bake payload bytes.
Git progress publication uses the local
`.tools/gitpush.ps1` and the qualified Grout-Library owner, with an explicit
staged-file allowlist. See [commands and proof](../../docs/look-dev/texture-tools.md).
The 2026-10-11 attempt stopped before commit/push because the secret guard found
an unchanged platform preview OAuth credential; [our TODO](../../docs/TODO.md#closeout-and-publication)
records the auth/broker owner action required to publish this staged snapshot.
The latest retro-kit Closeout/Publish preflight confirms that the same guard
still fails. Current local proof passes; no commit or push was created. See the
[publication closeout record](../../docs/look-dev/retro-terrain-publication-20261011.json).
The existing catalog and new cliff candidate remain visually unapproved;
purchased textures and their derivatives stay private and outside these fixtures.

Seamless tile textures written as GLSL shaders. Every style lives in [`src/shader/catalog.ts`](../../src/shader/catalog.ts). Its rendered pixels are scored by a TypeScript judge ([`src/shader/judge.ts`](../../src/shader/judge.ts)), and then it is baked to PNG. The baked corpus is committed under [`public/textures/`](../../public/textures/). Try the [live mill](https://shoozes.github.io/mountain-cabin-bloom-honey/) or browse the [PNG gallery](https://shoozes.github.io/mountain-cabin-bloom-honey/gallery/), both on GitHub Pages.

## Hero grid

Twelve baked PNGs (256×256, seed 1204, palette `style`). Pixel tiles are drawn at width 128. GitHub strips the `image-rendering: pixelated` style, so they may look soft here.

<table>
  <tr>
    <td align="center"><img src="public/textures/pixel/reviewed/brick.png" width="128" style="image-rendering: pixelated" alt="Running Bond, pixel"><br><sub>Running Bond · pixel</sub></td>
    <td align="center"><img src="public/textures/pixel/built/pantile.png" width="128" style="image-rendering: pixelated" alt="Pantile, pixel"><br><sub>Pantile · pixel</sub></td>
    <td align="center"><img src="public/textures/pixel/bond/chevron.png" width="128" style="image-rendering: pixelated" alt="Chevron, pixel"><br><sub>Chevron · pixel</sub></td>
    <td align="center"><img src="public/textures/pixel/bond/buttered.png" width="128" style="image-rendering: pixelated" alt="Buttered Grout, pixel"><br><sub>Buttered Grout · pixel</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="public/textures/pixel/bond/cobble.png" width="128" style="image-rendering: pixelated" alt="Cobble, pixel"><br><sub>Cobble · pixel</sub></td>
    <td align="center"><img src="public/textures/pixel/ground/moss.png" width="128" style="image-rendering: pixelated" alt="Moss Clumps, pixel"><br><sub>Moss Clumps · pixel</sub></td>
    <td align="center"><img src="public/textures/pixel/built/shingle.png" width="128" style="image-rendering: pixelated" alt="Shingles, pixel"><br><sub>Shingles · pixel</sub></td>
    <td align="center"><img src="public/textures/pixel/built/cinder.png" width="128" style="image-rendering: pixelated" alt="Cinder Block, pixel"><br><sub>Cinder Block · pixel</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="public/textures/pixel/nature/bark.png" width="128" style="image-rendering: pixelated" alt="Bark, pixel"><br><sub>Bark · pixel</sub></td>
    <td align="center"><img src="public/textures/painted/reviewed/brick.png" width="128" alt="Running Bond, painted"><br><sub>Running Bond · painted</sub></td>
    <td align="center"><img src="public/textures/real/bond/subway.png" width="128" alt="Subway Tile, real"><br><sub>Subway Tile · real</sub></td>
    <td align="center"><img src="public/textures/painted/bond/mosaic.png" width="128" alt="Tessera, painted"><br><sub>Tessera · painted</sub></td>
  </tr>
</table>

## Style tranches

The catalog has 75 styles. Verdicts come from [`docs/look-dev/catalog-keep-cut.md`](../../docs/look-dev/catalog-keep-cut.md):

| Category | keep | needs-ref | cut | total |
| --- | ---: | ---: | ---: | ---: |
| Reviewed | 7 | 2 | 0 | 9 |
| Bond | 10 | 0 | 0 | 10 |
| Ground | 11 | 0 | 0 | 11 |
| Built | 10 | 0 | 0 | 10 |
| Fiber | 5 | 10 | 0 | 15 |
| Metal | 4 | 5 | 0 | 9 |
| Nature | 2 | 9 | 0 | 11 |
| **Total** | **49** | **26** | **0** | **75** |

- **keep**: stays in the catalog and has a judge reference mapping.
- **needs-ref**: stays in the catalog but still needs a `JUDGE_REFS` entry. It is not published as a corpus PNG.
- **cut**: removed from the catalog. Ten Signal/FX and hazard styles were already removed, so none are pending.

Each style can render in four looks (`LOOKS` in `catalog.ts`). The look is applied in the shader's `finish()` pass in [`src/shader/glsl.ts`](../../src/shader/glsl.ts):

| Look | Label | What the shader does |
| --- | --- | --- |
| `pixel` | Pixel art | Chunk grid (default 32), 4×4 Bayer ordered dither, snapped to the palette's 4 colors |
| `painted` | Painted | Luma remapped through the palette with brush dab and bristle noise, warm tint |
| `real` | Hyper real | FBM shading plus micro detail and pore highlights |
| `poster` | Poster | Luma posterized to 3 bands through the palette |

Picking a non-pixel look in the mill resets the chunk grid to 0 (smooth), and the bake renders those looks smooth. You can still choose a grid size with Painted, Hyper real, or Poster in the mill. The non-pixel looks also add grain that scales with wear.

## Fetching textures

The corpus has a pixel PNG for each of the 49 keep styles. Four heroes (brick, stone, subway, mosaic) also have painted, real, and poster versions. That makes 61 files.

**Gallery.** Browse, filter, and preview tiles at https://shoozes.github.io/mountain-cabin-bloom-honey/gallery/. The live mill (shader view and in-browser export) is at https://shoozes.github.io/mountain-cabin-bloom-honey/

**Manifest.** [`public/textures/manifest.json`](../../public/textures/manifest.json), also served at https://shoozes.github.io/mountain-cabin-bloom-honey/textures/manifest.json

- `format`: `grout-corpus/1`
- `sourceTip`: the commit the bake was drawn from
- `files[]`: one entry per PNG with `id`, `name`, `category`, `look`, `pixels`, `exportSize`, `palette`, `seed`, `scale`, `wear`, `repeat`, `path`

`path` is relative to `public/`, so it is also the URL path under the Pages site.

**Raw PNGs.**

| Host | Pattern | Example |
| --- | --- | --- |
| GitHub Pages | `https://shoozes.github.io/mountain-cabin-bloom-honey/textures/<look>/<category>/<id>.png` | https://shoozes.github.io/mountain-cabin-bloom-honey/textures/pixel/built/pantile.png |
| raw GitHub | `https://raw.githubusercontent.com/Shoozes/mountain-cabin-bloom-honey/main/public/textures/<look>/<category>/<id>.png` | https://raw.githubusercontent.com/Shoozes/mountain-cabin-bloom-honey/main/public/textures/pixel/built/pantile.png |

`<category>` is lowercase (`reviewed`, `bond`, `ground`, `built`, `fiber`, `metal`, `nature`). Raw GitHub URLs follow whatever `main` holds. Pin a commit SHA instead of `main` if you need the same bytes every time.

```sh
curl -sO https://shoozes.github.io/mountain-cabin-bloom-honey/textures/manifest.json
curl -sO https://shoozes.github.io/mountain-cabin-bloom-honey/textures/pixel/built/pantile.png
```

## Shader first, bake only

1. **Author in GLSL.** Styles are shader code in the catalog (`src/shader/catalog.ts`, `src/shader/glsl.ts`), and look-dev reviews them live in the mill.
2. **Judge the rendered pixels.** The judge is TypeScript, not shader code. It scores the rendered tile against `SEAM_MAX` (0.16) and `MATCH_MIN` (0.58) in [`src/shader/judge.ts`](../../src/shader/judge.ts). Seam scoring is in [`src/shader/seam.ts`](../../src/shader/seam.ts). `npm run seam` ([`scripts/seam-harness.mjs`](../../scripts/seam-harness.mjs)) runs the fixture harness. The unit tests are in [`src/shader/seam.test.ts`](../../src/shader/seam.test.ts); run them with `node --experimental-strip-types --test src/shader/seam.test.ts` (Node 22). `npm test` runs them too, after the `scripts/` tests.
3. **Bake, never paint.** `npm run bake:corpus` ([`scripts/bake-corpus.mjs`](../../scripts/bake-corpus.mjs)) uses headless Chromium (Playwright) to draw each tile with the same path the mill's Save / PNG catalog export uses. It uses a locked recipe (`RECIPE` in the script) and writes `public/textures/**` and `manifest.json`. The bake refuses held needs-ref ids (`HELD_IDS`). PNGs are only ever shader output. Nobody edits them by hand.
4. **Provenance.** The bake writes `sourceTip` into the manifest. That value is `BAKE_SOURCE_TIP` if set. Otherwise it is `git rev-parse origin/main`, or `git rev-parse HEAD` if that command fails (for example, no `origin/main`). After a shader or recipe change, re-bake and commit the PNGs.
5. **Deploy.** [`.github/workflows/pages.yml`](../../.github/workflows/pages.yml) runs `npm run build:pages` on every push to `main`. It never bakes. It ships the committed PNGs as-is. The bake is not part of `npm run build` either.

The hosting plan and recipe are in [`docs/look-dev/public-publish-png-plan.md`](../../docs/look-dev/public-publish-png-plan.md).

## Planned (not yet available)

> **Planned.** None of these exist yet. There are no commands, endpoints, or packages to use today.

- **CLI** to fetch a texture
- **HTTP API** that returns a PNG or its shader recipe
- **MCP server** that exposes the corpus to agents

The publish plan says these should read `manifest.json` and the `textures/` tree rather than re-implement export.

## Development

Requires Node 22 (`@tanstack/react-start` needs >= 22.12).

```sh
npm install
npm run dev            # mill + gallery on http://localhost:8080
npm test               # all unit tests: scripts/, then src/ (incl. seam / judge)
node --experimental-strip-types --test src/shader/seam.test.ts   # seam / judge unit tests
npm run seam           # seam / match harness
npm run typecheck
npm run lint
npm run build:pages    # static Pages build (base /mountain-cabin-bloom-honey/) into dist/client
npm run preview:pages
npm run bake:corpus    # re-bake public/textures (needs Playwright Chromium)
```

Routes: `/` is the mill (live shader, Save, 2×2 atlas, PNG catalog ZIP). `/gallery` is the baked PNG gallery.

AI-edited: 2026-10-07 | agent=Codex/root | model=unknown | effort=unknown | task=texture-tools-publish | change=recorded verified material workflow, scoped publication and private art boundary

AI-edited: 2026-10-11 | agent=Codex/next_graphics_batch | model=unknown | effort=unknown | task=style-surface-recipes | change=documented ten-family four-style material recipes and single-seed baking

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=review-recheck-cleanup | change=linked current local verification and bounded TODO

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=grass-dirt-study | change=linked completed visual recommendations without approving artwork

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=closeout-publish | change=linked portable verified progress and retained unfinished art refinement

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=retro-terrain | change=linked original native-grid terrain authoring and separate export contract

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=retro-terrain-growth | change=linked curated path and weathering recipe with independent palettes

AI-edited: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=scene-coherence-learning | change=added actual-scene color, lighting, texture-scale and mockup-to-runtime criteria before expanding game-facing variants

AI-edited: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=realistic-material-catalog | change=linked six continuous surface recipes and neutral authoring preview without approving artwork

AI-edited: 2026-10-23 | agent=Codex/root | task=dirt-clumps | change=linked reversible HD-2D dirt structure and retained original recipe compatibility
