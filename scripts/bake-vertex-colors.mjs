import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generateMaterial,validateMaterialRecipe,MATERIAL_RECIPES} from '../src/shader/material.mjs';
import {bakeVertexMesh,VERTEX_COLOR_GENERATOR,VERTEX_COLOR_OUTPUT_SEMANTICS,validateVertexColorSettings} from '../src/shader/vertex-colors.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),MAX_JSON_BYTES=4*1048576;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function readBounded(file,maxBytes,label){let handle;try{handle=await fs.open(file,'r');const stat=await handle.stat();if(!stat.isFile()||stat.size>maxBytes)throw Error(`${label} exceeds its byte limit`);const bytes=Buffer.alloc(stat.size+1),{bytesRead}=await handle.read(bytes,0,bytes.length,0);if(bytesRead!==stat.size)throw Error(`${label} changed while being read`);return bytes.subarray(0,bytesRead);}finally{await handle?.close();}}
async function readJsonFile(file,label){const bytes=await readBounded(file,MAX_JSON_BYTES,label);return {value:JSON.parse(bytes.toString('utf8')),bytes};}
function validateMeshBytes(value){const bytes=Buffer.from(JSON.stringify(value));if(bytes.length>MAX_JSON_BYTES)throw Error('Mesh JSON exceeds the 4 MiB limit');return bytes;}
async function verifyOutput(directory,{identity,recipe,settings,source,sourceHashes,expectedMeshBytes,signal}){
 let manifest;try{manifest=JSON.parse((await readBounded(path.join(directory,'vertex-colors.json'),MAX_JSON_BYTES,'Cached manifest')).toString('utf8'));}catch(error){if(error instanceof Error&&error.message.includes('byte limit'))throw error;throw Error('Existing vertex-color output is incomplete');}
 signal?.throwIfAborted();
 if(!manifest||manifest.format!=='vertex-colors/1'||manifest.identity!==identity||manifest.generator!==VERTEX_COLOR_GENERATOR||JSON.stringify(manifest.recipe)!==JSON.stringify(recipe)||JSON.stringify(manifest.settings)!==JSON.stringify(settings)||JSON.stringify(manifest.semantics)!==JSON.stringify(VERTEX_COLOR_OUTPUT_SEMANTICS)||JSON.stringify(manifest.source)!==JSON.stringify(source)||JSON.stringify(manifest.sources)!==JSON.stringify(sourceHashes)||manifest.visualReview!=='unreviewed'||manifest.provenance?.training!==false||!Array.isArray(manifest.provenance?.restrictedInputs)||JSON.stringify(manifest.provenance.restrictedInputs)!==JSON.stringify(source.restrictedInputs))throw Error('Existing vertex-color output identity, semantics or provenance differs');
 const file=manifest.file;if(!file||file.path!=='mesh.json'||!Number.isInteger(file.bytes)||file.bytes<1||file.bytes>MAX_JSON_BYTES||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Existing vertex-color output metadata differs');
 let data;try{const target=path.resolve(directory,file.path);if(path.dirname(target)!==directory)throw Error('Invalid cached mesh path');data=await readBounded(target,MAX_JSON_BYTES,'Cached mesh');}catch(error){if(error instanceof Error&&error.message.includes('byte limit'))throw error;throw Error('Existing vertex-color output is incomplete');}
 signal?.throwIfAborted();if(data.length!==file.bytes||hash(data)!==file.sha256)throw Error('Existing vertex-color mesh was altered');if(!expectedMeshBytes||!data.equals(expectedMeshBytes))throw Error('Existing vertex-color mesh differs from deterministic source output');
 let mesh;try{mesh=JSON.parse(data.toString('utf8'));}catch{throw Error('Existing vertex-color mesh is malformed');}
 if(!mesh||!Array.isArray(mesh.colors)||mesh.colors.length!==source.vertexCount||mesh.positions?.length!==source.vertexCount||mesh.colors.some(color=>!Array.isArray(color)||color.length!==3||color.some(value=>!Number.isFinite(value)||value<0||value>1)))throw Error('Existing vertex-color mesh content differs');
 return manifest;
}
function normalizeRestrictions(value){
 if(value===undefined)return ['usage-unverified/local-only'];
 if(!Array.isArray(value)||value.length>32||value.some(item=>typeof item!=='string'))throw Error('restrictedInputs must be an array of at most 32 strings');
 const result=value.map(item=>item.trim());if(result.some(item=>!item||item.length>256||[...item].some(c=>{const n=c.codePointAt(0);return n<32||n===127;}))||result.reduce((sum,item)=>sum+item.length,0)>4096)throw Error('Invalid restrictedInputs');return [...new Set(result)].sort();
}
async function recipeValue(recipe,seed){
 let input=recipe;if(typeof recipe==='string')input=Object.hasOwn(MATERIAL_RECIPES,recipe)?{id:recipe}:(await readJsonFile(path.resolve(recipe),'Recipe')).value;
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Recipe must be a supported material recipe or a recipe JSON object/path');
 if(seed!==undefined)input={...input,seed};return validateMaterialRecipe(input);
}

/** Deterministically sample the generated material albedo onto an ordinary mesh and atomically cache it. */
export async function bakeVertexColors({mesh,meshPath,recipe='hd2d-cliff',seed,settings:settingsInput={},output,restrictedInputs,signal,onProgress=()=>{}}={}){
 if((mesh===undefined)===(meshPath===undefined))throw Error('Provide exactly one mesh object or meshPath');
 if(typeof output!=='string'||!output.trim())throw Error('An explicit vertex-color output directory is required');
 signal?.throwIfAborted();
 let meshValue,meshBytes;
 if(meshPath!==undefined){if(typeof meshPath!=='string'||!meshPath.trim())throw Error('Invalid mesh path');const loaded=await readJsonFile(path.resolve(meshPath),'Mesh');meshValue=loaded.value;meshBytes=loaded.bytes;}
 else {meshValue=mesh;meshBytes=validateMeshBytes(meshValue);}
 const recipeData=await recipeValue(recipe,seed),settings=validateVertexColorSettings(settingsInput),sourceRestrictions=normalizeRestrictions(restrictedInputs);
 const generated=generateMaterial(recipeData),albedo={...generated.channels.albedo,colorSpace:'srgb'};
 const source={meshSha256:hash(meshBytes),meshBytes:meshBytes.length,vertexCount:meshValue?.positions?.length,albedoSha256:hash(albedo.data),albedoSize:[albedo.width,albedo.height],colorSpace:'srgb',restrictedInputs:sourceRestrictions};
 const sourcePaths=['src/shader/material.mjs','src/shader/vertex-colors.mjs','scripts/bake-vertex-colors.mjs'];if(recipeData.id==='realistic-surface')sourcePaths.push('src/shader/material-realistic.mjs');
 const sourceFiles=[];for(const relative of sourcePaths){const bytes=await fs.readFile(path.join(root,relative));sourceFiles.push({path:relative,sha256:hash(bytes)});}
 let sourceTip;try{sourceTip=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:5000}).trim();}catch{sourceTip=null;}
 const identity=hash(JSON.stringify({generator:VERTEX_COLOR_GENERATOR,recipe:recipeData,settings,source,sourceFiles})),destination=path.resolve(output),final=path.join(destination,recipeData.id+'-'+identity.slice(0,12)),pending=path.join(destination,'.pending-'+randomUUID());
 const baked=await bakeVertexMesh({mesh:meshValue,albedo,settings,signal,onProgress}),meshOutput=Buffer.from(JSON.stringify(baked,null,2)+'\n');if(meshOutput.length>MAX_JSON_BYTES)throw Error('Baked mesh JSON exceeds the 4 MiB output limit');
 await fs.mkdir(destination,{recursive:true});signal?.throwIfAborted();
 let exists=true;try{await fs.stat(final);}catch(error){if(error instanceof Error&&'code'in error&&error.code==='ENOENT')exists=false;else throw error;}
 if(exists){const manifest=await verifyOutput(final,{identity,recipe:recipeData,settings,source,sourceHashes:sourceFiles,expectedMeshBytes:meshOutput,signal});return {directory:final,manifest,reused:true};}
 await fs.mkdir(pending);
 try{
  const file={path:'mesh.json',bytes:meshOutput.length,sha256:hash(meshOutput)};await fs.writeFile(path.join(pending,file.path),meshOutput);signal?.throwIfAborted();
  const manifest={format:'vertex-colors/1',identity,generator:VERTEX_COLOR_GENERATOR,sourceTip,sources:sourceFiles,recipe:recipeData,settings,semantics:VERTEX_COLOR_OUTPUT_SEMANTICS,source,file,visualReview:'unreviewed',provenance:{author:'offline material albedo sampling',training:false,restrictedInputs:sourceRestrictions}};
  await fs.writeFile(path.join(pending,'vertex-colors.json'),JSON.stringify(manifest,null,2)+'\n');signal?.throwIfAborted();
  try{await fs.rename(pending,final);return {directory:final,manifest,reused:false};}
  catch(error){signal?.throwIfAborted();let winner=false;try{await fs.stat(final);winner=true;}catch(statError){if(!(statError instanceof Error&&'code'in statError&&statError.code==='ENOENT'))throw statError;}if(!winner)throw error;const verified=await verifyOutput(final,{identity,recipe:recipeData,settings,source,sourceHashes:sourceFiles,expectedMeshBytes:meshOutput,signal});await fs.rm(pending,{recursive:true,force:true});return {directory:final,manifest:verified,reused:true};}
 }catch(error){if(path.dirname(pending)!==destination||!path.basename(pending).startsWith('.pending-'))throw Error('Invalid temporary vertex-color output ownership');await fs.rm(pending,{recursive:true,force:true});throw error;}
}

