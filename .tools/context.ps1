#Requires -Version 5.1

<#
.SYNOPSIS
    Builds, verifies, and stages rebuilds from bounded project context packs.

.DESCRIPTION
    Uses summary_bank.json to select complete UTF-8 text files, emits a readable
    length-delimited pack with unique markers, verifies hashes, and rebuilds only
    into an ignored staging directory unless explicit apply controls are used.
#>

[CmdletBinding()]
param(
    [ValidateSet('Status', 'List', 'Audit', 'Build', 'BuildFull', 'Verify', 'Rebuild', 'Clean')]
    [string]$Mode = 'Status',

    [string[]]$Group = @(),

    [string]$BankPath = '',

    [string]$OutputPath = '',

    [string]$PackPath = '',

    [string]$DestinationPath = '',

    [int]$BudgetKB = 0,

    [switch]$NoTree,

    [switch]$Apply,

    [switch]$Force,

    [switch]$Yes,

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

$script:RepoRoot = if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
else {
    [System.IO.Path]::GetFullPath($RepositoryRoot)
}
if (-not (Test-Path -LiteralPath $script:RepoRoot -PathType Container)) {
    throw "Repository root not found: $script:RepoRoot"
}
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$script:Utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$script:ContextSchema = 'gknome_context_pack_v1'
$script:FormatVersion = 1
$script:ContextPackBaseEstimateBytes = [int64]4096
$script:ContextPackBlockMetadataBytes = [int64]512

function Write-Utf8File {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Content
    )

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($Path, $Content, $script:Utf8NoBom)
}

function Invoke-ContextPublicationFault {
    param([Parameter(Mandatory = $true)][string]$Boundary)

    if ([string]$env:GKNOME_CONTEXT_FAULT_BOUNDARY -ne $Boundary) { return }
    if ([string]$env:GKNOME_CONTEXT_FAULT_ACTION -eq 'kill') {
        [System.Diagnostics.Process]::GetCurrentProcess().Kill()
        return
    }
    throw "Injected context publication fault at boundary: $Boundary"
}

function Get-ContextPublishTransactionRoot {
    param([Parameter(Mandatory = $true)][string]$PackPath)

    $packFull = [System.IO.Path]::GetFullPath($PackPath)
    $parent = Split-Path -Parent $packFull
    $key = Get-TextSha256 -Text $packFull.ToLowerInvariant()
    return (Join-Path $parent ('.gknome-context-publish-' + $key.Substring(0, 16)))
}

function Test-ContextFileHash {
    param([string]$Path, [string]$ExpectedHash)

    if ([string]::IsNullOrWhiteSpace($Path) -or [string]::IsNullOrWhiteSpace($ExpectedHash)) { return $false }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    return ((Get-FileSha256 -Path $Path) -eq $ExpectedHash)
}

function Install-ContextPublishedFile {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Target,
        [Parameter(Mandatory = $true)][string]$ExpectedHash
    )

    if (-not (Test-ContextFileHash -Path $Source -ExpectedHash $ExpectedHash)) {
        throw "Context publication source hash is invalid: $Source"
    }
    $parent = Split-Path -Parent $Target
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        New-Item -ItemType Directory -Path $parent -Force -ErrorAction Stop | Out-Null
    }
    $temporary = Join-Path $parent ('.gknome-context-swap-' + [guid]::NewGuid().ToString('N'))
    $replacedBackup = Join-Path $parent ('.gknome-context-replaced-' + [guid]::NewGuid().ToString('N'))
    try {
        [System.IO.File]::Copy($Source, $temporary, $false)
        if (Test-Path -LiteralPath $Target -PathType Leaf) {
            $targetItem = Get-Item -LiteralPath $Target -Force -ErrorAction Stop
            if (($targetItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Context publication target cannot be a reparse point: $Target"
            }
            [System.IO.File]::Replace($temporary, $Target, $replacedBackup, $true)
        }
        else {
            Move-Item -LiteralPath $temporary -Destination $Target -ErrorAction Stop
        }
        if (-not (Test-ContextFileHash -Path $Target -ExpectedHash $ExpectedHash)) {
            throw "Context publication target hash is invalid after replacement: $Target"
        }
    }
    finally {
        if (Test-Path -LiteralPath $temporary -PathType Leaf) {
            Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path -LiteralPath $replacedBackup -PathType Leaf) {
            Remove-Item -LiteralPath $replacedBackup -Force -ErrorAction SilentlyContinue
        }
    }
}

function Remove-ContextPublishTransaction {
    param([Parameter(Mandatory = $true)][string]$TransactionRoot)

    if (-not (Test-Path -LiteralPath $TransactionRoot -PathType Container)) { return }
    $item = Get-Item -LiteralPath $TransactionRoot -Force -ErrorAction Stop
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Context publication transaction cannot be a reparse point: $TransactionRoot"
    }
    Remove-Item -LiteralPath $TransactionRoot -Recurse -Force -ErrorAction Stop
}

function Recover-ContextPackPublication {
    param([Parameter(Mandatory = $true)][string]$PackPath)

    $packFull = [System.IO.Path]::GetFullPath($PackPath)
    $manifestFull = $packFull + '.manifest.json'
    $transactionRoot = Get-ContextPublishTransactionRoot -PackPath $packFull
    if (-not (Test-Path -LiteralPath $transactionRoot -PathType Container)) { return $false }
    $transactionItem = Get-Item -LiteralPath $transactionRoot -Force -ErrorAction Stop
    if (($transactionItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Context publication recovery refused a reparse transaction: $transactionRoot"
    }
    $journalPath = Join-Path $transactionRoot 'journal.json'
    if (-not (Test-Path -LiteralPath $journalPath -PathType Leaf)) {
        throw "Context publication recovery journal is missing: $journalPath"
    }
    $journal = Read-StrictJsonFile -Path $journalPath -MaxBytes 65536
    if ([string](Get-PropertyValue -Object $journal -Name 'schema' -Default '') -ne 'gknome_context_publish_journal_v1') {
        throw 'Context publication recovery journal schema is unsupported.'
    }
    if ([string](Get-PropertyValue -Object $journal -Name 'pack_path' -Default '') -ne $packFull -or
        [string](Get-PropertyValue -Object $journal -Name 'manifest_path' -Default '') -ne $manifestFull) {
        throw 'Context publication recovery journal does not own the requested output pair.'
    }

    $stagedPack = Join-Path $transactionRoot 'new.pack'
    $stagedManifest = Join-Path $transactionRoot 'new.manifest.json'
    $backupPack = Join-Path $transactionRoot 'old.pack'
    $backupManifest = Join-Path $transactionRoot 'old.manifest.json'
    $newPackHash = [string](Get-PropertyValue -Object $journal -Name 'new_pack_sha256' -Default '')
    $newManifestHash = [string](Get-PropertyValue -Object $journal -Name 'new_manifest_sha256' -Default '')
    $oldPackPresent = [bool](Get-PropertyValue -Object $journal -Name 'old_pack_present' -Default $false)
    $oldManifestPresent = [bool](Get-PropertyValue -Object $journal -Name 'old_manifest_present' -Default $false)
    $oldPackHash = [string](Get-PropertyValue -Object $journal -Name 'old_pack_sha256' -Default '')
    $oldManifestHash = [string](Get-PropertyValue -Object $journal -Name 'old_manifest_sha256' -Default '')

    if ((Test-ContextFileHash -Path $stagedPack -ExpectedHash $newPackHash) -and
        (Test-ContextFileHash -Path $stagedManifest -ExpectedHash $newManifestHash)) {
        Install-ContextPublishedFile -Source $stagedPack -Target $packFull -ExpectedHash $newPackHash
        Install-ContextPublishedFile -Source $stagedManifest -Target $manifestFull -ExpectedHash $newManifestHash
        Remove-ContextPublishTransaction -TransactionRoot $transactionRoot
        return $true
    }

    if ($oldPackPresent -and $oldManifestPresent) {
        $oldPackSource = if (Test-ContextFileHash -Path $backupPack -ExpectedHash $oldPackHash) { $backupPack } elseif (Test-ContextFileHash -Path $packFull -ExpectedHash $oldPackHash) { $packFull } else { '' }
        $oldManifestSource = if (Test-ContextFileHash -Path $backupManifest -ExpectedHash $oldManifestHash) { $backupManifest } elseif (Test-ContextFileHash -Path $manifestFull -ExpectedHash $oldManifestHash) { $manifestFull } else { '' }
        if ($oldPackSource -and $oldManifestSource) {
            if ($oldPackSource -ne $packFull) { Install-ContextPublishedFile -Source $oldPackSource -Target $packFull -ExpectedHash $oldPackHash }
            if ($oldManifestSource -ne $manifestFull) { Install-ContextPublishedFile -Source $oldManifestSource -Target $manifestFull -ExpectedHash $oldManifestHash }
            Remove-ContextPublishTransaction -TransactionRoot $transactionRoot
            return $true
        }
    }

    if (-not $oldPackPresent -and -not $oldManifestPresent -and
        -not (Test-Path -LiteralPath $packFull) -and -not (Test-Path -LiteralPath $manifestFull)) {
        Remove-ContextPublishTransaction -TransactionRoot $transactionRoot
        return $true
    }
    throw "Context publication recovery cannot prove either the previous or replacement pair. Recovery data remains at $transactionRoot"
}

function Publish-ContextPackPair {
    param(
        [Parameter(Mandatory = $true)][string]$PackPath,
        [Parameter(Mandatory = $true)][string]$PackContent,
        [Parameter(Mandatory = $true)][string]$ManifestContent
    )

    $packFull = [System.IO.Path]::GetFullPath($PackPath)
    $manifestFull = $packFull + '.manifest.json'
    [void](Recover-ContextPackPublication -PackPath $packFull)
    $packPresent = Test-Path -LiteralPath $packFull -PathType Leaf
    $manifestPresent = Test-Path -LiteralPath $manifestFull -PathType Leaf
    if ($packPresent -ne $manifestPresent) {
        throw 'Context publication refused an existing unpaired pack or manifest.'
    }
    if ($packPresent) {
        $existingPack = Read-ContextPack -Path $packFull
        $existingManifest = Read-StrictJsonFile -Path $manifestFull -MaxBytes 1048576
        if ([string](Get-PropertyValue -Object (Get-PropertyValue -Object $existingManifest -Name 'pack') -Name 'pack_id' -Default '') -ne [string]$existingPack.pack_id -or
            [string](Get-PropertyValue -Object $existingManifest -Name 'pack_sha256' -Default '') -ne [string]$existingPack.pack_sha256) {
            throw 'Context publication refused to replace an unverified existing pair.'
        }
    }

    $transactionRoot = Get-ContextPublishTransactionRoot -PackPath $packFull
    if (Test-Path -LiteralPath $transactionRoot) {
        throw "Context publication transaction already exists after recovery: $transactionRoot"
    }
    New-Item -ItemType Directory -Path $transactionRoot -ErrorAction Stop | Out-Null
    $stagedPack = Join-Path $transactionRoot 'new.pack'
    $stagedManifest = Join-Path $transactionRoot 'new.manifest.json'
    $newPackHash = Get-Sha256HexFromBytes -Bytes $script:Utf8NoBom.GetBytes($PackContent)
    $newManifestHash = Get-Sha256HexFromBytes -Bytes $script:Utf8NoBom.GetBytes($ManifestContent)
    $journal = [pscustomobject][ordered]@{
        schema = 'gknome_context_publish_journal_v1'
        pack_path = $packFull
        manifest_path = $manifestFull
        new_pack_sha256 = $newPackHash
        new_manifest_sha256 = $newManifestHash
        old_pack_present = $packPresent
        old_manifest_present = $manifestPresent
        old_pack_sha256 = if ($packPresent) { Get-FileSha256 -Path $packFull } else { '' }
        old_manifest_sha256 = if ($manifestPresent) { Get-FileSha256 -Path $manifestFull } else { '' }
    }
    Write-Utf8File -Path (Join-Path $transactionRoot 'journal.json') -Content ($journal | ConvertTo-Json -Depth 6)
    Invoke-ContextPublicationFault -Boundary 'journal'
    Write-Utf8File -Path $stagedPack -Content $PackContent
    Invoke-ContextPublicationFault -Boundary 'pack-staged'
    Write-Utf8File -Path $stagedManifest -Content $ManifestContent
    Invoke-ContextPublicationFault -Boundary 'manifest-staged'
    if ($packPresent) {
        [System.IO.File]::Copy($packFull, (Join-Path $transactionRoot 'old.pack'), $false)
        Invoke-ContextPublicationFault -Boundary 'pack-backed-up'
        [System.IO.File]::Copy($manifestFull, (Join-Path $transactionRoot 'old.manifest.json'), $false)
        Invoke-ContextPublicationFault -Boundary 'manifest-backed-up'
    }
    Install-ContextPublishedFile -Source $stagedPack -Target $packFull -ExpectedHash $newPackHash
    Invoke-ContextPublicationFault -Boundary 'pack-published'
    Install-ContextPublishedFile -Source $stagedManifest -Target $manifestFull -ExpectedHash $newManifestHash
    Invoke-ContextPublicationFault -Boundary 'manifest-published'
    Remove-ContextPublishTransaction -TransactionRoot $transactionRoot
}

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "JSON file not found: $Path"
    }
    return Read-StrictJsonFile -Path $Path -MaxBytes 1048576
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

