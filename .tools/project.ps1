#Requires -Version 5.1
# gknome-controller: gknome_controller_v2

<#
.SYNOPSIS
    Shared CLI and console TUI controller for the project.
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Task = 'menu',

    [string[]]$ArgumentList = @(),

    [string]$RepositoryRoot = ''
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:RepoRoot = if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
else {
    [System.IO.Path]::GetFullPath($RepositoryRoot)
}
if (-not (Test-Path -LiteralPath $script:RepoRoot -PathType Container)) {
    throw "Repository root not found: $script:RepoRoot"
}
$script:StrictJsonReader = Join-Path $PSScriptRoot 'StrictJson.ps1'
if (-not (Test-Path -LiteralPath $script:StrictJsonReader -PathType Leaf)) {
    throw "Strict JSON reader is missing: $script:StrictJsonReader"
}
. $script:StrictJsonReader
$script:ControllerPath = Join-Path $script:RepoRoot '.tools\controller.json'
$script:OperatorControllerPath = Join-Path $script:RepoRoot '.tools\controller.v3.json'
$script:TaskSpecPath = Join-Path $script:RepoRoot '.tools\task-specs.json'
$script:TaskRunnerPath = Join-Path $PSScriptRoot 'task-runner.ps1'
$script:ProjectPath = Join-Path $script:RepoRoot '.tools\project.json'
$script:StatePath = Join-Path $script:RepoRoot '.tools\project-state.json'

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "JSON file not found: $Path"
    }
    try {
        return Read-StrictJsonFile -Path $Path -MaxBytes 1048576
    }
    catch {
        throw "Invalid gknome project metadata '$Path': $($_.Exception.Message)"
    }
}

function Get-PropertyValue {
    param(
        [object]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [object]$Default = $null
    )

    if ($null -eq $Object) { return $Default }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $Default }
    return $property.Value
}

function Resolve-ProjectOwnedScript {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    if ([string]::IsNullOrWhiteSpace($RelativePath) -or [System.IO.Path]::IsPathRooted($RelativePath)) {
        throw 'Project task adapter script must be a project-relative path.'
    }
    $segments = @($RelativePath -split '[\\/]')
    if ($segments -contains '..' -or $segments -contains '.') {
        throw 'Project task adapter script cannot contain relative traversal segments.'
    }

    $root = [System.IO.Path]::GetFullPath($script:RepoRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $RelativePath))
    if (-not $fullPath.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Project task adapter script escapes the repository root.'
    }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "Project task adapter script not found: $RelativePath"
    }

    $current = $fullPath
    while ($true) {
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Project task adapter path is reparse-backed: $RelativePath"
            }
        }
        if ($current -eq $root) { break }
        $parent = Split-Path -Parent $current
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $current) { break }
        $current = $parent
    }
    return $fullPath
}

function Get-ProjectOwnedOperation {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Test-Path -LiteralPath $script:OperatorControllerPath -PathType Leaf)) { return $null }
    $operator = Read-JsonFile -Path $script:OperatorControllerPath
    $matches = @(@(Get-PropertyValue -Object $operator -Name 'operations' -Default @()) | Where-Object {
        [string](Get-PropertyValue -Object $_ -Name 'task' -Default '') -eq $Name
    })
    if ($matches.Count -gt 1) {
        throw "Project task '$Name' is declared by more than one operator operation."
    }
    if ($matches.Count -eq 1 -and [string](Get-PropertyValue -Object $matches[0] -Name 'owner' -Default 'foundation') -eq 'project') {
        return $matches[0]
    }
    return $null
}

function Assert-TaskDispatchAllowed {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Test-Path -LiteralPath $script:OperatorControllerPath -PathType Leaf)) { return }
    $operator = Read-JsonFile -Path $script:OperatorControllerPath
    $compatibility = Get-PropertyValue -Object $operator -Name 'compatibility' -Default $null
    $policy = [string](Get-PropertyValue -Object $compatibility -Name 'missing_task_policy' -Default 'show-legacy')
    if ($policy -ne 'fail-closed') { return }
    if ($Name -in @('menu', 'help')) { return }

    $allowedTasks = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($operation in @(Get-PropertyValue -Object $operator -Name 'operations' -Default @())) {
        $task = [string](Get-PropertyValue -Object $operation -Name 'task' -Default '')
        if (-not [string]::IsNullOrWhiteSpace($task)) { [void]$allowedTasks.Add($task) }
    }
    if (-not $allowedTasks.Contains($Name)) {
        throw "Task '$Name' is not available in this recipient runtime share."
    }
}

function Invoke-ProjectOwnedTask {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string[]]$Arguments = @()
    )

    $project = Read-JsonFile -Path $script:ProjectPath
    $adapter = Get-PropertyValue -Object $project -Name 'task_adapter' -Default $null
    $relativePath = [string](Get-PropertyValue -Object $adapter -Name 'script' -Default '')
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
        throw "Project-owned task '$Name' requires project.task_adapter.script."
    }
    $adapterPath = Resolve-ProjectOwnedScript -RelativePath $relativePath
    $parameterSplat = ConvertTo-ParameterSplat -Arguments $Arguments
    $global:LASTEXITCODE = 0
    & $adapterPath -Task $Name @parameterSplat
    if ($LASTEXITCODE -ne 0) {
        throw "Project-owned task '$Name' failed with exit code $LASTEXITCODE."
    }
}

