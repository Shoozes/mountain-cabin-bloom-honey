# Sprite variations and lossless recipe transport

Studio's ordinary Sprite workspace has a **Sprite variations** disclosure.
The accepted traveler opens unchanged. Its reusable family offers three tops,
four hat choices (including none), four coordinated colorways and an optional
backpack: 96 combinations drawn from existing artwork. Frame corrections,
body/feet drawings, anchors, ordering and clip timing stay in the recipe.
Generated combinations remain candidates; existing art acceptance does not expand.

Choose a group directly, lock it, or reroll only that group. **Generate 4
candidates** previews four consecutive seeds without replacing the source.
Choose a candidate to enter the normal undo/draft history. Candidate thumbnails
follow the selected pose; Play uses the established walk cycle. Candidate seeds
select options separately from the recipe's drawing seed, preserving procedural
marks inside a design. Selection/lock state recovers with the recipe.

**Edit variation family** is the secondary authoring surface. Invalid family
text is retained in the local recipe draft through reload; the last valid image
stays open. Applying a valid family captures current drawings as options before
any selection changes. Ordinary recipe source edits must be applied/reset first.
The Character workspace retains its existing creator/rig randomizer; generic
part replacement cannot bypass the character compiler's source-consistency guard.

## Reusable definitions

`grout-sprite-variations/1` contains named groups with named options. Options
provide complete `palette` and/or `parts` patches. Every option in a group owns
the same keys; groups cannot overlap. Palette roles and part names must already
exist. Replace all directional parts of a garment in one option; source frame
mapping, visibility, corrections and animation remain authoritative. Unsupported
references, invalid selections, inconsistent patches and locked rerolls reject
without replacing the source. Combined graphs are validated again on application.

```js
import {createSpriteVariationProfile, generateSpriteVariations,
  randomizeSpriteVariation} from './packages/grout-art/index.mjs';
const family = createSpriteVariationProfile(recipe);
const candidates = generateSpriteVariations(recipe, family,
  {seeds: [1204, 1215, 1233]});
const chosen = randomizeSpriteVariation(candidates[0], family,
  {seed: 1215, group: 'hat'});
```

A generic/imported sprite starts with its current palette as a complete option.
Author additional coordinated palettes or complete part alternatives in the
family definition; no recoloring, direction inference or new anatomy is automatic.
The built-in traveler factory preserves custom clothing/hat/pack snapshots.
Older travelers without newer apparel roles retain a palette-only starter.
Group streams depend on stable group IDs and seed, independently of group order.
A targeted reroll excludes its current option when alternatives exist. Locked
selections are never silently replaced. Batches are bounded to 64 candidates.

## Lossless optimization

**Lossless recipe optimization** checks the current source without changing it.
`optimizeRecipe(recipe, {signal})` returns `{document, report}`. The document
uses `grout-art-optimized/1` shared JSON subtrees when that reduces compact byte
count; otherwise it remains ordinary `grout-art/1`. Sharing includes repeated
masks, correction data, palette patches and creator definitions. It does not
merge layers, quantize colors, redraw pixels or discard hidden/editable data.

`parseRecipe(document)` reconstructs the exact parsed authoring object, with
independent mutable copies of shared data. It validates references, bounded
expansion and the ordinary graph before use. The optimizer compares every
restored RGBA frame and yields between frames for cancellation. Stale checks
are discarded when the recipe changes or Studio unmounts. Shader modules,
source attribution, character documents and custom parts survive unchanged.

Both browser and CLI atlas kits now add compact `recipe.optimized.json` and
`optimization.json`; `recipe.json` stays the full readable editable source.
The existing bake command also accepts the optimized transport directly:

```powershell
npm run bake:art -- --recipe path/to/recipe.optimized.json --out .artifacts/art
```

Source-addressed caches include codec, variation and optimizer modules and
validate all sidecar bytes. The optimizer minimizes **uncompressed recipe bytes**.
Gzip can be smaller for the original source; Studio/metrics report both encodings
and both recipe-plus-runtime gzip costs, rather than claiming shared data always
wins. Runtime measurements count the full SDK module set once, including
character and component support. Browser measurements use served module bytes
(dev transforms may add overhead); CLI measurements use source files. This is
not a compact consumer runtime or a claim of full Grout parity.

## Qualification

The [batch record](../work/done/SPRITE-VARIATION-20261017.md) binds commands,
current proof, preservation and limitations. Scope includes seeds 1204/1215/1233,
all built-in option combinations, locks/rerolls, malformed families/transports,
exact authoring/pixel restoration, import attribution, character source guards,
CPU/GLSL/WGSL comparisons and dev/built desktop/narrow workflows. No external
reference pixels are introduced.

AI-edited: 2026-10-17 | agent=Codex/root | task=sprite-variation | change=documented reusable families, reversible Studio workflow and exact transport contract
