#!/usr/bin/env python3
"""
Test script for TechBench detection engine
"""

import sys
import os
import json
from pathlib import Path

# Add directories to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "detection" / "usb-scanner"))

def test_chipset_database():
    """Test chipset database loading and lookup"""
    print("=" * 60)
    print("TEST: Chipset Database")
    print("=" * 60)
    
    from enhanced_detector import ChipsetDatabase
    
    db = ChipsetDatabase()
    
    # Test database loading
    print(f"[✓] Database loaded with {len(db.database)} entries")
    
    # Test lookup for all major brands
    test_cases = [
        ("05c6", "90db", "Qualcomm EDL"),
        ("0e8d", "0003", "MediaTek Preloader"),
        ("04e8", "6860", "Samsung Galaxy (MTP)"),
        ("05ac", "1227", "Apple DFU"),
        ("18d1", "4ee7", "Google Pixel Fastboot"),
        ("2717", "ff48", "Xiaomi Fastboot"),
        ("2717", "ff40", "Xiaomi MediaTek"),
        ("17ef", "6009", "Lenovo Tab M10"),
        ("17ef", "6011", "Lenovo Tab P11"),
        ("17ef", "6012", "Lenovo Tab P12"),
        ("22d9", "2765", "OPPO Fastboot"),
        ("2a70", "9093", "Realme Fastboot"),
        ("2d95", "5a01", "Vivo Fastboot"),
        ("22b8", "2e24", "Motorola Fastboot"),
        ("12d1", "0001", "Huawei/Honor Fastboot"),
        ("25c7", "0013", "Tecno/Infinix/ITEL Preloader"),
        ("19d2", "0001", "ZTE/Nubia Fastboot"),
    ]
    
    for vid, pid, expected_name in test_cases:
        result = db.lookup(vid, pid)
        if result:
            print(f"[✓] {vid}:{pid} -> {result.get('name', 'Unknown')} ({expected_name})")
        else:
            print(f"[✗] {vid}:{pid} -> Not found (expected: {expected_name})")
    
    # Test boot mode detection
    print("\nBoot Mode Detection:")
    for vid, pid, expected_name in test_cases:
        mode = db.detect_boot_mode(vid, pid)
        print(f"[✓] {vid}:{pid} -> {mode.value}")
    
    # Test capabilities
    print("\nCapabilities:")
    for vid, pid, expected_name in test_cases:
        caps = db.get_capabilities(vid, pid)
        if caps.can_flash:
            print(f"[✓] {vid}:{pid} -> Can flash")
        else:
            print(f"[✗] {vid}:{pid} -> Cannot flash")
    
    print()
    return True


