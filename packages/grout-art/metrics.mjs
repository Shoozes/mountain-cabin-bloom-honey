import { parseRecipe, lowerFrame } from "./core.mjs";
import { buildArtExport } from "./export.mjs";
const encoder = new TextEncoder(),
  utf8 = (s) => encoder.encode(s);
async function compressed(bytes, format = "gzip") {
  if (typeof CompressionStream === "undefined")
    throw Error("CompressionStream is required for measured compressed bytes");
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(name, data) {
  const tag = utf8(name),
    out = new Uint8Array(data.length + 12),
    view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(tag, 4);
  out.set(data, 8);
  let crc = 0xffffffff;
  for (const b of out.subarray(4, out.length - 4)) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  view.setUint32(out.length - 4, (crc ^ 0xffffffff) >>> 0);
  return out;
}
/** PNG cost is measured from actual lossless RGBA PNG bytes, not a pixel-count estimate. */
export async function encodePortablePng(pixels) {
  const head = new Uint8Array(13),
    view = new DataView(head.buffer);
  view.setUint32(0, pixels.width);
  view.setUint32(4, pixels.height);
  head[8] = 8;
  head[9] = 6;
  const rows = new Uint8Array((pixels.width * 4 + 1) * pixels.height);
  for (let y = 0; y < pixels.height; y++)
    rows.set(
      pixels.data.subarray(y * pixels.width * 4, (y + 1) * pixels.width * 4),
      y * (pixels.width * 4 + 1) + 1,
    );
  const chunks = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", head),
    chunk("IDAT", await compressed(rows, "deflate")),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(chunks.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const b of chunks) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}
export const compactRecipe = (input) => JSON.stringify(parseRecipe(input));
const runtimeUrls = [
  new URL("./index.mjs", import.meta.url),
  new URL("./core.mjs", import.meta.url),
  new URL("./compiler.mjs", import.meta.url),
  new URL("./browser.mjs", import.meta.url),
  new URL("./atlas.mjs", import.meta.url),
  new URL("./export.mjs", import.meta.url),
  new URL("./traveler.mjs", import.meta.url),
  new URL("./metrics.mjs", import.meta.url),
  new URL("./import.mjs", import.meta.url),
];
export async function measureRecipe(input, options = {}) {
  const recipe = parseRecipe(input),
    kit = buildArtExport(recipe),
    readable = utf8(JSON.stringify(recipe, null, 2)),
    compact = utf8(compactRecipe(recipe)),
    expanded = utf8(
      JSON.stringify({
        width: recipe.width,
        height: recipe.height,
        palette: recipe.palette,
        frames: recipe.frames.map((_, i) => lowerFrame(recipe, i)),
      }),
    ),
    raster = new Uint8Array(kit.frames.reduce((n, f) => n + f.data.length, 0));
  let at = 0;
  for (const frame of kit.frames) {
    raster.set(frame.data, at);
    at += frame.data.length;
  }
  const moduleText = JSON.stringify(recipe.techniques ?? []);
  let sources = options.runtimeSources,
    runtimeBytes = options.runtimeBytes ?? null;
  if (!sources && runtimeUrls[0].protocol !== "file:") {
    sources = await Promise.all(
      runtimeUrls.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw Error("SDK source metrics unavailable");
        return response.text();
      }),
    );
  }
  if (sources) runtimeBytes = sources.reduce((n, s) => n + utf8(s).length, 0);
  const pngs = await Promise.all(
      kit.atlas.pages.map((p) =>
        encodePortablePng({ width: p.width, height: p.height, data: p.rgba }),
      ),
    ),
    pngBytes = pngs.reduce((n, p) => n + p.length, 0);
  const metadata = utf8(JSON.stringify(kit.manifest)),
    packed = new Uint8Array(pngBytes + metadata.length);
  let packedAt = 0;
  for (const png of pngs) {
    packed.set(png, packedAt);
    packedAt += png.length;
  }
  packed.set(metadata, packedAt);
  const packedGzip = await compressed(packed);
  const [gzip, expandedGzip, rasterGzip] = await Promise.all([
      compressed(compact),
      compressed(expanded),
      compressed(raster),
    ]),
    bundle = sources ? utf8(sources.join("\n") + "\n" + new TextDecoder().decode(compact)) : null;
  return {
    readableBytes: readable.length,
    compactBytes: compact.length,
    gzipBytes: gzip.length,
    expandedBytes: expanded.length,
    expandedGzipBytes: expandedGzip.length,
    rasterBytes: raster.length,
    rasterGzipBytes: rasterGzip.length,
    pngBytes,
    atlasMetadataBytes: metadata.length,
    packedPngBundleBytes: packed.length,
    pngRuntimeBasis:
      "Atlas PNG pages plus reconstruction/clip metadata; host PNG decoder; consumer engine/runtime excluded",
    moduleBytes: utf8(moduleText).length,
    runtimeBytes,
    bundleBytes: runtimeBytes === null ? null : runtimeBytes + compact.length,
    bundleGzipBytes: bundle ? (await compressed(bundle)).length : null,
    runtimeBasis: sources
      ? "actual distributable SDK source; shared runtime counted once"
      : runtimeBytes === null
        ? "unmeasured"
        : "caller-measured SDK source bytes",
    representations: [
      { name: "Reusable recipe", bytes: compact.length, gzipBytes: gzip.length },
      { name: "Expanded operation graph", bytes: expanded.length, gzipBytes: expandedGzip.length },
      { name: "Raw RGBA frames", bytes: raster.length, gzipBytes: rasterGzip.length },
      {
        name: "Atlas PNG pages + metadata (host PNG decoder)",
        bytes: packed.length,
        gzipBytes: packedGzip.length,
      },
    ],
  };
}
