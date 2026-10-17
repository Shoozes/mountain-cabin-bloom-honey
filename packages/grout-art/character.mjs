/** Portable character creator documents. Compiles to the existing exact pixel profile. */
import { copy, parseRecipe, renderFrame } from "./core.mjs";
import { CHARACTER_FRAMES, DIRECTIONS, SLOT_LAYERS, characterPalette, drawCharacterSlot, hashCharacter } from "./character-art.mjs";
export { CHARACTER_FRAMES } from "./character-art.mjs";
export const CHARACTER_CREATOR_FORMAT = "grout-character-creator/1";
export const CHARACTER_FORMAT = "grout-character/1";
const ident = (s) => typeof s === "string" && /^[-a-zA-Z0-9_]{1,60}$/.test(s) && !["constructor","prototype","__proto__"].includes(s);
const check = (condition, message) => { if (!condition) throw Error(`Character: ${message}`); };
const int = (v, min, max, label) => check(Number.isInteger(v) && v >= min && v <= max, `${label} must be an integer ${min}..${max}`);
const record = v => v && typeof v === "object" && !Array.isArray(v);
const rgb = v => typeof v === "string" && /^#[a-fA-F0-9]{6}$/.test(v);
const read = input => {
  const text = typeof input === "string" ? input : JSON.stringify(input);
  check(typeof text === "string" && new TextEncoder().encode(text).length <= 2 * 1048576, "document exceeds 2 MiB");
  let result;
  try { result = JSON.parse(text); } catch { throw Error("Character: invalid JSON"); }
  check(record(result), "expected a document object");
  return result;
};
const unique = (items, label) => {
  check(Array.isArray(items) && items.length > 0 && items.length <= 64, `${label}: expected 1..64 entries`);
  check(items.every(v => record(v) && ident(v.id) && typeof v.name === "string" && v.name.trim().length && v.name.length <= 120), `${label}: invalid id/name`);
  check(new Set(items.map(v => v.id)).size === items.length, `${label}: duplicate id`);
};
const parameter = (min, max, value) => ({ min, max, default: value });
export function createCharacterCreator() {
  const choices = {
    head: [["round","Round"],["square","Square"],["tapered","Tapered"]],
    hair: [["crop","Crop"],["bob","Bob"],["swept","Side swept"],["ponytail","Ponytail"],["none","No hair"]],
    hat: [["cap","Cap"],["hood","Hood"],["brim","Wide brim"],["none","No hat"]],
    body: [["base","Body"]], clothing: [["shirt","Shirt"],["tunic","Tunic"],["vest","Vest"]],
    legs: [["trousers","Trousers"],["shorts","Shorts"]], shoes: [["boots","Boots"],["soft","Soft shoes"]],
    bag: [["pack","Backpack"],["none","No backpack"]],
  };
  const ranges = { hair: { length: parameter(0,3,1), fringe: parameter(0,2,1) }, hat: { crown: parameter(2,4,3) }, clothing: { sleeves: parameter(0,2,1), hem: parameter(0,1,0) } };
  return {
    format: CHARACTER_CREATOR_FORMAT, id: "native-adventure", name: "Native adventure creator",
    techniqueVersion: "character-drawings/1",
    feedback: { enabled: true, ratings: [] },
    styles: [
      {id:"adventure",name:"Outlined 8-bit",outline:true,shaded:false,budget:8},
      {id:"soft",name:"Outline-free",outline:false,shaded:false,budget:8},
      {id:"shaded",name:"Restrained shading",outline:true,shaded:true,budget:16},
    ],
    builds: [
      {id:"chibi",name:"Compact chibi",headWidth:10,headHeight:8,headY:2,torsoY:10,torsoWidth:6},
      {id:"classic",name:"Classic adventurer",headWidth:8,headHeight:7,headY:3,torsoY:10,torsoWidth:6},
      {id:"slim",name:"Tall / slim",headWidth:7,headHeight:6,headY:3,torsoY:9,torsoWidth:4},
    ],
    palettes: [
      {id:"fern",name:"Fern",cloth:"#6b9b60",hat:"#6b9b60",accent:"#edc17f"},
      {id:"cinder",name:"Cinder",cloth:"#559b96",hat:"#c66c53",accent:"#efc785"},
      {id:"heather",name:"Heather",cloth:"#9b83b4",hat:"#cbac61",accent:"#efe0ac"},
      {id:"harbor",name:"Harbor",cloth:"#6496bf",hat:"#dfd4ad",accent:"#c67563"},
    ],
    skinRamps: [["#b77950","#edc17f","#ffe4ad"],["#895540","#c78e65","#efb684"],["#593e38","#93634e","#c28b64"],["#b18e7c","#e7c8ae","#ffead1"]],
    hairRamps: [["#543a35","#925b3f","#c58c58"],["#6e633b","#b4a05b","#e0cc89"],["#292e39","#485161","#727c8b"],["#75463d","#b86d50","#de9e6b"]],
    slots: Object.entries(SLOT_LAYERS).map(([id,layers]) => ({
      id, name: id === "body" ? "Body & arms" : id[0].toUpperCase() + id.slice(1), layers,
      anchor: [0,0], parameters: ranges[id] ?? {},
      options: choices[id].map(([key,name]) => ({id:key,name,kind:"builtin",drawing:{technique:id,variant:key}})),
    })),
    provenance: { kind: "original", author: "Grout Art", visualReview: "unapproved", note: "Independently authored native shapes; no purchased or reference pixels." },
  };
}
export function parseCharacterCreator(input) {
  const c = read(input);
  check(c.format === CHARACTER_CREATOR_FORMAT, `expected ${CHARACTER_CREATOR_FORMAT}`);
  check(ident(c.id) && typeof c.name === "string" && c.name.trim() && c.name.length <= 120, "invalid creator name/id");
  check(c.techniqueVersion === "character-drawings/1", "unsupported drawing technique version");
  c.feedback ??= {enabled:true,ratings:[]};
  check(record(c.feedback)&&typeof c.feedback.enabled==="boolean"&&Array.isArray(c.feedback.ratings)&&c.feedback.ratings.length<=64,"feedback needs an enabled flag and at most 64 reviews");
  for(const rating of c.feedback.ratings) check(record(rating)&&["keep","reject"].includes(rating.decision)&&typeof rating.key==="string"&&rating.key.length<=65536&&record(rating.selection),"invalid character review");
  for (const key of ["styles","builds","palettes","slots"]) unique(c[key],key);
  for (const s of c.styles) { check(typeof s.outline === "boolean" && typeof s.shaded === "boolean", "invalid style flags"); int(s.budget,1,256,"style budget"); }
  for (const b of c.builds) {
    int(b.headWidth,6,10,"head width"); int(b.headHeight,5,8,"head height"); int(b.headY,1,4,"head position");
    int(b.torsoWidth,4,6,"torso width"); int(b.torsoY,8,11,"torso position");
  }
  for (const p of c.palettes) check([p.cloth,p.hat,p.accent].every(rgb), "palette needs RGB cloth, hat and accent colors");
  for (const key of ["skinRamps","hairRamps"]) check(Array.isArray(c[key]) && c[key].length > 0 && c[key].length <= 32 && c[key].every(r => Array.isArray(r) && r.length === 3 && r.every(rgb)), `${key}: expected three-color ramps`);
  const layers = new Set();
  for (const slot of c.slots) {
    check(Array.isArray(slot.layers) && slot.layers.length && slot.layers.every(ident), `${slot.id}: invalid layers`);
    for (const id of slot.layers) { check(!layers.has(id), `duplicate layer ${id}`); layers.add(id); }
    check(Array.isArray(slot.anchor) && slot.anchor.length === 2, `${slot.id}: expected attachment offset`);
    slot.anchor.forEach(v => int(v,-16,16,"attachment offset"));
    check(record(slot.parameters), `${slot.id}: missing parameters`);
    check(Object.keys(slot.parameters).length <= 16, "parameter limit exceeded");
    for (const [id,p] of Object.entries(slot.parameters)) {
      check(ident(id) && record(p), "invalid parameter"); int(p.min,0,8,`${id}.min`); int(p.max,p.min,8,`${id}.max`); int(p.default,p.min,p.max,`${id}.default`);
    }
    unique(slot.options, `${slot.id}.options`);
    for (const o of slot.options) {
      check(["builtin","custom"].includes(o.kind), `${slot.id}/${o.id}: unknown drawing kind`);
      if (o.kind === "builtin") {
        check(SLOT_LAYERS[slot.id] && o.drawing?.technique === slot.id, "unknown built-in drawing technique");
        check(createBuiltinChoices(slot.id).includes(o.drawing.variant), "unknown built-in drawing variant");
        if (o.drawing.cuts !== undefined) check(Array.isArray(o.drawing.cuts) && o.drawing.cuts.length === 8 && o.drawing.cuts.every(v => Number.isInteger(v) && v >= 0 && v <= 3), "head contour must have eight cuts in 0..3");
      } else {
        check(record(o.frames) && CHARACTER_FRAMES.every(f => record(o.frames[f]) && slot.layers.every(l => record(o.frames[f][l]) && Array.isArray(o.frames[f][l].ops))), `${slot.id}/${o.id}: map all twelve poses and layers explicitly`);
        if (o.palette) check(record(o.palette) && Object.entries(o.palette).every(([k,v]) => ident(k) && rgb(v)), "invalid imported palette");
      }
      if (o.compatible) for (const [key,list] of Object.entries(o.compatible)) {
        check(["builds","styles","heads"].includes(key) && Array.isArray(list) && list.every(ident), "invalid compatibility rule");
        const allowed = key === "heads" ? c.slots.find(s => s.id === "head")?.options : c[key];
        check(list.every(id => allowed?.some(v => v.id === id)), `unknown ${key} compatibility value`);
      }
    }
  }
  check(layers.size <= 64, "layer limit exceeded");
  return c;
}
const createBuiltinChoices = id => ({head:["round","square","tapered"],hair:["crop","bob","swept","ponytail","none"],hat:["cap","hood","brim","none"],body:["base"],clothing:["shirt","tunic","vest"],legs:["trousers","shorts"],shoes:["boots","soft"],bag:["pack","none"]})[id] ?? [];
export function createCharacterDocument(creator = createCharacterCreator()) {
  const c = parseCharacterCreator(creator);
  return parseCharacterDocument({
    format:CHARACTER_FORMAT, name:"My traveler",creator:c,build:c.builds.find(v=>v.id==="classic")?.id ?? c.builds[0].id,
    style:c.styles[0].id,frameSize:24,seed:1204,mode:"adjustable",palette:c.palettes[0].id,skin:0,hairColor:0,
    selections:Object.fromEntries(c.slots.map(s => [s.id,s.options[0].id])), parameters:{},locks:{},slotSeeds:Object.fromEntries(c.slots.map(s=>[s.id,1204])),paletteOverrides:{},layerVisibility:{},
  });
}
export function isCharacterOptionCompatible(doc, option) {
  const c = option.compatible;
  return !c || ((!c.builds || c.builds.includes(doc.build)) && (!c.styles || c.styles.includes(doc.style)) && (!c.heads || c.heads.includes(doc.selections.head)));
}
export function parseCharacterDocument(input) {
  const d = read(input);
  check(d.format === CHARACTER_FORMAT, `expected ${CHARACTER_FORMAT}`);
  d.creator = parseCharacterCreator(d.creator);
  check(typeof d.name === "string" && d.name.trim() && d.name.length <= 120, "invalid character name");
  check(d.creator.builds.some(v=>v.id===d.build) && d.creator.styles.some(v=>v.id===d.style) && d.creator.palettes.some(v=>v.id===d.palette), "unknown build, style or palette");
  check([16,24,32].includes(d.frameSize), "frame size must be 16, 24 or 32");
  int(d.seed,0,0xffffffff,"seed"); check(["authored","adjustable","procedural"].includes(d.mode), "unknown generation mode");
  int(d.skin,0,d.creator.skinRamps.length-1,"skin ramp"); int(d.hairColor,0,d.creator.hairRamps.length-1,"hair ramp");
  for (const key of ["selections","parameters","locks","paletteOverrides","layerVisibility"]) check(record(d[key]), `missing ${key}`);
  d.slotSeeds ??= Object.fromEntries(d.creator.slots.map(s=>[s.id,d.seed]));
  check(record(d.slotSeeds), "invalid slot seeds");
  for (const seed of Object.values(d.slotSeeds)) int(seed,0,0xffffffff,"slot seed");
  check(Object.entries(d.paletteOverrides).every(([k,v])=>ident(k)&&rgb(v)), "invalid palette overrides");
  check(Object.entries(d.locks).every(([k,v])=>ident(k)&&typeof v === "boolean"), "invalid locks");
  check(Object.entries(d.layerVisibility).every(([k,v])=>ident(k)&&typeof v === "boolean"), "invalid layer visibility");
  for (const slot of d.creator.slots) {
    const option = slot.options.find(o=>o.id===d.selections[slot.id]);
    check(option, `missing option for ${slot.name}`);
    check(isCharacterOptionCompatible(d,option), `${slot.name}/${option.name} is incompatible with this build, style or head; keep its compatible setup or choose another part`);
    const params = d.parameters[slot.id] ?? {};
    check(record(params), "invalid slot parameters");
    for (const [key,value] of Object.entries(params)) {
      check(slot.parameters[key], `unknown ${slot.name} parameter ${key}`);
      int(value,slot.parameters[key].min,slot.parameters[key].max,key);
    }
  }
  return d;
}

