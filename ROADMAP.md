# TechBench - Development Roadmap

## Phase Overview

| Phase | Name | Duration | Priority |
|-------|------|----------|----------|
| 0 | Foundation & Project Setup | 1-2 weeks | Critical |
| 1 | Base OS & Package Repository | 4-6 weeks | Critical |
| 2 | Auto-Detection Engine | 3-4 weeks | High |
| 3 | Unified GUI (BenchPanel) | 6-8 weeks | High |
| 4 | Electronics Engineering Integration | 4-6 weeks | Medium |
| 5 | Mobile Service Core | 6-8 weeks | Medium |
| 6 | Hardware Abstraction Layer | 4-6 weeks | Medium |
| 7 | Advanced Features | 8-12 weeks | Low |
| 8 | Polish, Testing & Release | 4-6 weeks | High |

**Total estimated timeline:** 10-14 months (solo developer)

---

## Phase 0: Foundation & Project Setup

**Goal:** Establish project structure, build system, and development environment.

### Tasks

- [ ] Set up monorepo structure with proper `.gitignore`, `LICENSE` (GPLv3)
- [ ] Create development environment setup script (`scripts/setup-dev.sh`)
- [ ] Initialize container base images for each toolchain
- [ ] Set up CI/CD pipeline (GitHub Actions) for:
  - Container builds
  - ISO builds
  - Automated testing
- [ ] Create contribution guidelines and coding standards
- [ ] Set up issue tracking and project board

### Deliverables
```
✅ Project structure initialized
✅ Dev environment script works on Ubuntu 22.04+
✅ Base container images build successfully
✅ CI pipeline runs on push
```

---

## Phase 1: Base OS & Package Repository

**Goal:** Bootable live USB with core electronics and mobile tools.

### 1.1 Kernel Configuration

```bash
# Build PREEMPT_RT kernel
git clone --branch v6.6-rt --depth 1 https://git.kernel.org/pub/scm/linux/kernel/git/rt/linux-rt.git
cd linux-rt

# Apply RT patches
make menuconfig  # Select PREEMPT_RT_FULL

# Key config options:
CONFIG_PREEMPT_RT_FULL=y
CONFIG_PREEMPT=y
CONFIG_HZ_1000=y
CONFIG_USB_SERIAL=y
CONFIG_USB_SERIAL_FTDI_SIO=y
CONFIG_USB_SERIAL_PL2303=y
CONFIG_I2C=y
CONFIG_SPI=y
CONFIG_GPIO_CDEV=y
CONFIG_JTAG=y
```

### 1.2 Live USB Builder

```bash
# scripts/build-live-usb.sh
#!/bin/bash
set -euo pipefail

DEVICE=${1:-/dev/sdX}
PERSISTENCE_SIZE=${2:-64G}

# Install live-build
sudo apt-get install -y live-build

# Configure
lb config \
    --distribution bookworm \
    --archive-areas "main contrib non-free non-free-firmware" \
    --bootloaders "grub-efi" \
    --firmware-binary true \
    --firmware-chroot true

# Add custom packages
cat > config/package-lists/techbench.list.chroot << 'EOF'
# Electronics
sigrok-firmware-fx2lafw
pulseview
openhantek
openocd
kicad
ngspice
gtkwave

# Mobile Android
android-tools-adb
android-tools-fastboot

# Mobile Apple (will build from source later)
libimobiledevice6
libimobiledevice-utils
ideviceinstaller

# System
podman
buildah
python3-pip
python3-serial
python3-pyusb
jq
htop
tmux
vim

# GPIO/Hardware
i2c-tools
spi-tools
python3-smbus
libgpiod-tools
openocd

# Development
git
build-essential
cmake
rustc
cargo
nodejs
npm
EOF

# Build ISO
sudo lb build
```

### 1.3 Boot Mode System

```bash
# /etc/systemd/system/techbench.target
[Unit]
Description=TechBench - Combined Mode
Requires=multi-user.target
After=multi-user.target

[Install]
WantedBy=multi-user.target

# Mode selector at boot (GRUB)
# /etc/default/grub
GRUB_DEFAULT=0
GRUB_TIMEOUT=10
GRUB_CMDLINE_LINUX="boot_mode=combined"
```

