#!/usr/bin/env bash
# Stop and remove the FinAlly Docker container (macOS / Linux).
# Volume is preserved so portfolio data survives restarts.

set -euo pipefail

CONTAINER_NAME="finally"

if [[ -n "$(docker ps -a --filter "name=^${CONTAINER_NAME}$" --format '{{.Names}}')" ]]; then
    echo "Stopping FinAlly..."
    docker stop "$CONTAINER_NAME" >/dev/null
    docker rm "$CONTAINER_NAME" >/dev/null
    echo "Stopped."
else
    echo "FinAlly is not running."
fi
