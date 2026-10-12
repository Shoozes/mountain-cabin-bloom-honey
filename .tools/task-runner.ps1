#Requires -Version 5.1

<##
.SYNOPSIS
    Executes a bounded declarative task specification.

.DESCRIPTION
    This runner is the PowerShell compatibility lane for gknome task specs.
    It never invokes an implicit shell, keeps working directories inside the
    project, bounds output and duration, and accepts cancellation through an
    operator-owned file path. Parallel task specs are intentionally rejected
    until output ownership and process-tree proof are complete in both
    PowerShell versions.
##>

[CmdletBinding()]
param(
    [string]$Task = 'task',
    [string]$SpecJson = '',
    [string]$TaskSpecPath = '',
    [string]$TaskSpecRef = '',
    [string]$RepositoryRoot = '',
    [string]$CancellationPath = '',
    [switch]$AsJson
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$script:MaxDepth = 8
$script:MaxChildren = 64
$script:MaxTimeoutMs = 600000
$script:MaxOutputBytes = 16MB
$script:RepoRoot = if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}
else {
    [System.IO.Path]::GetFullPath($RepositoryRoot)
}
if (-not (Test-Path -LiteralPath $script:RepoRoot -PathType Container)) {
    throw "Repository root not found: $script:RepoRoot"
}

$strictJsonPath = Join-Path $PSScriptRoot 'StrictJson.ps1'
if (-not (Test-Path -LiteralPath $strictJsonPath -PathType Leaf)) {
    throw "Strict JSON reader is missing: $strictJsonPath"
}
. $strictJsonPath

function Ensure-TaskJobType {
    if ($env:OS -ne 'Windows_NT') { return }
    if ($null -ne ('GknomeTaskJobV2' -as [type])) { return }
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class GknomeTaskJobV2
{
    private const int JobObjectExtendedLimitInformation = 9;
    private const uint JobObjectLimitKillOnJobClose = 0x2000;

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(IntPtr job, int informationClass, IntPtr information, uint length);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateJobObject(IntPtr job, uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreatePipe(out IntPtr readPipe, out IntPtr writePipe, ref SecurityAttributes attributes, uint size);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool InitializeProcThreadAttributeList(IntPtr attributeList, int attributeCount, int flags, ref IntPtr size);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool UpdateProcThreadAttribute(IntPtr attributeList, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returnSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern void DeleteProcThreadAttributeList(IntPtr attributeList);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreateProcess(
        string applicationName,
        [In, Out] System.Text.StringBuilder commandLine,
        IntPtr processAttributes,
        IntPtr threadAttributes,
        bool inheritHandles,
        uint creationFlags,
        IntPtr environment,
        string currentDirectory,
        ref StartupInfoEx startupInfo,
        out ProcessInformation processInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int standardHandle);

    [StructLayout(LayoutKind.Sequential)]
    private struct IoCounters
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimitInformation
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ExtendedLimitInformation
    {
        public BasicLimitInformation BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SecurityAttributes
    {
        public int Length;
        public IntPtr SecurityDescriptor;
        public int InheritHandle;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfo
    {
        public int cb;
        public string Reserved;
        public string Desktop;
        public string Title;
        public int X;
        public int Y;
        public int XSize;
        public int YSize;
        public int XCountChars;
        public int YCountChars;
        public int FillAttribute;
        public int Flags;
        public short ShowWindow;
        public short Reserved2;
        public IntPtr Reserved2Ptr;
        public IntPtr StdInput;
        public IntPtr StdOutput;
        public IntPtr StdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfoEx
    {
        public StartupInfo StartupInfo;
        public IntPtr AttributeList;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInformation
    {
        public IntPtr Process;
        public IntPtr Thread;
        public int ProcessId;
        public int ThreadId;
    }

    public static IntPtr Create()
    {
        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateJobObject failed.");
        ExtendedLimitInformation limits = new ExtendedLimitInformation();
        limits.BasicLimitInformation.LimitFlags = JobObjectLimitKillOnJobClose;
        int length = Marshal.SizeOf(typeof(ExtendedLimitInformation));
        IntPtr buffer = Marshal.AllocHGlobal(length);
        try
        {
            Marshal.StructureToPtr(limits, buffer, false);
            if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, buffer, (uint)length))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "SetInformationJobObject failed.");
            return job;
        }
        catch
        {
            CloseHandle(job);
            throw;
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    public static bool Terminate(IntPtr job, uint exitCode)
    {
        return TerminateJobObject(job, exitCode);
    }

    public static bool Close(IntPtr job)
    {
        return CloseHandle(job);
    }

    public static GknomeTaskNativeProcessV2 StartProcess(string commandLine, string workingDirectory, IntPtr job)
    {
        if (job == IntPtr.Zero) throw new ArgumentException("A task job handle is required.");
        IntPtr stdoutRead = IntPtr.Zero;
        IntPtr stdoutWrite = IntPtr.Zero;
        IntPtr stderrRead = IntPtr.Zero;
        IntPtr stderrWrite = IntPtr.Zero;
        IntPtr attributeList = IntPtr.Zero;
        IntPtr attributeSize = IntPtr.Zero;
        IntPtr jobList = IntPtr.Zero;
        ProcessInformation processInformation = new ProcessInformation();
        try
        {
            SecurityAttributes pipeAttributes = new SecurityAttributes();
            pipeAttributes.Length = Marshal.SizeOf(typeof(SecurityAttributes));
            pipeAttributes.InheritHandle = 1;
            if (!CreatePipe(out stdoutRead, out stdoutWrite, ref pipeAttributes, 0))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "CreatePipe stdout failed.");
            if (!SetHandleInformation(stdoutRead, 1, 0))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "SetHandleInformation stdout failed.");
            if (!CreatePipe(out stderrRead, out stderrWrite, ref pipeAttributes, 0))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "CreatePipe stderr failed.");
            if (!SetHandleInformation(stderrRead, 1, 0))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "SetHandleInformation stderr failed.");

            InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref attributeSize);
            if (attributeSize == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(), "InitializeProcThreadAttributeList sizing failed.");
            attributeList = Marshal.AllocHGlobal(attributeSize);
            if (!InitializeProcThreadAttributeList(attributeList, 1, 0, ref attributeSize))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "InitializeProcThreadAttributeList failed.");
            jobList = Marshal.AllocHGlobal(IntPtr.Size);
            Marshal.WriteIntPtr(jobList, job);
            IntPtr jobAttribute = new IntPtr(0x0002000D);
            if (!UpdateProcThreadAttribute(attributeList, 0, jobAttribute, jobList, (IntPtr)IntPtr.Size, IntPtr.Zero, IntPtr.Zero))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "UpdateProcThreadAttribute job list failed.");

            StartupInfoEx startup = new StartupInfoEx();
            startup.StartupInfo.cb = Marshal.SizeOf(typeof(StartupInfoEx));
            startup.StartupInfo.Flags = 0x00000100;
            startup.StartupInfo.StdInput = GetStdHandle(-10);
            startup.StartupInfo.StdOutput = stdoutWrite;
            startup.StartupInfo.StdError = stderrWrite;
            startup.AttributeList = attributeList;
            StringBuilder mutableCommandLine = new StringBuilder(commandLine);
            uint flags = 0x00080000 | 0x08000000 | 0x00000400;
            if (!CreateProcess(null, mutableCommandLine, IntPtr.Zero, IntPtr.Zero, true, flags, IntPtr.Zero, workingDirectory, ref startup, out processInformation))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateProcess failed.");
            return new GknomeTaskNativeProcessV2(processInformation.Process, processInformation.ProcessId, stdoutRead, stderrRead);
        }
        finally
        {
            if (attributeList != IntPtr.Zero)
            {
                DeleteProcThreadAttributeList(attributeList);
                Marshal.FreeHGlobal(attributeList);
            }
            if (jobList != IntPtr.Zero) Marshal.FreeHGlobal(jobList);
            if (processInformation.Thread != IntPtr.Zero) CloseHandle(processInformation.Thread);
            if (stdoutWrite != IntPtr.Zero) CloseHandle(stdoutWrite);
            if (stderrWrite != IntPtr.Zero) CloseHandle(stderrWrite);
            if (processInformation.Process == IntPtr.Zero)
            {
                if (stdoutRead != IntPtr.Zero) CloseHandle(stdoutRead);
                if (stderrRead != IntPtr.Zero) CloseHandle(stderrRead);
            }
        }
    }
}

