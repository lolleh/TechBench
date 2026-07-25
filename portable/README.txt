TechBench - Portable Version
===============================

Electronics Engineering & Mobile Device Servicing Platform

REQUIREMENTS:
  - Python 3.10+ (https://python.org/downloads/)
    During installation, CHECK "Add Python to PATH"

QUICK START:
  1. Extract this ZIP to a folder (e.g. USB pendrive)
  2. Double-click "TechBench.bat"
  3. Browser opens automatically at http://localhost:1420

MANUAL START:
  cd portable
  python server.py

OPTIONAL DEPENDENCIES (for USB device access):
  pip install pyserial pyusb pillow onnxruntime

  For Windows USB devices, install WinUSB drivers via Zadig:
    https://zadig.akeo.ie/

FILES:
  TechBench.bat     - Windows launcher (double-click to start)
  server.py           - Python backend server
  gui/                - Web interface (HTML/CSS/JS)
  python/ai/          - AI diagnostic engine
  python/detection/   - USB device detection
  data/               - User data (projects, databases, logs)

SUPPORTED DEVICES:
  - Android (ADB, Fastboot, Qualcomm EDL, MediaTek Preloader)
  - Apple (DFU, Recovery)
  - Samsung (Download/Odin mode)
  - USB-UART adapters (FTDI, CP210x, CH340)
  - JTAG/SWD probes (ST-Link, J-Link, FTDI)
  - Logic analyzers (Sigrok-compatible)
  - Multimeters, oscilloscopes
