#Requires -Version 5.1

<##
.SYNOPSIS
    Fetches and fast-forwards the reviewed GitHub branch without auto-merging.

.DESCRIPTION
    Normal pulls require a clean tree and use only fast-forward integration.
    Behind/diverged local histories, untracked overwrite risks, and conflicts are
    reported for manual review. -Force is an explicit destructive reset to the
    fetched branch and still requires a second confirmation.
##>

[CmdletBinding()]
param(
    [string]$Remote = '',
    [switch]$Force,
    [switch]$Yes
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$script:GitSafeDirectory = ''
. (Join-Path $PSScriptRoot 'git-remote.ps1')
$script:StrictJsonReader = Join-Path $PSScriptRoot 'StrictJson.ps1'
if (-not (Test-Path -LiteralPath $script:StrictJsonReader -PathType Leaf)) { throw "Strict JSON reader is missing: $script:StrictJsonReader" }
. $script:StrictJsonReader

function Invoke-Git {
    param([Parameter(Position = 0, ValueFromRemainingArguments = $true)][string[]]$Arguments)
    $safe = @('-c', "safe.directory=$script:GitSafeDirectory", '-c', 'core.excludesFile=')
    & git @($safe + $Arguments)
}

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return Read-StrictJsonFile -Path $Path -MaxBytes 1048576
}

function Read-FirstLine {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing token file: $Path" }
    $line = ([System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8) -split "`r?`n")[0]
    $line = $line.Trim().TrimStart([char]0xFEFF)
    if ([string]::IsNullOrWhiteSpace($line)) { throw "Token file is empty: $Path" }
    return $line
}

function Confirm-OrExit {
    param([Parameter(Mandatory = $true)][string]$Prompt, [string]$Expected = 'YES')
    if ($Yes) { return }
    $answer = Read-Host "$Prompt Type $Expected to continue"
    if ($answer -ne $Expected) { Write-Host 'Canceled.'; exit 0 }
}

function Resolve-TokenPath {
    param([Parameter(Mandatory = $true)][string]$Root, [string]$Directory = '.tools\.secrets')
    $candidates = @(
        (Join-Path $Root (Join-Path $Directory 'gt.txt')),
        (Join-Path $Root '.tools\.secrets\gt.txt'),
        (Join-Path $Root '.secrets\gt.txt')
    ) | Select-Object -Unique
    foreach ($candidate in $candidates) { if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate } }
    throw 'Missing token file. Put gt.txt under .tools/.secrets/ or the configured secrets directory.'
}

function Get-SyncState {
    param([Parameter(Mandatory = $true)][string]$Branch)
    $stateScript = Join-Path $repoRoot '.tools\git-state.ps1'
    $result = ConvertFrom-BoundedStrictJsonText -Text ((& $stateScript -RepositoryRoot $repoRoot -Branch $Branch -RemoteName 'origin' -AsJson | Out-String).Trim()) -MaxUtf8Bytes 1048576 -Label 'gknome Git state'
    return [string]$result.status
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$callerLocation = Get-Location
try {
Set-Location -LiteralPath $repoRoot
$script:GitSafeDirectory = $repoRoot
$project = Read-JsonFile -Path (Join-Path $repoRoot '.tools\project.json')
$configuredRemote = if ($project -and $project.git -and $project.git.remote) { [string]$project.git.remote } else { '' }
if ([string]::IsNullOrWhiteSpace($Remote)) { $Remote = $configuredRemote }
Assert-GitHubRemote -Remote $Remote
$secretDirectory = if ($project -and $project.paths -and $project.paths.secrets_dir) { [string]$project.paths.secrets_dir } else { '.tools\.secrets' }
$tokenPath = Resolve-TokenPath -Root $repoRoot -Directory $secretDirectory
$originalGitEnvironment = @{}
foreach ($name in @('GIT_TERMINAL_PROMPT', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0')) {
    $originalGitEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot '.git'))) { throw 'A Git repository is required.' }
    $token = Read-FirstLine -Path $tokenPath
    $origin = (Invoke-Git 'remote' 'get-url' 'origin' 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($origin)) { throw 'No origin is configured; pull will not create one implicitly.' }
    if ($origin -ne $Remote) { throw "Configured origin does not match requested remote: $origin" }
    $branch = (Invoke-Git 'branch' '--show-current' 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($branch) -or $branch -eq 'HEAD') { throw 'A named branch is required; detached HEAD pulls are refused.' }

    if ($Force -and $Yes) { throw '-Yes cannot authorize -Force. Rerun without -Yes and type FORCE to discard local changes and untracked files.' }
    if ($Force) { Confirm-OrExit -Prompt 'Force pull will discard local changes and untracked files.' -Expected 'FORCE' }
    else { Confirm-OrExit -Prompt 'Proceed with Git fetch/fast-forward pull?' -Expected 'YES' }

    $pair = "x-access-token:$token"
    $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
    $env:GIT_TERMINAL_PROMPT = '0'
    $env:GIT_CONFIG_COUNT = '1'
    $env:GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader'
    $env:GIT_CONFIG_VALUE_0 = "Authorization: Basic $basic"

    Invoke-Git 'fetch' 'origin' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed; the working tree was not changed.' }
    if ($Force) {
        Invoke-Git 'reset' '--hard' "origin/$branch"
        if ($LASTEXITCODE -ne 0) { throw 'Force reset failed.' }
        Invoke-Git 'clean' '-fd'
        if ($LASTEXITCODE -ne 0) { throw 'Force clean failed.' }
        Write-Host "Force-pulled $branch from origin."
    }
    else {
        $status = (Invoke-Git 'status' '--porcelain' | Out-String).Trim()
        if (-not [string]::IsNullOrWhiteSpace($status)) { throw 'Working tree is not clean; review or stash manually before pulling.' }
        $syncState = Get-SyncState -Branch $branch
        if ($syncState -eq 'remote-missing') { throw "Remote branch does not exist: origin/$branch" }
        elseif ($syncState -eq 'behind') {
            Invoke-Git 'merge' '--ff-only' "origin/$branch"
            if ($LASTEXITCODE -ne 0) { throw 'Fast-forward pull failed; resolve manually.' }
            Write-Host "Fast-forwarded $branch from origin."
        }
        elseif ($syncState -eq 'equal') { Write-Host "Already synchronized: $branch." }
        elseif ($syncState -eq 'ahead') { Write-Host "Local $branch is ahead; no pull was needed." }
        else { throw "Remote and local '$branch' histories are $syncState; manual review is required." }
    }
}
finally {
    foreach ($name in $originalGitEnvironment.Keys) {
        $value = $originalGitEnvironment[$name]
        if ($null -eq $value) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
        else { Set-Item "Env:$name" $value }
    }
    $token = $null
    $basic = $null
}
}
finally { Set-Location -LiteralPath $callerLocation.Path }
