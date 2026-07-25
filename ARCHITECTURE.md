# TechBench - Architecture & Implementation Plan

## Project Vision

**TechBench** is a specialized Linux distribution designed for electronics engineers and mobile device technicians. It bridges traditional bench electronics (oscilloscopes, logic analyzers, multimeters) with modern mobile device servicing (Android flashing, iOS recovery, chip-off repair).

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TechBench                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │  Desktop     │  │  Mobile     │  │  Electronics│  │  Combined │  │
│  │  Mode        │  │  Service    │  │  Bench      │  │  Mode     │  │
│  │  (Standard)  │  │  Mode       │  │  Mode       │  │  (All)    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Unified GUI (BenchPanel)                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │   │
│  │  │ Device   │ │ Signal   │ │ Schematic│ │ Power    │      │   │
│  │  │ Manager  │ │ Analyzer │ │ Viewer   │ │ Monitor  │      │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           Auto-Detection Engine                              │   │
│  │  USB Enumeration → Chipset ID → Driver Loading → Workspace  │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ Android     │  │ Apple       │  │ Qualcomm    │  │ MediaTek  │  │
│  │ Tools       │  │ Tools       │  │ EDL Tools   │  │ SP Tools  │  │
│  │ (Containers)│  │ (Containers)│  │ (Containers)│  │(Containers)│  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           Electronics Instrument Layer                       │   │
│  │  Sigrok │ OpenHantek │ FLIR SDK │ PSU Control │ GPIO/JTAG  │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           Hardware Abstraction Layer (HAL)                   │   │
│  │  USB │ UART │ I2C │ SPI │ JTAG │ SWD │ GPIO │ Thunderbolt  │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Linux Kernel (PREEMPT_RT patches) │ Live USB │ Persistent  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Project Structure