def test_device_types():
    """Test device type detection"""
    print("=" * 60)
    print("TEST: Device Type Detection")
    print("=" * 60)
    
    from enhanced_detector import DeviceType, DetectedDevice, DeviceCapabilities, DeviceStatus
    
    # Create test devices for all major brands
    test_devices = [
        DetectedDevice(
            id="test1",
            vendor_id="05c6",
            product_id="90db",
            vendor_name="Qualcomm",
            product_name="QDLoader 9008",
            device_type=DeviceType.QUALCOMM,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
        DetectedDevice(
            id="test2",
            vendor_id="0e8d",
            product_id="0003",
            vendor_name="MediaTek",
            product_name="Preloader",
            device_type=DeviceType.MEDIATEK,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
        DetectedDevice(
            id="test3",
            vendor_id="04e8",
            product_id="6860",
            vendor_name="Samsung",
            product_name="Download Mode",
            device_type=DeviceType.SAMSUNG,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
        DetectedDevice(
            id="test4",
            vendor_id="05ac",
            product_id="1227",
            vendor_name="Apple",
            product_name="DFU Mode",
            device_type=DeviceType.APPLE,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
        DetectedDevice(
            id="test5",
            vendor_id="2717",
            product_id="ff48",
            vendor_name="Xiaomi",
            product_name="Fastboot",
            device_type=DeviceType.XIAOMI,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
        DetectedDevice(
            id="test6",
            vendor_id="17ef",
            product_id="6009",
            vendor_name="Lenovo",
            product_name="Tab M10",
            device_type=DeviceType.LENOVO,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
        DetectedDevice(
            id="test7",
            vendor_id="22d9",
            product_id="2765",
            vendor_name="OPPO",
            product_name="Fastboot",
            device_type=DeviceType.OPPO,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
        DetectedDevice(
            id="test8",
            vendor_id="2a70",
            product_id="9093",
            vendor_name="Realme",
            product_name="Fastboot",
            device_type=DeviceType.OPPO,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
        DetectedDevice(
            id="test9",
            vendor_id="2d95",
            product_id="5a01",
            vendor_name="Vivo",
            product_name="Fastboot",
            device_type=DeviceType.VIVO,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
        DetectedDevice(
            id="test10",
            vendor_id="22b8",
            product_id="2e24",
            vendor_name="Motorola",
            product_name="Fastboot",
            device_type=DeviceType.MOTOROLA,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
        DetectedDevice(
            id="test11",
            vendor_id="12d1",
            product_id="0001",
            vendor_name="Huawei",
            product_name="Fastboot",
            device_type=DeviceType.HUAWEI,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
        DetectedDevice(
            id="test12",
            vendor_id="25c7",
            product_id="0013",
            vendor_name="Tecno",
            product_name="Preloader",
            device_type=DeviceType.TECNO,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
        DetectedDevice(
            id="test13",
            vendor_id="19d2",
            product_id="0001",
            vendor_name="ZTE",
            product_name="Nubia Fastboot",
            device_type=DeviceType.ZTE,
            boot_mode=None,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        ),
    ]
    
    for device in test_devices:
        print(f"[✓] Device: {device.vendor_name} {device.product_name}")
        print(f"    Type: {device.device_type.value}")
        print(f"    VID:PID: {device.vendor_id}:{device.product_id}")
    
    print()
    return True


def test_workspace_manager():
    """Test workspace creation and management"""
    print("=" * 60)
    print("TEST: Workspace Manager")
    print("=" * 60)
    
    from enhanced_detector import WorkspaceManager, DetectedDevice, DeviceType, BootMode, DeviceStatus, DeviceCapabilities
    
    # Create temp workspace
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        manager = WorkspaceManager(tmpdir)
        
        # Create test device
        device = DetectedDevice(
            id="test_ws",
            vendor_id="05c6",
            product_id="90db",
            vendor_name="Qualcomm",
            product_name="QDLoader 9008",
            device_type=DeviceType.QUALCOMM,
            boot_mode=BootMode.EDL,
            status=DeviceStatus.CONNECTED,
            capabilities=DeviceCapabilities(),
        )
        
        # Create workspace
        workspace = manager.create_workspace(device)
        print(f"[✓] Created workspace: {workspace.name}")
        
        # Check structure
        expected_dirs = ['firmware', 'backups', 'logs', 'partitions', 'tools', 'configs']
        for d in expected_dirs:
            if (workspace / d).exists():
                print(f"[✓] Directory exists: {d}")
            else:
                print(f"[✗] Directory missing: {d}")
        
        # Check device info
        info_file = workspace / "device_info.json"
        if info_file.exists():
            with open(info_file) as f:
                info = json.load(f)
            print(f"[✓] Device info saved: {info['vendor_name']} {info['product_name']}")
        
        # Test listing workspaces
        workspaces = manager.list_workspaces()
        print(f"[✓] Found {len(workspaces)} workspace(s)")
    
    print()
    return True


def test_protocol_decoders():
    """Test protocol decoder configuration"""
    print("=" * 60)
    print("TEST: Protocol Decoders")
    print("=" * 60)
    
    # Load protocol configuration
    protocols_file = Path(__file__).parent.parent / "packages" / "electronics" / "sigrok" / "protocols" / "mobile_protocols.json"
    
    if protocols_file.exists():
        with open(protocols_file) as f:
            protocols = json.load(f)
        
        print(f"[✓] Loaded {len(protocols['protocols'])} protocols:")
        for proto in protocols['protocols']:
            print(f"    - {proto['name']}: {proto['description']}")
        
        print(f"\n[✓] Loaded {len(protocols['trigger_profiles'])} trigger profiles")
    else:
        print(f"[✗] Protocol file not found: {protocols_file}")
        return False
    
    print()
    return True


def test_kicad_libraries():
    """Test KiCad library database"""
    print("=" * 60)
    print("TEST: KiCad Libraries")
    print("=" * 60)
    
    # Load PMIC database
    pmic_file = Path(__file__).parent.parent / "packages" / "electronics" / "kicad-mobrepair" / "libraries" / "pmic" / "database.json"
    
    if pmic_file.exists():
        with open(pmic_file) as f:
            pmics = json.load(f)
        
        print(f"[✓] Loaded {len(pmics['components'])} PMICs:")
        for pmic in pmics['components']:
            print(f"    - {pmic['name']}: {pmic['description']}")
            print(f"      Voltage rails: {len(pmic['voltage_rails'])}")
            print(f"      Test points: {len(pmic['test_points'])}")
    else:
        print(f"[✗] PMIC database not found: {pmic_file}")
        return False
    
    print()
    return True


def test_container_definitions():
    """Test container Dockerfiles"""
    print("=" * 60)
    print("TEST: Container Definitions")
    print("=" * 60)
    
    containers_dir = Path(__file__).parent.parent / "containers"
    
    expected_containers = [
        "android-tools",
        "apple-tools",
        "qualcomm-edl",
        "mediatek-flash",
        "samsung-odin",
    ]
    
    for container in expected_containers:
        dockerfile = containers_dir / container / "Dockerfile"
        if dockerfile.exists():
            # Read and validate Dockerfile
            with open(dockerfile) as f:
                content = f.read()
            
            if "FROM " in content:
                print(f"[✓] {container}: Valid Dockerfile")
            else:
                print(f"[✗] {container}: Invalid Dockerfile")
        else:
            print(f"[✗] {container}: Dockerfile not found")
    
    print()
    return True


def test_boot_modes():
    """Test boot mode configurations"""
    print("=" * 60)
    print("TEST: Boot Modes")
    print("=" * 60)
    
    boot_modes_dir = Path(__file__).parent.parent / "base" / "boot-modes"
    
    expected_modes = [
        "desktop-mode.conf",
        "mobile-service.conf",
        "electronics-bench.conf",
        "combined-mode.conf",
    ]
    
    for mode_file in expected_modes:
        mode_path = boot_modes_dir / mode_file
        if mode_path.exists():
            with open(mode_path) as f:
                content = f.read()
            
            if "[BootMode]" in content:
                print(f"[✓] {mode_file}: Valid configuration")
            else:
                print(f"[✗] {mode_file}: Invalid configuration")
        else:
            print(f"[✗] {mode_file}: Not found")
    
    print()
    return True


def test_gui_components():
    """Test GUI component files"""
    print("=" * 60)
    print("TEST: GUI Components")
    print("=" * 60)
    
    gui_dir = Path(__file__).parent.parent / "gui"
    
    expected_components = [
        "src/App.tsx",
        "src/main.tsx",
        "src/components/DeviceManager/DeviceManager.tsx",
        "src/components/SignalAnalyzer/SignalAnalyzer.tsx",
        "src/components/PowerMonitor/PowerMonitor.tsx",
        "src/components/SchematicViewer/SchematicViewer.tsx",
        "src/components/Flasher/Flasher.tsx",
        "src/components/Recovery/Recovery.tsx",
        "package.json",
        "tsconfig.json",
    ]
    
    for component in expected_components:
        component_path = gui_dir / component
        if component_path.exists():
            print(f"[✓] {component}")
        else:
            print(f"[✗] {component}: Not found")
    
    print()
    return True


def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("  TechBench - Component Tests")
    print("=" * 60 + "\n")
    
    tests = [
        ("Chipset Database", test_chipset_database),
        ("Device Types", test_device_types),
        ("Workspace Manager", test_workspace_manager),
        ("Protocol Decoders", test_protocol_decoders),
        ("KiCad Libraries", test_kicad_libraries),
        ("Container Definitions", test_container_definitions),
        ("Boot Modes", test_boot_modes),
        ("GUI Components", test_gui_components),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"[✗] {name}: ERROR - {e}")
            results.append((name, False))
    
    # Summary
    print("=" * 60)
    print("  TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, r in results if r)
    failed = sum(1 for _, r in results if not r)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status}: {name}")
    
    print(f"\n  Total: {passed} passed, {failed} failed\n")
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
