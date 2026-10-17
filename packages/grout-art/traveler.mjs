/** Original native16 traveler: broad top-down masses and authored contact/pass poses. */
import { copy, parseRecipe } from "./core.mjs";
const mask = (rows, ink, x = 0, y = 0) => ({ op: "mask", rows, ink, x, y });
const palette = {
  outline: "#26323f",
  hair: "#925b3f",
  skinShadow: "#925b3f",
  skin: "#edc17f",
  skinLight: "#edc17f",
  clothShadow: "#26323f",
  cloth: "#6b9b60",
  clothLight: "#6b9b60",
  boot: "#26323f",
  bootLight: "#925b3f",
  cap: "#6b9b60",
  accent: "#edc17f",
  tunic: "#edc17f",
  vest: "#925b3f",
};
// Apparel owns these roles. Face, leather and contour colors never change here.
const apparelPalettes = {
  fern: {
    cloth: "#6b9b60",
    clothLight: "#6b9b60",
    cap: "#6b9b60",
    accent: "#edc17f",
    tunic: "#edc17f",
    vest: "#925b3f",
  },
  cinder: {
    cloth: "#559b96",
    clothLight: "#559b96",
    cap: "#c66c53",
    accent: "#efc785",
    tunic: "#d5dcab",
    vest: "#c66c53",
  },
  heather: {
    cloth: "#9b83b4",
    clothLight: "#9b83b4",
    cap: "#cbac61",
    accent: "#efe0ac",
    tunic: "#dfccda",
    vest: "#cbac61",
  },
  harbor: {
    cloth: "#6496bf",
    clothLight: "#6496bf",
    cap: "#dfd4ad",
    accent: "#c67563",
    tunic: "#dfd4ad",
    vest: "#c67563",
  },
};
export const TRAVELER_PALETTES = Object.freeze([
  Object.freeze({ id: "fern", name: "Fern · original" }),
  Object.freeze({ id: "cinder", name: "Cinder · teal & rust" }),
  Object.freeze({ id: "heather", name: "Heather · violet & ochre" }),
  Object.freeze({ id: "harbor", name: "Harbor · blue & linen" }),
]);
const faceInk = { h: "hair", o: "outline", s: "skin", d: "skinShadow", l: "skinLight" };
const shirtInk = { o: "outline", c: "cloth", l: "clothLight", d: "clothShadow" };
const leatherInk = { b: "boot", t: "bootLight", a: "accent" };
// Head is almost half the native height. Nose, hair mass and cap brim establish facing.
const faces = {
  south: [
    "..oooooo..",
    ".ohhhhhho.",
    "ohhsssshho",
    "ohssssssho",
    "ohssssssho",
    ".osossoso.",
    "..osssso..",
    "...oddo...",
  ],
  west: [
    "..oooooo..",
    ".ohhhhhho.",
    "ohhhhhhhho",
    "olssshhhho",
    "ossssshhho",
    "ososhhhhho",
    ".ossshhho.",
    "..odddoo..",
  ],
  east: [
    "..oooooo..",
    ".ohhhhhho.",
    "ohhhhhhhho",
    "ohhhhssslo",
    "ohhhssssso",
    "ohhhhhsoso",
    ".ohhhssso.",
    "..oodddo..",
  ],
  north: [
    "..oooooo..",
    ".ohhhhhho.",
    "ohhhhhhhho",
    "ohhhhhhhho",
    "ohhhhhhhho",
    ".ohhhhhho.",
    "..ohhhho..",
    "...oddo...",
  ],
};
const coats = {
  south: [".occcco.", ".occcco.", "..occo.."],
  west: [".occco..", ".occcco.", "..occo.."],
  east: ["..occco.", ".occcco.", "..occo.."],
  north: [".occcco.", ".occcco.", "..occo.."],
};
const caps = {
  south: [
    "......oo....",
    "....oocoo...",
    "...occccco..",
    "..ocaccccco.",
    ".occcccccco.",
    "oooccccoooo.",
  ],
  west: [
    "......oo....",
    "....oocoo...",
    "..ooccccco..",
    ".ocaccccco..",
    "occcccccco..",
    ".ooocccooo..",
  ],
  east: [
    "....oo......",
    "...oocoo....",
    "..occcccoo..",
    "..occcccaco.",
    "..occcccccco",
    "..ooocccooo.",
  ],
  north: [
    "......oo....",
    "....oocoo...",
    "...occccco..",
    "..occccccco.",
    "..occccccco.",
    "...oooooo...",
  ],
};
// Garments share the accepted native torso/head envelope. One material plane
// per outfit and one silhouette change per hat; anatomy is never regenerated.
const clothingDrawings = {
  coat: coats,
  tunic: {
    south: [".oooooo.", ".ocppco.", "..oppo.."],
    west: [".ooooo..", ".ocppco.", "..oppo.."],
    east: ["..ooooo.", ".ocppco.", "..oppo.."],
    north: [".oooooo.", ".ocppco.", "..oppo.."],
  },
  vest: {
    south: [".oooooo.", ".ovccvo.", "..ovvo.."],
    west: [".ooooo..", ".ovccvo.", "..ovvo.."],
    east: ["..ooooo.", ".ovccvo.", "..ovvo.."],
    north: [".oooooo.", ".ovvvvo.", "..ovvo.."],
  },
};
const roundCapWest = [
  "...oooooo...",
  "..occcccco..",
  ".occcccccco.",
  ".ocacccccco.",
  ".occcccccco.",
  "..oooooooo..",
];
const trailWest = [
  "............",
  "....oooo....",
  "...occcco...",
  "..ocaccco...",
  ".occccccco..",
  "ooocccoooo..",
];
const hatDrawings = {
  cap: caps,
  round: {
    south: roundCapWest,
    west: roundCapWest,
    east: roundCapWest.map((row) => [...row].reverse().join("")),
    north: [
      "...oooooo...",
      "..occcccco..",
      ".occcccccco.",
      ".occcccccco.",
      ".occcccccco.",
      "..oooooooo..",
    ],
  },
  trail: {
    south: [
      "............",
      "...ooooo....",
      "..occccco...",
      "..ocacccco..",
      ".occcccccco.",
      "oooccccoooo.",
    ],
    west: trailWest,
    east: trailWest.map((row) => [...row].reverse().join("")),
    north: [
      "............",
      "...ooooo....",
      "..occccco...",
      "..occcccco..",
      ".occcccccco.",
      "..oooooooo..",
    ],
  },
};
export const TRAVELER_CLOTHING = Object.freeze([
  Object.freeze({ id: "coat", name: "Travel coat" }),
  Object.freeze({ id: "tunic", name: "Linen tunic" }),
  Object.freeze({ id: "vest", name: "Trail vest" }),
]);
export const TRAVELER_HATS = Object.freeze([
  Object.freeze({ id: "cap", name: "Wool cap" }),
  Object.freeze({ id: "round", name: "Round cap" }),
  Object.freeze({ id: "trail", name: "Trail hat" }),
]);
const clothingPart = (id, dir) => [
  mask(
    clothingDrawings[id][dir],
    id === "coat" ? shirtInk : { ...shirtInk, p: "tunic", v: "vest" },
    4,
    10,
  ),
];
const hatPart = (id, dir) => [
  mask(hatDrawings[id][dir], { o: "outline", c: "cap", a: "accent", d: "clothShadow" }, 2, 1),
];
function wardrobeOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options))
    throw Error("Traveler wardrobe: expected options");
  for (const key of Object.keys(options)) {
    const choices =
      key === "clothing"
        ? clothingDrawings
        : key === "hat"
          ? hatDrawings
          : key === "palette"
            ? apparelPalettes
            : null;
    if (!choices || typeof options[key] !== "string" || !Object.hasOwn(choices, options[key]))
      throw Error("Unknown traveler " + key);
  }
  return options;
}
// Compact feet overlap in passing, then separate in depth at contact. The near
// sole stays at y15; a lifted far foot ends at y14. No four-row boot columns.
const foot = (x, y) => mask(["bbb", "btb", "bbb"], leatherInk, x, y);
function previousFeet(dir, pose) {
  if (dir === "south" || dir === "north") {
    const contact = dir === "north" && pose ? 3 - pose : pose;
    return contact === 0
      ? [foot(6, 12), foot(8, 13)]
      : contact === 1
        ? [foot(9, 12), foot(5, 13)]
        : [foot(4, 12), foot(8, 13)];
  }
  const west =
    pose === 0
      ? [foot(8, 12), foot(6, 13)]
      : pose === 1
        ? [foot(4, 12), foot(8, 13)]
        : [foot(9, 12), foot(4, 13)];
  return dir === "west"
    ? west
    : west.map((op) => ({ ...op, rows: reflect(op.rows), x: 16 - op.x - op.rows[0].length }));
}
// Native contact silhouettes pivot about the hips. The trailing heel lifts and
// folds inward; passing feet tuck together rather than translating square stamps.
function feet(dir, pose) {
  if (dir === "south" || dir === "north") {
    const contact = pose;
    if (contact === 0)
      return [
        mask(["bbb", "btb", "bb."], leatherInk, 5, 13),
        mask(["bbb", "btb", ".bb"], leatherInk, 8, 13),
      ];
    const planted = mask(
      dir === "north" ? [".bb", "btb", "btb", ".bb"] : [".bb", "btb", "btb", "bbb"],
      leatherInk,
      5,
      12,
    );
    const lifted = mask(["bbb", "btb", "bb."], leatherInk, 8, 11);
    return contact === 1
      ? [lifted, planted]
      : [lifted, planted].map((op) => ({
          ...op,
          rows: reflect(op.rows),
          x: 16 - op.x - op.rows[0].length,
        }));
  }
  const west =
    pose === 0
      ? [mask([".bb", "btb", "bbb"], leatherInk, 8, 12), mask([".bb.", "bttb", "bbbb"], leatherInk, 6, 13)]
      : pose === 2
        ? [
            mask(["bbb", "btb", ".b."], leatherInk, 9, 13),
            mask(["..bb", ".btb", "bttb", "bbbb"], leatherInk, 4, 12),
          ]
        : [
            mask([".bb.", "btb.", ".bb."], leatherInk, 4, 12),
            mask(["bb..", "btb.", "bttb", "bbbb"], leatherInk, 8, 12),
          ];
  return dir === "west"
    ? west
    : west.map((op) => ({
        ...op,
        rows: reflect(op.rows),
        x: 16 - op.x - op.rows[0].length,
      }));
}
// Near arm rotates about a fixed shoulder. Wrist follows the sleeve, instead
// of a detached hand translating vertically. Both contacts oppose the near leg.
// East reflects anatomy only; the directional face, cap and gear remain authored.
const profileArms = [
  ["..oo...", "..oco..", "..osso.", "...oo.."],
  ["..oo...", ".ocoo..", "osso...", ".oo...."],
  ["..oo...", "..occo.", "...osso", "....oo."],
];
const facingArms = [
  [".oo.", "occo", "osso", ".oo."],
  [".oo.", "osso", ".ooo"],
  ["..o.", ".oco", ".oso", "..o."],
];
const reflect = (rows) => rows.map((row) => [...row].reverse().join(""));
export function createTravelerRecipe(options = {}) {
  const { clothing = "coat", hat = "cap", palette: colorway = "fern" } = wardrobeOptions(options);
  const parts = {},
    frames = [],
    layers = [
      { id: "bag", name: "Backpack", part: "bag-south", visible: true },
      { id: "body", name: "Body and boots", part: "body-south-0", visible: true },
      {
        id: "clothing",
        name: TRAVELER_CLOTHING.find((item) => item.id === clothing).name,
        part: "coat-south",
        visible: true,
      },
      {
        id: "cap",
        name: TRAVELER_HATS.find((item) => item.id === hat).name,
        part: "cap-south",
        visible: true,
      },
    ];
  const directions = ["south", "west", "east", "north"];
  for (const dir of directions) {
    for (const rows of [faces[dir], clothingDrawings[clothing][dir], hatDrawings[hat][dir]])
      if (rows.some((row) => row.length !== rows[0].length))
        throw Error("Authored traveler masks must use a rectangular native grid: " + dir);
    parts["coat-" + dir] = clothingPart(clothing, dir);
    parts["cap-" + dir] = hatPart(hat, dir);
    parts["bag-" + dir] = [
      mask(
        dir === "north" || dir === "south"
          ? [".bbbb.", "bttttb", "bttttb", ".bbbb."]
          : [".bb.", "bttb", "bttb", ".bb."],
        leatherInk,
        dir === "west" ? 9 : dir === "east" ? 3 : 5,
        dir === "north" || dir === "south" ? 10 : 9,
      ),
    ];
    for (let pose = 0; pose < 3; pose++) {
      const bob = pose === 0 ? -1 : 0,
        profile = dir === "west" || dir === "east",
        armInk = { ...shirtInk, s: dir === "north" ? "skinShadow" : "skin" };
      const arms = profile
        ? [
            mask(
              dir === "west" ? profileArms[pose] : reflect(profileArms[pose]),
              armInk,
              dir === "west" ? 5 : 4,
              10 + bob,
            ),
          ]
        : [
            mask(facingArms[pose], armInk, 3, 10 + bob),
            mask(reflect(facingArms[pose === 0 ? 0 : 3 - pose]), armInk, 9, 10 + bob),
          ];
      parts[`body-${dir}-${pose}`] = [
        mask(faces[dir], faceInk, 3, 3 + bob),
        mask(["oooo", "occo", "oooo"], shirtInk, 6, 11 + bob),
        ...feet(dir, pose),
        ...arms,
      ];
      frames.push({
        name: `${dir}-${pose}`,
        anchor: [8, 15],
        order:
          dir === "south"
            ? ["bag", "body", "clothing", "cap"]
            : dir === "north"
              ? ["body", "clothing", "bag", "cap"]
              : ["bag", "clothing", "body", "cap"],
        layers: {
          body: { part: `body-${dir}-${pose}` },
          clothing: { part: "coat-" + dir, offset: [0, bob] },
          cap: { part: "cap-" + dir, offset: [0, bob] },
          // Complete front occlusion is explicit, including when coat is hidden.
          bag: { part: "bag-" + dir, offset: [0, bob], visible: dir !== "south" },
        },
      });
    }
  }
  const clips = {};
  for (const dir of directions) {
    clips["idle-" + dir] = { frames: [dir + "-0"], fps: 1 };
    clips["walk-" + dir] = { frames: [dir + "-1", dir + "-0", dir + "-2", dir + "-0"], fps: 8 };
  }
  clips.turntable = { frames: ["south-0", "west-0", "north-0", "east-0"], fps: 2 };
  return parseRecipe({
    format: "grout-art/1",
    name: "Fern traveler",
    width: 16,
    height: 16,
    seed: 1204,
    palette: { ...palette, ...apparelPalettes[colorway] },
    parts,
    layers,
    frames,
    clips,
    techniques: [],
  });
}
/** Recognize the accepted anatomy, including old drafts without wardrobe metadata.
 * Custom apparel stays editable; unrelated recipes do not offer traveler controls. */
