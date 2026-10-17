import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  parseRecipe,
  createTravelerRecipe,
  getTravelerWardrobe,
  setTravelerWardrobe,
  TRAVELER_CLOTHING,
  TRAVELER_HATS,
  TRAVELER_PALETTES,
  refineTravelerWalk,
  createExampleRecipe,
  renderFrame,
  buildArtExport,
  buildAtlas,
  extractFrame,
  editPixel,
  floodFill,
  moveSelection,
  copy,
  compileShader,
  measureRecipe,
  createRenderer,
} from "../packages/grout-art/index.mjs";
import { bakeArt, ART_SOURCE_PATHS } from "./bake-art.mjs";
import {
  ART_WORKBENCH_EXAMPLES,
  GROUT_LIBRARY_EXAMPLES,
  GROUT_LIBRARY_EXAMPLE_GROUPS,
} from "../src/art/examples.mjs";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const at = (p, x, y) => [...p.data.subarray((x + y * p.width) * 4, (x + y * p.width) * 4 + 4)];
function decodePng(bytes) {
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20),
    idat = [];
  for (let p = 8; p < bytes.length;) {
    const size = bytes.readUInt32BE(p);
    if (bytes.toString("ascii", p + 4, p + 8) === "IDAT")
      idat.push(bytes.subarray(p + 8, p + 8 + size));
    p += size + 12;
  }
  const rows = inflateSync(Buffer.concat(idat)),
    data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    assert.equal(rows[y * (width * 4 + 1)], 0);
    data.set(rows.subarray(y * (width * 4 + 1) + 1, (y + 1) * (width * 4 + 1)), y * width * 4);
  }
  return { width, height, data };
}
test("new recipe parser rejects legacy input, bad graph references, cycles and missing portable code", () => {
  const r = createTravelerRecipe();
  assert.deepEqual(parseRecipe(JSON.stringify(r)), r);
  for (const change of [
    (r) => (r.format = "grout"),
    (r) => (r.width = 0),
    (r) => (r.seed = -1),
    (r) => (r.frames[1].name = r.frames[0].name),
    (r) => (r.frames[0].order = ["body"]),
    (r) => (r.parts.loop = [{ op: "use", part: "loop" }]),
    (r) => (r.layers[0].part = "missing"),
    (r) => (r.parts["bag-south"] = [{ op: "use", part: "bag-south" }]),
  ]) {
    const bad = copy(r);
    change(bad);
    if (bad.parts.loop) {
      bad.layers[0].part = "loop";
    }
    assert.throws(() => parseRecipe(bad));
  }
  const custom = createExampleRecipe("custom-technique");
  custom.techniques[0].wgsl = "";
  assert.throws(() => parseRecipe(custom), /GLSL and WGSL/);
  const bad = createExampleRecipe("geometry");
  bad.parts.study.push({ op: "technique", id: "missing" });
  assert.throws(() => parseRecipe(bad), /Missing technique/);
});
test("traveler has 12 distinct native frames, deliberate palette roles, anchors and direction order", () => {
  const r = createTravelerRecipe(),
    hashes = new Set();
  assert.equal(r.frames.length, 12);
  assert.equal(r.layers.length, 4);
  assert.equal(Object.keys(r.palette).length, 14);
  assert.equal(
    new Set(Object.values(r.palette)).size,
    4,
    "NES-inspired starter uses four actual colors with editable semantic roles",
  );
  for (let i = 0; i < 12; i++) {
    const p = renderFrame(r, i);
    assert.equal(p.width, 16);
    assert.equal(p.height, 16);
    hashes.add(sha(p.data));
    assert.deepEqual(r.frames[i].anchor, [8, 15]);
    for (let at = 3; at < p.data.length; at += 4) assert.ok(p.data[at] === 0 || p.data[at] === 255);
  }
  assert.equal(hashes.size, 12);
  assert.notDeepEqual(r.frames[0].order, r.frames[9].order);
  for (const frame of [1, 2, 10, 11]) {
    const p = renderFrame(r, frame);
    let planted = 0;
    for (let x = 0; x < 16; x++) planted += p.data[(x + 15 * 16) * 4 + 3] ? 1 : 0;
    assert.equal(
      planted,
      frame < 3 ? 3 : 2,
      "front toes and foreshortened rear heels have balanced soles",
    );
  }
  for (const dir of ["south", "west", "east", "north"]) {
    assert.equal(r.clips["walk-" + dir].fps, 8);
    assert.equal(r.clips["walk-" + dir].frames.length, 4);
  }
  for (const dir of ["west", "east"])
    for (const pose of [1, 2]) {
      const ops = r.parts[`body-${dir}-${pose}`],
        shoe = ops[3],
        arm = ops[4];
      const centerOf = (op, ink) => {
        const xs = [];
        op.rows.forEach((row) =>
          [...row].forEach((letter, x) => {
            if (ink.includes(letter)) xs.push(x + op.x);
          }),
        );
        return xs.reduce((a, b) => a + b, 0) / xs.length;
      };
      assert.ok(
        (centerOf(shoe, "bt") - 7.5) * (centerOf(arm, "s") - 7.5) < 0,
        "profile near hand and foot counter-swing",
      );
    }
});
test("traveler occludes the front backpack and keeps a closed dark contour with optional gear", () => {
  const r = createTravelerRecipe(),
    withoutBag = copy(r);
  withoutBag.layers.find((layer) => layer.id === "bag").visible = false;
  for (let i = 0; i < 12; i++) {
    const equipped = renderFrame(r, i),
      unequipped = renderFrame(withoutBag, i);
    if (r.frames[i].name.startsWith("south-"))
      assert.deepEqual(
        equipped.data,
        unequipped.data,
        "front-facing body completely occludes pack",
      );
    else assert.notDeepEqual(equipped.data, unequipped.data, "pack reads on sides and rear");
  }
  const outline = r.palette.outline.match(/[a-f\d]{2}/gi).map((hex) => parseInt(hex, 16));
  for (const cap of [true, false])
    for (const bag of [true, false]) {
      const variant = copy(r);
      variant.layers.find((layer) => layer.id === "cap").visible = cap;
      variant.layers.find((layer) => layer.id === "bag").visible = bag;
      for (let i = 0; i < 12; i++) {
        const p = renderFrame(variant, i);
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const pixel = at(p, x, y);
            if (!pixel[3] || pixel.slice(0, 3).every((v, c) => v === outline[c])) continue;
            for (const [dx, dy] of [
              [-1, 0],
              [1, 0],
              [0, -1],
              [0, 1],
            ]) {
              const nx = x + dx,
                ny = y + dy;
              assert.ok(
                nx >= 0 && nx < 16 && ny >= 0 && ny < 16 && at(p, nx, ny)[3] === 255,
                `${r.frames[i].name}: bare colored edge at ${x},${y}; cap=${cap}, bag=${bag}`,
              );
            }
          }
      }
    }
});
test("historical accepted pixels remain pinned; refinement changes only feet and centered pack", async () => {
  const baseline = JSON.parse(
      await fs.readFile(
        new URL("./fixtures/traveler-accepted-20261016.json", import.meta.url),
        "utf8",
      ),
    ),
    r = JSON.parse(
      await fs.readFile(
        new URL("./fixtures/traveler-wardrobe-20261016.json", import.meta.url),
        "utf8",
      ),
    );
  const refined = createTravelerRecipe();
  for (const [role, color] of Object.entries(baseline.palette))
    assert.equal(refined.palette[role], color);
  assert.deepEqual(refined.frames, r.frames);
  assert.deepEqual(refined.clips, r.clips);
  for (const f of r.frames) {
    const old = r.parts[f.layers.body.part],
      next = refined.parts[f.layers.body.part];
    assert.deepEqual(next.slice(0, 2), old.slice(0, 2), "head and hips unchanged");
    assert.deepEqual(next.slice(4), old.slice(4), "arms unchanged");
    assert.deepEqual(refined.parts[f.layers.cap.part], r.parts[f.layers.cap.part]);
    assert.deepEqual(refined.parts[f.layers.clothing.part], r.parts[f.layers.clothing.part]);
  }
  assert.deepEqual(r.palette, baseline.palette);
  assert.deepEqual(r.clips, baseline.clips);
  assert.deepEqual(
    r.frames.map((f, i) => ({
      name: f.name,
      anchor: f.anchor,
      sha256: sha(renderFrame(r, i).data),
    })),
    baseline.frames,
  );
});

