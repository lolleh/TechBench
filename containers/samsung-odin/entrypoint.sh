#!/bin/sh
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         TechBench - Samsung Odin Container              ║"
echo "╚════════════════════════════════════════════════════════════╝"

echo ""
echo "Tool Versions:"
command -v heimdall &> /dev/null && echo "  Heimdall: $(heimdall --version 2>/dev/null || echo 'installed')"
echo "  Python: $(python3 --version)"
echo ""

if [ $# -gt 0 ]; then
    exec "$@"
fi

echo "Starting interactive shell..."
echo "Available commands: heimdall, python3"
echo ""
exec /bin/bash
