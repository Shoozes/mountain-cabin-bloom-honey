import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generateMaterial, sampleSurfaceStructure, validateMaterialRecipe} from '../src/shader/material.mjs';
import {bakeMaterial} from './bake-material.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const seeds=[1204,1215,1233];
const hash=value=>createHash('sha256').update(value).digest('hex');
const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/material-style-legacy-20261023.json',import.meta.url),'utf8'));

test('legacy material recipes preserve all frozen channel bytes',()=>{
  assert.equal(fixture.cases.length,129);
  for(const item of fixture.cases){
    const recipe=validateMaterialRecipe(item.recipe);
    assert.deepEqual(recipe,item.recipe,`${JSON.stringify(item.recipe)} normalized recipe`);
    const output=generateMaterial(recipe);
    assert.deepEqual(Object.fromEntries(Object.entries(output.channels).map(([name,channel])=>[name,hash(channel.data)])),item.channels,JSON.stringify(item.recipe));
  }
});

test('opt-in dirt clumps are deterministic and periodic at three seeds',()=>{
  const recipes=seeds.map(seed=>validateMaterialRecipe({id:'style-surface',family:'dirt',style:'hd2d',structure:'clumps',seed,size:128}));
  for(const recipe of recipes){
    const point=[.137,.713],base=sampleSurfaceStructure(recipe,...point);
    assert.deepEqual(base,sampleSurfaceStructure(recipe,...point));
    for(const [du,dv]of [[1,0],[0,1],[-2,3]]){
      const shifted=sampleSurfaceStructure(recipe,point[0]+du,point[1]+dv);
      for(const key of Object.keys(base))assert.ok(Math.abs(base[key]-shifted[key])<1e-12,`${recipe.seed} ${key} periodic`);
    }
    assert.deepEqual(generateMaterial(recipe).channels,generateMaterial(recipe).channels);
  }
});

test('dirt fracture darkens and lowers the same localized joints without shifting soil',()=>{
  for(const seed of seeds){
    const base={id:'style-surface',family:'dirt',style:'hd2d',structure:'clumps',seed,size:128,fracture:0},fractured={...base,fracture:1};
    let changed=0;
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const a=sampleSurfaceStructure(base,(x+.5)/32,(y+.5)/32),b=sampleSurfaceStructure(fractured,(x+.5)/32,(y+.5)/32);
      assert.equal(b.soil,a.soil);
      if(b.joint>a.joint){changed++;assert.ok(b.pigment<a.pigment);assert.ok(b.height<a.height);}
    }
    assert.ok(changed>0,`seed ${seed} must expose fracture structure`);
  }
});

test('dirt clump channels align, relief zero flattens normals, and old/new output differ',()=>{
  for(const seed of seeds){
    const recipe={id:'style-surface',family:'dirt',style:'hd2d',structure:'clumps',seed,size:128},result=generateMaterial(recipe),flat=generateMaterial({...recipe,relief:0});
    assert.deepEqual(result.recipe,validateMaterialRecipe(recipe));
    for(const [name,channel]of Object.entries(result.channels)){
      assert.deepEqual([channel.width,channel.height],[128,128],name);
      for(let i=0;i<channel.data.length;i+=4){
        assert.equal(channel.data[i+3],255,`${name} alpha`);
        if(name==='height'||name==='roughness'){
          assert.equal(channel.data[i],channel.data[i+1],`${name} grayscale G`);
          assert.equal(channel.data[i],channel.data[i+2],`${name} grayscale B`);
        }
      }
    }
    const h=(x,y)=>result.heights[((y+128)%128)*128+(x+128)%128];
    const edgePoints=Array.from({length:128},(_,i)=>[[i,0],[i,127],[0,i],[127,i]]).flat();
    for(const [x,y]of edgePoints){
      const dx=(h(x+1,y)-h(x-1,y))*128*.08,dy=(h(x,y+1)-h(x,y-1))*128*.08,len=Math.hypot(dx,dy,1),at=(y*128+x)*4;
      assert.deepEqual([...result.channels.normal.data.slice(at,at+3)],[Math.round((-.5*dx/len+.5)*255),Math.round((-.5*dy/len+.5)*255),Math.round((.5/len+.5)*255)]);
    }
    assert.equal(new Set(Array.from({length:128*128},(_,i)=>flat.channels.normal.data[i*4]+','+flat.channels.normal.data[i*4+1]+','+flat.channels.normal.data[i*4+2])).size,1);
    assert.deepEqual([...flat.channels.normal.data.subarray(0,4)],[128,128,255,255]);
    const legacy={...recipe};delete legacy.structure;assert.notDeepEqual(result.channels.albedo,generateMaterial(legacy).channels.albedo);
    const slate=generateMaterial({...recipe,palette:'slate'});
    assert.notDeepEqual(result.channels.albedo,slate.channels.albedo);
    for(const key of ['height','normal','roughness'])assert.deepEqual(slate.channels[key],result.channels[key],`${key} must be independent of palette`);
  }
});

