import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generateMaterial,materialVersion,MATERIAL_RECIPES,sampleCliffStructure,validateMaterialRecipe} from '../src/shader/material.mjs';
import {bakeMaterial} from './bake-material.mjs';
import {bakeVertexColors} from './bake-vertex-colors.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const STRATA={id:'hd2d-cliff-strata'};
const LEGACY_CHANNELS=[
  {seed:1204,channels:{albedo:'80ff2bfb261711a14fe4c72acf72053d10f116f80f8107e77fcc08e5e5baeda6',height:'a4d4c2e8cbcd7e9225977bbc2f771b092f5d94baa295222f58851c473e142905',normal:'ee2f1868f9afe004d0a1354683d2197e44bb421017edbb3e024093aff2741410',roughness:'6277d5702db25b3f702801fb21397819bb44147d0a0a089585be498e918eadfe'}},
  {seed:1215,channels:{albedo:'a9674f4c72f6408f80f76305d634d57616f00642771eea3985d84f1ede9417f2',height:'219f0844700841ba84104f4379b138c1a8df3a6e64cfcdcd64ed0f1cfbe61231',normal:'ba894f5acceabcb898151c747904bab70229cc81a6e4d2e826f548a118e5f581',roughness:'e0aaf81c5625b0a83c054cc35f5fd9e3edec9ab1cbf75be31dc13b0995bd2833'}},
  {seed:1233,channels:{albedo:'3c015a8134883411b78851ed613a777a21070ebbbe9a7f0e3b28c5c809405fcb',height:'fe191864ee65dd009d2a956b4041468a4c234193060808b06d5fdd82d8fadc1c',normal:'3344a7ab5151b45ded051ab2dabd332b23ec5d1199220fbc57daaeea8b2b9e18',roughness:'0e14991d00140945b2de147ed494f36d09827c340e0dbd7598991fb92765153d'}}
];

test('strata sampling is deterministic and periodic on both wrapped axes',()=>{
  for(const seed of [1204,1215,1233]){
    const recipe={...STRATA,seed},u=.137,v=.713,base=sampleCliffStructure(recipe,u,v);
    assert.deepEqual(base,sampleCliffStructure(recipe,u,v));
    for(const offset of [{u:1,v:0},{u:0,v:1},{u:-2,v:3}]){
      const shifted=sampleCliffStructure(recipe,u+offset.u,v+offset.v);
      for(const key of Object.keys(base))assert.ok(Math.abs(base[key]-shifted[key])<1e-12,`${seed} ${key} periodicity`);
    }
  }
});

test('palette changes pigment only and wrapped height derivatives produce the normals',()=>{
  for(const seed of [1204,1215,1233]){
    const earth=generateMaterial({...STRATA,seed,size:128}),slate=generateMaterial({...STRATA,seed,size:128,palette:'slate'});
    assert.notDeepEqual(earth.channels.albedo,slate.channels.albedo);
    for(const channel of ['height','normal','roughness'])assert.deepEqual(earth.channels[channel],slate.channels[channel]);
    const at=(x,y)=>earth.heights[((y+128)%128)*128+(x+128)%128];
    for(const [x,y]of [[0,0],[127,127],[0,64],[64,0]]){
      const dx=(at(x+1,y)-at(x-1,y))*128*.08,dy=(at(x,y+1)-at(x,y-1))*128*.08,length=Math.hypot(dx,dy,1),offset=(y*128+x)*4;
      assert.equal(earth.channels.normal.data[offset],Math.round((-.5*dx/length+.5)*255));
      assert.equal(earth.channels.normal.data[offset+1],Math.round((-.5*dy/length+.5)*255));
    }
  }
});

test('strata identity and parameter bounds reject malformed IDs and out-of-range controls',()=>{
  assert.ok(Object.hasOwn(MATERIAL_RECIPES,'hd2d-cliff-strata'));
  assert.equal(materialVersion('hd2d-cliff-strata'),'hd2d-cliff-strata/1');
  for(const id of ['hd2d-cliff-stratas','constructor','__proto__','toString',null,[]])assert.throws(()=>validateMaterialRecipe({id}),/Invalid material identity/);
  for(const strataScale of [1,8])assert.equal(validateMaterialRecipe({...STRATA,strataScale}).strataScale,strataScale);
  for(const strataScale of [0,0.99,8.01,9])assert.throws(()=>validateMaterialRecipe({...STRATA,strataScale}),/strataScale/);
});

