"""
TechBench AI Assistant Framework
Provides component recognition, repair recommendations, and intelligent diagnostics.
"""

import os
import json
import logging
from pathlib import Path
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum

logger = logging.getLogger(__name__)


class AIModelType(Enum):
    COMPONENT_RECOGNITION = "component_recognition"
    POWER_SIGNATURE = "power_signature"
    FAULT_CLASSIFICATION = "fault_classification"
    CIRCUIT_ANALYSIS = "circuit_analysis"
    TEXT_REASONING = "text_reasoning"


class RepairPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ComponentDetection:
    component_id: str
    name: str
    category: str
    confidence: float
    bounding_box: Optional[Dict[str, float]] = None
    manufacturer: Optional[str] = None
    part_number: Optional[str] = None
    description: Optional[str] = None


@dataclass
class RepairRecommendation:
    title: str
    description: str
    priority: RepairPriority
    estimated_time_minutes: int
    estimated_cost: float
    required_tools: List[str]
    required_parts: List[str]
    steps: List[str]
    warnings: List[str] = field(default_factory=list)
    related_components: List[str] = field(default_factory=list)
    confidence: float = 0.0


@dataclass
class DiagnosticResult:
    symptom: str
    probable_cause: str
    confidence: float
    recommended_tests: List[str]
    recommendations: List[RepairRecommendation]
    affected_components: List[ComponentDetection]
    severity: str
    estimated_repair_time_minutes: int


@dataclass
class PowerAnalysisResult:
    signature_match: Optional[str]
    match_confidence: float
    avg_current: float
    peak_current: float
    duration: float
    anomalies: List[str]
    diagnosis: Optional[str]
    suggestion: Optional[str]


@dataclass
class CircuitExplanation:
    section_name: str
    description: str
    components: List[ComponentDetection]
    signal_flow: List[str]
    voltage_rails: List[str]
    test_points: List[Dict[str, str]]
    common_faults: List[Dict[str, str]]


