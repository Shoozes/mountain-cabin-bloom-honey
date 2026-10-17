/** Lossless authoring-data transport; no drawing rewrites or palette quantization. */
export const OPTIMIZED_FORMAT = "grout-art-optimized/1";
const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;
const marker = "$art", limit = 2 * 1048576;
const isObject = (value) => value !== null && typeof value === "object";
export function packRecipeData(recipe) {
  const counts = new Map();
  function count(value, depth = 0) {
    if (!isObject(value)) return;
    if (depth > 64) throw Error("Recipe optimization: nesting budget exceeded");
    const key = JSON.stringify(value);
    if (key.length >= 32) counts.set(key, (counts.get(key) ?? 0) + 1);
    for (const child of Object.values(value)) count(child, depth + 1);
  }
  count(recipe);
  const blocks = [], indices = new Map();
  function encode(value, literal = false) {
    if (!isObject(value)) return value;
    const key = JSON.stringify(value), uses = counts.get(key) ?? 0;
    if (!literal && uses > 1 && (key.length - 16) * (uses - 1) > 24 && blocks.length < 4096) {
      if (!indices.has(key)) {
        const block = encode(value, true);
        if (blocks.length >= 4096) return block;
        indices.set(key, blocks.length);
        blocks.push(block);
      }
      return { [marker]: indices.get(key) };
    }
    if (Array.isArray(value)) return value.map((child) => encode(child));
    const result = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encode(child)]));
    return Object.hasOwn(value, marker) ? { [marker]: "literal", value: result } : result;
  }
  const root = encode(recipe), packed = { format: OPTIMIZED_FORMAT, blocks, root };
  const sourceBytes = bytes(recipe), packedBytes = bytes(packed), smaller = packedBytes < sourceBytes;
  return { document: smaller ? packed : recipe, report: {
    format: "grout-art-optimization/1", method: "shared-json-subtrees",
    sourceBytes, optimizedBytes: smaller ? packedBytes : sourceBytes,
    savedBytes: smaller ? sourceBytes - packedBytes : 0, sharedBlocks: smaller ? blocks.length : 0,
    authoringReconstruction: "exact", drawingRewrites: false,
  } };
}
/** Bounded expansion with backward references only. Reserved user keys are escaped. */
export function unpackRecipeData(input) {
  if (input?.format !== OPTIMIZED_FORMAT) return input;
  if (bytes(input) > limit || Object.keys(input).some((key) => !["format", "blocks", "root"].includes(key)) ||
      !Array.isArray(input.blocks) || input.blocks.length > 4096 || !Object.hasOwn(input, "root"))
    throw Error("Optimized recipe: invalid envelope");
  let budget = limit, nodes = 0;
  function decode(value, available, depth = 0, literal = false) {
    if (++nodes > 500000 || depth > 64 || budget < 0) throw Error("Optimized recipe: expansion budget exceeded");
    if (!isObject(value)) { budget -= bytes(value); return value; }
    if (!literal && !Array.isArray(value) && Object.hasOwn(value, marker)) {
      if (value[marker] === "literal" && Object.keys(value).length === 2 && isObject(value.value) && !Array.isArray(value.value))
        return decode(value.value, available, depth + 1, true);
      const ref = value[marker];
      if (Object.keys(value).length !== 1 || !Number.isInteger(ref) || ref < 0 || ref >= available)
        throw Error("Optimized recipe: invalid or cyclic reference");
      return decode(input.blocks[ref], ref, depth + 1);
    }
    budget -= 2 + Object.keys(value).length;
    if (Array.isArray(value)) return value.map((child) => decode(child, available, depth + 1));
    return Object.fromEntries(Object.entries(value).map(([key, child]) => {
      budget -= bytes(key) + 1;
      return [key, decode(child, available, depth + 1)];
    }));
  }
  const result = decode(input.root, input.blocks.length);
  if (budget < 0 || bytes(result) > limit) throw Error("Optimized recipe: expansion budget exceeded");
  return result;
}
