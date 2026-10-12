import {useEffect,useMemo,useRef,useState} from 'react';
import {generateMaterial,validateMaterialRecipe,MATERIAL_DEFAULTS,MATERIAL_PALETTES,MATERIAL_RECIPES,STYLE_SURFACE_FAMILIES,MATERIAL_STYLES,STYLE_SURFACE_SIZES,type MaterialRecipe,type MaterialPixels} from '@/shader/material.mjs';
import {materialBrowserFiles,paintMaterialCanvas} from '@/shader/material-browser.mjs';
import {zipStore} from '@/shader/zip-store';
export type MaterialPreview={pixels:MaterialPixels;repeat:number;channel:string;label:string};
export function MaterialPanel({onPreview,active,open,onOpenChange}:{onPreview:(preview:MaterialPreview|null)=>void;active:boolean;open?:boolean;onOpenChange?:(open:boolean)=>void}){
  const [recipe,setRecipe]=useState<MaterialRecipe>({...MATERIAL_DEFAULTS}),[ready,setReady]=useState(false);
  const [channel,setChannel]=useState('albedo'),[repeat,setRepeat]=useState(2),[status,setStatus]=useState('Original candidate — visual approval pending'),[busy,setBusy]=useState(false),canvas=useRef<HTMLCanvasElement>(null);
  const disclosure=useRef<HTMLDetailsElement>(null);
  const editRevision=useRef(0);
  const label=recipe.id==='style-surface'?`${recipe.style} ${recipe.family}`:recipe.id==='hd2d-cliff-strata'?'Stratified cliff':'HD-2D cliff';
  useEffect(()=>{if(!active&&disclosure.current)disclosure.current.open=false;},[active]);
  const result=useMemo(()=>{try{return {material:generateMaterial(recipe),error:null};}catch(e){return {material:null,error:e instanceof Error?e.message:'Invalid material'};}},[recipe]);
  useEffect(()=>{if(result.material&&canvas.current)paintMaterialCanvas(canvas.current,result.material.channels[channel]!,repeat);},[result,channel,repeat]);
  useEffect(()=>{if(disclosure.current?.open&&result.material)onPreview({pixels:result.material.channels[channel]!,repeat,channel,label});},[result,channel,repeat,onPreview,label,open]);
  useEffect(()=>{try{const raw=localStorage.getItem('cliff-material-v1');if(raw){const draft=validateMaterialRecipe(JSON.parse(raw));setRecipe(draft);setStatus(localStorage.getItem('cliff-material-export-v1')===JSON.stringify(draft)?'Exported material draft — artwork remains unapproved':'Unsaved material changes — recovered local draft');}}catch{setStatus('Saved material draft could not be loaded');}setReady(true);},[]);
  useEffect(()=>{if(ready&&result.material){try{localStorage.setItem('cliff-material-v1',JSON.stringify(recipe));}catch{setStatus('Material draft could not be saved locally');}}},[recipe,result,ready]);
  const patch=(next:Partial<MaterialRecipe>)=>{editRevision.current++;setRecipe(r=>({...r,...next} as MaterialRecipe));setStatus('Unsaved material changes');};
  const changeRecipe=(id:MaterialRecipe['id'])=>{editRevision.current++;const defaults=validateMaterialRecipe(id==='style-surface'?{id,family:'grass',style:'hd2d'}:{id});setRecipe({...defaults,seed:recipe.seed,palette:recipe.palette} as MaterialRecipe);setStatus('Unsaved material changes');};
  const save=async()=>{const savedRevision=editRevision.current;setBusy(true);try{const files=await materialBrowserFiles(recipe),url=URL.createObjectURL(zipStore(files)),a=document.createElement('a');a.href=url;a.download=recipe.id+'-s'+recipe.seed+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);localStorage.setItem('cliff-material-export-v1',JSON.stringify(recipe));setStatus(savedRevision===editRevision.current?'Material channels and recipe saved — artwork remains unapproved':'Unsaved material changes — the previous recipe was exported');}catch(e){setStatus(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);}};
  return <details ref={disclosure} className="material-panel" open={open} onToggle={e=>{onOpenChange?.(e.currentTarget.open);onPreview(e.currentTarget.open&&result.material?{pixels:result.material.channels[channel]!,repeat,channel,label}:null);}}><summary>Material channels · {label}</summary>
    <p className="lede">Independent surface relief and pigment. No painted directional lighting.</p>
    <canvas ref={canvas} className="pixelated" style={{width:'100%',maxWidth:384,aspectRatio:'1'}} aria-label="Material channel preview" />
    <div className="fields">
      <label className="field">Recipe<select aria-label="Material recipe" value={recipe.id} onChange={e=>changeRecipe(e.target.value as MaterialRecipe['id'])}>{Object.entries(MATERIAL_RECIPES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      {recipe.id==='style-surface'&&<>
        <label className="field">Surface family<select aria-label="Material family" value={recipe.family} onChange={e=>patch({family:e.target.value as typeof recipe.family})}>{STYLE_SURFACE_FAMILIES.map(family=><option key={family}>{family}</option>)}</select></label>
        <label className="field">Appearance style<select aria-label="Material style" value={recipe.style} onChange={e=>{const style=e.target.value as typeof recipe.style;patch({style,size:STYLE_SURFACE_SIZES[style]});}}>{MATERIAL_STYLES.map(style=><option key={style}>{style}</option>)}</select></label>
      </>}
      <label className="field">Texture size<select aria-label="Material size" value={recipe.size} onChange={e=>patch({size:Number(e.target.value)})}>{[64,128,256,512].map(size=><option key={size}>{size}</option>)}</select></label>
      <label className="field">Channel<select aria-label="Material channel" value={channel} onChange={e=>setChannel(e.target.value)}>{['albedo','height','normal','roughness'].map(k=><option key={k}>{k}</option>)}</select></label>
      <label className="field">Repeat<select value={repeat} onChange={e=>setRepeat(Number(e.target.value))}>{[1,2,4].map(n=><option key={n}>{n}</option>)}</select></label>
      <label className="field">Material seed<input aria-label="Material seed" type="number" min={0} max={4294967295} value={recipe.seed} onChange={e=>patch({seed:Number(e.target.value)})}/></label>
      <label className="field">Material palette<select aria-label="Material palette" value={recipe.palette} onChange={e=>patch({palette:e.target.value})}>{Object.keys(MATERIAL_PALETTES).map(k=><option key={k}>{k}</option>)}</select></label>
      {(['strataScale','fracture','relief','roughness'] as const).map(k=><label className="field" key={k}>{{strataScale:'Strata',fracture:'Fractures',relief:'Relief',roughness:'Roughness'}[k]}<input aria-label={'Material '+k} type="range" min={k==='strataScale'?1:k==='roughness'?.05:0} max={k==='strataScale'?8:1} step={k==='strataScale'?1:.01} value={recipe[k]} onChange={e=>patch({[k]:Number(e.target.value)})}/><output>{recipe[k]}</output></label>)}
    </div>
    <button type="button" className="primary" onClick={()=>void save()} disabled={busy||!!result.error}>{busy?'Baking…':'Save material channels'}</button>
    <p className="drawer-status" role={result.error?'alert':'status'}>{result.error??status}</p>
  </details>;
}
