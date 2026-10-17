import { parseRecipe } from "./core.mjs";
const integer = (n, min, max, label) => {
  if (!Number.isInteger(n) || n < min || n > max)
    throw Error(`${label} must be an integer from ${min} to ${max}`);
  return n;
};
// One UTF-16 code unit per ink. Dot is reserved for transparent coverage.
const symbols =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
  Array.from({ length: 194 }, (_, i) => String.fromCharCode(0x100 + i)).join("");
const yieldFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Exact visible-pixel conversion. Transparent RGB is normalized to zero.
 * A grid is row-major. One imported bitmap does not imply semantic layers. */
export function importSpritePixels(pixels, options = {}, control = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options))
    throw Error("Expected import options");
  const { sourceName = "RGBA pixels", sourceSha256, ...rest } = options;
  return importSpriteLayers(
    [{ name: "Imported pixels", sourceName, sourceSha256, frames: [pixels] }],
    rest,
    control,
  );
}

/** Aligned layers, bottom first. Animated layers share an exact timeline;
 * single-frame layers remain static. Each sheet cell receives its own clip. */
export async function importSpriteLayers(inputs, options = {}, { signal } = {}) {
  signal?.throwIfAborted();
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > 16)
    throw Error("Import 1–16 aligned sprite layers");
  if (!options || typeof options !== "object" || Array.isArray(options))
    throw Error("Expected import options");
  const allowed = ["name", "frameWidth", "frameHeight", "margin", "spacing", "fps", "anchor"];
  for (const key of Object.keys(options))
    if (!allowed.includes(key)) throw Error("Unknown import option: " + key);
  const width = integer(inputs[0]?.frames?.[0]?.width, 1, 8192, "Image width"),
    height = integer(inputs[0]?.frames?.[0]?.height, 1, 8192, "Image height");
  let decoded = 0,
    times = 1,
    durations;
  for (const layer of inputs) {
    if (!layer || !Array.isArray(layer.frames) || !layer.frames.length || layer.frames.length > 256)
      throw Error("Each layer needs 1–256 decoded frames");
    for (const key of ["name", "sourceName"])
      if (
        layer[key] !== undefined &&
        (typeof layer[key] !== "string" || !layer[key].trim() || layer[key].length > 255)
      )
        throw Error("Invalid layer " + key);
    if (layer.sourceSha256 !== undefined && !/^[a-f0-9]{64}$/.test(layer.sourceSha256))
      throw Error("Invalid source SHA-256");
    times = Math.max(times, layer.frames.length);
    for (const p of layer.frames) {
      if (!p || p.width !== width || p.height !== height)
        throw Error("All layer images and animation frames must have the same dimensions");
      if (
        !(p.data instanceof Uint8Array || p.data instanceof Uint8ClampedArray) ||
        p.data.length !== width * height * 4
      )
        throw Error("Expected tightly packed RGBA8 pixels");
      decoded += width * height;
      if (decoded > 1048576)
        throw Error(
          "Sprite import supports at most 1,048,576 decoded source pixels across all layers",
        );
    }
    if (layer.frames.length > 1) {
      if (
        !Array.isArray(layer.durationsMs) ||
        layer.durationsMs.length !== layer.frames.length ||
        layer.durationsMs.some((n) => !Number.isFinite(n) || n <= 0 || n > 60000)
      )
        throw Error("Animated layers need a positive duration for every frame");
      if (durations && JSON.stringify(durations) !== JSON.stringify(layer.durationsMs))
        throw Error("Animated layer timings must match exactly");
      durations = [...layer.durationsMs];
    }
  }
  if (inputs.some((l) => l.frames.length !== 1 && l.frames.length !== times))
    throw Error("Animated layers must have the same frame count");
  const fw = integer(options.frameWidth ?? width, 1, 512, "Frame width"),
    fh = integer(options.frameHeight ?? height, 1, 512, "Frame height"),
    margin = integer(options.margin ?? 0, 0, 256, "Margin"),
    spacing = integer(options.spacing ?? 0, 0, 256, "Spacing"),
    columns = (width - margin * 2 + spacing) / (fw + spacing),
    rows = (height - margin * 2 + spacing) / (fh + spacing);
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1)
    throw Error("The frame grid must fit the image exactly; check frame size, margin and spacing");
  const cells = columns * rows;
  if (cells * times > 256) throw Error("Sprite import supports at most 256 output frames");
  const name = options.name ?? "Imported sprite",
    anchor = options.anchor ?? [Math.floor(fw / 2), fh - 1];
  if (typeof name !== "string" || !name.trim() || name.length > 120)
    throw Error("Use a sprite name of 1–120 characters");
  if (!Array.isArray(anchor) || anchor.length !== 2) throw Error("Anchor must be [x,y]");
  anchor.forEach((n) => integer(n, -512, 512, "Anchor"));
  let fps = options.fps === undefined ? 8 : integer(options.fps, 1, 60, "FPS"),
    holds = Array(times).fill(1);
  if (durations && options.fps === undefined) {
    fps = Array.from({ length: 60 }, (_, i) => i + 1).find((rate) =>
      durations.every(
        (ms) =>
          Math.abs((ms * rate) / 1000 - Math.round((ms * rate) / 1000)) < 1e-6 &&
          Math.round((ms * rate) / 1000) >= 1,
      ),
    );
    if (!fps)
      throw Error(
        "GIF timing cannot be represented exactly at 1–60 fps; import a PNG sheet or supply an explicit FPS override",
      );
    holds = durations.map((ms) => Math.round((ms * fps) / 1000));
    if (holds.reduce((a, b) => a + b, 0) > 4096)
      throw Error("Animation exceeds the clip timing budget");
  }
  const palette = {},
    colors = new Map(),
    parts = {},
    frames = [],
    duplicates = new Map();
  const layers = inputs.map((l, i) => ({
    id: inputs.length === 1 ? "sprite" : "layer-" + i,
    name: l.name ?? "Layer " + (i + 1),
    part: "",
    visible: true,
  }));
  let totalRuns = 0;
  for (let time = 0; time < times; time++)
    for (let cell = 0; cell < cells; cell++) {
      await yieldFrame();
      signal?.throwIfAborted();
      const x0 = margin + (cell % columns) * (fw + spacing),
        y0 = margin + Math.floor(cell / columns) * (fh + spacing),
        overrides = {};
      for (let li = 0; li < inputs.length; li++) {
        const pixels = inputs[li].frames[inputs[li].frames.length === 1 ? 0 : time],
          drawing = [],
          ink = {};
        let runs = 0;
        for (let y = 0; y < fh; y++) {
          let row = "",
            last = ".";
          for (let x = 0; x < fw; x++) {
            const p = ((y0 + y) * width + x0 + x) * 4,
              a = pixels.data[p + 3];
            let symbol = ".";
            if (a !== 0 && a !== 255)
              throw Error(
                `Partial transparency in layer ${li + 1} at ${x0 + x},${y0 + y}; use opaque or fully transparent pixels`,
              );
            if (a) {
              const hex =
                "#" +
                [...pixels.data.subarray(p, p + 3)]
                  .map((n) => n.toString(16).padStart(2, "0"))
                  .join("");
              if (!colors.has(hex)) {
                if (colors.size === 256)
                  throw Error(
                    "Sprite import supports at most 256 visible colors; reduce the palette explicitly before importing",
                  );
                const index = colors.size,
                  role = "color" + index.toString().padStart(3, "0");
                colors.set(hex, { symbol: symbols[index], role });
                palette[role] = hex;
              }
              const color = colors.get(hex);
              symbol = color.symbol;
              ink[symbol] = color.role;
              if (symbol !== last) runs++;
            }
            row += symbol;
            last = symbol;
          }
          drawing.push(row);
        }
        totalRuns += runs;
        if (runs > 4096 || totalRuns > 65536)
          throw Error(
            "Sprite is too detailed for editable mask import; use smaller frames or a simpler palette",
          );
        const signature = drawing.join("\n");
        let part = duplicates.get(signature);
        if (!part) {
          if (duplicates.size === 256)
            throw Error("Import supports at most 256 unique layer drawings");
          part = "sprite-" + duplicates.size.toString().padStart(3, "0");
          duplicates.set(signature, part);
          parts[part] = [{ op: "mask", x: 0, y: 0, rows: drawing, ink }];
        }
        if (!layers[li].part) layers[li].part = part;
        overrides[layers[li].id] = { part };
      }
      frames.push({
        name: "frame-" + frames.length.toString().padStart(3, "0"),
        anchor: [...anchor],
        layers: overrides,
      });
    }
  signal?.throwIfAborted();
  if (!colors.size) palette.color000 = "#000000";
  const clips = {};
  if (times === 1) clips.frames = { frames: frames.map((f) => f.name), fps };
  else
    for (let cell = 0; cell < cells; cell++)
      clips["sprite-" + cell.toString().padStart(3, "0")] = {
        frames: holds.flatMap((hold, t) => Array(hold).fill(frames[t * cells + cell].name)),
        fps,
      };
  return parseRecipe({
    format: "grout-art/1",
    name,
    width: fw,
    height: fh,
    seed: 1204,
    palette,
    parts,
    layers,
    frames,
    clips,
    techniques: [],
    importedSprite: {
      format: "sprite-import/1",
      sources: inputs.map((l, i) => ({
        name: l.sourceName ?? l.name ?? "RGBA layer " + i,
        ...(l.sourceSha256 ? { sha256: l.sourceSha256 } : {}),
        frames: l.frames.length,
      })),
      width,
      height,
      frameWidth: fw,
      frameHeight: fh,
      columns,
      rows,
      margin,
      spacing,
      animationFrames: times,
      ...(durations ? { durationsMs: durations } : {}),
      frameOrder: "time-then-row-major",
      transparentRgb: "zeroed",
      attribution: "User-supplied images; rights and attribution remain with their sources",
    },
  });
}