test('material and vertex-color bake APIs and CLIs accept the additive strata recipe',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'material-strata-cli-'));
  try{
    const api=await bakeMaterial({recipe:STRATA,output:path.join(output,'api')});
    assert.equal(api.manifest.recipe.id,'hd2d-cliff-strata');assert.equal(api.manifest.generator,'hd2d-cliff-strata/1');assert.equal(api.manifest.files.length,13);
    const cliOutput=path.join(output,'cli');
    const stdout=execFileSync(process.execPath,[path.join(root,'scripts/bake-material.mjs'),'--recipe','hd2d-cliff-strata','--seed','1204','--out',cliOutput],{cwd:root,encoding:'utf8',windowsHide:true,timeout:40000});
    const cli=JSON.parse(stdout.trim()),manifest=JSON.parse(await fs.readFile(path.join(cli.directory,'material.json'),'utf8'));
    assert.equal(manifest.recipe.id,'hd2d-cliff-strata');assert.equal(manifest.generator,'hd2d-cliff-strata/1');assert.equal(manifest.files.length,13);assert.equal(cli.reused,false);
    const mesh={id:'strata-probe',positions:[[0,0,0],[1,0,0],[0,1,0]],indices:[0,1,2],uvs:[[0,0],[1,0],[0,1]]},meshPath=path.join(output,'mesh.json');
    await fs.writeFile(meshPath,JSON.stringify(mesh));
    const vertexApi=await bakeVertexColors({mesh,recipe:'hd2d-cliff-strata',seed:1204,output:path.join(output,'vertex-api'),restrictedInputs:[]});
    assert.equal(vertexApi.manifest.recipe.id,'hd2d-cliff-strata');assert.equal(vertexApi.manifest.generator,'mesh-albedo-vertex-colors/1');assert.equal(vertexApi.manifest.source.vertexCount,3);
    const vertexCliOutput=path.join(output,'vertex-cli');
    const vertexStdout=execFileSync(process.execPath,[path.join(root,'scripts/bake-vertex-colors.mjs'),'--mesh',meshPath,'--recipe','hd2d-cliff-strata','--seed','1204','--out',vertexCliOutput],{cwd:root,encoding:'utf8',windowsHide:true,timeout:40000});
    const vertexCli=JSON.parse(vertexStdout.trim().split(/\r?\n/).at(-1)),vertexManifest=JSON.parse(await fs.readFile(path.join(vertexCli.directory,'vertex-colors.json'),'utf8'));
    assert.equal(vertexManifest.recipe.id,'hd2d-cliff-strata');assert.equal(vertexManifest.source.vertexCount,3);assert.equal(vertexCli.reused,false);
  }finally{await fs.rm(output,{recursive:true,force:true});}
});

test('style-surface single variant is distinct and cache-bound while catalog defaults stay three-variant',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'style-surface-variants-'));
  try{
    const recipe={id:'style-surface',family:'grass',style:'hd2d'};
    const catalog=await bakeMaterial({recipe,output:path.join(output,'api')});
    assert.equal(catalog.manifest.format,'texture-material/1');assert.equal(catalog.manifest.recipe.family,'grass');assert.equal(catalog.manifest.recipe.style,'hd2d');
    assert.equal(catalog.manifest.files.length,13);assert.equal(catalog.manifest.variantSet,undefined);
    assert.deepEqual([...new Set(catalog.manifest.files.filter(file=>file.channel!=='contact-sheet').map(file=>file.seed))],[1204,1215,1233]);
    const single=await bakeMaterial({recipe,output:path.join(output,'api'),variantSet:'single'});
    assert.notEqual(single.manifest.identity,catalog.manifest.identity);assert.notEqual(single.directory,catalog.directory);
    assert.equal(single.manifest.variantSet,'single');assert.equal(single.manifest.files.length,5);
    assert.deepEqual([...new Set(single.manifest.files.filter(file=>file.channel!=='contact-sheet').map(file=>file.seed))],[1204]);
    assert.equal((await bakeMaterial({recipe,output:path.join(output,'api'),variantSet:'single'})).reused,true);
    assert.equal((await bakeMaterial({recipe,output:path.join(output,'api')})).reused,true);
    const cliOut=path.join(output,'cli'),stdout=execFileSync(process.execPath,[path.join(root,'scripts/bake-material.mjs'),'--recipe','style-surface','--variant-set','single','--out',cliOut],{cwd:root,encoding:'utf8',windowsHide:true,timeout:40000}),cli=JSON.parse(stdout.trim());
    const cliManifest=JSON.parse(await fs.readFile(path.join(cli.directory,'material.json'),'utf8'));
    assert.equal(cli.variantSet,'single');assert.equal(cliManifest.recipe.id,'style-surface');assert.equal(cliManifest.files.length,5);
    const mesh={id:'surface-sample',positions:[[0,0,0],[1,0,0],[0,1,0]],indices:[0,1,2],uvs:[[0,0],[1,0],[0,1]]};
    const vertex=await bakeVertexColors({mesh,recipe:'style-surface',output:path.join(output,'vertex'),restrictedInputs:[]});
    assert.equal(vertex.manifest.recipe.family,'grass');assert.equal(vertex.manifest.recipe.style,'hd2d');assert.equal(vertex.manifest.source.vertexCount,3);
    const high=await bakeMaterial({recipe:{id:'style-surface',family:'roof',style:'pbr'},output:path.join(output,'high'),variantSet:'single'});
    assert.equal(high.manifest.recipe.size,512);
    for(const file of high.manifest.files.filter(file=>file.channel!=='contact-sheet'))assert.deepEqual([file.width,file.height],[512,512]);
    const sheet=high.manifest.files.find(file=>file.channel==='contact-sheet');assert.equal(sheet.width,2048);assert.equal(sheet.height,512);
    const manifestPath=path.join(single.directory,'material.json'),pngPath=path.join(single.directory,'s1204-albedo.png'),manifestBefore=await fs.readFile(manifestPath),pngBefore=await fs.readFile(pngPath);
    await fs.writeFile(pngPath,Buffer.from('altered'));await assert.rejects(bakeMaterial({recipe,output:path.join(output,'api'),variantSet:'single'}),/altered|incomplete|metadata/i);
    await fs.writeFile(pngPath,pngBefore);assert.deepEqual(await fs.readFile(manifestPath),manifestBefore);
    await assert.rejects(bakeMaterial({recipe:{...recipe,seed:77},output:path.join(output,'api'),variantSet:'single',signal:AbortSignal.abort(Error('cancel single bake'))}),/cancel single bake/);
    assert.deepEqual(await fs.readFile(manifestPath),manifestBefore);
    assert.equal((await fs.readdir(path.join(output,'api'))).some(name=>name.startsWith('.pending-')),false);
  }finally{await fs.rm(output,{recursive:true,force:true});}
});

