# Start the FinAlly Docker container (Windows PowerShell).
# Idempotent: builds the image if missing, recreates the container if needed.

$ErrorActionPreference = "Stop"

$ImageName = "finally"
$ContainerName = "finally"
$VolumeName = "finally-data"
$EnvFile = ".env"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptRoot
Set-Location $ProjectRoot

if (-not (Test-Path $EnvFile)) {
    Write-Host "No .env file found. Copying .env.example to .env."
    Copy-Item ".env.example" $EnvFile
    Write-Host "Edit .env to set OPENAI_API_KEY before re-running."
    exit 1
}

$ForceBuild = $args -contains "--build"
$ImageExists = (docker images -q $ImageName) -ne $null -and (docker images -q $ImageName).Length -gt 0

if ($ForceBuild -or -not $ImageExists) {
    Write-Host "Building Docker image '$ImageName'..."
    docker build -t $ImageName .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker build failed."
        exit 1
    }
}

$Existing = docker ps -a --filter "name=^${ContainerName}$" --format "{{.Names}}"
if ($Existing -eq $ContainerName) {
    Write-Host "Removing existing container '$ContainerName'..."
    docker rm -f $ContainerName | Out-Null
}

Write-Host "Starting FinAlly..."
docker run -d `
    --name $ContainerName `
    -p 8000:8000 `
    -v "${VolumeName}:/app/db" `
    --env-file $EnvFile `
    $ImageName | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "FinAlly running at http://localhost:8000"
} else {
    Write-Host "Failed to start container."
    exit 1
}
