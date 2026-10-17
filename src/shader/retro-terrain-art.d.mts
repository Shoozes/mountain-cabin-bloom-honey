export type CuratedFamily = 'dirt'|'grass'|'gravel'|'moss'|'rock'|'masonry'|'timber';
export type CuratedDrawing = [number,number,string[],('structure'|'detail')?][];
export const CURATED_DRAWINGS:Record<16|64,Record<CuratedFamily,CuratedDrawing[]>>;
export const CURATED_PALETTES:Record<'woodland'|'dry-trail'|'cool-moor',Record<CuratedFamily,string[]>>;
export function artRows(size:16|64,family:CuratedFamily,composition?:number,weathered?:boolean):string[];
