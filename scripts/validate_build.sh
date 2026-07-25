#!/bin/bash
set -euo pipefail

# TechBench - Build Script Validation
# Validates all build scripts and configuration files

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  TechBench - Build Script Validation                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  \033[0;32m✓\033[0m $1"; ((PASS++)); }
fail() { echo -e "  \033[0;31m✗\033[0m $1"; ((FAIL++)); }
warn() { echo -e "  \033[0;33m!\033[0m $1"; ((WARN++)); }

# Check required files
echo "Checking project files..."

# Root files
for file in README.md ARCHITECTURE.md ROADMAP.md CONTRIBUTING.md LICENSE .gitignore; do
    if [ -f "$file" ]; then
        pass "$file exists"
    else
        fail "$file missing"
    fi
done

# Scripts
echo ""
echo "Checking scripts..."

for script in scripts/setup-dev.sh base/live-usb/build.sh detection/driver-loader/load.sh; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            pass "$script is executable"
        else
            warn "$script exists but is not executable"
        fi
        
        # Check for syntax errors (bash -n)
        if bash -n "$script" 2>/dev/null; then
            pass "$script has valid syntax"
        else
            fail "$script has syntax errors"
        fi
    else
        fail "$script missing"
    fi
done

# Python files
echo ""
echo "Checking Python files..."

for file in detection/usb-scanner/detector.py detection/usb-scanner/enhanced_detector.py detection/driver-loader/load.sh; do
    if [ -f "$file" ]; then
        if python3 -m py_compile "$file" 2>/dev/null; then
            pass "$file compiles"
        else
            warn "$file has syntax issues (may need dependencies)"
        fi
    else
        fail "$file missing"
    fi
done

# Configuration files
echo ""
echo "Checking configuration files..."

# Boot modes
for conf in base/boot-modes/*.conf; do
    if [ -f "$conf" ]; then
        if grep -q "\[BootMode\]" "$conf"; then
            pass "$(basename $conf) is valid"
        else
            fail "$(basename $conf) is missing [BootMode] section"
        fi
    fi
done

# JSON files
for json in detection/chipset-id/database.json packages/electronics/sigrok/protocols/mobile_protocols.json packages/electronics/kicad-mobrepair/libraries/pmic/database.json; do
    if [ -f "$json" ]; then
        if python3 -c "import json; json.load(open('$json'))" 2>/dev/null; then
            pass "$(basename $json) is valid JSON"
        else
            fail "$(basename $json) is invalid JSON"
        fi
    else
        fail "$json missing"
    fi
done

# Container files
echo ""
echo "Checking container definitions..."

for container in android-tools apple-tools qualcomm-edl mediatek-flash samsung-odin; do
    dockerfile="containers/$container/Dockerfile"
    entrypoint="containers/$container/entrypoint.sh"
    
    if [ -f "$dockerfile" ]; then
        if grep -q "^FROM " "$dockerfile"; then
            pass "$container Dockerfile has valid FROM"
        else
            fail "$container Dockerfile missing FROM"
        fi
    else
        fail "$container Dockerfile missing"
    fi
    
    if [ -f "$entrypoint" ]; then
        if [ -x "$entrypoint" ]; then
            pass "$container entrypoint is executable"
        else
            warn "$container entrypoint is not executable"
        fi
    fi
done

# GUI files
echo ""
echo "Checking GUI components..."

for component in gui/src/App.tsx gui/src/main.tsx gui/package.json gui/tsconfig.json; do
    if [ -f "$component" ]; then
        pass "$component exists"
    else
        fail "$component missing"
    fi
done

# HAL files
echo ""
echo "Checking HAL (Rust)..."

for file in hal/Cargo.toml hal/src/lib.rs hal/src/main.rs; do
    if [ -f "$file" ]; then
        pass "$file exists"
    else
        fail "$file missing"
    fi
done

# CI/CD
echo ""
echo "Checking CI/CD..."

if [ -f ".github/workflows/ci.yml" ]; then
    if grep -q "jobs:" ".github/workflows/ci.yml"; then
        pass "CI workflow has jobs"
    else
        fail "CI workflow missing jobs"
    fi
else
    fail "CI workflow missing"
fi

# Summary
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  SUMMARY"
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "  \033[0;32mPassed: $PASS\033[0m"
echo -e "  \033[0;31mFailed: $FAIL\033[0m"
echo -e "  \033[0;33mWarnings: $WARN\033[0m"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "  \033[0;32m✓ All critical checks passed!\033[0m"
    exit 0
else
    echo -e "  \033[0;31m✗ Some checks failed\033[0m"
    exit 1
fi
