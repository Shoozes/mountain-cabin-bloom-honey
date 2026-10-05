import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CATEGORIES,
  LOOKS,
  PALETTES,
  SIZES,
  STYLE_COUNT,
  STYLES,
  getStyle,
  lookValue,
  resolvePalette,
  type Category,
  type LookId,
} from "@/shader/catalog";
import { hexToRgb, ShaderMill, type DrawParams } from "@/shader/engine";
import {
  JUDGE_REFS,
  matchScore,
  readFeatures,
  refForStyle,
  seamError,
  verdict,
} from "@/shader/judge";
import { glslText, recipeText } from "@/shader/recipe";
import { zipStore } from "@/shader/zip-store";

type JudgeRow = {
  id: string;
  name: string;
  ref: string;
  seam: number;
  match: number | null;
  pass: boolean;
  reason: string;
};

const STORAGE_KEY = "grout-shader-v1";

const SCALE_CHOICES = [1, 2, 3, 4] as const;
const REPEAT_CHOICES = [1, 2, 3, 4] as const;
const EXPORT_CHOICES = [32, 64, 128, 256, 512] as const;

type MillState = {
  styleId: string;
  seed: number;
  scale: number;
  pixels: number;
  wear: number;
  repeat: number;
  animate: boolean;
  paletteId: string;
  look: LookId;
  exportSize: number;
  favorites: string[];
  category: "All" | "Kept" | Category;
  query: string;
};

const INITIAL: MillState = {
  styleId: "brick",
  seed: 1204,
  scale: 1,
  pixels: 32,
  wear: 0.35,
  repeat: 2,
  animate: false,
  paletteId: "style",
  look: "pixel",
  exportSize: 256,
  favorites: [],
  category: "All",
  query: "",
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function loadState(): MillState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return { ...INITIAL, animate: !reduce };
    }
    const data = JSON.parse(raw);
    const styleId = STYLES.some((style) => style.id === data.styleId) ? data.styleId : INITIAL.styleId;
    const pixels = SIZES.some((size) => size.value === data.pixels) ? data.pixels : INITIAL.pixels;
    const scale = SCALE_CHOICES.includes(data.scale) ? data.scale : 1;
    const repeat = REPEAT_CHOICES.includes(data.repeat) ? data.repeat : 2;
    const exportSize = EXPORT_CHOICES.includes(data.exportSize) ? data.exportSize : 256;
    const paletteId = PALETTES.some((palette) => palette.id === data.paletteId) ? data.paletteId : "style";
    const look = LOOKS.some((item) => item.id === data.look) ? (data.look as LookId) : INITIAL.look;
    let category: MillState["category"] = "All";
    if (data.category === "All" || data.category === "Kept") category = data.category;
    else if (typeof data.category === "string" && (CATEGORIES as readonly string[]).includes(data.category)) {
      category = data.category as Category;
    }
    const seedNum = Number(data.seed);
    const wearNum = Number(data.wear);
    const favorites = Array.isArray(data.favorites)
      ? data.favorites.filter((id: string) => STYLES.some((style) => style.id === id))
      : [];
    return {
      styleId,
      seed: clamp(Number.isFinite(seedNum) ? Math.round(seedNum) : INITIAL.seed, 0, 999999),
      scale,
      pixels,
      wear: clamp(Number.isFinite(wearNum) ? wearNum : INITIAL.wear, 0, 1),
      repeat,
      animate: Boolean(data.animate),
      paletteId,
      look,
      exportSize,
      favorites,
      category,
      query: "",
    };
  } catch {
    return INITIAL;
  }
}

function paramsFor(state: MillState, time: number): DrawParams {
  const colors = resolvePalette(getStyle(state.styleId), state.paletteId).map(hexToRgb) as DrawParams["colors"];
  return {
    seed: state.seed,
    scale: state.scale,
    pixels: state.pixels,
    wear: state.wear,
    repeat: state.repeat,
    time,
    look: lookValue(state.look),
    colors,
  };
}

function thumbParams(styleId: string, pixels: number, look: number): DrawParams {
  return {
    seed: 7,
    scale: 1,
    pixels,
    wear: 0.28,
    repeat: 1,
    time: 0,
    look,
    colors: getStyle(styleId).palette.map(hexToRgb) as DrawParams["colors"],
  };
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function snapshot(source: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  const ctx = copy.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);
  return copy;
}