```
tech-bench-os/
├── README.md                    # This file
├── ARCHITECTURE.md              # Detailed architecture
├── ROADMAP.md                   # Phase-by-phase development plan
│
├── base/                        # Base OS configuration
│   ├── kernel/                  # Kernel config and patches
│   │   ├── config-rt            # PREEMPT_RT kernel config
│   │   ├── patches/             # Custom patches
│   │   └── modules/             # Extra kernel modules
│   ├── live-usb/                # Live USB builder scripts
│   │   ├── build.sh             # Main build script
│   │   ├── filesystem.squashfs  # SquashFS config
│   │   └── persistence/         # Persistent storage setup
│   └── boot-modes/              # Boot mode configurations
│       ├── desktop-mode.conf
│       ├── mobile-service.conf
│       ├── electronics-bench.conf
│       └── combined-mode.conf
│
├── packages/                    # Package definitions
│   ├── electronics/             # Electronics tools
│   │   ├── sigrok/              # Logic analyzer suite
│   │   ├── openhantek/          # Oscilloscope software
│   │   ├── openocd/             # JTAG/SWD debugger
│   │   ├── kicad-mobrepair/     # KiCad with mobile libraries
│   │   ├── spice/               # Circuit simulation
│   │   └── flir-sdk/            # Thermal imaging
│   ├── mobile-android/          # Android servicing tools
│   │   ├── adb-enhanced/        # Enhanced ADB wrapper
│   │   ├── fastboot-enhanced/   # Enhanced Fastboot
│   │   ├── qcom-edl/            # Qualcomm EDL tools
│   │   ├── mtk-flash/           # MediaTek flash tools
│   │   ├── samsung-odin/        # Samsung Odin protocol
│   │   └── isp-tools/           # In-System Programming
│   ├── mobile-apple/            # Apple servicing tools
│   │   ├── libimobiledevice/    # iOS communication
│   │   ├── idevice-restore/     # Restore automation
│   │   ├── checkm8-framework/   # Boot exploit framework
│   │   └── uart-access/         # Lightning UART debug
│   ├── mobile-universal/        # Cross-platform tools
│   │   ├── imei-reader/         # Hardware-level IMEI
│   │   ├── baseband-tools/      # Baseband repair
│   │   └── data-recovery/       # Chip-off to USB
│   └── system/                  # System utilities
│       ├── container-runtime/   # Podman/Docker setup
│       ├── serial-monitor/      # Serial port monitor
│       └── power-analysis/      # Power consumption tools
│
├── gui/                         # Unified GUI (BenchPanel)
│   ├── src/
│   │   ├── main/                # Electron/Tauri main process
│   │   ├── renderer/            # UI components
│   │   │   ├── DeviceManager/   # Device detection & workspace
│   │   │   ├── SignalAnalyzer/  # Oscilloscope/logic analyzer
│   │   │   ├── SchematicViewer/ # Schematic overlay system
│   │   │   ├── PowerMonitor/    # PSU & current analysis
│   │   │   ├── Flasher/         # Multi-device flasher
│   │   │   └── Recovery/        # Deep recovery tools
│   │   └── shared/              # Shared utilities
│   ├── package.json
│   └── tauri.conf.json
│
├── detection/                   # Auto-Detection Engine
│   ├── usb-scanner/             # USB device enumeration
│   ├── chipset-id/              # Chipset identification DB
│   ├── driver-loader/           # Dynamic driver loading
│   └── workspace-manager/       # Device workspace lifecycle
│
├── hal/                         # Hardware Abstraction Layer
│   ├── usb/                     # USB controller management
│   ├── uart/                    # UART/Serial interface
│   ├── gpio/                    # GPIO/JTAG/SWD control
│   ├── pd-negotiation/          # USB-PD controller
│   └── psu-control/             # Programmable PSU interface
│
├── ai/                          # AI/ML Components
│   ├── schematic-overlay/       # Image recognition for PCBs
│   │   ├── model/               # Trained model
│   │   ├── inference/           # Runtime inference
│   │   └── training/            # Training pipeline
│   ├── power-analysis/          # Current signature analysis
│   │   ├── signatures/          # Known-good signatures DB
│   │   └── classifier/          # Fault classifier
│   └── component-id/            # Component identification
│
├── database/                    # Collaborative Repair Database
│   ├── schema/                  # Database schema
│   ├── api/                     # REST/GraphQL API
│   ├── sync/                    # Offline-first sync engine
│   └── seeds/                   # Initial data (test points, faults)
│
├── containers/                  # Containerized Toolchains
│   ├── android-tools/           # Android SDK container
│   ├── apple-tools/             # libimobiledevice container
│   ├── qualcomm-edl/            # Qualcomm EDL container
│   ├── mediatek-flash/          # MediaTek tools container
│   └── samsung-odin/            # Samsung tools container
│
├── hardware/                    # Custom Hardware Designs
│   ├── mobile-debug-hat/        # RPi-style debug HAT
│   │   ├── kicad/               # KiCad PCB design
│   │   ├── gerber/              # Manufacturing files
│   │   └── firmware/            # HAT firmware
│   ├── usb-pd-tester/           # USB-C PD inline tester
│   │   ├── kicad/
│   │   ├── gerber/
│   │   └── firmware/
│   └── isp-adapters/            # eMMC/UFS ISP adapters
│       ├── bga153/
│       ├── bga162/
│       └── bga221/
│
├── docs/                        # Documentation
│   ├── getting-started.md
│   ├── hardware-requirements.md
│   ├── tool-guides/             # Per-tool documentation
│   └── repair-procedures/       # Common repair workflows
│
└── scripts/                     # Build & Development Scripts
    ├── build-iso.sh             # Build bootable ISO
    ├── build-live-usb.sh        # Create live USB
    ├── setup-dev.sh             # Development environment
    ├── test-containers.sh       # Test container stack
    └── ci/                      # CI/CD pipelines
        ├── build.yml
        └── release.yml
```

---

## 3. Core OS Architecture

### 3.1 Base Distribution

**Base:** Debian Stable (Bookworm) or Devuan (systemd-free alternative)

**Why Debian:**
- Largest package repository
- Excellent hardware support
- Stable, well-tested base
- Strong ARM64 support (future RPi deployment)

**Kernel:**
- Linux 6.x with PREEMPT_RT patches
- Custom config optimized for:
  - USB device enumeration (multiple controllers)
  - Real-time signal processing
  - GPIO/JTAG timing
  - Power management for portable use

### 3.2 Boot Modes

The OS supports four distinct boot modes, selectable at boot time:

```bash
# /etc/techbench/boot-modes.conf

BOOT_MODES=(
    "desktop"           # Standard Linux desktop
    "mobile-service"    # Mobile device servicing optimized
    "electronics-bench" # Electronics instruments optimized
    "combined"          # All features loaded (default)
)
```

