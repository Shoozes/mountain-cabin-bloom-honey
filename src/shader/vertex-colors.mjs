/** Deterministic offline sampling of authored albedo into linear vertex colors. */
export const VERTEX_COLOR_GENERATOR='mesh-albedo-vertex-colors/1';
export const VERTEX_COLOR_OUTPUT_SEMANTICS=Object.freeze({attribute:'vertex-color',colorSpace:'linear-srgb',operation:'multiply-base-color-before-lighting',includesIllumination:false,alpha:'none',uvV:'increases-upward'});
export const VERTEX_COLOR_DEFAULTS=Object.freeze({filter:'nearest',wrap:'repeat',uvScale:Object.freeze([1,1]),tint:'#ffffff'});
/** @typedef {[number,number]} VertexColorUv */
/** @typedef {[number,number,number]} VertexColorRgb */
/** @typedef {{positions:VertexColorRgb[],indices:number[],uvs:VertexColorUv[],normals?:VertexColorRgb[],uv2?:VertexColorUv[],uv2Buffer?:string,splatWeights?:[number,number,number,number][],colors?:VertexColorRgb[],[key:string]:unknown}} VertexColorMesh */
/** @typedef {{width:number,height:number,data:Uint8Array,colorSpace:'srgb'|'linear'}} VertexColorImage */
/** @typedef {{filter?:'nearest'|'linear',wrap?:'repeat'|'clamp',uvScale?:VertexColorUv,tint?:string}} VertexColorSettingsInput */
/** @typedef {{filter:'nearest'|'linear',wrap:'repeat'|'clamp',uvScale:VertexColorUv,tint:string}} ValidatedVertexColorSettings */
/** @typedef {{stage:'vertices'|'complete',done:number,total:number}} VertexColorProgress */
const MAX_VERTICES=8192,MAX_INDICES=49152,MAX_COORDINATE=100000;
/** @param {number} value @param {number} min @param {number} max */
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
/** @param {number} value @param {number} size */
const wrapIndex=(value,size)=>((value%size)+size)%size;
/** @param {number} value */
const srgbToLinear=value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4;

