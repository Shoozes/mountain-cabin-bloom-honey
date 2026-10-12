#Requires -Version 5.1
<#
.SYNOPSIS
  Optional Windows console input adapter for the gknome PowerShell menu.
.DESCRIPTION
  Normalizes keyboard, mouse, wheel, and resize records without owning task
  execution. Console mode is restored exactly when the input session closes.
#>

Set-StrictMode -Version 2.0

$script:GknomeMenuInputSchema = 'gknome_menu_input_event_v1'
$script:GknomeMenuInputSessionSchema = 'gknome_menu_input_session_v1'
$script:GknomeMenuNativeType = 'GknomeConsoleInputNativeV1'
$script:GknomeMenuCleanupFailureKey = 'gknome_menu_cleanup_failure'

function Get-GknomeMenuMousePolicy {
    $value = [string]$env:GKNOME_MOUSE
    if ([string]::IsNullOrWhiteSpace($value)) { return 'auto' }
    $normalized = $value.Trim().ToLowerInvariant()
    if ($normalized -in @('auto', 'on', 'off')) { return $normalized }
    return 'auto'
}

function Test-GknomeMenuWindowsConsole {
    try {
        if ($env:OS -ne 'Windows_NT') { return $false }
        if ([Console]::IsInputRedirected -or [Console]::IsOutputRedirected) { return $false }
        if ($null -eq $Host -or $null -eq $Host.UI -or $null -eq $Host.UI.RawUI) { return $false }
        return $true
    }
    catch {
        return $false
    }
}

function Initialize-GknomeMenuNativeInputType {
    if ($script:GknomeMenuNativeType -as [type]) { return }

    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class GknomeConsoleInputNativeV1
{
    public const int STD_INPUT_HANDLE = -10;
    public const ushort KEY_EVENT = 0x0001;
    public const ushort MOUSE_EVENT = 0x0002;
    public const ushort WINDOW_BUFFER_SIZE_EVENT = 0x0004;
    public const uint ENABLE_WINDOW_INPUT = 0x0008;
    public const uint ENABLE_MOUSE_INPUT = 0x0010;
    public const uint ENABLE_QUICK_EDIT_MODE = 0x0040;
    public const uint ENABLE_EXTENDED_FLAGS = 0x0080;
    public const uint FROM_LEFT_1ST_BUTTON_PRESSED = 0x0001;
    public const uint MOUSE_MOVED = 0x0001;
    public const uint DOUBLE_CLICK = 0x0002;
    public const uint MOUSE_WHEELED = 0x0004;
    public const uint MOUSE_HWHEELED = 0x0008;

    [StructLayout(LayoutKind.Explicit, Size = 20)]
    public struct INPUT_RECORD
    {
        [FieldOffset(0)] public ushort EventType;

        // KEY_EVENT_RECORD union fields.
        [FieldOffset(4)] public int KeyDown;
        [FieldOffset(8)] public ushort RepeatCount;
        [FieldOffset(10)] public ushort VirtualKey;
        [FieldOffset(12)] public ushort VirtualScan;
        [FieldOffset(14)] public ushort UnicodeChar;
        [FieldOffset(16)] public uint KeyControlState;

        // MOUSE_EVENT_RECORD union fields.
        [FieldOffset(4)] public short MouseX;
        [FieldOffset(6)] public short MouseY;
        [FieldOffset(8)] public uint ButtonState;
        [FieldOffset(12)] public uint MouseControlState;
        [FieldOffset(16)] public uint EventFlags;

        // WINDOW_BUFFER_SIZE_RECORD union fields.
        [FieldOffset(4)] public short BufferWidth;
        [FieldOffset(6)] public short BufferHeight;
    }

    public sealed class NativeEvent
    {
        public string Kind = String.Empty;
        public int VirtualKey;
        public int Character;
        public int X;
        public int Y;
        public int Width;
        public int Height;
        public uint ButtonState;
        public uint ControlState;
        public uint EventFlags;
        public int WheelDelta;
        public bool DoubleClick;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int nStdHandle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool ReadConsoleInputW(IntPtr hConsoleInput, out INPUT_RECORD lpBuffer, uint nLength, out uint lpNumberOfEventsRead);

    public static bool TryEnable(out IntPtr handle, out uint originalMode, out string error)
    {
        handle = GetStdHandle(STD_INPUT_HANDLE);
        originalMode = 0;
        error = String.Empty;
        if (handle == IntPtr.Zero || handle == new IntPtr(-1))
        {
            error = "standard input is not a console handle";
            return false;
        }
        if (!GetConsoleMode(handle, out originalMode))
        {
            error = new Win32Exception(Marshal.GetLastWin32Error()).Message;
            return false;
        }

        uint mode = originalMode | ENABLE_WINDOW_INPUT | ENABLE_MOUSE_INPUT | ENABLE_EXTENDED_FLAGS;
        mode &= ~ENABLE_QUICK_EDIT_MODE;
        if (!SetConsoleMode(handle, mode))
        {
            error = new Win32Exception(Marshal.GetLastWin32Error()).Message;
            return false;
        }
        return true;
    }

    public static void Restore(IntPtr handle, uint originalMode)
    {
        if (handle == IntPtr.Zero || handle == new IntPtr(-1)) { return; }
        if (!SetConsoleMode(handle, originalMode))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }
    }

    public static NativeEvent ReadEvent(IntPtr handle)
    {
        INPUT_RECORD record;
        uint count;
        if (!ReadConsoleInputW(handle, out record, 1, out count) || count != 1)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }

        NativeEvent result = new NativeEvent();
        if (record.EventType == KEY_EVENT)
        {
            if (record.KeyDown == 0) { result.Kind = "ignore"; return result; }
            result.Kind = "key";
            result.VirtualKey = record.VirtualKey;
            result.Character = record.UnicodeChar;
            result.ControlState = record.KeyControlState;
            return result;
        }
        if (record.EventType == MOUSE_EVENT)
        {
            result.Kind = "mouse";
            result.X = record.MouseX;
            result.Y = record.MouseY;
            result.ButtonState = record.ButtonState;
            result.ControlState = record.MouseControlState;
            result.EventFlags = record.EventFlags;
            result.DoubleClick = (record.EventFlags & DOUBLE_CLICK) != 0;
            if ((record.EventFlags & MOUSE_WHEELED) != 0)
            {
                result.WheelDelta = unchecked((short)((record.ButtonState >> 16) & 0xffff));
            }
            return result;
        }
        if (record.EventType == WINDOW_BUFFER_SIZE_EVENT)
        {
            result.Kind = "resize";
            result.Width = record.BufferWidth;
            result.Height = record.BufferHeight;
            return result;
        }
        result.Kind = "ignore";
        return result;
    }
}
'@
}

