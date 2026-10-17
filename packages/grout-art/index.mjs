export {
  FORMAT,
  VERSION,
  copy,
  parseRecipe,
  registerTechnique,
  renderFrame,
  editPixel,
  floodFill,
  moveSelection,
} from "./core.mjs";
export { compileShader } from "./compiler.mjs";
export {
  createTravelerRecipe,
  createExampleRecipe,
  getTravelerWardrobe,
  setTravelerWardrobe,
  refineTravelerWalk,
  TRAVELER_CLOTHING,
  TRAVELER_HATS,
  TRAVELER_PALETTES,
} from "./traveler.mjs";
export { buildAtlas, extractFrame, buildArtExport } from "./export.mjs";
export { compactRecipe, measureRecipe, encodePortablePng } from "./metrics.mjs";
export { importSpritePixels, importSpriteLayers } from "./import.mjs";
export { CHARACTER_FORMAT, CHARACTER_CREATOR_FORMAT, CHARACTER_FRAMES, createCharacterCreator, parseCharacterCreator, createCharacterDocument, parseCharacterDocument, compileCharacter, randomizeCharacter, rateCharacter, isCharacterOptionCompatible, captureCharacterEdits, cloneCharacterOption, addCharacterSlot, importCharacterOption } from "./character.mjs";
/** Importing the headless entrypoint never initializes or imports a GPU API. */
export async function createRenderer(options = {}) {
  const { createRenderer } = await import("./browser.mjs");
  return createRenderer(options);
}
