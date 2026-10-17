/** Original continuous material fields. No photographs, purchased pixels or baked light. */
export const REALISTIC_SURFACE_FAMILIES = Object.freeze(['soil','gravel','limestone','concrete','bark','timber']);
export const REALISTIC_DEFAULTS = Object.freeze({id:'realistic-surface',family:'soil',seed:1204,size:512,palette:'earth',strataScale:4,fracture:.28,relief:.55,roughness:.84});
export const REALISTIC_SURFACE_PRESETS = Object.freeze([
  {label:'Loamy soil',recipe:{...REALISTIC_DEFAULTS,family:'soil',relief:.42,roughness:.96}},
  {label:'Mixed gravel',recipe:{...REALISTIC_DEFAULTS,family:'gravel',relief:.65,roughness:.8}},
  {label:'Weathered limestone',recipe:{...REALISTIC_DEFAULTS,family:'limestone',fracture:.4,relief:.38,roughness:.82}},
  {label:'Poured concrete',recipe:{...REALISTIC_DEFAULTS,family:'concrete',fracture:.12,relief:.24,roughness:.9}},
  {label:'Oak bark',recipe:{...REALISTIC_DEFAULTS,family:'bark',fracture:.48,relief:.7,roughness:.92}},
  {label:'Weathered timber',recipe:{...REALISTIC_DEFAULTS,family:'timber',fracture:.2,relief:.25,roughness:.86}},
]);
/** @typedef {{id:'realistic-surface',family:string,seed:number,size:number,palette:string,strataScale:number,fracture:number,relief:number,roughness:number}} RealisticRecipe */
/** @typedef {{height:number,roughness:number,color:number[]}} SurfaceField */
/** @param {number} n @param {number} [lo] @param {number} [hi] */
const clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
/** @param {number} n @param {number} period */
const wrap=(n,period)=>(n%period+period)%period;
/** @param {number} t */
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
/** @param {number} a @param {number} b @param {number} t */
const mix=(a,b,t)=>a+(b-a)*t;
/** @param {number} x @param {number} y @param {number} seed */
function hash(x,y,seed){let h=Math.imul(x,0x9e3779b1)^Math.imul(y,0x85ebca77)^seed;h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return ((h^(h>>>16))>>>0)/4294967296;}
/** Periodic anisotropic value noise; every lattice is integral at the wrap.
 * @param {number} u @param {number} v @param {number} nx @param {number} ny @param {number} seed */
function noise(u,v,nx,ny,seed){
  const x=u*nx,y=v*ny,ix=Math.floor(x),iy=Math.floor(y),a=smooth(x-ix),b=smooth(y-iy);
  const x0=wrap(ix,nx),x1=wrap(ix+1,nx),y0=wrap(iy,ny),y1=wrap(iy+1,ny);
  return mix(mix(hash(x0,y0,seed),hash(x1,y0,seed),a),mix(hash(x0,y1,seed),hash(x1,y1,seed),a),b);
}
/** Jittered periodic mineral/plate geometry, not repeated image stamps.
 * @param {number} u @param {number} v @param {number} nx @param {number} ny @param {number} seed */
