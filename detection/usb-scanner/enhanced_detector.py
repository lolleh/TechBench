#!/usr/bin/env python3
"""
TechBench - Enhanced Device Detection Engine
Supports multiple detection methods and auto-configuration
"""

import os
import sys
import json
import time
import logging
import subprocess
import threading
from pathlib import Path
from typing import Dict, Optional, List, Callable, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
import hashlib
import queue

try:
    import pyudev
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "pyudev"], check=True)
    import pyudev

# Configure logging
log_dir = Path('/var/log/techbench')
log_file = log_dir / 'detection-engine.log'

# Create log directory if it doesn't exist
try:
    log_dir.mkdir(parents=True, exist_ok=True)
    log_handlers = [
        logging.FileHandler(str(log_file)),
        logging.StreamHandler()
    ]
except (PermissionError, OSError):
    # Fallback to console only if can't write to log file
    log_handlers = [logging.StreamHandler()]

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=log_handlers
)
logger = logging.getLogger(__name__)


class DeviceType(Enum):
    ANDROID = "android"
    APPLE = "apple"
    QUALCOMM = "qualcomm"
    MEDIATEK = "mediatek"
    SAMSUNG = "samsung"
    XIAOMI = "xiaomi"
    HUAWEI = "huawei"
    OPPO = "oppo"
    VIVO = "vivo"
    MOTOROLA = "motorola"
    LENOVO = "lenovo"
    TECNO = "tecno"
    ZTE = "zte"
    SONY = "sony"
    LG = "lg"
    HTC = "htc"
    ONEPLUS = "oneplus"
    NOKIA = "nokia"
    GENERIC = "generic"
    UNKNOWN = "unknown"


class BootMode(Enum):
    NORMAL = "normal"
    FASTBOOT = "fastboot"
    EDL = "edl"
    RECOVERY = "recovery"
    DFU = "dfu"
    DOWNLOAD = "download"
    PRELOADER = "preloader"
    UNKNOWN = "unknown"


class DeviceStatus(Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    BUSY = "busy"


@dataclass
class DeviceCapabilities:
    """Capabilities of a detected device"""
    can_flash: bool = False
    can_read_info: bool = False
    can_backup: bool = False
    can_restore: bool = False
    can_unlock_bootloader: bool = False
    can_bypass_frp: bool = False
    can_isp: bool = False  # In-System Programming
    can_jtag: bool = False
    supported_protocols: List[str] = field(default_factory=list)
    max_transfer_speed: int = 0  # bytes per second


@dataclass
class DeviceEvent:
    """Event emitted when device state changes"""
    event_type: str  # connected, disconnected, status_changed
    device_id: str
    timestamp: datetime
    data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DetectedDevice:
    """Information about a detected device"""
    id: str
    vendor_id: str
    product_id: str
    vendor_name: str
    product_name: str
    device_type: DeviceType
    boot_mode: BootMode
    status: DeviceStatus
    capabilities: DeviceCapabilities
    container: Optional[str] = None
    tools: List[str] = field(default_factory=list)
    serial: Optional[str] = None
    firmware_version: Optional[str] = None
    chipset: Optional[str] = None
    workspace_path: Optional[Path] = None
    first_seen: datetime = field(default_factory=datetime.now)
    last_seen: datetime = field(default_factory=datetime.now)
    event_history: List[DeviceEvent] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'vendor_id': self.vendor_id,
            'product_id': self.product_id,
            'vendor_name': self.vendor_name,
            'product_name': self.product_name,
            'device_type': self.device_type.value,
            'boot_mode': self.boot_mode.value,
            'status': self.status.value,
            'capabilities': asdict(self.capabilities),
            'container': self.container,
            'tools': self.tools,
            'serial': self.serial,
            'firmware_version': self.firmware_version,
            'chipset': self.chipset,
            'workspace_path': str(self.workspace_path) if self.workspace_path else None,
            'first_seen': self.first_seen.isoformat(),
            'last_seen': self.last_seen.isoformat(),
        }


