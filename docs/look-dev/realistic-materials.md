# Realistic material recipes

The mill's **Photorealistic materials** catalog entry opens six original
procedural starting surfaces: Loamy soil, Mixed gravel, Weathered limestone,
Poured concrete, Oak bark and Weathered timber. These are candidates for a more
realistic treatment; they are not scanned photographs or approved game artwork.

Each preset starts at 512×512 with seed 1204 and the Earth mood. Choose 64, 128,
256 or 512 pixels, Earth/Slate/Ochre, a seed, structure scale, fractures, relief
and roughness. The larger sizes retain more of the fine mineral, pore and fiber
detail. View a single tile or a 2×2/4×4 repeat with smooth filtering.

**Lit surface** shows the matched normal and roughness maps under one neutral
authoring light. The four channel views remain available. Lighting is a preview
operation: exported albedo contains pigment only. This preview does not qualify
an engine's illumination, filtering or material response.

The new `realistic-surface/1` CPU generator supplies continuous pigment and
periodic structure rather than a finite pixel-art ramp. Soil combines clods,
pores and compacted patches; gravel uses varied elliptical stones and fines;
limestone uses interrupted fissures and mineral deposits; concrete uses cement
variation, sparse aggregate and pinholes; bark uses irregular plates and broken
fissures; timber uses uneven longitudinal grain and sparse knots. Color moods
affect pigment only. Relief drives height and wrapped +Y tangent normals.

Save a JSON recipe, then use the existing material baker:

```json
{
  "id": "realistic-surface",
  "family": "gravel",
  "size": 512,
  "seed": 1204,
  "palette": "earth",
  "strataScale": 4,
  "fracture": 0.28,
  "relief": 0.65,
  "roughness": 0.8
}
```

```powershell
npm run bake:material -- --recipe C:/work/gravel-realistic.json --variant-set single --out .artifacts/materials
npm run bake:material -- --recipe realistic-surface --seed 1204 --out .artifacts/materials
```

The ID-only command defaults to soil. `catalog` remains the default variant set
with seed offsets 0, 11 and 29. `single` writes one requested seed. Browser ZIP
exports contain the four PNG maps, recipe and `texture-material/1` manifest;
CLI output also includes a contact sheet. Albedo is sRGB; height, normal and
roughness are linear data. Maps are opaque and record `filter: linear` and
`wrap: repeat`. Source identity includes `material-realistic.mjs`. Validated
cache reuse checks both source identity and deterministic output bytes.

Original recipes, commands, draft keys and the 75 shader tiles remain available.
The new recipe has no appearance-style field. The existing material draft key
recovers both old and new recipes, and the material/retro disclosures share one
active authoring preview. A failed export leaves the draft available for retry.

All source is independently authored. No purchased images, extracted palettes
or reference artwork are inputs. Every manifest keeps `visualReview: unapproved`.
Periodic fields can still reveal a repeat footprint; runtime anti-tiling and
actual-scene receiving remain separate work. Judge fit beside the game's trees,
props, water and sky using the [scene-coherence workflow](texture-authoring.md#game-facing-authoring-scene-coherence-first).

Focused checks and the browser harness are:

```powershell
node --test scripts/material-realistic.test.mjs scripts/material-strata.test.mjs src/shader/material.test.mjs
node scripts/test-realistic-material-browser.mjs --dev-url http://127.0.0.1:8080/
node scripts/test-realistic-material-browser.mjs
```

The dated [local verification receipt](realistic-materials-proof.json) records
the checks actually run and their source scope. It preserves the 184 pinned
channel identities of 46 older material recipes. Tests prove behavior and
compatibility; the owner still needs to accept the visuals.

AI-edited: 2026-10-12 | agent=Codex/root | model=unknown | effort=unknown | task=realistic-material-catalog | change=documented six original continuous material recipes, preview lighting and preserved legacy behavior