function Get-NormalizedAbsolutePath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$BasePath = ''
    )

    $candidate = [Environment]::ExpandEnvironmentVariables($Path.Trim())
    if ([string]::IsNullOrWhiteSpace($candidate)) { throw 'Path cannot be empty.' }
    if (-not [System.IO.Path]::IsPathRooted($candidate)) {
        $base = $BasePath
        if ([string]::IsNullOrWhiteSpace($base)) { $base = $script:RepoRoot }
        $candidate = Join-Path $base $candidate
    }
    return [System.IO.Path]::GetFullPath($candidate)
}

function Get-RelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $pathFull = [System.IO.Path]::GetFullPath($Path)
    $prefix = $rootFull + [System.IO.Path]::DirectorySeparatorChar
    if (-not $pathFull.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside the expected root: $pathFull"
    }
    return $pathFull.Substring($prefix.Length).Replace('\', '/')
}

function Assert-SafeRelativePath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $normalized = $RelativePath.Replace('\', '/').Trim()
    if ([string]::IsNullOrWhiteSpace($normalized)) { throw 'Context path cannot be empty.' }
    if ([System.IO.Path]::IsPathRooted($normalized)) { throw "Context path must be relative: $normalized" }
    if ($normalized -match '^[A-Za-z]:') { throw "Context path must not contain a drive prefix: $normalized" }
    if ($normalized -match '[\x00-\x1F]') { throw "Context path contains control characters: $normalized" }

    $segments = @($normalized -split '/')
    foreach ($segment in $segments) {
        if ([string]::IsNullOrWhiteSpace($segment) -or $segment -eq '.' -or $segment -eq '..') {
            throw "Context path contains an unsafe segment: $normalized"
        }
        if ($segment -in @('.git', '.secrets')) {
            throw "Context path targets a forbidden directory: $normalized"
        }
    }
    if ($normalized.StartsWith('.tools/.secrets/', [System.StringComparison]::OrdinalIgnoreCase) -or
        $normalized.Equals('.tools/.secrets', [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Context path targets the local secret store: $normalized"
    }
    if ($normalized.StartsWith('.tools/secrets/', [System.StringComparison]::OrdinalIgnoreCase) -or
        $normalized.Equals('.tools/secrets', [System.StringComparison]::OrdinalIgnoreCase) -or
        $normalized.StartsWith('.tools/local/', [System.StringComparison]::OrdinalIgnoreCase) -or
        $normalized.Equals('.tools/local', [System.StringComparison]::OrdinalIgnoreCase) -or
        $normalized.StartsWith('.agents/local/', [System.StringComparison]::OrdinalIgnoreCase) -or
        $normalized.Equals('.agents/local', [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Context path targets an operator-local store: $normalized"
    }
    $leaf = [System.IO.Path]::GetFileName($normalized)
    if ($leaf -match '^\.env(?:\.|$)' -and $leaf -notmatch '^\.env\.example$') {
        throw "Context path targets an environment secret file: $normalized"
    }
    if ($leaf -match '(?i)\.(pem|key|pfx|p12|kdbx|token|secret)$') {
        throw "Context path targets a key or secret container: $normalized"
    }
    if ($leaf -match '(?i)^(gt\.txt|\.npmrc|\.pypirc|\.netrc|_netrc|id_rsa(?:\..*)?|id_ed25519(?:\..*)?)$') {
        throw "Context path targets a credential file: $normalized"
    }
    return $normalized
}

function Test-BlockedCandidatePath {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [string[]]$SkipDirectories = @()
    )

    $normalized = $RelativePath.Replace('\', '/').TrimStart('/')
    $hardBlocked = @(
        '.git',
        '.artifacts',
        '.agents/local',
        '.runtime',
        '.secrets',
        '.tools/.secrets',
        '.tools/local',
        '.tools/secrets',
        '.venv',
        'venv',
        '__pycache__',
        'node_modules',
        'runtime-data',
        'output',
        'logs',
        'dist',
        'build',
        'release',
        'target',
        'coverage',
        'test-results',
        'playwright-report'
    )
    $blocked = @($hardBlocked + $SkipDirectories | Sort-Object -Unique)
    if ($normalized -match '^\.tools/release(?:/|$)') {
        $blocked = @($blocked | Where-Object { $_ -ne 'release' })
    }
    $pathSegments = @($normalized -split '/')
    foreach ($entry in $blocked) {
        $candidate = ([string]$entry).Replace('\', '/').Trim('/')
        if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
        if ($candidate.Contains('/')) {
            if ($normalized.Equals($candidate, [System.StringComparison]::OrdinalIgnoreCase) -or
                $normalized.StartsWith($candidate + '/', [System.StringComparison]::OrdinalIgnoreCase) -or
                $normalized.IndexOf('/' + $candidate + '/', [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                return $true
            }
        }
        else {
            foreach ($segment in $pathSegments) {
                if ($segment.Equals($candidate, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
            }
        }
    }

    $leaf = [System.IO.Path]::GetFileName($normalized)
    if ($leaf -match '^\.env(?:\.|$)' -and $leaf -notmatch '^\.env\.example$') { return $true }
    if ($leaf -match '(?i)\.(pem|key|pfx|p12|kdbx|token|secret)$') { return $true }
    if ($leaf -match '(?i)^(gt\.txt|\.npmrc|\.pypirc|\.netrc|_netrc|id_rsa(?:\..*)?|id_ed25519(?:\..*)?)$') { return $true }
    if ($leaf -in @('_struct_summary.txt', '_structure_with_content.txt')) { return $true }
    return $false
}

function Get-Sha256HexFromBytes {
    param([Parameter(Mandatory = $true)][byte[]]$Bytes)

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return (($sha.ComputeHash($Bytes) | ForEach-Object { $_.ToString('x2') }) -join '')
    }
    finally {
        $sha.Dispose()
    }
}

function Get-TextSha256 {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    return Get-Sha256HexFromBytes -Bytes $script:Utf8NoBom.GetBytes($Text)
}

function Get-FileSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)

    $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return (($sha.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') }) -join '')
    }
    finally {
        $sha.Dispose()
        $stream.Dispose()
    }
}

function Get-ProjectConfiguration {
    $path = Join-Path $script:RepoRoot '.tools\project.json'
    return Read-JsonFile -Path $path
}

function Resolve-BankPath {
    param([string]$RequestedPath)

    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        return Get-NormalizedAbsolutePath -Path $RequestedPath -BasePath $script:RepoRoot
    }
    $config = Get-ProjectConfiguration
    $paths = Get-PropertyValue -Object $config -Name 'paths'
    $configured = [string](Get-PropertyValue -Object $paths -Name 'context_bank' -Default 'summary_bank.json')
    return Get-NormalizedAbsolutePath -Path $configured -BasePath $script:RepoRoot
}

function Resolve-DefaultPackPath {
    param([string]$RequestedPath)

    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        return Get-NormalizedAbsolutePath -Path $RequestedPath -BasePath $script:RepoRoot
    }
    return Join-Path $script:RepoRoot '.artifacts\context\context-pack.txt'
}

function Resolve-TextSettings {
    param([object]$Config)

    $context = Get-PropertyValue -Object $Config -Name 'context'
    $extensions = @()
    foreach ($raw in @(Get-PropertyValue -Object $context -Name 'text_extensions' -Default @())) {
        $extension = ([string]$raw).Trim().ToLowerInvariant()
        if (-not $extension.StartsWith('.')) { $extension = '.' + $extension }
        if ($extension -and $extensions -notcontains $extension) { $extensions += $extension }
    }
    if ($extensions.Count -eq 0) {
        $extensions = @('.md', '.txt', '.json', '.ps1', '.psm1', '.sh', '.cmd', '.bat', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.html', '.css', '.rs', '.gml')
    }

    $names = @()
    foreach ($rawName in @(Get-PropertyValue -Object $context -Name 'text_file_names' -Default @())) {
        $name = ([string]$rawName).Trim()
        if ($name -and $names -notcontains $name) { $names += $name }
    }
    if ($names.Count -eq 0) { $names = @('.gitignore', '.gitattributes', 'Cargo.lock', 'LICENSE') }

    $maxBytes = [int64](Get-PropertyValue -Object $context -Name 'max_file_bytes' -Default 1048576)
    if ($maxBytes -lt 1024) { $maxBytes = 1024 }
    return [pscustomobject]@{
        extensions = $extensions
        file_names = $names
        max_file_bytes = $maxBytes
    }
}

function Test-TextCandidate {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Settings
    )

    $name = [System.IO.Path]::GetFileName($Path)
    if ($Settings.file_names -contains $name) { return $true }
    $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    return ($Settings.extensions -contains $extension)
}

function Get-RepositoryHead {
    $result = [ordered]@{
        commit = $null
        dirty = $null
    }
    if (-not (Test-Path -LiteralPath (Join-Path $script:RepoRoot '.git'))) {
        return [pscustomobject]$result
    }
    if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) {
        return [pscustomobject]$result
    }

    $head = @()
    $status = @()
    $headExitCode = 1
    $statusExitCode = 1
    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $head = @(& git -c ("safe.directory=$script:RepoRoot") -c 'core.excludesFile=' -C $script:RepoRoot rev-parse HEAD 2>$null)
        $headExitCode = $LASTEXITCODE
        $status = @(& git -c ("safe.directory=$script:RepoRoot") -c 'core.excludesFile=' -C $script:RepoRoot status --porcelain 2>$null)
        $statusExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($headExitCode -eq 0 -and $head.Count -gt 0) {
        $result.commit = ([string]$head[0]).Trim()
    }
    if ($statusExitCode -eq 0) {
        $result.dirty = ($status.Count -gt 0)
    }
    return [pscustomobject]$result
}

function Get-CandidateRelativePaths {
    param(
        [Parameter(Mandatory = $true)]$Settings,
        [string[]]$SkipDirectories = @()
    )

    $relativePaths = New-Object System.Collections.Generic.List[string]
    $usedGit = $false
    if ((Test-Path -LiteralPath (Join-Path $script:RepoRoot '.git')) -and $null -ne (Get-Command git -ErrorAction SilentlyContinue)) {
        $gitPaths = @()
        $gitExitCode = 1
        $previousErrorAction = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $gitPaths = @(& git -c ("safe.directory=$script:RepoRoot") -c 'core.excludesFile=' -C $script:RepoRoot ls-files -co --exclude-standard 2>$null)
            $gitExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorAction
        }
        if ($gitExitCode -eq 0) {
            $usedGit = $true
            foreach ($raw in $gitPaths) {
                $candidate = ([string]$raw).Trim().Replace('\', '/')
                if ($candidate) { $relativePaths.Add($candidate) }
            }
        }
    }

    if (-not $usedGit) {
        $pendingDirectories = New-Object System.Collections.Generic.Stack[string]
        $pendingDirectories.Push($script:RepoRoot)
        while ($pendingDirectories.Count -gt 0) {
            $currentDirectory = $pendingDirectories.Pop()
            $currentItem = Get-Item -LiteralPath $currentDirectory -Force -ErrorAction Stop
            if (($currentItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }

            foreach ($entry in @(Get-ChildItem -LiteralPath $currentDirectory -Force -ErrorAction Stop)) {
                $relative = Get-RelativePath -Root $script:RepoRoot -Path $entry.FullName
                if ($entry.PSIsContainer) {
                    # Decide from parent-visible metadata before touching the child. This
                    # keeps secret/configured skip trees and reparse-backed directories
                    # out of enumeration even when their contents are unreadable.
                    if (Test-BlockedCandidatePath -RelativePath $relative -SkipDirectories $SkipDirectories) { continue }
                    if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
                    $pendingDirectories.Push($entry.FullName)
                    continue
                }
                $relativePaths.Add($relative)
            }
        }
    }

    $accepted = New-Object System.Collections.Generic.List[string]
    foreach ($relative in @($relativePaths | Sort-Object -Unique)) {
        if (Test-BlockedCandidatePath -RelativePath $relative -SkipDirectories $SkipDirectories) { continue }
        $full = Get-NormalizedAbsolutePath -Path $relative -BasePath $script:RepoRoot
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { continue }
        $item = Get-Item -LiteralPath $full -Force
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
        if ($item.Length -gt $Settings.max_file_bytes) { continue }
        if (-not (Test-TextCandidate -Path $full -Settings $Settings)) { continue }
        $accepted.Add($relative.Replace('\', '/'))
    }
    return @($accepted | Sort-Object -Unique)
}

function Get-GroupNames {
    param([object]$Bank)

    $groups = Get-PropertyValue -Object $Bank -Name 'groups'
    if ($null -eq $groups) { return @() }
    return @($groups.PSObject.Properties | ForEach-Object { $_.Name } | Sort-Object)
}

function Resolve-SelectedGroups {
    param(
        [object]$Bank,
        [string[]]$RequestedGroups
    )

    $selected = @($RequestedGroups | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($selected.Count -eq 0) {
        $defaults = Get-PropertyValue -Object $Bank -Name 'defaults'
        $selected = @(Get-PropertyValue -Object $defaults -Name 'groups' -Default @())
    }
    $available = Get-GroupNames -Bank $Bank
    foreach ($groupName in $selected) {
        if ($available -notcontains $groupName) {
            throw "Context group not found: $groupName"
        }
    }
    return @($selected | Sort-Object -Unique)
}

function Get-GroupPatterns {
    param(
        [object]$Bank,
        [string[]]$SelectedGroups
    )

    $patterns = New-Object System.Collections.Generic.List[string]
    $groups = Get-PropertyValue -Object $Bank -Name 'groups'
    foreach ($groupName in $SelectedGroups) {
        $groupProperty = $groups.PSObject.Properties[$groupName]
        if ($null -eq $groupProperty) { continue }
        $groupObject = $groupProperty.Value
        $paths = Get-PropertyValue -Object $groupObject -Name 'paths'
        if ($null -eq $paths) { $paths = Get-PropertyValue -Object $groupObject -Name 'files' -Default @() }
        foreach ($rawPattern in @($paths)) {
            $pattern = ([string]$rawPattern).Trim().Replace('\', '/').TrimStart('/')
            if ($pattern) { $patterns.Add($pattern) }
        }
    }
    return @($patterns | Sort-Object -Unique)
}

function Test-PathMatchesPattern {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$Pattern
    )

    $pathValue = $RelativePath.Replace('\', '/')
    $patternValue = $Pattern.Replace('\', '/').TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($patternValue)) { return $false }

    $hasWildcard = $patternValue.IndexOfAny([char[]]'*?[') -ge 0
    if (-not $hasWildcard) {
        if ($pathValue.Equals($patternValue, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
        if ($pathValue.StartsWith($patternValue.TrimEnd('/') + '/', [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
        return $false
    }

    $effective = $patternValue.Replace('**', '*')
    return ($pathValue -like $effective)
}

function Select-ContextPaths {
    param(
        [string[]]$Candidates,
        [string[]]$Patterns,
        [switch]$All
    )

    if ($All) { return @($Candidates | Sort-Object -Unique) }
    if (@($Patterns).Count -eq 0) { return @() }

    $selected = New-Object System.Collections.Generic.List[string]
    foreach ($candidate in $Candidates) {
        foreach ($pattern in $Patterns) {
            if (Test-PathMatchesPattern -RelativePath $candidate -Pattern $pattern) {
                $selected.Add($candidate)
                break
            }
        }
    }
    return @($selected | Sort-Object -Unique)
}

function Get-ContextScopeHash {
    param([Parameter(Mandatory = $true)][string[]]$Paths)

    $builder = New-Object System.Text.StringBuilder
    foreach ($path in @($Paths | Sort-Object -Unique)) {
        [void]$builder.Append(([string]$path).Replace('\', '/').ToLowerInvariant())
        [void]$builder.Append([char]0)
    }
    return Get-TextSha256 -Text $builder.ToString()
}

function Resolve-ContextSelection {
    param(
        [switch]$All,
        [string[]]$RequestedGroups = @(),
        [string]$RequestedBankPath = ''
    )

    $config = Get-ProjectConfiguration
    $bankFull = Resolve-BankPath -RequestedPath $RequestedBankPath
    $bank = Read-JsonFile -Path $bankFull
    $defaults = Get-PropertyValue -Object $bank -Name 'defaults'
    $skipDirectories = @(Get-PropertyValue -Object $defaults -Name 'skip_dirs' -Default @())
    $defaultGroupNames = @(Get-PropertyValue -Object $defaults -Name 'groups' -Default @() | ForEach-Object { [string]$_ })
    $defaultBudgetKB = [int](Get-PropertyValue -Object $defaults -Name 'max_kb' -Default 0)
    $defaultBudgetBytes = [int64]$defaultBudgetKB * 1024
    $settings = Resolve-TextSettings -Config $config
    $candidates = @(Get-CandidateRelativePaths -Settings $settings -SkipDirectories $skipDirectories)
    $selectedGroups = @()
    $patterns = @()
    if (-not $All) {
        $selectedGroups = Resolve-SelectedGroups -Bank $bank -RequestedGroups $RequestedGroups
        $patterns = Get-GroupPatterns -Bank $bank -SelectedGroups $selectedGroups
    }
    $selectedPaths = Select-ContextPaths -Candidates $candidates -Patterns $patterns -All:$All
    if (@($selectedPaths).Count -eq 0) { throw 'No eligible context files were selected.' }
    return [pscustomobject][ordered]@{
        config = $config
        bank = $bank
        bank_path = $bankFull
        defaults = $defaults
        candidates = @($candidates)
        selected_groups = @($selectedGroups)
        selected_paths = @($selectedPaths)
        scope_sha256 = Get-ContextScopeHash -Paths $selectedPaths
    }
}

function Get-ContextFileRecord {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $safeRelative = Assert-SafeRelativePath -RelativePath $RelativePath
    $full = Get-NormalizedAbsolutePath -Path $safeRelative -BasePath $script:RepoRoot
    $content = [System.IO.File]::ReadAllText($full, $script:Utf8Strict)
    $bytes = $script:Utf8NoBom.GetBytes($content)
    return [pscustomobject]@{
        path = $safeRelative
        content = $content
        char_count = [int64]$content.Length
        utf8_bytes = [int64]$bytes.Length
        sha256 = Get-Sha256HexFromBytes -Bytes $bytes
    }
}

function Get-ContextBlockEstimateBytes {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][int64]$ContentBytes
    )

    # Each path appears once in the optional tree and once in compact block
    # metadata. The fixed allowance covers both block markers, JSON property
    # names, counts, the SHA-256 value, and line endings. A final serialized
    # size check below remains the fail-closed authority.
    $pathBytes = [int64]$script:Utf8NoBom.GetByteCount($RelativePath)
    return [int64]($ContentBytes + (2 * $pathBytes) + $script:ContextPackBlockMetadataBytes)
}

function ConvertTo-CompactJson {
    param([Parameter(Mandatory = $true)]$Value)
    return ($Value | ConvertTo-Json -Depth 30 -Compress)
}

function Build-ContextPack {
    param(
        [switch]$All,
        [string[]]$RequestedGroups,
        [string]$RequestedBankPath,
        [string]$RequestedOutputPath,
        [int]$RequestedBudgetKB,
        [switch]$DisableTree
    )

    $started = [DateTimeOffset]::UtcNow
    $selection = Resolve-ContextSelection -All:$All -RequestedGroups $RequestedGroups -RequestedBankPath $RequestedBankPath
    $config = $selection.config
    $bankFull = $selection.bank_path
    $bank = $selection.bank
    $defaults = $selection.defaults
    $selectedGroups = @($selection.selected_groups)
    $selectedPaths = @($selection.selected_paths)

    $budget = $RequestedBudgetKB
    if ($budget -le 0) {
        $budget = [int](Get-PropertyValue -Object $defaults -Name 'max_kb' -Default 0)
    }
    if ($budget -le 0) {
        $contextConfig = Get-PropertyValue -Object $config -Name 'context'
        $budget = [int](Get-PropertyValue -Object $contextConfig -Name 'default_budget_kb' -Default 512)
    }
    if ($budget -lt 16) { throw 'Context budget must be at least 16 KB.' }
    $budgetBytes = [int64]$budget * 1024

    $included = New-Object System.Collections.Generic.List[object]
    $omitted = New-Object System.Collections.Generic.List[object]
    $estimatedBytes = $script:ContextPackBaseEstimateBytes
    foreach ($relative in $selectedPaths) {
        try {
            $record = Get-ContextFileRecord -RelativePath $relative
        }
        catch {
            $omitted.Add([pscustomobject][ordered]@{
                path = $relative
                reason = 'read_failed'
                message = $_.Exception.Message
            })
            continue
        }
        $blockEstimate = Get-ContextBlockEstimateBytes -RelativePath $record.path -ContentBytes ([int64]$record.utf8_bytes)
        if (($estimatedBytes + $blockEstimate) -gt $budgetBytes) {
            $omitted.Add([pscustomobject][ordered]@{
                path = $relative
                reason = 'budget_exceeded'
                utf8_bytes = $record.utf8_bytes
            })
            continue
        }
        $included.Add($record)
        $estimatedBytes += $blockEstimate
    }
    if ($included.Count -eq 0) {
        throw "No complete file fit within the $budget KB context budget. Increase -BudgetKB."
    }

    $identityBuilder = New-Object System.Text.StringBuilder
    [void]$identityBuilder.AppendLine($script:ContextSchema)
    [void]$identityBuilder.AppendLine([string]$script:FormatVersion)
    foreach ($record in $included) {
        [void]$identityBuilder.Append($record.path)
        [void]$identityBuilder.Append([char]0)
        [void]$identityBuilder.Append($record.sha256)
        [void]$identityBuilder.Append([char]0)
        [void]$identityBuilder.AppendLine([string]$record.char_count)
    }
    $identityHash = Get-TextSha256 -Text $identityBuilder.ToString()
    $packId = $identityHash.Substring(0, 24)
    $projectName = [string](Get-PropertyValue -Object $config -Name 'name' -Default (Split-Path -Leaf $script:RepoRoot))
    $template = Get-PropertyValue -Object $config -Name 'template'
    $repository = Get-RepositoryHead
    $bankReference = $bankFull
    try { $bankReference = Get-RelativePath -Root $script:RepoRoot -Path $bankFull } catch { }

    $header = [pscustomobject][ordered]@{
        schema = $script:ContextSchema
        format_version = $script:FormatVersion
        pack_id = $packId
        generated_at_utc = [DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
        project = $projectName
        template_version = [string](Get-PropertyValue -Object $template -Name 'version' -Default '')
        repository = $repository
        selection_mode = if ($All) { 'full' } else { 'groups' }
        groups = @($selectedGroups)
        bank_path = $bankReference
        selected_path_count = @($selectedPaths).Count
        source_scope_sha256 = $selection.scope_sha256
        budget_kb = $budget
        file_count = $included.Count
        omitted_count = $omitted.Count
        identity_sha256 = $identityHash
        encoding = 'utf-8-no-bom'
        block_contract = 'metadata line followed by exact char_count content characters'
    }

    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append("@@@GKNOME_CTX_PACK_BEGIN:$packId@@@`n")
    [void]$builder.Append((ConvertTo-CompactJson -Value $header))
    [void]$builder.Append("`n")

    if (-not $DisableTree) {
        [void]$builder.Append("@@@GKNOME_CTX_TREE_BEGIN:$packId@@@`n")
        [void]$builder.Append("./`n")
        foreach ($record in $included) {
            [void]$builder.Append("  ")
            [void]$builder.Append($record.path)
            [void]$builder.Append("`n")
        }
        [void]$builder.Append("@@@GKNOME_CTX_TREE_END:$packId@@@`n")
    }

    $manifestFiles = New-Object System.Collections.Generic.List[object]
    foreach ($record in $included) {
        $metadata = [pscustomobject][ordered]@{
            path = $record.path
            char_count = $record.char_count
            utf8_bytes = $record.utf8_bytes
            sha256 = $record.sha256
        }
        [void]$builder.Append("@@@GKNOME_CTX_FILE_BEGIN:$packId@@@`n")
        [void]$builder.Append((ConvertTo-CompactJson -Value $metadata))
        [void]$builder.Append("`n")
        [void]$builder.Append($record.content)
        [void]$builder.Append("`n")
        [void]$builder.Append("@@@GKNOME_CTX_FILE_END:$packId@@@`n")
        $manifestFiles.Add($metadata)
    }

    $endMetadata = [pscustomobject][ordered]@{
        schema = 'gknome_context_pack_end_v1'
        pack_id = $packId
        file_count = $included.Count
        identity_sha256 = $identityHash
    }
    [void]$builder.Append("@@@GKNOME_CTX_PACK_END:$packId@@@`n")
    [void]$builder.Append((ConvertTo-CompactJson -Value $endMetadata))
    [void]$builder.Append("`n")

    $outputFull = Resolve-DefaultPackPath -RequestedPath $RequestedOutputPath
    [void](Get-RelativePath -Root $script:RepoRoot -Path $outputFull)
    $packContent = $builder.ToString()
    $packContentBytes = $script:Utf8NoBom.GetBytes($packContent)
    $packBytes = [int64]$packContentBytes.Length
    if ($packBytes -gt $budgetBytes) {
        throw "Context pack serialization exceeded the $budget KB budget after bounded selection ($packBytes bytes)."
    }
    $packHash = Get-Sha256HexFromBytes -Bytes $packContentBytes

    $manifest = [pscustomobject][ordered]@{
        schema = 'gknome_context_pack_manifest_v1'
        pack = $header
        pack_path = Get-RelativePath -Root $script:RepoRoot -Path $outputFull
        pack_bytes = [int64]$packBytes
        pack_sha256 = $packHash
        files = @($manifestFiles.ToArray())
        omitted = @($omitted.ToArray())
    }
    $manifestPath = $outputFull + '.manifest.json'
    $manifestContent = $manifest | ConvertTo-Json -Depth 30
    Publish-ContextPackPair -PackPath $outputFull -PackContent $packContent -ManifestContent $manifestContent

    $elapsed = [DateTimeOffset]::UtcNow - $started
    return [pscustomobject][ordered]@{
        schema = 'gknome_context_build_result_v1'
        status = 'pass'
        pack_id = $packId
        pack_path = $outputFull
        manifest_path = $manifestPath
        file_count = $included.Count
        omitted_count = $omitted.Count
        pack_bytes = [int64]$packBytes
        pack_sha256 = $packHash
        budget_kb = $budget
        elapsed_ms = [math]::Round($elapsed.TotalMilliseconds, 3)
    }
}

function Invoke-WithContextLock {
    param([Parameter(Mandatory = $true)][scriptblock]$Action)

    $mutexKey = Get-TextSha256 -Text ([System.IO.Path]::GetFullPath($script:RepoRoot).ToLowerInvariant())
    $mutex = New-Object System.Threading.Mutex($false, ('Local\gknome-context-' + $mutexKey.Substring(0, 24)))
    $held = $false
    try {
        try {
            $held = $mutex.WaitOne([TimeSpan]::FromMinutes(2))
        }
        catch [System.Threading.AbandonedMutexException] {
            $held = $true
        }
        if (-not $held) { throw 'Timed out waiting for another context operation for this repository.' }
        & $Action
    }
    finally {
        if ($held) { [void]$mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}

function Read-LineAt {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][ref]$Index
    )

    if ($Index.Value -gt $Text.Length) { throw 'Context pack cursor is outside the document.' }
    if ($Index.Value -eq $Text.Length) { return $null }
    $end = $Text.IndexOf("`n", $Index.Value)
    if ($end -lt 0) {
        $line = $Text.Substring($Index.Value)
        $Index.Value = $Text.Length
    }
    else {
        $line = $Text.Substring($Index.Value, $end - $Index.Value)
        $Index.Value = $end + 1
    }
    if ($line.EndsWith("`r")) { $line = $line.Substring(0, $line.Length - 1) }
    return $line
}

function Read-ContextPack {
    param([Parameter(Mandatory = $true)][string]$Path)

    $full = Get-NormalizedAbsolutePath -Path $Path -BasePath $script:RepoRoot
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        throw "Context pack not found: $full"
    }
    $text = [System.IO.File]::ReadAllText($full, $script:Utf8Strict)
    $cursor = 0
    $firstLine = Read-LineAt -Text $text -Index ([ref]$cursor)
    if ($firstLine -notmatch '^@@@GKNOME_CTX_PACK_BEGIN:([a-f0-9]{24})@@@$') {
        throw 'Context pack begin marker is missing or malformed.'
    }
    $packId = $Matches[1]
    $headerLine = Read-LineAt -Text $text -Index ([ref]$cursor)
    if ([string]::IsNullOrWhiteSpace($headerLine)) { throw 'Context pack header metadata is missing.' }
    $header = ConvertFrom-BoundedStrictJsonText -Text $headerLine -MaxUtf8Bytes 1048576 -Label 'Context pack header metadata'
    if ([string](Get-PropertyValue -Object $header -Name 'schema' -Default '') -ne $script:ContextSchema) {
        throw 'Context pack schema is unsupported.'
    }
    if ([string](Get-PropertyValue -Object $header -Name 'pack_id' -Default '') -ne $packId) {
        throw 'Context pack header identity does not match the begin marker.'
    }
    if ([int](Get-PropertyValue -Object $header -Name 'format_version' -Default 0) -ne $script:FormatVersion) {
        throw 'Context pack format version is unsupported.'
    }

    $files = New-Object System.Collections.Generic.List[object]
    $seen = @{}
    $treePaths = $null
    $endMetadata = $null
    while ($cursor -lt $text.Length) {
        $line = Read-LineAt -Text $text -Index ([ref]$cursor)
        if ($null -eq $line) { break }

        if ($line -eq "@@@GKNOME_CTX_PACK_END:$packId@@@") {
            $endLine = Read-LineAt -Text $text -Index ([ref]$cursor)
            if ([string]::IsNullOrWhiteSpace($endLine)) { throw 'Context pack end metadata is missing.' }
            $endMetadata = ConvertFrom-BoundedStrictJsonText -Text $endLine -MaxUtf8Bytes 1048576 -Label 'Context pack end metadata'
            break
        }

        if ($line -eq "@@@GKNOME_CTX_TREE_BEGIN:$packId@@@") {
            if ($null -ne $treePaths -or $files.Count -gt 0) {
                throw 'Context pack tree is duplicated or appears after file blocks.'
            }
            $treePaths = New-Object System.Collections.Generic.List[string]
            $treeSeen = @{}
            $treeRoot = Read-LineAt -Text $text -Index ([ref]$cursor)
            if ($treeRoot -ne './') { throw 'Context pack tree root is malformed.' }
            $treeClosed = $false
            while ($cursor -lt $text.Length) {
                $treeLine = Read-LineAt -Text $text -Index ([ref]$cursor)
                if ($null -eq $treeLine) { break }
                if ($treeLine -eq "@@@GKNOME_CTX_TREE_END:$packId@@@") {
                    $treeClosed = $true
                    break
                }
                if ($treeLine -notmatch '^  (.+)$') {
                    throw "Context pack tree line is malformed: $treeLine"
                }
                $treeRelative = Assert-SafeRelativePath -RelativePath $Matches[1]
                $treeKey = $treeRelative.ToLowerInvariant()
                if ($treeSeen.ContainsKey($treeKey)) {
                    throw "Duplicate context tree path: $treeRelative"
                }
                $treeSeen[$treeKey] = $true
                $treePaths.Add($treeRelative)
            }
            if (-not $treeClosed) { throw 'Context pack tree end marker was not found.' }
            continue
        }

        if ($line -ne "@@@GKNOME_CTX_FILE_BEGIN:$packId@@@") {
            throw "Unexpected context pack line outside a file block: $line"
        }

        $metadataLine = Read-LineAt -Text $text -Index ([ref]$cursor)
        if ([string]::IsNullOrWhiteSpace($metadataLine)) { throw 'Context file metadata is missing.' }
        $metadata = ConvertFrom-BoundedStrictJsonText -Text $metadataLine -MaxUtf8Bytes 1048576 -Label 'Context file metadata'
        $relative = Assert-SafeRelativePath -RelativePath ([string](Get-PropertyValue -Object $metadata -Name 'path' -Default ''))
        if ($seen.ContainsKey($relative.ToLowerInvariant())) {
            throw "Duplicate context path: $relative"
        }
        $seen[$relative.ToLowerInvariant()] = $true

        $charCount = [int64](Get-PropertyValue -Object $metadata -Name 'char_count' -Default -1)
        if ($charCount -lt 0 -or ($cursor + $charCount) -gt $text.Length) {
            throw "Invalid character count for context file: $relative"
        }
        $content = $text.Substring($cursor, [int]$charCount)
        $cursor += [int]$charCount
        if ($cursor -ge $text.Length -or $text[$cursor] -ne "`n") {
            throw "Context file delimiter is missing after: $relative"
        }
        $cursor++
        $endMarker = Read-LineAt -Text $text -Index ([ref]$cursor)
        if ($endMarker -ne "@@@GKNOME_CTX_FILE_END:$packId@@@") {
            throw "Context file end marker is missing after: $relative"
        }

        $actualBytes = $script:Utf8NoBom.GetBytes($content)
        $actualHash = Get-Sha256HexFromBytes -Bytes $actualBytes
        $expectedHash = [string](Get-PropertyValue -Object $metadata -Name 'sha256' -Default '')
        $expectedBytes = [int64](Get-PropertyValue -Object $metadata -Name 'utf8_bytes' -Default -1)
        if ($actualHash -ne $expectedHash) {
            throw "Context file hash mismatch: $relative"
        }
        if ($actualBytes.Length -ne $expectedBytes) {
            throw "Context file UTF-8 byte count mismatch: $relative"
        }

        $files.Add([pscustomobject][ordered]@{
            path = $relative
            content = $content
            char_count = $charCount
            utf8_bytes = [int64]$actualBytes.Length
            sha256 = $actualHash
        })
    }

    if ($null -eq $endMetadata) { throw 'Context pack end marker was not found.' }
    if ($cursor -lt $text.Length) {
        $trailing = $text.Substring($cursor)
        if (-not [string]::IsNullOrWhiteSpace($trailing)) {
            throw 'Context pack contains trailing content after end metadata.'
        }
    }
    if ([string](Get-PropertyValue -Object $endMetadata -Name 'schema' -Default '') -ne 'gknome_context_pack_end_v1') {
        throw 'Context pack end schema is unsupported.'
    }
    $expectedCount = [int](Get-PropertyValue -Object $header -Name 'file_count' -Default -1)
    if ($files.Count -ne $expectedCount) {
        throw "Context pack file count mismatch. Expected $expectedCount, read $($files.Count)."
    }
    if ([string](Get-PropertyValue -Object $endMetadata -Name 'pack_id' -Default '') -ne $packId) {
        throw 'Context pack end identity does not match.'
    }
    if ([int](Get-PropertyValue -Object $endMetadata -Name 'file_count' -Default -1) -ne $files.Count) {
        throw 'Context pack end file count does not match.'
    }
    if ($null -ne $treePaths) {
        if ($treePaths.Count -ne $files.Count) {
            throw 'Context pack tree file count does not match the file blocks.'
        }
        for ($treeIndex = 0; $treeIndex -lt $files.Count; $treeIndex++) {
            if (-not $treePaths[$treeIndex].Equals([string]$files[$treeIndex].path, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "Context pack tree path does not match file block order at index $treeIndex."
            }
        }
    }

    $identityBuilder = New-Object System.Text.StringBuilder
    [void]$identityBuilder.AppendLine($script:ContextSchema)
    [void]$identityBuilder.AppendLine([string]$script:FormatVersion)
    foreach ($record in $files) {
        [void]$identityBuilder.Append($record.path)
        [void]$identityBuilder.Append([char]0)
        [void]$identityBuilder.Append($record.sha256)
        [void]$identityBuilder.Append([char]0)
        [void]$identityBuilder.AppendLine([string]$record.char_count)
    }
    $actualIdentity = Get-TextSha256 -Text $identityBuilder.ToString()
    $expectedIdentity = [string](Get-PropertyValue -Object $header -Name 'identity_sha256' -Default '')
    $endIdentity = [string](Get-PropertyValue -Object $endMetadata -Name 'identity_sha256' -Default '')
    if ($actualIdentity -ne $expectedIdentity -or $actualIdentity -ne $endIdentity) {
        throw 'Context pack identity hash does not match its file records.'
    }
    if ($actualIdentity.Substring(0, 24) -ne $packId) {
        throw 'Context pack marker identity does not match its file records.'
    }

    return [pscustomobject][ordered]@{
        path = $full
        pack_id = $packId
        header = $header
        files = @($files.ToArray())
        end = $endMetadata
        pack_bytes = [int64](Get-Item -LiteralPath $full).Length
        pack_sha256 = Get-FileSha256 -Path $full
    }
}

function Get-ContextSourceFreshness {
    param(
        [Parameter(Mandatory = $true)]$Pack,
        [AllowNull()]$Manifest
    )

    $missing = New-Object System.Collections.Generic.List[string]
    $changed = New-Object System.Collections.Generic.List[object]
    $newInScope = New-Object System.Collections.Generic.List[string]
    $previouslyOmitted = New-Object System.Collections.Generic.List[string]
    $outOfScope = New-Object System.Collections.Generic.List[string]
    $scopeError = $null
    $selection = $null
    try {
        $header = $Pack.header
        $selectionMode = [string](Get-PropertyValue -Object $header -Name 'selection_mode' -Default 'groups')
        $isFull = $selectionMode -eq 'full'
        $requestedGroups = @(Get-PropertyValue -Object $header -Name 'groups' -Default @())
        $requestedBankPath = [string](Get-PropertyValue -Object $header -Name 'bank_path' -Default '')
        $selection = Resolve-ContextSelection -All:$isFull -RequestedGroups $requestedGroups -RequestedBankPath $requestedBankPath
    }
    catch { $scopeError = $_.Exception.Message }

    $packByKey = @{}
    foreach ($record in @($Pack.files)) { $packByKey[([string]$record.path).ToLowerInvariant()] = $record }
    $omittedByKey = @{}
    if ($null -ne $Manifest) {
        foreach ($record in @(Get-PropertyValue -Object $Manifest -Name 'omitted' -Default @())) {
            $omittedPath = [string](Get-PropertyValue -Object $record -Name 'path' -Default '')
            if ($omittedPath) { $omittedByKey[$omittedPath.ToLowerInvariant()] = $true }
        }
    }

    foreach ($packRecord in @($Pack.files)) {
        $relative = [string]$packRecord.path
        $full = Get-NormalizedAbsolutePath -Path $relative -BasePath $script:RepoRoot
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
            $missing.Add($relative)
            continue
        }
        try {
            $current = Get-ContextFileRecord -RelativePath $relative
            if ([string]$current.sha256 -ne [string]$packRecord.sha256 -or
                [int64]$current.utf8_bytes -ne [int64]$packRecord.utf8_bytes -or
                [int64]$current.char_count -ne [int64]$packRecord.char_count) {
                $changed.Add([pscustomobject][ordered]@{
                        path = $relative
                        expected_sha256 = [string]$packRecord.sha256
                        actual_sha256 = [string]$current.sha256
                        expected_utf8_bytes = [int64]$packRecord.utf8_bytes
                        actual_utf8_bytes = [int64]$current.utf8_bytes
                        expected_char_count = [int64]$packRecord.char_count
                        actual_char_count = [int64]$current.char_count
                    })
            }
        }
        catch {
            $changed.Add([pscustomobject][ordered]@{
                    path = $relative
                    expected_sha256 = [string]$packRecord.sha256
                    actual_sha256 = $null
                    error = $_.Exception.Message
                })
        }
    }

    $scopeHashMatches = $null
    $selectedPathCount = 0
    if ($null -ne $selection) {
        $selectedPathCount = @($selection.selected_paths).Count
        $selectedByKey = @{}
        foreach ($selectedPath in @($selection.selected_paths)) { $selectedByKey[([string]$selectedPath).ToLowerInvariant()] = $true }
        foreach ($selectedPath in @($selection.selected_paths)) {
            $selectedKey = ([string]$selectedPath).ToLowerInvariant()
            if (-not $packByKey.ContainsKey($selectedKey)) {
                $newInScope.Add([string]$selectedPath)
                if ($omittedByKey.ContainsKey($selectedKey)) { $previouslyOmitted.Add([string]$selectedPath) }
            }
        }
        foreach ($packRecord in @($Pack.files)) {
            $packKey = ([string]$packRecord.path).ToLowerInvariant()
            if (-not $selectedByKey.ContainsKey($packKey)) { $outOfScope.Add([string]$packRecord.path) }
        }
        $recordedScopeHash = [string](Get-PropertyValue -Object $Pack.header -Name 'source_scope_sha256' -Default '')
        if ($recordedScopeHash -match '^[0-9a-fA-F]{64}$') {
            $scopeHashMatches = $recordedScopeHash.Equals([string]$selection.scope_sha256, [System.StringComparison]::OrdinalIgnoreCase)
        }
    }

    $newlySelected = @($newInScope | Where-Object { -not $omittedByKey.ContainsKey(([string]$_).ToLowerInvariant()) })
    $sourceFresh = ($null -eq $scopeError -and $missing.Count -eq 0 -and $changed.Count -eq 0 -and
        $newlySelected.Count -eq 0 -and $outOfScope.Count -eq 0 -and $scopeHashMatches -ne $false)
    return [pscustomobject][ordered]@{
        status = if ($sourceFresh) { 'fresh' } else { 'source-stale' }
        source_fresh = [bool]$sourceFresh
        selection_mode = [string](Get-PropertyValue -Object $Pack.header -Name 'selection_mode' -Default 'groups')
        selected_path_count = $selectedPathCount
        checked_file_count = @($Pack.files).Count
        missing = @($missing.ToArray())
        changed = @($changed.ToArray())
        new_in_selected_scope = @($newInScope.ToArray())
        newly_selected = @($newlySelected)
        previously_omitted = @($previouslyOmitted.ToArray())
        out_of_selected_scope = @($outOfScope.ToArray())
        scope_hash_matches = $scopeHashMatches
        current_scope_sha256 = if ($null -ne $selection) { [string]$selection.scope_sha256 } else { $null }
        scope_error = $scopeError
    }
}

function Verify-ContextPack {
    param([string]$RequestedPackPath)

    $packFull = Resolve-DefaultPackPath -RequestedPath $RequestedPackPath
    [void](Recover-ContextPackPublication -PackPath $packFull)
    $started = [DateTimeOffset]::UtcNow
    $pack = Read-ContextPack -Path $packFull
    $manifestPath = $packFull + '.manifest.json'
    $manifestVerified = $false
    $manifest = $null

    if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
        $manifest = Read-JsonFile -Path $manifestPath
        if ([string](Get-PropertyValue -Object $manifest -Name 'schema' -Default '') -ne 'gknome_context_pack_manifest_v1') {
            throw 'Context pack manifest schema is unsupported.'
        }
        $manifestPack = Get-PropertyValue -Object $manifest -Name 'pack'
        if ([string](Get-PropertyValue -Object $manifestPack -Name 'pack_id' -Default '') -ne $pack.pack_id) {
            throw 'Context pack manifest identity does not match the pack.'
        }
        if ([int64](Get-PropertyValue -Object $manifest -Name 'pack_bytes' -Default -1) -ne $pack.pack_bytes) {
            throw 'Context pack manifest byte count does not match the pack.'
        }
        if ([string](Get-PropertyValue -Object $manifest -Name 'pack_sha256' -Default '') -ne $pack.pack_sha256) {
            throw 'Context pack manifest SHA-256 does not match the pack.'
        }

        $manifestFiles = @(Get-PropertyValue -Object $manifest -Name 'files' -Default @())
        if ($manifestFiles.Count -ne $pack.files.Count) {
            throw 'Context pack manifest file count does not match the pack.'
        }
        for ($manifestIndex = 0; $manifestIndex -lt $pack.files.Count; $manifestIndex++) {
            $manifestFile = $manifestFiles[$manifestIndex]
            $packFile = $pack.files[$manifestIndex]
            if (-not ([string](Get-PropertyValue -Object $manifestFile -Name 'path' -Default '')).Equals([string]$packFile.path, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "Context pack manifest path mismatch at index $manifestIndex."
            }
            if ([int64](Get-PropertyValue -Object $manifestFile -Name 'char_count' -Default -1) -ne [int64]$packFile.char_count) {
                throw "Context pack manifest character count mismatch: $($packFile.path)"
            }
            if ([int64](Get-PropertyValue -Object $manifestFile -Name 'utf8_bytes' -Default -1) -ne [int64]$packFile.utf8_bytes) {
                throw "Context pack manifest UTF-8 byte count mismatch: $($packFile.path)"
            }
            if ([string](Get-PropertyValue -Object $manifestFile -Name 'sha256' -Default '') -ne [string]$packFile.sha256) {
                throw "Context pack manifest SHA-256 mismatch: $($packFile.path)"
            }
        }
        $manifestVerified = $true
    }

    $freshness = Get-ContextSourceFreshness -Pack $pack -Manifest $manifest
    $status = if (-not $manifestVerified) { 'manifest-unverified' } elseif (-not [bool]$freshness.source_fresh) { 'source-stale' } else { 'pass' }
    $elapsed = [DateTimeOffset]::UtcNow - $started
    return [pscustomobject][ordered]@{
        schema = 'gknome_context_verify_result_v1'
        status = $status
        pack_id = $pack.pack_id
        pack_path = $pack.path
        file_count = $pack.files.Count
        pack_bytes = $pack.pack_bytes
        pack_sha256 = $pack.pack_sha256
        manifest_path = $manifestPath
        manifest_verified = $manifestVerified
        source_fresh = [bool]$freshness.source_fresh
        source_freshness = $freshness
        elapsed_ms = [math]::Round($elapsed.TotalMilliseconds, 3)
    }
}

function Test-ContainedOutputPath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $safe = Assert-SafeRelativePath -RelativePath $RelativePath
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $target = [System.IO.Path]::GetFullPath((Join-Path $rootFull ($safe.Replace('/', [System.IO.Path]::DirectorySeparatorChar))))
    $prefix = $rootFull + [System.IO.Path]::DirectorySeparatorChar
    if (-not $target.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Rebuild path escapes the destination root: $safe"
    }
    return $target
}

function Assert-NoReparsePath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $current = [System.IO.Path]::GetFullPath($Path)
    while (-not [string]::IsNullOrWhiteSpace($current)) {
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force
            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Reparse points are not allowed in rebuild paths: $current"
            }
            if (-not $item.PSIsContainer) {
                throw "Rebuild directory path contains a file: $current"
            }
        }
        $parent = Split-Path -Parent $current
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $current) { break }
        $current = $parent
    }
}

function Ensure-TrackedDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$CreatedDirectories
    )

    $missing = New-Object System.Collections.Generic.List[string]
    $cursor = [System.IO.Path]::GetFullPath($Path)
    while (-not (Test-Path -LiteralPath $cursor)) {
        $missing.Add($cursor)
        $parent = Split-Path -Parent $cursor
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $cursor) {
            throw "Could not find an existing parent for rebuild directory: $Path"
        }
        $cursor = $parent
    }
    Assert-NoReparsePath -Path $cursor
    foreach ($directory in @($missing.ToArray() | Sort-Object Length)) {
        New-Item -ItemType Directory -Path $directory -ErrorAction Stop | Out-Null
        $CreatedDirectories.Add($directory)
    }
    Assert-NoReparsePath -Path $Path
}

function Assert-NoReparseTree {
    param([Parameter(Mandatory = $true)][string]$Root)

    Assert-NoReparsePath -Path $Root
    $pending = New-Object System.Collections.Generic.Queue[string]
    $pending.Enqueue([System.IO.Path]::GetFullPath($Root))
    while ($pending.Count -gt 0) {
        $current = $pending.Dequeue()
        foreach ($entry in @(Get-ChildItem -LiteralPath $current -Force -ErrorAction Stop)) {
            if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Reparse points are not allowed in rebuild trees: $($entry.FullName)"
            }
            if ($entry.PSIsContainer) { $pending.Enqueue($entry.FullName) }
        }
    }
}

function Rebuild-ContextPack {
    param(
        [string]$RequestedPackPath,
        [string]$RequestedDestinationPath,
        [switch]$ApplyChanges,
        [switch]$AllowOverwrite
    )

    $started = [DateTimeOffset]::UtcNow
    $packFull = Resolve-DefaultPackPath -RequestedPath $RequestedPackPath
    [void](Recover-ContextPackPublication -PackPath $packFull)
    $pack = Read-ContextPack -Path $packFull

    if ($ApplyChanges) {
        if ([string]::IsNullOrWhiteSpace($RequestedDestinationPath)) {
            throw 'Rebuild apply requires an explicit -DestinationPath.'
        }
        $destinationFull = Get-NormalizedAbsolutePath -Path $RequestedDestinationPath -BasePath $script:RepoRoot
    }
    else {
        $destinationFull = Join-Path $script:RepoRoot ('.artifacts\rebuild\' + $pack.pack_id)
    }

    $destinationRoot = [System.IO.Path]::GetPathRoot($destinationFull)
    if ($destinationFull.Equals($destinationRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Rebuild refuses a filesystem root: $destinationFull"
    }
    if (Test-Path -LiteralPath $destinationFull -PathType Leaf) {
        throw "Rebuild destination must be a directory: $destinationFull"
    }
    Assert-NoReparsePath -Path (Split-Path -Parent $destinationFull)

    $previewRoot = Join-Path $script:RepoRoot '.artifacts\rebuild'
    $isPreview = -not $ApplyChanges
    $replaceWholePreview = $isPreview -and (Test-Path -LiteralPath $destinationFull -PathType Container) -and $AllowOverwrite
    if ($replaceWholePreview) {
        $previewFull = [System.IO.Path]::GetFullPath($previewRoot).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
        $targetFull = [System.IO.Path]::GetFullPath($destinationFull)
        if (-not $targetFull.StartsWith($previewFull, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw 'Preview replacement refused outside .artifacts/rebuild.'
        }
        Assert-NoReparseTree -Root $destinationFull
    }

    $plans = New-Object System.Collections.Generic.List[object]
    foreach ($record in $pack.files) {
        $target = Test-ContainedOutputPath -Root $destinationFull -RelativePath $record.path
        $parent = Split-Path -Parent $target
        Assert-NoReparsePath -Path $parent
        $existedBefore = Test-Path -LiteralPath $target
        $existingHash = $null
        if ($existedBefore) {
            $targetItem = Get-Item -LiteralPath $target -Force
            if (($targetItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Rebuild target is a reparse point: $target"
            }
            if ($targetItem.PSIsContainer) {
                throw "Rebuild target is a directory, not a file: $target"
            }
            if (-not $AllowOverwrite) {
                throw "Rebuild target already exists. Use -Force to replace a listed file: $target"
            }
            $existingHash = Get-FileSha256 -Path $target
        }
        $plans.Add([pscustomobject]@{
            record = $record
            target = $target
            parent = $parent
            existed_before = [bool]$existedBefore
            existing_sha256 = $existingHash
        })
    }

    $destinationParent = Split-Path -Parent $destinationFull
    $createdDirectories = New-Object System.Collections.Generic.List[string]
    $journal = New-Object System.Collections.Generic.List[object]
    $written = New-Object System.Collections.Generic.List[object]
    $transactionRoot = $null
    $previewBackup = $null
    $previewMoved = $false
    $proofPath = $null
    $proofBackup = $null
    $proofMoved = $false
    $proofAttempted = $false
    $succeeded = $false
    $rollbackComplete = $false
    $result = $null
    try {
        Ensure-TrackedDirectory -Path $destinationParent -CreatedDirectories $createdDirectories
        $transactionRoot = Join-Path $destinationParent ('.gknome-context-transaction-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $transactionRoot -ErrorAction Stop | Out-Null
        Assert-NoReparsePath -Path $transactionRoot
        $stagedRoot = Join-Path $transactionRoot 'staged'
        New-Item -ItemType Directory -Path $stagedRoot -ErrorAction Stop | Out-Null
        $backupRoot = Join-Path $transactionRoot 'backup'
        New-Item -ItemType Directory -Path $backupRoot -ErrorAction Stop | Out-Null

        foreach ($plan in $plans) {
            $record = $plan.record
            $stagedTarget = Test-ContainedOutputPath -Root $stagedRoot -RelativePath $record.path
            $stagedParent = Split-Path -Parent $stagedTarget
            if (-not (Test-Path -LiteralPath $stagedParent -PathType Container)) {
                New-Item -ItemType Directory -Path $stagedParent -Force | Out-Null
            }
            Write-Utf8File -Path $stagedTarget -Content $record.content
            $stagedContent = [System.IO.File]::ReadAllText($stagedTarget, $script:Utf8Strict)
            if ((Get-TextSha256 -Text $stagedContent) -ne [string]$record.sha256) {
                throw "Staged rebuild file hash mismatch: $($record.path)"
            }
            $plan | Add-Member -NotePropertyName staged -NotePropertyValue $stagedTarget
        }

        if ($replaceWholePreview) {
            $previewBackup = Join-Path $transactionRoot 'previous-preview'
            Move-Item -LiteralPath $destinationFull -Destination $previewBackup -ErrorAction Stop
            $previewMoved = $true
        }

        $failAfterApply = 0
        $failAfterApplyText = [Environment]::GetEnvironmentVariable('GKNOME_TEST_CONTEXT_FAIL_AFTER_APPLY', 'Process')
        if (-not [string]::IsNullOrWhiteSpace($failAfterApplyText)) {
            if (-not [int]::TryParse($failAfterApplyText, [ref]$failAfterApply) -or $failAfterApply -lt 1) {
                throw 'GKNOME_TEST_CONTEXT_FAIL_AFTER_APPLY must be a positive integer when set.'
            }
        }
        $appliedCount = 0
        foreach ($plan in $plans) {
            $record = $plan.record
            $target = [string]$plan.target
            $parent = [string]$plan.parent
            $existedBefore = [bool]$plan.existed_before -and -not $previewMoved
            Assert-NoReparsePath -Path $parent
            if ($existedBefore) {
                if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or (Get-FileSha256 -Path $target) -ne [string]$plan.existing_sha256) {
                    throw "Rebuild target changed after preflight: $($record.path)"
                }
            }
            elseif (Test-Path -LiteralPath $target) {
                throw "Rebuild target appeared after preflight: $($record.path)"
            }
            Ensure-TrackedDirectory -Path $parent -CreatedDirectories $createdDirectories
            Assert-NoReparsePath -Path $parent

            $backup = Test-ContainedOutputPath -Root $backupRoot -RelativePath $record.path
            $entry = [pscustomobject][ordered]@{
                path = [string]$record.path
                target = $target
                backup = $backup
                expected_sha256 = [string]$record.sha256
                backup_moved = $false
                attempted = $false
                committed = $false
            }
            $journal.Add($entry)
            if ($existedBefore) {
                $backupParent = Split-Path -Parent $backup
                if (-not (Test-Path -LiteralPath $backupParent -PathType Container)) {
                    New-Item -ItemType Directory -Path $backupParent -Force | Out-Null
                }
                Move-Item -LiteralPath $target -Destination $backup -ErrorAction Stop
                $entry.backup_moved = $true
            }
            $entry.attempted = $true
            Move-Item -LiteralPath ([string]$plan.staged) -Destination $target -ErrorAction Stop
            $entry.committed = $true
            $appliedCount++
            if ($failAfterApply -gt 0 -and $appliedCount -ge $failAfterApply) {
                if ([Environment]::GetEnvironmentVariable('GKNOME_TEST_CONTEXT_TAMPER_AFTER_APPLY', 'Process') -eq '1') {
                    [System.IO.File]::AppendAllText($target, "`noperator-change-after-rebuild`n", $script:Utf8NoBom)
                }
                throw "Injected context rebuild failure after applying $appliedCount file(s)."
            }

            $actualContent = [System.IO.File]::ReadAllText($target, $script:Utf8Strict)
            $actualHash = Get-TextSha256 -Text $actualContent
            if ($actualHash -ne [string]$record.sha256) {
                throw "Rebuilt file hash mismatch: $($record.path)"
            }
            $written.Add([pscustomobject][ordered]@{
                path = $record.path
                sha256 = $actualHash
                utf8_bytes = [int64]$script:Utf8NoBom.GetByteCount($actualContent)
            })
        }

        $proofDirectory = Join-Path $script:RepoRoot '.artifacts\proof'
        Ensure-TrackedDirectory -Path $proofDirectory -CreatedDirectories $createdDirectories
        $elapsed = [DateTimeOffset]::UtcNow - $started
        $proof = [pscustomobject][ordered]@{
            schema = 'gknome_context_rebuild_proof_v1'
            status = 'pass'
            generated_at_utc = [DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
            pack_id = $pack.pack_id
            pack_sha256 = $pack.pack_sha256
            destination = $destinationFull
            apply = [bool]$ApplyChanges
            force = [bool]$AllowOverwrite
            transactional = $true
            file_count = $written.Count
            files = @($written.ToArray())
            elapsed_ms = [math]::Round($elapsed.TotalMilliseconds, 3)
        }
        $proofPath = Join-Path $proofDirectory ("context-rebuild-$($pack.pack_id).json")
        $proofItem = Get-Item -LiteralPath $proofPath -Force -ErrorAction SilentlyContinue
        if ($null -ne $proofItem) {
            if ($proofItem.PSIsContainer -or ($proofItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Context rebuild proof target is unsafe: $proofPath"
            }
            $proofBackup = Join-Path $transactionRoot 'previous-proof.json'
            Move-Item -LiteralPath $proofPath -Destination $proofBackup -ErrorAction Stop
            $proofMoved = $true
        }
        $proofAttempted = $true
        Write-Utf8File -Path $proofPath -Content ($proof | ConvertTo-Json -Depth 20)

        $result = [pscustomobject][ordered]@{
            schema = 'gknome_context_rebuild_result_v1'
            status = 'pass'
            pack_id = $pack.pack_id
            destination = $destinationFull
            apply = [bool]$ApplyChanges
            transactional = $true
            file_count = $written.Count
            proof_path = $proofPath
            elapsed_ms = [math]::Round($elapsed.TotalMilliseconds, 3)
        }
        $succeeded = $true
    }
    catch {
        $failureMessage = $_.Exception.Message
        $rollbackErrors = New-Object System.Collections.Generic.List[string]
        if ($proofAttempted -and -not [string]::IsNullOrWhiteSpace($proofPath) -and (Test-Path -LiteralPath $proofPath -PathType Leaf)) {
            try { Remove-Item -LiteralPath $proofPath -Force -ErrorAction Stop } catch { $rollbackErrors.Add($_.Exception.Message) }
        }
        if ($proofMoved -and -not [string]::IsNullOrWhiteSpace($proofBackup) -and (Test-Path -LiteralPath $proofBackup -PathType Leaf)) {
            try { Move-Item -LiteralPath $proofBackup -Destination $proofPath -ErrorAction Stop } catch { $rollbackErrors.Add($_.Exception.Message) }
        }
        foreach ($entry in @($journal.ToArray() | Sort-Object @{ Expression = { ([string]$_.path).Length }; Descending = $true })) {
            $target = [string]$entry.target
            try {
                if ([bool]$entry.attempted -and (Test-Path -LiteralPath $target -PathType Leaf)) {
                    $targetItem = Get-Item -LiteralPath $target -Force
                    if (($targetItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                        throw "Rollback refused a reparse target: $target"
                    }
                    if ((Get-FileSha256 -Path $target) -ne [string]$entry.expected_sha256) {
                        throw "Rollback refused a target changed after rebuild: $target"
                    }
                    Remove-Item -LiteralPath $target -Force -ErrorAction Stop
                }
                if ([bool]$entry.backup_moved -and (Test-Path -LiteralPath ([string]$entry.backup) -PathType Leaf)) {
                    if (Test-Path -LiteralPath $target) { throw "Rollback target is occupied: $target" }
                    Move-Item -LiteralPath ([string]$entry.backup) -Destination $target -ErrorAction Stop
                }
            }
            catch { $rollbackErrors.Add($_.Exception.Message) }
        }
        foreach ($directory in @($createdDirectories.ToArray() | Sort-Object Length -Descending)) {
            try {
                if ((Test-Path -LiteralPath $directory -PathType Container) -and @(Get-ChildItem -LiteralPath $directory -Force).Count -eq 0) {
                    Remove-Item -LiteralPath $directory -Force -ErrorAction Stop
                }
            }
            catch { $rollbackErrors.Add($_.Exception.Message) }
        }
        if ($previewMoved -and -not [string]::IsNullOrWhiteSpace($previewBackup) -and (Test-Path -LiteralPath $previewBackup -PathType Container)) {
            try {
                if (Test-Path -LiteralPath $destinationFull) { throw "Preview rollback target is occupied: $destinationFull" }
                Move-Item -LiteralPath $previewBackup -Destination $destinationFull -ErrorAction Stop
            }
            catch { $rollbackErrors.Add($_.Exception.Message) }
        }
        if ($rollbackErrors.Count -gt 0) {
            throw "$failureMessage Rollback also reported: $($rollbackErrors -join '; '). Recovery data remains at $transactionRoot"
        }
        $rollbackComplete = $true
        throw $failureMessage
    }
    finally {
        if (($succeeded -or $rollbackComplete) -and -not [string]::IsNullOrWhiteSpace($transactionRoot) -and (Test-Path -LiteralPath $transactionRoot -PathType Container)) {
            $transactionItem = Get-Item -LiteralPath $transactionRoot -Force -ErrorAction SilentlyContinue
            if ($null -ne $transactionItem -and ($transactionItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) {
                Remove-Item -LiteralPath $transactionRoot -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
        if (-not $succeeded -and $rollbackComplete) {
            foreach ($directory in @($createdDirectories.ToArray() | Sort-Object Length -Descending)) {
                if ((Test-Path -LiteralPath $directory -PathType Container) -and @(Get-ChildItem -LiteralPath $directory -Force -ErrorAction SilentlyContinue).Count -eq 0) {
                    Remove-Item -LiteralPath $directory -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
    return $result
}

function Get-ContextStatus {
    param([string]$RequestedBankPath)

    $config = Get-ProjectConfiguration
    $bankFull = Resolve-BankPath -RequestedPath $RequestedBankPath
    $bank = Read-JsonFile -Path $bankFull
    $defaults = Get-PropertyValue -Object $bank -Name 'defaults'
    $latestPack = Resolve-DefaultPackPath -RequestedPath ''
    $template = Get-PropertyValue -Object $config -Name 'template'
    return [pscustomobject][ordered]@{
        schema = 'gknome_context_status_v1'
        project = [string](Get-PropertyValue -Object $config -Name 'name' -Default '')
        template_version = [string](Get-PropertyValue -Object $template -Name 'version' -Default '')
        context_schema = $script:ContextSchema
        powershell = $PSVersionTable.PSVersion.ToString()
        python_required = $false
        bank_path = $bankFull
        default_groups = @(Get-PropertyValue -Object $defaults -Name 'groups' -Default @())
        available_groups = @(Get-GroupNames -Bank $bank)
        default_budget_kb = [int](Get-PropertyValue -Object $defaults -Name 'max_kb' -Default 0)
        latest_pack = $latestPack
        latest_pack_exists = Test-Path -LiteralPath $latestPack -PathType Leaf
        marker_namespace = '@@@GKNOME_CTX_*:<pack-id>@@@'
        rebuild_default = '.artifacts/rebuild/<pack-id>'
    }
}

function Get-ContextGroupList {
    param([string]$RequestedBankPath)

    $bankFull = Resolve-BankPath -RequestedPath $RequestedBankPath
    $bank = Read-JsonFile -Path $bankFull
    $groupsObject = Get-PropertyValue -Object $bank -Name 'groups'
    $groups = New-Object System.Collections.Generic.List[object]
    foreach ($property in @($groupsObject.PSObject.Properties | Sort-Object Name)) {
        $groupObject = $property.Value
        $paths = Get-PropertyValue -Object $groupObject -Name 'paths'
        if ($null -eq $paths) { $paths = Get-PropertyValue -Object $groupObject -Name 'files' -Default @() }
        $groups.Add([pscustomobject][ordered]@{
            name = $property.Name
            description = [string](Get-PropertyValue -Object $groupObject -Name 'description' -Default '')
            status = [string](Get-PropertyValue -Object $groupObject -Name 'status' -Default '')
            path_count = @($paths).Count
        })
    }
    return [pscustomobject][ordered]@{
        schema = 'gknome_context_group_list_v1'
        bank_path = $bankFull
        groups = @($groups.ToArray())
    }
}

function Audit-ContextBank {
    param([string]$RequestedBankPath)

    $started = [DateTimeOffset]::UtcNow
    $config = Get-ProjectConfiguration
    $bankFull = Resolve-BankPath -RequestedPath $RequestedBankPath
    $bank = Read-JsonFile -Path $bankFull
    $defaults = Get-PropertyValue -Object $bank -Name 'defaults'
    $defaultGroupNames = @(Get-PropertyValue -Object $defaults -Name 'groups' -Default @() | ForEach-Object { [string]$_ })
    $defaultBudgetKB = [int](Get-PropertyValue -Object $defaults -Name 'max_kb' -Default 0)
    $defaultBudgetBytes = [int64]$defaultBudgetKB * 1024
    $skipDirectories = @(Get-PropertyValue -Object $defaults -Name 'skip_dirs' -Default @())
    $settings = Resolve-TextSettings -Config $config
    $candidates = @(Get-CandidateRelativePaths -Settings $settings -SkipDirectories $skipDirectories)
    $groupsObject = Get-PropertyValue -Object $bank -Name 'groups'
    $groupReports = New-Object System.Collections.Generic.List[object]
    $totalUnmatched = 0
    $overBudgetGroups = 0
    $activeOverBudgetGroups = 0
    $defaultOverBudgetGroups = 0
    $nearBudgetGroups = 0
    $packOverBudgetGroups = 0
    $activePackOverBudgetGroups = 0
    $defaultPackOverBudgetGroups = 0
    $nearPackBudgetGroups = 0

    foreach ($property in @($groupsObject.PSObject.Properties | Sort-Object Name)) {
        $groupObject = $property.Value
        $paths = Get-PropertyValue -Object $groupObject -Name 'paths'
        if ($null -eq $paths) { $paths = Get-PropertyValue -Object $groupObject -Name 'files' -Default @() }
        $patterns = @($paths | ForEach-Object { ([string]$_).Trim().Replace('\', '/').TrimStart('/') } | Where-Object { $_ })
        $matched = New-Object System.Collections.Generic.List[string]
        $unmatched = New-Object System.Collections.Generic.List[string]
        foreach ($pattern in $patterns) {
            $patternMatches = @($candidates | Where-Object { Test-PathMatchesPattern -RelativePath $_ -Pattern $pattern })
            if ($patternMatches.Count -eq 0) {
                $unmatched.Add($pattern)
                $totalUnmatched++
            }
            else {
                foreach ($match in $patternMatches) { $matched.Add([string]$match) }
            }
        }
        $uniqueMatches = @($matched | Sort-Object -Unique)
        $sourceBytes = [int64]0
        $estimatedPackBytes = $script:ContextPackBaseEstimateBytes
        foreach ($relative in $uniqueMatches) {
            $full = Get-NormalizedAbsolutePath -Path $relative -BasePath $script:RepoRoot
            if (Test-Path -LiteralPath $full -PathType Leaf) {
                $fileBytes = [int64](Get-Item -LiteralPath $full).Length
                $sourceBytes += $fileBytes
                $estimatedPackBytes += Get-ContextBlockEstimateBytes -RelativePath $relative -ContentBytes $fileBytes
            }
        }
        $groupStatus = [string](Get-PropertyValue -Object $groupObject -Name 'status' -Default '')
        $isDefaultGroup = $defaultGroupNames -contains [string]$property.Name
        $sourceBudgetStatus = if ($defaultBudgetBytes -gt 0 -and $sourceBytes -gt $defaultBudgetBytes) {
            $overBudgetGroups++
            if ($groupStatus -eq 'active') { $activeOverBudgetGroups++ }
            if ($isDefaultGroup) { $defaultOverBudgetGroups++ }
            'over-default-budget'
        }
        elseif ($defaultBudgetBytes -gt 0 -and $sourceBytes -gt [int64][math]::Floor($defaultBudgetBytes * 0.8)) {
            $nearBudgetGroups++
            'near-default-budget'
        }
        else {
            'within-default-budget'
        }
        $packBudgetStatus = if ($defaultBudgetBytes -gt 0 -and $estimatedPackBytes -gt $defaultBudgetBytes) {
            $packOverBudgetGroups++
            if ($groupStatus -eq 'active') { $activePackOverBudgetGroups++ }
            if ($isDefaultGroup) { $defaultPackOverBudgetGroups++ }
            'over-default-budget'
        }
        elseif ($defaultBudgetBytes -gt 0 -and $estimatedPackBytes -gt [int64][math]::Floor($defaultBudgetBytes * 0.8)) {
            $nearPackBudgetGroups++
            'near-default-budget'
        }
        else {
            'within-default-budget'
        }
        $groupReports.Add([pscustomobject][ordered]@{
            name = $property.Name
            status = $groupStatus
            default_selected = [bool]$isDefaultGroup
            pattern_count = $patterns.Count
            matched_file_count = $uniqueMatches.Count
            source_bytes = $sourceBytes
            source_budget_status = $sourceBudgetStatus
            source_budget_overage_bytes = if ($defaultBudgetBytes -gt 0 -and $sourceBytes -gt $defaultBudgetBytes) { [int64]($sourceBytes - $defaultBudgetBytes) } else { [int64]0 }
            estimated_pack_bytes = $estimatedPackBytes
            pack_budget_status = $packBudgetStatus
            pack_budget_overage_bytes = if ($defaultBudgetBytes -gt 0 -and $estimatedPackBytes -gt $defaultBudgetBytes) { [int64]($estimatedPackBytes - $defaultBudgetBytes) } else { [int64]0 }
            unmatched_patterns = @($unmatched)
        })
    }

    $elapsed = [DateTimeOffset]::UtcNow - $started
    return [pscustomobject][ordered]@{
        schema = 'gknome_context_bank_audit_v1'
        status = if ($totalUnmatched -eq 0 -and $activePackOverBudgetGroups -eq 0 -and $defaultPackOverBudgetGroups -eq 0) { 'pass' } else { 'warning' }
        bank_path = $bankFull
        candidate_file_count = $candidates.Count
        group_count = $groupReports.Count
        default_budget_kb = $defaultBudgetKB
        unmatched_pattern_count = $totalUnmatched
        over_default_budget_group_count = $overBudgetGroups
        active_over_default_budget_group_count = $activeOverBudgetGroups
        default_selected_over_budget_group_count = $defaultOverBudgetGroups
        near_default_budget_group_count = $nearBudgetGroups
        pack_over_default_budget_group_count = $packOverBudgetGroups
        active_pack_over_default_budget_group_count = $activePackOverBudgetGroups
        default_selected_pack_over_budget_group_count = $defaultPackOverBudgetGroups
        near_default_pack_budget_group_count = $nearPackBudgetGroups
        groups = @($groupReports.ToArray())
        elapsed_ms = [math]::Round($elapsed.TotalMilliseconds, 3)
    }
}

function Clean-ContextArtifacts {
    if (-not $Yes) {
        throw 'Context clean requires -Yes after reviewing the ignored generated paths.'
    }

    $removed = New-Object System.Collections.Generic.List[string]
    foreach ($relative in @('.artifacts\context', '.artifacts\rebuild')) {
        $full = Join-Path $script:RepoRoot $relative
        if (Test-Path -LiteralPath $full) {
            Remove-Item -LiteralPath $full -Recurse -Force
            $removed.Add($full)
        }
    }
    return [pscustomobject][ordered]@{
        schema = 'gknome_context_clean_result_v1'
        status = 'pass'
        removed = @($removed.ToArray())
    }
}

function Write-Result {
    param([Parameter(Mandatory = $true)]$Result)

    if ($AsJson) {
        Write-Output ($Result | ConvertTo-Json -Depth 40 -Compress)
        return
    }

    $schema = [string](Get-PropertyValue -Object $Result -Name 'schema' -Default '')
    switch ($schema) {
        'gknome_context_status_v1' {
            Write-Host "Project: $($Result.project)"
            Write-Host "Template: $($Result.template_version)"
            Write-Host "PowerShell: $($Result.powershell)"
            Write-Host "Python required: $($Result.python_required)"
            Write-Host "Bank: $($Result.bank_path)"
            Write-Host "Groups: $($Result.available_groups -join ', ')"
            Write-Host "Default groups: $($Result.default_groups -join ', ')"
            Write-Host "Budget: $($Result.default_budget_kb) KB"
            Write-Host "Latest pack: $($Result.latest_pack)"
        }
        'gknome_context_group_list_v1' {
            foreach ($entry in $Result.groups) {
                Write-Host "$($entry.name) [$($entry.status)] - $($entry.path_count) path(s) - $($entry.description)"
            }
        }
        'gknome_context_bank_audit_v1' {
            Write-Host "Context bank audit: $($Result.status)"
            Write-Host "Candidates: $($Result.candidate_file_count); groups: $($Result.group_count); unmatched patterns: $($Result.unmatched_pattern_count)"
            Write-Host "Default budget: $($Result.default_budget_kb) KiB; estimated packs over budget: $($Result.pack_over_default_budget_group_count); near budget: $($Result.near_default_pack_budget_group_count); default selection over budget: $($Result.default_selected_pack_over_budget_group_count)"
            foreach ($entry in $Result.groups) {
                Write-Host " - $($entry.name): $($entry.matched_file_count) file(s), $($entry.source_bytes) source bytes, $($entry.estimated_pack_bytes) estimated pack bytes, $($entry.pack_budget_status), $($entry.unmatched_patterns.Count) unmatched"
                foreach ($pattern in $entry.unmatched_patterns) { Write-Host "   unmatched: $pattern" }
            }
        }
        'gknome_context_build_result_v1' {
            Write-Host "Context pack built: $($Result.pack_path)"
            Write-Host "Pack ID: $($Result.pack_id)"
            Write-Host "Files: $($Result.file_count); omitted: $($Result.omitted_count); bytes: $($Result.pack_bytes)"
            Write-Host "Elapsed: $($Result.elapsed_ms) ms"
        }
        'gknome_context_verify_result_v1' {
            Write-Host "Context pack verified: $($Result.pack_path)"
            Write-Host "Pack ID: $($Result.pack_id); files: $($Result.file_count); bytes: $($Result.pack_bytes)"
            Write-Host "Manifest verified: $($Result.manifest_verified)"
            Write-Host "Source fresh: $($Result.source_fresh)"
            if ($Result.source_freshness -and -not [bool]$Result.source_fresh) {
                Write-Host "Source freshness status: $($Result.source_freshness.status)"
                Write-Host "Missing: $([string]::Join(', ', @($Result.source_freshness.missing)))"
                Write-Host "Changed: $(@($Result.source_freshness.changed).Count)"
                Write-Host "New in selected scope: $([string]::Join(', ', @($Result.source_freshness.newly_selected)))"
            }
            Write-Host "Elapsed: $($Result.elapsed_ms) ms"
        }
        'gknome_context_rebuild_result_v1' {
            Write-Host "Context pack rebuilt: $($Result.destination)"
            Write-Host "Pack ID: $($Result.pack_id); files: $($Result.file_count); apply: $($Result.apply)"
            Write-Host "Proof: $($Result.proof_path)"
        }
        'gknome_context_clean_result_v1' {
            Write-Host "Removed generated context paths: $($Result.removed.Count)"
            foreach ($path in $Result.removed) { Write-Host " - $path" }
        }
        default {
            Write-Output ($Result | ConvertTo-Json -Depth 40)
        }
    }
}

switch ($Mode) {
    'Status' {
        Write-Result -Result (Get-ContextStatus -RequestedBankPath $BankPath)
    }
    'List' {
        Write-Result -Result (Get-ContextGroupList -RequestedBankPath $BankPath)
    }
    'Audit' {
        Write-Result -Result (Audit-ContextBank -RequestedBankPath $BankPath)
    }
    'Build' {
        $result = Invoke-WithContextLock -Action {
            Build-ContextPack -RequestedGroups $Group -RequestedBankPath $BankPath -RequestedOutputPath $OutputPath -RequestedBudgetKB $BudgetKB -DisableTree:$NoTree
        }
        Write-Result -Result $result
    }
    'BuildFull' {
        $result = Invoke-WithContextLock -Action {
            Build-ContextPack -All -RequestedGroups @() -RequestedBankPath $BankPath -RequestedOutputPath $OutputPath -RequestedBudgetKB $BudgetKB -DisableTree:$NoTree
        }
        Write-Result -Result $result
    }
    'Verify' {
        $requested = if ($PackPath) { $PackPath } else { $OutputPath }
        $result = Invoke-WithContextLock -Action {
            Verify-ContextPack -RequestedPackPath $requested
        }
        Write-Result -Result $result
        if ([string]$result.status -ne 'pass') { exit 3 }
    }
    'Rebuild' {
        $requested = if ($PackPath) { $PackPath } else { $OutputPath }
        $result = Invoke-WithContextLock -Action {
            Rebuild-ContextPack -RequestedPackPath $requested -RequestedDestinationPath $DestinationPath -ApplyChanges:$Apply -AllowOverwrite:$Force
        }
        Write-Result -Result $result
    }
    'Clean' {
        $result = Invoke-WithContextLock -Action {
            Clean-ContextArtifacts
        }
        Write-Result -Result $result
    }
}

# A successful context command must not inherit a nonzero LASTEXITCODE from a
# deliberately bounded Git fallback or another child process. Exceptions
# still terminate before this point with a nonzero process result.
exit 0
