#Requires -Version 5.1
<#
.SYNOPSIS
  Renderer-neutral gknome menu model, adapters, and plain engine.
.DESCRIPTION
  Presentation only. Actions carry task IDs — never executable scriptblocks.
  Parseable by Windows PowerShell 5.1.
#>

Set-StrictMode -Version 2.0
$script:StrictJsonReader = Join-Path $PSScriptRoot '..\StrictJson.ps1'
if (-not (Test-Path -LiteralPath $script:StrictJsonReader -PathType Leaf)) {
    throw "Strict JSON reader is missing: $script:StrictJsonReader"
}
. $script:StrictJsonReader

$script:GknomeMenuModelSchema = 'gknome_menu_model_v1'
$script:MaxDisplayChars = 240
$script:MaxDescriptionChars = 480
$script:StudyBannerText = 'GKNOME'

function Get-GknomeMenuProperty {
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

function Limit-GknomeMenuText {
    param(
        [AllowNull()][AllowEmptyString()][string]$Text,
        [int]$MaxChars = 240
    )
    if ($null -eq $Text) { return '' }
    $clean = [string]$Text
    if ($clean.IndexOf([char]0) -ge 0) {
        $clean = $clean.Replace([string][char]0, '')
    }
    $builder = New-Object System.Text.StringBuilder
    foreach ($ch in $clean.ToCharArray()) {
        $code = [int][char]$ch
        if ($code -lt 32 -and $code -ne 9) { continue }
        if ($code -eq 127) { continue }
        [void]$builder.Append($ch)
    }
    $clean = $builder.ToString().Trim()
    if ($clean.Length -le $MaxChars) { return $clean }
    if ($MaxChars -le 3) { return $clean.Substring(0, $MaxChars) }
    return $clean.Substring(0, $MaxChars - 3) + '...'
}

function Get-GknomeMenuUiRoot {
    param([string]$HintPath = '')

    $candidates = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($HintPath)) {
        $candidates.Add([System.IO.Path]::GetFullPath($HintPath))
    }
    if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
        $candidates.Add($PSScriptRoot)
    }
    # Generated project: .tools/ui next to project.ps1
    # Launcher: source/launcher -> ../templates/.../template/.tools/ui
    if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
        $fromLauncher = Join-Path $PSScriptRoot '..\templates\gknome-standard\template\.tools\ui'
        $candidates.Add([System.IO.Path]::GetFullPath($fromLauncher))
        $fromTools = Join-Path $PSScriptRoot 'ui'
        $candidates.Add([System.IO.Path]::GetFullPath($fromTools))
    }
    foreach ($candidate in $candidates) {
        try {
            if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
            $core = Join-Path $candidate 'Gknome.Menu.Core.psm1'
            if (Test-Path -LiteralPath $core -PathType Leaf) {
                return (Get-Item -LiteralPath $candidate -Force).FullName
            }
        }
        catch { continue }
    }
    return $null
}

function Test-GknomeMenuInteractiveConsole {
    param([switch]$AllowHarness)

    if ($AllowHarness -and $env:GKNOME_MENU_HARNESS -eq '1') {
        return $true
    }
    try {
        if ([Console]::IsInputRedirected) { return $false }
        if ([Console]::IsOutputRedirected) { return $false }
    }
    catch { }
    try {
        if ($null -eq $Host -or $null -eq $Host.UI -or $null -eq $Host.UI.RawUI) { return $false }
        if ([string]$Host.Name -eq 'ServerRemoteHost') { return $false }
        return $true
    }
    catch {
        return $false
    }
}

function Publish-GknomeMenuFirstFrame {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('plain', 'basic', 'ansi')]
        [string]$Engine
    )

    $markerPath = [Environment]::GetEnvironmentVariable(
        'GKNOME_MENU_FIRST_FRAME_MARKER',
        'Process'
    )

    if ([string]::IsNullOrWhiteSpace($markerPath)) {
        return
    }

    $marker = [pscustomobject][ordered]@{
        schema   = 'gknome_menu_first_frame_v1'
        engine   = $Engine
        timestamp_utc = [DateTimeOffset]::UtcNow.ToString('o')
        process_id = $PID
    }

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText(
        $markerPath,
        (($marker | ConvertTo-Json -Compress) + "`n"),
        $utf8
    )
}

function Resolve-GknomeMenuEngine {
    param(
        [string]$Requested = '',
        [switch]$AllowHarness
    )

    $requested = if (-not [string]::IsNullOrWhiteSpace($Requested)) {
        $Requested.Trim().ToLowerInvariant()
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:GKNOME_MENU_ENGINE)) {
        $env:GKNOME_MENU_ENGINE.Trim().ToLowerInvariant()
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:GKNOME_ENGINE)) {
        $env:GKNOME_ENGINE.Trim().ToLowerInvariant()
    }
    else {
        'auto'
    }

    if ($requested -eq 'auto') {
        if ($AllowHarness -and $env:GKNOME_MENU_HARNESS -eq '1') { return 'plain' }
        if (-not (Test-GknomeMenuInteractiveConsole -AllowHarness:$AllowHarness)) { return 'plain' }
        if ($env:GKNOME_ASCII -eq '1' -or $env:NO_COLOR -eq '1') { return 'basic' }
        if ([int]$PSVersionTable.PSVersion.Major -ge 7) { return 'ansi' }
        return 'basic'
    }

    switch ($requested) {
        'ansi' {
            if ([int]$PSVersionTable.PSVersion.Major -ge 7) { return 'ansi' }
            return 'basic'
        }
        'basic' { return 'basic' }
        'plain' { return 'plain' }
        # Transitional aliases only. No alternate renderer is retained.
        'fancy' {
            if ([int]$PSVersionTable.PSVersion.Major -ge 7) { return 'ansi' }
            return 'basic'
        }
        'tui' {
            if ([int]$PSVersionTable.PSVersion.Major -ge 7) { return 'ansi' }
            return 'basic'
        }
        'native' {
            if ([int]$PSVersionTable.PSVersion.Major -ge 7) { return 'ansi' }
            return 'basic'
        }
        default { return 'plain' }
    }
}

function Resolve-GknomeMenuViewportEngine {
    param(
        [Parameter(Mandatory = $true)][string]$Engine,
        [Parameter(Mandatory = $true)][int]$Width,
        [Parameter(Mandatory = $true)][int]$Height
    )

    if ($Engine -in @('ansi', 'basic') -and ($Width -lt 40 -or $Height -lt 12)) {
        return 'plain'
    }
    return $Engine
}

function Test-GknomeMenuNoFallback {
    $value = [string]$env:GKNOME_NO_FALLBACK
    return ($value -eq '1' -or $value -eq 'true' -or $value -eq 'yes')
}

function Get-GknomeMenuTheme {
    param(
        [string]$UiRoot = '',
        [string]$Name = ''
    )

    $themeName = if (-not [string]::IsNullOrWhiteSpace($Name)) {
        $Name.Trim().ToLowerInvariant()
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:GKNOME_THEME)) {
        $env:GKNOME_THEME.Trim().ToLowerInvariant()
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:GKNOME_MENU_THEME)) {
        $env:GKNOME_MENU_THEME.Trim().ToLowerInvariant()
    }
    else {
        'mint'
    }

    $root = if ([string]::IsNullOrWhiteSpace($UiRoot)) { Get-GknomeMenuUiRoot } else { $UiRoot }
    $fallback = [pscustomobject]@{
        name = 'mint'
        label = 'MintRail'
        console = [pscustomobject]@{
            title = 'Cyan'; subtitle = 'DarkGray'; group = 'DarkCyan'; label = 'White'
            selected = 'Black'; selected_bg = 'Cyan'; muted = 'DarkGray'; accent = 'Cyan'
            error = 'Red'; success = 'Green'; border = 'DarkGray'
        }
        ansi = [pscustomobject]@{
            bg = @(10, 16, 18); panel = @(15, 28, 32); panel_alt = @(18, 36, 40)
            fg = @(226, 232, 240); muted = @(148, 163, 184); text_dim = @(100, 116, 139)
            accent = @(45, 212, 191); accent_hot = @(167, 139, 250); accent_deep = @(13, 100, 95)
            border = @(40, 70, 75); border_glow = @(45, 212, 191); selected_bg = @(15, 48, 52)
            selected_fg = @(240, 253, 250); path = @(103, 232, 249); hint = @(100, 116, 139)
            key_chip_bg = @(30, 41, 59); key_chip_fg = @(94, 234, 212); rail = @(45, 212, 191)
            error = @(251, 113, 133); success = @(52, 211, 153); footer_bg = @(8, 14, 16)
        }
        style = [pscustomobject]@{ name = 'study'; basic_width = 96; ansi_width = 108; banner = 'GKNOME' }
        warning = $null
    }

    if ([string]::IsNullOrWhiteSpace($root)) { return $fallback }
    $path = Join-Path $root 'themes.v1.json'
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $fallback }

    try {
        $raw = [System.IO.File]::ReadAllText($path, (New-Object System.Text.UTF8Encoding($false, $true)))
        $doc = ConvertFrom-BoundedStrictJsonText -Text $raw -MaxUtf8Bytes 1048576 -Label 'Gknome menu theme document'
        $themes = Get-GknomeMenuProperty -Object $doc -Name 'themes' -Default $null
        if ($null -eq $themes) { return $fallback }
        $selected = Get-GknomeMenuProperty -Object $themes -Name $themeName -Default $null
        $warning = $null
        if ($null -eq $selected) {
            $defaultName = [string](Get-GknomeMenuProperty -Object $doc -Name 'default' -Default 'mint')
            $selected = Get-GknomeMenuProperty -Object $themes -Name $defaultName -Default $null
            $warning = "Unknown theme '$themeName'; using '$defaultName'."
            $themeName = $defaultName
        }
        if ($null -eq $selected) { return $fallback }
        return [pscustomobject]@{
            name = $themeName
            label = [string](Get-GknomeMenuProperty -Object $selected -Name 'label' -Default $themeName)
            console = Get-GknomeMenuProperty -Object $selected -Name 'console' -Default $fallback.console
            ansi = Get-GknomeMenuProperty -Object $selected -Name 'ansi' -Default $fallback.ansi
            style = Get-GknomeMenuProperty -Object $selected -Name 'style' -Default $fallback.style
            warning = $warning
        }
    }
    catch {
        $fallback.warning = "Theme load failed: $($_.Exception.Message)"
        return $fallback
    }
}

