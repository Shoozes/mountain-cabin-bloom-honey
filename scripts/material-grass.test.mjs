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
const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/material-tuft-baseline-20261023.json',import.meta.url),'utf8'));

test('legacy grass and current clump recipes preserve all frozen channel bytes',()=>{
  assert.equal(fixture.base,'5478f302543b78cc168149078f2b4293b398342c');
  assert.equal(fixture.cases.length,6);
  for(const item of fixture.cases){
    const recipe=validateMaterialRecipe(item.recipe),output=generateMaterial(recipe);
    assert.deepEqual(recipe,item.recipe,`${JSON.stringify(item.recipe)} normalized recipe`);
    assert.deepEqual(Object.fromEntries(Object.entries(output.channels).map(([name,channel])=>[name,hash(channel.data)])),item.channels,JSON.stringify(item.recipe));
  }
});

test('optional tuft recipe omission and explicit undefined preserve legacy grass data',()=>{
  for(const seed of seeds){
    const legacy={id:'style-surface',family:'grass',style:'hd2d',seed,size:128};
    assert.deepEqual(validateMaterialRecipe({...legacy,structure:undefined}),validateMaterialRecipe(legacy));
    assert.deepEqual(generateMaterial({...legacy,structure:undefined}),generateMaterial(legacy));
  }
});

test('tuft structure is restricted to HD-2D grass while clumps remain dirt-only',()=>{
  for(const bad of [
    {id:'style-surface',family:'dirt',style:'hd2d',structure:'tufts'},
    {id:'style-surface',family:'grass',style:'pbr',structure:'tufts'},
    {id:'style-surface',family:'grass',style:'hd2d',structure:'clumps'},
    {id:'style-surface',family:'dirt',style:'hd2d',structure:'unknown'},
    {id:'hd2d-cliff',structure:'tufts'},
  ])assert.throws(()=>validateMaterialRecipe(bad));
  for(const seed of seeds)assert.equal(validateMaterialRecipe({id:'style-surface',family:'grass',style:'hd2d',structure:'tufts',seed,size:128}).structure,'tufts');
});

test('tuft samples are deterministic and periodic, with blades rooted inside tuft masks',()=>{
  for(const seed of seeds){
    const recipe=validateMaterialRecipe({id:'style-surface',family:'grass',style:'hd2d',structure:'tufts',seed,size:128}),point=[.137,.713],base=sampleSurfaceStructure(recipe,...point);
    assert.deepEqual(base,sampleSurfaceStructure(recipe,...point));
    for(const key of ['tuft','blade'])assert.ok(Number.isFinite(base[key])&&base[key]>=0&&base[key]<=1,`${key} mask range`);
    let bladeSamples=0,tuftSamples=0,maxBlade=0,maxTuft=0;
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const sample=sampleSurfaceStructure(recipe,(x+.5)/128,(y+.5)/128);
      assert.ok(Number.isFinite(sample.blade)&&Number.isFinite(sample.tuft)&&sample.blade>=0&&sample.blade<=sample.tuft&&sample.tuft<=1,`${seed} blades remain rooted inside tuft`);
      if(sample.blade>0)bladeSamples++;
      if(sample.tuft>0)tuftSamples++;
      maxBlade=Math.max(maxBlade,sample.blade);maxTuft=Math.max(maxTuft,sample.tuft);
    }
    assert.ok(bladeSamples>0&&tuftSamples>0&&maxBlade>0&&maxTuft>0,`${seed} tile contains tuft and blade structure`);
    for(const [du,dv]of [[1,0],[0,1],[-2,3]]){
      const shifted=sampleSurfaceStructure(recipe,point[0]+du,point[1]+dv);
      for(const key of Object.keys(base))assert.ok(Math.abs(base[key]-shifted[key])<1e-12,`${seed} ${key} periodic`);
    }
    assert.deepEqual(generateMaterial(recipe).channels,generateMaterial(recipe).channels);
  }
});

