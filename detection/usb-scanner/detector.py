#!/usr/bin/env python3
"""
TechBench - USB Device Detector (Cross-Platform)
Monitors USB ports and auto-detects connected devices.
Supports Linux (pyudev), Windows (WMI/setupapi), and macOS (IOKit).
"""

import os
import sys
import json
import time
import logging
import platform
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Optional, List
from dataclasses import dataclass
from datetime import datetime

# --- Platform detection ---
IS_WINDOWS = platform.system() == "Windows"
IS_LINUX = platform.system() == "Linux"
IS_MACOS = platform.system() == "Darwin"

# --- Platform-specific imports ---
if IS_LINUX:
    try:
        import pyudev
    except ImportError:
        pyudev = None

if IS_WINDOWS:
    try:
        import ctypes
        from ctypes import wintypes
    except ImportError:
        ctypes = None

# --- Cross-platform path resolution ---
def get_app_data_dir() -> Path:
    """Get platform-appropriate application data directory"""
    if IS_WINDOWS:
        base = os.environ.get("LOCALAPPDATA", os.path.expanduser("~\\AppData\\Local"))
        return Path(base) / "TechBench"
    elif IS_MACOS:
        return Path.home() / "Library" / "Application Support" / "TechBench"
    else:
        return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "techbench"

def get_app_log_dir() -> Path:
    """Get platform-appropriate log directory"""
    if IS_WINDOWS:
        base = os.environ.get("LOCALAPPDATA", os.path.expanduser("~\\AppData\\Local"))
        return Path(base) / "TechBench" / "logs"
    elif IS_MACOS:
        return Path.home() / "Library" / "Logs" / "TechBench"
    else:
        return Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local" / "state")) / "techbench" / "logs"

def get_app_cache_dir() -> Path:
    """Get platform-appropriate cache/temp directory"""
    if IS_WINDOWS:
        base = os.environ.get("LOCALAPPDATA", os.path.expanduser("~\\AppData\\Local"))
        return Path(base) / "TechBench" / "cache"
    elif IS_MACOS:
        return Path.home() / "Library" / "Caches" / "TechBench"
    else:
        return Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "techbench"

def get_workspaces_dir() -> Path:
    """Get platform-appropriate workspaces directory"""
    if IS_WINDOWS:
        base = os.environ.get("LOCALAPPDATA", os.path.expanduser("~\\AppData\\Local"))
        return Path(base) / "TechBench" / "workspaces"
    else:
        return Path.home() / "TechBench" / "workspaces"

def get_chipset_db_path() -> Path:
    """Get path to chipset database"""
    # Try relative to this script first
    script_dir = Path(__file__).parent
    local_db = script_dir.parent / "chipset-id" / "database.json"
    if local_db.exists():
        return local_db

    if IS_WINDOWS:
        base = os.environ.get("PROGRAMDATA", "C:\\ProgramData")
        return Path(base) / "TechBench" / "chipset-id" / "database.json"
    else:
        return Path("/opt/techbench/detection/chipset-id/database.json")

