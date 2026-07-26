#!/bin/bash
#
# TianOS DSU (Dynamic System Updates) Setup Guide
# Instructions for installing TianOS without bootloader unlock
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
cat << "EOF"
  _____ _____ _____  ___ ____  _   _ ______     __
 |_   _| ____|_   _|/ _ \___ \| | | |  _ \ \   / /
   | | |  _|   | || | | |__) | | | | |_) \ \ / /
   | | | |___  | || |_| / __/| |_| |  __/ \ V /
   |_| |_____| |_| \___/_____| \___/|_|     \_/
   
   DSU Installation Guide
EOF
echo -e "${NC}"

echo -e "${GREEN}[+] TianOS DSU Installation Guide${NC}"
echo ""
echo "This guide will help you install TianOS using Dynamic System Updates"
echo "without unlocking your bootloader."
echo ""
echo -e "${YELLOW}Requirements:${NC}"
echo "  - Android 10+ device"
echo "  - DSU Sideloader app (from Play Store or GitHub)"
echo "  - TianOS zip file"
echo "  - USB cable"
echo ""
echo -e "${YELLOW}Step 1: Download Required Apps${NC}"
echo "  1. Install DSU Sideloader from:"
echo "     https://github.com/nicknormandin/DSU-Sideloader/releases"
echo "  2. Install Termux from:"
echo "     https://github.com/termux/termux-app/releases"
echo ""
echo -e "${YELLOW}Step 2: Enable Developer Options${NC}"
echo "  1. Go to Settings > About Phone"
echo "  2. Tap 'Build Number' 7 times"
echo "  3. Go to Settings > Developer Options"
echo "  4. Enable 'USB Debugging'"
echo "  5. Enable 'Wireless Debugging' (optional)"
echo ""
echo -e "${YELLOW}Step 3: Sideload TianOS${NC}"
echo "  1. Open DSU Sideloader app"
echo "  2. Select the TianOS zip file"
echo "  3. Choose 'Dynamic System' as the target"
echo "  4. Tap 'Install' or 'Sideload'"
echo "  5. Wait for installation to complete"
echo ""
echo -e "${YELLOW}Step 4: Boot into TianOS${NC}"
echo "  1. Reboot your device"
echo "  2. You should see a boot menu"
echo "  3. Select 'TianOS' or 'Dynamic System'"
echo "  4. First boot may take 2-3 minutes"
echo ""
echo -e "${YELLOW}Step 5: First Boot Setup${NC}"
echo "  1. Complete the Android setup wizard"
echo "  2. Open Termux app"
echo "  3. Run: ~/install-tianos-tools.sh"
echo "  4. Wait for tools to install"
echo ""
echo -e "${YELLOW}Reverting to Stock:${NC}"
echo "  1. Reboot your device"
echo "  2. Select 'Android' or 'Stock' from boot menu"
echo "  3. Or use DSU Sideloader to remove TianOS"
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  TianOS DSU Setup Complete!            ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "For more information, see the README.md file"
echo ""
