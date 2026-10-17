import {
  importSpritePixels,
  importSpriteLayers,
  detectSpriteComponents,
  importSpriteComponents,
  type SpriteComponentAnalysis,
  type SpriteComponentOptions,
  createTravelerRecipe,
  getTravelerWardrobe,
  setTravelerWardrobe,
  createRenderer,
  renderFrame,
  buildArtExport,
  extractFrame,
  createSpriteVariationProfile, generateSpriteVariations, optimizeRecipe, parseRecipe,
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
const componentAnalysis: SpriteComponentAnalysis = await detectSpriteComponents(pixels, {connectivity: 8});
const componentOptions: SpriteComponentOptions = {groups: componentAnalysis.components.map((component) => [component.id]), padding: 1};
const components: ArtRecipe = await importSpriteComponents(pixels, componentOptions);
void components;

const outlined: ArtRecipe = {...layered, outline: {enabled: true, color: "#26323f", width: 1, corners: "stepped"}};
void renderFrame(outlined);
const character: CharacterDocument = randomizeCharacter(createCharacterDocument(), {seed: 1215});
void renderFrame(compileCharacter(character));

const family = createSpriteVariationProfile(recipe);
const variants: ArtRecipe[] = generateSpriteVariations(recipe, family, { seeds: [1204, 1215, 1233] });
const optimized = await optimizeRecipe(variants[0]);
void renderFrame(parseRecipe(optimized.document));
