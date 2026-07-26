#!/bin/bash
#
# TianOS-Android Build Script
# Builds a flashable Android OS with security tools
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
BUILD_DIR="$SCRIPT_DIR/build"
CONFIG_DIR="$SCRIPT_DIR/config"
TOOLS_DIR="$SCRIPT_DIR/tools"
ROOTFS_DIR="$SCRIPT_DIR/rootfs"

VERSION="0.1"
GSI_URL="https://github.com/nicknormandin/GSI-Images/releases/download/Android-15-GSI/system-arm64-ab-squeez-arm64-ab-14.0-20240916.img.xz"
GSI_FILE="system-arm64-ab.img"
FLASHABLE_NAME="TianOS-v${VERSION}.zip"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_banner() {
    echo -e "${BLUE}"
    cat << "EOF"
  _____ _____ _____  ___ ____  _   _ ______     __
 |_   _| ____|_   _|/ _ \___ \| | | |  _ \ \   / /
   | | |  _|   | || | | |__) | | | | |_) \ \ / /
   | | | |___  | || |_| / __/| |_| |  __/ \ V /
   |_| |_____| |_| \___/_____| \___/|_|     \_/
   
   Security-Focused Android OS
   Version: ${VERSION}
EOF
    echo -e "${NC}"
}

log() {
    echo -e "${GREEN}[+]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

error() {
    echo -e "${RED}[-]${NC} $1"
    exit 1
}

check_deps() {
    log "Checking dependencies..."
    
    local deps=("curl" "wget" "unxz" "zip" "unzip")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        warn "Missing dependencies: ${missing[*]}"
        if command -v sudo &> /dev/null; then
            log "Installing dependencies..."
            sudo apt-get update
            sudo apt-get install -y "${missing[@]}"
        else
            error "Cannot install missing dependencies. Please install manually: ${missing[*]}"
        fi
    fi
    
    log "Dependencies OK"
}

clean_build() {
    log "Cleaning build directory..."
    rm -rf "$BUILD_DIR"
    rm -rf "$OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
    log "Clean complete"
}

download_gsi() {
    log "Downloading A15 GSI base image..."
    mkdir -p "$BUILD_DIR"
    
    if [ -f "$BUILD_DIR/$GSI_FILE" ]; then
        log "GSI already downloaded"
        return
    fi
    
    # Try multiple GSI sources
    local gsi_urls=(
        "https://github.com/nicknormandin/GSI-Images/releases/download/Android-15-GSI/system-arm64-ab-squeez-arm64-ab-14.0-20240916.img.xz"
        "https://github.com/nicknormandin/GSI-Images/releases/download/Android-14-GSI/system-arm64-ab-arm64-ab-14.0-20231016.img.xz"
    )
    
    for url in "${gsi_urls[@]}"; do
        log "Trying: $url"
        if wget -q --show-progress -O "$BUILD_DIR/gsi.img.xz" "$url" 2>/dev/null; then
            log "Download successful, extracting..."
            unxz "$BUILD_DIR/gsi.img.xz"
            mv "$BUILD_DIR/gsi.img" "$BUILD_DIR/$GSI_FILE"
            return
        fi
    done
    
    # If download fails, create a minimal placeholder
    warn "Could not download GSI, creating placeholder for testing..."
    create_placeholder_image
}

create_placeholder_image() {
    log "Creating minimal system image for testing..."
    
    # Create a 2GB sparse image
    dd if=/dev/zero of="$BUILD_DIR/$GSI_FILE" bs=1M count=0 seek=2048 2>/dev/null
    
    # Format as ext4
    mkfs.ext4 -F "$BUILD_DIR/$GSI_FILE" 2>/dev/null || true
    
    log "Placeholder image created (2GB)"
    log "NOTE: Replace with real GSI for production use"
}

mount_image() {
    log "Mounting system image..."
    mkdir -p "$BUILD_DIR/mnt"
    
    # Try to mount with loop device
    if command -v losetup &> /dev/null; then
        LOOP_DEV=$(losetup -f --show "$BUILD_DIR/$GSI_FILE" 2>/dev/null || true)
        if [ -n "$LOOP_DEV" ]; then
            mount "$LOOP_DEV" "$BUILD_DIR/mnt" 2>/dev/null || true
        fi
    fi
    
    # Fallback: extract with e2tools or use directly
    if ! mountpoint -q "$BUILD_DIR/mnt" 2>/dev/null; then
        warn "Could not mount image, using direct overlay method"
        mkdir -p "$BUILD_DIR/mnt/system"
    fi
}

apply_branding() {
    log "Applying TianOS branding..."
    
    # Ensure directory exists
    mkdir -p "$BUILD_DIR/mnt/system"
    
    # System properties
    cat > "$BUILD_DIR/mnt/system/build.prop" << 'PROP'
# TianOS System Properties
ro.build.display.id=TianOS-v0.1
ro.build.version.sdk=35
ro.build.version.release=15
ro.build.version.security_patch=2025-01-05
ro.build.type=userdebug
ro.build.tags=test-keys
ro.build.description=TianOS-Android-15
ro.build.flavor=TianOS-userdebug

# TianOS specific
ro.tianos.version=0.1
ro.tianos.name=TianOS
ro.tianos.security=enabled

# Performance
dalvik.vm.heapsize=512m
dalvik.vm.heapgrowthlimit=256m

# Enable ADB
persist.sys.usb.config=adb
persist.service.adb.enable=1
ro.adb.secure=0

# Developer options
ro.debuggable=1
ro.secure=0
PROP
    
    log "Branding applied"
}

install_apps() {
    log "Installing pre-loaded apps..."
    
    # Create app directory structure
    mkdir -p "$BUILD_DIR/mnt/system/app/TianOSManager"
    mkdir -p "$BUILD_DIR/mnt/system/priv-app/TianOSSettings"
    
    # Create TianOS Manager stub
    cat > "$BUILD_DIR/mnt/system/app/TianOSManager/AndroidManifest.xml" << 'XML'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.tianos.manager">
    <uses-permission android:name="android.permission.INTERNET"/>
    <application android:label="TianOS Manager" android:icon="@mipmap/ic_launcher">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
XML
    
    log "Apps installed"
}

install_tools() {
    log "Installing security tools..."
    
    # Create tools installation script for Termux
    mkdir -p "$BUILD_DIR/mnt/data/data/com.termux/files/home"
    
    cat > "$BUILD_DIR/mnt/data/data/com.termux/files/home/install-tianos-tools.sh" << 'TOOLS'
#!/bin/bash
#
# TianOS Security Tools Installer
# Run this in Termux after first boot
#

echo "=== TianOS Security Tools Installer ==="
echo ""

# Update packages
echo "[1/8] Updating packages..."
pkg update -y && pkg upgrade -y

# Install core dependencies
echo "[2/8] Installing core dependencies..."
pkg install -y wget curl git python ruby nmap tcpdump netcat-openbsd

# Install network tools
echo "[3/8] Installing network tools..."
pkg install -y nmap masscan hping3 netcat-openbsd socat

# Install web tools
echo "[4/8] Installing web tools..."
pkg install -y python sqlmap nikto

# Install forensics tools
echo "[5/8] Installing forensics tools..."
pkg install -y binwalk foremost strings file

# Install password tools
echo "[6/8] Installing password tools..."
pkg install -y john hashcat hydra medusa

# Install wireless tools (if supported)
echo "[7/8] Installing wireless tools..."
pkg install -y aircrack-ng reaver wifite2 || echo "Some wireless tools may not be available"

# Install additional tools
echo "[8/8] Installing additional tools..."
pkg install -y gdb radare2 strace ltrace

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Available commands:"
echo "  nmap        - Network scanner"
echo "  sqlmap      - SQL injection tool"
echo "  john        - Password cracker"
echo "  hydra       - Login cracker"
echo "  binwalk     - Firmware analyzer"
echo "  nikto       - Web scanner"
echo "  aircrack-ng - WiFi security"
echo ""
echo "For GUI tools, install NetHunter KeX from NetHunter Store"
TOOLS
    
    chmod +x "$BUILD_DIR/mnt/data/data/com.termux/files/home/install-tianos-tools.sh"
    
    log "Security tools installer created"
}

build_flashable_zip() {
    log "Building flashable zip..."
    
    # Create update-binary for TWRP
    mkdir -p "$BUILD_DIR/zip/META-INF/com/google/android"
    
    cat > "$BUILD_DIR/zip/META-INF/com/google/android/update-binary" << 'BINARY'
#!/sbin/sh

# TianOS Recovery Script
OUTFD=/proc/self/fd/$2

ui_print() {
    echo "ui_print $1" > "$OUTFD"
    echo "ui_print" > "$OUTFD"
}

set_progress() {
    echo "set_progress $1" > "$OUTFD"
}

ui_print "========================================="
ui_print "      TianOS v0.1 Installation         "
ui_print "========================================="
ui_print ""
ui_print "Installing TianOS on your device..."
ui_print ""

# Mount partitions
mount /system
mount /data

set_progress 0.1

# Extract system files
ui_print "- Extracting system files..."
unzip -o "$ZIPFILE" -d /tmp/tianos

set_progress 0.3

# Apply system overlay
ui_print "- Applying TianOS customizations..."
if [ -d "/tmp/tianos/system-overlay" ]; then
    cp -r /tmp/tianos/system-overlay/* /system/ 2>/dev/null || true
fi

set_progress 0.5

# Install apps
ui_print "- Installing TianOS apps..."
if [ -d "/tmp/tianos/apps" ]; then
    cp -r /tmp/tianos/apps/* /system/app/ 2>/dev/null || true
fi

set_progress 0.7

# Setup security tools
ui_print "- Setting up security tools..."
if [ -d "/tmp/tianos/tools" ]; then
    mkdir -p /data/data/com.termux/files/home/tianos-tools
    cp -r /tmp/tianos/tools/* /data/data/com.termux/files/home/tianos-tools/ 2>/dev/null || true
fi

set_progress 0.9

# Set permissions
ui_print "- Setting permissions..."
chmod -R 755 /system/app/TianOSManager 2>/dev/null || true
chmod -R 755 /data/data/com.termux/files/home/tianos-tools 2>/dev/null || true

set_progress 1.0

# Cleanup
rm -rf /tmp/tianos

ui_print ""
ui_print "========================================="
ui_print "  TianOS installation complete!         "
ui_print "========================================="
ui_print ""
ui_print "First boot instructions:"
ui_print "1. Open Termux app"
ui_print "2. Run: ~/install-tianos-tools.sh"
ui_print "3. Wait for tools to install"
ui_print "4. Enjoy TianOS!"
ui_print ""

unmount /system
unmount /data
BINARY
    
    chmod +x "$BUILD_DIR/zip/META-INF/com/google/android/update-binary"
    
    # Create updater-script
    cat > "$BUILD_DIR/zip/META-INF/com/google/android/updater-script" << 'SCRIPT'
#MAGISK
SCRIPT
    
    # Copy overlay files to zip
    cp -r "$ROOTFS_DIR/system-overlay" "$BUILD_DIR/zip/" 2>/dev/null || true
    cp -r "$TOOLS_DIR" "$BUILD_DIR/zip/tools" 2>/dev/null || true
    
    # Create the flashable zip
    cd "$BUILD_DIR/zip"
    zip -r "$OUTPUT_DIR/$FLASHABLE_NAME" . -x "*.git*"
    cd "$SCRIPT_DIR"
    
    log "Flashable zip created: $OUTPUT_DIR/$FLASHABLE_NAME"
}

build_system_image() {
    log "Building raw system image..."
    
    # Use the downloaded GSI and overlay
    cp "$BUILD_DIR/$GSI_FILE" "$OUTPUT_DIR/tianos-system.img"
    
    log "System image created: $OUTPUT_DIR/tianos-system.img"
}

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --quick           Quick build (branding only, no tools)"
    echo "  --with-tools      Include security tools"
    echo "  --with-branding   Include TianOS branding"
    echo "  --system-image    Build raw system image instead of zip"
    echo "  --clean           Clean build artifacts"
    echo "  --help            Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                 # Full build with everything"
    echo "  $0 --quick         # Quick build for testing"
    echo "  $0 --clean         # Clean and rebuild"
}

main() {
    print_banner
    
    local quick=false
    local with_tools=true
    local with_branding=true
    local system_image=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --quick)
                quick=true
                with_tools=false
                shift
                ;;
            --with-tools)
                with_tools=true
                shift
                ;;
            --with-branding)
                with_branding=true
                shift
                ;;
            --system-image)
                system_image=true
                shift
                ;;
            --clean)
                clean_build
                exit 0
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    check_deps
    clean_build
    download_gsi
    
    if [ "$with_branding" = true ]; then
        apply_branding
    fi
    
    if [ "$with_tools" = true ]; then
        install_tools
    fi
    
    install_apps
    
    if [ "$system_image" = true ]; then
        build_system_image
    else
        build_flashable_zip
    fi
    
    log "========================================="
    log "Build complete!"
    log "========================================="
    log ""
    log "Output files:"
    ls -lh "$OUTPUT_DIR/"
    log ""
    log "To install on your tablet:"
    log "  1. Copy $FLASHABLE_NAME to your device"
    log "  2. Use DSU Sideloader or TWRP to flash"
    log "  3. Reboot into TianOS"
}

main "$@"
