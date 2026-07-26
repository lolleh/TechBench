#!/bin/bash
#
# TianOS Web Security Tools Installer
# Installs web application security testing tools
#

set -e

echo "[*] Installing Web Security Tools..."

# Core web tools
pkg install -y sqlmap nikto dirb whatweb curl wget

# Install additional Python web tools
pip install --break-system-packages \
    requests \
    beautifulsoup4 \
    mechanicalsoup \
    httpie \
    wpscan || true

# Create web security shortcuts
mkdir -p ~/bin

cat > ~/bin/webscan << 'EOF'
#!/bin/bash
echo "[*] TianOS Web Scanner"
echo "Usage: webscan <url>"
echo ""
nikto -h "$@"
EOF
chmod +x ~/bin/webscan

cat > ~/bin/sqli << 'EOF'
#!/bin/bash
echo "[*] TianOS SQL Injection Tester"
echo "Usage: sqli <url>"
echo ""
sqlmap -u "$1" --batch --level=3 --risk=2 --random-agent
EOF
chmod +x ~/bin/sqli

cat > ~/bin/dirsearch << 'EOF'
#!/bin/bash
echo "[*] TianOS Directory Searcher"
echo "Usage: dirsearch <url>"
echo ""
dirb "$@"
EOF
chmod +x ~/bin/dirsearch

cat > ~/bin/websource << 'EOF'
#!/bin/bash
echo "[*] TianOS Web Technology Detector"
echo "Usage: websource <url>"
echo ""
whatweb "$@"
EOF
chmod +x ~/bin/websource

echo "[+] Web security tools installed successfully!"
echo ""
echo "Available commands:"
echo "  webscan <url>       - Web server scanner"
echo "  sqli <url>          - SQL injection tester"
echo "  dirsearch <url>     - Directory searcher"
echo "  websource <url>     - Web technology detector"
echo "  nikto               - Web server scanner"
echo "  sqlmap              - SQL injection tool"
echo "  dirb                - Directory bruteforcer"
