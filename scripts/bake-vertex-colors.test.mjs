import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {bakeVertexColors,parseVertexColorArgs} from './bake-vertex-colors.mjs';
import {bakeVertexMesh} from '../src/shader/vertex-colors.mjs';

const triangle=(uvs=[[.25,.75],[.75,.75],[.25,.25]])=>({id:'tri',positions:[[0,0,0],[1,0,0],[0,1,0]],indices:[0,1,2],uvs,normals:[[0,0,1],[0,0,1],[0,0,1]],uv2:[[0,0],[1,0],[0,1]],splatWeights:[[1,0,0,0],[0,1,0,0],[0,0,1,0]],extra:{keep:true}});
const image=(rows,colorSpace='srgb')=>({width:2,height:2,colorSpace,data:new Uint8Array(rows.flat())});
const colors=[255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255];
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,`${actual} != ${expected}`);

test('nearest sampling follows bottom-up mesh UVs, repeat/clamp, tint and metadata preservation',async()=>{
 const albedo=image(colors),mesh=triangle([[.25,.75],[1.25,.75],[-.25,.25]]);
 const repeated=await bakeVertexMesh({mesh,albedo});assert.deepEqual(repeated.colors,[[1,0,0],[1,0,0],[1,1,1]]);assert.deepEqual(repeated.positions,mesh.positions);assert.deepEqual(repeated.indices,mesh.indices);assert.deepEqual(repeated.normals,mesh.normals);assert.deepEqual(repeated.uv2,mesh.uv2);assert.deepEqual(repeated.splatWeights,mesh.splatWeights);assert.deepEqual(repeated.extra,mesh.extra);
 const clamped=await bakeVertexMesh({mesh,albedo,settings:{wrap:'clamp'}});assert.deepEqual(clamped.colors,[[1,0,0],[0,1,0],[0,0,1]]);
 const boundaries=await bakeVertexMesh({mesh:triangle([[.25,0],[.25,1],[.25,1]]),albedo}),clampedBoundaries=await bakeVertexMesh({mesh:triangle([[.25,0],[.25,1],[.25,1]]),albedo,settings:{wrap:'clamp'}});assert.deepEqual(boundaries.colors,[[0,0,1],[0,0,1],[0,0,1]]);assert.deepEqual(clampedBoundaries.colors,[[0,0,1],[1,0,0],[1,0,0]]);
 const tinted=await bakeVertexMesh({mesh:triangle([[.25,.75],[.25,.75],[.25,.75]]),albedo,settings:{tint:'#808080'}});close(tinted.colors[0][0],((128/255+.055)/1.055)**2.4);
});

test('linear filter interpolates in linear light and handles clamp/repeat edges',async()=>{
 const albedo=image(colors),mesh=triangle([[.5,.5],[0,.5],[1,.5]]),result=await bakeVertexMesh({mesh,albedo,settings:{filter:'linear'}});
 const encodedLinear=((128/255+.055)/1.055)**2.4;close(result.colors[0][0],.5);close(result.colors[0][1],.5);close(result.colors[0][2],.5);
 close(result.colors[1][0],.5);close(result.colors[1][1],.5);close(result.colors[1][2],.5);
 close(result.colors[2][0],.5);close(result.colors[2][1],.5);close(result.colors[2][2],.5);assert.ok(encodedLinear>.2);
 const linear=image([128,128,128,255,128,128,128,255,128,128,128,255,128,128,128,255],'linear'),same=await bakeVertexMesh({mesh:triangle([[.25,.75],[.25,.75],[.25,.75]]),albedo:linear});close(same.colors[0][0],128/255);
});

test('mesh and source admission reject missing UVs, invalid topology, nonfinite bounds and alpha',async()=>{
 const albedo=image(colors);
 for(const mesh of [{...triangle(),uvs:undefined},{...triangle(),indices:[0,1,3]},{...triangle(),positions:[[100001,0,0],[1,0,0],[0,1,0]]},{...triangle(),uvs:[[0,0],[100001,0],[0,1]]},{...triangle(),normals:[[0,0,1]]},{...triangle(),uv2Buffer:'uv2',uv2:[[0,0],[1,0],[0,1]]},{...triangle(),indices:[0,1]}])await assert.rejects(bakeVertexMesh({mesh,albedo}));
 const transparent=image([...colors]);transparent.data[3]=254;await assert.rejects(bakeVertexMesh({mesh:triangle(),albedo:transparent}),/opaque/i);
 await assert.rejects(bakeVertexMesh({mesh:triangle(),albedo:{...albedo,colorSpace:'display-p3'}}),/albedo/i);
 await assert.rejects(bakeVertexMesh({mesh:triangle(),albedo,settings:{filter:'cubic'}}),/settings/i);
});

