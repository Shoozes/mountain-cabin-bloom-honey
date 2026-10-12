#Requires -Version 5.1

<#
.SYNOPSIS
    Proves that context enumeration prunes unsafe directories before descent.
#>

[CmdletBinding()]
param([switch]$AsJson)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$script:TemplateRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:ContextSource = Join-Path $script:TemplateRoot '.tools\context.ps1'
$script:StrictJsonSource = Join-Path $script:TemplateRoot '.tools\StrictJson.ps1'
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$script:Assertions = 0

function Assert-True {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Message
    )

    $script:Assertions++
    if (-not $Condition) { throw "Assertion failed: $Message" }
}

function Write-Utf8File {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Content
    )

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent -PathType Container)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($Path, $Content, $script:Utf8NoBom)
}

function Get-DirectoryAccessControl {
    param([Parameter(Mandatory = $true)][string]$Path)

    $directMethod = [System.IO.Directory].GetMethod('GetAccessControl', [type[]]@([string]))
    if ($null -ne $directMethod) {
        return $directMethod.Invoke($null, [object[]]@($Path))
    }
    $extensionsType = ([System.Management.Automation.PSTypeName]'System.IO.FileSystemAclExtensions').Type
    if ($null -eq $extensionsType) { throw 'No directory ACL API is available in this runtime.' }
    $directory = New-Object System.IO.DirectoryInfo($Path)
    $extensionMethod = @($extensionsType.GetMethods() | Where-Object {
        $_.Name -eq 'GetAccessControl' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType -eq [System.IO.DirectoryInfo]
    } | Select-Object -First 1)
    if ($extensionMethod.Count -ne 1) { throw 'No unambiguous directory ACL read API is available in this runtime.' }
    return $extensionMethod[0].Invoke($null, [object[]]@($directory.PSObject.BaseObject))
}

function Set-DirectoryAccessControl {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][System.Security.AccessControl.DirectorySecurity]$AccessControl
    )

    $directMethod = [System.IO.Directory].GetMethod('SetAccessControl', [type[]]@([string], [System.Security.AccessControl.DirectorySecurity]))
    if ($null -ne $directMethod) {
        [void]$directMethod.Invoke($null, [object[]]@($Path, $AccessControl))
        return
    }
    $extensionsType = ([System.Management.Automation.PSTypeName]'System.IO.FileSystemAclExtensions').Type
    if ($null -eq $extensionsType) { throw 'No directory ACL API is available in this runtime.' }
    $directory = New-Object System.IO.DirectoryInfo($Path)
    $extensionMethod = @($extensionsType.GetMethods() | Where-Object {
        $_.Name -eq 'SetAccessControl' -and $_.GetParameters().Count -eq 2 -and $_.GetParameters()[0].ParameterType -eq [System.IO.DirectoryInfo] -and $_.GetParameters()[1].ParameterType -eq [System.Security.AccessControl.DirectorySecurity]
    } | Select-Object -First 1)
    if ($extensionMethod.Count -ne 1) { throw 'No unambiguous directory ACL write API is available in this runtime.' }
    [void]$extensionMethod[0].Invoke($null, [object[]]@($directory.PSObject.BaseObject, $AccessControl.PSObject.BaseObject))
}

$tempBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
$testRoot = [System.IO.Path]::GetFullPath((Join-Path $tempBase ('gknome-context-fallback-' + [guid]::NewGuid().ToString('N'))))
if (-not $testRoot.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Fallback fixture escaped the temporary root: $testRoot"
}
$fixtureRoot = Join-Path $testRoot 'project'
$fixtureTools = Join-Path $fixtureRoot '.tools'
$fixtureContext = Join-Path $fixtureTools 'context.ps1'
$fixtureBank = Join-Path $fixtureRoot 'summary_bank.json'
$secretName = 'owner-token-fallback-fixture.md'
$secretValue = 'GKNOME_FALLBACK_SECRET_CONTENT_MUST_NOT_PRINT'
$protectedPaths = @(
    (Join-Path $fixtureTools '.secrets'),
    (Join-Path $fixtureTools 'secrets'),
    (Join-Path $fixtureTools 'local'),
    (Join-Path $fixtureRoot '.agents\local'),
    (Join-Path $fixtureRoot '.runtime'),
    (Join-Path $fixtureRoot '.secrets'),
    (Join-Path $fixtureRoot 'configured-skip')
)
$reparseTarget = Join-Path $testRoot 'reparse-target'
$reparseLink = Join-Path $fixtureRoot 'linked-secret'
$aclPaths = @($protectedPaths + $reparseTarget)
$originalAcls = @{}

