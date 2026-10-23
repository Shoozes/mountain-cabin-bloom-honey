# Minecraft-style block textures · native 16×16

Choose **Minecraft-style · 16 px** beside the texture catalog, or open Adjust
materials and select that recipe. **Block material** offers grass, dirt, stone,
cobble, sand, planks, bark and brick. The shortcut waits for draft recovery
before accepting input. The existing material workspace saves/reloads the whole
recipe; switching types restores their own valid defaults and controls.

The new `voxel-surface/1` generator authors original 16×16 pixels. Export size
16 is native; 32, 64, 128, 256 and 512 are exact integer nearest enlargements.
Those sizes add no new drawing detail. Preview repeats are 1×1, 2×2 or 4×4;
the main stage fits the native grid at an integer device-pixel scale and scrolls
when the selected output cannot fit. Review both the native tile and a repeat
patch; a seamless file can still have a visible repeating motif.

## Reference study and original drawing decisions

The owner selected Classic/default 16×16. The visual study used eight public
textures from [Mojang's official sample pack](https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/textures/blocks):
`grass_top`, `dirt`, `stone`, `cobblestone`, `sand`, `planks_oak`, `log_oak` and
`brick`, observed on 2026-10-23. The grass-top source is grayscale for tinting;
our grass uses its own green ramp. The screenshot is retained as reference-only
evidence outside the repository, independently of our generated studies.

[Mojang's artist interview](https://www.minecraft.net/en-us/article/try-new-minecraft-textures)
describes reducing antialiasing for crisper low-resolution textures and using
consistent rules across a pack. Our interpretation uses stepped clusters,
finite original ramps and material-specific mark directions:

| Material | Original drawing treatment |
| --- | --- |
| Grass | Grouped green marks over quieter connected ground masses |
| Dirt | Short light/dark clods inside broader warm soil patches |
| Stone | Restrained gray stepped marks rather than large flat slabs |
| Cobble | Separate irregular stone bodies with darker joints |
| Sand | Low-contrast clustered grain without isolated bright flecks |
| Planks | Horizontal boards, staggered ends and short interior grain |
| Bark | Broken vertical ridges and grouped lighter marks |
| Brick | Offset rows, contrasting mortar and varied brick bodies |

The first draft had flat Voronoi masses, sparse grass marks and almost blank
sand. Comparison at equal integer zoom led to smaller subordinate clusters,
quieter sand contrast, neutral stone colors and interior wood/brick variation.
Board/brick dimensions divide the native period; row staggering continues
through a tile repeat. No source textures, extracted ramps or donor code are
used by the generator or committed fixtures/exports. These are candidates for
owner art review, not approved game assets.

## Controls and exports

Seed changes deterministic cluster placement. Earth/slate/ochre change pigment
only. **Cluster scale** changes native cluster cadence; **Wear / joints** changes
wear or joint geometry. Relief changes height and native-derived +Y normals;
roughness changes its own channel. Color remains unlit pigment with five-role
ramps. Alpha is opaque. All four channels and floating-point heights enlarge
from the same native grid, keeping their alignment and native normal strength.

**Save material channels** downloads the existing `texture-material/1` ZIP:
four PNG channels, `recipe.json` and `material.json`. Files keep nearest/repeat
metadata, byte hashes, source identity, original provenance and unapproved-art
status. The new module is included in browser and CLI source identities. Source
fetch failures remain visible and retryable with the editable draft intact;
CLI cache reuse still validates manifest metadata and deterministic bytes.

```powershell
npm run bake:material -- --recipe voxel-surface --variant-set single --out <output>
# For another family, save a complete editable recipe and supply its JSON path.
npm run bake:material -- --recipe <recipe.json> --variant-set single --out <output>
```

Omitting `--variant-set single` retains the existing three-seed catalog bake.
Other material types keep their earlier dimensions, validation and pixels.
These exports use our existing material kit; Minecraft resource-pack packaging
and receiving-engine proof remain separate outcomes.

`node scripts/study-material-voxel.mjs --out <study>` produces original native,
8× and 3×3 repeat studies plus four-channel views and source-bound hashes.
`scripts/test-material-voxel-browser.mjs` checks actual downloads and previews
on dev, normal and Pages builds. Its explicit `--quick` flow is diagnostic;
default qualification retains all eight families and three seeds. See the
[completed work record](../work/done/MATERIAL-VOXEL-20261023.md) for exact checks.
Referenced evidence stays under
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/voxel-material-20261023/`.

AI-created: 2026-10-23 | agent=Codex/root | task=voxel-material | change=documented official reference observations, original native16 construction, controls, exports and verification boundaries