function New-GknomeMenuInputEvent {
    param(
        [Parameter(Mandatory = $true)][string]$Kind,
        [int]$VirtualKey = 0,
        [AllowEmptyString()][string]$Character = '',
        [int]$X = -1,
        [int]$Y = -1,
        [int]$Delta = 0,
        [int]$Width = 0,
        [int]$Height = 0,
        [switch]$DoubleClick,
        [string]$Source = 'synthetic'
    )

    return [pscustomobject][ordered]@{
        schema = $script:GknomeMenuInputSchema
        kind = $Kind
        virtual_key = $VirtualKey
        character = $Character
        x = $X
        y = $Y
        delta = $Delta
        width = $Width
        height = $Height
        double_click = [bool]$DoubleClick
        source = $Source
    }
}

function New-GknomeMenuInputSession {
    param(
        [object[]]$SyntheticEvents = @(),
        [switch]$ForceSynthetic,
        [switch]$DisableMouse
    )

    $policy = Get-GknomeMenuMousePolicy
    $session = [pscustomobject][ordered]@{
        schema = $script:GknomeMenuInputSessionSchema
        mouse_policy = $policy
        mouse_enabled = $false
        native_initialized = $false
        restore_required = $false
        restored = $false
        handle = [IntPtr]::Zero
        original_mode = [uint32]0
        last_left_down = $false
        warning = ''
        failure = ''
        synthetic = ([bool]$ForceSynthetic -or @($SyntheticEvents).Count -gt 0)
        synthetic_events = @($SyntheticEvents)
        synthetic_index = 0
    }

    if ([bool]$session.synthetic -or $DisableMouse -or $policy -eq 'off') { return $session }

    if (-not (Test-GknomeMenuWindowsConsole)) {
        if ($policy -eq 'on') {
            $session.warning = 'GKNOME_MOUSE=on was requested, but this session has no interactive Windows console; keyboard fallback remains active.'
        }
        return $session
    }

    try {
        Initialize-GknomeMenuNativeInputType
        $session.native_initialized = $true
        $handle = [IntPtr]::Zero
        $originalMode = [uint32]0
        $errorText = ''
        $enabled = [GknomeConsoleInputNativeV1]::TryEnable([ref]$handle, [ref]$originalMode, [ref]$errorText)
        if (-not $enabled) { throw $errorText }
        $session.handle = $handle
        $session.original_mode = $originalMode
        $session.mouse_enabled = $true
        $session.restore_required = $true
    }
    catch {
        $session.failure = $_.Exception.Message
        if ($policy -eq 'on') {
            $session.warning = "GKNOME_MOUSE=on could not initialize mouse input: $($session.failure). Keyboard fallback remains active."
        }
    }
    return $session
}

