#Requires -Version 5.1

<##
.SYNOPSIS
    Performs an explicit, fail-closed selected-path commit and main push.

.DESCRIPTION
    -CommitOnly creates a scoped local candidate without credentials or remote
    access so it can be verified before publication. The helper publishes main
    without staging when -Path is omitted. Explicit
    repository-relative paths are scanned, fetched, staged, and committed as a
    bounded set while unrelated index and working-tree state is preserved. The
    helper refuses behind/diverged histories and never resolves conflicts
    automatically. New repositories are private unless -Visibility public is
    explicit. The operator token is read only from the ignored secret store.
##>

[CmdletBinding()]
param(
    [string]$Remote = '',
    [string]$Message = '',
    [string[]]$Path = @(),
    [switch]$CommitOnly,
    [switch]$Yes,
    [switch]$CreateRemote,
    [ValidateSet('private', 'public')][string]$Visibility = 'private'
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

    $safeArgs = @('-c', "safe.directory=$script:GitSafeDirectory", '-c', 'core.excludesFile=')
    $previousErrorAction = $ErrorActionPreference
    try {
        # Windows PowerShell treats native stderr as an error record. Callers
        # inspect LASTEXITCODE even when a missing ref/remote is expected.
        $ErrorActionPreference = 'Continue'
        & git @($safeArgs + $Arguments)
    }
    finally { $ErrorActionPreference = $previousErrorAction }
}

function Read-FirstLine {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing token file: $Path" }
    $line = ([System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8) -split "`r?`n")[0]
    $line = $line.Trim().TrimStart([char]0xFEFF)
    if ([string]::IsNullOrWhiteSpace($line)) { throw "Token file is empty: $Path" }
    return $line
}

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return Read-StrictJsonFile -Path $Path -MaxBytes 1048576
}

function Get-RelPathPosix {
    param([Parameter(Mandatory = $true)][string]$BaseDir, [Parameter(Mandatory = $true)][string]$FullPath)
    $base = [System.IO.Path]::GetFullPath($BaseDir).TrimEnd('\', '/')
    $full = [System.IO.Path]::GetFullPath($FullPath)
    if (-not $full.StartsWith($base + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside repository root: $full"
    }
    return $full.Substring($base.Length).TrimStart('\', '/').Replace('\', '/')
}

function Resolve-PublishPaths {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [string[]]$RequestedPaths = @()
    )

    $resolved = New-Object System.Collections.Generic.List[object]
    $seen = @{}
    foreach ($requestedPath in @($RequestedPaths)) {
        if ([string]::IsNullOrWhiteSpace($requestedPath)) { throw 'Publish paths cannot be empty.' }
        if ([System.IO.Path]::IsPathRooted($requestedPath)) { throw "Publish paths must be repository-relative: $requestedPath" }

        $candidate = $null
        try { $candidate = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $requestedPath)) }
        catch { throw "Invalid publish path '$requestedPath': $($_.Exception.Message)" }
        $relative = Get-RelPathPosix -BaseDir $RepoRoot -FullPath $candidate
        if ($relative.Equals('.git', [System.StringComparison]::OrdinalIgnoreCase) -or
            $relative.StartsWith('.git/', [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Git metadata cannot be selected for publication: $requestedPath"
        }
        if ($seen.ContainsKey($relative)) { continue }
        $seen[$relative] = $true
        $resolved.Add([pscustomobject][ordered]@{
            relative = $relative
            pathspec = ":(top,literal)$relative"
        })
    }
    return @($resolved.ToArray())
}

function Resolve-TokenInfo {
    param([Parameter(Mandatory = $true)][string]$RepoRoot, [string]$SecretsDir, [string]$TokenFile)
    $candidates = @(
        (Join-Path $RepoRoot (Join-Path $SecretsDir $TokenFile)),
        (Join-Path $RepoRoot '.tools\secrets\gt.txt'),
        (Join-Path $RepoRoot '.tools\.secrets\gt.txt'),
        (Join-Path $RepoRoot '.secrets\gt.txt')
    ) | Select-Object -Unique
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $relative = Get-RelPathPosix -BaseDir $RepoRoot -FullPath $candidate
            return [pscustomobject][ordered]@{ path = $candidate; relative = $relative }
        }
    }
    throw "Missing token file. Put gt.txt under .tools/secrets/ or the configured secrets directory; .tools/.secrets/ remains a legacy fallback."
}