function Get-GknomeMenuStyle {
    <#
      The style study is a presentation profile, not a second controller.
      Keep the profile small and renderer-neutral so PS5, PS7, and the native
      companion can agree on the visible contract without sharing actions.
    #>
    $name = if (-not [string]::IsNullOrWhiteSpace($env:GKNOME_MENU_STYLE)) {
        $env:GKNOME_MENU_STYLE.Trim().ToLowerInvariant()
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:GKNOME_STYLE)) {
        $env:GKNOME_STYLE.Trim().ToLowerInvariant()
    }
    else {
        'study'
    }

    if ($name -notin @('study', 'classic')) { $name = 'study' }
    if ($name -eq 'classic') {
        return [pscustomobject]@{
            name = 'classic'; basic_width = 96; ansi_width = 108; banner = 'GKNOME'
            border = 'square'; selection = 'soft'; gradient = $false; hyperlink = $false
        }
    }
    return [pscustomobject]@{
        name = 'study'; basic_width = 96; ansi_width = 108; banner = 'GKNOME'
        border = 'square'; selection = 'soft'; gradient = $true; hyperlink = $true
    }
}

function Get-GknomeMenuThemeNames {
    param([string]$UiRoot = '')

    $root = if ([string]::IsNullOrWhiteSpace($UiRoot)) { Get-GknomeMenuUiRoot } else { $UiRoot }
    if ([string]::IsNullOrWhiteSpace($root)) { return @('mint') }
    $path = Join-Path $root 'themes.v1.json'
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return @('mint') }
    try {
        $raw = [System.IO.File]::ReadAllText($path, (New-Object System.Text.UTF8Encoding($false, $true)))
        $doc = ConvertFrom-BoundedStrictJsonText -Text $raw -MaxUtf8Bytes 1048576 -Label 'Gknome menu theme document'
        $themes = Get-GknomeMenuProperty -Object $doc -Name 'themes' -Default $null
        if ($null -eq $themes) { return @('mint') }
        $names = @($themes.PSObject.Properties | ForEach-Object { [string]$_.Name } | Sort-Object)
        if ($names.Count -eq 0) { return @('mint') }
        return $names
    }
    catch {
        return @('mint')
    }
}

function New-GknomeMenuAction {
    param(
        [Parameter(Mandatory = $true)][string]$Task,
        [Parameter(Mandatory = $true)][string]$Label,
        [string]$Description = '',
        [string]$Group = '',
        [string]$Owner = 'script',
        [bool]$Enabled = $true,
        [bool]$RequiresConfirmation = $false,
        [string]$Role = 'read',
        [string]$Maturity = 'stable',
        [string]$Network = 'off',
        [string]$Confirmation = '',
        [string]$Id = ''
    )

    $task = Limit-GknomeMenuText -Text $Task -MaxChars 80
    $id = if ([string]::IsNullOrWhiteSpace($Id)) { $task } else { Limit-GknomeMenuText -Text $Id -MaxChars 80 }
    $confirmationMode = Get-GknomeMenuConfirmationMode -Confirmation $Confirmation -RequiresConfirmation $RequiresConfirmation
    return [pscustomobject]@{
        id = $id
        task = $task
        label = (Limit-GknomeMenuText -Text $Label -MaxChars $script:MaxDisplayChars)
        description = (Limit-GknomeMenuText -Text $Description -MaxChars $script:MaxDescriptionChars)
        group = (Limit-GknomeMenuText -Text $Group -MaxChars 80)
        owner = (Limit-GknomeMenuText -Text $Owner -MaxChars 32)
        enabled = [bool]$Enabled
        role = (Limit-GknomeMenuText -Text $Role -MaxChars 24)
        maturity = (Limit-GknomeMenuText -Text $Maturity -MaxChars 24)
        network = (Limit-GknomeMenuText -Text $Network -MaxChars 24)
        confirmation = $confirmationMode
        requires_confirmation = $confirmationMode -ne 'none'
    }
}

function Get-GknomeMenuConfirmationMode {
    param(
        [string]$Confirmation = '',
        [bool]$RequiresConfirmation = $false
    )

    $candidate = ([string]$Confirmation).Trim().ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($candidate)) {
        return $(if ($RequiresConfirmation) { 'prompt' } else { 'none' })
    }
    if ($candidate -in @('true', 'yes', '1')) { return 'prompt' }
    if ($candidate -in @('false', 'no', '0')) { return 'none' }
    if ($candidate -in @('none', 'prompt', 'typed')) { return $candidate }
    # Invalid or future modes fail closed in the presentation layer. The
    # controller contract validator remains the authoritative error surface.
    return 'typed'
}

function ConvertTo-GknomeMenuGroups {
    param([object[]]$Groups = @())

    $normalizedGroups = New-Object System.Collections.Generic.List[object]
    $index = 0
    foreach ($group in @($Groups)) {
        $groupLabel = Limit-GknomeMenuText -Text ([string](Get-GknomeMenuProperty -Object $group -Name 'label' -Default 'Tasks')) -MaxChars 80
        $groupId = Limit-GknomeMenuText -Text ([string](Get-GknomeMenuProperty -Object $group -Name 'id' -Default ("g$index"))) -MaxChars 40
        $actions = New-Object System.Collections.Generic.List[object]
        foreach ($action in @(Get-GknomeMenuProperty -Object $group -Name 'actions' -Default @())) {
            if ($action -is [hashtable] -or $null -ne $action.PSObject) {
                $actions.Add((New-GknomeMenuAction `
                    -Task ([string](Get-GknomeMenuProperty -Object $action -Name 'task' -Default '')) `
                    -Label ([string](Get-GknomeMenuProperty -Object $action -Name 'label' -Default '')) `
                    -Description ([string](Get-GknomeMenuProperty -Object $action -Name 'description' -Default '')) `
                    -Group $groupLabel `
                    -Owner ([string](Get-GknomeMenuProperty -Object $action -Name 'owner' -Default 'script')) `
                    -Enabled ([bool](Get-GknomeMenuProperty -Object $action -Name 'enabled' -Default $true)) `
                    -RequiresConfirmation ([bool](Get-GknomeMenuProperty -Object $action -Name 'requires_confirmation' -Default $false)) `
                    -Role ([string](Get-GknomeMenuProperty -Object $action -Name 'role' -Default 'read')) `
                    -Maturity ([string](Get-GknomeMenuProperty -Object $action -Name 'maturity' -Default 'stable')) `
                    -Network ([string](Get-GknomeMenuProperty -Object $action -Name 'network' -Default 'off')) `
                    -Confirmation ([string](Get-GknomeMenuProperty -Object $action -Name 'confirmation' -Default '')) `
                    -Id ([string](Get-GknomeMenuProperty -Object $action -Name 'id' -Default ''))))
            }
        }
        if ($actions.Count -gt 0) {
            $normalizedGroups.Add([pscustomobject]@{
                id = $groupId
                label = $groupLabel
                actions = @($actions.ToArray())
            })
        }
        $index++
    }
    return @($normalizedGroups.ToArray())
}

