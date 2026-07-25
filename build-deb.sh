#!/bin/bash
# TechBench .deb build script
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/debian"
OUTPUT_DIR="$SCRIPT_DIR/dist"
VERSION="0.1.0"
ARCH="amd64"
PACKAGE_NAME="techbench_${VERSION}_${ARCH}"

echo "=== TechBench .deb Package Builder ==="
echo ""

# Ensure build deps are installed
echo "[1/7] Checking build dependencies..."
for tool in dpkg-deb fakeroot; do
    if ! command -v "$tool" &>/dev/null; then
        echo "Installing $tool..."
        sudo apt install -y "$tool" 2>/dev/null || true
    fi
done

# Verify source files exist
echo "[2/7] Verifying source files..."
if [ ! -f "$BUILD_DIR/DEBIAN/control" ]; then
    echo "ERROR: debian/DEBIAN/control not found"
    exit 1
fi

# Copy GUI build output
echo "[3/7] Copying built frontend assets..."
mkdir -p "$BUILD_DIR/usr/share/techbench/gui"
cp -r "$SCRIPT_DIR/gui/dist" "$BUILD_DIR/usr/share/techbench/gui/"
cp "$SCRIPT_DIR/gui/package.json" "$BUILD_DIR/usr/share/techbench/gui/"

# Copy Python modules
echo "[4/7] Copying Python modules..."
cp -r "$SCRIPT_DIR/ai" "$BUILD_DIR/usr/share/techbench/"
cp -r "$SCRIPT_DIR/detection" "$BUILD_DIR/usr/share/techbench/"
cp -r "$SCRIPT_DIR/database" "$BUILD_DIR/usr/share/techbench/"
cp -r "$SCRIPT_DIR/scripts" "$BUILD_DIR/usr/share/techbench/"

# Remove test files and __pycache__ from package
find "$BUILD_DIR/usr/share/techbench" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR/usr/share/techbench" -type f -name "test_*.py" -delete 2>/dev/null || true
find "$BUILD_DIR/usr/share/techbench" -type f -name "setup.py" -delete 2>/dev/null || true
find "$BUILD_DIR/usr/share/techbench" -type f -name "*.pyc" -delete 2>/dev/null || true

# Copy Rust binaries if built
if [ -d "$SCRIPT_DIR/target/release" ]; then
    echo "[5/7] Copying Rust binaries..."
    mkdir -p "$BUILD_DIR/usr/share/techbench/bin"
    for bin in hal-cli db-cli techbench-hal techbench-db; do
        if [ -f "$SCRIPT_DIR/target/release/$bin" ]; then
            cp "$SCRIPT_DIR/target/release/$bin" "$BUILD_DIR/usr/share/techbench/bin/"
        fi
    done
else
    echo "[5/7] Skipping Rust binaries (not built)"
    mkdir -p "$BUILD_DIR/usr/share/techbench/bin"
fi

# Set permissions
echo "[6/7] Setting permissions..."
chmod 755 "$BUILD_DIR/DEBIAN/postinst"
chmod 755 "$BUILD_DIR/DEBIAN/postrm"
chmod 755 "$BUILD_DIR/DEBIAN/preinst"
chmod 644 "$BUILD_DIR/lib/udev/rules.d/99-techbench.rules"
chmod 644 "$BUILD_DIR/usr/share/applications/techbench.desktop"
chmod 644 "$BUILD_DIR/usr/share/metainfo/techbench.appdata.xml"

# Calculate installed size (in KB)
INSTALLED_SIZE=$(du -sk "$BUILD_DIR" --exclude="$BUILD_DIR/DEBIAN" | cut -f1)
sed -i '/^Installed-Size:/d' "$BUILD_DIR/DEBIAN/control"
echo "Installed-Size: $INSTALLED_SIZE" >> "$BUILD_DIR/DEBIAN/control"
echo "Installed size: ${INSTALLED_SIZE} KB"

# Build the package
echo "[7/7] Building .deb package..."
mkdir -p "$OUTPUT_DIR"

fakeroot dpkg-deb --build "$BUILD_DIR" "$OUTPUT_DIR/$PACKAGE_NAME.deb"

echo ""
echo "=== Build Complete ==="
echo ""
echo "Package: $OUTPUT_DIR/$PACKAGE_NAME.deb"
echo "Size: $(du -h "$OUTPUT_DIR/$PACKAGE_NAME.deb" | cut -f1)"
echo ""
echo "Install with:"
echo "  sudo dpkg -i $OUTPUT_DIR/$PACKAGE_NAME.deb"
echo "  sudo apt install -f  # Fix any missing dependencies"
echo ""
echo "Launch with:"
echo "  techbench"
echo ""
