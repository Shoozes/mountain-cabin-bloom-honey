/** Grout Art 1: native integer drawing, portable technique graphs and straight RGBA. */
export const FORMAT = "grout-art/1";
export const VERSION = "grout-art/1.0.0";
export const copy = (value) => JSON.parse(JSON.stringify(value));
const integer = (n, min, max, path) => {
  if (!Number.isInteger(n) || n < min || n > max)
    throw Error(`${path}: expected integer ${min}..${max}`);
  return n;
};
const identifier = (s, path) => {
  if (
    typeof s !== "string" ||
    !/^[-a-zA-Z0-9_]{1,80}$/.test(s) ||
    ["__proto__", "prototype", "constructor"].includes(s)
  )
    throw Error(`${path}: invalid identifier`);
  return s;
};
const object = (v, path) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw Error(`${path}: expected object`);
  return v;
};
export function parseRecipe(input) {
  if (typeof input === "string") {
    if (new TextEncoder().encode(input).length > 2 * 1048576) throw Error("Recipe exceeds 2 MiB");
    try {
      input = JSON.parse(input);
    } catch {
      throw Error("Recipe: invalid JSON");
    }
  }
  const r = copy(object(input, "recipe"));
  if (new TextEncoder().encode(JSON.stringify(r)).length > 2 * 1048576)
    throw Error("Recipe exceeds 2 MiB");
  if (r.format !== FORMAT)
    throw Error("recipe.format: expected grout-art/1; legacy Grout formats are not imported");
  if (typeof r.name !== "string" || !r.name.trim() || r.name.length > 120)
    throw Error("recipe.name: expected a short name");
  integer(r.width, 1, 512, "width");
  integer(r.height, 1, 512, "height");
  integer(r.seed, 0, 0xffffffff, "seed");
  if (r.outline !== undefined) {
    object(r.outline, "outline");
    if (
      Object.keys(r.outline).some((key) => !["enabled", "color", "width", "corners"].includes(key))
    )
      throw Error("outline: unknown setting");
    if (typeof r.outline.enabled !== "boolean") throw Error("outline.enabled: expected boolean");
    if (typeof r.outline.color !== "string" || !/^#[a-fA-F0-9]{6}$/.test(r.outline.color))
      throw Error("outline.color: expected #rrggbb");
    integer(r.outline.width, 1, 3, "outline.width");
    if (!["stepped", "square"].includes(r.outline.corners))
      throw Error("outline.corners: expected stepped or square");
  }
  object(r.palette, "palette");
  const roles = Object.keys(r.palette);
  if (!roles.length || roles.length > 256) throw Error("palette: expected 1..256 roles");
  for (const role of roles) {
    identifier(role, "palette role");
    if (!/^#[a-fA-F0-9]{6}$/.test(r.palette[role]))
      throw Error("palette." + role + ": expected #rrggbb");
  }
  object(r.parts, "parts");
  if (Object.keys(r.parts).length > 256) throw Error("parts: limit 256");
  for (const key of Object.keys(r.parts)) identifier(key, "part");
  if (!Array.isArray(r.layers) || !r.layers.length || r.layers.length > 64)
    throw Error("layers: expected 1..64");
  const ids = new Set();
  for (const layer of r.layers) {
    identifier(layer.id, "layer.id");
    if (ids.has(layer.id)) throw Error("Duplicate layer " + layer.id);
    ids.add(layer.id);
    if (!Object.hasOwn(r.parts, layer.part)) throw Error("layer " + layer.id + ": missing part");
    layer.visible = layer.visible !== false;
    layer.name ??= layer.id;
  }
  if (
    !Array.isArray(r.frames) ||
    !r.frames.length ||
    r.frames.length > 256 ||
    r.frames.length * r.width * r.height > 16777216
  )
    throw Error("frames: decoded pixel budget exceeded");
  const names = new Set();
  for (const f of r.frames) {
    identifier(f.name, "frame.name");
    if (names.has(f.name)) throw Error("Duplicate frame " + f.name);
    names.add(f.name);
    if (!Array.isArray(f.anchor) || f.anchor.length !== 2)
      throw Error("frame.anchor: expected [x,y]");
    for (const n of f.anchor) integer(n, -512, 512, "frame.anchor");
    for (const [id, override] of Object.entries(f.layers ?? {})) {
      if (!ids.has(id)) throw Error("frame.layers: missing layer " + id);
      object(override, "frame.layers." + id);
      if (override.visible !== undefined && typeof override.visible !== "boolean")
        throw Error("layer visibility must be boolean");
    }
  }
  object(r.clips, "clips");
  for (const [id, clip] of Object.entries(r.clips)) {
    identifier(id, "clip");
    if (
      !Array.isArray(clip.frames) ||
      !clip.frames.length ||
      clip.frames.length > 4096 ||
      clip.frames.some((n) => !names.has(n))
    )
      throw Error("clip " + id + ": invalid frame names");
    integer(clip.fps, 1, 60, "clip.fps");
  }
  r.techniques ??= [];
  if (!Array.isArray(r.techniques) || r.techniques.length > 32) throw Error("techniques: limit 32");
  const techniqueIds = new Set();
  for (const t of r.techniques) {
    identifier(t.id, "technique.id");
    if (techniqueIds.has(t.id)) throw Error("Duplicate technique " + t.id);
    techniqueIds.add(t.id);
    if (
      typeof t.glsl !== "string" ||
      typeof t.wgsl !== "string" ||
      !t.glsl.trim() ||
      !t.wgsl.trim() ||
      t.glsl.length + t.wgsl.length > 65536
    )
      throw Error("technique " + t.id + ": GLSL and WGSL source required");
    object(t.parameters, "technique.parameters");
    for (const [key, p] of Object.entries(t.parameters)) {
      identifier(key, "parameter");
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) throw Error("Invalid shader parameter " + key);
      if (
        [
          "p",
          "seed",
          "color",
          "result",
          "fn",
          "var",
          "let",
          "int",
          "uint",
          "float",
          "bool",
          "return",
          "if",
          "else",
          "for",
          "while",
          "switch",
          "case",
          "struct",
          "uniform",
          "buffer",
          "in",
          "out",
        ].includes(key)
      )
        throw Error("Reserved technique parameter " + key);
      if (p.type === "role") {
        if (!roles.includes(p.default)) throw Error("Invalid role default");
      } else {
        if (p.type !== "int") throw Error("Parameter type must be int or role");
        integer(p.min, -512, 512, "parameter.min");
        integer(p.max, p.min, 512, "parameter.max");
        integer(p.default, p.min, p.max, "parameter.default");
      }
    }
  }
  let count = 0;
  const validateOps = (ops, path) => {
    if (!Array.isArray(ops)) throw Error(path + ": expected operation array");
    for (const op of ops) {
      if (++count > 50000) throw Error("Recipe operation budget exceeded");
      object(op, path);
      if (
        ![
          "rect",
          "circle",
          "mask",
          "use",
          "clip",
          "outline",
          "clusters",
          "hatch",
          "technique",
        ].includes(op.op)
      )
        throw Error(path + ": unknown operation " + op.op);
      if (op.ops) validateOps(op.ops, path + ".ops");
      if (op.op === "mask") {
        if (
          !Array.isArray(op.rows) ||
          op.rows.length > 512 ||
          op.rows.some((row) => typeof row !== "string" || row.length > 512)
        )
          throw Error(path + ": invalid mask rows");
        object(op.ink, path + ".ink");
        for (const role of Object.values(op.ink))
          if (!roles.includes(role)) throw Error("mask: unknown palette role");
      }
    }
  };
  for (const [id, ops] of Object.entries(r.parts)) validateOps(ops, "parts." + id);
  for (const f of r.frames)
    for (const layer of Object.values(f.layers ?? {}))
      if (layer.ops) validateOps(layer.ops, "frame " + f.name);
  for (const t of r.techniques) validateOps(t.cpu, "technique " + t.id + ".cpu");
  // Lower every frame now, so bad references, cycles and parameters fail before state replacement.
  for (let i = 0; i < r.frames.length; i++) {
    const order = r.frames[i].order;
    if (
      order &&
      (!Array.isArray(order) ||
        order.length !== ids.size ||
        new Set(order).size !== ids.size ||
        order.some((id) => !ids.has(id)))
    )
      throw Error("Frame order must name every layer once");
    lowerFrame(r, i, i === 0);
  }
  return r;
}
const number = (value, params, fallback = 0) => {
  const n =
    typeof value === "string" && value.startsWith("$")
      ? params[value.slice(1)]
      : (value ?? fallback);
  return integer(n, -4096, 4096, "operation coordinate");
};
const floorDiv = (a, b) => Math.floor(a / b);
export function pixelHash(x, y, seed) {
  let h = Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77) ^ seed;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}