export function compileCharacter(input) {
  const d = parseCharacterDocument(input), pad = (d.frameSize - 16) / 2,
    parts = {}, layers = [], frames = [], palette = characterPalette(d),
    frameLayers = Object.fromEntries(CHARACTER_FRAMES.map(f=>[f,{}]));
  for (const slot of d.creator.slots) {
    const option = slot.options.find(o=>o.id===d.selections[slot.id]);
    Object.assign(palette, option.palette ?? {});
    for (const layer of slot.layers) layers.push({id:layer,name:`${slot.name} · ${layer.replace(/-/g," ")}`,part:`${layer}-south-0`,visible:d.layerVisibility[layer] !== false});
    for (const frame of CHARACTER_FRAMES) {
      const [dir,pose] = frame.split("-"), drawn = option.kind === "custom" ? option.frames[frame] : drawCharacterSlot(d,slot,option,dir,Number(pose));
      for (const layer of slot.layers) {
        const value = drawn[layer] ?? {ops:[],visible:true}, key = `${layer}-${frame}`;
        parts[key] = copy(value.ops);
        frameLayers[frame][layer] = {part:key,offset:[pad+slot.anchor[0],pad+slot.anchor[1]],visible:value.visible !== false};
      }
    }
  }
  const order = {
    south:["rear-hair","bag","far-leg","far-shoe","near-leg","near-shoe","far-arm","torso","clothing","near-arm","head","front-hair","hat"],
    north:["far-leg","far-shoe","near-leg","near-shoe","far-arm","torso","clothing","near-arm","head","rear-hair","front-hair","bag","hat"],
    side:["rear-hair","bag","far-arm","far-leg","far-shoe","torso","clothing","near-leg","near-shoe","near-arm","head","front-hair","hat"],
  };
  for (const name of CHARACTER_FRAMES) {
    const dir = name.split("-")[0], ids = layers.map(l=>l.id), ranked = order[dir] ?? order.side;
    frames.push({name,anchor:[8+pad,15+pad],order:[...ranked.filter(id=>ids.includes(id)),...ids.filter(id=>!ranked.includes(id))],layers:frameLayers[name]});
  }
  const clips = {};
  for (const dir of DIRECTIONS) {
    clips[`idle-${dir}`]={frames:[`${dir}-0`],fps:1};
    clips[`walk-${dir}`]={frames:[`${dir}-1`,`${dir}-0`,`${dir}-2`,`${dir}-0`],fps:8};
  }
  clips.turntable={frames:["south-0","west-0","north-0","east-0"],fps:2};
  const recipe = parseRecipe({format:"grout-art/1",name:d.name,width:d.frameSize,height:d.frameSize,seed:d.seed,palette,parts,layers,frames,clips,techniques:[],...(d.outline?{outline:d.outline}:{}),character:d});
  // Native part bounds are checked before rendering, including off-canvas pixels
  // that a finite scratch canvas could otherwise fail to observe.
  const expansion=recipe.outline?.enabled?recipe.outline.width:0, usedColors=new Set();
  if(expansion)usedColors.add(recipe.outline.color.toLowerCase());
  for(const frame of frames) for(const layer of layers) {
    const patch=frame.layers[layer.id]; if(!layer.visible||patch.visible===false) continue;
    const [ox,oy]=patch.offset;
    const inside=(x,y)=>{
      if(x+ox-expansion<0||y+oy-expansion<0||x+ox+expansion>=d.frameSize||y+oy+expansion>=d.frameSize)
        throw Error(`Character: ${frame.name}/${layer.id} overflows ${d.frameSize}×${d.frameSize}; increase the frame or move the part attachment`);
    };
    for(const op of parts[patch.part]) {
      check(["mask","rect","circle"].includes(op.op),"custom character parts use native masks, rectangles or circles; import other graphs as rendered layers");
      const x=op.x??0,y=op.y??0;
      if(op.op==="mask") {
        for(let py=0;py<op.rows.length;py++) for(let px=0;px<op.rows[py].length;px++) if(!["."," "].includes(op.rows[py][px])) {
          inside(x+px,y+py);usedColors.add(palette[op.ink[op.rows[py][px]]].toLowerCase());
        }
      } else if(op.role!==null) {
        usedColors.add(palette[op.role].toLowerCase());
        if(op.op==="circle") {inside(x-op.r,y-op.r);inside(x+op.r,y+op.r);}
        else {inside(x,y);inside(x+(op.w??recipe.width)-1,y+(op.h??recipe.height)-1);}
      }
    }
  }
  const budget=d.creator.styles.find(s=>s.id===d.style).budget;
  check(usedColors.size<=budget,`selected parts use ${usedColors.size} colors, above this style's ${budget}-color budget; map imported colors or explicitly increase the style budget`);
  return recipe;
}

