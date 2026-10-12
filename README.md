# Grout Shader: texture authoring

A local texture mill and PNG gallery built with React, TanStack Start and Vite.
Author shader tiles, multi-channel materials and original native pixel terrain.
Gknome owns project configuration, task routing, context and guarded Git workflow.

## Start and verify

The existing npm commands remain the product interface:

```powershell
npm ci --legacy-peer-deps --ignore-scripts
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
npm run build:pages
```

Use `run.cmd` for the Gknome controller and its project-bound actions. Project
identity, source roots and task bindings live in [.tools/project.json](.tools/project.json).
The app runs on port 8080; Pages output is `dist/client`. Node 22.12 or later is
required by the framework; current retained local proof uses Node 26.5.

## Authoring

- [Texture and shader guide](docs/look-dev/texture-authoring.md): catalog, material
  recipes, mesh baking, public PNGs and existing commands.
- [Original retro terrain](docs/look-dev/retro-terrain.md): preserved 64px kit.
- [Paths and weathering](docs/look-dev/retro-terrain-growth.md): curated native
  drawings, Heath/Riverbed palettes, connected paths and deterministic exports.
- [Curated edition](docs/look-dev/retro-terrain-curated.md): independent 16px/64px
  compositions, three palette moods and Grout-compatible native autotiles.
- [Current work and acceptance](docs/TODO.md): technical proof, remaining art
  review and the next bounded polish pass. Purchased artwork stays private.

## Repository map

| Owner | Location |
| --- | --- |
| App and texture generators | `src/` |
| Product bakers and browser/test orchestration | `scripts/` |
| Gknome configuration and controller | `.tools/`, `.agents/`, `summary_bank.json` |
| Foundation verification | `tests/foundation/` |
| Durable guidance and original-only studies | `docs/` |
| Static assets and committed corpus | `public/` |
| Retained local bakes/proof and runtime ownership | ignored `.artifacts/`, `.runtime/` |

## Platform and publication

The app retains Grok preview/hosting compatibility in `.grok/`, `server/`,
`public/__grok/`, `startup.sh` and the existing Vite/env wrappers. These are
runtime integration owners, not a second project setup. Account/connector/
database scaffolding and automatic database migration are removed; host flags
cannot turn sign-in back on. The obsolete sandbox
instructions are retained as [historical context](docs/platform/grok-sandbox-origin.md).

Use only the documented guarded `gitpush.ps1` route for an explicitly authorized
named batch. No raw push, automatic credential access or broad staging. The
earlier OAuth guard failure is recorded in
[the historical closeout](docs/look-dev/retro-terrain-publication-20261011.json);
its unused credential-bearing module is now retired without copying the value.
Current publication still requires all supported helper guards to pass.
Publication saves verified progress; it does not approve artwork or declare
engine receiving complete. Deployment and releases remain separate requests.

[Documentation map](docs/README.md) · [Project guidance](AGENTS.md)

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=gknome-root-organization | change=separated current project entrypoints from retained texture details and historical sandbox guidance

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=curated-retro-terrain | change=linked the additive native curated edition

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=review-recheck-cleanup | change=replaced stale publication-blocker wording with current art handoff
