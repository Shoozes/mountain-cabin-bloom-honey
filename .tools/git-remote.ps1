#Requires -Version 5.1

<##
.SYNOPSIS
    Validates the GitHub remote forms accepted by the token-backed helpers.
#>

function Assert-GitHubRemote {
    param([Parameter(Mandatory = $true)][string]$Remote)

    if ([string]::IsNullOrWhiteSpace($Remote) -or $Remote -match '[\x00-\x1F\x7F\s]') {
        throw "Remote must be a GitHub HTTPS or SSH URL without credentials or whitespace: $Remote"
    }
    if ($Remote -match '^git@(?<host>[^:/\s]+):(?<path>.+)$') {
        if ($Matches.host -ine 'github.com') { throw "Remote must target github.com: $Remote" }
        $path = $Matches.path.Replace('\\', '/').Trim('/')
        if ($path -match '[?#]' -or @($path -split '/').Count -ne 2) { throw "Remote must identify one GitHub owner/repository pair: $Remote" }
        $segments = @($path -split '/')
        $invalidSegments = @($segments | Where-Object { $_ -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*(?:\.git)?$' })
        if ($invalidSegments.Count -gt 0) { throw "Remote contains unsupported GitHub path characters: $Remote" }
        return
    }

    $uri = $null
    if (-not [Uri]::TryCreate($Remote, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -notin @('https', 'ssh')) {
        throw "Remote must be a GitHub HTTPS or SSH URL without credentials or whitespace: $Remote"
    }
    if ($uri.Host -ine 'github.com' -or -not [string]::IsNullOrWhiteSpace($uri.UserInfo) -or -not [string]::IsNullOrWhiteSpace($uri.Query) -or -not [string]::IsNullOrWhiteSpace($uri.Fragment) -or -not $uri.IsDefaultPort) {
        throw "Remote must be a clean GitHub HTTPS or SSH URL: $Remote"
    }
    $segments = @($uri.AbsolutePath.Trim('/') -split '/')
    $invalidSegments = @($segments | Where-Object { $_ -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*(?:\.git)?$' })
    if ($segments.Count -ne 2 -or $invalidSegments.Count -gt 0) {
        throw "Remote must identify one GitHub owner/repository pair: $Remote"
    }
}

function Get-GitHubRemoteIdentity {
    param([Parameter(Mandatory = $true)][string]$Remote)

    Assert-GitHubRemote -Remote $Remote
    $path = if ($Remote -match '^git@[^:/\s]+:(?<path>.+)$') {
        $Matches.path.Replace('\\', '/').Trim('/')
    }
    else {
        ([Uri]$Remote).AbsolutePath.Trim('/')
    }
    $segments = @($path -split '/')
    $repository = $segments[1] -replace '(?i)\.git$', ''
    return [pscustomobject][ordered]@{
        owner = [string]$segments[0]
        repository = [string]$repository
        full_name = "$($segments[0])/$repository"
        https_remote = "https://github.com/$($segments[0])/$repository.git"
    }
}

function Invoke-GitHubApiRequest {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('GET', 'POST')][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [string]$Body = ''
    )

    try {
        $parameters = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
            ErrorAction = 'Stop'
            TimeoutSec = 30
        }
        if (-not [string]::IsNullOrWhiteSpace($Body)) {
            $parameters.ContentType = 'application/json'
            $parameters.Body = $Body
        }
        $response = Invoke-RestMethod @parameters
        return [pscustomobject][ordered]@{
            ok = $true
            status_code = $(if ($Method -eq 'POST') { 201 } else { 200 })
            body = $response
        }
    }
    catch {
        $statusCode = 0
        $responseProperty = $_.Exception.PSObject.Properties['Response']
        $response = if ($null -ne $responseProperty) { $responseProperty.Value } else { $null }
        $statusProperty = if ($null -ne $response) { $response.PSObject.Properties['StatusCode'] } else { $null }
        if ($null -ne $statusProperty -and $null -ne $statusProperty.Value) {
            try { $statusCode = [int]$statusProperty.Value } catch { $statusCode = 0 }
        }
        return [pscustomobject][ordered]@{
            ok = $false
            status_code = $statusCode
            body = $null
        }
    }
}

function Assert-GitHubApiSuccess {
    param(
        [Parameter(Mandatory = $true)][object]$Response,
        [Parameter(Mandatory = $true)][string]$Action
    )

    if ([bool]$Response.ok) { return }
    $status = [int]$Response.status_code
    $guidance = switch ($status) {
        401 { 'The token was rejected.' }
        403 { 'The token lacks permission, an organization policy refused creation, or GitHub rate-limited the request.' }
        404 { 'The requested GitHub owner or repository was not visible to this token.' }
        422 { 'GitHub rejected the repository name or creation policy; verify that the name is available and the token may create repositories.' }
        default { 'Check network access and GitHub API availability.' }
    }
    throw "$Action failed through the GitHub API (HTTP $status). $guidance"
}

function Ensure-GitHubRepository {
    param(
        [Parameter(Mandatory = $true)][string]$Remote,
        [Parameter(Mandatory = $true)][string]$Token,
        [switch]$CreateIfMissing,
        [ValidateSet('private', 'public')][string]$Visibility = 'private'
    )

    $identity = Get-GitHubRemoteIdentity -Remote $Remote
    $headers = @{
        Accept = 'application/vnd.github+json'
        Authorization = "Bearer $Token"
        'X-GitHub-Api-Version' = '2026-03-10'
        'User-Agent' = 'gknome-gitpush'
    }
    $owner = [Uri]::EscapeDataString([string]$identity.owner)
    $repository = [Uri]::EscapeDataString([string]$identity.repository)
    $repositoryUri = "https://api.github.com/repos/$owner/$repository"
    $existing = Invoke-GitHubApiRequest -Method GET -Uri $repositoryUri -Headers $headers
    if ([bool]$existing.ok) {
        if ([string]$existing.body.full_name -ine [string]$identity.full_name) {
            throw "GitHub returned an unexpected repository identity for $($identity.full_name)."
        }
        return [pscustomobject][ordered]@{
            status = 'existing'
            owner = [string]$identity.owner
            repository = [string]$identity.repository
            visibility = [string]$existing.body.visibility
            remote = [string]$identity.https_remote
        }
    }
    if ([int]$existing.status_code -ne 404) {
        Assert-GitHubApiSuccess -Response $existing -Action "Checking repository $($identity.full_name)"
    }
    if (-not $CreateIfMissing) {
        throw "GitHub repository $($identity.full_name) does not exist or is not visible. Pass -CreateRemote to create it with the operator token."
    }

    $user = Invoke-GitHubApiRequest -Method GET -Uri 'https://api.github.com/user' -Headers $headers
    Assert-GitHubApiSuccess -Response $user -Action 'Reading the authenticated GitHub identity'
    $authenticatedLogin = [string]$user.body.login
    if ([string]::IsNullOrWhiteSpace($authenticatedLogin)) {
        throw 'GitHub did not return an authenticated login; repository creation was not attempted.'
    }
    $createUri = if ($authenticatedLogin -ieq [string]$identity.owner) {
        'https://api.github.com/user/repos'
    }
    else {
        "https://api.github.com/orgs/$owner/repos"
    }
    $createBody = [ordered]@{
        name = [string]$identity.repository
        private = ($Visibility -eq 'private')
        auto_init = $false
    } | ConvertTo-Json -Compress
    $created = Invoke-GitHubApiRequest -Method POST -Uri $createUri -Headers $headers -Body $createBody
    if (-not [bool]$created.ok -and [int]$created.status_code -eq 422) {
        $raceCheck = Invoke-GitHubApiRequest -Method GET -Uri $repositoryUri -Headers $headers
        if ([bool]$raceCheck.ok) { $created = $raceCheck }
    }
    Assert-GitHubApiSuccess -Response $created -Action "Creating repository $($identity.full_name)"
    if ([string]$created.body.full_name -ine [string]$identity.full_name) {
        throw "GitHub created or returned an unexpected repository identity for $($identity.full_name)."
    }
    return [pscustomobject][ordered]@{
        status = $(if ([int]$created.status_code -eq 201) { 'created' } else { 'existing' })
        owner = [string]$identity.owner
        repository = [string]$identity.repository
        visibility = [string]$Visibility
        remote = [string]$identity.https_remote
    }
}