function randomizeOnce(input, {seed,slot:only,include=[]} = {}) {
  const d = parseCharacterDocument(input);
  d.seed = seed ?? ((d.seed+1)>>>0); int(d.seed,0,0xffffffff,"seed");
  check(!only || d.creator.slots.some(s=>s.id===only), "unknown randomizer slot");
  const pick = (items,key) => items[hashCharacter(key,d.seed)%items.length];
  for (const [key,items] of [["build",d.creator.builds],["style",d.creator.styles],["palette",d.creator.palettes]])
    if(!only && include.includes(key) && !d.locks[key]) {
      const available=items.filter(item=>d.creator.slots.every(s=>{
        if(!d.locks[s.id])return true;
        const constraint=s.options.find(o=>o.id===d.selections[s.id]).compatible?.[key+"s"];
        return !constraint||constraint.includes(item.id);
      }));
      check(available.length,`no ${key} satisfies the locked parts`);d[key]=pick(available,key).id;
    }
  const slots = [...d.creator.slots].sort((a,b)=>(a.id==="head"?-1:b.id==="head"?1:0));
  let visits=0;
  const choose = index => {
    if(++visits>10000) return false;
    if(index===slots.length) return slots.every(s=>isCharacterOptionCompatible(d,s.options.find(o=>o.id===d.selections[s.id])));
    const s=slots[index], options = d.locks[s.id] || (only && only!==s.id) ? s.options.filter(o=>o.id===d.selections[s.id]) : [...s.options].sort((a,b)=>hashCharacter(`${s.id}:${a.id}`,d.seed)-hashCharacter(`${s.id}:${b.id}`,d.seed));
    for(const option of options) { d.selections[s.id]=option.id; if(isCharacterOptionCompatible(d,option)&&choose(index+1)) return true; }
    return false;
  };
  check(choose(0), "no compatible combination satisfies the locks; change the requested build/style or unlock a conflicting part");
  for(const s of slots) if(!d.locks[s.id] && (!only||only===s.id)) {
    d.slotSeeds[s.id] = d.seed;
    d.parameters[s.id] = Object.fromEntries(Object.entries(s.parameters).map(([key,p])=>[key,p.min+hashCharacter(`${s.id}:${key}`,d.seed)%(p.max-p.min+1)]));
  }
  return parseCharacterDocument(d);
}