export function getTravelerWardrobe(input) {
  const r = parseRecipe(input),
    base = createTravelerRecipe(),
    same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (r.width !== 16 || r.height !== 16 || r.frames.length !== 12 || r.layers.length !== 4)
    return null;
  if (base.layers.some((layer) => r.layers.find((l) => l.id === layer.id)?.part !== layer.part))
    return null;
  if (
    base.frames.some((f, i) => {
      const actual = r.frames[i];
      return (
        actual.name !== f.name ||
        !same(actual.anchor, f.anchor) ||
        !same(actual.order, f.order) ||
        Object.keys(f.layers).some((id) => actual.layers?.[id]?.part !== f.layers[id].part) ||
        (!same(r.parts[f.layers.body.part], base.parts[f.layers.body.part]) &&
          !same(r.parts[f.layers.body.part], previousBody(base, f, i)) &&
          !same(r.parts[f.layers.body.part], previousProfileBody(base, f, i)))
      );
    })
  )
    return null;
  const matches = (prefix, make, choices) =>
    choices.find(({ id }) =>
      ["south", "west", "east", "north"].every((dir) => {
        const expected = make(id, dir),
          actual = r.parts[prefix + dir];
        if (same(actual, expected)) return true;
        // Previous wardrobe drafts borrowed skin/hair ink for garment panels.
        if (prefix === "coat-" && id !== "coat") {
          expected[0].ink.p = "skinLight";
          expected[0].ink.v = "hair";
          return same(actual, expected);
        }
        return false;
      }),
    )?.id ?? "custom";
  return {
    clothing: matches("coat-", clothingPart, TRAVELER_CLOTHING),
    hat: matches("cap-", hatPart, TRAVELER_HATS),
    palette:
      TRAVELER_PALETTES.find(({ id }) =>
        Object.entries(apparelPalettes[id]).every(
          ([role, color]) =>
            (r.palette[role] ??
              (role === "tunic"
                ? r.palette.skinLight
                : role === "vest"
                  ? r.palette.hair
                  : undefined)) === color,
        ),
      )?.id ?? "custom",
    walk: base.frames.every((f) =>
      same(r.parts[f.layers.body.part], base.parts[f.layers.body.part]),
    )
      ? "refined"
      : "previous",
  };
}
function previousProfileBody(base, frame, index) {
  const dir = frame.name.split("-")[0], pose = index % 3;
  const ops = base.parts[frame.layers.body.part];
  if (dir === "south" || dir === "north") return ops;
  const west =
    pose === 0
      ? [mask([".bb", "bbb"], leatherInk, 7, 12), mask([".bb.", "bttb", "bbbb"], leatherInk, 6, 13)]
      : pose === 2
        ? [
            mask(["..bb", ".btb", "bbb."], leatherInk, 8, 11),
            mask(["..bb", ".btb", "bttb", "bbbb"], leatherInk, 4, 12),
          ]
        : [
            mask([".bb.", "btb.", ".bbb"], leatherInk, 4, 11),
            mask(["bb..", "btb.", "bttb", "bbbb"], leatherInk, 8, 12),
          ];
  const oldFeet = dir === "west"
    ? west
    : west.map((op) => ({
        ...op,
        rows: reflect(op.rows),
        x: 16 - op.x - op.rows[0].length,
      }));
  return [...ops.slice(0, 2), ...oldFeet, ...ops.slice(4)];
}
function previousBody(base, frame, index) {
  const ops = base.parts[frame.layers.body.part];
  return [
    ...ops.slice(0, 2),
    ...previousFeet(frame.name.split("-")[0], index % 3),
    ...ops.slice(4),
  ];
}
/** Explicit, undoable upgrade for recovered drafts. Keep frame corrections and
 * custom packs; never silently replace an older drawing on load. */