test("36 apparel color combinations preserve anatomy, face, outlines, anchors and atlas reconstruction", () => {
  const base = createTravelerRecipe(),
    sheets = new Set();
  for (const { id: palette } of TRAVELER_PALETTES)
    for (const { id: clothing } of TRAVELER_CLOTHING)
      for (const { id: hat } of TRAVELER_HATS) {
        const r = createTravelerRecipe({ clothing, hat, palette });
        assert.deepEqual(getTravelerWardrobe(r), { clothing, hat, palette, walk: "refined" });
        assert.deepEqual(r.frames, base.frames);
        for (const role of [
          "outline",
          "hair",
          "skin",
          "skinShadow",
          "skinLight",
          "boot",
          "bootLight",
          "clothShadow",
        ])
          assert.equal(r.palette[role], base.palette[role]);
        assert.deepEqual(r.clips, base.clips);
        for (const f of r.frames)
          assert.deepEqual(r.parts[f.layers.body.part], base.parts[f.layers.body.part]);
        const kit = buildArtExport(r);
        sheets.add(sha(kit.sheet.data));
        for (let i = 0; i < 12; i++) {
          const pixels = renderFrame(r, i),
            original = renderFrame(base, i),
            bob = i % 3 === 0 ? -1 : 0;
          assert.deepEqual(extractFrame(kit.atlas, r.frames[i].name).data, pixels.data);
          for (let y = 7 + bob; y <= 9 + bob; y++)
            for (let x = 3; x <= 12; x++)
              assert.deepEqual(at(pixels, x, y), at(original, x, y), "face landmarks preserved");
        }
        for (const seed of [1204, 1215, 1233]) {
          r.seed = seed;
          assert.equal(
            sha(buildArtExport(r).sheet.data),
            sha(kit.sheet.data),
            "wardrobe is authored, not randomized",
          );
        }
        for (const cap of [true, false])
          for (const bag of [true, false]) {
            const variant = copy(r);
            variant.layers.find((l) => l.id === "cap").visible = cap;
            variant.layers.find((l) => l.id === "bag").visible = bag;
            for (let i = 0; i < 12; i++) {
              const p = renderFrame(variant, i);
              for (let y = 0; y < 16; y++)
                for (let x = 0; x < 16; x++) {
                  const pixel = at(p, x, y);
                  assert.ok(pixel[3] === 0 || pixel[3] === 255);
                  if (!pixel[3] || pixel.slice(0, 3).join() === "38,50,63") continue;
                  for (const [dx, dy] of [
                    [-1, 0],
                    [1, 0],
                    [0, -1],
                    [0, 1],
                  ])
                    assert.ok(
                      x + dx >= 0 &&
                        x + dx < 16 &&
                        y + dy >= 0 &&
                        y + dy < 16 &&
                        at(p, x + dx, y + dy)[3] === 255,
                      `${clothing}/${hat}/${i}: exposed color at ${x},${y}`,
                    );
                }
              if (i < 3)
                assert.deepEqual(
                  p.data,
                  renderFrame(
                    {
                      ...variant,
                      layers: variant.layers.map((l) =>
                        l.id === "bag" ? { ...l, visible: !bag } : l,
                      ),
                    },
                    i,
                  ).data,
                );
            }
          }
      }
  assert.equal(sheets.size, 36, "each combination is visibly distinct");
});

