# Agent route

The project keeps policy, action items, and proof local while reusable skills
remain in the host catalog.

- `AGENTS.md` is the policy and lifecycle authority.
- `.agents/README.md` maps the five active routes, with local closeout and
  publication separate.
- `.agents/skills/gknome-sprint/SKILL.md` owns one selected queue item through
  verified completion and removal from active routing.
- `summary-bank-context` owns bounded context selection and audit.
- `repo-integrity-pass` owns whole-repository proof reconciliation.
- `backlog-surgeon` owns future-backlog cleanup; selected executable work lives
  under `docs/work/queue/`.
- `curtail` owns the smallest safe implementation and removes unsupported
  flexibility.

Use the smallest route that matches the current task. Start from the selected
queue item and supplied project specification, then update only the
project-owned authorities required by the implemented behavior.

A requested handoff names the current stage, changed files, proof commands, and
unresolved risks. It names a next Done when only when real work remains, and is
optional person-to-person context rather than the completion owner. Completed
items leave active routing for `docs/work/done/` or are removed when their
evidence is durable elsewhere. Publication uses only the explicit
`publish-main` route.
