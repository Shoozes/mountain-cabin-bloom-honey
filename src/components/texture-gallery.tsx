import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { CATEGORIES, LOOKS } from "@/shader/catalog";

type ManifestFile = {
  id: string;
  name: string;
  category: string;
  look: string;
  pixels: number;
  exportSize: number;
  palette: string;
  seed: number;
  scale: number;
  wear: number;
  repeat: number;
  path: string;
};

type Manifest = {
  format: string;
  sourceTip: string;
  files: ManifestFile[];
};

type LoadStatus = "loading" | "ready" | "error";

type Counts = {
  all: number;
  byId: Map<string, number>;
};

const STRING_FIELDS = ["id", "name", "category", "look", "palette", "path"] as const;
const NUMBER_FIELDS = ["pixels", "exportSize", "seed", "scale", "wear", "repeat"] as const;

/** Cell size for the 3×3 preview. 96px keeps 3×96 inside a 390px viewport. */
const TILE_NARROW = 96;
const TILE_WIDE = 128;

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

function manifestUrl(): string {
  return `${import.meta.env.BASE_URL}textures/manifest.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isManifestFile(value: unknown): value is ManifestFile {
  if (!isRecord(value)) return false;
  for (const key of STRING_FIELDS) {
    if (typeof value[key] !== "string") return false;
  }
  for (const key of NUMBER_FIELDS) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) return false;
  }
  return true;
}

function isManifest(value: unknown): value is Manifest {
  if (!isRecord(value)) return false;
  if (typeof value.format !== "string" || typeof value.sourceTip !== "string") return false;
  return Array.isArray(value.files) && value.files.every(isManifestFile);
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === "AbortError";
}

function lookLabel(look: string): string {
  return LOOKS.find((item) => item.id === look)?.label ?? look;
}

function pixelsLabel(pixels: number): string {
  return pixels === 0 ? "Smooth" : `${pixels}×${pixels}`;
}

function liveShaderHref(file: ManifestFile): string {
  return `${import.meta.env.BASE_URL}?style=${encodeURIComponent(file.id)}&look=${file.look}&pixels=${file.pixels}&seed=${file.seed}&scale=${file.scale}&wear=${file.wear}&palette=${encodeURIComponent(file.palette)}`;
}

function tileSizeForViewport(): number {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return TILE_WIDE;
  return window.matchMedia("(max-width: 479px)").matches ? TILE_NARROW : TILE_WIDE;
}

function countBy(
  files: ManifestFile[],
  include: (file: ManifestFile) => boolean,
  key: (file: ManifestFile) => string,
): Counts {
  const byId = new Map<string, number>();
  let all = 0;
  for (const file of files) {
    if (!include(file)) continue;
    all += 1;
    const id = key(file);
    byId.set(id, (byId.get(id) ?? 0) + 1);
  }
  return { all, byId };
}

function orderedPresent(order: readonly string[], present: Set<string>): string[] {
  const known = order.filter((id) => present.has(id));
  const extra = [...present].filter((id) => !order.includes(id)).sort();
  return [...known, ...extra];
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ id: string; label: string; count: number }>;
}) {
  return (
    <div className="gallery-filter">
      <p className="gallery-filter-label" aria-hidden="true">
        {label}
      </p>
      <div role="radiogroup" aria-label={label} className="gallery-radios">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            className="cat"
            aria-checked={value === option.id}
            onClick={() => onChange(option.id)}
          >
            {option.label}
            <span className="gallery-n">{option.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailDialog({ file, onClose }: { file: ManifestFile; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tileS, setTileS] = useState(tileSizeForViewport);
  const src = assetUrl(file.path);
  const label = lookLabel(file.look);
  const pixelated = file.look === "pixel";

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 479px)");
    const apply = () => setTileS(query.matches ? TILE_NARROW : TILE_WIDE);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  const dialog = (
    <div
      className="gallery-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="gallery-detail"
        className="gallery-dialog"
        tabIndex={-1}
      >
        <div className="gallery-dialog-head">
          <h2 id={titleId}>{file.name}</h2>
          <button ref={closeRef} type="button" className="gallery-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="gallery-dialog-body">
          <dl className="gallery-facts">
            <dt>Id</dt>
            <dd>{file.id}</dd>
            <dt>Category</dt>
            <dd>{file.category}</dd>
            <dt>Look</dt>
            <dd>{label}</dd>
            <dt>Pixels</dt>
            <dd>{pixelsLabel(file.pixels)}</dd>
            <dt>Export</dt>
            <dd>{file.exportSize}</dd>
            <dt>Seed</dt>
            <dd>{file.seed}</dd>
            <dt>Path</dt>
            <dd>{file.path}</dd>
          </dl>
          <div className="gallery-actions">
            <a data-testid="detail-live-link" href={liveShaderHref(file)}>
              Open live shader
            </a>
            <a href={src} download={`${file.look}-${file.id}.png`}>
              Download PNG
            </a>
          </div>
          <div className="gallery-views">
            <figure className="gallery-view">
              <img
                data-testid="detail-full"
                className={pixelated ? "gallery-full pixelated" : "gallery-full"}
                src={src}
                alt={`${file.name} (${label})`}
                width={file.exportSize}
                height={file.exportSize}
                loading="eager"
                decoding="async"
              />
              <figcaption className="gallery-seam">Full PNG · {file.exportSize}px</figcaption>
            </figure>
            <figure className="gallery-view">
              <div
                data-testid="detail-tiled"
                role="img"
                aria-label={`${file.name} tiled 3×3`}
                className={pixelated ? "gallery-tiled pixelated" : "gallery-tiled"}
                style={{
                  backgroundImage: `url("${src}")`,
                  backgroundRepeat: "repeat",
                  backgroundSize: `${tileS}px ${tileS}px`,
                  width: tileS * 3,
                  height: tileS * 3,
                }}
              />
              <figcaption className="gallery-seam">3×3 repeat — seams show here</figcaption>
            </figure>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}

export function TextureGallery() {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [look, setLook] = useState("all");
  const [selected, setSelected] = useState<ManifestFile | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      try {
        const response = await fetch(manifestUrl(), { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Manifest request failed (${response.status})`);
        }
        const payload: unknown = await response.json();
        if (!isManifest(payload)) {
          throw new Error("Manifest shape was not recognized");
        }
        if (!active) return;
        setManifest(payload);
        setStatus("ready");
      } catch (caught: unknown) {
        if (!active || isAbortError(caught)) return;
        const detail = caught instanceof Error ? caught.message : "The request failed.";
        setError(`Could not load the texture corpus. ${detail}`);
        setStatus("error");
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  useEffect(() => {
    if (selected) return;
    const node = returnFocus.current;
    if (!node) return;
    returnFocus.current = null;
    node.focus();
  }, [selected]);

  const files = useMemo(() => manifest?.files ?? [], [manifest]);

  const categories = useMemo(
    () => orderedPresent(CATEGORIES, new Set(files.map((file) => file.category))),
    [files],
  );
  const looks = useMemo(() => {
    const order = LOOKS.map((item) => item.id);
    return orderedPresent(order, new Set(files.map((file) => file.look)));
  }, [files]);

  const categoryCounts = useMemo(
    () =>
      countBy(
        files,
        (file) => look === "all" || file.look === look,
        (file) => file.category,
      ),
    [files, look],
  );
  const lookCounts = useMemo(
    () =>
      countBy(
        files,
        (file) => category === "all" || file.category === category,
        (file) => file.look,
      ),
    [files, category],
  );
  const visible = useMemo(
    () =>
      files.filter(
        (file) =>
          (category === "all" || file.category === category) &&
          (look === "all" || file.look === look),
      ),
    [files, category, look],
  );

  function openFile(file: ManifestFile) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected(file);
  }

  const subtitle =
    status === "ready" && manifest
      ? `${manifest.files.length} baked PNGs · ${manifest.sourceTip.slice(0, 7)}`
      : status === "error"
        ? (error ?? "Could not load the texture corpus.")
        : "Loading corpus…";

  return (
    <main className="gallery" data-open={selected ? "true" : "false"}>
      <header className="gallery-header">
        <div className="gallery-heading">
          <h1 className="gallery-title">Texture gallery</h1>
          <p className="gallery-sub" role={status === "error" ? "alert" : undefined}>
            {subtitle}
          </p>
        </div>
        <Link to="/" className="gallery-back" data-testid="gallery-app-link">
          Live shader
        </Link>
      </header>

      {status === "ready" ? (
        <>
          <div className="gallery-filters">
            <FilterGroup
              label="Category"
              value={category}
              onChange={setCategory}
              options={[
                { id: "all", label: "All", count: categoryCounts.all },
                ...categories.map((id) => ({
                  id,
                  label: id,
                  count: categoryCounts.byId.get(id) ?? 0,
                })),
              ]}
            />
            <FilterGroup
              label="Look"
              value={look}
              onChange={setLook}
              options={[
                { id: "all", label: "All", count: lookCounts.all },
                ...looks.map((id) => ({
                  id,
                  label: lookLabel(id),
                  count: lookCounts.byId.get(id) ?? 0,
                })),
              ]}
            />
          </div>
          <p className="gallery-shown" aria-live="polite">
            <span data-testid="gallery-count">{visible.length}</span>
            <span> textures</span>
          </p>
          {visible.length === 0 ? (
            <p className="gallery-status">No textures match these filters.</p>
          ) : (
            <div className="gallery-grid">
              {visible.map((file) => {
                const label = lookLabel(file.look);
                return (
                  <button
                    key={`${file.look}/${file.id}`}
                    type="button"
                    className="gallery-tile"
                    data-testid="gallery-tile"
                    data-id={file.id}
                    data-look={file.look}
                    data-category={file.category}
                    onClick={() => openFile(file)}
                  >
                    <img
                      className={file.look === "pixel" ? "gallery-img pixelated" : "gallery-img"}
                      src={assetUrl(file.path)}
                      alt={`${file.name} (${label})`}
                      width={file.exportSize}
                      height={file.exportSize}
                      loading="eager"
                      decoding="async"
                    />
                    <span className="gallery-name">{file.name}</span>
                    <span className="gallery-meta">
                      {file.category} · {label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {selected ? <DetailDialog file={selected} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}
