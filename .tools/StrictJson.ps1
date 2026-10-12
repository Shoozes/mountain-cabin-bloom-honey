#Requires -Version 5.1

<#
.SYNOPSIS
    Reads bounded, strict UTF-8 JSON for the generated project controller.

.DESCRIPTION
    This is the self-contained generated-project copy of the foundation
    reader. It intentionally does not use ConvertFrom-Json because Windows
    PowerShell 5.1 does not provide duplicate-key or bounded-read guarantees.
#>

Set-StrictMode -Version 2.0

$script:StrictJsonUtf8 = New-Object System.Text.UTF8Encoding($false, $true)

function Skip-StrictJsonWhitespace {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][ref]$Index
    )
    while ($Index.Value -lt $Text.Length) {
        $code = [int][char]$Text[$Index.Value]
        if ($code -ne 0x20 -and $code -ne 0x09 -and $code -ne 0x0a -and $code -ne 0x0d) { break }
        $Index.Value++
    }
}

function Read-StrictJsonString {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][ref]$Index
    )
    if ($Index.Value -ge $Text.Length -or $Text[$Index.Value] -ne '"') {
        throw 'Strict JSON expected a quoted property name or string.'
    }
    $Index.Value++
    $builder = New-Object System.Text.StringBuilder
    while ($Index.Value -lt $Text.Length) {
        $code = [int][char]$Text[$Index.Value]
        $Index.Value++
        if ($code -eq 0x22) { return $builder.ToString() }
        if ($code -lt 0x20) { throw 'Strict JSON strings cannot contain control characters.' }
        if ($code -ne 0x5c) {
            $null = $builder.Append([char]$code)
            continue
        }
        if ($Index.Value -ge $Text.Length) { throw 'Strict JSON string ended after an escape marker.' }
        $escape = $Text[$Index.Value]
        $Index.Value++
        if ($escape -eq '"') { $null = $builder.Append('"'); continue }
        if ($escape -eq '\') { $null = $builder.Append('\'); continue }
        if ($escape -eq '/') { $null = $builder.Append('/'); continue }
        if ($escape -eq 'b') { $null = $builder.Append([char]0x08); continue }
        if ($escape -eq 'f') { $null = $builder.Append([char]0x0c); continue }
        if ($escape -eq 'n') { $null = $builder.Append([char]0x0a); continue }
        if ($escape -eq 'r') { $null = $builder.Append([char]0x0d); continue }
        if ($escape -eq 't') { $null = $builder.Append([char]0x09); continue }
        if ($escape -ne 'u') { throw "Strict JSON contains an unsupported escape: \$escape" }
        if ($Index.Value + 4 -gt $Text.Length) { throw 'Strict JSON unicode escape is incomplete.' }
        $hex = $Text.Substring($Index.Value, 4)
        if ($hex -notmatch '^[0-9a-fA-F]{4}$') { throw "Strict JSON unicode escape is invalid: \$hex" }
        $codePoint = [Convert]::ToInt32($hex, 16)
        $Index.Value += 4
        if ($codePoint -ge 0xd800 -and $codePoint -le 0xdbff) {
            if ($Index.Value + 6 -gt $Text.Length -or $Text[$Index.Value] -ne '\' -or $Text[$Index.Value + 1] -ne 'u') {
                throw 'Strict JSON high surrogate must be followed by a low surrogate.'
            }
            $lowHex = $Text.Substring($Index.Value + 2, 4)
            if ($lowHex -notmatch '^[0-9a-fA-F]{4}$') { throw "Strict JSON low surrogate is invalid: \$lowHex" }
            $lowPoint = [Convert]::ToInt32($lowHex, 16)
            if ($lowPoint -lt 0xdc00 -or $lowPoint -gt 0xdfff) { throw 'Strict JSON surrogate pair is invalid.' }
            $null = $builder.Append([char]$codePoint)
            $null = $builder.Append([char]$lowPoint)
            $Index.Value += 6
            continue
        }
        if ($codePoint -ge 0xdc00 -and $codePoint -le 0xdfff) {
            throw 'Strict JSON low surrogate cannot appear without a high surrogate.'
        }
        $null = $builder.Append([char]$codePoint)
    }
    throw 'Strict JSON string was not terminated.'
}