public sealed class GknomeTaskNativeProcessV2
{
    private const uint WaitTimeout = 258;
    private const uint StillActive = 259;
    private static bool CloseHandle(IntPtr handle)
    {
        return handle == IntPtr.Zero || NativeCloseHandle(handle);
    }

    [DllImport("kernel32.dll", EntryPoint = "CloseHandle", SetLastError = true)]
    private static extern bool NativeCloseHandle(IntPtr handle);

    [DllImport("kernel32.dll", EntryPoint = "WaitForSingleObject", SetLastError = true)]
    private static extern uint NativeWaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", EntryPoint = "GetExitCodeProcess", SetLastError = true)]
    private static extern bool NativeGetExitCodeProcess(IntPtr process, out uint exitCode);

    public readonly IntPtr ProcessHandle;
    public readonly int ProcessId;
    public readonly IntPtr StdoutReadHandle;
    public readonly IntPtr StderrReadHandle;

    public GknomeTaskNativeProcessV2(IntPtr processHandle, int processId, IntPtr stdoutReadHandle, IntPtr stderrReadHandle)
    {
        ProcessHandle = processHandle;
        ProcessId = processId;
        StdoutReadHandle = stdoutReadHandle;
        StderrReadHandle = stderrReadHandle;
    }

    public bool HasExited
    {
        get { return NativeWaitForSingleObject(ProcessHandle, 0) != WaitTimeout; }
    }

    public bool Wait(int milliseconds)
    {
        return NativeWaitForSingleObject(ProcessHandle, (uint)milliseconds) != WaitTimeout;
    }

    public int ExitCode
    {
        get
        {
            uint code;
            if (!NativeGetExitCodeProcess(ProcessHandle, out code)) throw new Win32Exception(Marshal.GetLastWin32Error(), "GetExitCodeProcess failed.");
            return code == StillActive ? -1 : unchecked((int)code);
        }
    }

    public void Close()
    {
        CloseHandle(ProcessHandle);
    }
}
'@
}

function New-TaskJob {
    if ($env:OS -ne 'Windows_NT') { return [IntPtr]::Zero }
    Ensure-TaskJobType
    return [GknomeTaskJobV2]::Create()
}

function New-TaskNativeReadStream {
    param([Parameter(Mandatory = $true)][IntPtr]$Handle)

    $safeHandle = New-Object Microsoft.Win32.SafeHandles.SafeFileHandle($Handle, $true)
    return New-Object System.IO.FileStream($safeHandle, [System.IO.FileAccess]::Read, 8192, $false)
}

function Test-TaskProcessExited {
    param(
        [AllowNull()][object]$NativeProcess,
        [AllowNull()][System.Diagnostics.Process]$ManagedProcess
    )

    if ($null -ne $NativeProcess) { return [bool]$NativeProcess.HasExited }
    return [bool]$ManagedProcess.HasExited
}

