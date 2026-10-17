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
const assertFacingIdleSymmetry=(r,label)=>{
  for(const dir of ["south","north"]) {
    const p=renderFrame(r,CHARACTER_FRAMES.indexOf(`${dir}-0`));
    for(let y=0;y<p.height;y++)for(let x=0;x<p.width/2;x++) {
      const a=(y*p.width+x)*4,b=(y*p.width+p.width-1-x)*4;
      assert.deepEqual(p.data.slice(a,a+4),p.data.slice(b,b+4),`${label}/${dir}: mirror at ${x},${y}`);
    }
  }
};
const colorCount=p=>{
  const colors=new Set();for(let i=0;i<p.data.length;i+=4){assert.ok(p.data[i+3]===0||p.data[i+3]===255);if(p.data[i+3])colors.add(p.data.slice(i,i+3).join(","));}return colors.size;
};

test("owner-accepted classic base retains its palette, twelve frames and walk clips",async()=>{
  const baseline=JSON.parse(await fs.readFile(new URL("./fixtures/character-accepted-20261017.json",import.meta.url),"utf8"));
  const recipe=compileCharacter(createCharacterDocument());
  assert.deepEqual(recipe.palette,baseline.palette);
  assert.deepEqual(recipe.clips,baseline.clips);
  assert.deepEqual(recipe.frames.map((frame,i)=>({name:frame.name,anchor:frame.anchor,sha256:sha(renderFrame(recipe,i).data)})),baseline.frames);
});

test("outline-free arms retain their authored silhouettes through every rig and pose",()=>{
  const base=createCharacterDocument();
  for(const build of base.creator.builds) {
    const outlined=compileCharacter({...base,build:build.id,style:"adventure"});
    const soft=compileCharacter({...base,build:build.id,style:"soft"});
    for(const frame of CHARACTER_FRAMES)for(const layer of ["near-arm","far-arm"]) {
      const key=`${layer}-${frame}`,outlineMask=outlined.parts[key][0],softMask=soft.parts[key][0];
      assert.deepEqual([softMask.x,softMask.y],[outlineMask.x,outlineMask.y],`${build.id}/${key}: position`);
      assert.deepEqual(softMask.rows.map(row=>row.replace(/[^.]/g,"#")),outlineMask.rows.map(row=>row.replace(/[^.]/g,"#")),`${build.id}/${key}: coverage`);
      assert.deepEqual(Object.values(softMask.ink),["skin"]);
    }
  }
});

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
      assertFacingIdleSymmetry(r,`${build.id}/${style.id}/${oa.id}/${ob.id}`);
    }
  }
});

test("generated heads use centered even widths in every direction, including recovered odd-width v1 rigs",()=>{
  const base=createCharacterDocument(),legacy=structuredClone(base.creator);
  legacy.builds.find(b=>b.id==="slim").headWidth=7;
  legacy.builds.find(b=>b.id==="slim").torsoWidth=5;
  legacy.builds.find(b=>b.id==="chibi").headWidth=9;
  const recovered=parseCharacterCreator(legacy);
  assert.equal(legacy.builds.find(b=>b.id==="slim").headWidth,7,"parsing preserves the input source object");
  assert.equal(recovered.builds.find(b=>b.id==="slim").headWidth,8);
  assert.equal(recovered.builds.find(b=>b.id==="slim").torsoWidth,6);
  assert.equal(recovered.builds.find(b=>b.id==="chibi").headWidth,10);
  for(const width of [6,7,8,9,10])for(const style of base.creator.styles)for(const head of ["round","square","tapered"]) {
    const d=structuredClone(base);d.style=style.id;d.selections.head=head;
    if(head==="tapered")d.creator.slots.find(s=>s.id==="head").options.find(o=>o.id===head).drawing.cuts=Array(8).fill(3);
    for(const rig of d.creator.builds)rig.headWidth=width;
    for(const build of d.creator.builds) {
      const r=compileCharacter({...d,build:build.id});
      assert.equal(r.character.creator.builds.find(b=>b.id===build.id).headWidth%2,0);
      const onlyHead={...r,layers:r.layers.map(l=>({...l,visible:l.id==="head"}))};
      for(let i=0;i<12;i++) {
        const p=renderFrame(onlyHead,i),xs=[];
        for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3])xs.push(x);
        const left=Math.min(...xs),right=Math.max(...xs);
        assert.equal((right-left+1)%2,0,`${width}/${build.id}/${style.id}/${head}/${r.frames[i].name}: even silhouette width`);
        assert.equal(left+right,23,"head stays centered on the native half-pixel axis");
      }
    }
  }
  assert.deepEqual(parseCharacterDocument({...base,creator:legacy}).creator,recovered);
});

