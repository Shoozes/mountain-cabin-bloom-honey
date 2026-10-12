#Requires -Version 5.1

<#
.SYNOPSIS
    Reads and updates the tracked gknome lifecycle state.

.DESCRIPTION
    Status, next-stage guidance, checklist output, and explicit stage transitions
    share one PowerShell 5.1-compatible implementation. Backward transitions are
    refused unless -AllowRegression is supplied with a non-empty reason.
#>

[CmdletBinding()]
param(
    [ValidateSet('Status', 'Next', 'Checklist', 'Set')]
    [string]$Mode = 'Status',

    [ValidateSet('idea', 'working-concept', 'demo', 'repo-foundation', 'direction-identity', 'implementation', 'snapshot', 'integrity-pass')]
    [string]$Stage = 'repo-foundation',

    [string]$Reason = '',

    [switch]$AllowRegression,

    [string]$SnapshotStatus = '',

    [string]$SnapshotVersion = '',

    [string]$RepositoryRoot = '',

    [switch]$AsJson
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$script:StrictJsonReader = Join-Path $PSScriptRoot 'StrictJson.ps1'
if (-not (Test-Path -LiteralPath $script:StrictJsonReader -PathType Leaf)) {
    throw "Strict JSON reader is missing: $script:StrictJsonReader"
}
. $script:StrictJsonReader

$script:SnapshotStatuses = @('not-started', 'in-progress', 'candidate', 'frozen')
$script:SnapshotEvidenceStatuses = @('candidate', 'frozen')

if (-not [string]::IsNullOrWhiteSpace($SnapshotStatus) -and $SnapshotStatus -notin $script:SnapshotStatuses) {
    throw "Invalid snapshot status: $SnapshotStatus"
}

$script:RepoRoot = if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
else {
    [System.IO.Path]::GetFullPath($RepositoryRoot)
}
if (-not (Test-Path -LiteralPath $script:RepoRoot -PathType Container)) {
    throw "Repository root not found: $script:RepoRoot"
}
$script:StatePath = Join-Path $script:RepoRoot '.tools\project-state.json'
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Get-StageDefinitions {
    return @(
        [pscustomobject][ordered]@{
            id = 'idea'
            number = 1
            name = 'Idea'
            goal = 'Define the opportunity, user, desired result, and major unknowns.'
            exit_gate = 'The next useful working concept can be stated.'
            checklist = @('Problem or opportunity is stated.', 'Intended user or operator is stated.', 'Major unknowns are listed.', 'Reason to test is clear.')
        },
        [pscustomobject][ordered]@{
            id = 'working-concept'
            number = 2
            name = 'Working Concept'
            goal = 'Prove the central mechanism with a bounded HAIO, script, harness, or experiment.'
            exit_gate = 'The central mechanism works often enough to justify an interactive demonstration.'
            checklist = @('One narrow path works.', 'Assumptions and shortcuts are recorded.', 'Failure cases are visible.', 'Hardware and dependency needs are roughly known.')
        },
        [pscustomobject][ordered]@{
            id = 'demo'
            number = 3
            name = 'Demonstration'
            goal = 'Produce an interactive, reviewable mini-app or demo with repeatable operation.'
            exit_gate = 'The concept is coherent enough to establish a durable repository.'
            checklist = @('The demo has a repeatable run command.', 'Useful progress and errors are visible.', 'Basic proof can be captured.', 'Continue, stop, or redirect decision is explicit.')
        },
        [pscustomobject][ordered]@{
            id = 'repo-foundation'
            number = 4
            name = 'Repository Foundation'
            goal = 'Establish identity, policy, paths, context, proof, safety, and a shared task surface.'
            exit_gate = 'A new developer or agent can enter and continue without reverse-engineering setup.'
            checklist = @('Identity and profile are recorded.', 'Source, docs, tools, artifacts, runtime, and secrets have owners.', 'CLI/TUI task surface runs.', 'Context groups and proof lanes exist.', 'Template provenance and version are recorded.')
        },
        [pscustomobject][ordered]@{
            id = 'direction-identity'
            number = 5
            name = 'Direction and Identity'
            goal = 'Review the repository as a whole and decide the real product identity and implementation direction.'
            exit_gate = 'Scope, non-goals, architecture order, demo disposition, risks, and milestones are coherent.'
            checklist = @('Project promise and audience are clear.', 'Demo code is retained, rewritten, archived, or removed intentionally.', 'Architecture direction is recorded.', 'Action board is ordered.', 'Pitfalls and risks have owners or guards.')
        },
        [pscustomobject][ordered]@{
            id = 'implementation'
            number = 6
            name = 'Full Implementation'
            goal = 'Build durable lower-level foundations through higher-level experience.'
            exit_gate = 'The intended MVP feature set works through real project boundaries.'
            checklist = @('Data and state contracts are implemented.', 'Core logic and backend paths are durable.', 'CLI/API and integrations handle failures.', 'Frontend or presentation exposes stable contracts.', 'Packaging and operator workflow exist where required.')
        },
        [pscustomobject][ordered]@{
            id = 'snapshot'
            number = 7
            name = 'Freeze and Prove'
            goal = 'Freeze broad scope, prove behavior, and create an MVP or LTS snapshot candidate.'
            exit_gate = 'The snapshot is reproducible, testable, understandable, and supportable at its declared level.'
            checklist = @('Scope and version target are frozen.', 'Relevant test lanes pass.', 'Benchmarks record environment and inputs.', 'Known limitations and rollback are documented.', 'Artifacts have immutable identity and checksums.')
        },
        [pscustomobject][ordered]@{
            id = 'integrity-pass'
            number = 8
            name = 'Integrity Pass and Scale Readiness'
            goal = 'Straighten out the wires, reduce debt, focus context, and harden a clean baseline.'
            exit_gate = 'The repository is organized, measured, and ready for the next cycle or scale increase.'
            checklist = @('Sources of truth are singular and current.', 'Pitfalls and recurring failures have guards.', 'Context and generated state are bounded.', 'Dependencies and paths are clean.', 'Measured optimizations preserve Safety, Courtesy, and Show.')
        }
    )
}

function Assert-SnapshotContract {
    param([Parameter(Mandatory = $true)][object]$Snapshot)

    $allowed = @('target', 'status', 'version', 'frozen_at_utc')
    foreach ($property in @($Snapshot.PSObject.Properties)) {
        if ([string]$property.Name -notin $allowed) { throw "GKNOME-STATE-UNKNOWN_PROPERTY: snapshot.$($property.Name)" }
    }
    foreach ($required in @('target', 'status')) {
        if ($null -eq $Snapshot.PSObject.Properties[$required] -or $null -eq $Snapshot.PSObject.Properties[$required].Value) {
            throw "GKNOME-STATE-MISSING_PROPERTY: snapshot.$required"
        }
    }

    if ([string]$Snapshot.target -notin @('none', 'demo', 'mvp', 'lts')) { throw "GKNOME-STATE-INVALID_VALUE: snapshot.target '$($Snapshot.target)'." }
    if ([string]$Snapshot.status -notin $script:SnapshotStatuses) { throw "GKNOME-STATE-INVALID_VALUE: snapshot.status '$($Snapshot.status)'." }

    $versionProperty = $Snapshot.PSObject.Properties['version']
    $version = if ($null -ne $versionProperty) { $versionProperty.Value } else { $null }
    if ($null -ne $version -and ($version -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$version) -or ([string]$version).Length -gt 128 -or [string]$version -match '[\x00-\x1F\r\n]')) {
        throw 'GKNOME-STATE-INVALID_VALUE: snapshot.version must be null or a bounded printable value.'
    }

    $frozenProperty = $Snapshot.PSObject.Properties['frozen_at_utc']
    $frozenAt = if ($null -ne $frozenProperty) { $frozenProperty.Value } else { $null }
    if ($null -ne $frozenAt) {
        if ($frozenAt -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$frozenAt)) {
            throw 'GKNOME-STATE-INVALID_VALUE: snapshot.frozen_at_utc must be null or a date-time string.'
        }
        try { $null = [DateTimeOffset]::Parse([string]$frozenAt) } catch { throw 'GKNOME-STATE-INVALID_VALUE: snapshot.frozen_at_utc is invalid.' }
    }

    if ([string]$Snapshot.status -in $script:SnapshotEvidenceStatuses) {
        if ($null -eq $version -or $null -eq $frozenAt) {
            throw 'GKNOME-STATE-INVALID_VALUE: candidate or frozen snapshots require version and frozen_at_utc.'
        }
    }
    elseif ($null -ne $frozenAt) {
        throw 'GKNOME-STATE-INVALID_VALUE: not-started or in-progress snapshots cannot claim frozen_at_utc.'
    }
}