Each mode loads different service sets:

| Mode | Services Loaded | Use Case |
|------|----------------|----------|
| Desktop | Standard desktop, office, browser | General use |
| Mobile Service | ADB, Fastboot, device containers | Phone repair |
| Electronics | Sigrok, OpenHantek, PSU control | Bench work |
| Combined | Everything | Full bench operation |

### 3.3 Live USB with Persistence

```bash
# Build process
./scripts/build-live-usb.sh --device /dev/sdX --persistence 64G

# Creates:
# /dev/sdX1: EFI System Partition (512MB)
# /dev/sdX2: Boot partition (1GB, squashfs)
# /dev/sdX3: Persistence (remaining space, ext4)
# /dev/sdX4: Swap (8GB)
```

**Persistence layout:**
```
/persistence/
├── config/                    # User configuration
├── containers/                # Container images (persistent)
├── databases/                 # Offline repair database
├── signatures/                # Power analysis signatures
├── schematics/                # Downloaded schematics
└── logs/                      # Audit logs
```

---

## 4. Electronics Engineering Layer

### 4.1 Integrated Instrument Suite

| Tool | Purpose | Integration |
|------|---------|-------------|
| **Sigrok/PulseView** | Logic analyzer, protocol decode | Direct USB/GPIO |
| **OpenHantek** | Oscilloscope | USB scope support |
| **FLIR SDK** | Thermal imaging | FLIR One/Lepton |
| **OpenOCD** | JTAG/SWD debugging | GPIO/USB adapters |
| **KiCad** | PCB design/schematic | Mobile repair libs |
| **ngspice** | Circuit simulation | Power rail analysis |

### 4.2 Protocol Decoding

Pre-configured protocol decoders for mobile repair:

```yaml
# packages/electronics/sigrok/protocols/mobile.yaml
protocols:
  - name: "USB-PD"
    description: "USB Power Delivery negotiation"
    channels: [CC1, CC2]
    decoder: "usb-pd"
    
  - name: "I2C-PMIC"
    description: "PMIC communication (charger, LDO)"
    channels: [SDA, SCL]
    decoder: "i2c"
    
  - name: "SPI-UFS"
    description: "UFS storage interface"
    channels: [CLK, MOSI, MISO, CS]
    decoder: "spi"
    
  - name: "UART-Baseband"
    description: "Baseband processor debug"
    channels: [TX, RX]
    decoder: "uart"
    
  - name: "MIPI-DSI"
    description: "Display serial interface"
    channels: [CLK, DATA0-DATA3]
    decoder: "mipi-dsi"
    
  - name: "JTAG"
    description: "Boundary scan / debug"
    channels: [TCK, TMS, TDI, TDO, nTRST]
    decoder: "jtag"
```

### 4.3 Hardware Interfaces

```
Physical Layout (Mobile Debug Hat):
┌────────────────────────────────────────┐
│  [JTAG 20-pin]  [SWD 10-pin]         │
│                                        │
│  [UART 3.3V] [UART 1.8V] [UART 1.2V] │  ← Level-shifted
│                                        │
│  [I2C] [SPI] [GPIO x8]               │
│                                        │
│  [eMMC ISP Pogo] [UFS ISP Pogo]       │  ← Chip-off adapters
│                                        │
│  [USB-C PD] [Power In] [Power Out]    │
└────────────────────────────────────────┘
```

---

## 5. Mobile Device Service Core

### 5.1 Auto-Detection Engine

```python
# detection/usb-scanner/scanner.py (pseudocode)

class DeviceScanner:
    def __init__(self):
        self.usb_monitor = pyudev.Monitor.from_netlink()
        self.chipset_db = ChipsetDatabase()
        
    def on_device_event(self, event):
        device = self.identify_device(event)
        
        workspace = DeviceWorkspace(
            device=device,
            chipset=device.chipset,
            boot_mode=device.current_boot_mode,
            security_state=device.security_state
        )
        
        # Load appropriate container
        container = self.load_toolchain(device.chipset.vendor)
        workspace.attach_container(container)
        
        # Notify GUI
        self.emit("device_connected", workspace)
```

