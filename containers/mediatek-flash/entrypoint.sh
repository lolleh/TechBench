#!/bin/sh
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         TechBench - MediaTek Flash Container            ║"
echo "╚════════════════════════════════════════════════════════════╝"

echo ""
echo "Tool Versions:"
command -v mtk &> /dev/null && echo "  MTK Client: installed"
echo "  Python: $(python3 --version)"
echo ""

if [ $# -gt 0 ]; then
    exec "$@"
fi

echo "Starting interactive shell..."
echo "Available commands: mtk, python3"
echo ""
exec /bin/bash
