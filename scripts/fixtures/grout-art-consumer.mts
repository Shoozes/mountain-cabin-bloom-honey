import {
  importSpritePixels,
  importSpriteLayers,
  createTravelerRecipe,
  getTravelerWardrobe,
  setTravelerWardrobe,
  createRenderer,
  renderFrame,
  buildArtExport,
  extractFrame,
  type ArtRecipe,
  type Pixels,
  createCharacterDocument, compileCharacter, randomizeCharacter, type CharacterDocument,
} from "../../.artifacts/grout-art-sdk/index.mjs";
import { createRenderer as browserRenderer } from "../../.artifacts/grout-art-sdk/browser.mjs";
const recipe: ArtRecipe = createTravelerRecipe();
const dressed: ArtRecipe = setTravelerWardrobe(recipe, { clothing: "tunic", hat: "trail", palette: "cinder" });
void getTravelerWardrobe(dressed);
const pixels: Pixels = renderFrame(recipe);
const kit = buildArtExport(recipe);
const restored: Pixels = extractFrame(kit.atlas, recipe.frames[0].name);
const cpu = await createRenderer({ backend: "cpu" });
await cpu.render(recipe, 0, { signal: new AbortController().signal });
cpu.dispose();
void browserRenderer;
void pixels;
void restored;

const imported: ArtRecipe = await importSpritePixels(pixels);
const layered: ArtRecipe = await importSpriteLayers([{name: "Source", frames: [pixels]}]);
void imported; void layered;

const outlined: ArtRecipe = {...layered, outline: {enabled: true, color: "#26323f", width: 1, corners: "stepped"}};
void renderFrame(outlined);
const character: CharacterDocument = randomizeCharacter(createCharacterDocument(), {seed: 1215});
void renderFrame(compileCharacter(character));