function Get-ProjectReadiness {
    $requirements = @(
        [pscustomobject]@{ label = 'version.json'; paths = @('version.json') }
        [pscustomobject]@{ label = '.tools/project.json'; paths = @('.tools\project.json') }
        [pscustomobject]@{ label = '.tools/project-state.json'; paths = @('.tools\project-state.json') }
        [pscustomobject]@{ label = '.tools/controller.json'; paths = @('.tools\controller.json') }
        [pscustomobject]@{ label = '.tools/controller.v3.json'; paths = @('.tools\controller.v3.json') }
        [pscustomobject]@{ label = '.tools/project-spec.json'; paths = @('.tools\project-spec.json') }
        [pscustomobject]@{ label = 'scripts/run.ps1|run.ps1 (legacy)'; paths = @('scripts\run.ps1', 'run.ps1') }
        [pscustomobject]@{ label = '.tools/ui/Gknome.Menu.Core.psm1'; paths = @('.tools\ui\Gknome.Menu.Core.psm1') }
        [pscustomobject]@{ label = '.tools/ui/Gknome.Menu.Input.Windows.psm1'; paths = @('.tools\ui\Gknome.Menu.Input.Windows.psm1') }
        [pscustomobject]@{ label = '.tools/ui/Gknome.Menu.Basic.psm1'; paths = @('.tools\ui\Gknome.Menu.Basic.psm1') }
        [pscustomobject]@{ label = '.tools/ui/Gknome.Menu.Ansi.psm1'; paths = @('.tools\ui\Gknome.Menu.Ansi.psm1') }
        [pscustomobject]@{ label = '.tools/ui/themes.v1.json'; paths = @('.tools\ui\themes.v1.json') }
    )
    $missing = New-Object System.Collections.Generic.List[string]
    foreach ($requirement in $requirements) {
        $present = $false
        foreach ($relative in @($requirement.paths)) {
            if (Test-Path -LiteralPath (Join-Path $script:RepoRoot ([string]$relative)) -PathType Leaf) {
                $present = $true
                break
            }
        }
        if (-not $present) { $missing.Add([string]$requirement.label) }
    }
    return [pscustomobject][ordered]@{
        label = if ($missing.Count -eq 0) { 'READY' } else { "MISSING $($missing.Count)" }
        missing_count = $missing.Count
        missing_paths = @($missing.ToArray())
    }
}

function ConvertTo-ParameterSplat {
    param([string[]]$Arguments = @())

    # PowerShell represents an unknown switch supplied through a parameter
    # splat as two remaining arguments, for example '-AsJson:' and 'True'.
    # Canonicalize that representation at the controller boundary so the
    # public root and scripts runners behave the same in PS5.1 and PS7.
    $normalizedArguments = New-Object 'System.Collections.Generic.List[string]'
    $index = 0
    while ($index -lt @($Arguments).Count) {
        $argument = [string]$Arguments[$index]
        if ($argument -match '^-(?<SwitchName>[A-Za-z][A-Za-z0-9-]*):$' -and ($index + 1) -lt @($Arguments).Count) {
            $switchValue = $false
            if ([bool]::TryParse([string]$Arguments[$index + 1], [ref]$switchValue)) {
                if ($switchValue) { $normalizedArguments.Add('-' + $Matches.SwitchName) }
                $index += 2
                continue
            }
        }
        $normalizedArguments.Add($argument)
        $index++
    }

    $parameters = @{}
    $index = 0
    $Arguments = @($normalizedArguments.ToArray())
    while ($index -lt $Arguments.Count) {
        $argument = [string]$Arguments[$index]
        if ($argument -notmatch '^-([A-Za-z][A-Za-z0-9-]*)$') {
            throw "Tool arguments must use named parameters: $argument"
        }
        $name = $Matches[1]
        if ($parameters.ContainsKey($name)) {
            throw "Duplicate tool parameter: -$name"
        }
        if (($index + 1) -lt $Arguments.Count -and [string]$Arguments[$index + 1] -notmatch '^-([A-Za-z][A-Za-z0-9-]*)$') {
            $parameters[$name] = [string]$Arguments[$index + 1]
            $index += 2
        }
        else {
            $parameters[$name] = $true
            $index++
        }
    }
    return $parameters
}

function Invoke-ToolScript {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [string[]]$Arguments = @()
    )

    $normalizedRelative = $RelativePath.Replace('/', '\')
    $scriptPath = Join-Path $script:RepoRoot $normalizedRelative
    if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
        throw "Tool script not found: $scriptPath"
    }
    $parameterSplat = ConvertTo-ParameterSplat -Arguments $Arguments
    & $scriptPath @parameterSplat
}

