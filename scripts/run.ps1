#Requires -Version 5.1

<#
.SYNOPSIS
    Canonical local runner for a generated Gknome project.

.DESCRIPTION
    Dispatches directly to the project-owned controller. Installation,
    generation, repair, and template updates remain owned by the separate
    gknome command.
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Task = 'menu',

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ArgumentList = @(),

    [switch]$Native
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

if ($Native) {
    throw 'The obsolete native menu has been retired. Use the PowerShell controller.'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$controller = Join-Path $repoRoot '.tools\project.ps1'

if (-not (Test-Path -LiteralPath $controller -PathType Leaf)) {
    throw "Project controller not found: $controller"
}

& $controller -Task $Task -ArgumentList @($ArgumentList)

$exitCode = 0
$lastExit = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
if ($null -ne $lastExit) {
    $exitCode = [int]$lastExit.Value
}

exit $exitCode
