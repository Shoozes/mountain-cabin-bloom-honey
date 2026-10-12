#Requires -Version 5.1
[CmdletBinding()]
param([switch]$AsJson)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$count = 0
function Assert-Binding([bool]$Value, [string]$Detail) {
    $script:count++
    if (-not $Value) { throw "Project binding: $Detail" }
}
$project = Get-Content -Raw -LiteralPath (Join-Path $root '.tools/project.json') | ConvertFrom-Json
$spec = Get-Content -Raw -LiteralPath (Join-Path $root '.tools/project-spec.json') | ConvertFrom-Json
$state = Get-Content -Raw -LiteralPath (Join-Path $root '.tools/project-state.json') | ConvertFrom-Json
$controller = Get-Content -Raw -LiteralPath (Join-Path $root '.tools/controller.v3.json') | ConvertFrom-Json
$tasks = Get-Content -Raw -LiteralPath (Join-Path $root '.tools/task-specs.json') | ConvertFrom-Json
$bank = Get-Content -Raw -LiteralPath (Join-Path $root 'summary_bank.json') | ConvertFrom-Json
Assert-Binding ($project.schema -eq 'gknome_project_v2' -and $spec.schema -eq 'gknome_project_spec_v2') 'typed identities'
Assert-Binding ($project.paths.source -eq 'src' -and $project.profile -eq 'app') 'existing app source/profile'
Assert-Binding ($project.name -eq $spec.project -and $project.name -eq $state.project) 'one project identity'
Assert-Binding ($project.git.remote -eq 'https://github.com/Shoozes/mountain-cabin-bloom-honey.git') 'actual registered remote'
Assert-Binding ($state.current_stage -eq 'repo-foundation' -and $state.stage_number -eq 4) 'no invented lifecycle advancement'
Assert-Binding ($bank.defaults.skip_dirs -contains 'src/lib/auth') 'credential-bearing auth excluded from packing'
Assert-Binding (-not (@($bank.groups.sprint.paths) -contains 'source/**')) 'no second product source route'
Assert-Binding ($project.task_adapter.script -eq 'scripts/project-tasks.ps1') 'supported project adapter'
$adapter = Join-Path $root $project.task_adapter.script
foreach ($task in @('project-dev','project-test','project-typecheck','project-lint','project-build','project-build-pages')) {
    $plan = & $adapter -Task $task -DryRun -AsJson | ConvertFrom-Json
    Assert-Binding ($plan.status -eq 'planned-not-executed' -and $plan.program -match '^npm(?:\.cmd)?$') "real npm owner for $task"
    $operations = @($controller.operations | Where-Object { $_.task -eq $task -and $_.owner -eq 'project' })
    # The full migration build is an explicit adapter command, not a default menu action.
    if ($task -ne 'project-build') { Assert-Binding ($operations.Count -eq 1) "unique project operation $task" }
}
$status = & $adapter -Task project-status -AsJson | ConvertFrom-Json
Assert-Binding ($status.status -eq 'observed' -and $status.source -eq 'src') 'executed status dispatch'
$publish = & $adapter -Task project-publish -CommitOnly -Path 'docs/PROOF.md' -Message 'reviewed fixture plan' -DryRun -AsJson | ConvertFrom-Json
Assert-Binding ($publish.owner -eq '.tools/gitpush.ps1' -and -not $publish.remote_creation) 'local guarded publication owner'
Assert-Binding (@($controller.operations | Where-Object { $_.task -eq 'project-publish' -and $_.owner -eq 'project' }).Count -eq 1) 'publication project dispatch'
$focus = @($tasks.tasks | Where-Object id -eq 'project-test-terrain')
Assert-Binding ($focus.Count -eq 1 -and $focus[0].spec.program -eq 'node' -and $focus[0].spec.args[1] -eq 'scripts/retro-terrain.test.mjs') 'declared real focused check'
Assert-Binding (@($controller.pages | Where-Object id -eq 'main').Count -eq 1 -and @($controller.pages | Where-Object id -eq 'git').Count -eq 1 -and @($controller.pages | Where-Object id -eq 'scripts').Count -eq 1) 'three-page controller'
$tokens = $null
$parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $root '.tools/project.ps1'),[ref]$tokens,[ref]$parseErrors)
$switches = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.SwitchStatementAst] -and $node.Extent.Text.Contains("'project-publish'") -and $node.Extent.Text.Contains("'context-clean'") },$true))
Assert-Binding ($parseErrors.Count -eq 0 -and $switches.Count -eq 1) 'actual confirmed-menu argument switch'
$argumentProjection = [scriptblock]::Create('param([string]$task)' + $switches[0].Extent.Text)
foreach ($task in @('git-push','project-publish')) {
    $arguments = @(& $argumentProjection $task)
    Assert-Binding ($arguments.Count -eq 1 -and $arguments[0] -eq '-Yes') "confirmed menu preserves Yes without implicit creation: $task"
}
$legacy = Get-Content -Raw -LiteralPath (Join-Path $root '.tools/controller.json') | ConvertFrom-Json
$legacyPush = @($legacy.groups.actions | Where-Object task -eq 'git-push')
Assert-Binding ($legacyPush.Count -eq 1 -and $legacyPush[0].description -notmatch 'privately create') 'legacy menu describes existing-repo publication'
foreach ($page in $controller.pages) {
    foreach ($id in $page.operations) { Assert-Binding (@($controller.operations | Where-Object id -eq $id).Count -eq 1) "resolved operation $id" }
}
$result = [ordered]@{ schema = 'texture_mill_project_binding_v1'; status = 'pass'; assertions = $count; runtime = $PSVersionTable.PSVersion.ToString(); proof = 'Semantic configuration, actual status dispatch and nonexecuted npm/publication plans; no product build, credential reads or publication.' }
if ($AsJson) { $result | ConvertTo-Json -Compress } else { $result | ConvertTo-Json }
