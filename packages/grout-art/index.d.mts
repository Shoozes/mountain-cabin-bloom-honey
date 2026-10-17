export * from "./character.mjs";
import type { CharacterDocument } from "./character.mjs";
export type Op = { op: string; [key: string]: unknown };
export type Technique = {
  id: string;
  version?: number;
  parameters: Record<
    string,
    { type: "int" | "role"; default: number | string; min?: number; max?: number }
  >;
  cpu: Op[];
  glsl: string;
  wgsl: string;
};
export type LayerOverride = {
  visible?: boolean;
  part?: string;
  offset?: [number, number];
  ops?: Op[];
};
export type ArtRecipe = {
  format: "grout-art/1";
  name: string;
  width: number;
  height: number;
  seed: number;
  character?: CharacterDocument;
  outline?: { enabled: boolean; color: string; width: 1 | 2 | 3; corners: "stepped" | "square" };
  palette: Record<string, string>;
  parts: Record<string, Op[]>;
  layers: { id: string; name: string; part: string; visible: boolean }[];
  frames: {
    name: string;
    anchor: [number, number];
    order?: string[];
    layers?: Record<string, LayerOverride>;
  }[];
  clips: Record<string, { frames: string[]; fps: number }>;
  techniques?: Technique[];
  importedSprite?: {
    format: "sprite-import/1";
    sources: { name: string; sha256?: string; frames: number }[];
    width: number;
    height: number;
    frameWidth: number;
    frameHeight: number;
    columns: number;
    rows: number;
    margin: number;
    spacing: number;
    animationFrames: number;
    durationsMs?: number[];
    frameOrder: "time-then-row-major";
    transparentRgb: "zeroed";
    attribution: string;
  };
};
export type Pixels = { width: number; height: number; data: Uint8Array };
export type Backend = "auto" | "cpu" | "webgl2" | "webgpu";
export interface ArtRenderer {
  backend: string;
  diagnostics: string[];
  render(
    recipe: ArtRecipe,
    frame?: number,
    options?: { signal?: AbortSignal },
  ): Promise<Pixels & { backend: string }>;
  dispose(): void;
}
export const FORMAT: "grout-art/1";
export const VERSION: string;
export function copy<T>(value: T): T;
export function parseRecipe(input: unknown): ArtRecipe;
export function registerTechnique(recipe: ArtRecipe, module: Technique): ArtRecipe;
export function renderFrame(recipe: ArtRecipe, frame?: number): Pixels;
export function createRenderer(options?: { backend?: Backend }): Promise<ArtRenderer>;
export type SpriteImportOptions = {
  name?: string;
  frameWidth?: number;
  frameHeight?: number;
  margin?: number;
  spacing?: number;
  fps?: number;
  anchor?: [number, number];
  sourceName?: string;
  sourceSha256?: string;
};
export function importSpritePixels(
  pixels: { width: number; height: number; data: Uint8Array | Uint8ClampedArray },
  options?: SpriteImportOptions,
  control?: { signal?: AbortSignal },
): Promise<ArtRecipe>;
export type SpriteImportLayer = {
  name?: string;
  sourceName?: string;
  sourceSha256?: string;
  frames: { width: number; height: number; data: Uint8Array | Uint8ClampedArray }[];
  durationsMs?: number[];
};
export function importSpriteLayers(
  layers: SpriteImportLayer[],
  options?: Omit<SpriteImportOptions, "sourceName" | "sourceSha256">,
  control?: { signal?: AbortSignal },
): Promise<ArtRecipe>;
export type TravelerClothing = "coat" | "tunic" | "vest";
export type TravelerHat = "cap" | "round" | "trail";
export type TravelerPalette = "fern" | "cinder" | "heather" | "harbor";
export type TravelerWardrobeOptions = {
  clothing?: TravelerClothing;
  hat?: TravelerHat;
  palette?: TravelerPalette;
};
export const TRAVELER_CLOTHING: readonly { readonly id: TravelerClothing; readonly name: string }[];
export const TRAVELER_HATS: readonly { readonly id: TravelerHat; readonly name: string }[];
export const TRAVELER_PALETTES: readonly { readonly id: TravelerPalette; readonly name: string }[];
export function createTravelerRecipe(options?: TravelerWardrobeOptions): ArtRecipe;
export function getTravelerWardrobe(recipe: ArtRecipe): {
  clothing: TravelerClothing | "custom";
  hat: TravelerHat | "custom";
  palette: TravelerPalette | "custom";
  walk: "refined" | "previous";
} | null;
export function setTravelerWardrobe(recipe: ArtRecipe, options: TravelerWardrobeOptions): ArtRecipe;
export function refineTravelerWalk(recipe: ArtRecipe): ArtRecipe;
export function createExampleRecipe(id: string): ArtRecipe;
export function editPixel(
  recipe: ArtRecipe,
  frame: number,
  layer: string,
  x: number,
  y: number,
  role: string | null,
): ArtRecipe;
export function floodFill(
  recipe: ArtRecipe,
  frame: number,
  layer: string,
  x: number,
  y: number,
  role: string | null,
): ArtRecipe;
export function moveSelection(
  recipe: ArtRecipe,
  frame: number,
  layer: string,
  box: { x: number; y: number; w: number; h: number },
  dx: number,
  dy: number,
): ArtRecipe;
export type AtlasFrame = {
  name: string;
  page: number;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  trim: { x: number; y: number; width: number; height: number };
  pivot?: { x: number; y: number };
  [key: string]: unknown;
};
export type ArtAtlas = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  pages: { index: number; width: number; height: number; rgba: Uint8ClampedArray }[];
  frames: AtlasFrame[];
  meta: Record<string, unknown>;
};
export function buildAtlas(
  frames: (Pixels & { name: string; anchor?: [number, number] })[],
  options?: Record<string, unknown>,
): ArtAtlas;
export function extractFrame(atlas: ArtAtlas, name: string, restoreTrim?: boolean): Pixels;
export function buildArtExport(
  recipe: ArtRecipe,
  options?: { signal?: AbortSignal; atlas?: Record<string, unknown> },
): {
  recipe: ArtRecipe;
  frames: (Pixels & { name: string; anchor: [number, number] })[];
  atlas: ArtAtlas;
  manifest: Record<string, unknown>;
  phaser: Record<string, unknown>;
  sheet: Pixels;
};
export type RecipeMetrics = {
  readableBytes: number;
  compactBytes: number;
  gzipBytes: number;
  expandedBytes: number;
  expandedGzipBytes: number;
  rasterBytes: number;
  rasterGzipBytes: number;
  pngBytes: number;
  atlasMetadataBytes: number;
  packedPngBundleBytes: number;
  pngRuntimeBasis: string;
  moduleBytes: number;
  runtimeBytes: number | null;
  bundleBytes: number | null;
  bundleGzipBytes: number | null;
  runtimeBasis: string;
  representations: { name: string; bytes: number; gzipBytes: number }[];
};
export function compactRecipe(recipe: ArtRecipe): string;
export function encodePortablePng(pixels: Pixels): Promise<Uint8Array>;
export function measureRecipe(
  recipe: ArtRecipe,
  options?: { runtimeSources?: string[]; runtimeBytes?: number },
): Promise<RecipeMetrics>;
export function compileShader(
  recipe: ArtRecipe,
  frame: number,
  backend: "webgl2" | "webgpu",
): string;
