# HD-2D grass: connected tuft candidate

The optional tuft structure replaces the earlier broad pigment islands and
isolated flecks with three tapered, curved blades growing from each shared root.
Spacing, length and lean vary locally across a periodic field. The original
green ramp stays unchanged, with quiet ground pigment and no painted directional
lighting. Height, wrapped +Y normals and roughness describe that same structure.
Artwork remains **unapproved** pending owner review.

## Author and recover

In Adjust → material controls, choose Style surface family, Grass and HD-2D,
then set **Grass structure → Connected tufts**. Original patches restores the
earlier output. Existing saved recipes open in their original mode; no migration
is automatic. The option appears only for HD-2D grass. Changing family or style
clears it; returning to grass/HD-2D starts in the original mode.

Tuft scale controls the number of root groups across the tile, using the existing
serialized `strataScale` key. Relief, palette, repeat and channel controls retain
their meanings. Palette edits change pigment only. Fracture has no effect on
grass, as with the original grass recipe; it remains available for other families.

```json
{
  "id": "style-surface",
  "family": "grass",
  "style": "hd2d",
  "structure": "tufts",
  "seed": 1204,
  "size": 128,
  "palette": "earth",
  "strataScale": 4,
  "fracture": 0.28,
  "relief": 0.55,
  "roughness": 0.84
}
```

Pass this JSON to the existing baker:

```powershell
npm run bake:material -- --recipe <recipe.json> --variant-set single --out <explicit-output>
```

Omitting `structure` preserves every older recipe and pixel, including the
released dirt clumps. `tufts` is accepted only for grass/HD-2D; `clumps` remains
dirt/HD-2D only. Invalid combinations fail validation. Browser ZIPs and CLI bakes
retain `texture-material/1`, readable recipes, four PNG channels, source identity
and unapproved provenance. New and original recipes have distinct cache
identities. A source edit invalidates old source-bound cache entries even when
their pixel output is unchanged. No public corpus or engine asset is replaced.

## Review and proof

The [earlier study](grass-dirt-study.md) remains historical. Its grass finding is
addressed by this optional candidate. Reproduce current original-only review
evidence with:

```powershell
node scripts/study-material-grass.mjs --out <explicit-study-directory>
```

The producer writes eight native maps and checks exact pixel copying for their
eight 2×2 repeats, then writes native/repeated comparisons, three-seed channel strips
and a nearest-neighbor 4× albedo comparison. Comparison rows are original above
and tufts below, with albedo, height, +Y normal and roughness left to right.
The 4× albedo view places original left and tufts right. `study.json` binds
normalized recipes, producer/source hashes and every retained PNG.

Current evidence is under
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/grass-tufts-20261023/`.
The [work record](../work/done/MATERIAL-GRASS-20261023.md) owns the exact local
checks and final results. Retain this compact original-only evidence while
referenced; no automatic retirement. Existing historical studies stay intact.

Native and integer views show connected blade groups over a quieter ground;
height remains shallow and roughness mostly matte. Exact repeats show no hard
tile border in the inspected maps, but recurring tuft arrangements remain
visible. These are drawing observations, not engine lighting or world-scale
qualification. Owner acceptance and engine receiving remain separate.

AI-created: 2026-10-23 | agent=Codex/root | task=grass-tufts | change=documented reversible tuft authoring, compatibility, review evidence and acceptance boundary
