# TechBench

<p align="center">
  <strong>Linux Electronics Engineering & Mobile Device Servicing Platform</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-0.1.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/Stack-Tauri%20%2B%20React%20%2B%20Rust%20%2B%20Python-9b59b6" alt="Stack">
</p>

---

## Overview

**TechBench** bridges traditional bench electronics (oscilloscopes, logic analyzers, multimeters) with modern mobile device servicing (Android flashing, iOS recovery, chip-off repair) in a single, cohesive desktop application.

Built with Tauri + React for the GUI, Rust for the Hardware Abstraction Layer, Python for AI-assisted diagnostics, and SQLite for data persistence.

### What's Included

- **Electronics Workspace** — Oscilloscope, logic analyzer, multimeter, signal generator views
- **Mobile Service Workspace** — Android/iOS device management, flashing, backup, shell access
- **AI Assistant** — Component identification, power analysis, fault diagnosis, repair recommendations
- **Project Management** — Track repairs, manage workspaces, collaborate
- **Plugin System** — Extensible marketplace for community tools
- **Hardware Abstraction Layer** — USB, UART, SPI, I2C, JTAG, SWD, CAN bus support
- **Cross-Platform** — Runs on Windows and Linux with platform-specific USB detection

---

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Development](#development)
- [Project Structure](#project-structure)
- [Supported Devices](#supported-devices)
- [Roadmap](#roadmap)
- [License](#license)

---

## Quick Start

### Windows (Portable — No Installation)

1. Ensure Python 3.10+ is installed ([python.org](https://python.org) — check "Add to PATH")
2. Download `TechBench-Portable.zip` and extract it
3. Double-click `TechBench.bat`
4. Browser opens automatically at `http://localhost:1420`

### Linux

```bash
# Install from .deb package
sudo dpkg -i dist/techbench_0.1.0_amd64.deb

# Or run from source
cd gui && npm install && npm run dev
```

### Build Native Windows Installer

Requires Windows machine with Node.js, Rust ([rustup.rs](https://rustup.rs)), and Python 3:

```cmd
build.bat
```

Output: `dist/TechBench-Setup-0.1.0.exe` (NSIS installer)

---

## Features

### GUI — 11 Views

| View | Description |
|------|-------------|
| **Dashboard** | System overview, connected devices, recent activity |
| **Electronics Workspace** | Instruments, protocols, embedded design, component database |
| **Mobile Service** | Device info, shell, partitions, firmware, backup/restore |
| **AI Assistant** | Chat interface with diagnostic suggestions and repair guidance |
| **Signal Analyzer** | Oscilloscope and logic analyzer visualization |
| **Schematic Viewer** | Interactive schematic with AI-powered component overlay |
| **Power Monitor** | Real-time power analysis with boot signature matching |
| **Projects** | Project CRUD with filtering, search, status tracking |
| **Plugin Manager** | Marketplace for community tools and extensions |
| **Device Manager** | USB device listing, container management, device shell |
| **Settings** | Container runtime, boot mode, log level configuration |

### Backend — Rust HAL

| Module | Description |
|--------|-------------|
| **USB** | Device enumeration, VID/PID lookup, controller scanning (via `rusb`/libusb) |
| **UART** | Serial communication with configurable baud rate, voltage levels (via `serialport`) |
| **GPIO** | Pin direction, read/write, voltage level shifting |
| **I2C** | Bus scanning, register read/write |
| **SPI** | Full-duplex transfer, configurable mode and speed |
| **JTAG** | TAP controller, boundary scan, IDCODE |
| **SWD** | Debug port, register access, breakpoint management |
| **CAN** | Frame send/receive, filtering, statistics |

### AI Engine — Python

| Capability | Description |
|------------|-------------|
| **Component Identification** | Fuzzy matching against component database by part number, name, category |
| **Power Signature Analysis** | Matches current readings against known boot signatures (normal boot, PMIC failure, short circuit, boot loop) |
| **Fault Diagnosis** | Rule-based diagnosis for no power, boot loop, display, touch, charging, audio, WiFi, camera issues |
| **Circuit Explanation** | Generates circuit section descriptions, signal flow, voltage rails, test points |
| **Repair Notes Search** | Full-text search across signatures and component database |
| **ONNX Integration** | Optional ONNX Runtime for ML-based inference (graceful fallback to rule-based) |

### Database — SQLite

14 tables covering components, power signatures, projects, devices, diagnostics, and more. Full CRUD via Rust library with `rusqlite`.

### Cross-Platform USB Detection

| Platform | Backend | Method |
|----------|---------|--------|
| **Linux** | `pyudev` | Netlink socket monitoring of USB subsystem |
| **Windows** | WMI | PowerShell `Get-CimInstance Win32_USBControllerDevice` polling |
| **macOS** | `system_profiler` | `SPUSBDataType` JSON output parsing |

Container runtime auto-detects Docker or Podman.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TechBench                                   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Tauri + React GUI (TypeScript)                   │   │
│  │  ElectronicsWorkspace │ MobileService │ AIAssistant │ ...    │   │
│  │  Zustand Store │ React Query │ TailwindCSS                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Rust HAL         │  │  Python AI        │  │  SQLite Database │  │
│  │  USB │ UART │ SPI │  │  Component ID     │  │  14 tables       │  │
│  │  I2C │ JTAG │ SWD │  │  Power Analysis   │  │  Full CRUD       │  │
│  │  CAN │ GPIO       │  │  Fault Diagnosis  │  │  rusqlite        │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Cross-Platform USB Detection                                │   │
│  │  Linux: pyudev │ Windows: WMI │ macOS: system_profiler       │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Container Runtime (Docker / Podman)                          │   │
│  │  Android │ Apple │ Qualcomm EDL │ MediaTek │ Samsung          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Installation

### Option 1: Portable (Windows — Recommended)

No installation required. Copy to pendrive and run:

1. Download `TechBench-Portable.zip` from `dist/`
2. Extract to pendrive or any folder
3. Double-click `TechBench.bat`
4. Browser opens at `http://localhost:1420`

**Requirements:** Python 3.10+ on the target machine.

### Option 2: Windows Installer (NSIS)

Build from source on a Windows machine:

```cmd
# Install prerequisites
# - Node.js 18+ (https://nodejs.org)
# - Rust (https://rustup.rs)
# - Python 3.10+ (https://python.org)

# Build
build.bat

# Output
dist\TechBench-Setup-0.1.0.exe
```

### Option 3: Linux .deb Package

```bash
sudo dpkg -i dist/techbench_0.1.0_amd64.deb
sudo apt install -f  # Fix any missing dependencies
techbench           # Launch
```

### Option 4: From Source (Any Platform)

```bash
git clone https://github.com/yourusername/tech-bench-os.git
cd tech-bench-os

# GUI
cd gui
npm install
npm run dev          # Development server at http://localhost:1420

# HAL (Rust)
cd ../hal
cargo build

# AI Engine (Python)
cd ../ai
pip install -r requirements.txt  # If available
python engine.py
```

---

## Development

### Prerequisites

- **Node.js** 18+
- **Rust** (via [rustup.rs](https://rustup.rs))
- **Python** 3.10+
- **Docker Desktop** or **Podman** (for containerized toolchains)

### GUI Development

```bash
cd gui
npm install
npm run dev          # Dev server with hot reload at http://localhost:1420
npm run build        # Production build
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npx vitest run       # Unit tests (11 tests)
```

### HAL Development

```bash
cd hal
cargo build          # Build HAL binary
cargo test           # Run HAL tests
cargo clippy         # Lint
```

### AI Engine Testing

```bash
python3 scripts/test_ai_engine.py    # 15 tests
python3 scripts/test_components.py   # Component detection tests
```

### Building the .deb Package (Linux)

```bash
bash build-deb.sh    # Output: dist/techbench_0.1.0_amd64.deb
```

### Building the Portable Package

```bash
# The portable/ directory is built automatically
# Contains: server.py, TechBench.bat, gui/, python/
zip -r dist/TechBench-Portable.zip portable/ -x "portable/data/*"
```

---

## Project Structure

```
tech-bench-os/
├── gui/                          # Tauri + React GUI
│   ├── src-tauri/               # Tauri backend (Rust)
│   │   ├── Cargo.toml           # Tauri v2 + shell plugin
│   │   ├── src/lib.rs           # App entry point
│   │   ├── src/main.rs          # Windows subsystem
│   │   └── icons/               # App icons (.ico, .png)
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── ElectronicsWorkspace/
│   │   │   ├── MobileService/
│   │   │   ├── AIAssistant/
│   │   │   ├── Projects/
│   │   │   ├── PluginManager/
│   │   │   ├── DeviceManager/
│   │   │   ├── SignalAnalyzer/
│   │   │   ├── SchematicViewer/
│   │   │   ├── PowerMonitor/
│   │   │   └── layout/
│   │   ├── lib/
│   │   │   ├── tauri.ts         # Tauri IPC bridge
│   │   │   ├── mockDevices.ts   # Device simulation
│   │   │   └── settingsStore.ts # Settings state
│   │   ├── store/index.ts       # Zustand global store
│   │   └── __tests__/           # Vitest unit tests
│   ├── package.json
│   └── vite.config.ts
├── hal/                          # Hardware Abstraction Layer (Rust)
│   ├── Cargo.toml               # rusb, serialport, tokio, clap
│   └── src/
│       ├── main.rs              # CLI binary (JTAG/SWD/I2C/SPI/CAN)
│       ├── lib.rs               # Library exports
│       ├── error.rs             # Error types
│       ├── usb/mod.rs           # USB device enumeration
│       ├── uart/mod.rs          # Serial communication
│       ├── gpio/mod.rs          # GPIO/JTAG/SWD/I2C/SPI
│       └── can/mod.rs           # CAN bus interface
├── ai/                           # AI Engine (Python)
│   ├── __init__.py
│   └── engine.py                # Component ID, power analysis, fault diagnosis
├── database/                     # SQLite Database
│   ├── Cargo.toml               # rusqlite with bundled SQLite
│   ├── schema/001_initial.sql   # 14-table schema
│   ├── seeds/                   # Component + power signature data
│   └── src/lib.rs               # Rust CRUD operations
├── detection/                    # Cross-Platform USB Detection
│   ├── usb-scanner/
│   │   ├── detector.py          # Main detector (pyudev/WMI/system_profiler)
│   │   └── enhanced_detector.py # Enhanced detection with events
│   └── chipset-id/database.json # 14 known USB VID:PID entries
├── containers/                   # Containerized Toolchains
│   ├── android-tools/
│   ├── apple-tools/
│   ├── qualcomm-edl/
│   ├── mediatek-flash/
│   └── samsung-odin/
├── scripts/                      # Build & Utility Scripts
│   ├── install-windows-deps.bat  # Windows dependency installer
│   ├── init-db.py               # Database initializer
│   ├── test_ai_engine.py        # AI engine tests
│   └── test_components.py       # Component detection tests
├── installer/                    # NSIS Installer
│   └── techbench.nsi          # Windows installer script
├── portable/                     # Portable Package (Pendrive)
│   ├── TechBench.bat          # Windows launcher
│   ├── server.py                # Python backend server
│   ├── gui/                     # Built frontend assets
│   └── python/                  # Python AI + detection modules
├── debian/                       # Linux .deb Package
│   └── DEBIAN/control           # Package metadata
├── build.bat                     # Windows build script
├── build-deb.sh                  # Linux .deb build script
└── README.md                     # This file
```

---

## Supported Devices

### Qualcomm (EDL Mode)

Xiaomi, OnePlus, Oppo, Vivo, Realme, Motorola

### MediaTek

Most MediaTek-based Android phones (Xiaomi, Realme, Vivo MTK models)

### Samsung

Galaxy S, Note, A, Tab series (Odin/Download mode)

### Apple

iPhone, iPad (basic operations); checkm8 support for A11 and below

### Google

Pixel (all models)

### Bench Equipment

| Category | Supported |
|----------|-----------|
| **USB-Serial** | FTDI FT232R, CP210x, CH340/CH341 |
| **JTAG/SWD** | ST-Link V2, J-Link, FTDI FT2232H |
| **Logic Analyzers** | Sigrok-compatible (fx2lafw, saleae) |
| **Oscilloscopes** | OpenHantek, Rigol |
| **Multimeters** | Fluke (via serial), generic DMM |

---

## Roadmap

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Database, AI Engine, HAL Expansion, GUI Enhancement | ✅ Complete |
| 2 | Electronics Workspace instruments, Mobile Service integration, Power Analysis | 🔄 In Progress |
| 3 | Real hardware integration, multi-device flash, schematic overlay | 📋 Planned |
| 4 | Collaborative database, plugin marketplace launch, community features | 📋 Planned |

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Tauri](https://tauri.app/) — Cross-platform desktop framework
- [React](https://react.dev/) — UI library
- [Sigrok](https://sigrok.org/) — Logic analyzer framework
- [libimobiledevice](https://libimobiledevice.org/) — Apple device communication
- [OpenOCD](https://openocd.org/) — JTAG/SWD debugging
- [Heimdall](https://glassechidna.com.au/heimdall/) — Samsung flashing
- [mtkclient](https://github.com/bkerler/mtkclient) — MediaTek tools
- [edl](https://github.com/bkerler/edl) — Qualcomm EDL tools
- [rusb](https://github.com/a1ien/rusb) — Rust libusb bindings
- [serialport](https://github.com/serialport/serialport-rs) — Cross-platform serial ports
- [rusqlite](https://github.com/rusqlite/rusqlite) — Rust SQLite bindings

---

<p align="center">
  <strong>TechBench</strong><br>
  <em>Electronics Engineering & Mobile Device Servicing Platform</em>
</p>
