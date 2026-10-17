import { useEffect, useRef, useState } from "react";
import {
  detectSpriteComponents,
  importSpriteComponents,
  type ArtRecipe,
  type SpriteComponentAnalysis,
} from "../../packages/grout-art/index.mjs";
import { readSpriteComponentFile } from "@/art/sprite-import";

type Sheet = Awaited<ReturnType<typeof readSpriteComponentFile>> & { analysis: SpriteComponentAnalysis };
const COLORS = ["#efb867", "#78cbb1", "#bf9cdd", "#f19783"];

function groupedIds(values: number[]) {
  const groups = new Map<number, number[]>();
  values.forEach((group, id) => groups.set(group, [...(groups.get(group) ?? []), id]));
  return [...groups].sort(([a], [b]) => a - b).map(([, ids]) => ids);
}

export function ArtSpriteComponents({ files, recipe, disabled, onImport, onBusyChange }: {
  files: File[];
  recipe: ArtRecipe;
  disabled: boolean;
  onImport: (recipe: ArtRecipe) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [groups, setGroups] = useState<number[]>([]);
  const [connectivity, setConnectivity] = useState<4 | 8>(8);
  const [padding, setPadding] = useState(1);
  const [customAnchor, setCustomAnchor] = useState(false);
  const [anchor, setAnchor] = useState<[number, number]>([0, 0]);
  const [busy, setBusy] = useState<"detect" | "convert" | null>(null);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setSheet(null);
    setGroups([]);
    setError("");
    return () => { active.current?.abort(); };
  }, [files, connectivity]);
  useEffect(() => () => { active.current?.abort(); }, [recipe, disabled]);

  useEffect(() => {
    if (!sheet || !canvas.current) return;
    const context = canvas.current.getContext("2d");
    if (!context) return;
    context.putImageData(new ImageData(new Uint8ClampedArray(sheet.pixels.data), sheet.pixels.width, sheet.pixels.height), 0, 0);
    for (const piece of sheet.analysis.components) {
      context.strokeStyle = COLORS[((groups[piece.id] ?? 1) - 1 + 256) % COLORS.length];
      context.strokeRect(piece.x + 0.5, piece.y + 0.5, Math.max(0, piece.width - 1), Math.max(0, piece.height - 1));
    }
  }, [sheet, groups]);

  async function run(task: "detect" | "convert") {
    if (disabled || files.length !== 1) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(task); onBusyChange(true); setError("");
    try {
      if (task === "detect") {
        const source = await readSpriteComponentFile(files[0], controller.signal);
        const analysis = await detectSpriteComponents(source.pixels, { connectivity }, { signal: controller.signal });
        controller.signal.throwIfAborted();
        if (active.current !== controller) return;
        setSheet({ ...source, analysis });
        setGroups(analysis.components.map(piece => piece.id + 1));
      } else if (sheet) {
        if (groups.some(value => !Number.isInteger(value) || value < 1 || value > 256)) throw Error("Group numbers must be integers from 1 to 256.");
        const next = await importSpriteComponents(sheet.pixels, {
          name: sheet.sourceName.replace(/\.png$/i, "").slice(0, 120),
          sourceName: sheet.sourceName, sourceSha256: sheet.sourceSha256,
          connectivity, groups: groupedIds(groups), padding,
          ...(customAnchor ? { anchor } : {}),
        }, { signal: controller.signal });
        controller.signal.throwIfAborted();
        if (active.current === controller) onImport(next);
      }
    } catch (cause) {
      if (active.current === controller) setError(controller.signal.aborted ? "Import cancelled. Your drawing is unchanged." : cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (active.current === controller) { active.current = null; setBusy(null); onBusyChange(false); }
    }
  }

  const frameSize = sheet ? groupedIds(groups).reduce(([width, height], ids) => {
    const pieces = ids.map(id => sheet.analysis.components[id]);
    return [Math.max(width, Math.max(...pieces.map(p => p.x + p.width)) - Math.min(...pieces.map(p => p.x)) + 2 * padding),
      Math.max(height, Math.max(...pieces.map(p => p.y + p.height)) - Math.min(...pieces.map(p => p.y)) + 2 * padding)];
  }, [0, 0]) : null;
  const locked = !!busy || disabled;
  return <div className="art-component-import">
    <label>Connected pixels<select aria-label="Piece connectivity" value={connectivity} disabled={locked} onChange={event => setConnectivity(Number(event.currentTarget.value) as 4 | 8)}>
      <option value={8}>Edges and diagonals (8 neighbors)</option><option value={4}>Edges only (4 neighbors)</option>
    </select></label>
    <p className="art-craft-note">Choose one transparent PNG. Review pieces before converting; every piece is retained.</p>
    <button type="button" disabled={files.length !== 1 || locked} onClick={() => void run("detect")}>{busy === "detect" ? "Finding pieces…" : "Find pieces"}</button>
    {sheet && <>
      <p role="status">{sheet.analysis.components.length} pieces · {groupedIds(groups).length} sprite groups</p>
      <div className="art-component-preview"><canvas ref={canvas} width={sheet.pixels.width} height={sheet.pixels.height} aria-label="Detected sprite pieces" style={{ width: sheet.pixels.width * Math.max(1, Math.min(4, Math.floor(280 / sheet.pixels.width))), height: sheet.pixels.height * Math.max(1, Math.min(4, Math.floor(280 / sheet.pixels.width))) }} /></div>
      <p className="art-craft-note">Give detached pieces the same group number to join them. Group numbers set frame order; no directions are inferred.</p>
      <div className="art-component-groups">{sheet.analysis.components.map(piece => <label key={piece.id}>
        <span>Piece {piece.id + 1} · {piece.x},{piece.y} · {piece.width}×{piece.height}</span>
        <input aria-label={`Piece ${piece.id + 1} group`} type="number" min={1} max={256} value={groups[piece.id] ?? piece.id + 1} disabled={locked} onChange={event => { const next = Number(event.currentTarget.value); setGroups(current => current.map((value, id) => id === piece.id ? next : value)); }} />
      </label>)}</div>
      <label>Padding<input aria-label="Piece padding" type="number" min={0} max={32} value={padding} disabled={locked} onChange={event => setPadding(Number(event.currentTarget.value))} /></label>
      {frameSize && <p className="art-craft-note">Shared frame: {frameSize[0]}×{frameSize[1]}. Crops start at {padding},{padding}. Default anchor: {Math.floor(frameSize[0] / 2)},{frameSize[1] - 1}.</p>}
      <label className="art-component-anchor"><input aria-label="Use custom import anchor" type="checkbox" checked={customAnchor} disabled={locked} onChange={event => { setCustomAnchor(event.currentTarget.checked); if (event.currentTarget.checked && frameSize) setAnchor([Math.floor(frameSize[0] / 2), frameSize[1] - 1]); }} /><span>Custom anchor</span></label>
      {customAnchor && <div className="art-import-grid">{([0, 1] as const).map(axis => <label key={axis}>Anchor {axis ? "Y" : "X"}<input aria-label={`Piece anchor ${axis ? "Y" : "X"}`} type="number" min={-512} max={512} value={anchor[axis]} disabled={locked} onChange={event => { const next = Number(event.currentTarget.value); setAnchor(current => axis ? [current[0], next] : [next, current[1]]); }} /></label>)}</div>}
      <button type="button" disabled={locked} onClick={() => void run("convert")}>{busy === "convert" ? "Converting…" : "Convert pieces to recipe"}</button>
    </>}
    {busy && <button type="button" onClick={() => active.current?.abort()}>Cancel import</button>}
    {error && <p className="art-import-error" role="alert">{error}</p>}
  </div>;
}
