#!/bin/bash
set -euo pipefail

# TechBench - Live USB Builder
# Creates a bootable live USB with persistence

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

# Usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Build TechBench Live USB

Options:
    -d, --device DEVICE     Target USB device (e.g., /dev/sdb)
    -s, --size SIZE         Persistence size in GB (default: 64)
    -b, --boot-mode MODE    Default boot mode (default: combined)
                            Options: desktop, mobile-service, electronics-bench, combined
    -o, --output OUTPUT     Output ISO location (default: ./output)
    -c, --clean             Clean build directory before building
    -h, --help              Show this help message

Examples:
    $0 -d /dev/sdb -s 32
    $0 -d /dev/sdc -b mobile-service -s 128
    $0 -o ./iso -c

EOF
    exit 0
}

# Defaults
DEVICE=""
PERSISTENCE_SIZE=64
BOOT_MODE="combined"
OUTPUT_DIR="./output"
CLEAN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--device)
            DEVICE="$2"
            shift 2
            ;;
        -s|--size)
            PERSISTENCE_SIZE="$2"
            shift 2
            ;;
        -b|--boot-mode)
            BOOT_MODE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Validate boot mode
case $BOOT_MODE in
    desktop|mobile-service|electronics-bench|combined)
        ;;
    *)
        error "Invalid boot mode: $BOOT_MODE"
        ;;
esac

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         TechBench - Live USB Builder                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
info "Boot Mode: $BOOT_MODE"
info "Persistence: ${PERSISTENCE_SIZE}GB"
if [ -n "$DEVICE" ]; then
    info "Target Device: $DEVICE"
fi
echo ""

# Check for root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (use sudo)"
fi

# Check for required tools
for cmd in lb debootstrap mksquashfs; do
    if ! command -v $cmd &> /dev/null; then
        error "Missing required tool: $cmd"
    fi
done

# Clean build directory if requested
if [ "$CLEAN" = true ]; then
    log "Cleaning build directory..."
    rm -rf "$OUTPUT_DIR"
fi

# Create build directory
mkdir -p "$OUTPUT_DIR"
BUILD_DIR="$OUTPUT_DIR/build"
mkdir -p "$BUILD_DIR"

# Step 1: Configure live-build
log "Configuring live-build..."
cd "$BUILD_DIR"

if [ ! -f "config/live-build.conf" ]; then
    lb config \
        --distribution bookworm \
        --archive-areas "main contrib non-free non-free-firmware" \
        --bootloader "grub" \
        --firmware-binary true \
        --firmware-chroot true \
        --iso-application "TechBench" \
        --iso-publisher "TechBench" \
        --iso-volume "TechBench ${BOOT_MODE}"
fi

