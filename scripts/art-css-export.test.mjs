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

test("opt-in CSS API and CLI exports have isolated cache identities and preserve PNG assets", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "grout-art-css-export-"));
  try {
    const recipe = createTravelerRecipe(), output = path.join(temp, "api");
    const plain = await bakeArt({ recipe, output });
    assert.equal(plain.manifest.stylesheet, undefined);
    assert.ok(!plain.manifest.files.some((file) => file.path === "atlas.css"));
    const withCss = await bakeArt({ recipe, output, includeCss: true });
    assert.notEqual(withCss.manifest.identity, plain.manifest.identity);
    assert.notEqual(withCss.directory, plain.directory);
    assert.equal(withCss.manifest.stylesheet.format, "grout-art-css/1");
    assert.equal(withCss.manifest.stylesheet.path, "atlas.css");
    assert.ok(withCss.manifest.files.some((file) => file.path === "atlas.css"));
    assert.equal((await bakeArt({ recipe, output })).reused, true);
    assert.equal((await bakeArt({ recipe, output, includeCss: true })).reused, true);
    for (const file of plain.manifest.files.filter((entry) => entry.path.endsWith(".png"))) {
      assert.deepEqual(await fs.readFile(path.join(plain.directory, file.path)), await fs.readFile(path.join(withCss.directory, file.path)), file.path);
    }
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(plain.directory, "recipe.json"), "utf8")),
      JSON.parse(await fs.readFile(path.join(withCss.directory, "recipe.json"), "utf8")));

    const cssPath = path.join(withCss.directory, "atlas.css"), cssBytes = await fs.readFile(cssPath);
    await fs.writeFile(cssPath, Buffer.from("tampered"));
    await assert.rejects(bakeArt({ recipe, output, includeCss: true }), /differs/);
    await fs.writeFile(cssPath, cssBytes);

    const recipePath = path.join(temp, "recipe.json"), cliOut = path.join(temp, "cli");
    await fs.writeFile(recipePath, JSON.stringify(recipe));
    const cli = JSON.parse(execFileSync(process.execPath, [path.join(root, "scripts/bake-art.mjs"), "--recipe", recipePath, "--out", cliOut, "--css"],
      { cwd: root, encoding: "utf8", windowsHide: true, timeout: 60000 }).trim());
    assert.equal(cli.identity, withCss.manifest.identity);
    assert.deepEqual(await fs.readFile(path.join(cli.directory, "atlas.css")), cssBytes);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(cli.directory, "atlas.json"), "utf8")).stylesheet, withCss.manifest.stylesheet);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test("CSS option validation, CLI syntax failures and pre-abort do not create output", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "grout-art-css-invalid-"));
  try {
    const recipe = createTravelerRecipe(), output = path.join(temp, "api-invalid");
    await assert.rejects(bakeArt({ recipe, output, includeCss: "yes" }), /includeCss must be boolean/);
    assert.equal(await fs.stat(output).then(() => true, () => false), false);
    await assert.rejects(bakeArt({ recipe, output, includeCss: true, signal: AbortSignal.abort(Error("CSS pre-abort")) }), /CSS pre-abort/);
    assert.equal(await fs.stat(output).then(() => true, () => false), false);

    const recipePath = path.join(temp, "recipe.json"), untouched = path.join(temp, "cli-invalid");
    await fs.writeFile(recipePath, JSON.stringify(recipe));
    for (const args of [["--css", "--css"], ["--unknown"]]) {
      assert.throws(() => execFileSync(process.execPath, [path.join(root, "scripts/bake-art.mjs"), "--recipe", recipePath,
        "--out", untouched, ...args], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 10000 }));
      assert.equal(await fs.stat(untouched).then(() => true, () => false), false);
    }
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test("cancellation after pending-directory creation cleans the owned cache attempt", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "grout-art-css-cancel-"));
  try {
    const output = path.join(temp, "out"), controller = new AbortController();
    const pendingBake = bakeArt({ recipe: createTravelerRecipe(), output, includeCss: true, signal: controller.signal });
    let observedPending = false;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && !observedPending) {
      try { observedPending = (await fs.readdir(output)).some((name) => name.startsWith(".pending-")); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (!observedPending) await new Promise((resolve) => setTimeout(resolve, 2));
    }
    assert.ok(observedPending, "bake entered its owned pending directory");
    controller.abort(Error("cancel CSS pending bake"));
    await assert.rejects(pendingBake, /cancel CSS pending bake/);
    assert.equal((await fs.readdir(output)).some((name) => name.startsWith(".pending-")), false);
    assert.deepEqual(await fs.readdir(output), []);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