test("profile-foot candidate retains its separate decoded sheet baselines", async () => {
  const fixture = JSON.parse(await fs.readFile(new URL("./fixtures/traveler-profile-feet-20261016.json", import.meta.url), "utf8"));
  assert.equal(fixture.cases.length, 36);
  for (const {clothing,hat,palette,sheetSha256} of fixture.cases)
    assert.equal(sha(buildArtExport(createTravelerRecipe({clothing,hat,palette})).sheet.data),sheetSha256,`${clothing}/${hat}/${palette}`);
});

test("wardrobe switching preserves edited drafts and only replaces selected apparel", () => {
  let r = editPixel(createTravelerRecipe(), 1, "clothing", 7, 11, "hair");
  r.palette.cloth = "#123456";
  r.seed = 1215;
  r.layers[3].visible = false;
  const original = copy(r),
    next = setTravelerWardrobe(r, { hat: "trail" });
  assert.deepEqual(r, original, "input is immutable");
  assert.deepEqual(next.frames, r.frames, "painted corrections retained");
  assert.deepEqual(next.palette, r.palette);
  assert.equal(next.seed, 1215);
  assert.equal(next.layers[3].visible, false);
  assert.deepEqual(next.parts["coat-south"], r.parts["coat-south"]);
  assert.deepEqual(getTravelerWardrobe(next), {
    clothing: "coat",
    hat: "trail",
    palette: "custom",
    walk: "refined",
  });
  const custom = copy(next);
  custom.parts["coat-south"][0].rows[1] = ".ollllo.";
  assert.equal(getTravelerWardrobe(custom).clothing, "custom");
  assert.deepEqual(
    setTravelerWardrobe(custom, { hat: "round" }).parts["coat-south"],
    custom.parts["coat-south"],
  );
  assert.equal(getTravelerWardrobe(createExampleRecipe("geometry")), null);
  assert.throws(
    () => setTravelerWardrobe(createExampleRecipe("geometry"), { hat: "cap" }),
    /accepted traveler/,
  );
  for (const bad of [
    null,
    [],
    { hat: "missing" },
    { clothing: "constructor" },
    { hat: 4 },
    { extra: "cap" },
    { palette: "constructor" },
    { palette: "missing" },
  ])
    assert.throws(() => createTravelerRecipe(bad));
  assert.deepEqual(
    setTravelerWardrobe(createTravelerRecipe({ clothing: "tunic", hat: "trail" }), {
      clothing: "coat",
      hat: "cap",
    }),
    createTravelerRecipe(),
  );
});