class ChipsetDatabase:
    """Enhanced chipset database with detailed device information"""
    
    def __init__(self, db_path: str = None):
        if db_path:
            self.db_path = Path(db_path)
        else:
            # Try relative to this script first
            script_dir = Path(__file__).parent
            local_db = script_dir.parent / "chipset-id" / "database.json"
            if local_db.exists():
                self.db_path = local_db
            else:
                self.db_path = Path("/opt/techbench/detection/chipset-id/database.json")
        self.database = self._load_database()
        self.vendor_names = self._build_vendor_map()
    
    def _load_database(self) -> Dict:
        if self.db_path.exists():
            with open(self.db_path, 'r') as f:
                return json.load(f)
        return self._get_default_database()
    
    def _get_default_database(self) -> Dict:
        return {
            "05c6:90db": {
                "vendor": "qualcomm",
                "chipset": "snapdragon",
                "name": "Qualcomm QDLoader 9008",
                "description": "Qualcomm Emergency Download (EDL) mode",
                "boot_modes": ["edl"],
                "tools": ["edl", "firehose", "sahara", "qfil"],
                "container": "qualcomm-edl",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "can_isp": True,
                    "supported_protocols": ["sahara", "firehose"]
                }
            },
            "0e8d:0003": {
                "vendor": "mediatek",
                "chipset": "mtk",
                "name": "MediaTek Preloader",
                "description": "MediaTek preloader mode",
                "boot_modes": ["preloader"],
                "tools": ["sp-flash-tool", "mtkclient"],
                "container": "mediatek-flash",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["mtk_preloader"]
                }
            },
            "04e8:6860": {
                "vendor": "samsung",
                "chipset": "exynos",
                "name": "Samsung Download Mode",
                "description": "Samsung Odin download mode",
                "boot_modes": ["download"],
                "tools": ["heimdall", "odin"],
                "container": "samsung-odin",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["odin"]
                }
            },
            "05ac:1227": {
                "vendor": "apple",
                "chipset": "a-series",
                "name": "Apple DFU Mode",
                "description": "Apple Device Firmware Upgrade mode",
                "boot_modes": ["dfu"],
                "tools": ["idevicerestore", "checkm8", "libimobiledevice"],
                "container": "apple-tools",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "can_restore": True,
                    "supported_protocols": ["usb", "checkm8"]
                }
            },
            "18d1:4ee7": {
                "vendor": "google",
                "chipset": "snapdragon",
                "name": "Google Pixel (Fastboot)",
                "description": "Google Pixel in fastboot mode",
                "boot_modes": ["fastboot"],
                "tools": ["fastboot", "adb"],
                "container": "android-tools",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "can_unlock_bootloader": True,
                    "supported_protocols": ["fastboot"]
                }
            },
            "2717:ff48": {
                "vendor": "xiaomi",
                "chipset": "snapdragon",
                "name": "Xiaomi (Fastboot)",
                "description": "Xiaomi device in fastboot mode",
                "boot_modes": ["fastboot"],
                "tools": ["fastboot", "miflash", "adb"],
                "container": "android-tools",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "can_unlock_bootloader": True,
                    "supported_protocols": ["fastboot", "miflash"]
                }
            },
            "2717:ff40": {
                "vendor": "xiaomi",
                "chipset": "mtk",
                "name": "Xiaomi (MediaTek)",
                "description": "Xiaomi MediaTek device",
                "boot_modes": ["preloader"],
                "tools": ["sp-flash-tool", "mtkclient"],
                "container": "mediatek-flash",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["mtk_preloader"]
                }
            },
            "17ef:6009": {
                "vendor": "lenovo",
                "chipset": "qualcomm",
                "name": "Lenovo Tab M10 (USB Debug)",
                "description": "Lenovo Tab M10 series in ADB mode",
                "boot_modes": ["normal", "fastboot"],
                "tools": ["adb", "fastboot"],
                "container": "android-tools",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["adb", "fastboot"]
                }
            },
            "17ef:6011": {
                "vendor": "lenovo",
                "chipset": "qualcomm",
                "name": "Lenovo Tab P11 (USB Debug)",
                "description": "Lenovo Tab P11 series in ADB mode",
                "boot_modes": ["normal", "fastboot"],
                "tools": ["adb", "fastboot"],
                "container": "android-tools",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["adb", "fastboot"]
                }
            },
            "17ef:6012": {
                "vendor": "lenovo",
                "chipset": "qualcomm",
                "name": "Lenovo Tab P12 (USB Debug)",
                "description": "Lenovo Tab P12 series in ADB mode",
                "boot_modes": ["normal", "fastboot"],
                "tools": ["adb", "fastboot"],
                "container": "android-tools",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["adb", "fastboot"]
                }
            },
            "22d9:2765": {
                "vendor": "oppo",
                "chipset": "qualcomm",
                "name": "OPPO (Fastboot)",
                "description": "OPPO device in fastboot mode",
                "boot_modes": ["fastboot"],
                "tools": ["fastboot", "adb"],
                "container": "android-tools",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["fastboot"]
                }
            },
            "2a70:9093": {
                "vendor": "realme",
                "chipset": "qualcomm",
                "name": "Realme (Fastboot)",
                "description": "Realme device in fastboot mode",
                "boot_modes": ["fastboot"],
                "tools": ["fastboot", "adb"],
                "container": "android-tools",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["fastboot"]
                }
            },
            "2d95:5a01": {
                "vendor": "vivo",
                "chipset": "qualcomm",
                "name": "Vivo (Fastboot)",
                "description": "Vivo device in fastboot mode",
                "boot_modes": ["fastboot"],
                "tools": ["fastboot", "adb"],
                "container": "android-tools",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["fastboot"]
                }
            },
            "22b8:2e24": {
                "vendor": "motorola",
                "chipset": "qualcomm",
                "name": "Motorola (Fastboot)",
                "description": "Motorola device in fastboot mode",
                "boot_modes": ["fastboot"],
                "tools": ["fastboot", "adb"],
                "container": "android-tools",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["fastboot"]
                }
            },
            "12d1:0001": {
                "vendor": "huawei",
                "chipset": "kirin",
                "name": "Huawei/Honor (Fastboot)",
                "description": "Huawei or Honor device in fastboot mode",
                "boot_modes": ["fastboot"],
                "tools": ["fastboot", "adb", "hisuite"],
                "container": "android-tools",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["fastboot", "hisuite"]
                }
            },
            "25c7:0013": {
                "vendor": "tecno",
                "chipset": "mediatek",
                "name": "Tecno/Infinix/ITEL (Preloader)",
                "description": "Tecno, Infinix, or ITEL device in preloader mode",
                "boot_modes": ["preloader"],
                "tools": ["sp-flash-tool", "mtkclient"],
                "container": "mediatek-flash",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["mtk_preloader"]
                }
            },
            "19d2:0001": {
                "vendor": "zte",
                "chipset": "qualcomm",
                "name": "ZTE/Nubia (Fastboot)",
                "description": "ZTE or Nubia device in fastboot mode",
                "boot_modes": ["fastboot"],
                "tools": ["fastboot", "adb"],
                "container": "android-tools",
                "capabilities": {
                    "can_flash": True,
                    "can_read_info": True,
                    "supported_protocols": ["fastboot"]
                }
            }
        }
    
    def _build_vendor_map(self) -> Dict[str, str]:
        vendor_map = {}
        for key, value in self.database.items():
            vendor = value.get('vendor', 'unknown')
            vendor_map[vendor] = value.get('name', vendor)
        return vendor_map
    
    def lookup(self, vendor_id: str, product_id: str) -> Optional[Dict]:
        key = f"{vendor_id}:{product_id}"
        return self.database.get(key)
    
    def detect_boot_mode(self, vendor_id: str, product_id: str) -> BootMode:
        device_info = self.lookup(vendor_id, product_id)
        if device_info:
            boot_modes = device_info.get('boot_modes', ['normal'])
            mode_str = boot_modes[0] if boot_modes else 'normal'
            try:
                return BootMode(mode_str)
            except ValueError:
                return BootMode.UNKNOWN
        return BootMode.NORMAL
    
    def get_capabilities(self, vendor_id: str, product_id: str) -> DeviceCapabilities:
        device_info = self.lookup(vendor_id, product_id)
        if device_info:
            caps = device_info.get('capabilities', {})
            return DeviceCapabilities(
                can_flash=caps.get('can_flash', False),
                can_read_info=caps.get('can_read_info', False),
                can_backup=caps.get('can_backup', False),
                can_restore=caps.get('can_restore', False),
                can_unlock_bootloader=caps.get('can_unlock_bootloader', False),
                can_bypass_frp=caps.get('can_bypass_frp', False),
                can_isp=caps.get('can_isp', False),
                can_jtag=caps.get('can_jtag', False),
                supported_protocols=caps.get('supported_protocols', []),
            )
        return DeviceCapabilities()


