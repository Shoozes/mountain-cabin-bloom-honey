import { useEffect, useRef, useState } from "react";
import { type ArtRecipe } from "../../packages/grout-art/index.mjs";
import { importSpriteFiles } from "@/art/sprite-import";
import { ArtSpriteComponents } from "@/components/art-sprite-components";

export function ArtSpriteImport({
  recipe,
  disabled,
  onImport,
}: {
  recipe: ArtRecipe;
  disabled: boolean;
  onImport: (recipe: ArtRecipe) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [layout, setLayout] = useState<"single" | "grid" | "components">("single");
  const [width, setWidth] = useState(16),
    [height, setHeight] = useState(16);
  const [margin, setMargin] = useState(0),
    [spacing, setSpacing] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), [recipe, disabled]);
  async function convert() {
    if (!files.length || disabled) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      const next = await importSpriteFiles(
        files,
        layout === "grid" ? { frameWidth: width, frameHeight: height, margin, spacing } : {},
        controller.signal,
      );
      controller.signal.throwIfAborted();
      if (active.current !== controller) return;
      active.current = null;
      onImport(next);
    } catch (cause) {
      if (active.current === controller)
        setError(
          controller.signal.aborted
            ? "Import cancelled. Your drawing is unchanged."
            : cause instanceof Error
              ? cause.message
              : String(cause),
        );
    } finally {
      if (active.current === controller || active.current === null) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <details className="art-inspector-section art-sprite-import">
      <summary>Import sprites &amp; layers</summary>
      <label>
        PNG / GIF files
        <input
          aria-label="Sprite images"
          type="file"
          multiple
          accept={layout === "components" ? "image/png,.png" : "image/png,image/gif,.png,.gif"}
          disabled={busy || disabled}
          onChange={(event) => {
            setFiles(Array.from(event.currentTarget.files ?? []));
            setError("");
          }}
        />
      </label>
      {files.length > 1 && layout !== "components" && (
        <div className="art-import-layers">
          <p>Layer order: bottom to top</p>
          {files.map((file, index) => (
            <div key={index}>
              <span>{file.name}</span>
              <button
                type="button"
                aria-label={`Move ${file.name} down`}
                disabled={!index || busy || disabled}
                onClick={() =>
                  setFiles((current) => {
                    const next = [...current];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    return next;
                  })
                }
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Move ${file.name} up`}
                disabled={index === files.length - 1 || busy || disabled}
                onClick={() =>
                  setFiles((current) => {
                    const next = [...current];
                    [next[index + 1], next[index]] = [next[index], next[index + 1]];
                    return next;
                  })
                }
              >
                ↑
              </button>
            </div>
          ))}
        </div>
      )}
      <label>
        Layout
        <select
          aria-label="Sprite layout"
          value={layout}
          disabled={busy || disabled}
          onChange={(event) => setLayout(event.currentTarget.value as typeof layout)}
        >
          <option value="single">Single sprite</option>
          <option value="grid">Grid sheet</option>
          <option value="components">Loose sprites (transparent PNG)</option>
        </select>
      </label>
      {layout === "grid" && (
        <div className="art-import-grid">
          <label>
            Frame width
            <input
              aria-label="Import frame width"
              type="number"
              min={1}
              max={512}
              value={width}
              disabled={busy || disabled}
              onChange={(event) => setWidth(Number(event.currentTarget.value))}
            />
          </label>
          <label>
            Frame height
            <input
              aria-label="Import frame height"
              type="number"
              min={1}
              max={512}
              value={height}
              disabled={busy || disabled}
              onChange={(event) => setHeight(Number(event.currentTarget.value))}
            />
          </label>
          <label>
            Margin
            <input
              aria-label="Import margin"
              type="number"
              min={0}
              max={256}
              value={margin}
              disabled={busy || disabled}
              onChange={(event) => setMargin(Number(event.currentTarget.value))}
            />
          </label>
          <label>
            Spacing
            <input
              aria-label="Import spacing"
              type="number"
              min={0}
              max={256}
              value={spacing}
              disabled={busy || disabled}
              onChange={(event) => setSpacing(Number(event.currentTarget.value))}
            />
          </label>
        </div>
      )}
      {layout === "components" ? <ArtSpriteComponents files={files} recipe={recipe} disabled={disabled} onImport={onImport} onBusyChange={setBusy} /> : <><p className="art-craft-note">
        {disabled
          ? "Apply or reset your source edits before importing."
          : "Preserves colors, hard transparency, layers and GIF timing. Creates editable masks; no automatic cleanup or outline. Undo restores your current drawing."}
      </p>
      <button
        type="button"
        disabled={!files.length || busy || disabled}
        onClick={() => void convert()}
      >
        {busy ? "Converting…" : "Convert to recipe"}
      </button>
      {busy && (
        <button type="button" onClick={() => active.current?.abort()}>
          Cancel import
        </button>
      )}
      {error && (
        <p className="art-import-error" role="alert">
          {error}
        </p>
      )}
      </>}
    </details>
  );
}
