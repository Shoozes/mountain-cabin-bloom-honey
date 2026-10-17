import { useEffect, useMemo, useRef, useState } from "react";
import { ArtCharacterFeedback } from "./art-character-feedback";
import {
  addCharacterSlot,
  cloneCharacterOption,
  compileCharacter,
  createCharacterCreator,
  createCharacterDocument,
  importCharacterOption,
  parseCharacterCreator,
  parseCharacterDocument,
  randomizeCharacter,
  renderFrame,
  type ArtRecipe,
  type CharacterCreator,
  type CharacterDocument,
} from "../../packages/grout-art/index.mjs";

type Props = {
  recipe: ArtRecipe;
  importedRecipe?: ArtRecipe | null;
  onClearImported?: () => void;
  creator: CharacterCreator;
  document: CharacterDocument;
  disabled?: boolean;
  onCreator: (creator: CharacterCreator) => void;
  onDocument: (document: CharacterDocument) => void;
  onRecipe: (recipe: ArtRecipe) => void;
  reportError: (error: unknown) => void;
  onSelectLayer: (layerId: string) => void;
};

const poseNames = ["south-0", "south-1", "south-2", "west-0", "west-1", "west-2", "east-0", "east-1", "east-2", "north-0", "north-1", "north-2"];

function saveJson(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CharacterSlotThumbnail({ pixels, width, height }: { pixels: ReturnType<typeof renderFrame>; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  }, [pixels]);
  return <canvas ref={ref} width={width} height={height} aria-hidden="true" />;
}

