# gknome Development Lifecycle

This is our normal development shape: lower-level truth first, then higher-level experience, followed by a deliberate freeze and integrity pass. It is a proof model rather than a rigid waterfall. A project may return to an earlier stage when evidence changes the direction; the reason and resulting scope change must be recorded.

The rule across all stages is proportional rigor: apply enough structure to protect the current work and the next handoff without front-loading architecture that the project has not earned yet.

## Stage 1 — Idea

Stage ID: `idea`

Purpose: Define the opportunity, user problem, experiment, or creative direction.

Typical outputs:

- concise problem or opportunity statement,
- intended user or operator,
- desired experience or result,
- major unknowns,
- reasons the idea is worth testing.

Exit gate: We can state what we are trying to learn or build and why a working concept is the next useful action.

## Stage 2 — HAIO / Script Working Concept

Stage ID: `working-concept`

Purpose: Prove the central mechanism with the smallest useful HAIO, script, harness, or technical experiment.

Typical outputs:

- one narrow working path,
- logs or output proving the core mechanism,
- known assumptions and shortcuts,
- first failure cases,
- rough hardware or dependency requirements.

Exit gate: The central mechanism works often enough to justify an interactive demonstration or bounded mini-app.

## Stage 3 — Demo / Mini-App

Stage ID: `demo`

Purpose: Turn the working concept into something interactive, reviewable, and worth continuing.

Typical outputs:

- demo or mini-app,
- repeatable run command,
- visible feedback and useful errors,
- basic proof capture,
- initial user-flow and quality observations,
- a decision to stop, continue, or change direction.

Exit gate: The concept is coherent enough to establish a durable repository rather than continue as disposable scratch work.

## Stage 4 — Repository Foundation

Stage ID: `repo-foundation`

Purpose: Set up shop. Establish the durable project boundary before broad implementation.

Typical outputs:

- repository identity and project profile,
- `AGENTS.md` and coding philosophy,
- project specification and lifecycle state,
- source, docs, tooling, artifacts, `.runtime/`, and secret boundaries,
- shared CLI/TUI task surface,
- context groups and proof lanes,
- contracts, active queue, and future backlog where needed,
- local Git initialization and optional credential-free remote,
- template provenance and version pin.

Exit gate: A new developer or agent can enter the repository, understand what it is, run the basic task surface, locate ownership boundaries, and continue without reverse-engineering the setup.

gknome's first mature responsibility is this stage.

## Stage 5 — Whole-Repository Direction and Identity

Stage ID: `direction-identity`

Purpose: Review the repository as a whole, decide what the project actually is, and set the implementation direction.

Typical outputs:

- project identity and product promise,
- clear audience and use cases,
- non-goals and external boundaries,
- architecture direction,
- implementation order,
- refined context levels,
- one selected queue item plus prioritized future backlog,
- initial pitfall and risk ledger,
- decision on which existing demo code is retained, rewritten, or archived.

Exit gate: The project has a coherent identity, bounded scope, architecture direction, and ordered implementation plan.

## Stage 6 — Full Implementation

Stage ID: `implementation`

Purpose: Build the durable system from lower-level foundations toward higher-level experience.

Default order:

1. Data contracts, storage, and state boundaries.
2. Core domain logic.
3. Backend services and hardware/runtime adapters.
4. CLI and API surfaces, including LLM integration where applicable.
5. Integration and failure-path handling.
6. Frontend and interaction surfaces where needed.
7. Packaging and operator workflows.

The order may change when the project proves that a thin vertical slice is safer or more informative, but the project should not build a polished frontend over unstable lower-level contracts without an explicit reason.

Exit gate: The intended MVP feature set is implemented through its real boundaries, not only mocked or demonstrated.

## Stage 7 — Freeze, Test, and Prove

Stage ID: `snapshot`

Purpose: Stop adding broad scope, stabilize behavior, and produce an MVP or LTS snapshot candidate.

Typical outputs:

- frozen scope and version target,
- clean build and launch path,
- unit, integration, smoke, visual, compatibility, and failure-path proof as applicable,
- secret and dependency review,
- benchmark baseline with hardware and input conditions,
- release or installation artifacts,
- known limitations and rollback path,
- immutable snapshot identity and checksums.

Exit gate: The snapshot is reproducible, testable, understandable, and supportable at its declared level.

MVP means the product promise is minimally complete. LTS means we are prepared to preserve compatibility and support that snapshot; it is not merely another word for stable.

## Stage 8 — Integrity Pass and Scale Readiness

Stage ID: `integrity-pass`

Purpose: Straighten out the wires after the snapshot. Reduce friction and debt without reopening uncontrolled product scope.

Typical outputs:

- full repository integrity review,
- pitfall and solution ledger,
- stale or duplicated source-of-truth removal,
- focused context groups and size budgets,
- dependency and runtime cleanup,
- path, secret, and generated-state audit,
- performance and capacity improvements that preserve Show,
- clarified contracts and ownership,
- migration or scaling plan,
- hardened clean-slate baseline.

Exit gate: The repository is organized, understandable, measured, and ready for the next feature cycle or scale increase without carrying avoidable ambiguity.

## Transition rules

- Stage changes are explicit decisions, not automatic file-count heuristics.
- The current stage belongs in tracked project state.
- Every transition records a reason and timestamp.
- Backward transitions are allowed but must be explicitly marked as regressions or scope resets.
- A project may have work from multiple stages, but one stage remains the current primary operating mode.
- Snapshot and integrity gates should cite proof, not only confidence.
