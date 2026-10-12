# mountain-cabin-bloom-honey Stage 5 Whole-Repository Review

Use this after the repository foundation exists and before broad implementation. The goal is to discover the project's real identity and direction, not to polish every placeholder.

## 1. Identity

- What is this project now, based on the working concept and demo?
- Who uses it directly?
- What promise does it make?
- What is the smallest complete outcome worth maintaining?
- What is explicitly not part of this project?

Output: update `docs/PROJECT_IDENTITY.md`.

## 2. Demonstration disposition

Classify existing demo material:

- retain as production candidate,
- retain as reference,
- rewrite behind a stable contract,
- archive as proof only,
- remove because it creates misleading direction.

Do not let a quick demo choose the permanent architecture by accident.

## 3. Ownership and boundaries

- Which repository or module owns each domain?
- Which paths own source, generated artifacts, runtime state, models, caches, uploads, and secrets?
- Which external tools or services are optional, required, or excluded?
- Are contracts explicit where processes or repositories meet?

## 4. Architecture direction

Review in lower-to-higher order:

1. data and state,
2. domain logic,
3. backend and hardware/runtime adapters,
4. CLI and API,
5. integrations and failure paths,
6. frontend and interaction,
7. packaging and release.

Record why this order fits the project. Use a thin vertical slice only when it reduces risk or proves a major unknown.

## 5. Safety

- What can lose data, expose secrets, hang, race, corrupt bytes, or exceed hardware capacity?
- Which operations must stage, verify, then apply?
- What cancellation and recovery behavior is required?
- Which compatibility claims need actual machines or hardware?

## 6. Courtesy

- Can a new operator run the project without guessing?
- Can the next agent find the right context without loading the whole repository?
- Are errors actionable?
- Are personal paths, hidden services, and implicit environment assumptions removed?
- Are supported platforms, hardware, and display conditions explicit?

## 7. Show

- Is the current demo worth recording?
- Are progress, state, and failures visible?
- Does the experience feel deliberate rather than assembled from placeholders?
- Which visual, motion, audio, console, or proof surfaces require a quality bar?

## 8. Efficiency

- What is measured now?
- Which costs are likely material: startup, build, memory, VRAM, latency, frame time, context size, disk, network, or maintenance?
- Which optimizations should wait until snapshot behavior is locked?

## 9. Proof and tests

- What is the smallest proof that the core path works?
- Which unit, integration, smoke, visual, compatibility, failure-path, and benchmark lanes apply?
- Which claims are not yet testable?
- Where are generated reports written, and which conclusions become durable docs?

## 10. Direction

End the review with:

- current lifecycle stage,
- next bounded milestone,
- ordered workstreams,
- acceptance gates,
- major risks,
- context groups needed for implementation,
- demo code disposition,
- explicit decisions and unresolved questions.
