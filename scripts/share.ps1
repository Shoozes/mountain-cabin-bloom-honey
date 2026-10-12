#Requires -Version 5.1

<##
.SYNOPSIS
    Exports the developer or runtime project share profile.

.DESCRIPTION
    Reads .tools/share.json, stages selected regular files to a unique sibling
    directory, scans the staged tree for secrets, writes a SHA-256 inventory,
    and promotes the complete directory only after every check passes.
#>

[CmdletBinding()]
param(
    [ValidateSet('developer', 'runtime')]
    [string]$Profile = 'runtime',

    [string]$Destination = '',

    [switch]$Yes,

    [switch]$AsJson
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$script:RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\', '/')
$script:RepoParent = Split-Path -Parent $script:RepoRoot
$script:SharePath = Join-Path $script:RepoRoot '.tools\share.json'
$script:StrictJsonPath = Join-Path $script:RepoRoot '.tools\StrictJson.ps1'
$script:SecretScannerPath = Join-Path $script:RepoRoot '.tools\scan-secrets.ps1'

if (-not (Test-Path -LiteralPath $script:StrictJsonPath -PathType Leaf)) { throw "Strict JSON reader is missing: $script:StrictJsonPath" }
. $script:StrictJsonPath

function Get-RelativePath {
    param([Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)][string]$Path)
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $pathFull = [System.IO.Path]::GetFullPath($Path)
    $prefix = $rootFull + [System.IO.Path]::DirectorySeparatorChar
    if (-not $pathFull.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Path escaped the share source: $pathFull" }
    return $pathFull.Substring($prefix.Length).Replace('\', '/')
}

function Get-FileSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash($stream)) -replace '-', '').ToLowerInvariant() }
    finally { $sha.Dispose(); $stream.Dispose() }
}

function Get-TextSha256 {
    param([Parameter(Mandatory = $true)][string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash($script:Utf8NoBom.GetBytes($Text))) -replace '-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Get-OptionalPropertyValue {
    param([object]$Object, [Parameter(Mandatory = $true)][string]$Name, [object]$Default = $null)
    if ($null -eq $Object) { return $Default }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $Default }
    return $property.Value
}

