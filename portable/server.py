#!/usr/bin/env python3
"""
TechBench Portable Server
Serves the web GUI and provides backend API for Windows.
Run this on any machine with Python 3.10+.
"""

import os
import re
import sys
import json
import time
import platform
import subprocess
import tempfile
import webbrowser
import shutil
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Timer

PORT = 1420
APP_DIR = Path(__file__).parent
FRONTEND_DIR = APP_DIR / "gui"
AI_DIR = APP_DIR / "python" / "ai"
# Writable data location. Desktop apps may point this at a user-writable dir
# (bundled resources are read-only). Falls back to <APP_DIR>/data.
DATA_DIR = Path(os.environ.get("TECHBENCH_DATA_DIR") or (APP_DIR / "data"))
DB_DIR = DATA_DIR / "databases"

def find_tool(name):
    """Find adb or fastboot in PATH or common locations"""
    path = shutil.which(name)
    if path:
        return path
    
    candidates = [
        APP_DIR / "platform-tools" / name,
        APP_DIR / "msys-tools" / name,
        Path("/tmp/platform-tools") / name,
        Path.home() / "platform-tools" / name,
    ]
    
    if platform.system() == "Windows":
        candidates = [Path(str(c) + ".exe") for c in candidates] + candidates
    
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    
    return name

def _find_pymobiledevice3():
    """Locate the pymobiledevice3 CLI (venv at ~/pyvenv or PATH)."""
    p = shutil.which("pymobiledevice3")
    if p:
        return p
    cand = Path.home() / "pyvenv" / "bin" / "pymobiledevice3"
    return str(cand) if cand.exists() else None


PYMOBILEDEVICE3 = _find_pymobiledevice3()

def _strip_ansi(s):
    """Remove ANSI color/control escape sequences from tool output"""
    if not s:
        return s
    return re.sub(r"\x1b\[[0-9;]*m", "", s)


def _apple_info_fields(udid):
    """Run ideviceinfo and return (dict, None) or (None, error)."""
    tool = find_tool("ideviceinfo")
    if tool == "ideviceinfo":
        return None, "Tool 'ideviceinfo' not found. Install libimobiledevice-utils."
    try:
        r = subprocess.run(
            [tool, "-u", udid], capture_output=True, text=True, timeout=30,
            creationflags=0x08000000 if platform.system() == "Windows" else 0,
            encoding="utf-8", errors="replace",
        )
    except Exception as e:
        return None, f"Failed to start ideviceinfo: {e}"
    if r.returncode != 0:
        out = ((r.stdout or "") + (r.stderr or "")).strip()
        return None, out or f"ideviceinfo failed (exit {r.returncode})"
    info = {}
    for line in ((r.stdout or "") + (r.stderr or "")).splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            info[k.strip()] = v.strip()
    return info, None


_PRODUCT_CHIP = {
    "iPhone5,1": "A6", "iPhone5,2": "A6", "iPhone5,3": "A6", "iPhone5,4": "A6",
    "iPhone6,1": "A7", "iPhone6,2": "A7",
    "iPhone7,1": "A8", "iPhone7,2": "A8",
    "iPhone8,1": "A9", "iPhone8,2": "A9", "iPhone8,4": "A9",
    "iPhone9,1": "A10", "iPhone9,2": "A10", "iPhone9,3": "A10", "iPhone9,4": "A10",
    "iPhone10,1": "A11", "iPhone10,2": "A11", "iPhone10,3": "A11",
    "iPhone10,4": "A11", "iPhone10,5": "A11", "iPhone10,6": "A11",
    "iPhone11,2": "A12", "iPhone11,4": "A12", "iPhone11,6": "A12", "iPhone11,8": "A12",
    "iPhone12,1": "A13", "iPhone12,3": "A13", "iPhone12,5": "A13", "iPhone12,8": "A13",
    "iPhone13,1": "A14", "iPhone13,2": "A14", "iPhone13,3": "A14", "iPhone13,4": "A14",
    "iPhone14,2": "A15", "iPhone14,3": "A15", "iPhone14,4": "A15", "iPhone14,5": "A15",
    "iPhone14,7": "A15", "iPhone14,8": "A15",
    "iPhone15,2": "A16", "iPhone15,3": "A16", "iPhone15,4": "A16", "iPhone15,5": "A16",
    "iPhone16,1": "A17 Pro", "iPhone16,2": "A17 Pro",
    "iPhone17,1": "A18 Pro", "iPhone17,2": "A18 Pro",
    "iPhone17,3": "A18", "iPhone17,4": "A18",
}

_PRODUCT_NAMES = {
    "iPhone6,1": "iPhone 5s", "iPhone6,2": "iPhone 5s",
    "iPhone7,1": "iPhone 6 Plus", "iPhone7,2": "iPhone 6",
    "iPhone8,1": "iPhone 6s", "iPhone8,2": "iPhone 6s Plus", "iPhone8,4": "iPhone SE (1st gen)",
    "iPhone9,1": "iPhone 7", "iPhone9,2": "iPhone 7 Plus",
    "iPhone9,3": "iPhone 7", "iPhone9,4": "iPhone 7 Plus",
    "iPhone10,1": "iPhone 8", "iPhone10,4": "iPhone 8",
    "iPhone10,2": "iPhone 8 Plus", "iPhone10,5": "iPhone 8 Plus",
    "iPhone10,3": "iPhone X", "iPhone10,6": "iPhone X",
    "iPhone11,8": "iPhone XR", "iPhone11,2": "iPhone XS",
    "iPhone11,4": "iPhone XS Max", "iPhone11,6": "iPhone XS Max",
    "iPhone12,8": "iPhone SE (2nd gen)",
    "iPhone12,1": "iPhone 11", "iPhone12,3": "iPhone 11 Pro", "iPhone12,5": "iPhone 11 Pro Max",
    "iPhone13,1": "iPhone 12 mini", "iPhone13,2": "iPhone 12",
    "iPhone13,3": "iPhone 12 Pro", "iPhone13,4": "iPhone 12 Pro Max",
    "iPhone14,4": "iPhone 13 mini", "iPhone14,5": "iPhone 13",
    "iPhone14,2": "iPhone 13 Pro", "iPhone14,3": "iPhone 13 Pro Max",
    "iPhone14,7": "iPhone 14", "iPhone14,8": "iPhone 14 Plus",
    "iPhone15,2": "iPhone 14 Pro", "iPhone15,3": "iPhone 14 Pro Max",
    "iPhone15,4": "iPhone 15", "iPhone15,5": "iPhone 15 Plus",
    "iPhone16,1": "iPhone 15 Pro", "iPhone16,2": "iPhone 15 Pro Max",
    "iPhone17,1": "iPhone 16 Pro", "iPhone17,2": "iPhone 16 Pro Max",
    "iPhone17,3": "iPhone 16", "iPhone17,4": "iPhone 16 Plus",
}

def _product_marketing_name(product):
    """Return a friendly marketing name for an Apple product identifier."""
    if not product:
        return ""
    if product in _PRODUCT_NAMES:
        return _PRODUCT_NAMES[product]
    m = re.match(r"^(iPad\d+|iPod\d+|AppleTV\d+|Watch\d+|AudioAccessory\d+)", product)
    return product


def _assess_jailbreak(product, ios):
    """Honest compatibility assessment against known jailbreak tools."""
    major = None
    try:
        major = int(str(ios).split(".")[0])
    except Exception:
        pass
    chip = _PRODUCT_CHIP.get(product)
    chip_kind = "unknown"
    if chip:
        m = re.match(r"A(\d+)", chip)
        chip_kind = f"A{int(m.group(1))}" if m else chip
    checkm8 = chip_kind in ("A7", "A8", "A9", "A10", "A11")

    tools = []

    def add(name, desc, ok, note):
        tools.append({"name": name, "description": desc, "supported": bool(ok), "note": note})

    if major is None:
        add("Any", "-", False, "Could not read the iOS version from the device.")
    add("palera1n", "checkm8 DFU-based rootless jailbreak (A8-A11)", checkm8 and major is not None and major <= 17,
        "Boots a patched kernel from DFU over USB. Applies only to A8-A11 devices.")
    add("checkra1n", "Semi-tethered checkm8 jailbreak (A7-A11)", checkm8 and major is not None and 12 <= major <= 16,
        "Classic checkm8 jailbreak, iOS 12-16.")
    add("Dopamine", "Rootless jailbreak (iOS 15-16.6.1)", major is not None and 15 <= major <= 16,
        "Modern rootless jailbreak; A12+ only up to 16.5.1.")
    add("TrollStore", "Permanent app signing (iOS 14-16)", major is not None and 14 <= major <= 16,
        "Installs permanent app signatures; not a full jailbreak.")
    add("XinaA15", "Jailbreak for A12-A15 (iOS 15.x)", major == 15 and chip_kind in ("A12", "A13", "A14", "A15"),
        "iOS 15.0-15.4.1 on A12-A15.")
    add("unc0ver", "Legacy jailbreak (iOS 11-14)", major is not None and 11 <= major <= 14,
        "Supports iOS 11-14 on A7-A13 devices.")

    supported_any = any(t["supported"] for t in tools)
    if major is not None and major >= 18:
        status = "unsupported"
        verdict = (f"No public jailbreak currently exists for iOS {ios} on this device "
                   f"({chip or 'unknown chip'}). Modern jailbreak development is paused; "
                   "check project releases for updates.")
    elif supported_any:
        status = "supported"
        verdict = f"One or more listed tools may support this device on iOS {ios}."
    else:
        status = "unsupported"
        verdict = (f"No listed jailbreak tool supports this device (chip {chip_kind}) on "
                   f"iOS {ios}.")

    return {
        "chip": chip or "unknown",
        "checkm8": checkm8,
        "iosVersion": str(ios),
        "tools": tools,
        "status": status,
        "verdict": verdict,
    }


_ACTIVATION_LOCK_URL = "https://icloud.apple.com/activationlock/query"


def _run_tool(argv, timeout=60):
    """Run a subprocess and return (proc, None) or (None, errstr)."""
    try:
        return subprocess.run(
            argv, capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=timeout,
            creationflags=0x08000000 if platform.system() == "Windows" else 0,
        ), None
    except subprocess.TimeoutExpired:
        return None, "Timed out"
    except Exception as e:
        return None, str(e)


_MDM_PROFILE_HINTS = (
    "mdm", "managed", "management", "remotemanagement",
    "airwatch", "vmware", "intune", "microsoft", "mobileiron",
    "meraki", "mosyle", "jamf", "kandji", "zuludesk", "workspaceone",
    "hexnode", "fleet", "headwind", "scalefusion", "miradore", "soti",
    "manageengine", "addigy", "csw", "m23",
)

_MDM_PKG_HINTS = (
    "airwatch", "awagent", "vmware", "intune", "microsoft", "mobileiron",
    "meraki", "mosyle", "jamf", "kandji", "zuludesk", "workspaceone", "hexnode",
    "mdm", "fleetdm", "headwind", "scalefusion", "miradore", "soti",
    "manageengine", "addigy", "androidforwork", "google.android.apps.work",
)


def _is_mdm_identifier(identifier, hints):
    """Case-insensitive MDM hint match against an identifier (profile id or package)."""
    low = (identifier or "").lower()
    return any(h in low for h in hints)


_VIRTUAL_LOCATION = {"pid": None, "lat": None, "lng": None}


def _virtual_location_alive():
    pid = _VIRTUAL_LOCATION.get("pid")
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        _VIRTUAL_LOCATION["pid"] = None
        return False


def _virtual_location_stop():
    pid = _VIRTUAL_LOCATION.get("pid")
    if pid:
        try:
            os.kill(pid, 9)
        except OSError:
            pass
        _VIRTUAL_LOCATION["pid"] = None
        _VIRTUAL_LOCATION["lat"] = None
        _VIRTUAL_LOCATION["lng"] = None


_IOS_INSTALLER_STYLE = {}

def _ios_installer_style():
    """Return 'subcommand' for ideviceinstaller 1.2.0+ or 'legacy' for 1.1.x.

    1.2.0+ uses subcommands (list/install/uninstall/upgrade); 1.1.x used
    short flags (-l, -U, -i, -g). Detected once and cached.
    """
    cached = _IOS_INSTALLER_STYLE.get("style")
    if cached:
        return cached
    style = "legacy"
    installer = find_tool("ideviceinstaller")
    if installer != "ideviceinstaller":
        try:
            r = subprocess.run(
                [installer, "--version"], capture_output=True, text=True, timeout=5
            )
            m = re.search(r"ideviceinstaller\s+(\d+)\.(\d+)", r.stdout)
            if m and (int(m.group(1)), int(m.group(2))) >= (1, 2):
                style = "subcommand"
        except Exception:
            pass
    _IOS_INSTALLER_STYLE["style"] = style
    return style


# Tool registry: (binary name, display name, description, action key, runnable)
_TOOL_DEFS = {
    "apple": [
        ("ideviceinfo", "Device Info", "Full device properties", "info", True),
        ("ideviceinstaller", "App Manager", "List installed apps", "apps", True),
        ("idevicebackup2", "Backup", "Create device backup in workspace", "backup", True),
        ("idevicediagnostics", "Diagnostics", "IORegistry snapshot", "ioreg", True),
        ("idevicescreenshot", "Screenshot", "Capture screen to workspace", "screenshot", True),
        ("ideviceenterrecovery", "Enter Recovery", "Reboot into recovery mode", "recovery", True),
        ("idevicename", "Device Name", "Read device name", "name", True),
        ("idevicedate", "Device Date", "Read device date/time", "date", True),
        ("idevice_id", "List UDIDs", "List connected device UDIDs", "udids", True),
        ("idevicecrashreport", "Crash Reports", "Collect crash logs", "crash", True),
        ("ideviceimagemounter", "Image Mounter", "Mount developer disk images", "imagemounter", True),
        ("idevicesyslog", "Syslog", "Tail device syslog", "syslog", False),
    ],
    "android": [
        ("adb", "ADB", "Android Debug Bridge", "adb_devices", True),
        ("fastboot", "Fastboot", "Bootloader interface", "fastboot_devices", True),
        ("heimdall", "Heimdall", "Samsung firmware flashing", "heimdall", True),
        ("mtkclient", "MTK Client", "MediaTek preloader tooling", "mtkclient", True),
        ("edl", "EDL", "Qualcomm EDL tool", "edl", True),
    ],
    "common": [
        ("lsusb", "List USB", "Enumerate USB buses", "lsusb", True),
        ("udevadm", "UDev Admin", "Query udev device database", "udevadm", True),
    ],
}

_TOOL_ACTIONS = {
    "info": lambda t, u, s: [t, "-u", u],
    "apps": lambda t, u, s: [t, "-u", u, "list", "--all"] if _ios_installer_style() == "subcommand" else [t, "-u", u, "-l", "-o", "list_all", "-o", "xml"],
    "backup": lambda t, u, s: [t, "-u", u, "backup", "--full", "unencrypted", str(s)],
    "ioreg": lambda t, u, s: [t, "-u", u, "ioreg"],
    "screenshot": lambda t, u, s: [t, "-u", u, str(s)],
    "recovery": lambda t, u, s: [t, "-u", u],
    "name": lambda t, u, s: [t, "-u", u],
    "date": lambda t, u, s: [t, "-u", u],
    "udids": lambda t, u, s: [t, "-l"],
    "crash": lambda t, u, s: [t, "-u", u, "-e", str(s)],
    "imagemounter": lambda t, u, s: [t, "-u", u],
    "adb_devices": lambda t, u, s: [t, "devices", "-l"],
    "fastboot_devices": lambda t, u, s: [t, "devices"],
    "heimdall": lambda t, u, s: [t, "detect"],
    "mtkclient": lambda t, u, s: [t, "print-info"],
    "edl": lambda t, u, s: [t, "reset"],
    "lsusb": lambda t, u, s: [t],
    "udevadm": lambda t, u, s: [t, "info", "-a", "-n", s] if s and s.startswith("/dev/") else [t, "info", "--export"],
}


def _scan_tools():
    """Return list of known tools with availability and resolved path."""
    tools = []
    for category, defs in _TOOL_DEFS.items():
        for name, display, desc, action, runnable in defs:
            path = find_tool(name)
            tools.append({
                "name": name,
                "display": display,
                "description": desc,
                "category": category,
                "action": action,
                "runnable": runnable,
                "available": path != name,
                "path": path if path != name else None,
            })
    return tools


def _tool_output_dir():
    """Directory where file-producing tools write output."""
    d = DATA_DIR / "tools"
    d.mkdir(parents=True, exist_ok=True)
    return d

# Ensure directories exist
DB_DIR.mkdir(parents=True, exist_ok=True)
(DATA_DIR / "projects").mkdir(parents=True, exist_ok=True)
(DATA_DIR / "firmware").mkdir(parents=True, exist_ok=True)
(DATA_DIR / "workspaces").mkdir(parents=True, exist_ok=True)
(DATA_DIR / "logs").mkdir(parents=True, exist_ok=True)