export function parseVertexColorArgs(args){const options={};for(let i=0;i<args.length;i++){const key=args[i];if(!['--mesh','--recipe','--seed','--settings','--out'].includes(key)||args[i+1]===undefined||Object.hasOwn(options,key))throw Error('Usage: npm run bake:vertex-colors -- --mesh mesh.json --recipe hd2d-cliff|hd2d-cliff-strata|style-surface|realistic-surface|recipe.json [--seed n] [--settings settings.json] --out <directory>');options[key]=args[++i];}if(!options['--mesh']||!options['--recipe']||!options['--out'])throw Error('Usage: npm run bake:vertex-colors -- --mesh mesh.json --recipe hd2d-cliff|hd2d-cliff-strata|style-surface|realistic-surface|recipe.json [--seed n] [--settings settings.json] --out <directory>');if(options['--seed']!==undefined&&(!/^(0|[1-9]\d*)$/.test(options['--seed'])||Number(options['--seed'])>0xffffffff))throw Error('Invalid seed');return options;}
async function main(){
 const options=parseVertexColorArgs(process.argv.slice(2)),meshPath=path.resolve(options['--mesh']),recipe=Object.hasOwn(MATERIAL_RECIPES,options['--recipe'])?options['--recipe']:path.resolve(options['--recipe']),settings=options['--settings']?(await readJsonFile(path.resolve(options['--settings']),'Settings')).value:{};
 const abort=new AbortController(),cancel=()=>abort.abort(Error('Vertex-color bake cancelled')),timer=setTimeout(()=>abort.abort(Error('Vertex-color bake exceeded 2 minutes')),120000);timer.unref();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
 try{const result=await bakeVertexColors({meshPath,recipe,seed:options['--seed']===undefined?undefined:Number(options['--seed']),settings,output:options['--out'],signal:abort.signal,onProgress:p=>{if(p.stage==='complete'||p.done%2048===0)console.log(JSON.stringify({progress:p.stage,done:p.done,total:p.total}));}});console.log(JSON.stringify({directory:result.directory,identity:result.manifest.identity,vertices:result.manifest.source.vertexCount,reused:result.reused}));}
 finally{clearTimeout(timer);process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