function New-GknomeMenuModel {
    param(
        [string]$ProductTitle = 'gknome',
        [string]$ProjectLabel = '',
        [string]$Subtitle = '',
        [string[]]$StatusLines = @(),
        [object[]]$Groups = @(),
        [object[]]$Pages = @(),
        [string[]]$FooterLines = @(),
        [string[]]$HelpLines = @()
    )

    $normalizedGroups = @(ConvertTo-GknomeMenuGroups -Groups $Groups)
    $normalizedPages = New-Object System.Collections.Generic.List[object]
    foreach ($page in @($Pages)) {
        $pageId = Limit-GknomeMenuText -Text ([string](Get-GknomeMenuProperty -Object $page -Name 'id' -Default 'page')) -MaxChars 40
        $pageLabel = Limit-GknomeMenuText -Text ([string](Get-GknomeMenuProperty -Object $page -Name 'label' -Default $pageId)) -MaxChars 80
        $pageDescription = Limit-GknomeMenuText -Text ([string](Get-GknomeMenuProperty -Object $page -Name 'description' -Default '')) -MaxChars $script:MaxDescriptionChars
        $parentPageId = Limit-GknomeMenuText -Text ([string](Get-GknomeMenuProperty -Object $page -Name 'parent_page_id' -Default '')) -MaxChars 40
        $pageGroups = @(ConvertTo-GknomeMenuGroups -Groups (Get-GknomeMenuProperty -Object $page -Name 'groups' -Default @()))
        if ($pageGroups.Count -gt 0) {
            $normalizedPages.Add([pscustomobject]@{
                id = $pageId
                label = $pageLabel
                description = $pageDescription
                parent_page_id = $parentPageId
                groups = $pageGroups
            })
        }
    }
    if ($normalizedPages.Count -eq 0 -and $normalizedGroups.Count -gt 0) {
        $normalizedPages.Add([pscustomobject]@{
            id = 'all'
            label = 'All actions'
            description = ''
            parent_page_id = ''
            groups = $normalizedGroups
        })
    }

    return [pscustomobject]@{
        schema = $script:GknomeMenuModelSchema
        product_title = (Limit-GknomeMenuText -Text $ProductTitle -MaxChars 80)
        project_label = (Limit-GknomeMenuText -Text $ProjectLabel -MaxChars 120)
        subtitle = (Limit-GknomeMenuText -Text $Subtitle -MaxChars 160)
        status_lines = @($StatusLines | ForEach-Object { Limit-GknomeMenuText -Text ([string]$_) -MaxChars $script:MaxDisplayChars })
        groups = @($normalizedGroups)
        pages = @($normalizedPages.ToArray())
        footer_lines = @($FooterLines | ForEach-Object { Limit-GknomeMenuText -Text ([string]$_) -MaxChars $script:MaxDisplayChars })
        help_lines = @($HelpLines | ForEach-Object { Limit-GknomeMenuText -Text ([string]$_) -MaxChars $script:MaxDisplayChars })
    }
}

function Get-GknomeMenuPages {
    param([Parameter(Mandatory = $true)][object]$Model)

    $pages = @(Get-GknomeMenuProperty -Object $Model -Name 'pages' -Default @())
    if ($pages.Count -gt 0) { return $pages }
    $groups = @(Get-GknomeMenuProperty -Object $Model -Name 'groups' -Default @())
    if ($groups.Count -eq 0) { return @() }
    return @([pscustomobject]@{ id = 'all'; label = 'All actions'; description = ''; parent_page_id = ''; groups = $groups })
}

function Get-GknomeMenuPageGroups {
    param(
        [Parameter(Mandatory = $true)][object]$Model,
        [int]$PageIndex = 0
    )

    $pages = @(Get-GknomeMenuPages -Model $Model)
    if ($pages.Count -eq 0) { return @() }
    $safeIndex = [Math]::Min([Math]::Max(0, $PageIndex), $pages.Count - 1)
    return @(Get-GknomeMenuProperty -Object $pages[$safeIndex] -Name 'groups' -Default @())
}

function Get-GknomeMenuPageLabel {
    param(
        [Parameter(Mandatory = $true)][object]$Model,
        [int]$PageIndex = 0
    )

    $pages = @(Get-GknomeMenuPages -Model $Model)
    if ($pages.Count -eq 0) { return '' }
    $safeIndex = [Math]::Min([Math]::Max(0, $PageIndex), $pages.Count - 1)
    return [string](Get-GknomeMenuProperty -Object $pages[$safeIndex] -Name 'label' -Default '')
}

function Get-GknomeMenuPageDescription {
    param(
        [Parameter(Mandatory = $true)][object]$Model,
        [int]$PageIndex = 0
    )

    $pages = @(Get-GknomeMenuPages -Model $Model)
    if ($pages.Count -eq 0) { return '' }
    $safeIndex = [Math]::Min([Math]::Max(0, $PageIndex), $pages.Count - 1)
    return [string](Get-GknomeMenuProperty -Object $pages[$safeIndex] -Name 'description' -Default '')
}

function Get-GknomeMenuPageIndexById {
    param(
        [Parameter(Mandatory = $true)][object]$Model,
        [AllowEmptyString()][string]$PageId = ''
    )

    if ([string]::IsNullOrWhiteSpace($PageId)) { return -1 }
    $pages = @(Get-GknomeMenuPages -Model $Model)
    for ($i = 0; $i -lt $pages.Count; $i++) {
        if ([string](Get-GknomeMenuProperty -Object $pages[$i] -Name 'id' -Default '') -eq $PageId) { return $i }
    }
    return -1
}

function Get-GknomeMenuParentPageIndex {
    param(
        [Parameter(Mandatory = $true)][object]$Model,
        [int]$PageIndex = 0
    )

    $pages = @(Get-GknomeMenuPages -Model $Model)
    if ($pages.Count -eq 0) { return -1 }
    $safeIndex = [Math]::Min([Math]::Max(0, $PageIndex), $pages.Count - 1)
    $parentId = [string](Get-GknomeMenuProperty -Object $pages[$safeIndex] -Name 'parent_page_id' -Default '')
    return Get-GknomeMenuPageIndexById -Model $Model -PageId $parentId
}