### Deliverables
```
✅ Live USB boots on x86_64 hardware
✅ Persistence storage works
✅ Core electronics tools installed and functional
✅ Core mobile tools installed and functional
✅ Boot mode selection works
```

---

## Phase 2: Auto-Detection Engine

**Goal:** Plug in a device → OS identifies it and loads appropriate tools.

### 2.1 USB Scanner

```python
# detection/usb-scanner/scanner.py
import pyudev
import json
from pathlib import Path

class USBDeviceScanner:
    def __init__(self):
        self.context = pyudev.Context()
        self.monitor = pyudev.Monitor.from_netlink(self.context)
        self.monitor.filter_by(subsystem='usb')
        self.chipset_db = self.load_chipset_db()
        
    def load_chipset_db(self):
        """Load VID:PID → chipset mapping database"""
        db_path = Path("/opt/techbench/detection/chipset-id/database.json")
        with open(db_path) as f:
            return json.load(f)
    
    def identify_device(self, device):
        vid = device.get('ID_VENDOR_ID', '')
        pid = device.get('ID_MODEL_ID', '')
        
        key = f"{vid}:{pid}"
        if key in self.chipset_db:
            return self.chipset_db[key]
        
        return {
            'vendor': 'unknown',
            'chipset': 'unknown',
            'boot_modes': ['normal'],
            'tools': ['adb', 'fastboot']  # Generic fallback
        }
    
    def create_workspace(self, device_info):
        return {
            'id': generate_workspace_id(),
            'device': device_info,
            'created_at': datetime.utcnow(),
            'status': 'active',
            'tools': self.load_tools(device_info)
        }
    
    def start(self):
        """Main event loop"""
        print("USB Device Scanner started...")
        for action, device in self.monitor:
            if action == 'add':
                info = self.identify_device(device)
                workspace = self.create_workspace(info)
                self.emit('device_connected', workspace)
            elif action == 'remove':
                self.emit('device_disconnected', device)
```

### 2.2 Chipset Database

```json
{
  "05c6:90db": {
    "vendor": "qualcomm",
    "chipset": "snapdragon",
    "name": "Qualcomm QDLoader 9008",
    "boot_modes": ["edl", "normal"],
    "tools": ["qfil", "firehose", "sahara"],
    "container": "qualcomm-edl",
    "test_points": {
      "edl": "Short test point TP401 to GND"
    }
  },
  "0e8d:0003": {
    "vendor": "mediatek",
    "chipset": "mtk",
    "name": "MediaTek Preloader",
    "boot_modes": ["preloader", "normal"],
    "tools": ["sp-flash-tool", "mtk-daemon"],
    "container": "mediatek-flash"
  },
  "04e8:6860": {
    "vendor": "samsung",
    "chipset": "exynos",
    "name": "Samsung Galaxy (MTP)",
    "boot_modes": ["normal"],
    "tools": ["adb"],
    "container": "android-tools"
  },
  "05ac:1227": {
    "vendor": "apple",
    "chipset": "a-series",
    "name": "Apple DFU Mode",
    "boot_modes": ["dfu", "recovery", "normal"],
    "tools": ["idevicerestore", "checkm8"],
    "container": "apple-tools"
  }
}
```

### 2.3 Driver Loader

```bash
#!/bin/bash
# detection/driver-loader/load.sh

DEVICE_VID=$1
DEVICE_PID=$2

# Check if device needs specific kernel module
case "$DEVICE_VID:$DEVICE_PID" in
    "05c6:90db")
        # Qualcomm EDL - ensure usbserial is loaded
        modprobe usbserial
        modprobe qcserial
        ;;
    "0e8d:0003")
        # MediaTek - load specific driver
        modprobe usbserial
        modprobe mtk_download_agent
        ;;
    *)
        # Generic - use default drivers
        modprobe usbserial
        ;;
esac

# Start device-specific container
CONTAINER=$(jq -r ".\"$DEVICE_VID:$DEVICE_PID\".container" /opt/techbench/detection/chipset-id/database.json)
if [ "$CONTAINER" != "null" ] && [ -n "$CONTAINER" ]; then
    podman start "techbench-$CONTAINER" 2>/dev/null || \
    podman run -d \
        --name "techbench-$CONTAINER" \
        --device /dev/bus/usb \
        --privileged \
        -v /workspace:/workspace \
        "techbench/$CONTAINER"
fi
```