export function refineTravelerWalk(input) {
  const r = parseRecipe(input);
  if (!getTravelerWardrobe(r))
    throw Error("This recipe does not use the accepted traveler anatomy");
  const base = createTravelerRecipe();
  for (const f of base.frames) r.parts[f.layers.body.part] = copy(base.parts[f.layers.body.part]);
  for (const dir of ["south", "north"]) {
    const ops = r.parts["bag-" + dir];
    if (
      JSON.stringify(ops) ===
      JSON.stringify([mask(["bbbbb", "btttb", "btttb", ".bbb."], leatherInk, 6, 10)])
    )
      r.parts["bag-" + dir] = copy(base.parts["bag-" + dir]);
  }
  return parseRecipe(r);
}
/** Replace only the chosen garment's shared drawings. Frame-level painting,
 * palette edits, visibility, timing, equipment and other parts remain intact. */
export function setTravelerWardrobe(input, options) {
  wardrobeOptions(options);
  const r = parseRecipe(input);
  const current = getTravelerWardrobe(r);
  if (!current) throw Error("This recipe does not use the accepted traveler anatomy");
  for (const dir of ["south", "west", "east", "north"]) {
    if (options.clothing || (options.palette && current.clothing !== "custom"))
      r.parts["coat-" + dir] = clothingPart(options.clothing ?? current.clothing, dir);
    if (options.hat) r.parts["cap-" + dir] = hatPart(options.hat, dir);
  }
  // Old drafts gain panel roles only when an apparel action needs them.
  if (options.palette || (options.clothing && options.clothing !== "coat")) {
    r.palette.tunic ??= r.palette.skinLight;
    r.palette.vest ??= r.palette.hair;
  }
  if (options.palette) Object.assign(r.palette, apparelPalettes[options.palette]);
  if (options.clothing)
    r.layers.find((l) => l.id === "clothing").name = TRAVELER_CLOTHING.find(
      (v) => v.id === options.clothing,
    ).name;
  if (options.hat)
    r.layers.find((l) => l.id === "cap").name = TRAVELER_HATS.find(
      (v) => v.id === options.hat,
    ).name;
  return parseRecipe(r);
}
export const HATCH_TECHNIQUE = {
  id: "diagonal-hatch",
  version: 1,
  parameters: {
    spacing: { type: "int", default: 3, min: 1, max: 8 },
    ink: { type: "role", default: "accent" },
  },
  cpu: [{ op: "hatch", x: 0, y: 0, w: 16, h: 16, period: "$spacing", role: "$ink" }],
  glsl: "if(p.x>=0 && p.y>=0 && p.x<16 && p.y<16 && (p.x+p.y)%spacing==0){return ink;} return -1;",
  wgsl: "if(p.x>=0 && p.y>=0 && p.x<16 && p.y<16 && (p.x+p.y)%spacing==0){return ink;} return -1;",
};
export function createExampleRecipe(id = "traveler") {
  const r = createTravelerRecipe();
  if (["traveler", "atlas", "comparison"].includes(id)) return r;
  r.frames = [{ name: "study", anchor: [8, 15] }];
  r.clips = { study: { frames: ["study"], fps: 8 } };
  r.layers = [{ id: "drawing", name: "Technique study", part: "study", visible: true }];
  if (id === "geometry") {
    r.name = "Native geometry";
    r.parts = {
      study: [
        { op: "rect", x: 2, y: 3, w: 12, h: 10, role: "clothShadow" },
        { op: "circle", x: 7, y: 7, r: 4, role: "cloth" },
        { op: "rect", x: 5, y: 5, w: 4, h: 2, role: "clothLight" },
        { op: "rect", x: 8, y: 9, w: 3, h: 3, role: "outline" },
      ],
    };
  } else if (id === "custom-technique") {
    r.name = "Portable custom hatch";
    r.parts = {
      study: [
        { op: "rect", x: 1, y: 1, w: 14, h: 14, role: "clothShadow" },
        {
          op: "clip",
          x: 2,
          y: 2,
          w: 12,
          h: 12,
          ops: [{ op: "technique", id: "diagonal-hatch", params: { spacing: 3, ink: "accent" } }],
        },
      ],
    };
    r.techniques = [copy(HATCH_TECHNIQUE)];
  } else if (id === "variations") {
    r.name = "Seeded native clusters";
    r.parts = {
      study: [
        { op: "rect", x: 1, y: 1, w: 14, h: 14, role: "clothShadow" },
        { op: "clusters", x: 2, y: 2, w: 12, h: 12, cell: 2, density: 37, salt: 11, role: "cloth" },
        {
          op: "clusters",
          x: 2,
          y: 2,
          w: 12,
          h: 12,
          cell: 2,
          density: 13,
          salt: 71,
          role: "clothLight",
        },
      ],
    };
  } else throw Error("Unknown example " + id);
  return parseRecipe(r);
}
