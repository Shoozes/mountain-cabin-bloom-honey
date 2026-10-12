#Requires -Version 5.1

function Invoke-SecretHistoryGit {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $parts = @(& git -c ("safe.directory=$RepositoryRoot") -c 'core.quotepath=false' -C $RepositoryRoot @Arguments 2>$null)
        $exitCode = [int]$LASTEXITCODE
    }
    finally { $ErrorActionPreference = $previousErrorAction }
    if ($exitCode -ne 0) { throw "Git history inspection failed for '$($Arguments -join ' ')'." }
    return (($parts | ForEach-Object { [string]$_ }) -join "`n")
}

function ConvertTo-SecretHistoryProcessArgument {
    param([AllowEmptyString()][string]$Value)

    if ($null -eq $Value -or $Value -notmatch '[\s"]') { return [string]$Value }
    $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}

function Invoke-SecretHistoryGitBytes {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][int64]$MaximumBytes,
        [int]$MaximumMilliseconds = 15000
    )

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = 'git'
    $argumentTexts = @(@('-c', "safe.directory=$RepositoryRoot", '-c', 'core.quotepath=false') + @($Arguments) |
        ForEach-Object { ConvertTo-SecretHistoryProcessArgument -Value ([string]$_) })
    $startInfo.Arguments = $argumentTexts -join ' '
    $startInfo.WorkingDirectory = $RepositoryRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    $bytes = New-Object System.IO.MemoryStream
    try {
        if (-not $process.Start()) { throw 'Git history process did not start.' }
        $process.StandardInput.Close()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        $buffer = New-Object byte[] 8192
        $captureLimit = [Math]::Max(0L, $MaximumBytes) + 1L
        $deadline = [DateTime]::UtcNow.AddMilliseconds($MaximumMilliseconds)
        $readTask = $process.StandardOutput.BaseStream.ReadAsync($buffer, 0, $buffer.Length)
        while ($true) {
            while (-not $readTask.IsCompleted) {
                if ([DateTime]::UtcNow -ge $deadline) { throw "Git history inspection timed out for '$($Arguments -join ' ')'." }
                Start-Sleep -Milliseconds 5
            }
            $count = [int]$readTask.GetAwaiter().GetResult()
            if ($count -le 0) { break }
            if ($bytes.Length -lt $captureLimit) {
                $copyCount = [int][Math]::Min([int64]$count, $captureLimit - $bytes.Length)
                $bytes.Write($buffer, 0, $copyCount)
            }
            $readTask = $process.StandardOutput.BaseStream.ReadAsync($buffer, 0, $buffer.Length)
        }
        while (-not $process.HasExited) {
            if ([DateTime]::UtcNow -ge $deadline) { throw "Git history inspection timed out for '$($Arguments -join ' ')'." }
            Start-Sleep -Milliseconds 5
        }
        while (-not $stderrTask.IsCompleted) {
            if ([DateTime]::UtcNow -ge $deadline) { throw "Git history error capture timed out for '$($Arguments -join ' ')'." }
            Start-Sleep -Milliseconds 5
        }
        [void]$stderrTask.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw "Git history inspection failed for '$($Arguments -join ' ')'." }
        return [pscustomobject][ordered]@{
            bytes = $bytes.ToArray()
            oversized = ($bytes.Length -gt $MaximumBytes)
        }
    }
    finally {
        try {
            if ($null -ne $process -and -not $process.HasExited) { $process.Kill(); [void]$process.WaitForExit(1000) }
        }
        catch { }
        $bytes.Dispose()
        $process.Dispose()
    }
}

function Get-SecretHistoryObjectSize {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot, [Parameter(Mandatory = $true)][string]$ObjectId)
    $text = Invoke-SecretHistoryGit -RepositoryRoot $RepositoryRoot -Arguments @('cat-file', '-s', $ObjectId)
    $size = 0L
    if (-not [int64]::TryParse($text.Trim(), [ref]$size) -or $size -lt 0) { throw "Git returned an invalid object size for '$ObjectId'." }
    return $size
}

function Get-SecretHistoryBinaryText {
    param(
        [Parameter(Mandatory = $true)][byte[]]$Bytes
    )

    # Secret markers and private-key delimiters are ASCII. Preserve those bytes
    # for pattern matching while replacing non-ASCII bytes with '?' so binary
    # evidence can be inspected without pretending it is valid source text.
    return [System.Text.Encoding]::ASCII.GetString($Bytes)
}