### Deliverables
```
✅ USB device detection works
✅ Chipset identification for top 50 mobile devices
✅ Container auto-start on device connection
✅ Proper USB passthrough to containers
```

---

## Phase 3: Unified GUI (BenchPanel)

**Goal:** Single-pane-of-glass interface for all bench operations.

### 3.1 Tech Stack

- **Framework:** Tauri 2.x (Rust backend + React frontend)
- **Why Tauri:** Smaller binary than Electron, native performance, Rust for hardware I/O
- **UI Library:** React 19 + Tailwind CSS 4 + shadcn/ui
- **State Management:** Zustand + React Query

### 3.2 Core Views

```
┌──────────────────────────────────────────────────────────────┐
│  BenchPanel                                        [─][□][×] │
├──────────────────────────────────────────────────────────────┤
│  [Devices] [Signal] [Schematic] [Power] [Flash] [Recovery]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │                    [Active View]                       │  │
│  │                                                        │  │
│  │                                                        │  │
│  │                                                        │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Device Sidebar                                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ Galaxy   │ │ iPhone   │ │ Pixel    │ │ [Empty]  │  │  │
│  │  │ S24 ⚡   │ │ 15 🔒    │ │ 8 ✓      │ │          │  │  │
│  │  │ [USB 1]  │ │ [USB 2]  │ │ [USB 3]  │ │ [USB 4]  │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Status: 3 devices connected │ PSU: 4.2V 0.5A │ Temp: 24°C │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Component Architecture

```
gui/src/renderer/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx          # Navigation sidebar
│   │   ├── DeviceTray.tsx       # Connected devices
│   │   └── StatusBar.tsx        # Bottom status bar
│   ├── DeviceManager/
│   │   ├── DeviceCard.tsx       # Device info card
│   │   ├── DeviceWorkspace.tsx  # Device-specific workspace
│   │   └── ToolPalette.tsx      # Available tools for device
│   ├── SignalAnalyzer/
│   │   ├── WaveformView.tsx     # Oscilloscope display
│   │   ├── ProtocolDecoder.tsx  # Protocol analysis
│   │   └── TriggerConfig.tsx    # Trigger settings
│   ├── SchematicViewer/
│   │   ├── PCBOverlay.tsx       # Photo with AI overlay
│   │   ├── ComponentInfo.tsx    # Component details panel
│   │   └── TestPointNav.tsx     # Test point navigation
│   ├── PowerMonitor/
│   │   ├── CurrentGraph.tsx     # Real-time current plot
│   │   ├── SignatureMatch.tsx   # Boot signature analysis
│   │   └── PSUControl.tsx       # Programmable PSU
│   ├── Flasher/
│   │   ├── FlashQueue.tsx       # Multi-device queue
│   │   ├── FirmwareSelect.tsx   # Firmware browser
│   │   └── ProgressTracker.tsx  # Flash progress
│   └── Recovery/
│       ├── DeepRecovery.tsx     # ISP/chip-off tools
│       ├── DataRecovery.tsx     # Data extraction
│       └── BootRepair.tsx       # Bootloader repair
├── stores/
│   ├── deviceStore.ts           # Device state
│   ├── signalStore.ts           # Signal data
│   └── settingsStore.ts         # User preferences
└── lib/
    ├── tauri-commands.ts        # Tauri IPC wrappers
    └── hardware.ts              # Hardware abstraction
