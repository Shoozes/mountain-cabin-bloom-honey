import {
  buildArtExport,
  optimizeRecipe,
  encodePortablePng,
  type ArtRecipe,
} from "../../packages/grout-art/index.mjs";
import { zipStore } from "@/shader/zip-store";
const encode = new TextEncoder();
const digest = async (bytes: Uint8Array) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
const sourceUrls = [
  new URL("../../packages/grout-art/recipe-codec.mjs", import.meta.url),
  new URL("../../packages/grout-art/optimization.mjs", import.meta.url),
  new URL("../../packages/grout-art/variation.mjs", import.meta.url),
  new URL("../../packages/grout-art/index.mjs", import.meta.url),
  new URL("../../packages/grout-art/core.mjs", import.meta.url),
  new URL("../../packages/grout-art/compiler.mjs", import.meta.url),
  new URL("../../packages/grout-art/atlas.mjs", import.meta.url),
  new URL("../../packages/grout-art/export.mjs", import.meta.url),
  new URL("../../packages/grout-art/browser.mjs", import.meta.url),
  new URL("../../packages/grout-art/traveler.mjs", import.meta.url),
  new URL("../../packages/grout-art/metrics.mjs", import.meta.url),
  new URL("../../packages/grout-art/import.mjs", import.meta.url),
  new URL("../../packages/grout-art/components.mjs", import.meta.url),
  new URL("../../packages/grout-art/character.mjs", import.meta.url),
  new URL("../../packages/grout-art/character-art.mjs", import.meta.url),
];
export async function exportArtFiles(input: ArtRecipe, { signal }: { signal?: AbortSignal } = {}) {
  signal?.throwIfAborted();
  const kit = buildArtExport(input, { signal }),
    files: { name: string; data: Uint8Array }[] = [];
  const json = (name: string, value: unknown) =>
    files.push({ name, data: encode.encode(JSON.stringify(value, null, 2) + "\n") });
  for (const page of kit.atlas.pages) {
    signal?.throwIfAborted();
    files.push({
      name: `atlas-${page.index}.png`,
      data: await encodePortablePng({
        width: page.width,
        height: page.height,
        data: new Uint8Array(page.rgba),
      }),
    });
  }
  files.push({ name: "sheet.png", data: await encodePortablePng(kit.sheet) });
  json("recipe.json", kit.recipe);
  const optimized = await optimizeRecipe(kit.recipe, { signal });
  files.push({ name: "recipe.optimized.json", data: encode.encode(JSON.stringify(optimized.document)) });
  json("optimization.json", optimized.report);
  if (kit.recipe.character) {
    json("character.json", kit.recipe.character);
    json("creator.json", kit.recipe.character.creator);
  }
  json("techniques.json", kit.recipe.techniques ?? []);
  json("phaser-atlas.json", kit.phaser);
  const sources = [];
  for (const url of sourceUrls) {
    signal?.throwIfAborted();
    const response = await fetch(url, { signal });
    if (!response.ok) throw Error("Art authoring source identity unavailable; retry export");
    const bytes = new Uint8Array(await response.arrayBuffer());
    sources.push({ path: url.pathname, sha256: await digest(bytes) });
  }
  const identity = await digest(encode.encode(JSON.stringify({ recipe: kit.recipe, sources }))),
    metadata = [];
  for (const file of files)
    metadata.push({ path: file.name, bytes: file.data.length, sha256: await digest(file.data) });
  json("atlas.json", { ...kit.manifest, identity, sources, files: metadata });
  signal?.throwIfAborted();
  return files;
}
export async function exportArtZip(recipe: ArtRecipe, options: { signal?: AbortSignal } = {}) {
  return zipStore(await exportArtFiles(recipe, options));
}
