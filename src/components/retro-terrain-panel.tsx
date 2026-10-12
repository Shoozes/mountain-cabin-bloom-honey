import {useEffect, useMemo, useRef, useState} from 'react';
import {composeRetroTerrain,type RetroPixels} from '@/shader/retro-terrain.mjs';
import {generateTerrainKit, composeRetroGrowth, composeRetroSurfaceVariants, validateTerrainKitRecipe, TERRAIN_SAMPLE, PATH_SAMPLE, type TerrainKitRecipe, type RetroPaletteId} from '@/shader/retro-terrain-growth.mjs';
import {generateCuratedTerrain,validateCuratedRecipe,composeCuratedTerrain,composeCuratedSurface,type CuratedRecipe,type CuratedPalette} from '@/shader/retro-terrain-curated.mjs';
import {retroTerrainBrowserFiles} from '@/shader/retro-terrain-browser.mjs';
import {paintMaterialCanvas} from '@/shader/material-browser.mjs';
import {zipStore} from '@/shader/zip-store';
import type {MaterialPreview} from './material-panel';

const KEY = 'retro-terrain-v1';
export function RetroTerrainPanel({open, onOpenChange, onPreview}: {
  open: boolean; onOpenChange: (open: boolean) => void; onPreview: (preview: MaterialPreview | null) => void;
}) {
  const [recipe, setRecipe] = useState<TerrainKitRecipe|CuratedRecipe>({id: 'retro-terrain-curated',tileSize:16, seed: 1204, palette:'woodland'});
  const [view, setView] = useState('dirt-0'), [repeat, setRepeat] = useState(1);
  const [composition,setComposition]=useState<'mixed'|0|1|2>('mixed');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Original retro color — visual approval pending');
  const canvas = useRef<HTMLCanvasElement>(null), revision = useRef(0), exportRun = useRef<AbortController | null>(null);
  const previewViewport = useRef<HTMLDivElement>(null);
  const downloads = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const generated = useMemo(() => {
    try {
      return {kit:recipe.id==='retro-terrain-curated'?generateCuratedTerrain(recipe):generateTerrainKit(recipe),error:null};
    } catch (error) { return {kit: null, pixels: null, repeat: 1, error: error instanceof Error ? error.message : 'Invalid retro terrain recipe'}; }
  }, [recipe]);
  const result = useMemo(() => {
    const {kit,error}=generated;if(!kit)return {kit,pixels:null,repeat:1,error};
    const tile=kit.tiles.find(value=>value.id===view);
    if('templates' in kit) {
      const curatedTile=kit.tiles.find(value=>value.id===view);
      let pixels:RetroPixels|undefined=curatedTile??kit.atlases.find(t=>t.id===view)??kit.templates.find(t=>t.id===view);
      if(view==='patch'||view==='weathered-patch'||view==='gravel-patch')pixels=composeCuratedTerrain(kit,{composition,weathered:view==='weathered-patch',relationship:view==='gravel-patch'?'gravel-dirt':'grass-dirt'});
      else if(view.startsWith('mixed-'))pixels=composeCuratedSurface(kit,view.slice(6),{composition});
      if(curatedTile?.role==='path-overlay') {
        const data=kit.tiles.find(t=>t.id===(curatedTile.weathered?'weathered-':'')+'grass-0')!.data.slice();
        for(let at=0;at<data.length;at+=4)if(curatedTile.data[at+3])data.set(curatedTile.data.subarray(at,at+4),at);
        pixels={...curatedTile,data};
      }
      return {kit,pixels:pixels??kit.tiles[0],repeat:tile?.role==='surface'?repeat:1,error:null};
    }
    let pixels=view==='atlas'?kit.atlas:view==='patch'?composeRetroTerrain({recipe:{id:'retro-terrain',seed:kit.recipe.seed},tiles:kit.tiles.slice(0,19),atlas:kit.atlas},TERRAIN_SAMPLE as number[][]):tile;
    if('atlases' in kit) {
      if(view==='path-patch'||view==='weathered-patch')pixels=composeRetroGrowth(kit,TERRAIN_SAMPLE,PATH_SAMPLE,{weathered:view==='weathered-patch'});
      else if(view==='varied-path-patch'||view==='varied-weathered-patch')pixels=composeRetroGrowth(kit,TERRAIN_SAMPLE,PATH_SAMPLE,{variation:true,weathered:view==='varied-weathered-patch'});
      else if(view.startsWith('varied-'))pixels=composeRetroSurfaceVariants(kit,view.slice(7));
      else if(view.endsWith('-atlas'))pixels=kit.atlases.find(atlas=>atlas.id===view);
      else if(tile?.role==='path-overlay') {
        const growthTile=kit.tiles.find(value=>value.id===view)!;
        const background=kit.tiles.find(value=>value.id===((growthTile.variant==='weathered'?'weathered-':'')+'grass'))!;
        const data=background.data.slice();for(let at=0;at<data.length;at+=4)if(tile.data[at+3])data.set(tile.data.subarray(at,at+4),at);
        pixels={...tile,data};
      }
    }
    return {kit,pixels:pixels??kit.tiles[0],repeat:tile?.role==='surface'?repeat:1,error:null};
  },[generated,view,repeat,composition]);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) {const input=JSON.parse(raw),saved=input.id==='retro-terrain-curated'?validateCuratedRecipe(input):validateTerrainKitRecipe(input);setRecipe(saved);setView(saved.id==='retro-terrain-curated'?'dirt-0':'dirt'); setStatus('Recovered retro terrain draft — artwork remains unapproved');} }
    catch {setStatus('Saved retro terrain draft could not be loaded');}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && result.kit) try {localStorage.setItem(KEY, JSON.stringify(recipe));}
    catch {setStatus('Retro terrain draft could not be saved locally; export remains available');}
  }, [ready, recipe, result.kit]);
  useEffect(() => {
    if (!open) {exportRun.current?.abort(); return;}
    if (result.pixels && canvas.current) paintMaterialCanvas(canvas.current, result.pixels, result.repeat);
    onPreview(result.pixels ? {pixels: result.pixels, repeat: result.repeat, channel: 'color', label: 'Retro terrain · ' + (view === 'atlas' ? 'transition sheet' : view === 'patch' ? 'connected patch' : view)} : null);
  }, [open, result, view, onPreview]);
  const previewWidth = result.pixels ? result.pixels.width * result.repeat : 192;
  useEffect(() => {
    const viewport = previewViewport.current, target = canvas.current;
    if (!open || !viewport || !target) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const fit = Math.floor(viewport.clientWidth * dpr / previewWidth);
      const scale = Math.max(1, Math.min(fit, Math.floor(3 * dpr)));
      target.style.width = `${previewWidth * scale / dpr}px`;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(viewport); window.addEventListener('resize', resize); resize();
    return () => {observer.disconnect(); window.removeEventListener('resize', resize);};
  }, [open, previewWidth]);
  useEffect(() => () => {
    exportRun.current?.abort();
    for (const [url, timer] of downloads.current) {clearTimeout(timer); URL.revokeObjectURL(url);}
    downloads.current.clear();
  }, []);
  const save = async () => {
    const controller = new AbortController(), savedRevision = revision.current;
    exportRun.current = controller; setBusy(true);
    try {
      const files = await retroTerrainBrowserFiles(recipe, {signal: controller.signal});
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(zipStore(files)), anchor = document.createElement('a');
      const timer = setTimeout(() => {URL.revokeObjectURL(url); downloads.current.delete(url);}, 1000);
      downloads.current.set(url, timer); anchor.href = url; anchor.download = 'retro-terrain-s' + recipe.seed + '.zip'; anchor.click();
      setStatus(savedRevision === revision.current ? 'Retro terrain kit exported — artwork remains unapproved' : 'Unsaved changes — the previous terrain seed was exported');
    } catch (error) {setStatus(controller.signal.aborted ? 'Export cancelled; reopen to retry' : error instanceof Error ? error.message + '; retry export' : 'Export failed; retry');}
    finally {if (exportRun.current === controller) {exportRun.current = null; setBusy(false);}}
  };
  return <details className="retro-terrain-panel" open={open} onToggle={event => onOpenChange(event.currentTarget.open)}>
    <summary>Retro terrain · {recipe.id==='retro-terrain-curated'?recipe.tileSize:64} px</summary>
    <p className="lede">Native drawings, worn surfaces and earthen gravel paths. Compare compositions and connected terrain.</p>
    <div ref={previewViewport} className="retro-preview-viewport" tabIndex={0} role="region" aria-label="Retro terrain preview viewport">
      <canvas ref={canvas} className="pixelated retro-preview" style={{width: previewWidth}} aria-label="Retro terrain preview" />
    </div>
    <div className="fields">
      <label className="field">Kit<select aria-label="Terrain kit" value={recipe.id} onChange={event=>{revision.current++;const id=event.target.value;setRecipe(id==='retro-terrain'?{id:'retro-terrain',seed:recipe.seed}:id==='retro-terrain-growth'?{id:'retro-terrain-growth',seed:recipe.seed,palette:'heath'}:{id:'retro-terrain-curated',tileSize:16,seed:recipe.seed,palette:'woodland'});setView(id==='retro-terrain-curated'?'dirt-0':'dirt');setStatus('Unsaved retro terrain changes');}}>
        <option value="retro-terrain-curated">Curated edition</option><option value="retro-terrain-growth">Paths and weathering</option><option value="retro-terrain">Original tiles</option>
      </select></label>
      {recipe.id==='retro-terrain-curated'&&<>
        <label className="field">Native size<select aria-label="Terrain size" value={recipe.tileSize} onChange={event=>{revision.current++;setRecipe({...recipe,tileSize:Number(event.target.value) as 16|64});setView('dirt-0');setStatus('Unsaved retro terrain changes');}}><option value="16">16 × 16</option><option value="64">64 × 64</option></select></label>
        <label className="field">Palette<select aria-label="Terrain palette" value={recipe.palette} onChange={event=>{revision.current++;setRecipe({...recipe,palette:event.target.value as CuratedPalette});setStatus('Unsaved retro terrain changes');}}><option value="woodland">Woodland · moss, earth, stone</option><option value="dry-trail">Dry trail · ochre, clay, chalk</option><option value="cool-moor">Cool moor · teal, taupe, slate</option></select></label>
        <label className="field">Connected composition<select aria-label="Terrain composition" value={composition} onChange={event=>setComposition(event.target.value==='mixed'?'mixed':Number(event.target.value) as 0|1|2)}><option value="mixed">Seeded mix</option>{[0,1,2].map(c=><option key={c} value={c}>Composition {c+1}</option>)}</select></label>
      </>}
      {recipe.id==='retro-terrain-growth'&&<label className="field">Palette<select aria-label="Terrain palette" value={recipe.palette} onChange={event=>{revision.current++;setRecipe({...recipe,palette:event.target.value as RetroPaletteId});setStatus('Unsaved retro terrain changes');}}>
        <option value="heath">Heath · sage, rose soil, slate</option><option value="riverbed">Riverbed · teal, clay, blue stone</option><option value="original">Original colors</option>
      </select></label>}
      <label className="field">Terrain seed<input aria-label="Terrain seed" type="number" min={0} max={4294967295} value={recipe.seed} onChange={event => {revision.current++; setRecipe({...recipe, seed: Number(event.target.value)}); setStatus('Unsaved retro terrain changes');}} /></label>
      <label className="field">Tile<select aria-label="Terrain tile" value={view} onChange={event => setView(event.target.value)}>
        <optgroup label="Surfaces">{(result.kit?.tiles??[]).filter(tile=>tile.role==='surface').map(tile=><option key={tile.id} value={tile.id}>{tile.id.replaceAll('-',' ')}</option>)}</optgroup>
        <optgroup label="Connected previews">{recipe.id!=='retro-terrain-curated'&&<option value="atlas">Transition sheet</option>}<option value="patch">Connected patch</option>
          {recipe.id==='retro-terrain-curated'&&<><option value="weathered-patch">Weathered connected patch</option>{recipe.tileSize===16&&<option value="gravel-patch">Connected gravel terrain</option>}{['dirt','grass','gravel'].map(f=><option key={f} value={'mixed-'+f}>Mixed {f} · 4×4</option>)}</>}
          {recipe.id==='retro-terrain-growth'&&<><option value="path-patch">Connected gravel paths</option><option value="weathered-patch">Weathered path terrain</option><option value="weathered-grass-dirt-atlas">Weathered transitions</option><option value="gravel-path-atlas">Path sheet</option><option value="weathered-gravel-path-atlas">Weathered path sheet</option></>}
        </optgroup>
        {recipe.id==='retro-terrain-curated'&&result.kit&&'templates' in result.kit&&<optgroup label="Sheets and editable sources">{[...result.kit.atlases,...result.kit.templates].map(t=><option key={t.id} value={t.id}>{t.id.replaceAll('-',' ')}</option>)}</optgroup>}
        {recipe.id==='retro-terrain-growth'&&<optgroup label="Phase variation · diagnostic"><option value="varied-dirt">Varied dirt · 4×4</option><option value="varied-grass">Varied grass · 4×4</option><option value="varied-gravel">Varied gravel · 4×4</option><option value="varied-path-patch">Varied path terrain</option><option value="varied-weathered-patch">Varied weathered terrain</option></optgroup>}
        <optgroup label="Terrain edges">{(result.kit?.tiles??[]).filter(tile=>tile.role==='transition').map(tile=><option key={tile.id} value={tile.id}>{tile.id.replaceAll('-',' ')}</option>)}</optgroup>
        {recipe.id!=='retro-terrain'&&<optgroup label="Path pieces">{result.kit?.tiles.filter(tile=>tile.role==='path-overlay').map(tile=><option key={tile.id} value={tile.id}>{tile.id.replaceAll('-',' ')}</option>)}</optgroup>}
      </select></label>
      <label className="field">Repeat<select aria-label="Terrain repeat" value={result.kit?.tiles.find(tile => tile.id === view)?.role === 'surface' ? repeat : 1} disabled={result.kit?.tiles.find(tile => tile.id === view)?.role !== 'surface'} onChange={event => setRepeat(Number(event.target.value))}>{[1,2,4].map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <button type="button" className="primary" onClick={() => void save()} disabled={busy || !!result.error}>{busy ? 'Baking terrain…' : 'Save terrain kit'}</button>
    <p className="drawer-status" role={result.error ? 'alert' : 'status'}>{result.error ?? status}</p>
  </details>;
}