function Get-DeclarativeTaskSpec {
    param([Parameter(Mandatory = $true)][string]$Name)

    $operator = if (Test-Path -LiteralPath $script:OperatorControllerPath -PathType Leaf) {
        Read-JsonFile -Path $script:OperatorControllerPath
    }
    else { $null }
    if ($null -ne $operator) {
        foreach ($operation in @(Get-PropertyValue -Object $operator -Name 'operations' -Default @())) {
            if ([string](Get-PropertyValue -Object $operation -Name 'task' -Default '') -ne $Name) { continue }
            $embedded = Get-PropertyValue -Object $operation -Name 'task_spec' -Default $null
            if ($null -ne $embedded) { return $embedded }
            $reference = [string](Get-PropertyValue -Object $operation -Name 'task_spec_ref' -Default '')
            if (-not [string]::IsNullOrWhiteSpace($reference) -and (Test-Path -LiteralPath $script:TaskSpecPath -PathType Leaf)) {
                $registry = Read-JsonFile -Path $script:TaskSpecPath
                $entry = @(@(Get-PropertyValue -Object $registry -Name 'tasks' -Default @()) | Where-Object { [string]$_.id -eq $reference } | Select-Object -First 1)
                if ($entry.Count -eq 0) { throw "Declared task specification reference is missing: $reference" }
                return (Get-PropertyValue -Object $entry[0] -Name 'spec' -Default $null)
            }
        }
    }

    $legacy = Read-JsonFile -Path $script:ControllerPath
    foreach ($group in @(Get-PropertyValue -Object $legacy -Name 'groups' -Default @())) {
        foreach ($action in @(Get-PropertyValue -Object $group -Name 'actions' -Default @())) {
            if ([string](Get-PropertyValue -Object $action -Name 'task' -Default '') -eq $Name) {
                $legacySpec = Get-PropertyValue -Object $action -Name 'spec' -Default $null
                if ($null -ne $legacySpec) { return $legacySpec }
                $legacyReference = [string](Get-PropertyValue -Object $action -Name 'spec_ref' -Default '')
                if (-not [string]::IsNullOrWhiteSpace($legacyReference) -and (Test-Path -LiteralPath $script:TaskSpecPath -PathType Leaf)) {
                    $registry = Read-JsonFile -Path $script:TaskSpecPath
                    $entry = @(@(Get-PropertyValue -Object $registry -Name 'tasks' -Default @()) | Where-Object { [string]$_.id -eq $legacyReference } | Select-Object -First 1)
                    if ($entry.Count -eq 0) { throw "Legacy task specification reference is missing: $legacyReference" }
                    return (Get-PropertyValue -Object $entry[0] -Name 'spec' -Default $null)
                }
                return $null
            }
        }
    }
    return $null
}

function Invoke-DeclarativeTask {
    param([Parameter(Mandatory = $true)][string]$Name, [Parameter(Mandatory = $true)][object]$Spec)

    if (-not (Test-Path -LiteralPath $script:TaskRunnerPath -PathType Leaf)) {
        throw "Declarative task runner is missing: $script:TaskRunnerPath"
    }
    $specJson = $Spec | ConvertTo-Json -Depth 20 -Compress
    & $script:TaskRunnerPath -Task $Name -RepositoryRoot $script:RepoRoot -SpecJson $specJson -AsJson
}

function Open-LocalPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $full = [System.IO.Path]::GetFullPath((Join-Path $script:RepoRoot $Path))
    if (-not (Test-Path -LiteralPath $full)) {
        throw "Path not found: $full"
    }
    if ($env:OS -eq 'Windows_NT') {
        Start-Process -FilePath $full | Out-Null
        return
    }
    if ($null -ne (Get-Command xdg-open -ErrorAction SilentlyContinue)) {
        & xdg-open $full | Out-Null
        return
    }
    throw 'No supported file opener is available.'
}