function canvasPng(source: HTMLCanvasElement): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    source.toBlob(async (blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
}

export function MillApp() {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const utilRef = useRef<HTMLCanvasElement>(null);
  const millRef = useRef<ShaderMill | null>(null);
  const stateRef = useRef(INITIAL);
  const drawRef = useRef<(() => void) | null>(null);
  const restartRef = useRef<() => void>(() => {});
  const catalogBusy = useRef(false);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<MillState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [mixOpen, setMixOpen] = useState(false);
  const [judgeOpen, setJudgeOpen] = useState(false);
  const [judgeBusy, setJudgeBusy] = useState(false);
  const [judgeRows, setJudgeRows] = useState<JudgeRow[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [shaderErrors, setShaderErrors] = useState<Record<string, string>>({});
  const [glError, setGlError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [fired, setFired] = useState(0);

  stateRef.current = state;

  useEffect(() => {
    const canvas = displayRef.current;
    const util = utilRef.current;
    if (!canvas || !util) return;

    let mill: ShaderMill;
    try {
      mill = new ShaderMill(canvas, util);
    } catch (error) {
      setGlError(error instanceof Error ? error.message : "WebGL failed to start.");
      return;
    }
    millRef.current = mill;

    let frame = 0;
    let alive = true;
    const startedAt = performance.now();

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const paint = (time: number) => {
      const current = stateRef.current;
      const style = getStyle(current.styleId);
      resize();
      mill.drawDisplay(canvas, style, paramsFor(current, time));
      const message = mill.error(style.id);
      if (message) {
        setShaderErrors((prev) => (prev[style.id] === message ? prev : { ...prev, [style.id]: message }));
      }
    };

    const loop = (now: number) => {
      if (!alive) return;
      const current = stateRef.current;
      const style = getStyle(current.styleId);
      if (!(current.animate && style.motion) || document.visibilityState === "hidden") return;
      paint((now - startedAt) / 1000);
      frame = requestAnimationFrame(loop);
    };

    const draw = () => {
      cancelAnimationFrame(frame);
      const current = stateRef.current;
      const style = getStyle(current.styleId);
      if (current.animate && style.motion && document.visibilityState !== "hidden") {
        frame = requestAnimationFrame(loop);
      } else {
        paint(0);
      }
    };
    drawRef.current = draw;

    const onResize = () => draw();
    const observer = new ResizeObserver(onResize);
    observer.observe(canvas);
    document.addEventListener("visibilitychange", draw);

    let index = 0;
    let queue = STYLES.slice();
    const pending: Record<string, string> = {};
    const problems: Record<string, string> = {};
    let pumpTimer = 0;
    let generation = 0;

    const orderQueue = () => {
      queue = STYLES.slice();
      const currentAt = queue.findIndex((item) => item.id === stateRef.current.styleId);
      if (currentAt > 0) {
        const current = queue[currentAt];
        if (current) {
          queue.splice(currentAt, 1);
          queue.unshift(current);
        }
      }
    };

    const flush = (done: number) => {
      const thumbKeys = Object.keys(pending);
      if (thumbKeys.length) {
        const batch = { ...pending };
        for (const key of thumbKeys) delete pending[key];
        setThumbs((prev) => ({ ...prev, ...batch }));
      }
      const problemKeys = Object.keys(problems);
      if (problemKeys.length) {
        const batch = { ...problems };
        for (const key of problemKeys) delete problems[key];
        setShaderErrors((prev) => ({ ...prev, ...batch }));
      }
      setFired(done);
    };

    const step = () => {
      if (!alive) return;
      const gen = generation;
      if (document.visibilityState === "hidden") {
        pumpTimer = window.setTimeout(step, 500);
        return;
      }
      const style = queue[index];
      if (!style) {
        flush(index);
        return;
      }
      index += 1;
      const current = stateRef.current;
      const key = `${style.id}:${current.look}:${current.pixels}`;
      const url = mill.thumbnail(util, style, thumbParams(style.id, current.pixels, lookValue(current.look)), key);
      if (gen !== generation) return;
      if (url) pending[style.id] = url;
      const message = mill.error(style.id);
      if (message) problems[style.id] = message;
      if (index === queue.length || index % 4 === 0) flush(index);
      if (index < queue.length) {
        pumpTimer = window.setTimeout(step, index < 8 ? 16 : 48);
      }
    };

    const restart = () => {
      generation += 1;
      index = 0;
      for (const key of Object.keys(pending)) delete pending[key];
      for (const key of Object.keys(problems)) delete problems[key];
      orderQueue();
      mill.clearThumbs();
      window.clearTimeout(pumpTimer);
      pumpTimer = window.setTimeout(step, 32);
    };
    restartRef.current = restart;

    draw();

    return () => {
      alive = false;
      window.clearTimeout(pumpTimer);
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", draw);
      mill.dispose();
      millRef.current = null;
      restartRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setThumbs({});
    setFired(0);
    restartRef.current();
  }, [hydrated, state.look, state.pixels]);

  useEffect(() => {
    if (!hydrated) return;
    drawRef.current?.();
  }, [
    hydrated,
    state.styleId,
    state.seed,
    state.scale,
    state.pixels,
    state.wear,
    state.repeat,
    state.animate,
    state.paletteId,
    state.look,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    const { query: _query, ...rest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  }, [hydrated, state]);

  const style = getStyle(state.styleId);
  const colors = resolvePalette(style, state.paletteId);
  const visible = useMemo(() => {
    const q = state.query.trim().toLowerCase();
    return STYLES.filter((item) => {
      if (state.category === "Kept" && !state.favorites.includes(item.id)) return false;
      if (state.category !== "All" && state.category !== "Kept" && item.category !== state.category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.id.includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.blurb.toLowerCase().includes(q) ||
        (item.preset?.includes(q) ?? false)
      );
    });
  }, [state.category, state.favorites, state.query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)
      ) {
        return;
      }
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const list = visible.length ? visible : STYLES;
      const current = Math.max(0, list.findIndex((item) => item.id === stateRef.current.styleId));
      const next =
        event.key === "ArrowRight"
          ? list[(current + 1) % list.length]
          : list[(current - 1 + list.length) % list.length];
      if (!next) return;
      event.preventDefault();
      setState((prev) => ({ ...prev, styleId: next.id }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [state.styleId, state.category, visible.length]);

  useEffect(() => {
    if (!mixOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMixOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mixOpen]);

  const recipe = recipeText(style, {
    seed: state.seed,
    scale: state.scale,
    pixels: state.pixels,
    wear: state.wear,
    paletteId: state.paletteId,
    look: state.look,
    colors,
  });
  const patch = (partial: Partial<MillState>) => setState((prev) => ({ ...prev, ...partial }));

  const runJudge = async () => {
    setJudgeOpen(true);
    setMixOpen(false);
    setJudgeBusy(true);
    setJudgeRows([]);
    const display = document.createElement("canvas");
    const util = document.createElement("canvas");
    const mill = new ShaderMill(display, util);
    const read = document.createElement("canvas");
    read.width = 96;
    read.height = 96;
    const ctx = read.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      mill.dispose();
      setJudgeBusy(false);
      return;
    }
    const samples = new Map<string, ReturnType<typeof readFeatures>>();
    for (const ref of JUDGE_REFS) {
      const img = new Image();
      img.src = ref.file;
      await img.decode();
      ctx.clearRect(0, 0, 96, 96);
      ctx.drawImage(img, 0, 0, 96, 96);
      samples.set(ref.id, readFeatures(ctx.getImageData(0, 0, 96, 96).data, 96, 96));
    }
    const rows: JudgeRow[] = [];
    for (const style of STYLES) {
      const ref = refForStyle(style.id);
      util.width = 96;
      util.height = 96;
      const colors = style.palette.map(hexToRgb) as DrawParams["colors"];
      const ok = mill.drawUtil(util, style, {
        seed: 7,
        scale: 1,
        pixels: 0,
        wear: 0.08,
        repeat: 1,
        time: 0,
        look: 2,
        colors,
      });
      ctx.clearRect(0, 0, 96, 96);
      if (ok) ctx.drawImage(util, 0, 0, 96, 96);
      const data = ctx.getImageData(0, 0, 96, 96).data;
      const sample = readFeatures(data, 96, 96);
      const seam = ok ? seamError(data, 96, 96) : 1;
      const refSample = ref ? samples.get(ref.id) : undefined;
      const match = refSample ? matchScore(sample, refSample) : null;
      const result = verdict(seam, match, sample.std < 6, ok);
      rows.push({
        id: style.id,
        name: style.name,
        ref: ref?.label ?? "—",
        seam,
        match,
        pass: result.pass,
        reason: result.reason,
      });
      setJudgeRows(rows.slice());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    mill.dispose();
    for (const canvas of [display, util]) {
      canvas.getContext("webgl")?.getExtension("WEBGL_lose_context")?.loseContext();
    }
    setJudgeBusy(false);
  };
  const fileBase = `grout-${style.id}-s${state.seed}-${state.pixels || "smooth"}`;

  const grabTile = (seed: number) => {
    const mill = millRef.current;
    const util = utilRef.current;
    if (!mill || !util) return false;
    util.width = state.exportSize;
    util.height = state.exportSize;
    return mill.drawUtil(util, style, { ...paramsFor(state, 0), seed, repeat: 1 });
  };

  const exportPng = () => {
    const util = utilRef.current;
    if (!util || !grabTile(state.seed)) {
      setStatus("Could not render that tile.");
      return;
    }
    const shot = snapshot(util);
    if (!shot) {
      setStatus("Could not render that tile.");
      return;
    }
    shot.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `${fileBase}.png`);
      setStatus("Tile saved");
    }, "image/png");
  };

  const exportAtlas = () => {
    const util = utilRef.current;
    if (!util) return;
    const size = state.exportSize;
    const atlas = document.createElement("canvas");
    atlas.width = size * 2;
    atlas.height = size * 2;
    const ctx = atlas.getContext("2d");
    if (!ctx) return;
    const seeds = [state.seed, state.seed + 11, state.seed + 29, state.seed + 47];
    for (let i = 0; i < seeds.length; i += 1) {
      const seed = seeds[i];
      if (seed === undefined || !grabTile(seed)) {
        setStatus("Could not render the atlas.");
        return;
      }
      ctx.drawImage(util, (i % 2) * size, Math.floor(i / 2) * size, size, size);
    }
    atlas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `${fileBase}-atlas.png`);
      setStatus("Atlas saved");
    }, "image/png");
  };

  const exportCatalog = async () => {
    if (catalogBusy.current) return;
    catalogBusy.current = true;
    setStatus("Rendering catalog…");
    const display = document.createElement("canvas");
    const util = document.createElement("canvas");
    const mill = new ShaderMill(display, util);
    const size = state.exportSize;
    const files: { name: string; data: Uint8Array }[] = [];
    try {
      for (const item of STYLES) {
        util.width = size;
        util.height = size;
        const params = paramsFor({ ...state, styleId: item.id }, 0);
        params.repeat = 1;
        if (!mill.drawUtil(util, item, params)) continue;
        const shot = snapshot(util);
        const data = shot ? await canvasPng(shot) : null;
        if (!data) continue;
        files.push({ name: `${item.category.toLowerCase()}/${item.id}.png`, data });
        if (files.length % 6 === 0) setStatus(`Catalog ${files.length} / ${STYLES.length}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      mill.dispose();
      for (const canvas of [display, util]) {
        canvas.getContext("webgl")?.getExtension("WEBGL_lose_context")?.loseContext();
      }
      catalogBusy.current = false;
    }
    if (!files.length) {
      setStatus("Could not render the catalog.");
      return;
    }
    downloadBlob(zipStore(files), `grout-catalog-${state.pixels || "smooth"}-${state.look}.zip`);
    setStatus(`Catalog saved, ${files.length} PNGs`);
  };

  const kept = state.favorites.includes(style.id);
  const activeError = shaderErrors[style.id] ?? glError;
  const chunky = state.pixels > 0 || state.look === "pixel";

  return (
    <main className="bench">
      <header className="top">
        <div className="id">
          <p className="mark">
            {fired > 0 && fired < STYLE_COUNT
              ? `Firing ${fired} / ${STYLE_COUNT}`
              : style.preset
                ? "Reviewed"
                : style.category}
          </p>
          <h1>{style.name}</h1>
        </div>
        <div className="top-actions">
          <button type="button" aria-expanded={judgeOpen} onClick={() => (judgeOpen ? setJudgeOpen(false) : void runJudge())}>
            {judgeBusy ? "Judging" : "Judge"}
          </button>
          <button type="button" aria-expanded={mixOpen} onClick={() => setMixOpen((open) => !open)}>
            Adjust
          </button>
          <button type="button" className="primary" onClick={exportPng}>
            Save
          </button>
        </div>
      </header>

      <section className="stage" aria-label="Texture preview">
        <canvas
          ref={displayRef}
          className={chunky ? "pixelated" : undefined}
          aria-label={`${style.name} texture preview`}
        />
        {glError ? <p className="stage-error">{glError}</p> : null}
      </section>

      <div className="finder">
        <input
          className="rack-search"
          type="search"
          value={state.query}
          onChange={(event) => patch({ query: event.target.value })}
          placeholder="Search textures"
          aria-label="Search styles"
        />
        <div className="cats" role="tablist" aria-label="Categories">
          {(["All", "Kept", ...CATEGORIES] as const).map((category) => {
            const on = state.category === category;
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => patch({ category })}
                className="cat"
              >
                {category}
              </button>
            );
          })}
        </div>
        <div className="looks">
          <div className="cat-set" role="radiogroup" aria-label="Look">
            {LOOKS.map((look) => (
              <button
                key={look.id}
                type="button"
                role="radio"
                aria-checked={state.look === look.id}
                className="cat"
                onClick={() =>
                  patch({
                    look: look.id,
                    pixels: look.id === "pixel" ? state.pixels || 32 : 0,
                  })
                }
              >
                {look.label}
              </button>
            ))}
          </div>
          <div className="cat-set" role="radiogroup" aria-label="Size">
            {SIZES.map((size) => (
              <button
                key={size.value}
                type="button"
                role="radio"
                aria-checked={state.pixels === size.value}
                className="cat"
                onClick={() => patch({ pixels: size.value })}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-scroll">
        {visible.length === 0 ? (
          <p className="recipe-empty">Nothing matches.</p>
        ) : (
          <ul className="tile-grid">
            {visible.map((item) => {
              const selected = item.id === style.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    ref={selected ? selectedRef : undefined}
                    aria-pressed={selected}
                    aria-label={item.name}
                    onClick={() => patch({ styleId: item.id })}
                    className="tile"
                  >
                    <span className="tile-face">
                      {thumbs[item.id] ? (
                        <img src={thumbs[item.id]} alt="" className={chunky ? "pixelated" : undefined} />
                      ) : (
                        <span className="tile-fallback" aria-hidden="true">
                          {item.palette.map((color) => (
                            <i key={color} style={{ background: color }} />
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="tile-name">{item.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <canvas ref={utilRef} className="util-canvas" aria-hidden="true" />

      <section className="judge" data-open={judgeOpen} inert={!judgeOpen} aria-label="Reference judge">
        <div className="judge-head">
          <h2>Reference judge</h2>
          <button type="button" onClick={() => setJudgeOpen(false)}>
            Close
          </button>
        </div>
        <p className="lede">
          Each scored texture is compared with a generated seamless tile of the same material. A pass means it
          tiles and sits close to that tile.
        </p>
        <p className="judge-sum" data-judge-sum="true">
          {judgeRows
            ? `${judgeRows.filter((row) => row.pass).length} pass / ${judgeRows.filter((row) => row.reason !== "no reference").length} scored${judgeBusy ? "…" : ""}`
            : "Running…"}
        </p>
        <ul className="judge-list">
          {(judgeRows ?? [])
            .filter((row) => row.reason !== "no reference")
            .map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="judge-row"
                  data-pass={row.pass}
                  data-judge-row={row.id}
                  data-seam={row.seam.toFixed(3)}
                  data-match={row.match === null ? "" : row.match.toFixed(3)}
                  data-reason={row.reason}
                  onClick={() => {
                    patch({ styleId: row.id, look: "real", pixels: 0 });
                    setJudgeOpen(false);
                  }}
                >
                  <span>{row.name}</span>
                  <span className="judge-ref">{row.ref}</span>
                  <span>{row.match === null ? "—" : row.match.toFixed(2)}</span>
                  <span>{row.pass ? "Pass" : row.reason}</span>
                </button>
              </li>
            ))}
        </ul>
      </section>

      <section className="details" data-open={mixOpen} inert={!mixOpen} aria-label="Adjust texture">
        <h2>{style.name}</h2>
        <p className="lede">{style.blurb}</p>
        {activeError ? <p className="shader-fault">{activeError}</p> : null}

        <div className="fields">
          <label className="field">
            Seed
            <span className="inline">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={999999}
                value={state.seed}
                aria-label="Seed"
                onChange={(event) =>
                  patch({ seed: clamp(Math.round(Number(event.target.value) || 0), 0, 999999) })
                }
              />
              <button
                type="button"
                className="ghost"
                onClick={() => patch({ seed: Math.floor(Math.random() * 100000) })}
              >
                Random
              </button>
            </span>
          </label>
          <Field label="Repeat">
            <select
              aria-label="Seam check"
              value={state.repeat}
              onChange={(event) => patch({ repeat: Number(event.target.value) })}
            >
              {REPEAT_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </Field>
          <Field label="Scale">
            <select
              aria-label="Motif scale"
              value={state.scale}
              onChange={(event) => patch({ scale: Number(event.target.value) })}
            >
              {SCALE_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </Field>
          <label className="field">
            Wear
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={state.wear}
              aria-label="Wear"
              aria-valuetext={state.wear.toFixed(2)}
              onChange={(event) => patch({ wear: Number(event.target.value) })}
            />
          </label>
          <Field label="Export">
            <select
              aria-label="Export size"
              value={state.exportSize}
              onChange={(event) => patch({ exportSize: Number(event.target.value) })}
            >
              {EXPORT_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {value} px
                </option>
              ))}
            </select>
          </Field>
          <div className="palette-row" role="radiogroup" aria-label="Palette">
            {PALETTES.map((palette) => {
              const swatch = palette.colors ?? style.palette;
              const on = state.paletteId === palette.id;
              return (
                <button
                  key={palette.id}
                  type="button"
                  role="radio"
                  aria-label={palette.name}
                  aria-checked={on}
                  onClick={() => patch({ paletteId: palette.id })}
                  className="palette-chip"
                >
                  <span className="swatches" aria-hidden="true">
                    {swatch.map((color) => (
                      <i key={color} style={{ background: color }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="links">
          <button
            type="button"
            aria-pressed={state.animate}
            onClick={() => patch({ animate: !state.animate })}
          >
            Drift {state.animate ? "on" : "off"}
          </button>
          <button
            type="button"
            aria-pressed={kept}
            onClick={() =>
              patch({
                favorites: kept
                  ? state.favorites.filter((id) => id !== style.id)
                  : [...state.favorites, style.id],
              })
            }
          >
            {kept ? "Kept" : "Keep"}
          </button>
          <button type="button" onClick={exportAtlas}>
            2×2 atlas
          </button>
          <button type="button" onClick={() => void exportCatalog()}>
            PNG catalog
          </button>
          <button
            type="button"
            onClick={() => {
              void copyText(recipe).then((ok) =>
                setStatus(ok ? "Recipe copied" : "Copy failed — select the recipe below"),
              );
            }}
          >
            Copy recipe
          </button>
          <button
            type="button"
            onClick={() => {
              const source = glslText(style, {
                seed: state.seed,
                scale: state.scale,
                pixels: state.pixels,
                wear: state.wear,
                paletteId: state.paletteId,
                look: state.look,
                colors,
              });
              void copyText(source).then((ok) => setStatus(ok ? "GLSL copied" : "Copy failed"));
            }}
          >
            Copy GLSL
          </button>
        </div>
        <p className="drawer-status">{status}</p>
        <pre>{recipe}</pre>
        <button type="button" className="done" onClick={() => setMixOpen(false)}>
          Done
        </button>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      {label}
      {children}
    </label>
  );
}