test('new strata cancellation preserves its completed output and altered cache is rejected',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'material-strata-cache-'));
  try{
    const first=await bakeMaterial({recipe:STRATA,output}),manifestPath=path.join(first.directory,'material.json'),before=await fs.readFile(manifestPath);
    assert.equal((await bakeMaterial({recipe:STRATA,output})).reused,true);
    const abort=new AbortController(),task=bakeMaterial({recipe:{...STRATA,seed:99},output,signal:abort.signal}),timer=setTimeout(()=>abort.abort(Error('cancel strata bake')),0);
    try{await assert.rejects(task,/cancel strata bake/);}finally{clearTimeout(timer);}
    assert.deepEqual(await fs.readFile(manifestPath),before);assert.equal((await fs.readdir(output)).some(name=>name.startsWith('.pending-')),false);
    const altered=JSON.parse(before.toString('utf8'));altered.recipe.palette='slate';await fs.writeFile(manifestPath,JSON.stringify(altered));
    await assert.rejects(bakeMaterial({recipe:STRATA,output}),/identity differs|recipe/i);
  }finally{await fs.rm(output,{recursive:true,force:true});}
});

test('material cache rejects coordinated asset and manifest tampering',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'material-coordinated-cache-'));
  try{
    const first=await bakeMaterial({recipe:{...STRATA,size:64},output});
    const manifestPath=path.join(first.directory,'material.json');
    for(const target of ['s1204-albedo.png','channels.png']){
      const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
      const entry=manifest.files.find(file=>file.path===target);
      const assetPath=path.join(first.directory,target),original=await fs.readFile(assetPath);
      const altered=Buffer.from(original);altered[Math.floor(altered.length/2)]^=1;
      await fs.writeFile(assetPath,altered);
      entry.sha256=createHash('sha256').update(altered).digest('hex');
      await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
      await assert.rejects(bakeMaterial({recipe:{...STRATA,size:64},output}),/altered|deterministic|metadata/i,`${target} should be regenerated and compared`);
      await fs.writeFile(assetPath,original);
      manifest.files.find(file=>file.path===target).bytes=original.length;
      manifest.files.find(file=>file.path===target).sha256=createHash('sha256').update(original).digest('hex');
      await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
    }
  }finally{await fs.rm(output,{recursive:true,force:true});}
});

test('legacy cliff channel hashes remain exact for the three default bake seeds',()=>{
  for(const expected of LEGACY_CHANNELS){
    const generated=generateMaterial({id:'hd2d-cliff',size:128,seed:expected.seed});
    for(const [channel,sha256]of Object.entries(expected.channels))assert.equal(createHash('sha256').update(generated.channels[channel].data).digest('hex'),sha256,`legacy ${expected.seed} ${channel} channel hash`);
  }
});