```

### Deliverables
```
✅ Tauri app builds and runs
✅ Device manager shows connected devices
✅ Basic tool launching from GUI
✅ Signal analyzer with real-time display
✅ Multi-device flash queue
```

---

## Phase 4: Electronics Engineering Integration

**Goal:** Full instrument suite for bench work.

### 4.1 Sigrok Integration

```yaml
# packages/electronics/sigrok/config/mobile-repairs.yml
session:
  name: "Mobile Repair Session"
  
  devices:
    - driver: "fx2lafw"
      channels: [D0, D1, D2, D3, D4, D5, D6, D7]
      sample_rate: "24MHz"
      
  decoders:
    - name: "i2c"
      channels:
        sda: D0
        scl: D1
      options:
        address_format: "7bit"
        
    - name: "spi"
      channels:
        clk: D2
        mosi: D3
        miso: D4
        cs: D5
        
    - name: "uart"
      channels:
        rx: D6
        tx: D7
      options:
        baudrate: 115200
        
    - name: "usb-pd"
      channels:
        cc1: D0
        cc2: D1
```

### 4.2 Thermal Imaging

```python
# packages/electronics/flir-sdk/thermal.py
from flir import FlirOne

class ThermalAnalyzer:
    def __init__(self):
        self.camera = FlirOne()
        
    def capture_thermal(self):
        """Capture thermal image for short detection"""
        thermal_data = self.camera.get_thermal_array()
        visual_data = self.camera.get_visual_image()
        
        return {
            'thermal': thermal_data,
            'visual': visual_data,
            'max_temp': thermal_data.max(),
            'hotspots': self.detect_hotspots(thermal_data)
        }
    
    def detect_hotspots(self, thermal_data, threshold=50.0):
        """Find components hotter than threshold"""
        hotspots = []
        for y, x in np.ndindex(thermal_data.shape):
            if thermal_data[y, x] > threshold:
                hotspots.append({
                    'x': x, 'y': y,
                    'temp': thermal_data[y, x]
                })
        return hotspots
```

### 4.3 KiCad Mobile Repair Libraries

```
packages/electronics/kicad-mobrepair/
├── libraries/
│   ├── pmic/
│   │   ├── PM8550.kicad_sym      # Qualcomm PMIC
│   │   ├── MT6370.kicad_sym      # MediaTek PMIC
│   │   └── S2MPS15.kicad_sym     # Samsung PMIC
│   ├── charging/
│   │   ├── BQ25895.kicad_sym     # TI Charger
│   │   ├── SY6974.kicad_sym      # MPS Charger
│   │   └── IP5306.kicad_sym      # Injoinic
│   ├── connectors/
│   │   ├── USB-C.kicad_sym       # USB Type-C
│   │   ├── Lightning.kicad_sym   # Apple Lightning
│   │   └── Micro-USB.kicad_sym   # Micro USB
│   └── passives/
│       ├── 0201-100k.kicad_sym   # Common resistor
│       └── 0402-10uF.kicad_sym   # Common capacitor
├── footprints/
│   ├── pmic/
│   ├── charging/
│   └── connectors/
└── 3d-models/
    └── ...
```

### Deliverables
```
✅ Logic analyzer captures and decodes I2C/SPI/UART
✅ Oscilloscope integration with mobile trigger profiles
✅ Thermal imaging identifies hotspots
✅ KiCad libraries with 50+ mobile components
```

---

## Phase 5: Mobile Service Core

**Goal:** Complete mobile device servicing stack.

### 5.1 Android Container

```dockerfile
# containers/android-tools/Dockerfile
FROM debian:bookworm-slim

# Install Android SDK tools
RUN apt-get update && apt-get install -y \
    wget unzip openjdk-17-jdk-headless

# Download Android SDK command-line tools
RUN wget -q https://dl.google.com/android/repository/commandlinetools-linux-latest.zip \
    && unzip commandlinetools-linux-latest.zip -d /opt/android-sdk \
    && rm commandlinetools-linux-latest.zip

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Install additional tools
RUN sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# Copy enhanced ADB wrapper
COPY enhanced-adb/ /opt/adb-enhanced/
COPY enhanced-fastboot/ /opt/fastboot-enhanced/

# Copy device database
COPY device-db/ /opt/device-db/

# Entry point
COPY entrypoint.sh /opt/entrypoint.sh
ENTRYPOINT ["/opt/entrypoint.sh"]
```

### 5.2 Qualcomm EDL Tools

```python
# containers/qualcomm-edl/tools/edl_client.py
import usb.core
import struct