export function ArtCharacterCreator({ recipe, importedRecipe, onClearImported, creator, document: character, disabled = false, onCreator, onDocument, onRecipe, reportError, onSelectLayer }: Props) {
  const [creatorEditing, setCreatorEditing] = useState(false);
  const [include, setInclude] = useState<string[]>([]);
  const [editSlot, setEditSlot] = useState(creator.slots[0]?.id ?? "");
  const [frameMap, setFrameMap] = useState<Record<string, string>>(() => Object.fromEntries(poseNames.map((name) => [name, ""])));
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [creatorText, setCreatorText] = useState(() => JSON.stringify(creator, null, 2));
  const [creatorTextDirty, setCreatorTextDirty] = useState(false);
  useEffect(() => {
    if (!creatorTextDirty) setCreatorText(JSON.stringify(creator, null, 2));
  }, [creator, creatorTextDirty]);
  const fileRef = useRef<HTMLInputElement>(null);
  const slot = creator.slots.find((item) => item.id === editSlot) ?? creator.slots[0];
  const option = slot?.options.find((item) => item.id === character.selections[slot.id]);
  const safeName = (character.name || "character").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const thumbnails = useMemo(() => new Map(creator.slots.map((slot) => {
    const visibleLayers = new Set(slot.layers);
    const preview = {
      ...recipe,
      layers: recipe.layers.map((layer) => ({ ...layer, visible: visibleLayers.has(layer.id) && layer.visible })),
      frames: recipe.frames.map((frame) => ({
        ...frame,
        layers: Object.fromEntries(Object.entries(frame.layers ?? {}).map(([id, value]) => [id, { ...value, visible: visibleLayers.has(id) && value.visible !== false }])),
      })),
    };
    return [slot.id, renderFrame(preview, 0)] as const;
  })), [creator.slots, recipe]);

  function selectSlot(slotId: string) {
    setEditSlot(slotId);
    const targetLayer = creator.slots.find((item) => item.id === slotId)?.layers.find((id) => recipe.layers.some((layer) => layer.id === id));
    if (targetLayer) onSelectLayer(targetLayer);
  }

  function uniqueOptionId(slotId: string) {
    const used = new Set(creator.slots.find((item) => item.id === slotId)?.options.map((item) => item.id) ?? []);
    let suffix = 1;
    while (used.has(`copy-${suffix}`)) suffix += 1;
    return `copy-${suffix}`;
  }

  function apply(next: CharacterDocument) {
    try {
      const compiled = compileCharacter(next);
      onCreator(compiled.character!.creator);
      onDocument(compiled.character!);
      onRecipe(compiled);
      setDirty(true);
      setNotice("");
    } catch (error) { reportError(error); }
  }
  function updateCreator(next: CharacterCreator) {
    try {
      const compiled = compileCharacter({ ...character, creator: next });
      const nextDocument = compiled.character!;
      onCreator(nextDocument.creator); onDocument(nextDocument); onRecipe(compiled); setDirty(true); setNotice("");
      if (!creatorTextDirty) setCreatorText(JSON.stringify(nextDocument.creator, null, 2));
      return true;
    } catch (error) { reportError(error); return false; }
  }
  function updateSlot(slotId: string, update: (current: CharacterCreator["slots"][number]) => CharacterCreator["slots"][number]) {
    updateCreator({ ...creator, slots: creator.slots.map((current) => current.id === slotId ? update(current) : current) });
  }
  function updateOption(slotId: string, optionId: string, update: (current: CharacterCreator["slots"][number]["options"][number]) => CharacterCreator["slots"][number]["options"][number]) {
    updateSlot(slotId, (current) => ({ ...current, options: current.options.map((item) => item.id === optionId ? update(item) : item) }));
  }
  async function loadDocument(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      let loadedCreator: CharacterCreator;
      if (parsed?.format === "grout-character-creator/1") {
        loadedCreator = parseCharacterCreator(parsed);
        const nextDoc = createCharacterDocument(loadedCreator);
        const compiled = compileCharacter(nextDoc);
        onCreator(loadedCreator); onDocument(nextDoc); onRecipe(compiled);
      } else {
        const nextDoc = parseCharacterDocument(parsed);
        const compiled = compileCharacter(nextDoc);
        loadedCreator = nextDoc.creator;
        onDocument(nextDoc); onCreator(loadedCreator); onRecipe(compiled);
      }
      setCreatorText(JSON.stringify(loadedCreator, null, 2));
      setCreatorTextDirty(false);
      setDirty(true); setNotice("Character source loaded and compiled.");
    } catch (error) { reportError(error); }
  }
  function randomize() {
    try {
      const next = randomizeCharacter(character, { include });
      apply(next);
    } catch (error) { reportError(error); }
  }
  function importCurrentRecipe() {
    if (!slot) return;
    try {
      const source = importedRecipe ?? recipe;
      const mapped = Object.fromEntries(Object.entries(frameMap).filter(([, frame]) => source.frames.some((entry) => entry.name === frame)).map(([pose, frame]) => [pose, frame]));
      const mappedRoles = Object.fromEntries(Object.entries(roleMap).filter(([, role]) => role));
      const next = importCharacterOption(character, {
        slot: slot.id,
        id: `custom-${Date.now().toString(36)}`,
        name: `Imported ${slot.name}`,
        recipe: source,
        frames: mapped,
        layers: source.layers.map((layer) => layer.id),
        roleMap: mappedRoles,
      });
      apply(next);
      setNotice("Mapped frames and palette roles into a custom option.");
    } catch (error) { reportError(error); }
  }

  return <fieldset className="art-character-fieldset" disabled={disabled}><div className="art-character-controls">
    {disabled && <p className="art-character-notice" role="status">Apply or reset the pending recipe source before changing character settings.</p>}
    <div className="art-character-title"><span>Character</span><button type="button" onClick={() => setCreatorEditing((value) => !value)} aria-expanded={creatorEditing}>{creatorEditing ? "Close creator" : "Edit creator"}</button></div>
    <div className="art-character-actions"><button type="button" className="art-character-primary" onClick={randomize}>Randomize</button><button type="button" onClick={() => { try { apply(randomizeCharacter(character, { seed: character.seed, include })); } catch (error) { reportError(error); } }}>Generate from seed</button><span className="art-character-dirty" aria-live="polite">{dirty ? "Unsaved character edits" : "Character saved locally"}</span></div>
    <ArtCharacterFeedback document={character} onChange={apply} onError={reportError} />
    <label>Name<input aria-label="Character name" value={character.name} onChange={(event) => apply({ ...character, name: event.currentTarget.value })} /></label>
    <div className="art-character-selectors">
      <label>Build<select value={character.build} onChange={(event) => apply({ ...character, build: event.currentTarget.value as CharacterDocument["build"] })}>{creator.builds.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Style<select value={character.style} onChange={(event) => apply({ ...character, style: event.currentTarget.value as CharacterDocument["style"] })}>{creator.styles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Frame size<select value={character.frameSize} onChange={(event) => apply({ ...character, frameSize: Number(event.currentTarget.value) as CharacterDocument["frameSize"] })}>{[16, 24, 32].map((size) => <option key={size}>{size}</option>)}</select></label>
      <label>Palette<select value={character.palette} onChange={(event) => apply({ ...character, palette: event.currentTarget.value })}>{creator.palettes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Skin ramp<select value={character.skin} onChange={(event) => apply({ ...character, skin: Number(event.currentTarget.value) })}>{creator.skinRamps.map((_, i) => <option key={i} value={i}>Skin {i + 1}</option>)}</select></label>
      <label>Hair ramp<select value={character.hairColor} onChange={(event) => apply({ ...character, hairColor: Number(event.currentTarget.value) })}>{creator.hairRamps.map((_, i) => <option key={i} value={i}>Hair {i + 1}</option>)}</select></label>
      <label>Mode<select value={character.mode} onChange={(event) => apply({ ...character, mode: event.currentTarget.value as CharacterDocument["mode"] })}><option value="authored">Authored</option><option value="adjustable">Adjustable</option><option value="procedural">Procedural</option></select></label>
      <label>Seed<input type="number" value={character.seed} onChange={(event) => apply({ ...character, seed: Number(event.currentTarget.value) })} /></label>
    </div>
    <section className="art-character-slots" aria-label="Character parts">
      {creator.slots.map((item) => {
        return <div className="art-character-slot" key={item.id}>
          <button className="art-character-thumb" type="button" aria-pressed={editSlot === item.id} onClick={() => selectSlot(item.id)}><CharacterSlotThumbnail pixels={thumbnails.get(item.id)!} width={recipe.width} height={recipe.height} /><span>{item.name}</span></button>
          <select aria-label={`${item.name} option`} value={character.selections[item.id] ?? ""} onChange={(event) => { selectSlot(item.id); apply({ ...character, selections: { ...character.selections, [item.id]: event.currentTarget.value } }); }}>{item.options.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>
          <label className="art-character-lock"><input type="checkbox" checked={Boolean(character.locks[item.id])} onChange={(event) => apply({ ...character, locks: { ...character.locks, [item.id]: event.currentTarget.checked } })} /> Lock</label>
        </div>;
      })}
    </section>
    {slot && <section className="art-character-option-detail">
      <label>Selected part<select value={editSlot} onChange={(event) => selectSlot(event.currentTarget.value)}>{creator.slots.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <p>{option?.name ?? "No option selected"} · {option?.kind ?? "custom"}</p>
      <div className="art-character-actions"><button type="button" onClick={() => { try { apply(cloneCharacterOption(character, slot.id, uniqueOptionId(slot.id), `Copy of ${option?.name ?? slot.name}`)); } catch (error) { reportError(error); } }}>Duplicate</button><button type="button" onClick={() => { try { apply(randomizeCharacter(character, { slot: slot.id })); } catch (error) { reportError(error); } }}>Reroll part</button></div>
      {Object.entries(slot.parameters).map(([key, range]) => <label key={key}>{key}<input type="range" min={range.min} max={range.max} value={character.parameters[slot.id]?.[key] ?? range.default} onChange={(event) => apply({ ...character, parameters: { ...character.parameters, [slot.id]: { ...character.parameters[slot.id], [key]: Number(event.currentTarget.value) } } })} /><span>{character.parameters[slot.id]?.[key] ?? range.default}</span></label>)}
    </section>}
    <fieldset className="art-character-randomize"><legend>Randomize includes</legend>{["build", "style", "palette"].map((part) => <label key={part}><input type="checkbox" checked={include.includes(part)} onChange={(event) => setInclude((current) => event.currentTarget.checked ? [...current, part] : current.filter((item) => item !== part))} />{part}</label>)}</fieldset>
    <details className="art-character-palette"><summary>Palette roles · {Object.keys(recipe.palette).length}</summary><section className="art-character-colors">{Object.entries(recipe.palette).map(([role, color]) => <label key={role}>{role}<input type="color" value={character.paletteOverrides[role] ?? color} onChange={(event) => apply({ ...character, paletteOverrides: { ...character.paletteOverrides, [role]: event.currentTarget.value } })} /></label>)}</section></details>
    <details className="art-character-import"><summary>Import poses and palette roles</summary>
      <p>Import PNG or GIF below, then map every decoded source frame before adding it as a custom option. Colors are preserved unless you choose another palette role.</p>
      <div className="art-character-mapping">{poseNames.map((pose) => <label key={pose}>{pose}<select value={frameMap[pose] ?? ""} onChange={(event) => setFrameMap({ ...frameMap, [pose]: event.currentTarget.value })}><option value="">Unmapped</option>{(importedRecipe ?? recipe).frames.map((frame) => <option key={frame.name} value={frame.name}>{frame.name}</option>)}</select></label>)}</div>
      <div className="art-character-mapping">{Object.keys((importedRecipe ?? recipe).palette).map((role) => <label key={role}>{role}<select value={roleMap[role] ?? ""} onChange={(event) => setRoleMap({ ...roleMap, [role]: event.currentTarget.value })}><option value="">Keep source color</option>{Object.keys(recipe.palette).map((target) => <option key={target} value={target}>{target}</option>)}</select></label>)}</div>
      <button type="button" disabled={poseNames.some((pose) => !frameMap[pose])} onClick={importCurrentRecipe}>Add mapped custom option</button>
      {importedRecipe && <button type="button" onClick={() => { onClearImported?.(); setFrameMap(Object.fromEntries(poseNames.map((pose) => [pose, ""]))); setRoleMap({}); setNotice("Import cancelled. Character options are unchanged."); }}>Cancel import</button>}
      {poseNames.some((pose) => !frameMap[pose]) && <p>Map all twelve poses before adding this option. The import stays unchanged until every pose is assigned.</p>}
    </details>
    <div className="art-character-actions"><button type="button" onClick={() => saveJson(`${safeName}.character.json`, character)}>Save character JSON</button><button type="button" onClick={() => saveJson("character-creator.json", creator)}>Save creator JSON</button><button type="button" onClick={() => fileRef.current?.click()}>Load JSON</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void loadDocument(file); event.currentTarget.value = ""; }} /></div>
    {notice && <p className="art-character-notice" role="status">{notice}</p>}
    {creatorEditing && <section className="art-character-editor" aria-label="Creator editor">
      <div className="art-character-title"><strong>Creator definition</strong><button type="button" onClick={() => { const copy = createCharacterCreator(); const next = createCharacterDocument(copy); const compiled = compileCharacter(next); onCreator(copy); onDocument(next); onRecipe(compiled); setEditSlot(copy.slots[0]?.id ?? ""); setDirty(true); setCreatorText(JSON.stringify(copy, null, 2)); setCreatorTextDirty(false); }}>Start fresh</button></div>
      <label>Creator name<input value={creator.name} onChange={(event) => updateCreator({ ...creator, name: event.currentTarget.value })} /></label>
      <details><summary>Styles</summary>{creator.styles.map((style) => <fieldset className="art-creator-definition" key={style.id}><legend>{style.name}</legend><label>Name<input value={style.name} onChange={(event) => updateCreator({ ...creator, styles: creator.styles.map((item) => item.id === style.id ? { ...item, name: event.currentTarget.value } : item) })} /></label><label>Detail budget<input type="number" min={1} max={256} value={style.budget} onChange={(event) => updateCreator({ ...creator, styles: creator.styles.map((item) => item.id === style.id ? { ...item, budget: Number(event.currentTarget.value) } : item) })} /></label><label><input type="checkbox" checked={style.outline} onChange={(event) => updateCreator({ ...creator, styles: creator.styles.map((item) => item.id === style.id ? { ...item, outline: event.currentTarget.checked } : item) })} /> Outline</label><label><input type="checkbox" checked={style.shaded} onChange={(event) => updateCreator({ ...creator, styles: creator.styles.map((item) => item.id === style.id ? { ...item, shaded: event.currentTarget.checked } : item) })} /> Shading</label></fieldset>)}</details>
      <details><summary>Builds</summary><p>Head widths use 6, 8 or 10 pixels; torso widths use 4 or 6, keeping the idle pose centered.</p>{creator.builds.map((build) => <fieldset className="art-creator-definition" key={build.id}><legend>{build.name}</legend><label>Name<input value={build.name} onChange={(event) => updateCreator({ ...creator, builds: creator.builds.map((item) => item.id === build.id ? { ...item, name: event.currentTarget.value } : item) })} /></label>{(["headWidth", "headHeight", "headY", "torsoY", "torsoWidth"] as const).map((field) => <label key={field}>{field}<input type="number" step={field === "headWidth" || field === "torsoWidth" ? 2 : 1} min={field === "headWidth" ? 6 : field === "headHeight" ? 5 : field === "headY" ? 1 : field === "torsoY" ? 8 : 4} max={field === "headWidth" ? 10 : field === "headHeight" ? 8 : field === "headY" ? 4 : field === "torsoY" ? 11 : 6} value={build[field]} onChange={(event) => updateCreator({ ...creator, builds: creator.builds.map((item) => item.id === build.id ? { ...item, [field]: Number(event.currentTarget.value) } : item) })} /></label>)}</fieldset>)}</details>
      <details><summary>Palette definitions and ramps</summary>{creator.palettes.map((palette) => <fieldset className="art-creator-definition" key={palette.id}><legend>{palette.name}</legend><label>Name<input value={palette.name} onChange={(event) => updateCreator({ ...creator, palettes: creator.palettes.map((item) => item.id === palette.id ? { ...item, name: event.currentTarget.value } : item) })} /></label>{(["cloth", "hat", "accent"] as const).map((role) => <label key={role}>{role}<input type="color" value={palette[role]} onChange={(event) => updateCreator({ ...creator, palettes: creator.palettes.map((item) => item.id === palette.id ? { ...item, [role]: event.currentTarget.value } : item) })} /></label>)}</fieldset>)}{(["skinRamps", "hairRamps"] as const).map((rampName) => <fieldset className="art-creator-definition" key={rampName}><legend>{rampName}</legend>{creator[rampName].map((ramp, rampIndex) => <div className="art-creator-ramp" key={rampIndex}><span>{rampName === "skinRamps" ? `Skin ${rampIndex + 1}` : `Hair ${rampIndex + 1}`}</span>{ramp.map((color, colorIndex) => <input aria-label={`${rampName} ${rampIndex + 1} color ${colorIndex + 1}`} type="color" key={colorIndex} value={color} onChange={(event) => updateCreator({ ...creator, [rampName]: creator[rampName].map((current, i) => i === rampIndex ? current.map((value, j) => j === colorIndex ? event.currentTarget.value : value) : current) })} />)}</div>)}</fieldset>)}</details>
      <details><summary>Slots, anchors, parameters and compatibility</summary>{creator.slots.map((creatorSlot) => <fieldset className="art-creator-definition" key={creatorSlot.id}><legend>{creatorSlot.name}</legend><label>Slot name<input value={creatorSlot.name} onChange={(event) => updateSlot(creatorSlot.id, (current) => ({ ...current, name: event.currentTarget.value }))} /></label><div className="art-creator-pair">{creatorSlot.anchor.map((value, index) => <label key={index}>Anchor {index === 0 ? "X" : "Y"}<input type="number" min={-16} max={16} value={value} onChange={(event) => updateSlot(creatorSlot.id, (current) => ({ ...current, anchor: current.anchor.map((item, i) => i === index ? Number(event.currentTarget.value) : item) as [number, number] }))} /></label>)}</div>{Object.entries(creatorSlot.parameters).map(([parameterId, range]) => <fieldset className="art-creator-range" key={parameterId}><legend>{parameterId}</legend>{(["min", "max", "default"] as const).map((field) => <label key={field}>{field}<input type="number" min={field === "min" ? 0 : range.min} max={field === "max" ? 8 : range.max} value={range[field]} onChange={(event) => updateSlot(creatorSlot.id, (current) => ({ ...current, parameters: { ...current.parameters, [parameterId]: { ...range, [field]: Number(event.currentTarget.value) } } }))} /></label>)}</fieldset>)}{creatorSlot.options.map((creatorOption) => <details key={creatorOption.id}><summary>{creatorOption.name} · compatibility</summary><label>Option name<input value={creatorOption.name} onChange={(event) => updateOption(creatorSlot.id, creatorOption.id, (current) => ({ ...current, name: event.currentTarget.value }))} /></label>{(["builds", "styles", ...(creatorSlot.id === "hair" || creatorSlot.id === "hat" ? ["heads"] : [])] as ("builds" | "styles" | "heads")[]).map((kind) => { const choices = kind === "builds" ? creator.builds : kind === "styles" ? creator.styles : creator.slots.find((item) => item.id === "head")?.options ?? []; const active: string[] = creatorOption.compatible?.[kind] ?? choices.map((item) => item.id); return <fieldset className="art-creator-compat" key={kind}><legend>{kind}</legend>{choices.map((item) => <label key={item.id}><input type="checkbox" checked={active.includes(item.id)} onChange={(event) => updateOption(creatorSlot.id, creatorOption.id, (current) => ({ ...current, compatible: { ...current.compatible, [kind]: event.currentTarget.checked ? [...active, item.id] : active.filter((id: string) => id !== item.id) } }))} />{item.name}</label>)}</fieldset>; })}</details>)}</fieldset>)}</details>
      <details className="art-character-source"><summary>Creator JSON source{creatorTextDirty ? " · pending edits" : ""}</summary><label>Creator JSON<textarea spellCheck={false} value={creatorText} onChange={(event) => { setCreatorText(event.currentTarget.value); setCreatorTextDirty(true); }} /></label><div className="art-character-actions"><button type="button" disabled={!creatorTextDirty} onClick={() => { try { const parsed = parseCharacterCreator(JSON.parse(creatorText)); if (updateCreator(parsed)) { setCreatorText(JSON.stringify(parsed, null, 2)); setCreatorTextDirty(false); } } catch (error) { reportError(error); } }}>Apply definition</button><button type="button" disabled={!creatorTextDirty} onClick={() => { setCreatorText(JSON.stringify(creator, null, 2)); setCreatorTextDirty(false); }}>Cancel edits</button></div></details>
      <div className="art-character-actions"><button type="button" onClick={() => { try { const next = addCharacterSlot(character, { id: `part-${Date.now().toString(36)}`, name: "New part" }); const compiled = compileCharacter(next); onDocument(next); onCreator(next.creator); onRecipe(compiled); setEditSlot(next.creator.slots.at(-1)?.id ?? ""); setDirty(true); } catch (error) { reportError(error); } }}>Add part slot</button><button type="button" onClick={() => { if (!slot) return; try { apply(cloneCharacterOption(character, slot.id, `copy-${Date.now().toString(36)}`, `New ${slot.name} option`)); } catch (error) { reportError(error); } }}>Add option</button></div>
      <p className="art-craft-note">Errors keep the last compiled preview active. Close creator editing to return to the character controls.</p>
    </section>}
  </div></fieldset>;
}
