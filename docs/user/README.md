# Operator guide

This project has a safe foundation controller. It is not a claim that the
product runtime is complete.

## First run

1. Read `README.md`, `AGENTS.md`, and `.tools/project-state.json`.
2. Open `run.cmd sprint` and `run.cmd spec`.
3. Run `run.cmd stage` and `run.cmd doctor`.
4. Run `run.cmd test` before sharing or publishing work.

The controller keeps Start first and Git second. `.tools/gitpull.ps1` is the
approved fast-forward-only pull entrypoint. Its destructive `-Force` mode never
accepts generic `-Yes`; it requires an interactive exact `FORCE` confirmation.
`.tools/gitpush.ps1` is the approved repository-create/scan/sync/push entrypoint
and accepts `-Remote`, repository-relative `-Path` values, `-CreateRemote`,
`-Visibility private|public`, `-Message`, and `-Yes`.
Without `-Path`, the helper publishes already-committed `main` and does not
change the index or working tree. With `-Path`, it stages and commits only those
literal paths while preserving every unrelated staged, modified, or untracked
path. `-Message` therefore requires at least one `-Path`.
`-CreateRemote` verifies the configured GitHub repository and creates it through
the GitHub API when absent; creation is private unless `-Visibility public` is
explicit. Both helpers require explicit approval, recognize the
canonical `.tools/secrets/gt.txt` and legacy `.tools/.secrets/gt.txt` stores,
and never print the token.

The styled controller is mouse- and keyboard-friendly on interactive Windows
consoles. Click a tab or row, use the visible Run, Up, Down, Back, Help,
Refresh, Quit, and Theme controls, or optionally use the wheel. Hover repaints
only when the pointer crosses a row boundary. A first row click only selects;
confirmation-gated actions still require Run plus the normal prompt. Set
`GKNOME_MOUSE=off` for keyboard-only input, `on` to request mouse input, or
leave it unset for automatic detection and fallback.

## Daily surface

```bat
run.cmd sprint
run.cmd spec
run.cmd stage
run.cmd test
```

```powershell
.\scripts\run.ps1 -Task context-audit
.\scripts\run.ps1 -Task context-verify
.\scripts\run.ps1 -Task secrets
.\scripts\run.ps1 -Task git-status
```

`context-verify` proves both the pack/manifest pair and freshness of the
currently routed source files. A `source-stale` result is nonzero and leaves
the existing pack unchanged; rebuild it explicitly after reviewing the
reported paths. The project controller does not install dependencies, publish artifacts, or
make Git changes without an explicit operator action. Project-owned runtime
commands remain in the caller's declared task surface.

## Where to look next

- Setup and compatibility: `docs/user/SETUP.md`
- Developer route: `docs/dev/README.md`
- Agent route: `docs/agents/README.md`
- Selected work and queue guide: `docs/work/`
- Conditional future backlog: `docs/TODO.md`
- Proof and limitations: `docs/PROOF.md`