def _start_parent_watchdog():
    """Exit the server automatically if the process that spawned it is gone.

    Used by the desktop app: the server is a child of the app, so this watchdog
    guarantees the backend stops when the app closes or crashes.
    """
    raw = os.environ.get("TECHBENCH_PARENT_PID")
    if not raw:
        return
    try:
        ppid = int(raw)
    except (TypeError, ValueError):
        return

    def _parent_alive():
        if platform.system() == "Windows":
            try:
                os.kill(ppid, 0)
                return True
            except ProcessLookupError:
                return False
            except PermissionError:
                return True
        return Path(f"/proc/{ppid}").exists()

    def _watch():
        while True:
            time.sleep(2)
            if not _parent_alive():
                try:
                    os._exit(0)
                except Exception:
                    pass

    threading.Thread(target=_watch, daemon=True).start()


_start_parent_watchdog()


class TechBenchHandler(SimpleHTTPRequestHandler):
    """Custom HTTP handler with API endpoints"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def do_GET(self):
        # API: System info
        if self.path == "/api/system":
            self._send_json({
                "platform": platform.system(),
                "python": platform.python_version(),
                "hostname": platform.node(),
                "version": "0.1.0",
            })
        # API: List serial ports
        elif self.path == "/api/ports":
            self._send_json(self._list_serial_ports())
        # API: List USB devices
        elif self.path == "/api/usb":
            self._send_json(self._list_usb_devices())
        # API: List ADB/Fastboot/Apple devices (served from background poller cache)
        elif self.path == "/api/devices":
            devices = _poller.get_devices() if _poller else self._list_adb_devices()
            self._send_json(devices)
        # API: List installed iOS apps
        elif self.path == "/api/ios/apps":
            self._send_json(self._list_ios_apps())
        # API: List available tools
        elif self.path == "/api/tools":
            self._send_json(_scan_tools())
        # API: Mirror screenshot (GET - streams PNG)
        elif self.path.startswith("/api/mirror/screenshot"):
            self._handle_mirror_screenshot()
        # API: Jailbreak compatibility check
        elif self.path.startswith("/api/jailbreak/info"):
            self._handle_jailbreak_info()
        # API: iCloud Activation Lock status check
        elif self.path.startswith("/api/icloud/activation"):
            self._handle_icloud_activation()
        # API: iCloud-related device info
        elif self.path.startswith("/api/icloud/info"):
            self._handle_icloud_info()
        # API: Database status
        elif self.path == "/api/database":
            db_file = DB_DIR / "techbench.db"
            self._send_json({
                "exists": db_file.exists(),
                "path": str(db_file),
                "size": db_file.stat().st_size if db_file.exists() else 0,
            })
        # Default: serve static files
        else:
            super().do_GET()

    def do_POST(self):
        # API: iOS app management
        if self.path.startswith("/api/ios/apps/uninstall"):
            self._handle_ios_uninstall()
        elif self.path.startswith("/api/ios/apps/install"):
            self._handle_ios_install(upgrade=False)
        elif self.path.startswith("/api/ios/apps/upgrade"):
            self._handle_ios_install(upgrade=True)
        elif self.path.startswith("/api/command"):
            self._handle_run_command()
        elif self.path.startswith("/api/backup/media"):
            self._handle_media_backup()
        elif self.path.startswith("/api/backup/ios-media"):
            self._handle_ios_media_backup()
        elif self.path.startswith("/api/recover/android-deleted"):
            self._handle_android_deleted_recovery()
        elif self.path.startswith("/api/recover/ios-deleted"):
            self._handle_ios_deleted_recovery()
        elif self.path.startswith("/api/network-unlock"):
            self._handle_network_unlock()
        elif self.path.startswith("/api/partitions"):
            self._handle_partitions()
        elif self.path.startswith("/api/device-health"):
            self._handle_device_health()
        elif self.path.startswith("/api/remove-lock"):
            self._handle_remove_lock()
        elif self.path.startswith("/api/mirror/input"):
            self._handle_mirror_input()
        elif self.path.startswith("/api/tools/run"):
            self._handle_tool_run()
        elif self.path.startswith("/api/apple/stop-update"):
            self._handle_stop_update()
        elif self.path.startswith("/api/apple/virtual-location"):
            self._handle_virtual_location()
        elif self.path.startswith("/api/mdm"):
            self._handle_mdm()
        elif self.path.startswith("/api/update"):
            self._handle_update()
        else:
            self.send_error(404)

    def _send_json(self, data):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_png(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", len(data))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _list_serial_ports(self):
        """List available serial ports"""
        ports = []
        try:
            if platform.system() == "Windows":
                import winreg
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                    r"HARDWARE\DEVICEMAP\SERIALCOMM")
                i = 0
                while True:
                    try:
                        name, value, _ = winreg.EnumValue(key, i)
                        ports.append({"port": value, "name": name})
                        i += 1
                    except OSError:
                        break
                winreg.CloseKey(key)
            else:
                import glob
                for p in glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*"):
                    ports.append({"port": p, "name": p})
        except Exception:
            pass
        return ports

    def _list_usb_devices(self):
        """List connected USB devices"""
        devices = []
        try:
            if platform.system() == "Windows":
                result = subprocess.run(
                    ["powershell", "-NoProfile", "-Command",
                     "Get-CimInstance Win32_PnPEntity | "
                     "Where-Object { $_.DeviceID -like 'USB\\*' } | "
                     "Select-Object Name, Manufacturer, DeviceID | "
                     "ConvertTo-Json -Compress"],
                    capture_output=True, text=True, timeout=10,
                    creationflags=0x08000000,  # CREATE_NO_WINDOW
                )
                if result.returncode == 0 and result.stdout.strip():
                    data = json.loads(result.stdout)
                    if isinstance(data, dict):
                        data = [data]
                    for dev in data:
                        pnp_id = dev.get("DeviceID", "")
                        if pnp_id.upper().startswith("USB\\"):
                            devices.append({
                                "name": dev.get("Name", "Unknown"),
                                "manufacturer": dev.get("Manufacturer", ""),
                                "id": pnp_id,
                            })
            else:
                result = subprocess.run(
                    ["lsusb"], capture_output=True, text=True, timeout=5
                )
                for line in result.stdout.strip().split("\n"):
                    if line:
                        devices.append({"name": line, "id": ""})
        except Exception:
            pass
        return devices

    def _list_adb_devices(self):
        """List ADB and Fastboot devices with details"""
        devices = []
        adb = find_tool("adb")
        fastboot = find_tool("fastboot")
        
        # Check for ADB
        try:
            result = subprocess.run(
                [adb, "devices", "-l"],
                capture_output=True, text=True, timeout=5,
                creationflags=0x08000000 if platform.system() == "Windows" else 0
            )
            if result.returncode == 0:
                for line in result.stdout.strip().split("\n")[1:]:  # Skip header
                    if line and "\t" in line:
                        parts = line.split()
                        serial = parts[0]
                        state = parts[1]
                        
                        # Get device properties
                        props = self._get_adb_props(serial)
                        
                        devices.append({
                            "id": serial,
                            "serial": serial,
                            "state": state,
                            "mode": "adb",
                            "productName": props.get("model", "Unknown"),
                            "vendorName": props.get("brand", "Unknown"),
                            "deviceType": "android",
                            "androidVersion": props.get("android_version", ""),
                            "chipset": props.get("hardware", ""),
                            "bootMode": "normal",
                        })
        except FileNotFoundError:
            pass  # ADB not installed
        except Exception:
            pass
        
        # Check for Fastboot
        try:
            result = subprocess.run(
                [fastboot, "devices"],
                capture_output=True, text=True, timeout=5,
                creationflags=0x08000000 if platform.system() == "Windows" else 0
            )
            if result.returncode == 0:
                for line in result.stdout.strip().split("\n"):
                    if line and "\t" in line:
                        serial = line.split()[0]
                        
                        # Get fastboot device info
                        props = self._get_fastboot_props(serial)
                        
                        devices.append({
                            "id": f"fastboot-{serial}",
                            "serial": serial,
                            "state": "fastboot",
                            "mode": "fastboot",
                            "productName": props.get("product", "Unknown"),
                            "vendorName": props.get("manufacturer", "Unknown"),
                            "deviceType": "android",
                            "chipset": props.get("hardware", ""),
                            "bootMode": "fastboot",
                        })
        except FileNotFoundError:
            pass  # Fastboot not installed
        except Exception:
            pass
        
        # Check for Apple devices (iPhone, iPad)
        devices.extend(self._list_apple_devices())
        
        return devices

    def _list_apple_devices(self):
        """Detect Apple (iPhone/iPad) devices via USB and libimobiledevice"""
        devices = []
        usb_devices = self._list_usb_devices()

        apple_usb = [
            usb for usb in usb_devices
            if "apple" in (usb.get("manufacturer", "") or "").lower()
            or "VID_05AC" in (usb.get("id", "") or "").upper()
        ]
        if not apple_usb:
            return devices

        # Prefer the entry with the most descriptive name (e.g. "Apple iPhone"),
        # fall back to a composite/MI entry.
        usb = None
        for candidate in apple_usb:
            name = candidate.get("name", "")
            if "iphone" in name.lower() or "ipad" in name.lower():
                usb = candidate
                break
        if usb is None:
            usb = apple_usb[0]

        dev_id = usb.get("id", "")
        name = usb.get("name", "")

        # Extract serial/UDID from the composite DeviceID (e.g.
        # USB\VID_05AC&PID_12A8\00008140001814243640801C)
        serial = None
        for cand in apple_usb:
            cid = cand.get("id", "")
            if "MI_" not in cid and "ROOT_HUB" not in cid:
                parts = cid.split("\\")
                if len(parts) >= 3 and parts[2]:
                    serial = parts[2]
                    break

        product_id = "0000"
        if "PID_" in dev_id.upper():
            product_id = dev_id.split("PID_")[1][:4].upper()

        # Apple PID -> boot mode
        if product_id == "1227":
            boot_mode = "dfu"
        elif product_id in ("1281", "1282", "12A9", "12AA", "12AB", "12AC"):
            boot_mode = "recovery"
        else:
            boot_mode = "normal"

        product_name = "Apple iPhone"
        if boot_mode == "dfu":
            product_name = "Apple iPhone (DFU Mode)"
        elif boot_mode == "recovery":
            product_name = "Apple iPhone (Recovery Mode)"
        elif "ipad" in name.lower():
            product_name = "Apple iPad"

        # Try libimobiledevice for UDID and model
        udid = None
        model = None
        idevice_id = find_tool("idevice_id")
        try:
            result = subprocess.run(
                [idevice_id, "-l"], capture_output=True, text=True, timeout=5,
                creationflags=0x08000000 if platform.system() == "Windows" else 0
            )
            if result.returncode == 0:
                udid = result.stdout.strip()
        except Exception:
            pass

        if udid:
            ideviceinfo = find_tool("ideviceinfo")
            try:
                result = subprocess.run(
                    [ideviceinfo, "-u", udid, "-k", "ProductType"],
                    capture_output=True, text=True, timeout=5,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0
                )
                if result.returncode == 0 and result.stdout.strip():
                    model = result.stdout.strip()
            except Exception:
                pass

        # Map internal product identifiers to friendly names
        display_name = _APPLE_MODEL_NAMES.get(model or "", model or product_name)

        devices.append({
            "id": udid or serial or dev_id,
            "serial": udid or serial or None,
            "state": "connected",
            "mode": "apple",
            "vendorId": "05AC",
            "productId": product_id,
            "vendorName": "Apple",
            "productName": display_name,
            "deviceType": "apple",
            "androidVersion": "",
            "chipset": model or "Apple",
            "bootMode": boot_mode,
        })

        return devices

    def _get_apple_udid(self):
        """Return the first connected iOS device UDID, or None.
        Tries idevice_id first; falls back to the poller cache (works when locked)."""
        idevice_id = find_tool("idevice_id")
        try:
            result = subprocess.run(
                [idevice_id, "-l"], capture_output=True, text=True, timeout=5,
                encoding="utf-8", errors="replace",
                creationflags=0x08000000 if platform.system() == "Windows" else 0
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip().split("\n")[0]
        except Exception:
            pass
        # Fallback: use cached UDID from background poller
        if _poller:
            for dev in _poller.get_devices():
                if dev.get("deviceType") == "apple":
                    return dev.get("serial")
        return None

    def _ios_installer_tool(self):
        """Return path to ideviceinstaller, or None if unavailable"""
        installer = find_tool("ideviceinstaller")
        return installer if installer != "ideviceinstaller" else None

    def _list_ios_apps(self):
        """List installed iOS apps via ideviceinstaller (XML plist output)"""
        import xml.etree.ElementTree as ET

        installer = self._ios_installer_tool()
        if installer is None:
            return {
                "available": False,
                "apps": [],
                "error": "ideviceinstaller not found in platform-tools or msys-tools",
            }

        udid = self._get_apple_udid()
        if not udid:
            return {
                "available": True,
                "apps": [],
                "error": "No iOS device connected or device not trusted",
            }

        try:
            if _ios_installer_style() == "subcommand":
                cmd = [installer, "-u", udid, "list", "--all", "--xml"]
            else:
                cmd = [installer, "-u", udid, "-l", "-o", "list_all", "-o", "xml"]
            result = subprocess.run(
                cmd,
                capture_output=True, text=True, timeout=20,
                encoding="utf-8", errors="replace",
                creationflags=0x08000000 if platform.system() == "Windows" else 0
            )
        except Exception as e:
            return {"available": True, "apps": [], "error": str(e)}

        raw = (result.stdout or "") + (result.stderr or "")
        apps = []
        try:
            root = ET.fromstring(raw)
            if root.tag != "plist":
                raise ValueError("unexpected root")
            for item in root.iter("dict"):
                pairs = {}
                children = list(item)
                i = 0
                while i < len(children) - 1:
                    if children[i].tag == "key":
                        key = children[i].text
                        value_el = children[i + 1]
                        if value_el.tag == "string":
                            pairs[key] = value_el.text or ""
                        elif value_el.tag in ("integer", "real"):
                            pairs[key] = value_el.text or ""
                        elif value_el.tag == "true":
                            pairs[key] = True
                        elif value_el.tag == "false":
                            pairs[key] = False
                        i += 2
                    else:
                        i += 1
                bundle_id = pairs.get("CFBundleIdentifier")
                if not bundle_id:
                    continue
                apps.append({
                    "id": bundle_id,
                    "packageName": bundle_id,
                    "appName": pairs.get("CFBundleDisplayName") or bundle_id,
                    "version": pairs.get("CFBundleShortVersionString")
                               or pairs.get("CFBundleVersion") or "",
                    "isSystem": pairs.get("ApplicationType") == "System",
                })
        except Exception as e:
            return {
                "available": True,
                "apps": [],
                "error": f"Failed to parse ideviceinstaller output: {e}",
            }

        apps.sort(key=lambda a: (a["isSystem"], a["appName"].lower()))
        return {"available": True, "apps": apps, "error": ""}

    def _read_body(self):
        """Read the raw request body"""
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
        except (TypeError, ValueError):
            length = 0
        return self.rfile.read(length) if length > 0 else b""

    def _handle_ios_uninstall(self):
        installer = self._ios_installer_tool()
        if installer is None:
            self._send_json({"success": False, "message": "ideviceinstaller not found"})
            return

        udid = self._get_apple_udid()
        if not udid:
            self._send_json({"success": False, "message": "No iOS device connected or device not trusted"})
            return

        payload = {}
        try:
            payload = json.loads(self._read_body() or b"{}")
        except Exception:
            pass
        package = (payload.get("packageName") or "").strip()
        if not package:
            self._send_json({"success": False, "message": "packageName is required"})
            return

        try:
            if _ios_installer_style() == "subcommand":
                cmd = [installer, "-u", udid, "uninstall", package]
            else:
                cmd = [installer, "-u", udid, "-U", package]
            result = subprocess.run(
                cmd,
                capture_output=True, text=True, timeout=120,
                encoding="utf-8", errors="replace",
                creationflags=0x08000000 if platform.system() == "Windows" else 0
            )
            out = ((result.stdout or "") + "\n" + (result.stderr or "")).strip()
            ok = result.returncode == 0
            self._send_json({
                "success": ok,
                "message": out or ("Uninstalled " + package if ok else "Uninstall failed"),
            })
        except Exception as e:
            self._send_json({"success": False, "message": f"Uninstall failed: {e}"})

    def _handle_ios_install(self, upgrade):
        installer = self._ios_installer_tool()
        if installer is None:
            self._send_json({"success": False, "message": "ideviceinstaller not found"})
            return

        udid = self._get_apple_udid()
        if not udid:
            self._send_json({"success": False, "message": "No iOS device connected or device not trusted"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
        except (TypeError, ValueError):
            length = 0
        if length <= 0:
            self._send_json({"success": False, "message": "No IPA archive data received"})
            return

        uploads = DATA_DIR / "uploads"
        uploads.mkdir(parents=True, exist_ok=True)
        ipa = uploads / f"upload-{int(time.time() * 1000)}.ipa"

        try:
            with open(ipa, "wb") as f:
                remaining = length
                while remaining > 0:
                    chunk = self.rfile.read(min(1 << 20, remaining))
                    if not chunk:
                        break
                    f.write(chunk)
                    remaining -= len(chunk)

            if remaining > 0:
                self._send_json({"success": False, "message": "Incomplete IPA upload (connection closed early)"})
                return

            if _ios_installer_style() == "subcommand":
                cmd = [installer, "-u", udid,
                       ("upgrade" if upgrade else "install"), str(ipa)]
            else:
                cmd = [installer, "-u", udid,
                       ("-g" if upgrade else "-i"), str(ipa)]
            result = subprocess.run(
                cmd,
                capture_output=True, text=True, timeout=300,
                encoding="utf-8", errors="replace",
                creationflags=0x08000000 if platform.system() == "Windows" else 0
            )
            out = ((result.stdout or "") + "\n" + (result.stderr or "")).strip()
            ok = result.returncode == 0
            self._send_json({
                "success": ok,
                "message": out or ("App installed successfully" if ok else "Install failed"),
            })
        except Exception as e:
            self._send_json({"success": False, "message": f"Install failed: {e}"})
        finally:
            try:
                if ipa.exists():
                    ipa.unlink()
            except Exception:
                pass

    def _handle_run_command(self):
        """Run an adb/fastboot command against a connected device and return real output."""
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            raw = self.rfile.read(length) if length > 0 else b""
            body = json.loads(raw.decode("utf-8", "replace"))
        except Exception:
            self._send_json({"success": False, "output": "", "error": "Invalid request body"})
            return

        try:
            command = (body.get("command") or "").strip()
            serial = (body.get("serial") or "").strip()
            if not command:
                self._send_json({"success": False, "output": "", "error": "No command provided"})
                return

            parts = command.split()
            tool = parts[0].lower()
            args = parts[1:]

            def _run(argv):
                try:
                    return subprocess.run(
                        argv, capture_output=True, text=True, timeout=120,
                        encoding="utf-8", errors="replace",
                        creationflags=0x08000000 if platform.system() == "Windows" else 0,
                        cwd=str(DATA_DIR),
                    ), None
                except subprocess.TimeoutExpired:
                    return None, "Command timed out after 120s"
                except Exception as e:
                    return None, str(e)

            if tool == "adb":
                exe = find_tool("adb")
                argv = [exe] + (["-s", serial] if serial else []) + args
                proc, err = _run(argv)
                if proc is None:
                    self._send_json({"success": False, "output": "", "error": err})
                    return
                out = ((proc.stdout or "") + (proc.stderr or "")).strip()
                ok = proc.returncode == 0
                self._send_json({
                    "success": ok,
                    "exitCode": proc.returncode,
                    "output": out,
                    "error": "" if ok else (out or f"Command failed with exit code {proc.returncode}"),
                })
            elif tool == "fastboot":
                exe = find_tool("fastboot")
                candidates = []
                if serial:
                    candidates.append([exe, "-s", serial] + args)
                candidates.append([exe] + args)
                proc = None
                last_out = ""
                for argv in candidates:
                    proc, err = _run(argv)
                    if proc is None:
                        self._send_json({"success": False, "output": "", "error": err})
                        return
                    last_out = ((proc.stdout or "") + (proc.stderr or "")).strip()
                    if proc.returncode == 0:
                        break
                    low = last_out.lower()
                    if "no devices" in low or "device not found" in low or "cannot find" in low:
                        continue
                    break
                ok = proc.returncode == 0
                self._send_json({
                    "success": ok,
                    "exitCode": proc.returncode,
                    "output": last_out,
                    "error": "" if ok else (last_out or f"Command failed with exit code {proc.returncode}"),
                })
            elif tool.startswith("idevice") or tool in ("irecovery", "usbmuxd"):
                exe = find_tool(tool)
                if exe == tool:
                    self._send_json({
                        "success": False, "output": "",
                        "error": f"Tool '{tool}' not found. Install libimobiledevice-utils.",
                    })
                    return
                no_udid = tool in ("idevice_id", "idevicediscoveryd", "usbmuxd")
                if tool == "ideviceenterrecovery" and serial:
                    argv = [exe] + args + [serial]
                else:
                    argv = [exe] + (["-u", serial] if serial and not no_udid else []) + args
                if tool in ("idevicescreenshot", "idevicecrashreport", "idevicebackup2") and args:
                    try:
                        target = str(DATA_DIR / args[-1])
                        if tool == "idevicescreenshot":
                            os.makedirs(os.path.dirname(target) or target, exist_ok=True)
                        else:
                            os.makedirs(target, exist_ok=True)
                    except Exception:
                        pass
                proc, err = _run(argv)
                if proc is None:
                    self._send_json({"success": False, "output": "", "error": err})
                    return
                out = ((proc.stdout or "") + (proc.stderr or "")).strip()
                ok = proc.returncode == 0
                self._send_json({
                    "success": ok,
                    "exitCode": proc.returncode,
                    "output": out,
                    "error": "" if ok else (out or f"Command failed with exit code {proc.returncode}"),
                })
            else:
                self._send_json({
                    "success": False, "output": "",
                    "error": f"Unsupported tool '{tool}' (expected 'adb', 'fastboot' or an 'idevice*' tool)",
                })
        except Exception as e:
            self._send_json({"success": False, "output": "", "error": f"Server error: {e}"})

    def _handle_device_health(self):
        """Gather live health data from a connected device (adb or idevice)."""
        def _empty_health():
            return {
                "batteryHealth": "unknown", "batteryLevel": None, "batteryCycles": None,
                "storageUsed": None, "storageTotal": None, "imei": None,
                "androidVersion": None, "securityPatch": None,
                "screenLock": None, "bootloaderUnlocked": None, "rootStatus": "unknown",
            }

        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(length).decode("utf-8", "replace"))
        except Exception:
            self._send_json({"success": False, "error": "Invalid request body", "health": _empty_health()})
            return

        serial = (body.get("serial") or "").strip()
        device_type = (body.get("deviceType") or "").strip().lower()
        if not serial:
            self._send_json({"success": False, "error": "No device serial provided", "health": _empty_health()})
            return

        def _run(argv, timeout=20):
            try:
                return subprocess.run(
                    argv, capture_output=True, text=True, timeout=timeout,
                    encoding="utf-8", errors="replace",
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                )
            except Exception:
                return None

        def _adb_shell(cmd, timeout=20):
            adb = find_tool("adb")
            if adb == "adb":
                return ""
            r = _run([adb, "-s", serial, "shell", cmd], timeout)
            return ((r.stdout or "") + (r.stderr or "")).strip() if r else ""

        def _adb_getprop(prop):
            return _adb_shell(f"getprop {prop}").strip()

        health = _empty_health()

        if device_type == "apple":
            ideviceinfo = find_tool("ideviceinfo")
            idevicediag = find_tool("idevicediagnostics")
            if ideviceinfo == "ideviceinfo":
                self._send_json({
                    "success": False, "error": "Tool 'ideviceinfo' not found. Install libimobiledevice-utils.",
                    "health": health,
                })
                return

            def _idevice_key(key):
                r = _run([ideviceinfo, "-u", serial, "-k", key], 15)
                return ((r.stdout or "") + (r.stderr or "")).strip() if r else ""

            health["imei"] = _idevice_key("InternationalMobileEquipmentIdentity") or None
            health["androidVersion"] = _idevice_key("ProductVersion") or None
            patch = _idevice_key("PasswordProtected").lower()
            health["screenLock"] = True if patch in ("true", "yes", "1") else False if patch in ("false", "no", "0") else None
            health["batteryLevel"] = None
            level = _idevice_key("BatteryCurrentCapacity")
            if level.isdigit():
                health["batteryLevel"] = int(level)

            if idevicediag != "idevicediagnostics":
                r = _run([idevicediag, "-u", serial, "diagnostics", "GasGauge"], 25)
                if r:
                    gauge = ((r.stdout or "") + (r.stderr or "")).strip()
                    cycles = re.search(r"<key>CycleCount</key>\s*<integer>(\d+)</integer>", gauge)
                    design = re.search(r"<key>DesignCapacity</key>\s*<integer>(\d+)</integer>", gauge)
                    full = re.search(r"<key>FullChargeCapacity</key>\s*<integer>(\d+)</integer>", gauge)
                    if cycles:
                        health["batteryCycles"] = int(cycles.group(1))
                    if design and full:
                        dc, fc = int(design.group(1)), int(full.group(1))
                        if 0 < fc <= 100:
                            pct = fc
                        elif 0 < dc <= 20000 and 0 < fc <= dc:
                            pct = round(fc / dc * 100)
                        else:
                            pct = None
                        if pct is not None:
                            health["batteryHealth"] = "good" if pct >= 85 else "fair" if pct >= 70 else "poor"
        elif device_type == "android":
            adb = find_tool("adb")
            if adb == "adb":
                self._send_json({
                    "success": False, "error": "Tool 'adb' not found. Install platform-tools.",
                    "health": health,
                })
                return

            battery = _adb_shell("dumpsys battery")
            m = re.search(r"\blevel:\s*(\d+)", battery)
            if m:
                health["batteryLevel"] = int(m.group(1))
            bh = re.search(r"\bhealth:\s*(\d+)", battery)
            if bh:
                code = int(bh.group(1))
                health["batteryHealth"] = {2: "good", 3: "poor", 4: "poor", 5: "poor", 7: "fair"}.get(code, "unknown")

            df = _adb_shell("df /data /sdcard")
            for line in df.splitlines():
                row = line.split()
                if len(row) >= 6 and (row[-1] == "/data" or row[-1] == "/sdcard"):
                    try:
                        size, used = int(row[1]) * 1024, int(row[2]) * 1024
                        health["storageTotal"] = size
                        health["storageUsed"] = used
                    except ValueError:
                        pass
                    break

            imei = _adb_getprop("gsm.imei") or _adb_getprop("ro.ril.oem.imei1") or _adb_getprop("persist.radio.imei")
            if not imei:
                sub = _adb_shell("dumpsys iphonesubinfo")
                im = re.search(r"imei[^\d]{0,20}(\d{9,15})", sub, re.IGNORECASE)
                imei = im.group(1) if im else None
            health["imei"] = imei or None
            health["androidVersion"] = _adb_getprop("ro.build.version.release") or None
            health["securityPatch"] = _adb_getprop("ro.build.version.security_patch") or None

            disabled = _adb_shell("locksettings get-disabled").lower()
            if disabled in ("true", "1"):
                health["screenLock"] = False
            elif disabled in ("false", "0"):
                health["screenLock"] = True
            else:
                q = _adb_shell("dumpsys lock_settings")
                qm = re.search(r"activePasswordQuality\s*=\s*(\d+)", q)
                health["screenLock"] = True if qm and int(qm.group(1)) > 0 else None

            state = _adb_getprop("ro.boot.vbmeta.device_state").lower()
            vb = _adb_getprop("ro.boot.verifiedbootstate").lower()
            if state in ("unlocked", "orange") or vb in ("orange", "yellow"):
                health["bootloaderUnlocked"] = True
            elif state == "locked" or vb == "green":
                health["bootloaderUnlocked"] = False

            su = _adb_shell("which su")
            su_paths = _adb_shell("ls /system/xbin/su /system/bin/su /su/bin/su /sbin/su 2>/dev/null")
            if su or su_paths:
                health["rootStatus"] = "rooted"
            else:
                health["rootStatus"] = "not_rooted"
        else:
            self._send_json({
                "success": False, "error": f"Unsupported device type '{device_type}'",
                "health": health,
            })
            return

        self._send_json({"success": True, "health": health})

    def _handle_mirror_screenshot(self):
        """Capture a fresh screenshot of the device and return it as PNG.

        Android: `adb exec-out screencap -p` streams the PNG.
        iOS: `pymobiledevice3 developer dvt screenshot --userspace` (needs Developer
        Mode enabled and the personalized Developer disk image mounted).
        """
        from urllib.parse import urlparse, parse_qs

        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        serial = (qs.get("serial", [""])[0] or "").strip()
        device_type = (qs.get("deviceType", [""])[0] or "").strip().lower()

        if not serial:
            self._send_json({"success": False, "error": "No device serial provided"})
            return

        def _run(argv, timeout=30):
            try:
                return subprocess.run(
                    argv, capture_output=True, timeout=timeout,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                ), None
            except subprocess.TimeoutExpired:
                return None, "Timed out"
            except Exception as e:
                return None, str(e)

        if device_type == "apple":
            if not PYMOBILEDEVICE3:
                self._send_json({
                    "success": False,
                    "error": "pymobiledevice3 not found. Install it in ~/pyvenv (python3 -m venv ~/pyvenv && ~/pyvenv/bin/pip install pymobiledevice3).",
                })
                return
            shot = DATA_DIR / "mirror" / "ios-screen.png"
            shot.parent.mkdir(parents=True, exist_ok=True)
            proc, err = _run([PYMOBILEDEVICE3, "developer", "dvt", "screenshot", str(shot), "--userspace"], 45)
            if proc is None or proc.returncode != 0:
                out = ""
                if proc is not None:
                    out = ((proc.stdout or b"") + (proc.stderr or b"")).decode("utf-8", "replace")
                self._send_json({
                    "success": False,
                    "error": (out or err or "Screenshot failed")[:400] or
                             "Screenshot failed - is the device unlocked with Developer Mode enabled?",
                })
                return
            if not shot.exists():
                self._send_json({"success": False, "error": "Screenshot produced no file"})
                return
            try:
                data = shot.read_bytes()
            except OSError as e:
                self._send_json({"success": False, "error": f"Could not read screenshot: {e}"})
                return
            self._send_png(data)
            return

        # Android
        adb = find_tool("adb")
        if adb == "adb":
            self._send_json({"success": False, "error": "Tool 'adb' not found. Install platform-tools."})
            return
        proc, err = _run([adb, "-s", serial, "exec-out", "screencap", "-p"], 20)
        if proc is None:
            self._send_json({"success": False, "error": err or "Screenshot failed"})
            return
        data = (proc.stdout or b"")
        if proc.returncode != 0 or not data:
            out = (proc.stderr or b"").decode("utf-8", "replace")
            self._send_json({
                "success": False,
                "error": out or "Screenshot failed - is the device unlocked with USB debugging authorized?",
            })
            return
        self._send_png(data)

    def _handle_mirror_input(self):
        """Inject touch/keyboard input into an Android device over adb."""
        import shlex

        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(length).decode("utf-8", "replace"))
        except Exception:
            self._send_json({"success": False, "error": "Invalid request body"})
            return

        serial = (body.get("serial") or "").strip()
        action = (body.get("action") or "").strip()
        device_type = (body.get("deviceType") or "").strip().lower()
        if not serial or not action:
            self._send_json({"success": False, "error": "Missing serial or action"})
            return

        if device_type == "apple":
            self._send_json({
                "success": False,
                "error": "Input injection is not supported on iOS over USB. Only Android devices can be remote-controlled.",
            })
            return

        adb = find_tool("adb")
        if adb == "adb":
            self._send_json({"success": False, "error": "Tool 'adb' not found. Install platform-tools."})
            return

        cmd = None
        if action == "tap":
            cmd = f"input tap {int(body.get('x', 0))} {int(body.get('y', 0))}"
        elif action == "swipe":
            cmd = ("input swipe %d %d %d %d %d" % (
                int(body.get('x', 0)), int(body.get('y', 0)),
                int(body.get('x2', 0)), int(body.get('y2', 0)),
                int(body.get('duration', 200))))
        elif action == "key":
            cmd = f"input keyevent {int(body.get('key', 0))}"
        elif action == "text":
            text = shlex.quote((body.get('text') or "").replace(" ", "%s"))
            cmd = f"input text {text}"

        if not cmd:
            self._send_json({"success": False, "error": f"Unknown action '{action}'"})
            return

        try:
            r = subprocess.run(
                [adb, "-s", serial, "shell", cmd], capture_output=True, text=True, timeout=15,
                encoding="utf-8", errors="replace",
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
            )
        except Exception as e:
            self._send_json({"success": False, "error": str(e)})
            return

        out = ((r.stdout or "") + (r.stderr or "")).strip()
        ok = r.returncode == 0
        self._send_json({
            "success": ok,
            "output": out,
            "error": "" if ok else (out or f"Input failed (exit {r.returncode})"),
        })

    # Media directories pulled during a quick backup (photos/videos/audio/docs)
    MEDIA_BACKUP_DIRS = [
        "DCIM", "Pictures", "Movies", "Music", "Recordings", "Sounds",
        "Download", "Documents", "WhatsApp", "Telegram", "Bluetooth",
    ]

    # Directories pulled from an iPhone's AFC root during a quick backup
    IOS_MEDIA_DIRS = [
        "DCIM", "PhotoData", "Photos", "Recordings", "Downloads", "Documents",
        "iTunes_Control", "Apple_Account",
    ]

    def _handle_media_backup(self):
        """Quick backup of all media/document files to portable/data/backups/<serial>/<timestamp>/"""
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(length).decode("utf-8", "replace"))
        except Exception:
            self._send_json({"success": False, "error": "Invalid request body", "backupPath": ""})
            return

        serial = (body.get("serial") or "").strip()
        if not serial:
            self._send_json({"success": False, "error": "No device serial provided", "backupPath": ""})
            return

        adb = find_tool("adb")
        base = DATA_DIR / "backups" / serial / time.strftime("%Y-%m-%d_%H%M%S")
        base.mkdir(parents=True, exist_ok=True)

        # Verify ADB connectivity (works if USB debugging was previously authorized)
        try:
            probe = subprocess.run(
                [adb, "-s", serial, "get-state"], capture_output=True, text=True, timeout=15,
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
                encoding="utf-8", errors="replace",
            )
        except Exception as e:
            self._send_json({"success": False, "error": f"Failed to start adb: {e}", "backupPath": str(base)})
            return

        if probe.returncode != 0 or not probe.stdout.strip():
            self._send_json({
                "success": False,
                "error": ("Device not reachable via ADB. Make sure USB debugging is enabled "
                          "and the authorization prompt was accepted while the screen was usable."),
                "backupPath": str(base),
            })
            return

        results = []
        total_files = 0
        total_bytes = 0

        for d in self.MEDIA_BACKUP_DIRS:
            src = f"/sdcard/{d}"
            dst = base / d
            try:
                r = subprocess.run(
                    [adb, "-s", serial, "pull", src, str(dst)],
                    capture_output=True, text=True, timeout=900,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                    encoding="utf-8", errors="replace",
                )
            except Exception as e:
                results.append({"dir": d, "ok": False, "files": 0, "bytes": 0,
                                "output": f"error: {e}"[:300]})
                continue

            out = ((r.stdout or "") + (r.stderr or "")).strip()
            n = 0
            size = 0
            if dst.exists():
                for dp, _, fs in os.walk(dst):
                    n += len(fs)
                    for f in fs:
                        try:
                            size += os.path.getsize(os.path.join(dp, f))
                        except OSError:
                            pass
            results.append({"dir": d, "ok": r.returncode == 0, "files": n,
                            "bytes": size, "output": out[:300]})
            total_files += n
            total_bytes += size

        self._send_json({
            "success": True,
            "backupPath": str(base),
            "dirs": results,
            "totalFiles": total_files,
            "totalBytes": total_bytes,
        })

    def _handle_ios_media_backup(self):
        """Quick backup of an iPhone's media/documents via AFC (works when the screen is broken)."""
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(length).decode("utf-8", "replace"))
        except Exception:
            self._send_json({"success": False, "error": "Invalid request body", "backupPath": ""})
            return

        udid = (body.get("serial") or "").strip()
        if not udid:
            self._send_json({"success": False, "error": "No device UDID provided", "backupPath": ""})
            return

        base = DATA_DIR / "backups" / udid / time.strftime("%Y-%m-%d_%H%M%S")
        base.mkdir(parents=True, exist_ok=True)

        idevice_id = find_tool("idevice_id")
        try:
            probe = subprocess.run(
                [idevice_id, "-l"], capture_output=True, text=True, timeout=15,
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
                encoding="utf-8", errors="replace",
            )
        except Exception as e:
            self._send_json({"success": False, "error": f"Failed to start idevice_id: {e}",
                             "backupPath": str(base)})
            return

        connected = [ln.strip() for ln in (probe.stdout or "").splitlines() if ln.strip()]
        if udid not in connected:
            self._send_json({
                "success": False,
                "error": ("iPhone not reachable via Apple's USB driver (idevice_id). "
                          "Make sure it is plugged in and has been trusted while the screen was usable."),
                "backupPath": str(base),
            })
            return

        afcclient = find_tool("afcclient")

        def _afc(argv, timeout=60):
            try:
                r = subprocess.run(
                    [afcclient, "-u", udid] + argv, capture_output=True, text=True,
                    timeout=timeout,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                    encoding="utf-8", errors="replace",
                )
                return r, None
            except subprocess.TimeoutExpired:
                return None, f"Command timed out after {timeout}s"
            except Exception as e:
                return None, str(e)

        # Enumerate what is actually present on the device root
        r, err = _afc(["ls", "/"], timeout=30)
        if err:
            self._send_json({"success": False, "error": err, "backupPath": str(base)})
            return
        if r.returncode != 0:
            out = _strip_ansi((r.stdout or "") + (r.stderr or "")).strip()
            self._send_json({
                "success": False,
                "error": out or f"afcclient ls failed (exit {r.returncode})",
                "backupPath": str(base),
            })
            return

        root_entries = [ln.strip() for ln in _strip_ansi(r.stdout).splitlines() if ln.strip()]
        requested = body.get("dirs") or self.IOS_MEDIA_DIRS
        targets = [d for d in requested if d in root_entries]

        results = []
        total_files = 0
        total_bytes = 0

        for d in targets:
            dst = base / d
            r, err = _afc(["get", "-r", f"/{d}", str(dst)], timeout=900)
            if err:
                results.append({"dir": d, "ok": False, "files": 0, "bytes": 0,
                                "output": f"error: {err}"[:300]})
                continue

            out = _strip_ansi((r.stdout or "") + (r.stderr or "")).strip()
            n = 0
            size = 0
            if dst.exists():
                for dp, _, fs in os.walk(dst):
                    n += len(fs)
                    for f in fs:
                        try:
                            size += os.path.getsize(os.path.join(dp, f))
                        except OSError:
                            pass
            results.append({"dir": d, "ok": r.returncode == 0, "files": n,
                            "bytes": size, "output": out[:300]})
            total_files += n
            total_bytes += size

        self._send_json({
            "success": True,
            "backupPath": str(base),
            "dirs": results,
            "totalFiles": total_files,
            "totalBytes": total_bytes,
        })

    def _handle_android_deleted_recovery(self):
        """Best-effort recovery of deleted photos/videos from an Android device.

        Without root this can't carve the filesystem, but deleted media usually
        leaves traces behind: the DCIM thumbnail cache and any trash/recycle
        folders created by galleries/file managers. Those are pulled into
        portable/data/recovered/<serial>/<timestamp>/.
        """
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(length).decode("utf-8", "replace"))
        except Exception:
            self._send_json({"success": False, "error": "Invalid request body", "recoveredPath": ""})
            return

        serial = (body.get("serial") or "").strip()
        if not serial:
            self._send_json({"success": False, "error": "No device serial provided", "recoveredPath": ""})
            return

        adb = find_tool("adb")
        base = DATA_DIR / "recovered" / serial / time.strftime("%Y-%m-%d_%H%M%S")
        base.mkdir(parents=True, exist_ok=True)

        try:
            probe = subprocess.run(
                [adb, "-s", serial, "get-state"], capture_output=True, text=True, timeout=15,
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
                encoding="utf-8", errors="replace",
            )
        except Exception as e:
            self._send_json({"success": False, "error": f"Failed to start adb: {e}",
                             "recoveredPath": str(base)})
            return

        if probe.returncode != 0 or not probe.stdout.strip():
            self._send_json({
                "success": False,
                "error": ("Device not reachable via ADB. Make sure USB debugging is enabled "
                          "and the authorization prompt was accepted while the screen was usable."),
                "recoveredPath": str(base),
            })
            return

        # Known places deleted media traces accumulate
        dirs = {
            "/sdcard/DCIM/.thumbnails",
            "/sdcard/.Trash", "/sdcard/.trash", "/sdcard/.recycle",
            "/sdcard/Download/.trash", "/sdcard/Pictures/.trash",
        }

        # Also scan for thumbnail caches / trash / recycle dirs left behind
        try:
            r = subprocess.run(
                [adb, "-s", serial, "shell",
                 r'find /sdcard -maxdepth 4 -type d \( -name .thumbnails -o -iname "*trash*" -o -iname "*recycle*" \) 2>/dev/null'],
                capture_output=True, text=True, timeout=90,
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
                encoding="utf-8", errors="replace",
            )
            for line in (r.stdout or "").splitlines():
                line = line.strip()
                if line:
                    dirs.add(line)
        except Exception:
            pass

        results = []
        total_files = 0
        total_bytes = 0

        for d in sorted(dirs):
            dst = base / (d.replace("/", "_").replace("\\", "_").lstrip("_") or "root")
            try:
                r = subprocess.run(
                    [adb, "-s", serial, "pull", d, str(dst)],
                    capture_output=True, text=True, timeout=600,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                    encoding="utf-8", errors="replace",
                )
            except Exception as e:
                results.append({"dir": d, "ok": False, "files": 0, "bytes": 0,
                                "output": f"error: {e}"[:300]})
                continue

            out = ((r.stdout or "") + (r.stderr or "")).strip()
            n = 0
            size = 0
            if dst.exists():
                for dp, _, fs in os.walk(dst):
                    n += len(fs)
                    for f in fs:
                        try:
                            size += os.path.getsize(os.path.join(dp, f))
                        except OSError:
                            pass
            results.append({"dir": d, "ok": r.returncode == 0, "files": n,
                            "bytes": size, "output": out[:300]})
            total_files += n
            total_bytes += size

        self._send_json({
            "success": True,
            "recoveredPath": str(base),
            "dirs": results,
            "totalFiles": total_files,
            "totalBytes": total_bytes,
            "message": (f"Recovered traces from {len([x for x in results if x['ok']])} folder(s). "
                        "Thumbnail caches can often be recovered into full photos with a recovery tool."),
        })

    def _handle_ios_deleted_recovery(self):
        """Recover photos/videos from the iOS 'Recently Deleted' album.

        Pulls the Photos library database over AFC, finds assets flagged as
        trashed, then copies those files into portable/data/recovered/<udid>/<timestamp>/.
        """
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(length).decode("utf-8", "replace"))
        except Exception:
            self._send_json({"success": False, "error": "Invalid request body", "recoveredPath": ""})
            return

        udid = (body.get("serial") or "").strip()
        if not udid:
            self._send_json({"success": False, "error": "No device UDID provided", "recoveredPath": ""})
            return

        base = DATA_DIR / "recovered" / udid / time.strftime("%Y-%m-%d_%H%M%S")
        base.mkdir(parents=True, exist_ok=True)

        idevice_id = find_tool("idevice_id")
        try:
            probe = subprocess.run(
                [idevice_id, "-l"], capture_output=True, text=True, timeout=15,
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
                encoding="utf-8", errors="replace",
            )
        except Exception as e:
            self._send_json({"success": False, "error": f"Failed to start idevice_id: {e}",
                             "recoveredPath": str(base)})
            return

        connected = [ln.strip() for ln in (probe.stdout or "").splitlines() if ln.strip()]
        if udid not in connected:
            self._send_json({
                "success": False,
                "error": ("iPhone not reachable via Apple's USB driver (idevice_id). "
                          "Make sure it is plugged in and has been trusted while the screen was usable."),
                "recoveredPath": str(base),
            })
            return

        afcclient = find_tool("afcclient")

        def _afc(argv, timeout=120):
            try:
                r = subprocess.run(
                    [afcclient, "-u", udid] + argv, capture_output=True, text=True,
                    timeout=timeout,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                    encoding="utf-8", errors="replace",
                )
                return r, None
            except subprocess.TimeoutExpired:
                return None, f"Command timed out after {timeout}s"
            except Exception as e:
                return None, str(e)

        # Pull the photo library database + journals so we can find deleted assets
        db_dir = base / "library"
        db_dir.mkdir(parents=True, exist_ok=True)
        for name in ["Photos.sqlite", "Photos.sqlite-wal", "Photos.sqlite-shm"]:
            r, err = _afc(["get", f"/PhotoData/{name}", str(db_dir / name)], timeout=900)
            if err:
                self._send_json({"success": False, "error": err, "recoveredPath": str(base)})
                return
            if r.returncode != 0 and name == "Photos.sqlite":
                out = _strip_ansi((r.stdout or "") + (r.stderr or "")).strip()
                self._send_json({
                    "success": False,
                    "error": out or f"Failed to read Photos library (exit {r.returncode})",
                    "recoveredPath": str(base),
                })
                return

        import sqlite3
        trashed = []
        db_path = db_dir / "Photos.sqlite"
        try:
            con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            cur = con.cursor()
            cols = [row[1] for row in cur.execute("PRAGMA table_info(ZASSET)")]
            if "ZTRASHEDSTATE" in cols and "ZDIRECTORY" in cols and "ZFILENAME" in cols:
                for row in cur.execute(
                    "SELECT ZDIRECTORY, ZFILENAME, ZKIND FROM ZASSET "
                    "WHERE ZTRASHEDSTATE IS NOT NULL AND ZTRASHEDSTATE != 0 "
                    "AND ZDIRECTORY IS NOT NULL AND ZFILENAME IS NOT NULL"
                ):
                    trashed.append({
                        "dir": row[0],
                        "file": row[1],
                        "kind": row[2] if row[2] is not None else 0,
                    })
            con.close()
        except Exception as e:
            self._send_json({
                "success": False,
                "error": (f"Could not read the Photos library (it may be locked or mid-sync): {e}. "
                          "Unlock the phone once while the screen works, then retry."),
                "recoveredPath": str(base),
            })
            return

        if not trashed:
            self._send_json({
                "success": True,
                "recoveredPath": str(base),
                "files": [],
                "totalFiles": 0,
                "totalBytes": 0,
                "message": "No photos/videos found in Recently Deleted.",
            })
            return

        files = []
        total_files = 0
        total_bytes = 0
        recovered = []

        for item in trashed:
            remote_dir = item["dir"].lstrip("/")
            local_dir = base / (remote_dir.replace("/", "_").replace("\\", "_"))
            local_dir.mkdir(parents=True, exist_ok=True)
            local_path = local_dir / item["file"]
            remote_path = f"/{remote_dir}/{item['file']}"

            r, err = _afc(["get", remote_path, str(local_path)], timeout=600)
            ok = err is None and r.returncode == 0 and local_path.exists()
            size = 0
            if ok:
                try:
                    size = os.path.getsize(local_path)
                except OSError:
                    ok = False
            if ok and size > 0:
                total_files += 1
                total_bytes += size
                recovered.append((remote_dir, item["file"]))
            files.append({
                "dir": remote_dir,
                "file": item["file"],
                "kind": "video" if item["kind"] == 1 else "photo",
                "ok": ok,
                "bytes": size,
                "output": "" if ok else _strip_ansi((r.stdout or "") + (r.stderr or "")).strip()[:200],
            })

        # Live photos store their video as a same-name .MOV/.MP4 sibling; edits as .AAE
        for remote_dir, fname in recovered:
            stem, ext = os.path.splitext(fname)
            local_dir = base / (remote_dir.replace("/", "_").replace("\\", "_"))
            for s in [".MOV", ".MP4", ".AAE"]:
                if ext.upper() == s:
                    continue
                local_path = local_dir / (stem + s)
                r, err = _afc(["get", f"/{remote_dir}/{stem}{s}", str(local_path)], timeout=300)
                if err is None and r.returncode == 0 and local_path.exists():
                    try:
                        size = os.path.getsize(local_path)
                    except OSError:
                        size = 0
                    if size > 0:
                        total_files += 1
                        total_bytes += size
                        files.append({
                            "dir": remote_dir, "file": stem + s,
                            "kind": "video" if s in (".MOV", ".MP4") else "edit",
                            "ok": True, "bytes": size, "output": "",
                        })

        self._send_json({
            "success": True,
            "recoveredPath": str(base),
            "files": files,
            "totalFiles": total_files,
            "totalBytes": total_bytes,
            "message": f"Recovered {total_files} file(s) from Recently Deleted.",
        })

    def _handle_network_unlock(self):
        """Network/carrier unlock helper.

        No tool can silently unlock every brand - a carrier-supplied unlock code
        (NCK) is always required. This reads the SIM/network-lock state, reports
        the IMEI, and opens the brand's unlock-code entry screen where possible
        (Samsung NCK menu, universal Android Testing/Phone-info menu).
        """
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(length).decode("utf-8", "replace"))
        except Exception:
            self._send_json({"success": False, "error": "Invalid request body", "steps": []})
            return

        serial = (body.get("serial") or "").strip()
        device_platform = (body.get("platform") or "android").lower()
        if not serial:
            self._send_json({"success": False, "error": "No device serial provided", "steps": []})
            return

        if device_platform == "ios":
            self._handle_ios_network_unlock(serial)
            return

        adb = find_tool("adb")

        def _sh(argv, timeout=20):
            try:
                r = subprocess.run(
                    argv, capture_output=True, text=True, timeout=timeout,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                    encoding="utf-8", errors="replace",
                )
                return r, None
            except subprocess.TimeoutExpired:
                return None, f"Timed out after {timeout}s"
            except Exception as e:
                return None, str(e)

        probe, err = _sh([adb, "-s", serial, "get-state"], 15)
        if err:
            self._send_json({"success": False, "error": err, "steps": []})
            return
        if probe.returncode != 0 or not probe.stdout.strip():
            self._send_json({
                "success": False,
                "error": ("Device not reachable via ADB. Make sure USB debugging is enabled "
                          "and the authorization prompt was accepted."),
                "steps": [],
            })
            return

        steps = []
        props = [
            ("Manufacturer", "ro.product.manufacturer"),
            ("Model", "ro.product.model"),
            ("Carrier", "gsm.sim.operator.alpha"),
            ("SIM state", "gsm.sim.state"),
            ("IMEI", "gsm.imei"),
        ]
        for label, prop in props:
            r, e = _sh([adb, "-s", serial, "shell", "getprop", prop], 15)
            if e:
                steps.append({"label": label, "command": f"getprop {prop}",
                              "ok": False, "output": e})
            else:
                out = ((r.stdout or "") + (r.stderr or "")).strip()
                steps.append({"label": label, "command": f"getprop {prop}",
                              "ok": r.returncode == 0, "output": out or "(empty)"})

        manufacturer = ""
        for s in steps:
            if s["label"] == "Manufacturer":
                manufacturer = s["output"].lower()

        # Samsung: trigger the factory "Network Lock" (NCK) menu
        if "samsung" in manufacturer:
            r, e = _sh([adb, "-s", serial, "shell", "am", "start",
                        "-a", "android.intent.action.CALL", "-d", "tel:*%237465625%23"], 20)
            if e:
                steps.append({"label": "Network Lock menu (Samsung)",
                              "command": "am start ... *7465625#", "ok": False, "output": e})
            else:
                out = ((r.stdout or "") + (r.stderr or "")).strip()
                steps.append({"label": "Network Lock menu (Samsung)",
                              "command": "am start ... *7465625#",
                              "ok": r.returncode == 0, "output": out or "(opened)"})

        # Universal: open the "Testing / Phone info" menu (SIM + lock state)
        r, e = _sh([adb, "-s", serial, "shell", "am", "start",
                    "-a", "android.intent.action.DIAL", "-d", "tel:*%23*%234636%23*%23"], 20)
        if e:
            steps.append({"label": "Testing / Phone info menu",
                          "command": "am start ... *#*#4636#*#*", "ok": False, "output": e})
        else:
            out = ((r.stdout or "") + (r.stderr or "")).strip()
            steps.append({"label": "Testing / Phone info menu",
                          "command": "am start ... *#*#4636#*#*",
                          "ok": r.returncode == 0, "output": out or "(opened)"})

        self._send_json({
            "success": True,
            "steps": steps,
            "message": ("Checked SIM/network-lock state. A carrier-supplied unlock code (NCK) is "
                        "still required - if a code screen opened on the phone, enter the code "
                        "to finish the network unlock."),
        })

    def _handle_ios_network_unlock(self, udid):
        """iPhone carrier unlock is done by the carrier/Apple using the IMEI;
        this reads and reports the current activation/lock status."""
        ideviceinfo = find_tool("ideviceinfo")
        steps = []
        try:
            r = subprocess.run(
                [ideviceinfo, "-u", udid], capture_output=True, text=True, timeout=30,
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
                encoding="utf-8", errors="replace",
            )
        except Exception as e:
            self._send_json({"success": False, "error": f"Failed to start ideviceinfo: {e}",
                             "steps": steps})
            return

        if r.returncode != 0:
            out = ((r.stdout or "") + (r.stderr or "")).strip()
            self._send_json({
                "success": False,
                "error": out or f"ideviceinfo failed (exit {r.returncode})",
                "steps": steps,
            })
            return

        info = {}
        for line in ((r.stdout or "") + (r.stderr or "")).splitlines():
            if ": " in line:
                k, v = line.split(": ", 1)
                info[k.strip()] = v.strip()

        wanted = [
            ("ProductType", "ProductType"),
            ("ProductVersion", "ProductVersion"),
            ("ActivationState", "ActivationState"),
            ("ActivationStateAcknowledged", "ActivationStateAcknowledged"),
            ("IMEI", "InternationalMobileEquipmentIdentity"),
            ("IMEI", "IMEI"),
            ("BasebandVersion", "BasebandVersion"),
        ]
        seen = set()
        for label, key in wanted:
            if key in info and key not in seen:
                seen.add(key)
                steps.append({"label": label, "command": f"ideviceinfo {key}",
                              "ok": True, "output": info[key] or "(empty)"})

        if not steps:
            steps.append({"label": "Device info", "command": "ideviceinfo",
                          "ok": True, "output": ((r.stdout or "").strip()[:300]) or "(empty)"})

        self._send_json({
            "success": True,
            "steps": steps,
            "message": ("iPhone carrier (network) unlocks are handled by the carrier or Apple "
                        "using the device IMEI. TechBench cannot unlock an iPhone locally - "
                        "request the unlock from the carrier, then restore the phone."),
        })

    def _handle_remove_lock(self):
        """Remove the screen lock (PIN/password/pattern/fingerprint/FaceID) without data loss.

        Android: needs root (adb root or an su binary). TechBench deletes the
        credential and biometric database files and reboots, keeping all user data.
        Without root, an unknown lock can only be cleared by a factory reset
        (which erases data) - that limitation is reported honestly instead of
        pretending otherwise.

        iOS: passcode and FaceID are bound to the Secure Enclave and cannot be
        removed over USB without the passcode or a full restore (data loss).
        TechBench reads the lock state and explains the options.
        """
        def _sh(argv, timeout=30):
            try:
                r = subprocess.run(
                    argv, capture_output=True, text=True, timeout=timeout,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                    encoding="utf-8", errors="replace",
                )
                return r, None
            except subprocess.TimeoutExpired:
                return None, f"Timed out after {timeout}s"
            except Exception as e:
                return None, str(e)

        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(length).decode("utf-8", "replace"))
        except Exception:
            self._send_json({"success": False, "error": "Invalid request body", "steps": [], "message": ""})
            return

        serial = (body.get("serial") or "").strip()
        platform = (body.get("platform") or "android").lower()
        if not serial:
            self._send_json({"success": False, "error": "No device serial provided", "steps": [], "message": ""})
            return

        if platform == "ios":
            self._handle_ios_remove_lock(serial)
            return

        adb = find_tool("adb")
        if adb == "adb":
            self._send_json({
                "success": False, "error": "Tool 'adb' not found. Install platform-tools.",
                "steps": [], "message": "",
            })
            return

        steps = []

        def _step(label, command, ok, output):
            steps.append({"label": label, "command": command,
                          "ok": ok, "output": ((output or "").strip()[:400] or "(empty)")})

        def _adb_shell(cmd, timeout=30):
            r, e = _sh([adb, "-s", serial, "shell", cmd], timeout)
            return ((r.stdout or "") + (r.stderr or "")).strip() if (r and not e) else ""

        # 1. Connectivity
        probe, err = _sh([adb, "-s", serial, "get-state"], 15)
        if err or probe is None or probe.returncode != 0:
            self._send_json({
                "success": False,
                "error": ("Device not reachable via ADB. Make sure USB debugging is enabled "
                          "and the authorization prompt was accepted."),
                "steps": steps, "message": "",
            })
            return
        _step("ADB connection", "adb get-state", True, "device online")

        # 2. Current lock state
        disabled = _adb_shell("locksettings get-disabled").lower()
        if disabled in ("true", "1"):
            _step("Lock state", "locksettings get-disabled", True, "already disabled - nothing to remove")
            self._send_json({
                "success": True, "steps": steps,
                "message": "The device already has no screen lock. No data was touched.",
            })
            return
        _step("Lock state", "locksettings get-disabled", True, "a lock is set")

        # 3. Try to obtain root
        root_cmd = "adb root"
        root_out = ""
        r, e = _sh([adb, "-s", serial, "root"], 15)
        if r:
            root_out = ((r.stdout or "") + (r.stderr or "")).strip()
        privileged = False
        if r is None or e or "cannot run as root" in root_out.lower() or "not allowed" in root_out.lower():
            # adb root refused - try an su binary on the device
            su_id = _adb_shell("su -c id")
            _step("Root (su)", "su -c id", "uid=0" in su_id,
                  su_id or "no su binary available")
            privileged = "uid=0" in su_id
        else:
            time.sleep(3)
            if "restarting adbd" in root_out.lower():
                _step("Root (adb root)", "adb root", True, "adbd restarted as root")
                id_out = _adb_shell("id")
                privileged = "uid=0" in id_out
                _step("Verify root", "id", privileged, id_out or "not root")
            else:
                id_out = _adb_shell("id")
                privileged = "uid=0" in id_out
                _step("Verify root", "id", privileged, id_out or "not root")

        if not privileged:
            self._send_json({
                "success": True,
                "steps": steps,
                "error": "",
                "removed": False,
                "message": ("Could not obtain root on this device. Removing a PIN/password/pattern "
                            "without data loss requires root (an unlocked bootloader with a custom "
                            "recovery or Magisk, or a userdebug build). A factory reset would clear "
                            "the lock but erases all user data. Alternatively the current PIN can be "
                            "used: Settings > Security > Screen lock."),
            })
            return

        # 4. Delete lock credential files (root)
        targets = [
            "/data/system/locksettings.db",
            "/data/system/locksettings.db-wal",
            "/data/system/locksettings.db-shm",
            "/data/system/gatekeeper.password.key",
            "/data/system/gatekeeper.pattern.key",
            "/data/system/gesture.key",
            "/data/system/password.key",
            "/data/system/strangerkey",
            "/data/user_de/0/fingerprint",
            "/data/system/users/0/fpdata",
            "/data/system/hw_fingerprint",
            "/data/system/sensors/hw_udfps",
            "/data/user_de/0/facedata",
            "/data/user_de/0/facelock",
        ]
        removed = 0
        for target in targets:
            out = _adb_shell(f"rm -rf {target} && echo removed")
            if "removed" in out:
                removed += 1
        _step("Remove lock files", "rm -rf locksettings.db + gatekeeper keys",
              removed > 0, f"{removed} credential file(s) removed")

        # 5. Reboot to finish
        r, e = _sh([adb, "-s", serial, "reboot"], 15)
        _step("Reboot", "adb reboot", r is not None and r.returncode == 0, "rebooting device")

        time.sleep(12)
        # Wait for the device to come back
        for _ in range(10):
            rr, _ = _sh([adb, "-s", serial, "get-state"], 10)
            if rr is not None and rr.returncode == 0 and rr.stdout.strip():
                break
            time.sleep(5)

        final_disabled = _adb_shell("locksettings get-disabled").lower()
        done = final_disabled in ("true", "1")
        _step("Verify", "locksettings get-disabled", done, final_disabled or "not reachable yet")

        self._send_json({
            "success": done,
            "removed": done,
            "steps": steps,
            "message": ("Screen lock removed. The device rebooted and should boot to the home "
                        "screen with all data intact.") if done else
                       ("Credential files were removed and the device was rebooted, but the lock "
                        "state could not be verified yet. Reconnect and re-run the tool if needed."),
        })

    def _handle_ios_remove_lock(self, udid):
        """iOS passcode/FaceID removal is bound to the Secure Enclave - explain honestly."""
        ideviceinfo = find_tool("ideviceinfo")
        steps = []
        if ideviceinfo == "ideviceinfo":
            self._send_json({
                "success": False, "error": "Tool 'ideviceinfo' not found. Install libimobiledevice-utils.",
                "steps": steps, "message": "",
            })
            return

        try:
            r = subprocess.run(
                [ideviceinfo, "-u", udid], capture_output=True, text=True, timeout=30,
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
                encoding="utf-8", errors="replace",
            )
        except Exception as e:
            self._send_json({"success": False, "error": f"Failed to start ideviceinfo: {e}",
                             "steps": steps, "message": ""})
            return

        if r.returncode != 0:
            out = ((r.stdout or "") + (r.stderr or "")).strip()
            self._send_json({"success": False, "error": out or f"ideviceinfo failed (exit {r.returncode})",
                             "steps": steps, "message": ""})
            return

        info = {}
        for line in ((r.stdout or "") + (r.stderr or "")).splitlines():
            if ": " in line:
                k, v = line.split(": ", 1)
                info[k.strip()] = v.strip()

        protected = info.get("PasswordProtected", "").lower()
        steps.append({"label": "Passcode protected", "command": "ideviceinfo PasswordProtected",
                      "ok": True, "output": protected or "unknown"})

        if protected in ("false", "no", "0"):
            self._send_json({
                "success": True, "removed": False, "steps": steps,
                "message": "This iPhone has no passcode set. FaceID can be re-enrolled under Settings > Face ID & Passcode.",
            })
            return

        self._send_json({
            "success": True, "removed": False, "steps": steps,
            "error": "",
            "message": ("This iPhone is passcode-protected. iOS passcode and FaceID cannot be removed "
                        "over USB without data loss - they are tied to the Secure Enclave. Apple only "
                        "clears them by (a) entering the current passcode, or (b) restoring the device "
                        "in DFU mode, which erases all data. There is no known exploit that removes an "
                        "unknown iOS passcode while keeping data. Options: enter the passcode on the "
                        "device, or restore from a recent iCloud/iTunes backup after a DFU erase."),
        })

    def _handle_jailbreak_info(self):
        """Report device details and honest jailbreak compatibility."""
        from urllib.parse import urlparse, parse_qs

        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        udid = (qs.get("serial", [""])[0] or "").strip()
        if not udid:
            self._send_json({"success": False, "error": "No device serial provided"})
            return

        info, err = _apple_info_fields(udid)
        if err:
            self._send_json({"success": False, "error": err})
            return

        product = info.get("ProductType", "")
        ios = info.get("ProductVersion", "") or info.get("HumanReadableProductVersionString", "")
        assessment = _assess_jailbreak(product, ios)
        self._send_json({
            "success": True,
            "device": {
                "name": info.get("DeviceName", ""),
                "marketingName": _product_marketing_name(product),
                "model": info.get("HardwareModel", ""),
                "productType": product,
                "modelNumber": info.get("ModelNumber", ""),
                "iosVersion": ios,
                "build": info.get("BuildVersion", ""),
                "serial": info.get("SerialNumber", ""),
            },
            "assessment": assessment,
        })

    def _handle_icloud_activation(self):
        """Query Apple's public Activation Lock status endpoint by serial or IMEI."""
        import urllib.request
        from urllib.parse import urlparse, parse_qs

        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        identifier = (qs.get("id", [""])[0] or "").strip()
        if not identifier:
            self._send_json({"success": False, "error": "No serial or IMEI provided"})
            return

        payload = {"imei": identifier} if (identifier.isdigit() and len(identifier) == 15) else {"sn": identifier}
        try:
            req = urllib.request.Request(
                _ACTIVATION_LOCK_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "TechBench/0.1"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8", "replace")
        except Exception as e:
            self._send_json({
                "success": False,
                "error": f"Could not reach Apple activation-lock service ({e}). "
                         "Check that this machine has internet access to icloud.apple.com.",
            })
            return

        try:
            data = json.loads(raw)
        except Exception:
            self._send_json({"success": False, "error": "Unexpected response from Apple", "raw": raw[:500]})
            return

        locked = bool(data.get("locked") or data.get("FMiPState") is True)
        self._send_json({
            "success": True,
            "identifier": identifier,
            "locked": locked,
            "established": bool(data.get("Established", False)),
            "desc": str(data.get("desc") or data.get("msg") or data.get("message") or ""),
            "raw": data,
        })

    def _handle_icloud_info(self):
        """Report iCloud-relevant device identifiers via ideviceinfo."""
        from urllib.parse import urlparse, parse_qs

        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        udid = (qs.get("serial", [""])[0] or "").strip()
        if not udid:
            self._send_json({"success": False, "error": "No device serial provided"})
            return

        info, err = _apple_info_fields(udid)
        if err:
            self._send_json({"success": False, "error": err})
            return

        keys = [
            "DeviceName", "SerialNumber", "IMEI", "ICCID", "MEID", "PhoneNumber",
            "ProductType", "HardwareModel", "ModelNumber", "ProductVersion", "BuildVersion",
            "ActivationState", "ActivationStateAcknowledged", "WiFiAddress",
            "BluetoothAddress", "DeviceClass", "MLBSerialNumber",
        ]
        report = {k: info.get(k, "") for k in keys}
        report["MarketingName"] = _product_marketing_name(report.get("ProductType", ""))
        self._send_json({"success": True, "device": report})

    def _pm3_with_udid(self, sub, udid):
        """Prefix a pymobiledevice3 subcommand with --udid placed after it."""
        return [PYMOBILEDEVICE3] + sub + ["--udid", udid]

    def _pm3_profile_identifiers(self, udid):
        """Return installed profile identifiers matching com.apple.applicationaccess."""
        proc, _ = _run_tool(self._pm3_with_udid(["profile", "list"], udid), 40)
        if proc is None or proc.returncode != 0:
            return []
        try:
            data = json.loads(proc.stdout or "{}")
            meta = data.get("ProfileMetadata") or {}
            return [k for k in meta if str(k).startswith("com.apple.applicationaccess")]
        except Exception:
            return []

    def _handle_stop_update(self):
        """Block/delay iOS OTA updates with a Restrictions profile (3uTools-style)."""
        try:
            payload = json.loads(self._read_body() or b"{}")
        except Exception:
            self._send_json({"success": False, "error": "Invalid request body"})
            return

        action = (payload.get("action") or "").strip()
        udid = (payload.get("serial") or "").strip()
        if not PYMOBILEDEVICE3:
            self._send_json({"success": False, "error":
                "pymobiledevice3 not found. Install it in ~/pyvenv."})
            return
        if not action or not udid:
            self._send_json({"success": False, "error": "Missing action or serial"})
            return

        if action == "status":
            identifiers = self._pm3_profile_identifiers(udid)
            self._send_json({
                "success": True, "blocked": bool(identifiers),
                "identifiers": identifiers,
                "message": ("OTA updates are currently delayed by a Restrictions profile."
                            if identifiers else "No update-blocking profile is installed."),
            })
            return

        if action == "block":
            try:
                days = max(0, min(90, int(payload.get("days") or 90)))
            except (TypeError, ValueError):
                self._send_json({"success": False, "error": "Invalid days value"})
                return
            cmd = self._pm3_with_udid(
                ["profile", "install-restrictions-profile",
                 "--enforced-software-update-delay", str(days)], udid)
            proc, err = _run_tool(cmd, 90)
            if proc is None or proc.returncode != 0:
                full_out = ""
                if proc is not None:
                    full_out = (proc.stdout or "") + (proc.stderr or "")
                if "locked" in (full_out or "").lower():
                    self._send_json({"success": False, "error":
                        "iPhone is locked. Unlock it, then retry - the phone may prompt to allow the profile."})
                    return
                self._send_json({"success": False,
                    "error": (full_out or err or "Failed to install update-blocking profile")[:600]})
                return
            identifiers = self._pm3_profile_identifiers(udid)
            self._send_json({
                "success": True, "blocked": bool(identifiers),
                "identifiers": identifiers,
                "message": ("Update-blocking profile installed - OTA updates are now delayed by "
                            f"{days} day(s). Tap 'Allow' on the phone if it asks."),
            })
            return

        if action == "unblock":
            identifiers = self._pm3_profile_identifiers(udid)
            if not identifiers:
                self._send_json({"success": True, "blocked": False, "identifiers": [],
                                 "message": "No update-blocking profile is installed."})
                return
            cmd = self._pm3_with_udid(["profile", "remove", identifiers[0]], udid)
            proc, err = _run_tool(cmd, 40)
            if proc is None or proc.returncode != 0:
                full_out = ""
                if proc is not None:
                    full_out = (proc.stdout or "") + (proc.stderr or "")
                self._send_json({"success": False,
                    "error": (full_out or err or "Failed to remove profile")[:500]})
                return
            self._send_json({"success": True, "blocked": False, "identifiers": [],
                             "message": "Update-blocking profile removed - OTA updates are re-enabled."})
            return

        self._send_json({"success": False, "error": f"Unknown action: {action}"})

    def _handle_virtual_location(self):
        """Simulate a GPS location through DVT (iOS 17+). The session must stay open."""
        try:
            payload = json.loads(self._read_body() or b"{}")
        except Exception:
            self._send_json({"success": False, "error": "Invalid request body"})
            return

        action = (payload.get("action") or "").strip()
        udid = (payload.get("serial") or "").strip()
        if not PYMOBILEDEVICE3:
            self._send_json({"success": False, "error":
                "pymobiledevice3 not found. Install it in ~/pyvenv."})
            return
        if not udid:
            self._send_json({"success": False, "error": "Missing serial"})
            return

        if action == "status":
            self._send_json({
                "success": True, "active": _virtual_location_alive(),
                "lat": _VIRTUAL_LOCATION.get("lat"), "lng": _VIRTUAL_LOCATION.get("lng"),
            })
            return

        if action == "set":
            try:
                lat = float(payload.get("lat"))
                lng = float(payload.get("lng"))
            except (TypeError, ValueError):
                self._send_json({"success": False, "error": "Invalid latitude/longitude"})
                return
            _virtual_location_stop()
            cmd = [PYMOBILEDEVICE3, "developer", "dvt", "simulate-location", "set",
                   "--userspace", "--udid", udid, "--", str(lat), str(lng)]
            log_file = DATA_DIR / "vloc.log"
            log_file.parent.mkdir(parents=True, exist_ok=True)
            flags = 0
            if platform.system() == "Windows":
                flags = 0x00000200 | 0x08000000  # CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW
                try:
                    p = subprocess.Popen(
                        cmd, stdout=open(log_file, "wb"), stderr=subprocess.STDOUT,
                        stdin=subprocess.DEVNULL, creationflags=flags, close_fds=True)
                except Exception as e:
                    self._send_json({"success": False, "error": f"Failed to start: {e}"})
                    return
            else:
                try:
                    p = subprocess.Popen(
                        cmd, stdout=open(log_file, "wb"), stderr=subprocess.STDOUT,
                        stdin=subprocess.DEVNULL, start_new_session=True)
                except Exception as e:
                    self._send_json({"success": False, "error": f"Failed to start: {e}"})
                    return
            time.sleep(4)
            if p.poll() is not None:
                out = ""
                try:
                    out = log_file.read_text("utf-8", "replace")[:600]
                except OSError:
                    pass
                self._send_json({"success": False, "error": (out or "Session exited unexpectedly")[:600]})
                return
            _VIRTUAL_LOCATION["pid"] = p.pid
            _VIRTUAL_LOCATION["lat"] = lat
            _VIRTUAL_LOCATION["lng"] = lng
            self._send_json({
                "success": True, "active": True, "lat": lat, "lng": lng,
                "message": f"Simulated location set to {lat}, {lng}. It stays active while the session runs.",
            })
            return

        if action == "clear":
            _virtual_location_stop()
            proc, err = _run_tool(self._pm3_with_udid(
                ["developer", "dvt", "simulate-location", "clear", "--userspace"], udid), 40)
            if proc is not None and proc.returncode != 0:
                full_out = (proc.stdout or "") + (proc.stderr or "")
                self._send_json({"success": True, "active": False,
                    "message": "Session stopped. Clear reported: " + (full_out or err or "ok")[:300]})
                return
            self._send_json({"success": True, "active": False,
                             "message": "Virtual location cleared - real GPS resumed."})
            return

        self._send_json({"success": False, "error": f"Unknown action: {action}"})

    def _handle_mdm(self):
        """Detect and remove Remote Management (MDM) enrollment on iOS and Android.

        iOS: looks for MDM/management configuration profiles and removes them via
        `pymobiledevice3 profile remove`. Supervised devices may reject removal.
        Android: lists Device Owner / active admins and tries `dpm remove-active-admin`;
        falls back to disabling the MDM app, or reports when a factory reset is the
        only route.
        """
        try:
            payload = json.loads(self._read_body() or b"{}")
        except Exception:
            self._send_json({"success": False, "error": "Invalid request body"})
            return

        action = (payload.get("action") or "").strip()
        device_type = (payload.get("deviceType") or "").strip().lower()
        serial = (payload.get("serial") or "").strip()
        identifier = (payload.get("identifier") or "").strip()

        if not action or not device_type or not serial:
            self._send_json({"success": False, "error": "Missing action, deviceType or serial"})
            return

        if device_type == "apple":
            if not PYMOBILEDEVICE3:
                self._send_json({"success": False, "error":
                    "pymobiledevice3 not found. Install it in ~/pyvenv."})
                return
            if action == "status":
                self._handle_mdm_ios_status(serial)
            elif action == "remove" and identifier:
                self._handle_mdm_ios_remove(serial, identifier)
            else:
                self._send_json({"success": False, "error": f"Unknown action: {action}"})
            return

        if device_type == "android":
            adb = find_tool("adb")
            if adb == "adb":
                self._send_json({"success": False,
                    "error": "Tool 'adb' not found. Install platform-tools."})
                return
            if action == "status":
                self._handle_mdm_android_status(adb, serial)
            elif action == "remove" and identifier:
                self._handle_mdm_android_remove(adb, serial, identifier)
            else:
                self._send_json({"success": False, "error": f"Unknown action: {action}"})
            return

        self._send_json({"success": False, "error": f"Unsupported deviceType: {device_type}"})

    def _handle_mdm_ios_status(self, udid):
        entries = []
        meta = {}
        proc, err = _run_tool(self._pm3_with_udid(["profile", "list"], udid), 40)
        if proc is None or proc.returncode != 0:
            out = ""
            if proc is not None:
                out = ((proc.stdout or "") + (proc.stderr or ""))[:400]
            self._send_json({"success": False,
                "error": (out or err or "Could not list iOS profiles")[:400]})
            return
        try:
            data = json.loads(proc.stdout or "{}")
            meta = data.get("ProfileMetadata") or {}
        except Exception:
            meta = {}
        for ident, m in meta.items():
            if not _is_mdm_identifier(ident, _MDM_PROFILE_HINTS):
                continue
            if isinstance(m, dict):
                name = m.get("ShortenedProfileName") or m.get("ProfileName") or ident
            else:
                name = ident
            entries.append({"identifier": ident, "name": name, "kind": "mdm-profile"})
        if entries:
            message = (f"Found {len(entries)} Remote Management profile(s). "
                       "Supervised devices may require the MDM removal passcode.")
        else:
            message = "No Remote Management (MDM) profiles detected."
        self._send_json({"success": True, "platform": "apple", "enrolled": bool(entries),
                         "entries": entries, "message": message})

    def _handle_mdm_ios_remove(self, udid, identifier):
        proc, err = _run_tool(self._pm3_with_udid(["profile", "remove", identifier], udid), 60)
        full_out = ""
        if proc is not None:
            full_out = (proc.stdout or "") + (proc.stderr or "")
        if proc is not None and proc.returncode == 0 and '"Status": "Error"' not in full_out:
            if "not installed" in full_out.lower():
                self._send_json({"success": True, "removed": False,
                    "message": f"No matching profile '{identifier}' is installed - nothing to remove."})
                return
            self._send_json({"success": True, "removed": True,
                "message": f"Removed Remote Management profile '{identifier}'."})
            return
        if "locked" in full_out.lower():
            self._send_json({"success": False, "removed": False,
                "error": "iPhone is locked. Unlock it, then retry."})
            return
        self._send_json({"success": False, "removed": False,
            "error": (full_out or err or "Profile removal failed")[:500]})

    def _handle_mdm_android_status(self, adb, serial):
        def sh(args, timeout=20):
            try:
                r = subprocess.run(
                    [adb, "-s", serial, "shell"] + args,
                    capture_output=True, text=True, encoding="utf-8", errors="replace",
                    timeout=timeout,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                )
                return r.returncode, (r.stdout or "") + (r.stderr or "")
            except subprocess.TimeoutExpired:
                return 1, "Timed out"
            except Exception as e:
                return 1, str(e)

        entries = []
        seen = set()

        rc, out = sh(["dpm", "list-owners"])
        for line in out.splitlines():
            if line.startswith("Package:"):
                pkg = line.split("Package:", 1)[1].strip()
                if pkg and pkg not in seen:
                    seen.add(pkg)
                    entries.append({"identifier": pkg, "name": pkg, "kind": "device-owner"})

        rc, out = sh(["dumpsys", "device_policy"])
        for m in re.finditer(r"admin=ComponentInfo\{([^}]+)\}", out):
            comp = m.group(1)
            pkg = comp.split("/", 1)[0]
            if pkg in seen:
                continue
            if _is_mdm_identifier(pkg, _MDM_PKG_HINTS):
                seen.add(pkg)
                entries.append({"identifier": comp, "name": comp, "kind": "active-admin"})

        rc, out = sh(["pm", "list", "packages"])
        for p in re.findall(r"package:([\w.]+)", out):
            if p in seen:
                continue
            if _is_mdm_identifier(p, _MDM_PKG_HINTS):
                seen.add(p)
                entries.append({"identifier": p, "name": p, "kind": "mdm-app"})

        if entries:
            message = (f"Found {len(entries)} Remote Management entr"
                       f"y/entries detected on this Android device.")
        else:
            message = "No Remote Management (MDM) enrollment detected."
        self._send_json({"success": True, "platform": "android", "enrolled": bool(entries),
                         "entries": entries, "message": message})

    def _handle_mdm_android_remove(self, adb, serial, identifier):
        pkg = identifier.split("/", 1)[0]

        def sh(args, timeout=25):
            try:
                r = subprocess.run(
                    [adb, "-s", serial, "shell"] + args,
                    capture_output=True, text=True, encoding="utf-8", errors="replace",
                    timeout=timeout,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                )
                return r.returncode, (r.stdout or "") + (r.stderr or "")
            except subprocess.TimeoutExpired:
                return 1, "Timed out"
            except Exception as e:
                return 1, str(e)

        rc, out = sh(["dpm", "remove-active-admin", "-n", identifier])
        low = out.lower()
        if rc == 0 and ("error" not in low) and ("cannot" not in low) and ("not permitted" not in low):
            self._send_json({"success": True, "removed": True,
                "message": f"Removed active admin '{identifier}'.", "output": out[:300]})
            return

        rc2, out2 = sh(["pm", "disable-user", "--user", "0", pkg])
        low2 = out2.lower()
        if rc2 == 0 and "error" not in low2 and "cannot" not in low2:
            self._send_json({"success": True, "removed": True,
                "message": f"Active admin could not be removed, but the MDM app '{pkg}' "
                           "was disabled for user 0 - it can no longer enforce policies.",
                "output": out2[:300]})
            return

        detail = (out or out2 or "").strip()[:400]
        self._send_json({"success": False, "removed": False,
            "error": (f"Could not remove '{identifier}'. "
                      f"Device owners typically require a factory reset or the MDM administrator. "
                      + (detail if detail else ""))[:600]})

    def _handle_update(self):
        """Pull the latest changes from GitHub and refresh the app.

        Runs: git fetch + pull in the repository that contains this server, then
        (if frontend sources changed) rebuilds and redeploys the GUI bundle. If
        server.py itself changed, the server restarts itself a moment later.
        """
        repo = APP_DIR.parent

        def sh(cmd, cwd, timeout=120):
            try:
                r = subprocess.run(
                    cmd, cwd=cwd, capture_output=True, text=True,
                    encoding="utf-8", errors="replace", timeout=timeout,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                )
                return r.returncode, (r.stdout or "") + (r.stderr or "")
            except subprocess.TimeoutExpired:
                return -1, "Timed out"
            except Exception as e:
                return -1, str(e)

        steps = []
        def step(label, cmd, cwd, timeout=120):
            rc, out = sh(cmd, cwd, timeout)
            ok = rc == 0
            steps.append({"label": label, "ok": ok, "output": (out or "").strip()[:400]})
            return ok

        if shutil.which("git") is None:
            self._send_json({"success": False, "steps": [],
                "error": "git is not installed or not on PATH. Install git to use the update button."})
            return
        if not (repo / ".git").exists():
            self._send_json({"success": False, "steps": [],
                "error": f"No git repository found at {repo}. The update button needs the app "
                         "to be run from a cloned copy of the GitHub repo."})
            return

        if not step("Fetching latest changes from GitHub",
                    ["git", "fetch", "origin", "main"], repo, 120):
            last = steps[-1]
            self._send_json({"success": False, "steps": steps,
                "error": "Failed to fetch from GitHub: " + last["output"]})
            return

        rc, behind_out = sh(["git", "rev-list", "--count", "HEAD..origin/main"], repo, 30)
        rc, ahead_out = sh(["git", "rev-list", "--count", "origin/main..HEAD"], repo, 30)
        try:
            behind = int((behind_out or "0").strip().splitlines()[0])
        except (ValueError, IndexError):
            behind = 0
        try:
            ahead = int((ahead_out or "0").strip().splitlines()[0])
        except (ValueError, IndexError):
            ahead = 0

        old_head = ""
        rc, old_head = sh(["git", "rev-parse", "HEAD"], repo, 30)

        if behind == 0:
            self._send_json({"success": True, "steps": steps, "behind": 0, "ahead": ahead,
                "message": "Already up to date with GitHub."})
            return

        if not step("Pulling latest changes", ["git", "pull", "--ff-only", "origin", "main"], repo, 120):
            last = steps[-1]
            hint = (" - commit or stash your local changes first." if "Your local changes" in last["output"]
                    or "not possible" in last["output"] else "")
            self._send_json({"success": False, "steps": steps, "behind": behind, "ahead": ahead,
                "error": "Pull failed: " + last["output"] + hint})
            return

        rc, new_head = sh(["git", "rev-parse", "HEAD"], repo, 30)
        rc, changed = sh(["git", "diff", "--name-only", (old_head or "").strip(), (new_head or "").strip(),
                          "--", "gui/src", "gui/package.json", "gui/package-lock.json",
                          "gui/tailwind.config.js", "gui/vite.config.ts", "gui/index.html"],
                         repo, 30)
        server_changed = False
        rc, sv = sh(["git", "diff", "--name-only", (old_head or "").strip(), (new_head or "").strip(),
                     "--", "portable/server.py"], repo, 30)
        server_changed = bool((sv or "").strip())

        if changed.strip():
            pkg_changed = bool(sh(["git", "diff", "--name-only",
                                   (old_head or "").strip(), (new_head or "").strip(),
                                   "--", "gui/package.json", "gui/package-lock.json"],
                                  repo, 30)[1].strip())
            if pkg_changed:
                step("Installing frontend dependencies", ["npm", "install"], repo / "gui", 300)
            if step("Rebuilding interface", ["npm", "run", "build"], repo / "gui", 240):
                step("Deploying bundle to portable server",
                     [sys.executable, "-c",
                      "import shutil; shutil.copytree('gui/dist', 'portable/gui', dirs_exist_ok=True)"],
                     repo, 60)

        message = f"Updated to commit {new_head.strip()[:10] if new_head.strip() else '?'} ({behind} new commit(s) pulled)."
        if server_changed:
            message += " Server code changed - restarting now."

        if server_changed:
            log_path = APP_DIR / ".." / ".." / "tmp" / "techbench-server.log"
            def _restart():
                time.sleep(2.5)
                try:
                    if platform.system() == "Windows":
                        flags = 0x00000200 | 0x08000000
                        subprocess.Popen(
                            [sys.executable, str(APP_DIR / "server.py")],
                            cwd=str(APP_DIR), stdin=subprocess.DEVNULL,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            creationflags=flags, close_fds=True)
                    else:
                        subprocess.Popen(
                            [sys.executable, str(APP_DIR / "server.py")],
                            cwd=str(APP_DIR), stdin=subprocess.DEVNULL,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            start_new_session=True, close_fds=True)
                except Exception:
                    pass
                try:
                    os._exit(0)
                except Exception:
                    pass
            threading.Thread(target=_restart, daemon=True).start()

        self._send_json({"success": True, "steps": steps, "behind": behind, "ahead": ahead,
                         "message": message})

    def _get_adb_props(self, serial):
        """Get ADB device properties"""
        props = {}
        adb = find_tool("adb")
        try:
            for prop, key in [
                ("ro.product.model", "model"),
                ("ro.product.brand", "brand"),
                ("ro.product.manufacturer", "manufacturer"),
                ("ro.hardware", "hardware"),
                ("ro.build.version.release", "android_version"),
            ]:
                result = subprocess.run(
                    [adb, "-s", serial, "shell", "getprop", prop],
                    capture_output=True, text=True, timeout=3,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0
                )
                if result.returncode == 0:
                    props[key] = result.stdout.strip()
        except Exception:
            pass
        return props

    def _get_fastboot_props(self, serial):
        """Get Fastboot device properties"""
        props = {}
        fastboot = find_tool("fastboot")
        try:
            for var, key in [
                ("product", "product"),
                ("manufacturer", "manufacturer"),
                ("hardware", "hardware"),
            ]:
                result = subprocess.run(
                    [fastboot, "-s", serial, "getvar", var],
                    capture_output=True, text=True, timeout=3,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0
                )
                # Fastboot outputs to stderr
                output = result.stdout + result.stderr
                if result.returncode == 0 or "Finished" in output:
                    for line in output.split("\n"):
                        if f"{var}:" in line:
                            props[key] = line.split(":")[1].strip()
        except Exception:
            pass
        return props

    def log_message(self, format, *args):
        """Suppress log noise"""
        if "/api/" in str(args[0]) if args else False:
            super().log_message(format, *args)

    def _handle_tool_run(self):
        """Run a detected tool against the selected device and return its output."""
        try:
            payload = json.loads(self._read_body() or b"{}")
        except Exception:
            self._send_json({"success": False, "error": "Invalid request body", "output": "", "command": ""})
            return

        name = (payload.get("name") or "").strip()
        if not name:
            self._send_json({"success": False, "error": "No tool name provided", "output": "", "command": ""})
            return

        tool = next((t for cat in _TOOL_DEFS.values() for t in cat if t[0] == name), None)
        if not tool:
            self._send_json({"success": False, "error": f"Unknown tool: {name}", "output": "", "command": ""})
            return

        path = find_tool(name)
        if path == name:
            self._send_json({"success": False, "error": f"Tool not found: {name}", "output": "", "command": ""})
            return

        _, _, _, action, runnable = tool
        if not runnable:
            self._send_json({"success": False, "error": f"{name} is informational only", "output": "", "command": ""})
            return

        mode = (payload.get("mode") or "").lower()
        serial = (payload.get("serial") or "").strip() or None

        udid = None
        if mode in ("apple", "ios") or name.startswith("idevice"):
            udid = (payload.get("udid") or "").strip() or self._get_apple_udid()

        out_dir = _tool_output_dir()
        dest = out_dir / f"{name}-{int(time.time() * 1000)}.png" if action == "screenshot" else out_dir

        try:
            cmd = _TOOL_ACTIONS[action](path, udid, dest)
        except KeyError:
            self._send_json({"success": False, "error": f"No run action for tool: {name}", "output": "", "command": ""})
            return

        timeout = 300 if action in ("backup", "screenshot", "crash") else 60
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=timeout,
                encoding="utf-8", errors="replace",
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
            )
        except subprocess.TimeoutExpired:
            self._send_json({"success": False, "error": f"Timed out after {timeout}s", "output": "", "command": " ".join(cmd)})
            return
        except Exception as e:
            self._send_json({"success": False, "error": str(e), "output": "", "command": " ".join(cmd)})
            return

        out = ((result.stdout or "") + "\n" + (result.stderr or "")).strip()
        artifact = None
        if action == "screenshot" and dest.exists():
            artifact = f"data/tools/{dest.name}"

        self._send_json({
            "success": result.returncode == 0,
            "error": "" if result.returncode == 0 else "Tool exited with an error",
            "output": out,
            "command": " ".join(cmd),
            "artifact": artifact,
        })

    def _handle_partitions(self):
        """Return the connected device's partition table."""
        try:
            payload = json.loads(self._read_body() or b"{}")
        except Exception:
            self._send_json({"partitions": [], "error": "Invalid request body"})
            return

        serial = (payload.get("serial") or "").strip() or None
        mode = (payload.get("mode") or "").lower()
        device_type = (payload.get("deviceType") or "").lower()

        if device_type == "apple" or mode in ("apple", "ios"):
            self._send_json({
                "partitions": [],
                "error": ("iPhone/iPad volumes are not enumerable over USB without a jailbreak "
                          "or the Developer disk image; iOS uses APFS. Partition access requires "
                          "recovery/DFU mode tooling or a jailbroken device."),
            })
            return

        if mode in ("fastboot", "edl", "download", "preloader"):
            parts = _fastboot_partitions(serial or "")
            if parts:
                self._send_json({"partitions": parts, "error": ""})
                return
            self._send_json({
                "partitions": [],
                "error": "No partition info returned by fastboot. Ensure the device is in fastboot mode.",
            })
            return

        if mode in ("adb", "normal", "recovery") or device_type == "android":
            parts = _adb_partitions(serial or "")
            if parts:
                self._send_json({"partitions": parts, "error": ""})
                return
            self._send_json({
                "partitions": [],
                "error": "No partitions readable via ADB. Ensure USB debugging is enabled and authorized.",
            })
            return

        self._send_json({"partitions": [], "error": "Unsupported device mode for partition listing."})