function cells(u,v,nx,ny,seed){
  const px=u*nx,py=v*ny,ix=Math.floor(px),iy=Math.floor(py);let first=Infinity,second=Infinity,owner=0,offsetX=0,offsetY=0;
  for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
    const cx=ix+x,cy=iy+y,kx=wrap(cx,nx),ky=wrap(cy,ny),key=hash(kx,ky,seed);
    const dx=px-cx-(.08+key*.84),dy=py-cy-(.08+hash(kx,ky,seed+61)*.84),distance=dx*dx+dy*dy;
    if(distance<first){second=first;first=distance;owner=key;offsetX=dx;offsetY=dy;}else if(distance<second)second=distance;
  }
  return {edge:Math.sqrt(second)-Math.sqrt(first),distance:Math.sqrt(first),owner,offsetX,offsetY};
}
/** @param {unknown} input @returns {RealisticRecipe} */
export function validateRealisticRecipe(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected a realistic material recipe');
  if(Object.keys(input).some(k=>!Object.hasOwn(REALISTIC_DEFAULTS,k)))throw Error('Unknown realistic material setting');
  const r={...REALISTIC_DEFAULTS,...input};
  if(r.id!=='realistic-surface'||!REALISTIC_SURFACE_FAMILIES.includes(r.family)||!Number.isInteger(r.seed)||r.seed<0||r.seed>0xffffffff||![64,128,256,512].includes(r.size)||!['earth','slate','ochre'].includes(r.palette))throw Error('Invalid realistic material family, seed, size or palette');
  for(const [key,min,max]of /** @type {[keyof RealisticRecipe,number,number][]} */ ([['strataScale',1,8],['fracture',0,1],['relief',0,1],['roughness',.05,1]]))if(typeof r[key]!=='number'||!Number.isFinite(r[key])||r[key]<min||r[key]>max)throw Error('Invalid realistic material '+key);
  return /** @type {RealisticRecipe} */ (r);
}
/** @param {RealisticRecipe} r @param {number} u @param {number} v @returns {SurfaceField} */
function field(r,u,v){
  const s=r.seed,scale=Math.round(r.strataScale),broad=noise(u,v,4,4,s+11),stain=noise(u,v,9,9,s+17);
  // Domain warping is periodic and irregular; detail stays tied to one surface field.
  const wu=u+(noise(u,v,6,6,s+23)-.5)*.055,wv=v+(noise(u,v,6,6,s+29)-.5)*.055;
  const grain=noise(wu,wv,96,96,s+31)-.5,micro=noise(wu,wv,192,192,s+37)-.5;
  let height=.5,roughness=0,color=[0,0,0];
  switch(r.family){
    case 'soil': {
      const clods=noise(wu,wv,scale*8,scale*8,s+43),fine=noise(wu,wv,64,64,s+47),pore=smooth((noise(wu,wv,128,128,s+53)-.66)*7);
      const compaction=smooth((noise(u,v,6,6,s+57)-.52)*3),fleck=smooth((fine-.63)*6),tone=(broad-.5)*17+(stain-.5)*12+grain*(26-compaction*9)+micro*12-pore*11-compaction*7;
      color=[109+tone+fleck*13,82+tone*.83+fleck*11,56+tone*.64+fleck*8];
      height=.5+(clods-.5)*(.12-compaction*.06)+grain*.026+micro*.012-pore*(.025+r.fracture*.09);
      roughness=(fine-.5)*.06+fleck*.015-pore*.02-compaction*.045;break;
    }
    case 'gravel': {
      const stone=cells(wu,wv,18+scale*3,18+scale*3,s+59),angle=stone.owner*Math.PI*2;
      const dx=stone.offsetX*Math.cos(angle)-stone.offsetY*Math.sin(angle),dy=stone.offsetX*Math.sin(angle)+stone.offsetY*Math.cos(angle);
      const radius=.29+stone.owner*.59,contour=Math.hypot(dx/(.73+stone.owner*.38),dy/(.86-stone.owner*.19));
      const irregular=Math.sin(Math.atan2(dy,dx)*3+angle)*.025+Math.sin(Math.atan2(dy,dx)*5-angle)*.015;
      const density=smooth((noise(u,v,7,7,s+63)-.19)*4),body=smooth(stone.edge/.04)*smooth((radius+irregular-contour)/.13)*density;
      const mineral=noise(wu,wv,128,128,s+67),fines=noise(wu,wv,160,160,s+69),tone=(stone.owner-.5)*31+(broad-.5)*16+grain*21+micro*12;
      const warm=stone.owner<.34?1:0,cool=stone.owner>.72?1:0;
      const stoneColor=[134+tone+warm*9-cool*6,130+tone+warm*3,122+tone-warm*7+cool*10];
      color=stoneColor.map((c,i)=>mix([108,104,94][i]+grain*17+micro*12+(fines-.5)*18+(stain-.5)*12,c+mineral*7,body));
      height=.38+body*.12+(1-smooth(contour/(radius+.1)))*body*.08+grain*.013+(1-body)*(fines-.5)*.035-(1-body)*r.fracture*.05;
      roughness=(1-body)*.06+(mineral-.5)*.08;break;
    }
    case 'limestone': {
      const fracture=cells(wu,wv,3+scale,3+scale,s+71),deposit=noise(wu,wv,17,17,s+75);
      const crack=(1-smooth(fracture.edge/(.022+deposit*.047)))*smooth((deposit-.18)*4)*r.fracture;
      const mineral=noise(wu,wv,48,48,s+73),pore=smooth((noise(wu,wv,128,128,s+79)-.7)*8);
      const vein=smooth((noise(wu,wv,24,24,s+83)-.59)*6),tone=(broad-.5)*26+(stain-.5)*18+grain*10+micro*7-crack*27-pore*12;
      color=[174+tone+vein*12+(deposit-.5)*7,167+tone+vein*11,150+tone+vein*10-(deposit-.5)*5];
      height=.5+(stain-.5)*.07+(mineral-.5)*.025+micro*.01-crack*.07-pore*.022;
      roughness=(mineral-.5)*.08+pore*.03-crack*.025;break;
    }
    case 'concrete': {
      const aggregate=noise(wu,wv,64,64,s+89),pore=smooth((noise(wu,wv,128,128,s+97)-.78)*9),mineral=smooth((aggregate-.73)*8);
      const trowel=noise(u,v,8,5,s+101),tone=(broad-.5)*18+(trowel-.5)*12+grain*12+micro*9-pore*23+mineral*8;
      color=[151+tone+(stain-.5)*5,149+tone,142+tone-(stain-.5)*4];
      height=.5+(trowel-.5)*.055+grain*.016+micro*.008-pore*(.035+r.fracture*.035)+mineral*.013;
      roughness=(aggregate-.5)*.065+pore*.04;break;
    }
    case 'bark': {
      const bx=u+(noise(u,v,10,6,s+102)-.5)*.023+(noise(u,v,64,48,s+104)-.5)*.012;
      const by=wv+(noise(u,v,40,28,s+106)-.5)*.022;
      const plate=cells(bx,by,12+scale*3,5,s+103),fiber=noise(wu,wv,128,18,s+107);
      const flake=noise(wu,wv,64,32,s+109),groove=(1-smooth(plate.edge/(.035+flake*.05)));
      const fissure=(1-smooth(cells(wu,wv,44,12,s+111).edge/.022))*smooth((noise(wu,wv,24,8,s+112)-.5)*5);
      const tone=(plate.owner-.5)*12+(broad-.5)*15+(stain-.5)*12+(fiber-.5)*18+grain*22+micro*13-groove*(10+r.fracture*18)-fissure*9;
      color=[99+tone+flake*8,89+tone*.9+flake*5,77+tone*.8+flake*3];
      height=.5+(plate.owner-.5)*.03+(fiber-.5)*.035+(flake-.5)*.025+micro*.01-groove*(.04+r.fracture*.14)-fissure*.04;
      roughness=groove*.04+(flake-.5)*.065;break;
    }
    case 'timber': {
      const drift=(noise(u,v,6,3,s+113)-.5)*.031+(noise(u,v,14,5,s+127)-.5)*.005;
      let bend=0,knot=0;
      for(let k=0;k<2;k++){
        const dx=wrap(u-hash(k,0,s+131)+.5,1)-.5,dy=wrap(v-hash(k,1,s+137)+.5,1)-.5;
        const radius=Math.hypot(dx/.11,dy/.19),influence=Math.exp(-radius*radius*2);
        bend+=dx*influence*.8;knot+=influence*(.6+.4*Math.cos(radius*23));
      }
      const growth=noise(u+drift+bend,v,14+scale*2,2,s+135),fiber=noise(u+drift,v,192,8,s+139);
      const line=smooth((noise(u+drift+bend,v,48+scale*4,3,s+141)-.49)*3),split=smooth((noise(u+drift,v,96,8,s+149)-.77)*8)*r.fracture;
      const tone=(broad-.5)*16+(stain-.5)*10+(growth-.5)*19+(fiber-.5)*20-line*(7+stain*8)-knot*17-split*17+micro*7;
      color=[149+tone+(stain-.5)*7,126+tone*.87+(fiber-.5)*3,94+tone*.7+(stain-.5)*10+micro*3];
      height=.5+(fiber-.5)*.025-line*.025-knot*.035-split*.045+micro*.005;
      roughness=(fiber-.5)*.06+split*.025;break;
    }
    default: throw Error('Unknown realistic material family');
  }
  // Palette moods affect pigment only; they do not change surface geometry.
  const tint=r.palette==='slate'?[-9,0,9]:r.palette==='ochre'?[10,3,-8]:[0,0,0];
  color=color.map((c,i)=>clamp(c+tint[i],0,255));
  return {height:clamp(.5+(height-.5)*r.relief),roughness:clamp(r.roughness+roughness,.05,1),color};
}
/** @param {unknown} input @param {number} u @param {number} v */
export function sampleRealisticStructure(input,u,v){
  if(!Number.isFinite(u)||!Number.isFinite(v))throw Error('Realistic sample coordinates must be finite');
  return field(validateRealisticRecipe(input),wrap(u,1),wrap(v,1));
}
/** @param {unknown} input */
export function generateRealisticMaterial(input){
  const recipe=validateRealisticRecipe(input),size=recipe.size,count=size*size,heights=new Float32Array(count);
  const channels=Object.fromEntries(['albedo','height','normal','roughness'].map(k=>[k,{width:size,height:size,data:new Uint8Array(count*4)}]));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const at=x+y*size,p=at*4,f=field(recipe,(x+.5)/size,(y+.5)/size);heights[at]=f.height;
    channels.albedo.data.set([Math.round(f.color[0]),Math.round(f.color[1]),Math.round(f.color[2]),255],p);
    const h=Math.round(f.height*255),r=Math.round(f.roughness*255);
    channels.height.data.set([h,h,h,255],p);channels.roughness.data.set([r,r,r,255],p);
  }
  /** @param {number} x @param {number} y */
  const height=(x,y)=>heights[wrap(x,size)+wrap(y,size)*size];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(height(x+1,y)-height(x-1,y))*size*.08,dy=(height(x,y+1)-height(x,y-1))*size*.08,length=Math.hypot(dx,dy,1),p=(x+y*size)*4;
    channels.normal.data.set([Math.round((-.5*dx/length+.5)*255),Math.round((-.5*dy/length+.5)*255),Math.round((.5/length+.5)*255),255],p);
  }
  return {recipe,channels,heights};
}

/** Neutral authoring light, applied only in the preview. Exported pigment stays unlit.
 * @param {Record<string,{width:number,height:number,data:Uint8Array}>} channels */
export function shadeRealisticPreview(channels){
  const {albedo,normal,roughness}=channels,result={width:albedo.width,height:albedo.height,data:new Uint8Array(albedo.data.length)};
  for(let p=0;p<result.data.length;p+=4){
    const nx=normal.data[p]/255*2-1,ny=normal.data[p+1]/255*2-1,nz=normal.data[p+2]/255*2-1;
    const diffuse=Math.max(0,nx*-.4+ny*-.5+nz*.7681146),r=roughness.data[p]/255;
    const half=Math.max(0,nx*-.213+ny*-.266+nz*.940),specular=Math.pow(half,8+(1-r)*120)*(1-r)*.18;
    for(let c=0;c<3;c++)result.data[p+c]=Math.round(Math.pow(clamp(Math.pow(albedo.data[p+c]/255,2.2)*(.34+diffuse*.76)+specular),1/2.2)*255);
    result.data[p+3]=255;
  }
  return result;
}