class EDLClient:
    """Qualcomm Emergency Download mode client"""
    
    VENDOR_ID = 0x05C6
    PRODUCT_IDS = {
        0x9008: 'EDL',
        0x9006: 'Fastboot',
    }
    
    def __init__(self):
        self.device = usb.core.find(
            idVendor=self.VENDOR_ID,
            idProduct=0x9008
        )
        
    def connect(self):
        if self.device is None:
            raise DeviceNotFoundError("No EDL device found")
        
        self.device.set_configuration()
        
        # Sahara protocol handshake
        self.sahara_handshake()
        
    def sahara_handshake(self):
        """Initial Sahara protocol communication"""
        # Read hello packet
        hello = self.device.read(0x81, 64)
        
        # Parse and respond
        cmd = struct.unpack('<I', hello[:4])[0]
        if cmd == 0x01:  # HELLO
            self.send_hello_reply()
            
    def load_firehose(self, firehose_path):
        """Load programmer (firehose) image"""
        with open(firehose_path, 'rb') as f:
            programmer = f.read()
        
        # Send via Sahara
        self.sahara_send_programmer(programmer)
        
    def read_partition(self, partition_name):
        """Read raw partition data"""
        # Configure firehose for reading
        config = {
            'MemoryName': 'eMMC',
            'StartAddress': self.get_partition_offset(partition_name),
            'SectorSize': 512,
            'NumPartitionSectors': self.get_partition_size(partition_name)
        }
        
        return self.firehose_read(config)
```

### 5.3 Apple Tools Container

```dockerfile
# containers/apple-tools/Dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libimobiledevice6 \
    libimobiledevice-utils \
    ideviceinstaller \
    ifuse \
    usbmuxd \
    python3 \
    python3-pip

# Build latest libimobiledevice from source
RUN git clone https://github.com/libimobiledevice/libimobiledevice.git \
    && cd libimobiledevice \
    && ./autogen.sh \
    && make -j$(nproc) \
    && make install

# Install pymobiledevice3 for advanced features
RUN pip3 install pymobiledevice3

# Copy custom tools
COPY tools/ /opt/apple-tools/

ENTRYPOINT ["/opt/entrypoint.sh"]
```

### Deliverables
```
✅ ADB/Fastboot with enhanced logging
✅ Qualcomm EDL mode read/write
✅ MediaTek preloader communication
✅ Samsung Odin protocol
✅ libimobiledevice full integration
✅ ISP (In-System Programming) tools
```

---

## Phase 6: Hardware Abstraction Layer

**Goal:** Unified interface for all hardware peripherals.

### 6.1 HAL Architecture

```
hal/
├── src/
│   ├── lib.rs              # HAL entry point
│   ├── usb/
│   │   ├── mod.rs          # USB controller management
│   │   ├── enumerator.rs   # Device enumeration
│   │   └── passthrough.rs  # USB passthrough to containers
│   ├── uart/
│   │   ├── mod.rs          # UART interface
│   │   ├── ftdi.rs         # FTDI chip support
│   │   ├── ch340.rs        # CH340 chip support
│   │   └── level_shifter.rs # Voltage level shifting
│   ├── gpio/
│   │   ├── mod.rs          # GPIO control
│   │   ├── jtag.rs         # JTAG interface
│   │   ├── swd.rs          # SWD interface
│   │   └── i2c.rs          # I2C interface
│   ├── pd/
│   │   ├── mod.rs          # USB-PD controller
│   │   ├── negotiate.rs    # PD negotiation
│   │   └── sniff.rs        # PD protocol sniffing
│   └── psu/
│       ├── mod.rs          # Programmable PSU
│       ├── scpi.rs         # SCPI protocol
│       └── control.rs      # Voltage/current control
├── Cargo.toml
└── README.md
```

### 6.2 USB Controller Management

```rust
// hal/src/usb/mod.rs

use rusb::{Context, Device, DeviceDescriptor};

