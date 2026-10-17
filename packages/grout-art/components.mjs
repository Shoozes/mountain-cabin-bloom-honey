import { importSpriteLayers } from "./import.mjs";

const MAX_PIXELS = 1_048_576;
const MAX_COMPONENTS = 256;
const yieldFrame = () => new Promise((resolve) => setTimeout(resolve, 0));
const detectionLabels = new WeakMap();
const integer = (n, min, max, label) => {
  if (!Number.isInteger(n) || n < min || n > max) throw Error(`${label} must be an integer from ${min} to ${max}`);
  return n;
};
const optionsObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error(`Expected ${label}`);
};
const pixelSource = (pixels) => {
  if (!pixels || typeof pixels !== "object" || Array.isArray(pixels)) throw Error("Expected RGBA pixels");
  for (const key of Object.keys(pixels)) if (!["width", "height", "data"].includes(key)) throw Error("Unknown pixel input: " + key);
  const { width, height, data } = pixels;
  integer(width, 1, 8192, "Image width");
  integer(height, 1, 8192, "Image height");
  if (width * height > MAX_PIXELS) throw Error("Sprite components support at most 1,048,576 decoded source pixels");
  if (!(data instanceof Uint8Array || data instanceof Uint8ClampedArray) || data.length !== width * height * 4)
    throw Error("Expected tightly packed RGBA8 pixels");
  return { width, height, data };
};
const checkAlpha = (data, at, x, y) => {
  const alpha = data[at + 3];
  if (alpha !== 0 && alpha !== 255) throw Error(`Partial transparency at ${x},${y}; use opaque or fully transparent pixels`);
  return alpha === 255;
};
const checkSignal = (signal) => signal?.throwIfAborted();
const controlSignal = (control) => {
  if (control === undefined) return undefined;
  optionsObject(control, "control options");
  for (const key of Object.keys(control)) if (key !== "signal") throw Error("Unknown control option: " + key);
  return control.signal;
};

/** Detect hard-alpha connected regions in deterministic row-major order. */
export async function detectSpriteComponents(pixels, options = {}, control = {}) {
  const signal = controlSignal(control);
  checkSignal(signal);
  optionsObject(options, "detection options");
  for (const key of Object.keys(options)) if (key !== "connectivity") throw Error("Unknown detection option: " + key);
  const { width, height, data } = pixelSource(pixels);
  const connectivity = options.connectivity ?? 8;
  if (connectivity !== 4 && connectivity !== 8) throw Error("Connectivity must be 4 or 8");
  const labels = new Int32Array(width * height).fill(-1);
  for (let i = 0; i < labels.length; i++) {
    if ((i & 4095) === 0) { checkSignal(signal); if (i) await yieldFrame(); }
    const x = i % width, y = Math.floor(i / width), at = i * 4;
    if (checkAlpha(data, at, x, y)) labels[i] = -2;
  }
  const components = [];
  const neighbors = connectivity === 4 ? [[-1,0],[1,0],[0,-1],[0,1]] : [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  for (let start = 0; start < labels.length; start++) {
    if ((start & 4095) === 0) { checkSignal(signal); if (start) await yieldFrame(); }
    if (labels[start] !== -2) continue;
    if (components.length >= MAX_COMPONENTS) throw Error("Sprite components support at most 256 components");
    const id = components.length, queue = [start]; labels[start] = id;
    let minX = width, minY = height, maxX = -1, maxY = -1, count = 0;
    for (let head = 0; head < queue.length; head++) {
      if ((head & 4095) === 0) { checkSignal(signal); if (head) await yieldFrame(); }
      const index = queue[head], x = index % width, y = Math.floor(index / width);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); count++;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (labels[next] === -2) { labels[next] = id; queue.push(next); }
      }
    }
    components.push({ id, x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, pixels: count });
  }
  checkSignal(signal);
  if (!components.length) throw Error("Sprite sheet contains no opaque pixels");
  const result = { width, height, connectivity, components };
  detectionLabels.set(result, labels);
  return result;
}

