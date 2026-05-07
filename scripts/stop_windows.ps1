# Stop and remove the FinAlly Docker container (Windows PowerShell).
# Volume is preserved so portfolio data survives restarts.

$ContainerName = "finally"

$Existing = docker ps -a --filter "name=^${ContainerName}$" --format "{{.Names}}"
if ($Existing -eq $ContainerName) {
    Write-Host "Stopping FinAlly..."
    docker stop $ContainerName | Out-Null
    docker rm $ContainerName | Out-Null
    Write-Host "Stopped."
} else {
    Write-Host "FinAlly is not running."
}