pub struct USBManager {
    context: Context,
    independent_controllers: Vec<USBController>,
}

impl USBManager {
    pub fn new() -> Result<Self> {
        let context = Context::new()?;
        
        // Identify independent USB controllers (not hubs)
        let controllers = Self::identify_controllers(&context)?;
        
        Ok(Self {
            context,
            independent_controllers: controllers,
        })
    }
    
    /// Identify independent USB controllers
    /// Critical for EDL mode stability
    fn identify_controllers(context: &Context) -> Result<Vec<USBController>> {
        let mut controllers = Vec::new();
        
        for device in context.devices()? {
            let desc = device.device_descriptor()?;
            
            // Check if device is a USB controller (class 0x09)
            if desc.class_code() == 0x09 {
                controllers.push(USBController {
                    bus: device.bus_number(),
                    address: device.address(),
                    ports: Self::count_ports(&device)?,
                });
            }
        }
        
        Ok(controllers)
    }
    
    /// Assign device to specific controller
    /// Prevents hub-related EDL disconnections
    pub fn assign_to_controller(
        &self,
        device: &Device,
        controller: &USBController,
    ) -> Result<()> {
        // Implementation for USB port binding
        todo!()
    }
}
```

### 6.3 UART with Level Shifting

```rust
// hal/src/uart/level_shifter.rs

pub enum VoltageLevel {
    V1_2,
    V1_8,
    V3_3,
    V5_0,
}

pub struct LevelShifter {
    /// Control pins for voltage selection
    ctrl_a: gpio::Pin,
    ctrl_b: gpio::Pin,
}

impl LevelShifter {
    pub fn set_voltage(&self, level: VoltageLevel) -> Result<()> {
        match level {
            VoltageLevel::V1_2 => {
                self.ctrl_a.set_low()?;
                self.ctrl_b.set_low()?;
            }
            VoltageLevel::V1_8 => {
                self.ctrl_a.set_low()?;
                self.ctrl_b.set_high()?;
            }
            VoltageLevel::V3_3 => {
                self.ctrl_a.set_high()?;
                self.ctrl_b.set_low()?;
            }
            VoltageLevel::V5_0 => {
                self.ctrl_a.set_high()?;
                self.ctrl_b.set_high()?;
            }
        }
        Ok(())
    }
    
    /// Auto-detect voltage from target device
    pub fn auto_detect(&self) -> Result<VoltageLevel> {
        // Measure voltage on target pin
        let voltage = self.adc_read()?;
        
        if voltage < 1.5 {
            Ok(VoltageLevel::V1_2)
        } else if voltage < 2.0 {
            Ok(VoltageLevel::V1_8)
        } else if voltage < 4.0 {
            Ok(VoltageLevel::V3_3)
        } else {
            Ok(VoltageLevel::V5_0)
        }
    }
}
```

### Deliverables
```
✅ USB controller identification and management
✅ UART with automatic voltage level detection
✅ GPIO/JTAG/SWD control interface
✅ USB-PD negotiation and sniffing
✅ Programmable PSU control (SCPI)
```

---

## Phase 7: Advanced Features

**Goal:** AI-powered diagnostics and collaborative repair database.

### 7.1 Schematic Overlay AI

```python
# ai/schematic-overlay/detector.py
from ultralytics import YOLO
import cv2

class ComponentDetector:
    def __init__(self, model_path="models/pcb_detector.pt"):
        self.model = YOLO(model_path)
        self.component_db = ComponentDatabase()
        
    def detect_components(self, image_path):
        """Detect and identify components on PCB"""
        image = cv2.imread(image_path)
        results = self.model(image)
        
        detections = []
        for result in results:
            for box in result.boxes:
                detection = {
                    'class': result.names[int(box.cls)],
                    'confidence': float(box.conf),
                    'bbox': box.xyxy.tolist(),
                    'component': self.identify_component(box)
                }
                detections.append(detection)
        
        return detections
    
    def identify_component(self, detection):
        """Match detection to known component database"""
        component_type = detection['class']
        
        # Query database for matching components
        matches = self.component_db.find_by_type(
            component_type,
            bbox_size=detection['bbox']
        )
        
        if matches:
            return matches[0]  # Best match
        
        return None
