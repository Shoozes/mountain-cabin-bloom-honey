import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from "react";
import {
  createExampleRecipe,
  createRenderer,
  createTravelerRecipe,
  getTravelerWardrobe,
  setTravelerWardrobe,
  refineTravelerWalk,
  TRAVELER_CLOTHING,
  TRAVELER_HATS,
  TRAVELER_PALETTES,
  type TravelerClothing,
  type TravelerHat,
  type TravelerPalette,
  type TravelerWardrobeOptions,
  editPixel,
  extractFrame,
  floodFill,
  moveSelection,
  parseRecipe,
  renderFrame,
  type ArtRecipe,
  type ArtRenderer,
  type RecipeMetrics,
  type Pixels,
  captureCharacterEdits,
  compileCharacter,
  createCharacterCreator,
  createCharacterDocument,
  parseCharacterDocument,
  type CharacterCreator,
  type CharacterDocument,
} from "../../packages/grout-art/index.mjs";
import { buildArtExport, measureRecipe } from "../../packages/grout-art/index.mjs";
import { exportArtZip } from "@/art/art-export";
import { ArtSpriteImport } from "@/components/art-sprite-import";
import { ArtSpriteVariations } from "@/components/art-sprite-variations";
import { ArtRecipeOptimization } from "@/components/art-recipe-optimization";
import { ArtOutline } from "@/components/art-outline";
import { getWorkbenchExample } from "@/art/examples.mjs";
import { ArtCharacterCreator } from "@/components/art-character-creator";
import "@/art/studio.css";

type Tool = "pencil" | "erase" | "fill" | "select" | "move";
type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
type CanvasPixels = { width: number; height: number; data: Uint8Array };
type AtlasReport = { pixels: CanvasPixels | null; text: string; reconstructed: number; frames: number; pages: number };
const BASE_URL = import.meta.env.BASE_URL;

function appPath(path: string) {
  return `${BASE_URL}${path.replace(/^\/+/, "")}`;
}

const DRAFT_KEY = "grout-art-studio/1";
const exampleDraftKey = (id: string | null) => id ? `${DRAFT_KEY}:example:${id}` : DRAFT_KEY;
const draftSourceKey = (id: string | null) => `${exampleDraftKey(id)}:source`;
const TOOL_LABELS: Record<Tool, string> = {
  pencil: "Pencil",
  erase: "Erase",
  fill: "Fill",
  select: "Select",
  move: "Move selection",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function recipePixels(value: unknown): CanvasPixels | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { width?: unknown; height?: unknown; data?: unknown; pixels?: unknown; rgba?: unknown };
  if (Number.isInteger(candidate.width) && Number.isInteger(candidate.height)) {
    const data = candidate.data ?? candidate.pixels ?? candidate.rgba;
    if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
      return { width: candidate.width as number, height: candidate.height as number, data: new Uint8Array(data) };
    }
  }
  return null;
}

function drawPixels(canvas: HTMLCanvasElement | null, pixels: CanvasPixels | Pixels | null) {
  if (!canvas) return;
  if (!pixels) {
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (canvas.width !== pixels.width) canvas.width = pixels.width;
  if (canvas.height !== pixels.height) canvas.height = pixels.height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  const image = new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
  context.putImageData(image, 0, 0);
}

function pixelAt(event: PointerEvent<HTMLCanvasElement>, zoom: number, recipe: ArtRecipe): Point {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(recipe.width - 1, Math.floor((event.clientX - bounds.left) / zoom))),
    y: Math.max(0, Math.min(recipe.height - 1, Math.floor((event.clientY - bounds.top) / zoom))),
  };
}

function boxBetween(a: Point, b: Point): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}

function byteLabel(value: number | null) {
  return value === null ? "not measured" : `${value.toLocaleString()} bytes`;
}