function ConvertTo-GknomeMenuModelFromController {
    param(
        [Parameter(Mandatory = $true)][object]$Controller,
        [string]$ProjectLabel = '',
        [string[]]$StatusLines = @(),
        [string[]]$FooterLines = @(),
        [hashtable]$OwnerByTask = @{},
        [hashtable]$ConfirmationByTask = @{}
    )

    $title = [string](Get-GknomeMenuProperty -Object $Controller -Name 'title' -Default 'Project Controller')
    $groups = New-Object System.Collections.Generic.List[object]
    $gi = 0
    foreach ($group in @(Get-GknomeMenuProperty -Object $Controller -Name 'groups' -Default @())) {
        $groupLabel = [string](Get-GknomeMenuProperty -Object $group -Name 'label' -Default 'Tasks')
        $actions = New-Object System.Collections.Generic.List[object]
        foreach ($action in @(Get-GknomeMenuProperty -Object $group -Name 'actions' -Default @())) {
            $task = [string](Get-GknomeMenuProperty -Object $action -Name 'task' -Default '')
            if ([string]::IsNullOrWhiteSpace($task)) { continue }
            $owner = 'script'
            if ($OwnerByTask.ContainsKey($task)) { $owner = [string]$OwnerByTask[$task] }
            $confirm = ''
            if ($ConfirmationByTask.ContainsKey($task)) { $confirm = [string]$ConfirmationByTask[$task] }
            $actions.Add([pscustomobject]@{
                id = $task
                task = $task
                label = [string](Get-GknomeMenuProperty -Object $action -Name 'label' -Default $task)
                description = [string](Get-GknomeMenuProperty -Object $action -Name 'description' -Default '')
                group = $groupLabel
                owner = $owner
                enabled = $true
                role = 'read'
                maturity = 'stable'
                network = 'off'
                confirmation = (Get-GknomeMenuConfirmationMode -Confirmation $confirm -RequiresConfirmation ($confirm -eq 'True'))
            })
        }
        if ($actions.Count -gt 0) {
            $groups.Add([pscustomobject]@{
                id = "g$gi"
                label = $groupLabel
                actions = @($actions.ToArray())
            })
        }
        $gi++
    }

    return New-GknomeMenuModel `
        -ProductTitle 'gknome' `
        -ProjectLabel $ProjectLabel `
        -Subtitle $title `
        -StatusLines $StatusLines `
        -Groups @($groups.ToArray()) `
        -FooterLines $(if ($FooterLines.Count -gt 0) { $FooterLines } else { @('Enter number, arrows+Enter (styled engines), H help, Q quit') }) `
        -HelpLines @('Select a numbered action to run the matching controller task ID.', 'Presentation never executes scriptblocks; the controller owns execution.')
}

function Test-GknomeMenuOperationAvailability {
    param(
        [Parameter(Mandatory = $true)][object]$Operation,
        [string]$RootPath = '',
        [string[]]$Capabilities = @()
    )

    $availability = Get-GknomeMenuProperty -Object $Operation -Name 'availability' -Default $null
    $reasons = New-Object System.Collections.Generic.List[string]
    $platform = [string](Get-GknomeMenuProperty -Object $availability -Name 'platform' -Default 'any')
    $currentPlatform = if ($env:OS -eq 'Windows_NT') { 'windows' } elseif ([string]$env:OSTYPE -match '(?i)darwin|mac') { 'macos' } else { 'linux' }
    if ($platform -notin @('', 'any', $currentPlatform)) { $reasons.Add("platform=$platform") }

    $knownCapabilities = @($Capabilities | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $_ })
    foreach ($required in @(Get-GknomeMenuProperty -Object $availability -Name 'capabilities' -Default @())) {
        if ($knownCapabilities -notcontains ([string]$required).ToLowerInvariant()) { $reasons.Add("capability=$required") }
    }

    foreach ($commandName in @(Get-GknomeMenuProperty -Object $availability -Name 'commands' -Default @())) {
        if (-not (Test-GknomeMenuCommandAvailable -Name ([string]$commandName))) { $reasons.Add("command=$commandName") }
    }

    $root = if ([string]::IsNullOrWhiteSpace($RootPath)) { try { (Get-Location).Path } catch { '' } } else { $RootPath }
    foreach ($relative in @(Get-GknomeMenuProperty -Object $availability -Name 'paths' -Default @())) {
        if ([string]::IsNullOrWhiteSpace($root) -or -not (Test-Path -LiteralPath (Join-Path $root ([string]$relative)))) {
            $reasons.Add("path=$relative")
        }
    }

    foreach ($name in @(Get-GknomeMenuProperty -Object $availability -Name 'environment' -Default @())) {
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable([string]$name))) { $reasons.Add("environment=$name") }
    }

    return [pscustomobject]@{
        enabled = ($reasons.Count -eq 0)
        reason = if ($reasons.Count -eq 0) { '' } else { $reasons -join ', ' }
    }
}

$script:GknomeCommandAvailability = @{}

function Test-GknomeMenuCommandAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $key = $Name.Trim().ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($key)) {
        return $false
    }

    if (-not $script:GknomeCommandAvailability.ContainsKey($key)) {
        $script:GknomeCommandAvailability[$key] =
            $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
    }

    return [bool]$script:GknomeCommandAvailability[$key]
}

function Order-GknomeMenuPageModels {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$PageModels
    )

    $ordered = New-Object System.Collections.Generic.List[object]
    $added = New-Object 'System.Collections.Generic.HashSet[string]' (
        [System.StringComparer]::OrdinalIgnoreCase
    )

    foreach ($preferredId in @('main', 'git', 'scripts')) {
        $match = @(
            $PageModels |
                Where-Object { [string]$_.id -eq $preferredId } |
                Select-Object -First 1
        )

        if ($match.Count -eq 1 -and $added.Add($preferredId)) {
            $ordered.Add($match[0])
        }
    }

    # Backward-compatible containment only.
    # Canonical controllers are tested to have exactly three pages.
    foreach ($page in $PageModels) {
        if ($added.Add([string]$page.id)) {
            $ordered.Add($page)
        }
    }

    return @($ordered.ToArray())
}

 function ConvertTo-GknomeMenuModelFromOperator {
    param(
        [Parameter(Mandatory = $true)][object]$Operator,
        [Parameter(Mandatory = $true)][object]$LegacyController,
        [string]$ProjectLabel = '',
        [string]$RootPath = '',
        [string[]]$StatusLines = @(),
        [string[]]$FooterLines = @(),
        [hashtable]$Capabilities = @{},
        [hashtable]$OwnerByTask = @{},
        [hashtable]$ConfirmationByTask = @{}
    )

    if ([string](Get-GknomeMenuProperty -Object $Operator -Name 'schema' -Default '') -ne 'gknome_controller_v3') {
        throw 'Operator controller must declare gknome_controller_v3.'
    }
    if ([string](Get-GknomeMenuProperty -Object $Operator -Name 'operation_schema' -Default '') -ne 'gknome_operation_v1') {
        throw 'Operator controller must declare gknome_operation_v1.'
    }

    $capabilityNames = @($Capabilities.Keys | ForEach-Object { [string]$_ })
    $operationById = @{}
    foreach ($operation in @(Get-GknomeMenuProperty -Object $Operator -Name 'operations' -Default @())) {
        $id = [string](Get-GknomeMenuProperty -Object $operation -Name 'id' -Default '')
        $task = [string](Get-GknomeMenuProperty -Object $operation -Name 'task' -Default '')
        if ([string]::IsNullOrWhiteSpace($id) -or [string]::IsNullOrWhiteSpace($task) -or $operationById.ContainsKey($id)) {
            throw "Operator controller contains an invalid or duplicate operation: $id"
        }
        $operationById[$id] = $operation
    }

    $operatorPages = @(Get-GknomeMenuProperty -Object $Operator -Name 'pages' -Default @())
    $fallbackPageId = [string](
        Get-GknomeMenuProperty `
            -Object (
                Get-GknomeMenuProperty `
                    -Object $Operator `
                    -Name 'compatibility' `
                    -Default $null
            ) `
            -Name 'legacy_page_id' `
            -Default 'scripts'
    )

    if (@(
        $operatorPages |
            Where-Object {
                [string](
                    Get-GknomeMenuProperty `
                        -Object $_ `
                        -Name 'id' `
                        -Default ''
                ) -eq $fallbackPageId
            }
    ).Count -ne 1) {
        throw "Operator compatibility fallback page was not found: $fallbackPageId"
    }

    $groups = New-Object System.Collections.Generic.List[object]
    $pageModels = New-Object System.Collections.Generic.List[object]
    $projectPageIds = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
    $seenTasks = @{}
    foreach ($page in $operatorPages) {
        $pageId = [string](Get-GknomeMenuProperty -Object $page -Name 'id' -Default '')
        $pageLabel = [string](Get-GknomeMenuProperty -Object $page -Name 'label' -Default $pageId)
        $parentPageId = [string](Get-GknomeMenuProperty -Object $page -Name 'parent_page_id' -Default '')
        if (-not [string]::IsNullOrWhiteSpace($parentPageId)) {
            $parentPage = @(Get-GknomeMenuProperty -Object $Operator -Name 'pages' -Default @() | Where-Object {
                    [string](Get-GknomeMenuProperty -Object $_ -Name 'id' -Default '') -eq $parentPageId
                } | Select-Object -First 1)
            if ($parentPage.Count -gt 0) {
                $parentLabel = [string](Get-GknomeMenuProperty -Object $parentPage[0] -Name 'label' -Default $parentPageId)
                $pageLabel = "$parentLabel > $pageLabel"
            }
        }
        $pageOperations = @(Get-GknomeMenuProperty -Object $page -Name 'operations' -Default @())
        $hideWhenEmpty = [bool](Get-GknomeMenuProperty -Object $page -Name 'hidden_when_empty' -Default $false)
        if ($hideWhenEmpty -and $pageOperations.Count -eq 0) { continue }
        $actions = New-Object System.Collections.Generic.List[object]
        foreach ($operationId in $pageOperations) {
            $operationKey = [string]$operationId
            if (-not $operationById.ContainsKey($operationKey)) { throw "Operator page '$pageId' references missing operation '$operationKey'." }
            $operation = $operationById[$operationKey]
            $task = [string](Get-GknomeMenuProperty -Object $operation -Name 'task' -Default '')
            if ($seenTasks.ContainsKey($task)) { throw "Operator controller assigns task '$task' more than once." }
            $seenTasks[$task] = $true
            $availabilityResult = Test-GknomeMenuOperationAvailability -Operation $operation -RootPath $RootPath -Capabilities $capabilityNames
            $role = [string](Get-GknomeMenuProperty -Object $operation -Name 'role' -Default 'read')
            $maturity = [string](Get-GknomeMenuProperty -Object $operation -Name 'maturity' -Default 'stable')
            $network = [string](Get-GknomeMenuProperty -Object $operation -Name 'network' -Default 'off')
            $confirmation = Get-GknomeMenuConfirmationMode -Confirmation ([string](Get-GknomeMenuProperty -Object $operation -Name 'confirmation' -Default '')) -RequiresConfirmation ($role -eq 'mutate')
            if ($role -notin @('read', 'preview', 'mutate', 'open') -or $maturity -notin @('stable', 'review', 'experimental') -or $network -notin @('off', 'read', 'write')) {
                throw "Operator operation '$task' has invalid safety metadata."
            }
            if ($confirmation -eq 'none' -and ($role -eq 'mutate' -or $network -eq 'write')) {
                throw "Operator operation '$task' cannot combine confirmation=none with role=$role or network=$network."
            }
            $description = [string](Get-GknomeMenuProperty -Object $operation -Name 'description' -Default '')
            $disabledReason = [string](Get-GknomeMenuProperty -Object $operation -Name 'disabled_reason' -Default '')
            if (-not [bool]$availabilityResult.enabled) {
                $reason = if ([string]::IsNullOrWhiteSpace($disabledReason)) { $availabilityResult.reason } else { $disabledReason }
                $description = "$description (unavailable: $reason)"
            }
            elseif (-not [string]::IsNullOrWhiteSpace($disabledReason)) {
                $description = "$description ($disabledReason)"
            }
            $owner = if ($OwnerByTask.ContainsKey($task)) { [string]$OwnerByTask[$task] } else { "operator/$role" }
            $enabled = [bool]$availabilityResult.enabled
            if (-not $enabled -and [bool](Get-GknomeMenuProperty -Object $operation -Name 'hidden_when_unavailable' -Default $false)) { continue }
            $actions.Add((New-GknomeMenuAction -Task $task -Label ([string](Get-GknomeMenuProperty -Object $operation -Name 'label' -Default $task)) -Description $description -Group $pageLabel -Owner $owner -Enabled $enabled -Role $role -Maturity $maturity -Network $network -Confirmation $confirmation -Id ([string](Get-GknomeMenuProperty -Object $operation -Name 'id' -Default $task))))
        }
        if ($actions.Count -gt 0) {
            $pageGroup = [pscustomobject]@{ id = $pageId; label = $pageLabel; actions = @($actions.ToArray()) }
            $groups.Add($pageGroup)
            $pageModels.Add([pscustomobject]@{
                id = $pageId
                label = $pageLabel
                description = [string](Get-GknomeMenuProperty -Object $page -Name 'description' -Default '')
                parent_page_id = $parentPageId
                groups = @($pageGroup)
            })
            foreach ($operationId in $pageOperations) {
                $operation = $operationById[[string]$operationId]
                if ([string](Get-GknomeMenuProperty -Object $operation -Name 'owner' -Default 'foundation') -eq 'project') {
                    [void]$projectPageIds.Add($pageId)
                    break
                }
            }
        }
    }

    $legacyActions = New-Object System.Collections.Generic.List[object]
    foreach ($legacyGroup in @(Get-GknomeMenuProperty -Object $LegacyController -Name 'groups' -Default @())) {
        foreach ($legacyAction in @(Get-GknomeMenuProperty -Object $legacyGroup -Name 'actions' -Default @())) {
            $task = [string](Get-GknomeMenuProperty -Object $legacyAction -Name 'task' -Default '')
            if ([string]::IsNullOrWhiteSpace($task) -or $seenTasks.ContainsKey($task)) { continue }
            $seenTasks[$task] = $true
            $confirm = if ($ConfirmationByTask.ContainsKey($task)) { [string]$ConfirmationByTask[$task] } else { '' }
            $owner = if ($OwnerByTask.ContainsKey($task)) { [string]$OwnerByTask[$task] } else { 'legacy/script' }
            $legacyActions.Add((New-GknomeMenuAction -Task $task -Label ([string](Get-GknomeMenuProperty -Object $legacyAction -Name 'label' -Default $task)) -Description ([string](Get-GknomeMenuProperty -Object $legacyAction -Name 'description' -Default '')) -Group 'Scripts' -Owner $owner -Confirmation $confirm))
        }
    }
    if ($legacyActions.Count -gt 0) {
        $fallbackPage = @(
            $pageModels |
                Where-Object { [string]$_.id -eq $fallbackPageId } |
                Select-Object -First 1
        )

        if ($fallbackPage.Count -ne 1) {
            throw "Normalized compatibility fallback page was not found: $fallbackPageId"
        }

        $fallbackGroups = @($fallbackPage[0].groups)
        if ($fallbackGroups.Count -ne 1) {
            throw "Compatibility fallback page must contain one normalized group: $fallbackPageId"
        }

        $fallbackGroups[0].actions = @($fallbackGroups[0].actions) +
            @($legacyActions.ToArray())

        foreach ($action in @($legacyActions.ToArray())) {
            $action.group = [string]$fallbackGroups[0].label
            $action.owner = 'compatibility/script'
        }
    }

    $operatorTitle = [string](Get-GknomeMenuProperty -Object $Operator -Name 'title' -Default 'Operator Console')
    $orderedPageModels = Order-GknomeMenuPageModels -PageModels @($pageModels.ToArray())
    return New-GknomeMenuModel `
        -ProductTitle 'gknome' `
        -ProjectLabel $ProjectLabel `
        -Subtitle $operatorTitle `
        -StatusLines $StatusLines `
        -Groups @($groups.ToArray()) `
        -Pages $orderedPageModels `
        -FooterLines $(if ($FooterLines.Count -gt 0) { $FooterLines } else { @('[Enter] run  [/] filter  [Tab] page  [H] help  [Q] quit') }) `
        -HelpLines @(
            'Main contains daily project actions.',
            'Git contains status, pull, and push.',
            'Scripts contains all other actions.',
            'Unavailable actions remain visible with a bounded reason.'
        )
}

