#!/bin/sh
set -eu

# TechBench - Container Build Script
# Builds all container images for the mobile servicing tools
#
# Usage:
#   ./build_containers.sh          # Build minimal containers (no deps)
#   ./build_containers.sh --full   # Build full containers (with deps, needs fast network)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONTAINERS_DIR="$PROJECT_ROOT/containers"

FULL_BUILD=false
[ "${1:-}" = "--full" ] && FULL_BUILD=true

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  TechBench - Container Build                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check for container runtime
if command -v podman >/dev/null 2>&1; then
    CRT="podman"
elif command -v docker >/dev/null 2>&1; then
    CRT="docker"
else
    echo "Error: No container runtime found (podman or docker)"
    exit 1
fi

echo "Using: $CRT"
echo "Mode: $([ "$FULL_BUILD" = "true" ] && echo "full" || echo "minimal")"
echo ""

# Select Dockerfile
if [ "$FULL_BUILD" = "true" ]; then
    DOCKERFILE="Dockerfile"
else
    DOCKERFILE="Dockerfile.minimal"
fi

# List of containers
CONTAINERS="android-tools apple-tools qualcomm-edl mediatek-flash samsung-odin"

SUCCESS=0
FAILED=0

for c in $CONTAINERS; do
    DIR="$CONTAINERS_DIR/$c"
    FILE="$DIR/$DOCKERFILE"

    if [ ! -f "$FILE" ]; then
        echo "✗ $c: $DOCKERFILE not found"
        FAILED=$((FAILED + 1))
        continue
    fi

    echo "Building $c..."
    if $CRT build -t "techbench/$c" -f "$FILE" "$DIR" 2>&1 | tail -3; then
        echo "✓ $c"
        SUCCESS=$((SUCCESS + 1))
    else
        echo "✗ $c failed"
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

echo "════════════════════════════════════════════════════════════"
echo "  RESULT: $SUCCESS built, $FAILED failed"
echo "════════════════════════════════════════════════════════════"
echo ""
$CRT images | grep techbench