function Get-SprintOpenPath {
    param([string]$RepositoryRoot = $script:RepoRoot)

    $queueRelative = 'docs\work\queue'
    $queueRoot = Join-Path $RepositoryRoot $queueRelative
    if (Test-Path -LiteralPath $queueRoot) {
        if (-not (Test-Path -LiteralPath $queueRoot -PathType Container)) {
            throw "Work queue path is not a directory: $queueRoot"
        }
        $queueItem = Get-Item -LiteralPath $queueRoot -Force -ErrorAction Stop
        if (($queueItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Work queue path is reparse-backed: $queueRoot"
        }
        $activeItems = @(Get-ChildItem -LiteralPath $queueRoot -Force -File -ErrorAction Stop |
            Where-Object { $_.Extension.Equals('.md', [System.StringComparison]::OrdinalIgnoreCase) } |
            Sort-Object Name)
        $reparseItems = @($activeItems | Where-Object {
                ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
            })
        if ($reparseItems.Count -gt 0) {
            throw "Work queue item cannot be reparse-backed: $($reparseItems[0].FullName)"
        }
        if ($activeItems.Count -eq 1) {
            return (Join-Path $queueRelative $activeItems[0].Name)
        }
        if ($activeItems.Count -gt 1) { return $queueRelative }
    }
    return 'docs\work\README.md'
}

function Show-Help {
    Write-Host 'Tasks:'
    Write-Host '  menu              Interactive console controller'
    Write-Host '  sprint            Open the selected queue item, queue, or work guide'
    Write-Host '  stage             Show current lifecycle state'
    Write-Host '  stage-next        Show next lifecycle stage'
    Write-Host '  stage-checklist   Show current-stage checklist'
    Write-Host '  stage-set         Set stage; ArgumentList: stage, reason, optional allow-regression'
    Write-Host '  identity          Open docs/PROJECT_IDENTITY.md'
    Write-Host '  spec              Open docs/PROJECT_SPEC.md'
    Write-Host '  spec-json         Open .tools/project-spec.json'
    Write-Host '  workflow          Open docs/DEVELOPMENT_LIFECYCLE.md'
    Write-Host '  philosophy        Open docs/CODING_PHILOSOPHY.md'
    Write-Host '  review            Open docs/PROJECT_REVIEW.md'
    Write-Host '  pitfalls          Open docs/PITFALL_LEDGER.md'
    Write-Host '  integrity         Open docs/INTEGRITY_PASS.md'
    Write-Host '  user-docs         Open docs/user/README.md'
    Write-Host '  developer-docs    Open docs/dev/README.md'
    Write-Host '  agent-docs        Open docs/agents/README.md'
    Write-Host '  context-status    Show context configuration'
    Write-Host '  context-list      List summary-bank groups'
    Write-Host '  context-audit     Audit group patterns, matches, and source bytes'
    Write-Host '  context           Build default focused context'
    Write-Host '  context-full      Build all eligible text context'
    Write-Host '  context-verify    Verify the latest context pack'
    Write-Host '  context-rebuild   Rebuild the latest pack into ignored staging'
    Write-Host '  context-clean     Remove generated context and rebuild output'
    Write-Host '  secrets           Fail on likely secret material'
    Write-Host '  doctor            Validate contract identifiers, required structure, runners, menu UI, and lifecycle state'
    Write-Host '  test              Run template regression and benchmark checks'
    Write-Host '  share             Export developer/runtime share; ArgumentList: -Profile runtime|developer, -Yes, optional -Destination, -AsJson'
    Write-Host '  git-status        Show repository status'
    Write-Host '  git-log           Show the latest ten commits'
    Write-Host '  git-pull          Run .tools/gitpull.ps1; fast-forward only after approval'
    Write-Host '  git-push          Run the guarded existing-main publisher; candidate preparation uses explicit Path/Message'
    Write-Host '  root              Open the repository root'
    Write-Host '  help              Show this help'

    if (Test-Path -LiteralPath $script:OperatorControllerPath -PathType Leaf) {
        $operator = Read-JsonFile -Path $script:OperatorControllerPath
        $projectTasks = @(@(Get-PropertyValue -Object $operator -Name 'operations' -Default @()) |
            Where-Object { [string](Get-PropertyValue -Object $_ -Name 'owner' -Default 'foundation') -eq 'project' } |
            Sort-Object { [string](Get-PropertyValue -Object $_ -Name 'task' -Default '') } -Unique)
        if ($projectTasks.Count -gt 0) {
            Write-Host ''
            Write-Host 'Project tasks:'
            foreach ($operation in $projectTasks) {
                $task = [string](Get-PropertyValue -Object $operation -Name 'task' -Default '')
                if ([string]::IsNullOrWhiteSpace($task)) { continue }
                $description = ([string](Get-PropertyValue -Object $operation -Name 'description' -Default 'Project-owned operation.') -replace '[\r\n]+', ' ').Trim()
                Write-Host ('  {0,-17} {1}' -f $task, $description)
            }
        }
    }

    Write-Host ''
    Write-Host 'Stage transition example:'
    Write-Host '  .\scripts\run.ps1 -Task stage-set -ArgumentList direction-identity,"Repository foundation reviewed."'
}

function Invoke-StageSet {
    param([string[]]$Arguments)

    if ($Arguments.Count -lt 2 -or $Arguments.Count -gt 3) {
        throw 'stage-set requires ArgumentList values: <stage>, <reason>, [allow-regression].'
    }
    $stage = [string]$Arguments[0]
    $reason = [string]$Arguments[1]
    $invokeArguments = @('-Mode', 'Set', '-Stage', $stage, '-Reason', $reason)
    if ($Arguments.Count -ge 3) {
        $allowRegressionValue = ([string]$Arguments[2]).Trim().ToLowerInvariant()
        if ($allowRegressionValue -notin @('true', '1', 'yes', 'allow-regression')) {
            throw "stage-set optional third value must be allow-regression (accepted compatibility aliases: true, 1, yes); received '$($Arguments[2])'."
        }
        $invokeArguments += '-AllowRegression'
    }
    Invoke-ToolScript -RelativePath '.tools\lifecycle.ps1' -Arguments $invokeArguments
}

function Invoke-ProjectTask {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string[]]$Arguments = @()
    )

    Assert-TaskDispatchAllowed -Name $Name
    $declarativeSpec = Get-DeclarativeTaskSpec -Name $Name
    if ($null -ne $declarativeSpec) {
        Invoke-DeclarativeTask -Name $Name -Spec $declarativeSpec
        return
    }

    $projectOperation = Get-ProjectOwnedOperation -Name $Name
    if ($null -ne $projectOperation) {
        Invoke-ProjectOwnedTask -Name $Name -Arguments $Arguments
        return
    }

    switch ($Name.ToLowerInvariant()) {
        'sprint' { Open-LocalPath -Path (Get-SprintOpenPath); return }
        'stage' { Invoke-ToolScript -RelativePath '.tools\lifecycle.ps1' -Arguments (@('-Mode', 'Status') + $Arguments); return }
        'stage-next' { Invoke-ToolScript -RelativePath '.tools\lifecycle.ps1' -Arguments (@('-Mode', 'Next') + $Arguments); return }
        'stage-checklist' { Invoke-ToolScript -RelativePath '.tools\lifecycle.ps1' -Arguments (@('-Mode', 'Checklist') + $Arguments); return }
        'stage-set' { Invoke-StageSet -Arguments $Arguments; return }
        'identity' { Open-LocalPath -Path 'docs\PROJECT_IDENTITY.md'; return }
        'spec' { Open-LocalPath -Path 'docs\PROJECT_SPEC.md'; return }
        'spec-json' { Open-LocalPath -Path '.tools\project-spec.json'; return }
        'workflow' { Open-LocalPath -Path 'docs\DEVELOPMENT_LIFECYCLE.md'; return }
        'philosophy' { Open-LocalPath -Path 'docs\CODING_PHILOSOPHY.md'; return }
        'review' { Open-LocalPath -Path 'docs\PROJECT_REVIEW.md'; return }
        'pitfalls' { Open-LocalPath -Path 'docs\PITFALL_LEDGER.md'; return }
        'integrity' { Open-LocalPath -Path 'docs\INTEGRITY_PASS.md'; return }
        'integrity-guide' { Open-LocalPath -Path 'docs\INTEGRITY_PASS.md'; return }
        'user-docs' { Open-LocalPath -Path 'docs\user\README.md'; return }
        'developer-docs' { Open-LocalPath -Path 'docs\dev\README.md'; return }
        'agent-docs' { Open-LocalPath -Path 'docs\agents\README.md'; return }
        'context-status' { Invoke-ToolScript -RelativePath '.tools\context.ps1' -Arguments (@('-Mode', 'Status') + $Arguments); return }
        'context-list' { Invoke-ToolScript -RelativePath '.tools\context.ps1' -Arguments (@('-Mode', 'List') + $Arguments); return }
        'context-audit' { Invoke-ToolScript -RelativePath '.tools\context.ps1' -Arguments (@('-Mode', 'Audit') + $Arguments); return }
        'context' { Invoke-ToolScript -RelativePath '.tools\context.ps1' -Arguments (@('-Mode', 'Build') + $Arguments); return }
        'context-full' { Invoke-ToolScript -RelativePath '.tools\context.ps1' -Arguments (@('-Mode', 'BuildFull') + $Arguments); return }
        'context-verify' { Invoke-ToolScript -RelativePath '.tools\context.ps1' -Arguments (@('-Mode', 'Verify') + $Arguments); return }
        'context-rebuild' { Invoke-ToolScript -RelativePath '.tools\context.ps1' -Arguments (@('-Mode', 'Rebuild') + $Arguments); return }
        'context-rebuild-apply' {
            if ($Arguments -notcontains '-DestinationPath') { throw 'context-rebuild-apply requires -DestinationPath.' }
            Invoke-ToolScript -RelativePath '.tools\context.ps1' -Arguments (@('-Mode', 'Rebuild', '-Apply') + $Arguments); return
        }
        'context-clean' { Invoke-ToolScript -RelativePath '.tools\context.ps1' -Arguments (@('-Mode', 'Clean') + $Arguments); return }
        'secrets' { Invoke-ToolScript -RelativePath '.tools\scan-secrets.ps1' -Arguments (@('-FailOnFindings') + $Arguments); return }
        'doctor' { Invoke-ProjectDoctor -Arguments $Arguments; return }
        'test' { Invoke-ToolScript -RelativePath 'tests\foundation\Test-Template.ps1' -Arguments $Arguments; return }
        'share' { Invoke-ToolScript -RelativePath 'scripts\share.ps1' -Arguments $Arguments; return }
        'runtime-git-info' { Write-Host 'Git helpers are not included in this runtime share.'; return }
        'git-status' { Invoke-ToolScript -RelativePath '.tools\git.ps1' -Arguments (@('-Task', 'status') + $Arguments); return }
        'git-log' { Invoke-ToolScript -RelativePath '.tools\git.ps1' -Arguments (@('-Task', 'log') + $Arguments); return }
        'git-pull' { Invoke-ToolScript -RelativePath '.tools\gitpull.ps1' -Arguments $Arguments; return }
        'git-push' { Invoke-ToolScript -RelativePath '.tools\gitpush.ps1' -Arguments $Arguments; return }
        'root' { Open-LocalPath -Path '.'; return }
        'help' { Show-Help; return }
        default { throw "Unknown project task: $Name" }
    }
}

