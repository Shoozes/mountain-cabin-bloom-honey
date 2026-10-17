import type { ArtRecipe } from "../../packages/grout-art/index.mjs";

type Outline = NonNullable<ArtRecipe["outline"]>;
const defaultOutline: Outline = { enabled: false, color: "#26323f", width: 1, corners: "stepped" };

export function ArtOutline({
  recipe,
  disabled,
  onChange,
}: {
  recipe: ArtRecipe;
  disabled: boolean;
  onChange: (recipe: ArtRecipe) => void;
}) {
  const outline = recipe.outline ?? defaultOutline;
  const change = (patch: Partial<Outline>) =>
    onChange({ ...recipe, outline: { ...outline, ...patch } });
  return (
    <details className="art-inspector-section art-outline">
      <summary>Outline</summary>
      <label className="art-outline-toggle">
        <input
          aria-label="Preview and export outline"
          type="checkbox"
          checked={outline.enabled}
          disabled={disabled}
          onChange={(event) => change({ enabled: event.currentTarget.checked })}
        />
        Preview &amp; export outline
      </label>
      {outline.enabled && (
        <>
          <div className="art-outline-controls">
            <label>
              Color
              <input
                aria-label="Outline color"
                type="color"
                value={outline.color}
                disabled={disabled}
                onChange={(event) => change({ color: event.currentTarget.value })}
              />
            </label>
            <label>
              Width
              <select
                aria-label="Outline width"
                value={outline.width}
                disabled={disabled}
                onChange={(event) =>
                  change({ width: Number(event.currentTarget.value) as Outline["width"] })
                }
              >
                <option value={1}>1 pixel</option>
                <option value={2}>2 pixels</option>
                <option value={3}>3 pixels</option>
              </select>
            </label>
          </div>
          <label className="art-outline-corners">
            Corners
            <select
              aria-label="Outline corners"
              value={outline.corners}
              disabled={disabled}
              onChange={(event) =>
                change({ corners: event.currentTarget.value as Outline["corners"] })
              }
            >
              <option value="stepped">Stepped</option>
              <option value="square">Square</option>
            </select>
          </label>
          <p className="art-craft-note">
            Adds a border around the visible layers in every frame. Export bakes it into PNGs; your
            layers and walk cycles stay editable. Borders clip at the frame edges.
          </p>
        </>
      )}
      {disabled && (
        <p className="art-craft-note">
          Apply or reset your source edits before changing the outline.
        </p>
      )}
    </details>
  );
}
