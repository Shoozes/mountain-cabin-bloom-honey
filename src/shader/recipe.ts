import type { StyleDef } from "@/shader/catalog";
import { lookValue } from "@/shader/catalog";
import { exportFragment, type BakedTile } from "@/shader/glsl";
import { hexToRgb, type Rgb } from "@/shader/engine";

export type TileSettings = {
  seed: number;
  scale: number;
  pixels: number;
  wear: number;
  paletteId: string;
  look: string;
  colors: [string, string, string, string];
};

export function recipeText(style: StyleDef, settings: TileSettings): string {
  return JSON.stringify(
    {
      format: "grout-shader/1",
      style: style.id,
      name: style.name,
      category: style.category,
      preset: style.preset ?? null,
      motion: Boolean(style.motion),
      seed: settings.seed,
      scale: settings.scale,
      pixels: settings.pixels,
      wear: Number(settings.wear.toFixed(2)),
      palette: settings.paletteId,
      look: settings.look,
      colors: settings.colors,
      repeatSafe: true,
    },
    null,
    2,
  );
}

export function glslText(style: StyleDef, settings: TileSettings): string {
  const colors = settings.colors.map(hexToRgb) as [Rgb, Rgb, Rgb, Rgb];
  const tile: BakedTile = {
    name: style.name,
    id: style.id,
    motion: Boolean(style.motion),
    seed: settings.seed,
    scale: settings.scale,
    pixels: settings.pixels,
    wear: settings.wear,
    look: lookValue(settings.look),
    colors,
  };
  return exportFragment(style.glsl, tile);
}
