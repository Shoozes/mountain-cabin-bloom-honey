#Requires -Version 5.1

<#
.SYNOPSIS
    Runs the standard template regression and benchmark lane.
#>

[CmdletBinding()]
param(
    [switch]$AsJson,
    [switch]$KeepArtifacts
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$script:Utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$script:Started = [DateTimeOffset]::UtcNow
$script:Assertions = 0

function Assert-True {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Message
    )

    $script:Assertions++
    if (-not $Condition) { throw "Assertion failed: $Message" }
}

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    return ([System.IO.File]::ReadAllText($Path, $script:Utf8Strict) | ConvertFrom-Json)
}

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

function Get-TextSha256 {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return (($sha.ComputeHash($script:Utf8NoBom.GetBytes($Text)) | ForEach-Object { $_.ToString('x2') }) -join '')
    }
    finally {
        $sha.Dispose()
    }
}

function Get-FileSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return (($sha.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') }) -join '') }
    finally { $sha.Dispose(); $stream.Dispose() }
}

function Invoke-WithRepositoryMutex {
    param(
        [Parameter(Mandatory = $true)][string]$Purpose,
        [Parameter(Mandatory = $true)][string]$Identity,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    $mutexIdentity = $Purpose + "`n" + [System.IO.Path]::GetFullPath($Identity).ToLowerInvariant()
    $mutexKey = Get-TextSha256 -Text $mutexIdentity
    $mutex = New-Object System.Threading.Mutex($false, ('Local\gknome-' + $Purpose + '-' + $mutexKey.Substring(0, 24)))
    $held = $false
    try {
        try {
            $held = $mutex.WaitOne([TimeSpan]::FromMinutes(2))
        }
        catch [System.Threading.AbandonedMutexException] {
            $held = $true
        }
        if (-not $held) { throw "Timed out waiting for another $Purpose operation for this repository." }
        & $Action
    }
    finally {
        if ($held) { [void]$mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}

function Publish-JsonProof {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][object]$Value
    )

    $proofFull = [System.IO.Path]::GetFullPath($Path)
    $proofJson = $Value | ConvertTo-Json -Depth 20
    Invoke-WithRepositoryMutex -Purpose 'template-proof' -Identity $proofFull -Action {
        $parent = Split-Path -Parent $proofFull
        if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }

        $publicationId = $PID.ToString() + '.' + [guid]::NewGuid().ToString('N')
        $temporaryPath = Join-Path $parent ('.' + [System.IO.Path]::GetFileName($proofFull) + '.' + $publicationId + '.tmp')
        $backupPath = Join-Path $parent ('.' + [System.IO.Path]::GetFileName($proofFull) + '.' + $publicationId + '.bak')
        try {
            [System.IO.File]::WriteAllText($temporaryPath, $proofJson, $script:Utf8NoBom)
            if ([System.IO.File]::Exists($proofFull)) {
                [System.IO.File]::Replace($temporaryPath, $proofFull, $backupPath)
            }
            else {
                [System.IO.File]::Move($temporaryPath, $proofFull)
            }
        }
        finally {
            foreach ($residuePath in @($temporaryPath, $backupPath)) {
                if (Test-Path -LiteralPath $residuePath -PathType Leaf) {
                    Remove-Item -LiteralPath $residuePath -Force
                }
            }
        }
    }
}

function Remove-TestArtifactRoot {
    param([Parameter(Mandatory = $true)][string]$Path)

    for ($attempt = 1; $attempt -le 12; $attempt++) {
        try {
            if (Test-Path -LiteralPath $Path -PathType Container) {
                Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
            }
            if (Test-Path -LiteralPath $Path) {
                throw "Template test scratch path remained after cleanup: $Path"
            }
            return
        }
        catch {
            if ($attempt -eq 12) { throw }
            Start-Sleep -Milliseconds 100
        }
    }
}

function Remove-EmptyTestArtifactParent {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return }
    if (@(Get-ChildItem -LiteralPath $Path -Force -ErrorAction Stop).Count -ne 0) { return }
    Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
}

function Invoke-JsonScript {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $parameterSplat = @{}
    $index = 0
    while ($index -lt $Arguments.Count) {
        $argument = [string]$Arguments[$index]
        if ($argument -notmatch '^-[A-Za-z][A-Za-z0-9-]*$') {
            throw "Test tool arguments must use named parameters: $argument"
        }
        $name = $argument.Substring(1)
        if ($parameterSplat.ContainsKey($name)) {
            throw "Duplicate test tool parameter: $argument"
        }
        if (($index + 1) -lt $Arguments.Count -and [string]$Arguments[$index + 1] -notmatch '^-[A-Za-z][A-Za-z0-9-]*$') {
            $parameterSplat[$name] = [string]$Arguments[$index + 1]
            $index += 2
        }
        else {
            $parameterSplat[$name] = $true
            $index++
        }
    }
    $output = @(& $ScriptPath @parameterSplat)
    if ($output.Count -eq 0) { throw "Script returned no JSON: $ScriptPath" }
    $json = ($output -join [Environment]::NewLine).Trim()
    return ($json | ConvertFrom-Json)
}

function Assert-Throws {
    param(
        [Parameter(Mandatory = $true)][scriptblock]$Body,
        [Parameter(Mandatory = $true)][string]$Message
    )

    $script:Assertions++
    $threw = $false
    try {
        & $Body
    }
    catch {
        $threw = $true
    }
    if (-not $threw) { throw "Assertion failed: $Message" }
}

Push-Location -LiteralPath $script:RepoRoot
$script:LocationPushed = $true
$artifactParent = ''
$artifactRoot = ''
trap {
    $failure = $_
    if ($script:LocationPushed) {
        Pop-Location
        $script:LocationPushed = $false
    }
    if (-not $KeepArtifacts -and -not [string]::IsNullOrWhiteSpace($artifactRoot) -and (Test-Path -LiteralPath $artifactRoot -PathType Container)) {
        try {
            Remove-TestArtifactRoot -Path $artifactRoot
            if (-not [string]::IsNullOrWhiteSpace($artifactParent)) {
                Remove-EmptyTestArtifactParent -Path $artifactParent
                $artifactTop = Split-Path -Parent $artifactParent
                if (-not [string]::IsNullOrWhiteSpace($artifactTop)) { Remove-EmptyTestArtifactParent -Path $artifactTop }
            }
        }
        catch {}
    }
    throw $failure
}
$contextScript = Join-Path $script:RepoRoot '.tools\context.ps1'
$contextFallbackTestScript = Join-Path $script:RepoRoot 'tests\foundation\Test-ContextFallback.ps1'
$secretScript = Join-Path $script:RepoRoot '.tools\scan-secrets.ps1'
$lifecycleScript = Join-Path $script:RepoRoot '.tools\lifecycle.ps1'
$lifecycleStatePath = Join-Path $script:RepoRoot '.tools\project-state.json'
$projectPath = Join-Path $script:RepoRoot '.tools\project.json'
$project = Read-JsonFile -Path $projectPath
$artifactRelativePath = [string]$project.paths.artifacts
if ([string]::IsNullOrWhiteSpace($artifactRelativePath) -or [System.IO.Path]::IsPathRooted($artifactRelativePath) -or $artifactRelativePath -match '(^|[\\/])\.\.([\\/]|$)' -or $artifactRelativePath.Trim().Replace('\', '/').Trim('/') -in @('', '.')) {
    throw 'Project paths.artifacts must be a repository-relative path without parent traversal.'
}
$artifactParent = Join-Path $script:RepoRoot (Join-Path $artifactRelativePath 'template-tests')
$artifactRoot = Join-Path $artifactParent ('run-{0}-{1}' -f $PID, [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null

$requiredFiles = @(
    'AGENTS.md',
    'README.md',
    'run.cmd',
    'version.json',
    'summary_bank.json',
    '.gitignore',
    '.gitattributes',
    'scripts\run.ps1',
    'scripts\run.sh',
    '.tools\project.json',
    '.tools\project-spec.json',
    '.tools\controller.json',
    '.tools\controller.v3.json',
    '.tools\project.ps1',
    '.tools\git.ps1',
    '.tools\git-remote.ps1',
    '.tools\git-state.ps1',
    '.tools\gitpull.ps1',
    '.tools\gitpush.ps1',
    '.tools\task-runner.ps1',
    '.tools\task-specs.json',
    '.tools\lifecycle.ps1',
    '.tools\context.ps1',
    'tests\foundation\Test-Template.ps1',
    'tests\foundation\Test-ContextFallback.ps1',
    'tests\product\README.md',
    'tests\fixtures\README.md',
    '.tools\scan-secrets.ps1',
    '.tools\template-provenance.json',
    '.tools\ui\Gknome.Menu.Core.psm1',
    '.tools\ui\Gknome.Menu.Input.Windows.psm1',
    '.tools\ui\Gknome.Menu.Basic.psm1',
    '.tools\ui\Gknome.Menu.Ansi.psm1',

    '.tools\ui\themes.v1.json',
    '.agents\README.md',
    '.agents\skill-routes.json',
    '.agents\skills\gknome-sprint\SKILL.md',
    '.agents\skills\gknome-sprint\agents\openai.yaml',
    '.agents\workflows\project-handoff.md',
    'docs\README.md',
    'docs\user\README.md',
    'docs\user\SETUP.md',
    'docs\dev\README.md',
    'docs\agents\README.md',
    'docs\PROJECT_SPEC.md',
    'docs\TODO.md',
    'docs\work\README.md',
    'docs\work\done\README.md',
    'source\README.md',
    'scripts\README.md',
    'tests\README.md'
)
foreach ($relative in $requiredFiles) {
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $script:RepoRoot $relative) -PathType Leaf) -Message "Required file missing: $relative"
}
Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $script:RepoRoot '.tools\tests'))) -Message 'Repeatable tests must not live under .tools.'

