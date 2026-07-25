#!/bin/sh
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         TechBench - Qualcomm EDL Container              ║"
echo "╚════════════════════════════════════════════════════════════╝"

echo ""
echo "Tool Versions:"
command -v edl &> /dev/null && echo "  EDL: $(edl --version 2>/dev/null || echo 'installed')"
echo "  Python: $(python3 --version)"
echo ""

if [ $# -gt 0 ]; then
    exec "$@"
fi

echo "Starting interactive shell..."
echo "Available commands: edl, python3"
echo ""
exec /bin/bash
