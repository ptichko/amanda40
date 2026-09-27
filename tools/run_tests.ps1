<#
    Runs every test in tools/ and reports a summary.

        powershell -File tools/run_tests.ps1
        powershell -File tools/run_tests.ps1 test_replay.js   # just one

    Exits non-zero if anything fails, so it drops straight into CI.
#>
$ErrorActionPreference = 'Continue'

$tests = if ($args.Count -gt 0) {
    $args | ForEach-Object { Join-Path $PSScriptRoot $_ }
} else {
    Get-ChildItem -Path $PSScriptRoot -Filter 'test_*.js' | Sort-Object Name | ForEach-Object { $_.FullName }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'node not found on PATH -- the tests need Node to run.' -ForegroundColor Red
    exit 1
}

$failed = @()
foreach ($test in $tests) {
    if (-not (Test-Path -LiteralPath $test)) {
        Write-Host "no such test: $test" -ForegroundColor Red
        $failed += (Split-Path -Leaf $test)
        continue
    }
    Write-Host ''
    Write-Host "== $(Split-Path -Leaf $test)" -ForegroundColor Cyan
    & node $test
    if ($LASTEXITCODE -ne 0) { $failed += (Split-Path -Leaf $test) }
}

Write-Host ''
if ($failed.Count -gt 0) {
    Write-Host "FAILED: $($failed -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "all tests passed ($($tests.Count) files)" -ForegroundColor Green
exit 0