function Read-StrictJsonNumber {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][ref]$Index
    )
    $start = $Index.Value
    if ($Index.Value -lt $Text.Length -and $Text[$Index.Value] -eq '-') { $Index.Value++ }
    if ($Index.Value -ge $Text.Length) { throw 'Strict JSON number is incomplete.' }
    if ($Text[$Index.Value] -eq '0') {
        $Index.Value++
        if ($Index.Value -lt $Text.Length -and [int][char]$Text[$Index.Value] -ge 0x30 -and [int][char]$Text[$Index.Value] -le 0x39) {
            throw 'Strict JSON numbers cannot contain a leading zero.'
        }
    }
    elseif ([int][char]$Text[$Index.Value] -ge 0x31 -and [int][char]$Text[$Index.Value] -le 0x39) {
        while ($Index.Value -lt $Text.Length -and [int][char]$Text[$Index.Value] -ge 0x30 -and [int][char]$Text[$Index.Value] -le 0x39) {
            $Index.Value++
        }
    }
    else {
        throw 'Strict JSON number has no integer digits.'
    }
    $fractional = $false
    if ($Index.Value -lt $Text.Length -and $Text[$Index.Value] -eq '.') {
        $fractional = $true
        $Index.Value++
        $fractionStart = $Index.Value
        while ($Index.Value -lt $Text.Length -and [int][char]$Text[$Index.Value] -ge 0x30 -and [int][char]$Text[$Index.Value] -le 0x39) {
            $Index.Value++
        }
        if ($Index.Value -eq $fractionStart) { throw 'Strict JSON decimal has no fractional digits.' }
    }
    if ($Index.Value -lt $Text.Length -and ($Text[$Index.Value] -eq 'e' -or $Text[$Index.Value] -eq 'E')) {
        $fractional = $true
        $Index.Value++
        if ($Index.Value -lt $Text.Length -and ($Text[$Index.Value] -eq '+' -or $Text[$Index.Value] -eq '-')) { $Index.Value++ }
        $exponentStart = $Index.Value
        while ($Index.Value -lt $Text.Length -and [int][char]$Text[$Index.Value] -ge 0x30 -and [int][char]$Text[$Index.Value] -le 0x39) {
            $Index.Value++
        }
        if ($Index.Value -eq $exponentStart) { throw 'Strict JSON exponent has no digits.' }
    }
    $token = $Text.Substring($start, $Index.Value - $start)
    try {
        if ($fractional) {
            return [decimal]::Parse($token, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture)
        }
        return [int64]::Parse($token, [Globalization.NumberStyles]::Integer, [Globalization.CultureInfo]::InvariantCulture)
    }
    catch {
        throw "Strict JSON number is outside the supported range: \$token"
    }
}

function Read-StrictJsonValue {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][ref]$Index,
        [int]$Depth = 0
    )
    if ($Depth -gt 32) { throw 'Strict JSON nesting exceeds the supported depth.' }
    Skip-StrictJsonWhitespace -Text $Text -Index $Index
    if ($Index.Value -ge $Text.Length) { throw 'Strict JSON value is missing.' }
    $current = $Text[$Index.Value]
    if ($current -eq '"') { return Read-StrictJsonString -Text $Text -Index $Index }
    if ($current -eq '{') { return Read-StrictJsonObject -Text $Text -Index $Index -Depth ($Depth + 1) }
    if ($current -eq '[') {
        $array = Read-StrictJsonArray -Text $Text -Index $Index -Depth ($Depth + 1)
        return ,$array
    }
    if ($current -eq 't' -and $Index.Value + 4 -le $Text.Length -and $Text.Substring($Index.Value, 4) -eq 'true') {
        $Index.Value += 4
        return $true
    }
    if ($current -eq 'f' -and $Index.Value + 5 -le $Text.Length -and $Text.Substring($Index.Value, 5) -eq 'false') {
        $Index.Value += 5
        return $false
    }
    if ($current -eq 'n' -and $Index.Value + 4 -le $Text.Length -and $Text.Substring($Index.Value, 4) -eq 'null') {
        $Index.Value += 4
        return $null
    }
    if ($current -eq '-' -or ([int][char]$current -ge 0x30 -and [int][char]$current -le 0x39)) {
        return Read-StrictJsonNumber -Text $Text -Index $Index
    }
    throw "Strict JSON contains an unexpected value at character $($Index.Value)."
}

function Read-StrictJsonObject {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][ref]$Index,
        [int]$Depth = 0
    )
    if ($Text[$Index.Value] -ne '{') { throw 'Strict JSON object must begin with an opening brace.' }
    $Index.Value++
    $properties = [ordered]@{}
    # PowerShell ordered dictionaries treat property names case-insensitively.
    # Match that storage behavior so a JSON document cannot silently collapse
    # distinct wire keys such as "Version" and "version" into one property.
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    Skip-StrictJsonWhitespace -Text $Text -Index $Index
    if ($Index.Value -lt $Text.Length -and $Text[$Index.Value] -eq '}') {
        $Index.Value++
        return [pscustomobject]$properties
    }
    while ($true) {
        Skip-StrictJsonWhitespace -Text $Text -Index $Index
        $key = Read-StrictJsonString -Text $Text -Index $Index
        if (-not $seen.Add($key)) { throw "Strict JSON contains a duplicate object key: \$key" }
        Skip-StrictJsonWhitespace -Text $Text -Index $Index
        if ($Index.Value -ge $Text.Length -or $Text[$Index.Value] -ne ':') { throw "Strict JSON object key has no colon: \$key" }
        $Index.Value++
        $propertyValue = Read-StrictJsonValue -Text $Text -Index $Index -Depth $Depth
        $properties[$key] = $propertyValue
        Skip-StrictJsonWhitespace -Text $Text -Index $Index
        if ($Index.Value -ge $Text.Length) { throw 'Strict JSON object was not terminated.' }
        if ($Text[$Index.Value] -eq '}') {
            $Index.Value++
            return [pscustomobject]$properties
        }
        if ($Text[$Index.Value] -ne ',') { throw 'Strict JSON object requires a comma between properties.' }
        $Index.Value++
    }
}