def _disable_usb_selective_suspend():
    """Disable Windows USB selective suspend to keep devices connected"""
    if platform.system() != "Windows":
        return
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\USB' "
             "-Name 'DisableSelectiveSuspend' -Value 1 -Type DWord -Force"],
            capture_output=True, timeout=5,
            creationflags=0x08000000,
        )
    except Exception:
        pass
    # Also try per-hub power management via powercfg
    try:
        subprocess.run(
            ["powercfg", "-change", "-usbselectivesuspend-ac", "0"],
            capture_output=True, timeout=5,
            creationflags=0x08000000,
        )
    except Exception:
        pass


def _disable_device_power_management(device_id):
    """Disable power management for a specific USB device (prevents sleep disconnection)"""
    if platform.system() != "Windows":
        return
    try:
        # Set PnPDeviceControlRegistry to prevent the device from being suspended
        subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Get-PnpDevice -InstanceId '{0}' | "
             "ForEach-Object {{ "
             "$devId = $_.InstanceId -replace '\\\\','\\\\\\\\'; "
             "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\' + $_.InstanceId "
             "-Name 'AllowIdleIrpInD3' -Value 0 -Type DWord -Force "
             "}}".format(device_id.replace("\\", "\\\\"))],
            capture_output=True, timeout=5,
            creationflags=0x08000000,
        )
    except Exception:
        pass