function reviewSelection(d) {
  return Object.fromEntries(["build","style","frameSize","seed","mode","palette","skin","hairColor","selections","parameters","slotSeeds","paletteOverrides","outline","layerVisibility"].filter(k=>d[k]!==undefined).map(k=>[k,copy(d[k])]));
}
function reviewKey(d) {
  const selected=reviewSelection(d);delete selected.seed;delete selected.frameSize;
  if(d.mode!=="procedural")delete selected.slotSeeds;
  if(d.mode==="authored")delete selected.parameters;
  const drawings=d.creator.slots.map(s=>({anchor:s.anchor,option:s.options.find(o=>o.id===d.selections[s.id])}));
  return JSON.stringify({selected,source:hashCharacter(JSON.stringify([drawings,d.creator.builds.find(b=>b.id===d.build),d.creator.styles.find(s=>s.id===d.style),characterPalette(d)]))});
}
export function rateCharacter(input,decision) {
  const d=parseCharacterDocument(input);check(["keep","reject"].includes(decision),"review must be keep or reject");
  const key=reviewKey(d),ratings=d.creator.feedback.ratings.filter(r=>r.key!==key);
  check(ratings.length<64,"review history is full; save the creator and remove an older review before adding another");
  ratings.push({key,decision,selection:reviewSelection(d)});d.creator.feedback.ratings=ratings;
  return d;
}
/** A modest local preference score, not a visual-quality classifier. Whole
 * rejected combinations are excluded; individual parts are never blacklisted. */