try {
    New-Item -ItemType Directory -Path $fixtureTools -Force | Out-Null
    foreach ($fixtureDirectory in $aclPaths) {
        New-Item -ItemType Directory -Path $fixtureDirectory -Force | Out-Null
    }
    Copy-Item -LiteralPath $script:ContextSource -Destination $fixtureContext -Force
    Copy-Item -LiteralPath $script:StrictJsonSource -Destination (Join-Path $fixtureTools 'StrictJson.ps1') -Force
    Write-Utf8File -Path (Join-Path $fixtureTools 'project.json') -Content '{"schema":"gknome_project_v2","paths":{"context_bank":"summary_bank.json"},"context":{"text_extensions":[".md"],"text_file_names":[],"max_file_bytes":1048576,"default_budget_kb":32}}'
    Write-Utf8File -Path $fixtureBank -Content '{"schema":"gknome_summary_bank_v2","defaults":{"groups":["safe"],"tree":false,"max_kb":32,"skip_dirs":[".artifacts",".git",".secrets",".tools/.secrets","configured-skip"]},"groups":{"safe":{"description":"Fallback traversal fixture.","status":"active","paths":["README.md"]}}}'
    Write-Utf8File -Path (Join-Path $fixtureRoot 'README.md') -Content "Fallback traversal fixture.`n"
    foreach ($protectedPath in $protectedPaths) {
        Write-Utf8File -Path (Join-Path $protectedPath $secretName) -Content $secretValue
    }
    Write-Utf8File -Path (Join-Path $reparseTarget $secretName) -Content $secretValue

    $null = @(& cmd.exe /d /c ('mklink /J "{0}" "{1}"' -f $reparseLink, $reparseTarget) 2>&1)
    $junctionExit = [int]$LASTEXITCODE
    Assert-True -Condition ($junctionExit -eq 0 -and (Test-Path -LiteralPath $reparseLink -PathType Container)) -Message 'The fallback fixture must create its reparse-backed secret directory.'

    $currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    foreach ($protectedPath in $aclPaths) {
        $originalAcl = Get-DirectoryAccessControl -Path $protectedPath
        $originalAcls[$protectedPath] = $originalAcl.GetSecurityDescriptorSddlForm([System.Security.AccessControl.AccessControlSections]::Access)
        $blockedAcl = New-Object System.Security.AccessControl.DirectorySecurity
        $blockedAcl.SetSecurityDescriptorSddlForm([string]$originalAcls[$protectedPath], [System.Security.AccessControl.AccessControlSections]::Access)
        $denyListRule = [System.Security.AccessControl.FileSystemAccessRule]::new(
            $currentIdentity,
            [System.Security.AccessControl.FileSystemRights]::ListDirectory,
            [System.Security.AccessControl.AccessControlType]::Deny
        )
        [void]$blockedAcl.AddAccessRule($denyListRule)
        Set-DirectoryAccessControl -Path $protectedPath -AccessControl $blockedAcl
    }

    $protectedEnumerationFailures = 0
    foreach ($protectedPath in $aclPaths) {
        try { Get-ChildItem -LiteralPath $protectedPath -Force -ErrorAction Stop | Out-Null }
        catch { $protectedEnumerationFailures++ }
    }
    Assert-True -Condition ($protectedEnumerationFailures -eq $aclPaths.Count) -Message 'The fixture must prove each skipped or reparse-target directory is unreadable before audit.'

    $auditOutput = @(& $fixtureContext -Mode Audit -BankPath $fixtureBank -RepositoryRoot $fixtureRoot -AsJson 2>&1)
    $auditExit = [int]$LASTEXITCODE
    $auditText = (@($auditOutput | ForEach-Object { [string]$_ }) -join [Environment]::NewLine).Trim()
    $audit = $auditText | ConvertFrom-Json
    Assert-True -Condition ($auditExit -eq 0 -and [string]$audit.status -eq 'pass' -and [int]$audit.candidate_file_count -eq 1 -and [int]$audit.groups[0].matched_file_count -eq 1) -Message 'Git-unavailable audit must prune hard-coded, configured, and reparse directories before descent.'
    Assert-True -Condition ($auditText -notmatch [regex]::Escape($secretName) -and $auditText -notmatch [regex]::Escape($secretValue)) -Message 'Fallback audit must neither enumerate nor print skipped secret filenames or content.'

    $report = [pscustomobject][ordered]@{
        schema = 'gknome_context_fallback_test_v1'
        status = 'pass'
        powershell = $PSVersionTable.PSVersion.ToString()
        assertions = $script:Assertions
        git_enumeration_available = $false
        candidate_file_count = [int]$audit.candidate_file_count
        protected_directory_count = $aclPaths.Count
        secret_names_exposed = $false
        secret_content_exposed = $false
        reparse_directory_pruned = $true
    }
}
finally {
    foreach ($protectedPath in $aclPaths) {
        if ($originalAcls.ContainsKey($protectedPath)) {
            $originalAcl = New-Object System.Security.AccessControl.DirectorySecurity
            $originalAcl.SetSecurityDescriptorSddlForm([string]$originalAcls[$protectedPath], [System.Security.AccessControl.AccessControlSections]::Access)
            Set-DirectoryAccessControl -Path $protectedPath -AccessControl $originalAcl
        }
    }
    if (Test-Path -LiteralPath $reparseLink) {
        $reparseItem = Get-Item -LiteralPath $reparseLink -Force
        if (($reparseItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) {
            throw "Fallback fixture cleanup refused a non-reparse directory: $reparseLink"
        }
        [System.IO.Directory]::Delete($reparseLink, $false)
    }
    if (Test-Path -LiteralPath $testRoot -PathType Container) {
        if (-not $testRoot.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Fallback fixture cleanup refused an unsafe root: $testRoot"
        }
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

if ($AsJson) {
    Write-Output ($report | ConvertTo-Json -Depth 10 -Compress)
}
else {
    Write-Host "Context fallback tests passed: $($report.assertions) assertions on PowerShell $($report.powershell)."
}
