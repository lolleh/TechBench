#!/usr/bin/env python3
"""
TechBench Portable Server
Serves the web GUI and provides backend API for Windows.
Run this on any machine with Python 3.10+.
"""

import os
import sys
import json
import time
import platform
import subprocess
import tempfile
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Timer

PORT = 1420
APP_DIR = Path(__file__).parent
FRONTEND_DIR = APP_DIR / "gui"
AI_DIR = APP_DIR / "python" / "ai"
DB_DIR = APP_DIR / "data" / "databases"

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
                    ["powershell", "-Command",
                     "Get-CimInstance Win32_USBControllerDevice | "
                     "ForEach-Object { [wmi]($_.Dependent) } | "
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

    def log_message(self, format, *args):
        """Suppress log noise"""
        if "/api/" in str(args[0]) if args else False:
            super().log_message(format, *args)


def open_browser():
    """Open browser after short delay"""
    time.sleep(1.5)
    webbrowser.open(f"http://localhost:{PORT}")


def main():
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

    # Auto-open browser
    Timer(1.5, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()

    try:
        server = HTTPServer(("0.0.0.0", PORT), TechBenchHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
