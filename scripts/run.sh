#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v pwsh >/dev/null 2>&1; then
    printf '%s\n' 'PowerShell 7+ is required.' >&2
    exit 1
fi

exec pwsh -NoProfile -File "$script_dir/run.ps1" "$@"