def _partition_type(name):
    """Infer a partition type from its node name."""
    n = name.lower()
    if "boot" in n:
        return "boot"
    if "recovery" in n:
        return "recovery"
    if "system" in n:
        return "system"
    if "vendor" in n:
        return "vendor"
    if "userdata" in n or n == "data":
        return "userdata"
    if "cache" in n:
        return "cache"
    if "misc" in n:
        return "misc"
    if "efs" in n:
        return "misc"
    return "unknown"


def _parse_size(text):
    """Convert a size string like '16M', '4G', '512K' or hex (0x...) to bytes."""
    try:
        t = text.strip()
        if not t:
            return 0
        if t.lower().startswith("0x"):
            return int(t, 16)
        m = re.fullmatch(r"(\d+)\s*([KMGTP]?)", t.upper())
        if not m:
            return 0
        val = int(m.group(1))
        unit = m.group(2)
        return val * {"": 1, "K": 1024, "M": 1024 ** 2, "G": 1024 ** 3, "T": 1024 ** 4}[unit]
    except Exception:
        return 0


def _adb_partitions(serial):
    """Enumerate Android partitions over ADB via /proc/partitions + by-name map."""
    adb = find_tool("adb")
    name_map = {}
    for bydir in ("/dev/block/bootdevice/by-name", "/dev/block/by-name"):
        try:
            r = subprocess.run(
                [adb, "-s", serial, "shell", "ls", "-l", bydir],
                capture_output=True, text=True, timeout=10, encoding="utf-8", errors="replace",
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
            )
            if r.returncode == 0:
                for line in r.stdout.splitlines():
                    m = re.search(r"([\w.-]+)\s*->\s*[/\w./]*/(\w+)$", line)
                    if m:
                        name_map[m.group(2)] = m.group(1)
                if name_map:
                    break
        except Exception:
            pass

    try:
        r = subprocess.run(
            [adb, "-s", serial, "shell", "cat", "/proc/partitions"],
            capture_output=True, text=True, timeout=10, encoding="utf-8", errors="replace",
            creationflags=0x08000000 if platform.system() == "Windows" else 0,
        )
    except Exception:
        return []

    parts = []
    for line in r.stdout.splitlines():
        f = line.split()
        if len(f) != 4 or not f[2].isdigit():
            continue
        node = f[3]
        if node.startswith(("loop", "ram", "zram", "dm-")) or not re.search(r"[a-z]+\d+$", node):
            continue
        size = int(f[2]) * 1024
        name = name_map.get(node, node)
        parts.append({
            "id": node,
            "name": name,
            "size": size,
            "type": _partition_type(name),
            "status": "empty",
            "node": node,
        })
    parts.sort(key=lambda p: p["name"])
    return parts


