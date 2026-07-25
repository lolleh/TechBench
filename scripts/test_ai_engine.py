#!/usr/bin/env python3
"""
Tests for TechBench AI Engine
"""

import sys
import os
import json
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from ai.engine import (
    AIEngine,
    AIModelType,
    ComponentDetection,
    RepairRecommendation,
    DiagnosticResult,
    PowerAnalysisResult,
    CircuitExplanation,
    RepairPriority,
)


def test_ai_engine_initialization():
    """Test AI engine initialization"""
    print("=" * 60)
    print("TEST: AI Engine Initialization")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        engine = AIEngine(model_dir=tmpdir)
        result = engine.initialize()

        assert result is True, "Engine initialization should succeed"
        assert engine.is_initialized() is True, "Engine should be initialized"

        models = engine.get_available_models()
        print(f"[✓] Engine initialized successfully")
        print(f"[✓] Available models: {models}")

    print()
    return True


def test_component_identification():
    """Test component identification"""
    print("=" * 60)
    print("TEST: Component Identification")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        engine = AIEngine(model_dir=tmpdir)
        engine.initialize()

        # Test exact match
        result = engine.identify_component({"part_number": "PM8550"})
        assert result is not None, "Should identify PM8550"
        assert result.name == "PM8550", f"Expected PM8550, got {result.name}"
        assert result.category == "pmic", f"Expected pmic, got {result.category}"
        assert result.confidence > 0.9, f"Expected high confidence, got {result.confidence}"
        print(f"[✓] Exact match: {result.name} (confidence: {result.confidence:.2f})")

        # Test fuzzy match by name
        result = engine.identify_component({"name": "BQ25895 charger"})
        assert result is not None, "Should identify BQ25895"
        assert result.part_number == "BQ25895"
        print(f"[✓] Fuzzy match: {result.name} (confidence: {result.confidence:.2f})")

        # Test category match
        result = engine.identify_component({"name": "touch controller", "category": "touch_controller"})
        assert result is not None, "Should identify touch controller"
        print(f"[✓] Category match: {result.name} (confidence: {result.confidence:.2f})")

        # Test unknown component
        result = engine.identify_component({"name": "unknown_foobar_xyz"})
        assert result is None, "Unknown component should return None"
        print(f"[✓] Unknown component correctly returns None")

        # Test batch identification
        batch = [
            {"part_number": "PM8550"},
            {"part_number": "FUSB302"},
            {"name": "audio codec", "category": "audio_codec"},
            {"name": "totally_unknown_12345"},
        ]
        results = engine.identify_components_batch(batch)
        assert len(results) == 3, f"Expected 3 results, got {len(results)}"
        print(f"[✓] Batch identification: {len(results)}/{len(batch)} found")

    print()
    return True


def test_power_signature_analysis():
    """Test power signature analysis"""
    print("=" * 60)
    print("TEST: Power Signature Analysis")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        engine = AIEngine(model_dir=tmpdir)
        engine.initialize()

        # Test normal boot pattern
        normal_boot = [0.3, 0.5, 0.8, 1.0, 1.2, 1.1, 0.9, 0.5, 0.4, 0.38, 0.35]
        result = engine.analyze_power_signature(normal_boot, voltage=4.2)
        assert result.avg_current > 0, "Avg current should be positive"
        assert result.peak_current > 0, "Peak current should be positive"
        print(f"[✓] Normal boot analysis:")
        print(f"    Avg: {result.avg_current:.3f}A, Peak: {result.peak_current:.3f}A")
        print(f"    Signature: {result.signature_match}")
        print(f"    Confidence: {result.match_confidence:.2f}")

        # Test no power pattern
        no_power = [0.001, 0.001, 0.001, 0.001, 0.001]
        result = engine.analyze_power_signature(no_power, voltage=4.2)
        assert any("zero" in a.lower() or "No data" in a for a in result.anomalies) or result.avg_current < 0.01
        print(f"[✓] No power detection: anomalies={result.anomalies}")

        # Test short circuit pattern
        short_circuit = [2.5, 2.6, 2.7, 2.5, 2.8, 2.5, 2.6]
        result = engine.analyze_power_signature(short_circuit, voltage=4.2)
        assert any("high" in a.lower() for a in result.anomalies)
        print(f"[✓] Short circuit detection: anomalies={result.anomalies}")

        # Test empty data
        result = engine.analyze_power_signature([])
        assert result.signature_match is None
        assert len(result.anomalies) > 0
        print(f"[✓] Empty data handled correctly")

    print()
    return True


def test_fault_diagnosis():
    """Test fault diagnosis"""
    print("=" * 60)
    print("TEST: Fault Diagnosis")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        engine = AIEngine(model_dir=tmpdir)
        engine.initialize()

        # Test no power diagnosis
        result = engine.diagnose_symptoms(
            symptoms=["no power", "dead phone"],
            device_info={"chipset": "Snapdragon 8 Gen 3", "manufacturer": "Samsung"},
        )
        assert result is not None
        assert result.confidence > 0.5
        assert len(result.recommended_tests) > 0
        print(f"[✓] No power diagnosis:")
        print(f"    Cause: {result.probable_cause}")
        print(f"    Confidence: {result.confidence:.2f}")
        print(f"    Tests: {len(result.recommended_tests)}")

        # Test boot loop diagnosis
        result = engine.diagnose_symptoms(
            symptoms=["boot loop", "keeps restarting"],
        )
        assert result is not None
        assert "boot" in result.probable_cause.lower() or "software" in result.probable_cause.lower()
        print(f"[✓] Boot loop diagnosis: {result.probable_cause}")

        # Test display issue
        result = engine.diagnose_symptoms(
            symptoms=["no display", "black screen"],
        )
        assert result is not None
        assert "display" in result.probable_cause.lower() or "screen" in result.probable_cause.lower()
        print(f"[✓] Display issue diagnosis: {result.probable_cause}")

        # Test with test results
        result = engine.diagnose_symptoms(
            symptoms=["charging issue"],
            test_results=[{"test_name": "VBUS voltage", "result": "fail", "actual_value": "0.5V"}],
        )
        assert result is not None
        print(f"[✓] Diagnosis with test results: confidence={result.confidence:.2f}")

    print()
    return True


