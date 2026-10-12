/** Offline linear-radiance environment import and deterministic cubemap prefilter. */
export const ENVIRONMENT_GENERATOR = 'original-cosine-ggx/2';
export const ENVIRONMENT_PROFILES = Object.freeze({
  preview: Object.freeze({specularSize:128,diffuseSize:16,specularSamples:64,diffuseSamples:128}),
  final: Object.freeze({specularSize:512,diffuseSize:32,specularSamples:128,diffuseSamples:256}),
});
export const ENVIRONMENT_IDS = Object.freeze(['studio-softboxes','open-sky']);
export const ENVIRONMENT_FACE_ORDER = Object.freeze(['+X','-X','+Y','-Y','+Z','-Z']);
const MAX_SOURCE_BYTES=64*1048576,MAX_WIDTH=4096,MAX_HEIGHT=2048,MAX_PIXELS=MAX_WIDTH*MAX_HEIGHT;
const PI=Math.PI,TAU=2*PI;
/** @typedef {[number,number,number]} Vec3 */
/** @typedef {{width:number,height:number,pixels:Float32Array}} DecodedRadiance */
/** @typedef {{format:'32-bit_rle_rgbe',orientation:string,colorSpace:'linear-rgb',outputColorSpace:'linear-srgb',primaries:string,exposure:number,colorCorrection:Vec3,sourceBytes:number}} RadianceMetadata */
/** @typedef {{width:number,height:number,pixels:Float32Array,metadata:RadianceMetadata}} DecodedRadianceWithMetadata */
/** @typedef {{maxBytes?:number,maxWidth?:number,maxHeight?:number}} RadianceDecodeOptions */
/** @typedef {{orientation?:'-Y +X'|'-Y -X'|'+Y +X'|'+Y -X',exposure?:number,colorCorrection?:Vec3}} RadianceEncodeOptions */
/** @typedef {{stage:'specular'|'diffuse'|'complete',done:number,total:number,mip?:number,face?:number,row?:number}} PrefilterProgress */
/** @typedef {{specularSize:number,diffuseSize:number,specularSamples:number,diffuseSamples:number,signal?:AbortSignal,onProgress?:(progress:PrefilterProgress)=>void}} PrefilterOptions */
/** @typedef {{diffuse:Uint8Array,specular:Uint8Array,specularSize:number,diffuseSize:number,specularMipLevels:number,specularSamples:number,diffuseSamples:number}} PrefilterResult */
/** @typedef {'studio-softboxes'|'open-sky'} EnvironmentId */
/** @typedef {'preview'|'final'} EnvironmentProfileName */
/** @typedef {{id:string,profile:EnvironmentProfileName,specularSize:number,diffuseSize:number,specularSamples:number,diffuseSamples:number}} ValidatedEnvironmentBake */
/** @param {number} x @param {number} a @param {number} b @returns {number} */
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
/** @param {number} x @returns {number} */
const fract=x=>x-Math.floor(x);
/** @param {number} a @param {number} b @param {number} x @returns {number} */
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
/** @param {Vec3} v @returns {Vec3} */
const normalize=v=>{const l=Math.hypot(v[0],v[1],v[2]);return [v[0]/l,v[1]/l,v[2]/l];};

