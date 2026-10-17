# Character creators

Open `/studio?workspace=character` using Studio's **Character** link. This
workspace assembles characters and edits reusable creator definitions. Ordinary
sprite editing, traveler recipes, terrain and their recovery state are preserved.
New artwork is **unapproved pending owner visual acceptance**.

## Assemble and draw

Defaults are Classic adventurer, Outlined 8-bit, Fern, seed 1204. Compact chibi
and Tall/slim use different native rigs; Outline-free and Restrained shading
change contours and material planes. Each of the nine combinations supplies
three heads, four hairstyles, three hats, three tops, two leg treatments, two
shoes and an optional backpack. Hair and hats can be absent. Skin/hair each have
four ramps; Fern, Cinder, Heather and Harbor coordinate clothing and headwear.

The body uses a native 16-pixel design grid. Default frames are 24×24, with four
pixels of padding and feet at `[12,19]`. Choose 16 or 32 without rescaling the
drawing; feet become `[8,15]` or `[16,23]`. Overflow produces an error and retains
the last valid preview. Source parts and outline footprints must fit. All twelve
frames share dimensions and an anchor. Walking uses contact, passing, opposite
contact, passing at 8 fps; idle references the passing pose. Direction-specific
ordering handles head, hair and gear; the backpack is hidden in front.

Choose a part thumbnail to select its drawing layer. Painting, erasing, filling
or moving pixels creates a custom option and locks its slot. Other poses and
the original option survive. Custom drawings retain build/style compatibility;
custom hair and hats also retain head compatibility. Undo/redo restores whole
creator documents. Use the layer list to select rear or far layers.

## Generate and build a creator

- **Authored** selects curated drawings with default dimensions.
- **Adjustable** changes hair length/fringe, hat crown and garment sleeve/hem
  through bounded integer controls.
- **Procedural** varies coherent hair contours, crown silhouettes and clothing
  panels. Slot seeds keep the design consistent across poses.

Randomize advances the seed and keeps build, style and palette unless explicitly
included. Locks protect choices and their procedural seeds. Reroll part changes
one slot. Generate from seed reproduces choices for a typed seed and current
locks/settings. Incompatible constraints show an explanation instead of silently
unlocking a part.

**Keep this look** and **Reject this look** record local judgments in the creator.
Future rolls exclude exact rejected combinations and use a modest preference
bias toward kept choices. Parts are not individually blacklisted. The same seed,
settings and feedback reproduce the same result. **Use my preferences** restores
ordinary seeded sampling when disabled. Review history can restore a selection
or remove a judgment; Undo restores the previous whole document. Reviews travel
with creator/character JSON. This is a local ranking rule, not a trained visual
quality model. Up to 64 reviews are retained without silently deleting older ones.

**Edit creator** exposes names, outline/shading flags, color budgets, rig
measurements, palette ramps, attachment offsets, generator ranges and option
compatibility. Duplicate the creator or add slots/options. New slots start as
twelve explicit blank poses for painting. The secondary JSON editor has a
pending-edit state and Apply/Cancel controls.

Import PNG/GIF layers through the existing importer, then explicitly map every
target pose. Pixel anchors align the source. Unmapped colors are preserved;
palette-role remapping is an explicit edit. The style color budget is enforced:
map colors or deliberately increase it for a richer imported source. Each
imported option retains its original recipe, layers, clips, mapping and
attribution even after correction. Missing directions are never invented.

Custom parts support native masks, rectangles and circles. Other graphs can be
rendered/imported as layers. Built-in drawings use `character-drawings/1` with
editable parameters and original native routines. No embedded JavaScript or
remote generation service is involved.

## Files and SDK

`grout-character-creator/1` holds rigs, styles, palette roles, slots, drawing
choices and compatibility. A self-contained `grout-character/1` document embeds
that creator and its selections, parameters, seeds, locks and custom parts.

```js
import {
  createCharacterDocument, randomizeCharacter, compileCharacter,
  parseCharacterCreator, parseCharacterDocument,
} from './packages/grout-art/index.mjs';

const character = randomizeCharacter(createCharacterDocument(), {seed: 1215});
const recipe = compileCharacter(character); // Existing grout-art/1
```

The typed headless SDK also exposes `createCharacterCreator`,
`captureCharacterEdits`, `cloneCharacterOption`, `addCharacterSlot` and
`importCharacterOption` and `rateCharacter`. Rendering continues through CPU,
WebGL2 or WebGPU.
Export includes creator/character JSON, resolved recipe, atlas PNGs, an untrimmed
3-column × 4-row sheet, and Phaser metadata. Stale creator/resolved pairs are
rejected. Source-addressed exports include creator compiler/drawing identities.

```powershell
npm run build:art-sdk
npm run bake:art -- --recipe .artifacts/grout-art-sdk/character.recipe.json --out .artifacts/art
node --test scripts/character.test.mjs
node scripts/test-character-browser.mjs --dev-url http://127.0.0.1:8080/ --proof-out <proof-directory>
```

Recovery uses `grout-character-studio/1`, separate from legacy drafts. Invalid
source keeps the last valid preview; pending source edits block conflicting
controls. Download creator or character JSON for a portable save.

Original-only studies and local receipts are retained at
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/character-creator-20261017/`.
Technical qualification is separate from artwork acceptance and publication.

The current session is a progress snapshot. See the
[continuation record](../work/queue/CHARACTER-CREATOR-20261017.md) for the exact
passed checks and remaining visual/browser acceptance criteria.

AI-created: 2026-10-17 | agent=Codex/root | task=character-creator
