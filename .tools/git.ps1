#Requires -Version 5.1

[CmdletBinding()]
param(
    [ValidateSet('status', 'log', 'pull', 'push')]
    [string]$Task = 'status',

    [string]$RepositoryRoot = '',
    [switch]$Yes,
    [switch]$CommitOnly,
    [string[]]$Path = @(),
    [string]$Message = ''
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:RepoRoot = if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
}
else {
    [System.IO.Path]::GetFullPath($RepositoryRoot)
}

function Invoke-GitRaw {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) {
        throw 'Git is not available on PATH.'
    }
    $output = @(& git -c ("safe.directory=$script:RepoRoot") -c 'core.excludesFile=' -C $script:RepoRoot @Arguments 2>&1)
    $exitCode = [int]$LASTEXITCODE
    return [pscustomobject]@{
        output = @($output | ForEach-Object { [string]$_ })
        exit_code = $exitCode
    }
}

function Assert-WindowsGitMarkerCompatible {
    $marker = Join-Path $script:RepoRoot '.git'
    if (-not (Test-Path -LiteralPath $marker -PathType Leaf)) { return }
    $item = Get-Item -LiteralPath $marker -Force -ErrorAction Stop
    if ($item.Length -gt 4096) { throw "Git marker is too large to validate safely: $marker" }
    $text = [System.IO.File]::ReadAllText($marker, (New-Object System.Text.UTF8Encoding($false, $true))).Trim()
    if ($text -match '^(?i:gitdir):\s*/(?!/|[A-Za-z]:)') {
        throw 'Windows Git cannot resolve this WSL-only .git pointer; run source-control tasks in the owning WSL distribution.'
    }
}

function Get-VerifiedRepositoryRoot {
    if (-not (Test-Path -LiteralPath $script:RepoRoot -PathType Container)) {
        throw "Repository root not found: $script:RepoRoot"
    }
    Assert-WindowsGitMarkerCompatible
    $result = Invoke-GitRaw -Arguments @('rev-parse', '--show-toplevel')
    if ($result.exit_code -ne 0 -or @($result.output).Count -eq 0) {
        throw "Not a Git repository: $script:RepoRoot"
    }
    $actual = [System.IO.Path]::GetFullPath(([string]::Join([Environment]::NewLine, @($result.output))).Trim())
    $expected = [System.IO.Path]::GetFullPath($script:RepoRoot)
    if (-not $actual.Equals($expected, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Git task must run at the repository root; resolved '$actual' instead of '$expected'."
    }
    return $expected
}

function Get-CurrentBranch {
    $result = Invoke-GitRaw -Arguments @('symbolic-ref', '--quiet', '--short', 'HEAD')
    if ($result.exit_code -ne 0 -or @($result.output).Count -eq 0) {
        throw 'Detached HEAD is unsafe for this Git task.'
    }
    return ([string]$result.output[0]).Trim()
}

function Get-Upstream {
    $result = Invoke-GitRaw -Arguments @('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}')
    if ($result.exit_code -ne 0 -or @($result.output).Count -eq 0) {
        throw 'The current branch has no configured upstream.'
    }
    return ([string]$result.output[0]).Trim()
}

function Assert-CleanWorkingTree {
    $result = Invoke-GitRaw -Arguments @('status', '--porcelain=v1')
    if ($result.exit_code -ne 0) {
        throw "Unable to inspect Git working tree: $([string]::Join([Environment]::NewLine, @($result.output)))"
    }
    if (@($result.output).Count -gt 0) {
        throw 'Git task refused: the working tree is not clean. Review or commit changes before pull/push.'
    }
}

function Confirm-GitAction {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('pull', 'push')][string]$Action,
        [Parameter(Mandatory = $true)][string]$Branch
    )

    $expected = ('{0} {1}' -f $Action.ToUpperInvariant(), $Branch)
    $answer = [string](Read-Host ("Type {0} to continue" -f $expected))
    if ($answer.Trim() -cne $expected) {
        throw "Git $Action canceled: exact confirmation was not entered."
    }
}

function Invoke-GitOutput {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $result = Invoke-GitRaw -Arguments $Arguments
    if ($result.output.Count -gt 0) {
        $result.output | ForEach-Object { Write-Output $_ }
    }
    if ($result.exit_code -ne 0) {
        throw "Git command failed with exit code $($result.exit_code)."
    }
}

$null = Get-VerifiedRepositoryRoot
switch ($Task) {
    'status' {
        Invoke-GitOutput -Arguments @('status', '--short', '--branch')
    }
    'log' {
        Invoke-GitOutput -Arguments @('log', '--oneline', '-10')
    }
    'pull' {
        if ($CommitOnly -or $Path.Count -gt 0 -or $Message) { throw 'Candidate arguments belong only to push.' }
        $helper = Join-Path $script:RepoRoot '.tools/gitpull.ps1'
        if (-not (Test-Path -LiteralPath $helper -PathType Leaf)) { throw 'The guarded local pull helper is missing.' }
        & $helper -Yes:$Yes
        if ($LASTEXITCODE -ne 0) { throw "Guarded pull failed with exit code $LASTEXITCODE." }
    }
    'push' {
        $helper = Join-Path $script:RepoRoot '.tools/gitpush.ps1'
        if (-not (Test-Path -LiteralPath $helper -PathType Leaf)) { throw 'The guarded local publisher is missing.' }
        $parameters = @{ Yes = [bool]$Yes }
        if ($CommitOnly) { $parameters.CommitOnly = $true }
        if ($Path.Count -gt 0) { $parameters.Path = $Path }
        if ($Message) { $parameters.Message = $Message }
        & $helper @parameters
        if ($LASTEXITCODE -ne 0) { throw "Guarded publication failed with exit code $LASTEXITCODE." }
    }
}