/** Convert isolated connected regions into editable Grout Art frames. */
export async function importSpriteComponents(pixels, options = {}, control = {}) {
  const signal = controlSignal(control);
  checkSignal(signal);
  optionsObject(options, "component import options");
  const allowed = ["name", "sourceName", "sourceSha256", "connectivity", "groups", "padding", "anchor"];
  for (const key of Object.keys(options)) if (!allowed.includes(key)) throw Error("Unknown component import option: " + key);
  const { width, height, data } = pixelSource(pixels);
  const { name, sourceName = "RGBA pixels", sourceSha256, connectivity = 8, groups, padding = 1, anchor } = options;
  if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 120)) throw Error("Use a sprite name of 1–120 characters");
  if (typeof sourceName !== "string" || !sourceName.trim() || sourceName.length > 255) throw Error("Invalid sourceName");
  if (sourceSha256 !== undefined && (typeof sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(sourceSha256))) throw Error("Invalid source SHA-256");
  integer(padding, 0, 32, "Padding");
  const detected = await detectSpriteComponents(pixels, { connectivity }, { signal });
  const regions = detected.components;
  let members;
  if (groups === undefined) members = regions.map((c) => [c.id]);
  else {
    if (!Array.isArray(groups) || !groups.length) throw Error("Groups must be a non-empty array of component ID lists");
    const seen = new Set();
    members = groups.map((group) => {
      if (!Array.isArray(group) || !group.length) throw Error("Each group must contain component IDs");
      const ids = group.map((id) => {
        integer(id, 0, regions.length - 1, "Component ID");
        if (seen.has(id)) throw Error("Groups contain a duplicate component ID");
        seen.add(id); return id;
      });
      return ids.sort((a, b) => a - b);
    });
    if (seen.size !== regions.length) throw Error("Groups must include every component exactly once");
  }
  const bounds = members.map((ids) => {
    const selected = ids.map((id) => regions[id]);
    const x = Math.min(...selected.map((c) => c.x)), y = Math.min(...selected.map((c) => c.y));
    const right = Math.max(...selected.map((c) => c.x + c.width)), bottom = Math.max(...selected.map((c) => c.y + c.height));
    return { x, y, width: right - x, height: bottom - y };
  });
  const frameWidth = Math.max(...bounds.map((b) => b.width)) + padding * 2;
  const frameHeight = Math.max(...bounds.map((b) => b.height)) + padding * 2;
  integer(frameWidth, 1, 512, "Frame width"); integer(frameHeight, 1, 512, "Frame height");
  if (frameWidth * frameHeight * members.length > MAX_PIXELS) throw Error("Component import output exceeds 1,048,576 decoded pixels");
  const resolvedAnchor = anchor ?? [Math.floor(frameWidth / 2), frameHeight - 1];
  if (!Array.isArray(resolvedAnchor) || resolvedAnchor.length !== 2) throw Error("Anchor must be [x,y]");
  resolvedAnchor.forEach((v) => integer(v, -512, 512, "Anchor"));
  const frames = [];
  const componentLabels = detectionLabels.get(detected);
  const groupFor = new Int16Array(regions.length).fill(-1);
  members.forEach((ids, groupIndex) => ids.forEach((id) => { groupFor[id] = groupIndex; }));
  const frameData = members.map(() => new Uint8ClampedArray(frameWidth * frameHeight * 4));
  for (let i = 0; i < componentLabels.length; i++) {
    if ((i & 4095) === 0) { checkSignal(signal); if (i) await yieldFrame(); }
    const id = componentLabels[i], groupIndex = id < 0 ? -1 : groupFor[id];
    if (groupIndex < 0) continue;
    const x = i % width, y = Math.floor(i / width), box = bounds[groupIndex];
    const dx = padding + x - box.x, dy = padding + y - box.y;
    const src = i * 4, dst = (dy * frameWidth + dx) * 4, out = frameData[groupIndex];
    out[dst] = data[src]; out[dst + 1] = data[src + 1]; out[dst + 2] = data[src + 2]; out[dst + 3] = 255;
  }
  for (const data of frameData) frames.push({ width: frameWidth, height: frameHeight, data });
  const recipe = await importSpriteLayers([{ name: "Components", sourceName, sourceSha256, frames, durationsMs: frames.length > 1 ? frames.map(() => 125) : undefined }], { name: name ?? "Imported components", anchor: resolvedAnchor }, { signal });
  const componentDescriptors = regions.map(({ id, x, y, width: w, height: h, pixels: count }) => ({ id, x, y, width: w, height: h, pixels: count }));
  recipe.clips = { frames: { frames: recipe.frames.map((f) => f.name), fps: 8 } };
  recipe.importedSprite = {
    format: "sprite-components/1",
    source: { name: sourceName, ...(sourceSha256 ? { sha256: sourceSha256 } : {}), width, height, frames: 1 },
    width, height, frameWidth, frameHeight, animationFrames: 1, frameOrder: groups === undefined ? "component-row-major" : "component-groups", transparentRgb: "zeroed", connectivity, padding,
    components: componentDescriptors,
    regions: bounds.map((box, i) => ({ frame: recipe.frames[i].name, components: members[i], x: box.x, y: box.y, width: box.width, height: box.height, offset: [padding, padding] })),
    attribution: "User-supplied image; rights and attribution remain with its source",
  };
  checkSignal(signal);
  return recipe;
}