test('bake is deterministic, records source restrictions, verifies caches and preserves prior outputs on cancellation',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vertex-colors-')),output=path.join(root,'out'),mesh=triangle();
 try{
  const first=await bakeVertexColors({mesh,recipe:'hd2d-cliff',output});assert.equal(first.reused,false);assert.equal(first.manifest.format,'vertex-colors/1');assert.deepEqual(first.manifest.provenance.restrictedInputs,['usage-unverified/local-only']);assert.equal(first.manifest.source.vertexCount,3);assert.deepEqual(first.manifest.semantics,{attribute:'vertex-color',colorSpace:'linear-srgb',operation:'multiply-base-color-before-lighting',includesIllumination:false,alpha:'none',uvV:'increases-upward'});
  const again=await bakeVertexColors({mesh,recipe:'hd2d-cliff',output});assert.equal(again.reused,true);assert.equal(again.manifest.identity,first.manifest.identity);
  const declared=await bakeVertexColors({mesh,recipe:'hd2d-cliff',restrictedInputs:[],output});assert.deepEqual(declared.manifest.provenance.restrictedInputs,[]);assert.notEqual(declared.manifest.identity,first.manifest.identity);
  const outputFile=path.join(first.directory,'mesh.json'),good=await fs.readFile(outputFile),manifestPath=path.join(first.directory,'vertex-colors.json'),goodManifest=await fs.readFile(manifestPath);
  await fs.writeFile(outputFile,'tampered');await assert.rejects(bakeVertexColors({mesh,recipe:'hd2d-cliff',output}),/altered/i);await fs.writeFile(outputFile,good);
  const editedMesh=JSON.parse(good.toString());editedMesh.positions[0][0]=9;const editedBytes=Buffer.from(JSON.stringify(editedMesh,null,2)+'\n'),editedManifest=JSON.parse(goodManifest.toString());editedManifest.file.bytes=editedBytes.length;editedManifest.file.sha256=createHash('sha256').update(editedBytes).digest('hex');await fs.writeFile(outputFile,editedBytes);await fs.writeFile(manifestPath,JSON.stringify(editedManifest));await assert.rejects(bakeVertexColors({mesh,recipe:'hd2d-cliff',output}),/deterministic source output/i);await fs.writeFile(outputFile,good);await fs.writeFile(manifestPath,goodManifest);
  const wrongSemantics=JSON.parse(goodManifest.toString());wrongSemantics.semantics.includesIllumination=true;await fs.writeFile(manifestPath,JSON.stringify(wrongSemantics));await assert.rejects(bakeVertexColors({mesh,recipe:'hd2d-cliff',output}),/semantics/i);await fs.writeFile(manifestPath,goodManifest);
  await fs.writeFile(manifestPath,Buffer.alloc(4*1048576+1,32));await assert.rejects(bakeVertexColors({mesh,recipe:'hd2d-cliff',output}),/byte limit/i);await fs.writeFile(manifestPath,goodManifest);
  await fs.writeFile(outputFile,Buffer.alloc(4*1048576+1,32));await assert.rejects(bakeVertexColors({mesh,recipe:'hd2d-cliff',output}),/byte limit/i);await fs.writeFile(outputFile,good);
  const before=await fs.readFile(manifestPath),abort=AbortSignal.abort(Error('cancel before bake'));await assert.rejects(bakeVertexColors({mesh,recipe:{seed:7},output,signal:abort}),/cancel before bake/i);assert.deepEqual(await fs.readFile(manifestPath),before);
  const many=triangle();many.positions=Array.from({length:768},(_,i)=>[i,0,0]);many.uvs=Array.from({length:768},()=>[.25,.75]);many.normals=undefined;many.uv2=undefined;many.splatWeights=undefined;many.indices=Array.from({length:768},(_,i)=>i);const controller=new AbortController();
  await assert.rejects(bakeVertexColors({mesh:many,recipe:{seed:8},output,signal:controller.signal,onProgress:p=>{if(p.done>=256)controller.abort(Error('cancel mid bake'));}}),/cancel mid bake/i);
  assert.deepEqual(await fs.readFile(manifestPath),before);assert.ok(!(await fs.readdir(output)).some(name=>name.startsWith('.pending-')));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('concurrent identical requests verify and reuse the atomic winner',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vertex-colors-concurrent-'));
 try{const results=await Promise.all([bakeVertexColors({mesh:triangle(),output:root}),bakeVertexColors({mesh:triangle(),output:root})]);assert.equal(results.filter(value=>!value.reused).length,1);assert.equal(results.filter(value=>value.reused).length,1);assert.equal(results[0].directory,results[1].directory);assert.ok(!(await fs.readdir(root)).some(name=>name.startsWith('.pending-')));}
 finally{await fs.rm(root,{recursive:true,force:true});}
});

test('CLI argument parser requires explicit paths and rejects duplicates, unknowns and invalid seeds',()=>{
 assert.deepEqual(parseVertexColorArgs(['--mesh','m.json','--recipe','hd2d-cliff','--seed','4','--out','out']),{'--mesh':'m.json','--recipe':'hd2d-cliff','--seed':'4','--out':'out'});
 for(const args of [[],['--mesh','m'],['--mesh','m','--recipe','hd2d-cliff','--out','o','--wat','1'],['--mesh','m','--recipe','hd2d-cliff','--out','o','--mesh','n'],['--mesh','m','--recipe','hd2d-cliff','--out','o','--seed','1.2'],['--mesh','m','--recipe','hd2d-cliff','--out','o','--seed','4294967296']])assert.throws(()=>parseVertexColorArgs(args),/Usage|seed/i);
});

test('public CLI reads mesh/settings JSON and emits an ordinary replacement mesh package',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vertex-colors-cli-')),meshPath=path.join(root,'input.json'),settingsPath=path.join(root,'settings.json'),output=path.join(root,'out');
 try{
  await fs.writeFile(meshPath,JSON.stringify(triangle()));await fs.writeFile(settingsPath,JSON.stringify({filter:'linear',wrap:'clamp',uvScale:[1,1],tint:'#ffffff'}));
  const stdout=execFileSync(process.execPath,[fileURLToPath(new URL('./bake-vertex-colors.mjs',import.meta.url)),'--mesh',meshPath,'--recipe','hd2d-cliff','--settings',settingsPath,'--out',output],{encoding:'utf8',timeout:30000,windowsHide:true});
  const result=JSON.parse(stdout.trim().split(/\r?\n/).at(-1));assert.equal(result.vertices,3);assert.equal(result.reused,false);const emitted=JSON.parse(await fs.readFile(path.join(result.directory,'mesh.json'),'utf8'));assert.equal(emitted.colors.length,3);assert.equal(emitted.id,'tri');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
