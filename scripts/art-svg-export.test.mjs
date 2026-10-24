import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { bakeArt } from "./bake-art.mjs";
import { createTravelerRecipe } from "../packages/grout-art/index.mjs";

test("SVG browser diagnostic capture never qualifies as completed download proof", () => {
  const selection = (...args) => JSON.parse(execFileSync(process.execPath, [path.resolve("scripts/test-art-svg-browser.mjs"), "--print-selection", ...args], { encoding: "utf8", windowsHide: true, stdio: "pipe" }));
  assert.deepEqual(selection("--dev"), {lane:"dev",qualification:true,downloadMethod:"completed-browser-download"});
  assert.deepEqual(selection("--dev","--diagnostic-blobs"), {lane:"dev-diagnostic",qualification:false,downloadMethod:"diagnostic-blob-capture"});
  for(const args of [["--mode","bad"],["--diagnostic-blobs","--diagnostic-blobs"],["--unknown"]])assert.throws(()=>selection(...args));
});

test("eight SVG/CSS/GIF bake choices preserve existing assets, isolate cache identities and match CLI output", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "grout-art-svg-export-"));
  try {
    const recipe = createTravelerRecipe(), output = path.join(temp, "api"), results = [];
    for (let bits = 0; bits < 8; bits++) results.push(await bakeArt({ recipe, output, includeCss: !!(bits & 1), includeGif: !!(bits & 2), includeSvg: !!(bits & 4) }));
    assert.equal(new Set(results.map(r => r.manifest.identity)).size, 8);
    for (let bits = 0; bits < 8; bits++) {
      const result = results[bits];
      assert.equal(!!result.manifest.vectors, !!(bits & 4));
      assert.equal(result.manifest.files.filter(f => f.path.endsWith(".svg")).length, bits & 4 ? 12 : 0);
      assert.equal((await bakeArt({ recipe, output, includeCss: !!(bits & 1), includeGif: !!(bits & 2), includeSvg: !!(bits & 4) })).reused, true);
      if (bits & 4) {
        assert.equal(result.manifest.vectors.format, "grout-art-svg/1");
        assert.ok(result.manifest.sources.some(s => s.path === "packages/grout-art/svg.mjs"));
        for (const frame of result.manifest.vectors.frames) assert.deepEqual(frame.anchor, recipe.frames.find(f => f.name === frame.name).anchor);
        const base = results[bits & 3];
        for (const file of base.manifest.files.filter(f => f.path !== "metrics.json"))
          assert.deepEqual(await fs.readFile(path.join(base.directory, file.path)), await fs.readFile(path.join(result.directory, file.path)), file.path);
      }
    }
    const both = results[7], frame = both.manifest.vectors.frames[0], target = path.join(both.directory, frame.path), bytes = await fs.readFile(target);
    await fs.writeFile(target, Buffer.from("tamper"));
    await assert.rejects(bakeArt({ recipe, output, includeCss: true, includeGif: true, includeSvg: true }), /differs/);
    await fs.writeFile(target, bytes);
    const recipePath = path.join(temp, "recipe.json"); await fs.writeFile(recipePath, JSON.stringify(recipe));
    const cli = JSON.parse(execFileSync(process.execPath, [path.resolve("scripts/bake-art.mjs"), "--recipe", recipePath, "--out", path.join(temp, "cli"), "--svg", "--css", "--gif"], { encoding: "utf8", windowsHide: true, timeout: 60000 }));
    assert.equal(cli.identity, both.manifest.identity);
    for (const file of both.manifest.vectors.frames)
      assert.deepEqual(await fs.readFile(path.join(cli.directory, file.path)), await fs.readFile(path.join(both.directory, file.path)));
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test("invalid SVG options, CLI syntax and pre-abort preserve absent output", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "grout-art-svg-invalid-"));
  try {
    const recipe = createTravelerRecipe(), output = path.join(temp, "out");
    await assert.rejects(bakeArt({ recipe, output, includeSvg: "yes" }), /includeSvg must be boolean/);
    await assert.rejects(bakeArt({ recipe, output, includeSvg: true, signal: AbortSignal.abort(Error("cancel SVG bake")) }), /cancel SVG bake/);
    const recipePath = path.join(temp, "recipe.json"); await fs.writeFile(recipePath, JSON.stringify(recipe));
    for (const flags of [["--svg", "--svg"], ["--svg", "false"], ["--unknown"]])
      assert.throws(() => execFileSync(process.execPath, [path.resolve("scripts/bake-art.mjs"), "--recipe", recipePath, "--out", output, ...flags], { stdio: "pipe", windowsHide: true }));
    await assert.rejects(fs.stat(output), { code: "ENOENT" });
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test("active SVG pending-bake cancellation releases scratch and preserves the preceding export", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "grout-art-svg-cancel-"));
  try {
    const recipe = createTravelerRecipe(), initial = await bakeArt({ recipe, output: temp });
    const original = await fs.readFile(path.join(initial.directory, "atlas.json"));
    const controller = new AbortController(), pending = bakeArt({ recipe, output: temp, includeSvg: true, signal: controller.signal });
    const deadline = Date.now() + 15000;
    while (!(await fs.readdir(temp)).some(name => name.startsWith(".pending-"))) {
      assert.ok(Date.now() < deadline, "owned pending output appears");
      await new Promise(resolve => setTimeout(resolve, 2));
    }
    controller.abort(Error("cancel SVG pending output")); await assert.rejects(pending, /cancel SVG pending output/);
    assert.deepEqual(await fs.readFile(path.join(initial.directory, "atlas.json")), original);
    assert.equal((await fs.readdir(temp)).some(name => name.startsWith(".pending-")), false);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