test('clump recipe is restricted to dirt HD-2D and bake identity preserves cache behavior',async()=>{
  const valid={id:'style-surface',family:'dirt',style:'hd2d',structure:'clumps'},output=await fs.mkdtemp(path.join(os.tmpdir(),'material-dirt-clumps-'));
  try{
    for(const bad of [{...valid,structure:'other'},{...valid,family:'grass'},{...valid,style:'pbr'},{id:'hd2d-cliff',structure:'clumps'}])assert.throws(()=>validateMaterialRecipe(bad));
    assert.deepEqual(validateMaterialRecipe({id:'style-surface',family:'dirt',style:'hd2d',structure:undefined}),validateMaterialRecipe({id:'style-surface',family:'dirt',style:'hd2d'}));
    const old=await bakeMaterial({recipe:{id:'style-surface',family:'dirt',style:'hd2d'},output,variantSet:'single'});
    const first=await bakeMaterial({recipe:valid,output,variantSet:'single'});
    assert.notEqual(first.manifest.identity,old.manifest.identity);
    assert.equal(first.manifest.recipe.structure,'clumps');
    assert.equal((await bakeMaterial({recipe:valid,output,variantSet:'single'})).reused,true);
    const manifestPath=path.join(first.directory,'material.json'),manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
    const asset=manifest.files.find(file=>file.channel==='albedo'),assetPath=path.join(first.directory,asset.path),saved=await fs.readFile(assetPath);
    await fs.writeFile(assetPath,Buffer.from('corrupt'));
    await assert.rejects(bakeMaterial({recipe:valid,output,variantSet:'single'}),/altered|incomplete|differs|metadata/i);
    await fs.writeFile(assetPath,saved);
    const before=await fs.readFile(manifestPath),abort=new AbortController(),pending=bakeMaterial({recipe:{...valid,seed:99},output,variantSet:'single',signal:abort.signal}),timer=setTimeout(()=>abort.abort(Error('cancel dirt bake')),0);
    try{await assert.rejects(pending,/cancel dirt bake/);}finally{clearTimeout(timer);}
    assert.deepEqual(await fs.readFile(manifestPath),before);
    assert.equal((await fs.readdir(output)).some(name=>name.startsWith('.pending-')),false);
    const cliOut=path.join(output,'cli'),recipePath=path.join(output,'recipe.json');await fs.writeFile(recipePath,JSON.stringify(valid));const cli=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts/bake-material.mjs'),'--recipe',recipePath,'--variant-set','single','--out',cliOut],{cwd:root,encoding:'utf8',windowsHide:true,timeout:40000}).trim());
    assert.equal(cli.variantSet,'single');
    assert.equal(JSON.parse(await fs.readFile(path.join(cli.directory,'material.json'),'utf8')).recipe.structure,'clumps');
  }finally{await fs.rm(output,{recursive:true,force:true});}
});