function Close-GknomeMenuInputSession {
    param([Parameter(Mandatory = $true)][object]$Session)

    if ([bool]$Session.restored) { return }
    if (-not [bool]$Session.restore_required) {
        $Session.mouse_enabled = $false
        $Session.restored = $true
        return
    }

    if (-not ($script:GknomeMenuNativeType -as [type])) {
        $message = 'Mouse input cleanup could not restore the original console mode because the native adapter type is unavailable.'
        if ($null -ne $Session.PSObject.Properties['failure']) { $Session.failure = $message }
        $exception = [System.InvalidOperationException]::new($message)
        $exception.Data[$script:GknomeMenuCleanupFailureKey] = $true
        throw $exception
    }

    try {
        [GknomeConsoleInputNativeV1]::Restore([IntPtr]$Session.handle, [uint32]$Session.original_mode)
    }
    catch {
        $message = "Mouse input cleanup could not restore the original console mode: $($_.Exception.Message)"
        if ($null -ne $Session.PSObject.Properties['failure']) { $Session.failure = $message }
        $exception = [System.InvalidOperationException]::new($message, $_.Exception)
        $exception.Data[$script:GknomeMenuCleanupFailureKey] = $true
        throw $exception
    }

    $Session.mouse_enabled = $false
    $Session.restore_required = $false
    $Session.restored = $true
}

function Disable-GknomeMenuMouseInput {
    param(
        [Parameter(Mandatory = $true)][object]$Session,
        [string]$Reason = ''
    )

    if (-not [string]::IsNullOrWhiteSpace($Reason)) { $Session.failure = $Reason }
    Close-GknomeMenuInputSession -Session $Session
}

function Invoke-GknomeMenuInputScope {
    param(
        [Parameter(Mandatory = $true)][object]$Session,
        [Parameter(Mandatory = $true)][scriptblock]$Body
    )

    try {
        return (& $Body $Session)
    }
    finally {
        Close-GknomeMenuInputSession -Session $Session
    }
}

function ConvertTo-GknomeMenuKeyEvent {
    param(
        [Parameter(Mandatory = $true)][int]$VirtualKey,
        [int]$CharacterCode = 0,
        [string]$Source = 'console'
    )

    $character = ''
    if ($CharacterCode -gt 0 -and $CharacterCode -le 0xffff) {
        try { $character = [string][char]$CharacterCode } catch { $character = '' }
    }
    return New-GknomeMenuInputEvent -Kind 'key' -VirtualKey $VirtualKey -Character $character -Source $Source
}

function Read-GknomeMenuInputEvent {
    param([Parameter(Mandatory = $true)][object]$Session)

    while ($true) {
        if ([bool]$Session.synthetic) {
            $index = [int]$Session.synthetic_index
            $events = @($Session.synthetic_events)
            if ($index -ge $events.Count) { return $null }
            $Session.synthetic_index = $index + 1
            return $events[$index]
        }

        if ([bool]$Session.mouse_enabled) {
            try {
                $native = [GknomeConsoleInputNativeV1]::ReadEvent([IntPtr]$Session.handle)
                if ($null -eq $native -or [string]$native.Kind -eq 'ignore') { continue }
                if ([string]$native.Kind -eq 'key') {
                    return ConvertTo-GknomeMenuKeyEvent -VirtualKey ([int]$native.VirtualKey) -CharacterCode ([int]$native.Character) -Source 'win32'
                }
                if ([string]$native.Kind -eq 'resize') {
                    return New-GknomeMenuInputEvent -Kind 'resize' -Width ([int]$native.Width) -Height ([int]$native.Height) -Source 'win32'
                }
                if ([string]$native.Kind -eq 'mouse') {
                    $flags = [uint32]$native.EventFlags
                    if (($flags -band [uint32]0x0004) -ne 0) {
                        $kind = if ([int]$native.WheelDelta -gt 0) { 'mouse-wheel-up' } else { 'mouse-wheel-down' }
                        return New-GknomeMenuInputEvent -Kind $kind -X ([int]$native.X) -Y ([int]$native.Y) -Delta ([int]$native.WheelDelta) -Source 'win32'
                    }
                    if (($flags -band [uint32]0x0008) -ne 0) { continue }
                    if (($flags -band [uint32]0x0001) -ne 0) {
                        return New-GknomeMenuInputEvent -Kind 'mouse-move' -X ([int]$native.X) -Y ([int]$native.Y) -Source 'win32'
                    }

                    $leftDown = (([uint32]$native.ButtonState -band [uint32]0x0001) -ne 0)
                    if ($leftDown) {
                        $Session.last_left_down = $true
                        return New-GknomeMenuInputEvent -Kind 'mouse-left-down' -X ([int]$native.X) -Y ([int]$native.Y) -DoubleClick:([bool]$native.DoubleClick) -Source 'win32'
                    }
                    if ([bool]$Session.last_left_down) {
                        $Session.last_left_down = $false
                        return New-GknomeMenuInputEvent -Kind 'mouse-left-up' -X ([int]$native.X) -Y ([int]$native.Y) -Source 'win32'
                    }
                    continue
                }
            }
            catch {
                $reason = $_.Exception.Message
                Disable-GknomeMenuMouseInput -Session $Session -Reason $reason
                if ([string]$Session.mouse_policy -eq 'on') {
                    Write-Warning "Mouse input failed and was disabled: $reason. Keyboard fallback remains active."
                }
            }
        }

        try {
            $key = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
            return ConvertTo-GknomeMenuKeyEvent -VirtualKey ([int]$key.VirtualKeyCode) -CharacterCode ([int][char]$key.Character) -Source 'rawui'
        }
        catch {
            return $null
        }
    }
}

