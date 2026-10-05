import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  HELD_IDS,
  KEEP_IDS,
  LOOK_STRIP_IDS,
  LOOK_STRIP_LOOKS,
  RECIPE,
  corpusJobs,
} from "./bake-corpus.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(buf) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_MAGIC)) return null;
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function walkPngs(dir, prefix) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(abs).isDirectory()) out.push(...walkPngs(abs, rel));
    else if (name.endsWith(".png")) out.push(rel);
  }
  return out;
}

test("corpus jobs are the 45 keep plus the 12-file look strip", () => {
  const jobs = corpusJobs();
  assert.equal(jobs.length, 57);
  assert.equal(KEEP_IDS.length, 45);
  assert.deepEqual(
    jobs.slice(0, 45).map((job) => job.id),
    KEEP_IDS,
  );
  for (const job of jobs.slice(0, 45)) {
    assert.equal(job.look, "pixel");
    assert.equal(job.pixels, 32);
  }
  const strip = jobs.slice(45);
  assert.deepEqual(
    strip.map((job) => `${job.look}/${job.id}`),
    LOOK_STRIP_IDS.flatMap((id) => LOOK_STRIP_LOOKS.map((look) => `${look}/${id}`)),
  );
  for (const job of strip) assert.equal(job.pixels, 0);
  for (const job of jobs) {
    assert.equal(job.exportSize, RECIPE.exportSize);
    assert.equal(job.palette, "style");
    assert.equal(job.seed, 1204);
    assert.equal(job.scale, 1);
    assert.equal(job.wear, 0.35);
    assert.equal(job.time, 0);
    assert.equal(job.repeat, 1);
    assert.equal(HELD_IDS.includes(job.id), false);
  }
  assert.deepEqual(HELD_IDS, ["concrete", "rust", "ice"]);
});

test("committed corpus matches the manifest and the subway example path", () => {
  const manifestPath = join(root, "public/textures/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.format, "grout-corpus/1");
  assert.equal(manifest.sourceTip, "1c48c7c8e8b6ff5418e068f5ec97cf91b192c4b7");
  assert.equal(manifest.files.length, 57);

  const subway = manifest.files.find((file) => file.path === "textures/pixel/bond/subway.png");
  assert.deepEqual(subway, {
    id: "subway",
    name: "Subway Tile",
    category: "Bond",
    look: "pixel",
    pixels: 32,
    exportSize: 256,
    palette: "style",
    seed: 1204,
    scale: 1,
    wear: 0.35,
    repeat: 1,
    path: "textures/pixel/bond/subway.png",
  });

  const paths = manifest.files.map((file) => file.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const id of HELD_IDS) {
    assert.equal(
      manifest.files.some((file) => file.id === id),
      false,
      id,
    );
  }
  const pixel = manifest.files.filter((file) => file.look === "pixel");
  const strip = manifest.files.filter((file) => file.look !== "pixel");
  assert.equal(pixel.length, 45);
  assert.equal(strip.length, 12);
  for (const id of ["dirt", "mud", "ash", "peat", "snow", "asphalt", "erosion"]) {
    const file = manifest.files.find((item) => item.id === id && item.look === "pixel");
    assert.ok(file, id);
    assert.equal(file.category, "Ground");
    assert.equal(file.pixels, 32);
    assert.equal(file.path, `textures/pixel/ground/${id}.png`);
  }
  for (const id of ["plaster", "rebar"]) {
    const file = manifest.files.find((item) => item.id === id && item.look === "pixel");
    assert.ok(file, id);
    assert.equal(file.category, "Built");
    assert.equal(file.pixels, 32);
    assert.equal(file.path, `textures/pixel/built/${id}.png`);
  }
  for (const file of pixel) assert.equal(file.pixels, 32);
  for (const file of strip) assert.equal(file.pixels, 0);

  for (const file of manifest.files) {
    const abs = join(root, "public", file.path);
    const buf = readFileSync(abs);
    const size = pngSize(buf);
    assert.ok(size, file.path);
    assert.equal(size.width, 256, file.path);
    assert.equal(size.height, 256, file.path);
    assert.equal(file.path, `textures/${file.look}/${file.category.toLowerCase()}/${file.id}.png`);
  }

  assert.deepEqual(
    walkPngs(join(root, "public/textures")).sort(),
    paths.map((item) => item.slice("textures/".length)).sort(),
  );
  assert.equal(existsSync(join(root, "public/showcase")), false);
  assert.equal(existsSync(join(root, "public/corpus")), false);
});
