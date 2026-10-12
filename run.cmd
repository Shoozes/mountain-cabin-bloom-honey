@echo off
setlocal
set "ENTRY=%~dp0scripts\run.ps1"
if not exist "%ENTRY%" (
    echo gknome project controller not found: %ENTRY%
    exit /b 1
)
where pwsh.exe >nul 2>&1
if errorlevel 1 goto :powershell
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%ENTRY%" %*
exit /b %ERRORLEVEL%
:powershell
where powershell.exe >nul 2>&1
if errorlevel 1 goto :missing
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ENTRY%" %*
exit /b %ERRORLEVEL%
:missing
echo Windows PowerShell 5.1 or PowerShell 7+ is required.
exit /b 1
