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
DB_DIR = APP_DIR / "data" / "databases"

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

def _strip_ansi(s):
    """Remove ANSI color/control escape sequences from tool output"""
    if not s:
        return s
    return re.sub(r"\x1b\[[0-9;]*m", "", s)

# Ensure directories exist
DB_DIR.mkdir(parents=True, exist_ok=True)
(APP_DIR / "data" / "projects").mkdir(parents=True, exist_ok=True)
(APP_DIR / "data" / "firmware").mkdir(parents=True, exist_ok=True)
(APP_DIR / "data" / "workspaces").mkdir(parents=True, exist_ok=True)
(APP_DIR / "data" / "logs").mkdir(parents=True, exist_ok=True)


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
            result = subprocess.run(
                [installer, "-u", udid, "-l", "-o", "list_all", "-o", "xml"],
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
            result = subprocess.run(
                [installer, "-u", udid, "-U", package],
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

        uploads = APP_DIR / "data" / "uploads"
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

            flag = "-g" if upgrade else "-i"
            result = subprocess.run(
                [installer, "-u", udid, flag, str(ipa)],
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
                        cwd=str(APP_DIR / "data"),
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
            else:
                self._send_json({
                    "success": False, "output": "",
                    "error": f"Unsupported tool '{tool}' (expected 'adb' or 'fastboot')",
                })
        except Exception as e:
            self._send_json({"success": False, "output": "", "error": f"Server error: {e}"})

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
        base = APP_DIR / "data" / "backups" / serial / time.strftime("%Y-%m-%d_%H%M%S")
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

        base = APP_DIR / "data" / "backups" / udid / time.strftime("%Y-%m-%d_%H%M%S")
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
        base = APP_DIR / "data" / "recovered" / serial / time.strftime("%Y-%m-%d_%H%M%S")
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

        base = APP_DIR / "data" / "recovered" / udid / time.strftime("%Y-%m-%d_%H%M%S")
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
            if "PID_" in did.upper():
                product_id = did.split("PID_")[1][:4].upper()
            if "MI_" not in did and "ROOT_HUB" not in did:
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