**Detection flow:**
```
USB Plug → enumerate VID/PID → lookup chipset DB
    ↓
Match found? → yes → load vendor-specific container
    ↓ no
Generic driver → attempt standard protocols
    ↓
Create workspace → populate available tools → notify GUI
```

### 5.2 Android Stack

| Tool | Container | Capabilities |
|------|-----------|--------------|
| ADB Enhanced | `android-tools` | Device management, shell, backup |
| Fastboot Enhanced | `android-tools` | Flash partitions, unlock bootloader |
| QFIL/EDL | `qualcomm-edl` | Emergency download, firehose programming |
| SP Flash Tool | `mediatek-flash` | Preloader, scatter loading |
| Odin Protocol | `samsung-odin` | Samsung binary flashing |
| ISP Tools | `mobile-universal` | eMMC/UFS direct access |

### 5.3 Apple Stack

| Tool | Container | Capabilities |
|------|-----------|--------------|
| libimobiledevice | `apple-tools` | Full iOS communication |
| idevicerestore | `apple-tools` | Firmware restore |
| checkm8 framework | `apple-tools` | A11 and below exploit |
| DFU Automator | `apple-tools` | Automated DFU entry |
| Serial Access | Native | Lightning UART debug |

### 5.4 Universal Features

```
┌─────────────────────────────────────────────────────────┐
│                   Device Workspace                       │
├─────────────────────────────────────────────────────────┤
│  Device: Samsung Galaxy S24 (SM-S926B)                  │
│  Chipset: Qualcomm Snapdragon 8 Gen 3                   │
│  Boot Mode: Normal (ADB accessible)                     │
│  Security: Bootloader locked, Knox 0x1                  │
├─────────────────────────────────────────────────────────┤
│  Available Tools:                                        │
│  ├─ ADB Shell ✓                                         │
│  ├─ Fastboot (locked) ⚠                                 │
│  ├─ EDL Mode (requires auth bypass) ⚠                   │
│  ├─ Partition Manager ✓                                 │
│  ├─ IMEI Reader ✓                                       │
│  ├─ Power Analysis ✓                                    │
│  └─ Schematic: SM-S926B_v1.0 ✓                         │
├─────────────────────────────────────────────────────────┤
│  Quick Actions:                                         │
│  [Read Info] [Backup EFS] [Flash Firmware] [Test Point] │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Advanced Features

### 6.1 Schematic Overlay System

```
┌─────────────────────────────────────────────────────────┐
│                  Schematic Viewer                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌───────────────────────────────────────────────┐    │
│   │  [Motherboard Photo with AI Overlay]          │    │
│   │                                               │    │
│   │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐        │    │
│   │  │U101 │  │C204 │  │R305 │  │L401 │        │    │
│   │  │PMIC │  │10µF │  │10kΩ │  │4.7µH│        │    │
│   │  │     │  │     │  │     │  │     │        │    │
│   │  │VREG │  │VDD_ │  │I2C_ │  │BATT │        │    │
│   │  │_LDO3│  │CORE │  │PULL │  │_FILT│        │    │
│   │  └─────┘  └─────┘  └─────┘  └─────┘        │    │
│   │                                               │    │
│   │  Click component to see:                      │    │
│   │  • Schematic symbol                           │    │
│   │  • Test points                                │    │
│   │  • Known faults                               │    │
│   │  • Replacement parts                          │    │
│   └───────────────────────────────────────────────┘    │
│                                                         │
│  Model: Power Management IC (PMIC)                     │
│  Part:  PM8550 (Qualcomm)                              │
│  Function: Primary PMIC for SoC power rails            │
│  Test Points: TP101 (VREG_L3), TP102 (VREG_L5)       │
│  Known Faults: 47% - No VREG_L3 output                │
│  Replacement: $12.50 (AliExpress)                      │
└─────────────────────────────────────────────────────────┘
```

**Tech Stack:**
- YOLOv8 for component detection on PCB images
- Database of 10,000+ common mobile components
- ZXW/Dongle schematic format parser
- Offline-capable inference (ONNX Runtime)

### 6.2 Power Analysis Diagnostics

```yaml
# Known boot signatures
signatures:
  - name: "Normal Boot (Snapdragon 8 Gen 3)"
    pattern: "0.3A → 0.8A → 1.2A → 0.4A (stable)"
    duration: "8-12 seconds"
    status: "healthy"
    
  - name: "PMIC Failure"
    pattern: "0.8A → 0.2A (drops after 2s)"
    duration: "2-3 seconds"
    status: "fault"
    diagnosis: "Primary PMIC not maintaining voltage"
    suggestion: "Check PM8550 output rails, reball if needed"
    
  - name: "Short Circuit"
    pattern: "2.5A → PSU current limit"
    duration: "immediate"
    status: "fault"
    diagnosis: "Dead short on main power rail"
    suggestion: "Thermal scan to locate short, check capacitors"
    
  - name: "Boot Loop"
    pattern: "0.3A → 1.2A → 0.3A → 1.2A (repeat)"
    duration: "infinite loop"
    status: "fault"
    diagnosis: "Device failing early boot, possible corrupt firmware"
    suggestion: "Try EDL/Recovery mode flash"