$agentRoutePath = Join-Path $script:RepoRoot '.agents\README.md'
$agentRouteText = [System.IO.File]::ReadAllText($agentRoutePath, $script:Utf8Strict)
Assert-True -Condition ($agentRouteText.Contains('gknome-sprint')) -Message 'Agent route must name the project-specific gknome-sprint handoff.'
Assert-True -Condition ($agentRouteText.Contains('queue item') -and $agentRouteText.Contains('same sprint') -and $agentRouteText.Contains('person-to-person handoff') -and $agentRouteText.Contains('publish-main')) -Message 'Agent route must bind queue completion to the sprint while keeping optional handoff and publication separate.'
$skillRoutes = Read-JsonFile -Path (Join-Path $script:RepoRoot '.agents\skill-routes.json')
Assert-True -Condition ([string]$skillRoutes.schema -eq 'gknome_skill_routes_v1' -and [int]$skillRoutes.revision -eq 1) -Message 'Generated skill routes must declare the versioned route contract.'
Assert-True -Condition (@($skillRoutes.routes).Count -eq 5) -Message 'Generated skill routes must stay limited to sprint, context review, proof, handoff, and explicit publication.'
$skillRouteIds = @($skillRoutes.routes | ForEach-Object { [string]$_.id })
Assert-True -Condition (@($skillRouteIds | Sort-Object -Unique).Count -eq $skillRouteIds.Count) -Message 'Generated skill route IDs must be unique.'
$expectedSkillRouteIds = @('sprint', 'context-review', 'proof', 'handoff', 'publish-main')
$missingSkillRouteIds = @($expectedSkillRouteIds | Where-Object { $skillRouteIds -notcontains $_ })
Assert-True -Condition ($missingSkillRouteIds.Count -eq 0) -Message 'Generated skill routes must expose exactly the five active route IDs.'
$sprintRoute = @($skillRoutes.routes | Where-Object { [string]$_.id -eq 'sprint' })[0]
Assert-True -Condition (@($sprintRoute.preferred_host_skills) -contains 'gknome-sprint') -Message 'Sprint route must prefer the local gknome-sprint skill.'
$taskRegistry = Read-JsonFile -Path (Join-Path $script:RepoRoot '.tools\task-specs.json')
Assert-True -Condition ([string]$taskRegistry.schema -eq 'gknome_task_registry_v1' -and @($taskRegistry.tasks).Count -gt 0) -Message 'Generated task registry must declare the versioned registry contract with at least one task.'
Assert-True -Condition (Test-Path -LiteralPath (Join-Path $script:RepoRoot '.tools\task-runner.ps1') -PathType Leaf) -Message 'Generated declarative task runner must be present.'
Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $script:RepoRoot '.tools\skill-routes.ps1') -PathType Leaf)) -Message 'Generated projects must not ship a route-organizer script.'
$localSkillRoot = Join-Path $script:RepoRoot '.agents\skills'
$localSkillFiles = @()
if (Test-Path -LiteralPath $localSkillRoot -PathType Container) {
    $localSkillFiles = @(Get-ChildItem -LiteralPath $localSkillRoot -Recurse -File -Filter 'SKILL.md' -ErrorAction SilentlyContinue)
}
$sprintSkillText = [System.IO.File]::ReadAllText((Join-Path $localSkillRoot 'gknome-sprint\SKILL.md'), $script:Utf8Strict)
Assert-True -Condition ($sprintSkillText -match '\A---\r?\nname: gknome-sprint\r?\ndescription: [^\r\n]+\r?\n---') -Message 'gknome-sprint must have minimal valid skill frontmatter.'
Assert-True -Condition (-not $sprintSkillText.Contains('[TODO')) -Message 'gknome-sprint must not retain scaffold placeholders.'
Assert-True -Condition ($sprintSkillText.Contains('Fresh:') -and $sprintSkillText.Contains('Continue:') -and $sprintSkillText.Contains('Adapt:') -and $sprintSkillText.Contains('## Completion')) -Message 'gknome-sprint must define fresh, continue, adapt, and automatic completion paths.'
Assert-True -Condition ($sprintSkillText.Contains('Git') -and $sprintSkillText.Contains('process') -and $sprintSkillText.Contains('check') -and $sprintSkillText.Contains('open') -and $sprintSkillText.Contains('sequence') -and $sprintSkillText.Contains('recipe')) -Message 'gknome-sprint must preserve controller ordering and the curtailed task contract.'
Assert-True -Condition ($sprintSkillText -match '(?is)native\s+companion\s+is\s+headless-only.*never owns a menu' -and $sprintSkillText -notmatch '(?i)native UI may directly run') -Message 'gknome-sprint must preserve the retired-menu and PowerShell confirmation boundary.'
Assert-True -Condition ($sprintSkillText -match '(?is)Completion.*same sprint.*never wait for a\s+separate closeout or handoff request' -and $sprintSkillText -match '(?is)handoff is optional person-to-person context') -Message 'gknome-sprint completion must remove done work from active routing without making handoff a gate.'
$rootAgentText = [System.IO.File]::ReadAllText((Join-Path $script:RepoRoot 'AGENTS.md'), $script:Utf8Strict)
Assert-True -Condition ($rootAgentText -match '(?is)native\s+companion\s+is\s+headless-only.*never owns a menu' -and $rootAgentText -notmatch '(?i)native UI directly runs') -Message 'Generated first-load policy must not advertise the retired native menu.'
$workItemFiles = New-Object System.Collections.Generic.List[System.IO.FileInfo]
foreach ($workSubdirectory in @('docs\work\queue', 'docs\work\done')) {
    $workRoot = Join-Path $script:RepoRoot $workSubdirectory
    if (-not (Test-Path -LiteralPath $workRoot -PathType Container)) { continue }
    foreach ($workFile in @(Get-ChildItem -LiteralPath $workRoot -Force -File -Filter '*.md' -ErrorAction Stop | Where-Object { $_.Name -ne 'README.md' })) {
        $workItemFiles.Add($workFile)
    }
}
foreach ($workFile in $workItemFiles) {
    $workText = [System.IO.File]::ReadAllText($workFile.FullName, $script:Utf8Strict)
    foreach ($queueHeading in @('## Goal', '## Current state', '## Start here', '## Constraints', '## Out of scope', '## Done when', '## Verification', '## Completion evidence')) {
        Assert-True -Condition $workText.Contains($queueHeading) -Message "Work item '$($workFile.Name)' must define $queueHeading."
    }
}
$todoText = [System.IO.File]::ReadAllText((Join-Path $script:RepoRoot 'docs\TODO.md'), $script:Utf8Strict)
Assert-True -Condition ($todoText.Contains('future backlog') -and $todoText.Contains('docs/work/queue/')) -Message 'Generated TODO must remain future backlog and route active work to the queue.'

$controller = Read-JsonFile -Path (Join-Path $script:RepoRoot '.tools\controller.json')
$operatorController = Read-JsonFile -Path (Join-Path $script:RepoRoot '.tools\controller.v3.json')
$controllerText = [System.IO.File]::ReadAllText((Join-Path $script:RepoRoot '.tools\controller.json'), $script:Utf8Strict)
$projectControllerText = [System.IO.File]::ReadAllText((Join-Path $script:RepoRoot '.tools\project.ps1'), $script:Utf8Strict)
foreach ($requiredTask in @('sprint', 'git-pull', 'git-push', 'user-docs', 'developer-docs', 'agent-docs')) {
    Assert-True -Condition $controllerText.Contains(('"task": "' + $requiredTask + '"')) -Message "Controller must route $requiredTask."
}
$controllerTasks = @($controller.groups | ForEach-Object { @($_.actions) } | ForEach-Object { [string]$_.task })
$missingControllerTasks = @($controllerTasks | Where-Object {
    $taskPattern = "(?m)^\s*'$([regex]::Escape([string]$_))'\s*\{"
    $projectControllerText -notmatch $taskPattern
})
Assert-True -Condition ($missingControllerTasks.Count -eq 0) -Message ('Generated controller manifest tasks lack explicit routes: ' + ($missingControllerTasks -join ', '))
Assert-True -Condition ($controllerText.Contains('Open work queue') -and -not $controllerText.Contains('Open sprint board')) -Message 'Generated controller labels must describe selected work rather than a future-backlog sprint board.'

$controllerTokens = $null
$controllerParseErrors = $null
$controllerAst = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $script:RepoRoot '.tools\project.ps1'), [ref]$controllerTokens, [ref]$controllerParseErrors)
$sprintResolverDefinitions = @($controllerAst.FindAll({
            param($node)
            return $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-SprintOpenPath'
        }, $true))
