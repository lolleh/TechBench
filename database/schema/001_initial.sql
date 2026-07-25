-- TechBench Database Schema
-- Version: 001
-- Description: Initial schema for projects, devices, repairs, and component database

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- =============================================================================
-- Projects
-- =============================================================================

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    project_type TEXT NOT NULL CHECK (project_type IN ('repair', 'diagnostics', 'engineering', 'research', 'data_recovery')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'on_hold')),
    customer_name TEXT,
    customer_contact TEXT,
    device_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    tags TEXT DEFAULT '[]',
    notes TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_device ON projects(device_id);

-- =============================================================================
-- Devices
-- =============================================================================

CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    manufacturer TEXT,
    model TEXT,
    chipset TEXT,
    cpu TEXT,
    storage_type TEXT CHECK (storage_type IN ('emmc', 'ufs', 'nvme', 'unknown')),
    storage_capacity TEXT,
    ram TEXT,
    android_version TEXT,
    ios_version TEXT,
    imei TEXT,
    serial_number TEXT,
    boot_mode TEXT DEFAULT 'normal',
    bootloader_locked INTEGER DEFAULT 1,
    security_state TEXT,
    battery_health TEXT,
    last_seen TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    tags TEXT DEFAULT '[]',
    notes TEXT,
    photos TEXT DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_devices_manufacturer ON devices(manufacturer);
CREATE INDEX IF NOT EXISTS idx_devices_model ON devices(model);
CREATE INDEX IF NOT EXISTS idx_devices_imei ON devices(imei);
CREATE INDEX IF NOT EXISTS idx_devices_serial ON devices(serial_number);

-- =============================================================================
-- Repair Records
-- =============================================================================

CREATE TABLE IF NOT EXISTS repairs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    repair_type TEXT NOT NULL CHECK (repair_type IN (
        'software', 'hardware', 'firmware', 'diagnostic', 'data_recovery',
        'screen_replacement', 'battery_replacement', 'charging_port',
        'microphone', 'speaker', 'camera', 'power_button', 'volume_button',
        'wifi_bluetooth', 'cellular', 'nfc', 'fingerprint', 'face_id',
        'board_repair', 'chip_replacement', 'reballing', 'jumper_repair',
        'isp', 'chip_off', 'other'
    )),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'on_hold')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    title TEXT NOT NULL,
    description TEXT,
    diagnosis TEXT,
    solution TEXT,
    parts_used TEXT DEFAULT '[]',
    tools_used TEXT DEFAULT '[]',
    time_spent_minutes INTEGER DEFAULT 0,
    cost_parts REAL DEFAULT 0,
    cost_labor REAL DEFAULT 0,
    cost_total REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    technician TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_repairs_project ON repairs(project_id);
CREATE INDEX IF NOT EXISTS idx_repairs_device ON repairs(device_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_type ON repairs(repair_type);

-- =============================================================================
-- Test Results
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    repair_id TEXT NOT NULL,
    test_type TEXT NOT NULL CHECK (test_type IN (
        'voltage', 'current', 'resistance', 'continuity', 'signal',
        'power_sequence', 'boot_current', 'thermal', 'visual', 'functional'
    )),
    test_name TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'warning', 'info')),
    expected_value TEXT,
    actual_value TEXT,
    unit TEXT,
    notes TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_test_results_repair ON test_results(repair_id);
CREATE INDEX IF NOT EXISTS idx_test_results_type ON test_results(test_type);

-- =============================================================================
-- Power Logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS power_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL,
    device_id TEXT,
    session_name TEXT,
    voltage REAL NOT NULL,
    current REAL NOT NULL,
    power REAL NOT NULL,
    temperature REAL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_power_logs_project ON power_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_power_logs_timestamp ON power_logs(timestamp);

-- =============================================================================
-- Boot Signatures
-- =============================================================================

CREATE TABLE IF NOT EXISTS boot_signatures (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    chipset TEXT,
    manufacturer TEXT,
    pattern_description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'fault', 'warning', 'unknown')),
    diagnosis TEXT,
    suggestion TEXT,
    avg_current_a REAL,
    peak_current_a REAL,
    duration_seconds REAL,
    signature_data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    usage_count INTEGER DEFAULT 0,
    accuracy REAL
);

CREATE INDEX IF NOT EXISTS idx_boot_signatures_chipset ON boot_signatures(chipset);
CREATE INDEX IF NOT EXISTS idx_boot_signatures_status ON boot_signatures(status);

-- =============================================================================
-- Components Database
-- =============================================================================

CREATE TABLE IF NOT EXISTS components (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'pmic', 'charging_ic', 'audio_codec', 'rf_ic', 'usb_controller',
        'touch_controller', 'display_driver', 'wifi', 'bluetooth', 'nfc',
        'accelerometer', 'gyroscope', 'compass', 'proximity', 'ambient_light',
        'capacitor', 'resistor', 'inductor', 'diode', 'transistor',
        'connector', 'crystal', 'fuse', 'ic', 'other'
    )),
    manufacturer TEXT,
    part_number TEXT,
    description TEXT,
    package TEXT,
    common_devices TEXT DEFAULT '[]',
    common_faults TEXT DEFAULT '[]',
    test_points TEXT DEFAULT '[]',
    datasheet_url TEXT,
    price_range TEXT,
    suppliers TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_components_category ON components(category);
CREATE INDEX IF NOT EXISTS idx_components_part ON components(part_number);
CREATE INDEX IF NOT EXISTS idx_components_manufacturer ON components(manufacturer);

-- =============================================================================
-- Schematics
-- =============================================================================

CREATE TABLE IF NOT EXISTS schematics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    device_id TEXT,
    name TEXT NOT NULL,
    manufacturer TEXT,
    model TEXT,
    version TEXT,
    file_path TEXT,
    file_type TEXT CHECK (file_type IN ('pdf', 'brd', 'kicad_pcb', 'sch', 'image', 'other')),
    resolution INTEGER,
    page_count INTEGER,
    tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_schematics_device ON schematics(device_id);
CREATE INDEX IF NOT EXISTS idx_schematics_manufacturer ON schematics(manufacturer);

-- =============================================================================
-- Firmware Library
-- =============================================================================

CREATE TABLE IF NOT EXISTS firmware (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    device_id TEXT,
    name TEXT NOT NULL,
    manufacturer TEXT,
    model TEXT,
    version TEXT,
    build_number TEXT,
    android_version TEXT,
    file_path TEXT,
    file_size INTEGER,
    file_hash TEXT,
    file_type TEXT CHECK (file_type IN ('zip', 'tar', 'img', 'mbn', 'bin', 'ipsw', 'other')),
    region TEXT,
    carrier TEXT,
    download_date TEXT,
    verified INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_firmware_device ON firmware(device_id);
CREATE INDEX IF NOT EXISTS idx_firmware_manufacturer ON firmware(manufacturer);

-- =============================================================================
-- Audit Log
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    user_id TEXT DEFAULT 'local',
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- =============================================================================
-- Tags (for flexible categorization)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6b7280',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- Project Tags (many-to-many)
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_tags (
    project_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (project_id, tag_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- =============================================================================
-- Files attached to projects
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_files (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);

-- =============================================================================
-- Saved Searches
-- =============================================================================

CREATE TABLE IF NOT EXISTS saved_searches (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    search_type TEXT NOT NULL,
    query TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