function New-GknomeMenuHitZone {
    param(
        [Parameter(Mandatory = $true)][string]$Kind,
        [Parameter(Mandatory = $true)][int]$X,
        [Parameter(Mandatory = $true)][int]$Y,
        [Parameter(Mandatory = $true)][int]$Width,
        [int]$Height = 1,
        [AllowNull()][object]$Value = $null,
        [bool]$Enabled = $true
    )

    return [pscustomobject][ordered]@{
        kind = $Kind
        x = $X
        y = $Y
        width = [Math]::Max(0, $Width)
        height = [Math]::Max(0, $Height)
        value = $Value
        enabled = $Enabled
    }
}

function Get-GknomeMenuCursorY {
    $y = 0
    try { $y = [int]$Host.UI.RawUI.CursorPosition.Y } catch { }
    return $y
}

function Find-GknomeMenuHitZone {
    param(
        [object[]]$HitZones = @(),
        [Parameter(Mandatory = $true)][int]$X,
        [Parameter(Mandatory = $true)][int]$Y
    )

    $zones = @($HitZones)
    for ($i = $zones.Count - 1; $i -ge 0; $i--) {
        $zone = $zones[$i]
        if ($null -eq $zone) { continue }
        $x0 = [int]$zone.x
        $y0 = [int]$zone.y
        $x1 = $x0 + [int]$zone.width
        $y1 = $y0 + [int]$zone.height
        if ($X -ge $x0 -and $X -lt $x1 -and $Y -ge $y0 -and $Y -lt $y1) { return $zone }
    }
    return $null
}

function New-GknomeMenuButtonLayout {
    param(
        [object[]]$Buttons = @(),
        [Parameter(Mandatory = $true)][int]$InnerWidth,
        [int]$StartX = 2,
        [int]$StartY = 0
    )

    $safeWidth = [Math]::Max(1, $InnerWidth)
    $lines = New-Object System.Collections.Generic.List[string]
    $zones = New-Object System.Collections.Generic.List[object]
    $current = ''
    $row = 0
    foreach ($button in @($Buttons)) {
        $label = [string]$button.label
        if ([string]::IsNullOrWhiteSpace($label)) { continue }
        $token = '[ ' + $label.Trim() + ' ]'
        if ($token.Length -gt $safeWidth) { $token = $token.Substring(0, $safeWidth) }
        $separator = if ($current.Length -eq 0) { '' } else { '  ' }
        if ($current.Length -gt 0 -and ($current.Length + $separator.Length + $token.Length) -gt $safeWidth) {
            $lines.Add($current)
            $current = ''
            $row++
            $separator = ''
        }
        $x = $current.Length + $separator.Length
        $current += $separator + $token
        $kind = [string]$button.kind
        $value = if ($null -ne $button.PSObject.Properties['value']) { $button.value } else { $null }
        $enabled = if ($null -ne $button.PSObject.Properties['enabled']) { [bool]$button.enabled } else { $true }
        $zones.Add((New-GknomeMenuHitZone -Kind $kind -X ($StartX + $x) -Y ($StartY + $row) -Width $token.Length -Value $value -Enabled $enabled))
    }
    if ($current.Length -gt 0 -or $lines.Count -eq 0) { $lines.Add($current) }
    return [pscustomobject]@{ lines = @($lines.ToArray()); zones = @($zones.ToArray()) }
}

function New-GknomeMenuPageTabLayout {
    param(
        [object[]]$Pages = @(),
        [int]$PageIndex = 0,
        [Parameter(Mandatory = $true)][int]$InnerWidth,
        [int]$StartX = 2,
        [int]$StartY = 0
    )

    $buttons = New-Object System.Collections.Generic.List[object]
    for ($i = 0; $i -lt @($Pages).Count; $i++) {
        $label = [string]$Pages[$i].label
        if ($i -eq $PageIndex) { $label = '> ' + $label + ' <' }
        $buttons.Add([pscustomobject]@{ kind = 'page'; label = $label; value = $i; enabled = $true })
    }
    return New-GknomeMenuButtonLayout -Buttons @($buttons.ToArray()) -InnerWidth $InnerWidth -StartX $StartX -StartY $StartY
}

