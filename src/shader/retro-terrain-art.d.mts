export type CuratedDrawing = [number,number,string[]][];
export const CURATED_DRAWINGS:Record<16|64,Record<'grass'|'dirt'|'gravel',CuratedDrawing[]>>;
export const CURATED_PALETTES:Record<'woodland'|'dry-trail'|'cool-moor',Record<'grass'|'dirt'|'gravel',string[]>>;
export function artRows(size:16|64,family:'grass'|'dirt'|'gravel',composition?:number,weathered?:boolean):string[];
