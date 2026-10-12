import type {TerrainKitRecipe} from './retro-terrain-growth.mjs';
export function retroTerrainBrowserFiles(recipe: TerrainKitRecipe, options?: {signal?: AbortSignal}): Promise<{name: string; data: Uint8Array}[]>;
