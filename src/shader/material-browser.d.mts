import type {MaterialPixels,MaterialRecipe} from './material.mjs';
export function paintMaterialCanvas(canvas:HTMLCanvasElement,pixels:MaterialPixels,repeat?:number):void;
export function materialBrowserFiles(recipe:MaterialRecipe):Promise<{name:string;data:Uint8Array}[]>;
