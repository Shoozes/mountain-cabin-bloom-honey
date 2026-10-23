import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bakeArt } from "./bake-art.mjs";
import { createTravelerRecipe } from "../packages/grout-art/traveler.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const exists = async (target) => fs.stat(target).then(() => true, (error) => error.code === "ENOENT" ? false : Promise.reject(error));

test("GIF/CSS bake variants isolate identities, preserve base assets and match CLI metadata", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "grout-art-gif-export-"));
  try {
    const recipe = createTravelerRecipe(), output = path.join(temp, "api"), modes = [
      {}, { includeCss: true }, { includeGif: true }, { includeCss: true, includeGif: true },
    ];
    const results = [];
    for (const options of modes) results.push(await bakeArt({ recipe, output, ...options }));
    const [plain, css, gif, both] = results;
    assert.equal(plain.manifest.stylesheet, undefined);
    assert.equal(plain.manifest.animations, undefined);
    assert.ok(!plain.manifest.files.some(({ path: name }) => name === "atlas.css" || name.endsWith(".gif")));
    assert.ok(css.manifest.stylesheet);
    assert.equal(css.manifest.animations, undefined);
    assert.equal(gif.manifest.stylesheet, undefined);
    assert.equal(gif.manifest.animations.format, "grout-art-gif/1");
    assert.equal(gif.manifest.animations.loop, "infinite");
    assert.equal(gif.manifest.animations.timing, "rounded-cumulative-centiseconds");
    assert.equal(both.manifest.stylesheet.format, "grout-art-css/1");
    assert.equal(both.manifest.animations.format, "grout-art-gif/1");
    assert.equal(both.manifest.animations.clips.length, Object.keys(recipe.clips).length);
    assert.equal(new Set(results.map(({ manifest }) => manifest.identity)).size, 4);
    for (let i = 0; i < modes.length; i++)
      assert.equal((await bakeArt({ recipe, output, ...modes[i] })).reused, true);

    for (const file of plain.manifest.files.filter(({ path: name }) => name.endsWith(".png") || name === "recipe.json")) {
      for (const result of results.slice(1))
        assert.deepEqual(await fs.readFile(path.join(plain.directory, file.path)), await fs.readFile(path.join(result.directory, file.path)), file.path);
    }
    for (const file of gif.manifest.animations.clips) {
      const source = await fs.readFile(path.join(gif.directory, file.path));
      assert.deepEqual(source, await fs.readFile(path.join(both.directory, file.path)), file.path);
      assert.deepEqual(JSON.parse(await fs.readFile(path.join(gif.directory, "atlas.json"), "utf8")).animations.clips
        .find(({ name }) => name === file.name), file);
    }

    const tamper = gif.manifest.animations.clips[0], gifPath = path.join(gif.directory, tamper.path);
    const originalGif = await fs.readFile(gifPath);
    await fs.writeFile(gifPath, Buffer.from("tampered"));
    await assert.rejects(bakeArt({ recipe, output, includeGif: true }), /differs/);
    await fs.writeFile(gifPath, originalGif);

    const recipePath = path.join(temp, "recipe.json"), cliOut = path.join(temp, "cli");
    await fs.writeFile(recipePath, JSON.stringify(recipe));
    const cli = JSON.parse(execFileSync(process.execPath, [path.join(root, "scripts/bake-art.mjs"), "--recipe", recipePath,
      "--out", cliOut, "--css", "--gif"], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 60000 }).trim());
    assert.equal(cli.identity, both.manifest.identity);
    const cliManifest = JSON.parse(await fs.readFile(path.join(cli.directory, "atlas.json"), "utf8"));
    assert.deepEqual(cliManifest.animations, both.manifest.animations);
    assert.deepEqual(cliManifest.stylesheet, both.manifest.stylesheet);
    for (const file of both.manifest.animations.clips)
      assert.deepEqual(await fs.readFile(path.join(cli.directory, file.path)), await fs.readFile(path.join(both.directory, file.path)));
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test("GIF validation, empty clips, CLI syntax and pre-abort leave no output", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "grout-art-gif-invalid-"));
  try {
    const recipe = createTravelerRecipe(), output = path.join(temp, "api-invalid");
    await assert.rejects(bakeArt({ recipe, output, includeGif: "yes" }), /includeGif must be boolean/);
    assert.equal(await exists(output), false);
    await assert.rejects(bakeArt({ recipe, output, includeGif: true, signal: AbortSignal.abort(Error("GIF pre-abort")) }), /GIF pre-abort/);
    assert.equal(await exists(output), false);
    const empty = structuredClone(recipe); empty.clips = {};
    await assert.rejects(bakeArt({ recipe: empty, output, includeGif: true }), /no clips/);
    assert.equal(await exists(output), false);

    const recipePath = path.join(temp, "recipe.json"), untouched = path.join(temp, "cli-invalid");
    await fs.writeFile(recipePath, JSON.stringify(recipe));
    for (const args of [["--gif", "--gif"], ["--unknown"]]) {
      assert.throws(() => execFileSync(process.execPath, [path.join(root, "scripts/bake-art.mjs"), "--recipe", recipePath,
        "--out", untouched, ...args], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 10000 }));
      assert.equal(await exists(untouched), false);
    }
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test("active GIF bake cancellation removes the owned pending cache directory", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "grout-art-gif-cancel-"));
  try {
    const output = path.join(temp, "out"), controller = new AbortController();
    const pendingBake = bakeArt({ recipe: createTravelerRecipe(), output, includeGif: true, signal: controller.signal });
    let observedPending = false;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && !observedPending) {
      try { observedPending = (await fs.readdir(output)).some((name) => name.startsWith(".pending-")); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (!observedPending) await new Promise((resolve) => setTimeout(resolve, 2));
    }
    assert.ok(observedPending, "bake entered its owned pending directory");
    controller.abort(Error("cancel GIF pending bake"));
    await assert.rejects(pendingBake, /cancel GIF pending bake/);
    assert.equal((await fs.readdir(output)).some((name) => name.startsWith(".pending-")), false);
    assert.deepEqual(await fs.readdir(output), []);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
