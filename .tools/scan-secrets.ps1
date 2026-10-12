#Requires -Version 5.1

<##
.SYNOPSIS
    Scans project source for likely secret material without printing values.

.DESCRIPTION
    The scanner is deliberately conservative at the boundaries: operator
    secret stores remain opaque, Git paths are read with NUL delimiters, and a
    file that cannot be inspected is reported as incomplete rather than clean.
##>

[CmdletBinding()]
param(
    [switch]$FailOnFindings,

    [string]$RepositoryRoot = '',

    [int64]$MaxFileBytes = 2MB,

    [string[]]$ExpectedDeletionPath = @(),

    [switch]$AsJson
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
$script:Utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$script:Utf16LittleEndian = New-Object System.Text.UnicodeEncoding($false, $false, $true)
$script:Utf16BigEndian = New-Object System.Text.UnicodeEncoding($true, $false, $true)
$script:SecretScanCore = Join-Path $PSScriptRoot 'secret-scan-core.ps1'
if (-not (Test-Path -LiteralPath $script:SecretScanCore -PathType Leaf)) { throw "Secret scan core is missing: $script:SecretScanCore" }
. $script:SecretScanCore

function Get-RelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $pathFull = [System.IO.Path]::GetFullPath($Path)
    $prefix = $rootFull + [System.IO.Path]::DirectorySeparatorChar
    if (-not $pathFull.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside repository root: $pathFull"
    }
    return $pathFull.Substring($prefix.Length).Replace('\', '/')
}

function Get-GitPathList {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $parts = @(& git -c ("safe.directory=$script:RepoRoot") -C $script:RepoRoot @Arguments 2>$null)
        $exitCode = [int]$LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($exitCode -ne 0) {
        return [pscustomobject][ordered]@{ ok = $false; paths = @() }
    }

    # Do not trim or split on newlines. Git's -z contract is the only safe
    # delimiter for Unicode, whitespace, and newline-bearing filenames.
    $raw = ($parts | ForEach-Object { [string]$_ }) -join ''
    $paths = @($raw -split ([char]0) | Where-Object { $_ -ne '' } | ForEach-Object { ([string]$_).Replace('\', '/') })
    return [pscustomobject][ordered]@{ ok = $true; paths = @($paths) }
}

function Test-ExternalGitPointer {
    $markerPath = Join-Path $script:RepoRoot '.git'
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) { return $false }
    try {
        $item = Get-Item -LiteralPath $markerPath -Force -ErrorAction Stop
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or $item.Length -gt 4096) { return $false }
        $text = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($markerPath))
        return ($text -match '(?im)^\s*gitdir\s*:\s*\S+')
    }
    catch {
        return $false
    }
}

function Test-OpaquePath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $normalized = $RelativePath.Replace('\', '/').TrimStart('/')
    foreach ($segment in @($normalized -split '/')) {
        if ($segment.Equals('.git', [System.StringComparison]::OrdinalIgnoreCase) -or
            $segment.Equals('.artifacts', [System.StringComparison]::OrdinalIgnoreCase) -or
            $segment.Equals('.runtime', [System.StringComparison]::OrdinalIgnoreCase) -or
            $segment.Equals('.secrets', [System.StringComparison]::OrdinalIgnoreCase) -or
            $segment.Equals('node_modules', [System.StringComparison]::OrdinalIgnoreCase) -or
            $segment.Equals('__pycache__', [System.StringComparison]::OrdinalIgnoreCase) -or
            $segment.Equals('.venv', [System.StringComparison]::OrdinalIgnoreCase) -or
            $segment.Equals('venv', [System.StringComparison]::OrdinalIgnoreCase) -or
            $segment.Equals('runtime-data', [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    foreach ($privatePath in @('.tools/.secrets', '.tools/secrets', '.tools/local', '.agents/local')) {
        if ($normalized.Equals($privatePath, [System.StringComparison]::OrdinalIgnoreCase) -or
            $normalized.StartsWith($privatePath + '/', [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

function Test-GeneratedTreePath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $segments = @($RelativePath.Replace('\', '/') -split '/')
    for ($index = 0; $index -lt $segments.Count; $index++) {
        $segment = [string]$segments[$index]
        if ($segment -notin @('output', 'logs', 'dist', 'build', 'target', 'coverage')) { continue }
        if ($index -gt 0 -and [string]$segments[$index - 1] -ieq 'skills') { continue }
        return $true
    }
    return $false
}

function Test-TrackedSensitivePath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $normalized = $RelativePath.Replace('\', '/').TrimStart('/')
    foreach ($privatePath in @('.tools/.secrets', '.tools/secrets', '.secrets')) {
        if ($normalized.Equals($privatePath, [System.StringComparison]::OrdinalIgnoreCase) -or
            $normalized.StartsWith($privatePath + '/', [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return (Test-RiskyFileName -RelativePath $normalized)
}

function Test-RiskyFileName {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $leaf = [System.IO.Path]::GetFileName($RelativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    if ($leaf -match '^(?i:\.env(?:\.|$))' -and $leaf -notmatch '^(?i:\.env\.example)$') { return $true }
    if ($leaf -match '(?i)\.(pem|key|pfx|p12|kdbx|token|secret)$') { return $true }
    if ($leaf -match '(?i)^(gt\.txt|\.npmrc|\.pypirc|\.netrc|_netrc|id_rsa(?:\..*)?|id_ed25519(?:\..*)?)$') { return $true }
    return $false
}

function Test-ProbablyTextPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $name = [System.IO.Path]::GetFileName($Path)
    if ($name -in @('.gitignore', '.gitattributes', 'LICENSE', 'Cargo.lock', '.env.example')) { return $true }
    $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    if ($extension -in @(
        '.md', '.txt', '.json', '.ps1', '.psm1', '.cmd', '.bat', '.yml',
        '.yaml', '.toml', '.ini', '.cfg', '.js', '.mjs', '.ts', '.tsx',
        '.jsx', '.html', '.css', '.rs', '.gml', '.py', '.pyi', '.sh',
        '.bash', '.zsh', '.fish', '.c', '.h', '.cc', '.cpp', '.cxx',
        '.hpp', '.cs', '.java', '.kt', '.kts', '.go', '.rb', '.php',
        '.swift', '.dart', '.sql', '.xml', '.svg', '.vue', '.svelte',
        '.properties', '.gradle', '.make', '.mk', '.tf', '.tfvars',
        '.graphql', '.gql', '.proto', '.dockerfile', '.gltf'
    )) { return $true }
    if ($extension -in @(
        '.7z', '.avi', '.bin', '.bmp', '.class', '.dll', '.doc', '.docx', '.eot',
        '.exe', '.gif', '.ico', '.jar', '.jpeg', '.jpg', '.mov', '.mp3',
        '.glb', '.mp4', '.o', '.obj', '.pdf', '.png', '.so', '.tar', '.wav',
        '.webp', '.woff', '.woff2', '.xls', '.xlsx', '.zip', '.wasm'
    )) { return $false }
    # Unknown and extensionless paths are inspected by content so a source
    # file named without an extension is not silently omitted.
    return $true
}

function Read-BoundedTextFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][int64]$LimitBytes
    )

    try {
        $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
        if ($item.Length -gt $LimitBytes) {
            return [pscustomobject][ordered]@{ status = 'budget_exhausted'; text = $null }
        }
        $bytes = [System.IO.File]::ReadAllBytes($Path)
        $offset = 0
        $encoding = $script:Utf8Strict
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
            $offset = 3
        }
        elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
            $offset = 2
            $encoding = $script:Utf16LittleEndian
        }
        elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
            $offset = 2
            $encoding = $script:Utf16BigEndian
        }
        $text = $encoding.GetString($bytes, $offset, $bytes.Length - $offset)
        if ($text.IndexOf([char]0) -ge 0) {
            return [pscustomobject][ordered]@{ status = 'unsupported'; text = $null }
        }
        return [pscustomobject][ordered]@{ status = 'scanned'; text = $text }
    }
    catch {
        return [pscustomobject][ordered]@{ status = 'read_failed'; text = $null }
    }
}

function Add-Finding {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][System.Collections.Generic.List[object]]$Findings,
        [Parameter(Mandatory = $true)][hashtable]$Seen,
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Pattern
    )

    $key = $Path.ToLowerInvariant() + '|' + $Pattern.ToLowerInvariant()
    if ($Seen.ContainsKey($key)) { return }
    $Seen[$key] = $true
    $Findings.Add([pscustomobject][ordered]@{ path = $Path; pattern = $Pattern })
}

$patterns = @(Get-SecretPatternDefinitions)

function Get-CandidateRecords {
    $gitAvailable = (Test-Path -LiteralPath (Join-Path $script:RepoRoot '.git')) -and $null -ne (Get-Command git -ErrorAction SilentlyContinue)
    if ($gitAvailable) {
        $all = Get-GitPathList -Arguments @('ls-files', '--cached', '--others', '--exclude-standard', '--full-name', '-z')
        $tracked = Get-GitPathList -Arguments @('ls-files', '--cached', '--full-name', '-z')
        if ([bool]$all.ok -and [bool]$tracked.ok) {
            $trackedLookup = @{}
            foreach ($path in @($tracked.paths)) { $trackedLookup[[string]$path.ToLowerInvariant()] = $true }
            return [pscustomobject][ordered]@{
                source = 'git'
                degraded = $false
                records = @($all.paths | Sort-Object -Unique | ForEach-Object {
                    [pscustomobject][ordered]@{ path = [string]$_; tracked = $trackedLookup.ContainsKey(([string]$_).ToLowerInvariant()) }
                })
            }
        }
    }

    $fallback = @()
    $externalGitPointer = Test-ExternalGitPointer
    foreach ($file in @(Get-ChildItem -LiteralPath $script:RepoRoot -Recurse -Force -File -ErrorAction Stop)) {
        $fallback += [pscustomobject][ordered]@{ path = Get-RelativePath -Root $script:RepoRoot -Path $file.FullName; tracked = $false }
    }
    return [pscustomobject][ordered]@{ source = 'filesystem-fallback'; degraded = ($gitAvailable -and -not $externalGitPointer); records = @($fallback | Sort-Object path -Unique) }
}

$started = [DateTimeOffset]::UtcNow
$findings = New-Object System.Collections.Generic.List[object]
$findingKeys = @{}
$dispositions = [ordered]@{
    scanned = 0
    excluded = 0
    unsupported = 0
    read_failed = 0
    budget_exhausted = 0
    missing = 0
    reparse = 0
    risky_path = 0
    tracked_forbidden_path = 0
}
$candidateInfo = Get-CandidateRecords
$expectedDeletionLookup = @{}
$matchedExpectedDeletions = @{}
foreach ($expectedDeletion in @($ExpectedDeletionPath)) {
    if ([string]::IsNullOrWhiteSpace($expectedDeletion) -or [System.IO.Path]::IsPathRooted($expectedDeletion)) { throw "Expected deletion paths must be non-empty repository-relative paths: $expectedDeletion" }
    $normalizedExpectedDeletion = $expectedDeletion.Replace('\', '/')
    if ($normalizedExpectedDeletion.StartsWith('/') -or $normalizedExpectedDeletion -match '(^|/)\.\.?(/|$)' -or $normalizedExpectedDeletion -match '//' -or $normalizedExpectedDeletion -match '[\x00-\x1F\x7F]') {
        throw "Unsafe expected deletion path: $expectedDeletion"
    }
    $expectedDeletionLookup[$normalizedExpectedDeletion.ToLowerInvariant()] = $normalizedExpectedDeletion
}
if ($expectedDeletionLookup.Count -gt 0 -and [string]$candidateInfo.source -ne 'git') { throw 'Expected deletion paths require complete Git candidate enumeration.' }

foreach ($record in @($candidateInfo.records)) {
    $relative = [string]$record.path
    if (Test-OpaquePath -RelativePath $relative) {
        $dispositions.excluded++
        continue
    }

    $full = Join-Path $script:RepoRoot ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        $missingKey = $relative.Replace('\', '/').ToLowerInvariant()
        if ($expectedDeletionLookup.ContainsKey($missingKey)) {
            $matchedExpectedDeletions[$missingKey] = $true
            $dispositions.excluded++
            continue
        }
        $dispositions.missing++
        continue
    }
    try { $item = Get-Item -LiteralPath $full -Force -ErrorAction Stop }
    catch {
        $dispositions.read_failed++
        continue
    }
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        $dispositions.reparse++
        continue
    }

    if (Test-RiskyFileName -RelativePath $relative) {
        $dispositions.risky_path++
        Add-Finding -Findings $findings -Seen $findingKeys -Path $relative -Pattern 'risky_path'
        continue
    }
    if ([bool]$record.tracked -and (Test-GeneratedTreePath -RelativePath $relative)) {
        $dispositions.tracked_forbidden_path++
        Add-Finding -Findings $findings -Seen $findingKeys -Path $relative -Pattern 'tracked_forbidden_path'
        continue
    }
    if (-not (Test-ProbablyTextPath -Path $full)) {
        $dispositions.unsupported++
        continue
    }

    $read = Read-BoundedTextFile -Path $full -LimitBytes $MaxFileBytes
    $dispositions[[string]$read.status]++
    if ([string]$read.status -ne 'scanned') { continue }
    foreach ($pattern in $patterns) {
        if ([regex]::IsMatch([string]$read.text, [string]$pattern.regex)) {
            Add-Finding -Findings $findings -Seen $findingKeys -Path $relative -Pattern ([string]$pattern.id)
            break
        }
    }
}
foreach ($expectedDeletionKey in @($expectedDeletionLookup.Keys)) {
    if (-not $matchedExpectedDeletions.ContainsKey($expectedDeletionKey)) {
        throw "Expected deletion is not a missing Git candidate: $($expectedDeletionLookup[$expectedDeletionKey])"
    }
}

# Path-only checks cover files Git intentionally keeps out of the normal
# candidate list, including force-added operator stores and generated trees.
if ($candidateInfo.source -eq 'git') {
    $tracked = Get-GitPathList -Arguments @('ls-files', '--cached', '--full-name', '-z')
    if ([bool]$tracked.ok) {
        foreach ($relative in @($tracked.paths)) {
            $path = [string]$relative
            if (Test-TrackedSensitivePath -RelativePath $path) {
                Add-Finding -Findings $findings -Seen $findingKeys -Path $path -Pattern 'tracked_secret_path'
            }
            elseif (Test-GeneratedTreePath -RelativePath $path) {
                Add-Finding -Findings $findings -Seen $findingKeys -Path $path -Pattern 'tracked_forbidden_path'
            }
        }
    }
}

$unique = @($findings | Sort-Object path, pattern -Unique)
$incomplete = [int]$dispositions.read_failed + [int]$dispositions.budget_exhausted + [int]$dispositions.missing
if ([bool]$candidateInfo.degraded) { $incomplete++ }
$status = if ($unique.Count -gt 0) { 'fail' } elseif ($incomplete -gt 0) { 'incomplete' } else { 'pass' }
$skipped = [int]$dispositions.excluded + [int]$dispositions.unsupported + [int]$dispositions.read_failed + [int]$dispositions.budget_exhausted + [int]$dispositions.missing + [int]$dispositions.reparse
$elapsed = [DateTimeOffset]::UtcNow - $started
$result = [pscustomobject][ordered]@{
    schema = 'gknome_secret_scan_v2'
    status = $status
    generated_at_utc = [DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
    repository = Split-Path -Leaf $script:RepoRoot
    candidate_source = [string]$candidateInfo.source
    candidate_enumeration_degraded = [bool]$candidateInfo.degraded
    max_file_bytes = [int64]$MaxFileBytes
    scanned_files = [int]$dispositions.scanned
    skipped_files = $skipped
    incomplete_count = $incomplete
    dispositions = [pscustomobject]$dispositions
    findings_count = $unique.Count
    findings = $unique
    values_exposed = $false
    elapsed_ms = [math]::Round($elapsed.TotalMilliseconds, 3)
}

if ($AsJson) {
    Write-Output ($result | ConvertTo-Json -Depth 20 -Compress)
}
else {
    if ($status -eq 'pass') {
        Write-Host "Secret scan passed. Scanned $($result.scanned_files) file(s); skipped $($result.skipped_files)."
    }
    elseif ($status -eq 'incomplete') {
        Write-Host "Secret scan incomplete: $($result.incomplete_count) file(s) could not be inspected."
    }
    else {
        Write-Host "Secret scan failed with $($unique.Count) finding(s):"
        foreach ($finding in $unique) { Write-Host " - $($finding.path) [$($finding.pattern)]" }
    }
    Write-Host "Elapsed: $($result.elapsed_ms) ms"
}

if ($FailOnFindings -and $unique.Count -gt 0) {
    throw "Secret scan failed with $($unique.Count) finding(s)."
}
if ($status -ne 'pass') { exit 1 }
exit 0