def _fastboot_partitions(serial):
    """Enumerate partitions over fastboot via 'getvar all'."""
    fastboot = find_tool("fastboot")
    try:
        cmd = [fastboot, "-s", serial, "getvar", "all"] if serial else [fastboot, "getvar", "all"]
        r = subprocess.run(
            cmd, capture_output=True, text=True, timeout=15, encoding="utf-8", errors="replace",
            creationflags=0x08000000 if platform.system() == "Windows" else 0,
        )
    except Exception:
        return []
    parts = []
    for line in r.stdout.splitlines():
        m = re.search(r"partition-size:\s*([\w-]+):\s*(\S+)", line)
        if not m:
            continue
        name = m.group(1)
        parts.append({
            "id": name,
            "name": name,
            "size": _parse_size(m.group(2)),
            "type": _partition_type(name),
            "status": "empty",
            "node": name,
        })
    parts.sort(key=lambda p: p["name"])
    return parts


class DevicePoller:
    """Background thread that polls for devices and caches their state.

    Two-tier detection for Apple devices:
      Tier 1: USB PnP enumeration (always works when plugged in)
      Tier 2: libimobiledevice (needs usbmuxd + lockdown session)
    Cached UDID/model persist across brief disconnections and lock screen
    transitions so the device stays visible in the UI.
    """

    def __init__(self, poll_interval=2.0):
        self._interval = poll_interval
        self._lock = threading.Lock()
        self._stop_evt = threading.Event()
        # Cache keyed by UDID
        self._apple_cache = {}          # udid -> {productName, chipset, last_seen, boot_mode}
        self._devices = []              # last polled device list
        self._timestamp = 0.0
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    # ------------------------------------------------------------------
    def _run(self):
        while not self._stop_evt.is_set():
            try:
                self._poll()
            except Exception:
                pass
            self._stop_evt.wait(self._interval)

    def _poll(self):
        devices = []

        # --- ADB devices ---
        adb = find_tool("adb")
        try:
            r = subprocess.run(
                [adb, "devices", "-l"], capture_output=True, text=True, timeout=5,
                encoding="utf-8", errors="replace",
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
            )
            if r.returncode == 0:
                for line in r.stdout.strip().split("\n")[1:]:
                    if line and "\t" in line:
                        serial = line.split()[0]
                        state = line.split()[1]
                        props = self._get_adb_props(serial)
                        devices.append({
                            "id": serial,
                            "serial": serial,
                            "state": state,
                            "mode": "adb",
                            "productName": props.get("model", "Unknown"),
                            "vendorName": props.get("brand", "Unknown"),
                            "deviceType": "android",
                            "androidVersion": props.get("android_version", ""),
                            "chipset": props.get("hardware", ""),
                            "bootMode": "normal",
                        })
        except (FileNotFoundError, Exception):
            pass

        # --- Fastboot devices ---
        fastboot = find_tool("fastboot")
        try:
            r = subprocess.run(
                [fastboot, "devices"], capture_output=True, text=True, timeout=5,
                encoding="utf-8", errors="replace",
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
            )
            if r.returncode == 0:
                for line in r.stdout.strip().split("\n"):
                    if line and "\t" in line:
                        serial = line.split()[0]
                        devices.append({
                            "id": f"fastboot-{serial}",
                            "serial": serial,
                            "state": "fastboot",
                            "mode": "fastboot",
                            "productName": "Fastboot Device",
                            "vendorName": "Unknown",
                            "deviceType": "android",
                            "chipset": "",
                            "bootMode": "fastboot",
                        })
        except (FileNotFoundError, Exception):
            pass

        # --- Apple devices (two-tier) ---
        devices.extend(self._poll_apple())

        # --- USB special modes (EDL, preloader, download, etc.) ---
        devices.extend(self._poll_usb_special())

        with self._lock:
            self._devices = devices
            self._timestamp = time.time()

    # ------------------------------------------------------------------
    def _poll_apple(self):
        """Two-tier Apple detection with caching"""
        results = []

        # Tier 1: USB PnP — always works when plugged in
        usb_entries = self._get_usb_apple_entries()
        if not usb_entries:
            # Truly unplugged — clear cache entries for devices no longer on USB
            with self._lock:
                stale = [udid for udid, info in self._apple_cache.items()
                         if time.time() - info["last_seen"] > 30]
                for udid in stale:
                    del self._apple_cache[udid]
            return results

        # Determine product_id and serial from USB
        serial_from_usb = None
        product_id = "0000"
        for entry in usb_entries:
            did = entry.get("id", "")
            upper = did.upper()
            if "PID_" in upper:
                product_id = did.split("PID_")[1][:4].upper()
            elif "05AC:" in upper:
                # Linux lsusb format: "Bus 003 Device 016: ID 05ac:12a8 Apple ..."
                m = re.search(r"ID\s+05ac:([0-9a-fA-F]{4})", did)
                if m:
                    product_id = m.group(1).upper()
            if "MI_" not in did and "ROOT_HUB" not in did and "\\" in did:
                parts = did.split("\\")
                if len(parts) >= 3 and parts[2]:
                    serial_from_usb = parts[2]

        # Boot mode from PID
        if product_id == "1227":
            boot_mode = "dfu"
        elif product_id in ("1281", "1282", "12A9", "12AA", "12AB", "12AC"):
            boot_mode = "recovery"
        else:
            boot_mode = "normal"

        # Tier 2: libimobiledevice — may fail when locked/untrusted
        idevice_id = find_tool("idevice_id")
        udid = None
        try:
            r = subprocess.run(
                [idevice_id, "-l"], capture_output=True, text=True, timeout=3,
                encoding="utf-8", errors="replace",
                creationflags=0x08000000 if platform.system() == "Windows" else 0,
            )
            if r.returncode == 0 and r.stdout.strip():
                udid = r.stdout.strip().split("\n")[0]
        except Exception:
            pass

        # Try ideviceinfo for model (only when lockdown session is active)
        model = None
        if udid:
            ideviceinfo = find_tool("ideviceinfo")
            try:
                r = subprocess.run(
                    [ideviceinfo, "-u", udid, "-k", "ProductType"],
                    capture_output=True, text=True, timeout=3,
                    encoding="utf-8", errors="replace",
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                )
                if r.returncode == 0 and r.stdout.strip():
                    model = r.stdout.strip()
            except Exception:
                pass

        # Use UDID or USB serial as key
        cache_key = udid or serial_from_usb or f"usb-{product_id}"

        with self._lock:
            cached = self._apple_cache.get(cache_key, {})
            if udid and model:
                # Fresh info — update cache
                cached["udid"] = udid
                cached["chipset"] = model
                cached["productName"] = _APPLE_MODEL_NAMES.get(model, model)
                cached["serial"] = udid
            elif udid and not model:
                # UDID known but ideviceinfo failed (locked screen) — keep cached model
                cached["udid"] = udid
                cached["serial"] = udid
            elif not udid and serial_from_usb:
                # Only USB-level — use whatever we have cached, or generic
                if not cached:
                    cached["udid"] = None
                    cached["serial"] = serial_from_usb
                    cached["chipset"] = "Apple"
                    cached["productName"] = "Apple Device"
            cached["last_seen"] = time.time()
            cached["boot_mode"] = boot_mode
            cached["product_id"] = product_id
            self._apple_cache[cache_key] = cached

        # Build device entry from cache
        results.append({
            "id": cached.get("udid") or cached.get("serial") or cache_key,
            "serial": cached.get("udid") or cached.get("serial"),
            "state": "connected",
            "mode": "apple",
            "vendorId": "05AC",
            "productId": product_id,
            "vendorName": "Apple",
            "productName": cached.get("productName", "Apple Device"),
            "deviceType": "apple",
            "androidVersion": "",
            "chipset": cached.get("chipset", "Apple"),
            "bootMode": boot_mode,
        })

        # Try to disable power management for this USB device so it stays connected
        if serial_from_usb:
            _disable_device_power_management(
                f"USB\\VID_05AC&PID_{product_id}\\{serial_from_usb}"
            )

        return results

    # ------------------------------------------------------------------
    def _poll_usb_special(self):
        """Detect mobile devices in special boot modes (EDL, preloader, download, etc.)
        using the USB VID/PID database."""
        results = []
        usb_entries = self._get_all_usb_entries()
        if not usb_entries:
            return results

        # Collect VID:PIDs already detected by ADB/fastboot/Apple
        seen = set()
        for dev in (getattr(self, '_devices', []) or []):
            vid = dev.get("vendorId", "")
            pid = dev.get("productId", "")
            if vid and pid:
                seen.add((vid.upper(), pid.upper()))

        for entry in usb_entries:
            did = entry.get("id", "")
            if "ROOT_HUB" in did.upper():
                continue

            upper = did.upper()
            vid = pid = None
            if "VID_" in upper:
                try:
                    vid = upper[upper.index("VID_") + 4: upper.index("VID_") + 8]
                except (ValueError, IndexError):
                    pass
            if "PID_" in upper:
                try:
                    pid = upper[upper.index("PID_") + 4: upper.index("PID_") + 8]
                except (ValueError, IndexError):
                    pass
            if not vid or not pid:
                continue

            # Skip if already detected by ADB/fastboot/Apple
            if (vid, pid) in seen:
                continue

            mode_info = USB_MODE_DB.get((vid, pid))
            if not mode_info:
                # Fallback: PnP name hints at Android/adb/fastboot and VID is a
                # known mobile chipset/vendor -> treat as a fastboot-mode device
                name = (entry.get("name") or "").lower()
                if vid in _MOBILE_SOC_VENDORS and any(
                    k in name for k in ("android", "adb", "fastboot")
                ):
                    mode_info = {
                        "mode": "fastboot",
                        "brand": USB_VID_BRAND.get(vid, "Unknown"),
                        "deviceType": "android",
                        "label": f"{USB_VID_BRAND.get(vid, 'Unknown')} Fastboot Device",
                    }
                else:
                    continue

            serial = None
            parts = did.split("\\")
            if len(parts) >= 3 and parts[2]:
                serial = parts[2]

            brand = mode_info.get("brand", USB_VID_BRAND.get(vid, "Unknown"))
            mode = mode_info.get("mode", "normal")
            device_type = mode_info.get("deviceType", "generic")
            label = mode_info.get("label", f"{brand} Device")

            results.append({
                "id": f"{device_type}-{vid}:{pid}-{serial or label}",
                "serial": serial,
                "state": "connected",
                "mode": mode,
                "vendorId": vid,
                "productId": pid,
                "vendorName": brand,
                "productName": label,
                "deviceType": device_type,
                "androidVersion": "",
                "chipset": "",
                "bootMode": mode,
            })

        return results

    # ------------------------------------------------------------------
    def _get_all_usb_entries(self):
        """Get all USB PnP entries (Name + DeviceID)"""
        try:
            r = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "Get-CimInstance Win32_PnPEntity | "
                 "Where-Object { $_.DeviceID -like 'USB\\*' } | "
                 "Select-Object Name, DeviceID | ConvertTo-Json -Compress"],
                capture_output=True, text=True, timeout=5,
                encoding="utf-8", errors="replace",
                creationflags=0x08000000,
            )
            if r.returncode != 0 or not r.stdout.strip():
                return []
            data = json.loads(r.stdout)
            if isinstance(data, dict):
                data = [data]
            return [{"name": d.get("Name", ""), "id": d.get("DeviceID", "")} for d in data]
        except Exception:
            return []

    # ------------------------------------------------------------------
    def _get_usb_apple_entries(self):
        """Return raw USB PnP entries for Apple (VID_05AC)"""
        try:
            if platform.system() == "Linux":
                r = subprocess.run(
                    ["lsusb", "-d", "05ac:"], capture_output=True, text=True, timeout=5
                )
                entries = []
                for line in r.stdout.strip().split("\n"):
                    if line:
                        entries.append({"name": line, "id": line})
                return entries
            r = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "Get-CimInstance Win32_PnPEntity | "
                 "Where-Object { $_.DeviceID -like 'USB\\*' -and "
                 "($_.DeviceID -like '*VID_05AC*' -or $_.Manufacturer -like '*Apple*') } | "
                 "Select-Object Name, DeviceID | ConvertTo-Json -Compress"],
                capture_output=True, text=True, timeout=5,
                creationflags=0x08000000,
            )
            if r.returncode == 0 and r.stdout.strip():
                data = json.loads(r.stdout)
                if isinstance(data, dict):
                    data = [data]
                return [{"name": d.get("Name", ""), "id": d.get("DeviceID", "")} for d in data]
        except Exception:
            pass
        return []

    def _get_adb_props(self, serial):
        props = {}
        adb = find_tool("adb")
        try:
            for prop, key in [
                ("ro.product.model", "model"),
                ("ro.product.brand", "brand"),
                ("ro.hardware", "hardware"),
                ("ro.build.version.release", "android_version"),
            ]:
                r = subprocess.run(
                    [adb, "-s", serial, "shell", "getprop", prop],
                    capture_output=True, text=True, timeout=3,
                    creationflags=0x08000000 if platform.system() == "Windows" else 0,
                )
                if r.returncode == 0:
                    props[key] = r.stdout.strip()
        except Exception:
            pass
        return props

    # ------------------------------------------------------------------
    def get_devices(self):
        """Return cached device list (instant, no blocking)"""
        with self._lock:
            return list(self._devices)

    def stop(self):
        self._stop_evt.set()


