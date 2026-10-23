import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  generateMaterial,
  validateMaterialRecipe,
  MATERIAL_DEFAULTS,
  MATERIAL_PALETTES,
  MATERIAL_RECIPES,
  STYLE_SURFACE_FAMILIES,
  MATERIAL_STYLES,
  STYLE_SURFACE_SIZES,
  REALISTIC_SURFACE_FAMILIES,
  REALISTIC_SURFACE_PRESETS,
  type MaterialRecipe,
  type MaterialPixels,
} from '@/shader/material.mjs';
import { materialBrowserFiles, paintMaterialCanvas } from '@/shader/material-browser.mjs';
import { shadeRealisticPreview } from '@/shader/material-realistic.mjs';
import { zipStore } from '@/shader/zip-store';

export type MaterialPreview = {
  pixels: MaterialPixels;
  repeat: number;
  channel: string;
  label: string;
  smooth?: boolean;
};

export function MaterialPanel({
  onPreview,
  active,
  open,
  onOpenChange,
  requestedRecipe,
  requestKey,
}: {
  onPreview: (preview: MaterialPreview | null) => void;
  active: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  requestedRecipe?: MaterialRecipe['id'];
  requestKey?: number;
}) {
  const [recipe, setRecipe] = useState<MaterialRecipe>({ ...MATERIAL_DEFAULTS });
  const [ready, setReady] = useState(false);
  const [channel, setChannel] = useState('albedo');
  const [repeat, setRepeat] = useState(2);
  const [status, setStatus] = useState('Original candidate — visual approval pending');
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const disclosure = useRef<HTMLDetailsElement>(null);
  const editRevision = useRef(0);
  const realistic = recipe.id === 'realistic-surface';
  const clumps = recipe.id === 'style-surface' && recipe.structure === 'clumps';
  const tufts = recipe.id === 'style-surface' && recipe.structure === 'tufts';
  const label = realistic
    ? `${recipe.family} surface`
    : recipe.id === 'style-surface'
      ? `${recipe.style} ${recipe.family}`
      : recipe.id === 'hd2d-cliff-strata'
        ? 'Stratified cliff'
        : 'HD-2D cliff';

  useEffect(() => {
    if (!active && disclosure.current) disclosure.current.open = false;
  }, [active]);

  const result = useMemo(() => {
    try {
      return { material: generateMaterial(recipe), error: null };
    } catch (error) {
      return { material: null, error: error instanceof Error ? error.message : 'Invalid material' };
    }
  }, [recipe]);

  const previewPixels = useMemo(() => {
    if (!result.material) return null;
    return realistic && channel === 'surface'
      ? shadeRealisticPreview(result.material.channels)
      : result.material.channels[channel === 'surface' ? 'albedo' : channel]!;
  }, [result, realistic, channel]);

  useEffect(() => {
    if (previewPixels && canvas.current) {
      paintMaterialCanvas(canvas.current, previewPixels, repeat);
    }
  }, [previewPixels, repeat]);

  const preview = useCallback((material: { channels: Record<string, MaterialPixels> }): MaterialPreview => ({
    pixels: previewPixels ?? material.channels.albedo!,
    repeat,
    channel,
    label,
    smooth: realistic,
  }), [channel, label, realistic, repeat, previewPixels]);

  useEffect(() => {
    if (disclosure.current?.open && result.material) onPreview(preview(result.material));
  }, [result, onPreview, open, preview]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cliff-material-v1');
      if (raw) {
        const draft = validateMaterialRecipe(JSON.parse(raw));
        setRecipe(draft);
        setStatus(
          localStorage.getItem('cliff-material-export-v1') === JSON.stringify(draft)
            ? 'Exported material draft — artwork remains unapproved'
            : 'Unsaved material changes — recovered local draft',
        );
      }
    } catch {
      setStatus('Saved material draft could not be loaded');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && result.material) {
      try {
        localStorage.setItem('cliff-material-v1', JSON.stringify(recipe));
      } catch {
        setStatus('Material draft could not be saved locally');
      }
    }
  }, [recipe, result, ready]);

  const patch = (next: Partial<MaterialRecipe>) => {
    editRevision.current++;
    setRecipe((current) => {
      const updated = { ...current, ...next } as MaterialRecipe;
      if (updated.id === 'style-surface') {
        const supported = updated.style === 'hd2d' &&
          ((updated.family === 'dirt' && updated.structure === 'clumps') ||
           (updated.family === 'grass' && updated.structure === 'tufts'));
        if (!supported) delete updated.structure;
      }
      return updated;
    });
    setStatus('Unsaved material changes');
  };

  const changeRecipe = useCallback((id: MaterialRecipe['id']) => {
    editRevision.current++;
    const defaults = validateMaterialRecipe(
      id === 'style-surface'
        ? { id, family: 'grass', style: 'hd2d' }
        : id === 'realistic-surface'
          ? { id, family: 'soil' }
          : { id },
    );
    setRecipe((current) => ({ ...defaults, seed: current.seed, palette: current.palette }) as MaterialRecipe);
    setChannel(id === 'realistic-surface' ? 'surface' : 'albedo');
    setStatus('Unsaved material changes');
  }, []);

  useEffect(() => {
    if (requestKey && requestedRecipe) changeRecipe(requestedRecipe);
  }, [changeRecipe, requestKey, requestedRecipe]);

  const selectPreset = (preset: (typeof REALISTIC_SURFACE_PRESETS)[number]) => {
    editRevision.current++;
    setRecipe({ ...preset.recipe, seed: recipe.seed } as MaterialRecipe);
    setStatus('Unsaved material changes');
  };

  const save = async () => {
    const savedRevision = editRevision.current;
    setBusy(true);
    try {
      const files = await materialBrowserFiles(recipe);
      const url = URL.createObjectURL(zipStore(files));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = recipe.id + '-s' + recipe.seed + '.zip';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      localStorage.setItem('cliff-material-export-v1', JSON.stringify(recipe));
      setStatus(
        savedRevision === editRevision.current
          ? 'Material channels and recipe saved — artwork remains unapproved'
          : 'Unsaved material changes — the previous recipe was exported',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details
      ref={disclosure}
      className="material-panel"
      open={open}
      onToggle={(event) => {
        const isOpen = event.currentTarget.open;
        onOpenChange?.(isOpen);
        onPreview(isOpen && result.material ? preview(result.material) : null);
      }}
    >
      <summary>Adjust materials · {label}</summary>
      <p className="lede">
        {realistic
          ? 'Continuous surface detail under a neutral preview light. Exported color stays unlit.'
          : 'Independent surface relief and pigment. No painted directional lighting.'}
      </p>
      <canvas
        ref={canvas}
        className={realistic ? 'material-preview-smooth' : 'pixelated'}
        style={{ width: '100%', maxWidth: 384, aspectRatio: '1' }}
        aria-label="Material channel preview"
      />
      <div className="fields">
        <label className="field">
          Recipe
          <select
            aria-label="Material recipe"
            value={recipe.id}
            onChange={(event) => changeRecipe(event.target.value as MaterialRecipe['id'])}
          >
            {Object.entries(MATERIAL_RECIPES).map(([id, recipeLabel]) => (
              <option key={id} value={id}>{recipeLabel}</option>
            ))}
          </select>
        </label>

        {realistic && (
          <>
            <label className="field">
              Realistic family
              <select
                aria-label="Realistic material family"
                value={recipe.family}
                onChange={(event) => patch({ family: event.target.value } as Partial<MaterialRecipe>)}
              >
                {REALISTIC_SURFACE_FAMILIES.map((family) => (
                  <option key={family} value={family}>{family}</option>
                ))}
              </select>
            </label>
            <div className="material-presets" aria-label="Realistic material presets">
              <span className="material-presets-label">Starting surfaces</span>
              <div className="material-preset-list">
                {REALISTIC_SURFACE_PRESETS.map((preset) => (
                  <button
                    className="material-preset"
                    type="button"
                    key={preset.label}
                    aria-pressed={
                      recipe.family === preset.recipe.family &&
                      recipe.palette === preset.recipe.palette &&
                      recipe.size === preset.recipe.size &&
                      recipe.strataScale === preset.recipe.strataScale &&
                      recipe.fracture === preset.recipe.fracture &&
                      recipe.relief === preset.recipe.relief &&
                      recipe.roughness === preset.recipe.roughness
                    }
                    onClick={() => selectPreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {recipe.id === 'style-surface' && (
          <>
            <label className="field">
              Surface family
              <select
                aria-label="Material family"
                value={recipe.family}
                onChange={(event) => patch({ family: event.target.value } as Partial<MaterialRecipe>)}
              >
                {STYLE_SURFACE_FAMILIES.map((family) => <option key={family}>{family}</option>)}
              </select>
            </label>
            <label className="field">
              Appearance style
              <select
                aria-label="Material style"
                value={recipe.style}
                onChange={(event) => {
                  const style = event.target.value as typeof recipe.style;
                  patch({ style, size: STYLE_SURFACE_SIZES[style] } as Partial<MaterialRecipe>);
                }}
              >
                {MATERIAL_STYLES.map((style) => <option key={style}>{style}</option>)}
              </select>
            </label>
            {(recipe.family === 'dirt' || recipe.family === 'grass') && recipe.style === 'hd2d' && (
              <label className="field">
                {recipe.family === 'dirt' ? 'Dirt structure' : 'Grass structure'}
                <select
                  aria-label={recipe.family === 'dirt' ? 'Dirt structure' : 'Grass structure'}
                  value={recipe.structure ?? 'legacy'}
                  onChange={(event) => patch({ structure: event.target.value === 'legacy' ? undefined : event.target.value as 'clumps' | 'tufts' })}
                >
                  <option value="legacy">{recipe.family === 'dirt' ? 'Original rows' : 'Original patches'}</option>
                  <option value={recipe.family === 'dirt' ? 'clumps' : 'tufts'}>{recipe.family === 'dirt' ? 'Irregular clumps' : 'Connected tufts'}</option>
                </select>
              </label>
            )}
          </>
        )}

        <label className="field">
          Texture size
          <select aria-label="Material size" value={recipe.size} onChange={(event) => patch({ size: Number(event.target.value) })}>
            {[64, 128, 256, 512].map((size) => <option key={size}>{size}</option>)}
          </select>
        </label>
        <label className="field">
          Channel
          <select aria-label="Material channel" value={channel} onChange={(event) => setChannel(event.target.value)}>
            {realistic && <option value="surface">Lit surface</option>}
            {['albedo', 'height', 'normal', 'roughness'].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="field">
          Repeat
          <select aria-label="Material repeat" value={repeat} onChange={(event) => setRepeat(Number(event.target.value))}>
            {[1, 2, 4].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="field">
          Material seed
          <input aria-label="Material seed" type="number" min={0} max={4294967295} value={recipe.seed} onChange={(event) => patch({ seed: Number(event.target.value) })} />
        </label>
        <label className="field">
          Material palette
          <select aria-label="Material palette" value={recipe.palette} onChange={(event) => patch({ palette: event.target.value })}>
            {Object.keys(MATERIAL_PALETTES).map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        {(['strataScale', 'fracture', 'relief', 'roughness'] as const).map((key) => (
          <label className="field" key={key}>
            {{ strataScale: realistic ? 'Structure scale' : clumps ? 'Clump scale' : tufts ? 'Tuft scale' : 'Strata', fracture: 'Fractures', relief: 'Relief', roughness: 'Roughness' }[key]}
            <input
              aria-label={'Material ' + (key === 'strataScale' && realistic ? 'structure scale' : key === 'strataScale' && clumps ? 'clump scale' : key === 'strataScale' && tufts ? 'tuft scale' : key)}
              type="range"
              min={key === 'strataScale' ? 1 : key === 'roughness' ? 0.05 : 0}
              max={key === 'strataScale' ? 8 : 1}
              step={key === 'strataScale' ? 1 : 0.01}
              value={recipe[key]}
              onChange={(event) => patch({ [key]: Number(event.target.value) })}
            />
            <output>{recipe[key]}</output>
          </label>
        ))}
      </div>
      <button type="button" className="primary" onClick={() => void save()} disabled={busy || !!result.error}>
        {busy ? 'Baking…' : 'Save material channels'}
      </button>
      <p className="drawer-status" role={result.error ? 'alert' : 'status'}>{result.error ?? status}</p>
    </details>
  );
}