function Invoke-ProjectDoctor {
    param([string[]]$Arguments = @())

    $parameters = ConvertTo-ParameterSplat -Arguments $Arguments
    foreach ($name in @($parameters.Keys)) {
        if ([string]$name -ine 'AsJson') { throw "doctor does not support parameter: -$name" }
    }
    $asJson = $parameters.ContainsKey('AsJson')
    $checks = New-Object System.Collections.Generic.List[object]
    $failed = 0
    $provenance = $null
    $projectDocument = $null

    $required = @(
        @{ path = '.tools\project.json'; schema = 'gknome_project_v2' },
        @{ path = '.tools\project-state.json'; schema = 'gknome_project_state_v1' },
        @{ path = '.tools\controller.json'; schema = 'gknome_controller_v2' },
        @{ path = '.tools\project-spec.json'; schema = 'gknome_project_spec_v2' }
    )
    foreach ($entry in $required) {
        $full = Join-Path $script:RepoRoot $entry.path
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
            $checks.Add([pscustomobject]@{ name = $entry.path; ok = $false; detail = 'missing' })
            $failed++
            continue
        }
        try {
            $json = Read-JsonFile -Path $full
            $schema = [string](Get-PropertyValue -Object $json -Name 'schema' -Default '')
            if ($schema -ne $entry.schema) {
                $checks.Add([pscustomobject]@{ name = $entry.path; ok = $false; detail = "schema '$schema' (expected $($entry.schema))" })
                $failed++
            }
            else {
                $checks.Add([pscustomobject]@{ name = $entry.path; ok = $true; detail = "schema $schema" })
                if ($entry.path -eq '.tools\project.json') { $projectDocument = $json }
                if ($entry.path -eq '.tools\template-provenance.json') { $provenance = $json }
            }
        }
        catch {
            $checks.Add([pscustomobject]@{ name = $entry.path; ok = $false; detail = $_.Exception.Message })
            $failed++
        }
    }

    $canonicalSecretPath = Join-Path $script:RepoRoot '.tools\secrets'
    $legacySecretPath = Join-Path $script:RepoRoot '.tools\.secrets'
    $canonicalSecretExists = Test-Path -LiteralPath $canonicalSecretPath -PathType Container
    $legacySecretExists = Test-Path -LiteralPath $legacySecretPath -PathType Container
    $configuredSecretPath = ''
    if ($null -ne $projectDocument) {
        $paths = Get-PropertyValue -Object $projectDocument -Name 'paths' -Default $null
        $configuredSecretPath = [string](Get-PropertyValue -Object $paths -Name 'secrets_dir' -Default '')
    }
    if ($canonicalSecretExists -and $legacySecretExists) {
        $checks.Add([pscustomobject]@{ name = 'secret-store'; ok = $true; level = 'warning'; detail = 'both canonical .tools/secrets and legacy .tools/.secrets exist; review and move bytes manually' })
    }
    elseif ($legacySecretExists -or $configuredSecretPath -eq '.tools/.secrets') {
        $checks.Add([pscustomobject]@{ name = 'secret-store'; ok = $true; level = 'warning'; detail = 'legacy .tools/.secrets is in use; .tools/secrets is canonical and migration is operator-owned' })
    }
    else {
        $checks.Add([pscustomobject]@{ name = 'secret-store'; ok = $true; level = 'pass'; detail = 'canonical .tools/secrets configured; secret contents were not inspected' })
    }

    $runners = @('scripts\run.ps1', 'run.ps1')
    $runnerOk = $false
    foreach ($relative in $runners) {
        $full = Join-Path $script:RepoRoot $relative
        if (Test-Path -LiteralPath $full -PathType Leaf) {
            $runnerOk = $true
            $checks.Add([pscustomobject]@{ name = $relative; ok = $true; detail = 'present' })
        }
    }
    if (-not $runnerOk) {
        $checks.Add([pscustomobject]@{ name = 'runner'; ok = $false; detail = 'scripts/run.ps1 or legacy run.ps1 missing' })
        $failed++
    }

    $controllerPath = Join-Path $script:RepoRoot '.tools\controller.json'
    if (Test-Path -LiteralPath $controllerPath -PathType Leaf) {
        try {
            $controller = Read-JsonFile -Path $controllerPath
            $groups = @(Get-PropertyValue -Object $controller -Name 'groups' -Default @())
            $actionCount = 0
            $controllerTasks = @()
            foreach ($group in $groups) {
                $actions = @((Get-PropertyValue -Object $group -Name 'actions' -Default @()))
                $actionCount += $actions.Count
                $controllerTasks += @($actions | ForEach-Object { [string](Get-PropertyValue -Object $_ -Name 'task' -Default '') })
            }
            $ok = $actionCount -gt 0
            $checks.Add([pscustomobject]@{ name = 'controller-actions'; ok = $ok; detail = "$actionCount actions in $($groups.Count) groups" })
            if (-not $ok) { $failed++ }
            if ($controllerTasks -contains 'git-push' -or $controllerTasks -contains 'git-pull') {
                $gitEntrypoints = @('.tools\gitpush.ps1', '.tools\gitpull.ps1', '.tools\git-remote.ps1', '.tools\git-state.ps1')
                $missingGitEntrypoints = @($gitEntrypoints | Where-Object { -not (Test-Path -LiteralPath (Join-Path $script:RepoRoot $_) -PathType Leaf) })
                $gitEntrypointsOk = $missingGitEntrypoints.Count -eq 0
                $checks.Add([pscustomobject]@{ name = 'git-entrypoints'; ok = $gitEntrypointsOk; detail = $(if ($gitEntrypointsOk) { 'approved gitpush.ps1 and gitpull.ps1 handoffs present' } else { "missing: $($missingGitEntrypoints -join ', ')" }) })
                if (-not $gitEntrypointsOk) { $failed++ }
            }
        }
        catch {
            $checks.Add([pscustomobject]@{ name = 'controller-actions'; ok = $false; detail = $_.Exception.Message })
            $failed++
        }
    }

    $uiPaths = @(
        'ui\Gknome.Menu.Core.psm1',
        'ui\Gknome.Menu.Input.Windows.psm1',
        'ui\Gknome.Menu.Basic.psm1',
        'ui\Gknome.Menu.Ansi.psm1',
        'ui\themes.v1.json'
    )
    $missingUi = @($uiPaths | Where-Object { -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $_) -PathType Leaf) })
    $uiOk = $missingUi.Count -eq 0
    $checks.Add([pscustomobject]@{
        name = 'menu-ui'
        ok = $uiOk
        detail = $(if ($uiOk) { 'portable menu modules and theme catalog present' } else { "missing: $($missingUi -join ', ')" })
    })
    if (-not $uiOk) { $failed++ }

    if ($uiOk) {
        try {
            $uiRoot = Import-ProjectMenuModules
            $menuModel = Get-ProjectMenuModel -UiRoot $uiRoot
            $checks.Add([pscustomobject]@{ name = 'operator-controller'; ok = $true; detail = "$(@($menuModel.pages).Count) validated page(s)" })
        }
        catch {
            $checks.Add([pscustomobject]@{ name = 'operator-controller'; ok = $false; detail = $_.Exception.Message })
            $failed++
        }
    }

    $provenancePath = Join-Path $script:RepoRoot '.tools\template-provenance.json'
    if (Test-Path -LiteralPath $provenancePath -PathType Leaf) {
        try {
            if ($null -eq $provenance) { $provenance = Read-JsonFile -Path $provenancePath }
            $provenanceHash = [string](Get-PropertyValue -Object $provenance -Name 'template_payload_sha256' -Default '')
            $provenanceVersion = [string](Get-PropertyValue -Object $provenance -Name 'template_version' -Default '')
            if ($provenanceHash -notmatch '^[0-9a-fA-F]{64}$' -or [string]::IsNullOrWhiteSpace($provenanceVersion)) {
                throw 'template provenance payload identity is malformed'
            }
            $launcherHash = [Environment]::GetEnvironmentVariable('GKNOME_LAUNCHER_TEMPLATE_PAYLOAD_SHA256', 'Process')
            $launcherVersion = [Environment]::GetEnvironmentVariable('GKNOME_LAUNCHER_TEMPLATE_VERSION', 'Process')
            if ([string]::IsNullOrWhiteSpace($launcherHash)) {
                $checks.Add([pscustomobject]@{ name = 'template-payload'; ok = $true; detail = "generated payload $provenanceHash; active launcher identity not supplied" })
            }
            elseif ($provenanceHash -ieq $launcherHash -and ($launcherVersion -eq '' -or $provenanceVersion -eq $launcherVersion)) {
                $checks.Add([pscustomobject]@{ name = 'template-payload'; ok = $true; detail = "generated payload $provenanceHash matches active launcher" })
            }
            else {
                $checks.Add([pscustomobject]@{ name = 'template-payload'; ok = $false; detail = "generated payload $provenanceHash differs from active launcher $launcherHash; refresh gknome before generation; no project files changed" })
                $failed++
            }
        }
        catch {
            $checks.Add([pscustomobject]@{ name = 'template-payload'; ok = $false; detail = $_.Exception.Message })
            $failed++
        }
    }
    else {
        $checks.Add([pscustomobject]@{ name = 'template-payload'; ok = $true; detail = 'not present; older project provenance cannot be compared' })
    }

    $statePath = Join-Path $script:RepoRoot '.tools\project-state.json'
    if (Test-Path -LiteralPath $statePath -PathType Leaf) {
        try {
            $state = Read-JsonFile -Path $statePath
            $stage = [string](Get-PropertyValue -Object $state -Name 'current_stage' -Default '')
            $stageNumber = [int](Get-PropertyValue -Object $state -Name 'stage_number' -Default -1)
            $ok = (-not [string]::IsNullOrWhiteSpace($stage) -and $stageNumber -ge 0)
            $checks.Add([pscustomobject]@{ name = 'lifecycle'; ok = $ok; detail = "stage $stageNumber $stage" })
            if (-not $ok) { $failed++ }
        }
        catch {
            $checks.Add([pscustomobject]@{ name = 'lifecycle'; ok = $false; detail = $_.Exception.Message })
            $failed++
        }
    }

    $result = [pscustomobject][ordered]@{
        schema = 'gknome_project_doctor_result_v1'
        status = if ($failed -eq 0) { 'pass' } else { 'fail' }
        root = $script:RepoRoot
        check_count = $checks.Count
        failed_count = $failed
        checks = @($checks.ToArray())
    }
    if ($asJson) {
        $result | ConvertTo-Json -Depth 8 -Compress
    }
    else {
        Write-Host 'gknome project doctor'
        Write-Host "Root: $script:RepoRoot"
        foreach ($check in $checks) {
            $level = [string](Get-PropertyValue -Object $check -Name 'level' -Default '')
            $mark = if (-not $check.ok) { 'FAIL' } elseif ($level -eq 'warning') { 'WARN' } else { 'PASS' }
            Write-Host ("  [{0}] {1}: {2}" -f $mark, $check.name, $check.detail)
        }
    }
    if ($failed -gt 0) {
        throw "Project doctor failed $failed check(s)."
    }
    if (-not $asJson) { Write-Host "Doctor status: pass ($($checks.Count) checks)" }
}

