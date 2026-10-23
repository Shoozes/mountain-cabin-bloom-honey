import { parseRecipe } from "./core.mjs";

export const GIF_ATLAS_FORMAT = "grout-art-gif/1";
const MAX_PIXELS = 16_777_216;
const MAX_BYTES = 32 * 1024 * 1024;
const identifier = /^[-a-zA-Z0-9_]{1,80}$/;

class ByteWriter {
  constructor(limit) { this.limit = limit; this.data = new Uint8Array(1024); this.length = 0; }
  push(value) {
    if (this.length >= this.limit) throw Error("GIF output exceeds 32 MiB");
    if (this.length === this.data.length) {
      const size = Math.min(this.limit, Math.max(this.data.length * 2, this.data.length + 1));
      const next = new Uint8Array(size); next.set(this.data); this.data = next;
    }
    this.data[this.length++] = value & 255;
  }
  bytes(values) { for (const value of values) this.push(value); }
  word(value) { this.push(value); this.push(value >> 8); }
  finish() { return this.data.slice(0, this.length); }
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
function check(signal) { signal?.throwIfAborted(); }

async function analyzeFrame(frame, signal) {
  const colors = new Map(); let transparent = false;
  for (let i = 0; i < frame.data.length; i += 4) {
    if ((i & 0x3ffff) === 0) { check(signal); if (i) await pause(); }
    const alpha = frame.data[i + 3];
    if (alpha !== 0 && alpha !== 255) throw Error("GIF export supports only fully opaque or fully transparent pixels");
    if (alpha === 0) transparent = true;
    else {
      const color = (frame.data[i] << 16) | (frame.data[i + 1] << 8) | frame.data[i + 2];
      colors.set(color, 0);
    }
  }
  return { colors: [...colors.keys()].sort((a, b) => a - b), transparent };
}

async function paletteFor(frame, analysis, reserveTransparent, signal) {
  const limit = reserveTransparent ? 255 : 256;
  if (analysis.colors.length > limit) throw Error(`GIF frame has ${analysis.colors.length} visible colors; ${limit} supported${reserveTransparent ? " with transparency" : ""}`);
  const palette = analysis.colors, index = new Map();
  let next = reserveTransparent ? 1 : 0;
  for (const color of palette) index.set(color, next++);
  const tableSize = Math.max(2, 2 ** Math.ceil(Math.log2(palette.length + (reserveTransparent ? 1 : 0))));
  const pixels = new Uint8Array(frame.width * frame.height);
  for (let p = 0, i = 0; p < pixels.length; p++, i += 4) {
    if ((p & 0xffff) === 0) { check(signal); if (p) await pause(); }
    pixels[p] = frame.data[i + 3] === 0 ? 0 : index.get((frame.data[i] << 16) | (frame.data[i + 1] << 8) | frame.data[i + 2]);
  }
  const table = new Uint8Array(tableSize * 3);
  for (let i = 0; i < palette.length; i++) {
    const color = palette[i], at = (index.get(color)) * 3;
    table[at] = color >> 16; table[at + 1] = color >> 8; table[at + 2] = color;
  }
  return { pixels, table, tableBits: Math.log2(tableSize), transparent: reserveTransparent };
}

async function writeLzwBlocks(writer, pixels, minimumCodeSize, signal) {
  writer.push(minimumCodeSize);
  const clear = 1 << minimumCodeSize, end = clear + 1;
  let codeSize, nextCode, dictionary, bits = 0, bitCount = 0, block = new Uint8Array(255), blockLength = 0, work = 0;
  const flushBlock = () => { if (blockLength) { writer.push(blockLength); writer.bytes(block.subarray(0, blockLength)); blockLength = 0; } };
  const outByte = (byte) => { block[blockLength++] = byte; if (blockLength === 255) flushBlock(); };
  const reset = () => { dictionary = new Map(); codeSize = minimumCodeSize + 1; nextCode = end + 1; };
  const emit = (code) => {
    bits |= code << bitCount; bitCount += codeSize;
    while (bitCount >= 8) { outByte(bits); bits >>>= 8; bitCount -= 8; }
  };
  reset(); emit(clear);
  if (pixels.length) {
    let phrase = pixels[0];
    for (let i = 1; i < pixels.length; i++) {
      if ((++work & 0x3fff) === 0) { check(signal); await pause(); }
      const symbol = pixels[i], key = phrase * 256 + symbol, found = dictionary.get(key);
      if (found !== undefined) phrase = found;
      else {
        emit(phrase);
        if (nextCode < 4096) {
          dictionary.set(key, nextCode++);
          // The encoder adds one dictionary entry before the decoder can mirror it.
          // Keep the old width for the next emitted code and widen only after the
          // encoder's next free code passes the decoder's current ceiling.
          if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
        } else {
          emit(clear); reset();
        }
        phrase = symbol;
      }
    }
    emit(phrase);
  }
  emit(end);
  if (bitCount) outByte(bits);
  flushBlock(); writer.push(0);
}

async function encodeClip(recipe, kitFrames, clip, clipName, signal, remainingBytes) {
  if (!identifier.test(clipName)) throw Error(`GIF export: unsafe clip identifier ${clipName}`);
  if (!Array.isArray(clip.frames) || !clip.frames.length || !Number.isInteger(clip.fps) || clip.fps < 1 || clip.fps > 60)
    throw Error(`GIF export: invalid clip ${clipName}`);
  if (clip.frames.length * recipe.width * recipe.height > MAX_PIXELS)
    throw Error(`GIF clip ${clipName} exceeds 16,777,216 aggregate decoded pixels`);
  const frames = clip.frames.map((name) => kitFrames.get(name));
  if (frames.some((frame) => !frame)) throw Error(`GIF export: clip ${clipName} references a missing frame`);
  const width = recipe.width, height = recipe.height, palettes = [];
  const analyses = [];
  let transparent = false;
  for (let i = 0; i < frames.length; i++) {
    check(signal); const analysis = await analyzeFrame(frames[i], signal); analyses.push(analysis); transparent ||= analysis.transparent;
    if ((i & 15) === 15) await pause();
  }
  for (let i = 0; i < frames.length; i++) {
    palettes.push(await paletteFor(frames[i], analyses[i], transparent, signal));
    if ((i & 15) === 15) { check(signal); await pause(); }
  }
  const writer = new ByteWriter(remainingBytes);
  writer.bytes([71, 73, 70, 56, 57, 97]); // GIF89a
  writer.word(width); writer.word(height); writer.bytes([0xf0, 0, 0, 0, 0, 0, 0, 0, 0]); // two-entry global table; index 0 is disposal background
  writer.bytes([0x21, 0xff, 0x0b, 78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48, 3, 1, 0, 0, 0]);
  const delaysCs = [];
  let durationCs = 0;
  for (let i = 0; i < frames.length; i++) {
    check(signal);
    const delay = Math.round((i + 1) * 100 / clip.fps) - Math.round(i * 100 / clip.fps);
    delaysCs.push(delay); durationCs += delay;
    const palette = palettes[i], descriptorFlags = 0x80 | (palette.tableBits - 1);
    writer.bytes([0x21, 0xf9, 4, (2 << 2) | (transparent ? 1 : 0)]); // clear full frame; clip transparency applies to every frame
    writer.word(delay); writer.bytes([0, 0]);
    writer.push(0x2c); writer.word(0); writer.word(0); writer.word(width); writer.word(height); writer.push(descriptorFlags);
    writer.bytes(palette.table);
    await writeLzwBlocks(writer, palette.pixels, Math.max(2, palette.tableBits), signal);
    if ((i & 15) === 15) { check(signal); await pause(); }
  }
  check(signal);
  writer.push(0x3b);
  const data = writer.finish();
  return { name: `clip-${clipName}.gif`, data, metadata: {
    name: clipName, path: `clip-${clipName}.gif`, width, height, fps: clip.fps,
    frames: [...clip.frames], delaysCs, durationCs, transparent,
  } };
}

/** Encode one exact-color GIF per recipe clip using per-frame local palettes. */
export async function buildArtGifs(kit, { signal } = {}) {
  check(signal);
  if (!kit || !Array.isArray(kit.frames)) throw Error("GIF export requires a packed art export kit");
  const recipe = parseRecipe(kit.recipe);
  if (kit.frames.length !== recipe.frames.length) throw Error("GIF export: kit frames do not match recipe");
  const kitFrames = new Map();
  for (let i = 0; i < recipe.frames.length; i++) {
    const source = recipe.frames[i], frame = kit.frames[i];
    if (!frame || frame.name !== source.name || frame.width !== recipe.width || frame.height !== recipe.height ||
        !(frame.data instanceof Uint8Array || frame.data instanceof Uint8ClampedArray) || frame.data.length !== recipe.width * recipe.height * 4 || kitFrames.has(frame.name))
      throw Error(`GIF export: invalid frame data for ${source.name}`);
    kitFrames.set(frame.name, frame);
  }
  const clips = Object.entries(recipe.clips), files = [], metadata = [];
  if (!clips.length) throw Error("GIF export: recipe has no clips");
  let totalPixels = 0;
  for (const [name, clip] of clips) {
    if (!identifier.test(name)) throw Error(`GIF export: unsafe clip identifier ${name}`);
    if (!Array.isArray(clip.frames) || !clip.frames.length || !Number.isInteger(clip.fps) || clip.fps < 1 || clip.fps > 60)
      throw Error(`GIF export: invalid clip ${name}`);
    totalPixels += clip.frames.length * recipe.width * recipe.height;
    if (totalPixels > MAX_PIXELS) throw Error("GIF export exceeds 16,777,216 aggregate decoded clip pixels");
  }
  for (const [name, clip] of clips) {
    check(signal);
    const result = await encodeClip(recipe, kitFrames, clip, name, signal, MAX_BYTES - files.reduce((total, file) => total + file.data.length, 0));
    files.push({ name: result.name, data: result.data }); metadata.push(result.metadata);
  }
  return { files, metadata: { format: GIF_ATLAS_FORMAT, loop: "infinite", timing: "rounded-cumulative-centiseconds", palette: "exact-per-frame", clips: metadata } };
}