function Get-TaskProcessExitCode {
    param(
        [AllowNull()][object]$NativeProcess,
        [AllowNull()][System.Diagnostics.Process]$ManagedProcess
    )

    if ($null -ne $NativeProcess) { return [int]$NativeProcess.ExitCode }
    return [int]$ManagedProcess.ExitCode
}

function Get-PropertyValue {
    param([object]$Object, [Parameter(Mandatory = $true)][string]$Name, [object]$Default = $null)
    if ($null -eq $Object) { return $Default }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $Default }
    if ($property.Value -is [System.Array]) { return ,$property.Value }
    return $property.Value
}

function Get-BoundedInt {
    param([object]$Value, [int]$Default, [int]$Minimum, [int]$Maximum, [string]$Label)
    if ($null -eq $Value) { return $Default }
    $parsed = 0
    if (-not [int]::TryParse([string]$Value, [ref]$parsed) -or $parsed -lt $Minimum -or $parsed -gt $Maximum) {
        throw "$Label must be between $Minimum and $Maximum."
    }
    return $parsed
}

function Test-TaskSpecInteger {
    param([object]$Value)
    return ($Value -is [byte] -or $Value -is [sbyte] -or $Value -is [int16] -or $Value -is [uint16] -or $Value -is [int32] -or $Value -is [uint32] -or $Value -is [int64] -or $Value -is [uint64])
}

function Test-TaskSpecArray {
    param([object]$Value)
    return ($Value -is [System.Array])
}

function Assert-TaskSpecObjectShape {
    param(
        [Parameter(Mandatory = $true)][object]$Value,
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string[]]$Allowed,
        [Parameter(Mandatory = $true)][string[]]$Required
    )

    if ($Value -is [string] -or $Value -is [System.Array] -or $null -eq $Value.PSObject) {
        throw "$Label must be a JSON object."
    }
    $names = @($Value.PSObject.Properties | ForEach-Object { [string]$_.Name })
    foreach ($name in $names) {
        if ($Allowed -cnotcontains $name) { throw "$Label contains an unsupported property: $name" }
    }
    foreach ($name in $Required) {
        if ($names -cnotcontains $name) { throw "$Label is missing required property: $name" }
    }
}

function Assert-TaskSpecString {
    param(
        [object]$Value,
        [Parameter(Mandatory = $true)][string]$Label,
        [int]$MinimumLength = 0,
        [Parameter(Mandatory = $true)][int]$MaximumLength,
        [switch]$RequireNonWhitespace
    )

    if ($Value -isnot [string] -or $Value.Length -lt $MinimumLength -or $Value.Length -gt $MaximumLength) {
        throw "$Label must be a string between $MinimumLength and $MaximumLength characters."
    }
    if ($RequireNonWhitespace -and [string]::IsNullOrWhiteSpace($Value)) { throw "$Label must not be blank." }
    if ($Value.IndexOf([char]0) -ge 0) { throw "$Label cannot contain a null character." }
}

function Assert-TaskSpecRelativePath {
    param([object]$Value, [Parameter(Mandatory = $true)][string]$Label)

    Assert-TaskSpecString -Value $Value -Label $Label -MinimumLength 1 -MaximumLength 260 -RequireNonWhitespace
    $path = [string]$Value
    if ([System.IO.Path]::IsPathRooted($path) -or $path.StartsWith('/') -or $path.StartsWith('\') -or $path -match '^[A-Za-z]:' -or $path -match '(^|[\\/])\.\.([\\/]|$)') {
        throw "$Label must be relative to the project root without traversal."
    }
}

function Assert-TaskSpecBoundedInteger {
    param(
        [object]$Value,
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][int64]$Minimum,
        [Parameter(Mandatory = $true)][int64]$Maximum
    )

    if (-not (Test-TaskSpecInteger -Value $Value) -or [int64]$Value -lt $Minimum -or [int64]$Value -gt $Maximum) {
        throw "$Label must be an integer between $Minimum and $Maximum."
    }
}