function ConvertTo-GknomeMenuModelFromGlobalContext {
    param(
        [Parameter(Mandatory = $true)][object]$Context
    )

    $contextName = [string](Get-GknomeMenuProperty -Object $Context -Name 'context' -Default 'unknown')
    $path = [string](Get-GknomeMenuProperty -Object $Context -Name 'current_path' -Default '')
    $projectRoot = [string](Get-GknomeMenuProperty -Object $Context -Name 'project_root' -Default '')
    $safe = [bool](Get-GknomeMenuProperty -Object $Context -Name 'safe_to_mutate' -Default $false)
    $recommendation = [string](Get-GknomeMenuProperty -Object $Context -Name 'recommendation' -Default '')

    $status = @(
        "Context: $contextName",
        "Folder: $path"
    )
    if (-not [string]::IsNullOrWhiteSpace($projectRoot)) { $status += "Project root: $projectRoot" }
    $status += "Safe to mutate: $safe"
    $readiness = Get-GknomeMenuProperty -Object $Context -Name 'readiness' -Default $null
    $readinessLabel = [string](Get-GknomeMenuProperty -Object $readiness -Name 'label' -Default 'NOT MEASURED')
    $status += "Readiness: $readinessLabel"
    $missingCount = [int](Get-GknomeMenuProperty -Object $readiness -Name 'missing_count' -Default 0)
    if ($missingCount -gt 0) {
        $missingPaths = @(Get-GknomeMenuProperty -Object $readiness -Name 'missing_paths' -Default @())
        if ($missingPaths.Count -gt 0) { $status += "Missing: $([string]::Join(', ', $missingPaths))" }
    }
    if (-not [string]::IsNullOrWhiteSpace($recommendation)) { $status += $recommendation }

    $isProject = $contextName -in @('project-root', 'nested-project')
    $isSetupReady = $contextName -in @('empty-directory', 'nonempty-directory') -and $safe
    $actions = New-Object System.Collections.Generic.List[object]

    if ($isProject) {
        $actions.Add((New-GknomeMenuAction -Task 'global-update-gknome' -Label 'Update / modify gknome (provenance refresh, then open)' -Description 'Refresh provenance-owned foundation files from the current gknome payload, then open the local controller. Stops before any change when a foundation file was edited locally.' -Group 'Project' -Owner 'launcher' -Role 'mutate' -Confirmation 'typed'))
        $actions.Add((New-GknomeMenuAction -Task 'global-open-controller' -Label 'Open local gknome controller' -Description 'Open the project controller menu without changing project files.' -Group 'Project' -Owner 'launcher' -Role 'open'))
        $actions.Add((New-GknomeMenuAction -Task 'global-doctor' -Label 'Run project doctor' -Description 'Validate required contracts, runners, schemas, and lifecycle state without a full regression suite.' -Group 'Project' -Owner 'launcher'))
        $actions.Add((New-GknomeMenuAction -Task 'global-show-context' -Label 'Show context again' -Description 'Re-print the current launcher context summary.' -Group 'Project' -Owner 'launcher'))
    }
    elseif ($isSetupReady) {
        $actions.Add((New-GknomeMenuAction -Task 'global-setup-repair' -Label 'Setup / repair this folder (add missing foundation)' -Description 'Add missing gknome foundation entries without replacing caller-owned files.' -Group 'Setup' -Owner 'launcher' -Role 'mutate' -Confirmation 'prompt'))
        $actions.Add((New-GknomeMenuAction -Task 'global-show-context' -Label 'Show context again' -Description 'Re-print the current launcher context summary.' -Group 'Setup' -Owner 'launcher'))
    }
    else {
        $actions.Add((New-GknomeMenuAction -Task 'global-show-context' -Label 'Show blocked context and safety guidance' -Description 'Display why mutation is refused in this folder.' -Group 'Safety' -Owner 'launcher'))
    }

    $groupLabel = if ($isProject) { 'Project' } elseif ($isSetupReady) { 'Setup' } else { 'Safety' }
    return New-GknomeMenuModel `
        -ProductTitle 'gknome setup / modify / repair' `
        -ProjectLabel $(if ($isProject -and -not [string]::IsNullOrWhiteSpace($projectRoot)) { Split-Path -Leaf $projectRoot } else { $contextName }) `
        -Subtitle 'Safe, context-aware project foundation and controller handoff' `
        -StatusLines $status `
        -Groups @([pscustomobject]@{ id = 'global'; label = $groupLabel; actions = @($actions.ToArray()) }) `
        -FooterLines @('Number + Enter, H help, Q quit') `
        -HelpLines @('Global menu actions are launcher-owned. Project tasks run only after opening the local controller.')
}

function Get-GknomeMenuFlatActions {
    param([Parameter(Mandatory = $true)][object]$Model)

    $list = New-Object System.Collections.Generic.List[object]
    foreach ($group in @($Model.groups)) {
        foreach ($action in @($group.actions)) {
            $list.Add($action)
        }
    }
    return @($list.ToArray())
}

function Get-GknomeMenuConsoleSize {
    $width = 80
    $height = 24
    try {
        $size = $Host.UI.RawUI.WindowSize
        if ($null -ne $size) {
            if ([int]$size.Width -gt 0) { $width = [int]$size.Width }
            if ([int]$size.Height -gt 0) { $height = [int]$size.Height }
        }
    }
    catch { }
    return [pscustomobject]@{ Width = [Math]::Max(1, $width); Height = [Math]::Max(1, $height) }
}

function Get-GknomeMenuFrameWidth {
    param(
        [int]$Preferred = 72,
        [int]$Minimum = 12,
        [int]$Maximum = 90,
        [AllowNull()][object]$ConsoleSize = $null
    )

    $requested = $Preferred
    $envWidth = 0
    if ([int]::TryParse([string]$env:GKNOME_MENU_WIDTH, [ref]$envWidth) -and $envWidth -gt 0) {
        $requested = $envWidth
    }
    $size = if ($null -eq $ConsoleSize) { Get-GknomeMenuConsoleSize } else { $ConsoleSize }
    $safeMinimum = [Math]::Max(4, $Minimum)
    $safeMaximum = [Math]::Max($safeMinimum, $Maximum)
    $available = [Math]::Max(4, [int]$size.Width - 1)
    $preferredWidth = [Math]::Min($safeMaximum, [Math]::Max($safeMinimum, $requested))
    # The physical viewport always wins over the stylistic minimum. Writing a
    # frame wider than the real console wraps rows and invalidates mouse zones.
    return [Math]::Min($preferredWidth, $available)
}

function Get-GknomeMenuBannerGlyphMap {
    return @{
        'A' = @(' #### ', '##  ##', '######', '##  ##', '##  ##')
        'B' = @('##### ', '##  ##', '##### ', '##  ##', '##### ')
        'C' = @(' #### ', '##    ', '##    ', '##    ', ' #### ')
        'D' = @('##### ', '##  ##', '##  ##', '##  ##', '##### ')
        'E' = @('######', '##    ', '####  ', '##    ', '######')
        'F' = @('######', '##    ', '####  ', '##    ', '##    ')
        'G' = @(' #### ', '##    ', '## ###', '##  ##', ' #### ')
        'H' = @('##  ##', '##  ##', '######', '##  ##', '##  ##')
        'I' = @('######', '  ##  ', '  ##  ', '  ##  ', '######')
        'J' = @('  ####', '    ##', '    ##', '##  ##', ' #### ')
        'K' = @('##  ##', '## ## ', '####  ', '## ## ', '##  ##')
        'L' = @('##    ', '##    ', '##    ', '##    ', '######')
        'M' = @('##   ##', '### ###', '## # ##', '##   ##', '##   ##')
        'N' = @('##  ##', '### ##', '## ###', '##  ##', '##  ##')
        'O' = @(' #### ', '##  ##', '##  ##', '##  ##', ' #### ')
        'P' = @('##### ', '##  ##', '##### ', '##    ', '##    ')
        'Q' = @(' #### ', '##  ##', '##  ##', '## ## ', ' ### #')
        'R' = @('##### ', '##  ##', '##### ', '## ## ', '##  ##')
        'S' = @(' #####', '##    ', ' #### ', '    ##', '##### ')
        'T' = @('######', '  ##  ', '  ##  ', '  ##  ', '  ##  ')
        'U' = @('##  ##', '##  ##', '##  ##', '##  ##', ' #### ')
        'V' = @('##  ##', '##  ##', '##  ##', ' #### ', '  ##  ')
        'W' = @('##   ##', '##   ##', '## # ##', '### ###', '##   ##')
        'X' = @('##  ##', ' #### ', '  ##  ', ' #### ', '##  ##')
        'Y' = @('##  ##', ' ## ##', '  ##  ', '  ##  ', '  ##  ')
        'Z' = @('######', '   ## ', '  ##  ', ' ##   ', '######')
        '0' = @(' #### ', '##  ##', '##  ##', '##  ##', ' #### ')
        '1' = @('  ##  ', ' ###  ', '  ##  ', '  ##  ', ' #### ')
        '2' = @(' #### ', '##  ##', '   ## ', '  ##  ', '######')
        '3' = @('##### ', '    ##', '  ### ', '    ##', '##### ')
        '4' = @('##  ##', '##  ##', '######', '    ##', '    ##')
        '5' = @('######', '##    ', '##### ', '    ##', '##### ')
        '6' = @(' #### ', '##    ', '##### ', '##  ##', ' #### ')
        '7' = @('######', '    ##', '   ## ', '  ##  ', '  ##  ')
        '8' = @(' #### ', '##  ##', ' #### ', '##  ##', ' #### ')
        '9' = @(' #### ', '##  ##', ' #####', '    ##', ' #### ')
        ' ' = @('  ', '  ', '  ', '  ', '  ')
    }
}

function ConvertTo-GknomeMenuBannerBitmap {
    param(
        [AllowEmptyString()][string]$Text = 'GKNOME',
        [int]$MaxWidth = 0
    )

    $map = Get-GknomeMenuBannerGlyphMap
    $normalized = if ([string]::IsNullOrWhiteSpace($Text)) { $script:StudyBannerText } else { $Text.Trim().ToUpperInvariant() }
    $normalized = [regex]::Replace($normalized, '[^A-Z0-9 ]', ' ')
    $rows = [string[]]::new(5)
    for ($i = 0; $i -lt $rows.Count; $i++) { $rows[$i] = '' }
    $first = $true
    foreach ($ch in $normalized.ToCharArray()) {
        $key = [string]$ch
        $glyph = if ($map.ContainsKey($key)) { @($map[$key]) } else { @('######', '##  ##', '##  ##', '##  ##', '######') }
        $glyphWidth = 1
        foreach ($line in $glyph) { if ([string]$line -and ([string]$line).Length -gt $glyphWidth) { $glyphWidth = ([string]$line).Length } }
        $extra = if ($first) { $glyphWidth } else { 1 + $glyphWidth }
        if ($MaxWidth -gt 0 -and $rows[0].Length + $extra -gt $MaxWidth) { break }
        if (-not $first) { for ($r = 0; $r -lt $rows.Count; $r++) { $rows[$r] += ' ' } }
        for ($r = 0; $r -lt $rows.Count; $r++) {
            $piece = [string]$glyph[$r]
            if ($piece.Length -lt $glyphWidth) { $piece += (' ' * ($glyphWidth - $piece.Length)) }
            $rows[$r] += $piece
        }
        $first = $false
    }
    if ($first) { return @(ConvertTo-GknomeMenuBannerBitmap -Text $script:StudyBannerText -MaxWidth $MaxWidth) }
    return @($rows)
}

function ConvertTo-GknomeMenuHalfBlocks {
    param([Parameter(Mandatory = $true)][string[]]$BitmapRows)

    $src = @($BitmapRows)
    $width = 0
    foreach ($line in $src) {
        if ([string]$line -and ([string]$line).Length -gt $width) { $width = ([string]$line).Length }
    }
    if (($src.Count % 2) -ne 0) { $src += '' }
    $solid = [string][char]0x2588
    $upper = [string][char]0x2580
    $lower = [string][char]0x2584
    $packed = New-Object System.Collections.Generic.List[string]
    for ($r = 0; $r -lt $src.Count; $r += 2) {
        $top = ([string]$src[$r]).PadRight($width)
        $bottom = ([string]$src[$r + 1]).PadRight($width)
        $row = New-Object System.Text.StringBuilder
        for ($c = 0; $c -lt $width; $c++) {
            $topInk = ($top[$c] -eq [char]'#')
            $bottomInk = ($bottom[$c] -eq [char]'#')
            if ($topInk -and $bottomInk) { [void]$row.Append($solid) }
            elseif ($topInk) { [void]$row.Append($upper) }
            elseif ($bottomInk) { [void]$row.Append($lower) }
            else { [void]$row.Append(' ') }
        }
        $packed.Add($row.ToString())
    }
    if ($packed.Count -ge 2) { $packed[1] = $packed[1].Replace($solid, [string][char]0x2593) }
    if ($packed.Count -ge 3) {
        $last = [string]$packed[$packed.Count - 1]
        $packed[$packed.Count - 1] = $last.Replace($solid, $upper).Replace([string][char]0x2593, $upper).Replace($lower, $upper)
    }
    return @($packed.ToArray())
}

function Get-GknomeMenuProductBanner {
    param(
        [AllowEmptyString()][string]$Text = 'GKNOME',
        [int]$MaxWidth = 0,
        [switch]$Ascii
    )
    $bitmap = @(ConvertTo-GknomeMenuBannerBitmap -Text $Text -MaxWidth $MaxWidth)
    if ($Ascii -or $env:GKNOME_ASCII -eq '1') { return $bitmap }
    return @(ConvertTo-GknomeMenuHalfBlocks -BitmapRows $bitmap)
}

function Get-GknomeMenuGlyphSet {
    param([switch]$Ascii)

    if ($Ascii -or $env:GKNOME_ASCII -eq '1') {
        return [pscustomobject]@{
            top_left = '+'; top_right = '+'; bottom_left = '+'; bottom_right = '+'
            horizontal = '-'; vertical = '|'; middle_left = '+'; middle_right = '+'
            selected = '>'; group = '*'; dot = '*'
        }
    }
    return [pscustomobject]@{
        top_left = [char]0x250C; top_right = [char]0x2510; bottom_left = [char]0x2514; bottom_right = [char]0x2518
        horizontal = [char]0x2500; vertical = [char]0x2502; middle_left = [char]0x251C; middle_right = [char]0x2524
        selected = '>'; group = [char]0x00B7; dot = [char]0x00B7
    }
}

function Format-GknomeMenuFrameEdge {
    param(
        [ValidateSet('top', 'middle', 'bottom')][string]$Side = 'middle',
        [int]$Width = 72,
        [Parameter(Mandatory = $true)][object]$Glyphs
    )

    $safeWidth = [Math]::Max(4, $Width)
    $horizontal = [string]$Glyphs.horizontal
    $fill = $horizontal * ($safeWidth - 2)
    switch ($Side) {
        'top' { return ([string]$Glyphs.top_left + $fill + [string]$Glyphs.top_right) }
        'bottom' { return ([string]$Glyphs.bottom_left + $fill + [string]$Glyphs.bottom_right) }
        default { return ([string]$Glyphs.middle_left + $fill + [string]$Glyphs.middle_right) }
    }
}

function Format-GknomeMenuFrameLine {
    param(
        [AllowEmptyString()][string]$Text = '',
        [int]$Width = 72,
        [Parameter(Mandatory = $true)][object]$Glyphs
    )

    $safeWidth = [Math]::Max(4, $Width)
    $innerWidth = $safeWidth - 4
    $body = Format-GknomeMenuTruncated -Text $Text -Width $innerWidth
    return ([string]$Glyphs.vertical + ' ' + $body + ' ' + [string]$Glyphs.vertical)
}

function Format-GknomeMenuKeyChip {
    param(
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $safeKey = Limit-GknomeMenuText -Text $Key -MaxChars 12
    $safeLabel = Limit-GknomeMenuText -Text $Label -MaxChars 48
    return ('[{0}] {1}' -f $safeKey, $safeLabel)
}

function Get-GknomeMenuKeyHintLine {
    param([switch]$Ascii)

    if ($Ascii -or $env:GKNOME_ASCII -eq '1') {
        return ((Format-GknomeMenuKeyChip -Key 'Up/Down' -Label 'select') + '  ' +
            (Format-GknomeMenuKeyChip -Key 'Enter' -Label 'run') + '  ' +
            (Format-GknomeMenuKeyChip -Key 'H' -Label 'help') + '  ' +
            (Format-GknomeMenuKeyChip -Key 'Q' -Label 'quit'))
    }
    return ((Format-GknomeMenuKeyChip -Key ([string][char]0x2191 + [string][char]0x2193) -Label 'select') + '  ' +
        (Format-GknomeMenuKeyChip -Key 'Enter' -Label 'run') + '  ' +
        (Format-GknomeMenuKeyChip -Key 'H' -Label 'help') + '  ' +
        (Format-GknomeMenuKeyChip -Key 'Q' -Label 'quit'))
}

function Get-GknomeMenuDisplayPath {
    param([int]$MaxChars = 72)

    $candidate = if (-not [string]::IsNullOrWhiteSpace($env:GKNOME_MENU_ROOT)) {
        [string]$env:GKNOME_MENU_ROOT
    }
    else {
        try { [string](Get-Location).Path } catch { '' }
    }
    return (Format-GknomeMenuTruncated -Text $candidate -Width $MaxChars).TrimEnd()
}

function Get-GknomeMenuStudyFooterLine {
    param([switch]$Ascii, [switch]$Native)

    $select = if ($Ascii) { 'Up/Down' } else { ([string][char]0x2191 + [string][char]0x2193) }
    $parts = @(
        ('[{0}] select' -f $select),
        '[Enter] run',
        '[/] filter',
        '[H] help',
        '[Q] quit'
    )
    if ($Native) { $parts += '[T] theme' }
    return ($parts -join '  ')
}

function Get-GknomeMenuBannerText {
    param([Parameter(Mandatory = $true)][object]$Model)

    $label = [string](Get-GknomeMenuProperty -Object $Model -Name 'project_label' -Default '')
    if (-not [string]::IsNullOrWhiteSpace($label)) { return $label.Trim() }
    try {
        $leaf = Split-Path -Leaf ([string](Get-Location).Path)
        if (-not [string]::IsNullOrWhiteSpace($leaf)) { return $leaf.Trim() }
    }
    catch { }
    $title = [string](Get-GknomeMenuProperty -Object $Model -Name 'product_title' -Default '')
    if (-not [string]::IsNullOrWhiteSpace($title)) { return $title.Trim() }
    return 'project'
}

function Get-GknomeMenuHeaderText {
    param([Parameter(Mandatory = $true)][object]$Model)

    $projectLabel = [string](Get-GknomeMenuProperty -Object $Model -Name 'project_label' -Default '')
    if (-not [string]::IsNullOrWhiteSpace($projectLabel)) { return $projectLabel.Trim() }
    $productTitle = [string](Get-GknomeMenuProperty -Object $Model -Name 'product_title' -Default '')
    if (-not [string]::IsNullOrWhiteSpace($productTitle)) { return $productTitle.Trim() }
    return 'project'
}

function Format-GknomeMenuTruncated {
    param(
        [AllowNull()][AllowEmptyString()][string]$Text,
        [int]$Width
    )
    $value = if ($null -eq $Text) { '' } else { [string]$Text }
    if ($Width -le 0) { return '' }
    if ($value.Length -le $Width) { return $value.PadRight($Width) }
    if ($Width -le 3) { return $value.Substring(0, $Width) }
    return $value.Substring(0, $Width - 3) + '...'
}

function Get-GknomeMenuPaintWindow {
    param(
        [Parameter(Mandatory = $true)][object[]]$Rows,
        [Parameter(Mandatory = $true)][int]$SelectedActionIndex,
        [Parameter(Mandatory = $true)][int]$Viewport
    )

    $paint = New-Object System.Collections.Generic.List[object]
    $actionIndex = -1
    foreach ($row in $Rows) {
        if ([string]$row.kind -eq 'group') {
            $paint.Add($row)
            continue
        }
        $actionIndex++
        $paint.Add([pscustomobject]@{
            kind = 'action'
            label = $row.label
            action = $row.action
            number = $row.number
            actionIndex = $actionIndex
        })
    }

    $selectedPaint = 0
    for ($i = 0; $i -lt $paint.Count; $i++) {
        if ([string]$paint[$i].kind -eq 'action' -and [int]$paint[$i].actionIndex -eq $SelectedActionIndex) {
            $selectedPaint = $i
            break
        }
    }
    $paintScroll = 0
    if ($selectedPaint -ge $Viewport) { $paintScroll = $selectedPaint - $Viewport + 1 }
    $visible = New-Object System.Collections.Generic.List[object]
    for ($i = $paintScroll; $i -lt $paint.Count -and $visible.Count -lt $Viewport; $i++) {
        $visible.Add($paint[$i])
    }
    return [pscustomobject]@{
        visible = @($visible.ToArray())
        above = $paintScroll
        below = [Math]::Max(0, $paint.Count - ($paintScroll + $visible.Count))
        paint_count = $paint.Count
    }
}

function Get-GknomeMenuViewportBudget {
    param(
        [Parameter(Mandatory = $true)][int]$Height,
        [Parameter(Mandatory = $true)][int]$HeaderLines,
        [Parameter(Mandatory = $true)][int]$ControlLines
    )

    $compact = $Height -lt 32
    $footerBudget = $(if ($compact) { 3 } else { 4 }) + [Math]::Max(0, $ControlLines)
    $viewport = [Math]::Max(1, $Height - [Math]::Max(0, $HeaderLines) - $footerBudget)
    return [pscustomobject]@{
        compact = $compact
        footer_budget = $footerBudget
        viewport = $viewport
        content_viewport = [Math]::Max(1, $viewport - 2)
    }
}

function Get-GknomeMenuFilteredRows {
    param(
        [Parameter(Mandatory = $true)][object[]]$Rows,
        [AllowEmptyString()][string]$Query = ''
    )

    $needle = if ($null -eq $Query) { '' } else { $Query.Trim().ToLowerInvariant() }
    if ([string]::IsNullOrWhiteSpace($needle)) { return @($Rows) }
    $filtered = New-Object System.Collections.Generic.List[object]
    $pendingGroup = $null
    foreach ($row in @($Rows)) {
        if ([string]$row.kind -eq 'group') {
            $pendingGroup = $row
            continue
        }
        $haystack = @(
            [string]$row.label
            [string]$row.action.task
            [string]$row.action.description
            [string]$pendingGroup.label
        ) -join ' '
        if ($haystack.ToLowerInvariant().Contains($needle)) {
            if ($null -ne $pendingGroup) {
                $filtered.Add($pendingGroup)
                $pendingGroup = $null
            }
            $filtered.Add($row)
        }
    }
    return @($filtered.ToArray())
}

function Invoke-GknomeMenuPlain {
    param(
        [Parameter(Mandatory = $true)][object]$Model,
        [switch]$NoClear
    )

    $actions = @(Get-GknomeMenuFlatActions -Model $Model)
    while ($true) {
        if (-not $NoClear) {
            try { Clear-Host } catch { }
        }
        Write-Host ([string]$Model.product_title)
        if (-not [string]::IsNullOrWhiteSpace([string]$Model.project_label)) {
            Write-Host ([string]$Model.project_label)
        }
        if (-not [string]::IsNullOrWhiteSpace([string]$Model.subtitle)) {
            Write-Host ([string]$Model.subtitle)
        }
        foreach ($line in @($Model.status_lines)) {
            if (-not [string]::IsNullOrWhiteSpace([string]$line)) { Write-Host ([string]$line) }
        }
        Write-Host ''

        $size = Get-GknomeMenuConsoleSize
        # Reserve header/footer roughly; still list with numbers for harness.
        $index = 1
        $map = [ordered]@{}
        $pages = @(Get-GknomeMenuPages -Model $Model)
        if ($pages.Count -eq 0) {
            $pages = @([pscustomobject]@{ label = 'All actions'; description = ''; groups = @($Model.groups) })
        }
        foreach ($page in $pages) {
            if ($pages.Count -gt 1) {
                Write-Host ("== {0} ==" -f [string]$page.label)
                if (-not [string]::IsNullOrWhiteSpace([string]$page.description)) { Write-Host ([string]$page.description) -ForegroundColor DarkGray }
            }
            foreach ($group in @(Get-GknomeMenuProperty -Object $page -Name 'groups' -Default @())) {
                Write-Host ("[{0}]" -f [string]$group.label)
                foreach ($action in @($group.actions)) {
                    $map[[string]$index] = $action
                    $label = Format-GknomeMenuTruncated -Text ([string]$action.label) -Width ([Math]::Max(12, $size.Width - 8))
                    Write-Host (" {0,2}) {1}" -f $index, $label.TrimEnd())
                    $index++
                }
                Write-Host ''
            }
        }
        Write-Host '  H) Help'
        Write-Host '  Q) Quit'
        Write-Host ''
        foreach ($line in @($Model.footer_lines)) {
            if (-not [string]::IsNullOrWhiteSpace([string]$line)) { Write-Host ([string]$line) -ForegroundColor DarkGray }
        }

        try { $choice = Read-Host 'Select option' } catch { return [pscustomobject]@{ kind = 'cancel'; task = $null } }
        if ($null -eq $choice) { return [pscustomobject]@{ kind = 'cancel'; task = $null } }
        $choice = ([string]$choice).Trim()
        if ($choice -match '(?i)^q$') { return [pscustomobject]@{ kind = 'cancel'; task = $null } }
        if ($choice -match '(?i)^h$') { return [pscustomobject]@{ kind = 'help'; task = $null } }
        if ($choice -match '(?i)^r$') { return [pscustomobject]@{ kind = 'refresh'; task = $null } }
        if (-not $map.Contains($choice)) { continue }
        $selected = $map[$choice]
        if (-not [bool]$selected.enabled) { continue }
        return [pscustomobject]@{ kind = 'task'; task = [string]$selected.task; action = $selected }
    }
}

function Import-GknomeMenuModules {
    param([string]$UiRoot = '')

    $root = if ([string]::IsNullOrWhiteSpace($UiRoot)) { Get-GknomeMenuUiRoot } else { $UiRoot }
    if ([string]::IsNullOrWhiteSpace($root)) { throw 'gknome menu UI root was not found.' }
    $basic = Join-Path $root 'Gknome.Menu.Basic.psm1'
    $ansi = Join-Path $root 'Gknome.Menu.Ansi.psm1'
    $input = Join-Path $root 'Gknome.Menu.Input.Windows.psm1'
    if (Test-Path -LiteralPath $input -PathType Leaf) {
        Import-Module -Name $input -DisableNameChecking -ErrorAction Stop
    }
    if (Test-Path -LiteralPath $basic -PathType Leaf) {
        Import-Module -Name $basic -DisableNameChecking -ErrorAction Stop
    }
    if (Test-Path -LiteralPath $ansi -PathType Leaf) {
        Import-Module -Name $ansi -DisableNameChecking -ErrorAction SilentlyContinue
    }
    return $root
}

function Test-GknomeMenuCleanupFailure {
    param([Parameter(Mandatory = $true)][object]$ErrorRecord)

    $exception = if ($ErrorRecord -is [System.Exception]) {
        $ErrorRecord
    }
    else {
        Get-GknomeMenuProperty -Object $ErrorRecord -Name 'Exception' -Default $null
    }
    while ($null -ne $exception) {
        try {
            if ($exception.Data.Contains('gknome_menu_cleanup_failure') -and [bool]$exception.Data['gknome_menu_cleanup_failure']) {
                return $true
            }
        }
        catch { }
        $exception = $exception.InnerException
    }
    return $false
}

function Invoke-GknomeMenuRenderer {
    param(
        [Parameter(Mandatory = $true)][object]$Model,
        [string]$Engine = 'auto',
        [string]$UiRoot = '',
        [switch]$AllowHarness,
        [switch]$NoClear
    )

    $resolved = Resolve-GknomeMenuEngine -Requested $Engine -AllowHarness:$AllowHarness
    if ($resolved -eq 'plain') {
        return (Invoke-GknomeMenuPlain -Model $Model -NoClear:$NoClear)
    }

    $consoleSize = Get-GknomeMenuConsoleSize
    $viewportResolved = Resolve-GknomeMenuViewportEngine -Engine $resolved -Width ([int]$consoleSize.Width) -Height ([int]$consoleSize.Height)
    if ($viewportResolved -ne $resolved) {
        Write-Host ("[gknome] Styled menu needs a terminal of at least 40x12; using the plain menu in {0}x{1}." -f $consoleSize.Width, $consoleSize.Height)
        $resolved = $viewportResolved
    }
    $root = if ([string]::IsNullOrWhiteSpace($UiRoot)) { Get-GknomeMenuUiRoot } else { $UiRoot }
    $theme = Get-GknomeMenuTheme -UiRoot $root
    $noFallback = Test-GknomeMenuNoFallback
    # Styled renderers consume mouse and RawUI input; plain rendering returned
    # above before this optional adapter or theme work is reached.
    if (-not [string]::IsNullOrWhiteSpace($root)) {
        $input = Join-Path $root 'Gknome.Menu.Input.Windows.psm1'
        if (Test-Path -LiteralPath $input -PathType Leaf) {
            Import-Module -Name $input -DisableNameChecking -ErrorAction Stop
        }
    }

    if ($resolved -eq 'ansi') {
        try {
            if ([string]::IsNullOrWhiteSpace($root)) { throw 'UI root missing' }
            Import-Module -Name (Join-Path $root 'Gknome.Menu.Ansi.psm1') -DisableNameChecking -ErrorAction Stop
            return (Invoke-GknomeMenuAnsi -Model $Model -Theme $theme -NoClear:$NoClear)
        }
        catch {
            if (Test-GknomeMenuCleanupFailure -ErrorRecord $_) { throw }
            if ($noFallback) {
                throw "ANSI menu engine failed and GKNOME_NO_FALLBACK is set: $($_.Exception.Message)"
            }
            $resolved = 'basic'
        }
    }
    if ($resolved -eq 'basic') {
        try {
            if ([string]::IsNullOrWhiteSpace($root)) { throw 'UI root missing' }
            Import-Module -Name (Join-Path $root 'Gknome.Menu.Basic.psm1') -DisableNameChecking -ErrorAction Stop
            return (Invoke-GknomeMenuBasic -Model $Model -Theme $theme -NoClear:$NoClear)
        }
        catch {
            if (Test-GknomeMenuCleanupFailure -ErrorRecord $_) { throw }
            if ($noFallback) {
                throw "Basic menu engine failed and GKNOME_NO_FALLBACK is set: $($_.Exception.Message)"
            }
            $resolved = 'plain'
        }
    }
    return (Invoke-GknomeMenuPlain -Model $Model -NoClear:$NoClear)
}

Export-ModuleMember -Function @(
    'Get-GknomeMenuProperty',
    'Limit-GknomeMenuText',
    'Get-GknomeMenuUiRoot',
    'Test-GknomeMenuInteractiveConsole',
    'Publish-GknomeMenuFirstFrame',
    'Resolve-GknomeMenuEngine',
    'Resolve-GknomeMenuViewportEngine',
    'Test-GknomeMenuNoFallback',
    'Get-GknomeMenuTheme',
    'Get-GknomeMenuConfirmationMode',
    'New-GknomeMenuAction',
    'New-GknomeMenuModel',
    'Get-GknomeMenuPages',
    'Get-GknomeMenuPageGroups',
    'Get-GknomeMenuPageLabel',
    'Get-GknomeMenuPageDescription',
    'Get-GknomeMenuPageIndexById',
    'Get-GknomeMenuParentPageIndex',
    'ConvertTo-GknomeMenuModelFromController',
    'Test-GknomeMenuOperationAvailability',
    'ConvertTo-GknomeMenuModelFromOperator',
    'ConvertTo-GknomeMenuModelFromGlobalContext',
    'Get-GknomeMenuFlatActions',
    'Get-GknomeMenuConsoleSize',
    'Get-GknomeMenuFrameWidth',
    'Get-GknomeMenuProductBanner',
    'Get-GknomeMenuGlyphSet',
    'Format-GknomeMenuFrameEdge',
    'Format-GknomeMenuFrameLine',
    'Format-GknomeMenuKeyChip',
    'Get-GknomeMenuKeyHintLine',
    'Get-GknomeMenuDisplayPath',
    'Get-GknomeMenuStudyFooterLine',
    'Get-GknomeMenuBannerText',
    'Get-GknomeMenuHeaderText',
    'Get-GknomeMenuStyle',
    'Get-GknomeMenuThemeNames',
    'Format-GknomeMenuTruncated',
    'Get-GknomeMenuPaintWindow',
    'Get-GknomeMenuViewportBudget',
    'Get-GknomeMenuFilteredRows',
    'Invoke-GknomeMenuPlain',
    'Import-GknomeMenuModules',
    'Invoke-GknomeMenuRenderer'
)