Assert-True -Condition (@($controllerParseErrors).Count -eq 0 -and $sprintResolverDefinitions.Count -eq 1) -Message 'Generated project controller must define one parse-valid Get-SprintOpenPath resolver.'
if ($sprintResolverDefinitions.Count -eq 1) {
    $queueFixtureRoot = Join-Path $artifactRoot 'sprint-open-routing'
    $queueFixtureDirectory = Join-Path $queueFixtureRoot 'docs\work\queue'
    New-Item -ItemType Directory -Path $queueFixtureDirectory -Force | Out-Null
    Write-Utf8File -Path (Join-Path $queueFixtureRoot 'docs\work\README.md') -Content "# Work queue`n"
    $resolverSource = $sprintResolverDefinitions[0].Extent.Text
    Assert-True -Condition ($resolverSource.Contains('[System.IO.FileAttributes]::ReparsePoint') -and $resolverSource.Contains('Work queue item cannot be reparse-backed')) -Message 'Sprint routing must reject a reparse-backed queue Markdown leaf before opening it.'
    $queueFixtureLiteral = $queueFixtureRoot.Replace("'", "''")
    $emptyQueueResult = & ([scriptblock]::Create($resolverSource + "`nGet-SprintOpenPath -RepositoryRoot '$queueFixtureLiteral'"))
    Assert-True -Condition ([string]$emptyQueueResult -eq 'docs\work\README.md') -Message 'Sprint routing must open the stable work guide when no queue Markdown exists.'
    Write-Utf8File -Path (Join-Path $queueFixtureDirectory 'ONE.md') -Content "# One`n"
    $singleQueueResult = & ([scriptblock]::Create($resolverSource + "`nGet-SprintOpenPath -RepositoryRoot '$queueFixtureLiteral'"))
    Assert-True -Condition ([string]$singleQueueResult -eq 'docs\work\queue\ONE.md') -Message 'Sprint routing must open the only queue Markdown item directly.'
    Write-Utf8File -Path (Join-Path $queueFixtureDirectory 'TWO.md') -Content "# Two`n"
    $multipleQueueResult = & ([scriptblock]::Create($resolverSource + "`nGet-SprintOpenPath -RepositoryRoot '$queueFixtureLiteral'"))
    Assert-True -Condition ([string]$multipleQueueResult -eq 'docs\work\queue') -Message 'Sprint routing must open the queue directory when several Markdown items exist.'
}
Assert-True -Condition ($projectControllerText.Contains("'git-pull' { Invoke-ToolScript -RelativePath '.tools\gitpull.ps1'") -and $projectControllerText.Contains("'git-push' { Invoke-ToolScript -RelativePath '.tools\gitpush.ps1'")) -Message 'Generated Git controller tasks must use the approved gitpull.ps1 and gitpush.ps1 entrypoint names.'
$gitPushText = [System.IO.File]::ReadAllText((Join-Path $script:RepoRoot '.tools\gitpush.ps1'), $script:Utf8Strict)
$gitPullText = [System.IO.File]::ReadAllText((Join-Path $script:RepoRoot '.tools\gitpull.ps1'), $script:Utf8Strict)
$gitRemoteText = [System.IO.File]::ReadAllText((Join-Path $script:RepoRoot '.tools\git-remote.ps1'), $script:Utf8Strict)
$gitPushStageMarker = 'Invoke-Git @stageArguments'
Assert-True -Condition ($gitPushText.Contains(".tools\secrets\gt.txt") -and $gitPushText.Contains(".tools\.secrets\gt.txt") -and -not $gitPushText.Contains("Invoke-Git 'add' '-A'") -and $gitPushText.Contains(':(top,literal)') -and $gitPushText.Contains('ExpectedDeletionPath') -and $gitPushText.IndexOf('Invoke-SecretScan') -lt $gitPushText.IndexOf($gitPushStageMarker)) -Message 'Generated push helper must recognize canonical and legacy token paths, allow only explicit tracked deletions, and scan before bounded literal-path staging.'
Assert-True -Condition ($gitPushText.Contains('Ensure-GitHubRepository') -and $gitPushText.Contains("[ValidateSet('private', 'public')]") -and $gitRemoteText.Contains('https://api.github.com/user/repos') -and $gitRemoteText.Contains('https://api.github.com/orgs/$owner/repos') -and $gitRemoteText.Contains('auto_init = $false')) -Message 'Generated push helper must create an absent user or organization repository through the bounded GitHub API contract, private by default and without a remote seed commit.'
$gitPushPublicationStart = $gitPushText.IndexOf('$project = Read-JsonFile')
$gitPushFetchIndex = if ($gitPushPublicationStart -ge 0) { $gitPushText.IndexOf("Invoke-Git 'fetch' 'origin'", $gitPushPublicationStart) } else { -1 }
$gitPushPublicationStageIndex = if ($gitPushFetchIndex -ge 0) { $gitPushText.IndexOf($gitPushStageMarker, $gitPushFetchIndex) } else { -1 }
Assert-True -Condition ($gitPushPublicationStart -ge 0 -and $gitPushFetchIndex -gt $gitPushPublicationStart -and $gitPushPublicationStageIndex -gt $gitPushFetchIndex -and $gitPushText.Contains('Fetch failed; nothing was staged, committed, or pushed.') -and $gitPullText.Contains('Fetch failed; the working tree was not changed.')) -Message 'Generated Git publication mode must stop on fetch failure before local mutation, while tokenless candidate mode remains a separate local-only path.'
Assert-True -Condition ($gitPushText.Contains("@('status', '--porcelain', '--') + `$publishPathspecs") -and $gitPushText.Contains("@('commit', '--only', '-m', `$Message, '--') + `$publishPathspecs") -and $gitPushText.Contains("if (`$branch -cne 'main')") -and $gitPushText.Contains('Index and working-tree changes will remain untouched')) -Message 'Generated push helper must publish only main, default to push-only, and scope optional commits to selected paths.'
Assert-True -Condition ($gitPullText.IndexOf('if ($Force -and $Yes)') -lt $gitPullText.IndexOf("Invoke-Git 'reset' '--hard'") -and $gitPullText.Contains('-Yes cannot authorize -Force')) -Message 'Generated pull helper must reject generic -Yes before destructive reset/clean behavior.'
Assert-True -Condition ($gitPushText.Contains('finally') -and $gitPullText.Contains('finally') -and $gitPushText.Contains('Set-Location -LiteralPath $callerLocation.Path') -and $gitPullText.Contains('Set-Location -LiteralPath $callerLocation.Path')) -Message 'Generated Git network helpers must restore credentials and caller location in finally blocks.'
Assert-True -Condition ([string]$operatorController.schema -eq 'gknome_controller_v3' -and [string]$operatorController.operation_schema -eq 'gknome_operation_v1') -Message 'Generated operator controller must declare the versioned page and operation contracts.'
Assert-True -Condition (@($operatorController.pages).Count -gt 1 -and [string]$operatorController.pages[1].id -eq 'git') -Message 'Generated operator controller must keep Git as the second page.'
Assert-True -Condition ((@($operatorController.pages | ForEach-Object { [string]$_.id }) -join ',') -eq 'main,git,scripts') -Message 'Generated operator controller must expose exactly Main, Git, and Scripts.'
Assert-True -Condition (@($operatorController.operations | ForEach-Object { [string]$_.task } | Sort-Object -Unique).Count -eq @($operatorController.operations).Count) -Message 'Generated operator task IDs must be unique.'
$summary = Read-JsonFile -Path (Join-Path $script:RepoRoot 'summary_bank.json')
$templateProvenance = Read-JsonFile -Path (Join-Path $script:RepoRoot '.tools\template-provenance.json')
$summaryBankTemplateOwned = @($templateProvenance.files | Where-Object { [string]$_.path -eq 'summary_bank.json' }).Count -eq 1
$queueSeedTemplateOwned = @($templateProvenance.files | Where-Object { [string]$_.path -eq 'docs/work/queue/PROJECT-SPEC-SPRINT-001.md' }).Count -gt 0
Assert-True -Condition (-not $queueSeedTemplateOwned) -Message 'Generated provenance must not own the project queue seed.'
$staticSummaryPaths = @($summary.groups.PSObject.Properties | ForEach-Object { @($_.Value.paths) } | ForEach-Object { [string]$_ })
$stableWorkGuideRequired = $summaryBankTemplateOwned -and $staticSummaryPaths -notcontains 'docs/work/README.md'
$ephemeralQueueRoutes = @($staticSummaryPaths | Where-Object { $_ -like 'docs/work/queue/*' -or $_ -eq 'docs/work/queue/**' })
Assert-True -Condition (-not $stableWorkGuideRequired -and $ephemeralQueueRoutes.Count -eq 0) -Message 'Template-owned context routes must use the stable work guide, while every accepted bank must avoid ephemeral queue items and wildcards.'
$projectSpec = Read-JsonFile -Path (Join-Path $script:RepoRoot '.tools\project-spec.json')
$projectState = Invoke-WithRepositoryMutex -Purpose 'template-lifecycle' -Identity $lifecycleStatePath -Action {
    Read-JsonFile -Path $lifecycleStatePath
}
$summaryGroups = @($summary.groups.PSObject.Properties | ForEach-Object { [string]$_.Name })
$baseRoutePath = Join-Path $script:RepoRoot '.agents\skill-routes.json'
$localRoutePath = Join-Path $script:RepoRoot '.agents\skill-routes.local.json'
$effectiveRoutes = Read-JsonFile -Path $baseRoutePath
Assert-True -Condition (-not (Test-Path -LiteralPath $localRoutePath)) -Message 'Retired mutable skill-route overlays must remain absent.'
Assert-True -Condition ([string]$effectiveRoutes.schema -eq 'gknome_skill_routes_v1' -and [int]$effectiveRoutes.revision -eq 1) -Message 'Effective skill routes must declare the versioned route contract.'
$requiredRouteGroups = @($effectiveRoutes.routes | ForEach-Object { @($_.context_groups) } | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Sort-Object -Unique)
Assert-True -Condition ($requiredRouteGroups.Count -gt 0) -Message 'Effective skill routes must declare at least one context group.'
foreach ($requiredGroup in $requiredRouteGroups) {
    Assert-True -Condition ($summaryGroups -contains [string]$requiredGroup) -Message "Summary bank must route effective skill group $requiredGroup."
}
$defaultGroups = @($summary.defaults.groups | ForEach-Object { [string]$_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
Assert-True -Condition ($defaultGroups.Count -gt 0) -Message 'Summary bank must declare at least one default context group.'
foreach ($defaultGroup in $defaultGroups) {
    Assert-True -Condition ($summaryGroups -contains $defaultGroup) -Message "Summary bank default group is missing: $defaultGroup."
}
$focusedContextGroup = [string]$defaultGroups[0]
$summaryBudget = [int]$summary.defaults.max_kb
$projectBudget = [int]$project.context.default_budget_kb
Assert-True -Condition ($summaryBudget -gt 0 -and $projectBudget -eq $summaryBudget) -Message 'Summary-bank and project context budgets must share the active project default.'

$version = Read-JsonFile -Path (Join-Path $script:RepoRoot 'version.json')
Assert-True -Condition ([string]$version.template.version -eq '0.0.005') -Message 'Template version must be 0.0.005.'
Assert-True -Condition (-not [bool]$projectSpec.constraints.python_required_by_template) -Message 'The gknome foundation must not require Python even when an adopted project does.'

$lifecycleStatus = Invoke-WithRepositoryMutex -Purpose 'template-lifecycle' -Identity $lifecycleStatePath -Action {
    Invoke-JsonScript -ScriptPath $lifecycleScript -Arguments @('-Mode', 'Status', '-AsJson')
}
Assert-True -Condition ([string]$lifecycleStatus.status -eq 'available') -Message 'Lifecycle status must be available.'
Assert-True -Condition ([string]$lifecycleStatus.current_stage.id -eq [string]$projectState.current_stage) -Message 'Lifecycle status must report the tracked current stage.'

$lifecycleFixtureRoot = Join-Path $artifactRoot 'lifecycle-transitions'
$lifecycleFixtureTools = Join-Path $lifecycleFixtureRoot '.tools'
New-Item -ItemType Directory -Path $lifecycleFixtureTools -Force | Out-Null
Copy-Item -LiteralPath $lifecycleScript -Destination (Join-Path $lifecycleFixtureTools 'lifecycle.ps1')
Copy-Item -LiteralPath (Join-Path $script:RepoRoot '.tools\StrictJson.ps1') -Destination (Join-Path $lifecycleFixtureTools 'StrictJson.ps1')
Copy-Item -LiteralPath (Join-Path $script:RepoRoot '.tools\project.ps1') -Destination (Join-Path $lifecycleFixtureTools 'project.ps1')
Copy-Item -LiteralPath (Join-Path $script:RepoRoot 'version.json') -Destination (Join-Path $lifecycleFixtureRoot 'version.json')
$fixtureState = Read-JsonFile -Path $lifecycleStatePath
$fixtureState.state_revision = 1
$fixtureState.current_stage = 'repo-foundation'
$fixtureState.stage_number = 4
$fixtureState.snapshot.status = 'not-started'
$fixtureState.snapshot.version = $null
$fixtureState.snapshot.frozen_at_utc = $null
$fixtureState.stage_history = @([pscustomobject][ordered]@{
    stage = 'repo-foundation'
    stage_number = 4
    entered_at_utc = '2026-01-01T00:00:00Z'
    reason = 'Isolated lifecycle transition fixture.'
    regression = $false
})
$fixtureState.updated_at_utc = '2026-01-01T00:00:00Z'
$fixtureStatePath = Join-Path $lifecycleFixtureTools 'project-state.json'
Write-Utf8File -Path $fixtureStatePath -Content (($fixtureState | ConvertTo-Json -Depth 100) + "`n")
$fixtureLifecycleScript = Join-Path $lifecycleFixtureTools 'lifecycle.ps1'
$fixtureProjectController = Join-Path $lifecycleFixtureTools 'project.ps1'
$fixtureCommonArguments = @('-RepositoryRoot', $lifecycleFixtureRoot, '-AsJson')
$initialLifecycle = Invoke-JsonScript -ScriptPath $fixtureLifecycleScript -Arguments (@('-Mode', 'Status') + $fixtureCommonArguments)
Assert-True -Condition ([string]$initialLifecycle.snapshot.status -eq 'not-started' -and $null -eq $initialLifecycle.snapshot.frozen_at_utc) -Message 'A not-started snapshot must not claim freeze evidence.'
$initialLifecycleBytes = [System.IO.File]::ReadAllText($fixtureStatePath, $script:Utf8Strict)
try {
    Assert-Throws -Message 'stage-set must reject an unknown regression acknowledgement.' -Body {
        & $fixtureProjectController -RepositoryRoot $lifecycleFixtureRoot -Task 'stage-set' -ArgumentList @('direction-identity', 'Must not publish.', 'maybe') | Out-Null
    }
    Assert-Throws -Message 'stage-set must reject trailing arguments instead of ignoring them.' -Body {
        & $fixtureProjectController -RepositoryRoot $lifecycleFixtureRoot -Task 'stage-set' -ArgumentList @('direction-identity', 'Must not publish.', 'allow-regression', 'ignored') | Out-Null
    }
}
finally {
    Set-Location -LiteralPath $script:RepoRoot
}
Assert-True -Condition ([System.IO.File]::ReadAllText($fixtureStatePath, $script:Utf8Strict) -eq $initialLifecycleBytes) -Message 'Rejected stage-set arguments must leave lifecycle state bytes unchanged.'

$directionTransition = Invoke-JsonScript -ScriptPath $fixtureLifecycleScript -Arguments (@('-Mode', 'Set', '-Stage', 'direction-identity', '-Reason', 'Fixture direction accepted.') + $fixtureCommonArguments)
Assert-True -Condition ([string]$directionTransition.current_stage.id -eq 'direction-identity') -Message 'Lifecycle fixture must advance from repository foundation to direction and identity.'
$implementationTransition = Invoke-JsonScript -ScriptPath $fixtureLifecycleScript -Arguments (@('-Mode', 'Set', '-Stage', 'implementation', '-Reason', 'Fixture implementation accepted.') + $fixtureCommonArguments)
Assert-True -Condition ([string]$implementationTransition.current_stage.id -eq 'implementation') -Message 'Lifecycle fixture must advance from direction and identity to implementation.'
$inProgressTransition = Invoke-JsonScript -ScriptPath $fixtureLifecycleScript -Arguments (@('-Mode', 'Set', '-Stage', 'snapshot', '-Reason', 'Fixture snapshot work started.', '-SnapshotStatus', 'in-progress', '-SnapshotVersion', '1.0.0') + $fixtureCommonArguments)
Assert-True -Condition ([string]$inProgressTransition.snapshot.status -eq 'in-progress' -and [string]$inProgressTransition.snapshot.version -eq '1.0.0' -and $null -eq $inProgressTransition.snapshot.frozen_at_utc) -Message 'An in-progress snapshot transition must preserve its target version without claiming freeze evidence.'

$null = Invoke-JsonScript -ScriptPath $fixtureLifecycleScript -Arguments (@('-Mode', 'Set', '-Stage', 'implementation', '-Reason', 'Fixture reopens implementation for candidate proof.', '-AllowRegression') + $fixtureCommonArguments)
$candidateTransition = Invoke-JsonScript -ScriptPath $fixtureLifecycleScript -Arguments (@('-Mode', 'Set', '-Stage', 'snapshot', '-Reason', 'Fixture candidate evidence captured.', '-SnapshotStatus', 'candidate', '-SnapshotVersion', '1.0.0') + $fixtureCommonArguments)
$candidateTimestampValid = $true
try { $null = [DateTimeOffset]::Parse([string]$candidateTransition.snapshot.frozen_at_utc) } catch { $candidateTimestampValid = $false }
Assert-True -Condition ([string]$candidateTransition.snapshot.status -eq 'candidate' -and [string]$candidateTransition.snapshot.version -eq '1.0.0' -and $candidateTimestampValid) -Message 'A candidate transition must record a version and valid freeze timestamp.'

$null = Invoke-JsonScript -ScriptPath $fixtureLifecycleScript -Arguments (@('-Mode', 'Set', '-Stage', 'implementation', '-Reason', 'Fixture reopens implementation for explicit freeze proof.', '-AllowRegression') + $fixtureCommonArguments)
$frozenTransition = Invoke-JsonScript -ScriptPath $fixtureLifecycleScript -Arguments (@('-Mode', 'Set', '-Stage', 'snapshot', '-Reason', 'Fixture freeze evidence captured.', '-SnapshotStatus', 'frozen', '-SnapshotVersion', '1.0.0') + $fixtureCommonArguments)
$frozenTimestampValid = $true
try { $null = [DateTimeOffset]::Parse([string]$frozenTransition.snapshot.frozen_at_utc) } catch { $frozenTimestampValid = $false }
Assert-True -Condition ([string]$frozenTransition.snapshot.status -eq 'frozen' -and [string]$frozenTransition.snapshot.version -eq '1.0.0' -and $frozenTimestampValid) -Message 'An explicit frozen transition must record a version and valid freeze timestamp.'

$null = Invoke-JsonScript -ScriptPath $fixtureLifecycleScript -Arguments (@('-Mode', 'Set', '-Stage', 'implementation', '-Reason', 'Fixture reopens implementation for failed-mutation proof.', '-AllowRegression') + $fixtureCommonArguments)
$beforeRejectedTransitionBytes = [System.IO.File]::ReadAllText($fixtureStatePath, $script:Utf8Strict)
$invalidSnapshotVersion = 'x' * 129
Assert-Throws -Message 'A candidate transition with an invalid version must fail before publication.' -Body {
    & $fixtureLifecycleScript -RepositoryRoot $lifecycleFixtureRoot -Mode Set -Stage snapshot -Reason 'Invalid candidate evidence must not publish.' -SnapshotStatus candidate -SnapshotVersion $invalidSnapshotVersion -AsJson | Out-Null
}
Assert-True -Condition ([System.IO.File]::ReadAllText($fixtureStatePath, $script:Utf8Strict) -eq $beforeRejectedTransitionBytes) -Message 'Post-mutation lifecycle validation failure must leave persisted state bytes unchanged.'
$null = Invoke-JsonScript -ScriptPath $fixtureLifecycleScript -Arguments (@('-Mode', 'Set', '-Stage', 'snapshot', '-Reason', 'Fixture restores valid frozen evidence.', '-SnapshotStatus', 'frozen', '-SnapshotVersion', '1.0.0') + $fixtureCommonArguments)

$validFrozenStateBytes = [System.IO.File]::ReadAllText($fixtureStatePath, $script:Utf8Strict)
try {
    $invalidInProgress = $validFrozenStateBytes | ConvertFrom-Json
    $invalidInProgress.snapshot.status = 'in-progress'
    Write-Utf8File -Path $fixtureStatePath -Content (($invalidInProgress | ConvertTo-Json -Depth 100) + "`n")
    Assert-Throws -Message 'In-progress state with a freeze timestamp must fail runtime validation.' -Body {
        & $fixtureLifecycleScript -RepositoryRoot $lifecycleFixtureRoot -Mode Status -AsJson | Out-Null
    }
    $invalidCandidate = $validFrozenStateBytes | ConvertFrom-Json
    $invalidCandidate.snapshot.status = 'candidate'
    $invalidCandidate.snapshot.frozen_at_utc = $null
    Write-Utf8File -Path $fixtureStatePath -Content (($invalidCandidate | ConvertTo-Json -Depth 100) + "`n")
    Assert-Throws -Message 'Candidate state without freeze evidence must fail runtime validation.' -Body {
        & $fixtureLifecycleScript -RepositoryRoot $lifecycleFixtureRoot -Mode Status -AsJson | Out-Null
    }
    $invalidLegacy = $validFrozenStateBytes | ConvertFrom-Json
    $invalidLegacy.snapshot.status = 'proven'
    Write-Utf8File -Path $fixtureStatePath -Content (($invalidLegacy | ConvertTo-Json -Depth 100) + "`n")
    Assert-Throws -Message 'Retired snapshot status must fail runtime validation.' -Body {
        & $fixtureLifecycleScript -RepositoryRoot $lifecycleFixtureRoot -Mode Status -AsJson | Out-Null
    }
}
finally {
    Write-Utf8File -Path $fixtureStatePath -Content $validFrozenStateBytes
}
Assert-True -Condition ([System.IO.File]::ReadAllText($fixtureStatePath, $script:Utf8Strict) -eq $validFrozenStateBytes) -Message 'Lifecycle evidence rejection fixtures must restore the valid isolated state exactly.'

$replaceFallbackRoot = Join-Path $artifactRoot 'lifecycle-replace-fallback'
$replaceFallbackTools = Join-Path $replaceFallbackRoot '.tools'
New-Item -ItemType Directory -Path $replaceFallbackTools -Force | Out-Null
$replaceFallbackScript = Join-Path $replaceFallbackTools 'lifecycle.ps1'
$replaceFallbackSource = [System.IO.File]::ReadAllText($lifecycleScript, $script:Utf8Strict)
$replaceFallbackNeedle = '[System.IO.File]::Replace($tempPath, $script:StatePath, $backupPath, $true)'
Assert-True -Condition $replaceFallbackSource.Contains($replaceFallbackNeedle) -Message 'Lifecycle fallback fixture must patch the production File.Replace boundary exactly.'
$replaceFallbackSource = $replaceFallbackSource.Replace($replaceFallbackNeedle, "throw [System.UnauthorizedAccessException]::new('Managed-workspace fixture denies File.Replace.')")
Write-Utf8File -Path $replaceFallbackScript -Content $replaceFallbackSource
Copy-Item -LiteralPath (Join-Path $script:RepoRoot '.tools\StrictJson.ps1') -Destination (Join-Path $replaceFallbackTools 'StrictJson.ps1')
Copy-Item -LiteralPath (Join-Path $script:RepoRoot 'version.json') -Destination (Join-Path $replaceFallbackRoot 'version.json')
$replaceFallbackStatePath = Join-Path $replaceFallbackTools 'project-state.json'
Write-Utf8File -Path $replaceFallbackStatePath -Content (($fixtureState | ConvertTo-Json -Depth 100) + "`n")
$replaceFallbackTransition = Invoke-JsonScript -ScriptPath $replaceFallbackScript -Arguments @('-Mode', 'Set', '-Stage', 'direction-identity', '-Reason', 'Managed-workspace fallback accepted.', '-RepositoryRoot', $replaceFallbackRoot, '-AsJson')
$replaceFallbackState = Read-JsonFile -Path $replaceFallbackStatePath
$replaceFallbackResidue = @(Get-ChildItem -LiteralPath $replaceFallbackTools -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^project-state\.json\..+\.(?:tmp|bak)$' })
Assert-True -Condition ([string]$replaceFallbackTransition.current_stage.id -eq 'direction-identity' -and [string]$replaceFallbackState.current_stage -eq 'direction-identity' -and [int]$replaceFallbackState.state_revision -eq 2 -and $replaceFallbackResidue.Count -eq 0) -Message 'Unauthorized File.Replace must use the bounded same-directory fallback, persist one valid transition, and leave no temp or backup residue.'
$lifecycleTransitionStatuses = @('not-started', 'in-progress', 'candidate', 'frozen')

$scriptsRunScript = Join-Path $script:RepoRoot 'scripts\run.ps1'
$forwardedScriptsRun = Invoke-JsonScript -ScriptPath $scriptsRunScript -Arguments @('-Task', 'context-audit', '-AsJson')
Assert-True -Condition ([string]$forwardedScriptsRun.schema -eq 'gknome_context_bank_audit_v1' -and [string]$forwardedScriptsRun.status -in @('pass', 'warning', 'fail') -and $null -ne $forwardedScriptsRun.PSObject.Properties['unmatched_pattern_count']) -Message 'Scripts runner must preserve switch arguments supplied through a parameter splat and return structured context output independently of project context health.'
$doctorScriptsRun = Invoke-JsonScript -ScriptPath $scriptsRunScript -Arguments @('-Task', 'doctor', '-AsJson')
Assert-True -Condition ([string]$doctorScriptsRun.schema -eq 'gknome_project_doctor_result_v1' -and [string]$doctorScriptsRun.status -eq 'pass' -and [int]$doctorScriptsRun.failed_count -eq 0 -and [int]$doctorScriptsRun.check_count -gt 0) -Message 'Scripts runner must forward -AsJson to the project doctor and return structured proof.'
# Exercise the generated project's local parser at its public process boundary.
# Invoked PowerShell scripts normalize terminating child-script errors to a
# nonzero process exit; direct local dispatch is covered below.
$projectControllerScript = Join-Path $script:RepoRoot '.tools\project.ps1'
$gitDoctorFixture = Join-Path $artifactRoot 'git-doctor-fixture'
New-Item -ItemType Directory -Path $gitDoctorFixture -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $script:RepoRoot '.tools') -Destination (Join-Path $gitDoctorFixture '.tools') -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $gitDoctorFixture 'scripts') -Force | Out-Null
Copy-Item -LiteralPath $scriptsRunScript -Destination (Join-Path $gitDoctorFixture 'scripts\run.ps1') -Force
$gitDoctorController = Join-Path $gitDoctorFixture '.tools\project.ps1'
$gitDoctorBaseline = @(& $gitDoctorController -Task 'doctor' -ArgumentList @('-AsJson') -RepositoryRoot $gitDoctorFixture) -join [Environment]::NewLine
$gitDoctorBaselineJson = $gitDoctorBaseline | ConvertFrom-Json
Assert-True -Condition ([string]$gitDoctorBaselineJson.status -eq 'pass') -Message 'Isolated Git-entrypoint doctor fixture must start valid.'
Remove-Item -LiteralPath (Join-Path $gitDoctorFixture '.tools\gitpush.ps1') -Force
Assert-Throws -Message 'Doctor must fail after only the approved gitpush.ps1 entrypoint is removed from an otherwise passing isolated fixture.' -Body {
    & $gitDoctorController -Task 'doctor' -ArgumentList @('-AsJson') -RepositoryRoot $gitDoctorFixture | Out-Null
}
$malformedPowerShell = if ([int]$PSVersionTable.PSVersion.Major -ge 6) { (Get-Command pwsh -ErrorAction Stop).Source } else { (Get-Command powershell.exe -ErrorAction Stop).Source }
$escapedProjectController = $projectControllerScript.Replace("'", "''")
$malformedCommand = "& '$escapedProjectController' -Task 'context-audit' -ArgumentList @('-AsJson:')"
$malformedEncodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($malformedCommand))
$previousMalformedErrorAction = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    $malformedOutput = @(& $malformedPowerShell -NoProfile -EncodedCommand $malformedEncodedCommand 2>&1)
    $malformedExitCode = [int]$LASTEXITCODE
}
finally {
    $ErrorActionPreference = $previousMalformedErrorAction
}
$malformedText = ($malformedOutput | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
Assert-True -Condition ($malformedExitCode -ne 0 -and $malformedText -match 'Tool arguments must use named parameters') -Message 'Malformed colon arguments must remain rejected with the named-parameter diagnostic.'

$adapterFixture = Join-Path $artifactRoot 'project-task-adapter'
$adapterTools = Join-Path $adapterFixture '.tools'
$adapterScripts = Join-Path $adapterFixture 'scripts'
New-Item -ItemType Directory -Path $adapterTools, $adapterScripts -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $script:RepoRoot '.tools\project.ps1') -Destination (Join-Path $adapterTools 'project.ps1')
Copy-Item -LiteralPath (Join-Path $script:RepoRoot '.tools\StrictJson.ps1') -Destination (Join-Path $adapterTools 'StrictJson.ps1')
Copy-Item -LiteralPath (Join-Path $script:RepoRoot '.tools\ui') -Destination (Join-Path $adapterTools 'ui') -Recurse
$adapterControllerJson = @'
{"schema":"gknome_controller_v3","operation_schema":"gknome_operation_v1","compatibility":{"legacy_controller":".tools/controller.json","legacy_page_id":"scripts","task_id_policy":"stable","missing_task_policy":"show-legacy"},"pages":[{"id":"main","label":"Main","description":"Exercise project-owned dispatch.","operations":["fixture.probe"]},{"id":"git","label":"Git","description":"Fixture Git page.","operations":[]},{"id":"scripts","label":"Scripts","description":"Fixture compatibility page.","operations":[]}],"operations":[{"schema":"gknome_operation_v1","id":"fixture.probe","page_id":"main","label":"Adapter probe","task":"adapter-probe","description":"Run the bounded adapter probe.","owner":"project","role":"mutate","network":"off","confirmation":"prompt","availability":{}}]}
'@
$adapterLegacyControllerJson = @'
{"schema":"gknome_controller_v2","task_schema":"gknome_controller_task_v1","groups":[]}
'@
$adapterProjectJson = @'
{"schema":"gknome_project_v2","name":"Adapter fixture","alias":"fixture","description":"Controller adapter test fixture.","profile":"custom","capabilities":[],"required":[],"template":{"id":"gknome-standard","version":"0.0.005"},"task_adapter":{"script":"scripts/probe.ps1"}}
'@
$adapterProjectStateJson = @'
{"schema":"gknome_project_state_v1","current_stage":"integration","stage_number":4,"profile":"custom","capabilities":[]}
'@
$adapterProvenanceJson = @'
{"schema":"gknome_template_provenance_v1","template_version":"0.0.005","template_payload_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
'@
$adapterProbeScript = @'
#Requires -Version 5.1
param([string]$Task, [string]$Value = '')
if ($Task -ne 'adapter-probe') { throw "Unexpected adapter task: $Task" }
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'probe.txt'), $Value, (New-Object System.Text.UTF8Encoding($false)))
'@
Write-Utf8File -Path (Join-Path $adapterTools 'controller.v3.json') -Content $adapterControllerJson
Write-Utf8File -Path (Join-Path $adapterTools 'controller.json') -Content $adapterLegacyControllerJson
Write-Utf8File -Path (Join-Path $adapterTools 'project.json') -Content $adapterProjectJson
Write-Utf8File -Path (Join-Path $adapterTools 'project-state.json') -Content $adapterProjectStateJson
Write-Utf8File -Path (Join-Path $adapterTools 'template-provenance.json') -Content $adapterProvenanceJson
Write-Utf8File -Path (Join-Path $adapterScripts 'probe.ps1') -Content $adapterProbeScript
Copy-Item -LiteralPath (Join-Path $script:RepoRoot 'scripts\run.ps1') -Destination (Join-Path $adapterScripts 'run.ps1')
$adapterController = Join-Path $adapterTools 'project.ps1'
& $adapterController -Task 'adapter-probe' -ArgumentList @('-Value', 'round-trip') -RepositoryRoot $adapterFixture
$adapterMarker = Join-Path $adapterScripts 'probe.txt'
Assert-True -Condition ((Test-Path -LiteralPath $adapterMarker -PathType Leaf) -and [System.IO.File]::ReadAllText($adapterMarker, $script:Utf8Strict) -eq 'round-trip') -Message 'A controller operation owned by the project must route arguments through the declared task adapter.'
$menuPowerShell = if ([int]$PSVersionTable.PSVersion.Major -ge 6) { (Get-Command pwsh -ErrorAction Stop).Source } else { (Get-Command powershell.exe -ErrorAction Stop).Source }
Remove-Item -LiteralPath $adapterMarker -Force
$menuStart = New-Object System.Diagnostics.ProcessStartInfo
$menuStart.FileName = $menuPowerShell
$menuStart.Arguments = ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $adapterController)
$menuStart.WorkingDirectory = $adapterFixture
$menuStart.UseShellExecute = $false
$menuStart.RedirectStandardInput = $true
$menuStart.RedirectStandardOutput = $true
$menuStart.RedirectStandardError = $true
$menuStart.EnvironmentVariables['GKNOME_MENU_HARNESS'] = '1'
$menuStart.EnvironmentVariables['GKNOME_MENU_ENGINE'] = 'plain'
$menuProcess = New-Object System.Diagnostics.Process
$menuProcess.StartInfo = $menuStart
[void]$menuProcess.Start()
foreach ($menuInput in @('1', 'y', '', 'q')) { $menuProcess.StandardInput.WriteLine($menuInput) }
$menuProcess.StandardInput.Close()
$menuOutput = $menuProcess.StandardOutput.ReadToEnd()
$menuError = $menuProcess.StandardError.ReadToEnd()
$menuExited = $menuProcess.WaitForExit(15000)
if (-not $menuExited) {
    try { $menuProcess.Kill() } catch { }
    throw 'Prompted project-owned menu action did not exit within 15 seconds.'
}
Assert-True -Condition ($menuProcess.ExitCode -eq 0 -and [string]::IsNullOrWhiteSpace($menuError) -and $menuOutput -notmatch 'Cannot index into a null array' -and (Test-Path -LiteralPath $adapterMarker -PathType Leaf)) -Message 'A confirmed project-owned menu action with no arguments must dispatch an empty array instead of null.'
$adapterHelp = @(& $adapterController -Task 'help' -RepositoryRoot $adapterFixture 6>&1) -join [Environment]::NewLine
Assert-True -Condition ($adapterHelp -match '(?m)^Project tasks:\r?$' -and @([regex]::Matches($adapterHelp, '(?m)^\s+adapter-probe\s+')).Count -eq 1 -and $adapterHelp -match 'Run the bounded adapter probe\.') -Message 'Controller help must list each valid project-declared task once with its description.'
$generatedRunnerText = [System.IO.File]::ReadAllText((Join-Path $adapterScripts 'run.ps1'), $script:Utf8Strict)
foreach ($retiredPattern in @(
    'ControllerHost',
    'GKNOME_CONTROLLER_HOST',
    'ProcessStartInfo',
    'Invoke-GknomeBoundedHostProbe',
    'Initialize-GknomeHostProbeContainment'
)) {
    Assert-True -Condition ($generatedRunnerText -notmatch [regex]::Escape($retiredPattern)) -Message "Generated scripts runner must not retain retired startup path: $retiredPattern"
}
Assert-True -Condition ($generatedRunnerText -match '[.]tools[\\/]project[.]ps1') -Message 'Generated scripts runner must dispatch directly to the tracked local controller.'
$runnerPowerShell = if ([int]$PSVersionTable.PSVersion.Major -ge 6) { (Get-Command pwsh -ErrorAction Stop).Source } else { (Get-Command powershell.exe -ErrorAction Stop).Source }
$previousRunnerErrorAction = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    $directOutput = @(& $runnerPowerShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $adapterScripts 'run.ps1') -Task 'adapter-probe' -Value 'direct-round-trip' 2>&1)
    $directExit = [int]$LASTEXITCODE
}
finally { $ErrorActionPreference = $previousRunnerErrorAction }
Assert-True -Condition ($directExit -eq 0 -and [System.IO.File]::ReadAllText($adapterMarker, $script:Utf8Strict) -eq 'direct-round-trip') -Message ('Generated scripts runner must preserve exact task arguments through direct local dispatch. Output: ' + ($directOutput -join [Environment]::NewLine))
Write-Utf8File -Path (Join-Path $adapterTools 'project.json') -Content '{"schema":"gknome_project_v2","task_adapter":{"script":"../outside.ps1"}}'
Assert-Throws -Message 'Project task adapter traversal must fail closed.' -Body {
    & $adapterController -Task 'adapter-probe' -RepositoryRoot $adapterFixture | Out-Null
}
Invoke-WithRepositoryMutex -Purpose 'template-lifecycle' -Identity $lifecycleStatePath -Action {
    $lifecycleOriginal = [System.IO.File]::ReadAllText($lifecycleStatePath, $script:Utf8Strict)
    try {
        $corruptState = $lifecycleOriginal | ConvertFrom-Json
        $corruptState.stage_number = 3
        Write-Utf8File -Path $lifecycleStatePath -Content (($corruptState | ConvertTo-Json -Depth 100) + "`n")
        Assert-Throws -Message 'Lifecycle stage-number corruption must fail closed.' -Body {
            & $lifecycleScript -Mode Status -AsJson | Out-Null
        }
        Assert-True -Condition ([System.IO.File]::ReadAllText($lifecycleStatePath, $script:Utf8Strict) -ne $lifecycleOriginal) -Message 'Corruption fixture must be written before restoration.'
    }
    finally {
        Write-Utf8File -Path $lifecycleStatePath -Content $lifecycleOriginal
    }
    Assert-True -Condition ([System.IO.File]::ReadAllText($lifecycleStatePath, $script:Utf8Strict) -eq $lifecycleOriginal) -Message 'Failed lifecycle validation must leave restored state bytes intact.'
}

