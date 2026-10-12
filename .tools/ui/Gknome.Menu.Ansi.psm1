#Requires -Version 7.0
<#
.SYNOPSIS
  PowerShell 7 ANSI / true-color menu renderer for gknome.
.DESCRIPTION
  In-place-ish repaint using ConsoleColor-compatible layout from Basic, with
  VT color when supported and the shared optional Windows mouse adapter. No
  alternate screen buffer.
#>

Set-StrictMode -Version 2.0

$corePath = Join-Path $PSScriptRoot 'Gknome.Menu.Core.psm1'
$basicPath = Join-Path $PSScriptRoot 'Gknome.Menu.Basic.psm1'
$inputPath = Join-Path $PSScriptRoot 'Gknome.Menu.Input.Windows.psm1'
foreach ($dependency in @($corePath, $basicPath, $inputPath)) {
    if (-not (Test-Path -LiteralPath $dependency -PathType Leaf)) {
        throw "Required gknome menu module is missing: $dependency"
    }
    Import-Module -Name $dependency -DisableNameChecking -ErrorAction Stop
}

function Test-GknomeMenuVtEnabled {
    if ($env:NO_COLOR -eq '1' -or $env:GKNOME_ASCII -eq '1') {
        return $false
    }

    if ([int]$PSVersionTable.PSVersion.Major -lt 7) {
        return $false
    }

    if (-not (Test-GknomeMenuInteractiveConsole)) {
        return $false
    }

    try {
        $property = $Host.UI.PSObject.Properties['SupportsVirtualTerminal']
        return ($null -eq $property -or [bool]$property.Value)
    }
    catch {
        return $false
    }
}

function Get-GknomeMenuAnsiRgb {
    param(
        [object]$Theme,
        [Parameter(Mandatory = $true)][string]$Token,
        [int[]]$Default = @(180, 180, 185)
    )
    try {
        $ansi = Get-GknomeMenuProperty -Object $Theme -Name 'ansi' -Default $null
        $value = Get-GknomeMenuProperty -Object $ansi -Name $Token -Default $null
        if ($null -eq $value) { return $Default }
        $arr = @($value | ForEach-Object { [int]$_ })
        if ($arr.Count -ge 3) { return @($arr[0], $arr[1], $arr[2]) }
        return $Default
    }
    catch {
        return $Default
    }
}

function Write-GknomeMenuAnsiLine {
    param(
        [AllowEmptyString()][string]$Text = '',
        [int[]]$Fg = @(230, 230, 235),
        [int[]]$Bg = $null,
        [switch]$Bold,
        [switch]$NoNewline
    )
    $reset = "`e[0m"
    $seq = ''
    if ($Bold) { $seq += "`e[1m" }
    if ($null -ne $Fg -and $Fg.Count -ge 3) {
        $seq += "`e[38;2;$($Fg[0]);$($Fg[1]);$($Fg[2])m"
    }
    if ($null -ne $Bg -and $Bg.Count -ge 3) {
        $seq += "`e[48;2;$($Bg[0]);$($Bg[1]);$($Bg[2])m"
    }
    if ($NoNewline) {
        Write-Host ($seq + $Text + $reset) -NoNewline
    }
    else {
        Write-Host ($seq + $Text + $reset)
    }
}

function ConvertTo-GknomeMenuAnsiGradientText {
    param(
        [AllowEmptyString()][string]$Text = '',
        [Parameter(Mandatory = $true)][int[]]$From,
        [Parameter(Mandatory = $true)][int[]]$To
    )

    $safeFrom = if ($From.Count -ge 3) { $From } else { @(45, 212, 191) }
    $safeTo = if ($To.Count -ge 3) { $To } else { $safeFrom }
    $builder = New-Object System.Text.StringBuilder
    $length = [Math]::Max(1, $Text.Length - 1)
    for ($i = 0; $i -lt $Text.Length; $i++) {
        $t = $i / [double]$length
        $r = [int]($safeFrom[0] + (($safeTo[0] - $safeFrom[0]) * $t))
        $g = [int]($safeFrom[1] + (($safeTo[1] - $safeFrom[1]) * $t))
        $b = [int]($safeFrom[2] + (($safeTo[2] - $safeFrom[2]) * $t))
        [void]$builder.Append("`e[38;2;${r};${g};${b}m")
        [void]$builder.Append($Text[$i])
    }
    return $builder.ToString()
}

function Write-GknomeMenuAnsiGradientLine {
    param(
        [AllowEmptyString()][string]$Text = '',
        [Parameter(Mandatory = $true)][int[]]$From,
        [Parameter(Mandatory = $true)][int[]]$To,
        [switch]$Bold
    )
    $prefix = if ($Bold) { "`e[1m" } else { '' }
    Write-Host ($prefix + (ConvertTo-GknomeMenuAnsiGradientText -Text $Text -From $From -To $To) + "`e[0m")
}

