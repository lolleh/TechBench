#!/usr/bin/env python3
"""
TechBench - USB Device Detector
Monitors USB ports and auto-detects connected devices
"""

import os
import sys
import json
import time
import logging
import subprocess
from pathlib import Path
from typing import Dict, Optional, List
from dataclasses import dataclass
from datetime import datetime

try:
    import pyudev
except ImportError:
    print("pyudev not installed. Installing...")
    subprocess.run([sys.executable, "-m", "pip", "install", "pyudev"], check=True)
    import pyudev

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/techbench/device-detector.log'),
        logging.StreamHandler()
    ]
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
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


class ChipsetDatabase:
    """Database of known chipsets and their identifiers"""
    
    def __init__(self, db_path: str = "/opt/techbench/detection/chipset-id/database.json"):
        self.db_path = Path(db_path)
        self.database = self._load_database()
    
    def _load_database(self) -> Dict:
        """Load chipset database from file"""
        if self.db_path.exists():
            with open(self.db_path, 'r') as f:
                return json.load(f)
        else:
            logger.warning(f"Database not found at {self.db_path}, using defaults")
            return self._get_default_database()
    
    def _get_default_database(self) -> Dict:
        """Default chipset database"""
        return {
            "05c6:90db": {
                "vendor": "qualcomm",
                "chipset": "snapdragon",
                "name": "Qualcomm QDLoader 9008",
                "boot_modes": ["edl", "normal"],
                "tools": ["qfil", "firehose", "sahara"],
                "container": "qualcomm-edl"
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
                "name": "Samsung Download Mode",
                "boot_modes": ["odin", "normal"],
                "tools": ["heimdall", "odin"],
                "container": "samsung-odin"
            },
            "05ac:1227": {
                "vendor": "apple",
                "chipset": "a-series",
                "name": "Apple DFU Mode",
                "boot_modes": ["dfu", "recovery", "normal"],
                "tools": ["idevicerestore", "checkm8"],
                "container": "apple-tools"
            },
            "18d1:4ee7": {
                "vendor": "google",
                "chipset": "pixel",
                "name": "Google Pixel (Fastboot)",
                "boot_modes": ["fastboot", "normal"],
                "tools": ["fastboot", "adb"],
                "container": "android-tools"
            },
            "18d1:d002": {
                "vendor": "google",
                "chipset": "pixel",
                "name": "Google Pixel (ADB)",
                "boot_modes": ["normal"],
                "tools": ["adb"],
                "container": "android-tools"
            }
        }
    
    def lookup(self, vendor_id: str, product_id: str) -> Optional[Dict]:
        """Look up device by VID:PID"""
        key = f"{vendor_id}:{product_id}"
        return self.database.get(key)
    
    def detect_boot_mode(self, vendor_id: str, product_id: str) -> str:
        """Detect boot mode from VID:PID"""
        device_info = self.lookup(vendor_id, product_id)
        if device_info:
            boot_modes = device_info.get("boot_modes", ["normal"])
            return boot_modes[0] if boot_modes else "normal"
        return "normal"