$pythonFiles = @(Get-ChildItem -LiteralPath $script:RepoRoot -Recurse -Force -File | Where-Object {
    $relativePythonPath = $_.FullName.Substring($script:RepoRoot.Length).TrimStart([char[]]@('\', '/'))
    $relativePythonPath -notmatch '(^|[\\/])\.artifacts([\\/]|$)' -and $_.Extension.ToLowerInvariant() -in @('.py', '.pyw')
})
$pythonRequired = [bool]$project.runtime.python_required
if ($pythonRequired) {
    Assert-True -Condition ($pythonFiles.Count -gt 0) -Message 'A project that declares Python runtime support must contain Python tooling.'
}
else {
    Assert-True -Condition ($pythonFiles.Count -eq 0) -Message 'A foundation that does not declare Python runtime support must not contain Python tooling.'
}

$gitignore = [System.IO.File]::ReadAllText((Join-Path $script:RepoRoot '.gitignore'), $script:Utf8Strict)
$runtimeDataPath = [string]$project.paths.runtime_data
$secretStorePath = [string]$project.paths.secrets_dir
Assert-True -Condition ($runtimeDataPath -in @('.runtime', 'runtime-data') -and $secretStorePath -in @('.tools/secrets', '.tools/.secrets') -and $runtimeDataPath -ne $secretStorePath) -Message 'Generated metadata must separate a supported ignored runtime-state root from a supported operator secret store.'
Assert-True -Condition ((Test-Path -LiteralPath (Join-Path $script:RepoRoot 'docs\research-inbox\README.md') -PathType Leaf) -and ((-not $summaryBankTemplateOwned) -or ($null -ne $summary.groups.PSObject.Properties['research_inbox'] -and $null -ne $summary.groups.PSObject.Properties['project_share']))) -Message 'Generated projects must ship project-owned research-intake and share guidance with focused template-owned context routes; a preserved compatible project bank remains caller-owned.'
$configuredIgnoreCandidates = @($runtimeDataPath, $artifactRelativePath) | ForEach-Object { ([string]$_).Replace('\', '/').TrimEnd('/') } | Sort-Object Length
$configuredIgnorePaths = @()
foreach ($candidate in $configuredIgnoreCandidates) {
    if (@($configuredIgnorePaths | Where-Object { $candidate -eq $_ -or $candidate.StartsWith($_ + '/', [System.StringComparison]::OrdinalIgnoreCase) }).Count -eq 0) {
        $configuredIgnorePaths += $candidate
    }
}
foreach ($requiredIgnore in @('.tools/.secrets/', '.tools/secrets/', '.tools/local/', '.agents/local/', '.env') + @($configuredIgnorePaths | ForEach-Object { $_ + '/' })) {
    Assert-True -Condition $gitignore.Contains($requiredIgnore) -Message ".gitignore must contain $requiredIgnore"
}

$contextSource = [System.IO.File]::ReadAllText($contextScript, $script:Utf8Strict)
Assert-True -Condition $contextSource.Contains('@@@GKNOME_CTX_FILE_BEGIN:') -Message 'Context tool must use the GKNOME_CTX marker namespace.'
Assert-True -Condition (-not $contextSource.Contains('#region ')) -Message 'Context tool must not emit editor region markers.'

$audit = Invoke-JsonScript -ScriptPath $contextScript -Arguments @('-Mode', 'Audit', '-AsJson')
Assert-True -Condition ([string]$audit.status -eq 'pass') -Message 'Context bank audit must pass.'
Assert-True -Condition ([int]$audit.unmatched_pattern_count -eq 0) -Message 'Context bank must not contain unmatched template paths.'
Assert-True -Condition ([int]$audit.default_budget_kb -eq [int]$summary.defaults.max_kb -and [int]$audit.active_over_default_budget_group_count -eq 0 -and [int]$audit.active_pack_over_default_budget_group_count -eq 0 -and [int]$audit.default_selected_over_budget_group_count -eq 0 -and [int]$audit.default_selected_pack_over_budget_group_count -eq 0) -Message 'Context audit must expose the configured budget and keep every active group within both source and serialized-pack estimates.'
Assert-True -Condition (@($audit.groups | Where-Object { [string]::IsNullOrWhiteSpace([string]$_.source_budget_status) -or [string]::IsNullOrWhiteSpace([string]$_.pack_budget_status) -or [int64]$_.estimated_pack_bytes -lt [int64]$_.source_bytes }).Count -eq 0) -Message 'Context audit must classify source and serialized-pack budget pressure for every group.'

$fallbackTest = Invoke-JsonScript -ScriptPath $contextFallbackTestScript -Arguments @('-AsJson')
Assert-True -Condition ([string]$fallbackTest.status -eq 'pass' -and [int]$fallbackTest.candidate_file_count -eq 1 -and -not [bool]$fallbackTest.git_enumeration_available) -Message 'Git-unavailable context fallback regression must pass with only the selected public file.'
Assert-True -Condition (-not [bool]$fallbackTest.secret_names_exposed -and -not [bool]$fallbackTest.secret_content_exposed -and [bool]$fallbackTest.reparse_directory_pruned) -Message 'Context fallback regression must prove secret non-enumeration and reparse pruning.'

$packPath = Join-Path $artifactRoot 'context-pack.txt'
$secondPackPath = Join-Path $artifactRoot 'context-pack-second.txt'
$contextSnapshot = Invoke-WithRepositoryMutex -Purpose 'template-lifecycle' -Identity $lifecycleStatePath -Action {
    $snapshotBuildStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $snapshotBuild = Invoke-JsonScript -ScriptPath $contextScript -Arguments @('-Mode', 'Build', '-Group', $focusedContextGroup, '-BudgetKB', ([string]$summaryBudget), '-OutputPath', $packPath, '-AsJson')
    $snapshotBuildStopwatch.Stop()
    $snapshotSecondBuild = Invoke-JsonScript -ScriptPath $contextScript -Arguments @('-Mode', 'Build', '-Group', $focusedContextGroup, '-BudgetKB', ([string]$summaryBudget), '-OutputPath', $secondPackPath, '-AsJson')
    $snapshotVerifyStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $snapshotVerify = Invoke-JsonScript -ScriptPath $contextScript -Arguments @('-Mode', 'Verify', '-PackPath', $packPath, '-AsJson')
    $snapshotVerifyStopwatch.Stop()
    [pscustomobject][ordered]@{
        build = $snapshotBuild
        second_build = $snapshotSecondBuild
        verify = $snapshotVerify
        build_ms = [math]::Round($snapshotBuildStopwatch.Elapsed.TotalMilliseconds, 3)
        verify_ms = [math]::Round($snapshotVerifyStopwatch.Elapsed.TotalMilliseconds, 3)
    }
}
$build = $contextSnapshot.build
$secondBuild = $contextSnapshot.second_build
$verify = $contextSnapshot.verify
Assert-True -Condition ([string]$build.status -eq 'pass') -Message 'Focused context build must pass.'
Assert-True -Condition ([int]$build.file_count -gt 0) -Message 'Focused context build must include files.'
Assert-True -Condition ([int]$build.omitted_count -eq 0 -and [int64]$build.pack_bytes -le ([int64]$summaryBudget * 1024)) -Message 'Focused context build must include its complete route and remain within the serialized-pack budget.'
Assert-True -Condition (Test-Path -LiteralPath $packPath -PathType Leaf) -Message 'Context pack must be created.'
Assert-True -Condition ([string]$secondBuild.pack_id -eq [string]$build.pack_id) -Message 'Unchanged source must produce the same context pack identity.'
Assert-True -Condition ([string]$verify.status -eq 'pass') -Message 'Context verification must pass.'
Assert-True -Condition ([int]$verify.file_count -eq [int]$build.file_count) -Message 'Build and verify file counts must match.'
Assert-True -Condition ([bool]$verify.manifest_verified) -Message 'Adjacent context manifest must verify the full pack bytes.'
Assert-True -Condition ([bool]$verify.source_fresh -and [string]$verify.source_freshness.status -eq 'fresh') -Message 'Fresh context verification must also prove current routed source freshness.'

$freshnessFixtureRoot = Join-Path $artifactRoot 'context-freshness-fixture'
$freshnessFixtureTools = Join-Path $freshnessFixtureRoot '.tools'
$freshnessContextScript = Join-Path $freshnessFixtureTools 'context.ps1'
$freshnessStrictJson = Join-Path $freshnessFixtureTools 'StrictJson.ps1'
$freshnessBankPath = Join-Path $freshnessFixtureRoot 'summary_bank.json'
$freshnessSourcePath = Join-Path $freshnessFixtureRoot 'Cargo.lock'
$freshnessPackPath = Join-Path $freshnessFixtureRoot '.artifacts\context-pack-freshness.txt'
New-Item -ItemType Directory -Path $freshnessFixtureTools -Force | Out-Null
Copy-Item -LiteralPath $contextScript -Destination $freshnessContextScript -Force
Copy-Item -LiteralPath (Join-Path $script:RepoRoot '.tools\StrictJson.ps1') -Destination $freshnessStrictJson -Force
Write-Utf8File -Path (Join-Path $freshnessFixtureTools 'project.json') -Content '{"schema":"gknome_project_v2","paths":{"context_bank":"summary_bank.json"},"context":{"text_extensions":[".md"],"text_file_names":["Cargo.lock"],"max_file_bytes":1048576,"default_budget_kb":32}}'
Write-Utf8File -Path $freshnessBankPath -Content '{"schema":"gknome_summary_bank_v2","defaults":{"groups":["freshness"],"tree":false,"max_kb":32,"skip_dirs":[".artifacts",".git"]},"groups":{"freshness":{"description":"Isolated source freshness fixture.","status":"active","paths":["Cargo.lock"]}}}'
Write-Utf8File -Path $freshnessSourcePath -Content "# Context freshness lockfile fixture.`n"
$freshnessBuild = Invoke-JsonScript -ScriptPath $freshnessContextScript -Arguments @('-Mode', 'Build', '-Group', 'freshness', '-BankPath', 'summary_bank.json', '-BudgetKB', '32', '-OutputPath', $freshnessPackPath, '-RepositoryRoot', $freshnessFixtureRoot, '-AsJson')
Assert-True -Condition ([string]$freshnessBuild.status -eq 'pass' -and [int]$freshnessBuild.file_count -eq 1) -Message 'Isolated context freshness fixture must build one selected source file.'
$freshnessManifest = Read-JsonFile -Path ($freshnessPackPath + '.manifest.json')
$freshnessRecord = @($freshnessManifest.files)[0]
Assert-True -Condition ([string]$freshnessRecord.path -eq 'Cargo.lock') -Message 'An explicitly routed Cargo.lock must be eligible text context without a project workaround.'
$freshnessRelativePath = [string]$freshnessRecord.path
$packHashBeforeFreshnessMutation = Get-FileSha256 -Path $freshnessPackPath
Invoke-WithRepositoryMutex -Purpose 'template-source-freshness' -Identity $freshnessSourcePath -Action {
    $freshnessOriginal = $null
    try {
        $freshnessOriginal = [System.IO.File]::ReadAllText($freshnessSourcePath, $script:Utf8Strict)
        Write-Utf8File -Path $freshnessSourcePath -Content ($freshnessOriginal + "`nsource-freshness-fixture`n")
        $staleVerify = Invoke-JsonScript -ScriptPath $freshnessContextScript -Arguments @('-Mode', 'Verify', '-PackPath', $freshnessPackPath, '-RepositoryRoot', $freshnessFixtureRoot, '-AsJson')
        $staleExitCode = [int]$LASTEXITCODE
        $staleChangedPaths = @($staleVerify.source_freshness.changed | ForEach-Object { [string]$_.path })
        Assert-True -Condition ($staleExitCode -eq 3 -and [string]$staleVerify.status -eq 'source-stale' -and -not [bool]$staleVerify.source_fresh -and $staleChangedPaths -contains $freshnessRelativePath) -Message 'Changing a selected source file must report source-stale, identify the changed path, and return the public nonzero verification exit.'
        Assert-True -Condition ((Get-FileSha256 -Path $freshnessPackPath) -eq $packHashBeforeFreshnessMutation -and [string]$staleVerify.pack_sha256 -eq $freshnessBuild.pack_sha256) -Message 'Source-stale verification must not modify the existing context pack.'
    }
    finally {
        if ($null -ne $freshnessOriginal) { Write-Utf8File -Path $freshnessSourcePath -Content $freshnessOriginal }
    }

    $restoredVerify = Invoke-JsonScript -ScriptPath $freshnessContextScript -Arguments @('-Mode', 'Verify', '-PackPath', $freshnessPackPath, '-RepositoryRoot', $freshnessFixtureRoot, '-AsJson')
    Assert-True -Condition ([string]$restoredVerify.status -eq 'pass' -and [bool]$restoredVerify.source_fresh -and [string]$restoredVerify.source_freshness.status -eq 'fresh') -Message 'Restoring the selected source file must return verification to fresh without rebuilding the pack.'
}

$concurrentPackPath = Join-Path $artifactRoot 'context-pack-concurrent.txt'
$contextJobs = @(
    (Start-Job -ScriptBlock {
        param($scriptPath, $outputPath)
        & $scriptPath -Mode Build -OutputPath $outputPath -AsJson | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Concurrent context build failed: $LASTEXITCODE" }
    } -ArgumentList $contextScript, $concurrentPackPath),
    (Start-Job -ScriptBlock {
        param($scriptPath, $outputPath)
        & $scriptPath -Mode Build -OutputPath $outputPath -AsJson | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Concurrent context build failed: $LASTEXITCODE" }
    } -ArgumentList $contextScript, $concurrentPackPath)
)
try {
    $finishedJobs = @(Wait-Job -Job $contextJobs -Timeout 120)
    Assert-True -Condition ($finishedJobs.Count -eq $contextJobs.Count -and @($contextJobs | Where-Object State -ne 'Completed').Count -eq 0) -Message 'Concurrent context builds must serialize and complete successfully.'
}
finally {
    foreach ($job in $contextJobs) {
        if ($job.State -eq 'Running') { Stop-Job -Job $job -ErrorAction SilentlyContinue }
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }
}
$concurrentVerify = Invoke-JsonScript -ScriptPath $contextScript -Arguments @('-Mode', 'Verify', '-PackPath', $concurrentPackPath, '-AsJson')
Assert-True -Condition ([string]$concurrentVerify.status -eq 'pass' -and [bool]$concurrentVerify.manifest_verified) -Message 'The final concurrent context pack must verify after serialized writes.'

$rebuildSnapshot = Invoke-WithRepositoryMutex -Purpose 'template-lifecycle' -Identity $lifecycleStatePath -Action {
    $rebuildStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $rebuild = Invoke-JsonScript -ScriptPath $contextScript -Arguments @('-Mode', 'Rebuild', '-PackPath', $packPath, '-Force', '-AsJson')
    $rebuildStopwatch.Stop()
    Assert-True -Condition ([string]$rebuild.status -eq 'pass') -Message 'Context rebuild preview must pass.'
    Assert-True -Condition (-not [bool]$rebuild.apply) -Message 'Default rebuild must remain a preview.'
    Assert-True -Condition (Test-Path -LiteralPath ([string]$rebuild.destination) -PathType Container) -Message 'Rebuild destination must exist.'

    $manifest = Read-JsonFile -Path ($packPath + '.manifest.json')
    foreach ($file in @($manifest.files)) {
        $sourcePath = Join-Path $script:RepoRoot (([string]$file.path).Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        $rebuiltPath = Join-Path ([string]$rebuild.destination) (([string]$file.path).Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        Assert-True -Condition (Test-Path -LiteralPath $rebuiltPath -PathType Leaf) -Message "Rebuilt file missing: $($file.path)"
        $sourceText = [System.IO.File]::ReadAllText($sourcePath, $script:Utf8Strict)
        $rebuiltText = [System.IO.File]::ReadAllText($rebuiltPath, $script:Utf8Strict)
        Assert-True -Condition ((Get-TextSha256 -Text $sourceText) -eq (Get-TextSha256 -Text $rebuiltText)) -Message "Rebuilt file differs: $($file.path)"
    }
    [pscustomobject][ordered]@{
        rebuild = $rebuild
        manifest = $manifest
        elapsed_ms = [math]::Round($rebuildStopwatch.Elapsed.TotalMilliseconds, 3)
    }
}
$rebuild = $rebuildSnapshot.rebuild
$manifest = $rebuildSnapshot.manifest
$rebuildElapsedMs = [double]$rebuildSnapshot.elapsed_ms

$applyTarget = Join-Path $artifactRoot 'transactional-apply'
$firstApplyRecord = @($manifest.files)[0]
$firstApplyPath = Join-Path $applyTarget (([string]$firstApplyRecord.path).Replace('/', [System.IO.Path]::DirectorySeparatorChar))
$sentinelContent = "operator-owned-before-apply`n"
Write-Utf8File -Path $firstApplyPath -Content $sentinelContent
$previousContextFailureHook = [Environment]::GetEnvironmentVariable('GKNOME_TEST_CONTEXT_FAIL_AFTER_APPLY', 'Process')
try {
    [Environment]::SetEnvironmentVariable('GKNOME_TEST_CONTEXT_FAIL_AFTER_APPLY', '1', 'Process')
    Assert-Throws -Message 'Injected rebuild apply failure must surface.' -Body {
        & $contextScript -Mode Rebuild -PackPath $packPath -DestinationPath $applyTarget -Apply -Force -AsJson | Out-Null
    }
}
finally {
    [Environment]::SetEnvironmentVariable('GKNOME_TEST_CONTEXT_FAIL_AFTER_APPLY', $previousContextFailureHook, 'Process')
}
$remainingApplyFiles = @(Get-ChildItem -LiteralPath $applyTarget -Recurse -Force -File)
$transactionResidue = @(Get-ChildItem -LiteralPath $artifactRoot -Directory -Filter '.gknome-context-transaction-*' -Force -ErrorAction SilentlyContinue)
Assert-True -Condition ($remainingApplyFiles.Count -eq 1 -and [System.IO.File]::ReadAllText($firstApplyPath, $script:Utf8Strict) -eq $sentinelContent -and $transactionResidue.Count -eq 0) -Message 'Failed rebuild apply must restore overwritten bytes, remove new files, and clean its transaction directory.'

$previousContextTamperHook = [Environment]::GetEnvironmentVariable('GKNOME_TEST_CONTEXT_TAMPER_AFTER_APPLY', 'Process')
try {
    [Environment]::SetEnvironmentVariable('GKNOME_TEST_CONTEXT_FAIL_AFTER_APPLY', '1', 'Process')
    [Environment]::SetEnvironmentVariable('GKNOME_TEST_CONTEXT_TAMPER_AFTER_APPLY', '1', 'Process')
    Assert-Throws -Message 'A changed applied file must make rebuild rollback fail closed.' -Body {
        & $contextScript -Mode Rebuild -PackPath $packPath -DestinationPath $applyTarget -Apply -Force -AsJson | Out-Null
    }
}
finally {
    [Environment]::SetEnvironmentVariable('GKNOME_TEST_CONTEXT_FAIL_AFTER_APPLY', $previousContextFailureHook, 'Process')
    [Environment]::SetEnvironmentVariable('GKNOME_TEST_CONTEXT_TAMPER_AFTER_APPLY', $previousContextTamperHook, 'Process')
}
$recoveryTransactions = @(Get-ChildItem -LiteralPath $artifactRoot -Directory -Filter '.gknome-context-transaction-*' -Force -ErrorAction SilentlyContinue)
$recoveryBackup = if ($recoveryTransactions.Count -eq 1) { Join-Path $recoveryTransactions[0].FullName ('backup\' + (([string]$firstApplyRecord.path).Replace('/', '\'))) } else { '' }
Assert-True -Condition ($recoveryTransactions.Count -eq 1 -and (Test-Path -LiteralPath $recoveryBackup -PathType Leaf) -and [System.IO.File]::ReadAllText($recoveryBackup, $script:Utf8Strict) -eq $sentinelContent -and [System.IO.File]::ReadAllText($firstApplyPath, $script:Utf8Strict) -match 'operator-change-after-rebuild') -Message 'Incomplete rollback must retain both changed destination bytes and recovery backup data.'
Remove-Item -LiteralPath $firstApplyPath -Force
Move-Item -LiteralPath $recoveryBackup -Destination $firstApplyPath
Remove-Item -LiteralPath $recoveryTransactions[0].FullName -Recurse -Force

$appliedRebuild = Invoke-JsonScript -ScriptPath $contextScript -Arguments @('-Mode', 'Rebuild', '-PackPath', $packPath, '-DestinationPath', $applyTarget, '-Apply', '-Force', '-AsJson')
Assert-True -Condition ([string]$appliedRebuild.status -eq 'pass' -and [bool]$appliedRebuild.apply -and [bool]$appliedRebuild.transactional -and [int]$appliedRebuild.file_count -eq [int]$manifest.pack.file_count) -Message 'Explicit rebuild apply must commit every verified file transactionally.'

$tamperedPath = Join-Path $artifactRoot 'context-pack-tampered.txt'
$tamperedText = [System.IO.File]::ReadAllText($packPath, $script:Utf8Strict)
$beginIndex = $tamperedText.IndexOf('@@@GKNOME_CTX_FILE_BEGIN:')
Assert-True -Condition ($beginIndex -ge 0) -Message 'Pack must contain a file block.'
$firstLineEnd = $tamperedText.IndexOf("`n", $beginIndex)
$metadataLineEnd = $tamperedText.IndexOf("`n", $firstLineEnd + 1)
$contentIndex = $metadataLineEnd + 1
$characters = $tamperedText.ToCharArray()
$characters[$contentIndex] = if ($characters[$contentIndex] -eq 'X') { 'Y' } else { 'X' }
Write-Utf8File -Path $tamperedPath -Content (-join $characters)
Assert-Throws -Message 'Tampered content must fail hash verification.' -Body {
    & $contextScript -Mode Verify -PackPath $tamperedPath -AsJson | Out-Null
}

$trailingPath = Join-Path $artifactRoot 'context-pack-trailing.txt'
$trailingText = [System.IO.File]::ReadAllText($packPath, $script:Utf8Strict) + "UNDECLARED-TRAILING-CONTENT`n"
Write-Utf8File -Path $trailingPath -Content $trailingText
Assert-Throws -Message 'Trailing content after pack metadata must fail verification.' -Body {
    & $contextScript -Mode Verify -PackPath $trailingPath -AsJson | Out-Null
}

$unsafePath = Join-Path $artifactRoot 'context-pack-unsafe-path.txt'
$unsafeText = [System.IO.File]::ReadAllText($packPath, $script:Utf8Strict)
$metadataStart = $firstLineEnd + 1
$firstMetadata = $unsafeText.Substring($metadataStart, $metadataLineEnd - $metadataStart) | ConvertFrom-Json
$originalPath = [string]$firstMetadata.path
$unsafeReplacement = '../' + ('x' * [math]::Max(0, $originalPath.Length - 3))
if ($unsafeReplacement.Length -gt $originalPath.Length) { $unsafeReplacement = $unsafeReplacement.Substring(0, $originalPath.Length) }
while ($unsafeReplacement.Length -lt $originalPath.Length) { $unsafeReplacement += 'x' }
$unsafeText = $unsafeText.Replace(('"path":"' + $originalPath + '"'), ('"path":"' + $unsafeReplacement + '"'))
Write-Utf8File -Path $unsafePath -Content $unsafeText
Assert-Throws -Message 'Traversal metadata must fail verification before rebuild.' -Body {
    & $contextScript -Mode Verify -PackPath $unsafePath -AsJson | Out-Null
}

$secretStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$secretScan = Invoke-JsonScript -ScriptPath $secretScript -Arguments @('-FailOnFindings', '-AsJson')
$secretStopwatch.Stop()
Assert-True -Condition ([string]$secretScan.status -eq 'pass') -Message 'Secret scan must pass.'
Assert-True -Condition ([int]$secretScan.findings_count -eq 0) -Message 'Secret scan must have zero findings.'

$elapsed = [DateTimeOffset]::UtcNow - $script:Started
$report = [pscustomobject][ordered]@{
    schema = 'gknome_template_test_report_v1'
    status = 'pass'
    generated_at_utc = [DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
    powershell = $PSVersionTable.PSVersion.ToString()
    assertions = $script:Assertions
    context = [pscustomobject][ordered]@{
        pack_id = [string]$build.pack_id
        file_count = [int]$build.file_count
        omitted_count = [int]$build.omitted_count
        pack_bytes = [int64]$build.pack_bytes
        build_ms = [double]$contextSnapshot.build_ms
        verify_ms = [double]$contextSnapshot.verify_ms
        rebuild_ms = $rebuildElapsedMs
        deterministic_identity = $true
        manifest_verification = [bool]$verify.manifest_verified
        source_freshness = [bool]$verify.source_fresh
        source_stale_detection = $true
        tamper_detection = $true
        trailing_content_rejection = $true
        traversal_rejection = $true
        fallback_directory_pruning = ([string]$fallbackTest.status -eq 'pass')
        fallback_secret_non_enumeration = (-not [bool]$fallbackTest.secret_names_exposed -and -not [bool]$fallbackTest.secret_content_exposed)
        fallback_reparse_pruning = [bool]$fallbackTest.reparse_directory_pruned
        concurrent_build_serialization = $true
        transactional_apply = $true
        transactional_rollback = $true
        incomplete_rollback_recovery = $true
    }
    secrets = [pscustomobject][ordered]@{
        scanned_files = [int]$secretScan.scanned_files
        findings = [int]$secretScan.findings_count
        scan_ms = [math]::Round($secretStopwatch.Elapsed.TotalMilliseconds, 3)
    }
    lifecycle = [pscustomobject][ordered]@{
        current_stage = [string]$lifecycleStatus.current_stage.id
        semantic_validation = $true
        corrupt_stage_refused = $true
        transition_fixture = 'pass'
        snapshot_statuses = $lifecycleTransitionStatuses
        candidate_evidence_required = $true
        non_frozen_evidence_refused = $true
        retired_status_refused = $true
        rejected_transition_no_write = $true
    }
    runner = [pscustomobject][ordered]@{
        root_shim = 'pass'
        scripts_shim = 'pass'
        parameter_splat_switch_forwarding = $true
        project_task_adapter = 'pass'
        direct_local_dispatch = 'pass'
        retired_host_protocol_absent = $true
        adapter_traversal_rejection = $true
    }
    isolation = [pscustomobject][ordered]@{
        scratch_scope = 'per-run'
        proof_publication = 'serialized-atomic'
        lifecycle_fixture = 'serialized'
        context_source_snapshot = 'serialized-with-lifecycle-state'
    }
    python_required = $false
    elapsed_ms = [math]::Round($elapsed.TotalMilliseconds, 3)
}

$proofDirectory = Join-Path $script:RepoRoot (Join-Path $artifactRelativePath 'proof')
$proofPath = Join-Path $proofDirectory 'template-test.json'
Publish-JsonProof -Path $proofPath -Value $report

if ($script:LocationPushed) {
    Pop-Location
    $script:LocationPushed = $false
}

if (-not $KeepArtifacts -and (Test-Path -LiteralPath $artifactRoot -PathType Container)) {
    Remove-TestArtifactRoot -Path $artifactRoot
}

if ($AsJson) {
    Write-Output ($report | ConvertTo-Json -Depth 20 -Compress)
}
else {
    Write-Host "Template tests passed: $($report.assertions) assertions."
    Write-Host "Context: $($report.context.file_count) files, $($report.context.pack_bytes) bytes, build $($report.context.build_ms) ms."
    Write-Host "Secret scan: $($report.secrets.scanned_files) files, $($report.secrets.findings) findings, $($report.secrets.scan_ms) ms."
    Write-Host "Proof: $proofPath"
}