function Confirm-OrExit {
    param([Parameter(Mandatory = $true)][string]$Prompt, [string]$Expected = 'YES')
    if ($Yes) { return }
    $answer = Read-Host "$Prompt Type $Expected to continue"
    if ($answer -ne $Expected) { Write-Host 'Canceled.'; exit 0 }
}

function Get-GitConfigValue {
    param([Parameter(Mandatory = $true)][string]$Name)
    return (Invoke-Git 'config' '--get' $Name 2>$null | Out-String).Trim()
}

function Ensure-GitIdentity {
    param([Parameter(Mandatory = $true)][string]$Login)
    if ([string]::IsNullOrWhiteSpace((Get-GitConfigValue -Name 'user.name'))) { Invoke-Git 'config' 'user.name' $Login | Out-Null }
    if ([string]::IsNullOrWhiteSpace((Get-GitConfigValue -Name 'user.email'))) { Invoke-Git 'config' 'user.email' "$Login@users.noreply.github.com" | Out-Null }
}

function Assert-NoOversizedTrackedFiles {
    param([Parameter(Mandatory = $true)][string]$RepoRoot, [int64]$LimitBytes = 95MB)
    $raw = Invoke-Git 'ls-files' '-z' 2>$null
    foreach ($relative in ([string]$raw -split "`0" | Where-Object { $_ })) {
        $full = Join-Path $RepoRoot ($relative -replace '/', '\')
        if (Test-Path -LiteralPath $full -PathType Leaf) {
            $item = Get-Item -LiteralPath $full
            if ($item.Length -ge $LimitBytes) { throw "Tracked file exceeds the GitHub-safe size threshold: $relative" }
        }
    }
}

function Invoke-SecretScan {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot, [string[]]$ExpectedDeletionPath = @())
    $scanner = Join-Path $RepositoryRoot '.tools\scan-secrets.ps1'
    if (-not (Test-Path -LiteralPath $scanner -PathType Leaf)) { throw "Secret scanner not found: $scanner" }
    & $scanner -FailOnFindings -ExpectedDeletionPath $ExpectedDeletionPath -AsJson | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Secret scan failed; nothing was staged.' }
}

function Get-BranchSyncState {
    param([Parameter(Mandatory = $true)][string]$Branch)
    $stateScript = Join-Path $repoRoot '.tools\git-state.ps1'
    $result = ConvertFrom-BoundedStrictJsonText -Text ((& $stateScript -RepositoryRoot $repoRoot -Branch $Branch -RemoteName 'origin' -AsJson | Out-String).Trim()) -MaxUtf8Bytes 1048576 -Label 'gknome Git state'
    return [string]$result.status
}