```

### 7.2 Power Signature Analysis

```python
# ai/power-analysis/classifier.py
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import pickle

class PowerSignatureClassifier:
    def __init__(self, model_path="models/power_classifier.pkl"):
        with open(model_path, 'rb') as f:
            self.model = pickle.load(f)
        
        self.signature_db = SignatureDatabase()
        
    def analyze(self, current_data, sample_rate=1000):
        """Analyze current consumption pattern"""
        features = self.extract_features(current_data, sample_rate)
        
        # Predict fault type
        prediction = self.model.predict([features])[0]
        confidence = self.model.predict_proba([features])[0].max()
        
        # Find matching known signature
        known_match = self.signature_db.find_closest(features)
        
        return {
            'prediction': prediction,
            'confidence': confidence,
            'known_signature': known_match,
            'suggestion': self.get_suggestion(prediction)
        }
    
    def extract_features(self, data, sample_rate):
        """Extract features from current waveform"""
        return {
            'mean': np.mean(data),
            'std': np.std(data),
            'max': np.max(data),
            'min': np.min(data),
            'peaks': len(self.find_peaks(data)),
            'stable_periods': self.count_stable_periods(data),
            'rise_time': self.measure_rise_time(data, sample_rate),
            'fall_time': self.measure_fall_time(data, sample_rate),
        }
    
    def get_suggestion(self, fault_type):
        suggestions = {
            'pmic_failure': 'Check PMIC output rails, reball if needed',
            'short_circuit': 'Thermal scan to locate short, check capacitors',
            'boot_loop': 'Try EDL/Recovery mode flash',
            'no_power': 'Check battery connector, PMIC input',
            'normal': 'Device appears healthy',
        }
        return suggestions.get(fault_type, 'Consult device documentation')
```

### 7.3 Collaborative Repair Database

```python
# database/api/server.py
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession

app = FastAPI(title="TechBench Repair Database")

@app.get("/api/v1/devices/{device_model}/test-points")
async def get_test_points(
    device_model: str,
    db: AsyncSession = Depends(get_db)
):
    """Get test points for a specific device model"""
    test_points = await db.query(TestPoint).filter(
        TestPoint.device_model == device_model
    ).all()
    
    return {
        'device': device_model,
        'test_points': [
            {
                'id': tp.id,
                'name': tp.name,
                'location': tp.location,
                'voltage': tp.voltage,
                'description': tp.description,
                'image_url': tp.image_url,
            }
            for tp in test_points
        ]
    }

@app.get("/api/v1/devices/{device_model}/known-faults")
async def get_known_faults(
    device_model: str,
    db: AsyncSession = Depends(get_db)
):
    """Get known faults and solutions"""
    faults = await db.query(KnownFault).filter(
        KnownFault.device_model == device_model
    ).all()
    
    return {
        'device': device_model,
        'faults': [
            {
                'symptom': f.symptom,
                'cause': f.cause,
                'solution': f.solution,
                'success_rate': f.success_rate,
                'votes': f.upvotes,
            }
            for f in faults
        ]
    }