function Write-GknomeMenuAnsiGradientEdge {
    param(
        [ValidateSet('top', 'middle', 'bottom')][string]$Side = 'middle',
        [int]$Width = 74,
        [Parameter(Mandatory = $true)][object]$Glyphs,
        [Parameter(Mandatory = $true)][int[]]$From,
        [Parameter(Mandatory = $true)][int[]]$To
    )
    $edge = Format-GknomeMenuFrameEdge -Side $Side -Width $Width -Glyphs $Glyphs
    Write-GknomeMenuAnsiGradientLine -Text $edge -From $From -To $To
}

function Get-GknomeMenuAnsiHyperlink {
    param([string]$Path, [string]$Display)
    if ([string]::IsNullOrWhiteSpace($Path) -or $env:NO_COLOR -eq '1' -or $env:GKNOME_NO_OSC8 -eq '1') {
        return [string]$Display
    }
    try {
        $uri = ([System.Uri]([System.IO.Path]::GetFullPath($Path))).AbsoluteUri
        return "`e]8;;$uri`a$Display`e]8;;`a"
    }
    catch {
        return [string]$Display
    }
}

function Move-GknomeMenuAnsiHome {
    try {
        [Console]::SetCursorPosition(0, 0)
        return $true
    }
    catch {
        try {
            Write-Host "`e[H" -NoNewline
            return $true
        }
        catch { return $false }
    }
}

function Clear-GknomeMenuAnsiRemainder {
    try {
        Write-Host "`e[J" -NoNewline
        return $true
    }
    catch {
        return $false
    }
}