class AIEngine:
    """Main AI engine for TechBench diagnostics and recommendations."""

    def __init__(self, model_dir: Optional[str] = None):
        self.model_dir = Path(model_dir or os.path.expanduser("~/.techbench/ai/models"))
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self._models: Dict[AIModelType, Any] = {}
        self._component_db: Dict[str, Dict] = {}
        self._signature_db: List[Dict] = []
        self._initialized = False

    def initialize(self) -> bool:
        """Initialize the AI engine and load available models."""
        try:
            self._load_component_database()
            self._load_signature_database()
            self._load_models()
            self._initialized = True
            logger.info("AI Engine initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize AI engine: {e}")
            return False

    def _load_component_database(self):
        """Load the component identification database."""
        db_path = self.model_dir / "component_db.json"
        if db_path.exists():
            with open(db_path, "r") as f:
                self._component_db = json.load(f)
        else:
            self._component_db = self._get_default_component_db()
            with open(db_path, "w") as f:
                json.dump(self._component_db, f, indent=2)

    def _load_signature_database(self):
        """Load the power signature database."""
        db_path = self.model_dir / "signatures.json"
        if db_path.exists():
            with open(db_path, "r") as f:
                self._signature_db = json.load(f)
        else:
            self._signature_db = self._get_default_signatures()
            with open(db_path, "w") as f:
                json.dump(self._signature_db, f, indent=2)

    def _load_models(self):
        """Attempt to load ONNX/TFLite models if available."""
        try:
            import onnxruntime as ort
            model_path = self.model_dir / "component_detector.onnx"
            if model_path.exists():
                self._models[AIModelType.COMPONENT_RECOGNITION] = ort.InferenceSession(str(model_path))
                logger.info("Loaded ONNX component detection model")
        except ImportError:
            logger.info("ONNX Runtime not available, using rule-based detection")
        except Exception as e:
            logger.warning(f"Failed to load ONNX model: {e}")

        try:
            import onnxruntime as ort
            model_path = self.model_dir / "power_signature.onnx"
            if model_path.exists():
                self._models[AIModelType.POWER_SIGNATURE] = ort.InferenceSession(str(model_path))
                logger.info("Loaded ONNX power signature model")
        except (ImportError, Exception):
            pass

    def is_initialized(self) -> bool:
        return self._initialized

    def get_available_models(self) -> List[str]:
        """List available AI models."""
        return [m.value for m in self._models.keys()]

    # =========================================================================
    # Component Recognition
    # =========================================================================

    def identify_component(self, component_data: Dict[str, Any]) -> Optional[ComponentDetection]:
        """Identify a component from its visual or electrical characteristics."""
        name = component_data.get("name", "").lower()
        category = component_data.get("category", "").lower()
        part_number = component_data.get("part_number", "")

        if part_number and part_number in self._component_db:
            entry = self._component_db[part_number]
            return ComponentDetection(
                component_id=part_number,
                name=entry.get("name", part_number),
                category=entry.get("category", category),
                confidence=0.95,
                manufacturer=entry.get("manufacturer"),
                part_number=part_number,
                description=entry.get("description"),
            )

        best_match = None
        best_score = 0.0

        for pid, entry in self._component_db.items():
            score = 0.0
            entry_name = entry.get("name", "").lower()
            entry_category = entry.get("category", "").lower()

            if name and name in entry_name:
                score += 0.4
            if category and category == entry_category:
                score += 0.3
            if part_number and part_number.lower() in pid.lower():
                score += 0.3

            if score > best_score and score > 0.3:
                best_score = score
                best_match = ComponentDetection(
                    component_id=pid,
                    name=entry.get("name", pid),
                    category=entry.get("category", category),
                    confidence=min(score, 0.95),
                    manufacturer=entry.get("manufacturer"),
                    part_number=pid,
                    description=entry.get("description"),
                )

        return best_match

    def identify_components_batch(self, components: List[Dict[str, Any]]) -> List[ComponentDetection]:
        """Identify multiple components at once."""
        results = []
        for comp in components:
            detection = self.identify_component(comp)
            if detection:
                results.append(detection)
        return results

    # =========================================================================
    # Power Signature Analysis
    # =========================================================================

    def analyze_power_signature(
        self,
        current_readings: List[float],
        voltage: float = 4.2,
        sample_interval_ms: int = 50,
    ) -> PowerAnalysisResult:
        """Analyze power consumption pattern against known signatures."""
        if not current_readings:
            return PowerAnalysisResult(
                signature_match=None,
                match_confidence=0.0,
                avg_current=0.0,
                peak_current=0.0,
                duration=0.0,
                anomalies=["No data to analyze"],
                diagnosis=None,
                suggestion=None,
            )

        avg_current = sum(current_readings) / len(current_readings)
        peak_current = max(current_readings)
        min_current = min(current_readings)
        duration = len(current_readings) * sample_interval_ms / 1000.0

        anomalies = []
        if peak_current > 2.5:
            anomalies.append(f"Very high peak current: {peak_current:.2f}A")
        if avg_current < 0.01:
            anomalies.append("Near-zero average current - possible no power")
        if avg_current > 2.0:
            anomalies.append(f"High average current: {avg_current:.2f}A")

        variance = sum((x - avg_current) ** 2 for x in current_readings) / len(current_readings)
        if variance > 0.15:
            anomalies.append("High current variance - possible boot loop or instability")

        best_match = None
        best_confidence = 0.0
        diagnosis = None
        suggestion = None

        for sig in self._signature_db:
            sig_avg = sig.get("avg_current_a", 0)
            sig_peak = sig.get("peak_current_a", 0)

            if sig_avg > 0 and sig_peak > 0:
                avg_diff = abs(avg_current - sig_avg) / sig_avg
                peak_diff = abs(peak_current - sig_peak) / sig_peak

                confidence = 1.0 - (avg_diff * 0.6 + peak_diff * 0.4)
                confidence = max(0.0, min(1.0, confidence))

                if confidence > best_confidence and confidence > 0.5:
                    best_confidence = confidence
                    best_match = sig.get("name")
                    diagnosis = sig.get("diagnosis")
                    suggestion = sig.get("suggestion")

        return PowerAnalysisResult(
            signature_match=best_match,
            match_confidence=best_confidence,
            avg_current=avg_current,
            peak_current=peak_current,
            duration=duration,
            anomalies=anomalies,
            diagnosis=diagnosis,
            suggestion=suggestion,
        )

    # =========================================================================
    # Fault Diagnosis
    # =========================================================================

    def diagnose_symptoms(
        self,
        symptoms: List[str],
        device_info: Optional[Dict[str, str]] = None,
        test_results: Optional[List[Dict[str, Any]]] = None,
    ) -> DiagnosticResult:
        """Diagnose device issues based on symptoms and test results."""
        chipset = (device_info or {}).get("chipset", "")
        manufacturer = (device_info or {}).get("manufacturer", "")

        symptom_text = " ".join(symptoms).lower()
        probable_cause = "Unknown - requires physical inspection"
        confidence = 0.3
        recommended_tests = ["Visual inspection", "Continuity test", "Voltage measurement"]
        recommendations = []
        affected_components = []
        severity = "medium"
        repair_time = 60

        if "no power" in symptom_text or "dead" in symptom_text:
            probable_cause = "Possible battery, charging IC, or PMIC failure"
            confidence = 0.7
            severity = "high"
            recommended_tests = [
                "Battery voltage measurement",
                "Charging IC input/output voltage",
                "PMIC output rails",
                "Continuity on power path",
            ]
            recommendations.append(RepairRecommendation(
                title="Power Path Diagnosis",
                description="Systematically check the power path from USB to battery to PMIC",
                priority=RepairPriority.HIGH,
                estimated_time_minutes=45,
                estimated_cost=0,
                required_tools=["Multimeter", "USB power meter"],
                required_parts=[],
                steps=[
                    "Measure battery voltage at connector",
                    "Check USB input voltage at charging IC",
                    "Verify charging IC output",
                    "Check PMIC main power rails",
                    "Inspect for visible damage or corrosion",
                ],
                confidence=0.7,
            ))

        if "boot loop" in symptom_text or "restart" in symptom_text:
            probable_cause = "Software corruption, PMIC instability, or storage failure"
            confidence = 0.6
            severity = "medium"
            recommended_tests = [
                "Boot current signature analysis",
                "PMIC voltage stability",
                "Storage initialization check",
            ]
            recommendations.append(RepairRecommendation(
                title="Boot Loop Diagnosis",
                description="Analyze boot current pattern to determine software vs hardware cause",
                priority=RepairPriority.MEDIUM,
                estimated_time_minutes=30,
                estimated_cost=0,
                required_tools=["Programmable PSU", "Current analyzer"],
                required_parts=[],
                steps=[
                    "Connect to programmable PSU",
                    "Capture boot current signature",
                    "Compare against known signatures",
                    "If software: attempt recovery flash",
                    "If hardware: check PMIC and storage",
                ],
                confidence=0.6,
            ))

        if "no display" in symptom_text or "black screen" in symptom_text:
            probable_cause = "Display connector, display driver IC, or MIPI issue"
            confidence = 0.6
            severity = "medium"
            recommended_tests = [
                "Display connector visual inspection",
                "MIPI signal integrity check",
                "Display power rail voltage",
                "Backlight circuit check",
            ]

        if "no touch" in symptom_text or "touch" in symptom_text:
            probable_cause = "Touch controller, FPC connector, or digitizer failure"
            confidence = 0.6
            severity = "low"
            recommended_tests = [
                "Touch controller I2C/SPI communication",
                "Touch connector inspection",
                "Touch controller power rail",
            ]

        if "charging" in symptom_text:
            probable_cause = "Charging IC, USB-C connector, or PD controller issue"
            confidence = 0.65
            severity = "medium"
            recommended_tests = [
                "USB-C CC line voltage",
                "Charging IC input voltage",
                "Charging IC output current",
                "USB-PD negotiation check",
            ]

        if "audio" in symptom_text or "sound" in symptom_text:
            probable_cause = "Audio codec, amplifier, or speaker connection issue"
            confidence = 0.55
            severity = "low"
            recommended_tests = [
                "Audio codec I2C communication",
                "Amplifier output voltage",
                "Speaker continuity",
                "Audio codec register dump",
            ]

        if "wifi" in symptom_text or "bluetooth" in symptom_text:
            probable_cause = "WiFi/BT module, antenna connection, or power rail issue"
            confidence = 0.5
            severity = "low"

        if "camera" in symptom_text:
            probable_cause = "Camera module, MIPI lane, or camera power rail issue"
            confidence = 0.5
            severity = "low"

        if test_results:
            for tr in test_results:
                if tr.get("result") == "fail":
                    test_name = tr.get("test_name", "")
                    if "voltage" in test_name.lower():
                        confidence = min(confidence + 0.1, 0.95)
                    if "continuity" in test_name.lower():
                        severity = "high"

        return DiagnosticResult(
            symptom=", ".join(symptoms),
            probable_cause=probable_cause,
            confidence=confidence,
            recommended_tests=recommended_tests,
            recommendations=recommendations,
            affected_components=affected_components,
            severity=severity,
            estimated_repair_time_minutes=repair_time,
        )

    # =========================================================================
    # Circuit Explanation
    # =========================================================================

    def explain_circuit_section(
        self,
        section_data: Dict[str, Any],
        device_info: Optional[Dict[str, str]] = None,
    ) -> CircuitExplanation:
        """Provide explanation of a circuit section."""
        section_name = section_data.get("name", "Unknown Section")
        components = section_data.get("components", [])

        identified = self.identify_components_batch(components)

        description = f"Circuit section: {section_name}"
        signal_flow = []
        voltage_rails = []
        test_points = []
        common_faults = []

        for comp in identified:
            if comp.category in ("pmic", "charging_ic"):
                voltage_rails.append(comp.name)
            if comp.description:
                signal_flow.append(f"{comp.part_number or comp.name}: {comp.description}")

        return CircuitExplanation(
            section_name=section_name,
            description=description,
            components=identified,
            signal_flow=signal_flow,
            voltage_rails=voltage_rails,
            test_points=test_points,
            common_faults=common_faults,
        )

    # =========================================================================
    # Test Point Identification
    # =========================================================================

    def identify_test_points(
        self,
        board_data: Dict[str, Any],
        target_signals: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Identify relevant test points on a board."""
        test_points = []
        components = board_data.get("components", [])

        for comp in components:
            detection = self.identify_component(comp)
            if detection:
                for pid, entry in self._component_db.items():
                    if pid == detection.component_id:
                        for tp in entry.get("test_points", []):
                            test_points.append({
                                "component": detection.name,
                                "signal": tp,
                                "category": detection.category,
                                "recommended_probe": "1x passive probe",
                            })

        if target_signals:
            test_points = [
                tp for tp in test_points
                if any(sig.lower() in tp["signal"].lower() for sig in target_signals)
            ]

        return test_points

    # =========================================================================
    # Repair Documentation
    # =========================================================================

    def search_repair_notes(self, query: str) -> List[Dict[str, Any]]:
        """Search for relevant repair procedures and notes."""
        query_lower = query.lower()
        results = []

        for sig in self._signature_db:
            name = sig.get("name", "").lower()
            diagnosis = (sig.get("diagnosis") or "").lower()
            suggestion = (sig.get("suggestion") or "").lower()

            if query_lower in name or query_lower in diagnosis or query_lower in suggestion:
                results.append({
                    "type": "power_signature",
                    "title": sig.get("name"),
                    "content": sig.get("diagnosis"),
                    "suggestion": sig.get("suggestion"),
                    "status": sig.get("status"),
                })

        for pid, entry in self._component_db.items():
            name = entry.get("name", "").lower()
            desc = entry.get("description", "").lower()
            faults = " ".join(entry.get("common_faults", [])).lower()

            if query_lower in name or query_lower in desc or query_lower in faults:
                results.append({
                    "type": "component",
                    "title": entry.get("name"),
                    "content": entry.get("description"),
                    "part_number": pid,
                    "common_faults": entry.get("common_faults", []),
                })

        return results

    # =========================================================================
    # Default Data
    # =========================================================================

    def _get_default_component_db(self) -> Dict[str, Dict]:
        return {
            "PM8550": {
                "name": "PM8550",
                "category": "pmic",
                "manufacturer": "Qualcomm",
                "description": "Primary PMIC for Snapdragon 8 Gen 2/3",
                "common_faults": ["No VREG_L3 output", "Overheating", "No output on LDO rails"],
                "test_points": ["VREG_L3", "VREG_L5", "VREG_S3", "VREG_CX"],
            },
            "PM8150B": {
                "name": "PM8150B",
                "category": "pmic",
                "manufacturer": "Qualcomm",
                "description": "Secondary PMIC for Snapdragon 8 Gen 1/2",
                "common_faults": ["No VREG_L1 output", "Short on VREG_S4"],
                "test_points": ["VREG_L1", "VREG_L5", "VREG_S4"],
            },
            "S2MPS15": {
                "name": "S2MPS15",
                "category": "pmic",
                "manufacturer": "Samsung",
                "description": "Samsung Exynos PMIC",
                "common_faults": ["No buck output", "LDO failure"],
                "test_points": ["BUCK1", "BUCK2", "LDO3", "LDO4"],
            },
            "MT6370": {
                "name": "MT6370",
                "category": "pmic",
                "manufacturer": "MediaTek",
                "description": "MediaTek MT series PMIC",
                "common_faults": ["Charging IC failure", "No output"],
                "test_points": ["CHR_OUT", "VPROC", "VCORE"],
            },
            "BQ25895": {
                "name": "BQ25895",
                "category": "charging_ic",
                "manufacturer": "Texas Instruments",
                "description": "2A Single-Input Switch-Mode Battery Charger",
                "common_faults": ["No charging", "Overheating", "Slow charging"],
                "test_points": ["VBUS", "VBAT", "SYS"],
            },
            "FUSB302": {
                "name": "FUSB302",
                "category": "usb_controller",
                "manufacturer": "ON Semiconductor",
                "description": "USB Type-C PHY with PD",
                "common_faults": ["PD negotiation failure", "No CC detection"],
                "test_points": ["CC1", "CC2", "VBUS"],
            },
            "WCD9385": {
                "name": "WCD9385",
                "category": "audio_codec",
                "manufacturer": "Qualcomm",
                "description": "Audio codec for Snapdragon 8 Gen 2",
                "common_faults": ["No audio output", "Mic not working", "Distorted audio"],
                "test_points": ["MIC1", "MIC2", "HPHL", "HPHR", "SPK"],
            },
            "FT5436": {
                "name": "FT5436",
                "category": "touch_controller",
                "manufacturer": "FocalTech",
                "description": "Mutual Capacitive Touch Controller",
                "common_faults": ["No touch response", "Ghost touch", "Dead zones"],
                "test_points": ["SDA", "SCL", "INT", "RST"],
            },
        }

    def _get_default_signatures(self) -> List[Dict]:
        return [
            {
                "name": "Normal Boot (Snapdragon 8 Gen 3)",
                "chipset": "Snapdragon 8 Gen 3",
                "manufacturer": "Qualcomm",
                "pattern_description": "0.3A → 0.8A → 1.2A → 0.4A (stable)",
                "status": "healthy",
                "diagnosis": "Device booting normally",
                "suggestion": "No action required",
                "avg_current_a": 0.4,
                "peak_current_a": 1.2,
                "duration_seconds": 10.0,
            },
            {
                "name": "PMIC Failure (PM8550)",
                "chipset": "Snapdragon 8 Gen 3",
                "manufacturer": "Qualcomm",
                "pattern_description": "0.8A → 0.2A (drops after 2s)",
                "status": "fault",
                "diagnosis": "Primary PMIC not maintaining voltage",
                "suggestion": "Check PM8550 output rails, reball if needed",
                "avg_current_a": 0.2,
                "peak_current_a": 0.8,
                "duration_seconds": 2.0,
            },
            {
                "name": "Short Circuit (Main Rail)",
                "chipset": None,
                "manufacturer": None,
                "pattern_description": "2.5A → PSU current limit",
                "status": "fault",
                "diagnosis": "Dead short on main power rail",
                "suggestion": "Thermal scan to locate short, check capacitors",
                "avg_current_a": 2.5,
                "peak_current_a": 2.5,
                "duration_seconds": 0.5,
            },
            {
                "name": "Boot Loop (Software)",
                "chipset": None,
                "manufacturer": None,
                "pattern_description": "0.3A → 1.2A → 0.3A → 1.2A (repeat)",
                "status": "fault",
                "diagnosis": "Device failing early boot, possible corrupt firmware",
                "suggestion": "Try EDL/Recovery mode flash",
                "avg_current_a": 0.75,
                "peak_current_a": 1.2,
                "duration_seconds": 8.0,
            },
            {
                "name": "No Power",
                "chipset": None,
                "manufacturer": None,
                "pattern_description": "0.0A (no current draw)",
                "status": "fault",
                "diagnosis": "No power reaching device",
                "suggestion": "Check battery connector, charging IC, fuse",
                "avg_current_a": 0.0,
                "peak_current_a": 0.0,
                "duration_seconds": 0.0,
            },
        ]
