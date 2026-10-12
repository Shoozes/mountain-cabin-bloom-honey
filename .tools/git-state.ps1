#Requires -Version 5.1

<##
.SYNOPSIS
    Classifies a local branch against a fetched remote-tracking branch.

.DESCRIPTION
    This is a read-only state boundary shared by the push and pull helpers.
    It never fetches, merges, resets, stages, or writes credentials.
##>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$Branch,
    [string]$RemoteName = 'origin',
    [switch]$AsJson
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Invoke-SafeGit {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    $safeArgs = @('-c', "safe.directory=$RepositoryRoot", '-c', 'core.excludesFile=', '-C', $RepositoryRoot)
    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & git @($safeArgs + $Arguments)
    }
    finally { $ErrorActionPreference = $previousErrorAction }
}

function Get-RefSha {
    param([Parameter(Mandatory = $true)][string]$Ref)
    $value = (Invoke-SafeGit -Arguments @('rev-parse', '--verify', $Ref) 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { return '' }
    return $value
}

if (-not (Test-Path -LiteralPath $RepositoryRoot -PathType Container)) { throw "Repository root not found: $RepositoryRoot" }
if ($Branch -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$' -or $Branch -match '[\s]') { throw "Unsafe branch name: $Branch" }
if ($RemoteName -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$') { throw "Unsafe remote name: $RemoteName" }

$local = Get-RefSha -Ref 'HEAD'
$remote = Get-RefSha -Ref ("$RemoteName/$Branch")
$state = 'unborn'
if ([string]::IsNullOrWhiteSpace($remote)) {
    $state = 'remote-missing'
}
elseif ([string]::IsNullOrWhiteSpace($local)) {
    $state = 'unborn'
}
elseif ($local -eq $remote) {
    $state = 'equal'
}
else {
    Invoke-SafeGit -Arguments @('merge-base', '--is-ancestor', $remote, $local) *>$null
    $localAhead = ($LASTEXITCODE -eq 0)
    Invoke-SafeGit -Arguments @('merge-base', '--is-ancestor', $local, $remote) *>$null
    $remoteAhead = ($LASTEXITCODE -eq 0)
    if ($localAhead -and -not $remoteAhead) { $state = 'ahead' }
    elseif ($remoteAhead -and -not $localAhead) { $state = 'behind' }
    else { $state = 'diverged' }
}

$result = [pscustomobject][ordered]@{
    schema = 'gknome_git_branch_state_v1'
    status = $state
    repository_root = [System.IO.Path]::GetFullPath($RepositoryRoot)
    branch = $Branch
    remote_name = $RemoteName
    local_sha = if ($local) { $local } else { $null }
    remote_sha = if ($remote) { $remote } else { $null }
}
if ($AsJson) { Write-Output ($result | ConvertTo-Json -Depth 10 -Compress) }
else { Write-Output $result.status }