# Device model name map (shared by poller and handler)
_APPLE_MODEL_NAMES = {
    "iPhone17,2": "iPhone 16 Pro Max",
    "iPhone17,1": "iPhone 16 Pro",
    "iPhone17,3": "iPhone 16",
    "iPhone17,4": "iPhone 16 Plus",
    "iPhone16,1": "iPhone 15 Pro",
    "iPhone16,2": "iPhone 15 Pro Max",
    "iPhone15,2": "iPhone 14 Pro",
    "iPhone15,3": "iPhone 14 Pro Max",
    "iPhone15,4": "iPhone 13 Pro",
    "iPhone15,5": "iPhone 13 Pro Max",
    "iPhone14,8": "iPhone 12 Pro Max",
    "iPhone13,4": "iPhone 12 Pro",
    "iPhone13,3": "iPhone 12",
    "iPhone14,4": "iPhone 13 mini",
    "iPhone14,5": "iPhone 13",
}

# USB Vendor ID -> brand name (for any PID)
USB_VID_BRAND = {
    "04E8": "Samsung", "05AC": "Apple", "05C6": "Qualcomm", "0BB4": "HTC",
    "0FCE": "Sony", "043E": "LG", "0421": "Nokia", "0E8D": "MediaTek",
    "12D1": "Huawei", "18D1": "Google", "1F3A": "Huawei", "19D2": "ZTE",
    "2001": "Huawei",     "22B8": "Motorola", "22D9": "OPPO", "2717": "Xiaomi",
    "2A70": "OnePlus", "2C3E": "Tecno", "2D95": "Vivo", "0483": "STMicro",
    "17EF": "Lenovo",
    "0BB4": "HTC", "1004": "LG", "10A6": "ASUS", "0525": "NXP",
    "040D": "HTC", "0B05": "ASUS", "04DA": "Panasonic", "04F2": "Chicony",
}