function Assert-TaskSpecContract {
    param(
        [Parameter(Mandatory = $true)][object]$Spec,
        [int]$Depth = 0,
        [string]$Label = 'Task specification'
    )

    if ($Depth -gt $script:MaxDepth) { throw "$Label exceeds the maximum nesting depth." }
    if ($Spec -is [string] -or $Spec -is [System.Array] -or $null -eq $Spec.PSObject) { throw "$Label must be a JSON object." }
    $kindValue = Get-PropertyValue -Object $Spec -Name 'kind' -Default $null
    if ($kindValue -isnot [string]) { throw "$Label kind must be a string." }
    $kind = [string]$kindValue
    switch -CaseSensitive ($kind) {
        'process' { $allowed = @('kind', 'program', 'args', 'working_directory', 'timeout_ms', 'max_output_bytes'); $required = @('kind', 'program'); break }
        'check' { $allowed = @('kind', 'program', 'args', 'working_directory', 'timeout_ms', 'max_output_bytes'); $required = @('kind', 'program'); break }
        'open' { $allowed = @('kind', 'path'); $required = @('kind', 'path'); break }
        'sequence' { $allowed = @('kind', 'tasks'); $required = @('kind', 'tasks'); break }
        'recipe' { $allowed = @('kind', 'name', 'tasks'); $required = @('kind', 'name', 'tasks'); break }
        default { throw "$Label has unsupported kind '$kind'." }
    }
    Assert-TaskSpecObjectShape -Value $Spec -Label $Label -Allowed $allowed -Required $required

    if ($kind -in @('process', 'check')) {
        Assert-TaskSpecString -Value (Get-PropertyValue -Object $Spec -Name 'program' -Default $null) -Label "$Label program" -MinimumLength 1 -MaximumLength 260 -RequireNonWhitespace
        $argsProperty = $Spec.PSObject.Properties['args']
        if ($null -ne $argsProperty) {
            if (-not (Test-TaskSpecArray -Value $argsProperty.Value) -or @($argsProperty.Value).Count -gt 128) { throw "$Label args must be a JSON array with at most 128 values." }
            $index = 0
            foreach ($argument in @($argsProperty.Value)) {
                Assert-TaskSpecString -Value $argument -Label "$Label args[$index]" -MaximumLength 4096
                $index++
            }
        }
        $workingDirectoryProperty = $Spec.PSObject.Properties['working_directory']
        if ($null -ne $workingDirectoryProperty) { Assert-TaskSpecRelativePath -Value $workingDirectoryProperty.Value -Label "$Label working_directory" }
        $timeoutProperty = $Spec.PSObject.Properties['timeout_ms']
        if ($null -ne $timeoutProperty) { Assert-TaskSpecBoundedInteger -Value $timeoutProperty.Value -Label "$Label timeout_ms" -Minimum 1 -Maximum $script:MaxTimeoutMs }
        $outputProperty = $Spec.PSObject.Properties['max_output_bytes']
        if ($null -ne $outputProperty) { Assert-TaskSpecBoundedInteger -Value $outputProperty.Value -Label "$Label max_output_bytes" -Minimum 1 -Maximum $script:MaxOutputBytes }
        return
    }

    if ($kind -eq 'open') {
        Assert-TaskSpecRelativePath -Value (Get-PropertyValue -Object $Spec -Name 'path' -Default $null) -Label "$Label path"
        return
    }

    if ($kind -eq 'recipe') {
        Assert-TaskSpecString -Value (Get-PropertyValue -Object $Spec -Name 'name' -Default $null) -Label "$Label name" -MinimumLength 1 -MaximumLength 120 -RequireNonWhitespace
    }
    $tasks = Get-PropertyValue -Object $Spec -Name 'tasks' -Default $null
    if (-not (Test-TaskSpecArray -Value $tasks) -or @($tasks).Count -lt 1 -or @($tasks).Count -gt $script:MaxChildren) {
        throw "$Label tasks must be a JSON array with between 1 and $($script:MaxChildren) entries."
    }
    $index = 0
    foreach ($child in @($tasks)) {
        Assert-TaskSpecContract -Spec $child -Depth ($Depth + 1) -Label "$Label tasks[$index]"
        $index++
    }
}

function Assert-TaskRegistryContract {
    param([Parameter(Mandatory = $true)][object]$Registry)

    Assert-TaskSpecObjectShape -Value $Registry -Label 'Task registry' -Allowed @('schema', 'tasks') -Required @('schema', 'tasks')
    if ([string](Get-PropertyValue -Object $Registry -Name 'schema' -Default '') -cne 'gknome_task_registry_v1') { throw 'Unsupported task registry schema.' }
    $tasks = Get-PropertyValue -Object $Registry -Name 'tasks' -Default $null
    if (-not (Test-TaskSpecArray -Value $tasks) -or @($tasks).Count -gt 256) { throw 'Task registry tasks must be a JSON array with at most 256 entries.' }
    $ids = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::Ordinal)
    foreach ($entry in @($tasks)) {
        Assert-TaskSpecObjectShape -Value $entry -Label 'Task registry entry' -Allowed @('id', 'description', 'spec') -Required @('id', 'description', 'spec')
        $id = Get-PropertyValue -Object $entry -Name 'id' -Default $null
        Assert-TaskSpecString -Value $id -Label 'Task registry entry id' -MinimumLength 1 -MaximumLength 96
        if ([string]$id -notmatch '^[a-z0-9][a-z0-9.-]*$' -or -not $ids.Add([string]$id)) { throw "Task registry contains an invalid or duplicate task id: $id" }
        Assert-TaskSpecString -Value (Get-PropertyValue -Object $entry -Name 'description' -Default $null) -Label "Task registry entry '$id' description" -MaximumLength 500
        Assert-TaskSpecContract -Spec (Get-PropertyValue -Object $entry -Name 'spec' -Default $null) -Label "Task registry entry '$id' spec"
    }
}

function Test-IsReparsePath {
    param([Parameter(Mandatory = $true)][string]$Path)
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    return (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)
}

function Assert-NoReparsePath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $root = [System.IO.Path]::GetFullPath($script:RepoRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $current = [System.IO.Path]::GetFullPath($Path)
    while ($true) {
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
            if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Task path is reparse-backed: $Path"
            }
        }
        if ($current -eq $root) { break }
        $parent = Split-Path -Parent $current
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $current) { break }
        $current = $parent
    }
}

function Resolve-ProjectPath {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [switch]$MustExist,
        [switch]$AllowDirectory
    )
    if ([string]::IsNullOrWhiteSpace($RelativePath) -or [System.IO.Path]::IsPathRooted($RelativePath) -or $RelativePath -match '(^|[\\/])\.\.([\\/]|$)') {
        throw "Task path must be a non-empty project-relative path: $RelativePath"
    }
    $root = [System.IO.Path]::GetFullPath($script:RepoRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $RelativePath))
    if (-not $full.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -and $full -ne $root) {
        throw "Task path escapes the project root: $RelativePath"
    }
    Assert-NoReparsePath -Path $full
    if ($MustExist -and -not (Test-Path -LiteralPath $full)) { throw "Task path not found: $RelativePath" }
    if (Test-Path -LiteralPath $full) {
        if (Test-IsReparsePath -Path $full) { throw "Task path is reparse-backed: $RelativePath" }
        $item = Get-Item -LiteralPath $full -Force
        if (-not $AllowDirectory -and $item.PSIsContainer) { throw "Task path is a directory: $RelativePath" }
    }
    return $full
}

function ConvertTo-ProcessArgument {
    param([AllowEmptyString()][string]$Value)
    if ($null -eq $Value) { return '""' }
    if ($Value -notmatch '[\s"]') { return $Value }
    $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}

