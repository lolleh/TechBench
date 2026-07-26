#!/bin/bash
#
# TianOS Test Script
# Tests the build system and verifies components
#

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}[+] TianOS Test Suite${NC}"
echo ""

# Test 1: Check directory structure
echo -e "${YELLOW}Test 1: Directory Structure${NC}"
if [ -d "$SCRIPT_DIR/config" ] && [ -d "$SCRIPT_DIR/tools" ] && [ -d "$SCRIPT_DIR/rootfs" ]; then
    echo -e "${GREEN}  ✓ Directory structure OK${NC}"
else
    echo -e "${RED}  ✗ Directory structure incomplete${NC}"
fi

# Test 2: Check build script
echo -e "${YELLOW}Test 2: Build Script${NC}"
if [ -f "$SCRIPT_DIR/build.sh" ] && [ -x "$SCRIPT_DIR/build.sh" ]; then
    echo -e "${GREEN}  ✓ Build script exists and is executable${NC}"
else
    echo -e "${RED}  ✗ Build script missing or not executable${NC}"
fi

# Test 3: Check tools installer
echo -e "${YELLOW}Test 3: Tools Installer${NC}"
if [ -f "$SCRIPT_DIR/tools/install-tools.sh" ] && [ -x "$SCRIPT_DIR/tools/install-tools.sh" ]; then
    echo -e "${GREEN}  ✓ Tools installer exists and is executable${NC}"
else
    echo -e "${RED}  ✗ Tools installer missing or not executable${NC}"
fi

# Test 4: Check configuration
echo -e "${YELLOW}Test 4: Configuration Files${NC}"
if [ -f "$SCRIPT_DIR/config/tianos.prop" ]; then
    echo -e "${GREEN}  ✓ Configuration files exist${NC}"
else
    echo -e "${RED}  ✗ Configuration files missing${NC}"
fi

# Test 5: Check output directory
echo -e "${YELLOW}Test 5: Output Directory${NC}"
mkdir -p "$SCRIPT_DIR/output"
if [ -d "$SCRIPT_DIR/output" ]; then
    echo -e "${GREEN}  ✓ Output directory ready${NC}"
else
    echo -e "${RED}  ✗ Cannot create output directory${NC}"
fi

# Test 6: Build test (dry run)
echo -e "${YELLOW}Test 6: Build System Test${NC}"
if bash -n "$SCRIPT_DIR/build.sh" 2>/dev/null; then
    echo -e "${GREEN}  ✓ Build script syntax OK${NC}"
else
    echo -e "${RED}  ✗ Build script has syntax errors${NC}"
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Test Suite Complete!                   ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "To build TianOS, run:"
echo "  ./build.sh"
echo ""
echo "To build with options:"
echo "  ./build.sh --quick          # Quick build"
echo "  ./build.sh --with-tools     # With security tools"
echo "  ./build.sh --clean          # Clean and rebuild"
echo ""