function Get-SecretHistoryBlobText {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$ObjectId,
        [int64]$MaxFileBytes = 2MB
    )

    $size = Get-SecretHistoryObjectSize -RepositoryRoot $RepositoryRoot -ObjectId $ObjectId
    if ($size -gt $MaxFileBytes) { return [pscustomobject][ordered]@{ status = 'budget_exhausted'; text = $null } }
    try {
        $raw = Invoke-SecretHistoryGitBytes -RepositoryRoot $RepositoryRoot -Arguments @('cat-file', 'blob', $ObjectId) -MaximumBytes $MaxFileBytes
        if ([bool]$raw.oversized) { return [pscustomobject][ordered]@{ status = 'budget_exhausted'; text = $null } }
        $bytes = [byte[]]$raw.bytes
        $offset = 0
        $encoding = New-Object System.Text.UTF8Encoding($false, $true)
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
            $offset = 3
        }
        elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
            $offset = 2
            $encoding = New-Object System.Text.UnicodeEncoding($false, $false, $true)
        }
        elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
            $offset = 2
            $encoding = New-Object System.Text.UnicodeEncoding($true, $false, $true)
        }
        $text = $encoding.GetString($bytes, $offset, $bytes.Length - $offset)
        if ($text.IndexOf([char]0) -ge 0) {
            return [pscustomobject][ordered]@{ status = 'binary_scanned'; text = (Get-SecretHistoryBinaryText -Bytes $bytes) }
        }
        return [pscustomobject][ordered]@{ status = 'scanned'; text = $text }
    }
    catch [System.Text.DecoderFallbackException] {
        return [pscustomobject][ordered]@{ status = 'binary_scanned'; text = (Get-SecretHistoryBinaryText -Bytes $bytes) }
    }
    catch {
        return [pscustomobject][ordered]@{ status = 'read_failed'; text = $null }
    }
}

function Get-SecretHistoryPathDisposition {
    param([Parameter(Mandatory = $true)][string]$Path)

    $normalized = $Path.Replace('\', '/').TrimStart('/')
    foreach ($privatePath in @('.tools/.secrets', '.tools/secrets', '.secrets')) {
        if ($normalized.Equals($privatePath, [System.StringComparison]::OrdinalIgnoreCase) -or
            $normalized.StartsWith($privatePath + '/', [System.StringComparison]::OrdinalIgnoreCase)) {
            return 'tracked_secret_path'
        }
    }
    $leaf = [System.IO.Path]::GetFileName($normalized.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    if (($leaf -match '^(?i:\.env(?:\.|$))' -and $leaf -notmatch '^(?i:\.env\.example)$') -or
        $leaf -match '(?i)\.(pem|key|pfx|p12|kdbx|token|secret)$' -or
        $leaf -match '(?i)^(gt\.txt|\.npmrc|\.pypirc|\.netrc|_netrc|id_rsa(?:\..*)?|id_ed25519(?:\..*)?)$') {
        return 'risky_path'
    }
    $segments = @($normalized -split '/')
    for ($index = 0; $index -lt $segments.Count; $index++) {
        $segment = [string]$segments[$index]
        if ($segment -notin @('output', 'logs', 'dist', 'build', 'target', 'coverage')) { continue }
        if ($index -gt 0 -and [string]$segments[$index - 1] -ieq 'skills') { continue }
        return 'tracked_forbidden_path'
    }
    return ''
}

function Get-SecretHistoryPolicyFingerprint {
    param([Parameter(Mandatory = $true)][string[]]$PolicyPaths)

    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($path in @($PolicyPaths | Sort-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Secret scan policy file is missing: $path" }
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { $hash = (([System.BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '').ToLowerInvariant()) }
        finally { $sha.Dispose() }
        $lines.Add(([System.IO.Path]::GetFullPath($path) + '|' + $bytes.Length + '|' + $hash))
    }
    $digest = [System.Security.Cryptography.SHA256]::Create()
    try {
        return (([System.BitConverter]::ToString($digest.ComputeHash((New-Object System.Text.UTF8Encoding($false)).GetBytes(($lines -join "`n")))) -replace '-', '').ToLowerInvariant())
    }
    finally { $digest.Dispose() }
}

function Get-SecretHistoryRefSha {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot, [Parameter(Mandatory = $true)][string]$Ref)

    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $text = (& git -c ("safe.directory=$RepositoryRoot") -C $RepositoryRoot rev-parse --verify $Ref 2>$null | Out-String).Trim()
        $exitCode = [int]$LASTEXITCODE
    }
    finally { $ErrorActionPreference = $previousErrorAction }
    if ($exitCode -ne 0) { return '' }
    return $text
}

function Get-SecretHistoryReachableObjectIds {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot, [Parameter(Mandatory = $true)][string]$Commit)

    $ids = @{}
    $raw = Invoke-SecretHistoryGit -RepositoryRoot $RepositoryRoot -Arguments @('rev-list', '--objects', $Commit)
    foreach ($line in @($raw -split "`r?`n")) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $objectId = ([string]$line -split '\s+', 2)[0]
        if ($objectId -match '^[0-9a-fA-F]{40,64}$') { $ids[$objectId.ToLowerInvariant()] = $true }
    }
    return $ids
}