export function randomizeCharacter(input,options={}) {
  const d=parseCharacterDocument(input),feedback=d.creator.feedback;
  if(!feedback.enabled||!feedback.ratings.length)return randomizeOnce(d,options);
  const seed=options.seed??((d.seed+1)>>>0),candidates=[];
  for(let i=0;i<16;i++) {
    const stream=(seed+Math.imul(i,0x9e3779b9))>>>0,c=randomizeOnce(d,{...options,seed:stream});
    c.seed=seed;
    const key=reviewKey(c);
    if(feedback.ratings.some(r=>r.decision==="reject"&&r.key===key))continue;
    let preference=0;
    for(const rating of feedback.ratings) {
      const previous=rating.selection,traits=["build","style","palette","skin","hairColor"];
      let same=traits.filter(k=>previous[k]===c[k]).length,total=traits.length;
      for(const [slot,value] of Object.entries(c.selections)){total++;if(previous.selections?.[slot]===value)same++;}
      preference+=(rating.decision==="keep"?1:-1)*(same/total);
    }
    preference/=feedback.ratings.length;
    candidates.push({document:c,score:(hashCharacter("preference",stream)%10000)/10000+.35*preference});
  }
  check(candidates.length,"the sampled choices repeat rejected combinations; unlock a part, widen the choices or turn off preferences");
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0].document;
}

