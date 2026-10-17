import { useEffect, useMemo, useRef, useState } from "react";
import { applySpriteVariation, createSpriteVariationProfile, generateSpriteVariations, parseSpriteVariations, randomizeSpriteVariation, renderFrame, type ArtRecipe } from "../../packages/grout-art/index.mjs";

function Candidate({ recipe, frame, index, onChoose }: { recipe: ArtRecipe; frame: number; index: number; onChoose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const pixels = renderFrame(recipe, Math.min(frame, recipe.frames.length - 1));
    canvas.current?.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  }, [recipe, frame]);
  return <button type="button" aria-label={`Choose candidate ${index + 1}`} onClick={onChoose}>
    <canvas ref={canvas} width={recipe.width} height={recipe.height} aria-label={`Variant seed ${recipe.spriteVariation?.seed}`} style={{ width: recipe.width * Math.max(1, Math.floor(48 / Math.max(recipe.width, recipe.height))) }} />
    <span>{recipe.spriteVariation?.seed}</span>
  </button>;
}
export function ArtSpriteVariations({ recipe, frame, disabled, onChange }: { recipe: ArtRecipe; frame: number; disabled: boolean; onChange: (recipe: ArtRecipe) => void }) {
  const [seed, setSeed] = useState("1204"), [candidates, setCandidates] = useState<ArtRecipe[]>([]);
  const [source, setSource] = useState(recipe.spriteVariationSource ?? ""), [sourceDirty, setSourceDirty] = useState(recipe.spriteVariationSource !== undefined), [error, setError] = useState("");
  const family = useMemo(() => {
    try { return { value: createSpriteVariationProfile(recipe), error: "" }; }
    catch (cause) { return { value: null, error: String(cause) }; }
  }, [recipe]);
  const profile = family.value;
  const selections = recipe.spriteVariation?.selections ?? Object.fromEntries(profile?.groups.map(group => [group.id, group.options[0].id]) ?? []);
  const locks = recipe.spriteVariation?.locks ?? {};
  useEffect(() => { setCandidates([]); setSeed(String(recipe.spriteVariation?.seed ?? 1204)); }, [recipe]);
  useEffect(() => { setSourceDirty(recipe.spriteVariationSource !== undefined); if (recipe.spriteVariationSource !== undefined) setSource(recipe.spriteVariationSource); }, [recipe.spriteVariationSource]);
  useEffect(() => { if (!sourceDirty && profile) setSource(JSON.stringify(profile, null, 2)); }, [profile, sourceDirty]);
  const candidateSeed = () => {
    const value = Number(seed);
    if (!seed.trim() || !Number.isInteger(value) || value < 0 || value > 4294967292) throw Error("Candidate seed must be 0..4294967292");
    return value;
  };
  const guarded = disabled || sourceDirty || !profile;
  const attempt = (action: () => void) => { try { action(); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } };
  return <details className="art-inspector-section art-sprite-variations">
    <summary>Sprite variations</summary>
    {profile?.groups.map(group => <div className="art-variation-group" key={group.id}>
      <label>{group.name}<select aria-label={`Variation ${group.name}`} value={selections[group.id]} disabled={guarded || locks[group.id]} onChange={event => {
        const choice = event.currentTarget.value;
        attempt(() => onChange(applySpriteVariation(recipe, profile, { seed: candidateSeed(), selections: { ...selections, [group.id]: choice }, locks })));
      }}>{group.options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <label><input type="checkbox" aria-label={`Lock variation ${group.name}`} checked={locks[group.id] ?? false} disabled={guarded} onChange={event => {
        const checked = event.currentTarget.checked;
        onChange({ ...recipe, spriteVariations: profile, spriteVariation: { seed: recipe.spriteVariation?.seed ?? 1204, selections, locks: { ...locks, [group.id]: checked } } });
      }} />Lock</label>
      <button type="button" disabled={guarded || locks[group.id]} onClick={() => attempt(() => onChange(randomizeSpriteVariation(recipe, profile, { seed: candidateSeed(), selections, locks, group: group.id })))}>Reroll {group.name.toLowerCase()}</button>
    </div>)}
    <label>Candidate seed<input aria-label="Sprite variation seed" type="number" min="0" max="4294967292" value={seed} disabled={disabled} onChange={event => setSeed(event.currentTarget.value)} /></label>
    <button type="button" disabled={guarded} onClick={() => attempt(() => {
      const start = candidateSeed();
      setCandidates(generateSpriteVariations(recipe, profile!, { seeds: [start, start + 1, start + 2, start + 3], selections, locks }));
    })}>Generate 4 candidates</button>
    {candidates.length > 0 && <div className="art-variation-candidates">{candidates.map((candidate, index) => <Candidate key={index} recipe={candidate} frame={frame} index={index} onChoose={() => onChange(candidate)} />)}</div>}
    <p className="art-craft-note">One choice carries through every pose. Locks and selections recover with the recipe; Undo restores the previous sprite. Candidates stay unapproved.</p>
    <details><summary>Edit variation family</summary>
      <p>Groups own complete, non-overlapping palette roles or named parts. Map every direction through the existing parts; animation and anchors stay in the recipe.</p>
      <textarea aria-label="Sprite variation family JSON" maxLength={524288} spellCheck={false} value={source} disabled={disabled} onChange={event => { const text = event.currentTarget.value; setSource(text); setSourceDirty(true); onChange({ ...recipe, spriteVariationSource: text }); }} />
      <button type="button" disabled={disabled || !sourceDirty} onClick={() => attempt(() => {
        const next = parseSpriteVariations(source, recipe);
        // Capture the current source as an option so loading a family never redraws the sprite.
        for (const group of next.groups) {
          const scope = group.options[0];
          group.options = group.options.filter(option => option.id !== "current");
          group.options.unshift({ id: "current", name: "Current drawing", ...(scope.palette ? { palette: Object.fromEntries(Object.keys(scope.palette).map(role => [role, recipe.palette[role]])) } : {}), ...(scope.parts ? { parts: Object.fromEntries(Object.keys(scope.parts).map(part => [part, recipe.parts[part]])) } : {}) });
        }
        onChange({ ...recipe, spriteVariationSource: undefined, spriteVariations: parseSpriteVariations(next, recipe), spriteVariation: { seed: 1204, selections: Object.fromEntries(next.groups.map(group => [group.id, "current"])), locks: {} } });
        setSourceDirty(false);
      })}>Apply variation family</button>
      <button type="button" disabled={disabled} onClick={() => { setSourceDirty(false); setError(""); onChange({ ...recipe, spriteVariationSource: undefined }); }}>Reset family text</button>
    </details>
    {disabled && <p>Apply or reset your recipe source edits before varying this sprite.</p>}
    {(error || family.error) && <p role="alert">{error || family.error}</p>}
  </details>;
}