function Get-SecretHistoryTreeBlobEntries {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$Commit
    )

    $entries = New-Object System.Collections.Generic.List[object]
    $treeRaw = Invoke-SecretHistoryGit -RepositoryRoot $RepositoryRoot -Arguments @('ls-tree', '-r', '--full-tree', '-z', $Commit)
    foreach ($entry in @($treeRaw -split ([char]0) | Where-Object { $_ -ne '' })) {
        $tab = $entry.IndexOf("`t", [System.StringComparison]::Ordinal)
        if ($tab -lt 0) { throw "Git returned a malformed tree entry for commit '$Commit'." }
        $header = $entry.Substring(0, $tab).Split(' ')
        if ($header.Count -lt 3 -or $header[1] -ne 'blob' -or $header[2] -notmatch '^[0-9a-fA-F]{40,64}$') { continue }
        $entries.Add([pscustomobject][ordered]@{
            object = ([string]$header[2]).ToLowerInvariant()
            path = $entry.Substring($tab + 1).Replace('\', '/')
        })
    }
    return @($entries.ToArray())
}

function Add-SecretHistoryFinding {
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

function Assert-NoOutgoingHistorySecrets {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$CandidateSha,
        [string]$UpstreamSha = '',
        [Parameter(Mandatory = $true)][string[]]$PolicyPaths,
        [int64]$MaxFileBytes = 2MB
    )

    $candidateBefore = Get-SecretHistoryRefSha -RepositoryRoot $RepositoryRoot -Ref 'HEAD'
    if ($candidateBefore -ne $CandidateSha) { throw 'Outgoing history candidate changed before scanning.' }
    $upstreamBefore = Get-SecretHistoryRefSha -RepositoryRoot $RepositoryRoot -Ref 'origin/main'
    if ($upstreamBefore -ne $UpstreamSha) { throw 'Outgoing history upstream changed before scanning.' }
    $policyBefore = Get-SecretHistoryPolicyFingerprint -PolicyPaths $PolicyPaths

    $revArguments = @('rev-list', '--topo-order', '--reverse', $CandidateSha)
    if (-not [string]::IsNullOrWhiteSpace($UpstreamSha)) { $revArguments += @('--not', $UpstreamSha) }
    $commitsRaw = Invoke-SecretHistoryGit -RepositoryRoot $RepositoryRoot -Arguments $revArguments
    $commits = @($commitsRaw -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $findings = New-Object System.Collections.Generic.List[object]
    $findingKeys = @{}
    $blobResults = @{}
    $blobPaths = @{}
    $incomplete = New-Object System.Collections.Generic.List[object]
    $dispositions = [ordered]@{
        commits = $commits.Count
        blobs = 0
        scanned = 0
        binary_scanned = 0
        unsupported = 0
        budget_exhausted = 0
        read_failed = 0
        missing = 0
        upstream_reused = 0
        risky_path = 0
        tracked_secret_path = 0
        tracked_forbidden_path = 0
    }

    foreach ($commit in $commits) {
        $commitText = Invoke-SecretHistoryGit -RepositoryRoot $RepositoryRoot -Arguments @('cat-file', 'commit', $commit)
        $separator = $commitText.IndexOf("`n`n", [System.StringComparison]::Ordinal)
        $message = if ($separator -ge 0) { $commitText.Substring($separator + 2) } else { $commitText }
        foreach ($pattern in @(Get-SecretPatternDefinitions)) {
            if ([regex]::IsMatch($message, [string]$pattern.regex)) {
                Add-SecretHistoryFinding -Findings $findings -Seen $findingKeys -Path ("commit:{0}:message" -f $commit) -Pattern ([string]$pattern.id)
            }
        }

        foreach ($entry in @(Get-SecretHistoryTreeBlobEntries -RepositoryRoot $RepositoryRoot -Commit $commit)) {
            $objectId = [string]$entry.object
            $path = [string]$entry.path
            if (-not $blobPaths.ContainsKey($objectId)) { $blobPaths[$objectId] = New-Object System.Collections.Generic.List[string] }
            if ($blobPaths[$objectId] -notcontains $path) { $blobPaths[$objectId].Add($path) }
        }
    }

    $dispositions.blobs = $blobPaths.Count
    $upstreamObjects = @{}
    $upstreamTree = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([System.StringComparer]::Ordinal)
    if (-not [string]::IsNullOrWhiteSpace($UpstreamSha)) {
        $upstreamObjects = Get-SecretHistoryReachableObjectIds -RepositoryRoot $RepositoryRoot -Commit $UpstreamSha
        foreach ($entry in @(Get-SecretHistoryTreeBlobEntries -RepositoryRoot $RepositoryRoot -Commit $UpstreamSha)) {
            $upstreamTree[[string]$entry.path] = [string]$entry.object
        }
    }
    foreach ($objectId in @($blobPaths.Keys | Sort-Object)) {
        foreach ($path in @($blobPaths[$objectId])) {
            $pathDisposition = Get-SecretHistoryPathDisposition -Path $path
            if ([string]::IsNullOrWhiteSpace($pathDisposition)) { continue }
            if ($upstreamTree.ContainsKey([string]$path) -and [string]$upstreamTree[[string]$path] -ceq ([string]$objectId).ToLowerInvariant()) { continue }
            $dispositions[$pathDisposition]++
            Add-SecretHistoryFinding -Findings $findings -Seen $findingKeys -Path $path -Pattern $pathDisposition
        }
    }
    foreach ($objectId in @($blobPaths.Keys | Sort-Object)) {
        if ($upstreamObjects.ContainsKey(([string]$objectId).ToLowerInvariant())) {
            $dispositions.upstream_reused++
            continue
        }
        if (-not $blobResults.ContainsKey($objectId)) {
            $exists = $true
            try { [void](Invoke-SecretHistoryGit -RepositoryRoot $RepositoryRoot -Arguments @('cat-file', '-e', $objectId)) }
            catch { $exists = $false }
            if (-not $exists) {
                $dispositions.missing++
                throw "Outgoing history references a missing Git object: $objectId"
            }
            $blobResults[$objectId] = Get-SecretHistoryBlobText -RepositoryRoot $RepositoryRoot -ObjectId $objectId -MaxFileBytes $MaxFileBytes
        }
        $blob = $blobResults[$objectId]
        if ([string]$blob.status -eq 'budget_exhausted') {
            $dispositions.budget_exhausted++
            $incomplete.Add([pscustomobject][ordered]@{ object = $objectId; status = [string]$blob.status })
            continue
        }
        if ([string]$blob.status -eq 'read_failed') {
            $dispositions.read_failed++
            $incomplete.Add([pscustomobject][ordered]@{ object = $objectId; status = [string]$blob.status })
            continue
        }
        if ([string]$blob.status -eq 'binary_scanned') {
            $dispositions.binary_scanned++
        }
        elseif ([string]$blob.status -eq 'unsupported') {
            $dispositions.unsupported++
            $incomplete.Add([pscustomobject][ordered]@{ object = $objectId; status = [string]$blob.status })
            continue
        }
        elseif ([string]$blob.status -ne 'scanned') {
            $dispositions.read_failed++
            $incomplete.Add([pscustomobject][ordered]@{ object = $objectId; status = [string]$blob.status })
            continue
        }
        else {
            $dispositions.scanned++
        }
        foreach ($pattern in @(Get-SecretPatternDefinitions)) {
            if (-not [regex]::IsMatch([string]$blob.text, [string]$pattern.regex)) { continue }
            foreach ($path in @($blobPaths[$objectId])) {
                Add-SecretHistoryFinding -Findings $findings -Seen $findingKeys -Path $path -Pattern ([string]$pattern.id)
            }
        }
    }

    $candidateAfter = Get-SecretHistoryRefSha -RepositoryRoot $RepositoryRoot -Ref 'HEAD'
    $upstreamAfter = Get-SecretHistoryRefSha -RepositoryRoot $RepositoryRoot -Ref 'origin/main'
    $policyAfter = Get-SecretHistoryPolicyFingerprint -PolicyPaths $PolicyPaths
    if ($candidateAfter -ne $CandidateSha) { throw 'Outgoing history candidate changed during scanning.' }
    if ($upstreamAfter -ne $UpstreamSha) { throw 'Outgoing history upstream changed during scanning.' }
    if ($policyAfter -ne $policyBefore) { throw 'Secret scan policy changed during outgoing history scanning.' }
    if ($incomplete.Count -gt 0) {
        $incompleteDetails = @($incomplete | ForEach-Object { "$($_.object):$($_.status)" }) -join ', '
        throw "Outgoing history scan incomplete for $($incomplete.Count) Git object(s): $incompleteDetails"
    }

    $unique = @($findings | Sort-Object path, pattern -Unique)
    return [pscustomobject][ordered]@{
        schema = 'gknome_outgoing_history_scan_v1'
        status = if ($unique.Count -eq 0) { 'pass' } else { 'fail' }
        candidate_sha = $CandidateSha
        upstream_sha = if ([string]::IsNullOrWhiteSpace($UpstreamSha)) { $null } else { $UpstreamSha }
        commit_count = $commits.Count
        blob_count = $blobPaths.Count
        findings_count = $unique.Count
        findings = $unique
        incomplete_count = $incomplete.Count
        incomplete = @($incomplete.ToArray())
        dispositions = [pscustomobject]$dispositions
        policy_fingerprint = $policyBefore
        values_exposed = $false
    }
}
