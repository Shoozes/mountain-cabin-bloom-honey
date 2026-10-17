# Documentation map

Use the smallest audience-specific entrypoint that answers the current
question.

| Audience | Start here | Purpose |
| --- | --- | --- |
| Everyone | `README.md` | Identity and first commands |
| Operator | `docs/user/README.md` | Safe daily commands and Git boundaries |
| Developer | `docs/dev/README.md` | Source changes, tests, and local proof |
| Agent | `docs/agents/README.md` and `.agents/README.md` | Scope, context, routes, and handoff |
| Sprint reviewer | `docs/research-inbox/README.md` | Temporary raw research intake; ingest decisions into durable owners |

Product work stays in the existing React/Vite app under `src/`; Gknome supplies
project contracts and operation/context routing, rather than a second app tree.
The private reusable sprite SDK lives in `packages/grout-art/`; its
[authoring guide](look-dev/grout-art.md) covers the Studio, shader profile,
atlas contract and capability migration matrix.
Use [texture authoring](look-dev/texture-authoring.md) for material, shader and
corpus details; [retro terrain](look-dev/retro-terrain-growth.md) for curated
native drawings, paths and weathering; and [the tool guide](look-dev/texture-tools.md)
for export ownership. The [historical Grok sandbox contract](platform/grok-sandbox-origin.md)
explains inherited platform hooks and does not govern current local work.

The root `AGENTS.md` is the policy authority. `docs/` explains project-facing
workflow; `.agents/` provides the machine-readable routes and local sprint
skill. Keep active executable assignments in `docs/work/queue/`, future backlog
in `docs/TODO.md`, and verified queue evidence in `docs/work/done/` when useful.

AI-edited: 2026-10-11 | agent=Codex/root | model=unknown | effort=unknown | task=gknome-root-organization | change=bound the documentation map to existing product and retained platform owners

AI-edited: 2026-10-16 | agent=Codex/root | task=grout-art-successor | change=routed the private sprite SDK and Studio guide
