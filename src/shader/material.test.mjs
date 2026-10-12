import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {generateMaterial,sampleCliffStructure,sampleSurfaceStructure,validateMaterialRecipe,STYLE_SURFACE_FAMILIES,MATERIAL_STYLES,STYLE_SURFACE_SIZES} from './material.mjs';
import {bakeMaterial} from '../../scripts/bake-material.mjs';
test('periodic structure and shared channels are deterministic; palette preserves relief',()=>{
  const a=generateMaterial(),b=generateMaterial(),c=generateMaterial({palette:'slate'});for(const k of ['height','normal','roughness']){assert.deepEqual(a.channels[k],b.channels[k]);assert.deepEqual(a.channels[k],c.channels[k]);}
  assert.notDeepEqual(a.channels.albedo,c.channels.albedo);
  for(const [u,v]of [[0,.3],[.13,.71],[-.2,1.4],[1,0]]){const s=sampleCliffStructure({},u,v);assert.deepEqual(s,sampleCliffStructure({},u+1,v));for(const k of Object.keys(s))assert.ok(Math.abs(s[k]-sampleCliffStructure({},u,v+1)[k])<1e-12);}
  assert.notDeepEqual(a.channels.height,generateMaterial({seed:99}).channels.height);
});
test('normals use wrapped height derivatives; maps have matching bounds and grayscale data',()=>{
  const a=generateMaterial(),n=128;
  /** @param {number} x @param {number} y */
  const at=(x,y)=>a.heights[((y+n)%n)*n+(x+n)%n];
  for(const [x,y]of [[0,0],[127,127],[0,60],[60,0],[48,36]]){const dx=(at(x+1,y)-at(x-1,y))*n*.08,dy=(at(x,y+1)-at(x,y-1))*n*.08,length=Math.hypot(dx,dy,1),p=(y*n+x)*4;assert.equal(a.channels.normal.data[p],Math.round((-.5*dx/length+.5)*255));assert.equal(a.channels.normal.data[p+1],Math.round((-.5*dy/length+.5)*255));}
  for(const channel of Object.values(a.channels)){assert.equal(channel.data.length,n*n*4);assert.equal(channel.width,n);}
  for(let i=0;i<a.channels.roughness.data.length;i+=4){assert.equal(a.channels.roughness.data[i],a.channels.roughness.data[i+1]);assert.equal(a.channels.roughness.data[i],a.channels.roughness.data[i+2]);}
  const flat=generateMaterial({relief:0});for(let i=0;i<flat.channels.normal.data.length;i+=4)assert.deepEqual([...flat.channels.normal.data.subarray(i,i+4)],[128,128,255,255]);
});
test('invalid recipes fail before output generation',()=>{for(const r of [null,[],{seed:-1},{seed:1.5},{size:8192},{palette:'bad'},{fracture:NaN},{relief:2},{roughness:0},{unknown:1},{constructor:'x'}])assert.throws(()=>validateMaterialRecipe(r));});

test('cached bakes reject altered channel metadata, recipe and provenance',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'material-metadata-'));
  try{
    const first=await bakeMaterial({output}),file=path.join(first.directory,'material.json'),before=await fs.readFile(file);
    /** @type {((m:{recipe:{palette:string},generator:string,sources:{sha256:string}[],format:string,visualReview:string,provenance:{restrictedInputs:unknown[]},files:Record<string,unknown>[]})=>void)[]} */
    const edits=[m=>m.recipe.palette='slate',m=>m.generator='other/1',m=>m.sources[0].sha256='0'.repeat(64),m=>m.format='other/1',m=>m.visualReview='approved',m=>m.provenance.restrictedInputs.push('private'),m=>m.files[0].channel='normal',m=>m.files[0].width=64,m=>m.files[0].colorSpace='linear',m=>m.files[0].bytes=1,m=>m.files[0].filter='linear',m=>m.files[0].path='s999-albedo.png'];
    for(const edit of edits){
      const altered=JSON.parse(JSON.stringify(first.manifest));edit(altered);await fs.writeFile(file,JSON.stringify(altered));
      await assert.rejects(bakeMaterial({output}),/material|identity|metadata|provenance/i);
      assert.equal((await fs.readdir(output)).filter(p=>p.startsWith('.pending-')).length,0);
    }
    await fs.writeFile(file,before);assert.equal((await bakeMaterial({output})).reused,true);
  }finally{await fs.rm(output,{recursive:true,force:true});}
});

test('cancellation during cache reads cannot report successful reuse',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'material-cache-cancel-'));
  try{
    const first=await bakeMaterial({output}),before=await fs.readFile(path.join(first.directory,'material.json')),abort=new AbortController();
    const task=bakeMaterial({output,signal:abort.signal}),timer=setTimeout(()=>abort.abort(Error('cancel cached bake')),0);
    try{await assert.rejects(task,/cancel cached bake/);}finally{clearTimeout(timer);}
    assert.deepEqual(before,await fs.readFile(path.join(first.directory,'material.json')));
  }finally{await fs.rm(output,{recursive:true,force:true});}
});

test('all ten surface structures compose with all four original styles at their selected defaults',()=>{
  assert.deepEqual(STYLE_SURFACE_SIZES,{'hd2d':128,'cel-ink':256,'soft-cartoon':256,'pbr':512});
  for(const family of STYLE_SURFACE_FAMILIES)for(const style of MATERIAL_STYLES){
    const recipe=validateMaterialRecipe({id:'style-surface',family,style}),small=generateMaterial(recipe);
    assert.equal(recipe.size,STYLE_SURFACE_SIZES[style]);
    assert.deepEqual(Object.keys(small.channels).sort(),['albedo','height','normal','roughness']);
    for(const channel of Object.values(small.channels)){assert.equal(channel.width,recipe.size);assert.equal(channel.height,recipe.size);assert.equal(channel.data.length,recipe.size*recipe.size*4);}
    for(let i=3;i<small.channels.albedo.data.length;i+=4)assert.equal(small.channels.albedo.data[i],255);
  }
});