@app.post("/api/v1/devices/{device_model}/test-points")
async def add_test_point(
    device_model: str,
    test_point: TestPointCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Community contribution of test points"""
    tp = TestPoint(
        device_model=device_model,
        **test_point.dict(),
        contributed_by=user.id
    )
    db.add(tp)
    await db.commit()
    
    return {'status': 'added', 'id': tp.id}
```

### 7.4 Offline-First Sync

```python
# database/sync/engine.py
import sqlite3
from datetime import datetime

class SyncEngine:
    """Offline-first database synchronization"""
    
    def __init__(self, local_db, remote_api):
        self.local = sqlite3.connect(local_db)
        self.remote = remote_api
        self.sync_log = self.load_sync_log()
        
    def sync(self):
        """Bidirectional sync with conflict resolution"""
        # 1. Push local changes
        local_changes = self.get_unsynced_changes()
        for change in local_changes:
            try:
                self.remote.push(change)
                self.mark_synced(change)
            except SyncConflict:
                self.resolve_conflict(change)
        
        # 2. Pull remote changes
        remote_changes = self.remote.pull(
            since=self.last_sync_time
        )
        for change in remote_changes:
            self.apply_remote_change(change)
        
        # 3. Update sync state
        self.last_sync_time = datetime.utcnow()
        self.save_sync_log()
        
    def resolve_conflict(self, local_change, remote_change):
        """Resolve sync conflicts"""
        # Last-write-wins for most fields
        # Community voting for test points and solutions
        if local_change.table == 'test_points':
            # Merge: keep both versions, let community vote
            self.merge_test_points(local_change, remote_change)
        else:
            # Last write wins
            if local_change.timestamp > remote_change.timestamp:
                self.apply_local_to_remote(local_change)
            else:
                self.apply_remote_to_local(remote_change)
```

### Deliverables
```
✅ PCB component detection (90%+ accuracy)
✅ Power signature classification
✅ Repair database with 1000+ test points
✅ Offline-first sync working
✅ Community contribution system
```

---

## Phase 8: Polish, Testing & Release

**Goal:** Production-ready release.

### Tasks

- [ ] Comprehensive testing:
  - Unit tests for all core modules
  - Integration tests for device detection
  - Hardware-in-the-loop tests
  - User acceptance testing with real technicians
- [ ] Documentation:
  - User manual
  - Hardware compatibility list
  - Troubleshooting guide
  - Developer documentation
- [ ] Performance optimization:
  - Boot time < 30 seconds
  - Device detection < 2 seconds
  - GUI responsive at 60fps
- [ ] Security audit:
  - Container isolation
  - USB passthrough security
  - Audit logging completeness
- [ ] Release:
  - ISO image
  - Live USB builder
  - Update mechanism
  - Community forum/discord

### Deliverables
```
✅ v1.0 release candidate
✅ Documentation complete
✅ Security audit passed
✅ Community channels established
```

---

## Hardware Requirements

### Minimum
- CPU: Intel i5 8th gen / AMD Ryzen 5 2600
- RAM: 8GB
- Storage: 64GB (for live USB persistence)
- USB: 2x independent USB controllers
- Display: 1920x1080

### Recommended
- CPU: Intel i7 10th gen / AMD Ryzen 7 3700X
- RAM: 16GB
- Storage: 256GB NVMe SSD
- USB: 3-4x independent USB controllers
- Serial: FTDI-based USB-to-serial adapter
- GPIO: Intel NUC-style header or external USB GPIO
- Thunderbolt: For high-speed oscilloscopes

### Optimal
- CPU: Intel i9 12th gen / AMD Ryzen 9 5900X
- RAM: 32GB
- Storage: 512GB NVMe SSD
- USB: 4+ independent USB controllers
- Serial: Multiple FTDI adapters
- GPIO: Custom Mobile Debug Hat
- Thunderbolt 4: For premium oscilloscopes

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0 | 1-2 weeks | None |
| Phase 1 | 4-6 weeks | Phase 0 |
| Phase 2 | 3-4 weeks | Phase 1 |
| Phase 3 | 6-8 weeks | Phase 1, 2 |
| Phase 4 | 4-6 weeks | Phase 1 |
| Phase 5 | 6-8 weeks | Phase 2 |
| Phase 6 | 4-6 weeks | Phase 1 |
| Phase 7 | 8-12 weeks | Phase 3, 5 |
| Phase 8 | 4-6 weeks | All phases |

**Total:** 40-58 weeks (10-14 months)

**Parallel tracks:**
- Phase 4 (Electronics) can run parallel with Phase 5 (Mobile)
- Phase 6 (HAL) can run parallel with Phase 3 (GUI)
- Phase 7 (Advanced) starts after Phase 3 and 5 complete

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Boot time (live USB) | < 30 seconds |
| Device detection | < 2 seconds |
| Supported devices | 200+ models |
| Protocol decoders | 15+ protocols |
| Test point database | 10,000+ entries |
| Known faults database | 5,000+ entries |
| GUI responsiveness | 60fps |
| Container startup | < 5 seconds |
