#Requires -Version 5.1
<#
.SYNOPSIS
  PowerShell 5.1 ConsoleColor menu renderer for gknome.
.DESCRIPTION
  Viewport-aware list with group headers, selected details, shared optional
  Windows mouse input, and keyboard shortcuts. Falls back to plain when RawUI
  is unavailable.
#>

Set-StrictMode -Version 2.0

$corePath = Join-Path $PSScriptRoot 'Gknome.Menu.Core.psm1'
$inputPath = Join-Path $PSScriptRoot 'Gknome.Menu.Input.Windows.psm1'
foreach ($dependency in @($corePath, $inputPath)) {
    if (-not (Test-Path -LiteralPath $dependency -PathType Leaf)) {
        throw "Required gknome menu module is missing: $dependency"
    }
    Import-Module -Name $dependency -DisableNameChecking -ErrorAction Stop
}

function Get-GknomeMenuConsoleColor {
    param(
        [object]$Theme,
        [Parameter(Mandatory = $true)][string]$Token,
        [ConsoleColor]$Default = [ConsoleColor]::Gray
    )
    try {
        $console = Get-GknomeMenuProperty -Object $Theme -Name 'console' -Default $null
        $name = [string](Get-GknomeMenuProperty -Object $console -Name $Token -Default '')
        if ([string]::IsNullOrWhiteSpace($name)) { return $Default }
        return [ConsoleColor]::$name
    }
    catch {
        return $Default
    }
}

function Write-GknomeMenuBasicLine {
    param(
        [AllowEmptyString()][string]$Text = '',
        [ConsoleColor]$Foreground = [ConsoleColor]::Gray,
        [ConsoleColor]$Background = [ConsoleColor]::Black,
        [switch]$NoNewline
    )
    $useBg = $false
    try {
        if ($Background -ne [ConsoleColor]::Black) { $useBg = $true }
    }
    catch { }
    if ($useBg) {
        if ($NoNewline) {
            Write-Host $Text -ForegroundColor $Foreground -BackgroundColor $Background -NoNewline
        }
        else {
            Write-Host $Text -ForegroundColor $Foreground -BackgroundColor $Background
        }
    }
    else {
        if ($NoNewline) {
            Write-Host $Text -ForegroundColor $Foreground -NoNewline
        }
        else {
            Write-Host $Text -ForegroundColor $Foreground
        }
    }
}

function Get-GknomeMenuBasicRows {
    param(
        [Parameter(Mandatory = $true)][object]$Model,
        [int]$PageIndex = 0
    )

    $rows = New-Object System.Collections.Generic.List[object]
    $actionNumber = 1
    foreach ($group in @(Get-GknomeMenuPageGroups -Model $Model -PageIndex $PageIndex)) {
        $rows.Add([pscustomobject]@{ kind = 'group'; label = [string]$group.label; action = $null; number = -1 })
        foreach ($action in @($group.actions)) {
            $rows.Add([pscustomobject]@{
                kind = 'action'
                label = [string]$action.label
                action = $action
                number = $actionNumber
            })
            $actionNumber++
        }
    }
    return @($rows.ToArray())
}

function Get-GknomeMenuBasicDarkColor {
    param([ConsoleColor]$Color)
    switch ($Color) {
        ([ConsoleColor]::Blue) { return [ConsoleColor]::DarkBlue }
        ([ConsoleColor]::Green) { return [ConsoleColor]::DarkGreen }
        ([ConsoleColor]::Cyan) { return [ConsoleColor]::DarkCyan }
        ([ConsoleColor]::Red) { return [ConsoleColor]::DarkRed }
        ([ConsoleColor]::Magenta) { return [ConsoleColor]::DarkMagenta }
        ([ConsoleColor]::Yellow) { return [ConsoleColor]::DarkYellow }
        ([ConsoleColor]::White) { return [ConsoleColor]::Gray }
        ([ConsoleColor]::Gray) { return [ConsoleColor]::DarkGray }
        default { return [ConsoleColor]::DarkGray }
    }
}

