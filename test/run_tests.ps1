# run_tests.ps1 — Build the app container, run Playwright E2E tests, tear down.
# Usage: .\run_tests.ps1
# Exits with 0 on success, non-zero on failure.

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# ── Install Playwright if node_modules is absent ──────────────────────────────
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing Playwright..."
    npm install
    npx playwright install chromium --with-deps
}

# ── Start the test environment ────────────────────────────────────────────────
Write-Host "Starting test container (this builds the image if needed)..."
docker compose -f docker-compose.test.yml up -d --build

# ── Wait for the app to be healthy ────────────────────────────────────────────
Write-Host "Waiting for app to become healthy..."
$healthy = $false
for ($i = 1; $i -le 30; $i++) {
    Start-Sleep -Seconds 3
    try {
        $r = Invoke-WebRequest `
            -Uri "http://localhost:8000/api/health" `
            -UseBasicParsing `
            -TimeoutSec 2 `
            -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            Write-Host "App healthy after $($i * 3)s."
            $healthy = $true
            break
        }
    } catch {}
    Write-Host "  attempt $i/30..."
}

if (-not $healthy) {
    Write-Host "ERROR: app did not become healthy in time. Logs:"
    docker compose -f docker-compose.test.yml logs app
    docker compose -f docker-compose.test.yml down -v
    exit 1
}

# ── Run Playwright tests ──────────────────────────────────────────────────────
Write-Host "Running Playwright tests..."
npx playwright test
$testExitCode = $LASTEXITCODE

# ── Tear down ─────────────────────────────────────────────────────────────────
Write-Host "Tearing down test environment..."
docker compose -f docker-compose.test.yml down -v

Write-Host "Tests finished with exit code $testExitCode."
exit $testExitCode
