# Agent route

Read `AGENTS.md`, the selected `docs/work/queue/` item, and only the identity,
specification, lifecycle, or context owners needed by that item. The generated
project does not copy host skills; use the smallest available host skill or the
local fallback documents and commands.

Use the local gknome-sprint skill to complete one fresh, continuing, or adapting
queue item. It combines a supplied specification with the foundation, preserves
runtime ownership, continues until the queue item's Done when is proven, then
archives or removes the item from active routing in the same sprint. Use
project-handoff.md only for a requested person-to-person handoff; it is not a
completion gate.

The shipped `.agents/skills/gknome-sprint/` tree and `skill-routes.json` are
foundation-owned. Additive repair restores missing shipped files; explicit
update replaces only provenance-matched unchanged foundation bytes; a locally
modified foundation skill stops update before mutation. Any other
`.agents/skills/<project-skill>/` tree is project-owned, preserved byte-for-byte,
and never added to template provenance merely because it shares the skills
directory.

skill-routes.json is declarative routing only. Its five routes are:

- sprint: complete one selected queue outcome with gknome-sprint;
- context-review: inspect summary-bank groups, paths, and budgets read-only;
- proof: run local tests and keep static, mocked, template, and native proof
  distinct;
- handoff: provide optional person-to-person context without owning queue
  completion, publishing, or a manufactured next task;
- publish-main: explicitly publish already verified work through the
  repository-owned Git handoff.

Routes do not grant permission beyond their declared policies. In particular,
only `publish-main` can request network or Git publication, and it still
requires explicit confirmation. Keep product source, operator tooling, tests,
docs, generated artifacts, and runtime data in their owning boundaries. When a
capability is missing, record the owner-scoped skip and its completion
condition.