function Read-StrictJsonArray {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][ref]$Index,
        [int]$Depth = 0
    )
    if ($Text[$Index.Value] -ne '[') { throw 'Strict JSON array must begin with an opening bracket.' }
    $Index.Value++
    $items = New-Object System.Collections.Generic.List[object]
    Skip-StrictJsonWhitespace -Text $Text -Index $Index
    if ($Index.Value -lt $Text.Length -and $Text[$Index.Value] -eq ']') {
        $Index.Value++
        return ,([object[]]$items.ToArray())
    }
    while ($true) {
        $items.Add((Read-StrictJsonValue -Text $Text -Index $Index -Depth $Depth))
        Skip-StrictJsonWhitespace -Text $Text -Index $Index
        if ($Index.Value -ge $Text.Length) { throw 'Strict JSON array was not terminated.' }
        if ($Text[$Index.Value] -eq ']') {
            $Index.Value++
            return ,([object[]]$items.ToArray())
        }
        if ($Text[$Index.Value] -ne ',') { throw 'Strict JSON array requires a comma between values.' }
        $Index.Value++
    }
}

function ConvertFrom-StrictJsonText {
    param([Parameter(Mandatory = $true)][string]$Text)
    if ($Text.Length -eq 0) { throw 'Strict JSON document is empty.' }
    if ([int][char]$Text[0] -eq 0xfeff) { throw 'Strict JSON document must not contain a UTF-8 BOM.' }
    $index = 0
    $value = Read-StrictJsonValue -Text $Text -Index ([ref]$index)
    Skip-StrictJsonWhitespace -Text $Text -Index ([ref]$index)
    if ($index -ne $Text.Length) { throw 'Strict JSON document contains trailing data.' }
    return ,$value
}

function ConvertFrom-BoundedStrictJsonText {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [int64]$MaxUtf8Bytes = 1048576,
        [string]$Label = 'JSON contract'
    )
    if ($MaxUtf8Bytes -lt 0 -or $MaxUtf8Bytes -gt [int32]::MaxValue) { throw 'Bounded JSON text size limit is outside the supported range.' }
    $utf8Bytes = [int64]$script:StrictJsonUtf8.GetByteCount($Text)
    if ($utf8Bytes -gt $MaxUtf8Bytes) { throw "$Label exceeds the strict JSON text size limit of $MaxUtf8Bytes UTF-8 bytes." }
    try {
        return ConvertFrom-StrictJsonText -Text $Text
    }
    catch {
        throw "$Label is invalid strict JSON. $($_.Exception.Message)"
    }
}

function Read-BoundedFileBytes {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [int64]$MaxBytes = 1048576
    )
    if ($MaxBytes -lt 0 -or $MaxBytes -gt [int32]::MaxValue) { throw 'Bounded file size limit is outside the supported range.' }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Required bounded file is missing: $Path" }
    $before = Get-Item -LiteralPath $Path -Force
    if (($before.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Required bounded file cannot be a reparse point: $Path" }
    if ([int64]$before.Length -gt $MaxBytes) { throw "Required bounded file exceeds the size limit: $Path" }
    $bytes = New-Object byte[] ([int]$before.Length)
    $stream = $null
    try {
        $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
        if ([int64]$stream.Length -ne [int64]$before.Length) { throw "Bounded file changed before reading: $Path" }
        $offset = 0
        while ($offset -lt $bytes.Length) {
            $read = $stream.Read($bytes, $offset, $bytes.Length - $offset)
            if ($read -le 0) { throw "Bounded file ended during reading: $Path" }
            $offset += $read
        }
        if ([int64]$stream.Length -ne [int64]$before.Length) { throw "Bounded file changed during reading: $Path" }
    }
    catch {
        throw "Bounded file could not be read safely: $Path. $($_.Exception.Message)"
    }
    finally {
        if ($null -ne $stream) { $stream.Dispose() }
    }
    $after = Get-Item -LiteralPath $Path -Force
    if (($after.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Bounded file became a reparse point during inspection: $Path"
    }
    if ([int64]$after.Length -ne [int64]$before.Length -or $after.LastWriteTimeUtc.Ticks -ne $before.LastWriteTimeUtc.Ticks) {
        throw "Bounded file changed during inspection: $Path"
    }
    return ,$bytes
}

function Read-BoundedUtf8File {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [int64]$MaxBytes = 1048576
    )
    $bytes = Read-BoundedFileBytes -Path $Path -MaxBytes $MaxBytes
    try { return $script:StrictJsonUtf8.GetString($bytes) }
    catch { throw "Bounded file is not strict UTF-8: $Path" }
}

function Read-StrictJsonFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [int64]$MaxBytes = 1048576
    )
    $text = Read-BoundedUtf8File -Path $Path -MaxBytes $MaxBytes
    return ConvertFrom-BoundedStrictJsonText -Text $text -MaxUtf8Bytes $MaxBytes -Label "Generated project JSON contract '$Path'"
}
