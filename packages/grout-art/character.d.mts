import type { ArtRecipe, Op } from "./index.mjs";
export type CharacterFrame = string;
export type CharacterParameter = { min: number; max: number; default: number };
export type CharacterOption = {
  id: string; name: string; kind: "builtin" | "custom";
  drawing?: { technique: string; variant: string; cuts?: number[] };
  compatible?: { builds?: string[]; styles?: string[]; heads?: string[] };
  frames?: Record<string, Record<string, { ops: Op[]; visible?: boolean }>>;
  palette?: Record<string, string>; edited?: boolean; provenance?: unknown;
  imported?: { recipe: ArtRecipe; frames: Record<string,string>; layers: string[]; roleMap: Record<string,string> };
};
export type CharacterSlot = {
  id: string; name: string; layers: string[]; anchor: [number, number];
  parameters: Record<string, CharacterParameter>; options: CharacterOption[];
};
export type CharacterCreator = {
  format: "grout-character-creator/1"; id: string; name: string; techniqueVersion: "character-drawings/1";
  feedback?: { enabled: boolean; ratings: {key: string; decision: "keep" | "reject"; selection: Partial<Omit<CharacterDocument,"creator">>}[] };
  styles: { id: string; name: string; outline: boolean; shaded: boolean; budget: number }[];
  /** Parsed headWidth is 6/8/10 and torsoWidth is 4/6; odd v1 inputs round up without editing custom pixels. */
  builds: { id: string; name: string; headWidth: number; headHeight: number; headY: number; torsoY: number; torsoWidth: number }[];
  palettes: { id: string; name: string; cloth: string; hat: string; accent: string }[];
  skinRamps: string[][]; hairRamps: string[][]; slots: CharacterSlot[]; provenance: unknown;
};
export type CharacterDocument = {
  format: "grout-character/1"; name: string; creator: CharacterCreator;
  build: string; style: string; frameSize: 16 | 24 | 32; seed: number;
  mode: "authored" | "adjustable" | "procedural"; palette: string; skin: number; hairColor: number;
  selections: Record<string, string>; parameters: Record<string, Record<string, number>>;
  locks: Record<string, boolean>; slotSeeds?: Record<string, number>;
  paletteOverrides: Record<string, string>; layerVisibility: Record<string, boolean>; outline?: ArtRecipe["outline"];
};
export const CHARACTER_CREATOR_FORMAT: "grout-character-creator/1";
export const CHARACTER_FORMAT: "grout-character/1";
export const CHARACTER_FRAMES: readonly string[];
export function createCharacterCreator(): CharacterCreator;
export function parseCharacterCreator(input: unknown): CharacterCreator;
export function createCharacterDocument(creator?: CharacterCreator): CharacterDocument;
export function parseCharacterDocument(input: unknown): CharacterDocument;
export function compileCharacter(input: CharacterDocument): ArtRecipe;
export function isCharacterOptionCompatible(doc: CharacterDocument, option: CharacterOption): boolean;
export function randomizeCharacter(input: CharacterDocument, options?: { seed?: number; slot?: string; include?: string[] }): CharacterDocument;
export function rateCharacter(input: CharacterDocument, decision: "keep" | "reject"): CharacterDocument;
export function captureCharacterEdits(before: ArtRecipe, after: ArtRecipe): ArtRecipe;
export function cloneCharacterOption(input: CharacterDocument, slot: string, id: string, name: string): CharacterDocument;
export function addCharacterSlot(input: CharacterDocument, slot: { id: string; name: string }): CharacterDocument;
export function importCharacterOption(input: CharacterDocument, options: { slot: string; id: string; name: string; recipe: ArtRecipe; frames: Record<string, string>; layers: string[]; roleMap?: Record<string, string> }): CharacterDocument;
