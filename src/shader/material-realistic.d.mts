import type {RealisticSurfaceRecipe,MaterialPixels} from './material.mjs';
export const REALISTIC_SURFACE_FAMILIES:readonly RealisticSurfaceRecipe['family'][];
export const REALISTIC_DEFAULTS:Readonly<RealisticSurfaceRecipe>;
export const REALISTIC_SURFACE_PRESETS:readonly {label:string;recipe:RealisticSurfaceRecipe}[];
export function validateRealisticRecipe(input:unknown):RealisticSurfaceRecipe;
export function sampleRealisticStructure(input:unknown,u:number,v:number):{height:number;roughness:number;color:number[]};
export function generateRealisticMaterial(input:unknown):{recipe:RealisticSurfaceRecipe;channels:Record<string,MaterialPixels>;heights:Float32Array};
export function shadeRealisticPreview(channels:Record<string,MaterialPixels>):MaterialPixels;
