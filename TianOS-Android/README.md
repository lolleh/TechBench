# TianOS-Android

**A security-focused Android OS combining Android's usability with Kali Linux's penetration testing tools.**

Based on Android 15 GSI with TianOS security tools pre-installed.

---

## Features

- **Android 15 Base** — Latest AOSP with GSI compatibility
- **Security Tools** — Nmap, SQLmap, John the Ripper, Binwalk, and more
- **Termux Pre-installed** — Full Linux terminal on Android
- **NetHunter Store** — Access to additional security apps
- **No Root Required** — Works on stock bootloader (via DSU)
- **Easy Revert** — Simply reboot to go back to stock

## Supported Devices

| Device | Chipset | Status |
|--------|---------|--------|
| Lenovo Tab M11 (TB330FU) | MediaTek Helio G88 | ✅ Tested |
| Any ARM64 A/B device | Various | Should work |

## Quick Start

### Option 1: DSU (No Bootloader Unlock Required)

1. Build the TianOS zip: `./build.sh`
2. Install DSU Sideloader app on your tablet
3. Sideload the TianOS zip
4. Reboot into TianOS

### Option 2: TWRP (Requires Bootloader Unlock)

1. Build the TianOS zip: `./build.sh`
2. Boot into TWRP recovery
3. Flash `output/TianOS-v0.1.zip`
4. Reboot

### Option 3: Fastboot (Requires Bootloader Unlock)

1. Build the system image: `./build.sh --system-image`
2. Flash via fastboot: `fastboot flash system output/system.img`

## Building

### Prerequisites

- Linux PC (Ubuntu 22.04+)
- 50GB+ free storage
- Internet connection
- ADB/Fastboot tools

### Build Commands

```bash
# Full build (creates flashable zip)
./build.sh

# Build with specific options
./build.sh --with-tools        # Include security tools
./build.sh --with-branding     # Include TianOS branding
./build.sh --system-image      # Build raw system image
./build.sh --clean             # Clean build artifacts

# Quick build (no tools, branding only)
./build.sh --quick
```

## Included Security Tools

### Network Analysis
- Nmap — Network scanner
- tcpdump — Packet analyzer
- hping3 — Network tool
- Netcat — TCP/UDP utility

### Web Security
- SQLmap — SQL injection
- Nikto — Web server scanner
- Dirb — Directory scanner
- WhatWeb — Web technology detector

### Forensics
- Binwalk — Firmware analyzer
- Foremost — File recovery
- Strings — String extraction

### Password Cracking
- John the Ripper — Password cracker
- Hydra — Login cracker
- Medusa — Parallel login cracker

### Wireless
- Aircrack-ng — WiFi security
- Reaver — WPS attack
- Wifite — Automated wireless audit

## Project Structure

```
TianOS-Android/
├── build.sh              # Main build script
├── config/               # Configuration files
│   ├── tianos.prop       # System properties
│   └── overlay.prop      # Build overlay settings
├── tools/                # Security tools scripts
│   ├── install-tools.sh  # Tools installer
│   ├── network/          # Network tools
│   ├── forensics/        # Forensics tools
│   ├── password/         # Password tools
│   └── web/              # Web security tools
├── apps/                 # Pre-installed APKs
├── rootfs/               # System overlay files
│   ├── system-overlay/   # Custom system files
│   └── data/             # Pre-configured data
└── output/               # Build output
    └── TianOS-v0.1.zip   # Flashable zip
```

## How It Works

TianOS-Android works by:

1. **Downloading** an A15 GSI (Generic System Image)
2. **Extracting** the system partition
3. **Overlaying** TianOS customizations (branding, tools, apps)
4. **Repackaging** as a flashable zip
5. **Installing** via DSU or TWRP

This approach means:
- No kernel compilation needed
- Compatible with any A/B ARM64 device
- Easy to update (just rebuild with newer GSI)
- Can revert to stock by rebooting

## Troubleshooting

### Boot Animation Stuck
- Boot to recovery and wipe cache/dalvik
- Or reboot to go back to stock

### Tools Not Working
- Open Termux and run: `pkg update && pkg upgrade`
- Some tools need additional setup — see tool-specific docs

### WiFi Issues
- A15 GSI WiFi is confirmed working on Tab M11
- If issues occur, try a different GSI variant

## License

MIT License — See [LICENSE](../LICENSE) for details.

---

**TianOS** — Stealthy. Powerful. Invisible when needed.