function New-GknomeMenuControlLayout {
    param(
        [Parameter(Mandatory = $true)][int]$InnerWidth,
        [int]$StartX = 2,
        [int]$StartY = 0,
        [bool]$RunEnabled = $true,
        [int]$ParentPageIndex = -1,
        [bool]$NavigationEnabled = $true,
        [switch]$IncludeTheme
    )

    $buttons = @(
        [pscustomobject]@{ kind = 'run'; label = $(if ($RunEnabled) { 'Run' } else { 'Run (disabled)' }); value = $null; enabled = $RunEnabled },
        [pscustomobject]@{ kind = 'move-up'; label = 'Up'; value = $null; enabled = $NavigationEnabled },
        [pscustomobject]@{ kind = 'move-down'; label = 'Down'; value = $null; enabled = $NavigationEnabled }
    )
    if ($ParentPageIndex -ge 0) {
        $buttons += [pscustomobject]@{ kind = 'back'; label = 'Back'; value = $ParentPageIndex; enabled = $true }
    }
    $buttons += @(
        [pscustomobject]@{ kind = 'help'; label = 'Help'; value = $null; enabled = $true },
        [pscustomobject]@{ kind = 'refresh'; label = 'Refresh'; value = $null; enabled = $true },
        [pscustomobject]@{ kind = 'cancel'; label = 'Quit'; value = $null; enabled = $true }
    )
    if ($IncludeTheme) {
        $buttons += [pscustomobject]@{ kind = 'theme'; label = 'Theme'; value = $null; enabled = $true }
    }
    return New-GknomeMenuButtonLayout -Buttons $buttons -InnerWidth $InnerWidth -StartX $StartX -StartY $StartY
}

function New-GknomeMenuInteractionResult {
    param(
        [string]$Command = 'none',
        [int]$SelectedActionIndex = 0,
        [int]$PageIndex = 0,
        [int]$HoverActionIndex = -1,
        [AllowEmptyString()][string]$MouseSelectionKey = '',
        [AllowNull()][object]$Action = $null,
        [AllowNull()][object]$Value = $null
    )

    return [pscustomobject][ordered]@{
        command = $Command
        selected_action_index = $SelectedActionIndex
        page_index = $PageIndex
        hover_action_index = $HoverActionIndex
        mouse_selection_key = $MouseSelectionKey
        action = $Action
        value = $Value
    }
}

function Get-GknomeMenuFirstEnabledActionIndex {
    param([object[]]$Actions = @())

    for ($i = 0; $i -lt @($Actions).Count; $i++) {
        if ([bool]$Actions[$i].enabled) { return $i }
    }
    return 0
}

