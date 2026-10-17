import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  createCharacterCreator,createCharacterDocument,parseCharacterCreator,parseCharacterDocument,
  compileCharacter,randomizeCharacter,rateCharacter,captureCharacterEdits,cloneCharacterOption,addCharacterSlot,importCharacterOption,
  renderFrame,editPixel,buildArtExport,extractFrame,importSpritePixels,CHARACTER_FRAMES,
} from "../packages/grout-art/index.mjs";
import { bakeArt } from "./bake-art.mjs";
const sha=b=>createHash("sha256").update(b).digest("hex");
const pixels=r=>r.frames.map((_,i)=>sha(renderFrame(r,i).data));
const colorCount=p=>{
  const colors=new Set();for(let i=0;i<p.data.length;i+=4){assert.ok(p.data[i+3]===0||p.data[i+3]===255);if(p.data[i+3])colors.add(p.data.slice(i,i+3).join(","));}return colors.size;
};

test("reviewed generations remain reversible, deterministic and respect locked choices",()=>{
  const original=randomizeCharacter({...createCharacterDocument(),mode:"authored"},{seed:1204});
  const rejected=rateCharacter(original,"reject");
  assert.equal(original.creator.feedback.ratings.length,0);
  assert.equal(rejected.creator.feedback.ratings.length,1);
  const locked={...rejected,locks:Object.fromEntries(rejected.creator.slots.map(s=>[s.id,true]))};
  assert.throws(()=>randomizeCharacter(locked,{seed:1215}),/rejected combinations/);
  const kept=rateCharacter(rejected,"keep");
  assert.equal(kept.creator.feedback.ratings.length,1);
  assert.equal(kept.creator.feedback.ratings[0].decision,"keep");
  assert.deepEqual(parseCharacterDocument(JSON.stringify(kept)),kept);
  for(const seed of [1204,1215,1233]) {
    const roll=randomizeCharacter(rejected,{seed});
    assert.deepEqual(roll,randomizeCharacter(rejected,{seed}));
    assert.notDeepEqual(roll.selections,rejected.selections);
    const withLock={...rejected,locks:{hat:true},mode:"procedural"};
    const reroll=randomizeCharacter(withLock,{seed,slot:"hair"});
    for(const s of withLock.creator.slots.filter(s=>s.id!=="hair")) {
      assert.equal(reroll.selections[s.id],withLock.selections[s.id]);
      assert.equal(reroll.slotSeeds[s.id],withLock.slotSeeds[s.id]);
    }
    const disabled=structuredClone(rejected);disabled.creator.feedback.enabled=false;
    const unbiased=randomizeCharacter(disabled,{seed}),baseline=randomizeCharacter(original,{seed});
    assert.deepEqual(pixels(compileCharacter(unbiased)),pixels(compileCharacter(baseline)));
  }
  const cleared=structuredClone(locked);cleared.creator.feedback.ratings=[];
  assert.deepEqual(randomizeCharacter(cleared,{seed:1215}).selections,locked.selections);
  assert.throws(()=>rateCharacter(original,"bad"),/keep or reject/);
});
test("creator documents round-trip and reject broken definitions before replacing a preview",()=>{
  const creator=createCharacterCreator(),d=createCharacterDocument();
  assert.deepEqual(parseCharacterCreator(JSON.stringify(creator)),creator);
  assert.deepEqual(parseCharacterDocument(JSON.stringify(d)),d);
  for(const mutate of [c=>c.slots.push(c.slots[0]),c=>c.slots[0].options[0].drawing.variant="missing",c=>c.builds[0].headWidth=99,c=>c.slots[1].parameters.length.default=100,c=>c.slots[0].options[0].compatible={styles:["missing"]}]) {
    const c=structuredClone(creator);mutate(c);assert.throws(()=>parseCharacterCreator(c));
  }
  const bad=structuredClone(d);bad.selections.head="missing";assert.throws(()=>parseCharacterDocument(bad),/missing option/);
  assert.throws(()=>parseCharacterDocument("not json"),/JSON/);
});
test("nine authored build/style bases and all palette/seed modes render exact native frames",()=>{
  const base=createCharacterDocument(),distinct=new Set();
  for(const build of base.creator.builds)for(const style of base.creator.styles)for(const palette of base.creator.palettes)for(const seed of [1204,1215,1233]) {
    const d={...structuredClone(base),build:build.id,style:style.id,palette:palette.id,seed};
    const r=compileCharacter(d);
    assert.equal(r.frames.length,12);assert.equal(r.width,24);assert.equal(r.height,24);
    const colors=new Set();
    for(let i=0;i<12;i++) {
      const p=renderFrame(r,i);assert.ok(colorCount(p)<=style.budget);
      for(let a=0;a<p.data.length;a+=4)if(p.data[a+3])colors.add(p.data.slice(a,a+3).join(","));
      assert.deepEqual(r.frames[i].anchor,[12,19]);assert.equal(r.frames[i].layers.bag.visible,!r.frames[i].name.startsWith("south"));
    }
    assert.ok(colors.size<=style.budget,`${style.id}: ${colors.size}`);
    assert.deepEqual(pixels(r),pixels(compileCharacter(d)));
    assert.deepEqual(r.clips["walk-west"],{frames:["west-1","west-0","west-2","west-0"],fps:8});
    if(palette.id==="fern"&&seed===1204)distinct.add(pixels(r).join(""));
  }
  assert.equal(distinct.size,9,"rendering styles and body builds must change drawings");
});
test("every authored option and each pair of slot choices compiles across nine rigs",()=>{
  const base=createCharacterDocument();
  for(const build of base.creator.builds)for(const style of base.creator.styles) {
    const d={...structuredClone(base),build:build.id,style:style.id,mode:"authored"};
    const slots=d.creator.slots;
    for(let a=0;a<slots.length;a++)for(let b=a+1;b<slots.length;b++)for(const oa of slots[a].options)for(const ob of slots[b].options) {
      const c={...d,selections:{...d.selections,[slots[a].id]:oa.id,[slots[b].id]:ob.id}};
      const r=compileCharacter(c);
      assert.equal(r.frames.length,12);
    }
  }
});
test("procedural designs reproduce across poses and rerolls preserve locked and unrelated slots",()=>{
  const d=createCharacterDocument();d.mode="procedural";d.locks.hair=true;d.selections.hair="swept";
  const a=randomizeCharacter(d,{seed:1215}),b=randomizeCharacter(d,{seed:1215});
  assert.deepEqual(a,b);assert.equal(a.build,d.build);assert.equal(a.style,d.style);assert.equal(a.palette,d.palette);
  assert.equal(a.selections.hair,d.selections.hair);assert.equal(a.slotSeeds.hair,d.slotSeeds.hair);
  const before=compileCharacter(d),after=compileCharacter(a);
  for(const key of Object.keys(before.parts).filter(k=>k.includes("hair")))assert.deepEqual(before.parts[key],after.parts[key]);
  const reroll=randomizeCharacter(a,{seed:1233,slot:"hat"});
  for(const s of d.creator.slots.filter(s=>s.id!=="hat")){assert.equal(reroll.selections[s.id],a.selections[s.id]);assert.deepEqual(reroll.parameters[s.id],a.parameters[s.id]);assert.equal(reroll.slotSeeds[s.id],a.slotSeeds[s.id]);}
  const varied=new Set();
  for(const seed of [1204,1215,1233])for(const mode of ["authored","adjustable","procedural"]){const c=randomizeCharacter({...d,mode},{seed});varied.add(pixels(compileCharacter(c)).join(""));}
  assert.ok(varied.size>=5);
});
test("paint forks one reusable slot, preserves other poses, and locks custom compatibility",()=>{
  const before=compileCharacter(createCharacterDocument()),edited=editPixel(before,0,"hat",12,5,"accent"),r=captureCharacterEdits(before,edited),d=r.character;
  assert.equal(d.locks.hat,true);assert.match(d.selections.hat,/custom/);
  assert.deepEqual(renderFrame(r,0).data,renderFrame(edited,0).data);
  for(let i=1;i<12;i++)assert.deepEqual(renderFrame(r,i).data,renderFrame(before,i).data);
  assert.equal(before.character.creator.slots.find(s=>s.id==="hat").options.length,4);
  const c=compileCharacter(randomizeCharacter(d,{seed:1215}));
  for(const f of CHARACTER_FRAMES)assert.deepEqual(c.parts[`hat-${f}`],r.parts[`hat-${f}`]);
  const broken=structuredClone(d);broken.style="soft";assert.throws(()=>compileCharacter(broken),/incompatible/);
  const paletteOnly=structuredClone(before);paletteOnly.palette.cloth="#aa4455";
  const recolored=captureCharacterEdits(before,paletteOnly);assert.equal(recolored.character.paletteOverrides.cloth,"#aa4455");assert.equal(Object.keys(recolored.character.paletteOverrides).length,1);
  assert.deepEqual(recolored.character.selections,before.character.selections);
});
test("template can add a blank slot and copy options without losing the original",()=>{
  let d=addCharacterSlot(createCharacterDocument(),{id:"scarf",name:"Scarf"});
  d=cloneCharacterOption(d,"hat","new-cap","My cap");
  assert.equal(d.creator.slots.find(s=>s.id==="hat").options.length,5);
  assert.equal(compileCharacter(d).layers.length,14);
  const invalid=structuredClone(d);delete invalid.creator.slots.at(-1).options[0].frames["north-2"];
  assert.throws(()=>parseCharacterDocument(invalid),/all twelve/);
});
test("padding preserves native pixels and anchors; opaque overflow cannot silently export",()=>{
  const d=createCharacterDocument(),a=compileCharacter(d),b=compileCharacter({...d,frameSize:32});
  const ap=renderFrame(a,1),bp=renderFrame(b,1);
  for(let y=0;y<24;y++)for(let x=0;x<24;x++)assert.deepEqual(bp.data.slice(((y+4)*32+x+4)*4,((y+4)*32+x+4)*4+4),ap.data.slice((y*24+x)*4,(y*24+x)*4+4));
  assert.deepEqual(b.frames[0].anchor,[16,23]);
  const wide=structuredClone(d);wide.creator.slots.find(s=>s.id==="hat").anchor=[16,0];
  assert.throws(()=>compileCharacter(wide),/overflows/);
  const strict={...d,frameSize:16,selections:{...d.selections,hat:"none"}};
  assert.equal(compileCharacter(strict).width,16);
});
test("mapped imports preserve exact colors and anchors, and require every directional pose",async()=>{
  const data=new Uint8Array(16*16*4);data.set([17,32,201,255],(8+6*16)*4);
  const source=await importSpritePixels({width:16,height:16,data},{anchor:[8,15]});
  const d=addCharacterSlot(createCharacterDocument(),{id:"badge",name:"Badge"}),mapping=Object.fromEntries(CHARACTER_FRAMES.map(f=>[f,source.frames[0].name]));
  assert.throws(()=>importCharacterOption(d,{slot:"badge",id:"imported",name:"Badge",recipe:source,frames:{},layers:[source.layers[0].id]}),/map all twelve/);
  const out=importCharacterOption(d,{slot:"badge",id:"imported",name:"Badge",recipe:source,frames:mapping,layers:[source.layers[0].id]});
  assert.deepEqual(out.creator.slots.at(-1).options.at(-1).imported.recipe,source);
  const importedRecipe=compileCharacter(out), corrected=captureCharacterEdits(importedRecipe,editPixel(importedRecipe,0,"badge-custom",13,10,"hat"));
  assert.deepEqual(corrected.character.creator.slots.at(-1).options.at(-1).imported.recipe,source);
  const r=compileCharacter(out);r.layers=r.layers.map(l=>({...l,visible:l.id==="badge-custom"}));
  const p=renderFrame(r,0);assert.deepEqual([...p.data.slice((12+10*24)*4,(12+10*24)*4+4)],[17,32,201,255]);
});
test("export reconstructs every frame and retains reusable source, provenance and cache identity",async()=>{
  const d=randomizeCharacter(createCharacterDocument(),{seed:1233}),r=compileCharacter(d),kit=buildArtExport(r);
  for(let i=0;i<12;i++)assert.deepEqual(extractFrame(kit.atlas,r.frames[i].name).data,renderFrame(r,i).data);
  assert.equal(kit.sheet.width,72);assert.equal(kit.sheet.height,96);
  const broken=structuredClone(r);broken.parts["hat-south-0"].push({op:"rect",x:1,y:1,w:1,h:1,role:"hat"});
  assert.throws(()=>buildArtExport(broken),/source and resolved recipe differ/);
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"character-bake-"));
  try {
    const out=await bakeArt({recipe:r,output:dir});
    const files=out.manifest.files.map(f=>f.path);assert.ok(files.includes("character.json")&&files.includes("creator.json"));
    assert.ok(out.manifest.sources.some(s=>s.path.endsWith("character-art.mjs")));
    const again=await bakeArt({recipe:r,output:dir});assert.equal(again.manifest.identity,out.manifest.identity);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