/** Parse bounded Radiance RGBE, including legacy flat pixels and modern per-channel scanline RLE. */
/** @param {Uint8Array|ArrayBuffer} input @param {RadianceDecodeOptions} [options] @returns {DecodedRadianceWithMetadata} */
export function decodeRadianceHdr(input,{maxBytes=MAX_SOURCE_BYTES,maxWidth=MAX_WIDTH,maxHeight=MAX_HEIGHT}={}){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.byteLength<32||bytes.byteLength>maxBytes)throw Error('Radiance HDR source exceeds its byte limit or is truncated');
  let at=0;/** @returns {string} */ const line=()=>{const start=at;while(at<bytes.length&&bytes[at]!==10)at++;if(at>=bytes.length)throw Error('Truncated Radiance HDR header');let end=at++;if(end>start&&bytes[end-1]===13)end--;return Buffer.from(bytes.subarray(start,end)).toString('ascii');};
  const magic=line();if(magic!=='#?RADIANCE'&&magic!=='#?RGBE')throw Error('Invalid Radiance HDR signature');
  let format=false,headerEnded=false,exposure=1;/** @type {Vec3} */ let colorCorrection=[1,1,1];let primaries='srgb-rec709';
  for(let n=0;n<64;n++){
    const value=line();if(!value){headerEnded=true;break;}
    if(value==='FORMAT=32-bit_rle_rgbe')format=true;
    else if(value.startsWith('EXPOSURE=')){const v=Number(value.slice(9));if(!Number.isFinite(v)||v<=0||v>1e12||exposure>1e12/v)throw Error('Invalid Radiance exposure metadata');exposure*=v;}
    else if(value.startsWith('COLORCORR=')){const v=value.slice(10).trim().split(/\s+/).map(Number);if(v.length!==3||v.some(n=>!Number.isFinite(n)||n<=0||n>1e6)||colorCorrection.some((n,i)=>n>1e6/v[i]))throw Error('Invalid Radiance color correction metadata');colorCorrection=/** @type {Vec3} */(colorCorrection.map((n,i)=>n*v[i]));}
    else if(value.startsWith('PRIMARIES=')){const v=value.slice(10).trim().split(/\s+/).map(Number);if(v.length!==8||v.some(n=>!Number.isFinite(n))||JSON.stringify(v.map(n=>Number(n.toFixed(4))))!==JSON.stringify([0.6400,0.3300,0.3000,0.6000,0.1500,0.0600,0.3127,0.3290]))throw Error('Radiance primaries must be sRGB/Rec.709 for linear-sRGB output');}
  }
  if(!format)throw Error('Radiance HDR must declare FORMAT=32-bit_rle_rgbe');if(!headerEnded)throw Error('Radiance HDR header is incomplete');
  /** @type {{ySign:'+'|'-',height:number,xSign:'+'|'-',width:number,text:string}|undefined} */ let resolution;for(let n=0;n<8;n++){const value=line();const match=value.match(/^([+-])Y\s+(\d+)\s+([+-])X\s+(\d+)$/);if(match){resolution={ySign:/** @type {'+'|'-'} */(match[1]),height:Number(match[2]),xSign:/** @type {'+'|'-'} */(match[3]),width:Number(match[4]),text:value};break;}if(/^\s*[+-]X\b/.test(value))throw Error('Radiance orientation must list Y scanlines before X pixels');}
  if(!resolution)throw Error('Unsupported Radiance orientation/resolution');
  const {width,height}=resolution;if(width<1||height<1||width>maxWidth||height>maxHeight||width*height>MAX_PIXELS||width!==height*2)throw Error('Radiance environment must be a bounded 2:1 equirectangular image');
  const pixels=new Float32Array(width*height*3);/** @returns {number} */ const read=()=>{if(at>=bytes.length)throw Error('Truncated Radiance HDR pixels');return bytes[at++];};
  const scale=1/exposure,sourceColorCorrection=/** @type {Vec3} */(colorCorrection.map(value=>1/value));
  for(let row=0;row<height;row++){
    const rgbe=new Uint8Array(width*4);/** @type {[number,number,number,number]} */ let first=[read(),read(),read(),read()];
    const isRle=width>=8&&first[0]===2&&first[1]===2&&(first[2]&0x80)===0&&((first[2]<<8)|first[3])===width;
    if(isRle){
      for(let channel=0;channel<4;channel++){
        let x=0;while(x<width){const count=read();if(count===0)throw Error('Invalid Radiance RLE packet');if(count>128){const run=count-128;if(run===0||x+run>width)throw Error('Radiance RLE run exceeds scanline');const value=read();for(let k=0;k<run;k++)rgbe[(x+k)*4+channel]=value;x+=run;}else{if(x+count>width)throw Error('Radiance RLE literal exceeds scanline');for(let k=0;k<count;k++)rgbe[(x+k)*4+channel]=read();x+=count;}}
      }
    }else{
      rgbe.set(first,0);for(let x=1;x<width;x++)rgbe.set([read(),read(),read(),read()],x*4);
    }
    const y=resolution.ySign==='-'?row:height-1-row;
    for(let column=0;column<width;column++){
      const x=resolution.xSign==='+'?column:width-1-column,o=(y*width+x)*3,p=column*4,e=rgbe[p+3];
      const factor=e?2**(e-136)*scale:0;
      const r=rgbe[p]*factor*sourceColorCorrection[0],g=rgbe[p+1]*factor*sourceColorCorrection[1],b=rgbe[p+2]*factor*sourceColorCorrection[2];
      if(!Number.isFinite(r)||!Number.isFinite(g)||!Number.isFinite(b)||Math.max(r,g,b)>65504)throw Error('Radiance value is outside finite linear RGBA16F range');
      pixels[o]=r;pixels[o+1]=g;pixels[o+2]=b;
    }
  }
  if(at!==bytes.length)throw Error('Radiance HDR has trailing bytes after its image');
  return {width,height,pixels,metadata:{format:'32-bit_rle_rgbe',orientation:resolution.text,colorSpace:'linear-rgb',outputColorSpace:'linear-srgb',primaries,exposure,colorCorrection:/** @type {Vec3} */(colorCorrection),sourceBytes:bytes.byteLength}};
}