function Resolve-GknomeMenuInteraction {
    param(
        [Parameter(Mandatory = $true)][object]$Event,
        [object[]]$HitZones = @(),
        [object[]]$Actions = @(),
        [int]$SelectedActionIndex = 0,
        [int]$PageIndex = 0,
        [int]$PageCount = 1,
        [int]$ParentPageIndex = -1,
        [int]$Viewport = 1,
        [int]$HoverActionIndex = -1,
        [AllowEmptyString()][string]$MouseSelectionKey = '',
        [switch]$HelpVisible
    )

    $actionRows = @($Actions)
    $selected = if ($actionRows.Count -eq 0) { 0 } else { [Math]::Min([Math]::Max(0, $SelectedActionIndex), $actionRows.Count - 1) }
    $base = @{ SelectedActionIndex = $selected; PageIndex = $PageIndex; HoverActionIndex = $HoverActionIndex; MouseSelectionKey = $MouseSelectionKey }
    $kind = [string]$Event.kind

    if ($HelpVisible) {
        if ($kind -eq 'mouse-move' -and $HoverActionIndex -ge 0) { return New-GknomeMenuInteractionResult -Command 'hover' -SelectedActionIndex $selected -PageIndex $PageIndex -HoverActionIndex -1 -MouseSelectionKey $MouseSelectionKey }
        if ($kind -eq 'key') {
            $vk = [int]$Event.virtual_key
            $ch = [string]$Event.character
            if ($vk -eq 27 -or $ch -match '(?i)^[h?]$') { return New-GknomeMenuInteractionResult @base -Command 'close-help' }
            if ($ch -match '(?i)^q$') { return New-GknomeMenuInteractionResult @base -Command 'cancel' }
            return New-GknomeMenuInteractionResult @base
        }
        if ($kind -eq 'mouse-left-down') {
            $zone = Find-GknomeMenuHitZone -HitZones $HitZones -X ([int]$Event.x) -Y ([int]$Event.y)
            if ($null -ne $zone -and [string]$zone.kind -eq 'help-panel') { return New-GknomeMenuInteractionResult @base }
            return New-GknomeMenuInteractionResult @base -Command 'close-help'
        }
        if ($kind -eq 'resize') { return New-GknomeMenuInteractionResult @base -Command 'redraw' }
        return New-GknomeMenuInteractionResult @base
    }

    if ($kind -eq 'resize') { return New-GknomeMenuInteractionResult -Command 'redraw' -SelectedActionIndex $selected -PageIndex $PageIndex -HoverActionIndex -1 -MouseSelectionKey '' }
    if ($kind -eq 'mouse-move') {
        $zone = Find-GknomeMenuHitZone -HitZones $HitZones -X ([int]$Event.x) -Y ([int]$Event.y)
        $hover = -1
        if ($null -ne $zone -and [string]$zone.kind -eq 'action' -and [bool]$zone.enabled) {
            $candidate = [int]$zone.value
            if ($candidate -ge 0 -and $candidate -lt $actionRows.Count) { $hover = $candidate }
        }
        if ($hover -eq $HoverActionIndex) { return New-GknomeMenuInteractionResult @base }
        return New-GknomeMenuInteractionResult -Command 'hover' -SelectedActionIndex $selected -PageIndex $PageIndex -HoverActionIndex $hover -MouseSelectionKey $MouseSelectionKey
    }
    if ($kind -eq 'mouse-wheel-up' -or $kind -eq 'mouse-wheel-down') {
        if ($actionRows.Count -eq 0) { return New-GknomeMenuInteractionResult @base }
        $step = [Math]::Max(1, [Math]::Min(3, [Math]::Max(1, $Viewport)))
        $next = if ($kind -eq 'mouse-wheel-up') { [Math]::Max(0, $selected - $step) } else { [Math]::Min($actionRows.Count - 1, $selected + $step) }
        return New-GknomeMenuInteractionResult -Command 'select' -SelectedActionIndex $next -PageIndex $PageIndex -HoverActionIndex -1 -MouseSelectionKey ''
    }
    if ($kind -eq 'mouse-left-down') {
        $zone = Find-GknomeMenuHitZone -HitZones $HitZones -X ([int]$Event.x) -Y ([int]$Event.y)
        if ($null -eq $zone -or -not [bool]$zone.enabled) {
            return New-GknomeMenuInteractionResult -SelectedActionIndex $selected -PageIndex $PageIndex -HoverActionIndex -1 -MouseSelectionKey ''
        }
        switch ([string]$zone.kind) {
            'page' {
                return New-GknomeMenuInteractionResult -Command 'page' -SelectedActionIndex 0 -PageIndex ([int]$zone.value) -HoverActionIndex -1 -MouseSelectionKey ''
            }
            'back' {
                $target = if ([int]$zone.value -ge 0) { [int]$zone.value } else { $ParentPageIndex }
                if ($target -ge 0) { return New-GknomeMenuInteractionResult -Command 'page' -SelectedActionIndex 0 -PageIndex $target -HoverActionIndex -1 -MouseSelectionKey '' }
                return New-GknomeMenuInteractionResult @base
            }
            'action' {
                $index = [int]$zone.value
                if ($index -lt 0 -or $index -ge $actionRows.Count) { return New-GknomeMenuInteractionResult @base }
                $action = $actionRows[$index]
                if (-not [bool]$action.enabled) { return New-GknomeMenuInteractionResult -SelectedActionIndex $selected -PageIndex $PageIndex -HoverActionIndex -1 -MouseSelectionKey '' }
                $selectionKey = "$PageIndex`:$index"
                $role = [string]$action.role
                $network = [string]$action.network
                $safeAutoRun = [string]$action.confirmation -eq 'none' -and $role -in @('read', 'preview', 'open') -and $network -in @('off', 'read')
                if ($index -eq $selected -and $MouseSelectionKey -eq $selectionKey -and $safeAutoRun) {
                    return New-GknomeMenuInteractionResult -Command 'task' -SelectedActionIndex $index -PageIndex $PageIndex -HoverActionIndex $index -MouseSelectionKey $selectionKey -Action $action
                }
                return New-GknomeMenuInteractionResult -Command 'select' -SelectedActionIndex $index -PageIndex $PageIndex -HoverActionIndex $index -MouseSelectionKey $selectionKey -Action $action
            }
            'move-up' {
                if ($actionRows.Count -eq 0) { return New-GknomeMenuInteractionResult @base }
                $next = if ($selected -gt 0) { $selected - 1 } else { $actionRows.Count - 1 }
                return New-GknomeMenuInteractionResult -Command 'select' -SelectedActionIndex $next -PageIndex $PageIndex -HoverActionIndex -1 -MouseSelectionKey ''
            }
            'move-down' {
                if ($actionRows.Count -eq 0) { return New-GknomeMenuInteractionResult @base }
                $next = if ($selected -lt ($actionRows.Count - 1)) { $selected + 1 } else { 0 }
                return New-GknomeMenuInteractionResult -Command 'select' -SelectedActionIndex $next -PageIndex $PageIndex -HoverActionIndex -1 -MouseSelectionKey ''
            }
            'run' {
                if ($actionRows.Count -eq 0) { return New-GknomeMenuInteractionResult @base }
                $action = $actionRows[$selected]
                if (-not [bool]$action.enabled) { return New-GknomeMenuInteractionResult @base }
                return New-GknomeMenuInteractionResult -Command 'task' -SelectedActionIndex $selected -PageIndex $PageIndex -HoverActionIndex -1 -MouseSelectionKey $MouseSelectionKey -Action $action
            }
            'help' { return New-GknomeMenuInteractionResult @base -Command 'show-help' }
            'refresh' { return New-GknomeMenuInteractionResult @base -Command 'refresh' }
            'cancel' { return New-GknomeMenuInteractionResult @base -Command 'cancel' }
            'theme' { return New-GknomeMenuInteractionResult @base -Command 'theme' }
        }
        return New-GknomeMenuInteractionResult @base
    }

    if ($kind -ne 'key') { return New-GknomeMenuInteractionResult @base }
    $base.HoverActionIndex = -1
    $vk = [int]$Event.virtual_key
    $ch = [string]$Event.character
    if ($vk -eq 38 -or $ch -eq 'k') {
        $next = if ($selected -gt 0) { $selected - 1 } else { [Math]::Max(0, $actionRows.Count - 1) }
        return New-GknomeMenuInteractionResult -Command 'select' -SelectedActionIndex $next -PageIndex $PageIndex -MouseSelectionKey ''
    }
    if ($vk -eq 40 -or $ch -eq 'j') {
        $next = if ($selected -lt ($actionRows.Count - 1)) { $selected + 1 } else { 0 }
        return New-GknomeMenuInteractionResult -Command 'select' -SelectedActionIndex $next -PageIndex $PageIndex -MouseSelectionKey ''
    }
    if ($vk -eq 33) { return New-GknomeMenuInteractionResult -Command 'select' -SelectedActionIndex ([Math]::Max(0, $selected - [Math]::Max(1, $Viewport))) -PageIndex $PageIndex -MouseSelectionKey '' }
    if ($vk -eq 34) { return New-GknomeMenuInteractionResult -Command 'select' -SelectedActionIndex ([Math]::Min([Math]::Max(0, $actionRows.Count - 1), $selected + [Math]::Max(1, $Viewport))) -PageIndex $PageIndex -MouseSelectionKey '' }
    if ($vk -eq 36) { return New-GknomeMenuInteractionResult -Command 'select' -SelectedActionIndex 0 -PageIndex $PageIndex -MouseSelectionKey '' }
    if ($vk -eq 35) { return New-GknomeMenuInteractionResult -Command 'select' -SelectedActionIndex ([Math]::Max(0, $actionRows.Count - 1)) -PageIndex $PageIndex -MouseSelectionKey '' }
    if (($vk -eq 9 -or $vk -eq 37 -or $vk -eq 39) -and $PageCount -gt 1) {
        $nextPage = if ($vk -eq 37) { if ($PageIndex -eq 0) { $PageCount - 1 } else { $PageIndex - 1 } } else { ($PageIndex + 1) % $PageCount }
        return New-GknomeMenuInteractionResult -Command 'page' -SelectedActionIndex 0 -PageIndex $nextPage -MouseSelectionKey ''
    }
    if ($vk -eq 13 -and $actionRows.Count -gt 0) {
        $action = $actionRows[$selected]
        if ([bool]$action.enabled) { return New-GknomeMenuInteractionResult -Command 'task' -SelectedActionIndex $selected -PageIndex $PageIndex -MouseSelectionKey $MouseSelectionKey -Action $action }
        return New-GknomeMenuInteractionResult @base
    }
    if ($vk -eq 27 -or $ch -match '(?i)^q$') { return New-GknomeMenuInteractionResult @base -Command 'cancel' }
    if ($ch -match '(?i)^[h?]$') { return New-GknomeMenuInteractionResult @base -Command 'show-help' }
    if ($ch -match '(?i)^r$') { return New-GknomeMenuInteractionResult @base -Command 'refresh' }
    if ($ch -eq '/') { return New-GknomeMenuInteractionResult @base -Command 'filter' }
    if ($ch -match '(?i)^t$') { return New-GknomeMenuInteractionResult @base -Command 'theme' }
    if ($ch -match '^\d$') { return New-GknomeMenuInteractionResult @base -Command 'digit' -Value $ch }
    return New-GknomeMenuInteractionResult @base
}

