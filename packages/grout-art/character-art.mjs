/** Original native-grid character drawings. No reference pixels or extracted ramps.
 * Named operations are versioned creator techniques; all coordinates are integers.
 * A body always occupies the same 16-pixel design space, regardless of export padding.
 */
export const DIRECTIONS = ["south", "west", "east", "north"];
export const CHARACTER_FRAMES = DIRECTIONS.flatMap(d => [0, 1, 2].map(p => `${d}-${p}`));
export const SLOT_LAYERS = {
  head: ["head"], hair: ["rear-hair", "front-hair"], hat: ["hat"],
  body: ["torso", "far-arm", "near-arm"], clothing: ["clothing"],
  legs: ["far-leg", "near-leg"], shoes: ["far-shoe", "near-shoe"], bag: ["bag"],
};
export const hashCharacter = (text, seed = 0) => {
  let h = (seed ^ 2166136261) >>> 0;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15;
  return h >>> 0;
};
const mix = (a, b, amount) => "#" + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount).toString(16).padStart(2, "0")).join("");
export function characterPalette(doc) {
  const c = doc.creator, p = c.palettes.find(v => v.id === doc.palette),
    skin = c.skinRamps[doc.skin], hair = c.hairRamps[doc.hairColor],
    shade = c.styles.find(v => v.id === doc.style).shaded,
    outline = "#28303c", leather = "#705746";
  return {
    outline, skin: skin[1], skinLight: shade ? skin[2] : skin[1],
    skinShadow: shade ? skin[0] : hair[1], hair: hair[1],
    hairLight: shade ? hair[2] : hair[1], hairShadow: shade ? hair[0] : outline,
    cloth: p.cloth, clothLight: shade ? mix(p.cloth, "#f6e7c6", .30) : p.cloth,
    clothShadow: shade ? mix(p.cloth, outline, .35) : outline,
    hat: p.hat, hatLight: shade ? mix(p.hat, "#f6e7c6", .30) : p.hat,
    accent: p.accent, leather, shoeLight: shade ? mix(leather, "#f6e7c6", .25) : leather,
    ...doc.paletteOverrides,
  };
}
// Drawing helpers retain role-valued editable masks, including purposeful negative space.
function drawing() {
  const pixels = new Map();
  const put = (x, y, role) => { if (role) pixels.set(`${x},${y}`, role); else pixels.delete(`${x},${y}`); };
  const rect = (x, y, w, h, role) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, role); };
  const shape = (x, y, widths, role, contour) => {
    const wide = Math.max(...widths);
    for (let row = 0; row < widths.length; row++) {
      const left = Math.floor((wide - widths[row]) / 2);
      rect(x + left, y + row, widths[row], 1, role);
    }
    if (contour) {
      const keys = [...pixels.keys()];
      for (const key of keys) {
        const [px, py] = key.split(",").map(Number);
        if ([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => !pixels.has(`${px+dx},${py+dy}`))) put(px, py, contour);
      }
    }
  };
  const ops = () => {
    if (!pixels.size) return [];
    const coords = [...pixels.keys()].map(k => k.split(",").map(Number));
    const x = Math.min(...coords.map(p => p[0])), y = Math.min(...coords.map(p => p[1])),
      right = Math.max(...coords.map(p => p[0])), bottom = Math.max(...coords.map(p => p[1])),
      roles = [...new Set(pixels.values())], ink = Object.fromEntries(roles.map((r, i) => [String.fromCharCode(65 + i), r])), rows = [];
    for (let py = y; py <= bottom; py++) {
      let row = "";
      for (let px = x; px <= right; px++) {
        const role = pixels.get(`${px},${py}`);
        row += role ? String.fromCharCode(65 + roles.indexOf(role)) : ".";
      }
      rows.push(row);
    }
    return [{ op: "mask", x, y, rows, ink }];
  };
  return { put, rect, shape, ops };
}

/** Expand one slot into its directional, articulated layers. Shapes share design
 * parameters across every frame; only the rig pose changes during the walk. */
