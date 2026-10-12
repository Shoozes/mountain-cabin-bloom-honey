import type {TerrainKitRecipe} from './retro-terrain-growth.mjs';
import type {CuratedRecipe} from './retro-terrain-curated.mjs';
export function retroTerrainBrowserFiles(recipe: TerrainKitRecipe|CuratedRecipe, options?: {signal?: AbortSignal}): Promise<{name: string; data: Uint8Array}[]>;
