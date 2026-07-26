#!/bin/bash
#
# TianOS Password Tools Installer
# Installs password cracking and auditing tools
#

set -e

echo "[*] Installing Password Cracking Tools..."

# Core password tools
pkg install -y john hashcat hydra medusa ncrack || true

# Create password cracking shortcuts
mkdir -p ~/bin

cat > ~/bin/passcrack << 'EOF'
#!/bin/bash
echo "[*] TianOS Password Cracker"
echo "Usage: passcrack <hashfile>"
echo ""
echo "Cracking passwords..."
john --wordlist=/data/data/com.termux/files/usr/share/wordlists/rockyou.txt "$@"
EOF
chmod +x ~/bin/passcrack

cat > ~/bin/bruteforce << 'EOF'
#!/bin/bash
echo "[*] TianOS Login Bruteforcer"
echo "Usage: bruteforce <service> <target>"
echo ""
echo "Example: bruteforce ssh 192.168.1.1"
echo ""
SERVICE=$1
TARGET=$2
WORDLIST="/data/data/com.termux/files/usr/share/wordlists/rockyou.txt"

if [ -z "$SERVICE" ] || [ -z "$TARGET" ]; then
    echo "Usage: bruteforce <service> <target>"
    echo "Services: ssh, ftp, http, mysql, mssql, vnc"
    exit 1
fi

hydra -L /data/data/com.termux/files/usr/share/wordlists/usernames.txt -P "$WORDLIST" "$TARGET" "$SERVICE"
EOF
chmod +x ~/bin/bruteforce

cat > ~/bin/hashid << 'EOF'
#!/bin/bash
echo "[*] TianOS Hash Identifier"
echo "Usage: hashid <hash>"
echo ""
hash-identifier 2>/dev/null || echo "Install hash-identifier: pip install hash-identifier"
EOF
chmod +x ~/bin/hashid

echo "[+] Password cracking tools installed successfully!"
echo ""
echo "Available commands:"
echo "  passcrack <file>    - Password cracker"
echo "  bruteforce <svc> <t> - Login bruteforcer"
echo "  hashid <hash>       - Hash identifier"
echo "  john                - John the Ripper"
echo "  hashcat             - GPU password cracker"
echo "  hydra               - Network login cracker"