export function lowerFrame(r, index = 0, validateParts = false) {
  integer(index, 0, r.frames.length - 1, "frame index");
  const frame = r.frames[index],
    roles = Object.keys(r.palette),
    modules = r.techniques ?? [];
  let work = 0;
  const role = (v, params) => {
    const name = typeof v === "string" && v.startsWith("$") ? params[v.slice(1)] : v;
    if (name === null) return -1;
    const at = roles.indexOf(name);
    if (at < 0) throw Error("Unknown palette role " + name);
    return at;
  };
  const lower = (ops, params = {}, stack = []) => {
    if (stack.length > 24) throw Error("Part/technique recursion budget exceeded");
    return ops.flatMap((op) => {
      if (++work > 100000) throw Error("Expanded recipe budget exceeded");
      const n = (v, f = 0) => number(v, params, f),
        base = { kind: op.op, x: n(op.x), y: n(op.y) };
      if (["rect", "clip", "clusters", "hatch"].includes(op.op)) {
        base.w = n(op.w, r.width);
        base.h = n(op.h, r.height);
        if (base.w < 1 || base.h < 1 || base.w > 512 || base.h > 512)
          throw Error("Operation extent must be 1..512");
      }
      switch (op.op) {
        case "rect":
          return [{ ...base, role: role(op.role, params) }];
        case "circle": {
          const radius = n(op.r, 1);
          if (radius < 1 || radius > 512) throw Error("circle.r must be 1..512");
          return [{ ...base, r: radius, role: role(op.role, params) }];
        }
        case "hatch": {
          const period = n(op.period, 3);
          if (period < 1 || period > 512) throw Error("hatch.period must be 1..512");
          return [{ ...base, period, role: role(op.role, params) }];
        }
        case "clusters": {
          const cell = n(op.cell, 2),
            density = n(op.density, 25);
          if (cell < 1 || cell > 64 || density < 0 || density > 100)
            throw Error("Invalid cluster controls");
          return [{ ...base, cell, density, salt: n(op.salt), role: role(op.role, params) }];
        }
        case "mask": {
          const commands = [];
          for (let y = 0; y < op.rows.length; y++) {
            const row = op.rows[y];
            for (let x = 0; x < row.length;) {
              const ch = row[x];
              let end = x + 1;
              while (end < row.length && row[end] === ch) end++;
              if (ch !== "." && ch !== " ") {
                if (!Object.hasOwn(op.ink, ch)) throw Error("Mask has unmapped symbol " + ch);
                commands.push({
                  kind: "rect",
                  x: base.x + x,
                  y: base.y + y,
                  w: end - x,
                  h: 1,
                  role: role(op.ink[ch], params),
                });
              }
              x = end;
            }
          }
          return commands;
        }
        case "clip":
          return [{ ...base, ops: lower(op.ops, params, stack) }];
        case "use":
        case "outline": {
          const id = op.part;
          if (!Object.hasOwn(r.parts, id)) throw Error("Missing part " + id);
          if (stack.includes("part:" + id)) throw Error("Cyclic part " + id);
          const scale = n(op.scale, 1);
          if (scale < 1 || scale > 16) throw Error("Part scale must be 1..16");
          const children = lower(r.parts[id], params, [...stack, "part:" + id]);
          return [
            {
              ...base,
              ops: children,
              role: op.op === "outline" ? role(op.role, params) : undefined,
              scale,
              flipX: !!op.flipX,
              flipY: !!op.flipY,
              width: n(op.width, r.width),
              height: n(op.height, r.height),
            },
          ];
        }
        case "technique": {
          const module = modules.find((t) => t.id === op.id);
          if (!module) throw Error("Missing technique " + op.id);
          if (stack.includes("technique:" + op.id)) throw Error("Cyclic technique " + op.id);
          const values = {};
          for (const [key, p] of Object.entries(module.parameters)) {
            const value = op.params?.[key] ?? p.default;
            values[key] =
              p.type === "role"
                ? value
                : integer(
                    typeof value === "string" && value.startsWith("$")
                      ? params[value.slice(1)]
                      : value,
                    p.min,
                    p.max,
                    "technique " + op.id + "." + key,
                  );
            if (p.type === "role") role(value, params);
          }
          for (const key of Object.keys(op.params ?? {}))
            if (!Object.hasOwn(module.parameters, key))
              throw Error("Unknown technique parameter " + key);
          return [
            {
              ...base,
              module,
              values,
              args: Object.entries(module.parameters).map(([key, p]) =>
                p.type === "role" ? role(values[key], params) : values[key],
              ),
              ops: lower(module.cpu, values, [...stack, "technique:" + op.id]),
            },
          ];
        }
        default:
          throw Error("Unknown operation");
      }
    });
  };
  if (validateParts)
    for (const [id, ops] of Object.entries(r.parts)) lower(ops, {}, ["part:" + id]);
  const ordered = frame.order
    ? frame.order.map((id) => r.layers.find((l) => l.id === id))
    : r.layers;
  return {
    width: r.width,
    height: r.height,
    seed: r.seed,
    outline: r.outline?.enabled
      ? {
          color: [1, 3, 5].map((i) => parseInt(r.outline.color.slice(i, i + 2), 16)),
          offsets: outlineOffsets(r.outline),
        }
      : null,
    roles,
    colors: roles.map((role) =>
      [1, 3, 5].map((i) => parseInt(r.palette[role].slice(i, i + 2), 16)),
    ),
    layers: ordered
      .filter((layer) => layer.visible !== false && frame.layers?.[layer.id]?.visible !== false)
      .map((layer) => {
        const patch = frame.layers?.[layer.id] ?? {},
          part = patch.part ?? layer.part;
        if (!Object.hasOwn(r.parts, part)) throw Error("Missing frame part " + part);
        const offset = patch.offset ?? [0, 0];
        if (!Array.isArray(offset) || offset.length !== 2)
          throw Error("Layer offset must be [x,y]");
        return {
          id: layer.id,
          offset: offset.map((v) => integer(v, -512, 512, "layer offset")),
          ops: [...lower(r.parts[part], {}, ["part:" + part]), ...lower(patch.ops ?? [])],
        };
      }),
  };
}
/** Shared integer dilation footprint. Never samples the generated border itself. */
function outlineOffsets({ width, corners }) {
  const offsets = [];
  for (let y = -width; y <= width; y++)
    for (let x = -width; x <= width; x++)
      if ((x || y) && (corners === "square" || Math.abs(x) + Math.abs(y) <= width))
        offsets.push([x, y]);
  return offsets;
}
export function sampleOps(ops, x, y, seed) {
  let color = -1;
  for (const o of ops) {
    const inBox = x >= o.x && y >= o.y && x < o.x + o.w && y < o.y + o.h;
    switch (o.kind) {
      case "rect":
        if (inBox) color = o.role;
        break;
      case "circle":
        if ((x - o.x) ** 2 + (y - o.y) ** 2 <= o.r ** 2) color = o.role;
        break;
      case "hatch":
        if (inBox && (((x - o.x + y - o.y) % o.period) + o.period) % o.period === 0) color = o.role;
        break;
      case "clusters":
        if (
          inBox &&
          pixelHash(floorDiv(x - o.x, o.cell), floorDiv(y - o.y, o.cell), (seed + o.salt) >>> 0) %
            100 <
            o.density
        )
          color = o.role;
        break;
      case "clip":
        if (inBox) {
          const c = sampleOps(o.ops, x, y, seed);
          if (c >= 0) color = c;
        }
        break;
      case "use": {
        if (o.scale < 1 || o.scale > 16) throw Error("Part scale must be 1..16");
        let px = floorDiv(x - o.x, o.scale),
          py = floorDiv(y - o.y, o.scale);
        if (o.flipX) px = o.width - 1 - px;
        if (o.flipY) py = o.height - 1 - py;
        const c = sampleOps(o.ops, px, py, seed);
        if (c >= 0) color = c;
        break;
      }
      case "outline": {
        const px = x - o.x,
          py = y - o.y;
        if (
          sampleOps(o.ops, px, py, seed) < 0 &&
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([dx, dy]) => sampleOps(o.ops, px + dx, py + dy, seed) >= 0)
        )
          color = o.role;
        break;
      }
      case "technique": {
        const c = sampleOps(o.ops, x - o.x, y - o.y, seed);
        if (c >= 0) color = c;
        break;
      }
    }
  }
  return color;
}
export function renderFrame(input, frameIndex = 0) {
  const r = parseRecipe(input),
    scene = lowerFrame(r, frameIndex),
    data = new Uint8Array(r.width * r.height * 4);
  renderRows(scene, data, 0, r.height);
  return { width: r.width, height: r.height, data };
}
/** Internal row kernel shared by synchronous baking and cooperative CPU previews. */
export function renderRows(scene, data, first, last) {
  const sample = (x, y) => {
    if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) return -1;
    let color = -1;
    for (const layer of scene.layers) {
      const c = sampleOps(layer.ops, x - layer.offset[0], y - layer.offset[1], scene.seed);
      if (c >= 0) color = c;
    }
    return color;
  };
  for (let y = first; y < last; y++)
    for (let x = 0; x < scene.width; x++) {
      const color = sample(x, y);
      if (color >= 0) {
        if (!scene.colors[color]) throw Error("Technique returned an invalid palette index");
        data.set([...scene.colors[color], 255], (x + y * scene.width) * 4);
      } else if (scene.outline?.offsets.some(([dx, dy]) => sample(x + dx, y + dy) >= 0)) {
        data.set([...scene.outline.color, 255], (x + y * scene.width) * 4);
      }
    }
}
export function registerTechnique(input, module) {
  const r = copy(input);
  r.techniques ??= [];
  r.techniques = r.techniques.filter((t) => t.id !== module.id);
  r.techniques.push(copy(module));
  return parseRecipe(r);
}
function editingRecipe(input, frame, layer) {
  const r = parseRecipe(input);
  integer(frame, 0, r.frames.length - 1, "edit.frame");
  if (!r.layers.some((l) => l.id === layer)) throw Error("Unknown paint layer");
  return r;
}
export function editPixel(input, frame, layer, x, y, role) {
  const r = editingRecipe(input, frame, layer);
  integer(x, 0, r.width - 1, "paint.x");
  integer(y, 0, r.height - 1, "paint.y");
  r.frames[frame].layers ??= {};
  const patch = (r.frames[frame].layers[layer] ??= {});
  const [ox, oy] = patch.offset ?? [0, 0];
  patch.ops ??= [];
  patch.ops.push({ op: "rect", x: x - ox, y: y - oy, w: 1, h: 1, role });
  return parseRecipe(r);
}
function layerPixels(recipe, frame, layer) {
  const r = copy(recipe);
  // Editing tools sample source pixels, never bake the composited effect into a layer.
  delete r.outline;
  r.layers = r.layers.map((l) => ({ ...l, visible: l.id === layer }));
  return renderFrame(r, frame);
}
export function floodFill(input, frame, layer, x, y, role) {
  const r = editingRecipe(input, frame, layer);
  integer(x, 0, r.width - 1, "fill.x");
  integer(y, 0, r.height - 1, "fill.y");
  const pixels = layerPixels(r, frame, layer),
    at = (x + y * r.width) * 4,
    target = Array.from(pixels.data.subarray(at, at + 4)).join(","),
    seen = new Set(),
    queue = [[x, y]],
    points = [];
  while (queue.length) {
    const [px, py] = queue.pop(),
      key = px + py * r.width;
    if (px < 0 || py < 0 || px >= r.width || py >= r.height || seen.has(key)) continue;
    seen.add(key);
    if (Array.from(pixels.data.subarray(key * 4, key * 4 + 4)).join(",") !== target) continue;
    points.push([px, py]);
    queue.push([px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]);
  }
  r.frames[frame].layers ??= {};
  const patch = (r.frames[frame].layers[layer] ??= {});
  const [ox, oy] = patch.offset ?? [0, 0];
  patch.ops ??= [];
  for (const [px, py] of points)
    patch.ops.push({ op: "rect", x: px - ox, y: py - oy, w: 1, h: 1, role });
  return parseRecipe(r);
}
export function moveSelection(input, frame, layer, box, dx, dy) {
  const r = editingRecipe(input, frame, layer);
  object(box, "selection");
  integer(box.x, 0, r.width - 1, "selection.x");
  integer(box.y, 0, r.height - 1, "selection.y");
  integer(box.w, 1, r.width - box.x, "selection.w");
  integer(box.h, 1, r.height - box.y, "selection.h");
  integer(dx, -512, 512, "selection.dx");
  integer(dy, -512, 512, "selection.dy");
  const pixels = layerPixels(r, frame, layer),
    ink = {},
    roles = Object.keys(r.palette);
  for (let i = 0; i < roles.length; i++) ink[String.fromCharCode(0x100 + i)] = roles[i];
  const rows = [];
  for (let y = 0; y < box.h; y++) {
    let row = "";
    for (let x = 0; x < box.w; x++) {
      const px = box.x + x,
        py = box.y + y,
        at = (px + py * r.width) * 4;
      if (px < 0 || py < 0 || px >= r.width || py >= r.height || !pixels.data[at + 3]) {
        row += ".";
        continue;
      }
      const hex =
        "#" +
        [...pixels.data.subarray(at, at + 3)].map((c) => c.toString(16).padStart(2, "0")).join("");
      row += String.fromCharCode(
        0x100 + roles.findIndex((role) => r.palette[role].toLowerCase() === hex),
      );
    }
    rows.push(row);
  }
  r.frames[frame].layers ??= {};
  const patch = (r.frames[frame].layers[layer] ??= {});
  const [ox, oy] = patch.offset ?? [0, 0];
  patch.ops ??= [];
  patch.ops.push(
    { op: "rect", ...box, x: box.x - ox, y: box.y - oy, role: null },
    { op: "mask", x: box.x + dx - ox, y: box.y + dy - oy, rows, ink },
  );
  return parseRecipe(r);
}
