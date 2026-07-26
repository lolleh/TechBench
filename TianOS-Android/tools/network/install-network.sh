#!/bin/bash
#
# TianOS Network Tools Installer
# Installs network analysis and security tools
#

set -e

echo "[*] Installing Network Analysis Tools..."

# Core network tools
pkg install -y nmap masscan hping3 netcat-openbsd socat tcpdump

# Network utilities
pkg install -y dnsutils whois traceroute mtr arp-scan net-tools

# Install additional Python network tools
pip install --break-system-packages scapy impacket python-nmap

# Create network scan shortcuts
mkdir -p ~/bin

cat > ~/bin/portscan << 'EOF'
#!/bin/bash
echo "[*] TianOS Port Scanner"
echo "Usage: portscan <target> [options]"
echo ""
echo "Examples:"
echo "  portscan 192.168.1.1"
echo "  portscan 192.168.1.0/24 -p 80,443"
echo ""
nmap -sV -sC -O "$@"
EOF
chmod +x ~/bin/portscan

cat > ~/bin/vulnscan << 'EOF'
#!/bin/bash
echo "[*] TianOS Vulnerability Scanner"
echo "Usage: vulnscan <target>"
echo ""
nmap --script vuln "$@"
EOF
chmod +x ~/bin/vulnscan

cat > ~/bin/netdiscovery << 'EOF'
#!/bin/bash
echo "[*] TianOS Network Discovery"
echo "Usage: netdiscovery [network]"
echo ""
TARGET=${1:-"$(ip route show default | awk '/default/ {print $3}' | sed 's/\.[0-9]*$/.0/24')"}
echo "Scanning network: $TARGET"
nmap -sn "$TARGET"
EOF
chmod +x ~/bin/netdiscovery

echo "[+] Network tools installed successfully!"
echo ""
echo "Available commands:"
echo "  portscan <target>    - Port scanner"
echo "  vulnscan <target>    - Vulnerability scanner"
echo "  netdiscovery [net]   - Network discovery"
echo "  nmap                 - Full-featured scanner"
echo "  masscan              - Fast port scanner"
echo "  hping3               - Packet crafter"
echo "  tcpdump              - Packet capture"