test("built-in front and rear idle sprites are pixel-symmetrical across options, styles and seeded designs",()=>{
  const base=createCharacterDocument();
  for(const build of base.creator.builds)for(const style of base.creator.styles) {
    const d={...structuredClone(base),build:build.id,style:style.id};
    for(const slot of d.creator.slots)for(const option of slot.options)
      assertFacingIdleSymmetry(compileCharacter({...d,selections:{...d.selections,[slot.id]:option.id}}),`${build.id}/${style.id}/${slot.id}/${option.id}`);
    for(const seed of [1204,1215,1233])for(const mode of ["authored","adjustable","procedural"])
      assertFacingIdleSymmetry(compileCharacter(randomizeCharacter({...d,mode},{seed})),`${build.id}/${style.id}/${mode}/${seed}`);
    const edited=structuredClone(d);edited.creator.builds.find(b=>b.id===build.id).torsoWidth=5;
    edited.creator.slots.find(s=>s.id==="head").options[0].drawing.cuts=Array(8).fill(3);
    assertFacingIdleSymmetry(compileCharacter(edited),`${build.id}/${style.id}/custom contour and legacy odd torso`);
  }
});
test("composited profile eyes and slim front eyes retain skin separation",()=>{
  const base=createCharacterDocument(), landmarks={chibi:{west:7,east:8,y:6},classic:{west:7,east:8,y:6},slim:{west:7,east:8,y:5}};
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).concat(255);
  const at=(p,x,y)=>Array.from(p.data.slice(((y+4)*p.width+x+4)*4,((y+4)*p.width+x+4)*4+4));
  for(const build of base.creator.builds)for(const style of base.creator.styles) {
    const r=compileCharacter({...structuredClone(base),build:build.id,style:style.id}), eye=landmarks[build.id];
    for(const dir of ["west","east"])for(const pose of [0,1,2]) {
      const p=renderFrame(r,CHARACTER_FRAMES.indexOf(`${dir}-${pose}`)),x=eye[dir],y=eye.y+1,label=`${build.id}/${style.id}/${dir}-${pose}`;
      assert.deepEqual(at(p,x,y),rgb(r.palette.outline),`${label}: visible pupil`);
      for(const dx of [-1,1])assert.deepEqual(at(p,x+dx,y),rgb(r.palette.skin),`${label}: skin separates pupil from face edge and hair`);
    }
    if(build.id==="slim")for(const pose of [0,1,2]) {
      const p=renderFrame(r,pose),y=6;
      for(const x of [6,9]) {
        assert.deepEqual(at(p,x,y),rgb(r.palette.outline));
        for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const color=at(p,x+dx,y+dy);
          assert.ok([r.palette.skin,r.palette.skinLight,r.palette.skinShadow].some(role=>JSON.stringify(rgb(role))===JSON.stringify(color)),`${style.id}/south-${pose}: skin around slim pupil at ${x},${y}`);
        }
      }
    }
  }
});
test("profile feet articulate a planted toe and lifted heel, with alternating support",()=>{
  const base=createCharacterDocument();
  const layerFrame=(r,frame,id)=>renderFrame({...r,layers:r.layers.map(l=>({...l,visible:l.id===id}))},CHARACTER_FRAMES.indexOf(frame));
  const opaque=p=>{
    const found=[];
    for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3])found.push([x,y]);
    return found;
  };
  const bounds=p=>{const points=opaque(p);return {left:Math.min(...points.map(v=>v[0])),right:Math.max(...points.map(v=>v[0])),top:Math.min(...points.map(v=>v[1])),bottom:Math.max(...points.map(v=>v[1]))};};
  for(const build of base.creator.builds)for(const style of base.creator.styles)for(const shoes of ["boots","soft"]) {
    const r=compileCharacter({...structuredClone(base),build:build.id,style:style.id,selections:{...base.selections,shoes}});
    for(const dir of ["west","east"]) {
      const feet=[0,1,2].map(pose=>["near-shoe","far-shoe"].map(id=>layerFrame(r,`${dir}-${pose}`,id))), contacts=feet.slice(1).map(pair=>pair.map(bounds));
      assert.equal(contacts[0][0].left,contacts[1][1].left,"contacts exchange the forward reach");
      assert.equal(contacts[0][1].right,contacts[1][0].right,"contacts exchange the rear reach");
      for(const pair of contacts) {
        const ordered=[...pair].sort((a,b)=>a.left-b.left);
        assert.ok(ordered[0].right<ordered[1].left,"contacts separate feet in both facings");
      }
      const shoeVolumes=["near-shoe","far-shoe"].map((_,foot)=>feet.map(pair=>opaque(pair[foot]).length));
      for(const volumes of shoeVolumes)assert.ok(Math.max(...volumes)-Math.min(...volumes)<=1,"heel articulation changes at most one silhouette pixel");
      assert.deepEqual(feet.map(pair=>pair.map(foot=>bounds(foot).bottom)),[[19,19],[19,18],[18,19]],"the planted foot alternates while passing gathers both feet");
      for(const pair of feet)for(const foot of pair) {
        const box=bounds(foot);
        assert.equal(box.right-box.left+1,3,"native toe silhouette is three pixels wide");
        assert.equal(box.bottom-box.top+1,3,"shoe shaft, material and sole keep three native rows");
      }
      for(const pose of [0,1,2]) {
        const p=renderFrame(r,CHARACTER_FRAMES.indexOf(`${dir}-${pose}`));
        for(const foot of feet[pose]) {
          const visible=opaque(foot).filter(([x,y])=>{
            const i=(y*p.width+x)*4,color=foot.data.slice(i,i+4),hex="#"+Array.from(color.slice(0,3)).map(v=>v.toString(16).padStart(2,"0")).join("");
            return [r.palette.leather,r.palette.leatherShadow,r.palette.shoeLight].includes(hex)&&color.every((v,j)=>p.data[i+j]===v);
          });
          assert.ok(visible.length,`${build.id}/${style.id}/${dir}-${pose}: shoe material survives compositing`);
        }
      }
      const shoePair={...r,layers:r.layers.map(l=>({...l,visible:l.id.endsWith("-shoe")}))};
      const passing=renderFrame(shoePair,CHARACTER_FRAMES.indexOf(`${dir}-0`)),soles=[];
      for(let x=0;x<passing.width;x++)if(passing.data[(19*passing.width+x)*4+3])soles.push(x);
      assert.ok(soles.some((x,i)=>i>0&&x-soles[i-1]>1),"passing soles retain a visible floor gap");
      assert.notEqual(sha(renderFrame(shoePair,CHARACTER_FRAMES.indexOf(`${dir}-1`)).data),sha(renderFrame(shoePair,CHARACTER_FRAMES.indexOf(`${dir}-2`)).data),"contacts retain distinct near/far shoe silhouettes");
      assert.deepEqual(r.clips[`walk-${dir}`],{frames:[`${dir}-1`,`${dir}-0`,`${dir}-2`,`${dir}-0`],fps:8});
    }
  }
});

