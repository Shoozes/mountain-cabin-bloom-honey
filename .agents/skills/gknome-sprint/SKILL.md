---
name: gknome-sprint
description: Execute one selected Gknome queue item as a complete, runnable, verified outcome while preserving project runtime ownership. Use Fresh, Continue, or Adapt, then remove the completed item from active routing. Handoff and publication remain separate.
---

# Gknome sprint

Use this skill for three bounded implementation paths:

- **Fresh:** combine the operator-supplied specification with the generated
  foundation. Do not invent or request a replacement specification. Record only
  durable identity, constraints, acceptance conditions, and proof expectations.
- **Continue:** read the selected queue item, preserve its owner and Done when,
  then implement all remaining slices required to complete that outcome.
- **Adapt:** map the real source roots, commands, manifests, imports/exports,
  tests, mutable data, and controller ownership before changing layout. Keep
  the caller's runtime and public commands intact.

## First 30 seconds

Route before reviewing broadly:

1. No valid `.tools/project.json` yet and no generated-path collision means
   **Fresh**. From that folder run `gknome -Here -Yes -AsJson` immediately.
   Supplied specifications, research notes, ordinary tools, and canonical or
   legacy secret directories do not make the folder an adoption candidate.
2. A valid foundation means **Continue** or **Adapt**.
3. Use experimental adoption only when an established repository already has
   foundation/contracts or generated-path collisions that need reviewed
   preservation and rollback. Never run adoption as a precautionary substitute
   for the fresh path.

Foundation creation should finish within 30 seconds on a normal local checkout.
If it does not, report the exact command, elapsed time, and blocker immediately;
do not spend the sprint on a broader review or workaround. During the first
slice, keep safety proportional: cheap containment, overwrite, secret, timeout,
and cleanup guards stay; broad integrity, threat, compatibility, and release
proof wait until a concrete trust or growth boundary requires them.

Before the operator intentionally creates or publishes Git history, use build
mode: select one vertical source/check/run outcome, implement it, prove it with
the smallest relevant check, and continue until the selected queue item's Done
when is met. Planning must terminate in the next edit. Defer broad review,
backlog grooming, history prose, full compatibility matrices, and release
polish until a milestone gate or concrete trigger makes them necessary.

## Working frame

The selected queue item owns What, Why, When, Where, How, risk, and a testable
**Done when**. Do not restate the full schema for every concern. A sprint should
normally contain one product outcome, one source boundary, one product-facing
test, one applicable Run or Check task, and one visible proof result. Break a
large item into implementation units, but do not treat the first unit as a
handoff boundary.

Read `AGENTS.md` and the selected `docs/work/queue/` item, then use the current
Summary Bank as the route map for the smallest sufficient orientation and task
groups. Read the selected file contents; expand to changed or newly matched
working-tree material when evidence or scope requires it. Freshness does not
prove task coverage, and a budget omission does not prove the omitted source is
irrelevant. Do not run List, Audit, Build, and Verify as a mandatory chain.
Read only the identity, specification, lifecycle, context, or backlog owners
needed by that item. Use current lifecycle and project state as evidence, not as
a substitute for the supplied specification. Keep product identity, project
identity, lifecycle state, proof, and context selection as separate contracts.

## Safe implementation

- Preserve public commands, route paths, file formats, and caller-owned runtime
  roots unless the specification explicitly changes them.
- Classify files by ownership before moving them: product source, operator
  tooling, tests, fixtures, docs, generated artifacts, or runtime data.
- Propagate a source change through manifests, working directories, imports,
  exports, language module declarations, fixtures, ignore rules, task routes,
  context groups, and active docs.
- Prefer process/check/open/sequence/recipe task specs. Keep unsupported task
  kinds out of the public contract.
- Keep mutation and network writes behind explicit prompt or typed confirmation.
  The optional native companion is headless-only and never owns a menu or
  confirmation flow; explicit project actions stay with the PowerShell controller.
- Bound subprocess time, output, cancellation, and error messages. Capture
  native output as an array before joining or trimming it in PowerShell.
- When work adds background services, IPC or growing output, read
  [runtime ownership](../../../docs/dev/RUNTIME_LIFECYCLE.md) and exercise the
  affected shutdown/retention paths through existing project owners.
- Do not silently install dependencies, use a network, publish, rewrite Git, or
  invent architecture. Record an owner-scoped skip when a capability is absent.
