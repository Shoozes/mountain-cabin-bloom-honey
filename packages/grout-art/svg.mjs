import { parseRecipe } from "./core.mjs";

const MAX_BYTES = 32 * 1024 * 1024;
const encoder = new TextEncoder();
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Convert an existing kit's native frames to self-contained, cutout SVG paths. */
export async function buildArtSvgs(kit, { signal } = {}) {
  signal?.throwIfAborted();
  if (!kit || !Array.isArray(kit.frames)) throw Error("SVG export requires an art export kit");
  const recipe = parseRecipe(kit.recipe);
  if (kit.frames.length !== recipe.frames.length) throw Error("SVG export: kit frames do not match recipe");
  const files = [], frames = [];
  let totalBytes = 0;
  const reserve = (text) => {
    // All emitted markup is ASCII: numeric geometry, hex colors and fixed tags.
    totalBytes += text.length;
    if (totalBytes > MAX_BYTES) throw Error("SVG output exceeds 32 MiB");
    return text;
  };
  for (let i = 0; i < recipe.frames.length; i++) {
    signal?.throwIfAborted();
    const source = recipe.frames[i], frame = kit.frames[i];
    if (!frame || frame.name !== source.name || frame.width !== recipe.width || frame.height !== recipe.height ||
        !(frame.data instanceof Uint8Array || frame.data instanceof Uint8ClampedArray) || frame.data.length !== frame.width * frame.height * 4)
      throw Error("SVG export: invalid frame data for " + source.name);
    const paths = new Map();
    const colorAt = (x, y) => {
      const p = (y * frame.width + x) * 4, a = frame.data[p + 3];
      if (a !== 0 && a !== 255) throw Error("SVG export supports only fully opaque or fully transparent pixels");
      return a === 0 ? -1 : (frame.data[p] << 16) | (frame.data[p + 1] << 8) | frame.data[p + 2];
    };
    for (let y = 0; y < frame.height; y++) {
      if (y % 16 === 0) { await pause(); signal?.throwIfAborted(); }
      for (let x = 0; x < frame.width;) {
        const start = x, color = colorAt(x++, y);
        while (x < frame.width && colorAt(x, y) === color) x++;
        if (color < 0) continue;
        const width = x - start, segment = reserve(`M${start} ${y}h${width}v1h-${width}z`);
        if (!paths.has(color)) paths.set(color, []);
        paths.get(color).push(segment);
      }
    }
    const lines = [reserve(`<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}" shape-rendering="crispEdges">\n`)];
    for (const color of [...paths.keys()].sort((a, b) => a - b)) {
      signal?.throwIfAborted();
      lines.push(reserve(`<path fill="#${color.toString(16).padStart(6, "0")}" d="`) + paths.get(color).join("") + reserve('"/>\n'));
    }
    lines.push(reserve("</svg>\n"));
    const name = `frame-${source.name}.svg`;
    files.push({ name, data: encoder.encode(lines.join("")) });
    frames.push({ name: source.name, path: name, width: frame.width, height: frame.height, anchor: [...source.anchor] });
  }
  signal?.throwIfAborted();
  return { files, metadata: { format: "grout-art-svg/1", representation: "pixel-run-paths", frames } };
}
