# Project scripts

Existing npm commands remain the product interface. `scripts/project-tasks.ps1`
is the bounded Gknome adapter: it dispatches fixed program/argument arrays and
never evaluates forwarded shell text. `run.cmd` and `scripts/run.ps1` preserve
the generated control plane; they do not replace Vite or package scripts.

Use `project-status`, `project-dev`, `project-build-pages`, `project-test`,
`project-typecheck` and `project-lint` through the controller. `project-setup`
and the full `project-build` require `-Yes`; `-DryRun -AsJson` reports plans
without executing them. Development stays foreground; this onboarding pass
launches no persistent service or stops retained previews.

The registry's `project-test-terrain` invokes the existing
`node --test scripts/retro-terrain.test.mjs` as a bounded check. Product tests
remain in existing scripts and shader modules. Foundation contract checks live
in `tests/foundation/`; no framework split or second product tree is created.

The project-owned `project-publish` adapter delegates only to the local qualified
`.tools/gitpush.ps1`. Prefer invoking that documented helper directly with an
explicit Path/Message for CommitOnly, then no Path for verified push-only main.
The adapter admits no remote creation, force, credential fallback or raw push.

---
AI-edited: 2026-10-11T19:40:02-04:00 | agent=Codex/root | model=unknown | effort=unknown | task=docs | change=bound standalone texture tool foundation and guarded workflow