# VIDs of mobile chipsets/vendors eligible for the Android-name fallback
_MOBILE_SOC_VENDORS = {
    "05C6", "0E8D", "18D1", "04E8", "12D1", "1F3A", "19D2", "2001",
    "22B8", "22D9", "2717", "2A70", "2C3E", "2D95", "17EF", "0BB4",
    "0FCE", "043E", "0421", "10A6", "0B05",
}

# (VID, PID) -> special boot mode info
USB_MODE_DB = {
    # Qualcomm
    ("05C6", "9008"): {"mode": "edl", "brand": "Qualcomm", "deviceType": "qualcomm", "label": "Emergency Download (EDL)"},
    ("05C6", "9006"): {"mode": "edl", "brand": "Qualcomm", "deviceType": "qualcomm", "label": "Qualcomm Mass Storage"},
    ("05C6", "900E"): {"mode": "diag", "brand": "Qualcomm", "deviceType": "qualcomm", "label": "Qualcomm Diagnostics"},
    ("05C6", "9001"): {"mode": "fastboot", "brand": "Qualcomm", "deviceType": "qualcomm", "label": "Qualcomm Fastboot"},
    ("05C6", "9004"): {"mode": "serial", "brand": "Qualcomm", "deviceType": "qualcomm", "label": "Qualcomm Serial"},
    ("05C6", "9015"): {"mode": "edl", "brand": "Qualcomm", "deviceType": "qualcomm", "label": "Qualcomm EDL"},
    # MediaTek
    ("0E8D", "0003"): {"mode": "preloader", "brand": "MediaTek", "deviceType": "mediatek", "label": "MediaTek Preloader"},
    ("0E8D", "0004"): {"mode": "meta", "brand": "MediaTek", "deviceType": "mediatek", "label": "MediaTek META"},
    ("0E8D", "2000"): {"mode": "meta", "brand": "MediaTek", "deviceType": "mediatek", "label": "MediaTek USB VCOM"},
    ("0E8D", "2001"): {"mode": "preloader", "brand": "MediaTek", "deviceType": "mediatek", "label": "MediaTek Preloader USB"},
    ("0E8D", "0023"): {"mode": "download", "brand": "MediaTek", "deviceType": "mediatek", "label": "MediaTek DA"},
    ("0E8D", "003A"): {"mode": "meta", "brand": "MediaTek", "deviceType": "mediatek", "label": "MediaTek META USB"},
    ("0E8D", "0050"): {"mode": "preloader", "brand": "MediaTek", "deviceType": "mediatek", "label": "MediaTek Preloader USB VCOM"},
    ("0E8D", "00AB"): {"mode": "preloader", "brand": "MediaTek", "deviceType": "mediatek", "label": "MediaTek Preloader USB"},
    ("0E8D", "201C"): {"mode": "fastboot", "brand": "MediaTek", "deviceType": "mediatek", "label": "MediaTek Fastboot (Lenovo Tab)"},
    ("0E8D", "2004"): {"mode": "fastboot", "brand": "MediaTek", "deviceType": "mediatek", "label": "MediaTek Fastboot"},
    ("0E8D", "2005"): {"mode": "fastboot", "brand": "MediaTek", "deviceType": "mediatek", "label": "MediaTek Fastboot"},
    # Samsung
    ("04E8", "6860"): {"mode": "download", "brand": "Samsung", "deviceType": "samsung", "label": "Samsung Download Mode"},
    ("04E8", "6877"): {"mode": "download", "brand": "Samsung", "deviceType": "samsung", "label": "Samsung Download Mode"},
    ("04E8", "6866"): {"mode": "uart", "brand": "Samsung", "deviceType": "samsung", "label": "Samsung UART"},
    ("04E8", "6863"): {"mode": "modem", "brand": "Samsung", "deviceType": "samsung", "label": "Samsung Modem"},
    ("04E8", "6864"): {"mode": "modem", "brand": "Samsung", "deviceType": "samsung", "label": "Samsung Modem"},
    # Huawei
    ("12D1", "0001"): {"mode": "fastboot", "brand": "Huawei", "deviceType": "huawei", "label": "Huawei Fastboot"},
    ("12D1", "1001"): {"mode": "fastboot", "brand": "Huawei", "deviceType": "huawei", "label": "Huawei Fastboot"},
    ("12D1", "1010"): {"mode": "download", "brand": "Huawei", "deviceType": "huawei", "label": "Huawei Download"},
    ("12D1", "1020"): {"mode": "fastboot", "brand": "Huawei", "deviceType": "huawei", "label": "Huawei Fastboot"},
    ("12D1", "1021"): {"mode": "download", "brand": "Huawei", "deviceType": "huawei", "label": "Huawei Download"},
    ("12D1", "0006"): {"mode": "serial", "brand": "Huawei", "deviceType": "huawei", "label": "Huawei Serial"},
    # Google (Nexus/Pixel)
    ("18D1", "4EE1"): {"mode": "fastboot", "brand": "Google", "deviceType": "android", "label": "Google Fastboot"},
    ("18D1", "4EE2"): {"mode": "fastboot", "brand": "Google", "deviceType": "android", "label": "Google Fastboot"},
    ("18D1", "4EE3"): {"mode": "fastboot", "brand": "Google", "deviceType": "android", "label": "Google Fastboot"},
    ("18D1", "4EE4"): {"mode": "fastboot", "brand": "Google", "deviceType": "android", "label": "Google Fastboot"},
    ("18D1", "4EE5"): {"mode": "fastboot", "brand": "Google", "deviceType": "android", "label": "Google Fastboot"},
    ("18D1", "4EE6"): {"mode": "serial", "brand": "Google", "deviceType": "android", "label": "Google Serial"},
    ("18D1", "4EE7"): {"mode": "serial", "brand": "Google", "deviceType": "android", "label": "Google Serial"},
    # Xiaomi
    ("2717", "0001"): {"mode": "fastboot", "brand": "Xiaomi", "deviceType": "xiaomi", "label": "Xiaomi Fastboot"},
    ("2717", "FFC0"): {"mode": "edl", "brand": "Xiaomi", "deviceType": "xiaomi", "label": "Xiaomi EDL"},
    # OPPO
    ("22D9", "0001"): {"mode": "download", "brand": "OPPO", "deviceType": "oppo", "label": "OPPO Download"},
    ("22D9", "0003"): {"mode": "download", "brand": "OPPO", "deviceType": "oppo", "label": "OPPO Download"},
    # Vivo
    ("2D95", "0001"): {"mode": "download", "brand": "Vivo", "deviceType": "vivo", "label": "Vivo Download"},
    ("2D95", "0003"): {"mode": "download", "brand": "Vivo", "deviceType": "vivo", "label": "Vivo Download"},
    # ZTE
    ("19D2", "0001"): {"mode": "download", "brand": "ZTE", "deviceType": "zte", "label": "ZTE Download"},
    # Motorola
    ("22B8", "2E66"): {"mode": "fastboot", "brand": "Motorola", "deviceType": "motorola", "label": "Motorola Fastboot"},
    ("22B8", "2E23"): {"mode": "fastboot", "brand": "Motorola", "deviceType": "motorola", "label": "Motorola Fastboot"},
    # Sony
    ("0FCE", "5171"): {"mode": "flash", "brand": "Sony", "deviceType": "generic", "label": "Sony Flash Mode"},
    ("0FCE", "0D5D"): {"mode": "flash", "brand": "Sony", "deviceType": "generic", "label": "Sony Flash Mode"},
    # Nokia
    ("0421", "0473"): {"mode": "download", "brand": "Nokia", "deviceType": "generic", "label": "Nokia Download"},
    ("0421", "063A"): {"mode": "download", "brand": "Nokia", "deviceType": "generic", "label": "Nokia Download"},
    # LG
    ("043E", "3004"): {"mode": "download", "brand": "LG", "deviceType": "generic", "label": "LG Download"},
    ("043E", "3005"): {"mode": "download", "brand": "LG", "deviceType": "generic", "label": "LG Download"},
    # OnePlus
    ("2A70", "9091"): {"mode": "fastboot", "brand": "OnePlus", "deviceType": "android", "label": "OnePlus Fastboot"},
    # Tecno/Infinix
    ("2C3E", "0001"): {"mode": "download", "brand": "Tecno", "deviceType": "tecno", "label": "Tecno Download"},
}

# Global poller instance (set in main)
_poller = None


def main():
    global _poller

    print()
    print("  ====================================")
    print("   TechBench - Electronics & Mobile Repair")
    print("  ====================================")
    print()
    print(f"  Platform: {platform.system()} {platform.machine()}")
    print(f"  Python:   {platform.python_version()}")
    print(f"  Port:     {PORT}")
    print()
    print(f"  Open in browser: http://localhost:{PORT}")
    print("  Press Ctrl+C to stop")
    print()

    # Disable USB selective suspend so devices stay connected
    if platform.system() == "Windows":
        _disable_usb_selective_suspend()

    # Start background device poller
    _poller = DevicePoller(poll_interval=2.0)

    # Auto-open browser
    Timer(1.5, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()

    try:
        server = ThreadingHTTPServer(("0.0.0.0", PORT), TechBenchHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
        if _poller:
            _poller.stop()
        server.server_close()


if __name__ == "__main__":
    main()