function Assert-StateContract {
    param([Parameter(Mandatory = $true)][object]$State)

    $allowed = @('schema', 'state_revision', 'project', 'profile', 'capabilities', 'current_stage', 'stage_number', 'origin', 'snapshot', 'stage_history', 'updated_at_utc')
    foreach ($property in @($State.PSObject.Properties)) {
        if ($allowed -notcontains [string]$property.Name) {
            throw "GKNOME-STATE-UNKNOWN_PROPERTY: $($property.Name)"
        }
    }
    foreach ($required in $allowed) {
        if ($null -eq $State.PSObject.Properties[$required] -or $null -eq $State.PSObject.Properties[$required].Value) {
            throw "GKNOME-STATE-MISSING_PROPERTY: $required"
        }
    }
    if ([string]$State.schema -ne 'gknome_project_state_v1') { throw "GKNOME-STATE-INVALID_SCHEMA: $($State.schema)" }
    if ([int]$State.state_revision -lt 1) { throw 'GKNOME-STATE-INVALID_VALUE: state_revision must be positive.' }
    if ([string]::IsNullOrWhiteSpace([string]$State.project) -or [string]$State.project -match '[\x00-\x1F\r\n]') { throw 'GKNOME-STATE-INVALID_VALUE: project is empty or non-printable.' }
    if ([string]$State.profile -notin @('tool', 'app', 'service', 'game', 'library', 'experiment', 'agentic-app', 'custom')) { throw "GKNOME-STATE-INVALID_VALUE: unsupported profile '$($State.profile)'." }

    if ($State.capabilities -isnot [System.Array]) { throw 'GKNOME-STATE-INVALID_TYPE: capabilities must be an array.' }
    $capabilities = New-Object System.Collections.Generic.List[string]
    foreach ($capability in @($State.capabilities)) {
        if ($capability -isnot [string] -or [string]$capability -notmatch '^[a-z0-9][a-z0-9-]*$') { throw "GKNOME-STATE-INVALID_VALUE: capability '$capability'." }
        if ($capabilities.Contains([string]$capability)) { throw "GKNOME-STATE-DUPLICATE_VALUE: capability '$capability'." }
        $capabilities.Add([string]$capability)
    }

    $current = Find-Stage -Id ([string]$State.current_stage)
    if ([int]$State.stage_number -ne [int]$current.number) { throw "GKNOME-STATE-INVALID_VALUE: stage number does not match '$($State.current_stage)'." }

    $origin = $State.origin
    foreach ($property in @($origin.PSObject.Properties)) {
        if ([string]$property.Name -notin @('source_stage', 'adopted_existing')) { throw "GKNOME-STATE-UNKNOWN_PROPERTY: origin.$($property.Name)" }
    }
    if ([string]$origin.source_stage -notin @('idea', 'working-concept', 'demo', 'repo-foundation')) { throw "GKNOME-STATE-INVALID_VALUE: origin.source_stage '$($origin.source_stage)'." }
    if ($origin.adopted_existing -isnot [bool]) { throw 'GKNOME-STATE-INVALID_TYPE: origin.adopted_existing must be boolean.' }

    Assert-SnapshotContract -Snapshot $State.snapshot

    if ($State.stage_history -isnot [System.Array] -or @($State.stage_history).Count -eq 0) { throw 'GKNOME-STATE-INVALID_VALUE: stage_history must be a non-empty array.' }
    $previousTime = $null
    $previousNumber = 0
    $historyIndex = 0
    foreach ($entry in @($State.stage_history)) {
        foreach ($property in @($entry.PSObject.Properties)) {
            if ([string]$property.Name -notin @('stage', 'stage_number', 'entered_at_utc', 'reason', 'regression')) { throw "GKNOME-STATE-UNKNOWN_PROPERTY: stage_history[$historyIndex].$($property.Name)" }
        }
        foreach ($required in @('stage', 'stage_number', 'entered_at_utc', 'reason', 'regression')) {
            if ($null -eq $entry.PSObject.Properties[$required] -or $null -eq $entry.PSObject.Properties[$required].Value) { throw "GKNOME-STATE-MISSING_PROPERTY: stage_history[$historyIndex].$required" }
        }
        $entryStage = Find-Stage -Id ([string]$entry.stage)
        if ([int]$entry.stage_number -ne [int]$entryStage.number) { throw "GKNOME-STATE-INVALID_VALUE: stage_history[$historyIndex] stage number mismatch." }
        if ([string]::IsNullOrWhiteSpace([string]$entry.reason)) { throw "GKNOME-STATE-INVALID_VALUE: stage_history[$historyIndex] reason is empty." }
        if ($entry.regression -isnot [bool]) { throw "GKNOME-STATE-INVALID_TYPE: stage_history[$historyIndex].regression must be boolean." }
        try { $entryTime = [DateTimeOffset]::Parse([string]$entry.entered_at_utc) } catch { throw "GKNOME-STATE-INVALID_VALUE: stage_history[$historyIndex] timestamp is invalid." }
        if ($null -ne $previousTime -and $entryTime -lt $previousTime) { throw 'GKNOME-STATE-INVALID_VALUE: stage history timestamps must be ordered.' }
        if ($historyIndex -gt 0 -and [bool]$entry.regression -ne ([int]$entryStage.number -lt $previousNumber)) { throw "GKNOME-STATE-INVALID_VALUE: stage_history[$historyIndex] regression marker is inconsistent." }
        $previousTime = $entryTime
        $previousNumber = [int]$entryStage.number
        $historyIndex++
    }
    $last = @($State.stage_history)[-1]
    if ([string]$last.stage -ne [string]$State.current_stage -or [int]$last.stage_number -ne [int]$State.stage_number) { throw 'GKNOME-STATE-INVALID_VALUE: final history entry must equal current state.' }
    try { $updated = [DateTimeOffset]::Parse([string]$State.updated_at_utc) } catch { throw 'GKNOME-STATE-INVALID_VALUE: updated_at_utc is invalid.' }
    if ($null -ne $previousTime -and $updated -lt $previousTime) { throw 'GKNOME-STATE-INVALID_VALUE: updated_at_utc cannot precede the final history entry.' }
}