# --- Configure logging cross-platform ---
log_dir = get_app_log_dir()
log_dir.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(log_dir / "device-detector.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


@dataclass
class DeviceInfo:
    """Information about a detected device"""
    vendor_id: str
    product_id: str
    vendor_name: str
    product_name: str
    device_type: str  # android, apple, qualcomm, mediatek, samsung, unknown
    boot_mode: str  # normal, edl, recovery, dfu, fastboot, download, unknown
    container: Optional[str]  # container to launch
    tools: List[str]  # available tools
    chipset: Optional[str] = None  # chipset information
    functions: Optional[List[str]] = None  # supported functions
    notes: Optional[str] = None  # additional notes
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()
        if self.functions is None:
            self.functions = []


class ChipsetDatabase:
    """Database of known chipsets and their identifiers"""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = Path(db_path) if db_path else get_chipset_db_path()
        self.database = self._load_database()

    def _load_database(self) -> Dict:
        if self.db_path.exists():
            with open(self.db_path, "r") as f:
                return json.load(f)
        else:
            logger.warning(f"Database not found at {self.db_path}, using defaults")
            return self._get_default_database()

    def _get_default_database(self) -> Dict:
        return {
            "05c6:90db": {
                "vendor": "qualcomm", "chipset": "snapdragon",
                "name": "Qualcomm QDLoader 9008", "boot_modes": ["edl", "normal"],
                "tools": ["qfil", "firehose", "sahara"], "container": "qualcomm-edl",
            },
            "0e8d:0003": {
                "vendor": "mediatek", "chipset": "mtk",
                "name": "MediaTek Preloader", "boot_modes": ["preloader", "normal"],
                "tools": ["sp-flash-tool", "mtk-daemon"], "container": "mediatek-flash",
            },
            "04e8:6860": {
                "vendor": "samsung", "chipset": "exynos",
                "name": "Samsung Galaxy (MTP)", "boot_modes": ["normal"],
                "tools": ["adb"], "container": "android-tools",
            },
            "05ac:1227": {
                "vendor": "apple", "chipset": "a-series",
                "name": "Apple DFU Mode", "boot_modes": ["dfu", "recovery", "normal"],
                "tools": ["idevicerestore", "checkm8"], "container": "apple-tools",
            },
            "18d1:4ee7": {
                "vendor": "google", "chipset": "pixel",
                "name": "Google Pixel (Fastboot)", "boot_modes": ["fastboot", "normal"],
                "tools": ["fastboot", "adb"], "container": "android-tools",
            },
            "18d1:d002": {
                "vendor": "google", "chipset": "pixel",
                "name": "Google Pixel (ADB)", "boot_modes": ["normal"],
                "tools": ["adb"], "container": "android-tools",
            },
        }

    def lookup(self, vendor_id: str, product_id: str) -> Optional[Dict]:
        return self.database.get(f"{vendor_id}:{product_id}")

    def detect_boot_mode(self, vendor_id: str, product_id: str) -> str:
        info = self.lookup(vendor_id, product_id)
        if info:
            modes = info.get("boot_modes", ["normal"])
            return modes[0] if modes else "normal"
        return "normal"


# ============================================================================
#  Platform-specific USB monitor backends
# ============================================================================

class USBMonitorBase:
    """Abstract base class for USB monitoring"""
    def scan(self) -> List[DeviceInfo]:
        raise NotImplementedError
    def start_monitoring(self, on_connect, on_disconnect):
        raise NotImplementedError
    def stop(self):
        pass


class LinuxUSBMonitor(USBMonitorBase):
    """Linux USB monitor using pyudev"""

    def __init__(self):
        if pyudev is None:
            raise RuntimeError("pyudev is required on Linux. Install with: pip install pyudev")
        self.context = pyudev.Context()
        self.monitor = pyudev.Monitor.from_netlink(self.context)
        self.monitor.filter_by(subsystem="usb")
        self._running = False

    def scan(self) -> List[DeviceInfo]:
        devices = []
        for device in self.context.list_devices(subsystem="usb"):
            if device.device_type == "usb_device":
                info = _identify_from_udev_props(device)
                if info:
                    devices.append(info)
        return devices

    def start_monitoring(self, on_connect, on_disconnect):
        self._running = True
        for action, device in self.monitor:
            if not self._running:
                break
            if device.device_type == "usb_device":
                if action == "add":
                    info = _identify_from_udev_props(device)
                    if info:
                        on_connect(info)
                elif action == "remove":
                    vid = device.get("ID_VENDOR_ID", "0000")
                    pid = device.get("ID_MODEL_ID", "0000")
                    on_disconnect(vid, pid)

    def stop(self):
        self._running = False


def _identify_from_udev_props(device) -> Optional[DeviceInfo]:
    """Extract device info from udev properties"""
    vendor_id = device.get("ID_VENDOR_ID", "0000")
    product_id = device.get("ID_MODEL_ID", "0000")
    vendor_name = device.get("ID_VENDOR_FROM_DATABASE", "Unknown")
    product_name = device.get("ID_MODEL_FROM_DATABASE", "Unknown")
    
    # Try to get more detailed information from udev properties
    if vendor_name == "Unknown":
        vendor_name = device.get("ID_VENDOR", "Unknown")
    if product_name == "Unknown":
        product_name = device.get("ID_MODEL", "Unknown")
    
    return _build_device_info(vendor_id, product_id, vendor_name, product_name)


class WindowsUSBMonitor(USBMonitorBase):
    """Windows USB monitor using WMI / SetupAPI"""

    def __init__(self):
        self._running = False
        self._known_devices: Dict[str, DeviceInfo] = {}

    def _get_connected_devices_wmi(self) -> List[Dict[str, str]]:
        """Query WMI for connected USB devices"""
        devices = []
        try:
            result = subprocess.run(
                [
                    "powershell", "-Command",
                    "Get-CimInstance Win32_USBControllerDevice | "
                    "ForEach-Object { [wmi]($_.Dependent) } | "
                    "Select-Object DeviceID, Name, Manufacturer, "
                    "PNPDeviceID | ConvertTo-Json -Compress"
                ],
                capture_output=True, text=True, timeout=10,
                creationflags=subprocess.CREATE_NO_WINDOW if IS_WINDOWS else 0,
            )
            if result.returncode == 0 and result.stdout.strip():
                data = json.loads(result.stdout)
                if isinstance(data, dict):
                    data = [data]
                for dev in data:
                    devices.append(dev)
        except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
            pass
        return devices

    def _extract_vid_pid(self, pnp_device_id: str) -> tuple:
        """Extract VID and PID from PnP device ID string like USB\\VID_05C6&PID_9008\\..."""
        vid, pid = "0000", "0000"
        upper = pnp_device_id.upper()
        if "VID_" in upper:
            start = upper.index("VID_") + 4
            vid = upper[start:start + 4].lower()
        if "PID_" in upper:
            start = upper.index("PID_") + 4
            pid = upper[start:start + 4].lower()
        return vid, pid

    def scan(self) -> List[DeviceInfo]:
        devices = []
        for dev in self._get_connected_devices_wmi():
            pnp_id = dev.get("PNPDeviceID", "")
            if not pnp_id.upper().startswith("USB\\"):
                continue
            vid, pid = self._extract_vid_pid(pnp_id)
            name = dev.get("Name", "Unknown USB Device")
            manufacturer = dev.get("Manufacturer", "Unknown")
            info = _build_device_info(vid, pid, manufacturer, name)
            if info:
                devices.append(info)
        return devices

    def start_monitoring(self, on_connect, on_disconnect):
        self._running = True
        known = set()
        while self._running:
            current = set()
            for dev in self._get_connected_devices_wmi():
                pnp_id = dev.get("PNPDeviceID", "")
                if not pnp_id.upper().startswith("USB\\"):
                    continue
                vid, pid = self._extract_vid_pid(pnp_id)
                key = f"{vid}:{pid}"
                current.add(key)
                if key not in known:
                    name = dev.get("Name", "Unknown USB Device")
                    manufacturer = dev.get("Manufacturer", "Unknown")
                    info = _build_device_info(vid, pid, manufacturer, name)
                    if info:
                        on_connect(info)
            # Detect removals
            for key in known - current:
                vid, pid = key.split(":")
                on_disconnect(vid, pid)
            known = current
            time.sleep(2)  # Poll every 2 seconds on Windows

    def stop(self):
        self._running = False


class MacUSBMonitor(USBMonitorBase):
    """macOS USB monitor using system_profiler"""

    def __init__(self):
        self._running = False

    def _get_usb_devices(self) -> List[Dict[str, str]]:
        devices = []
        try:
            result = subprocess.run(
                ["system_profiler", "SPUSBDataType", "-json"],
                capture_output=True, text=True, timeout=10,
            )
            if result.returncode == 0:
                data = json.loads(result.stdout)
                items = data.get("SPUSBDataType", [])
                for item in items:
                    self._flatten_usb_tree(item, devices)
        except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
            pass
        return devices

    def _flatten_usb_tree(self, item, devices, depth=0):
        if "USB Serial Number" in item or "Vendor ID" in item:
            devices.append(item)
        for child in item.get("_items", []):
            self._flatten_usb_tree(child, devices, depth + 1)

    def scan(self) -> List[DeviceInfo]:
        devices = []
        for dev in self._get_usb_devices():
            vid_hex = dev.get("Vendor ID", "0x0000")
            pid_hex = dev.get("Product ID", "0x0000")
            vid = f"{int(vid_hex, 16):04x}"
            pid = f"{int(pid_hex, 16):04x}"
            name = dev.get("Product Name", "Unknown")
            mfg = dev.get("Manufacturer", "Unknown")
            info = _build_device_info(vid, pid, mfg, name)
            if info:
                devices.append(info)
        return devices

    def start_monitoring(self, on_connect, on_disconnect):
        self._running = True
        known = set()
        while self._running:
            current = set()
            for dev in self._get_usb_devices():
                vid_hex = dev.get("Vendor ID", "0x0000")
                pid_hex = dev.get("Product ID", "0x0000")
                vid = f"{int(vid_hex, 16):04x}"
                pid = f"{int(pid_hex, 16):04x}"
                key = f"{vid}:{pid}"
                current.add(key)
                if key not in known:
                    name = dev.get("Product Name", "Unknown")
                    mfg = dev.get("Manufacturer", "Unknown")
                    info = _build_device_info(vid, pid, mfg, name)
                    if info:
                        on_connect(info)
            for key in known - current:
                vid, pid = key.split(":")
                on_disconnect(vid, pid)
            known = current
            time.sleep(2)

    def stop(self):
        self._running = False


# ============================================================================
#  Shared helpers
# ============================================================================

_chipset_db = ChipsetDatabase()

def _build_device_info(vendor_id: str, product_id: str, vendor_name: str, product_name: str) -> Optional[DeviceInfo]:
    """Build DeviceInfo from raw USB identifiers"""
    db_entry = _chipset_db.lookup(vendor_id, product_id)
    if db_entry:
        device_type = db_entry.get("vendor", "unknown")
        boot_mode = _chipset_db.detect_boot_mode(vendor_id, product_id)
        container = db_entry.get("container")
        tools = db_entry.get("tools", [])
        chipset = db_entry.get("chipset")
        functions = db_entry.get("functions", [])
        notes = db_entry.get("notes")
    else:
        device_type = _guess_device_type(vendor_name, product_name)
        boot_mode = "normal"
        container = _get_default_container(device_type)
        tools = _get_default_tools(device_type)
        chipset = None
        functions = []
        notes = None

    return DeviceInfo(
        vendor_id=vendor_id, product_id=product_id,
        vendor_name=vendor_name, product_name=product_name,
        device_type=device_type, boot_mode=boot_mode,
        container=container, tools=tools,
        chipset=chipset, functions=functions, notes=notes,
    )


def _guess_device_type(vendor_name: str, product_name: str) -> str:
    v = vendor_name.lower()
    p = product_name.lower()
    if "qualcomm" in v or "qcom" in v:
        return "qualcomm"
    elif "mediatek" in v or "mtk" in v:
        return "mediatek"
    elif "samsung" in v:
        return "samsung"
    elif "apple" in v or "iphone" in p or "ipad" in p:
        return "apple"
    elif "google" in v or "pixel" in p:
        return "android"
    elif "xiaomi" in v or "redmi" in v or "poco" in v:
        return "xiaomi"
    elif "huawei" in v or "honor" in v:
        return "huawei"
    elif "oppo" in v or "realme" in v:
        return "oppo"
    elif "vivo" in v or "iqoo" in v:
        return "vivo"
    elif "motorola" in v or "moto" in v:
        return "motorola"
    elif "lenovo" in v or "tab" in p:
        return "lenovo"
    elif "tecno" in v or "infinix" in v or "itel" in v:
        return "tecno"
    elif "zte" in v or "nubia" in v:
        return "zte"
    elif "sony" in v or "xperia" in p:
        return "sony"
    elif "lg" in v:
        return "lg"
    elif "htc" in v:
        return "htc"
    elif "oneplus" in v:
        return "oneplus"
    elif "nokia" in v:
        return "nokia"
    elif "android" in p:
        return "android"
    return "unknown"


def _get_default_container(device_type: str) -> str:
    return {
        "qualcomm": "qualcomm-edl", "mediatek": "mediatek-flash",
        "samsung": "samsung-odin", "apple": "apple-tools",
        "android": "android-tools", "xiaomi": "android-tools",
        "huawei": "android-tools", "oppo": "android-tools",
        "vivo": "android-tools", "motorola": "android-tools",
        "lenovo": "android-tools", "tecno": "android-tools",
        "zte": "android-tools", "sony": "android-tools",
        "lg": "android-tools", "htc": "android-tools",
        "oneplus": "android-tools", "nokia": "android-tools",
    }.get(device_type, "android-tools")


def _get_default_tools(device_type: str) -> List[str]:
    return {
        "qualcomm": ["edl", "firehose", "sahara"],
        "mediatek": ["sp-flash", "preloader"],
        "samsung": ["heimdall", "odin"],
        "apple": ["idevicerestore", "libimobiledevice"],
        "android": ["adb", "fastboot"],
        "xiaomi": ["adb", "fastboot", "miflash"],
        "huawei": ["adb", "fastboot", "hisuite"],
        "oppo": ["adb", "fastboot"],
        "vivo": ["adb", "fastboot"],
        "motorola": ["adb", "fastboot"],
        "lenovo": ["adb", "fastboot"],
        "tecno": ["adb", "fastboot"],
        "zte": ["adb", "fastboot"],
        "sony": ["adb", "fastboot"],
        "lg": ["adb", "fastboot"],
        "htc": ["adb", "fastboot"],
        "oneplus": ["adb", "fastboot"],
        "nokia": ["adb", "fastboot"],
    }.get(device_type, ["adb"])


# ============================================================================
#  Container runtime abstraction
# ============================================================================

class ContainerRunner:
    """Cross-platform container runner (Docker / Podman)"""

    def __init__(self):
        self.runtime = self._detect_runtime()

    def _detect_runtime(self) -> Optional[str]:
        for cmd in ["docker", "podman"]:
            try:
                result = subprocess.run(
                    [cmd, "--version"], capture_output=True, text=True, timeout=5,
                    creationflags=subprocess.CREATE_NO_WINDOW if IS_WINDOWS else 0,
                )
                if result.returncode == 0:
                    return cmd
            except (FileNotFoundError, subprocess.TimeoutExpired):
                continue
        return None

    def is_available(self) -> bool:
        return self.runtime is not None

    def run(self, name: str, image: str, workspace_path: Path, extra_args: List[str] = None) -> bool:
        if not self.runtime:
            logger.warning("No container runtime (docker/podman) found")
            return False
        try:
            cmd = [
                self.runtime, "run", "-d",
                "--name", name,
                "-v", f"{workspace_path}:/workspace",
            ]
            if IS_LINUX:
                cmd.extend(["--device", "/dev/bus/usb:/dev/bus/usb", "--privileged"])
            if extra_args:
                cmd.extend(extra_args)
            cmd.append(image)
            subprocess.Popen(
                cmd,
                creationflags=subprocess.CREATE_NO_WINDOW if IS_WINDOWS else 0,
            )
            return True
        except Exception as e:
            logger.error(f"Failed to launch container: {e}")
            return False

    def stop(self, name: str):
        if self.runtime:
            try:
                subprocess.run(
                    [self.runtime, "stop", name],
                    capture_output=True,
                    creationflags=subprocess.CREATE_NO_WINDOW if IS_WINDOWS else 0,
                )
            except Exception:
                pass


# ============================================================================
#  Driver loading abstraction
# ============================================================================

class DriverLoader:
    """Load appropriate drivers / kernel modules for detected devices"""

    @staticmethod
    def load_for_device(device_info: DeviceInfo):
        if IS_LINUX:
            DriverLoader._load_linux_modules(device_info)
        elif IS_WINDOWS:
            DriverLoader._ensure_windows_driver(device_info)

    @staticmethod
    def _load_linux_modules(device_info: DeviceInfo):
        modules = ["usbserial"]
        if device_info.vendor_id == "05c6":
            modules.append("qcserial")
        elif device_info.vendor_id == "0e8d":
            modules.append("mtk_download_agent")
        for mod in modules:
            try:
                subprocess.run(["modprobe", mod], check=True, capture_output=True)
                logger.info(f"Loaded module: {mod}")
            except (subprocess.CalledProcessError, FileNotFoundError):
                logger.warning(f"Failed to load module: {mod}")

    @staticmethod
    def _ensure_windows_driver(device_info: DeviceInfo):
        logger.info(f"Windows: device {device_info.vendor_id}:{device_info.product_id} "
                     "detected (ensure WinUSB driver via Zadig if needed)")


# ============================================================================
#  Main detector
# ============================================================================

class DeviceDetector:
    """Main device detection class - cross-platform"""

    def __init__(self):
        if IS_LINUX and pyudev is not None:
            self.monitor_backend: USBMonitorBase = LinuxUSBMonitor()
        elif IS_WINDOWS:
            self.monitor_backend = WindowsUSBMonitor()
        elif IS_MACOS:
            self.monitor_backend = MacUSBMonitor()
        else:
            raise RuntimeError(f"Unsupported platform: {platform.system()}")

        self.chipset_db = ChipsetDatabase()
        self.active_devices: Dict[str, DeviceInfo] = {}
        self.workspaces_dir = get_workspaces_dir()
        self.workspaces_dir.mkdir(parents=True, exist_ok=True)
        self.container_runner = ContainerRunner()
        self._running = False

    def create_workspace(self, device_info: DeviceInfo) -> Path:
        workspace_name = f"{device_info.vendor_id}_{device_info.product_id}_{int(time.time())}"
        workspace_path = self.workspaces_dir / workspace_name
        workspace_path.mkdir(parents=True, exist_ok=True)

        for sub in ["firmware", "backups", "logs", "partitions"]:
            (workspace_path / sub).mkdir(exist_ok=True)

        with open(workspace_path / "device_info.json", "w") as f:
            json.dump({
                "vendor_id": device_info.vendor_id,
                "product_id": device_info.product_id,
                "vendor_name": device_info.vendor_name,
                "product_name": device_info.product_name,
                "device_type": device_info.device_type,
                "boot_mode": device_info.boot_mode,
                "container": device_info.container,
                "tools": device_info.tools,
                "chipset": device_info.chipset,
                "functions": device_info.functions,
                "notes": device_info.notes,
                "platform": platform.system(),
                "created_at": device_info.timestamp.isoformat(),
            }, f, indent=2)

        logger.info(f"Created workspace: {workspace_path}")
        return workspace_path

    def launch_container(self, device_info: DeviceInfo, workspace_path: Path) -> bool:
        if not device_info.container:
            return False
        container_name = f"techbench-{device_info.container}-{device_info.vendor_id}"
        return self.container_runner.run(
            name=container_name,
            image=f"techbench/{device_info.container}",
            workspace_path=workspace_path,
        )

    def on_device_connected(self, device_info: DeviceInfo):
        logger.info(f"Device connected: {device_info.vendor_name} {device_info.product_name}")
        logger.info(f"  Type: {device_info.device_type}, Boot: {device_info.boot_mode}")

        DriverLoader.load_for_device(device_info)
        workspace_path = self.create_workspace(device_info)
        self.launch_container(device_info, workspace_path)

        device_key = f"{device_info.vendor_id}:{device_info.product_id}"
        self.active_devices[device_key] = device_info
        self._notify_gui("connected", device_info)

    def on_device_disconnected(self, vendor_id: str, product_id: str):
        device_key = f"{vendor_id}:{product_id}"
        if device_key in self.active_devices:
            device_info = self.active_devices.pop(device_key)
            logger.info(f"Device disconnected: {device_info.vendor_name} {device_info.product_name}")
            container_name = f"techbench-{device_info.container}-{vendor_id}"
            self.container_runner.stop(container_name)
            self._notify_gui("disconnected", device_info)

    def _notify_gui(self, event: str, device_info: DeviceInfo):
        notification = {
            "event": event,
            "device": {
                "vendor_id": device_info.vendor_id,
                "product_id": device_info.product_id,
                "vendor_name": device_info.vendor_name,
                "product_name": device_info.product_name,
                "device_type": device_info.device_type,
                "boot_mode": device_info.boot_mode,
                "tools": device_info.tools,
                "chipset": device_info.chipset,
                "functions": device_info.functions,
                "notes": device_info.notes,
            },
            "timestamp": device_info.timestamp.isoformat(),
        }

        cache_dir = get_app_cache_dir()
        cache_dir.mkdir(parents=True, exist_ok=True)
        with open(cache_dir / "device_event.json", "w") as f:
            json.dump(notification, f, indent=2)

        log_dir = get_app_log_dir()
        log_dir.mkdir(parents=True, exist_ok=True)
        with open(log_dir / "device_events.log", "a") as f:
            f.write(f"{json.dumps(notification)}\n")

    def scan_existing(self):
        logger.info("Scanning for existing USB devices...")
        for dev in self.monitor_backend.scan():
            self.on_device_connected(dev)

    def run(self):
        logger.info(f"TechBench Device Detector started ({platform.system()})")
        self._running = True
        self.scan_existing()
        self.monitor_backend.start_monitoring(
            on_connect=self.on_device_connected,
            on_disconnect=self.on_device_disconnected,
        )

    def stop(self):
        self._running = False
        self.monitor_backend.stop()


def main():
    detector = DeviceDetector()
    try:
        detector.run()
    except KeyboardInterrupt:
        logger.info("Device detector stopped")
        detector.stop()
        sys.exit(0)
    except Exception as e:
        logger.error(f"Device detector error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
