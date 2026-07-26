#!/bin/bash
#
# TianOS Forensics Tools Installer
# Installs digital forensics and analysis tools
#

set -e

echo "[*] Installing Forensics Tools..."

# Core forensics tools
pkg install -y binwalk foremost strings file hexdump xxd unzip p7zip

# Sleuth Kit (if available)
pkg install -y sleuthkit || echo "[-] Sleuth Kit not available in this repo"

# Install Python forensics tools
pip install --break-system-packages \
    volatility3 \
    yara-python \
    capstone \
    keystone-engine \
    unicorn || true

# Create forensics shortcuts
mkdir -p ~/bin

cat > ~/bin/firmware << 'EOF'
#!/bin/bash
echo "[*] TianOS Firmware Analyzer"
echo "Usage: firmware <file>"
echo ""
echo "Analyzing firmware file..."
binwalk "$@"
EOF
chmod +x ~/bin/firmware

cat > ~/bin/filetype << 'EOF'
#!/bin/bash
echo "[*] TianOS File Type Detector"
echo "Usage: filetype <file>"
echo ""
file "$1"
echo ""
echo "Hex dump (first 64 bytes):"
xxd -l 64 "$1"
EOF
chmod +x ~/bin/filetype

cat > ~/bin/strings-extract << 'EOF'
#!/bin/bash
echo "[*] TianOS String Extractor"
echo "Usage: strings-extract <file>"
echo ""
strings "$@" | head -100
EOF
chmod +x ~/bin/strings-extract

cat > ~/bin/recover << 'EOF'
#!/bin/bash
echo "[*] TianOS File Recovery"
echo "Usage: recover <directory>"
echo ""
echo "Scanning for recoverable files..."
foremost -i "$1" -o ./recovered_files
echo "Recovered files saved to ./recovered_files/"
EOF
chmod +x ~/bin/recover

echo "[+] Forensics tools installed successfully!"
echo ""
echo "Available commands:"
echo "  firmware <file>     - Firmware analyzer"
echo "  filetype <file>     - File type detector"
echo "  strings-extract <f> - String extractor"
echo "  recover <dir>       - File recovery"
echo "  binwalk             - Firmware analysis"
echo "  foremost            - File recovery"
echo "  strings             - String extraction"
