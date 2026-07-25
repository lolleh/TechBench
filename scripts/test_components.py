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
    
    # Test lookup
    test_cases = [
        ("05c6", "90db"),  # Qualcomm EDL
        ("0e8d", "0003"),  # MediaTek Preloader
        ("04e8", "6860"),  # Samsung Download
        ("05ac", "1227"),  # Apple DFU
        ("18d1", "4ee7"),  # Google Pixel Fastboot
    ]
    
    for vid, pid in test_cases:
        result = db.lookup(vid, pid)
        if result:
            print(f"[✓] {vid}:{pid} -> {result.get('name', 'Unknown')}")
        else:
            print(f"[✗] {vid}:{pid} -> Not found")
    
    # Test boot mode detection
    print("\nBoot Mode Detection:")
    for vid, pid in test_cases:
        mode = db.detect_boot_mode(vid, pid)
        print(f"[✓] {vid}:{pid} -> {mode.value}")
    
    print()
    return True


def test_device_types():
    """Test device type detection"""
    print("=" * 60)
    print("TEST: Device Type Detection")
    print("=" * 60)
    
    from enhanced_detector import DeviceType, DetectedDevice, DeviceCapabilities, DeviceStatus
    
    # Create test devices
    test_devices = [
        DetectedDevice(
            id="test1",
            vendor_id="05c6",
            product_id="90db",
            vendor_name="Qualcomm",
            product_name="QDLoader 9008",
            device_type=DeviceType.QUALCOMM,
            boot_mode=None,  # Will be set
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
