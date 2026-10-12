import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {bakeEnvironment,parseEnvironmentBakeArgs} from './bake-environment.mjs';
import {createOriginalEnvironmentHdr,cubeDirection,decodeRadianceHdr,encodeRadianceHdr,ENVIRONMENT_PROFILES,prefilterEnvironment,validateEnvironmentBake} from '../src/shader/environment.mjs';

function flatHdr(width=4,height=2,rgbe=[128,64,32,129],{orientation='-Y +X',extra=''}={}){
  const [yAxis,xAxis]=orientation.split(' '),header=Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n${extra}\n\n${yAxis} ${height} ${xAxis} ${width}\n`,'ascii'),data=Buffer.alloc(width*height*4);
  for(let fileY=0;fileY<height;fileY++)for(let fileX=0;fileX<width;fileX++){const x=xAxis==='+X'?fileX:width-1-fileX,y=yAxis==='-Y'?fileY:height-1-fileY,value=typeof rgbe==='function'?rgbe(x,y):rgbe;data.set(value,(fileY*width+fileX)*4);}return Buffer.concat([header,data]);
}
const readHalf=(bytes,offset)=>{const h=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength).readUInt16LE(offset),sign=(h&0x8000)?-1:1,e=(h>>>10)&31,m=h&1023;return e===0?sign*2**-14*(m/1024):e===31?NaN:sign*2**(e-15)*(1+m/1024);};
function bufferBytes(size,levels){let n=0;for(let mip=0,current=size;mip<levels;mip++,current=Math.max(1,current>>1))n+=current*current*6*8;return n;}
function directionalHdr(width=256,height=128){
  const pixels=new Float32Array(width*height*3);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const longitude=((x+.5)/width-.5)*Math.PI*2,latitude=Math.PI/2-(y+.5)/height*Math.PI,d=[Math.cos(latitude)*Math.cos(longitude),Math.sin(latitude),Math.cos(latitude)*Math.sin(longitude)],i=(y*width+x)*3;pixels[i]=.5+.5*d[0];pixels[i+1]=.5+.5*d[1];pixels[i+2]=.5+.5*d[2];}return decodeRadianceHdr(encodeRadianceHdr(width,height,pixels));
}

test('Radiance flat RGBE import restores source radiance from cumulative exposure and color-correction metadata',()=>{
  const source=flatHdr(4,2,(x,y)=>[128+x+4*y,64,32,129],{orientation:'+Y -X',extra:'EXPOSURE=2\nEXPOSURE=4\nCOLORCORR=2 1 2\nCOLORCORR=0.5 0.5 2'}),decoded=decodeRadianceHdr(source);
  assert.equal(decoded.metadata.orientation,'+Y 2 -X 4');assert.equal(decoded.metadata.colorSpace,'linear-rgb');assert.equal(decoded.metadata.outputColorSpace,'linear-srgb');assert.equal(decoded.metadata.exposure,8);assert.deepEqual(decoded.metadata.colorCorrection,[1,0.5,4]);
  assert.deepEqual([...decoded.pixels.slice(0,3)],[1/8,1/8,1/128]);assert.ok(Math.abs(decoded.pixels[4*3]-((128+4)/128/8))<1e-7);assert.deepEqual([...decoded.pixels.slice((4+3)*3,(4+3)*3+3)],[(128+7)/128/8,1/8,1/128]);
  assert.throws(()=>decodeRadianceHdr(flatHdr(4,2,[128,64,32,129],{extra:'COLORCORR=1 0 1'})),/color correction/i);
  assert.throws(()=>decodeRadianceHdr(flatHdr(4,2,[128,64,32,129],{extra:'COLORCORR=1 1 1\nCOLORCORR=0 1 1'})),/color correction/i);
});

test('Radiance encoder applies its declared metadata factors before writing RGBE',()=>{
  const pixels=new Float32Array(8*4*3);for(let i=0;i<pixels.length;i+=3){pixels[i]=.5;pixels[i+1]=.25;pixels[i+2]=.125;}
  const decoded=decodeRadianceHdr(encodeRadianceHdr(8,4,pixels,{exposure:2,colorCorrection:[2,.5,4]}));
  for(let i=0;i<pixels.length;i++)assert.ok(Math.abs(decoded.pixels[i]-pixels[i])<.005);
});

test('Radiance scanline RLE handles repeated and literal channel packets deterministically',()=>{
  const width=16,height=8,pixels=new Float32Array(width*height*3);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*3,v=x<6?1.25:.25+x*.071+y*.017;pixels[i]=v;pixels[i+1]=v*.5;pixels[i+2]=v*.25;}
  const encoded=encodeRadianceHdr(width,height,pixels),decoded=decodeRadianceHdr(encoded);assert.deepEqual(decodeRadianceHdr(encoded).pixels,decoded.pixels);assert.equal(decoded.width,width);assert.equal(decoded.height,height);
  for(let i=0;i<pixels.length;i++)assert.ok(Math.abs(decoded.pixels[i]-pixels[i])<.025,`RGBE round trip at ${i}`);
});

test('Radiance importer rejects malformed headers, unsupported primaries and over-limit inputs',()=>{
  assert.throws(()=>decodeRadianceHdr(Buffer.from('bad')),/signature|limit|truncated/i);
  assert.throws(()=>decodeRadianceHdr(flatHdr(4,2).subarray(0,55)),/truncated/i);
  assert.throws(()=>decodeRadianceHdr(flatHdr(4,2,[0,0,0,0],{extra:'PRIMARIES=0.7 0.3 0.2 0.7 0.1 0.1 0.31 0.33'})),/primaries/i);
  assert.doesNotThrow(()=>decodeRadianceHdr(flatHdr(4,2,[0,0,0,0],{extra:'PRIMARIES=0.64 0.33 0.30 0.60 0.15 0.06 0.3127 0.329'})));
  const wrongDimensions=Buffer.concat([Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 2 +X 5\n','ascii'),Buffer.alloc(5*2*4)]);assert.throws(()=>decodeRadianceHdr(wrongDimensions),/2:1/i);
  const badRun=Buffer.concat([Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 4 +X 8\n','ascii'),Buffer.from([2,2,0,8,137,128])]);assert.throws(()=>decodeRadianceHdr(badRun),/run exceeds/i);
  assert.throws(()=>decodeRadianceHdr(Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n-Y 2 +X 4\n','ascii')),/header is incomplete|truncated/i);
  assert.throws(()=>decodeRadianceHdr(flatHdr(),{maxBytes:8}),/limit/i);
});

test('canonical face directions and preview/final packing contract are fixed',async()=>{
  for(const [face,expected]of [[0,[1,0,0]],[1,[-1,0,0]],[2,[0,1,0]],[3,[0,-1,0]],[4,[0,0,1]],[5,[0,0,-1]]]){const got=cubeDirection(face,0,0);for(let c=0;c<3;c++)assert.ok(Math.abs(got[c]-expected[c])<1e-12);}
  assert.deepEqual(ENVIRONMENT_PROFILES.preview,{specularSize:128,diffuseSize:16,specularSamples:64,diffuseSamples:128});assert.deepEqual(ENVIRONMENT_PROFILES.final,{specularSize:512,diffuseSize:32,specularSamples:128,diffuseSamples:256});
  assert.throws(()=>validateEnvironmentBake({id:'../escape'}),/identity/i);assert.throws(()=>validateEnvironmentBake({id:'custom',profile:'quick'}),/profile/i);
  const aborted=AbortSignal.abort(Error('final profile reached prefilter'));await assert.rejects(prefilterEnvironment({width:4,height:2,pixels:new Float32Array(24)}, {...ENVIRONMENT_PROFILES.final,signal:aborted}),/final profile reached prefilter/);
});

test('cosine diffuse and GGX mips are deterministic, linear half-float, and alpha-one',async()=>{
  const image={width:4,height:2,pixels:new Float32Array(4*2*3)};for(let i=0;i<image.pixels.length;i+=3){image.pixels[i]=1.99951171875;image.pixels[i+1]=.75;image.pixels[i+2]=.25;}
  const first=await prefilterEnvironment(image,{...ENVIRONMENT_PROFILES.preview}),second=await prefilterEnvironment(image,{...ENVIRONMENT_PROFILES.preview});assert.deepEqual(first,second);
  assert.equal(first.specular.length,bufferBytes(128,8));assert.equal(first.diffuse.length,16*16*6*8);assert.equal(first.specularMipLevels,8);
  for(const map of [first.specular,first.diffuse])for(let i=0;i<map.length;i+=8){assert.ok(Math.abs(readHalf(map,i)-2)<.004);assert.ok(Math.abs(readHalf(map,i+2)-.75)<.004);assert.ok(Math.abs(readHalf(map,i+4)-.25)<.004);assert.equal(map[i+6],0);assert.equal(map[i+7],0x3c);}
});

test('cosine diffuse preserves a directional field across every face and cube edge',async()=>{
  const size=ENVIRONMENT_PROFILES.preview.diffuseSize,result=await prefilterEnvironment(directionalHdr(),{...ENVIRONMENT_PROFILES.preview}),diffuse=result.diffuse;
  let maxError=0,maxEdgeError=0;
  for(let face=0;face<6;face++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const d=cubeDirection(face,2*(x+.5)/size-1,2*(y+.5)/size-1),offset=((face*size+y)*size+x)*8,edge=x===0||y===0||x===size-1||y===size-1;
    for(let channel=0;channel<3;channel++){const error=Math.abs(readHalf(diffuse,offset+channel*2)-(.5+d[channel]/3));maxError=Math.max(maxError,error);if(edge)maxEdgeError=Math.max(maxEdgeError,error);}
  }
  assert.ok(maxError<.025,`directional convolution error ${maxError}`);assert.ok(maxEdgeError<.025,`cube-edge directional error ${maxEdgeError}`);
  let mipOffset=0,maxSpecularOrientationError=0,maxSpecularEdgeError=0;
  for(let mip=0,faceSize=ENVIRONMENT_PROFILES.preview.specularSize;mip<result.specularMipLevels;mip++,faceSize=Math.max(1,faceSize>>1)){
    for(let face=0;face<6;face++)for(let y=0;y<faceSize;y++)for(let x=0;x<faceSize;x++){
      const n=cubeDirection(face,2*(x+.5)/faceSize-1,2*(y+.5)/faceSize-1),offset=mipOffset+((face*faceSize+y)*faceSize+x)*8,v=[0,1,2].map(channel=>readHalf(result.specular,offset+channel*2)-.5),projection=v[0]*n[0]+v[1]*n[1]+v[2]*n[2],residual=Math.hypot(v[0]-projection*n[0],v[1]-projection*n[1],v[2]-projection*n[2]),edge=x===0||y===0||x===faceSize-1||y===faceSize-1;
      maxSpecularOrientationError=Math.max(maxSpecularOrientationError,residual);if(edge)maxSpecularEdgeError=Math.max(maxSpecularEdgeError,residual);
    }
    mipOffset+=faceSize*faceSize*6*8;
  }
  assert.ok(maxSpecularOrientationError<.04,`specular field orientation error ${maxSpecularOrientationError}`);assert.ok(maxSpecularEdgeError<.04,`specular cube-edge orientation error ${maxSpecularEdgeError}`);
});

test('original studio and sky sources are deterministic Radiance RLE with distinct content',()=>{
  const a=createOriginalEnvironmentHdr('studio-softboxes'),b=createOriginalEnvironmentHdr('studio-softboxes'),sky=createOriginalEnvironmentHdr('open-sky');assert.deepEqual(a,b);assert.notDeepEqual(a,sky);
  const d=decodeRadianceHdr(a),skyImage=decodeRadianceHdr(sky);assert.equal(d.width,512);assert.equal(d.height,256);assert.equal(d.metadata.orientation,'-Y 256 +X 512');assert.ok(d.pixels.some(v=>v>1));assert.ok(skyImage.pixels.reduce((max,value)=>Math.max(max,value),0)<4,'open sky keeps a broad halo without a concentrated sun disk');
});

test('bake writes a content-bound manifest atomically, reuses verified output, and preserves output on abort/corruption',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'environment-bake-')),source=flatHdr();
  try{
    const progress=[],first=await bakeEnvironment({id:'fixture-flat',profile:'preview',sourceBytes:source,output,onProgress:p=>progress.push(p)});assert.equal(first.reused,false);assert.ok(progress.length>0);assert.equal(first.manifest.format,'environment-map/1');assert.deepEqual(first.manifest.environmentMaps,[{id:'fixture-flat',diffuse:'fixture-flat-diffuse',specular:'fixture-flat-specular'}]);assert.equal(first.manifest.buffers[0].byteLength,16*16*6*8);assert.equal(first.manifest.buffers[1].mipLevels,8);assert.ok(first.manifest.buffers.every(b=>/^[a-f0-9]{64}$/.test(b.sha256)));
    const reused=await bakeEnvironment({id:'fixture-flat',profile:'preview',sourceBytes:source,output});assert.equal(reused.reused,true);assert.equal(reused.directory,first.directory);const changed=Buffer.from(source);changed[changed.length-1]=1;const distinct=await bakeEnvironment({id:'fixture-flat',profile:'preview',sourceBytes:changed,output});assert.notEqual(distinct.manifest.identity,first.manifest.identity);
    const baseline=await fs.readFile(path.join(first.directory,'environment.json')),file=path.join(first.directory,first.manifest.buffers[0].uri),bytes=await fs.readFile(file);await fs.writeFile(file,Buffer.from('bad'));await assert.rejects(bakeEnvironment({id:'fixture-flat',profile:'preview',sourceBytes:source,output}),/altered|incomplete/i);await fs.writeFile(file,bytes);
    const abort=AbortSignal.abort(Error('stop before bake'));await assert.rejects(bakeEnvironment({id:'fixture-flat',sourceBytes:source,output,signal:abort}),/stop before bake/);assert.deepEqual(await fs.readFile(path.join(first.directory,'environment.json')),baseline);
    const controller=new AbortController();await assert.rejects(bakeEnvironment({id:'fixture-cancel',sourceBytes:source,output,signal:controller.signal,onProgress:()=>controller.abort(Error('cancel prefilter'))}),/cancel prefilter/);assert.ok(!(await fs.readdir(output)).some(name=>name.startsWith('.pending-')));
  }finally{await fs.rm(output,{recursive:true,force:true});}
});

test('cache reuse bounds padded manifests and oversized buffers while preserving completed output',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'environment-bounded-cache-')),source=flatHdr();
  try{
    const first=await bakeEnvironment({id:'bounded-cache-fixture',sourceBytes:source,output}),manifestPath=path.join(first.directory,'environment.json'),manifestBytes=await fs.readFile(manifestPath),manifest=JSON.parse(manifestBytes.toString('utf8'));
    manifest.padding='x'.repeat(1048576);const padded=Buffer.from(JSON.stringify(manifest));assert.ok(padded.length>1048576);await fs.writeFile(manifestPath,padded);
    await assert.rejects(bakeEnvironment({id:'bounded-cache-fixture',sourceBytes:source,output}),/byte limit/i);
    assert.ok((await fs.readdir(output)).includes(path.basename(first.directory)));
    await fs.writeFile(manifestPath,manifestBytes);

    const bufferPath=path.join(first.directory,first.manifest.buffers[0].uri),bufferBytes=await fs.readFile(bufferPath),expectedBytes=first.manifest.buffers[0].byteLength;
    await fs.truncate(bufferPath,expectedBytes+32*1048576);
    const originalReadFile=fs.readFile;let cacheReadFileCalls=0;
    fs.readFile=async function(file,...args){if(path.resolve(String(file))===path.resolve(bufferPath))cacheReadFileCalls++;return originalReadFile.call(fs,file,...args);};
    try{await assert.rejects(bakeEnvironment({id:'bounded-cache-fixture',sourceBytes:source,output}),/incomplete/i);assert.equal(cacheReadFileCalls,0,'cache verification must reject the oversized buffer before calling readFile');}
    finally{fs.readFile=originalReadFile;}
    await fs.writeFile(bufferPath,bufferBytes);
    assert.ok((await fs.readdir(output)).includes(path.basename(first.directory)));
    assert.ok(!(await fs.readdir(output)).some(name=>name.startsWith('.pending-')));
    const restored=await bakeEnvironment({id:'bounded-cache-fixture',sourceBytes:source,output});assert.equal(restored.reused,true);assert.equal(restored.directory,first.directory);
  }finally{await fs.rm(output,{recursive:true,force:true});}
});

test('offline path import records only a bounded source basename and content hash',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'environment-hdr-source-')),source=path.join(root,'sample.hdr'),output=path.join(root,'out');
  try{const bytes=flatHdr();await fs.writeFile(source,bytes);const result=await bakeEnvironment({id:'path-fixture',sourcePath:source,profile:'preview',output});assert.equal(result.manifest.source.name,'sample.hdr');assert.equal(result.manifest.source.sha256,(await import('node:crypto')).createHash('sha256').update(bytes).digest('hex'));assert.ok(!JSON.stringify(result.manifest).includes(root));}
  finally{await fs.rm(root,{recursive:true,force:true});}
});

test('external HDR usage restrictions are explicit and bound to cache identity and verification',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'environment-restriction-')),source=flatHdr();
  try{
    const unverified=await bakeEnvironment({id:'restriction-fixture',sourceBytes:source,output});
    assert.deepEqual(unverified.manifest.provenance.restrictedInputs,['usage-unverified/local-only']);
    const restrictedInputs=[' licensed for project A only ','no redistribution','no redistribution'];
    const normalized=['licensed for project A only','no redistribution'];
    const declared=await bakeEnvironment({id:'restriction-fixture',sourceBytes:source,restrictedInputs,output});
    assert.deepEqual(declared.manifest.provenance.restrictedInputs,normalized);
    assert.notEqual(declared.manifest.identity,unverified.manifest.identity);
    assert.equal((await bakeEnvironment({id:'restriction-fixture',sourceBytes:source,restrictedInputs:normalized,output})).reused,true);
    const explicitlyCleared=await bakeEnvironment({id:'restriction-fixture',sourceBytes:source,restrictedInputs:[],output});assert.deepEqual(explicitlyCleared.manifest.provenance.restrictedInputs,[]);assert.notEqual(explicitlyCleared.manifest.identity,unverified.manifest.identity);
    const altered=JSON.parse(await fs.readFile(path.join(declared.directory,'environment.json'),'utf8'));altered.provenance.restrictedInputs=['unrestricted'];await fs.writeFile(path.join(declared.directory,'environment.json'),JSON.stringify(altered));
    await assert.rejects(bakeEnvironment({id:'restriction-fixture',sourceBytes:source,restrictedInputs,output}),/provenance differs/i);
    await assert.rejects(bakeEnvironment({id:'restriction-fixture',sourceBytes:source,restrictedInputs:['  '],output}),/restricted inputs/i);
  }finally{await fs.rm(output,{recursive:true,force:true});}
});

test('original analytic environments keep empty restricted-input provenance',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'environment-original-provenance-'));
  try{const original=await bakeEnvironment({id:'studio-softboxes',profile:'preview',output});assert.deepEqual(original.manifest.provenance.restrictedInputs,[]);}
  finally{await fs.rm(output,{recursive:true,force:true});}
});

test('environment CLI exposes one supplied-HDR usage restriction',()=>{
  assert.deepEqual(parseEnvironmentBakeArgs(['--hdr','studio.hdr','--id','studio','--usage-restriction','local project only','--out','cache']),{'--hdr':'studio.hdr','--id':'studio','--usage-restriction':'local project only','--out':'cache'});
  assert.throws(()=>parseEnvironmentBakeArgs(['--environment','open-sky','--usage-restriction','local only','--out','cache']),/only to supplied HDR/i);
  assert.throws(()=>parseEnvironmentBakeArgs(['--hdr','studio.hdr','--id','studio','--usage-restriction']),/Usage:/i);
});

test('concurrent identical bakes validate and reuse the atomically published winner',async()=>{
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'environment-concurrent-')),source=flatHdr();
  try{
    const results=await Promise.all([
      bakeEnvironment({id:'concurrent-fixture',sourceBytes:source,output}),
      bakeEnvironment({id:'concurrent-fixture',sourceBytes:source,output}),
    ]);
    assert.equal(results.filter(result=>!result.reused).length,1);
    assert.equal(results.filter(result=>result.reused).length,1);
    assert.equal(results[0].directory,results[1].directory);
    assert.ok(!(await fs.readdir(output)).some(name=>name.startsWith('.pending-')));
  }finally{await fs.rm(output,{recursive:true,force:true});}
});