function Move-GknomeMenuBasicHome {
    try {
        $Host.UI.RawUI.CursorPosition = New-Object System.Management.Automation.Host.Coordinates 0, 0
        return $true
    }
    catch { }
    try {
        [Console]::SetCursorPosition(0, 0)
        return $true
    }
    catch { return $false }
}

function Clear-GknomeMenuBasicRemainder {
    param(
        [int]$FrameTop,
        [int]$CurrentHeight,
        [int]$PreviousHeight,
        [int]$Width
    )

    if ($PreviousHeight -le $CurrentHeight) { return $true }
    $blankWidth = [Math]::Max(1, [Math]::Min($Width, (Get-GknomeMenuConsoleSize).Width - 1))
    try {
        for ($row = $CurrentHeight; $row -lt $PreviousHeight; $row++) {
            [Console]::SetCursorPosition(0, $FrameTop + $row)
            [Console]::Write((' ' * $blankWidth))
        }
        [Console]::SetCursorPosition(0, $FrameTop + $CurrentHeight)
        return $true
    }
    catch { return $false }
}

function Invoke-GknomeMenuBasic {
    param(
        [Parameter(Mandatory = $true)][object]$Model,
        [object]$Theme = $null,
        [switch]$NoClear
    )

    if ($null -eq $Theme) { $Theme = Get-GknomeMenuTheme -UiRoot $PSScriptRoot }

    $useKeys = $false
    try {
        if ($null -ne $Host.UI.RawUI -and -not [Console]::IsInputRedirected) { $useKeys = $true }
    }
    catch { $useKeys = $false }

    if (-not $useKeys) {
        return (Invoke-GknomeMenuPlain -Model $Model -NoClear:$NoClear)
    }

    $pages = @(Get-GknomeMenuPages -Model $Model)
    $pageIndex = 0
    $allRows = @(Get-GknomeMenuBasicRows -Model $Model -PageIndex $pageIndex)
    $rows = @($allRows)
    $actionRows = @($rows | Where-Object { $_.kind -eq 'action' })
    if ($actionRows.Count -eq 0) {
        return [pscustomobject]@{ kind = 'cancel'; task = $null; engine = 'basic' }
    }

    $selected = Get-GknomeMenuFirstEnabledActionIndex -Actions @($actionRows | ForEach-Object { $_.action })
    $ascii = ($env:GKNOME_ASCII -eq '1')
    $noColor = ($env:NO_COLOR -eq '1')
    $glyphs = Get-GknomeMenuGlyphSet -Ascii:$ascii

    $titleColor = if ($noColor) { [ConsoleColor]::Gray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'title' -Default Cyan }
    $mutedColor = if ($noColor) { [ConsoleColor]::DarkGray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'muted' -Default DarkGray }
    $groupColor = if ($noColor) { [ConsoleColor]::Gray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'group' -Default DarkCyan }
    $labelColor = if ($noColor) { [ConsoleColor]::Gray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'label' -Default White }
    $hoverFg = if ($noColor) { [ConsoleColor]::White } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'hover' -Default White }
    $hoverBg = if ($noColor) { [ConsoleColor]::DarkGray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'hover_bg' -Default DarkGray }
    $selectedFg = if ($noColor) { [ConsoleColor]::Black } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'selected' -Default Black }
    $selectedBg = if ($noColor) { [ConsoleColor]::Gray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'selected_bg' -Default Cyan }
    $accentColor = if ($noColor) { [ConsoleColor]::Gray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'accent' -Default Cyan }
    $borderColor = if ($noColor) { [ConsoleColor]::DarkGray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'border' -Default DarkGray }
    $style = Get-GknomeMenuStyle
    $bannerText = Get-GknomeMenuBannerText -Model $Model
    $bannerProbe = @(Get-GknomeMenuProductBanner -Text $bannerText -Ascii)
    $bannerPreferred = [Math]::Max([int]$style.basic_width, $bannerProbe[0].Length + 4)
    $filter = ''
    $themeNames = @(Get-GknomeMenuThemeNames -UiRoot $PSScriptRoot)
    $themeIndex = [Math]::Max(0, [array]::IndexOf($themeNames, [string]$Theme.name))
    $showHelp = $false
    $hover = -1
    $painted = $false
    $previousFrameHeight = 0
    $mouseSelectionKey = ''
    $pendingDigits = ''
    $pendingDigitAt = [datetime]::MinValue
    $inputSession = $null
    $mouseWarning = ''

    try {
    while ($true) {
        $isFirstFrame = -not $painted
        $hitZones = New-Object System.Collections.Generic.List[object]
        $actionRows = @($rows | Where-Object { $_.kind -eq 'action' })
        if ($actionRows.Count -eq 0) {
            $rows = @($allRows)
            $filter = ''
            $actionRows = @($rows | Where-Object { $_.kind -eq 'action' })
        }
        $size = Get-GknomeMenuConsoleSize
        $compactViewport = $size.Height -lt 32
        $frameWidth = Get-GknomeMenuFrameWidth -Preferred $bannerPreferred -Maximum 108
        $banner = @(Get-GknomeMenuProductBanner -Text $bannerText -MaxWidth ($frameWidth - 4) -Ascii:$ascii)
        $paintedInPlace = $false
        if (-not $NoClear) {
            if ($painted) { $paintedInPlace = Move-GknomeMenuBasicHome }
            if (-not $paintedInPlace) { try { Clear-Host } catch { } }
        }
        $frameTop = Get-GknomeMenuCursorY

        Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameEdge -Side top -Width $frameWidth -Glyphs $glyphs) -Foreground $borderColor
        for ($bannerIndex = 0; $bannerIndex -lt $banner.Count; $bannerIndex++) {
            $bannerColor = if ($bannerIndex -lt [Math]::Ceiling($banner.Count / 2.0)) { $accentColor } else { Get-GknomeMenuBasicDarkColor -Color $accentColor }
            Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text ([string]$banner[$bannerIndex]) -Width $frameWidth -Glyphs $glyphs) -Foreground $bannerColor
        }
        $header = Get-GknomeMenuHeaderText -Model $Model
        Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text $header -Width $frameWidth -Glyphs $glyphs) -Foreground $accentColor
        if (-not [string]::IsNullOrWhiteSpace([string]$Model.subtitle)) {
            Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text ([string]$Model.subtitle) -Width $frameWidth -Glyphs $glyphs) -Foreground $mutedColor
        }
        foreach ($line in @($Model.status_lines)) {
            if (-not [string]::IsNullOrWhiteSpace([string]$line)) {
                Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text ([string]$line) -Width $frameWidth -Glyphs $glyphs) -Foreground $mutedColor
            }
        }
        if (-not [string]::IsNullOrWhiteSpace($mouseWarning)) {
            Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text ("MOUSE  $mouseWarning") -Width $frameWidth -Glyphs $glyphs) -Foreground $mutedColor
        }
        Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameEdge -Side middle -Width $frameWidth -Glyphs $glyphs) -Foreground $borderColor
        Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text (Get-GknomeMenuDisplayPath -MaxChars ($frameWidth - 4)) -Width $frameWidth -Glyphs $glyphs) -Foreground $mutedColor
        if ($pages.Count -gt 1) {
            $pageDescription = Get-GknomeMenuPageDescription -Model $Model -PageIndex $pageIndex
            $pageLayout = New-GknomeMenuPageTabLayout -Pages $pages -PageIndex $pageIndex -InnerWidth ($frameWidth - 4) -StartX 2 -StartY (Get-GknomeMenuCursorY)
            foreach ($pageLine in @($pageLayout.lines)) {
                Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text ([string]$pageLine) -Width $frameWidth -Glyphs $glyphs) -Foreground $accentColor
            }
            foreach ($zone in @($pageLayout.zones)) { $hitZones.Add($zone) }
            if (-not $compactViewport -and -not [string]::IsNullOrWhiteSpace($pageDescription)) {
                Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text $pageDescription -Width $frameWidth -Glyphs $glyphs) -Foreground $mutedColor
            }
        }
        Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameEdge -Side middle -Width $frameWidth -Glyphs $glyphs) -Foreground $borderColor

        # Reserve actual rendered header rows and the compact shared control rail.
        $headerLines = [Math]::Max(0, (Get-GknomeMenuCursorY) - $frameTop)
        $parentPageIndex = Get-GknomeMenuParentPageIndex -Model $Model -PageIndex $pageIndex
        $controlProbe = New-GknomeMenuControlLayout -InnerWidth ($frameWidth - 4) -RunEnabled ([bool]$actionRows[$selected].action.enabled) -ParentPageIndex $parentPageIndex -NavigationEnabled:($actionRows.Count -gt 1) -IncludeTheme
        $viewportBudget = Get-GknomeMenuViewportBudget -Height $size.Height -HeaderLines $headerLines -ControlLines @($controlProbe.lines).Count
        $viewport = [int]$viewportBudget.viewport
        if ($showHelp) {
            $helpStartY = Get-GknomeMenuCursorY
            $helpLines = @('HELP  Click outside this panel, click Help, or press H/Escape to close.') + @($Model.help_lines)
            $helpCount = [Math]::Min($viewport, $helpLines.Count)
            for ($helpIndex = 0; $helpIndex -lt $helpCount; $helpIndex++) {
                Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text ([string]$helpLines[$helpIndex]) -Width $frameWidth -Glyphs $glyphs) -Foreground $(if ($helpIndex -eq 0) { $accentColor } else { $mutedColor })
            }
            $hitZones.Add((New-GknomeMenuHitZone -Kind 'help-panel' -X 1 -Y $helpStartY -Width ($frameWidth - 2) -Height ([Math]::Max(1, $helpCount))))
        }
        else {
            $contentViewport = [int]$viewportBudget.content_viewport
            $window = Get-GknomeMenuPaintWindow -Rows $rows -SelectedActionIndex $selected -Viewport $contentViewport
            $visible = @($window.visible)
            $above = [int]$window.above
            $below = [int]$window.below
            if ($above -gt 0) {
                $aboveY = Get-GknomeMenuCursorY
                Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text ("^ $above more above") -Width $frameWidth -Glyphs $glyphs) -Foreground $mutedColor
                $hitZones.Add((New-GknomeMenuHitZone -Kind 'move-up' -X 1 -Y $aboveY -Width ($frameWidth - 2)))
            }

            foreach ($row in $visible) {
                if ($row.kind -eq 'group') {
                    Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text ("$($glyphs.group) $($row.label)") -Width $frameWidth -Glyphs $glyphs) -Foreground $groupColor
                    continue
                }
                $rowY = Get-GknomeMenuCursorY
                $isSelected = ([int]$row.actionIndex -eq $selected)
                $isHovered = ([int]$row.actionIndex -eq $hover)
                $prefix = if ($isSelected) { "$($glyphs.selected) " } elseif ($isHovered) { "$($glyphs.dot) " } else { '  ' }
                $text = Format-GknomeMenuKeyChip -Key ([string]$row.number) -Label ([string]$row.label)
                $line = Format-GknomeMenuFrameLine -Text ($prefix + $text) -Width $frameWidth -Glyphs $glyphs
                if ($isSelected) {
                    Write-GknomeMenuBasicLine -Text $line -Foreground $selectedFg -Background $selectedBg
                }
                elseif ($isHovered) {
                    Write-GknomeMenuBasicLine -Text $line -Foreground $hoverFg -Background $hoverBg
                }
                else {
                    Write-GknomeMenuBasicLine -Text $line -Foreground $(if ([bool]$row.action.enabled) { $labelColor } else { $mutedColor })
                }
                $hitZones.Add((New-GknomeMenuHitZone -Kind 'action' -X 1 -Y $rowY -Width ($frameWidth - 2) -Value ([int]$row.actionIndex) -Enabled ([bool]$row.action.enabled)))
            }

            if ($below -gt 0) {
                $belowY = Get-GknomeMenuCursorY
                Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text ("v $below more below") -Width $frameWidth -Glyphs $glyphs) -Foreground $mutedColor
                $hitZones.Add((New-GknomeMenuHitZone -Kind 'move-down' -X 1 -Y $belowY -Width ($frameWidth - 2)))
            }
        }

        Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameEdge -Side middle -Width $frameWidth -Glyphs $glyphs) -Foreground $borderColor
        $current = $actionRows[$selected]
        $detail = [string]$current.action.description
        if ([string]::IsNullOrWhiteSpace($detail)) { $detail = [string]$current.action.task }
        Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text ("DETAIL  $detail  // task=$([string]$current.action.task)  // owner=$([string]$current.action.owner)  ($($selected + 1)/$($actionRows.Count))") -Width $frameWidth -Glyphs $glyphs) -Foreground $mutedColor
        $controlLayout = New-GknomeMenuControlLayout -InnerWidth ($frameWidth - 4) -StartX 2 -StartY (Get-GknomeMenuCursorY) -RunEnabled ([bool]$current.action.enabled) -ParentPageIndex $parentPageIndex -NavigationEnabled:($actionRows.Count -gt 1) -IncludeTheme
        foreach ($controlLine in @($controlLayout.lines)) {
            Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text ([string]$controlLine) -Width $frameWidth -Glyphs $glyphs) -Foreground $accentColor
        }
        foreach ($zone in @($controlLayout.zones)) { $hitZones.Add($zone) }
        if (-not [bool]$viewportBudget.compact) {
            $footerText = Get-GknomeMenuStudyFooterLine -Ascii:$ascii -Native
            if ($null -ne $inputSession -and [bool]$inputSession.mouse_enabled) { $footerText = "[Mouse] hover/click/up/down/wheel  $footerText" }
            elseif ($pages.Count -gt 1) { $footerText = "[Tab] page  $footerText" }
            if (-not [string]::IsNullOrWhiteSpace($filter)) { $footerText = "FILTER  $filter  //  $footerText" }
            Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameLine -Text $footerText -Width $frameWidth -Glyphs $glyphs) -Foreground $mutedColor
        }
        Write-GknomeMenuBasicLine -Text (Format-GknomeMenuFrameEdge -Side bottom -Width $frameWidth -Glyphs $glyphs) -Foreground $borderColor
        $currentFrameHeight = [Math]::Max(0, (Get-GknomeMenuCursorY) - $frameTop)
        if ($paintedInPlace -and $previousFrameHeight -gt $currentFrameHeight) {
            [void](Clear-GknomeMenuBasicRemainder -FrameTop $frameTop -CurrentHeight $currentFrameHeight -PreviousHeight $previousFrameHeight -Width $frameWidth)
        }
        $previousFrameHeight = $currentFrameHeight
        if ($isFirstFrame) {
            Publish-GknomeMenuFirstFrame -Engine 'basic'
        }
        $painted = $true
        if ($null -eq $inputSession) {
            $inputSession = New-GknomeMenuInputSession
            $mouseWarning = [string]$inputSession.warning
        }

        $actions = @($actionRows | ForEach-Object { $_.action })
        $resolvedInput = Wait-GknomeMenuInteraction `
            -Session $inputSession `
            -HitZones @($hitZones.ToArray()) `
            -Actions $actions `
            -SelectedActionIndex $selected `
            -PageIndex $pageIndex `
            -PageCount $pages.Count `
            -ParentPageIndex $parentPageIndex `
            -Viewport $viewport `
            -HoverActionIndex $hover `
            -MouseSelectionKey $mouseSelectionKey `
            -HelpVisible:$showHelp
        $event = $resolvedInput.event
        if ($null -eq $event) { return [pscustomobject]@{ kind = 'cancel'; task = $null; engine = 'basic' } }
        $interaction = $resolvedInput.interaction
        $selected = [int]$interaction.selected_action_index
        $hover = [int]$interaction.hover_action_index
        $mouseSelectionKey = [string]$interaction.mouse_selection_key
        if ([string]$interaction.command -ne 'digit') { $pendingDigits = '' }

        switch ([string]$interaction.command) {
            'hover' { continue }
            'redraw' { continue }
            'select' { continue }
            'page' {
                $pageIndex = [Math]::Min([Math]::Max(0, [int]$interaction.page_index), $pages.Count - 1)
                $allRows = @(Get-GknomeMenuBasicRows -Model $Model -PageIndex $pageIndex)
                $rows = @($allRows)
                $filter = ''
                $pageActions = @($rows | Where-Object { $_.kind -eq 'action' } | ForEach-Object { $_.action })
                $selected = Get-GknomeMenuFirstEnabledActionIndex -Actions $pageActions
                $showHelp = $false
                $mouseSelectionKey = ''
                continue
            }
            'task' {
                $action = $interaction.action
                return [pscustomobject]@{ kind = 'task'; task = [string]$action.task; action = $action; input_source = [string]$event.source; engine = 'basic' }
            }
            'cancel' { return [pscustomobject]@{ kind = 'cancel'; task = $null; engine = 'basic' } }
            'refresh' { return [pscustomobject]@{ kind = 'refresh'; task = $null; engine = 'basic' } }
            'show-help' { $showHelp = $true; $mouseSelectionKey = ''; continue }
            'close-help' { $showHelp = $false; $mouseSelectionKey = ''; continue }
            'filter' {
                $mouseSelectionKey = ''
                $promptResult = Invoke-GknomeMenuTextPrompt -Session $inputSession -Prompt 'Filter (blank clears)'
                $inputSession = $promptResult.session
                $mouseWarning = [string]$inputSession.warning
                $candidate = [string]$promptResult.value
                $candidateRows = @(Get-GknomeMenuFilteredRows -Rows $allRows -Query ([string]$candidate))
                if (@($candidateRows | Where-Object { $_.kind -eq 'action' }).Count -gt 0) {
                    $rows = $candidateRows
                    $filter = ([string]$candidate).Trim()
                    $selected = Get-GknomeMenuFirstEnabledActionIndex -Actions @($rows | Where-Object { $_.kind -eq 'action' } | ForEach-Object { $_.action })
                }
                elseif ([string]::IsNullOrWhiteSpace([string]$candidate)) {
                    $rows = @($allRows)
                    $filter = ''
                    $selected = Get-GknomeMenuFirstEnabledActionIndex -Actions @($rows | Where-Object { $_.kind -eq 'action' } | ForEach-Object { $_.action })
                }
                continue
            }
            'theme' {
                if ($themeNames.Count -gt 1) {
                    $themeIndex = ($themeIndex + 1) % $themeNames.Count
                    $Theme = Get-GknomeMenuTheme -UiRoot $PSScriptRoot -Name ([string]$themeNames[$themeIndex])
                    $titleColor = if ($noColor) { [ConsoleColor]::Gray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'title' -Default Cyan }
                    $mutedColor = if ($noColor) { [ConsoleColor]::DarkGray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'muted' -Default DarkGray }
                    $groupColor = if ($noColor) { [ConsoleColor]::Gray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'group' -Default DarkCyan }
                    $labelColor = if ($noColor) { [ConsoleColor]::Gray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'label' -Default White }
                    $hoverFg = if ($noColor) { [ConsoleColor]::White } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'hover' -Default White }
                    $hoverBg = if ($noColor) { [ConsoleColor]::DarkGray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'hover_bg' -Default DarkGray }
                    $selectedFg = if ($noColor) { [ConsoleColor]::Black } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'selected' -Default Black }
                    $selectedBg = if ($noColor) { [ConsoleColor]::Gray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'selected_bg' -Default Cyan }
                    $accentColor = if ($noColor) { [ConsoleColor]::Gray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'accent' -Default Cyan }
                    $borderColor = if ($noColor) { [ConsoleColor]::DarkGray } else { Get-GknomeMenuConsoleColor -Theme $Theme -Token 'border' -Default DarkGray }
                }
                $mouseSelectionKey = ''
                continue
            }
            'digit' {
                $digitState = Update-GknomeMenuDigitSelection -Digit ([string]$interaction.value) -ActionRows $actionRows -PendingDigits $pendingDigits -PendingAt $pendingDigitAt
                $pendingDigits = [string]$digitState.digits
                $pendingDigitAt = [datetime]$digitState.at
                if ([int]$digitState.selected_action_index -ge 0) { $selected = [int]$digitState.selected_action_index }
                $mouseSelectionKey = ''
                continue
            }
        }
    }
    }
    finally {
        if ($null -ne $inputSession) {
            Close-GknomeMenuInputSession -Session $inputSession
        }
    }
}

Export-ModuleMember -Function @('Invoke-GknomeMenuBasic', 'Get-GknomeMenuBasicRows')
