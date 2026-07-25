#!/bin/sh
set -e

# Android Tools Container - Entry Point

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         TechBench - Android Tools Container             ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Start usbmuxd for iOS device detection (if needed)
if command -v usbmuxd &> /dev/null; then
    usbmuxd &
    sleep 1
fi

# Check for ADB server
if ! pgrep -x "adb" > /dev/null; then
    adb start-server 2>/dev/null || true
fi

# Print version info
echo ""
echo "Tool Versions:"
echo "  ADB: $(adb version | head -1)"
echo "  Fastboot: $(fastboot --version | head -1)"
echo "  Python: $(python3 --version)"
echo ""

# If arguments passed, run them
if [ $# -gt 0 ]; then
    exec "$@"
fi

# Otherwise, start an interactive shell
echo "Starting interactive shell..."
echo "Available commands: adb, fastboot, python3"
echo ""
exec /bin/bash