```

### 6.3 Multi-Device Orchestration

```
┌─────────────────────────────────────────────────────────┐
│              Flash Station (4-port)                     │
├─────────────────────────────────────────────────────────┤
│  Port 1: [████████████░░░░] 75% - Galaxy A54 - Flashing│
│  Port 2: [████████████████] 100% - Galaxy A54 - Done ✓ │
│  Port 3: [░░░░░░░░░░░░░░░░] 0% - Galaxy A54 - Waiting │
│  Port 4: [░░░░░░░░░░░░░░░░] 0% - Galaxy A54 - Waiting │
├─────────────────────────────────────────────────────────┤
│  Queue: 12 devices remaining                            │
│  Estimated time: 47 minutes                             │
│  Status: Port 1 → Port 2 verified, swapping...          │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Container Architecture

### 7.1 Container Design

Each mobile platform runs in an isolated container to prevent driver conflicts:

```yaml
# containers/android-tools/Dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    android-tools-adb \
    android-tools-fastboot \
    libusb-1.0-0 \
    usbutils

# ADB/Fastboot enhancements
COPY enhanced-adb/ /opt/adb-enhanced/
COPY enhanced-fastboot/ /opt/fastboot-enhanced/

# Device database
COPY device-db/ /opt/device-db/

VOLUME ["/workspace", "/logs"]
ENTRYPOINT ["/opt/entrypoint.sh"]
```

### 7.2 Container Orchestration

```bash
# Podman-based (rootless by default)
podman-compose up -d android-tools
podman-compose up -d qualcomm-edl
podman-compose up -d mediatek-flash

# USB passthrough to containers
podman run --device /dev/bus/usb:/dev/bus/usb \
           --privileged \
           -v /workspace:/workspace \
           techbench/android-tools
```

---

## 8. Security & Ethics

### 8.1 Ownership Verification

```python
class OwnershipVerifier:
    """Mandatory ownership check before sensitive operations"""
    
    def verify(self, device, operation):
        if operation.risk_level == "high":
            # Require proof of ownership
            proof = self.collect_proof(device)
            
            # IMEI ownership database check
            if not self.check_imei_ownership(proof.imei, proof.owner_id):
                raise OwnershipError("IMEI not registered to provided owner")
            
            # Log for audit trail
            self.audit_log.record(
                device=device,
                operation=operation,
                owner=proof.owner_id,
                timestamp=datetime.utcnow()
            )
```

### 8.2 Audit Logging

All sensitive operations are logged:
- Bootloader unlock attempts
- FRP bypass operations
- Partition modifications
- Data recovery operations
- JTAG/SWD access

---

## 9. Development Roadmap

See [ROADMAP.md](ROADMAP.md) for detailed phase breakdown.

---

## 10. Technology Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Base OS | Debian 12 (Bookworm) | Stability, package ecosystem |
| Kernel | Linux 6.x + PREEMPT_RT | Real-time for signal work |
| Container Runtime | Podman | Rootless, daemonless |
| GUI Framework | Tauri (Rust + React) | Native performance, small footprint |
| Database | SQLite (offline) + PostgreSQL (sync) | Offline-first design |
| AI/ML | ONNX Runtime + YOLOv8 | Component detection |
| Build System | Live-build (Debian) | ISO generation |
| CI/CD | GitHub Actions | Automated builds |
| Language (Core) | Rust, Python, TypeScript | Performance + tooling |
| Language (Tools) | C/C++ | Hardware interfaces |
