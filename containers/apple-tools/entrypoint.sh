#!/bin/sh
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         TechBench - Apple Tools Container               ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Start usbmuxd for iOS device detection
if command -v usbmuxd &> /dev/null; then
    usbmuxd &
    sleep 1
fi

echo ""
echo "Tool Versions:"
command -v idevice_id &> /dev/null && echo "  idevice_id: $(idevice_id -v 2>/dev/null || echo 'installed')"
command -v ideviceinfo &> /dev/null && echo "  ideviceinfo: installed"
echo "  Python: $(python3 --version)"
echo ""

if [ $# -gt 0 ]; then
    exec "$@"
fi

echo "Starting interactive shell..."
echo "Available commands: idevice_id, ideviceinfo, ideviceinstaller, python3"
echo ""
exec /bin/bash