function Get-RemoteBranchSha {
    param(
        [Parameter(Mandatory = $true)][string]$RemoteName,
        [Parameter(Mandatory = $true)][string]$Branch
    )

    $raw = (Invoke-Git 'ls-remote' '--refs' $RemoteName ("refs/heads/{0}" -f $Branch) 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect remote branch '$RemoteName/$Branch'." }
    if ([string]::IsNullOrWhiteSpace($raw)) { return '' }
    $parts = @($raw -split '\s+')
    if ($parts.Count -ne 2 -or $parts[1] -cne ("refs/heads/{0}" -f $Branch) -or $parts[0] -notmatch '^[0-9a-fA-F]{40,64}$') {
        throw "Remote branch inspection returned an unexpected ref for '$RemoteName/$Branch'."
    }
    return $parts[0].ToLowerInvariant()
}

function Get-EffectivePushDestinations {
    param([Parameter(Mandatory = $true)][string]$RemoteName)

    $raw = @(Invoke-Git 'remote' 'get-url' '--push' '--all' $RemoteName 2>$null)
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect effective push destinations for '$RemoteName'." }
    $destinations = @($raw | ForEach-Object { [string]$_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($destinations.Count -ne 1) {
        throw "Remote '$RemoteName' must resolve to exactly one effective push destination; found $($destinations.Count)."
    }
    return [string]$destinations[0]
}

function Assert-ReviewedPushDestination {
    param(
        [Parameter(Mandatory = $true)][string]$RemoteName,
        [Parameter(Mandatory = $true)][string]$ReviewedRemote
    )

    $reviewedIdentity = Get-GitHubRemoteIdentity -Remote $ReviewedRemote
    $destination = Get-EffectivePushDestinations -RemoteName $RemoteName
    try { $destinationIdentity = Get-GitHubRemoteIdentity -Remote $destination }
    catch { throw "Effective push destination is not a clean GitHub repository: $destination" }
    if ([string]$destinationIdentity.full_name -ine [string]$reviewedIdentity.full_name) {
        throw "Effective push destination does not match reviewed repository '$($reviewedIdentity.full_name)': $destination"
    }
    return [pscustomobject][ordered]@{
        destination = $destination
        identity = [string]$destinationIdentity.full_name
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$secretScannerPath = Join-Path $repoRoot '.tools\scan-secrets.ps1'
$secretCorePath = Join-Path $PSScriptRoot 'secret-scan-core.ps1'
$secretHistoryPath = Join-Path $PSScriptRoot 'scan-secrets-history.ps1'
if (-not (Test-Path -LiteralPath $secretCorePath -PathType Leaf)) { throw "Secret scan core is missing: $secretCorePath" }
if (-not (Test-Path -LiteralPath $secretHistoryPath -PathType Leaf)) { throw "Secret history scanner is missing: $secretHistoryPath" }
. $secretCorePath
. $secretHistoryPath
$callerLocation = Get-Location
try {
Set-Location -LiteralPath $repoRoot
$script:GitSafeDirectory = $repoRoot
$publishPaths = @(Resolve-PublishPaths -RepoRoot $repoRoot -RequestedPaths $Path)
if ($publishPaths.Count -eq 0 -and -not [string]::IsNullOrWhiteSpace($Message)) {
    throw '-Message requires at least one explicit repository-relative -Path. No files were staged.'
}
$publishPathspecs = @($publishPaths | ForEach-Object { [string]$_.pathspec })

if ($CommitOnly) {
    if ($publishPaths.Count -eq 0) { throw '-CommitOnly requires an explicit -Path allowlist.' }
    if ([string]::IsNullOrWhiteSpace($Message)) { throw '-CommitOnly requires an explicit -Message.' }
    if ($CreateRemote) { throw '-CommitOnly cannot create or modify a remote.' }
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot '.git'))) { throw 'A Git repository is required; this helper will not initialize one implicitly.' }
    $branch = (Invoke-Git 'branch' '--show-current' 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($branch) -or $branch -eq 'HEAD') { throw 'A named branch is required; detached HEAD commits are refused.' }
    if ($branch -cne 'main') { throw "Candidate commits are restricted to main; current branch is '$branch'." }

    $expectedDeletionPaths = @($publishPaths | Where-Object {
            -not (Test-Path -LiteralPath (Join-Path $repoRoot ([string]$_.relative).Replace('/', '\')))
    } | ForEach-Object { [string]$_.relative })
    Invoke-SecretScan -RepositoryRoot $repoRoot -ExpectedDeletionPath $expectedDeletionPaths
    Write-Host 'Selected local candidate paths:'
    foreach ($publishPath in $publishPaths) { Write-Host "  $($publishPath.relative)" }
    Confirm-OrExit -Prompt 'Proceed with the selected-path local commit only? No remote or credential will be accessed.' -Expected 'YES'

    Ensure-GitIdentity -Login 'gknome-operator'
    $stageArguments = @('add', '--all', '--') + $publishPathspecs
    Invoke-Git @stageArguments | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Selected-path staging failed; no commit was created.' }
    Assert-NoOversizedTrackedFiles -RepoRoot $repoRoot
    $statusArguments = @('status', '--porcelain', '--') + $publishPathspecs
    $pending = (Invoke-Git @statusArguments | Out-String).Trim()
    if (-not [string]::IsNullOrWhiteSpace($pending)) {
        $commitArguments = @('commit', '--only', '-m', $Message, '--') + $publishPathspecs
        Invoke-Git @commitArguments
        if ($LASTEXITCODE -ne 0) { throw 'Selected-path local commit failed. Fix errors above and retry.' }
        Write-Host ("Created local main candidate {0}. No remote or credential was accessed." -f ((Invoke-Git 'rev-parse' 'HEAD' 2>$null | Out-String).Trim()))
    }
    else {
        Write-Host 'No selected-path changes required a local commit. No remote or credential was accessed.'
    }
    return
}

$project = Read-JsonFile -Path (Join-Path $repoRoot '.tools\project.json')
$secretDirectory = if ($project -and $project.paths -and $project.paths.secrets_dir) { [string]$project.paths.secrets_dir } else { '.tools\secrets' }
$tokenInfo = Resolve-TokenInfo -RepoRoot $repoRoot -SecretsDir $secretDirectory -TokenFile 'gt.txt'
$configuredRemote = if ($project -and $project.git -and $project.git.remote) { [string]$project.git.remote } else { '' }
if ([string]::IsNullOrWhiteSpace($Remote)) { $Remote = $configuredRemote }
$originalGitEnvironment = @{}
foreach ($name in @('GIT_TERMINAL_PROMPT', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0')) {
    $originalGitEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot '.git'))) { throw 'A Git repository is required; this helper will not initialize one implicitly.' }
    $token = Read-FirstLine -Path $tokenInfo.path
    $branch = (Invoke-Git 'branch' '--show-current' 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($branch) -or $branch -eq 'HEAD') { throw 'A named branch is required; detached HEAD pushes are refused.' }
    if ($branch -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$' -or $branch -match '[\s]') { throw "Unsafe branch name: $branch" }
    if ($branch -cne 'main') { throw "Publication is restricted to main; current branch is '$branch'." }
    Assert-GitHubRemote -Remote $Remote

    $origin = (Invoke-Git 'remote' 'get-url' 'origin' 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($origin) -and -not $CreateRemote) {
        throw 'No origin is configured. Pass -CreateRemote to create or verify the reviewed GitHub repository and add origin.'
    }
    if (-not [string]::IsNullOrWhiteSpace($origin) -and $origin -ne $Remote) {
        throw "Configured origin does not match requested remote. Review it manually before retrying: $origin"
    }
    $reviewedPushDestination = $null
    if (-not [string]::IsNullOrWhiteSpace($origin)) {
        $reviewedPushDestination = Assert-ReviewedPushDestination -RemoteName 'origin' -ReviewedRemote $Remote
    }

    $expectedDeletionPaths = @($publishPaths | Where-Object {
            -not (Test-Path -LiteralPath (Join-Path $repoRoot ([string]$_.relative).Replace('/', '\')))
        } | ForEach-Object { [string]$_.relative })
    Invoke-SecretScan -RepositoryRoot $repoRoot -ExpectedDeletionPath $expectedDeletionPaths
    $ignored = (Invoke-Git 'check-ignore' '--no-index' '--' $tokenInfo.relative 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($ignored)) { throw "Token path is not ignored by Git: $($tokenInfo.relative)" }
    $trackedToken = (Invoke-Git 'ls-files' '--' $tokenInfo.relative 2>$null | Out-String).Trim()
    if (-not [string]::IsNullOrWhiteSpace($trackedToken)) { throw "Token path is already tracked; remove it from Git history manually: $($tokenInfo.relative)" }

    if ($publishPaths.Count -gt 0) {
        Write-Host 'Selected commit paths:'
        foreach ($publishPath in $publishPaths) { Write-Host "  $($publishPath.relative)" }
        Confirm-OrExit -Prompt 'Proceed with the selected-path Git commit/sync/push?' -Expected 'YES'
    }
    else {
        Write-Host 'No -Path was supplied. Index and working-tree changes will remain untouched.'
        Confirm-OrExit -Prompt 'Proceed with push of already-committed main only?' -Expected 'YES'
    }

    $pair = "x-access-token:$token"
    $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
    $env:GIT_TERMINAL_PROMPT = '0'
    $env:GIT_CONFIG_COUNT = '1'
    $env:GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader'
    $env:GIT_CONFIG_VALUE_0 = "Authorization: Basic $basic"

    $repositoryResult = Ensure-GitHubRepository -Remote $Remote -Token $token -CreateIfMissing:$CreateRemote -Visibility $Visibility
    if ([string]::IsNullOrWhiteSpace($origin)) {
        Invoke-Git 'remote' 'add' 'origin' $Remote | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "GitHub repository $($repositoryResult.owner)/$($repositoryResult.repository) is available, but adding local origin failed. Add the reviewed remote manually and retry."
        }
        $reviewedPushDestination = Assert-ReviewedPushDestination -RemoteName 'origin' -ReviewedRemote $Remote
    }
    if ([string]$repositoryResult.status -eq 'created') {
        Write-Host "Created $Visibility GitHub repository $($repositoryResult.owner)/$($repositoryResult.repository)."
    }

    Ensure-GitIdentity -Login 'gknome-operator'
    Invoke-Git 'fetch' 'origin' '--prune' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Fetch failed; nothing was staged, committed, or pushed.' }
    $remoteMainSha = Get-RemoteBranchSha -RemoteName 'origin' -Branch $branch
    $trackingMainSha = Get-SecretHistoryRefSha -RepositoryRoot $repoRoot -Ref 'origin/main'
    if ([string]::IsNullOrWhiteSpace($remoteMainSha)) {
        if (-not [string]::IsNullOrWhiteSpace($trackingMainSha)) { throw 'Remote main is absent but the local origin/main tracking ref is stale.' }
    }
    elseif ($trackingMainSha -cne $remoteMainSha) {
        throw 'The local origin/main tracking ref does not match the reviewed remote main.'
    }
    $syncState = Get-BranchSyncState -Branch $branch
    if ($syncState -in @('behind', 'diverged')) {
        throw "Remote branch is $syncState relative to local '$branch'. Pull/review manually; this helper will not merge or choose a conflict winner."
    }

    $didCommit = $false
    if ($publishPaths.Count -gt 0) {
        $stageArguments = @('add', '--all', '--') + $publishPathspecs
        Invoke-Git @stageArguments | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Selected-path staging failed; nothing was committed or pushed.' }
    }
    Assert-NoOversizedTrackedFiles -RepoRoot $repoRoot
    if ($publishPaths.Count -gt 0) {
        $statusArguments = @('status', '--porcelain', '--') + $publishPathspecs
        $pending = (Invoke-Git @statusArguments | Out-String).Trim()
        if (-not [string]::IsNullOrWhiteSpace($pending)) {
            if ([string]::IsNullOrWhiteSpace($Message)) { $Message = "chore: update $(Get-Date -Format s)" }
            $commitArguments = @('commit', '--only', '-m', $Message, '--') + $publishPathspecs
            Invoke-Git @commitArguments
            if ($LASTEXITCODE -ne 0) { throw 'Selected-path commit failed. Fix errors above and retry.' }
            $didCommit = $true
        }
    }

    $candidateSha = (Invoke-Git 'rev-parse' 'HEAD' 2>$null | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($candidateSha)) { throw 'Could not resolve the local main candidate for outgoing-history scanning.' }
    $upstreamSha = Get-SecretHistoryRefSha -RepositoryRoot $repoRoot -Ref 'origin/main'
    $historyScan = Assert-NoOutgoingHistorySecrets -RepositoryRoot $repoRoot -CandidateSha $candidateSha -UpstreamSha $upstreamSha -PolicyPaths @($secretScannerPath, $secretCorePath, $secretHistoryPath, $PSCommandPath)
    if ([string]$historyScan.status -ne 'pass') { throw "Outgoing history secret scan found $($historyScan.findings_count) finding(s); nothing was pushed." }

    if (-not [string]::IsNullOrWhiteSpace([string]$env:GKNOME_TEST_GITPUSH_DESTINATION_MUTATION)) {
        Invoke-Git 'config' '--add' 'remote.origin.pushurl' ([string]$env:GKNOME_TEST_GITPUSH_DESTINATION_MUTATION) | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Git push destination mutation fixture could not update the remote configuration.' }
    }

    $candidateAfterScan = (Invoke-Git 'rev-parse' 'HEAD' 2>$null | Out-String).Trim()
    $pushDestinationAfterScan = Assert-ReviewedPushDestination -RemoteName 'origin' -ReviewedRemote $Remote
    $remoteAfterScan = Get-RemoteBranchSha -RemoteName 'origin' -Branch $branch
    $policyAfterScan = Get-SecretHistoryPolicyFingerprint -PolicyPaths @($secretScannerPath, $secretCorePath, $secretHistoryPath, $PSCommandPath)
    if ($candidateAfterScan -cne $candidateSha) { throw 'The inspected main candidate changed before publication; nothing was pushed.' }
    if ([string]$pushDestinationAfterScan.destination -cne [string]$reviewedPushDestination.destination -or [string]$pushDestinationAfterScan.identity -ine [string]$reviewedPushDestination.identity) { throw 'The reviewed effective push destination changed before publication; nothing was pushed.' }
    if ($remoteAfterScan -cne $remoteMainSha) { throw 'The reviewed remote main changed before publication; nothing was pushed.' }
    if ($policyAfterScan -cne [string]$historyScan.policy_fingerprint) { throw 'The reviewed secret policy changed before publication; nothing was pushed.' }

    $syncMessage = if ($didCommit) { $Message } elseif ($publishPaths.Count -gt 0) { 'no selected-path changes' } else { 'already-committed main only' }
    Invoke-Git 'push' '--no-follow-tags' '--recurse-submodules=no' ([string]$reviewedPushDestination.destination) ("{0}:refs/heads/{1}" -f $candidateSha, $branch)
    if ($LASTEXITCODE -ne 0) { throw 'Push failed. Remote state may have changed; inspect Git status and retry after review.' }
    try {
        $publishedSha = Get-RemoteBranchSha -RemoteName ([string]$reviewedPushDestination.destination) -Branch $branch
        if ($publishedSha -cne $candidateSha) { throw 'Remote main no longer matches the published candidate.' }
        $originAfterPush = (Invoke-Git 'remote' 'get-url' 'origin' 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or $originAfterPush -cne $Remote) { throw 'Origin changed after publication; tracking refs were not refreshed.' }
        # Pushing to the reviewed URL pins the destination but does not update
        # origin/main. Refresh it only after verifying the published ref.
        Invoke-Git 'fetch' 'origin' '--prune' | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'The post-push tracking-ref fetch failed.' }
        $trackingAfterPush = Get-SecretHistoryRefSha -RepositoryRoot $repoRoot -Ref ("origin/{0}" -f $branch)
        if ($trackingAfterPush -cne $candidateSha) { throw 'Origin tracking state differs from the published candidate.' }
    }
    catch {
        throw ("Push completed, but synchronization verification failed: {0} Inspect remote/main and local tracking state before another publication." -f $_.Exception.Message)
    }
    Write-Host "Pushed $branch to $($reviewedPushDestination.identity) ($syncMessage)."
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