class DeviceDetector:
    """Main device detection class"""
    
    def __init__(self):
        self.context = pyudev.Context()
        self.monitor = pyudev.Monitor.from_netlink(self.context)
        self.monitor.filter_by(subsystem='usb')
        self.chipset_db = ChipsetDatabase()
        self.active_devices: Dict[str, DeviceInfo] = {}
        self.workspaces_dir = Path("/workspace/devices")
        self.workspaces_dir.mkdir(parents=True, exist_ok=True)
    
    def identify_device(self, device) -> DeviceInfo:
        """Identify a USB device"""
        vendor_id = device.get('ID_VENDOR_ID', '0000')
        product_id = device.get('ID_MODEL_ID', '0000')
        vendor_name = device.get('ID_VENDOR_FROM_DATABASE', 'Unknown')
        product_name = device.get('ID_MODEL_FROM_DATABASE', 'Unknown')
        
        # Look up in chipset database
        db_entry = self.chipset_db.lookup(vendor_id, product_id)
        
        if db_entry:
            device_type = db_entry.get('vendor', 'unknown')
            boot_mode = self.chipset_db.detect_boot_mode(vendor_id, product_id)
            container = db_entry.get('container')
            tools = db_entry.get('tools', [])
        else:
            # Generic detection
            device_type = self._guess_device_type(vendor_name, product_name)
            boot_mode = 'normal'
            container = self._get_default_container(device_type)
            tools = self._get_default_tools(device_type)
        
        return DeviceInfo(
            vendor_id=vendor_id,
            product_id=product_id,
            vendor_name=vendor_name,
            product_name=product_name,
            device_type=device_type,
            boot_mode=boot_mode,
            container=container,
            tools=tools
        )
    
    def _guess_device_type(self, vendor_name: str, product_name: str) -> str:
        """Guess device type from names"""
        vendor_lower = vendor_name.lower()
        product_lower = product_name.lower()
        
        if 'qualcomm' in vendor_lower or 'qcom' in vendor_lower:
            return 'qualcomm'
        elif 'mediatek' in vendor_lower or 'mtk' in vendor_lower:
            return 'mediatek'
        elif 'samsung' in vendor_lower:
            return 'samsung'
        elif 'apple' in vendor_lower or 'iphone' in product_lower or 'ipad' in product_lower:
            return 'apple'
        elif 'google' in vendor_lower or 'pixel' in product_lower:
            return 'android'
        elif 'android' in product_lower:
            return 'android'
        
        return 'unknown'
    
    def _get_default_container(self, device_type: str) -> str:
        """Get default container for device type"""
        container_map = {
            'qualcomm': 'qualcomm-edl',
            'mediatek': 'mediatek-flash',
            'samsung': 'samsung-odin',
            'apple': 'apple-tools',
            'android': 'android-tools'
        }
        return container_map.get(device_type, 'android-tools')
    
    def _get_default_tools(self, device_type: str) -> List[str]:
        """Get default tools for device type"""
        tools_map = {
            'qualcomm': ['edl', 'firehose', 'sahara'],
            'mediatek': ['sp-flash', 'preloader'],
            'samsung': ['heimdall', 'odin'],
            'apple': ['idevicerestore', 'libimobiledevice'],
            'android': ['adb', 'fastboot']
        }
        return tools_map.get(device_type, ['adb'])
    
    def create_workspace(self, device_info: DeviceInfo) -> Path:
        """Create a workspace directory for the device"""
        workspace_name = f"{device_info.vendor_id}_{device_info.product_id}_{int(time.time())}"
        workspace_path = self.workspaces_dir / workspace_name
        workspace_path.mkdir(exist_ok=True)
        
        # Create workspace structure
        (workspace_path / "firmware").mkdir(exist_ok=True)
        (workspace_path / "backups").mkdir(exist_ok=True)
        (workspace_path / "logs").mkdir(exist_ok=True)
        (workspace_path / "partitions").mkdir(exist_ok=True)
        
        # Save device info
        with open(workspace_path / "device_info.json", 'w') as f:
            json.dump({
                'vendor_id': device_info.vendor_id,
                'product_id': device_info.product_id,
                'vendor_name': device_info.vendor_name,
                'product_name': device_info.product_name,
                'device_type': device_info.device_type,
                'boot_mode': device_info.boot_mode,
                'container': device_info.container,
                'tools': device_info.tools,
                'created_at': device_info.timestamp.isoformat()
            }, f, indent=2)
        
        logger.info(f"Created workspace: {workspace_path}")
        return workspace_path
    
    def launch_container(self, device_info: DeviceInfo, workspace_path: Path) -> bool:
        """Launch the appropriate container for the device"""
        if not device_info.container:
            logger.info("No container specified, skipping container launch")
            return False
        
        container_name = f"techbench-{device_info.container}-{device_info.vendor_id}"
        
        try:
            # Check if container exists
            result = subprocess.run(
                ['podman', 'container', 'exists', container_name],
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                # Container doesn't exist, run it
                logger.info(f"Launching container: {device_info.container}")
                subprocess.Popen([
                    'podman', 'run', '-d',
                    '--name', container_name,
                    '--device', '/dev/bus/usb:/dev/bus/usb',
                    '--privileged',
                    '-v', f'{workspace_path}:/workspace',
                    '-v', '/var/log/techbench:/logs',
                    f'techbench/{device_info.container}'
                ])
            else:
                # Container exists, start it
                logger.info(f"Starting existing container: {container_name}")
                subprocess.run(['podman', 'start', container_name], check=True)
            
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to launch container: {e}")
            return False
    
    def load_kernel_modules(self, device_info: DeviceInfo):
        """Load appropriate kernel modules for the device"""
        modules = ['usbserial']
        
        if device_info.vendor_id == '05c6':
            modules.append('qcserial')
        elif device_info.vendor_id == '0e8d':
            modules.append('mtk_download_agent')
        
        for module in modules:
            try:
                subprocess.run(['modprobe', module], check=True, capture_output=True)
                logger.info(f"Loaded module: {module}")
            except subprocess.CalledProcessError:
                logger.warning(f"Failed to load module: {module}")
    
    def on_device_connected(self, device):
        """Handle device connection event"""
        device_info = self.identify_device(device)
        
        logger.info(f"Device connected: {device_info.vendor_name} {device_info.product_name}")
        logger.info(f"  Type: {device_info.device_type}")
        logger.info(f"  Boot mode: {device_info.boot_mode}")
        logger.info(f"  Container: {device_info.container}")
        
        # Load kernel modules
        self.load_kernel_modules(device_info)
        
        # Create workspace
        workspace_path = self.create_workspace(device_info)
        
        # Launch container
        self.launch_container(device_info, workspace_path)
        
        # Store active device
        device_key = f"{device_info.vendor_id}:{device_info.product_id}"
        self.active_devices[device_key] = device_info
        
        # Notify GUI (via socket or file)
        self._notify_gui('connected', device_info)
    
    def on_device_disconnected(self, device):
        """Handle device disconnection event"""
        vendor_id = device.get('ID_VENDOR_ID', '0000')
        product_id = device.get('ID_MODEL_ID', '0000')
        device_key = f"{vendor_id}:{product_id}"
        
        if device_key in self.active_devices:
            device_info = self.active_devices.pop(device_key)
            logger.info(f"Device disconnected: {device_info.vendor_name} {device_info.product_name}")
            
            # Stop container
            container_name = f"techbench-{device_info.container}-{vendor_id}"
            try:
                subprocess.run(['podman', 'stop', container_name], capture_output=True)
            except:
                pass
            
            # Notify GUI
            self._notify_gui('disconnected', device_info)
    
    def _notify_gui(self, event: str, device_info: DeviceInfo):
        """Notify GUI of device event"""
        notification = {
            'event': event,
            'device': {
                'vendor_id': device_info.vendor_id,
                'product_id': device_info.product_id,
                'vendor_name': device_info.vendor_name,
                'product_name': device_info.product_name,
                'device_type': device_info.device_type,
                'boot_mode': device_info.boot_mode,
                'tools': device_info.tools
            },
            'timestamp': device_info.timestamp.isoformat()
        }
        
        # Write to notification file
        notification_file = Path("/tmp/techbench/device_event.json")
        notification_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(notification_file, 'w') as f:
            json.dump(notification, f, indent=2)
        
        # Also log to file
        log_file = Path("/var/log/techbench/device_events.log")
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(log_file, 'a') as f:
            f.write(f"{json.dumps(notification)}\n")
    
    def scan_existing_devices(self):
        """Scan for already connected devices"""
        logger.info("Scanning for existing USB devices...")
        
        for device in self.context.list_devices(subsystem='usb'):
            if device.device_type == 'usb_device':
                self.on_device_connected(device)
    
    def run(self):
        """Main event loop"""
        logger.info("TechBench Device Detector started")
        logger.info(f"Monitoring USB devices...")
        
        # Scan existing devices first
        self.scan_existing_devices()
        
        # Monitor for new devices
        for action, device in self.monitor:
            if device.device_type == 'usb_device':
                if action == 'add':
                    self.on_device_connected(device)
                elif action == 'remove':
                    self.on_device_disconnected(device)


def main():
    """Main entry point"""
    detector = DeviceDetector()
    
    try:
        detector.run()
    except KeyboardInterrupt:
        logger.info("Device detector stopped")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Device detector error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