function Join-ProcessArguments {
    param([string[]]$Arguments = @())
    return (@($Arguments | ForEach-Object { ConvertTo-ProcessArgument -Value ([string]$_) }) -join ' ')
}

function Stop-ProcessTree {
    param(
        [Parameter(Mandatory = $true)][int]$ProcessId,
        [IntPtr]$JobHandle = [IntPtr]::Zero
    )
    $pidValue = $ProcessId
    if ($env:OS -eq 'Windows_NT') {
        if ($JobHandle -ne [IntPtr]::Zero) {
            try {
                if ([GknomeTaskJobV2]::Terminate($JobHandle, 1)) { return 'job-object' }
                return "job-object-failed:$([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
            }
            catch { return 'job-object-failed' }
        }
        try {
            & taskkill.exe /PID $pidValue /T /F *> $null
            if ($LASTEXITCODE -eq 0) { return 'taskkill-tree' }
            return "taskkill-failed:$LASTEXITCODE+direct-child"
        }
        catch { return 'taskkill-unavailable+direct-child' }
    }
    try {
        & kill -KILL ("-$pidValue") *> $null
        if ($LASTEXITCODE -eq 0) { return 'process-group' }
        return "process-group-failed:$LASTEXITCODE+direct-child"
    }
    catch { return 'process-group-unavailable+direct-child' }
}

function Receive-ProcessStream {
    param(
        [Parameter(Mandatory = $true)][ref]$ReadTask,
        [Parameter(Mandatory = $true)][ref]$ReadBuffer,
        [Parameter(Mandatory = $true)][ref]$Captured,
        [Parameter(Mandatory = $true)][ref]$CapturedLength,
        [Parameter(Mandatory = $true)][ref]$Truncated,
        [Parameter(Mandatory = $true)][ref]$ReadFailed,
        [Parameter(Mandatory = $true)][ref]$EndOfStream,
        [Parameter(Mandatory = $true)][object]$Stream,
        [Parameter(Mandatory = $true)][int]$MaximumBytes,
        [int]$MaximumChunks = 8
    )
    $handled = $false
    $chunks = 0
    while ($null -ne $ReadTask.Value -and $ReadTask.Value.IsCompleted -and $chunks -lt $MaximumChunks) {
        $handled = $true
        $chunks++
        try {
            $count = [int]$ReadTask.Value.GetAwaiter().GetResult()
        }
        catch {
            $ReadTask.Value = $null
            $ReadFailed.Value = $true
            break
        }
        if ($count -le 0) {
            $ReadTask.Value = $null
            $EndOfStream.Value = $true
            break
        }
        $remaining = $MaximumBytes - [int]$CapturedLength.Value
        if ($remaining -gt 0) {
            $copyCount = [Math]::Min($remaining, $count)
            [Array]::Copy($ReadBuffer.Value, 0, $Captured.Value, $CapturedLength.Value, $copyCount)
            $CapturedLength.Value = [int]$CapturedLength.Value + $copyCount
            if ($copyCount -lt $count) { $Truncated.Value = $true }
        }
        else { $Truncated.Value = $true }
        # Continue issuing reads after the capture bound is full so a noisy
        # child cannot block on a full redirected pipe.
        try { $ReadTask.Value = $Stream.ReadAsync($ReadBuffer.Value, 0, $ReadBuffer.Value.Length) }
        catch {
            $ReadTask.Value = $null
            $ReadFailed.Value = $true
            break
        }
    }
    return $handled
}

function New-TaskResult {
    param(
        [Parameter(Mandatory = $true)][string]$TaskName,
        [Parameter(Mandatory = $true)][string]$Kind,
        [Parameter(Mandatory = $true)][string]$Status,
        [bool]$Success = $false,
        [bool]$Cancelled = $false,
        [bool]$TimedOut = $false,
        [int]$ExitCode = -1,
        [int64]$DurationMs = 0,
        [string]$Stdout = '',
        [string]$Stderr = '',
        [hashtable]$Outputs = @{}
    )
    return [pscustomobject][ordered]@{
        schema = 'gknome_task_result_v1'
        task = $TaskName
        kind = $Kind
        status = $Status
        success = [bool]$Success
        cancelled = [bool]$Cancelled
        timed_out = [bool]$TimedOut
        exit_code = $ExitCode
        duration_ms = $DurationMs
        stdout = [string]$Stdout
        stderr = [string]$Stderr
        outputs = [pscustomobject]$Outputs
    }
}

function Test-CancellationRequested {
    if ([string]::IsNullOrWhiteSpace($CancellationPath)) { return $false }
    return (Test-Path -LiteralPath $CancellationPath -PathType Leaf)
}

