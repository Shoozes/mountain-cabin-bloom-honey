# Standalone texture tool setup

This is an existing app: preserve `src/`, package/Vite/TypeScript paths and
public assets. Use the existing npm commands; do not generate another product.
Node/npm are app requirements. `run.cmd` is the Windows Gknome controller;
`scripts/run.sh` delegates to PowerShell where that runtime is installed.

The Main page routes real status, setup, dev, Pages build, test, typecheck and
lint actions. Dependency installation needs explicit confirmation. Do not
replace environment/build behavior or kill an owned preview as routine setup.

For an operator-selected publication, use the qualified local helper:

```powershell
$paths = (Get-Content '.artifacts/publication-paths.json' -Raw | ConvertFrom-Json).paths
& .tools/gitpush.ps1 -CommitOnly -Path $paths -Message '<reviewed batch>' -Yes
# After the selected candidate's required local proof:
& .tools/gitpush.ps1 -Yes
```

There is no PublisherRoot, Allowlist-file, StagedOnly, remote creation or force
flag in this supported route. Paths are exact repository-relative names,
including reviewed deletions. CommitOnly does not access credentials or remote;
push-only publishes committed main and leaves index/worktree unchanged.
The publisher integrates and verifies its selected batch before committing or
pushing. Foundation proof alone grants no publication authority. Guard findings
remain actionable failures.

Do not rewrite `.tools/template-provenance.json` to erase customization or
relabel the older initial payload. Preserve its managed placeholder document
paths until a supported reviewed migration changes their disposition.

---
AI-edited: 2026-10-11T19:40:02-04:00 | agent=Codex/root | model=unknown | effort=unknown | task=docs | change=bound standalone texture tool foundation and guarded workflow