function Invoke-GknomeMenuAnsi {
    param(
        [Parameter(Mandatory = $true)][object]$Model,
        [object]$Theme = $null,
        [switch]$NoClear
    )

    if ($null -eq $Theme) { $Theme = Get-GknomeMenuTheme -UiRoot $PSScriptRoot }

    if (-not (Test-GknomeMenuVtEnabled)) {
        return (Invoke-GknomeMenuBasic -Model $Model -Theme $Theme -NoClear:$NoClear)
    }

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
        return [pscustomobject]@{ kind = 'cancel'; task = $null; engine = 'ansi' }
    }

    $selected = Get-GknomeMenuFirstEnabledActionIndex -Actions @($actionRows | ForEach-Object { $_.action })
    $filter = ''
    $style = Get-GknomeMenuStyle
    $themeNames = @(Get-GknomeMenuThemeNames -UiRoot $PSScriptRoot)
    $themeIndex = [Math]::Max(0, [array]::IndexOf($themeNames, [string]$Theme.name))
    $ascii = ($env:GKNOME_ASCII -eq '1')
    $glyphs = Get-GknomeMenuGlyphSet -Ascii:$ascii
    $bannerText = Get-GknomeMenuBannerText -Model $Model
    $bannerProbe = @(Get-GknomeMenuProductBanner -Text $bannerText -Ascii)
    $bannerPreferred = [Math]::Max([int]$style.ansi_width, $bannerProbe[0].Length + 4)
    $painted = $false
    $paintedInPlace = $false
    $showHelp = $false
    $hover = -1
    $mouseSelectionKey = ''
    $pendingDigits = ''
    $pendingDigitAt = [datetime]::MinValue
    $inputSession = $null
    $mouseWarning = ''

    # PowerShell chooses PlainText at process startup when the parent exports a
    # non-VT TERM/NO_COLOR environment. An operator can deliberately clear that
    # policy and request ANSI for this interactive controller, so make the
    # renderer's explicit choice effective without leaking it to later output.
    $previousOutputRendering = $null
    $restoreOutputRendering = $false
    try {
        if ($null -ne $PSStyle -and [string]$PSStyle.OutputRendering -ne 'Ansi') {
            $previousOutputRendering = $PSStyle.OutputRendering
            $PSStyle.OutputRendering = 'Ansi'
            $restoreOutputRendering = $true
        }
    }
    catch { }

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
        $fg = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'fg' -Default @(226, 232, 240)
        $muted = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'muted' -Default @(148, 163, 184)
        $accent = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'accent' -Default @(45, 212, 191)
        $accentHot = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'accent_hot' -Default @(167, 139, 250)
        $accentDeep = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'accent_deep' -Default @(13, 100, 95)
        $group = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'group' -Default $accent
        $border = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'border' -Default @(40, 70, 75)
        $borderGlow = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'border_glow' -Default $accent
        $selFg = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'selected_fg' -Default @(240, 253, 250)
        $selBg = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'selected_bg' -Default @(15, 48, 52)
        $hoverFg = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'hover_fg' -Default $accentHot
        $hoverBg = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'hover_bg' -Default @(18, 36, 40)
        $rail = Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'rail' -Default $accent
        $size = Get-GknomeMenuConsoleSize
        $compactViewport = $size.Height -lt 32
        $frameWidth = Get-GknomeMenuFrameWidth -Preferred $bannerPreferred -Maximum 120
        $banner = @(Get-GknomeMenuProductBanner -Text $bannerText -MaxWidth ($frameWidth - 4) -Ascii:$ascii)
        if (-not $NoClear) {
            if (-not $painted) { try { Clear-Host } catch { } }
            else {
                $paintedInPlace = Move-GknomeMenuAnsiHome
                if (-not $paintedInPlace) { try { Clear-Host } catch { } }
            }
        }
        $frameTop = Get-GknomeMenuCursorY

        Write-GknomeMenuAnsiGradientEdge -Side top -Width $frameWidth -Glyphs $glyphs -From $borderGlow -To $accentHot
        for ($bannerIndex = 0; $bannerIndex -lt $banner.Count; $bannerIndex++) {
            $bannerLine = Format-GknomeMenuFrameLine -Text ([string]$banner[$bannerIndex]) -Width $frameWidth -Glyphs $glyphs
            $rowFrom = if ($bannerIndex -lt [Math]::Ceiling($banner.Count / 2.0)) { $accent } else { $accentDeep }
            Write-GknomeMenuAnsiGradientLine -Text $bannerLine -From $rowFrom -To $accentHot -Bold
        }
        $header = Get-GknomeMenuHeaderText -Model $Model
        Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text $header -Width $frameWidth -Glyphs $glyphs) -Fg $accent -Bold
        if (-not [string]::IsNullOrWhiteSpace([string]$Model.subtitle)) {
            Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text ([string]$Model.subtitle) -Width $frameWidth -Glyphs $glyphs) -Fg $muted
        }
        foreach ($line in @($Model.status_lines)) {
            if (-not [string]::IsNullOrWhiteSpace([string]$line)) {
                Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text ([string]$line) -Width $frameWidth -Glyphs $glyphs) -Fg $muted
            }
        }
        if (-not [string]::IsNullOrWhiteSpace($mouseWarning)) {
            Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text ("MOUSE  $mouseWarning") -Width $frameWidth -Glyphs $glyphs) -Fg $muted
        }
        Write-GknomeMenuAnsiGradientEdge -Side middle -Width $frameWidth -Glyphs $glyphs -From $border -To $borderGlow
        $displayPath = Get-GknomeMenuDisplayPath -MaxChars ($frameWidth - 4)
        $pathInnerWidth = [Math]::Max(0, $frameWidth - 4)
        $pathPad = [Math]::Max(0, $pathInnerWidth - $displayPath.Length)
        $pathLink = Get-GknomeMenuAnsiHyperlink -Path $displayPath -Display $displayPath
        $pathLine = "$($glyphs.vertical) $pathLink$(' ' * $pathPad) $($glyphs.vertical)"
        Write-GknomeMenuAnsiLine -Text $pathLine -Fg (Get-GknomeMenuAnsiRgb -Theme $Theme -Token 'path' -Default @(103, 232, 249))
        if ($pages.Count -gt 1) {
            $pageDescription = Get-GknomeMenuPageDescription -Model $Model -PageIndex $pageIndex
            $pageLayout = New-GknomeMenuPageTabLayout -Pages $pages -PageIndex $pageIndex -InnerWidth ($frameWidth - 4) -StartX 2 -StartY (Get-GknomeMenuCursorY)
            foreach ($pageLine in @($pageLayout.lines)) {
                Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text ([string]$pageLine) -Width $frameWidth -Glyphs $glyphs) -Fg $accent
            }
            foreach ($zone in @($pageLayout.zones)) { $hitZones.Add($zone) }
            if (-not $compactViewport -and -not [string]::IsNullOrWhiteSpace($pageDescription)) {
                Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text $pageDescription -Width $frameWidth -Glyphs $glyphs) -Fg $muted
            }
        }
        Write-GknomeMenuAnsiGradientEdge -Side middle -Width $frameWidth -Glyphs $glyphs -From $border -To $borderGlow

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
                Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text ([string]$helpLines[$helpIndex]) -Width $frameWidth -Glyphs $glyphs) -Fg $(if ($helpIndex -eq 0) { $accent } else { $muted }) -Bold:($helpIndex -eq 0)
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
                Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text ("^ $above more above") -Width $frameWidth -Glyphs $glyphs) -Fg $muted
                $hitZones.Add((New-GknomeMenuHitZone -Kind 'move-up' -X 1 -Y $aboveY -Width ($frameWidth - 2)))
            }

            foreach ($row in $visible) {
                if ($row.kind -eq 'group') {
                    Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text ("$($glyphs.group) $($row.label)") -Width $frameWidth -Glyphs $glyphs) -Fg $group -Bold
                    continue
                }
                $rowY = Get-GknomeMenuCursorY
                $isSelected = ([int]$row.actionIndex -eq $selected)
                $isHovered = ([int]$row.actionIndex -eq $hover)
                $prefix = if ($isSelected) { "$($glyphs.selected) " } elseif ($isHovered) { "$($glyphs.dot) " } else { '  ' }
                $text = Format-GknomeMenuKeyChip -Key ([string]$row.number) -Label ([string]$row.label)
                $line = Format-GknomeMenuFrameLine -Text ($prefix + $text) -Width $frameWidth -Glyphs $glyphs
                if ($isSelected) {
                    Write-GknomeMenuAnsiLine -Text $line -Fg $selFg -Bg $selBg -Bold
                }
                elseif ($isHovered) {
                    Write-GknomeMenuAnsiLine -Text $line -Fg $hoverFg -Bg $hoverBg -Bold
                }
                else {
                    Write-GknomeMenuAnsiLine -Text $line -Fg $(if ([bool]$row.action.enabled) { $fg } else { $muted })
                }
                $hitZones.Add((New-GknomeMenuHitZone -Kind 'action' -X 1 -Y $rowY -Width ($frameWidth - 2) -Value ([int]$row.actionIndex) -Enabled ([bool]$row.action.enabled)))
            }
            if ($below -gt 0) {
                $belowY = Get-GknomeMenuCursorY
                Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text ("v $below more below") -Width $frameWidth -Glyphs $glyphs) -Fg $muted
                $hitZones.Add((New-GknomeMenuHitZone -Kind 'move-down' -X 1 -Y $belowY -Width ($frameWidth - 2)))
            }
        }

        Write-GknomeMenuAnsiGradientEdge -Side middle -Width $frameWidth -Glyphs $glyphs -From $border -To $borderGlow
        $current = $actionRows[$selected]
        $detail = [string]$current.action.description
        if ([string]::IsNullOrWhiteSpace($detail)) { $detail = [string]$current.action.task }
        Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text ("DETAIL  $detail  // task=$([string]$current.action.task)  // owner=$([string]$current.action.owner)  ($($selected + 1)/$($actionRows.Count))") -Width $frameWidth -Glyphs $glyphs) -Fg $rail
        $controlLayout = New-GknomeMenuControlLayout -InnerWidth ($frameWidth - 4) -StartX 2 -StartY (Get-GknomeMenuCursorY) -RunEnabled ([bool]$current.action.enabled) -ParentPageIndex $parentPageIndex -NavigationEnabled:($actionRows.Count -gt 1) -IncludeTheme
        foreach ($controlLine in @($controlLayout.lines)) {
            Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text ([string]$controlLine) -Width $frameWidth -Glyphs $glyphs) -Fg $accent -Bold
        }
        foreach ($zone in @($controlLayout.zones)) { $hitZones.Add($zone) }
        if (-not [bool]$viewportBudget.compact) {
            $footerText = Get-GknomeMenuStudyFooterLine -Ascii:$ascii -Native
            if ($null -ne $inputSession -and [bool]$inputSession.mouse_enabled) { $footerText = "[Mouse] hover/click/up/down/wheel  $footerText" }
            elseif ($pages.Count -gt 1) { $footerText = "[Tab] page  $footerText" }
            if (-not [string]::IsNullOrWhiteSpace($filter)) { $footerText = "FILTER  $filter  //  $footerText" }
            Write-GknomeMenuAnsiLine -Text (Format-GknomeMenuFrameLine -Text $footerText -Width $frameWidth -Glyphs $glyphs) -Fg $muted
        }
        Write-GknomeMenuAnsiGradientEdge -Side bottom -Width $frameWidth -Glyphs $glyphs -From $borderGlow -To $border
        if ($paintedInPlace) { [void](Clear-GknomeMenuAnsiRemainder) }
        if ($isFirstFrame) {
            Publish-GknomeMenuFirstFrame -Engine 'ansi'
        }
        $painted = $true
        $paintedInPlace = $false
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
        if ($null -eq $event) { return [pscustomobject]@{ kind = 'cancel'; task = $null; engine = 'ansi' } }
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
                return [pscustomobject]@{ kind = 'task'; task = [string]$action.task; action = $action; input_source = [string]$event.source; engine = 'ansi' }
            }
            'cancel' { return [pscustomobject]@{ kind = 'cancel'; task = $null; engine = 'ansi' } }
            'refresh' { return [pscustomobject]@{ kind = 'refresh'; task = $null; engine = 'ansi' } }
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
        if ($restoreOutputRendering) {
            try { $PSStyle.OutputRendering = $previousOutputRendering } catch { }
        }
    }
}

Export-ModuleMember -Function @('Invoke-GknomeMenuAnsi')
