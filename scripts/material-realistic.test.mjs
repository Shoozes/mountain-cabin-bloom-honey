import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {generateMaterial,validateMaterialRecipe,materialVersion,REALISTIC_SURFACE_FAMILIES,REALISTIC_SURFACE_PRESETS} from '../src/shader/material.mjs';
import {sampleRealisticStructure,shadeRealisticPreview} from '../src/shader/material-realistic.mjs';
import {bakeMaterial} from './bake-material.mjs';
import {bakeVertexColors} from './bake-vertex-colors.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function decode(bytes){
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),parts=[];
  for(let p=8;p<bytes.length;){const n=bytes.readUInt32BE(p);if(bytes.toString('ascii',p+4,p+8)==='IDAT')parts.push(bytes.subarray(p+8,p+8+n));p+=n+12;}
  const stride=width*4,rows=inflateSync(Buffer.concat(parts)),data=Buffer.alloc(stride*height);
  for(let y=0;y<height;y++){assert.equal(rows[y*(stride+1)],0);rows.copy(data,y*stride,y*(stride+1)+1,(y+1)*(stride+1));}
  return {width,height,data};
}
test('46 existing recipes retain their 184 pre-change channel identities',async()=>{
  const baseline=JSON.parse(await fs.readFile(new URL('./fixtures/material-realistic-legacy-baseline-20261012.json',import.meta.url)));
  assert.equal(baseline.cases.length,46);
  for(const entry of baseline.cases){const m=generateMaterial(entry.recipe);for(const [channel,sha] of Object.entries(entry.channels))assert.equal(hash(m.channels[channel].data),sha,JSON.stringify(entry.recipe)+' '+channel);}
});
test('realistic presets validate bounded editable recipes without changing old defaults',()=>{
  assert.equal(REALISTIC_SURFACE_PRESETS.length,6);assert.equal(new Set(REALISTIC_SURFACE_PRESETS.map(p=>p.recipe.family)).size,6);
  for(const preset of REALISTIC_SURFACE_PRESETS){assert.deepEqual(validateMaterialRecipe(preset.recipe),preset.recipe);assert.equal(preset.recipe.size,512);}
  assert.equal(validateMaterialRecipe({id:'realistic-surface'}).family,'soil');assert.equal(validateMaterialRecipe().id,'hd2d-cliff');
  assert.equal(materialVersion('realistic-surface'),'realistic-surface/1');
  for(const extra of [{family:'grass'},{style:'pbr'},{size:1024},{palette:'woodland'},{seed:-1},{seed:4294967296},{seed:1.5},{roughness:0},{strataScale:0},{fracture:NaN}])assert.throws(()=>generateMaterial({id:'realistic-surface',...extra}));
});
for(const family of REALISTIC_SURFACE_FAMILIES){
  test(family+' continuous periodic fields preserve palette-independent geometry',()=>{
    for(const seed of [1204,1215,1233]){
      const recipe={id:'realistic-surface',family,seed,size:64},a=generateMaterial(recipe),b=generateMaterial(recipe),slate=generateMaterial({...recipe,palette:'slate'});
      for(const channel of ['albedo','height','normal','roughness'])assert.deepEqual(a.channels[channel],b.channels[channel]);
      for(const channel of ['height','normal','roughness'])assert.deepEqual(a.channels[channel],slate.channels[channel]);
      assert.notDeepEqual(a.channels.albedo,slate.channels.albedo);
      for(const [u,v]of [[0,0],[.137,.713],[-.4,1.3],[.999,.01]]){
        const s=sampleRealisticStructure(recipe,u,v);
        for(const shifted of [sampleRealisticStructure(recipe,u+1,v),sampleRealisticStructure(recipe,u,v-1)]){
          assert.ok(Math.abs(s.height-shifted.height)<1e-9);assert.ok(Math.abs(s.roughness-shifted.roughness)<1e-9);
          for(let i=0;i<3;i++)assert.ok(Math.abs(s.color[i]-shifted.color[i])<1e-8);
        }
      }
      for(const pixels of Object.values(a.channels)){assert.equal(pixels.width,64);assert.equal(pixels.height,64);assert.equal(pixels.data.length,64*64*4);for(let p=3;p<pixels.data.length;p+=4)assert.equal(pixels.data[p],255);}
      const colors=new Set();for(let p=0;p<a.channels.albedo.data.length;p+=4)colors.add(a.channels.albedo.data.subarray(p,p+3).toString());assert.ok(colors.size>128,'Continuous pigment should not collapse to a finite pixel-art ramp');
      for(let p=0;p<a.channels.normal.data.length;p+=4){const n=[...a.channels.normal.data.subarray(p,p+3)].map(c=>c/255*2-1);assert.ok(Math.abs(Math.hypot(...n)-1)<.015);assert.ok(n[2]>0);}
    }
    const a=generateMaterial({id:'realistic-surface',family,seed:1204,size:64}),b=generateMaterial({id:'realistic-surface',family,seed:1215,size:64});assert.notEqual(hash(a.channels.albedo.data),hash(b.channels.albedo.data));
    const flat=generateMaterial({id:'realistic-surface',family,size:64,relief:0});for(let p=0;p<flat.channels.normal.data.length;p+=4)assert.deepEqual([...flat.channels.normal.data.subarray(p,p+4)],[128,128,255,255]);
  });
}
test('realistic controls change structure or roughness without recoloring pigment through light',()=>{
  const base={id:'realistic-surface',family:'limestone',size:64};
  const a=generateMaterial(base),r=generateMaterial({...base,roughness:.2}),h=generateMaterial({...base,relief:.1});
  assert.deepEqual(a.channels.albedo,r.channels.albedo);assert.deepEqual(a.channels.albedo,h.channels.albedo);assert.notDeepEqual(a.channels.roughness,r.channels.roughness);assert.notDeepEqual(a.channels.normal,h.channels.normal);
  assert.notDeepEqual(a.channels.height,generateMaterial({...base,fracture:.8}).channels.height);assert.notDeepEqual(a.channels.albedo,generateMaterial({...base,strataScale:7}).channels.albedo);
});
test('neutral light is preview-only and responds to relief and roughness',()=>{
  const recipe={id:'realistic-surface',family:'gravel',size:64},material=generateMaterial(recipe),before=hash(material.channels.albedo.data);
  const lit=shadeRealisticPreview(material.channels);
  assert.equal(lit.width,64);assert.equal(lit.height,64);assert.equal(lit.data.length,64*64*4);
  assert.equal(hash(material.channels.albedo.data),before);assert.notEqual(hash(lit.data),before);
  assert.deepEqual(shadeRealisticPreview(material.channels),lit);
  for(let p=3;p<lit.data.length;p+=4)assert.equal(lit.data[p],255);
  assert.notEqual(hash(shadeRealisticPreview(generateMaterial({...recipe,relief:0}).channels).data),hash(lit.data));
  assert.notEqual(hash(shadeRealisticPreview(generateMaterial({...recipe,roughness:.1}).channels).data),hash(lit.data));
});
test('realistic CLI cache binds generator source and smooth sampling; PNG pixels reproduce',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'realistic-material-test-'));
  try{
    const recipe={id:'realistic-surface',family:'gravel',size:64,seed:1204},baked=await bakeMaterial({recipe,output,variantSet:'single'}),m=generateMaterial(recipe);
    assert.equal(baked.manifest.generator,'realistic-surface/1');assert.ok(baked.manifest.sources.some(s=>s.path==='src/shader/material-realistic.mjs'));
    for(const file of baked.manifest.files.filter(f=>f.channel!=='contact-sheet')){assert.equal(file.filter,'linear');assert.equal(file.wrap,'repeat');const image=decode(await fs.readFile(path.join(baked.directory,file.path)));assert.ok(image.data.equals(Buffer.from(m.channels[file.channel].data)));}
    assert.equal((await bakeMaterial({recipe,output,variantSet:'single'})).reused,true);
    const albedo=path.join(baked.directory,'s1204-albedo.png'),bytes=await fs.readFile(albedo);bytes[bytes.length-1]^=1;await fs.writeFile(albedo,bytes);
    await assert.rejects(bakeMaterial({recipe,output,variantSet:'single'}),/differs from deterministic/);
    const variants=await bakeMaterial({recipe,output:path.join(output,'catalog')});assert.deepEqual([...new Set(variants.manifest.files.filter(f=>f.seed!==undefined).map(f=>f.seed))],[1204,1215,1233]);
  }finally{await fs.rm(output,{recursive:true,force:true});}
});
test('existing vertex-color preparation accepts the new recipe and binds its actual source',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'realistic-vertices-test-'));
  try{
    const mesh={positions:[[0,0,0],[1,0,0],[0,1,0]],indices:[0,1,2],uvs:[[0,0],[1,0],[0,1]]};
    const baked=await bakeVertexColors({mesh,recipe:'realistic-surface',output});
    assert.equal(baked.manifest.recipe.family,'soil');assert.ok(baked.manifest.sources.some(s=>s.path==='src/shader/material-realistic.mjs'));
    assert.equal(baked.manifest.semantics.includesIllumination,false);
    assert.equal((await bakeVertexColors({mesh,recipe:'realistic-surface',output})).reused,true);
  }finally{await fs.rm(output,{recursive:true,force:true});}
});