function Invoke-ProcessTask {
    param(
        [Parameter(Mandatory = $true)][string]$TaskName,
        [Parameter(Mandatory = $true)][object]$Spec,
        [int]$Depth = 0
    )
    $kind = [string](Get-PropertyValue -Object $Spec -Name 'kind' -Default 'process')
    if (Test-CancellationRequested) {
        return New-TaskResult -TaskName $TaskName -Kind $kind -Status 'cancelled' -Cancelled $true -Outputs @{ cancellation_observed = 'before-launch' }
    }
    $program = [string](Get-PropertyValue -Object $Spec -Name 'program' -Default '')
    $arguments = @((Get-PropertyValue -Object $Spec -Name 'args' -Default @()) | ForEach-Object { [string]$_ })
    if ([string]::IsNullOrWhiteSpace($program) -or $program.IndexOf([char]0) -ge 0 -or $program.Length -gt 4096 -or $arguments.Count -gt 128) { throw "Task '$TaskName' has an invalid process specification." }
    foreach ($argument in $arguments) {
        if ($argument.IndexOf([char]0) -ge 0 -or $argument.Length -gt 4096) { throw "Task '$TaskName' has an unsafe process argument." }
    }
    $timeoutMs = Get-BoundedInt -Value (Get-PropertyValue -Object $Spec -Name 'timeout_ms' -Default $null) -Default $script:MaxTimeoutMs -Minimum 1 -Maximum $script:MaxTimeoutMs -Label "Task '$TaskName' timeout_ms"
    $maxOutputBytes = Get-BoundedInt -Value (Get-PropertyValue -Object $Spec -Name 'max_output_bytes' -Default $null) -Default 1048576 -Minimum 1 -Maximum $script:MaxOutputBytes -Label "Task '$TaskName' max_output_bytes"
    $workingDirectory = $script:RepoRoot
    $workingDirectoryRelative = [string](Get-PropertyValue -Object $Spec -Name 'working_directory' -Default '')
    if (-not [string]::IsNullOrWhiteSpace($workingDirectoryRelative)) {
        $workingDirectory = Resolve-ProjectPath -RelativePath $workingDirectoryRelative -MustExist -AllowDirectory
    }

    $startInfo = $null
    $process = $null
    $nativeProcess = $null
    $started = [DateTime]::UtcNow
    $stdoutTask = $null
    $stderrTask = $null
    $stdoutStream = $null
    $stderrStream = $null
    $stdoutReadBuffer = New-Object byte[] 8192
    $stderrReadBuffer = New-Object byte[] 8192
    $stdoutCaptured = New-Object byte[] $maxOutputBytes
    $stderrCaptured = New-Object byte[] $maxOutputBytes
    $stdoutLength = 0
    $stderrLength = 0
    $stdoutTruncated = $false
    $stderrTruncated = $false
    $stdoutReadFailed = $false
    $stderrReadFailed = $false
    $stdoutEndOfStream = $false
    $stderrEndOfStream = $false
    $processStarted = $false
    $processId = 0
    $jobHandle = [IntPtr]::Zero
    $ownershipCleanupFailed = $false
    try {
        $jobHandle = New-TaskJob
        if ($env:OS -eq 'Windows_NT') {
            $commandLine = (ConvertTo-ProcessArgument -Value $program) + ' ' + (Join-ProcessArguments -Arguments $arguments)
            $nativeProcess = [GknomeTaskJobV2]::StartProcess($commandLine, $workingDirectory, $jobHandle)
            $processId = [int]$nativeProcess.ProcessId
            $processStarted = $true
            $stdoutStream = New-TaskNativeReadStream -Handle ([IntPtr]$nativeProcess.StdoutReadHandle)
            $stderrStream = New-TaskNativeReadStream -Handle ([IntPtr]$nativeProcess.StderrReadHandle)
        }
        else {
            $startInfo = New-Object System.Diagnostics.ProcessStartInfo
            $startInfo.FileName = $program
            $startInfo.Arguments = Join-ProcessArguments -Arguments $arguments
            $startInfo.WorkingDirectory = $workingDirectory
            $startInfo.UseShellExecute = $false
            $startInfo.CreateNoWindow = $true
            $startInfo.RedirectStandardOutput = $true
            $startInfo.RedirectStandardError = $true
            $process = New-Object System.Diagnostics.Process
            $process.StartInfo = $startInfo
            if (-not $process.Start()) { throw "Task '$TaskName' process did not start." }
            $processId = [int]$process.Id
            $processStarted = $true
            $stdoutStream = $process.StandardOutput.BaseStream
            $stderrStream = $process.StandardError.BaseStream
        }
        # Poll .NET stream tasks from the owning PowerShell runspace. This
        # avoids scriptblock callbacks on worker threads and keeps each stream
        # in a fixed-size byte buffer while the child continues to drain.
        $stdoutTask = $stdoutStream.ReadAsync($stdoutReadBuffer, 0, $stdoutReadBuffer.Length)
        $stderrTask = $stderrStream.ReadAsync($stderrReadBuffer, 0, $stderrReadBuffer.Length)
        # This hook exists only for the local regression fixture that proves a
        # failed required stream read cannot become a successful task result.
        if ([string]$env:GKNOME_TEST_FAIL_CAPTURE_STREAM -eq 'stdout') {
            $stdoutReadFailed = $true
            $stdoutTask = $null
        }
        $cancelled = $false
        $timedOut = $false
        $termination = 'not-needed'
        while (-not (Test-TaskProcessExited -NativeProcess $nativeProcess -ManagedProcess $process)) {
            $stdoutDidWork = Receive-ProcessStream -ReadTask ([ref]$stdoutTask) -ReadBuffer ([ref]$stdoutReadBuffer) -Captured ([ref]$stdoutCaptured) -CapturedLength ([ref]$stdoutLength) -Truncated ([ref]$stdoutTruncated) -ReadFailed ([ref]$stdoutReadFailed) -EndOfStream ([ref]$stdoutEndOfStream) -Stream $stdoutStream -MaximumBytes $maxOutputBytes
            $stderrDidWork = Receive-ProcessStream -ReadTask ([ref]$stderrTask) -ReadBuffer ([ref]$stderrReadBuffer) -Captured ([ref]$stderrCaptured) -CapturedLength ([ref]$stderrLength) -Truncated ([ref]$stderrTruncated) -ReadFailed ([ref]$stderrReadFailed) -EndOfStream ([ref]$stderrEndOfStream) -Stream $stderrStream -MaximumBytes $maxOutputBytes
            if (Test-CancellationRequested) { $cancelled = $true; $termination = Stop-ProcessTree -ProcessId $processId -JobHandle $jobHandle; break }
            if (([DateTime]::UtcNow - $started).TotalMilliseconds -ge $timeoutMs) { $timedOut = $true; $termination = Stop-ProcessTree -ProcessId $processId -JobHandle $jobHandle; break }
            if (-not $stdoutDidWork -and -not $stderrDidWork) { Start-Sleep -Milliseconds 10 }
        }
        if (-not (Test-TaskProcessExited -NativeProcess $nativeProcess -ManagedProcess $process)) {
            if ($null -ne $nativeProcess) { [void]$nativeProcess.Wait(5000) } else { [void]$process.WaitForExit(5000) }
            if (-not (Test-TaskProcessExited -NativeProcess $nativeProcess -ManagedProcess $process)) {
                if ($jobHandle -ne [IntPtr]::Zero) {
                    if (-not [GknomeTaskJobV2]::Terminate($jobHandle, 1)) { $ownershipCleanupFailed = $true }
                }
                else { try { $process.Kill() } catch { } }
                if ($null -ne $nativeProcess) { [void]$nativeProcess.Wait(2000) } else { [void]$process.WaitForExit(2000) }
            }
        }
        if ((Test-TaskProcessExited -NativeProcess $nativeProcess -ManagedProcess $process) -and $jobHandle -ne [IntPtr]::Zero -and -not $cancelled -and -not $timedOut) {
            if ([GknomeTaskJobV2]::Terminate($jobHandle, 0)) { $termination = 'job-object' } else { $ownershipCleanupFailed = $true; $termination = 'job-object-failed' }
        }
        $drainUntil = [DateTime]::UtcNow.AddSeconds(5)
        while (($null -ne $stdoutTask -or $null -ne $stderrTask) -and [DateTime]::UtcNow -lt $drainUntil) {
            $stdoutDidWork = Receive-ProcessStream -ReadTask ([ref]$stdoutTask) -ReadBuffer ([ref]$stdoutReadBuffer) -Captured ([ref]$stdoutCaptured) -CapturedLength ([ref]$stdoutLength) -Truncated ([ref]$stdoutTruncated) -ReadFailed ([ref]$stdoutReadFailed) -EndOfStream ([ref]$stdoutEndOfStream) -Stream $stdoutStream -MaximumBytes $maxOutputBytes
            $stderrDidWork = Receive-ProcessStream -ReadTask ([ref]$stderrTask) -ReadBuffer ([ref]$stderrReadBuffer) -Captured ([ref]$stderrCaptured) -CapturedLength ([ref]$stderrLength) -Truncated ([ref]$stderrTruncated) -ReadFailed ([ref]$stderrReadFailed) -EndOfStream ([ref]$stderrEndOfStream) -Stream $stderrStream -MaximumBytes $maxOutputBytes
            if (-not $stdoutDidWork -and -not $stderrDidWork -and ($null -ne $stdoutTask -or $null -ne $stderrTask)) { Start-Sleep -Milliseconds 5 }
        }
        $stdoutReady = [bool]$stdoutEndOfStream
        $stderrReady = [bool]$stderrEndOfStream
        $stdoutText = [System.Text.Encoding]::UTF8.GetString($stdoutCaptured, 0, $stdoutLength)
        $stderrText = [System.Text.Encoding]::UTF8.GetString($stderrCaptured, 0, $stderrLength)
        if (-not $stdoutReady) { $stdoutText += "`n[output capture did not complete before the runner bound expired]" }
        if (-not $stderrReady) { $stderrText += "`n[error capture did not complete before the runner bound expired]" }
        $exitCode = -1
        if (Test-TaskProcessExited -NativeProcess $nativeProcess -ManagedProcess $process) { $exitCode = Get-TaskProcessExitCode -NativeProcess $nativeProcess -ManagedProcess $process }
        $captureFailed = $stdoutReadFailed -or $stderrReadFailed
        $captureIncomplete = (-not $stdoutReady) -or (-not $stderrReady)
        $status = if ($cancelled) { 'cancelled' } elseif ($timedOut) { 'timed-out' } elseif ($ownershipCleanupFailed -or $termination -match 'failed') { 'ownership-failed' } elseif ($captureFailed) { 'capture-failed' } elseif ($captureIncomplete) { 'capture-incomplete' } elseif ($exitCode -eq 0) { 'pass' } else { 'failed' }
        return New-TaskResult -TaskName $TaskName -Kind $kind -Status $status -Success ($status -eq 'pass') -Cancelled $cancelled -TimedOut $timedOut -ExitCode $exitCode -DurationMs ([int64](([DateTime]::UtcNow - $started).TotalMilliseconds)) -Stdout $stdoutText -Stderr $stderrText -Outputs @{ process_tree_termination = $termination; process_ownership = if ($jobHandle -ne [IntPtr]::Zero) { 'job-object' } else { 'platform-fallback' }; process_ownership_established = ($jobHandle -ne [IntPtr]::Zero); stdout_truncated = [bool]$stdoutTruncated; stderr_truncated = [bool]$stderrTruncated; stdout_capture_complete = [bool]$stdoutReady; stderr_capture_complete = [bool]$stderrReady; stdout_capture_failed = [bool]$stdoutReadFailed; stderr_capture_failed = [bool]$stderrReadFailed }
    }
    catch {
        if ($processStarted -and -not (Test-TaskProcessExited -NativeProcess $nativeProcess -ManagedProcess $process)) {
            [void](Stop-ProcessTree -ProcessId $processId -JobHandle $jobHandle)
        }
        throw
    }
    finally {
        if ($null -ne $stdoutStream) { try { $stdoutStream.Dispose() } catch { } }
        if ($null -ne $stderrStream) { try { $stderrStream.Dispose() } catch { } }
        if ($jobHandle -ne [IntPtr]::Zero) {
            try { [void][GknomeTaskJobV2]::Terminate($jobHandle, 1); [void][GknomeTaskJobV2]::Close($jobHandle) } catch { }
        }
        if ($null -ne $nativeProcess) { try { $nativeProcess.Close() } catch { } }
        if ($null -ne $process) { $process.Dispose() }
    }
}