def test_circuit_explanation():
    """Test circuit explanation generation"""
    print("=" * 60)
    print("TEST: Circuit Explanation")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        engine = AIEngine(model_dir=tmpdir)
        engine.initialize()

        section = {
            "name": "Power Management",
            "components": [
                {"name": "PM8550", "category": "pmic"},
                {"name": "BQ25895", "category": "charging_ic"},
            ],
        }

        result = engine.explain_circuit_section(section)
        assert result is not None
        assert result.section_name == "Power Management"
        assert len(result.components) == 2
        print(f"[✓] Circuit explanation generated:")
        print(f"    Section: {result.section_name}")
        print(f"    Components: {len(result.components)}")
        print(f"    Voltage rails: {result.voltage_rails}")

    print()
    return True


def test_repair_notes_search():
    """Test repair notes search"""
    print("=" * 60)
    print("TEST: Repair Notes Search")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        engine = AIEngine(model_dir=tmpdir)
        engine.initialize()

        # Search for PMIC
        results = engine.search_repair_notes("PMIC")
        assert len(results) > 0
        print(f"[✓] Found {len(results)} results for 'PMIC'")

        # Search for charging
        results = engine.search_repair_notes("charging")
        assert len(results) > 0
        print(f"[✓] Found {len(results)} results for 'charging'")

        # Search for unknown
        results = engine.search_repair_notes("xyzzy_unknown")
        print(f"[✓] Found {len(results)} results for 'xyzzy_unknown' (expected 0)")

    print()
    return True


def test_test_point_identification():
    """Test test point identification"""
    print("=" * 60)
    print("TEST: Test Point Identification")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        engine = AIEngine(model_dir=tmpdir)
        engine.initialize()

        board = {
            "components": [
                {"name": "PM8550", "category": "pmic"},
                {"name": "FUSB302", "category": "usb_controller"},
            ],
        }

        # All test points
        results = engine.identify_test_points(board)
        assert len(results) > 0
        print(f"[✓] Found {len(results)} test points")

        # Filtered test points
        results = engine.identify_test_points(board, target_signals=["VREG"])
        assert len(results) > 0
        print(f"[✓] Found {len(results)} test points matching 'VREG'")

    print()
    return True


def test_database_schema():
    """Test database schema creation"""
    print("=" * 60)
    print("TEST: Database Schema")
    print("=" * 60)

    schema_path = Path(__file__).parent.parent / "database" / "schema" / "001_initial.sql"
    assert schema_path.exists(), f"Schema file not found: {schema_path}"

    with open(schema_path) as f:
        schema = f.read()

    # Check for key tables
    expected_tables = [
        "projects", "devices", "repairs", "test_results",
        "power_logs", "boot_signatures", "components",
        "schematics", "firmware", "audit_log", "tags",
    ]

    for table in expected_tables:
        assert f"CREATE TABLE IF NOT EXISTS {table}" in schema, f"Table {table} not found in schema"
        print(f"[✓] Table: {table}")

    print()
    return True


def test_seed_data():
    """Test seed data files"""
    print("=" * 60)
    print("TEST: Seed Data")
    print("=" * 60)

    seeds_dir = Path(__file__).parent.parent / "database" / "seeds"
    assert seeds_dir.exists(), f"Seeds directory not found: {seeds_dir}"

    seed_files = list(seeds_dir.glob("*.sql"))
    assert len(seed_files) >= 2, f"Expected at least 2 seed files, found {len(seed_files)}"
    print(f"[✓] Found {len(seed_files)} seed files")

    for seed_file in seed_files:
        with open(seed_file) as f:
            content = f.read()
        assert "INSERT" in content, f"Seed file {seed_file.name} has no INSERT statements"
        print(f"[✓] {seed_file.name}: Valid seed data")

    print()
    return True


def main():
    """Run all AI engine tests"""
    print("\n" + "=" * 60)
    print("  TechBench AI Engine Tests")
    print("=" * 60 + "\n")

    tests = [
        ("AI Engine Initialization", test_ai_engine_initialization),
        ("Component Identification", test_component_identification),
        ("Power Signature Analysis", test_power_signature_analysis),
        ("Fault Diagnosis", test_fault_diagnosis),
        ("Circuit Explanation", test_circuit_explanation),
        ("Repair Notes Search", test_repair_notes_search),
        ("Test Point Identification", test_test_point_identification),
        ("Database Schema", test_database_schema),
        ("Seed Data", test_seed_data),
    ]

    results = []

    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            import traceback
            print(f"[✗] {name}: ERROR - {e}")
            traceback.print_exc()
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