function Assert-SafePattern {
    param([Parameter(Mandatory = $true)][string]$Pattern)
    $normalized = $Pattern.Replace('\', '/').Trim()
    if ([string]::IsNullOrWhiteSpace($normalized) -or [System.IO.Path]::IsPathRooted($normalized) -or $normalized -match '(^|/)\.\.(/|$)' -or $normalized.Contains('//') -or $normalized.IndexOfAny(@([char]0, [char]10, [char]13)) -ge 0) {
        throw "Share manifest contains an unsafe path pattern: $Pattern"
    }
    return $normalized
}

function Test-MatchesPattern {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Pattern)
    $candidate = $Path.Replace('\', '/')
    $normalized = (Assert-SafePattern -Pattern $Pattern)
    if ($normalized.EndsWith('/**')) {
        $root = $normalized.Substring(0, $normalized.Length - 3).TrimEnd('/')
        return ($candidate -ieq $root -or $candidate.StartsWith($root + '/', [System.StringComparison]::OrdinalIgnoreCase))
    }
    return $candidate -like $normalized
}

function Test-BlockedSharePath {
    param([Parameter(Mandatory = $true)][string]$RelativePath, [Parameter(Mandatory = $true)][string]$RequestedProfile)
    $path = $RelativePath.Replace('\', '/').TrimStart('/').ToLowerInvariant()
    $alwaysBlocked = @('.git', '.gknome', '.artifacts', '.runtime', 'runtime-data', '.tools/local', '.tools/secrets', '.tools/.secrets', '.agents/local', '.secrets', 'node_modules', '.venv', 'venv', '__pycache__', 'coverage', 'test-results')
    foreach ($blocked in $alwaysBlocked) {
        if ($path -eq $blocked -or $path.StartsWith($blocked + '/')) { return $true }
    }
    if ($path.EndsWith('.log') -or $path.EndsWith('.tmp')) { return $true }
    if ($RequestedProfile -eq 'runtime' -and ($path -eq '.agents' -or $path.StartsWith('.agents/') -or $path -eq 'tests' -or $path.StartsWith('tests/') -or $path -eq 'docs/dev' -or $path.StartsWith('docs/dev/') -or $path -eq 'docs/research-inbox' -or $path.StartsWith('docs/research-inbox/'))) { return $true }
    return $false
}

function Get-SafeSourceFiles {
    $files = New-Object System.Collections.Generic.List[object]
    $stack = New-Object System.Collections.Generic.Stack[string]
    $stack.Push($script:RepoRoot)
    while ($stack.Count -gt 0) {
        $directory = $stack.Pop()
        foreach ($item in @(Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop | Sort-Object Name)) {
            $relative = Get-RelativePath -Root $script:RepoRoot -Path $item.FullName
            if (Test-BlockedSharePath -RelativePath $relative -RequestedProfile $Profile) { continue }
            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Share source contains a reparse path in selected scope: $relative" }
            if ($item.PSIsContainer) { $stack.Push($item.FullName); continue }
            $files.Add([pscustomobject]@{ full = $item.FullName; relative = $relative })
        }
    }
    return @($files.ToArray())
}

function Get-DeveloperFiles {
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($null -eq $git) { $git = Get-Command git -ErrorAction SilentlyContinue }
    if ($null -eq $git) { throw 'Developer share requires Git so tracked content can be selected exactly.' }
    $tracked = @(& $git.Source -C $script:RepoRoot ls-files 2>&1)
    if ($LASTEXITCODE -ne 0) { throw 'Developer share requires an initialized readable Git worktree.' }
    $result = New-Object System.Collections.Generic.List[object]
    foreach ($line in $tracked) {
        $relative = ([string]$line).Replace('\', '/').Trim()
        if ([string]::IsNullOrWhiteSpace($relative)) { continue }
        [void](Assert-SafePattern -Pattern $relative)
        if (Test-BlockedSharePath -RelativePath $relative -RequestedProfile 'developer') { throw 'Developer share refused tracked content inside an operator-only or live-state path.' }
        $full = [System.IO.Path]::GetFullPath((Join-Path $script:RepoRoot $relative.Replace('/', '\')))
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw "Tracked share source is missing: $relative" }
        $item = Get-Item -LiteralPath $full -Force
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Developer share refused a reparse file: $relative" }
        $result.Add([pscustomobject]@{ full = $full; relative = $relative })
    }
    return @($result.ToArray())
}

function Test-RuntimeSelectedPath {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][System.Collections.Generic.HashSet[string]]$SelectedPaths
    )
    $normalized = (Assert-SafePattern -Pattern $RelativePath).TrimEnd('/')
    if ($normalized -eq '.') { return $true }
    # A selected-file set is an input to the closure check, not the policy
    # boundary itself. Re-apply runtime exclusions here so a future selector
    # change cannot make a development-only path executable or visible merely
    # by being present in the selected set.
    if (Test-BlockedSharePath -RelativePath $normalized -RequestedProfile 'runtime') { return $false }
    if ($SelectedPaths.Contains($normalized)) { return $true }
    foreach ($selectedPath in $SelectedPaths) {
        if ($selectedPath.StartsWith($normalized + '/', [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
    return $false
}

function Test-RuntimeTaskSpecClosure {
    param(
        [Parameter(Mandatory = $true)][object]$Spec,
        [Parameter(Mandatory = $true)][System.Collections.Generic.HashSet[string]]$SelectedPaths
    )
    if ($null -eq $Spec) { return $false }
    $kind = [string](Get-OptionalPropertyValue -Object $Spec -Name 'kind' -Default '')
    if ($kind -in @('sequence', 'recipe')) {
        $tasks = @(Get-OptionalPropertyValue -Object $Spec -Name 'tasks' -Default @())
        if ($tasks.Count -eq 0) { return $false }
        foreach ($task in $tasks) {
            if (-not (Test-RuntimeTaskSpecClosure -Spec $task -SelectedPaths $SelectedPaths)) { return $false }
        }
        return $true
    }
    if ($kind -eq 'open') {
        $path = [string](Get-OptionalPropertyValue -Object $Spec -Name 'path' -Default '')
        return (-not [string]::IsNullOrWhiteSpace($path) -and (Test-RuntimeSelectedPath -RelativePath $path -SelectedPaths $SelectedPaths))
    }
    if ($kind -notin @('process', 'check')) { return $false }
    $workingDirectory = [string](Get-OptionalPropertyValue -Object $Spec -Name 'working_directory' -Default '.')
    if (-not (Test-RuntimeSelectedPath -RelativePath $workingDirectory -SelectedPaths $SelectedPaths)) { return $false }
    $dependencies = New-Object System.Collections.Generic.List[string]
    $program = [string](Get-OptionalPropertyValue -Object $Spec -Name 'program' -Default '')
    if ($program -match '[/\\]' -or $program.StartsWith('.')) { $dependencies.Add($program) }
    foreach ($argument in @(Get-OptionalPropertyValue -Object $Spec -Name 'args' -Default @())) {
        $candidate = [string]$argument
        if ([string]::IsNullOrWhiteSpace($candidate) -or $candidate.StartsWith('-') -or [System.IO.Path]::IsPathRooted($candidate)) { continue }
        try {
            $full = [System.IO.Path]::GetFullPath((Join-Path $script:RepoRoot $candidate.Replace('/', '\')))
            if (($full -eq $script:RepoRoot -or $full.StartsWith($script:RepoRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) -and (Test-Path -LiteralPath $full)) {
                $dependencies.Add($candidate)
            }
        }
        catch { return $false }
    }
    foreach ($dependency in $dependencies) {
        if (-not (Test-RuntimeSelectedPath -RelativePath $dependency -SelectedPaths $SelectedPaths)) { return $false }
    }
    return $true
}

function ConvertTo-RuntimeControllerClosure {
    param(
        [Parameter(Mandatory = $true)][string]$StageRoot,
        [Parameter(Mandatory = $true)][object]$Profile,
        [Parameter(Mandatory = $true)][System.Collections.Generic.HashSet[string]]$SelectedPaths
    )

    $controllerPath = Join-Path $StageRoot '.tools\controller.v3.json'
    $legacyPath = Join-Path $StageRoot '.tools\controller.json'
    $taskRegistryPath = Join-Path $StageRoot '.tools\task-specs.json'
    $projectPath = Join-Path $StageRoot '.tools\project.json'
    $controller = Read-StrictJsonFile -Path $controllerPath -MaxBytes 1048576
    $legacy = Read-StrictJsonFile -Path $legacyPath -MaxBytes 1048576
    $registry = Read-StrictJsonFile -Path $taskRegistryPath -MaxBytes 1048576
    $project = Read-StrictJsonFile -Path $projectPath -MaxBytes 1048576
    $policy = Get-OptionalPropertyValue -Object $Profile -Name 'controller' -Default $null
    if ($null -eq $policy) { throw 'Runtime share controller policy is missing.' }
    $policyProperties = @($policy.PSObject.Properties | ForEach-Object { [string]$_.Name })
    if ($policyProperties.Count -ne 3 -or $policyProperties -notcontains 'foundation_tasks' -or $policyProperties -notcontains 'project_roles' -or $policyProperties -notcontains 'project_tasks') {
        throw 'Runtime share controller policy must contain only foundation_tasks, project_roles, and project_tasks.'
    }
    $rawFoundationTasks = Get-OptionalPropertyValue -Object $policy -Name 'foundation_tasks' -Default $null
    $rawProjectRoles = Get-OptionalPropertyValue -Object $policy -Name 'project_roles' -Default $null
    $rawProjectTasks = Get-OptionalPropertyValue -Object $policy -Name 'project_tasks' -Default $null
    if ($rawFoundationTasks -isnot [System.Array] -or $rawProjectRoles -isnot [System.Array] -or ($null -ne $rawProjectTasks -and $rawProjectTasks -isnot [System.Array])) {
        throw 'Runtime share controller policy values must be arrays.'
    }
    $foundationTasks = @($rawFoundationTasks | ForEach-Object { [string]$_ })
    $projectRoles = @($rawProjectRoles | ForEach-Object { [string]$_ })
    $projectTasks = @(
        if ($null -ne $rawProjectTasks) { $rawProjectTasks | ForEach-Object { [string]$_ } }
    )
    if ($foundationTasks.Count -eq 0 -or $projectRoles.Count -eq 0) { throw 'Runtime share controller policy must declare foundation_tasks and project_roles.' }
    if (@($foundationTasks | Sort-Object -Unique).Count -ne $foundationTasks.Count -or @($projectRoles | Sort-Object -Unique).Count -ne $projectRoles.Count -or @($projectTasks | Sort-Object -Unique).Count -ne $projectTasks.Count -or @($projectRoles | Where-Object { $_ -notin @('read', 'open', 'preview') }).Count -gt 0) {
        throw 'Runtime share controller policy must use unique project roles/tasks; project roles must be non-mutating.'
    }

    $registryById = @{}
    foreach ($entry in @(Get-OptionalPropertyValue -Object $registry -Name 'tasks' -Default @())) {
        $id = [string](Get-OptionalPropertyValue -Object $entry -Name 'id' -Default '')
        if (-not [string]::IsNullOrWhiteSpace($id)) { $registryById[$id] = $entry }
    }
    $adapter = Get-OptionalPropertyValue -Object $project -Name 'task_adapter' -Default $null
    $adapterPath = [string](Get-OptionalPropertyValue -Object $adapter -Name 'script' -Default '')
    $keptOperations = New-Object System.Collections.Generic.List[object]
    $keptSpecIds = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    $projectOperationTasks = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    foreach ($operation in @(Get-OptionalPropertyValue -Object $controller -Name 'operations' -Default @())) {
        if ([string](Get-OptionalPropertyValue -Object $operation -Name 'owner' -Default 'foundation') -eq 'project') {
            $task = [string](Get-OptionalPropertyValue -Object $operation -Name 'task' -Default '')
            if (-not [string]::IsNullOrWhiteSpace($task)) { [void]$projectOperationTasks.Add($task) }
        }
    }
    foreach ($task in $projectTasks) {
        if (-not $projectOperationTasks.Contains($task)) { throw "Runtime share project task is not a project-owned operation: $task" }
    }
    foreach ($operation in @(Get-OptionalPropertyValue -Object $controller -Name 'operations' -Default @())) {
        $owner = [string](Get-OptionalPropertyValue -Object $operation -Name 'owner' -Default 'foundation')
        $task = [string](Get-OptionalPropertyValue -Object $operation -Name 'task' -Default '')
        $keep = $owner -eq 'foundation' -and $foundationTasks -contains $task
        if ($owner -eq 'project') {
            $role = [string](Get-OptionalPropertyValue -Object $operation -Name 'role' -Default '')
            $network = [string](Get-OptionalPropertyValue -Object $operation -Name 'network' -Default '')
            $confirmation = [string](Get-OptionalPropertyValue -Object $operation -Name 'confirmation' -Default 'none')
            $explicitTask = $projectTasks -contains $task
            $keep = if ($explicitTask) {
                $network -in @('off', 'read') -and $role -in @('read', 'open', 'preview', 'mutate') -and ($role -ne 'mutate' -or $confirmation -in @('prompt', 'typed'))
            }
            else {
                $projectRoles -contains $role -and $network -in @('off', 'read')
            }
            $availability = Get-OptionalPropertyValue -Object $operation -Name 'availability' -Default $null
            foreach ($path in @(Get-OptionalPropertyValue -Object $availability -Name 'paths' -Default @())) {
                if (-not (Test-RuntimeSelectedPath -RelativePath ([string]$path) -SelectedPaths $SelectedPaths)) { $keep = $false; break }
            }
            $embeddedSpec = Get-OptionalPropertyValue -Object $operation -Name 'task_spec' -Default $null
            $specReference = [string](Get-OptionalPropertyValue -Object $operation -Name 'task_spec_ref' -Default '')
            if ($keep -and $null -ne $embeddedSpec) { $keep = Test-RuntimeTaskSpecClosure -Spec $embeddedSpec -SelectedPaths $SelectedPaths }
            elseif ($keep -and -not [string]::IsNullOrWhiteSpace($specReference)) {
                if (-not $registryById.ContainsKey($specReference)) { $keep = $false }
                else {
                    $entry = $registryById[$specReference]
                    $keep = Test-RuntimeTaskSpecClosure -Spec (Get-OptionalPropertyValue -Object $entry -Name 'spec' -Default $null) -SelectedPaths $SelectedPaths
                    if ($keep) { [void]$keptSpecIds.Add($specReference) }
                }
            }
            elseif ($keep) {
                $keep = -not [string]::IsNullOrWhiteSpace($adapterPath) -and (Test-RuntimeSelectedPath -RelativePath $adapterPath -SelectedPaths $SelectedPaths)
            }
        }
        if ($keep) { $keptOperations.Add($operation) }
    }

    if ($foundationTasks -contains 'root' -and @($keptOperations | Where-Object { [string]$_.task -eq 'root' }).Count -eq 0) {
        $keptOperations.Add([pscustomobject][ordered]@{
            schema = 'gknome_operation_v1'; id = 'runtime.root'; page_id = 'scripts'; label = 'Repository root'; task = 'root'
            description = 'Open the shared repository root.'; owner = 'foundation'; role = 'open'; maturity = 'stable'; network = 'off'; confirmation = 'none'; availability = [pscustomobject]@{}
        })
    }

    foreach ($operation in $keptOperations) {
        $task = [string](Get-OptionalPropertyValue -Object $operation -Name 'task' -Default '')
        $pageId = [string](Get-OptionalPropertyValue -Object $operation -Name 'page_id' -Default '')
        if ($task -in @('git-status', 'git-pull', 'git-push')) {
            $operation.page_id = 'git'
        }
        elseif ($pageId -in @('main', 'start', 'home', 'setup', 'downloads', 'run', 'build', 'clean')) {
            $operation.page_id = 'main'
        }
        else {
            $operation.page_id = 'scripts'
        }
    }

    if (@(
        $keptOperations |
            Where-Object { [string]$_.page_id -eq 'git' }
    ).Count -eq 0) {
        $keptOperations.Add([pscustomobject][ordered]@{
            schema = 'gknome_operation_v1'
            id = 'runtime.git-info'
            page_id = 'git'
            label = 'Git not included'
            task = 'runtime-git-info'
            description = 'Git mutation helpers are intentionally excluded from this runtime share.'
            owner = 'foundation'
            role = 'read'
            maturity = 'stable'
            network = 'off'
            confirmation = 'none'
            availability = [pscustomobject]@{}
        })
    }

    $operationById = @{}
    foreach ($operation in $keptOperations) { $operationById[[string]$operation.id] = $operation }
    $runtimePageDefinitions = @(
        [pscustomobject][ordered]@{
            id = 'main'
            label = 'Main'
            description = 'Runtime status and primary actions.'
        },
        [pscustomobject][ordered]@{
            id = 'git'
            label = 'Git'
            description = 'Repository actions available in this share.'
        },
        [pscustomobject][ordered]@{
            id = 'scripts'
            label = 'Scripts'
            description = 'All other available runtime actions.'
        }
    )
    $pages = New-Object System.Collections.Generic.List[object]
    foreach ($definition in $runtimePageDefinitions) {
        $operationIds = @(
            $keptOperations |
                Where-Object { [string]$_.page_id -eq [string]$definition.id } |
                ForEach-Object { [string]$_.id }
        )
        $pages.Add([pscustomobject][ordered]@{
            id = [string]$definition.id
            label = [string]$definition.label
            description = [string]$definition.description
            operations = @($operationIds)
        })
    }
    $controller.title = ([string]$controller.title) + ' // Runtime'
    $controller.compatibility.legacy_page_id = 'scripts'
    $controller.compatibility.missing_task_policy = 'fail-closed'
    $controller.pages = @($pages.ToArray())
    $controller.operations = @($keptOperations.ToArray())

    $keptTasks = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    foreach ($operation in $keptOperations) { [void]$keptTasks.Add([string]$operation.task) }
    $legacyActionsByPage = @{
        Main = New-Object System.Collections.Generic.List[object]
        Git = New-Object System.Collections.Generic.List[object]
        Scripts = New-Object System.Collections.Generic.List[object]
    }
    $seenLegacyTasks = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
    foreach ($group in @(Get-OptionalPropertyValue -Object $legacy -Name 'groups' -Default @())) {
        foreach ($action in @(Get-OptionalPropertyValue -Object $group -Name 'actions' -Default @())) {
            $task = [string](Get-OptionalPropertyValue -Object $action -Name 'task' -Default '')
            if (-not $keptTasks.Contains($task) -or -not $seenLegacyTasks.Add($task)) { continue }
            $pageLabel = if ($task -in @('git-status', 'git-pull', 'git-push')) { 'Git' } elseif ($task -in @('sprint', 'spec', 'stage', 'doctor', 'test')) { 'Main' } else { 'Scripts' }
            $legacyActionsByPage[$pageLabel].Add($action)
        }
    }
    if ($keptTasks.Contains('root') -and $seenLegacyTasks.Add('root')) {
        $legacyActionsByPage['Scripts'].Add([pscustomobject][ordered]@{ label = 'Repository root'; task = 'root'; description = 'Open the shared repository root.' })
    }
    if ($keptTasks.Contains('runtime-git-info') -and $seenLegacyTasks.Add('runtime-git-info')) {
        $legacyActionsByPage['Git'].Add([pscustomobject][ordered]@{ label = 'Git not included'; task = 'runtime-git-info'; description = 'Git mutation helpers are intentionally excluded from this runtime share.' })
    }
    $legacyGroups = New-Object System.Collections.Generic.List[object]
    foreach ($label in @('Main', 'Git', 'Scripts')) {
        $actions = @($legacyActionsByPage[$label].ToArray())
        $legacyGroups.Add([pscustomobject][ordered]@{ label = $label; actions = $actions })
    }
    $legacy.title = ([string]$legacy.title) + ' // Runtime'
    $legacy.groups = @($legacyGroups.ToArray())
    $registry.tasks = @(@(Get-OptionalPropertyValue -Object $registry -Name 'tasks' -Default @()) | Where-Object { $keptSpecIds.Contains([string]$_.id) })

    [System.IO.File]::WriteAllText($controllerPath, (($controller | ConvertTo-Json -Depth 40) + "`n"), $script:Utf8NoBom)
    [System.IO.File]::WriteAllText($legacyPath, (($legacy | ConvertTo-Json -Depth 30) + "`n"), $script:Utf8NoBom)
    [System.IO.File]::WriteAllText($taskRegistryPath, (($registry | ConvertTo-Json -Depth 30) + "`n"), $script:Utf8NoBom)
    return [pscustomobject]@{ operations = $keptOperations.Count; task_specs = $keptSpecIds.Count }
}

function Invoke-StagedRuntimeDoctor {
    param([Parameter(Mandatory = $true)][string]$StageRoot)

    $controllerPath = Join-Path $StageRoot '.tools\project.ps1'
    if (-not (Test-Path -LiteralPath $controllerPath -PathType Leaf)) {
        throw "Staged runtime controller is missing: $controllerPath"
    }

    try {
        $doctorOutput = @(& $controllerPath -Task 'doctor' -ArgumentList @('-AsJson') -RepositoryRoot $StageRoot 2>&1)
    }
    catch {
        throw "Staged runtime doctor failed before promotion: $($_.Exception.Message)"
    }
    $doctorResult = $null
    foreach ($line in @($doctorOutput | Select-Object -Last 20)) {
        $text = [string]$line
        if (-not $text.TrimStart().StartsWith('{')) { continue }
        try { $doctorResult = $text | ConvertFrom-Json } catch {}
        if ($null -ne $doctorResult) { break }
    }
    if ($null -eq $doctorResult -or [string]$doctorResult.schema -ne 'gknome_project_doctor_result_v1' -or [string]$doctorResult.status -ne 'pass') {
        throw 'Staged runtime doctor did not return a passing gknome project-doctor result.'
    }
}

if (-not $Yes) { throw 'Share export requires -Yes for direct dispatch; the interactive menu uses an exact typed confirmation.' }
if (-not (Test-Path -LiteralPath $script:SharePath -PathType Leaf)) { throw "Share manifest not found: $script:SharePath" }
$share = Read-StrictJsonFile -Path $script:SharePath -MaxBytes 1048576
if ([string]$share.schema -ne 'gknome_share_v1' -or [int]$share.version -ne 1) { throw 'Share manifest must declare gknome_share_v1 version 1.' }
$profileObject = $share.profiles.PSObject.Properties[$Profile].Value
if ($null -eq $profileObject) { throw "Share profile is missing: $Profile" }

$destinationCandidate = if ([string]::IsNullOrWhiteSpace($Destination)) {
    Join-Path $script:RepoParent ((Split-Path -Leaf $script:RepoRoot) + '-' + $Profile + '-share')
}
elseif ([System.IO.Path]::IsPathRooted($Destination)) { $Destination }
else { Join-Path (Get-Location).Path $Destination }
$destinationFull = [System.IO.Path]::GetFullPath($destinationCandidate)
$destinationFull = $destinationFull.TrimEnd('\', '/')
if ((Split-Path -Parent $destinationFull) -ine $script:RepoParent) { throw 'Share destination must be a sibling of the repository root.' }
if ($destinationFull -ieq $script:RepoRoot) { throw 'Share destination cannot be the repository root.' }
if (Test-Path -LiteralPath $destinationFull) { throw "Share destination already exists: $destinationFull" }

$selected = if ($Profile -eq 'developer') { @(Get-DeveloperFiles) } else {
    $includePatterns = @($profileObject.include) + @($profileObject.additional_include)
    $excludePatterns = @($profileObject.exclude)
    foreach ($pattern in @($includePatterns + $excludePatterns)) { [void](Assert-SafePattern -Pattern ([string]$pattern)) }
    @(Get-SafeSourceFiles | Where-Object {
        $relative = [string]$_.relative
        $included = $false
        foreach ($pattern in $includePatterns) { if (Test-MatchesPattern -Path $relative -Pattern ([string]$pattern)) { $included = $true; break } }
        $excluded = $false
        foreach ($pattern in $excludePatterns) { if (Test-MatchesPattern -Path $relative -Pattern ([string]$pattern)) { $excluded = $true; break } }
        $included -and -not $excluded
    })
}
$selected = @($selected | Sort-Object relative -Unique)
if ($selected.Count -eq 0) { throw "Share profile selected no files: $Profile" }
if ($Profile -eq 'runtime') {
    foreach ($required in @('run.cmd', 'scripts/run.ps1', 'scripts/run.sh', '.tools/project.ps1', '.tools/controller.v3.json')) {
        if (@($selected | Where-Object { [string]$_.relative -ieq $required }).Count -ne 1) { throw "Runtime share is missing required portable file: $required" }
    }
}

$stage = Join-Path $script:RepoParent ('.gknome-share-stage-' + [guid]::NewGuid().ToString('N'))
$committed = $false
$runtimeClosure = $null
try {
    New-Item -ItemType Directory -Path $stage -ErrorAction Stop | Out-Null
    foreach ($entry in $selected) {
        $target = Join-Path $stage ([string]$entry.relative).Replace('/', '\')
        $parent = Split-Path -Parent $target
        if (-not (Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        [System.IO.File]::Copy([string]$entry.full, $target, $false)
    }
    if ($Profile -eq 'runtime') {
        $selectedPaths = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
        foreach ($entry in $selected) { [void]$selectedPaths.Add(([string]$entry.relative).Replace('\', '/')) }
        $runtimeClosure = ConvertTo-RuntimeControllerClosure -StageRoot $stage -Profile $profileObject -SelectedPaths $selectedPaths
        Invoke-StagedRuntimeDoctor -StageRoot $stage
    }

    $records = New-Object System.Collections.Generic.List[object]
    [int64]$totalBytes = 0
    foreach ($item in @(Get-ChildItem -LiteralPath $stage -Recurse -Force -File | Sort-Object FullName)) {
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Share staging produced an unexpected reparse file.' }
        $relative = Get-RelativePath -Root $stage -Path $item.FullName
        $sha256 = Get-FileSha256 -Path $item.FullName
        $totalBytes += [int64]$item.Length
        $records.Add([pscustomobject][ordered]@{ path = $relative; bytes = [int64]$item.Length; sha256 = $sha256 })
    }
    if (-not (Test-Path -LiteralPath $script:SecretScannerPath -PathType Leaf)) { throw "Secret scanner is missing: $script:SecretScannerPath" }
    $global:LASTEXITCODE = 0
    $scanOutput = @(& $script:SecretScannerPath -RepositoryRoot $stage -FailOnFindings -AsJson 2>&1)
    $scanExit = [int]$LASTEXITCODE
    if ($scanExit -ne 0) { throw 'Share staging failed the secret scan; inspect the local scanner report.' }

    $aggregateSource = (@($records.ToArray() | ForEach-Object { "$($_.path)`n$($_.bytes)`n$($_.sha256)" }) -join "`n")
    $inventory = [pscustomobject][ordered]@{
        schema = 'gknome_share_inventory_v1'
        profile = $Profile
        created_at_utc = [DateTime]::UtcNow.ToString('o')
        source_project = Split-Path -Leaf $script:RepoRoot
        file_count = $records.Count
        bytes = $totalBytes
        aggregate_sha256 = Get-TextSha256 -Text $aggregateSource
        runtime_controller_operations = if ($null -ne $runtimeClosure) { [int]$runtimeClosure.operations } else { $null }
        runtime_task_specs = if ($null -ne $runtimeClosure) { [int]$runtimeClosure.task_specs } else { $null }
        files = @($records.ToArray())
    }
    [System.IO.File]::WriteAllText((Join-Path $stage 'share-inventory.json'), (($inventory | ConvertTo-Json -Depth 8) + "`n"), $script:Utf8NoBom)
    Move-Item -LiteralPath $stage -Destination $destinationFull -ErrorAction Stop
    $committed = $true
    $result = [pscustomobject][ordered]@{
        schema = 'gknome_project_share_result_v1'
        status = 'pass'
        profile = $Profile
        destination = $destinationFull
        file_count = $records.Count
        bytes = $totalBytes
        aggregate_sha256 = $inventory.aggregate_sha256
        secret_scan = 'pass'
        runtime_controller_operations = if ($null -ne $runtimeClosure) { [int]$runtimeClosure.operations } else { $null }
    }
    if ($AsJson) { $result | ConvertTo-Json -Compress }
    else {
        Write-Host "Share profile: $Profile"
        Write-Host "Destination: $destinationFull"
        Write-Host "Files: $($records.Count); bytes: $totalBytes"
        Write-Host "Inventory SHA-256: $($inventory.aggregate_sha256)"
    }
}
finally {
    if (-not $committed -and (Test-Path -LiteralPath $stage -PathType Container)) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