/** Turn edits to a generated layer into a reusable option; sibling poses survive. */
export function captureCharacterEdits(before, after) {
  if(!before.character) return after;
  const d = parseCharacterDocument(before.character), next = parseRecipe(after);
  for(const [role,color] of Object.entries(next.palette)) if(color !== before.palette[role]) d.paletteOverrides[role]=color;
  d.outline = next.outline;
  d.layerVisibility = Object.fromEntries(next.layers.map(l=>[l.id,l.visible]));
  for(const slot of d.creator.slots) {
    const changed = slot.layers.some(id=>next.frames.some((frame,i)=>{
      const a=before.frames[i]?.layers?.[id], b=frame.layers?.[id];
      return JSON.stringify([a,before.parts[a?.part]])!==JSON.stringify([b,next.parts[b?.part]]);
    }));
    if(!changed) continue;
    const current=slot.options.find(o=>o.id===d.selections[slot.id]);
    const id = current.edited ? current.id : freshId(slot.options,"custom");
    const option={id,name:current.edited?current.name:`${current.name} · custom`,kind:"custom",edited:true,compatible:{builds:[d.build],styles:[d.style]},frames:{},...(current.palette?{palette:copy(current.palette)}:{}),...(current.provenance?{provenance:copy(current.provenance)}:{}),...(current.imported?{imported:copy(current.imported)}:{})};
    if(slot.id==="hair"||slot.id==="hat") option.compatible.heads=[d.selections.head];
    const pad=(d.frameSize-16)/2;
    for(const frame of next.frames) {
      option.frames[frame.name]={};
      for(const layer of slot.layers) {
        const patch=frame.layers[layer], offset=patch.offset??[0,0];
        const dx=offset[0]-pad-slot.anchor[0],dy=offset[1]-pad-slot.anchor[1];
        const ops=[...copy(next.parts[patch.part]),...copy(patch.ops??[])];
        // Compiler-generated parts are native masks; imported/general operations keep a use transform.
        option.frames[frame.name][layer]={ops:dx||dy?ops.map(op=>({...op,x:(op.x??0)+dx,y:(op.y??0)+dy})):ops,visible:patch.visible!==false};
      }
    }
    slot.options=slot.options.filter(o=>o.id!==id); slot.options.push(option);
    d.selections[slot.id]=id; d.locks[slot.id]=true;
  }
  return compileCharacter(d);
}
const freshId = (items, prefix) => { let n=1; while(items.some(v=>v.id===`${prefix}-${n}`)) n++; return `${prefix}-${n}`; };
export function cloneCharacterOption(input, slotId, id, name) {
  const d=parseCharacterDocument(input),slot=d.creator.slots.find(s=>s.id===slotId);
  check(slot && ident(id) && !slot.options.some(o=>o.id===id),"new option needs a unique id");
  const recipe=compileCharacter(d),current=slot.options.find(o=>o.id===d.selections[slotId]), option={id,name,kind:"custom",compatible:{builds:[d.build],styles:[d.style]},frames:{},...(current.palette?{palette:copy(current.palette)}:{}),...(current.provenance?{provenance:copy(current.provenance)}:{}),...(current.imported?{imported:copy(current.imported)}:{})};
  for(const frame of recipe.frames) option.frames[frame.name]=Object.fromEntries(slot.layers.map(layer=>[layer,{ops:copy(recipe.parts[frame.layers[layer].part]),visible:frame.layers[layer].visible}]));
  slot.options.push(option); d.selections[slot.id]=id; d.locks[slot.id]=true;
  return parseCharacterDocument(d);
}
export function addCharacterSlot(input,{id,name}) {
  const d=parseCharacterDocument(input);
  check(ident(id)&&!d.creator.slots.some(s=>s.id===id),"slot needs a unique id");
  const layer=`${id}-custom`, frames=Object.fromEntries(CHARACTER_FRAMES.map(f=>[f,{[layer]:{ops:[],visible:true}}]));
  d.creator.slots.push({id,name,layers:[layer],anchor:[0,0],parameters:{},options:[{id:"blank",name:"Blank",kind:"custom",frames}]});
  d.selections[id]="blank"; return parseCharacterDocument(d);
}
export function importCharacterOption(input,{slot:slotId,id,name,recipe:source,frames:mapping,layers:sourceLayers,roleMap={}}) {
  const d=parseCharacterDocument(input),slot=d.creator.slots.find(s=>s.id===slotId),r=parseRecipe(source);
  check(slot && ident(id) && !slot.options.some(o=>o.id===id),"import needs a slot and unique option id");
  check(record(mapping)&&CHARACTER_FRAMES.every(f=>r.frames.some(v=>v.name===mapping[f])),"map all twelve direction/pose frames explicitly");
  check(Array.isArray(sourceLayers)&&sourceLayers.length&&sourceLayers.every(id=>r.layers.some(l=>l.id===id)),"choose source layers");
  const palette={...characterPalette(d)}, importedPalette={};
  for(const [role,color] of Object.entries(r.palette)) {
    const mapped=roleMap[role];
    if(mapped) check(palette[mapped],`unknown palette role ${mapped}`);
    else { const key=`${slotId}-${id}-${Object.keys(importedPalette).length}`; check(ident(key),"import palette id too long"); importedPalette[key]=color; }
  }
  const sourceRoles=Object.keys(r.palette), map={}; let i=0;
  for(const role of sourceRoles) map[role]=roleMap[role]??Object.keys(importedPalette)[i++];
  const option={id,name,kind:"custom",compatible:{builds:[d.build],styles:[d.style]},palette:importedPalette,frames:{},provenance:r.importedSprite??{kind:"user-supplied",name:r.name}};
  const original=copy(r);delete original.character;
  option.imported={recipe:original,frames:copy(mapping),layers:copy(sourceLayers),roleMap:copy(roleMap)};
  d.creator.provenance={kind:"mixed",visualReview:"unapproved",note:"Original creator with user-supplied parts; each imported option retains its source recipe, layers, clips and attribution."};
  const sourceCopy=copy(r); delete sourceCopy.outline; delete sourceCopy.character;
  sourceCopy.layers=sourceCopy.layers.map(l=>({...l,visible:sourceLayers.includes(l.id)}));
  for(const target of CHARACTER_FRAMES) {
    const frameIndex=r.frames.findIndex(f=>f.name===mapping[target]),pixels=renderFrame(sourceCopy,frameIndex),
      ink={},rows=[],anchor=r.frames[frameIndex].anchor;
    sourceRoles.forEach((role,index)=>{ink[String.fromCharCode(0x100+index)]=map[role];});
    for(let y=0;y<pixels.height;y++) {
      let row="";
      for(let x=0;x<pixels.width;x++) {
        const at=(x+y*pixels.width)*4;
        if(!pixels.data[at+3]) {row+=".";continue;}
        const hex="#"+[...pixels.data.slice(at,at+3)].map(c=>c.toString(16).padStart(2,"0")).join("");
        const ri=sourceRoles.findIndex(role=>r.palette[role].toLowerCase()===hex);
        check(ri>=0,"source contains a color outside its palette"); row+=String.fromCharCode(0x100+ri);
      }
      rows.push(row);
    }
    option.frames[target]=Object.fromEntries(slot.layers.map((layer,index)=>[layer,{ops:index?[]:[{op:"mask",x:8-anchor[0]-slot.anchor[0],y:15-anchor[1]-slot.anchor[1],rows,ink}],visible:true}]));
  }
  slot.options.push(option);d.selections[slotId]=id;d.locks[slotId]=true;
  const result=parseCharacterDocument(d); compileCharacter(result); return result;
}