test('tuft recipes change grass, keep color out of geometry, and preserve wrapped channel contracts',()=>{
  for(const seed of seeds){
    const tuft={id:'style-surface',family:'grass',style:'hd2d',structure:'tufts',seed,size:128},legacy={...tuft};delete legacy.structure;
    const result=generateMaterial(tuft),old=generateMaterial(legacy),slate=generateMaterial({...tuft,palette:'slate'}),flat=generateMaterial({...tuft,relief:0});
    assert.notDeepEqual(result.channels.albedo,old.channels.albedo);
    assert.deepEqual(result.recipe,validateMaterialRecipe(tuft));
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
    assert.notDeepEqual(result.channels.albedo,slate.channels.albedo);
    for(const key of ['height','normal','roughness'])assert.deepEqual(slate.channels[key],result.channels[key],`${key} palette independence`);
    for(let i=0;i<flat.channels.normal.data.length;i+=4)assert.deepEqual([...flat.channels.normal.data.subarray(i,i+4)],[128,128,255,255]);
    const h=(x,y)=>result.heights[((y+128)%128)*128+(x+128)%128];
    for(const [x,y]of Array.from({length:128},(_,i)=>[[i,0],[i,127],[0,i],[127,i]]).flat()){
      const dx=(h(x+1,y)-h(x-1,y))*128*.08,dy=(h(x,y+1)-h(x,y-1))*128*.08,len=Math.hypot(dx,dy,1),at=(y*128+x)*4;
      assert.deepEqual([...result.channels.normal.data.slice(at,at+3)],[Math.round((-.5*dx/len+.5)*255),Math.round((-.5*dy/len+.5)*255),Math.round((.5/len+.5)*255)]);
    }
  }
});

test('tuft recipe bake identity retains exact schema, cache checks and cancellation cleanup',async()=>{
  const recipe={id:'style-surface',family:'grass',style:'hd2d',structure:'tufts'},output=await fs.mkdtemp(path.join(os.tmpdir(),'material-grass-tufts-'));
  try{
    const legacy=await bakeMaterial({recipe:{id:'style-surface',family:'grass',style:'hd2d'},output,variantSet:'single'}),first=await bakeMaterial({recipe,output,variantSet:'single'});
    assert.notEqual(first.manifest.identity,legacy.manifest.identity);
    assert.equal(first.manifest.recipe.structure,'tufts');
    assert.equal((await bakeMaterial({recipe,output,variantSet:'single'})).reused,true);
    const manifestPath=path.join(first.directory,'material.json'),manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
    const asset=manifest.files.find(file=>file.channel==='albedo'),assetPath=path.join(first.directory,asset.path),saved=await fs.readFile(assetPath);
    await fs.writeFile(assetPath,Buffer.from('corrupt'));
    await assert.rejects(bakeMaterial({recipe,output,variantSet:'single'}),/altered|incomplete|differs|metadata/i);
    await fs.writeFile(assetPath,saved);
    const before=await fs.readFile(manifestPath),abort=new AbortController(),pending=bakeMaterial({recipe:{...recipe,seed:99},output,variantSet:'single',signal:abort.signal}),timer=setTimeout(()=>abort.abort(Error('cancel tuft bake')),0);
    try{await assert.rejects(pending,/cancel tuft bake/);}finally{clearTimeout(timer);}
    assert.deepEqual(await fs.readFile(manifestPath),before);
    assert.equal((await fs.readdir(output)).some(name=>name.startsWith('.pending-')),false);
    const cliOut=path.join(output,'cli'),recipePath=path.join(output,'recipe.json');await fs.writeFile(recipePath,JSON.stringify(recipe));
    const cli=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts/bake-material.mjs'),'--recipe',recipePath,'--variant-set','single','--out',cliOut],{cwd:root,encoding:'utf8',windowsHide:true,timeout:40000}).trim());
    assert.equal(JSON.parse(await fs.readFile(path.join(cli.directory,'material.json'),'utf8')).recipe.structure,'tufts');
  }finally{await fs.rm(output,{recursive:true,force:true});}
});