- Do not leave copied menus, TODO-only handlers, dead imports, unreachable
  operations, or placeholder tests inside the authorized slice.

## Controller and proof

For a project-owned controller, put applicable product actions first, Git
second, and foundation diagnostics/context later. Omit empty categories rather
than showing stubs. Route product tasks through a bounded adapter, preserve
foundation tasks, and prove exactly one page reference per operation.

When a project operation is available, the first non-empty product page comes
before Git, Git remains the second page, and Start/support pages follow it. Keep the
ordering data-driven and hide empty categories; do not add a readiness scorer
or planner just to choose the page order.

Run the smallest changed-boundary test first. Run the proportional local gate
needed to complete the queue item; reserve the full candidate/release matrix
for an explicit milestone closeout. Include PowerShell 5.1/7 compatibility when
the change touches a public script. Static, mocked, template, and native proof
must remain labeled separately.

## Foundation upgrade conflicts

A fail-closed foundation-upgrade conflict is an ownership handoff, not
overwrite permission. Preserve the conflict report and create one ignored,
hash-inventoried reconciliation bundle before moving an exact target. Classify
each path as a mutable project contract, foundation implementation,
caller-owned product content, or retired foundation content.

The shipped `.agents/skills/gknome-sprint/` tree and `.agents/skill-routes.json`
are foundation-owned: repair restores missing files, explicit update replaces
only provenance-matched unchanged bytes, and a local modification blocks before
mutation. All other `.agents/skills/<project-skill>/` trees are project-owned;
preserve their bytes and keep them outside refreshed template provenance unless
the project explicitly transfers ownership.

The launcher may merge validated `.tools/project.json`, review-owned
`.tools/project-spec.json`, and generated `version.json` because project
identity, settings, task adapters, scope, acceptance, release, and runtime
fields are intentionally mutable. A prior additive reconciliation may omit an
individual contract record, so the launcher must validate the complete shape
and old project/template identity before merging, bind active template identity,
retain host context entries while adding required template text types, back up
prior bytes, and refresh provenance to each merged result. A diverged
provenance-owned `docs/PROJECT_SPEC.md` is
already project review content: preserve it byte-for-byte and leave it out of
refreshed template provenance. Unchanged or missing owned copies still adopt
the current template; an existing copy absent from old provenance still blocks.
For other changed foundation code or docs, recover the exact provenance base
when available and apply only the host delta to the new file. Existing root
`run.ps1`/`run.cmd` files absent from old provenance are caller-owned public
entrypoints: the launcher preserves their bytes and leaves them out of refreshed
template provenance. A changed provenance-owned runner is still a conflict. If
an authentic base is unavailable, preserve the current bytes and stop for a
reviewed disposition—never edit provenance to make changed content appear
unchanged. Other caller-owned files that overlap a new foundation path require
an explicit preserve/merge decision. Known project-owned README, agent-guide,
summary-bank, and ignore paths already present but absent from provenance remain
byte-identical and outside refreshed provenance.

When a release adds a nested foundation file whose destination tree is absent,
do not create the directory manually to bypass a launcher error. The migration
must validate the nearest existing in-root ancestor, create the missing parent
chain, recheck ancestry, install the file, and record its exact hash in refreshed
provenance. If that sequence fails, preserve host state and route the launcher
defect upstream before retrying.

After reconciliation, prove the migration backup and provenance identity,
reapply only reviewed host adaptations, and rerun the caller runner, product
boundaries, imports/exports, context freshness, and supported PowerShell lanes.
The upgrade is done only when rollback evidence exists and both the foundation
and caller-owned product remain runnable.

## Completion

After Done when and verification are demonstrated, move the selected queue item
to `docs/work/done/`, or remove it when its evidence is already durable
elsewhere. Completion owns this transition in the same sprint; never wait for a
separate closeout or handoff request, and never leave a done item in active
routing. Update `docs/TODO.md` only for real future work, history only for a
milestone or significant architecture change, the pitfall ledger only for a
proven durable hazard, and `summary_bank.json` only when routes or budgets
changed. Record a next action only when real remaining work or an external
blocker exists.

A handoff is optional person-to-person context after the repository state is
accurate. Use `.agents/workflows/project-handoff.md` only when requested; do not
make it the queue-completion owner or manufacture follow-up work to fill it.

Publication is never part of this skill. Use the explicit `publish-main` route
only after local verification is already complete.
