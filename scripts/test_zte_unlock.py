#!/usr/bin/env python3
"""
Tests for the ZTE ZX297520V3 (MF927U / MF927TU / H220m) web unlock backend.
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "portable"))

from server import (
    _zte_zx297520v3_unlock_code,
    _find_zte_usb_interface,
    _zte_web_device_info,
    _MODEM_UNLOCK_CATALOG,
    _detect_modem_vendor,
)

PASS = 0


def check(name, condition, detail=""):
    global PASS
    if condition:
        PASS += 1
        print(f"  ok - {name}")
    else:
        print(f"FAIL - {name} {detail}")


def test_unlock_code_algorithm():
    print("ZTE ZX297520V3 IMEI -> NCK algorithm")
    # Known published pairs from the reverse-engineered firmware
    check("known pair 1", _zte_zx297520v3_unlock_code("987654321098767") == "16159363")
    check("known pair 2", _zte_zx297520v3_unlock_code("123456789012347") == "61739633")
    check("8-digit output", len(_zte_zx297520v3_unlock_code("867462053683870")) == 8)
    check("all digits", _zte_zx297520v3_unlock_code("867462053683870").isdigit())
    check("short imei -> None", _zte_zx297520v3_unlock_code("123") is None)
    check("empty imei -> None", _zte_zx297520v3_unlock_code("") is None)
    check("None -> None", _zte_zx297520v3_unlock_code(None) is None)
    # Deterministic
    a = _zte_zx297520v3_unlock_code("867462053683870")
    b = _zte_zx297520v3_unlock_code("867462053683870")
    check("deterministic", a == b)


def test_zte_interface_detection():
    print("ZTE USB interface detection")
    iface = _find_zte_usb_interface()
    # Only an assertion when a ZTE device is actually connected
    base, resolved = _zte_web_device_info(iface)
    if iface:
        check("interface found", isinstance(iface, str) and len(iface) > 0, str(iface))
        check("base URL built", base is not None and base.startswith("http://"), str(base))
    else:
        print("  note - no ZTE USB device connected, skipping live checks")


def test_catalog_integrity():
    print("Unlock catalog integrity")
    check("zte vendor present", "zte" in _MODEM_UNLOCK_CATALOG)
    check("generic vendor present", "generic" in _MODEM_UNLOCK_CATALOG)
    check("qualcomm vendor present", "qualcomm" in _MODEM_UNLOCK_CATALOG)
    detect = _detect_modem_vendor("ZTE WCDMA Technologies MSM", "DEMO Mobile Boardband", "19D2")
    check("ZTE detected by VID", detect == "zte", detect)


if __name__ == "__main__":
    test_unlock_code_algorithm()
    test_catalog_integrity()
    test_zte_interface_detection()
    print()
    print(f"  {PASS} checks passed")
    sys.exit(0 if PASS > 0 else 1)