# Step 2: Copy package lists
log "Adding package lists..."
mkdir -p config/package-lists
cp ../../packages/package-lists/*.list.chroot config/package-lists/

# Step 3: Copy boot mode configuration
log "Setting up boot mode: ${BOOT_MODE}..."
mkdir -p config/includes.chroot/opt/techbench/boot-modes
cp ../../base/boot-modes/*.conf config/includes.chroot/opt/techbench/boot-modes/

# Step 4: Create boot mode selector
log "Creating boot mode selector..."
mkdir -p config/includes.chroot/opt/techbench/bin

cat > config/includes.chroot/opt/techbench/bin/boot-mode-selector << 'BOOTMODE'
#!/bin/bash
# TechBench - Boot Mode Selector

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         TechBench - Select Boot Mode                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Available modes:"
echo "  1) Desktop         - Standard Linux desktop"
echo "  2) Mobile Service  - Mobile device servicing"
echo "  3) Electronics     - Electronics bench instruments"
echo "  4) Combined        - All features (default)"
echo ""
read -p "Select mode [1-4]: " choice

case $choice in
    1) MODE="desktop" ;;
    2) MODE="mobile-service" ;;
    3) MODE="electronics-bench" ;;
    *) MODE="combined" ;;
esac

echo ""
echo "Booting in ${MODE} mode..."
export HYBRIDBENCH_MODE="$MODE"

# Source the mode configuration
if [ -f "/opt/techbench/boot-modes/${MODE}-mode.conf" ]; then
    source "/opt/techbench/boot-modes/${MODE}-mode.conf"
fi

# Execute mode-specific init
if [ -n "${command:-}" ]; then
    exec $command
else
    exec startx
fi
BOOTMODE

chmod +x config/includes.chroot/opt/techbench/bin/boot-mode-selector

# Step 5: Create init scripts for each mode
log "Creating mode init scripts..."

# Desktop init
cat > config/includes.chroot/opt/techbench/bin/desktop-init << 'DESKTOP'
#!/bin/bash
echo "Starting TechBench in Desktop mode..."
exec startx
DESKTOP
chmod +x config/includes.chroot/opt/techbench/bin/desktop-init

# Mobile Service init
cat > config/includes.chroot/opt/techbench/bin/mobile-service-init << 'MOBILE'
#!/bin/bash
echo "Starting TechBench in Mobile Service mode..."

# Start USB device detection
python3 /opt/techbench/bin/device-detector &

# Start ADB server
adb start-server 2>/dev/null || true

# Start usbmuxd
usbmuxd &

# Launch BenchPanel GUI
exec benchpanel --mode mobile-service
MOBILE
chmod +x config/includes.chroot/opt/techbench/bin/mobile-service-init

# Electronics init
cat > config/includes.chroot/opt/techbench/bin/electronics-init << 'ELECTRONICS'
#!/bin/bash
echo "Starting TechBench in Electronics Bench mode..."

# Set real-time priority
ulimit -r 99

# Load GPIO modules
modprobe i2c-dev
modprobe spidev
modprobe gpio-cdev

# Start Sigrok daemon
sigrok-cli --version > /dev/null 2>&1 &

# Launch BenchPanel GUI
exec benchpanel --mode electronics-bench
ELECTRONICS
chmod +x config/includes.chroot/opt/techbench/bin/electronics-init

# Combined init
cat > config/includes.chroot/opt/techbench/bin/combined-init << 'COMBINED'
#!/bin/bash
echo "Starting TechBench in Combined mode..."

# Set real-time priority
ulimit -r 99

# Load all hardware modules
modprobe i2c-dev
modprobe spidev
modprobe gpio-cdev
modprobe usbserial

# Start all services
usbmuxd &
adb start-server 2>/dev/null || true
sigrok-cli --version > /dev/null 2>&1 &

# Start USB device detection
python3 /opt/techbench/bin/device-detector &

# Launch BenchPanel GUI
exec benchpanel --mode combined
COMBINED
chmod +x config/includes.chroot/opt/techbench/bin/combined-init

# Step 6: Build ISO
log "Building ISO..."
lb build 2>&1 | tee "$OUTPUT_DIR/build.log"

# Step 7: Calculate checksum
log "Calculating checksum..."
ISO_FILE=$(ls -1 techbench-*.iso 2>/dev/null | head -1)
if [ -n "$ISO_FILE" ]; then
    sha256sum "$ISO_FILE" > "${ISO_FILE}.sha256"
    log "ISO created: $ISO_FILE"
    log "Checksum: ${ISO_FILE}.sha256"
else
    error "ISO file not found"
fi

# Step 8: Write to USB device (if specified)
if [ -n "$DEVICE" ]; then
    log "Writing to USB device: $DEVICE"
    
    # Unmount any mounted partitions
    umount ${DEVICE}* 2>/dev/null || true
    
    # Write ISO
    dd if="$ISO_FILE" of="$DEVICE" bs=4M status=progress oflag=sync
    
    # Create persistence partition
    log "Creating persistence partition..."
    parted -s "$DEVICE" mkpart primary ext4 0% ${PERSISTENCE_SIZE}GB
    
    # Format persistence
    PERSISTENCE_PART="${DEVICE}2"
    mkfs.ext4 -L "persistence" "$PERSISTENCE_PART"
    
    # Setup persistence
    mkdir -p /mnt/persistence
    mount "$PERSISTENCE_PART" /mnt/persistence
    
    echo "/ union" > /mnt/persistence/persistence.conf
    mkdir -p /mnt/persistence/{config,containers,databases,signatures,schematics,logs}
    
    umount /mnt/persistence
    
    log "USB device ready: $DEVICE"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Build Complete!                                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
log "ISO location: $OUTPUT_DIR/$ISO_FILE"
if [ -n "$DEVICE" ]; then
    log "USB device: $DEVICE"
fi
echo ""
