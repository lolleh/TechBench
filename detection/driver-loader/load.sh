#!/bin/bash
set -euo pipefail

# TechBench - Driver Loader
# Loads appropriate kernel modules for detected devices

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Usage
usage() {
    cat << EOF
Usage: $0 <vendor_id> <product_id>

Load kernel modules for a specific USB device.

Arguments:
    vendor_id    USB Vendor ID (e.g., 05c6)
    product_id   USB Product ID (e.g., 90db)

Examples:
    $0 05c6 90db    # Load Qualcomm EDL drivers
    $0 0e8d 0003    # Load MediaTek preloader drivers
    $0 04e8 6860    # Load Samsung download mode drivers

EOF
    exit 0
}

# Check arguments
if [ $# -lt 2 ]; then
    usage
fi

VENDOR_ID=$1
PRODUCT_ID=$2

log "Loading drivers for device: ${VENDOR_ID}:${PRODUCT_ID}"

# Base modules (always load)
BASE_MODULES="usbserial"

# Device-specific modules
case "${VENDOR_ID}:${PRODUCT_ID}" in
    "05c6:90db"|"05c6:9008")
        # Qualcomm EDL mode
        log "Detected Qualcomm EDL mode"
        MODULES="$BASE_MODULES qcserial"
        ;;
    "0e8d:0003"|"0e8d:2000")
        # MediaTek preloader
        log "Detected MediaTek preloader"
        MODULES="$BASE_MODULES"
        ;;
    "04e8:6860")
        # Samsung download mode
        log "Detected Samsung download mode"
        MODULES="$BASE_MODULES"
        ;;
    "05ac:1227"|"05ac:1281"|"05ac:1222")
        # Apple device
        log "Detected Apple device"
        MODULES="$BASE_MODULES"
        ;;
    "18d1:4ee7"|"18d1:d002")
        # Google Pixel
        log "Detected Google Pixel"
        MODULES="$BASE_MODULES"
        ;;
    *)
        # Unknown device, try generic modules
        warn "Unknown device, loading generic modules"
        MODULES="$BASE_MODULES"
        ;;
esac

# Load modules
for module in $MODULES; do
    if lsmod | grep -q "^${module} "; then
        log "Module already loaded: $module"
    else
        if modprobe "$module" 2>/dev/null; then
            log "Loaded module: $module"
        else
            warn "Failed to load module: $module (may not be available)"
        fi
    fi
done

# Set permissions for USB devices
log "Setting USB device permissions..."
for dev in /dev/bus/usb/*/*; do
    if [ -e "$dev" ]; then
        chmod 666 "$dev" 2>/dev/null || true
    fi
done

# Check if device is now accessible
log "Checking device accessibility..."
if lsusb | grep -q "${VENDOR_ID}:${PRODUCT_ID}"; then
    log "Device found and accessible"
else
    warn "Device not found in lsusb (may need to replug)"
fi

log "Driver loading complete"
