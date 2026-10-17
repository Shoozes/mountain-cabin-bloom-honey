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
    accent: p.accent, leather, leatherShadow: outline, shoeLight: shade ? mix(leather, "#f6e7c6", .25) : leather,
    ...doc.paletteOverrides,
  };
}
// Drawing helpers retain role-valued editable masks, including purposeful negative space.
function drawing() {
  const pixels = new Map();
  const put = (x, y, role) => { if (role) pixels.set(`${x},${y}`, role); else pixels.delete(`${x},${y}`); };
  const rect = (x, y, w, h, role) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, role); };
  const shape = (x, y, widths, role) => {
    const wide = Math.max(...widths);
    for (let row = 0; row < widths.length; row++) {
      const left = Math.floor((wide - widths[row]) / 2);
      rect(x + left, y + row, widths[row], 1, role);
    }
  };
  const seal = (contour) => {
    if (contour) {
      const keys = [...pixels.keys()];
      for (const key of keys) {
        const [px, py] = key.split(",").map(Number);
        if ([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => !pixels.has(`${px+dx},${py+dy}`))) put(px, py, contour);
      }
    }
  };
  const stamp = (x, y, rows, ink, reflect = false) => {
    rows.forEach((row, j) => [...row].forEach((cell, i) => {
      if (ink[cell]) put(reflect ? 15 - x - i : x + i, y + j, ink[cell]);
    }));
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
  return { put, rect, shape, stamp, seal, ops };
}

// West-facing native keys. Boots articulate at the ankle: the forward foot
// plants, the trailing heel folds up, and both feet gather in the passing key.
// East mirrors the drawing. Equipment and facial identity keep their own order.
const PROFILE_FEET = [
  { near: { x:6,y:13,knee:7,rows:[".oo","olo","oo."] }, far: { x:8,y:13,knee:8,rows:["oo.","olo",".oo"] } },
  { near: { x:4,y:13,knee:7,rows:[".oo","olo","ooo"] }, far: { x:9,y:12,knee:9,rows:["oo.","olo",".oo"] } },
  { near: { x:9,y:12,knee:8,rows:["oo.","olo",".oo"] }, far: { x:4,y:13,knee:7,rows:[".oo","olo","ooo"] } },
];

/** Expand one slot into its directional, articulated layers. Shapes share design
 * parameters across every frame; only the rig pose changes during the walk. */
