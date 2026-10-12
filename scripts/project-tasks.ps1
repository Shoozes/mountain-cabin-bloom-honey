#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('project-status','project-setup','project-dev','project-test','project-typecheck','project-lint','project-build','project-build-pages','project-publish')]
    [string]$Task,
    [switch]$DryRun,
    [switch]$AsJson,
    [switch]$Yes,
    [switch]$CommitOnly,
    [string[]]$Path = @(),
    [string]$Message = ''
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$scripts = @{
    'project-setup' = @('ci','--legacy-peer-deps','--ignore-scripts')
    'project-dev' = @('run','dev')
    'project-test' = @('test')
    'project-typecheck' = @('run','typecheck')
    'project-lint' = @('run','lint')
    'project-build' = @('run','build')
    'project-build-pages' = @('run','build:pages')
}
if ($Task -ne 'project-publish' -and ($CommitOnly -or $Path.Count -gt 0 -or $Message)) {
    throw 'Publication arguments belong only to project-publish.'
}
if ($Task -eq 'project-status') {
    $project = Get-Content -Raw -LiteralPath (Join-Path $root '.tools/project.json') | ConvertFrom-Json
    $state = Get-Content -Raw -LiteralPath (Join-Path $root '.tools/project-state.json') | ConvertFrom-Json
    [ordered]@{ task = $Task; status = 'observed'; project = $project.name; profile = $project.profile; source = $project.paths.source; stage = $state.current_stage; remote = $project.git.remote; product_commands = 'package.json'; mutation = $false } | ConvertTo-Json -Compress
    exit 0
}
if ($Task -eq 'project-publish') {
    if ($CommitOnly -and ($Path.Count -eq 0 -or -not $Message.Trim())) { throw 'CommitOnly requires explicit Path and Message.' }
    if ($Message -and $Path.Count -eq 0) { throw 'Message requires an explicit Path allowlist.' }
    if ($DryRun) {
        [ordered]@{ task = $Task; status = 'planned-not-executed'; owner = '.tools/gitpush.ps1'; commit_only = [bool]$CommitOnly; paths = $Path; message = $Message; remote_creation = $false; requires_yes = $true } | ConvertTo-Json -Depth 5 -Compress
        exit 0
    }
    if (-not $Yes) { throw 'Publication requires the explicit Yes switch and reviewed task scope.' }
    $parameters = @{ Yes = $true }
    if ($CommitOnly) { $parameters.CommitOnly = $true }
    if ($Path.Count -gt 0) { $parameters.Path = $Path }
    if ($Message) { $parameters.Message = $Message }
    # No remote override, creation, force, credential fallback or shell text.
    & (Join-Path $root '.tools/gitpush.ps1') @parameters
    exit $LASTEXITCODE
}
$arguments = $scripts[$Task]
$package = Get-Content -Raw -LiteralPath (Join-Path $root 'package.json') | ConvertFrom-Json
if ($arguments[0] -eq 'run' -and $null -eq $package.scripts.PSObject.Properties[$arguments[1]]) {
    throw "The actual package has no script: $($arguments[1])"
}
$program = if ($env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }
if ($DryRun) {
    [ordered]@{ task = $Task; status = 'planned-not-executed'; program = $program; args = $arguments; cwd = $root; requires_yes = ($Task -in @('project-setup','project-build')) } | ConvertTo-Json -Depth 4 -Compress
    exit 0
}
if ($Task -in @('project-setup','project-build') -and -not $Yes) {
    throw 'Dependency installation or the full build path requires explicit Yes.'
}
Push-Location -LiteralPath $root
try { & $program @arguments; $code = $LASTEXITCODE }
finally { Pop-Location }
exit $code