export function drawCharacterSlot(doc, slot, option, direction, pose) {
  const rig = doc.creator.builds.find(v => v.id === doc.build), style = doc.creator.styles.find(v => v.id === doc.style),
    profile = direction === "west" || direction === "east", east = direction === "east",
    back = direction === "north", bob = pose === 0 ? -1 : 0,
    params = doc.mode === "authored" ? {} : doc.parameters[slot.id] ?? {},
    design = option.drawing ?? {}, variant = design.variant ?? option.id,
    get = (key, fallback) => params[key] ?? slot.parameters[key]?.default ?? fallback,
    random = (key, n) => hashCharacter(`${slot.id}:${key}`, doc.slotSeeds?.[slot.id] ?? doc.seed) % n,
    procedural = doc.mode === "procedural", contour = style.outline ? "outline" : null,
    w = rig.headWidth - (profile ? 1 : 0), h = rig.headHeight,
    hx = Math.floor((16 - w) / 2), hy = rig.headY + bob,
    torsoY = rig.torsoY + bob, tw = rig.torsoWidth - (profile ? 1 : 0), tx = Math.floor((16 - tw) / 2),
    result = Object.fromEntries(slot.layers.map(id => [id, { ops: [], visible: true }]));
  const emit = (layer, d, visible = true) => { if (result[layer]) result[layer] = { ops: d.ops(), visible }; };
  const d = drawing();
  if (variant === "none") return result;
  if (slot.id === "head") {
    const cuts = design.cuts ?? (variant === "square" ? [1,0,0,0,0,0,1,1] : variant === "tapered" ? [2,1,0,0,0,1,2,2] : [2,1,0,0,0,1,1,2]);
    const widths = Array.from({length: h}, (_, i) => Math.max(3, w - Math.min(cuts[i] ?? 2, Math.floor(w / 2) - 1) * 2));
    if (style.id === "soft") widths[0] = Math.max(3, w - 4);
    d.shape(hx, hy, widths, "skin", contour);
    if (style.shaded) { d.rect(hx + 2, hy + 1, Math.max(1,w - 4), 1, "skinLight"); d.rect(hx + 2, hy + h - 2, Math.max(1,w - 4), 1, "skinShadow"); }
    if (!back) {
      const ey = hy + h - 3, inset = w >= 9 ? 3 : w <= 6 ? 1 : 2;
      if (profile) {
        d.put(east ? hx + w - 2 : hx + 1, ey, "outline");
        d.put(east ? hx + w - 1 : hx, ey + 1, "skin");
      } else { d.put(hx + inset, ey, "outline"); d.put(hx + w - 1 - inset, ey, "outline"); }
    }
    emit("head", d);
  } else if (slot.id === "hair") {
    const rear = drawing(), front = drawing(), length = get("length", variant === "bob" || variant === "ponytail" ? 2 : 0), fringe = get("fringe", 1),
      crown = hy - (style.shaded ? 1 : 0), gap = procedural ? random("part", Math.max(1,w - 4)) : variant === "swept" ? 2 : 0;
    const widths = [w - 4, w - 2, w, w];
    // Short cuts stop at the ears instead of surrounding the chin like a beard.
    // Longer cuts end in a tapered mat; the ponytail is a separate rear feature.
    const rearHeight = variant === "bob" ? h + length : Math.max(4, h - 2 + (procedural ? random("nape", 2) : 0));
    rear.shape(hx, crown, [...widths, ...Array(Math.max(0,rearHeight - 5)).fill(w), ...(rearHeight > 4 ? [w - 2] : [])], "hair", contour);
    if (variant === "ponytail") {
      rear.shape(east ? hx - 2 : hx + w - 1, crown + 3, [2,3,2,2,1], "hair", contour);
      rear.put(east ? hx - 1 : hx + w - 1, crown + 3, "accent");
    }
    if (back) { if (style.shaded) rear.rect(hx + 2, crown + 1, Math.max(1,w - 5), 2, "hairLight"); emit("front-hair", rear); }
    else {
      front.shape(hx, crown, [w - 4, w - 2, w, ...(style.id === "soft" ? [w - 1] : [])], "hair", contour);
      const edgeY = crown + 3;
      for (let i = 1; i < w - 1; i++) {
        const depth = variant === "crop" ? 0 : (i < Math.floor(w / 2) + gap ? fringe : Math.max(0,fringe - 1));
        front.rect(hx + i, edgeY, 1, Math.min(depth, 2), "hair");
      }
      if (profile) front.rect(east ? hx : hx + w - 3, crown + 2, 3, h - 2, "hair");
      else { front.rect(hx, crown + 2, 1, h - 3, contour ?? "hair"); front.rect(hx + w - 1, crown + 2, 1, h - 3, contour ?? "hair"); }
      if (style.shaded) front.rect(hx + 2, crown + 1, Math.max(1,w - 5), 1, "hairLight");
      emit("front-hair", front); emit("rear-hair", rear);
    }
  } else if (slot.id === "hat") {
    const height = get("crown", 3) + (procedural ? random("crown", 2) : 0), y = hy + 2 - height, wide = variant === "brim";
    if (variant === "hood") {
      d.shape(hx - 1, hy - 1, [w - 3,w - 1,w + 1,...Array(h - 1).fill(w + 1)], "hat", contour);
      // A transparent face opening, with an authored lower edge, not a filled mask.
      if (!back) d.rect(hx + 1, hy + 2, w - 2, h - 3, null);
    } else {
      d.shape(hx, y, [w - 4,w - 2,...Array(Math.max(1,height - 1)).fill(w)], "hat", contour);
      d.rect(hx - (wide ? 2 : profile ? 1 : 0), hy + 2, w + (wide ? 4 : profile ? 2 : 0), 1, contour ?? "hat");
      if (wide) d.rect(hx - 1, hy + 1, w + 2, 1, "hat");
      if (style.shaded) d.rect(hx + 2, y + 1, Math.max(1,w - 5), 1, "hatLight");
    }
    emit("hat", d);
  } else if (slot.id === "body") {
    d.shape(tx, torsoY, [tw - 2,tw,tw,tw - 2], "skin", contour); emit("torso", d);
    const contact = pose === 1 ? -1 : pose === 2 ? 1 : 0;
    for (const near of [false,true]) {
      const arm = drawing(), x = profile ? 7 + (near ? -contact : contact) : near ? tx + tw - 2 : tx - 1,
        y = torsoY + (profile ? 0 : (near ? contact : -contact) > 0 ? 1 : 0);
      arm.shape(x, y, [2,3,3,2], "skin", contour);
      arm.put(x + (east ? 0 : 1), y + 2, "skin");
      emit(near ? "near-arm" : "far-arm", arm);
    }
  } else if (slot.id === "clothing") {
    const hem = get("hem", variant === "tunic" ? 1 : 0), sleeves = get("sleeves", 1);
    d.shape(tx, torsoY, [tw - 2,tw,tw,...Array(hem + 1).fill(tw - 2)], "cloth", contour);
    if (variant === "vest") { d.rect(7, torsoY + 1, 2, 2, "accent"); if (!back) d.put(7, torsoY, "skin"); }
    else if (variant === "tunic") d.rect(tx + 1, torsoY + 2, Math.max(1,tw - 2), 1, "leather");
    if (sleeves) { d.rect(tx - 1, torsoY + 1, 1, Math.min(2,sleeves), contour ?? "cloth"); d.rect(tx + tw, torsoY + 1, 1, Math.min(2,sleeves), contour ?? "cloth"); }
    if (style.shaded) d.rect(tx + 1, torsoY + 1, Math.max(1,tw - 3), 1, "clothLight");
    if (procedural && random("panel", 2)) d.rect(tx + 1, torsoY + 1, 1, 2, "accent");
    emit("clothing", d);
  } else if (slot.id === "legs" || slot.id === "shoes") {
    const stride = pose === 1 ? -1 : pose === 2 ? 1 : 0;
    for (const near of [false,true]) {
      const foot = drawing(), sign = near ? 1 : -1,
        x = profile ? (near ? 6 : 8) + stride * sign * 2 : near ? 5 : 9,
        y = 14 + (profile ? (stride * sign > 0 ? 1 : 0) : stride * sign > 0 ? 1 : 0);
      if (slot.id === "legs") {
        const hipX = profile ? near ? 7 : 8 : x;
        foot.rect(hipX, 12, 2, variant === "shorts" ? 1 : 2, "clothShadow");
        foot.rect(Math.round((hipX + x) / 2), 13, 2, 1, variant === "shorts" ? "skin" : "clothShadow");
        foot.rect(x, 14, 2, y - 13, variant === "shorts" ? "skin" : "clothShadow");
      } else {
        const height = variant === "boots" && y === 14 ? 2 : 1;
        foot.rect(x - (profile && !east ? 1 : 0), y, 3, height, contour ?? "leather");
        foot.put(x + (east ? 1 : 0), y, "leather");
        if (style.shaded && height > 1) foot.put(x, y, "shoeLight");
      }
      emit(`${near ? "near" : "far"}-${slot.id === "legs" ? "leg" : "shoe"}`, foot);
    }
  } else if (slot.id === "bag") {
    const x = profile ? east ? 3 : 10 : 5, width = profile ? 3 : 6;
    d.shape(x, torsoY - 1, [width - 2,width,width,width,width - 2], "leather", contour);
    d.rect(x + 1, torsoY, Math.max(1,width - 2), 1, "accent");
    emit("bag", d, direction !== "south");
  }
  return result;
}