/** @param {VertexColorImage} image */
function validateAlbedo(image){
 if(!image||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.height<1||image.width>8192||image.height>8192||!['srgb','linear'].includes(image.colorSpace)||!(image.data instanceof Uint8Array)||image.data.length!==image.width*image.height*4)throw Error('Invalid albedo image');
 for(let i=3;i<image.data.length;i+=4)if(image.data[i]!==255)throw Error('Vertex-color baking requires fully opaque albedo');
}
/** @param {VertexColorSettingsInput} input @returns {ValidatedVertexColorSettings} */
function validateSettings(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['filter','wrap','uvScale','tint'].includes(key)))throw Error('Invalid vertex-color sampling settings');
 const settings=/** @type {ValidatedVertexColorSettings} */ ({...VERTEX_COLOR_DEFAULTS,...input,uvScale:input.uvScale??[...VERTEX_COLOR_DEFAULTS.uvScale]});
 if(!['nearest','linear'].includes(settings.filter)||!['repeat','clamp'].includes(settings.wrap)||!Array.isArray(settings.uvScale)||settings.uvScale.length!==2||settings.uvScale.some(value=>!Number.isFinite(value)||value===0||Math.abs(value)>64)||typeof settings.tint!=='string'||!/^#[0-9a-f]{6}$/i.test(settings.tint))throw Error('Invalid vertex-color sampling settings');
 return {filter:settings.filter,wrap:settings.wrap,uvScale:[...settings.uvScale],tint:settings.tint.toLowerCase()};
}
/** @param {VertexColorMesh} mesh */
function validateMesh(mesh){
 if(!mesh||typeof mesh!=='object'||Array.isArray(mesh)||!Array.isArray(mesh.positions)||mesh.positions.length<3||mesh.positions.length>MAX_VERTICES||!Array.isArray(mesh.indices)||mesh.indices.length<3||mesh.indices.length>MAX_INDICES||mesh.indices.length%3||mesh.indices.some(index=>!Number.isInteger(index)||index<0||index>=mesh.positions.length)||!Array.isArray(mesh.uvs)||mesh.uvs.length!==mesh.positions.length)throw Error('Invalid mesh geometry for vertex-color baking');
 if(mesh.positions.some(point=>!Array.isArray(point)||point.length!==3||point.some(value=>!Number.isFinite(value)||Math.abs(value)>MAX_COORDINATE))||mesh.uvs.some(uv=>!Array.isArray(uv)||uv.length!==2||uv.some(value=>!Number.isFinite(value)||Math.abs(value)>MAX_COORDINATE))||mesh.normals!==undefined&&(!Array.isArray(mesh.normals)||mesh.normals.length!==mesh.positions.length||mesh.normals.some(normal=>!Array.isArray(normal)||normal.length!==3||normal.some(value=>!Number.isFinite(value)||Math.abs(value)>MAX_COORDINATE)))||mesh.uv2!==undefined&&(!Array.isArray(mesh.uv2)||mesh.uv2.length!==mesh.positions.length||mesh.uv2.some(uv=>!Array.isArray(uv)||uv.length!==2||uv.some(value=>!Number.isFinite(value)||value<0||value>1)))||mesh.uv2Buffer!==undefined&&mesh.uv2!==undefined||mesh.splatWeights!==undefined&&(!Array.isArray(mesh.splatWeights)||mesh.splatWeights.length!==mesh.positions.length||mesh.splatWeights.some(weights=>!Array.isArray(weights)||weights.length!==4||weights.some(value=>!Number.isFinite(value)||value<0||value>1))))throw Error('Invalid mesh positions, normals, UVs, UV2, or splat weights');
}
/** @param {string} tint */
function tintLinear(tint){return [1,3,5].map(i=>srgbToLinear(parseInt(tint.slice(i,i+2),16)/255));}
/** @param {number} value @param {number} size @param {'repeat'|'clamp'} wrap */
function index(value,size,wrap){return wrap==='repeat'?wrapIndex(value,size):clamp(value,0,size-1);}
/** @param {VertexColorImage} image @param {number} u @param {number} v @param {ValidatedVertexColorSettings} settings @returns {VertexColorRgb} */
function sampleAlbedo(image,u,v,settings){
 const x=u*image.width,y=(1-v)*image.height,wrap=settings.wrap;
 /** @type {[number,number,number][]} */ let samples;
 if(settings.filter==='nearest')samples=[[index(Math.floor(x),image.width,wrap),image.height-1-index(Math.floor(v*image.height),image.height,wrap),1]];
 else{
  const px=x-.5,py=y-.5,x0=Math.floor(px),y0=Math.floor(py),tx=px-x0,ty=py-y0;
  samples=[[x0,y0,(1-tx)*(1-ty)],[x0+1,y0,tx*(1-ty)],[x0,y0+1,(1-tx)*ty],[x0+1,y0+1,tx*ty]].map(([sx,sy,w])=>[index(sx,image.width,wrap),index(sy,image.height,wrap),w]);
 }
 const tint=tintLinear(settings.tint),out=[0,0,0];
 for(const [sx,sy,weight]of samples){const at=(sy*image.width+sx)*4;for(let c=0;c<3;c++){const channel=image.data[at+c]/255,linear=image.colorSpace==='srgb'?srgbToLinear(channel):channel;out[c]+=linear*weight*tint[c];}}
 const color=out.map(value=>clamp(value,0,1));return [color[0],color[1],color[2]];
}

/** Sample an admitted opaque albedo image onto mesh vertices.
 * @param {{mesh?:VertexColorMesh,albedo?:VertexColorImage,settings?:VertexColorSettingsInput,signal?:AbortSignal,onProgress?:(progress:VertexColorProgress)=>void}} options
 * @returns {Promise<VertexColorMesh>}
 */
export async function bakeVertexMesh({mesh,albedo,settings:inputSettings={},signal,onProgress=()=>{}}={}){
 if(!mesh||!albedo)throw Error('A mesh and albedo image are required');
 validateMesh(mesh);validateAlbedo(albedo);const settings=validateSettings(inputSettings),colors=new Array(mesh.positions.length),n=mesh.positions.length;
 for(let i=0;i<n;i++){
  signal?.throwIfAborted();const uv=mesh.uvs[i],u=uv[0]*settings.uvScale[0],v=uv[1]*settings.uvScale[1];colors[i]=sampleAlbedo(albedo,u,v,settings);
  if((i&255)===255){onProgress({stage:'vertices',done:i+1,total:n});await new Promise(resolve=>setImmediate(resolve));}
 }
 signal?.throwIfAborted();onProgress({stage:'complete',done:n,total:n});return {...mesh,colors};
}

/** @param {VertexColorSettingsInput} input @returns {ValidatedVertexColorSettings} */
export function validateVertexColorSettings(input={}){return validateSettings(input);}
