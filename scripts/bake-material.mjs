import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generateMaterial,validateMaterialRecipe,materialContactSheet,MATERIAL_CHANNELS,materialVersion,MATERIAL_RECIPES} from '../src/shader/material.mjs';
import {encodeMaterialPng} from './material-png.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const MAX_MANIFEST_BYTES=1024*1024;
/** @param {Uint8Array|string} b */
const hash=b=>createHash('sha256').update(b).digest('hex');
/** @param {string} file @param {number} maxBytes @param {string} label */
async function readBounded(file,maxBytes,label){
  let handle;
  try{
    handle=await fs.open(file,'r');const stat=await handle.stat();
    if(!stat.isFile()||stat.size>maxBytes)throw Error(`${label} exceeds its byte limit`);
    const bytes=Buffer.alloc(stat.size+1),{bytesRead}=await handle.read(bytes,0,bytes.length,0);
    if(bytesRead!==stat.size)throw Error(`${label} changed while being read`);
    return bytes.subarray(0,bytesRead);
  }finally{await handle?.close();}
}
/** @param {string} file @param {Buffer} expected @param {string} label */
async function readExpectedAsset(file,expected,label){
  let handle;
  try{
    handle=await fs.open(file,'r');const stat=await handle.stat();
    if(!stat.isFile()||stat.size!==expected.length)throw Error(`${label} byte metadata differs`);
    const bytes=Buffer.alloc(expected.length+1),{bytesRead}=await handle.read(bytes,0,bytes.length,0);
    if(bytesRead!==expected.length)throw Error(`${label} changed while being read`);
    return bytes.subarray(0,bytesRead);
  }finally{await handle?.close();}
}
/** @typedef {{path:string,channel:string,seed?:number,width?:number,height?:number,colorSpace?:string,semantic?:string,filter?:string,wrap?:string,bytes:number,sha256:string,data:Buffer}} ExpectedAsset */
/** @param {'catalog'|'single'} variantSet */
const offsetsFor=variantSet=>variantSet==='single'?[0]:[0,11,29];
/** @param {import('../src/shader/material.mjs').MaterialRecipe} recipe @param {AbortSignal|undefined} signal @param {'catalog'|'single'} variantSet @returns {Promise<ExpectedAsset[]>} */
async function generateAssets(recipe,signal,variantSet){
  /** @type {ExpectedAsset[]} */ const assets=[];const variants=[];
  for(const offset of offsetsFor(variantSet)){
    signal?.throwIfAborted();const material=generateMaterial({...recipe,seed:(recipe.seed+offset)>>>0});variants.push(material);
    const prefix='s'+material.recipe.seed;
    for(const [channel,pixels]of Object.entries(material.channels)){
      signal?.throwIfAborted();const bytes=encodeMaterialPng(pixels),file=prefix+'-'+channel+'.png';
      assets.push({path:file,channel,seed:material.recipe.seed,width:pixels.width,height:pixels.height,...MATERIAL_CHANNELS[channel],filter:recipe.id==='realistic-surface'?'linear':'nearest',wrap:'repeat',bytes:bytes.length,sha256:hash(bytes),data:bytes});
    }
    await new Promise(resolve=>setImmediate(resolve));
  }
  signal?.throwIfAborted();const contact=materialContactSheet(variants),sheet=encodeMaterialPng(contact);
  assets.push({path:'channels.png',channel:'contact-sheet',width:contact.width,height:contact.height,bytes:sheet.length,sha256:hash(sheet),data:sheet});
  return assets;
}
/** @param {{recipe?:unknown,output?:string,signal?:AbortSignal,variantSet?:'catalog'|'single'}} options */
export async function bakeMaterial({recipe:input={},output,signal,variantSet='catalog'}={}){
  if(typeof output!=='string'||!output.trim())throw Error('An explicit output directory is required');
  if(!['catalog','single'].includes(variantSet))throw Error('variantSet must be catalog or single');
  const recipe=validateMaterialRecipe(input),generator=materialVersion(recipe.id);signal?.throwIfAborted();const destination=path.resolve(output);await fs.mkdir(destination,{recursive:true});
  const sourcePaths=['src/shader/material.mjs','scripts/bake-material.mjs','scripts/material-png.mjs'];if(recipe.id==='realistic-surface')sourcePaths.push('src/shader/material-realistic.mjs');
  if(recipe.id==='voxel-surface')sourcePaths.push('src/shader/material-voxel.mjs');
  const sources=[];for(const relative of sourcePaths){const bytes=await fs.readFile(path.join(root,relative));sources.push({path:relative,sha256:hash(bytes)});}
  let sourceTip;try{sourceTip=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:5000}).trim();}catch{sourceTip=null;}
  const identity=hash(JSON.stringify({recipe,generator:generator,sources,...(variantSet==='single'?{variantSet}:{})})),final=path.join(destination,recipe.id+'-'+identity.slice(0,12)),pending=path.join(destination,'.pending-'+randomUUID());
  const assets=await generateAssets(recipe,signal,variantSet),expectedAssets=new Map(assets.map(asset=>[asset.path,asset]));
  let exists=true;try{await fs.stat(final);}catch(error){if(error instanceof Error&&'code' in error&&error.code==='ENOENT')exists=false;else throw error;}
  if(exists){
    /** @type {{format:string,identity:string,generator:string,recipe:import('../src/shader/material.mjs').MaterialRecipe,variantSet?:'catalog'|'single',sources:{path:string,sha256:string}[],visualReview:string,provenance:{author:string,training:boolean,restrictedInputs:unknown[]},files:(Record<string,unknown>&{path:string,sha256:string,bytes:number})[]}} */
    let old;try{old=JSON.parse((await readBounded(path.join(final,'material.json'),MAX_MANIFEST_BYTES,'Cached material manifest')).toString('utf8'));}catch(error){if(error instanceof Error&&error.message.includes('byte limit'))throw error;throw Error('Existing material output is incomplete');}
    signal?.throwIfAborted();
    if(!old||old.identity!==identity||old.format!=='texture-material/1'||old.generator!==generator||(old.variantSet??'catalog')!==variantSet||old.variantSet!==(variantSet==='catalog'?undefined:'single')||!old.recipe||JSON.stringify(validateMaterialRecipe(old.recipe))!==JSON.stringify(recipe)||!Array.isArray(old.sources)||old.sources.length!==sources.length||sources.some((s,i)=>old.sources[i]?.path!==s.path||old.sources[i]?.sha256!==s.sha256))throw Error('Existing material output identity differs');
    if(old.visualReview!=='unapproved'||old.provenance?.author!=='original procedural work for our projects'||old.provenance?.training!==false||!Array.isArray(old.provenance?.restrictedInputs)||old.provenance.restrictedInputs.length)throw Error('Existing material provenance differs');
    if(!Array.isArray(old.files)||old.files.length!==assets.length||old.files.some(f=>!f||typeof f.path!=='string'||!/^(s\d+-(albedo|height|normal|roughness)|channels)\.png$/.test(f.path))||new Set(old.files.map(f=>f.path)).size!==assets.length)throw Error('Invalid cached material asset path');
    for(const f of old.files){
      signal?.throwIfAborted();const expected=expectedAssets.get(f.path);if(!expected||Object.entries(expected).some(([key,value])=>key!=='data'&&key!=='bytes'&&key!=='sha256'&&f[key]!==value))throw Error('Existing material channel metadata differs');
      let bytes;try{bytes=await readExpectedAsset(path.join(final,f.path),expected.data,`Cached ${f.path}`);}catch(error){if(error instanceof Error&&error.message.includes('byte metadata differs'))throw error;throw Error('Existing material output is incomplete');}
      signal?.throwIfAborted();if(f.bytes!==bytes.length||f.sha256!==hash(bytes)||!bytes.equals(expected.data))throw Error('Existing material output differs from deterministic generated bytes');
    }
    signal?.throwIfAborted();
    return {directory:final,manifest:old,reused:true,variantSet};
  }
  await fs.mkdir(pending);try{
    const files=[];
    for(const asset of assets){signal?.throwIfAborted();await fs.writeFile(path.join(pending,asset.path),asset.data);const {data:_assetData,...metadata}=asset;files.push(metadata);}
    const manifest={format:'texture-material/1',identity,generator:generator,sourceTip,sources,recipe,...(variantSet==='single'?{variantSet}:{}),visualReview:'unapproved',provenance:{author:'original procedural work for our projects',restrictedInputs:[],training:false},files};
    await fs.writeFile(path.join(pending,'material.json'),JSON.stringify(manifest,null,2)+'\n');signal?.throwIfAborted();await fs.rename(pending,final);return {directory:final,manifest,reused:false,variantSet};
  }catch(error){if(path.dirname(pending)!==destination||!path.basename(pending).startsWith('.pending-'))throw Error('Invalid temporary ownership');await fs.rm(pending,{recursive:true,force:true});throw error;}
}
async function main(){
  const args=process.argv.slice(2);
  /** @type {Record<string,string>} */
  const options={};
  for(let i=0;i<args.length;i+=2){if(!['--recipe','--seed','--out','--variant-set'].includes(args[i])||args[i+1]===undefined||options[args[i]])throw Error('Usage: npm run bake:material -- --recipe hd2d-cliff|hd2d-cliff-strata|style-surface|realistic-surface|voxel-surface|recipe.json --seed 1204 --variant-set catalog|single --out <directory>');options[args[i]]=args[i+1];}
  let recipe=options['--recipe']?(Object.hasOwn(MATERIAL_RECIPES,options['--recipe'])?{id:options['--recipe']}:JSON.parse(await fs.readFile(path.resolve(options['--recipe']),'utf8'))):{};if(options['--seed']!==undefined)recipe.seed=Number(options['--seed']);
  const abort=new AbortController(),cancel=()=>abort.abort(Error('Material bake cancelled'));process.once('SIGINT',cancel);const timer=setTimeout(()=>abort.abort(Error('Material bake exceeded 40 seconds')),40000);timer.unref();
  const variantSet=options['--variant-set']??'catalog';if(variantSet!=='catalog'&&variantSet!=='single')throw Error('variant-set must be catalog or single');
  try{const result=await bakeMaterial({recipe,output:options['--out'],variantSet,signal:abort.signal});console.log(JSON.stringify({directory:result.directory,identity:result.manifest.identity,files:result.manifest.files.length,variantSet:result.variantSet,reused:result.reused}));}finally{clearTimeout(timer);process.removeListener('SIGINT',cancel);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