export function drawCharacterSlot(doc, slot, option, direction, pose) {
  const rig = doc.creator.builds.find(v => v.id === doc.build), style = doc.creator.styles.find(v => v.id === doc.style),
    profile = direction === "west" || direction === "east", east = direction === "east",
    back = direction === "north",
    params = doc.mode === "authored" ? {} : doc.parameters[slot.id] ?? {},
    design = option.drawing ?? {}, variant = design.variant ?? option.id,
    get = (key, fallback) => params[key] ?? slot.parameters[key]?.default ?? fallback,
    random = (key, n) => hashCharacter(`${slot.id}:${key}`, doc.slotSeeds?.[slot.id] ?? doc.seed) % n,
    procedural = doc.mode === "procedural", contour = style.outline ? "outline" : null,
    w = rig.headWidth - (profile && rig.headWidth > 6 ? 2 : 0), h = rig.headHeight, browLift = Math.max(0, 7 - h),
    hx = Math.floor((16 - w) / 2), hy = rig.headY,
    torsoY = rig.torsoY, tw = rig.torsoWidth - (profile ? 1 : 0), tx = Math.floor((16 - tw) / 2),
    result = Object.fromEntries(slot.layers.map(id => [id, { ops: [], visible: true }]));
  const emit = (layer, d, visible = true, join) => {
    // Finish the authored mask after fills, face marks and material planes.
    // Imported/painted custom options never pass through this drawing function.
    d.seal(contour);
    join?.();
    if (result[layer]) result[layer] = { ops: d.ops(), visible };
  };
  const d = drawing();
  if (variant === "none") return result;
  if (slot.id === "head") {
    const cuts = design.cuts ?? (variant === "square" ? [1,0,0,0,0,0,1,1] : variant === "tapered" ? [2,1,0,0,0,1,2,2] : [2,1,0,0,0,1,1,2]);
    const widths = Array.from({length: h}, (_, i) => Math.max(2, w - Math.min(cuts[i] ?? 2, Math.floor(w / 2) - 1) * 2));
    if (style.id === "soft") widths[0] = Math.max(2, w - 4);
    // Contour edits keep a full-width temple and a readable face plane. This
    // also keeps extreme custom cuts centered instead of shifting the mask.
    widths[Math.floor(h / 2)] = w;
    widths[h - 3] = Math.max(widths[h - 3],Math.min(w,profile ? 6 : 8));
    d.shape(hx, hy, widths, "skin");
    if (style.shaded) { d.rect(hx + 2, hy + 1, Math.max(1,w - 4), 1, "skinLight"); d.rect(hx + 2, hy + h - 2, Math.max(1,w - 4), 1, "skinShadow"); }
    if (!back) {
      const ey = hy + h - 3, inset = w >= 9 ? 3 : w <= 6 ? 1 : 2;
      if (profile) {
        const faceInset = Math.floor((w - widths[h - 3]) / 2) + 2;
        d.put(east ? hx + w - 1 - faceInset : hx + faceInset, ey, "outline");
      } else { d.put(hx + inset, ey, "outline"); d.put(hx + w - 1 - inset, ey, "outline"); }
    }
    emit("head", d);
  } else if (slot.id === "hair") {
    const rear = drawing(), front = drawing(), length = get("length", variant === "bob" || variant === "ponytail" ? 2 : 0), fringe = get("fringe", 1),
      crown = hy - browLift - (style.shaded ? 1 : 0), gap = procedural ? random("part", Math.max(1,w - 4)) : variant === "swept" ? 2 : 0;
    const widths = [w - 4, w - 2, w, w];
    // Short cuts stop at the ears instead of surrounding the chin like a beard.
    // Longer cuts end in a tapered mat; the ponytail is a separate rear feature.
    const rearHeight = variant === "bob" ? h + length : Math.max(4, h - 2 + (procedural ? random("nape", 2) : 0));
    rear.shape(hx, crown, [...widths, ...Array(Math.max(0,rearHeight - 5)).fill(w), ...(rearHeight > 4 ? [w - 2] : [])], "hair");
    if (variant === "ponytail") {
      if (profile) {
        rear.shape(east ? hx - 2 : hx + w - 1, crown + 3, [2,3,2,2,1], "hair");
        rear.put(east ? hx - 1 : hx + w, crown + 4, "accent");
      } else {
        rear.shape(6, crown + h - 2, [2,4,2,2], "hair");
        rear.rect(7, crown + h - 1, 2, 1, "accent");
      }
    }
    if (back) { if (style.shaded) rear.rect(hx + 2, crown + 1, w - 4, 2, "hairLight"); emit("front-hair", rear); }
    else {
      front.shape(hx, crown, [w - 4, w - 2, w, ...(style.id === "soft" && !browLift ? [w - 2] : [])], "hair");
      const edgeY = crown + 3;
      for (let i = 1; i < w - 1; i++) {
        const edge = profile ? i : Math.min(i,w - 1 - i),
          threshold = profile ? Math.floor(w / 2) + gap : 2 + gap % 2,
          depth = variant === "crop" ? 0 : edge < threshold ? fringe : Math.max(0,fringe - 1);
        front.rect(hx + i, edgeY, 1, Math.min(depth, 2), "hair");
      }
      if (profile) {
        const sideWidth = Math.min(3, w - 4);
        front.rect(east ? hx : hx + w - sideWidth, crown + 2, sideWidth, h - 2 + browLift, "hair");
      }
      else { front.rect(hx, crown + 2, 1, h - 3, contour ?? "hair"); front.rect(hx + w - 1, crown + 2, 1, h - 3, contour ?? "hair"); }
      if (style.shaded) front.rect(hx + 2, crown + 1, w - 4, 1, "hairLight");
      // The sideburn joins the filled head rather than owning a second dark
      // seam. Keep its inner hair plane; the outer and lower contours stay inked.
      const sideWidth = Math.min(3,w - 4);
      emit("front-hair", front, true, contour && profile ? () => front.rect(east ? hx + sideWidth - 1 : hx + w - sideWidth,crown + 2,1,h - 3 + browLift,"hair") : null);
      emit("rear-hair", rear);
    }
  } else if (slot.id === "hat") {
    const height = get("crown", 3) + (procedural ? random("crown", 2) : 0), brimY = hy + 2 - browLift, y = brimY - height, wide = variant === "brim";
    if (variant === "hood") {
      d.shape(hx - 1, hy - 1, [w - 2,w,w + 2,...Array(h - 1).fill(w + 2)], "hat");
      // A transparent face opening, with an authored lower edge, not a filled mask.
      if (!back) d.rect(hx + 1, brimY, w - 2, h - 3 + browLift, null);
    } else {
      d.shape(hx, y, [w - 4,w - 2,...Array(Math.max(1,height - 1)).fill(w)], "hat");
      d.rect(hx - (wide ? 2 : profile ? 1 : 0), brimY, w + (wide ? 4 : profile ? 2 : 0), 1, contour ?? "hat");
      if (wide) d.rect(hx - 1, brimY - 1, w + 2, 1, "hat");
      if (style.shaded) d.rect(hx + 2, y + 1, w - 4, 1, "hatLight");
    }
    emit("hat", d);
  } else if (slot.id === "body") {
    // A quiet upper body leaves the stride to the limbs. Three torso rows keep
    // a visible hip/knee interval instead of pinning square boots to the hem.
    d.shape(tx, torsoY, [tw - 2,tw,tw - 2], "skin"); emit("torso", d);
    for (const near of [false,true]) {
      const arm = drawing(), phase = near ? pose : pose ? 3 - pose : 0,
        ink = { o: contour ?? "skin", c: "skin", s: "skin" };
      if (profile) {
        const rows = phase === 1 ? ["oo..","oco.",".oso","..oo"] : phase === 2 ? ["..oo",".oco","oso.","oo.."] : [".o.","oco","oso",".o."],
          x = phase === 2 ? 4 : 7;
        arm.stamp(x, torsoY - 1, rows, ink, east);
      } else {
        const y = torsoY + (phase === 1 ? -1 : phase === 2 ? 1 : 0),
          x = near ? tx + tw - 1 : tx - 2;
        arm.stamp(x, y, near ? ["oo.","oco","oso",".o."] : [".oo","oco","oso",".o."], ink);
      }
      emit(near ? "near-arm" : "far-arm", arm);
    }
  } else if (slot.id === "clothing") {
    const hem = get("hem", variant === "tunic" ? 1 : 0), sleeves = get("sleeves", 1);
    d.shape(tx, torsoY, [tw - 2,tw,...Array(hem + 1).fill(tw - 2)], "cloth");
    if (variant === "vest") { d.rect(7, torsoY + 1, 2, 2, "accent"); if (!back) d.rect(7, torsoY, profile ? 1 : 2, 1, "skin"); }
    else if (variant === "tunic") d.rect(tx + 1, torsoY + 2, Math.max(1,tw - 2), 1, "leather");
    if (sleeves) { d.rect(tx - 1, torsoY + 1, 1, Math.min(2,sleeves), contour ?? "cloth"); d.rect(tx + tw, torsoY + 1, 1, Math.min(2,sleeves), contour ?? "cloth"); }
    if (style.shaded) d.rect(tx + 1, torsoY + 1, tw - 2, 1, "clothLight");
    if (procedural && random("panel", 2)) {
      d.rect(tx + 1, torsoY + 1, 1, 2, "accent");
      if (!profile) d.rect(tx + tw - 2, torsoY + 1, 1, 2, "accent");
    }
    emit("clothing", d);
  } else if (slot.id === "legs" || slot.id === "shoes") {
    for (const near of [false,true]) {
      const foot = drawing(), phase = near ? pose : pose ? 3 - pose : 0,
        key = profile ? PROFILE_FEET[pose][near ? "near" : "far"] : null,
        x = profile ? key.x : near ? 8 : 5,
        y = profile ? key.y : phase === 2 ? 12 : 13,
        put = (px,py,role) => foot.put(profile && east ? 15 - px : px,py,role);
      if (slot.id === "legs") {
        const hipX = profile ? near ? 7 : 8 : near ? 9 : 5,
          kneeX = profile ? key.knee : near ? 9 : 6,
          kneeY = Math.min(13,y), role = variant === "shorts" ? "skin" : "clothShadow";
        for (const dx of [0,1]) put(hipX + dx,12,"clothShadow");
        foot.stamp(kneeX - 1,kneeY - 1,[".o.","oso",".o."],{o:contour ?? role,s:role},profile && east);
      } else {
        const ink = { o: contour ?? "leather", l: profile && !near ? "leatherShadow" : "shoeLight" },
          rows = profile ? [...key.rows] : ["ooo","olo",near ? ".oo" : "oo."];
        if (variant === "soft") rows[0] = ".o.";
        foot.stamp(x, y, rows, ink, profile && east);
      }
      emit(`${near ? "near" : "far"}-${slot.id === "legs" ? "leg" : "shoe"}`, foot);
    }
  } else if (slot.id === "bag") {
    const x = profile ? east ? 3 : 10 : 5, width = profile ? 3 : 6;
    d.shape(x, torsoY - 1, [width - 2,width,width,width,width - 2], "leather");
    d.rect(x + 1, torsoY, Math.max(1,width - 2), 1, "leatherShadow");
    emit("bag", d, direction !== "south");
  }
  return result;
}
