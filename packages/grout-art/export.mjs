import { parseRecipe, renderFrame } from "./core.mjs";
import { buildRgbaAtlas, extractAtlasFrameRgba, exportPhaserAtlasMetadata } from "./atlas.mjs";
import { compileCharacter } from "./character.mjs";
export function buildAtlas(frames, options = {}) {
  for (const f of frames)
    if (
      typeof f.name !== "string" ||
      !/^[-a-zA-Z0-9_]{1,80}$/.test(f.name) ||
      ["__proto__", "constructor", "prototype"].includes(f.name)
    )
      throw Error("Unsafe atlas frame name");
  return buildRgbaAtlas(
    frames.map((f) => ({
      name: f.name,
      width: f.width,
      height: f.height,
      rgba: f.data,
      pivot: f.anchor ? { x: f.anchor[0], y: f.anchor[1] } : undefined,
    })),
    { trim: true, padding: 1, extrude: 1, maxWidth: 1024, maxHeight: 1024, ...options },
  );
}
export function extractFrame(atlas, name, restoreTrim = true) {
  const p = extractAtlasFrameRgba(atlas, name);
  if (!restoreTrim) return { width: p.width, height: p.height, data: new Uint8Array(p.rgba) };
  const f = p.frame,
    data = new Uint8Array(f.sourceWidth * f.sourceHeight * 4);
  for (let y = 0; y < p.height; y++)
    data.set(
      p.rgba.subarray(y * p.width * 4, (y + 1) * p.width * 4),
      ((y + f.trim.y) * f.sourceWidth + f.trim.x) * 4,
    );
  return { width: f.sourceWidth, height: f.sourceHeight, data };
}
export function buildArtExport(input, { signal, atlas: options } = {}) {
  if (input.character) {
    const expected = compileCharacter(input.character);
    for (const key of ["name","width","height","seed","palette","parts","layers","frames","clips","outline"])
      if (JSON.stringify(input[key]) !== JSON.stringify(expected[key])) throw Error("Character source and resolved recipe differ; capture your edits or compile the creator before exporting");
  }
  const recipe = parseRecipe(input),
    frames = recipe.frames.map((f, i) => {
      signal?.throwIfAborted();
      return { ...renderFrame(recipe, i), name: f.name, anchor: f.anchor };
    }),
    atlas = buildAtlas(frames, { ...options, shouldCancel: () => !!signal?.aborted });
  const columns = 3,
    rows = Math.ceil(frames.length / columns),
    sheet = {
      width: recipe.width * columns,
      height: recipe.height * rows,
      data: new Uint8Array(recipe.width * columns * recipe.height * rows * 4),
    };
  for (let i = 0; i < frames.length; i++)
    for (let y = 0; y < recipe.height; y++)
      sheet.data.set(
        frames[i].data.subarray(y * recipe.width * 4, (y + 1) * recipe.width * 4),
        ((Math.floor(i / columns) * recipe.height + y) * sheet.width +
          (i % columns) * recipe.width) *
          4,
      );
  const manifest = {
    format: "grout-atlas/1",
    generator: "grout-art/1.0.0",
    recipeFormat: recipe.format,
    name: recipe.name,
    seed: recipe.seed,
    visualReview: "unapproved",
    ...(recipe.character ? { character: { format: recipe.character.format, creator: recipe.character.creator.id, build: recipe.character.build, style: recipe.character.style, mode: recipe.character.mode, source: "character.json", definition: "creator.json" } } : {}),
    alpha: "straight-rgba8-cutout",
    sampling: { filter: "nearest", mipmaps: false },
    sourceSize: { width: recipe.width, height: recipe.height },
    pages: atlas.pages.map((p) => ({
      index: p.index,
      path: `atlas-${p.index}.png`,
      width: p.width,
      height: p.height,
    })),
    frames: atlas.frames.map((f) => ({
      ...f,
      anchor: recipe.frames.find((frame) => frame.name === f.name).anchor,
    })),
    clips: recipe.clips,
    ...(recipe.outline ? {outline: {...recipe.outline, baked: recipe.outline.enabled, bounds: "source-frame"}} : {}),
    sheet: { path: "sheet.png", columns, rows, width: sheet.width, height: sheet.height },
    packing: atlas.meta,
    provenance: {
      art: recipe.character ? "character assembled from its creator definition; original and imported part attribution is recorded in creator.json" : recipe.importedSprite ? "converted user-supplied sprite; attribution remains with its source" : "original independently authored candidate",
      ...(recipe.character ? { creator: recipe.character.creator.provenance } : {}),
      ...(recipe.importedSprite ? { importedSprite: recipe.importedSprite } : {}),
      restrictedInputs: [],
      donorCode: "Grout-Library@34016ee; MIT; no donor character artwork",
    },
  };
  const phaser = exportPhaserAtlasMetadata(atlas, { version: 4, image: "atlas-0.png" });
  for (const f of atlas.frames)
    phaser.frames[f.name].pivot = {
      x: (f.pivot?.x ?? 0) / f.sourceWidth,
      y: (f.pivot?.y ?? 0) / f.sourceHeight,
    };
  const consumer =
    atlas.pages.length === 1
      ? phaser
      : {
          textures: atlas.pages.map((page) => ({
            image: `atlas-${page.index}.png`,
            format: "RGBA8888",
            size: { w: page.width, h: page.height },
            scale: 1,
            frames: atlas.frames
              .filter((f) => f.pageIndex === page.index)
              .map((f) => ({ filename: f.name, ...phaser.frames[f.name] })),
          })),
          meta: { app: "grout-art/1", scale: "1" },
        };
  return { recipe, frames, atlas, manifest, phaser: consumer, sheet };
}
