import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRecipe,
  renderFrame,
  importSpriteLayers,
  buildArtExport,
  extractFrame,
  copy,
  editPixel,
  floodFill,
  moveSelection,
  createRenderer,
} from "../packages/grout-art/index.mjs";
const settings = { enabled: true, color: "#102030", width: 1, corners: "stepped" };
const point = (x = 5, y = 5) => ({
  format: "grout-art/1",
  name: "Outline test",
  width: 11,
  height: 11,
  seed: 1204,
  palette: { ink: "#ff0000" },
  parts: { dot: [{ op: "rect", x, y, w: 1, h: 1, role: "ink" }] },
  layers: [{ id: "base", name: "Base", part: "dot", visible: true }],
  frames: [{ name: "idle", anchor: [5, 10] }],
  clips: { idle: { frames: ["idle"], fps: 8 } },
  techniques: [],
});
const color = (p, x, y) => [...p.data.subarray((y * p.width + x) * 4, (y * p.width + x + 1) * 4)];
test("composite outline has exact stepped/square width and never replaces opaque source colors", () => {
  for (const corners of ["stepped", "square"])
    for (const width of [1, 2, 3]) {
      const r = { ...point(), outline: { ...settings, width, corners } },
        p = renderFrame(r);
      let count = 0;
      for (let y = 0; y < 11; y++)
        for (let x = 0; x < 11; x++) {
          const dx = Math.abs(x - 5),
            dy = Math.abs(y - 5),
            covered = corners === "stepped" ? dx + dy <= width : Math.max(dx, dy) <= width;
          assert.deepEqual(
            color(p, x, y),
            x === 5 && y === 5 ? [255, 0, 0, 255] : covered ? [16, 32, 48, 255] : [0, 0, 0, 0],
          );
          if (p.data[(y * 11 + x) * 4 + 3]) count++;
        }
      assert.equal(
        count,
        corners === "stepped" ? 1 + 2 * width * (width + 1) : (2 * width + 1) ** 2,
      );
    }
});
test("outline follows visible composed layers, frame patches and holes without changing layers or clips", () => {
  const r = point();
  r.palette.blue = "#0000ff";
  r.parts.cover = [{ op: "rect", x: 4, y: 4, w: 3, h: 3, role: "blue" }];
  r.layers.push({ id: "top", name: "Top", part: "cover", visible: true });
  r.frames.push(
    {
      name: "step",
      anchor: [5, 10],
      layers: {
        top: { offset: [2, 0], ops: [{ op: "rect", x: 5, y: 5, w: 1, h: 1, role: null }] },
      },
    },
    { name: "hidden", anchor: [5, 10], layers: { top: { visible: false } } },
  );
  r.clips.walk = { frames: ["idle", "step", "hidden", "step"], fps: 4 };
  const original = parseRecipe(r),
    outlined = parseRecipe({ ...r, outline: settings });
  for (const key of ["parts", "layers", "frames", "clips", "palette"])
    assert.deepEqual(outlined[key], original[key]);
  for (let i = 0; i < 3; i++) {
    const source = renderFrame(original, i),
      p = renderFrame(outlined, i);
    for (let y = 0; y < 11; y++)
      for (let x = 0; x < 11; x++) {
        if (color(source, x, y)[3]) assert.deepEqual(color(p, x, y), color(source, x, y));
        else {
          const adjacent = [
            [x - 1, y],
            [x + 1, y],
            [x, y - 1],
            [x, y + 1],
          ].some(([a, b]) => a >= 0 && b >= 0 && a < 11 && b < 11 && color(source, a, b)[3]);
          assert.deepEqual(color(p, x, y), adjacent ? [16, 32, 48, 255] : [0, 0, 0, 0]);
        }
      }
  }
  assert.deepEqual(
    renderFrame({ ...outlined, outline: { ...settings, enabled: false } }),
    renderFrame(original),
  );
});
test("outline clips to the frame; off-canvas geometry never leaks in; empty/solid frames remain exact", () => {
  const edge = renderFrame({ ...point(0, 0), outline: settings });
  assert.equal([...edge.data].filter((_, i) => i % 4 === 3).filter(Boolean).length, 3);
  const outside = point(-1, 5);
  assert.deepEqual(renderFrame({ ...outside, outline: settings }), renderFrame(outside));
  const solid = point();
  solid.parts.dot[0] = { op: "rect", x: 0, y: 0, w: 11, h: 11, role: "ink" };
  assert.deepEqual(renderFrame({ ...solid, outline: settings }), renderFrame(solid));
});
test("painting, fill and selection operate on original layers while outline stays reversible", () => {
  const source = parseRecipe(point()),
    outlined = { ...source, outline: settings };
  for (const edit of [
    (r) => editPixel(r, 0, "base", 5, 5, null),
    (r) => floodFill(r, 0, "base", 4, 5, "ink"),
    (r) => moveSelection(r, 0, "base", { x: 4, y: 4, w: 3, h: 3 }, 2, 0),
  ]) {
    const a = edit(source),
      b = edit(outlined);
    assert.deepEqual(b.frames, a.frames);
    assert.deepEqual(b.parts, a.parts);
    assert.deepEqual(b.outline, settings);
    delete b.outline;
    assert.deepEqual(b, a);
  }
});
test("animated imported layers export baked borders and reconstruct with source anchors and clip timing intact", async () => {
  const frames = [0, 1].map((t) => {
    const data = new Uint8Array(8 * 8 * 4);
    data.set([255, 100, 20, 255], (3 + t + 3 * 8) * 4);
    return { width: 8, height: 8, data };
  });
  const r = await importSpriteLayers([
    { name: "Paint", frames, durationsMs: [250, 500] },
    { name: "Overlay", frames: [frames[0]] },
  ]);
  const outlined = { ...r, outline: { ...settings, width: 2, corners: "square" } },
    kit = buildArtExport(outlined);
  assert.deepEqual(kit.recipe.layers, r.layers);
  assert.deepEqual(kit.recipe.frames, r.frames);
  assert.deepEqual(kit.recipe.clips, r.clips);
  assert.deepEqual(kit.recipe.parts, r.parts);
  assert.equal(kit.manifest.outline.baked, true);
  assert.equal(kit.manifest.outline.bounds, "source-frame");
  for (const [i, f] of kit.frames.entries())
    assert.deepEqual([...extractFrame(kit.atlas, f.name).data], [...renderFrame(outlined, i).data]);
  assert.equal(buildArtExport(r).manifest.outline, undefined);
});
test("invalid outline settings fail before rendering and old recipes stay unchanged", () => {
  for (const patch of [
    { width: 0 },
    { width: 4 },
    { width: 1.5 },
    { enabled: "true" },
    { color: "#123" },
    { color: "red" },
    { corners: "round" },
    { extra: 1 },
  ])
    assert.throws(() => parseRecipe({ ...point(), outline: { ...settings, ...patch } }), /outline/);
  for (const outline of [null, [], true])
    assert.throws(() => parseRecipe({ ...point(), outline }), /outline/);
  const r = parseRecipe(point());
  assert.equal(r.outline, undefined);
  assert.deepEqual(parseRecipe(copy(r)), r);
});
test("CPU outline preview retains cooperative cancellation and source identity", async () => {
  const renderer = await createRenderer({ backend: "cpu" }),
    r = { ...point(), outline: settings };
  try {
    assert.deepEqual((await renderer.render(r)).data, renderFrame(r).data);
    const controller = new AbortController();
    const pending = renderer.render(r, 0, { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
  } finally {
    renderer.dispose();
  }
});