test("walk keeps the upper body steady and counter-swings each arm against its own foot",()=>{
  const base=createCharacterDocument();
  const layer=(r,dir,pose,id)=>renderFrame({...r,layers:r.layers.map(l=>({...l,visible:l.id===id}))},CHARACTER_FRAMES.indexOf(`${dir}-${pose}`));
  const center=p=>{
    const points=[];for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3])points.push([x,y]);
    return [0,1].map(axis=>points.reduce((sum,p)=>sum+p[axis],0)/points.length);
  };
  for(const build of base.creator.builds)for(const style of base.creator.styles) {
    const r=compileCharacter({...structuredClone(base),build:build.id,style:style.id});
    for(const dir of ["south","west","east","north"]) {
      for(const id of ["head","front-hair","hat","torso","clothing","bag"]) {
        assert.deepEqual(layer(r,dir,0,id).data,layer(r,dir,1,id).data,`${build.id}/${style.id}/${dir}: no passing-key upper-body jump`);
        assert.deepEqual(layer(r,dir,1,id).data,layer(r,dir,2,id).data);
      }
      const axis=dir==="west"||dir==="east"?0:1;
      for(const side of ["near","far"]) {
        const arm=[1,2].map(pose=>center(layer(r,dir,pose,`${side}-arm`))[axis]),
          foot=[1,2].map(pose=>center(layer(r,dir,pose,`${side}-shoe`))[axis]);
        assert.ok((arm[1]-arm[0])*(foot[1]-foot[0])<0,`${build.id}/${style.id}/${dir}: ${side} arm counters its own leg`);
      }
    }
  }
});