test('surface-family sampling is deterministic and periodic for three retained seeds',()=>{
  for(const family of STYLE_SURFACE_FAMILIES)for(const seed of [1204,1215,1233]){
    const recipe={id:'style-surface',family,style:'hd2d',seed,size:64},sample=sampleSurfaceStructure(recipe,.137,.713);
    assert.deepEqual(sample,sampleSurfaceStructure(recipe,.137,.713));
    for(const delta of [[1,0],[0,1],[-2,3]]){
      const shifted=sampleSurfaceStructure(recipe,.137+delta[0],.713+delta[1]);
      for(const key of Object.keys(sample))assert.ok(Math.abs(sample[key]-shifted[key])<1e-12,`${family} seed ${seed} ${key}`);
    }
    const a=generateMaterial(recipe),b=generateMaterial(recipe);
    for(const key of Object.keys(a.channels))assert.deepEqual(a.channels[key],b.channels[key]);
  }
});

test('surface palette affects pigment only and style relief drives matching height and normals',()=>{
  const base={id:'style-surface',family:'cliff',style:'hd2d',seed:1204,size:64},earth=generateMaterial(base),slate=generateMaterial({...base,palette:'slate'});
  assert.notDeepEqual(earth.channels.albedo,slate.channels.albedo);
  for(const channel of ['height','normal','roughness'])assert.deepEqual(earth.channels[channel],slate.channels[channel]);
  const pbr=generateMaterial({...base,style:'pbr'});assert.notDeepEqual(earth.channels.height,pbr.channels.height);
  const n=64;
  /** @param {number} x @param {number} y */
  const at=(x,y)=>pbr.heights[((y+n)%n)*n+(x+n)%n];
  for(const [x,y]of [[0,0],[63,63],[0,31],[31,0]]){
    const dx=(at(x+1,y)-at(x-1,y))*n*.08,dy=(at(x,y+1)-at(x,y-1))*n*.08,length=Math.hypot(dx,dy,1),p=(y*n+x)*4;
    assert.equal(pbr.channels.height.data[p],Math.round(at(x,y)*255));
    assert.equal(pbr.channels.normal.data[p],Math.round((-.5*dx/length+.5)*255));
    assert.equal(pbr.channels.normal.data[p+1],Math.round((-.5*dy/length+.5)*255));
  }
});
test('cliffs use interrupted strata rather than closed cell seams, and PBR pigment stays continuous',()=>{
  for(const [u,v]of [[.13,.24],[.36,.78],[.87,.42]]) {
    const cliff=sampleSurfaceStructure({id:'style-surface',family:'cliff'},u,v),strata=sampleCliffStructure({id:'hd2d-cliff-strata'},u,v);
    assert.equal(cliff.joint,strata.joint);assert.equal(cliff.height,strata.height);
    assert.equal(sampleSurfaceStructure({id:'style-surface',family:'grass'},u,v).joint,0);
  }
  const hd=generateMaterial({id:'style-surface',family:'plaster',style:'hd2d',size:64}),physical=generateMaterial({id:'style-surface',family:'plaster',style:'pbr',size:64});
  /** @param {ReturnType<typeof generateMaterial>} material */
  const colors=material=>{const values=new Set();for(let i=0;i<material.channels.albedo.data.length;i+=4)values.add(material.channels.albedo.data.slice(i,i+3).join(','));return values.size;};
  assert.ok(colors(hd)<=6);assert.ok(colors(physical)>64);
});
test('bake is content bound, repeatable and cancellation preserves prior output',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'material-test-'));try{
    const first=await bakeMaterial({output}),second=await bakeMaterial({output});assert.equal(second.reused,true);assert.equal(first.manifest.files.length,13);assert.equal(first.manifest.visualReview,'unapproved');
    const before=await fs.readFile(path.join(first.directory,'material.json'));const signal=AbortSignal.abort(Error('cancel'));await assert.rejects(bakeMaterial({output,recipe:{seed:99},signal}),/cancel/);assert.deepEqual(before,await fs.readFile(path.join(first.directory,'material.json')));assert.ok(!(await fs.readdir(output)).some(p=>p.startsWith('.pending-')));
    const abort=new AbortController(),task=bakeMaterial({output,recipe:{seed:91},signal:abort.signal});setTimeout(()=>abort.abort(Error('cancel during bake')),20);await assert.rejects(task,/cancel/);assert.deepEqual(before,await fs.readFile(path.join(first.directory,'material.json')));assert.ok(!(await fs.readdir(output)).some(p=>p.startsWith('.pending-')));
    const cached=structuredClone(first.manifest);cached.files[0].path='../outside.png';await fs.writeFile(path.join(first.directory,'material.json'),JSON.stringify(cached));await assert.rejects(bakeMaterial({output}),/asset path/);await fs.writeFile(path.join(first.directory,'material.json'),before);
    const map=path.join(first.directory,first.manifest.files[0].path),mapBytes=await fs.readFile(map);await fs.unlink(map);await assert.rejects(bakeMaterial({output}),/incomplete/);assert.deepEqual(before,await fs.readFile(path.join(first.directory,'material.json')));await fs.writeFile(map,mapBytes);
    await fs.writeFile(map,'bad');await assert.rejects(bakeMaterial({output}),/altered|deterministic|byte metadata/);
  }finally{await fs.rm(output,{recursive:true,force:true});}
});