function Read-State {
    if (-not (Test-Path -LiteralPath $script:StatePath -PathType Leaf)) {
        $retainedBackups = @(Get-ChildItem -LiteralPath (Split-Path -Parent $script:StatePath) -File -Filter ((Split-Path -Leaf $script:StatePath) + '.*.bak') -ErrorAction SilentlyContinue)
        $recoveryHint = if ($retainedBackups.Count -gt 0) { " Retained recovery backup(s): $(@($retainedBackups.FullName) -join ', ')" } else { '' }
        throw ('Project lifecycle state not found: {0}{1}' -f $script:StatePath, $recoveryHint)
    }
    $state = Read-StrictJsonFile -Path $script:StatePath -MaxBytes 1048576
    if ([string]$state.schema -ne 'gknome_project_state_v1') {
        throw "Unsupported project lifecycle schema: $($state.schema)"
    }
    Assert-StateContract -State $state
    return $state
}

function Write-StateAtomic {
    param([Parameter(Mandatory = $true)][object]$State)

    $tempPath = "$script:StatePath.$PID.$([guid]::NewGuid().ToString('N')).tmp"
    $backupPath = "$script:StatePath.$PID.$([guid]::NewGuid().ToString('N')).bak"
    $json = $State | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($tempPath, $json + [Environment]::NewLine, $script:Utf8NoBom)
    $keepBackup = $false
    try {
        if (Test-Path -LiteralPath $script:StatePath -PathType Leaf) {
            try {
                [System.IO.File]::Replace($tempPath, $script:StatePath, $backupPath, $true)
            }
            catch {
                $replaceException = $_.Exception
                $isUnauthorized = $replaceException -is [System.UnauthorizedAccessException] -or $replaceException.InnerException -is [System.UnauthorizedAccessException]
                if (-not $isUnauthorized) { throw }
                if (-not (Test-Path -LiteralPath $tempPath -PathType Leaf) -or -not (Test-Path -LiteralPath $script:StatePath -PathType Leaf)) { throw }

                $probe = $null
                try {
                    $probe = [System.IO.File]::Open($script:StatePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::Read)
                }
                finally {
                    if ($null -ne $probe) { $probe.Dispose() }
                }

                [System.IO.File]::Move($script:StatePath, $backupPath)
                $keepBackup = $true
                try {
                    [System.IO.File]::Move($tempPath, $script:StatePath)
                    $keepBackup = $false
                }
                catch {
                    $publishException = $_.Exception
                    if (-not (Test-Path -LiteralPath $script:StatePath) -and (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
                        try {
                            [System.IO.File]::Move($backupPath, $script:StatePath)
                            $keepBackup = $false
                        }
                        catch {
                            throw "Lifecycle state publication failed and automatic restoration failed. Original state retained at '$backupPath'. Publish error: $($publishException.Message)"
                        }
                    }
                    throw $publishException
                }
            }
        }
        else {
            [System.IO.File]::Move($tempPath, $script:StatePath)
        }
    }
    finally {
        if (Test-Path -LiteralPath $tempPath) {
            Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
        }
        if (-not $keepBackup -and (Test-Path -LiteralPath $backupPath)) {
            Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Find-Stage {
    param([Parameter(Mandatory = $true)][string]$Id)
    $match = @(Get-StageDefinitions | Where-Object { $_.id -eq $Id })
    if ($match.Count -ne 1) {
        throw "Unknown lifecycle stage: $Id"
    }
    return $match[0]
}

function Get-NextStage {
    param([Parameter(Mandatory = $true)][object]$Current)
    $match = @(Get-StageDefinitions | Where-Object { [int]$_.number -eq ([int]$Current.number + 1) })
    if ($match.Count -eq 0) { return $null }
    return $match[0]
}

function New-Report {
    param(
        [Parameter(Mandatory = $true)][object]$State,
        [Parameter(Mandatory = $true)][object]$Current,
        [object]$Next = $null,
        [string]$Status = 'available'
    )

    $nextReport = $null
    if ($null -ne $Next) {
        $nextReport = [pscustomobject][ordered]@{
            id = [string]$Next.id
            number = [int]$Next.number
            name = [string]$Next.name
            goal = [string]$Next.goal
            exit_gate = [string]$Next.exit_gate
            checklist = @($Next.checklist)
        }
    }

    return [pscustomobject][ordered]@{
        schema = 'gknome_lifecycle_report_v1'
        status = $Status
        project = [string]$State.project
        profile = [string]$State.profile
        capabilities = @($State.capabilities)
        current_stage = [pscustomobject][ordered]@{
            id = [string]$Current.id
            number = [int]$Current.number
            name = [string]$Current.name
            goal = [string]$Current.goal
            exit_gate = [string]$Current.exit_gate
            checklist = @($Current.checklist)
        }
        next_stage = $nextReport
        snapshot = $State.snapshot
        state_revision = [int]$State.state_revision
        updated_at_utc = [string]$State.updated_at_utc
    }
}

function Write-Report {
    param([Parameter(Mandatory = $true)][object]$Report)

    if ($AsJson) {
        Write-Output ($Report | ConvertTo-Json -Depth 100 -Compress)
        return
    }

    Write-Host "Project: $($Report.project)"
    Write-Host "Profile: $($Report.profile)"
    Write-Host "Stage: $($Report.current_stage.number) - $($Report.current_stage.name) [$($Report.current_stage.id)]"
    Write-Host "Goal: $($Report.current_stage.goal)"
    Write-Host "Exit gate: $($Report.current_stage.exit_gate)"
    if ($null -ne $Report.next_stage) {
        Write-Host "Next: $($Report.next_stage.number) - $($Report.next_stage.name) [$($Report.next_stage.id)]"
    }
    else {
        Write-Host 'Next: No later lifecycle stage is defined.'
    }
    Write-Host "State revision: $($Report.state_revision)"
    Write-Host "Updated: $($Report.updated_at_utc)"
}

$state = Read-State
$current = Find-Stage -Id ([string]$state.current_stage)
if ([int]$state.stage_number -ne [int]$current.number) {
    throw "Lifecycle state is inconsistent: stage '$($state.current_stage)' must use number $($current.number)."
}
$next = Get-NextStage -Current $current

switch ($Mode) {
    'Status' {
        Write-Report -Report (New-Report -State $state -Current $current -Next $next)
        break
    }
    'Next' {
        $report = New-Report -State $state -Current $current -Next $next
        if ($AsJson) {
            Write-Output ($report | ConvertTo-Json -Depth 100 -Compress)
        }
        elseif ($null -eq $next) {
            Write-Host 'No later lifecycle stage is defined.'
        }
        else {
            Write-Host "Next stage: $($next.number) - $($next.name) [$($next.id)]"
            Write-Host "Goal: $($next.goal)"
            Write-Host "Exit gate: $($next.exit_gate)"
        }
        break
    }
    'Checklist' {
        $report = New-Report -State $state -Current $current -Next $next
        if ($AsJson) {
            Write-Output ($report | ConvertTo-Json -Depth 100 -Compress)
        }
        else {
            Write-Host "Current-stage checklist: $($current.name)"
            foreach ($item in @($current.checklist)) {
                Write-Host " - $item"
            }
            Write-Host "Exit gate: $($current.exit_gate)"
        }
        break
    }
    'Set' {
        if ([string]::IsNullOrWhiteSpace($Reason)) {
            throw 'A non-empty -Reason is required for lifecycle transitions.'
        }
        $target = Find-Stage -Id $Stage
        if ($target.id -eq $current.id) {
            throw "Project is already at lifecycle stage '$($current.id)'."
        }
        $isRegression = [int]$target.number -lt [int]$current.number
        if ($isRegression -and -not $AllowRegression) {
            throw "Backward transition from '$($current.id)' to '$($target.id)' requires -AllowRegression."
        }
        $now = [DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
        $entry = [pscustomobject][ordered]@{
            stage = [string]$target.id
            stage_number = [int]$target.number
            entered_at_utc = $now
            reason = $Reason.Trim()
            regression = [bool]$isRegression
        }
        $state.current_stage = [string]$target.id
        $state.stage_number = [int]$target.number
        if ([string]$target.id -eq 'snapshot') {
            $state.snapshot.status = if ($SnapshotStatus) { $SnapshotStatus } else { 'candidate' }
            if ($SnapshotVersion) { $state.snapshot.version = $SnapshotVersion }
            if ([string]$state.snapshot.status -in $script:SnapshotEvidenceStatuses -and [string]::IsNullOrWhiteSpace([string]$state.snapshot.version)) {
                $versionPath = Join-Path $script:RepoRoot 'version.json'
                if (Test-Path -LiteralPath $versionPath -PathType Leaf) {
                    $versionObject = Read-StrictJsonFile -Path $versionPath -MaxBytes 1048576
                    $state.snapshot.version = [string]$versionObject.version
                }
            }
            $state.snapshot.frozen_at_utc = if ([string]$state.snapshot.status -in $script:SnapshotEvidenceStatuses) { $now } else { $null }
        }
        $state.state_revision = [int]$state.state_revision + 1
        $state.stage_history = @($state.stage_history) + @($entry)
        $state.updated_at_utc = $now
        Assert-StateContract -State $state
        Write-StateAtomic -State $state
        $targetNext = Get-NextStage -Current $target
        Write-Report -Report (New-Report -State $state -Current $target -Next $targetNext -Status 'updated')
        break
    }
}