test("outlined built-in drawings keep ink on exposed edges and backpacks use only leather roles",()=>{
  const base=createCharacterDocument();
  for(const build of base.creator.builds)for(const style of base.creator.styles.filter(s=>s.outline)) {
    const d={...structuredClone(base),build:build.id,style:style.id};
    const cases=[d,...d.creator.slots.flatMap(slot=>slot.options.map(option=>({...d,selections:{...d.selections,[slot.id]:option.id}}))),
      ...[1204,1215,1233].map(seed=>randomizeCharacter({...d,mode:"procedural"},{seed}))];
    for(const candidate of cases) {
      const r=compileCharacter(candidate), ink=[1,3,5].map(i=>parseInt(r.palette.outline.slice(i,i+2),16));
      for(let frame=0;frame<12;frame++) {
        const p=renderFrame(r,frame),alpha=(x,y)=>x>=0&&x<p.width&&y>=0&&y<p.height&&p.data[(y*p.width+x)*4+3]>0;
        for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(alpha(x,y)&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>!alpha(x+dx,y+dy)))
          assert.deepEqual([...p.data.slice((y*p.width+x)*4,(y*p.width+x)*4+3)],ink,`${build.id}/${style.id}/${r.frames[frame].name}: exposed ink at ${x},${y}`);
        for(const op of r.parts[`bag-${r.frames[frame].name}`])
          assert.ok(Object.values(op.ink).every(role=>["outline","leather","leatherShadow"].includes(role)),"pack never borrows skin, apparel or accent roles");
      }
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
  for(const palette of d.creator.palettes) {
    const outfit={...structuredClone(d),palette:palette.id,selections:{...d.selections,clothing:"vest"}},
      recovered=importCharacterOption(outfit,{slot:"badge",id:"imported",name:"Badge",recipe:source,frames:mapping,layers:[source.layers[0].id]});
    assert.equal(compileCharacter(recovered).character.creator.styles[0].budget,8,"material seams retain room for an existing eighth imported color");
    assert.deepEqual(recovered.creator.slots.at(-1).options.at(-1).imported.recipe,source);
  }
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
