#!/usr/bin/env bash
# Start the FinAlly Docker container (macOS / Linux).
# Idempotent: builds the image if missing, recreates the container if needed.

set -euo pipefail

IMAGE_NAME="finally"
CONTAINER_NAME="finally"
VOLUME_NAME="finally-data"
ENV_FILE=".env"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "No .env file found. Copying .env.example to .env."
    cp .env.example "$ENV_FILE"
    echo "Edit .env to set OPENAI_API_KEY before re-running."
    exit 1
fi

force_build=false
for arg in "$@"; do
    if [[ "$arg" == "--build" ]]; then
        force_build=true
    fi
done

if $force_build || [[ -z "$(docker images -q "$IMAGE_NAME" 2>/dev/null)" ]]; then
    echo "Building Docker image '$IMAGE_NAME'..."
    docker build -t "$IMAGE_NAME" .
fi

if [[ -n "$(docker ps -a --filter "name=^${CONTAINER_NAME}$" --format '{{.Names}}')" ]]; then
    echo "Removing existing container '$CONTAINER_NAME'..."
    docker rm -f "$CONTAINER_NAME" >/dev/null
fi

echo "Starting FinAlly..."
docker run -d \
    --name "$CONTAINER_NAME" \
    -p 8000:8000 \
    -v "${VOLUME_NAME}:/app/db" \
    --env-file "$ENV_FILE" \
    "$IMAGE_NAME" >/dev/null

echo ""
echo "FinAlly running at http://localhost:8000"