export function ArtStudio() {
  const [recipe, setRecipe] = useState<ArtRecipe>(() => createTravelerRecipe());
  const recipeRef = useRef(recipe);
  const [characterWorkspace, setCharacterWorkspace] = useState(false);
  const [characterCreator, setCharacterCreator] = useState<CharacterCreator>(() => createCharacterCreator());
  const [characterDocument, setCharacterDocument] = useState<CharacterDocument>(() => createCharacterDocument());
  const [characterRecoveryCorrupt, setCharacterRecoveryCorrupt] = useState(false);
  const [spriteRecoveryCorrupt, setSpriteRecoveryCorrupt] = useState(false);
  const [importedCharacterRecipe, setImportedCharacterRecipe] = useState<ArtRecipe | null>(null);
  const [booted, setBooted] = useState(false);
  const [exampleId, setExampleId] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [selectedLayer, setSelectedLayer] = useState("");
  const [activeRole, setActiveRole] = useState("");
  const [tool, setTool] = useState<Tool>("pencil");
  const [zoom, setZoom] = useState(16);
  const [onionSkin, setOnionSkin] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [clipId, setClipId] = useState("walk-south");
  const [clipPosition, setClipPosition] = useState(0);
  const [backend, setBackend] = useState<"auto" | "cpu" | "webgl2" | "webgpu">("auto");
  const [actualBackend, setActualBackend] = useState("waiting");
  const [rendererDiagnostics, setRendererDiagnostics] = useState<string[]>([]);
  const [selection, setSelection] = useState<Box | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [includeCss, setIncludeCss] = useState(false);
  const [includeGif, setIncludeGif] = useState(false);
  const [includeSvg, setIncludeSvg] = useState(false);
  const [metrics, setMetrics] = useState<RecipeMetrics | null>(null);
  const [metricsPending, setMetricsPending] = useState(false);
  const [backendProbe, setBackendProbe] = useState<Array<{ requested: string; actual?: string; ms?: number; byteDifference?: number; status: string }>>([]);
  const [backendProbePending, setBackendProbePending] = useState(false);
  const [atlasReport, setAtlasReport] = useState<AtlasReport | null>(null);
  const [rendererEpoch, setRendererEpoch] = useState(0);
  const [recipeText, setRecipeText] = useState("");
  const [recipeTextDirty, setRecipeTextDirty] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onionRef = useRef<HTMLCanvasElement>(null);
  const atlasCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ArtRenderer | null>(null);
  const activeRender = useRef<AbortController | null>(null);
  const activeExport = useRef<AbortController | null>(null);
  const exportObjectUrl = useRef<string | null>(null);
  const exportRevokeTimer = useRef<number | null>(null);
  const rendererRequest = useRef(0);
  const backendProbeAbort = useRef<AbortController | null>(null);
  const historyPast = useRef<ArtRecipe[]>([]);
  const historyFuture = useRef<ArtRecipe[]>([]);
  const pointerStroke = useRef<{ start: Point; last: Point; tool: Tool; moved: boolean } | null>(null);
  const strokeChanged = useRef(false);
  const activeRoleRef = useRef(activeRole);
  const selectedLayerRef = useRef(selectedLayer);
  activeRoleRef.current = activeRole;
  selectedLayerRef.current = selectedLayer;

  const firstVisibleLayer = recipe.layers.find((layer) => layer.visible && recipe.frames[frameIndex]?.layers?.[layer.id]?.visible !== false)?.id ?? recipe.layers[0]?.id ?? "";
  const layerId = recipe.layers.some((layer) => layer.id === selectedLayer) ? selectedLayer : firstVisibleLayer;
  const selectedLayerHidden = recipe.layers.find((layer) => layer.id === layerId)?.visible === false || recipe.frames[frameIndex]?.layers?.[layerId]?.visible === false;
  const roles = useMemo(() => Object.keys(recipe.palette), [recipe.palette]);
  const wardrobe = useMemo(() => getTravelerWardrobe(recipe), [recipe]);
  const clips = recipe.clips;
  const clipNames = Object.keys(clips);
  const activeClip = clips[clipId] ?? clips[clipNames[0] ?? ""];
  const clipFrames = activeClip?.frames ?? recipe.frames.map((frame) => frame.name);
  const currentFrameName = recipe.frames[frameIndex]?.name;
  const selectedExample = getWorkbenchExample(exampleId);
  const isAtlasExample = exampleId === "atlas";
  const isComparisonExample = exampleId === "comparison";

  const replaceRecipe = useCallback((next: ArtRecipe, pushHistory = true) => {
    let applied = next;
    const sameCharacterDocument = stableJson(next.character) === stableJson(recipeRef.current.character);
    if (characterWorkspace && recipeRef.current.character && sameCharacterDocument) {
      try {
        applied = captureCharacterEdits(recipeRef.current, next);
        const nextDocument = (applied as ArtRecipe & { character?: CharacterDocument }).character;
        if (nextDocument) { setCharacterDocument(nextDocument); setCharacterCreator(nextDocument.creator); }
      } catch (captureError) {
        setError(`Character edit could not be captured. The last valid preview remains open. ${errorMessage(captureError)}`);
        return;
      }
    }
    if (pushHistory) {
      historyPast.current.push(recipeRef.current);
      if (historyPast.current.length > 120) historyPast.current.shift();
      historyFuture.current = [];
    }
    recipeRef.current = applied;
    setRecipe(applied);
    setDirty(true);
    setError("");
    if (!recipeTextDirty) setRecipeText(JSON.stringify(applied, null, 2));
    if (characterWorkspace && applied.character) setCharacterRecoveryCorrupt(false);
  }, [characterWorkspace, recipeTextDirty]);

  useEffect(() => {
    const activateFirstClip = (next: ArtRecipe) => {
      const firstClip = next.clips["walk-south"] ? "walk-south" : Object.keys(next.clips)[0] ?? "";
      const firstName = next.clips[firstClip]?.frames[0];
      const firstIndex = next.frames.findIndex((frame) => frame.name === firstName);
      setClipId(firstClip);
      setClipPosition(0);
      setFrameIndex(firstIndex < 0 ? 0 : firstIndex);
    };
    const params = new URLSearchParams(window.location.search);
    const requestedCharacterWorkspace = params.get("workspace") === "character";
    setCharacterWorkspace(requestedCharacterWorkspace);
    if (requestedCharacterWorkspace) {
      try {
        const saved = window.localStorage.getItem("grout-character-studio/1");
        const restored = saved ? parseCharacterDocument(JSON.parse(saved)) : createCharacterDocument();
        const compiled = compileCharacter(restored);
        setCharacterDocument(restored);
        setCharacterCreator(restored.creator);
        recipeRef.current = compiled;
        setRecipe(compiled);
        activateFirstClip(compiled);
        setMessage(saved ? "Recovered your character workspace." : "Character workspace ready. New edits stay in this local draft.");
        const source = window.localStorage.getItem("grout-character-studio/1:source") ?? JSON.stringify(compiled, null, 2);
        setRecipeText(source);
        setRecipeTextDirty(source !== JSON.stringify(compiled, null, 2));
        setDirty(Boolean(saved));
      } catch (loadError) {
        const starter = createCharacterDocument();
        const compiledStarter = compileCharacter(starter);
        setCharacterDocument(starter);
        setCharacterCreator(starter.creator);
        recipeRef.current = compiledStarter;
        setRecipe(compiledStarter);
        activateFirstClip(compiledStarter);
        setCharacterRecoveryCorrupt(true);
        setError(`Character draft could not be recovered. A fresh starter is open; the saved bytes are preserved until you replace them. ${errorMessage(loadError)}`);
      }
      setBooted(true);
      return;
    }
    const requestedExample = params.get("example");
    if (requestedExample && getWorkbenchExample(requestedExample)) {
      // Select the persistence scope before parsing its draft. A broken example
      // must never fall through to saving over the ordinary sprite workspace.
      setExampleId(requestedExample);
      try {
        const stored = window.localStorage.getItem(exampleDraftKey(requestedExample));
        const savedSource = window.localStorage.getItem(draftSourceKey(requestedExample));
        const next = stored ? parseRecipe(JSON.parse(stored)) : createExampleRecipe(requestedExample);
        recipeRef.current = next;
        setRecipe(next);
        setExampleId(requestedExample);
        activateFirstClip(next);
        setMessage(stored ? `Recovered your ${getWorkbenchExample(requestedExample)?.title} draft.` : `Loaded local ${getWorkbenchExample(requestedExample)?.title} example.`);
        const source = savedSource ?? JSON.stringify(next, null, 2);
        setRecipeText(source);
        setRecipeTextDirty(source !== JSON.stringify(next, null, 2));
        if (stored) setDirty(true);
      } catch (loadError) {
        const starter = createExampleRecipe(requestedExample);
        recipeRef.current = starter;
        setRecipe(starter);
        activateFirstClip(starter);
        setRecipeText(JSON.stringify(starter, null, 2));
        setSpriteRecoveryCorrupt(true);
        setError(`Could not recover this example draft. A fresh example is open; the saved bytes are preserved. ${errorMessage(loadError)}`);
      }
    } else {
      try {
        const saved = window.localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const restored = parseRecipe(JSON.parse(saved));
          const savedSource = window.localStorage.getItem(draftSourceKey(null));
          recipeRef.current = restored;
          setRecipe(restored);
          activateFirstClip(restored);
          const source = savedSource ?? JSON.stringify(restored, null, 2);
          setRecipeText(source);
          setRecipeTextDirty(source !== JSON.stringify(restored, null, 2));
          setDirty(true);
          setMessage("Recovered your last local draft.");
        } else {
          activateFirstClip(recipeRef.current);
          setRecipeText(JSON.stringify(recipeRef.current, null, 2));
        }
      } catch (loadError) {
        setSpriteRecoveryCorrupt(true);
        activateFirstClip(recipeRef.current);
        setError(`The saved draft could not be recovered. A fresh starter is open; the saved bytes are preserved. ${errorMessage(loadError)}`);
        setRecipeText(JSON.stringify(recipeRef.current, null, 2));
      }
    }
    setBooted(true);
  }, []);

  useEffect(() => {
    const firstRole = roles[0] ?? "";
    if (!roles.includes(activeRole)) setActiveRole(firstRole);
    if (!recipe.layers.some((layer) => layer.id === selectedLayer)) setSelectedLayer(firstVisibleLayer);
    if (!Object.hasOwn(clips, clipId)) {
      const nextClip = clipNames[0] ?? "";
      const firstName = clips[nextClip]?.frames[0];
      const firstIndex = recipe.frames.findIndex((item) => item.name === firstName);
      setClipId(nextClip);
      setClipPosition(0);
      if (firstIndex >= 0) setFrameIndex(firstIndex);
    }
    if (!currentFrameName) setFrameIndex(0);
    else if (frameIndex >= recipe.frames.length) setFrameIndex(Math.max(0, recipe.frames.length - 1));
  }, [activeRole, clipId, clipNames, clips, currentFrameName, firstVisibleLayer, frameIndex, recipe, roles, selectedLayer]);

  useEffect(() => {
    if (!booted || characterWorkspace || spriteRecoveryCorrupt) return;
    try {
      window.localStorage.setItem(exampleDraftKey(exampleId), JSON.stringify(recipe));
    } catch (saveError) {
      setError(`Could not save the local recovery draft: ${errorMessage(saveError)}`);
    }
  }, [booted, characterWorkspace, exampleId, recipe, spriteRecoveryCorrupt]);

  useEffect(() => {
    if (!booted || (characterWorkspace ? characterRecoveryCorrupt : spriteRecoveryCorrupt)) return;
    try {
      window.localStorage.setItem(characterWorkspace ? "grout-character-studio/1:source" : draftSourceKey(exampleId), recipeText);
    } catch (saveError) {
      setError(`Could not save the editable recipe source: ${errorMessage(saveError)}`);
    }
  }, [booted, characterWorkspace, characterRecoveryCorrupt, spriteRecoveryCorrupt, exampleId, recipeText]);

  useEffect(() => {
    if (!booted || !characterWorkspace || characterRecoveryCorrupt) return;
    try { window.localStorage.setItem("grout-character-studio/1", JSON.stringify(characterDocument)); }
    catch (saveError) { setError(`Could not save the character recovery draft: ${errorMessage(saveError)}`); }
  }, [booted, characterWorkspace, characterDocument, characterRecoveryCorrupt]);

  useEffect(() => {
    setSelection(null);
  }, [frameIndex, layerId]);

  useEffect(() => {
    const request = ++rendererRequest.current;
    let cancelled = false;
    const rendererAbort = new AbortController();
    rendererRef.current = null;
    setActualBackend("starting");
    setRendererDiagnostics([]);
    createRenderer({ backend }).then((renderer) => {
      if (cancelled || rendererAbort.signal.aborted || request !== rendererRequest.current) {
        renderer.dispose();
        return;
      }
      rendererRef.current = renderer;
      setRendererDiagnostics([...renderer.diagnostics]);
      setRendererEpoch((value) => value + 1);
      setMessage("");
    }).catch((rendererError: unknown) => {
      if (cancelled || rendererAbort.signal.aborted) return;
      rendererRef.current = null;
      setActualBackend("CPU fallback");
      setError(`${backend} renderer unavailable; showing the CPU preview. ${errorMessage(rendererError)}`);
      setRendererEpoch((value) => value + 1);
    });
    return () => {
      cancelled = true;
      rendererAbort.abort();
      if (rendererRequest.current === request) rendererRequest.current += 1;
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [backend]);

  useEffect(() => {
    const controller = new AbortController();
    activeRender.current?.abort();
    activeRender.current = controller;
    const token = rendererRequest.current;
    const renderer = rendererRef.current;
    const frames = recipe.frames;
    const index = Math.max(0, Math.min(frameIndex, frames.length - 1));
    if (!frames.length) return () => controller.abort();

    const update = async () => {
      try {
        let current: Pixels & { backend?: string };
        let previous: Pixels | null = null;
        if (renderer) {
          current = await renderer.render(recipe, index, { signal: controller.signal });
          if (onionSkin && frames.length > 1) {
            const previousIndex = (index - 1 + frames.length) % frames.length;
            previous = await renderer.render(recipe, previousIndex, { signal: controller.signal });
          }
        } else {
          current = renderFrame(recipe, index);
          if (onionSkin && frames.length > 1) previous = renderFrame(recipe, (index - 1 + frames.length) % frames.length);
        }
        if (controller.signal.aborted || token !== rendererRequest.current) return;
        drawPixels(canvasRef.current, current);
        drawPixels(onionRef.current, previous);
        if (renderer) setRendererDiagnostics([...renderer.diagnostics]);
        setActualBackend(current.backend ?? (renderer ? backend : "cpu"));
        setError((current) => current.startsWith("Render failed:") ? "" : current);
      } catch (renderError) {
        if (controller.signal.aborted || token !== rendererRequest.current) return;
        if (renderer) setRendererDiagnostics([...renderer.diagnostics, errorMessage(renderError)]);
        setError(`Render failed: ${errorMessage(renderError)}. The previous valid preview remains visible.`);
      }
    };
    void update();
    return () => controller.abort();
  }, [backend, frameIndex, onionSkin, recipe, rendererEpoch]);

  useEffect(() => () => {
    backendProbeAbort.current?.abort();
    backendProbeAbort.current = null;
  }, []);

  useEffect(() => {
    if (!playing || !clipFrames.length) return;
    const delay = 1000 / Math.max(1, activeClip?.fps ?? 8);
    const timer = window.setInterval(() => {
      const nextPosition = (clipPosition + 1) % clipFrames.length;
      const nextName = clipFrames[nextPosition];
      const index = recipeRef.current.frames.findIndex((frame) => frame.name === nextName);
      if (index >= 0) {
        setClipPosition(nextPosition);
        setFrameIndex(index);
      }
    }, delay);
    return () => window.clearInterval(timer);
  }, [activeClip?.fps, clipFrames, clipPosition, playing]);

  useEffect(() => {
    if (booted && !recipeTextDirty) setRecipeText(JSON.stringify(recipe, null, 2));
  }, [booted, recipe, recipeTextDirty]);

  useEffect(() => {
    if (!isAtlasExample) {
      setAtlasReport(null);
      return;
    }
    setAtlasReport(null);
    let cancelled = false;
    void Promise.resolve(buildArtExport(recipe)).then((output) => {
      if (cancelled) return;
      const page = output.atlas.pages[0];
      const atlas = page ? { width: page.width, height: page.height, data: new Uint8Array(page.rgba) } : null;
      const manifest = output.manifest as Record<string, unknown>;
      let reconstructedCount = 0;
      for (const frame of output.frames) {
        const restored = extractFrame(output.atlas, frame.name, true);
        if (restored.width === frame.width && restored.height === frame.height && restored.data.every((value, index) => value === frame.data[index])) reconstructedCount += 1;
      }
      const text = JSON.stringify({
        pages: output.atlas.pages.map(({ index, width, height }) => ({ index, width, height })),
        reconstructedFrames: `${reconstructedCount} / ${output.frames.length}`,
        sourceSize: `${recipe.width}×${recipe.height}`,
        sampling: manifest.sampling,
        frameMetadata: output.atlas.frames,
        manifest,
      }, null, 2);
      setAtlasReport({ pixels: atlas ?? recipePixels(output.sheet), text, reconstructed: reconstructedCount, frames: output.frames.length, pages: output.atlas.pages.length });
    }).catch((atlasError: unknown) => {
      if (!cancelled) setError(`Atlas inspection failed: ${errorMessage(atlasError)}`);
    });
    return () => { cancelled = true; };
  }, [isAtlasExample, recipe]);

  useEffect(() => {
    if (isAtlasExample && atlasReport?.pixels) drawPixels(atlasCanvasRef.current, atlasReport.pixels);
  }, [atlasReport, isAtlasExample]);

  useEffect(() => {
    if (!isComparisonExample) {
      setMetrics(null);
      setBackendProbe([]);
      return;
    }
    let cancelled = false;
    setMetrics(null);
    setMetricsPending(true);
    void Promise.resolve(measureRecipe(recipe)).then((result) => {
      if (!cancelled) setMetrics(result);
    }).catch((metricError: unknown) => {
      if (!cancelled) setError(`Recipe measurement failed: ${errorMessage(metricError)}`);
    }).finally(() => {
      if (!cancelled) setMetricsPending(false);
    });
    return () => { cancelled = true; };
  }, [isComparisonExample, recipe]);

  useEffect(() => {
    backendProbeAbort.current?.abort();
    backendProbeAbort.current = null;
    setBackendProbePending(false);
  }, [recipe]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      const editable = target instanceof HTMLElement && (
        target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']") !== null
      );
      if (!editable && (event.ctrlKey || event.metaKey)) {
        const key = event.key.toLowerCase();
        if (key === "z" || key === "y") {
          event.preventDefault();
          if (key === "y" || event.shiftKey) redo(); else undo();
        }
      }
      if (event.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function commit(next: ArtRecipe, push = true) {
    replaceRecipe(next, push);
  }

  function acceptCharacterRecipe(next: ArtRecipe) {
    historyPast.current.push(recipeRef.current);
    if (historyPast.current.length > 120) historyPast.current.shift();
    historyFuture.current = [];
    recipeRef.current = next;
    setRecipe(next);
    setDirty(true);
    setError("");
    setCharacterRecoveryCorrupt(false);
  }

  function changeWardrobe(options: TravelerWardrobeOptions) {
    try {
      commit(setTravelerWardrobe(recipeRef.current, options));
      if (options.hat || options.clothing) setSelectedLayer(options.hat ? "cap" : "clothing");
      setMessage("");
    } catch (wardrobeError) {
      setError(errorMessage(wardrobeError));
    }
  }

  async function compareBackends() {
    backendProbeAbort.current?.abort();
    const controller = new AbortController();
    backendProbeAbort.current = controller;
    const probeRecipe = recipeRef.current;
    setBackendProbePending(true);
    setBackendProbe([]);
    let baseline: Uint8Array | null = null;
    const results: Array<{ requested: string; actual?: string; ms?: number; byteDifference?: number; status: string }> = [];
    try {
      for (const requested of ["cpu", "webgl2", "webgpu"] as const) {
        if (controller.signal.aborted) return;
        let renderer: ArtRenderer | null = null;
        try {
          const started = performance.now();
          renderer = await createRenderer({ backend: requested });
          if (controller.signal.aborted) {
            renderer.dispose();
            return;
          }
          const rendered = await renderer.render(probeRecipe, 0, { signal: controller.signal });
          const elapsed = performance.now() - started;
          if (controller.signal.aborted) return;
          const actual = rendered.backend || renderer.backend;
          if (requested === "cpu") baseline = rendered.data;
          const byteDifference = requested === "cpu" ? 0 : baseline === null ? undefined : (() => {
            const max = Math.max(baseline!.length, rendered.data.length);
            let count = 0;
            for (let i = 0; i < max; i += 1) if (baseline![i] !== rendered.data[i]) count += 1;
            return count;
          })();
          const fallback = actual.toLowerCase() !== requested;
          results.push({ requested, actual, ms: elapsed, byteDifference, status: fallback ? "fallback reported" : "rendered" });
        } catch (probeError) {
          if (controller.signal.aborted) return;
          results.push({ requested, status: `unavailable: ${errorMessage(probeError)}` });
        } finally {
          renderer?.dispose();
        }
        if (!controller.signal.aborted) setBackendProbe([...results]);
      }
    } finally {
      if (backendProbeAbort.current === controller) {
        backendProbeAbort.current = null;
        setBackendProbePending(false);
      }
    }
  }

  function undo() {
    const previous = historyPast.current.pop();
    if (!previous) return;
    historyFuture.current.push(recipeRef.current);
    recipeRef.current = previous;
    setRecipe(previous);
    const restoredCharacter = (previous as ArtRecipe & { character?: CharacterDocument }).character;
    if (restoredCharacter) { setCharacterDocument(restoredCharacter); setCharacterCreator(restoredCharacter.creator); }
    setDirty(true);
    setError("");
  }

  function redo() {
    const next = historyFuture.current.pop();
    if (!next) return;
    historyPast.current.push(recipeRef.current);
    recipeRef.current = next;
    setRecipe(next);
    const nextCharacter = (next as ArtRecipe & { character?: CharacterDocument }).character;
    if (nextCharacter) { setCharacterDocument(nextCharacter); setCharacterCreator(nextCharacter.creator); }
    setDirty(true);
    setError("");
  }

  function recordStart() {
    historyPast.current.push(recipeRef.current);
    if (historyPast.current.length > 120) historyPast.current.shift();
    historyFuture.current = [];
    strokeChanged.current = false;
  }

  function paint(point: Point, selectedTool: Tool) {
    if (!layerId) return;
    const role = selectedTool === "erase" ? null : activeRoleRef.current;
    try {
      const edited = editPixel(recipeRef.current, frameIndex, layerId, point.x, point.y, role);
      const next = characterWorkspace ? captureCharacterEdits(recipeRef.current, edited) : edited;
      const nextDocument = (next as ArtRecipe & { character?: CharacterDocument }).character;
      if (nextDocument) { setCharacterDocument(nextDocument); setCharacterCreator(nextDocument.creator); }
      recipeRef.current = next;
      setRecipe(next);
      setDirty(true);
      strokeChanged.current = true;
    } catch (editError) {
      setError(`Could not edit this pixel: ${errorMessage(editError)}`);
      pointerStroke.current = null;
    }
  }

  function paintSegment(from: Point, to: Point, selectedTool: Tool) {
    let x = from.x;
    let y = from.y;
    const dx = Math.abs(to.x - from.x);
    const sx = from.x < to.x ? 1 : -1;
    const dy = -Math.abs(to.y - from.y);
    const sy = from.y < to.y ? 1 : -1;
    let error = dx + dy;
    while (true) {
      paint({ x, y }, selectedTool);
      if (x === to.x && y === to.y) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pixelAt(event, zoom, recipeRef.current);
    if (tool === "fill") {
      recordStart();
      try {
        const edited = floodFill(recipeRef.current, frameIndex, layerId, point.x, point.y, activeRoleRef.current || null);
        const next = characterWorkspace ? captureCharacterEdits(recipeRef.current, edited) : edited;
        const nextDocument = (next as ArtRecipe & { character?: CharacterDocument }).character;
        if (nextDocument) { setCharacterDocument(nextDocument); setCharacterCreator(nextDocument.creator); }
        recipeRef.current = next;
        setRecipe(next);
        setDirty(true);
      } catch (editError) {
        historyPast.current.pop();
        setError(`Could not fill this region: ${errorMessage(editError)}`);
      }
      return;
    }
    if (tool === "pencil" || tool === "erase") {
      recordStart();
      pointerStroke.current = { start: point, last: point, tool, moved: false };
      paint(point, tool);
      return;
    }
    if (tool === "select") {
      pointerStroke.current = { start: point, last: point, tool, moved: false };
      setSelection({ x: point.x, y: point.y, w: 1, h: 1 });
      return;
    }
    if (tool === "move" && selection) {
      recordStart();
      pointerStroke.current = { start: point, last: point, tool, moved: false };
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const stroke = pointerStroke.current;
    if (!stroke || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const point = pixelAt(event, zoom, recipeRef.current);
    if (point.x === stroke.last.x && point.y === stroke.last.y) return;
    const previous = stroke.last;
    stroke.last = point;
    stroke.moved = true;
    if (stroke.tool === "pencil" || stroke.tool === "erase") paintSegment(previous, point, stroke.tool);
    else if (stroke.tool === "select") setSelection(boxBetween(stroke.start, point));
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const stroke = pointerStroke.current;
    if (!stroke) return;
    const point = pixelAt(event, zoom, recipeRef.current);
    if (stroke.tool === "move" && selection && (point.x !== stroke.start.x || point.y !== stroke.start.y)) {
      const targetX = Math.max(0, Math.min(recipe.width - selection.w, selection.x + point.x - stroke.start.x));
      const targetY = Math.max(0, Math.min(recipe.height - selection.h, selection.y + point.y - stroke.start.y));
      const dx = targetX - selection.x;
      const dy = targetY - selection.y;
      if (dx !== 0 || dy !== 0) {
        try {
          const edited = moveSelection(recipeRef.current, frameIndex, layerId, selection, dx, dy);
          const next = characterWorkspace ? captureCharacterEdits(recipeRef.current, edited) : edited;
          const nextDocument = (next as ArtRecipe & { character?: CharacterDocument }).character;
          if (nextDocument) { setCharacterDocument(nextDocument); setCharacterCreator(nextDocument.creator); }
          recipeRef.current = next;
          setRecipe(next);
          setDirty(true);
          setSelection({ ...selection, x: targetX, y: targetY });
        } catch (editError) {
          historyPast.current.pop();
          setError(`Could not move this selection: ${errorMessage(editError)}`);
        }
      } else {
        historyPast.current.pop();
      }
    }
    pointerStroke.current = null;
    if (!stroke.moved && stroke.tool === "select") setSelection({ x: point.x, y: point.y, w: 1, h: 1 });
  }

  function handleCanvasKey(event: ReactKeyboardEvent<HTMLCanvasElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const current = selection ? { x: selection.x, y: selection.y } : { x: 0, y: 0 };
      const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key] ?? [0, 0];
      const point = { x: Math.max(0, Math.min(recipe.width - 1, current.x + delta[0])), y: Math.max(0, Math.min(recipe.height - 1, current.y + delta[1])) };
      setSelection({ x: point.x, y: point.y, w: 1, h: 1 });
    } else if (event.key === " " && (tool === "pencil" || tool === "erase")) {
      event.preventDefault();
      recordStart();
      const point = selection ? { x: selection.x, y: selection.y } : { x: 0, y: 0 };
      paint(point, tool);
    }
  }

  async function downloadExport() {
    setExporting(true);
    setError("");
    const controller = new AbortController();
    activeExport.current = controller;
    try {
      const blob = await exportArtZip(recipe, { signal: controller.signal, includeCss, includeGif, includeSvg });
      const href = URL.createObjectURL(blob);
      exportObjectUrl.current = href;
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${recipe.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "grout-art"}.zip`;
      anchor.click();
      exportRevokeTimer.current = window.setTimeout(() => {
        URL.revokeObjectURL(href);
        if (exportObjectUrl.current === href) exportObjectUrl.current = null;
        exportRevokeTimer.current = null;
      }, 1000);
      const extras = [includeCss ? "CSS sprites" : "", includeGif ? `${Object.keys(recipe.clips).length} GIF clips` : "", includeSvg ? `${recipe.frames.length} SVG frames` : ""].filter(Boolean).join(" and ");
      setMessage(`Export saved with editable recipe, atlas, sheet and frame metadata${extras ? `, plus ${extras}` : ""}.`);
    } catch (exportError) {
      if (controller.signal.aborted) setMessage("Export cancelled. Your editable recipe is still open.");
      else setError(`Export failed. Your editable recipe is still open; retry when ready. ${errorMessage(exportError)}`);
    } finally {
      if (activeExport.current === controller) activeExport.current = null;
      setExporting(false);
    }
  }

  useEffect(() => () => {
    activeRender.current?.abort();
    activeExport.current?.abort();
    if (exportRevokeTimer.current !== null) window.clearTimeout(exportRevokeTimer.current);
    if (exportObjectUrl.current) URL.revokeObjectURL(exportObjectUrl.current);
    rendererRef.current?.dispose();
    rendererRef.current = null;
  }, []);

  function applyRecipeText() {
    try {
      const parsedRecipe = parseRecipe(JSON.parse(recipeText));
      const parsed = characterWorkspace ? captureCharacterEdits(recipeRef.current, parsedRecipe) : parsedRecipe;
      historyPast.current.push(recipeRef.current);
      historyFuture.current = [];
      recipeRef.current = parsed;
      setRecipe(parsed);
      const parsedCharacter = (parsed as ArtRecipe & { character?: CharacterDocument }).character;
      if (parsedCharacter) { setCharacterDocument(parsedCharacter); setCharacterCreator(parsedCharacter.creator); setCharacterRecoveryCorrupt(false); }
      setDirty(true);
      setRecipeText(JSON.stringify(parsed, null, 2));
      setRecipeTextDirty(false);
      setError("");
      setMessage("Recipe accepted; the preview is rendering from the new source.");
    } catch (parseError) {
      setError(`Recipe was not applied. The previous valid preview and source remain available. ${errorMessage(parseError)}`);
    }
  }

  const widthStyle = { width: recipe.width * zoom, height: recipe.height * zoom } as CSSProperties;
  const activePalette = recipe.palette[activeRole] ?? "#d9c7a3";
  const canUndo = historyPast.current.length > 0;
  const canRedo = historyFuture.current.length > 0;
  const frame = recipe.frames[frameIndex];
  const currentAnchor = frame?.anchor ?? [Math.floor(recipe.width / 2), recipe.height - 1];
  const visibleSelection = selection;

  return (
    <main className="art-studio" aria-busy={!booted}>
      <header className="art-studio-head">
        <div className="art-studio-title">
          <p className="art-eyebrow">Grout Art · {characterWorkspace ? "character bench" : "sprite bench"}</p>
          <h1>{recipe.name || "Untitled sprite"}</h1>
        </div>
        <nav className="art-page-nav" aria-label="Art workbench">
          <a href={appPath("studio")}>Sprite</a>
          <a href={`${appPath("studio")}?workspace=character`} aria-current={characterWorkspace ? "page" : undefined}>Character</a>
          <a href={appPath("examples")}>Examples</a>
          <a href={appPath("")}>Texture mill</a>
        </nav>
        {exporting && <button className="art-cancel-export" type="button" onClick={() => activeExport.current?.abort()}>Cancel export</button>}
        <button className="art-export-button" type="button" onClick={() => void downloadExport()} disabled={!booted || exporting}>
          {exporting ? "Packing…" : "Export atlas kit"}
        </button>
      </header>

      <div className="art-studio-status" aria-live="polite">
        <span className="art-status-led" aria-hidden="true" />
          <span>{!characterWorkspace && spriteRecoveryCorrupt ? "Recovery paused · saved bytes protected; new edits are not saved locally" : dirty ? "Draft saved locally · artwork still needs approval" : "Original recipe · artwork still needs approval"}</span>
        <span className="art-status-backend">Preview: {actualBackend}</span>
      </div>
      {(error || message) && <p className={error ? "art-notice art-notice-error" : "art-notice"} role={error ? "alert" : "status"}>{error || message}</p>}
      {!characterWorkspace && spriteRecoveryCorrupt && <p className="art-notice" role="status">
        The unreadable draft and its source remain saved. Export any new work before leaving, or explicitly replace this workspace's saved draft.
        {" "}<button type="button" onClick={() => { setSpriteRecoveryCorrupt(false); setDirty(true); setError(""); setMessage("Replaced this workspace's unreadable draft with the current recipe and source."); }}>Replace saved draft</button>
      </p>}

      <section className="art-workbench" aria-label="Sprite editor" inert={!booted}>
        <aside className="art-tool-rail" aria-label="Drawing tools">
          {(Object.keys(TOOL_LABELS) as Tool[]).map((id) => (
            <button key={id} type="button" className="art-tool-button" aria-pressed={tool === id} onClick={() => setTool(id)} title={TOOL_LABELS[id]}>
              <span className={`art-tool-glyph art-tool-${id}`} aria-hidden="true" />
              <span>{TOOL_LABELS[id]}</span>
            </button>
          ))}
          <div className="art-rail-divider" />
          <button type="button" className="art-tool-button" onClick={undo} disabled={!canUndo} aria-label="Undo (Ctrl or Command plus Z)">
            <span className="art-tool-glyph art-tool-undo" aria-hidden="true">↶</span><span>Undo</span>
          </button>
          <button type="button" className="art-tool-button" onClick={redo} disabled={!canRedo} aria-label="Redo (Ctrl or Command plus Shift plus Z)">
            <span className="art-tool-glyph art-tool-redo" aria-hidden="true">↷</span><span>Redo</span>
          </button>
        </aside>

        <section className="art-canvas-column" aria-label="Frame canvas and timeline">
          <div className="art-canvas-toolbar">
            <span className="art-dimension-readout">{recipe.width} × {recipe.height} px</span>
            <label className="art-zoom-control"><span>Zoom</span>
              <select value={zoom} onChange={(event) => setZoom(Number(event.currentTarget.value))}>
                {[1, 2, 4, 8, 12, 16, 20, 24, 32].map((value) => <option key={value} value={value}>{value}×</option>)}
              </select>
            </label>
            <label className="art-onion-toggle"><input type="checkbox" checked={onionSkin} onChange={(event) => setOnionSkin(event.currentTarget.checked)} /> Onion skin</label>
            <label className="art-backend-control"><span>Renderer</span>
              <select value={backend} onChange={(event) => setBackend(event.currentTarget.value as typeof backend)}>
                <option value="auto">Auto</option><option value="cpu">CPU</option><option value="webgl2">WebGL2</option><option value="webgpu">WebGPU</option>
              </select>
            </label>
          </div>
          <div className="art-canvas-stage">
            <div className="art-canvas-checker" style={widthStyle}>
              <canvas ref={onionRef} className="art-onion-canvas" style={{ ...widthStyle, opacity: onionSkin ? 0.22 : 0 }} aria-hidden="true" />
              <canvas
                ref={canvasRef}
                className="art-main-canvas"
                style={widthStyle}
                role="application"
                tabIndex={0}
                aria-label={`Frame ${frameIndex + 1} of ${recipe.frames.length}, native ${recipe.width} by ${recipe.height} pixel drawing canvas`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onKeyDown={handleCanvasKey}
              />
              {visibleSelection && <span className="art-selection-box" style={{ left: visibleSelection.x * zoom, top: visibleSelection.y * zoom, width: visibleSelection.w * zoom, height: visibleSelection.h * zoom }} aria-hidden="true" />}
              <span className="art-anchor-mark" style={{ left: currentAnchor[0] * zoom + zoom / 2, top: currentAnchor[1] * zoom + zoom / 2 }} title={`Feet anchor ${currentAnchor[0]}, ${currentAnchor[1]}`} aria-label={`Feet anchor at ${currentAnchor[0]}, ${currentAnchor[1]}`} />
            </div>
          </div>

          <div className="art-timeline">
            <div className="art-timeline-heading">
              <label><span>Clip</span>
                  <select value={clipId} onChange={(event) => {
                    const nextClip = event.currentTarget.value;
                    setClipId(nextClip);
                    setPlaying(false);
                    setClipPosition(0);
                    const firstName = clips[nextClip]?.frames[0];
                    const firstIndex = recipe.frames.findIndex((item) => item.name === firstName);
                    if (firstIndex >= 0) setFrameIndex(firstIndex);
                  }}>
                  {clipNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <span>{activeClip?.fps ?? 8} fps</span>
              <button type="button" className="art-play-button" onClick={() => setPlaying((value) => !value)} aria-pressed={playing}>{playing ? "Pause" : "Play"}</button>
              <span className="art-timeline-count">{clipFrames.length} frames</span>
            </div>
            <ol className="art-frame-list" aria-label="Animation frames">
              {clipFrames.map((name, position) => {
                const index = recipe.frames.findIndex((item) => item.name === name);
                if (index < 0) return null;
                return (
                  <li key={`${name}-${position}`}>
                    <button type="button" className="art-frame-button" aria-current={index === frameIndex && position === clipPosition ? "true" : undefined} onClick={() => { setClipPosition(position); setFrameIndex(index); }}>
                      <canvas className="art-frame-thumb" width={recipe.width} height={recipe.height} aria-hidden="true" ref={(element) => {
                        if (!element) return;
                        try { drawPixels(element, renderFrame(recipe, index)); } catch { /* The primary preview reports render errors. */ }
                      }} />
                      <span>{String(position + 1).padStart(2, "0")} · {name}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <aside className="art-inspector" aria-label="Recipe controls">
          {characterWorkspace && booted && <ArtCharacterCreator recipe={recipe} importedRecipe={importedCharacterRecipe} onClearImported={() => setImportedCharacterRecipe(null)} creator={characterCreator} document={characterDocument} disabled={recipeTextDirty} onCreator={setCharacterCreator} onDocument={setCharacterDocument} onRecipe={acceptCharacterRecipe} onSelectLayer={setSelectedLayer} reportError={(cause) => setError(errorMessage(cause))} />}
          <section className="art-inspector-section art-layer-section">
            <div className="art-inspector-title"><h2>Layers</h2><span>{recipe.layers.length}</span></div>
            <ul className="art-layer-list">
              {recipe.layers.map((layer, index) => (
                <li key={layer.id}>
                  <button type="button" className="art-layer-select" aria-pressed={layerId === layer.id} onClick={() => setSelectedLayer(layer.id)}>
                    <span className="art-layer-index">{String(index + 1).padStart(2, "0")}</span>{layer.name}
                  </button>
                  <label className="art-layer-visible" title={`Show ${layer.name}`}><input type="checkbox" checked={layer.visible} onChange={(event) => {
                    const nextLayers = recipe.layers.map((item) => item.id === layer.id ? { ...item, visible: event.currentTarget.checked } : item);
                    commit({ ...recipeRef.current, layers: nextLayers });
                  }} /><span className="sr-only">Show {layer.name}</span></label>
                </li>
              ))}
            </ul>
            {selectedLayerHidden && <p className="art-craft-note" role="status">{recipe.layers.find((layer) => layer.id === layerId)?.name} is hidden in this frame. Choose another layer or frame to see your edits.</p>}
          </section>

          {characterWorkspace && booted && <ArtSpriteImport recipe={recipe} disabled={recipeTextDirty} onImport={next => { setImportedCharacterRecipe(next); setMessage(`Imported ${next.frames.length} source frames. Map them to the twelve poses in the character panel.`); }} />}

          {!characterWorkspace && booted && wardrobe && <details className="art-inspector-section art-wardrobe">
            <summary>Clothing &amp; hats</summary>
            <label>Clothing<select aria-label="Traveler clothing" value={wardrobe.clothing} disabled={recipeTextDirty} onChange={event => changeWardrobe({clothing: event.currentTarget.value as TravelerClothing})}>
              {wardrobe.clothing === "custom" && <option value="custom" disabled>Custom drawing</option>}
              {TRAVELER_CLOTHING.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            <label>Hat<select aria-label="Traveler hat" value={wardrobe.hat} disabled={recipeTextDirty} onChange={event => changeWardrobe({hat: event.currentTarget.value as TravelerHat})}>
              {wardrobe.hat === "custom" && <option value="custom" disabled>Custom drawing</option>}
              {TRAVELER_HATS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            <label>Colors<select aria-label="Traveler colors" value={wardrobe.palette} disabled={recipeTextDirty} onChange={event => changeWardrobe({palette: event.currentTarget.value as TravelerPalette})}>
              {wardrobe.palette === "custom" && <option value="custom" disabled>Custom colors</option>}
              {TRAVELER_PALETTES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            {wardrobe.walk === "previous" && <button type="button" disabled={recipeTextDirty} onClick={() => commit(refineTravelerWalk(recipeRef.current))}>Refine walk &amp; backpack</button>}
            <p className="art-craft-note">{recipeTextDirty ? "Apply or reset your source edits to change clothing." : "Changes all directions. Painted corrections stay; Undo restores the previous garment."}</p>
          </details>}

          {!characterWorkspace && booted && <ArtSpriteImport recipe={recipe} disabled={recipeTextDirty} onImport={next => {
            commit(next); setPlaying(false); setFrameIndex(0); setClipPosition(0);
            setClipId(Object.keys(next.clips)[0]); setSelectedLayer(next.layers[0].id);
            setZoom([16,12,8,4,2,1].find(value => value * Math.max(next.width,next.height) <= 256) ?? 1);
            setMessage(`Imported ${next.frames.length} frames and ${next.layers.length} editable layers.`);
          }} />}

          {!characterWorkspace && booted && <ArtSpriteVariations recipe={recipe} frame={frameIndex} disabled={recipeTextDirty} onChange={next => commit(next)} />}
          {booted && <ArtRecipeOptimization recipe={recipe} disabled={recipeTextDirty} />}
          {booted && <ArtOutline recipe={recipe} disabled={recipeTextDirty} onChange={next => commit(next)} />}

          <section className="art-inspector-section">
            <div className="art-inspector-title"><h2>Palette roles</h2><span>{roles.length}</span></div>
            <ul className="art-palette-list">
              {roles.map((role) => (
                <li key={role}>
                  <button type="button" className="art-role-select" aria-pressed={activeRole === role} onClick={() => setActiveRole(role)}>
                    <span className="art-swatch" style={{ backgroundColor: recipe.palette[role] }} />{role}
                  </button>
                  <input aria-label={`${role} color`} type="color" value={recipe.palette[role]} onChange={(event) => {
                    const next = { ...recipeRef.current, palette: { ...recipeRef.current.palette, [role]: event.currentTarget.value } };
                    commit(next);
                  }} />
                </li>
              ))}
            </ul>
            <label className="art-seed-field"><span>Seed</span><input type="number" min={0} max={4294967295} step={1} value={recipe.seed} onChange={(event) => {
              const value = Number(event.currentTarget.value);
              if (Number.isInteger(value) && value >= 0 && value <= 4294967295) commit({ ...recipeRef.current, seed: value });
            }} /></label>
            <p className="art-selected-role">Drawing role: <strong>{activeRole || "none"}</strong> <span className="art-selected-role-swatch" style={{ backgroundColor: activePalette }} /></p>
          </section>

          {isAtlasExample && (
            <section className="art-inspector-section art-atlas-inspection">
              <div className="art-inspector-title"><h2>Atlas inspection</h2><span>{atlasReport ? "built" : "building"}</span></div>
              <p>Trim, padding and extrusion metadata is generated from this recipe. The canvas below is the actual packed sheet.</p>
              {atlasReport?.pixels ? <canvas ref={atlasCanvasRef} className="art-atlas-canvas" width={atlasReport.pixels.width} height={atlasReport.pixels.height} aria-label="Generated sprite atlas" /> : <span className="art-atlas-pending">Preparing atlas pixels…</span>}
              {atlasReport && <p>{atlasReport.pages} atlas page{atlasReport.pages === 1 ? "" : "s"} · {atlasReport.reconstructed}/{atlasReport.frames} frames reconstructed byte-for-byte</p>}
              {atlasReport && <details><summary>Frame rectangles and reconstruction report</summary><pre>{atlasReport.text}</pre></details>}
            </section>
          )}

          {isComparisonExample && (
            <section className="art-inspector-section art-measurements">
              <div className="art-inspector-title"><h2>Measured costs</h2><span>{metricsPending ? "measuring" : "current recipe"}</span></div>
              <p>Measured recipe encodings and atlas PNG pages. Shared runtime size is reported only when the SDK has a source basis.</p>
              {metrics !== null && (
                <dl className="art-metric-list">
                  <div><dt>Readable recipe</dt><dd>{byteLabel(metrics.readableBytes)}</dd></div>
                  <div><dt>Compact recipe</dt><dd>{byteLabel(metrics.compactBytes)}</dd></div>
                  <div><dt>Gzip recipe</dt><dd>{byteLabel(metrics.gzipBytes)}</dd></div>
                  <div><dt>Expanded frames</dt><dd>{byteLabel(metrics.expandedBytes)}</dd></div>
                  <div><dt>Expanded gzip</dt><dd>{byteLabel(metrics.expandedGzipBytes)}</dd></div>
                  <div><dt>RGBA frames</dt><dd>{byteLabel(metrics.rasterBytes)}</dd></div>
                  <div><dt>RGBA gzip</dt><dd>{byteLabel(metrics.rasterGzipBytes)}</dd></div>
                  <div><dt>Atlas PNG pages</dt><dd>{byteLabel(metrics.pngBytes)}</dd></div>
                  <div><dt>Custom modules</dt><dd>{byteLabel(metrics.moduleBytes)}</dd></div>
                  <div><dt>Runtime basis</dt><dd>{metrics.runtimeBasis}</dd></div>
                  <div><dt>Runtime source</dt><dd>{byteLabel(metrics.runtimeBytes)}</dd></div>
                  <div><dt>Recipe + runtime</dt><dd>{byteLabel(metrics.bundleBytes)}</dd></div>
                  <div><dt>Recipe + runtime bundle</dt><dd>{byteLabel(metrics.bundleGzipBytes)}</dd></div>
                </dl>
              )}
              {metrics !== null && <details><summary>Representation byte measurements</summary><pre>{JSON.stringify(metrics.representations, null, 2)}</pre></details>}
              <div className="art-backend-probe">
                <button type="button" disabled={backendProbePending} onClick={() => { void compareBackends(); }}>
                  {backendProbePending ? "Comparing renderers…" : "Compare CPU, WebGL2 and WebGPU"}
                </button>
                <p>Each timing includes renderer setup and one frame render. GPU output is compared byte-for-byte with CPU when the CPU baseline is available.</p>
                {backendProbe.length > 0 && <ul aria-live="polite">{backendProbe.map((result) => (
                  <li key={result.requested}>
                    <strong>{result.requested}</strong>: {result.status}
                    {result.actual && ` · used ${result.actual}`}
                    {result.ms !== undefined && ` · ${result.ms.toFixed(2)} ms`}
                    {result.byteDifference !== undefined && ` · ${result.byteDifference} differing bytes vs CPU`}
                  </li>
                ))}</ul>}
              </div>
            </section>
          )}

          <details className="art-advanced">
            <summary>Recipe source and technique modules</summary>
            <p>Edit the complete recipe, including shader source and its CPU fallback graph. Invalid drafts remain editable and keep the last valid preview.</p>
            <textarea aria-label="Recipe JSON, including custom technique source" spellCheck={false} value={recipeText} onChange={(event) => { setRecipeText(event.currentTarget.value); setRecipeTextDirty(true); }} />
            <div className="art-advanced-actions">
              <button type="button" onClick={applyRecipeText}>Apply recipe</button>
              <button type="button" onClick={() => { setRecipeText(JSON.stringify(recipe, null, 2)); setRecipeTextDirty(false); setError(""); }}>Reset text</button>
            </div>
            {recipe.techniques?.length ? <p>{recipe.techniques.length} custom technique module{recipe.techniques.length === 1 ? "" : "s"} in this recipe.</p> : <p>This recipe uses built-in techniques.</p>}
            <details className="art-renderer-diagnostics">
              <summary>Renderer diagnostics</summary>
              {rendererDiagnostics.length ? <ul>{rendererDiagnostics.map((diagnostic, index) => <li key={`${index}-${diagnostic}`}>{diagnostic}</li>)}</ul> : <p>No renderer diagnostics reported.</p>}
            </details>
          </details>

          <details className="art-export-options">
            <summary>Export options</summary>
            <label><input type="checkbox" checked={includeCss} disabled={exporting} onChange={(event) => setIncludeCss(event.target.checked)} /> Include CSS sprites</label>
            <label><input type="checkbox" checked={includeGif} disabled={exporting} onChange={(event) => setIncludeGif(event.target.checked)} /> Include animated GIFs</label>
            <label><input type="checkbox" checked={includeSvg} disabled={exporting} onChange={(event) => setIncludeSvg(event.target.checked)} /> Include SVG frames</label>
          </details>
          <p className="art-craft-note">Every palette, frame and layer in this recipe is editable. Exported art stays a draft until you accept it.</p>
        </aside>
      </section>

      {selectedExample && (
        <footer className="art-example-context">
          <span>Example · {selectedExample.title}</span>
          <span>{selectedExample.summary}</span>
          <a href={appPath("examples")}>Browse other techniques</a>
        </footer>
      )}
    </main>
  );
}