function Pause-Menu {
    param([switch]$MouseCapable)

    if (Get-Command Wait-GknomeMenuContinue -ErrorAction SilentlyContinue) {
        return [bool](Wait-GknomeMenuContinue -AllowQuit -DisableMouse:(-not $MouseCapable))
    }
    Write-Host ''
    try { [void](Read-Host 'Press Enter to continue') } catch { return $true }
    return $true
}

function Import-ProjectMenuModules {
    $uiRoot = Join-Path $PSScriptRoot 'ui'
    $core = Join-Path $uiRoot 'Gknome.Menu.Core.psm1'
    if (-not (Test-Path -LiteralPath $core -PathType Leaf)) {
        throw "Portable menu core not found: $core"
    }
    Import-Module -Name $core -DisableNameChecking -ErrorAction Stop
    return $uiRoot
}

function Get-ProjectMenuModel {
    param([Parameter(Mandatory = $true)][string]$UiRoot)

    $controller = Read-JsonFile -Path $script:ControllerPath
    $operator = $null
    if (Test-Path -LiteralPath $script:OperatorControllerPath -PathType Leaf) {
        $operator = Read-JsonFile -Path $script:OperatorControllerPath
    }
    $project = Read-JsonFile -Path $script:ProjectPath
    $state = Read-JsonFile -Path $script:StatePath
    $projectLabel = [string](Get-PropertyValue -Object $project -Name 'alias' -Default '')
    if ([string]::IsNullOrWhiteSpace($projectLabel)) {
        $projectLabel = [string](Get-PropertyValue -Object $project -Name 'name' -Default (Split-Path -Leaf $script:RepoRoot))
    }
    $profile = [string](
        Get-PropertyValue `
            -Object $state `
            -Name 'profile' `
            -Default 'custom'
    )

    $stageNumber = [int](
        Get-PropertyValue `
            -Object $state `
            -Name 'stage_number' `
            -Default 0
    )

    $stageName = [string](
        Get-PropertyValue `
            -Object $state `
            -Name 'current_stage' `
            -Default 'unknown'
    )

    $statusLines = @(
        [string](
            Get-PropertyValue `
                -Object $project `
                -Name 'description' `
                -Default ''
        ),
        "Stage $stageNumber $stageName  //  $profile  //  PS $($PSVersionTable.PSVersion)"
    )
    $confirm = @{
        'stage-set' = $true
        'context-rebuild-apply' = $true
    }
    if ($null -ne $operator) {
        $capabilityMap = @{}
        foreach ($capability in @(Get-PropertyValue -Object $state -Name 'capabilities' -Default @())) {
            $capabilityMap[[string]$capability] = $true
        }
        return ConvertTo-GknomeMenuModelFromOperator `
            -Operator $operator `
            -LegacyController $controller `
            -ProjectLabel $projectLabel `
            -RootPath $script:RepoRoot `
            -StatusLines $statusLines `
            -Capabilities $capabilityMap `
            -ConfirmationByTask $confirm
    }
    return ConvertTo-GknomeMenuModelFromController -Controller $controller -ProjectLabel $projectLabel -StatusLines $statusLines -ConfirmationByTask $confirm
}

function Invoke-ProjectMenuAction {
    param([Parameter(Mandatory = $true)][object]$Action)

    $task = [string](Get-PropertyValue -Object $Action -Name 'task' -Default '')
    if ([string]::IsNullOrWhiteSpace($task)) { throw 'Selected menu action has no task ID.' }
    $role = [string](Get-PropertyValue -Object $Action -Name 'role' -Default 'review')
    $network = [string](Get-PropertyValue -Object $Action -Name 'network' -Default 'write')
    $confirmation = [string](Get-PropertyValue -Object $Action -Name 'confirmation' -Default '')
    $requiresConfirmation = [bool](Get-PropertyValue -Object $Action -Name 'requires_confirmation' -Default $true)
    if (Get-Command Get-GknomeMenuConfirmationMode -ErrorAction SilentlyContinue) {
        $confirmation = Get-GknomeMenuConfirmationMode -Confirmation $confirmation -RequiresConfirmation $requiresConfirmation
    }
    if ($confirmation -eq 'none' -and ($role -eq 'mutate' -or $network -eq 'write')) {
        throw "Unsafe menu policy for '$task': confirmation=none cannot run role=$role network=$network."
    }

    switch ($confirmation) {
        'none' {
            Invoke-ProjectTask -Name $task
            return $true
        }
        'prompt' {
            $answer = [string](Read-Host ("Run '{0}'? Type y to continue" -f $task))
            if ($answer.Trim().ToLowerInvariant() -notin @('y', 'yes')) {
                Write-Host "Canceled '$task'."
                return $false
            }
        }
        'typed' {
            $answer = [string](Read-Host ("Type {0} to run this action" -f $task))
            if ($answer.Trim() -cne $task) {
                Write-Host "Canceled '$task': exact task ID was not entered."
                return $false
            }
        }
        default {
            throw "Unsupported menu confirmation mode for '$task': $confirmation"
        }
    }

    $arguments = @(switch ($task) {
        { $_ -in @('git-push', 'project-publish', 'share', 'context-clean', 'git-pull') } { @('-Yes') }
        default { @() }
    })
    Invoke-ProjectTask -Name $task -Arguments $arguments
    return $true
}

function Run-Menu {
    $uiRoot = Import-ProjectMenuModules
    $model = Get-ProjectMenuModel -UiRoot $uiRoot

    while ($true) {
        $result = Invoke-GknomeMenuRenderer `
            -Model $model `
            -UiRoot $uiRoot `
            -AllowHarness

        if ($null -eq $result -or [string]$result.kind -eq 'cancel') {
            return
        }

        $mouseCapable = [string](
            Get-PropertyValue `
                -Object $result `
                -Name 'engine' `
                -Default ''
        ) -in @('basic', 'ansi')

        if ([string]$result.kind -eq 'help') {
            Show-Help
            if (-not (Pause-Menu -MouseCapable:$mouseCapable)) {
                return
            }
            continue
        }

        if ([string]$result.kind -eq 'refresh') {
            $model = Get-ProjectMenuModel -UiRoot $uiRoot
            continue
        }

        if (
            [string]$result.kind -ne 'task' -or
            [string]::IsNullOrWhiteSpace([string]$result.task)
        ) {
            continue
        }

        $actionCompleted = $false

        try {
            $actionCompleted = [bool](
                Invoke-ProjectMenuAction -Action $result.action
            )
        }
        catch {
            Write-Host ''
            Write-Host "ERROR: $($_.Exception.Message)"
        }

        # Rebuild only after an action known to modify displayed metadata.
        if (
            $actionCompleted -and
            [string]$result.task -in @('stage-set')
        ) {
            $model = Get-ProjectMenuModel -UiRoot $uiRoot
        }

        if (-not (Pause-Menu -MouseCapable:$mouseCapable)) {
            return
        }
    }
}

$callerLocation = (Get-Location).Path
try {
    Set-Location -LiteralPath $script:RepoRoot
    if ([string]::IsNullOrWhiteSpace($Task) -or $Task.ToLowerInvariant() -eq 'menu') {
        Run-Menu
    }
    else {
        Invoke-ProjectTask -Name $Task -Arguments $ArgumentList
    }
}
finally {
    Set-Location -LiteralPath $callerLocation
}
