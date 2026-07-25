#!/bin/bash
set -euo pipefail

# TechBench - Development Environment Setup
# Tested on: Ubuntu 22.04+, Debian 12+

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         TechBench - Development Setup                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    error "Do not run this script as root"
fi

# Update system
log "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install base dependencies
log "Installing base dependencies..."
sudo apt-get install -y \
    build-essential \
    git \
    curl \
    wget \
    unzip \
    jq \
    tmux \
    vim \
    htop

# Install Rust
if ! command -v cargo &> /dev/null; then
    log "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    log "Rust already installed"
fi

# Install Node.js (via nvm)
if ! command -v node &> /dev/null; then
    log "Installing Node.js..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
else
    log "Node.js already installed"
fi

# Install Python tools
log "Installing Python tools..."
sudo apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    python3-serial \
    python3-pyusb \
    python3-smbus \
    python3-numpy \
    python3-opencv

# Install container runtime (Podman)
log "Installing Podman..."
sudo apt-get install -y \
    podman \
    podman-compose \
    buildah

# Install electronics tools
log "Installing electronics tools..."
sudo apt-get install -y \
    sigrok-firmware-fx2lafw \
    pulseview \
    openhantek \
    openocd \
    kicad \
    ngspice \
    gtkwave \
    i2c-tools \
    spi-tools \
    libgpiod-tools

# Install mobile tools
log "Installing mobile tools..."
sudo apt-get install -y \
    android-tools-adb \
    android-tools-fastboot \
    libimobiledevice6 \
    libimobiledevice-utils \
    ideviceinstaller \
    ifuse \
    usbmuxd

# Install USB/Serial utilities
log "Installing USB/Serial utilities..."
sudo apt-get install -y \
    usbutils \
    usbip \
    linux-tools-generic \
    picocom \
    minicom \
    screen

# Install Tauri dependencies
log "Installing Tauri dependencies..."
sudo apt-get install -y \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev

# Create project structure
log "Creating project structure..."
mkdir -p base/{kernel,boot-modes}
mkdir -p packages/{electronics,mobile-android,mobile-apple,mobile-universal,system}
mkdir -p gui/src/{components,stores,lib}
mkdir -p detection/{usb-scanner,chipset-id,driver-loader}
mkdir -p hal/src
mkdir -p ai/{schematic-overlay,power-analysis,component-id}
mkdir -p database/{schema,api,sync}
mkdir -p containers
mkdir -p hardware
mkdir -p docs/{tool-guides,repair-procedures}
mkdir -p scripts/ci

# Make scripts executable
chmod +x scripts/*.sh 2>/dev/null || true

# Create initial package.json for GUI
log "Initializing GUI project..."
cd gui
cat > package.json << 'EOF'
{
  "name": "benchpanel",
  "version": "0.1.0",
  "description": "TechBench Unified GUI",
  "private": true,
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.20.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.56.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
EOF
cd ..

# Initialize Rust HAL project
log "Initializing HAL project..."
cd hal
cat > Cargo.toml << 'EOF'
[package]
name = "techbench-hal"
version = "0.1.0"
edition = "2021"

[dependencies]
rusb = "0.9"
serialport = "4.3"
gpio-cdev = "0.5"
gpiocdev = "0.6"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
log = "0.4"
env_logger = "0.11"
thiserror = "1"
EOF
cd ..

# Create chipset database template
log "Creating chipset database template..."
cat > detection/chipset-id/database.json << 'EOF'
{
  "05c6:90db": {
    "vendor": "qualcomm",
    "chipset": "snapdragon",
    "name": "Qualcomm QDLoader 9008",
    "boot_modes": ["edl", "normal"],
    "tools": ["qfil", "firehose", "sahara"],
    "container": "qualcomm-edl"
  },
  "0e8d:0003": {
    "vendor": "mediatek",
    "chipset": "mtk",
    "name": "MediaTek Preloader",
    "boot_modes": ["preloader", "normal"],
    "tools": ["sp-flash-tool", "mtk-daemon"],
    "container": "mediatek-flash"
  },
  "04e8:6860": {
    "vendor": "samsung",
    "chipset": "exynos",
    "name": "Samsung Download Mode",
    "boot_modes": ["odin", "normal"],
    "tools": ["heimdall", "odin"],
    "container": "samsung-odin"
  },
  "05ac:1227": {
    "vendor": "apple",
    "chipset": "a-series",
    "name": "Apple DFU Mode",
    "boot_modes": ["dfu", "recovery", "normal"],
    "tools": ["idevicerestore", "checkm8"],
    "container": "apple-tools"
  }
}
EOF

log "Development environment setup complete!"
echo ""
echo "Next steps:"
echo "  1. Install Rust tools:  cargo install tauri-cli"
echo "  2. Setup GUI:           cd gui && npm install"
echo "  3. Build HAL:           cd hal && cargo build"
echo "  4. Read docs:           cat docs/getting-started.md"
echo ""
echo "Happy hacking! 🔧"
