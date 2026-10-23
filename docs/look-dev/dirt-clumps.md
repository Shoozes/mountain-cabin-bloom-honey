# HD-2D dirt: irregular clump candidate

The optional clump structure replaces the earlier horizontal crack phase with
smooth periodic soil clumps and localized depressions. Pigment stays unlit and
uses the existing earthy dirt ramp. A stronger fracture lowers and darkens the
same local joint field; +Y normals come from wrapped central differences of the
generated height. Artwork remains **unapproved** pending owner review.

## Author and recover

In Adjust → material controls, choose Style surface family, Dirt and HD-2D, then
set **Dirt structure → Irregular clumps**. Original rows reproduces the earlier
candidate. Existing saved recipes open in their original mode; no migration is
automatic. The option is shown only for HD-2D dirt. Changing family or style
clears it, and changing back starts with the original mode again.

Clump scale controls the number of broad soil features; fracture controls local
crack depressions. Relief, palette, repeat and all four channel controls retain
their existing meaning. Palette edits affect pigment only. `strataScale` remains
the serialized scale key for compatibility.

The opt-in recipe is:

```json
{
  "id": "style-surface",
  "family": "dirt",
  "style": "hd2d",
  "structure": "clumps",
  "seed": 1204,
  "size": 128,
  "palette": "earth",
  "strataScale": 4,
  "fracture": 0.28,
  "relief": 0.55,
  "roughness": 0.84
}
```

Pass this JSON file to the existing command:

```powershell
npm run bake:material -- --recipe <recipe.json> --variant-set single --out <explicit-output>
```

Omitting `structure` preserves every original recipe and pixel. The string
`clumps` is accepted only for dirt/HD-2D; incompatible or unknown values fail
validation. Browser downloads and CLI bakes retain `texture-material/1`, the
readable recipe, all four PNG channels, source-bound identity and unapproved
provenance. New and original recipes have distinct cache identities. As before,
source edits invalidate old source-bound cache entries even when their pixels
remain unchanged. No public corpus, sprite or engine asset is replaced.

## Review and proof

The [earlier study](grass-dirt-study.md) remains historical at its recorded source.
Its dirt recommendation is addressed by this opt-in candidate. It does not
approve the new drawing or change the grass recommendation.

Generate a current original-only comparison with:

```powershell
node scripts/study-material-dirt.mjs --out <explicit-study-directory>
```

The study writes eight native 128px maps, eight exact 2×2 views and two comparison
strips. The top row is original dirt and the bottom row clumps; columns are
albedo, height, +Y normal and roughness. `study.json` binds recipes, sources and
file hashes, with three-seed channel identities. Row-gradient coherence is a
diagnostic of horizontal alignment; it is not an art acceptance threshold or
evidence that finite-tile repetition is invisible.

Current retained evidence is under
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/dirt-clumps-20261023/`:
`study/native-comparison.png`, `study/repeat-comparison.png` and `study/study.json`.
These are compact, original-only local review evidence, retained while referenced;
no automatic retirement. Historical studies and private purchased inputs remain
separate. The [work record](../work/done/MATERIAL-DIRT-20261023.md) owns final
commands, browser results and limitations.

AI-created: 2026-10-23 | agent=Codex/root | task=dirt-clumps | change=documented additive clump authoring, backward compatibility and native/repeated review
