import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { parseRecipe, buildArtExport, measureRecipe, optimizeRecipe } from "../packages/grout-art/index.mjs";
import { encodeMaterialPng } from "./material-png.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  hash = (b) => createHash("sha256").update(b).digest("hex");
export const ART_SOURCE_PATHS = [
  "core.mjs",
  "compiler.mjs",
  "browser.mjs",
  "atlas.mjs",
  "export.mjs",
  "traveler.mjs",
  "metrics.mjs",
  "import.mjs",
  "components.mjs",
  "character.mjs",
  "character-art.mjs",
  "recipe-codec.mjs",
  "optimization.mjs",
  "variation.mjs",
  "index.mjs",
].map((p) => "packages/grout-art/" + p);
export async function bakeArt({ recipe: input, output, signal } = {}) {
  if (typeof output !== "string" || !output.trim())
    throw Error("An explicit output directory is required");
  signal?.throwIfAborted();
  const recipe = parseRecipe(input),
    kit = buildArtExport(recipe, { signal }),
    sources = [],
    runtimeSources = [];
  for (const relative of [
    ...ART_SOURCE_PATHS,
    "scripts/bake-art.mjs",
    "scripts/material-png.mjs",
  ]) {
    const bytes = await fs.readFile(path.join(root, relative));
    sources.push({ path: relative, sha256: hash(bytes) });
    if (relative.startsWith("packages/")) runtimeSources.push(bytes.toString("utf8"));
  }
  const identity = hash(JSON.stringify({ recipe, sources })),
    destination = path.resolve(output),
    directory = path.join(destination, "grout-art-" + identity.slice(0, 12)),
    pending = path.join(destination, ".pending-" + randomUUID()),
    assets = new Map();
  const json = (name, value) =>
    assets.set(name, Buffer.from(JSON.stringify(value, null, 2) + "\n"));
  for (const page of kit.atlas.pages)
    assets.set(
      `atlas-${page.index}.png`,
      encodeMaterialPng({
        width: page.width,
        height: page.height,
        data: new Uint8Array(page.rgba),
      }),
    );
  assets.set("sheet.png", encodeMaterialPng(kit.sheet));
  json("recipe.json", recipe);
  const optimized = await optimizeRecipe(recipe, { signal });
  assets.set("recipe.optimized.json", Buffer.from(JSON.stringify(optimized.document)));
  json("optimization.json", optimized.report);
  if (recipe.character) {
    json("character.json", recipe.character);
    json("creator.json", recipe.character.creator);
  }
  json("techniques.json", recipe.techniques);
  json("phaser-atlas.json", kit.phaser);
  json("metrics.json", await measureRecipe(recipe, { runtimeSources }));
  const manifest = {
    ...kit.manifest,
    identity,
    sources,
    files: [...assets].map(([name, bytes]) => ({
      path: name,
      bytes: bytes.length,
      sha256: hash(bytes),
    })),
  };
  json("atlas.json", manifest);
  signal?.throwIfAborted();
  const verify = async () => {
    const entries = await fs.readdir(directory);
    if (entries.length !== assets.size) throw Error("Existing art cache file list differs");
    for (const [name, expected] of assets) {
      signal?.throwIfAborted();
      const stat = await fs.lstat(path.join(directory, name));
      if (!stat.isFile() || stat.size !== expected.length)
        throw Error("Existing art cache metadata differs: " + name);
      if (!(await fs.readFile(path.join(directory, name))).equals(expected))
        throw Error("Existing art cache differs from deterministic source: " + name);
    }
    return { directory, manifest, reused: true };
  };
  await fs.mkdir(destination, { recursive: true });
  try {
    await fs.stat(directory);
    return await verify();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.mkdir(pending);
  try {
    for (const [name, bytes] of assets) {
      signal?.throwIfAborted();
      await fs.writeFile(path.join(pending, name), bytes);
    }
    signal?.throwIfAborted();
    try {
      await fs.rename(pending, directory);
    } catch (error) {
      if (!["EEXIST", "EPERM", "ENOTEMPTY"].includes(error.code)) throw error;
      const winner = await verify();
      await fs.rm(pending, { recursive: true, force: true });
      return winner;
    }
    return { directory, manifest, reused: false };
  } catch (error) {
    if (path.dirname(pending) === destination && path.basename(pending).startsWith(".pending-"))
      await fs.rm(pending, { recursive: true, force: true });
    throw error;
  }
}
async function main() {
  const args = process.argv.slice(2),
    opts = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--recipe", "--out"].includes(args[i]) || !args[i + 1] || Object.hasOwn(opts, args[i]))
      throw Error("Usage: npm run bake:art -- --recipe recipe.json --out .artifacts/art");
    opts[args[i]] = args[i + 1];
  }
  if (!opts["--recipe"] || !opts["--out"]) throw Error("Explicit --recipe and --out are required");
  const controller = new AbortController(),
    cancel = () => controller.abort(Error("Art bake cancelled"));
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const recipe = JSON.parse(await fs.readFile(path.resolve(opts["--recipe"]), "utf8")),
      result = await bakeArt({ recipe, output: opts["--out"], signal: controller.signal });
    console.log(
      JSON.stringify({
        directory: result.directory,
        identity: result.manifest.identity,
        reused: result.reused,
      }),
    );
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
