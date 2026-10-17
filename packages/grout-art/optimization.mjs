import { parseRecipe, renderFrame } from "./core.mjs";
import { packRecipeData } from "./recipe-codec.mjs";
/** Preserve the entire editable recipe and prove every restored RGBA frame. */
export async function optimizeRecipe(input, { signal } = {}) {
  signal?.throwIfAborted();
  const source = parseRecipe(input), result = packRecipeData(source), restored = parseRecipe(result.document);
  if (JSON.stringify(source) !== JSON.stringify(restored)) throw Error("Recipe optimization changed authoring data");
  for (let frame = 0; frame < source.frames.length; frame++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    signal?.throwIfAborted();
    const before = renderFrame(source, frame).data, after = renderFrame(restored, frame).data;
    if (before.some((byte, index) => byte !== after[index])) throw Error("Recipe optimization changed frame " + frame);
  }
  signal?.throwIfAborted();
  return { ...result, report: { ...result.report, verifiedFrames: source.frames.length } };
}
