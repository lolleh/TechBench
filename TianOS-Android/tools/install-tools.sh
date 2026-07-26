#!/bin/bash
#
# TianOS Security Tools Installer
# Run this script in Termux to install all security tools
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
    echo -e "${CYAN}"
    cat << "EOF"
  _____ _____ _____  ___ ____  _   _ ______     __
 |_   _| ____|_   _|/ _ \___ \| | | |  _ \ \   / /
   | | |  _|   | || | | |__) | | | | |_) \ \ / /
   | | | |___  | || |_| / __/| |_| |  __/ \ V /
   |_| |_____| |_| \___/_____| \___/|_|     \_/
   
   Security Tools Installer
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

install_core() {
    log "Installing core packages..."
    pkg update -y
    pkg upgrade -y
    pkg install -y \
        wget \
        curl \
        git \
        python \
        python-pip \
        ruby \
        build-essential \
        clang \
        make \
        pkg-config \
        libxml2 \
        libxslt \
        libffi \
        openssl
}

install_network_tools() {
    log "Installing network analysis tools..."
    pkg install -y \
        nmap \
        masscan \
        hping3 \
        netcat-openbsd \
        socat \
        tcpdump \
        dnsutils \
        whois \
        traceroute \
        mtr \
        arp-scan \
        net-tools
}

install_web_tools() {
    log "Installing web security tools..."
    
    # Core web tools
    pkg install -y \
        sqlmap \
        nikto \
        dirb \
        whatweb \
        curl \
        wget
    
    # Install additional Python web tools
    pip install --break-system-packages \
        requests \
        beautifulsoup4 \
        scapy \
        impacket
}

install_forensics_tools() {
    log "Installing forensics tools..."
    pkg install -y \
        binwalk \
        foremost \
        strings \
        file \
        hexdump \
       xxd \
        unzip \
        p7zip \
        sleuthkit \
        autopsy || true
    
    # Python forensics tools
    pip install --break-system-packages \
        volatility3 \
        yara-python \
        capstone \
        keystone-engine
}

install_password_tools() {
    log "Installing password cracking tools..."
    pkg install -y \
        john \
        hashcat \
        hydra \
        medusa \
        ncrack \
        ophcrack || true
}

install_wireless_tools() {
    log "Installing wireless security tools..."
    pkg install -y \
        aircrack-ng \
        reaver \
        wifite2 \
        kismet \
        pixiewps \
        bully \
        cowpatty || true
    
    warn "Wireless tools may require a compatible USB WiFi adapter"
}

install_reverse_eng() {
    log "Installing reverse engineering tools..."
    pkg install -y \
        gdb \
        radare2 \
        strace \
        ltrace \
        objdump \
        readelf \
        nm \
        ltrace
    
    # Ghidra (if available)
    pip install --break-system-packages \
        ghidra-bridge || true
}

install_utilities() {
    log "Installing utility packages..."
    pkg install -y \
        tmux \
        screen \
        vim \
        nano \
        htop \
        tree \
        jq \
        sed \
        awk \
        grep \
        findutils \
        util-linux
}

create_shortcuts() {
    log "Creating command shortcuts..."
    
    mkdir -p ~/bin
    
    # Network scan shortcut
    cat > ~/bin/scan << 'SCAN'
#!/bin/bash
echo "[*] TianOS Network Scanner"
echo "Usage: scan <target>"
echo ""
nmap -sV -sC -O "$@"
SCAN
    chmod +x ~/bin/scan
    
    # SQL injection shortcut
    cat > ~/bin/sqlcheck << 'SQL'
#!/bin/bash
echo "[*] TianOS SQL Injection Checker"
echo "Usage: sqlcheck <url>"
echo ""
sqlmap -u "$1" --batch --level=3 --risk=2
SQL
    chmod +x ~/bin/sqlcheck
    
    # Password crack shortcut
    cat > ~/bin/crack << 'CRACK'
#!/bin/bash
echo "[*] TianOS Password Cracker"
echo "Usage: crack <hashfile>"
echo ""
john --wordlist=/data/data/com.termux/files/usr/share/wordlists/rockyou.txt "$@"
CRACK
    chmod +x ~/bin/crack
    
    # Firmware analysis shortcut
    cat > ~/bin/firmware << 'FW'
#!/bin/bash
echo "[*] TianOS Firmware Analyzer"
echo "Usage: firmware <file>"
echo ""
binwalk "$@"
FW
    chmod +x ~/bin/firmware
    
    # Add ~/bin to PATH
    echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
    echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc 2>/dev/null || true
}

install_wordlists() {
    log "Installing wordlists..."
    
    mkdir -p /data/data/com.termux/files/usr/share/wordlists
    
    # Download SecLists
    cd /data/data/com.termux/files/usr/share/wordlists
    wget -q https://github.com/danielmiessler/SecLists/archive/master.zip -O seclists.zip
    unzip -q seclists.zip
    mv SecLists-master seclists
    rm seclists.zip
    
    # Create symlinks for common wordlists
    ln -sf seclists/Passwords/Leaked-Databases/rockyou.txt rockyou.txt 2>/dev/null || true
    
    cd ~
}

print_summary() {
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}  TianOS Tools Installation Complete!   ${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo -e "${CYAN}Installed Categories:${NC}"
    echo "  ✓ Network Analysis (nmap, masscan, hping3)"
    echo "  ✓ Web Security (sqlmap, nikto, dirb)"
    echo "  ✓ Forensics (binwalk, foremost, volatility)"
    echo "  ✓ Password Cracking (john, hashcat, hydra)"
    echo "  ✓ Wireless Security (aircrack-ng, reaver)"
    echo "  ✓ Reverse Engineering (gdb, radare2)"
    echo "  ✓ Utilities (tmux, vim, htop)"
    echo ""
    echo -e "${CYAN}Quick Commands:${NC}"
    echo "  scan <target>      - Network scanner"
    echo "  sqlcheck <url>     - SQL injection checker"
    echo "  crack <hashfile>   - Password cracker"
    echo "  firmware <file>    - Firmware analyzer"
    echo ""
    echo -e "${CYAN}Wordlists:${NC}"
    echo "  /data/data/com.termux/files/usr/share/wordlists/"
    echo ""
    echo -e "${YELLOW}Note: Some tools may require additional setup.${NC}"
    echo -e "${YELLOW}For GUI tools, install NetHunter KeX from NetHunter Store.${NC}"
    echo ""
}

main() {
    print_banner
    
    log "Starting TianOS Security Tools Installation..."
    echo ""
    
    install_core
    install_network_tools
    install_web_tools
    install_forensics_tools
    install_password_tools
    install_wireless_tools
    install_reverse_eng
    install_utilities
    create_shortcuts
    install_wordlists
    
    print_summary
}

main "$@"
