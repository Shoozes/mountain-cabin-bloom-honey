import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createOriginalEnvironmentHdr,decodeRadianceHdr,ENVIRONMENT_GENERATOR,prefilterEnvironment,validateEnvironmentBake} from '../src/shader/environment.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const MAX_SOURCE_BYTES=64*1048576;
const MAX_MANIFEST_BYTES=1048576;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bufferByteLength=(faceSize,mipLevels)=>{let bytes=0;for(let mip=0,size=faceSize;mip<mipLevels;mip++,size=Math.max(1,size>>1))bytes+=size*size*6*8;return bytes;};
async function readBounded(file,maxBytes,label,expectedBytes){
  let handle;
  try{
    handle=await fs.open(file,'r');
    const stat=await handle.stat();
    if(!stat.isFile()||stat.size>maxBytes)throw Error(`${label} exceeds its byte limit`);
    if(expectedBytes!==undefined&&stat.size!==expectedBytes)throw Error(`${label} does not match its expected byte length`);
    const bytes=Buffer.alloc(stat.size+1);let offset=0;
    while(offset<bytes.length){const {bytesRead}=await handle.read(bytes,offset,bytes.length-offset,offset);if(!bytesRead)break;offset+=bytesRead;}
    if(offset!==stat.size)throw Error(`${label} changed while being read`);
    return bytes.subarray(0,offset);
  }finally{await handle?.close();}
}
const expectedBuffers=(id,quality)=>[
  {id:id+'-diffuse',uri:id+'-diffuse.bin',format:'cube-rgba16f-le',faceSize:quality.diffuseSize,mipLevels:1,colorSpace:'linear-srgb'},
  {id:id+'-specular',uri:id+'-specular.bin',format:'cube-rgba16f-le',faceSize:quality.specularSize,mipLevels:Math.floor(Math.log2(quality.specularSize))+1,colorSpace:'linear-srgb'},
];
const UNVERIFIED_USAGE=['usage-unverified/local-only'];
const hasControlCharacter=value=>[...value].some(character=>{const code=character.codePointAt(0);return code<32||code===127;});
function normalizedRestrictions(value,sourceAuthor){
  if(sourceAuthor==='original analytic environment source'){
    if(value!==undefined&&(!Array.isArray(value)||value.length))throw Error('Original environments do not accept caller-supplied restricted inputs');
    return [];
  }
  if(value===undefined)return [...UNVERIFIED_USAGE];
  if(!Array.isArray(value)||value.length>32||value.some(item=>typeof item!=='string'))throw Error('Restricted inputs must be an array of at most 32 strings');
  const result=value.map(item=>item.trim());
  if(result.some(item=>!item||item.length>256||hasControlCharacter(item))||result.reduce((size,item)=>size+item.length,0)>4096)throw Error('Restricted inputs must be nonempty bounded text without control characters');
  return [...new Set(result)].sort();
}
async function verifyExistingOutput(final,{identity,generator,recipe,sources,source,sourceAuthor,restrictedInputs,specs,signal}){
  /** @type {any} */ let old;try{old=JSON.parse((await readBounded(path.join(final,'environment.json'),MAX_MANIFEST_BYTES,'Cached environment manifest')).toString('utf8'));}catch(error){if(error instanceof Error&&error.message.includes('byte limit'))throw error;throw Error('Existing environment output is incomplete');}
  signal?.throwIfAborted();
  if(!old||old.format!=='environment-map/1'||old.identity!==identity||old.generator!==generator||JSON.stringify(old.recipe)!==JSON.stringify(recipe)||!Array.isArray(old.sources)||old.sources.length!==sources.length||sources.some((s,i)=>old.sources[i]?.path!==s.path||old.sources[i]?.sha256!==s.sha256)||JSON.stringify(old.source)!==JSON.stringify(source))throw Error('Existing environment identity differs');
  if(old.provenance?.author!==sourceAuthor||old.provenance?.training!==false||JSON.stringify(old.provenance?.restrictedInputs)!==JSON.stringify(restrictedInputs)||old.visualReview!=='unreviewed')throw Error('Existing environment provenance differs');
  if(!Array.isArray(old.environmentMaps)||old.environmentMaps.length!==1||JSON.stringify(old.environmentMaps[0])!==JSON.stringify({id:recipe.id,diffuse:specs[0].id,specular:specs[1].id})||!Array.isArray(old.buffers)||old.buffers.length!==2)throw Error('Existing environment buffer descriptors differ');
  for(let i=0;i<specs.length;i++){
    const spec=specs[i],buffer=old.buffers[i];signal?.throwIfAborted();
    if(!buffer||Object.entries(spec).some(([key,value])=>buffer[key]!==value)||buffer.byteLength!==bufferByteLength(spec.faceSize,spec.mipLevels)||typeof buffer.sha256!=='string'||!/^[a-f0-9]{64}$/.test(buffer.sha256))throw Error('Existing environment buffer metadata differs');
    let data;try{const file=path.resolve(final,buffer.uri);if(path.dirname(file)!==final||path.basename(file)!==spec.uri)throw Error('Invalid cached environment buffer path');data=await readBounded(file,buffer.byteLength,'Cached environment buffer',buffer.byteLength);}catch{throw Error('Existing environment output is incomplete');}
    signal?.throwIfAborted();if(data.length!==buffer.byteLength||hash(data)!==buffer.sha256)throw Error('Existing environment buffer was altered');
  }
  signal?.throwIfAborted();return old;
}