function Invoke-TaskSpec {
    param([Parameter(Mandatory = $true)][string]$TaskName, [Parameter(Mandatory = $true)][object]$Spec, [int]$Depth = 0)
    if ($Depth -gt $script:MaxDepth) { throw "Task '$TaskName' exceeds the maximum nesting depth." }
    $kind = [string](Get-PropertyValue -Object $Spec -Name 'kind' -Default '')
    switch ($kind) {
        'process' { return Invoke-ProcessTask -TaskName $TaskName -Spec $Spec -Depth $Depth }
        'check' { return Invoke-ProcessTask -TaskName $TaskName -Spec $Spec -Depth $Depth }
        'open' {
            $path = Resolve-ProjectPath -RelativePath ([string](Get-PropertyValue -Object $Spec -Name 'path' -Default '')) -MustExist
            if ($env:OS -eq 'Windows_NT') { Start-Process -FilePath $path | Out-Null }
            elseif ($null -ne (Get-Command xdg-open -ErrorAction SilentlyContinue)) { & xdg-open $path | Out-Null }
            else { throw "No supported file opener is available for task '$TaskName'." }
            return New-TaskResult -TaskName $TaskName -Kind $kind -Status 'pass' -Success $true -Outputs @{ path = $path }
        }
        'sequence' {
            $children = @((Get-PropertyValue -Object $Spec -Name 'tasks' -Default @()))
            if ($children.Count -eq 0 -or $children.Count -gt $script:MaxChildren) { throw "Task '$TaskName' has an invalid sequence." }
            $results = New-Object System.Collections.Generic.List[object]
            foreach ($child in $children) {
                $childName = "$TaskName.$($results.Count + 1)"
                $childResult = Invoke-TaskSpec -TaskName $childName -Spec $child -Depth ($Depth + 1)
                $results.Add($childResult)
                if (-not $childResult.success) {
                    return New-TaskResult -TaskName $TaskName -Kind $kind -Status ([string]$childResult.status) -Success $false -Cancelled ([bool]$childResult.cancelled) -TimedOut ([bool]$childResult.timed_out) -ExitCode ([int]$childResult.exit_code) -Stdout ([string]$childResult.stdout) -Stderr ([string]$childResult.stderr) -Outputs @{ children = @($results.ToArray()) }
                }
            }
            return New-TaskResult -TaskName $TaskName -Kind $kind -Status 'pass' -Success $true -Outputs @{ children = @($results.ToArray()) }
        }
        'recipe' {
            $name = [string](Get-PropertyValue -Object $Spec -Name 'name' -Default '')
            if ([string]::IsNullOrWhiteSpace($name)) { throw "Task '$TaskName' recipe name is required." }
            $recipeTasks = Get-PropertyValue -Object $Spec -Name 'tasks' -Default @()
            $result = Invoke-TaskSpec -TaskName $TaskName -Spec ([pscustomobject]@{ kind = 'sequence'; tasks = $recipeTasks }) -Depth $Depth
            $result.kind = 'recipe'
            $result.outputs | Add-Member -NotePropertyName recipe -NotePropertyValue $name -Force
            return $result
        }
        default { throw "Task '$TaskName' has unsupported kind '$kind'." }
    }
}

