# gknome Coding Philosophy

Our priority order is:

1. Safety
2. Courtesy
3. Show
4. Efficiency

These are ordered decision gates, not equal-weight preferences. A later pillar does not justify damaging an earlier pillar. Efficiency cannot excuse unsafe behavior, hostile operation, or visibly poor results. Show cannot excuse data loss or an unmaintainable handoff.

The pillars are also scope-proportional. Early experiments need conscious boundaries, not enterprise architecture. Snapshot and integrity stages require stronger proof because the project is claiming durability.

The practical loop is: protect the work, make the handoff kind, make the result worth seeing, then make the sound version faster and smaller. When a pillar fails, stop at that gate and repair it before polishing a later one.

## Safety

Safety protects peace of mind, data, users, developers, hardware, credentials, and the ability to recover.

Safety includes:

- correct types, state transitions, and invariants,
- async, thread, process, cancellation, timeout, and lifecycle correctness,
- byte counts, encoding, path containment, and file integrity,
- secret, privilege, network, and dependency boundaries,
- input validation and failure-path behavior,
- memory, disk, VRAM, GPU, CPU, thermal, and workload capacity considerations,
- reversible or staged mutation when data can be harmed,
- linting, static checks, tests, and cybersecurity appropriate to the current stage,
- explicit uncertainty instead of invented proof.

Safety does not mean overengineering. It means recognizing the real failure surface at the current scope and addressing it before the failure becomes expensive.

Safety also has a time budget. During a fresh sprint, run only cheap guards
that prevent immediate harm: path containment, no overwrite, opaque secret
exclusion, bounded child cleanup, and the focused check for the current slice.
Do not require release-grade adoption, exhaustive audit, threat modeling,
compatibility matrices, or proof packets before the first runnable result.

Escalate when the app introduces untrusted input, credentials or network
access, irreversible mutation, persistent user data, concurrency/process
ownership, external users, or a snapshot/publication claim. Foundation setup
has a 30-second local target; a miss is a workflow blocker to report directly,
not a reason to add more planning.

Before intentional Git creation or publication, favor doing over repository
ceremony. Select the smallest vertical result that can run, implement it, run
its focused check, and repeat. Planning should terminate in an edit; broad
review and history work should terminate a completed slice.

Stage examples:

- Working concept: do not overwrite user data; bound the experiment; expose assumptions.
- Demo: provide cancellation, useful failures, and safe temporary output.
- Repository foundation: establish secret, generated-state, and path policies.
- Snapshot: test destructive paths, compatibility, recovery, capacity, and release integrity.

## Courtesy

Courtesy serves both the user and the next developer or agent pass.

Courtesy includes:

- clear setup, commands, errors, and recovery instructions,
- safe and unsurprising defaults,
- clean code, concise comments, stable naming, and readable control flow,
- a small root and predictable ownership boundaries,
- current context routes, specifications, contracts, action boards, and proof notes,
- leaving files, tests, and documentation ready for the next pass,
- avoiding hard-coded personal paths and hidden environment assumptions,
- considering platform, hardware, GPU/CPU, display size, DPI, input method, and accessibility where relevant,
- respecting project policy and contracts unless the task explicitly changes them.

Courtesy does not require supporting every platform or device. It requires making supported and unsupported conditions explicit and designing reasonable fallbacks when the project scope warrants them.

## Show

Show is the visible and experiential quality of the work.

What we build should look intentional, feel smooth, and be worth demonstrating. This applies to internal developer tools, background processes, CLIs, TUIs, logs, proof captures, demos, and final interfaces.

Show includes:

- coherent visual hierarchy and interaction flow,
- smooth feedback instead of jank or unexplained waiting,
- readable progress, status, warnings, and results,
- high-quality demos that are interactive rather than static facades,
- clear proof capture for backend and model processes,
- appropriate behavior across supported resolutions, DPI levels, and form factors,
- avoiding placeholder-heavy, inconsistent, or disposable-looking output in claimed snapshots.

Show is not decoration layered over unstable behavior. It is the presentation of a system whose lower-level behavior is already trustworthy enough to expose.

## Efficiency

Efficiency improves a system after Safety, Courtesy, and Show are sound enough for the current stage.

Efficiency includes:

- measuring before optimizing,
- reducing startup, build, inference, render, transfer, and test time,
- lowering memory, VRAM, disk, network, and context costs,
- removing duplicated logic and unnecessary dependencies,
- simplifying maintenance and operator steps,
- improving context precision and proof density,
- preserving visual and interaction quality while optimizing.

An optimization is not successful when it makes the system harder to understand, less safe, less usable, or visibly worse without a justified tradeoff.

## Scope ladder

Apply the philosophy at the level the project has earned:

- Concept: bound the experiment, protect data, and expose assumptions.
- Demo: make the central flow repeatable, legible, and pleasant enough to evaluate.
- Repository foundation: establish ownership, context, secret, runtime, and proof boundaries.
- Implementation: harden real contracts and failure paths before adding surface area.
- Snapshot: freeze scope and prove the claims made by the release.
- Integrity pass: reduce debt and improve capacity without reopening uncontrolled scope.

## Decision rule

When choices conflict, ask in order:

1. Is it safe enough for the current scope and stage?
2. Is it considerate to users and the next development pass?
3. Does it present and feel like quality work?
4. Is it efficient, measured, and clean?

Stop at the first failed gate. Fix that gate before optimizing a later one.

## Review language

Useful review statements are concrete:

- Safety: "The cancellation path can leave the output partially replaced. Stage the output and rename only after verification."
- Courtesy: "The command fails correctly but does not tell the operator where the report was written."
- Show: "The backend process works, but progress freezes visually during the longest operation."
- Efficiency: "The packer re-reads every file three times; benchmark a single-pass implementation after correctness tests are locked."

Avoid vague labels such as "clean," "production-ready," or "optimized" without stating the observed behavior and proof.