/** Bake original or caller-supplied Radiance HDR to deterministic engine-ready cube buffers. */
export async function bakeEnvironment({id='studio-softboxes',profile='preview',sourcePath,sourceBytes,restrictedInputs,output,signal,onProgress=()=>{}}={}){
  const quality=validateEnvironmentBake({id,profile});
  if(typeof output!=='string'||!output.trim())throw Error('An explicit environment output directory is required');
  if(sourcePath!==undefined&&sourceBytes!==undefined)throw Error('Choose an HDR path or in-memory source bytes, not both');
  let bytes,sourceName,sourceAuthor;
  if(sourceBytes!==undefined){if(!(sourceBytes instanceof Uint8Array)||sourceBytes.byteLength>MAX_SOURCE_BYTES)throw Error('Radiance HDR source exceeds its 64 MiB limit');bytes=Buffer.from(sourceBytes);sourceName='provided-radiance.hdr';sourceAuthor='caller-supplied Radiance HDR';}
  else if(sourcePath!==undefined){if(typeof sourcePath!=='string'||!sourcePath.trim())throw Error('Invalid Radiance HDR path');const full=path.resolve(sourcePath);signal?.throwIfAborted();bytes=await readBounded(full,MAX_SOURCE_BYTES,'Radiance HDR source');sourceName=path.basename(full);sourceAuthor='caller-supplied Radiance HDR';}
  else if(id==='studio-softboxes'||id==='open-sky'){bytes=createOriginalEnvironmentHdr(id);sourceName=id+'.hdr';sourceAuthor='original analytic environment source';}
  else throw Error('External Radiance HDR sources require --hdr and --id');
  const restrictions=normalizedRestrictions(restrictedInputs,sourceAuthor);
  signal?.throwIfAborted();
  const sourceSha256=hash(bytes),decoded=decodeRadianceHdr(bytes);signal?.throwIfAborted();
  const sources=[];for(const relative of ['src/shader/environment.mjs','scripts/bake-environment.mjs']){const source=await fs.readFile(path.join(root,relative));sources.push({path:relative,sha256:hash(source)});}
  let sourceTip;try{sourceTip=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:5000}).trim();}catch{sourceTip=null;}
  const recipe={id,profile,specularSize:quality.specularSize,diffuseSize:quality.diffuseSize,specularSamples:quality.specularSamples,diffuseSamples:quality.diffuseSamples,faceOrder:['+X','-X','+Y','-Y','+Z','-Z'],packing:'mip-major,face-major,row-major'};
  const identity=hash(JSON.stringify({generator:ENVIRONMENT_GENERATOR,recipe,sources,sourceSha256,sourceName,sourceAuthor,restrictedInputs:restrictions,sourceMetadata:decoded.metadata}));
  const destination=path.resolve(output),final=path.join(destination,id+'-'+identity.slice(0,12)),pending=path.join(destination,'.pending-'+randomUUID());
  await fs.mkdir(destination,{recursive:true});signal?.throwIfAborted();
  let exists=true;try{await fs.stat(final);}catch(error){if(error instanceof Error&&'code' in error&&error.code==='ENOENT')exists=false;else throw error;}
  const specs=expectedBuffers(id,quality);
  if(exists){
    const manifest=await verifyExistingOutput(final,{identity,generator:ENVIRONMENT_GENERATOR,recipe,sources,source:{name:sourceName,sha256:sourceSha256,byteLength:bytes.length,width:decoded.width,height:decoded.height,metadata:decoded.metadata},sourceAuthor,restrictedInputs:restrictions,specs,signal});
    return {directory:final,manifest,reused:true};
  }
  await fs.mkdir(pending);try{
    const maps=await prefilterEnvironment(decoded,{specularSize:quality.specularSize,diffuseSize:quality.diffuseSize,specularSamples:quality.specularSamples,diffuseSamples:quality.diffuseSamples,signal,onProgress});
    const payloads=[maps.diffuse,maps.specular],buffers=[];
    for(let i=0;i<specs.length;i++){signal?.throwIfAborted();const spec=specs[i],payload=payloads[i];if(payload.length!==bufferByteLength(spec.faceSize,spec.mipLevels))throw Error('Environment prefilter byte count differs');await fs.writeFile(path.join(pending,spec.uri),payload);buffers.push({...spec,byteLength:payload.length,sha256:hash(payload)});}
    const source={name:sourceName,sha256:sourceSha256,byteLength:bytes.length,width:decoded.width,height:decoded.height,metadata:decoded.metadata},manifest={format:'environment-map/1',identity,generator:ENVIRONMENT_GENERATOR,sourceTip,sources,recipe,source,environmentMaps:[{id,diffuse:specs[0].id,specular:specs[1].id}],buffers,visualReview:'unreviewed',provenance:{author:sourceAuthor,training:false,restrictedInputs:restrictions}};
    await fs.writeFile(path.join(pending,'environment.json'),JSON.stringify(manifest,null,2)+'\n');signal?.throwIfAborted();
    try{await fs.rename(pending,final);return {directory:final,manifest,reused:false};}
    catch(error){signal?.throwIfAborted();let winnerExists=false;try{await fs.stat(final);winnerExists=true;}catch(statError){if(!(statError instanceof Error&&'code' in statError&&statError.code==='ENOENT'))throw statError;}if(!winnerExists)throw error;const winner=await verifyExistingOutput(final,{identity,generator:ENVIRONMENT_GENERATOR,recipe,sources,source,sourceAuthor,restrictedInputs:restrictions,specs,signal});await fs.rm(pending,{recursive:true,force:true});return {directory:final,manifest:winner,reused:true};}
  }catch(error){if(path.dirname(pending)!==destination||!path.basename(pending).startsWith('.pending-'))throw Error('Invalid temporary environment ownership');await fs.rm(pending,{recursive:true,force:true});throw error;}
}

