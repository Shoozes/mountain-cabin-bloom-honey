import { copy, parseRecipe, pixelHash } from "./core.mjs";
import { getTravelerWardrobe, setTravelerWardrobe, TRAVELER_CLOTHING, TRAVELER_HATS, TRAVELER_PALETTES } from "./traveler.mjs";
export const VARIATION_FORMAT = "grout-sprite-variations/1";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const id = (value) => typeof value === "string" && /^[-a-zA-Z0-9_]{1,80}$/.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
const uint = (value) => { if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw Error("Variation seed must be uint32"); return value; };
const hash = (text) => [...text].reduce((value, ch) => Math.imul(value ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
const record = (value) => value && typeof value === "object" && !Array.isArray(value);

/** Groups own disjoint roles/parts; every option supplies the same complete patch. */
export function parseSpriteVariations(input, source) {
  const recipe = parseRecipe(source);
  if (recipe.character) throw Error("Use the character creator for character document variations");
  const profile = copy(typeof input === "string" ? JSON.parse(input) : input);
  if (!record(profile) || profile.format !== VARIATION_FORMAT || !Array.isArray(profile.groups) || !profile.groups.length || profile.groups.length > 16 ||
      new TextEncoder().encode(JSON.stringify(profile)).length > 524288) throw Error("Invalid sprite variation family");
  const groups = new Set(), owners = new Set();
  for (const group of profile.groups) {
    if (!id(group.id) || groups.has(group.id) || typeof group.name !== "string" || !group.name.trim() || !Array.isArray(group.options) || !group.options.length || group.options.length > 32)
      throw Error("Invalid or duplicate variation group");
    groups.add(group.id);
    const options = new Set();
    let scope;
    for (const option of group.options) {
      if (!id(option.id) || options.has(option.id) || typeof option.name !== "string" || !option.name.trim() ||
          Object.keys(option).some((key) => !["id", "name", "palette", "parts"].includes(key)) ||
          !record(option.palette ?? {}) || !record(option.parts ?? {})) throw Error("Invalid or duplicate variation option");
      options.add(option.id);
      const keys = [...Object.keys(option.palette ?? {}).map((key) => "palette:" + key), ...Object.keys(option.parts ?? {}).map((key) => "parts:" + key)].sort();
      if (!keys.length || (scope && !same(scope, keys))) throw Error("Variation options must cover the same complete roles and parts");
      if (!scope) {
        scope = keys;
        for (const key of keys) {
          if (owners.has(key)) throw Error("Variation groups cannot overlap: " + key);
          owners.add(key);
        }
      }
      for (const role of Object.keys(option.palette ?? {})) if (!Object.hasOwn(recipe.palette, role)) throw Error("Unknown variation palette role " + role);
      for (const part of Object.keys(option.parts ?? {})) if (!Object.hasOwn(recipe.parts, part)) throw Error("Unknown variation part " + part);
      parseRecipe({ ...recipe, palette: { ...recipe.palette, ...option.palette }, parts: { ...recipe.parts, ...option.parts } });
    }
  }
  return profile;
}
function checkState(profile, selections, locks) {
  if (!record(selections) || !record(locks)) throw Error("Invalid variation selections or locks");
  for (const key of [...Object.keys(selections), ...Object.keys(locks)]) if (!profile.groups.some((group) => group.id === key)) throw Error("Unknown variation group " + key);
  for (const group of profile.groups) {
    if (!group.options.some((option) => option.id === selections[group.id])) throw Error("Missing or invalid selection for " + group.id);
    if (locks[group.id] !== undefined && typeof locks[group.id] !== "boolean") throw Error("Variation lock must be boolean");
  }
}
export function applySpriteVariation(input, family, { selections, locks = {}, seed = 1204 } = {}) {
  const recipe = parseRecipe(input), profile = parseSpriteVariations(family, recipe);
  checkState(profile, selections, locks); uint(seed);
  for (const group of profile.groups) {
    const option = group.options.find((option) => option.id === selections[group.id]);
    Object.assign(recipe.palette, copy(option.palette ?? {}));
    Object.assign(recipe.parts, copy(option.parts ?? {}));
  }
  recipe.spriteVariations = profile;
  recipe.spriteVariation = { seed, selections: copy(selections), locks: copy(locks) };
  return parseRecipe(recipe);
}
export function randomizeSpriteVariation(input, family, { seed = 1204, selections, locks, group: only } = {}) {
  const recipe = parseRecipe(input), profile = parseSpriteVariations(family, recipe);
  uint(seed);
  locks ??= recipe.spriteVariation?.locks ?? {};
  const chosen = { ...(selections ?? recipe.spriteVariation?.selections ?? Object.fromEntries(profile.groups.map((group) => [group.id, group.options[0].id]))) };
  checkState(profile, chosen, locks);
  if (only !== undefined && !profile.groups.some((group) => group.id === only)) throw Error("Unknown reroll group " + only);
  if (only && locks[only]) throw Error("Unlock " + only + " before rerolling");
  for (const group of profile.groups) if (!locks[group.id] && (!only || only === group.id)) {
    const choices = only && group.options.length > 1 ? group.options.filter((option) => option.id !== chosen[group.id]) : group.options;
    chosen[group.id] = choices[pixelHash(hash(group.id), 0, seed) % choices.length].id;
  }
  return applySpriteVariation(recipe, profile, { selections: chosen, locks, seed });
}
export function generateSpriteVariations(input, family, { seeds = [1204, 1215, 1233], selections, locks } = {}) {
  if (!Array.isArray(seeds) || !seeds.length || seeds.length > 64) throw Error("Variation batch needs 1..64 seeds");
  return seeds.map((seed) => randomizeSpriteVariation(input, family, { seed, selections, locks }));
}
/** Reuse accepted apparel only; anatomy, feet, frame corrections and timing stay untouched. */
export function createSpriteVariationProfile(input) {
  const recipe = parseRecipe(input);
  if (recipe.character) throw Error("Use the character creator for character document variations");
  if (recipe.spriteVariations) return parseSpriteVariations(recipe.spriteVariations, recipe);
  if (!getTravelerWardrobe(recipe) || !["tunic", "vest"].every(role => Object.hasOwn(recipe.palette, role))) return parseSpriteVariations({ format: VARIATION_FORMAT, groups: [{ id: "colors", name: "Colors", options: [{ id: "current", name: "Current colors", palette: copy(recipe.palette) }] }] }, recipe);
  const definitions = [
    ["clothing", "Clothing", TRAVELER_CLOTHING, "coat-"],
    ["hat", "Hat", TRAVELER_HATS, "cap-"],
    ["palette", "Colors", TRAVELER_PALETTES, null],
  ];
  const groups = definitions.map(([key, name, catalog, prefix]) => {
    const snapshots = catalog.map((item) => ({ item, recipe: setTravelerWardrobe(recipe, { [key]: item.id }) }));
    const partKeys = prefix ? Object.keys(recipe.parts).filter((part) => part.startsWith(prefix)) : [];
    const roleKeys = prefix ? [] : ["cloth", "clothLight", "cap", "accent", "tunic", "vest"];
    const patch = (value) => prefix ? { parts: Object.fromEntries(partKeys.map((part) => [part, value.parts[part]])) } : { palette: Object.fromEntries(roleKeys.map((role) => [role, value.palette[role]])) };
    const options = snapshots.map(({ item, recipe: value }) => ({ id: item.id, name: item.name, ...patch(value) }));
    if (key === "hat") options.push({ id: "none", name: "No hat", parts: Object.fromEntries(partKeys.map(part => [part, []])) });
    const match = options.findIndex(option => same(patch(recipe), prefix ? { parts: option.parts } : { palette: option.palette }));
    if (match >= 0) options.unshift(...options.splice(match, 1));
    else options.unshift({ id: "current", name: "Current drawing", ...patch(recipe) });
    return { id: key, name, options };
  });
  const bagParts = Object.keys(recipe.parts).filter(part => part.startsWith("bag-"));
  if (bagParts.length) groups.push({ id: "backpack", name: "Backpack", options: [
    { id: "carried", name: "Current backpack", parts: Object.fromEntries(bagParts.map(part => [part, recipe.parts[part]])) },
    { id: "none", name: "No backpack", parts: Object.fromEntries(bagParts.map(part => [part, []])) },
  ] });
  return parseSpriteVariations({ format: VARIATION_FORMAT, groups }, recipe);
}
