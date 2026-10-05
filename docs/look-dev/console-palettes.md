# Console palettes

Three named mill ramps for the pixel look. Existing palettes stay. `style` remains the default (per-style colors). No new catalog styles. Pixel-finish GLSL is unchanged — Tessera owns that pass.

Donor: [Shoozes/Grout-Library](https://github.com/Shoozes/Grout-Library) `src/palettes.js` at tip `9834a7a` (MIT). Show picked these four-stop hex ramps from that file. grout13 was not used.

| id | name | stops |
| --- | --- | --- |
| `pico8` | PICO-8 | `#1d2b53` `#5f574f` `#c2c3c7` `#fff1e8` |
| `gameboy` | Game Boy | `#0f380f` `#306230` `#8bac0f` `#9bbc0f` |
| `nes` | NES | `#000000` `#7c7c7c` `#f8f8f8` `#a81000` |

- `pico8` — PICO-8 dark blue, dark gray, light gray, white. A four-stop pick4 ramp for the pixel look.
- `gameboy` — exact `GAMEBOY_PALETTE` from the donor (already four colors).
- `nes` — black, gray, and off-white plus the red accent from the curated `NES_PALETTE`.

Deferred: `c64` and `cga`. Not in this tranche.

The mill lists every `PALETTES` entry as a chip (Adjust). `resolvePalette` already resolves a named id to its four colors, and falls back to the style palette only for `style` or an unknown id.

---
Work: 2026-10-05T09:20:00-04:00 | agent=Swatch | role=Look-dev / Visual Director | where=Shoozes/mountain-cabin-bloom-honey | what=console palettes pico8, gameboy, nes from Grout-Library 9834a7a