export function parseEnvironmentBakeArgs(args){const options={};for(let i=0;i<args.length;i+=1){const key=args[i];if(!['--environment','--hdr','--id','--profile','--out','--usage-restriction'].includes(key)||args[i+1]===undefined||Object.hasOwn(options,key))throw Error('Usage: npm run bake:environment -- --environment studio-softboxes|open-sky --profile preview|final --out <directory> OR --hdr <file.hdr> --id <name> --profile preview|final --usage-restriction <text> --out <directory>');options[key]=args[++i];}if(Boolean(options['--environment'])===Boolean(options['--hdr'])||options['--hdr']&&!options['--id']||options['--environment']&&options['--id']||Object.hasOwn(options,'--usage-restriction')&&!options['--hdr'])throw Error('Choose one environment name or an HDR path plus --id; usage restrictions apply only to supplied HDR');return options;}
async function main(){
  const options=parseEnvironmentBakeArgs(process.argv.slice(2)),id=options['--environment']??options['--id'];
  const abort=new AbortController(),cancel=()=>abort.abort(Error('Environment bake cancelled')),timer=setTimeout(()=>abort.abort(Error('Environment bake exceeded 20 minutes')),20*60*1000);timer.unref();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
  try{const result=await bakeEnvironment({id,profile:options['--profile']??'preview',sourcePath:options['--hdr'],restrictedInputs:Object.hasOwn(options,'--usage-restriction')?[options['--usage-restriction']]:undefined,output:options['--out'],signal:abort.signal,onProgress:p=>{if(p.done===p.total||p.done%256===0)console.log(JSON.stringify({progress:p.stage,done:p.done,total:p.total}));}});console.log(JSON.stringify({directory:result.directory,identity:result.manifest.identity,buffers:result.manifest.buffers.map(b=>({id:b.id,bytes:b.byteLength,sha256:b.sha256})),reused:result.reused}));}
  finally{clearTimeout(timer);process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