function Read-TaskSpecRegistry {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Task registry not found: $Path" }
    $registry = Read-StrictJsonFile -Path $Path -MaxBytes 1048576
    Assert-TaskRegistryContract -Registry $registry
    return $registry
}

function Resolve-TaskRegistryPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    $root = [System.IO.Path]::GetFullPath($script:RepoRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $full = if ([System.IO.Path]::IsPathRooted($Path)) {
        [System.IO.Path]::GetFullPath($Path)
    }
    else {
        [System.IO.Path]::GetFullPath((Join-Path $root $Path))
    }
    if (-not $full.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -and $full -ne $root) { throw 'Task registry must remain inside the project root.' }
    Assert-NoReparsePath -Path $full
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw "Task registry not found: $full" }
    if (Test-IsReparsePath -Path $full) { throw 'Task registry cannot be reparse-backed.' }
    return $full
}

function Resolve-RequestedSpec {
    if (-not [string]::IsNullOrWhiteSpace($SpecJson)) { return ConvertFrom-BoundedStrictJsonText -Text $SpecJson -MaxUtf8Bytes 1048576 -Label 'task specification' }
    if (-not [string]::IsNullOrWhiteSpace($TaskSpecPath)) {
        $registry = Read-TaskSpecRegistry -Path (Resolve-TaskRegistryPath -Path $TaskSpecPath)
        $ref = if ([string]::IsNullOrWhiteSpace($TaskSpecRef)) { $Task } else { $TaskSpecRef }
        $entry = @($registry.tasks | Where-Object { [string]$_.id -eq $ref } | Select-Object -First 1)
        if ($entry.Count -eq 0) { throw "Task specification reference not found: $ref" }
        return $entry[0].spec
    }
    throw 'Provide -SpecJson or -TaskSpecPath.'
}

$result = $null
try {
    $requestedSpec = Resolve-RequestedSpec
    Assert-TaskSpecContract -Spec $requestedSpec
    $result = Invoke-TaskSpec -TaskName $Task -Spec $requestedSpec
}
catch {
    $result = New-TaskResult -TaskName $Task -Kind 'unknown' -Status 'rejected' -Stderr $_.Exception.Message
}
if ($AsJson) { $result | ConvertTo-Json -Depth 20 -Compress } else { $result | ConvertTo-Json -Depth 20 }
if (-not [bool]$result.success) { exit 1 }
exit 0
