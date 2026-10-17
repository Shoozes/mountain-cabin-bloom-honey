/** Original surface authoring. Color is pigment; height is independent geometry. */
import {validateRealisticRecipe,generateRealisticMaterial} from './material-realistic.mjs';
export {REALISTIC_SURFACE_FAMILIES,REALISTIC_SURFACE_PRESETS} from './material-realistic.mjs';
export const MATERIAL_VERSION = 'hd2d-cliff/1';
export const MATERIAL_RECIPES = Object.freeze({'hd2d-cliff':'Original rock masses','hd2d-cliff-strata':'Stratified cliff','style-surface':'Style surface family','realistic-surface':'Photorealistic surfaces'});
export const STYLE_SURFACE_FAMILIES=Object.freeze(['grass','dirt','moss','cliff','stone','cobble','bark','timber','plaster','roof']);
export const MATERIAL_STYLES=Object.freeze(['hd2d','cel-ink','soft-cartoon','pbr']);
export const STYLE_SURFACE_SIZES=Object.freeze({'hd2d':128,'cel-ink':256,'soft-cartoon':256,'pbr':512});
export const materialVersion = id => id === 'realistic-surface' ? 'realistic-surface/1' : id === 'hd2d-cliff-strata' ? 'hd2d-cliff-strata/1' : id === 'style-surface' ? 'style-surface/1' : MATERIAL_VERSION;
export const MATERIAL_PALETTES = {
  earth: ['#40372f','#554b3d','#6a604e','#827962','#978d74','#aea58d'],
  slate: ['#343e41','#495256','#5d6668','#758080','#909b98','#afb7b0'],
  ochre: ['#49382c','#654d37','#80654a','#9a8060','#b09771','#c7b18c'],
};
export const MATERIAL_DEFAULTS = Object.freeze({id:'hd2d-cliff',seed:1204,size:128,palette:'earth',strataScale:4,fracture:.28,relief:.55,roughness:.84});
const SURFACE_DEFAULTS=Object.freeze({id:'style-surface',family:'grass',style:'hd2d',seed:1204,size:128,palette:'earth',strataScale:4,fracture:.28,relief:.55,roughness:.84});
const SURFACE_COLORS=Object.freeze({
  grass:['#193d25','#28572d','#397437','#579044','#7cab5a','#b3c77a'],dirt:['#36251b','#4a3020','#67452b','#84603b','#a27a50','#c19e71'],
  moss:['#243723','#344e2a','#4b6833','#68833e','#8d9c50','#b7b86c'],cliff:['#343433','#4b4944','#625e55','#797568','#918a78','#b0a68e'],
  stone:['#35393a','#4b5050','#626766','#787e7b','#929894','#b2b7ae'],cobble:['#3f3932','#585047','#71685b','#8c8170','#a89b85','#c0b59f'],
  bark:['#271a15','#3d2820','#56372a','#704a36','#8e6349','#b28a68'],timber:['#4c301a','#674322','#845a30','#a07340','#bc925b','#d2b47f'],
  plaster:['#554a3b','#766b59','#938674','#b0a48f','#c7bca8','#ded4c1'],roof:['#302d31','#464047','#5c5254','#746768','#8c7a76','#aa9688'],
});
const SURFACE_STYLES=Object.freeze({'hd2d':{relief:1,levels:6,edge:.18,saturation:1},'cel-ink':{relief:.72,levels:4,edge:.42,saturation:.92},'soft-cartoon':{relief:.82,levels:5,edge:.12,saturation:1.04},'pbr':{relief:1.12,levels:8,edge:.08,saturation:.94}});
const SURFACE_PALETTE_SHIFT=Object.freeze({earth:[0,0,0],slate:[-.1,.03,.12],ochre:[.08,.025,-.055]});
const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
const wrap=(n,p)=>(n%p+p)%p;
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
function hash(x,y,seed){let h=Math.imul(x,0x9e3779b1)^Math.imul(y,0x85ebca77)^seed;h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return ((h^(h>>>16))>>>0)/4294967296;}
function noise(u,v,cells,seed){const x=u*cells,y=v*cells,ix=Math.floor(x),iy=Math.floor(y),a=smooth(x-ix),b=smooth(y-iy),n=(x,y)=>hash(wrap(x,cells),wrap(y,cells),seed);return mix(mix(n(ix,iy),n(ix+1,iy),a),mix(n(ix,iy+1),n(ix+1,iy+1),a),b);}
export function validateMaterialRecipe(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected a material recipe object');
  if(input.id==='realistic-surface')return validateRealisticRecipe(input);
  if(input.id==='style-surface'){
    if(Object.keys(input).some(k=>!Object.hasOwn(SURFACE_DEFAULTS,k)))throw Error('Unknown material setting');
    const style=input.style??SURFACE_DEFAULTS.style,r={...SURFACE_DEFAULTS,...input,size:input.size??STYLE_SURFACE_SIZES[style]};
    if(!Object.hasOwn(SURFACE_COLORS,r.family)||!Object.hasOwn(SURFACE_STYLES,r.style)||!Number.isInteger(r.seed)||r.seed<0||r.seed>0xffffffff||![64,128,256,512].includes(r.size)||!Object.hasOwn(SURFACE_PALETTE_SHIFT,r.palette))throw Error('Invalid surface family, style, seed, size or palette');
    for(const [key,min,max]of [['strataScale',1,8],['fracture',0,1],['relief',0,1],['roughness',.05,1]])if(!Number.isFinite(r[key])||r[key]<min||r[key]>max)throw Error('Invalid material '+key);
    return r;
  }
  if(Object.keys(input).some(k=>!Object.hasOwn(MATERIAL_DEFAULTS,k)))throw Error('Unknown material setting');
  const r={...MATERIAL_DEFAULTS,...input};
  if(!Object.hasOwn(MATERIAL_RECIPES,r.id)||!Number.isInteger(r.seed)||r.seed<0||r.seed>0xffffffff||![64,128,256,512].includes(r.size)||!Object.hasOwn(MATERIAL_PALETTES,r.palette))throw Error('Invalid material identity, seed, size or palette');
  for(const [key,min,max]of [['strataScale',1,8],['fracture',0,1],['relief',0,1],['roughness',.05,1]])if(!Number.isFinite(r[key])||r[key]<min||r[key]>max)throw Error('Invalid material '+key);
  return r;
}
/** Periodic continuous structure, evaluated before color quantization. */
function sample(r,u,v){
  u=wrap(u,1);v=wrap(v,1);
  if(r.id==='hd2d-cliff-strata')return strata(r,u,v);
  const bands=Math.round(r.strataScale),warp=(noise(u,v,4,r.seed+11)-.5)*.14;
  const py=(v+warp)*bands,px=(u+(noise(u,v,4,r.seed+21)-.5)*.08)*4;
  const ix=Math.floor(px),iy=Math.floor(py);let first=Infinity,second=Infinity,owner=0;
  // Flattened, jittered rock masses; no independent square cell outlines.
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
    const x=ix+i,y=iy+j,key=hash(wrap(x,4),wrap(y,bands),r.seed),dx=px-x-(.08+key*.84),dy=py-y-(.08+hash(wrap(x,4),wrap(y,bands),r.seed+71)*.84),d=dx*dx+dy*dy;
    if(d<first){second=first;first=d;owner=key;}else if(d<second)second=d;
  }
  const mass=noise(u,v,8,r.seed+49),fy=wrap(v+warp,1)*bands%1;
  const edge=1-smooth(clamp((Math.sqrt(second)-Math.sqrt(first))/.12));
  const seam=1-smooth(clamp(Math.min(fy,1-fy)/.045));
  const joint=clamp(edge*r.fracture+seam*.3*smooth(clamp((mass-.3)*3)));
  const broad=noise(u,v,2,r.seed+79),soil=clamp((.45-owner)*2.6);
  const height=clamp(.5+r.relief*((owner-.5)*.26+(mass-.5)*.13+Math.sin(fy*Math.PI)*.08-joint*.29));
  return {height,joint,soil,pigment:clamp(.36+owner*.4+(broad-.5)*.22+(mass-.5)*.1-joint*.15)};
}
// Continuous periodic bedding, interrupted joints and broad pigment masses.
// No illumination is baked into pigment; normals derive from the same relief.
function strata(r,u,v){
  const bands=Math.round(r.strataScale),warp=(noise(u,v,2,r.seed+17)-.5)*.15+(noise(u,v,8,r.seed+27)-.5)*.022;
  const layer=(v+warp)*bands,row=Math.floor(layer),f=wrap(layer,1),rowKey=wrap(row,bands);
  const edge=Math.min(f,1-f),seam=(1-smooth(clamp(edge/.095)))*(.3+.7*noise(u,v,4,r.seed+41));
  const drift=noise(u,v,4,r.seed+61),x=u*3+(noise(u,v,2,r.seed+73)-.5)*.4+hash(0,rowKey,r.seed)*.8;
  const jointDistance=Math.abs(wrap(x,1)-.5),fracture=(1-smooth(clamp(jointDistance/.052)))*smooth(clamp((drift-.36)*4))*r.fracture;
  const broad=noise(u,v,2,r.seed+89),mass=noise(u,v,8,r.seed+101),grain=noise(u,v,32,r.seed+107);
  const joint=clamp(seam*.65+fracture*.7),soil=clamp(.8-broad);
  const shelf=smooth(clamp(f/.2))*(1-smooth(clamp((f-.7)/.3)));
  const height=clamp(.5+r.relief*((broad-.5)*.19+(mass-.5)*.07+shelf*.075-joint*.13+(grain-.5)*.012));
  const pigment=clamp(.4+(broad-.5)*.4+(mass-.5)*.1+(grain-.5)*.018+(.5-hash(1,rowKey,r.seed+113))*.13-joint*.08);
  return {height,joint,soil,pigment};
}
// Periodic jittered blade clusters: directions vary locally, without coherent rows.
function grassClusters(u,v,seed){
  const x=u*10,y=v*10,ix=Math.floor(x),iy=Math.floor(y);let blade=0;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++) {
    const cx=ix+i,cy=iy+j,keyX=wrap(cx,10),keyY=wrap(cy,10),
      dx=x-cx-(.15+hash(keyX,keyY,seed+233)*.7),dy=y-cy-(.15+hash(keyX,keyY,seed+239)*.7),
      angle=hash(keyX,keyY,seed+241)*Math.PI*2,a=dx*Math.cos(angle)+dy*Math.sin(angle),b=-dx*Math.sin(angle)+dy*Math.cos(angle);
    blade=Math.max(blade,1-smooth(clamp(Math.abs(a)/.075+Math.abs(b)/.3)));
  }
  return blade;
}
function surfaceFamily(r,u,v){
  const seed=r.seed,grain=noise(u,v,24,seed+101),broad=noise(u,v,4,seed+113),fine=noise(u,v,48,seed+127),warp=noise(u,v,6,seed+139)-.5;
  const row=wrap(Math.floor((v+warp*.035)*Math.round(r.strataScale)),Math.round(r.strataScale)),rowF=wrap((v+warp*.035)*Math.round(r.strataScale),1);
  const cellU=u*5+(noise(u,v,4,seed+151)-.5)*.22,cellV=v*5+(noise(u,v,4,seed+163)-.5)*.22,ix=Math.floor(cellU),iy=Math.floor(cellV);
  let first=Infinity,second=Infinity,owner=0;
  for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
    const cx=ix+x,cy=iy+y,key=hash(wrap(cx,5),wrap(cy,5),seed+173),dx=cellU-cx-(.14+key*.72),dy=cellV-cy-(.14+hash(wrap(cx,5),wrap(cy,5),seed+179)*.72),d=dx*dx+dy*dy;
    if(d<first){second=first;first=d;owner=key;}else if(d<second)second=d;
  }
  const cellEdge=1-smooth(clamp((Math.sqrt(second)-Math.sqrt(first))/.095));
  const roughField=clamp(grain*.38+broad*.42+fine*.2),phase=wrap(u*3+v*2,1);
  let height,pigment,soil,joint=0;
  switch(r.family){
    case 'grass': {const blade=grassClusters(u,v,seed),tuft=noise(u,v,8,seed+181);height=clamp(.5+(blade*.07+(tuft-.5)*.13+(grain-.5)*.018)*r.relief);pigment=clamp(.24+tuft*.52+blade*.13+(fine-.5)*.03);soil=clamp((.58-tuft)*1.6);break;}
    case 'dirt': {const crack=1-smooth(clamp(Math.min(rowF,1-rowF)/.08)),clump=noise(u,v,8,seed+191);height=clamp(.5+((clump-.5)*.22-(1-crack)*r.fracture*.08)*r.relief);pigment=clamp(.22+clump*.48+grain*.22-crack*.12);soil=clamp(.2+broad*.72);break;}
    case 'moss': {const patch=noise(u,v,7,seed+193),soft=noise(u,v,14,seed+197);height=clamp(.5+((patch-.5)*.22+(soft-.5)*.08)*r.relief);pigment=clamp(.25+patch*.55+soft*.16);soil=clamp(.68-patch*.35);break;}
    case 'cliff': {({height,pigment,soil,joint}=strata(r,u,v));break;}
    case 'stone': {joint=clamp(cellEdge*r.fracture);height=clamp(.5+((owner-.5)*.2+(roughField-.5)*.11-cellEdge*r.fracture*.13)*r.relief);pigment=clamp(.2+owner*.44+roughField*.25-cellEdge*.12);soil=clamp((.46-owner)*1.8);break;}
    case 'cobble': {joint=clamp(cellEdge*r.fracture);const rounded=smooth(clamp((Math.sqrt(second)-Math.sqrt(first))/.18));height=clamp(.5+((1-cellEdge)*.22+(rounded-.5)*.06)*r.relief);pigment=clamp(.25+owner*.4+roughField*.24-cellEdge*.13);soil=clamp(.2+cellEdge*.7);break;}
    case 'bark': {const groove=1-smooth(clamp(Math.abs(wrap(u*8+warp*.35,1)-.5)/.17)),curl=noise(u,v,10,seed+211);height=clamp(.5+(groove*.16+(curl-.5)*.12)*r.relief);pigment=clamp(.2+groove*.34+curl*.3+grain*.13);soil=clamp(.18+groove*.45);break;}
    case 'timber': {const ring=noise(u,v,5,seed+223),grainLine=1-smooth(clamp(Math.abs(wrap(v*11+warp*.12,1)-.5)/.14));height=clamp(.5+((ring-.5)*.1+grainLine*.1+fine*.04)*r.relief);pigment=clamp(.22+ring*.4+grainLine*.18+fine*.18);soil=clamp(.12+grainLine*.45);break;}
    case 'plaster': {const trowel=noise(u,v,9,seed+227),patch=noise(u,v,3,seed+229);height=clamp(.5+((trowel-.5)*.1+(patch-.5)*.16)*r.relief);pigment=clamp(.25+patch*.38+trowel*.25+fine*.08);soil=clamp(.18+(1-patch)*.5);break;}
    case 'roof': {const shingle=1-smooth(clamp(Math.min(rowF,1-rowF)/.07)),offset=1-smooth(clamp(Math.abs(wrap(u*4+(row%2)*.5,1)-.5)/.06));height=clamp(.5+((1-shingle)*.16+offset*.09+(broad-.5)*.08)*r.relief);pigment=clamp(.22+broad*.32+roughField*.28-shingle*.12-offset*.08);soil=clamp(.2+shingle*.5);break;}
  }
  return {height,joint,pigment,soil,roughness:roughField,phase};
}
export function sampleSurfaceStructure(input,u,v){const recipe=validateMaterialRecipe(input);if(recipe.id!=='style-surface')throw Error('Surface structure requires style-surface recipe');return surfaceFamily(recipe,wrap(u,1),wrap(v,1));}
export function sampleCliffStructure(input,u,v){return sample(validateMaterialRecipe(input),u,v);}
export function generateMaterial(input={}){
  if(input?.id==='realistic-surface')return generateRealisticMaterial(input);
  const recipe=validateMaterialRecipe(input),{size}=recipe,n=size*size,heights=new Float32Array(n),fields=new Array(n),surface=recipe.id==='style-surface';
  const palette=(surface?SURFACE_COLORS[recipe.family]:MATERIAL_PALETTES[recipe.palette]).map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
  const channels=Object.fromEntries(['albedo','height','normal','roughness'].map(k=>[k,{width:size,height:size,data:new Uint8Array(n*4)}]));
  // Sample at texel centers; opposite border texels need not be artificially equal.
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const at=y*size+x,u=(x+.5)/size,v=(y+.5)/size,s=surface?surfaceFamily(recipe,u,v):sample(recipe,u,v),profile=surface?SURFACE_STYLES[recipe.style]:null;heights[at]=surface?clamp(.5+(s.height-.5)*profile.relief):s.height;fields[at]=s;}
  const h=(x,y)=>heights[wrap(y,size)*size+wrap(x,size)];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const at=y*size+x,offset=at*4,s=fields[at],profile=surface?SURFACE_STYLES[recipe.style]:null,pigment=surface?clamp(Math.round(s.pigment*(profile.levels-1))/(profile.levels-1)):s.pigment;
    let color=palette[Math.min(palette.length-1,Math.floor(pigment*palette.length))];
    if(surface&&['pbr','soft-cartoon'].includes(recipe.style)) {
      const position=s.pigment*(palette.length-1),index=Math.floor(position),fraction=position-index;
      color=palette[index].map((value,i)=>mix(value,palette[Math.min(index+1,palette.length-1)][i],fraction));
    }
    if(surface){const shift=SURFACE_PALETTE_SHIFT[recipe.palette],edge=clamp(s.joint*profile.edge),factor=1-edge; color=color.map(value=>Math.round(clamp((value/255+shift[0])*(1+shift[1])*profile.saturation+shift[2],0,1)*255*factor));}
    channels.albedo.data.set([...color,255],offset);
    const height=Math.round(heights[at]*255);channels.height.data.set([height,height,height,255],offset);
    // +Y tangent normal; texture v grows upward in the receiving UV convention.
    const dx=(h(x+1,y)-h(x-1,y))*size*.08,dy=(h(x,y+1)-h(x,y-1))*size*.08,length=Math.hypot(dx,dy,1);
    channels.normal.data.set([Math.round((-.5*dx/length+.5)*255),Math.round((-.5*dy/length+.5)*255),Math.round((.5/length+.5)*255),255],offset);
    const roughness=Math.round(clamp(recipe.roughness+s.soil*.09+(surface?s.roughness*.025:s.joint*.06)-.045)*255);channels.roughness.data.set([roughness,roughness,roughness,255],offset);
  }
  return {recipe,channels,heights};
}
export const MATERIAL_CHANNELS = Object.freeze({albedo:{colorSpace:'srgb',semantic:'unlit pigment'},height:{colorSpace:'linear',semantic:'surface height; authoring only'},normal:{colorSpace:'linear',semantic:'tangent-space +Y'},roughness:{colorSpace:'linear',semantic:'roughness repeated in RGB'}});
export function materialContactSheet(variants){
  const size=variants[0].recipe.size;if(variants.some(v=>v.recipe.size!==size))throw Error('Contact sheet sizes differ');
  const width=size*4,height=size*variants.length,data=new Uint8Array(width*height*4);
  for(let row=0;row<variants.length;row++)for(const [column,key]of ['albedo','height','normal','roughness'].entries())for(let y=0;y<size;y++)data.set(variants[row].channels[key].data.subarray(y*size*4,(y+1)*size*4),((row*size+y)*width+column*size)*4);
  return {width,height,data};
}