test("palettes isolate apparel; previous drafts upgrade explicitly without losing edits", async () => {
  const old = JSON.parse(
    await fs.readFile(
      new URL("./fixtures/traveler-wardrobe-20261016.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(getTravelerWardrobe(old).walk, "previous");
  assert.equal(getTravelerWardrobe(old).palette, "fern");
  const original = copy(old);
  const colored = setTravelerWardrobe(old, { palette: "cinder" });
  assert.deepEqual(old, original);
  assert.deepEqual(colored.frames, old.frames);
  for (const f of old.frames)
    assert.deepEqual(colored.parts[f.layers.body.part], old.parts[f.layers.body.part]);
  assert.equal(getTravelerWardrobe(colored).walk, "previous");
  let edited = editPixel(colored, 1, "clothing", 0, 0, "cap");
  edited.seed = 1233;
  edited.layers[3].visible = false;
  const refined = refineTravelerWalk(edited);
  assert.deepEqual(refined.frames, edited.frames);
  assert.deepEqual(refined.palette, edited.palette);
  assert.deepEqual(refined.layers, edited.layers);
  assert.equal(refined.seed, 1233);
  assert.equal(getTravelerWardrobe(refined).walk, "refined");
  assert.deepEqual(refineTravelerWalk(refined), refined);
  const customPack = copy(old);
  customPack.parts["bag-north"][0].rows[1] = "bbtbb";
  assert.deepEqual(
    refineTravelerWalk(customPack).parts["bag-north"],
    customPack.parts["bag-north"],
  );
  // Old tunic/vest ink references migrate only on an explicit colorway choice.
  const oldTunic = createTravelerRecipe({ clothing: "tunic" });
  for (const dir of ["south", "west", "east", "north"]) {
    oldTunic.parts["coat-" + dir][0].ink.p = "skinLight";
    oldTunic.parts["coat-" + dir][0].ink.v = "hair";
  }
  delete oldTunic.palette.tunic;
  delete oldTunic.palette.vest;
  const migrated = setTravelerWardrobe(oldTunic, { palette: "harbor" });
  assert.equal(migrated.parts["coat-south"][0].ink.p, "tunic");
  assert.equal(migrated.palette.skinLight, oldTunic.palette.skinLight);
  for (const { id: palette } of TRAVELER_PALETTES) {
    const r = createTravelerRecipe({ palette });
    const pack = copy(r);
    pack.layers.forEach((l) => (l.visible = l.id === "bag"));
    for (const frame of [9, 10, 11]) {
      const p = renderFrame(pack, frame);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 8; x++)
          assert.deepEqual(
            at(p, x, y),
            at(p, 15 - x, y),
            "rear pack is centered on the same axis as the torso",
          );
    }
    for (const frame of [0, 9]) {
      const p = renderFrame(r, frame);
      for (let y = 14; y < 16; y++)
        for (let x = 0; x < 8; x++)
          assert.deepEqual(
            at(p, x, y),
            at(p, 15 - x, y),
            "repeated passing pose does not favor one foot",
          );
    }
    const restored = setTravelerWardrobe(r, { palette: "fern" });
    assert.deepEqual(restored, createTravelerRecipe());
  }
});

test("palette slot zero is opaque color; empty coverage remains separate", () => {
  const r = createExampleRecipe("geometry");
  r.palette = { black: "#000000" };
  r.parts.study = [{ op: "rect", x: 0, y: 0, w: 1, h: 1, role: "black" }];
  const p = renderFrame(r);
  assert.deepEqual(at(p, 0, 0), [0, 0, 0, 255]);
  assert.deepEqual(at(p, 1, 0), [0, 0, 0, 0]);
});
test("native mask, clip, outline, mirror and integer transforms retain known coordinates", () => {
  const r = createExampleRecipe("geometry");
  r.parts = {
    dot: [{ op: "rect", x: 1, y: 1, w: 1, h: 1, role: "skin" }],
    study: [
      { op: "outline", part: "dot", role: "outline" },
      { op: "use", part: "dot", x: 5, y: 2 },
      {
        op: "clip",
        x: 9,
        y: 0,
        w: 1,
        h: 4,
        ops: [{ op: "rect", x: 8, y: 0, w: 4, h: 4, role: "accent" }],
      },
      { op: "use", part: "dot", x: 0, y: 6, width: 4, height: 4, flipX: true, scale: 2 },
    ],
  };
  const p = renderFrame(r);
  assert.equal(at(p, 1, 1)[3], 0);
  assert.equal(at(p, 1, 0)[3], 255);
  assert.equal(at(p, 6, 3)[3], 255);
  assert.equal(at(p, 8, 1)[3], 0);
  assert.equal(at(p, 9, 1)[3], 255);
  assert.equal(at(p, 4, 8)[3], 255);
});
test("CPU seed, equipment and palette matrix is deterministic and keeps color-independent alpha", () => {
  for (const seed of [1204, 1215, 1233])
    for (const cap of [true, false])
      for (const bag of [true, false]) {
        const r = createTravelerRecipe();
        r.seed = seed;
        r.layers.find((l) => l.id === "cap").visible = cap;
        r.layers.find((l) => l.id === "bag").visible = bag;
        for (let i = 0; i < 12; i++) {
          const a = renderFrame(r, i),
            b = renderFrame(r, i);
          assert.deepEqual(a, b);
          const variant = copy(r);
          variant.palette.cloth = "#46647d";
          const c = renderFrame(variant, i);
          for (let p = 3; p < a.data.length; p += 4) assert.equal(a.data[p], c.data[p]);
        }
      }
  const r = createExampleRecipe("variations"),
    a = renderFrame(r);
  r.seed++;
  assert.notEqual(sha(a.data), sha(renderFrame(r).data));
});
test("portable custom technique validates ranges and generated shaders contain executable geometry", () => {
  const r = createExampleRecipe("custom-technique"),
    base = sha(renderFrame(r).data);
  r.parts.study[1].ops[0].params.spacing = 5;
  assert.notEqual(sha(renderFrame(r).data), base);
  r.parts.study[1].ops[0].params.spacing = 0;
  assert.throws(() => parseRecipe(r), /spacing/);
  for (const backend of ["webgl2", "webgpu"]) {
    const shader = compileShader(createExampleRecipe("geometry"), 0, backend);
    assert.match(shader, /color=/);
    assert.doesNotMatch(shader, /textureSample|texelFetch/);
  }
});
test("paint, erase, flood fill and move selection affect their intended frame/layer only", () => {
  const base = createTravelerRecipe(),
    original = sha(renderFrame(base, 1).data),
    painted = editPixel(base, 0, "cap", 0, 0, "skin");
  assert.equal(at(renderFrame(painted), 0, 0)[3], 255);
  assert.equal(sha(renderFrame(painted, 1).data), original);
  assert.equal(at(renderFrame(base), 0, 0)[3], 0);
  const erased = editPixel(painted, 0, "cap", 0, 0, null);
  assert.deepEqual(at(renderFrame(erased), 0, 0), [0, 0, 0, 0]);
  const filled = floodFill(base, 0, "cap", 0, 0, "accent");
  assert.equal(at(renderFrame(filled), 0, 0)[3], 255);
  const moved = moveSelection(painted, 0, "cap", { x: 0, y: 0, w: 1, h: 1 }, 1, 1);
  assert.equal(at(renderFrame(moved), 0, 0)[3], 0);
  assert.equal(at(renderFrame(moved), 1, 1)[3], 255);
  assert.throws(() => editPixel(base, 99, "cap", 0, 0, "skin"), /edit.frame/);
  assert.throws(() => floodFill(base, 0, "missing", 0, 0, "skin"), /Unknown paint layer/);
  assert.throws(() => floodFill(base, 0, "cap", -1, 0, "skin"), /fill.x/);
  const shifted = copy(base);
  shifted.frames[0].layers.cap.offset = [2, -1];
  const worldPaint = editPixel(shifted, 0, "cap", 0, 0, "skin");
  assert.equal(at(renderFrame(worldPaint), 0, 0)[3], 255);
  const worldMoved = moveSelection(worldPaint, 0, "cap", { x: 0, y: 0, w: 1, h: 1 }, 1, 1);
  assert.equal(at(renderFrame(worldMoved), 0, 0)[3], 0);
  assert.equal(at(renderFrame(worldMoved), 1, 1)[3], 255);
  assert.throws(
    () => moveSelection(base, 0, "cap", { x: 0, y: 0, w: 1e9, h: 1 }, 1, 1),
    /selection.w/,
  );
});
test("catalog binds all donor references and exposes only working original local recipes", () => {
  assert.equal(GROUT_LIBRARY_EXAMPLES.length, 61);
  assert.equal(GROUT_LIBRARY_EXAMPLE_GROUPS.length, 13);
  assert.equal(ART_WORKBENCH_EXAMPLES.length, 6);
  assert.equal(new Set(GROUT_LIBRARY_EXAMPLES.map((e) => e.sourcePath)).size, 61);
  for (const example of GROUT_LIBRARY_EXAMPLES) {
    assert.equal(example.sourceCommit, "34016ee");
    assert.ok(GROUT_LIBRARY_EXAMPLE_GROUPS.some((g) => g.id === example.primaryGroup));
    assert.ok(example.tags.length && example.backends.length && example.provenance);
    assert.ok(["partial", "source-only"].includes(example.migration));
    if (example.localExampleId)
      assert.ok(ART_WORKBENCH_EXAMPLES.some((e) => e.id === example.localExampleId));
  }
  for (const example of ART_WORKBENCH_EXAMPLES)
    assert.ok(renderFrame(createExampleRecipe(example.id)).data.some(Boolean));
});
test("atlas pages, cutouts, extrusion, source sizes and anchors reconstruct every frame exactly", () => {
  const r = createTravelerRecipe(),
    kit = buildArtExport(r, { atlas: { maxWidth: 24, maxHeight: 24 } });
  assert.ok(kit.atlas.pages.length > 1);
  assert.equal(kit.sheet.width, 48);
  assert.equal(kit.sheet.height, 64);
  assert.equal(kit.manifest.visualReview, "unapproved");
  assert.equal(kit.phaser.textures.length, kit.atlas.pages.length);
  for (const frame of kit.frames) {
    assert.deepEqual(extractFrame(kit.atlas, frame.name), {
      width: 16,
      height: 16,
      data: frame.data,
    });
    const record = kit.atlas.frames.find((f) => f.name === frame.name),
      page = kit.atlas.pages[record.pageIndex];
    assert.deepEqual(record.pivot, { x: 8, y: 15 });
    assert.deepEqual(
      [
        ...page.rgba.subarray(
          (record.x - 1 + record.y * page.width) * 4,
          (record.x + record.y * page.width) * 4,
        ),
      ],
      [
        ...page.rgba.subarray(
          (record.x + record.y * page.width) * 4,
          (record.x + record.y * page.width) * 4 + 4,
        ),
      ],
    );
  }
  const data = new Uint8Array(16);
  assert.throws(() => buildAtlas([{ name: "__proto__", width: 2, height: 2, data }]), /Unsafe/);
  assert.throws(
    () =>
      buildAtlas([
        { name: "a", width: 2, height: 2, data },
        { name: "a", width: 2, height: 2, data },
      ]),
    /duplicated/,
  );
});
test("compactness reports actual recipe, PNG, raster and shared source bundle costs honestly", async () => {
  const r = createTravelerRecipe(),
    runtimeSources = await Promise.all(
      ART_SOURCE_PATHS.map((p) => fs.readFile(new URL("../" + p, import.meta.url), "utf8")),
    ),
    m = await measureRecipe(r, { runtimeSources });
  assert.ok(m.readableBytes > m.compactBytes);
  assert.ok(m.gzipBytes < m.compactBytes);
  assert.ok(m.expandedBytes > m.compactBytes);
  assert.equal(m.rasterBytes, 12 * 16 * 16 * 4);
  assert.ok(m.pngBytes > 100);
  assert.equal(m.bundleBytes, m.runtimeBytes + m.compactBytes);
  assert.ok(m.bundleGzipBytes > m.gzipBytes);
  assert.equal(m.representations.length, 4);
  assert.equal(m.packedPngBundleBytes, m.pngBytes + m.atlasMetadataBytes);
});
test("SDK headless renderer has no DOM dependency, rejects cancellation and disposes", async () => {
  const renderer = await createRenderer({ backend: "cpu" }),
    r = createTravelerRecipe();
  assert.equal((await renderer.render(r)).backend, "cpu");
  await assert.rejects(
    renderer.render(r, 0, { signal: AbortSignal.abort(Error("cancelled")) }),
    /cancelled/,
  );
  renderer.dispose();
  await assert.rejects(renderer.render(r), /disposed/);
});
test("active CPU work yields for cancellation and disposal before publishing pixels", async () => {
  const r = createExampleRecipe("geometry");
  r.width = 128;
  r.height = 128;
  const renderer = await createRenderer({ backend: "cpu" }),
    controller = new AbortController();
  const active = renderer.render(r, 0, { signal: controller.signal });
  setTimeout(() => controller.abort(Error("active cancellation")), 4);
  await assert.rejects(active, /active cancellation/);
  const pending = renderer.render(r);
  setTimeout(() => renderer.dispose(), 4);
  await assert.rejects(pending, /disposed/);
});
test("source-bound CLI cache verifies PNG pixels, metadata, tampering and cancellation", async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "grout-art-bake-"));
  try {
    const r = createTravelerRecipe(),
      baked = await bakeArt({ recipe: r, output }),
      kit = buildArtExport(r);
    assert.equal(baked.reused, false);
    assert.equal((await bakeArt({ recipe: r, output })).reused, true);
    assert.equal(baked.manifest.format, "grout-atlas/1");
    assert.deepEqual(baked.manifest.sources.map(source => source.path), [
      ...ART_SOURCE_PATHS, "scripts/bake-art.mjs", "scripts/material-png.mjs",
    ]);
    assert.ok(baked.manifest.sources.some(source => source.path === "packages/grout-art/components.mjs"));
    const png = decodePng(await fs.readFile(path.join(baked.directory, "sheet.png")));
    assert.deepEqual(png, kit.sheet);
    const manifest = path.join(baked.directory, "atlas.json"),
      bytes = await fs.readFile(manifest);
    await fs.writeFile(manifest, bytes.toString().replace("unapproved", "approved!!"));
    await assert.rejects(bakeArt({ recipe: r, output }), /differs/);
    await fs.writeFile(manifest, bytes);
    await assert.rejects(
      bakeArt({ recipe: r, output, signal: AbortSignal.abort(Error("cancelled")) }),
      /cancelled/,
    );
    assert.ok(!(await fs.readdir(output)).some((n) => n.startsWith(".pending-")));
  } finally {
    await fs.rm(output, { recursive: true, force: true });
  }
});