function Wait-GknomeMenuInteraction {
    param(
        [Parameter(Mandatory = $true)][object]$Session,
        [object[]]$HitZones = @(),
        [object[]]$Actions = @(),
        [int]$SelectedActionIndex = 0,
        [int]$PageIndex = 0,
        [int]$PageCount = 1,
        [int]$ParentPageIndex = -1,
        [int]$Viewport = 1,
        [int]$HoverActionIndex = -1,
        [AllowEmptyString()][string]$MouseSelectionKey = '',
        [switch]$HelpVisible
    )

    $selected = $SelectedActionIndex
    $hover = $HoverActionIndex
    $selectionKey = $MouseSelectionKey
    while ($true) {
        $event = Read-GknomeMenuInputEvent -Session $Session
        if ($null -eq $event) {
            return [pscustomobject][ordered]@{ event = $null; interaction = $null }
        }
        $interaction = Resolve-GknomeMenuInteraction `
            -Event $event `
            -HitZones $HitZones `
            -Actions $Actions `
            -SelectedActionIndex $selected `
            -PageIndex $PageIndex `
            -PageCount $PageCount `
            -ParentPageIndex $ParentPageIndex `
            -Viewport $Viewport `
            -HoverActionIndex $hover `
            -MouseSelectionKey $selectionKey `
            -HelpVisible:$HelpVisible
        $selected = [int]$interaction.selected_action_index
        $hover = [int]$interaction.hover_action_index
        $selectionKey = [string]$interaction.mouse_selection_key
        if ([string]$interaction.command -eq 'none') { continue }
        return [pscustomobject][ordered]@{ event = $event; interaction = $interaction }
    }
}

function Update-GknomeMenuDigitSelection {
    param(
        [Parameter(Mandatory = $true)][string]$Digit,
        [object[]]$ActionRows = @(),
        [AllowEmptyString()][string]$PendingDigits = '',
        [datetime]$PendingAt = [datetime]::MinValue,
        [datetime]$Now = [datetime]::UtcNow,
        [int]$WindowMilliseconds = 650
    )

    $digits = if (-not [string]::IsNullOrWhiteSpace($PendingDigits) -and ($Now - $PendingAt).TotalMilliseconds -le $WindowMilliseconds) { $PendingDigits + $Digit } else { $Digit }
    if ($digits.Length -gt 3) { $digits = $Digit }
    $selected = -1
    for ($i = 0; $i -lt @($ActionRows).Count; $i++) {
        if ([string]$ActionRows[$i].number -eq $digits) { $selected = $i; break }
    }
    if ($selected -lt 0 -and $digits.Length -gt 1) {
        $digits = $Digit
        for ($i = 0; $i -lt @($ActionRows).Count; $i++) {
            if ([string]$ActionRows[$i].number -eq $digits) { $selected = $i; break }
        }
    }
    return [pscustomobject]@{ digits = $digits; at = $Now; selected_action_index = $selected }
}

function Wait-GknomeMenuContinue {
    param([switch]$AllowQuit, [switch]$DisableMouse)

    Write-Host ''
    $cursorY = 0
    try { $cursorY = [int]$Host.UI.RawUI.CursorPosition.Y } catch { }
    $text = if ($AllowQuit) { '[ Continue ]  [ Quit ]' } else { '[ Continue ]' }
    Write-Host $text
    $zones = @(
        (New-GknomeMenuHitZone -Kind 'continue' -X 0 -Y $cursorY -Width 12)
    )
    if ($AllowQuit) { $zones += New-GknomeMenuHitZone -Kind 'cancel' -X 14 -Y $cursorY -Width 8 }

    $session = New-GknomeMenuInputSession -DisableMouse:$DisableMouse
    if (-not [string]::IsNullOrWhiteSpace([string]$session.warning)) { Write-Warning ([string]$session.warning) }
    return Invoke-GknomeMenuInputScope -Session $session -Body {
        param($activeSession)
        while ($true) {
            $event = Read-GknomeMenuInputEvent -Session $activeSession
            if ($null -eq $event) {
                try { [void](Read-Host 'Press Enter to continue') } catch { }
                return $true
            }
            if ([string]$event.kind -eq 'key') {
                if ([int]$event.virtual_key -eq 13) { return $true }
                if ($AllowQuit -and ([int]$event.virtual_key -eq 27 -or [string]$event.character -match '(?i)^q$')) { return $false }
                continue
            }
            if ([string]$event.kind -eq 'mouse-left-down') {
                $zone = Find-GknomeMenuHitZone -HitZones $zones -X ([int]$event.x) -Y ([int]$event.y)
                if ($null -eq $zone) { continue }
                if ([string]$zone.kind -eq 'continue') { return $true }
                if ([string]$zone.kind -eq 'cancel') { return $false }
            }
        }
    }
}

function Invoke-GknomeMenuTextPrompt {
    param(
        [Parameter(Mandatory = $true)][object]$Session,
        [Parameter(Mandatory = $true)][string]$Prompt,
        [scriptblock]$Reader = { param($PromptText) Read-Host $PromptText }
    )

    # Restore ordinary console input before entering a cooked text prompt so
    # mouse records cannot be collected against a frame that is about to change.
    Close-GknomeMenuInputSession -Session $Session
    $value = & $Reader $Prompt
    $replacement = New-GknomeMenuInputSession
    return [pscustomobject][ordered]@{
        value = $value
        session = $replacement
    }
}

Export-ModuleMember -Function @(
    'Get-GknomeMenuMousePolicy',
    'Test-GknomeMenuWindowsConsole',
    'New-GknomeMenuInputEvent',
    'New-GknomeMenuInputSession',
    'Close-GknomeMenuInputSession',
    'Disable-GknomeMenuMouseInput',
    'Invoke-GknomeMenuInputScope',
    'Read-GknomeMenuInputEvent',
    'New-GknomeMenuHitZone',
    'Get-GknomeMenuCursorY',
    'Find-GknomeMenuHitZone',
    'New-GknomeMenuButtonLayout',
    'New-GknomeMenuPageTabLayout',
    'New-GknomeMenuControlLayout',
    'Get-GknomeMenuFirstEnabledActionIndex',
    'Resolve-GknomeMenuInteraction',
    'Wait-GknomeMenuInteraction',
    'Update-GknomeMenuDigitSelection',
    'Wait-GknomeMenuContinue',
    'Invoke-GknomeMenuTextPrompt'
)
