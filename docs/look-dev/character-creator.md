# Character creators

Open `/studio?workspace=character` using Studio's **Character** link. This
workspace assembles characters and edits reusable creator definitions. Ordinary
sprite editing, traveler recipes, terrain and their recovery state are preserved.
The owner accepted the displayed Classic adventurer / Outlined 8-bit / Fern
base and walk cycle on 2026-10-17. Its twelve frames, palette and clips are pinned
in `scripts/fixtures/character-accepted-20261017.json`. Other builds, styles,
variants and generated/custom designs remain unapproved pending owner review.

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

Generated heads have even widths in every direction: 6, 8 or 10 pixels in the
front/rear rig, with profiles narrowed by two pixels down to a minimum of six.
Torso widths are 4 or 6. Odd widths from older v1 creators round up during
parsing; their custom/imported drawings remain unchanged. The editor steps by
two and displays the same canonical values saved in the character document.

Built-in front and rear idle frames are exactly symmetrical, including hands,
feet, fringe, centered ponytails, hat contours and shading planes. This applies
to authored, adjustable and procedural designs. Custom pixels and attachment
edits remain under the author's control. Walking retains alternating contact
poses, stable head/torso height, counter-swinging arms and a fixed feet anchor.
Profile contacts alternate a planted toe and lifted trailing heel. The gathered
passing key keeps a floor gap between its soles. Three native shoe rows describe
shaft, leather plane and sole; heel articulation changes at most one silhouette
pixel instead of exchanging identical block stamps.

Choose a part thumbnail to select its drawing layer. Painting, erasing, filling
or moving pixels creates a custom option and locks its slot. Other poses and
the original option survive. Custom drawings retain build/style compatibility;
custom hair and hats also retain head compatibility. Undo/redo restores whole
creator documents. Use the layer list to select rear or far layers.

Built-in outlined styles finish their contours after fills and material planes.
The profile face keeps its outer ink; the inner hair plane joins the head without
replacing its perimeter. Backpacks use leather and leather-shadow roles, never
skin or clothing accents. The shadow reuses existing ink so a previously valid
eighth imported color still fits flat styles. Outline-free styles remain an
explicit alternative; custom/imported pixels bypass this built-in finishing.
Outline-free arms retain the complete authored contour as skin coverage rather
than dropping boundary pixels when ink is disabled.

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
controls. Studio waits for local recovery before enabling drawing and export.
Unapplied recipe text survives reloads and workspace switches; malformed text
does not replace the last valid character or sprite. Download creator or
character JSON for a portable save.

Current cleanup receipts and outline-free studies are retained at
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/character-review-cleanup-20261017/`.
The accepted original-only contour/feet studies remain at
`D:/Compact_Evidence/mountain-cabin-bloom-honey/runs/character-contours-20261017/`.
Recovery and earlier motion studies remain historical under
`character-recovery-art-20261017`, `character-motion-20261017` and
`character-creator-20261017`. The owner reported defects in those motion
candidates; the owner subsequently accepted the displayed contour/feet default.
Technical qualification is separate from artwork acceptance and publication.

See the current [qualification record](../work/done/CHARACTER-CREATOR-20261017.md) for the exact
passed checks and the scope of owner visual acceptance.

AI-created: 2026-10-17 | agent=Codex/root | task=character-creator

AI-edited: 2026-10-17 | agent=Codex/root | task=character-recovery-art | change=qualified startup recovery and linked the completed eye/stride pass

AI-edited: 2026-10-17 | agent=Codex/root | task=character-motion | change=recorded even rigs, symmetrical facing idles and revised walk candidate

AI-edited: 2026-10-17 | agent=Codex/root | task=character-contours | change=recorded closed contours, leather roles and articulated profile shoes

AI-edited: 2026-10-17 | agent=Codex/root | task=character-review-cleanup | change=recorded accepted default pixel contract and outline-free coverage repair