/** Encode an equirectangular linear-RGB image as valid Radiance scanline-RLE. */
/** @param {number} width @param {number} height @param {Float32Array|Float64Array} pixels @param {RadianceEncodeOptions} [options] @returns {Buffer} */
export function encodeRadianceHdr(width,height,pixels,{orientation='-Y +X',exposure=1,colorCorrection=[1,1,1]}={}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<8||height<1||width!==height*2||!(pixels instanceof Float32Array||pixels instanceof Float64Array)||pixels.length!==width*height*3)throw Error('Invalid Radiance source pixels');
  if(!['-Y +X','-Y -X','+Y +X','+Y -X'].includes(orientation)||!Number.isFinite(exposure)||exposure<=0||exposure>1e12||colorCorrection.length!==3||colorCorrection.some(n=>!Number.isFinite(n)||n<=0||n>1e6)||colorCorrection.some(n=>exposure>1e12/n))throw Error('Invalid Radiance source metadata');
  const header=Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\nEXPOSURE=${exposure}\nCOLORCORR=${colorCorrection.join(' ')}\n\n${orientation.split(' ')[0]} ${height} ${orientation.split(' ')[1]} ${width}\n`,'ascii'),parts=[header];
  /** @param {number} x @param {number} y @returns {[number,number,number,number]} */ const encodePixel=(x,y)=>{const i=(y*width+x)*3,r=pixels[i]*exposure*colorCorrection[0],g=pixels[i+1]*exposure*colorCorrection[1],b=pixels[i+2]*exposure*colorCorrection[2],v=Math.max(r,g,b);if(!Number.isFinite(v)||Math.min(r,g,b)<0||Math.max(pixels[i],pixels[i+1],pixels[i+2])>65504||v>1e30)throw Error('Invalid linear Radiance pixel');if(v<1e-32)return [0,0,0,0];const exponent=Math.floor(Math.log2(v))+1,multiplier=256/2**exponent;return [Math.min(255,Math.floor(r*multiplier)),Math.min(255,Math.floor(g*multiplier)),Math.min(255,Math.floor(b*multiplier)),exponent+128];};
  for(let fileY=0;fileY<height;fileY++){
    const y=orientation.startsWith('-Y')?fileY:height-1-fileY,scan=Buffer.alloc(width*4);for(let fileX=0;fileX<width;fileX++){const x=orientation.endsWith('+X')?fileX:width-1-fileX;scan.set(encodePixel(x,y),fileX*4);}
    const row=[Buffer.from([2,2,width>>8,width&255])];for(let c=0;c<4;c++){const channel=Buffer.alloc(width);for(let x=0;x<width;x++)channel[x]=scan[x*4+c];let i=0;while(i<width){let run=1;while(i+run<width&&run<127&&channel[i+run]===channel[i])run++;if(run>=4){row.push(Buffer.from([128+run,channel[i]]));i+=run;continue;}const start=i;i+=run;while(i<width&&i-start<128){let next=1;while(i+next<width&&next<127&&channel[i+next]===channel[i])next++;if(next>=4)break;i+=Math.min(next,128-(i-start));}row.push(Buffer.from([i-start]),channel.subarray(start,i));}}
    parts.push(...row);
  }
  return Buffer.concat(parts);
}

/** Cube directions use the shared +X,-X,+Y,-Y,+Z,-Z top-to-bottom convention. */
/** @param {number} face @param {number} u @param {number} v @returns {Vec3} */
export function cubeDirection(face,u,v){
  const d=[[1,-v,-u],[-1,-v,u],[u,1,v],[u,-1,-v],[u,-v,1],[-u,-v,-1]][face];if(!d)throw Error('Invalid cubemap face');return normalize(/** @type {Vec3} */(d));
}
/** @param {DecodedRadiance} image @param {Vec3} direction @returns {Vec3} */
function sampleEquirect(image,direction){
  const u=fract(.5+Math.atan2(direction[2],direction[0])/TAU),v=Math.acos(clamp(direction[1],-1,1))/PI,x=u*image.width-.5,y=clamp(v*image.height-.5,0,image.height-1),x0=Math.floor(x),y0=Math.floor(y),tx=x-x0,ty=y-y0;
  const xA=((x0%image.width)+image.width)%image.width,xB=(xA+1)%image.width,yA=clamp(y0,0,image.height-1),yB=clamp(yA+1,0,image.height-1),out=[0,0,0];
  for(let c=0;c<3;c++){const a=image.pixels[(yA*image.width+xA)*3+c],b=image.pixels[(yA*image.width+xB)*3+c],d=image.pixels[(yB*image.width+xA)*3+c],e=image.pixels[(yB*image.width+xB)*3+c];out[c]=(a+(b-a)*tx)*(1-ty)+(d+(e-d)*tx)*ty;}return /** @type {Vec3} */(out);
}
/** @param {number} bits @returns {number} */
function radicalInverse(bits){bits=(bits<<16)|(bits>>>16);bits=((bits&0x55555555)<<1)|((bits&0xaaaaaaaa)>>>1);bits=((bits&0x33333333)<<2)|((bits&0xcccccccc)>>>2);bits=((bits&0x0f0f0f0f)<<4)|((bits&0xf0f0f0f0)>>>4);bits=((bits&0x00ff00ff)<<8)|((bits&0xff00ff00)>>>8);return (bits>>>0)/4294967296;}
/** @param {Vec3} n @returns {[Vec3,Vec3]} */
function basis(n){const up=/** @type {Vec3} */(Math.abs(n[1])<.999?[0,1,0]:[0,0,1]),t=normalize(/** @type {Vec3} */([up[1]*n[2]-up[2]*n[1],up[2]*n[0]-up[0]*n[2],up[0]*n[1]-up[1]*n[0]])),b=/** @type {Vec3} */([n[1]*t[2]-n[2]*t[1],n[2]*t[0]-n[0]*t[2],n[0]*t[1]-n[1]*t[0]]);return [t,b];}
/** @param {Vec3} local @param {Vec3} n @param {Vec3} t @param {Vec3} b @returns {Vec3} */
function toWorld(local,n,t,b){return normalize(/** @type {Vec3} */([t[0]*local[0]+b[0]*local[1]+n[0]*local[2],t[1]*local[0]+b[1]*local[1]+n[1]*local[2],t[2]*local[0]+b[2]*local[1]+n[2]*local[2]]));}
/** @param {number} value @returns {number} */
function pixelHalf(value){if(!Number.isFinite(value)||value<0||value>65504)throw Error('Environment output exceeds linear RGBA16F range');if(value===0)return 0;_float32[0]=value;const x=_uint32[0],exp=(x>>>23)&255,mant=x&0x7fffff;if(exp===255)throw Error('Environment output is not finite');let halfExp=exp-127+15;if(halfExp>=31)throw Error('Environment output exceeds linear RGBA16F range');if(halfExp<=0){if(halfExp< -10)return 0;const m=(mant|0x800000)>>(1-halfExp);return (m+0x1000)>>13;}let halfMant=(mant+0x1000)>>13;if(halfMant===0x400){halfMant=0;halfExp++;if(halfExp>=31)throw Error('Environment output exceeds linear RGBA16F range');}return (halfExp<<10)|halfMant;}
const _float32=new Float32Array(1),_uint32=new Uint32Array(_float32.buffer);
/** @param {DataView} view @param {number} byteOffset @param {Vec3} color */
function writeRgba16f(view,byteOffset,color){view.setUint16(byteOffset,pixelHalf(color[0]),true);view.setUint16(byteOffset+2,pixelHalf(color[1]),true);view.setUint16(byteOffset+4,pixelHalf(color[2]),true);view.setUint16(byteOffset+6,0x3c00,true);}
/** @param {Vec3} n @param {Vec3} t @param {Vec3} b @param {number} index @param {number} count @returns {Vec3} */
function samplePoint(n,t,b,index,count){const u=(index+.5)/count,v=radicalInverse(index),r=Math.sqrt(u),phi=TAU*v;return toWorld([r*Math.cos(phi),r*Math.sin(phi),Math.sqrt(1-u)],n,t,b);}
/** @param {DecodedRadiance} image @param {Vec3} n @param {number} samples @returns {Vec3} */
function diffusePixel(image,n,samples){const [t,b]=basis(n),out=[0,0,0];for(let i=0;i<samples;i++){const d=samplePoint(n,t,b,i,samples),c=sampleEquirect(image,d);out[0]+=c[0];out[1]+=c[1];out[2]+=c[2];}return /** @type {Vec3} */(out.map(v=>v/samples));}
/** @param {DecodedRadiance} image @param {Vec3} n @param {number} samples @param {number} perceptualRoughness @returns {Vec3} */
function specularPixel(image,n,samples,perceptualRoughness){
  const physicalRoughness=clamp(perceptualRoughness,.089,1)**2;if(physicalRoughness<.01)return sampleEquirect(image,n);
  const [t,b]=basis(n),out=[0,0,0];let total=0;
  for(let i=0;i<samples;i++){
    const xi=(i+.5)/samples,eta=radicalInverse(i),phi=TAU*xi,cosTheta=Math.sqrt((1-eta)/(1+(physicalRoughness*physicalRoughness-1)*eta)),sinTheta=Math.sqrt(Math.max(0,1-cosTheta*cosTheta)),h=toWorld([sinTheta*Math.cos(phi),sinTheta*Math.sin(phi),cosTheta],n,t,b),ndoth=Math.max(0,n[0]*h[0]+n[1]*h[1]+n[2]*h[2]),l=normalize([2*ndoth*h[0]-n[0],2*ndoth*h[1]-n[1],2*ndoth*h[2]-n[2]]),ndotl=Math.max(0,n[0]*l[0]+n[1]*l[1]+n[2]*l[2]);
    if(ndotl>0){const c=sampleEquirect(image,l);out[0]+=c[0]*ndotl;out[1]+=c[1]*ndotl;out[2]+=c[2]*ndotl;total+=ndotl;}
  }
  return total>0?/** @type {Vec3} */(out.map(v=>v/total)):sampleEquirect(image,n);
}
/** Deterministic cosine irradiance/π and GGX roughness mip chain in shared face order. */
/** @param {DecodedRadiance} image @param {PrefilterOptions} [options] @returns {Promise<PrefilterResult>} */
export async function prefilterEnvironment(image,{specularSize,diffuseSize,specularSamples,diffuseSamples,signal,onProgress=()=>{}}=/** @type {PrefilterOptions} */({})){
  if(!image||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width!==image.height*2||!(image.pixels instanceof Float32Array))throw Error('Invalid decoded Radiance environment');
  const validProfile=specularSize===128&&diffuseSize===16&&specularSamples===64&&diffuseSamples===128||specularSize===512&&diffuseSize===32&&specularSamples===128&&diffuseSamples===256;
  if(!validProfile)throw Error('Invalid environment prefilter profile');
  const levels=Math.floor(Math.log2(specularSize))+1;
  // Sum exact mip sizes; avoid fractional estimates in the output descriptor.
  let exactSpecBytes=0;for(let n=specularSize;n>=1;n>>=1)exactSpecBytes+=n*n*6*8;
  const specular=new Uint8Array(exactSpecBytes),diffuse=new Uint8Array(diffuseSize*diffuseSize*6*8),view=new DataView(specular.buffer);let offset=0,done=0,totalRows=6*(specularSize*2-1)+6*diffuseSize;
  for(let mip=0,size=specularSize;mip<levels;mip++,size=Math.max(1,size>>1)){
    const roughness=levels===1?0:mip/(levels-1);
    for(let face=0;face<6;face++)for(let y=0;y<size;y++){
      signal?.throwIfAborted();for(let x=0;x<size;x++){const n=cubeDirection(face,2*(x+.5)/size-1,2*(y+.5)/size-1),c=specularPixel(image,n,specularSamples,roughness);writeRgba16f(view,offset,c);offset+=8;}
      done++;if((done&15)===0){onProgress({stage:'specular',done,total:totalRows,mip,face,row:y});await new Promise(resolve=>setImmediate(resolve));}
    }
  }
  const diffuseView=new DataView(diffuse.buffer);offset=0;
  for(let face=0;face<6;face++)for(let y=0;y<diffuseSize;y++){
    signal?.throwIfAborted();for(let x=0;x<diffuseSize;x++){const n=cubeDirection(face,2*(x+.5)/diffuseSize-1,2*(y+.5)/diffuseSize-1),c=diffusePixel(image,n,diffuseSamples);writeRgba16f(diffuseView,offset,c);offset+=8;}
    done++;if((done&15)===0){onProgress({stage:'diffuse',done,total:totalRows,face,row:y});await new Promise(resolve=>setImmediate(resolve));}
  }
  signal?.throwIfAborted();onProgress({stage:'complete',done:totalRows,total:totalRows});return {specular,diffuse,specularSize,diffuseSize,specularMipLevels:levels,specularSamples,diffuseSamples};
}

/** @param {number} x @param {number} y @param {number} width @param {number} height @returns {Vec3} */
function directionFromLatLong(x,y,width,height){const u=x/width,v=y/height,longitude=(u-.5)*TAU,latitude=PI/2-v*PI,c=Math.cos(latitude);return [c*Math.cos(longitude),Math.sin(latitude),c*Math.sin(longitude)];}
/** @param {Vec3} d @returns {Vec3} */
function originalStudioRadiance(d){
  const horizon=smooth(-.25,.25,d[1]),c=/** @type {Vec3} */([.045+.07*horizon,.05+.075*horizon,.06+.09*horizon]),boxes=/** @type {[Vec3,Vec3,number,number][]} */([[[.2,.85,.48],[1.0,.78,.55],11,.24], [[-.72,.62,.32],[.56,.75,1.0],7,.3], [[.72,.48,-.58],[1.0,.42,.2],4,.34]]);
  for(const [raw,color,power,width]of boxes){const axis=normalize(raw),angle=1-d[0]*axis[0]-d[1]*axis[1]-d[2]*axis[2],w=1-smooth(width*.62,width,angle);for(let k=0;k<3;k++)c[k]+=color[k]*power*w;}
  return c;
}
/** @param {Vec3} d @returns {Vec3} */
function originalSkyRadiance(d){
  const t=smooth(-.12,.42,d[1]),cloud=clamp(.5+.5*Math.sin(d[0]*13+d[2]*7+Math.sin(d[1]*9))*Math.cos(d[2]*11-d[0]*4),0,1),c=/** @type {Vec3} */(d[1]>=0?[.19+.34*t+.1*cloud,.42+.42*t+.12*cloud,.76+.56*t+.08*cloud]:[.08+.2*(d[1]+1),.095+.2*(d[1]+1),.11+.19*(d[1]+1)]);
  const sun=normalize([-.38,.82,.42]),angle=Math.acos(clamp(d[0]*sun[0]+d[1]*sun[1]+d[2]*sun[2],-1,1)),halo=Math.exp(-((angle/.12)**2));
  c[0]+=1.2*halo;c[1]+=1.05*halo;c[2]+=.8*halo;return c;
}
/** Original procedural studio and outdoor source HDRs; both use the public decoder path. */
/** @param {EnvironmentId} id @param {{width?:number,height?:number}} [options] @returns {Buffer} */
export function createOriginalEnvironmentHdr(id,{width=512,height=256}={}){
  if(!ENVIRONMENT_IDS.includes(id)||width!==height*2||width<8||width>MAX_WIDTH||height>MAX_HEIGHT)throw Error('Invalid original environment source');
  const floats=new Float32Array(width*height*3),fn=id==='studio-softboxes'?originalStudioRadiance:originalSkyRadiance;for(let y=0;y<height;y++)for(let x=0;x<width;x++){const c=fn(directionFromLatLong(x+.5,y+.5,width,height)),i=(y*width+x)*3;floats[i]=c[0];floats[i+1]=c[1];floats[i+2]=c[2];}
  return encodeRadianceHdr(width,height,floats);
}

/** Validate public authoring choices; only preview and final profiles are supported. */
/** @param {{id?:string,profile?:EnvironmentProfileName}} [options] @returns {ValidatedEnvironmentBake} */
export function validateEnvironmentBake({id,profile='preview'}={}){
  if(typeof id!=='string'||!/^[a-z0-9][a-z0-9-]{0,47}$/.test(id)||profile!=='preview'&&profile!=='final')throw Error('Invalid environment identity or profile');
  return {id,profile,...ENVIRONMENT_PROFILES[profile]};
}