class WorkspaceManager:
    """Manages device workspaces"""
    
    def __init__(self, base_path: str = "/workspace/devices"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def create_workspace(self, device: DetectedDevice) -> Path:
        workspace_name = f"{device.vendor_id}_{device.product_id}_{int(time.time())}"
        workspace_path = self.base_path / workspace_name
        workspace_path.mkdir(exist_ok=True)
        
        # Create directory structure
        dirs = ['firmware', 'backups', 'logs', 'partitions', 'tools', 'configs']
        for d in dirs:
            (workspace_path / d).mkdir(exist_ok=True)
        
        # Save device info
        with open(workspace_path / "device_info.json", 'w') as f:
            json.dump(device.to_dict(), f, indent=2)
        
        # Create symlink for easy access
        latest_link = self.base_path / "latest"
        if latest_link.exists() or latest_link.is_symlink():
            latest_link.unlink()
        latest_link.symlink_to(workspace_path)
        
        logger.info(f"Created workspace: {workspace_path}")
        return workspace_path
    
    def get_workspace(self, device_id: str) -> Optional[Path]:
        for workspace in self.base_path.iterdir():
            if workspace.is_dir() and device_id in workspace.name:
                return workspace
        return None
    
    def list_workspaces(self) -> List[Dict]:
        workspaces = []
        for workspace in self.base_path.iterdir():
            if workspace.is_dir():
                info_file = workspace / "device_info.json"
                if info_file.exists():
                    with open(info_file, 'r') as f:
                        info = json.load(f)
                    workspaces.append({
                        'path': str(workspace),
                        'device': info
                    })
        return workspaces


class DeviceDetector:
    """Enhanced device detection engine"""
    
    def __init__(self):
        self.context = pyudev.Context()
        self.monitor = pyudev.Monitor.from_netlink(self.context)
        self.monitor.filter_by(subsystem='usb')
        self.chipset_db = ChipsetDatabase()
        self.workspace_manager = WorkspaceManager()
        self.active_devices: Dict[str, DetectedDevice] = {}
        self.event_queue: queue.Queue = queue.Queue()
        self.callbacks: List[Callable[[DeviceEvent], None]] = []
        self._running = False
        self._lock = threading.Lock()
    
    def register_callback(self, callback: Callable[[DeviceEvent], None]):
        """Register a callback for device events"""
        self.callbacks.append(callback)
    
    def _emit_event(self, event: DeviceEvent):
        """ Emit an event to all callbacks"""
        for callback in self.callbacks:
            try:
                callback(event)
            except Exception as e:
                logger.error(f"Callback error: {e}")
        
        self.event_queue.put(event)
    
    def identify_device(self, device) -> DetectedDevice:
        """Identify a USB device"""
        vendor_id = device.get('ID_VENDOR_ID', '0000')
        product_id = device.get('ID_MODEL_ID', '0000')
        vendor_name = device.get('ID_VENDOR_FROM_DATABASE', 'Unknown')
        product_name = device.get('ID_MODEL_FROM_DATABASE', 'Unknown')
        serial = device.get('ID_SERIAL_SHORT')
        
        # Look up in chipset database
        db_entry = self.chipset_db.lookup(vendor_id, product_id)
        
        if db_entry:
            device_type = DeviceType(db_entry.get('vendor', 'generic'))
            boot_mode = self.chipset_db.detect_boot_mode(vendor_id, product_id)
            capabilities = self.chipset_db.get_capabilities(vendor_id, product_id)
            container = db_entry.get('container')
            tools = db_entry.get('tools', [])
            chipset = db_entry.get('chipset')
        else:
            device_type = self._guess_device_type(vendor_name, product_name)
            boot_mode = BootMode.NORMAL
            capabilities = DeviceCapabilities()
            container = self._get_default_container(device_type)
            tools = self._get_default_tools(device_type)
            chipset = None
        
        device_id = hashlib.md5(f"{vendor_id}:{product_id}:{serial or ''}".encode()).hexdigest()[:12]
        
        return DetectedDevice(
            id=device_id,
            vendor_id=vendor_id,
            product_id=product_id,
            vendor_name=vendor_name,
            product_name=product_name,
            device_type=device_type,
            boot_mode=boot_mode,
            status=DeviceStatus.CONNECTED,
            capabilities=capabilities,
            container=container,
            tools=tools,
            serial=serial,
            chipset=chipset,
        )
    
    def _guess_device_type(self, vendor_name: str, product_name: str) -> DeviceType:
        vendor_lower = vendor_name.lower()
        product_lower = product_name.lower()
        
        if 'qualcomm' in vendor_lower or 'qcom' in vendor_lower:
            return DeviceType.QUALCOMM
        elif 'mediatek' in vendor_lower or 'mtk' in vendor_lower:
            return DeviceType.MEDIATEK
        elif 'samsung' in vendor_lower:
            return DeviceType.SAMSUNG
        elif 'apple' in vendor_lower or 'iphone' in product_lower or 'ipad' in product_lower:
            return DeviceType.APPLE
        elif 'google' in vendor_lower or 'pixel' in product_lower:
            return DeviceType.ANDROID
        elif 'xiaomi' in vendor_lower or 'redmi' in vendor_lower or 'poco' in vendor_lower:
            return DeviceType.XIAOMI
        elif 'huawei' in vendor_lower or 'honor' in vendor_lower:
            return DeviceType.HUAWEI
        elif 'oppo' in vendor_lower or 'realme' in vendor_lower:
            return DeviceType.OPPO
        elif 'vivo' in vendor_lower or 'iqoo' in vendor_lower:
            return DeviceType.VIVO
        elif 'motorola' in vendor_lower or 'moto' in vendor_lower:
            return DeviceType.MOTOROLA
        elif 'lenovo' in vendor_lower or 'tab' in product_lower:
            return DeviceType.LENOVO
        elif 'tecno' in vendor_lower or 'infinix' in vendor_lower or 'itel' in vendor_lower:
            return DeviceType.TECNO
        elif 'zte' in vendor_lower or 'nubia' in vendor_lower:
            return DeviceType.ZTE
        elif 'sony' in vendor_lower or 'xperia' in product_lower:
            return DeviceType.SONY
        elif 'lg' in vendor_lower:
            return DeviceType.LG
        elif 'htc' in vendor_lower:
            return DeviceType.HTC
        elif 'oneplus' in vendor_lower:
            return DeviceType.ONEPLUS
        elif 'nokia' in vendor_lower:
            return DeviceType.NOKIA
        elif 'android' in product_lower:
            return DeviceType.ANDROID
        
        return DeviceType.GENERIC
    
    def _get_default_container(self, device_type: DeviceType) -> str:
        container_map = {
            DeviceType.QUALCOMM: 'qualcomm-edl',
            DeviceType.MEDIATEK: 'mediatek-flash',
            DeviceType.SAMSUNG: 'samsung-odin',
            DeviceType.APPLE: 'apple-tools',
            DeviceType.ANDROID: 'android-tools',
            DeviceType.XIAOMI: 'android-tools',
            DeviceType.HUAWEI: 'android-tools',
            DeviceType.OPPO: 'android-tools',
            DeviceType.VIVO: 'android-tools',
            DeviceType.MOTOROLA: 'android-tools',
            DeviceType.LENOVO: 'android-tools',
            DeviceType.TECNO: 'android-tools',
            DeviceType.ZTE: 'android-tools',
            DeviceType.SONY: 'android-tools',
            DeviceType.LG: 'android-tools',
            DeviceType.HTC: 'android-tools',
            DeviceType.ONEPLUS: 'android-tools',
            DeviceType.NOKIA: 'android-tools',
        }
        return container_map.get(device_type, 'android-tools')
    
    def _get_default_tools(self, device_type: DeviceType) -> List[str]:
        tools_map = {
            DeviceType.QUALCOMM: ['edl', 'firehose', 'sahara'],
            DeviceType.MEDIATEK: ['sp-flash', 'preloader'],
            DeviceType.SAMSUNG: ['heimdall', 'odin'],
            DeviceType.APPLE: ['idevicerestore', 'libimobiledevice'],
            DeviceType.ANDROID: ['adb', 'fastboot'],
            DeviceType.XIAOMI: ['adb', 'fastboot', 'miflash'],
            DeviceType.HUAWEI: ['adb', 'fastboot', 'hisuite'],
            DeviceType.OPPO: ['adb', 'fastboot'],
            DeviceType.VIVO: ['adb', 'fastboot'],
            DeviceType.MOTOROLA: ['adb', 'fastboot'],
            DeviceType.LENOVO: ['adb', 'fastboot'],
            DeviceType.TECNO: ['adb', 'fastboot'],
            DeviceType.ZTE: ['adb', 'fastboot'],
            DeviceType.SONY: ['adb', 'fastboot'],
            DeviceType.LG: ['adb', 'fastboot'],
            DeviceType.HTC: ['adb', 'fastboot'],
            DeviceType.ONEPLUS: ['adb', 'fastboot'],
            DeviceType.NOKIA: ['adb', 'fastboot'],
        }
        return tools_map.get(device_type, ['adb'])
    
    def load_kernel_modules(self, device: DetectedDevice):
        """Load appropriate kernel modules"""
        modules = ['usbserial']
        
        if device.vendor_id == '05c6':
            modules.append('qcserial')
        elif device.vendor_id == '0e8d':
            modules.append('cdc_acm')
        
        for module in modules:
            try:
                subprocess.run(['modprobe', module], check=True, capture_output=True)
                logger.info(f"Loaded module: {module}")
            except subprocess.CalledProcessError:
                logger.warning(f"Failed to load module: {module}")
    
    def launch_container(self, device: DetectedDevice, workspace_path: Path) -> bool:
        """Launch the appropriate container"""
        if not device.container:
            return False
        
        container_name = f"techbench-{device.container}-{device.id}"
        
        try:
            result = subprocess.run(
                ['podman', 'container', 'exists', container_name],
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                logger.info(f"Launching container: {device.container}")
                subprocess.Popen([
                    'podman', 'run', '-d',
                    '--name', container_name,
                    '--device', '/dev/bus/usb:/dev/bus/usb',
                    '--privileged',
                    '-v', f'{workspace_path}:/workspace',
                    '-v', '/var/log/techbench:/logs',
                    f'techbench/{device.container}'
                ])
            else:
                logger.info(f"Starting existing container: {container_name}")
                subprocess.run(['podman', 'start', container_name], check=True)
            
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to launch container: {e}")
            return False
    
    def on_device_connected(self, device):
        """Handle device connection"""
        device_info = self.identify_device(device)
        
        logger.info(f"Device connected: {device_info.vendor_name} {device_info.product_name}")
        
        # Load kernel modules
        self.load_kernel_modules(device_info)
        
        # Create workspace
        workspace_path = self.workspace_manager.create_workspace(device_info)
        device_info.workspace_path = workspace_path
        
        # Launch container
        self.launch_container(device_info, workspace_path)
        
        # Store active device
        with self._lock:
            self.active_devices[device_info.id] = device_info
        
        # Emit event
        event = DeviceEvent(
            event_type='connected',
            device_id=device_info.id,
            timestamp=datetime.now(),
            data=device_info.to_dict()
        )
        device_info.event_history.append(event)
        self._emit_event(event)
        
        # Save state
        self._save_state()
    
    def on_device_disconnected(self, device):
        """Handle device disconnection"""
        vendor_id = device.get('ID_VENDOR_ID', '0000')
        product_id = device.get('ID_MODEL_ID', '0000')
        
        with self._lock:
            for device_id, device_info in self.active_devices.items():
                if device_info.vendor_id == vendor_id and device_info.product_id == product_id:
                    device_info.status = DeviceStatus.DISCONNECTED
                    
                    event = DeviceEvent(
                        event_type='disconnected',
                        device_id=device_id,
                        timestamp=datetime.now()
                    )
                    device_info.event_history.append(event)
                    self._emit_event(event)
                    
                    # Stop container
                    container_name = f"techbench-{device_info.container}-{device_id}"
                    try:
                        subprocess.run(['podman', 'stop', container_name], capture_output=True)
                    except:
                        pass
                    
                    del self.active_devices[device_id]
                    break
        
        self._save_state()
    
    def _save_state(self):
        """Save current state to disk"""
        state_dir = Path('/var/lib/techbench')
        try:
            state_dir.mkdir(parents=True, exist_ok=True)
        except (PermissionError, OSError):
            state_dir = Path('/tmp/techbench')
            state_dir.mkdir(parents=True, exist_ok=True)
        
        state_file = state_dir / "detection_state.json"
        
        state = {
            'devices': {k: v.to_dict() for k, v in self.active_devices.items()},
            'last_updated': datetime.now().isoformat()
        }
        
        with open(state_file, 'w') as f:
            json.dump(state, f, indent=2)
    
    def _load_state(self):
        """Load state from disk"""
        state_dirs = [
            Path('/var/lib/techbench'),
            Path('/tmp/techbench'),
        ]
        
        for state_dir in state_dirs:
            state_file = state_dir / "detection_state.json"
            if state_file.exists():
                with open(state_file, 'r') as f:
                    state = json.load(f)
                logger.info(f"Loaded state with {len(state.get('devices', {}))} devices")
                return
    
    def scan_existing_devices(self):
        """Scan for already connected devices"""
        logger.info("Scanning for existing USB devices...")
        
        for device in self.context.list_devices(subsystem='usb'):
            if device.device_type == 'usb_device':
                self.on_device_connected(device)
    
    def get_device(self, device_id: str) -> Optional[DetectedDevice]:
        """Get device by ID"""
        with self._lock:
            return self.active_devices.get(device_id)
    
    def get_all_devices(self) -> List[DetectedDevice]:
        """Get all active devices"""
        with self._lock:
            return list(self.active_devices.values())
    
    def run(self):
        """Main event loop"""
        logger.info("TechBench Detection Engine started")
        
        self._load_state()
        self.scan_existing_devices()
        
        self._running = True
        
        for action, device in self.monitor:
            if not self._running:
                break
            
            if device.device_type == 'usb_device':
                if action == 'add':
                    self.on_device_connected(device)
                elif action == 'remove':
                    self.on_device_disconnected(device)
    
    def stop(self):
        """Stop the detection engine"""
        self._running = False
        self._save_state()


def main():
    """Main entry point"""
    detector = DeviceDetector()
    
    try:
        detector.run()
    except KeyboardInterrupt:
        logger.info("Detection engine stopped")
        detector.stop()
        sys.exit(0)
    except Exception as e:
        logger.error(f"Detection engine error: {e}")
        detector.stop()
        sys.exit(1)


if __name__ == '__main__':
    main()
