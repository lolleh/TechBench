-- Common Mobile Repair Components Seed Data

INSERT OR IGNORE INTO components (id, name, category, manufacturer, part_number, description, package, common_devices, common_faults, test_points) VALUES
-- PMICs
('pm001', 'PM8550', 'pmic', 'Qualcomm', 'PM8550', 'Primary PMIC for Snapdragon 8 Gen 2/3', 'BGA', '["Samsung Galaxy S24", "OnePlus 12", "Xiaomi 14"]', '["No VREG_L3 output (47%)", "Overheating (23%)", "No output on LDO rails (15%)"]', '["VREG_L3", "VREG_L5", "VREG_S3", "VREG_CX"]'),
('pm002', 'PM8150B', 'pmic', 'Qualcomm', 'PM8150B', 'Secondary PMIC for Snapdragon 8 Gen 1/2', 'BGA', '["Samsung Galaxy S23", "Pixel 7 Pro"]', '["No VREG_L1 output (35%)", "Short on VREG_S4 (20%)"]', '["VREG_L1", "VREG_L5", "VREG_S4"]'),
('pm003', 'S2MPS15', 'pmic', 'Samsung', 'S2MPS15', 'Samsung Exynos PMIC', 'BGA', '["Samsung Galaxy S21", "Galaxy Note 20"]', '["No buck output (40%)", "LDO failure (25%)"]', '["BUCK1", "BUCK2", "LDO3", "LDO4"]'),
('pm004', 'MT6370', 'pmic', 'MediaTek', 'MT6370', 'MediaTek MT series PMIC', 'QFN', '["Redmi Note 12", "Realme GT Neo 3"]', '["Charging IC failure (30%)", "No output (20%)"]', '["CHR_OUT", "VPROC", "VCORE"]'),
('pm005', 'AXP228', 'pmic', 'Allwinner', 'AXP228', 'Allwinner SoC PMIC', 'QFN48', '["Orange Pi", "Banana Pi"]', '["No power output (25%)"]', '["DCDC1", "DCDC2", "LDO1"]'),

-- Charging ICs
('ch001', 'BQ25895', 'charging_ic', 'Texas Instruments', 'BQ25895', '2A Single-Input Switch-Mode Battery Charger', 'QFN-28', '["Various Android phones"]', '["No charging (35%)", "Overheating (20%)", "Slow charging (15%)"]', '["VBUS", "VBAT", "SYS"]'),
('ch002', 'PMI8998', 'charging_ic', 'Qualcomm', 'PMI8998', 'Integrated Charge management', 'BGA', '["Pixel 2 XL", "OnePlus 5T"]', '["No charge current (40%)", "Battery drain (25%)"]', '["CHG_SENT", "BATFET"]'),
('ch003', 'S2MU005', 'charging_ic', 'Samsung', 'S2MU005', 'Samsung fast charging IC', 'BGA', '["Samsung Galaxy S20", "Note 10"]', '["Fast charge failure (30%)"]', '["CHG_IN", "VBAT"]'),

-- Audio Codecs
('ac001', 'WCD9385', 'audio_codec', 'Qualcomm', 'WCD9385', 'Audio codec for Snapdragon 8 Gen 2', 'BGA', '["Samsung Galaxy S23", "OnePlus 11"]', '["No audio output (30%)", "Mic not working (25%)", "Distorted audio (15%)"]', '["MIC1", "MIC2", "HPHL", "HPHR", "SPK"]'),
('ac002', 'CS35L45', 'audio_codec', 'Cirrus Logic', 'CS35L45', 'Smart amplifier', 'WLCSP', '["iPhone 13", "Pixel 6"]', '["No speaker output (35%)"]', '["AMP_OUT", "I2S"]'),

-- USB Controllers
('usb001', 'FUSB302', 'usb_controller', 'ON Semiconductor', 'FUSB302', 'USB Type-C PHY with PD', 'QFN-20', '["Various USB-C devices"]', '["PD negotiation failure (40%)", "No CC detection (25%)"]', '["CC1", "CC2", "VBUS"]'),
('usb002', 'TPS65986', 'usb_controller', 'Texas Instruments', 'TPS65986', 'USB Type-C and PD Controller', 'QFN-48', '["Various USB-C laptops", "Tablets"]', '["No USB data (30%)", "PD not working (25%)"]', '["CC1", "CC2", "D+", "D-"]'),

-- Touch Controllers
('tc001', 'FT5436', 'touch_controller', 'FocalTech', 'FT5436', 'Mutual Capacitive Touch Controller', 'QFN-40', '["Various Android phones"]', '["No touch response (35%)", "Ghost touch (25%)", "Dead zones (20%)"]', '["SDA", "SCL", "INT", "RST"]'),
('tc002', 'S3908', 'touch_controller', 'Synaptics', 'S3908', 'TouchScreen Controller', 'CSP', '["Samsung Galaxy A series"]', '["Touch not working (40%)"]', '["SPI_CLK", "SPI_MOSI", "INT"]'),

-- Display Drivers
('dd001', 'RM692B0', 'display_driver', 'Raydium', 'RM692B0', 'AMOLED Display Driver IC', 'COF', '["Xiaomi 12", "Redmi K50"]', '["No display (30%)", "Display flicker (20%)", "Green tint (15%)"]', '["MIPI_CLK", "MIPI_DATA", "VDDIO"]'),
('dd002', 'SSD2825', 'display_driver', 'Synaptics', 'SSD2825', 'MIPI DSI Bridge', 'BGA', '["Various phones"]', '["No MIPI output (35%)"]', '["DSI_CLK", "DSI_DATA0-3"]'),

-- RF ICs
('rf001', 'WTR3925', 'rf_ic', 'Qualcomm', 'WTR3925', 'RF Transceiver for LTE/5G', 'BGA', '["Snapdragon 6 series phones"]', '["No cellular (40%)", "Weak signal (25%)"]', '["ANT", "RFC", "TX"]'),
('rf002', 'Skyworks SKY5', 'rf_ic', 'Skyworks', 'SKY5-37435', 'Multi-Mode Multi-Band PA Module', 'LGA', '["Various 5G phones"]', '["No TX power (30%)"]', '["VCC", "TX", "ANT"]'),

-- Connectors
('cn001', 'USB-C 16P', 'connector', 'Generic', 'USB-C-16P', 'USB Type-C 16 Pin Connector', 'SMD', '["Universal"]', '["Bent pins (35%)", "Corrosion (20%)", "No data (15%)", "No power (15%)"]', '["VBUS", "CC1", "CC2", "D+", "D-", "GND"]'),
('cn002', 'FPC Display', 'connector', 'Generic', 'FPC-40P', '40-pin FPC Display Connector', 'SMD', '["Various phones"]', '["No display (40%)", "Flickering (20%)"]', '["MIPI_CLK", "MIPI_DATA"]'),
('cn003', 'Battery Connector', 'connector', 'Generic', 'BAT-CONN', 'Battery Connector Terminal', 'SMD', '["Universal"]', '["No power (30%)", "Intermittent (25%)"]', '["VBAT", "BATT_ID", "BATT_THERM"]');

-- =============================================================================
-- Boot Signatures Seed Data
-- =============================================================================

INSERT OR IGNORE INTO boot_signatures (id, name, chipset, manufacturer, pattern_description, status, diagnosis, suggestion, avg_current_a, peak_current_a, duration_seconds) VALUES
('bs001', 'Normal Boot (Snapdragon 8 Gen 3)', 'Snapdragon 8 Gen 3', 'Qualcomm', '0.3A → 0.8A → 1.2A → 0.4A (stable)', 'healthy', 'Device booting normally', 'No action required', 0.4, 1.2, 10.0),
('bs002', 'Normal Boot (Snapdragon 8 Gen 2)', 'Snapdragon 8 Gen 2', 'Qualcomm', '0.25A → 0.7A → 1.1A → 0.35A', 'healthy', 'Device booting normally', 'No action required', 0.35, 1.1, 10.0),
('bs003', 'Normal Boot (Exynos 2200)', 'Exynos 2200', 'Samsung', '0.3A → 0.9A → 1.3A → 0.45A', 'healthy', 'Device booting normally', 'No action required', 0.45, 1.3, 12.0),
('bs004', 'PMIC Failure (PM8550)', 'Snapdragon 8 Gen 3', 'Qualcomm', '0.8A → 0.2A (drops after 2s)', 'fault', 'Primary PMIC not maintaining voltage', 'Check PM8550 output rails, reball if needed', 0.2, 0.8, 2.0),
('bs005', 'Short Circuit (Main Rail)', NULL, NULL, '2.5A → PSU current limit', 'fault', 'Dead short on main power rail', 'Thermal scan to locate short, check capacitors', 2.5, 2.5, 0.5),
('bs006', 'Boot Loop (Software)', NULL, NULL, '0.3A → 1.2A → 0.3A → 1.2A (repeat)', 'fault', 'Device failing early boot, possible corrupt firmware', 'Try EDL/Recovery mode flash', 0.75, 1.2, 8.0),
('bs007', 'No Power', NULL, NULL, '0.0A (no current draw)', 'fault', 'No power reaching device', 'Check battery connector, charging IC, fuse', 0.0, 0.0, 0.0),
('bs008', 'Display Failure', NULL, NULL, '0.3A → 0.8A → 1.0A (no display)', 'warning', 'Device booting but display not initializing', 'Check display connector, MIPI lines, display driver IC', 0.8, 1.0, 10.0),
('bs009', 'Charging IC Failure', NULL, NULL, '0.1A → 0.0A (drops to zero)', 'fault', 'Charging IC not maintaining input', 'Check charging IC, input capacitors, USB-PD controller', 0.1, 0.1, 5.0),
('bs010', 'Audio Codec Failure', NULL, NULL, '0.3A → 0.8A → 1.2A → 0.4A (normal boot, no audio)', 'warning', 'Device boots normally but audio subsystem failing', 'Check audio codec I2C lines, amplifier, speaker connections', 0.4, 1.2, 10.0);

-- =============================================================================
-- Default Tags
-- =============================================================================

INSERT OR IGNORE INTO tags (id, name, color) VALUES
('tag001', 'water_damage', '#3b82f6'),
('tag002', 'drop_damage', '#ef4444'),
('tag003', 'charging_issue', '#eab308'),
('tag004', 'display_issue', '#8b5cf6'),
('tag005', 'audio_issue', '#06b6d4'),
('tag006', 'camera_issue', '#f97316'),
('tag007', 'battery_issue', '#22c55e'),
('tag008', 'boot_loop', '#dc2626'),
('tag009', 'no_power', '#6b7280'),
('tag010', 'data_recovery', '#ec4899'),
('tag011', 'firmware_flash', '#14b8a6'),
('tag012', 'board_repair', '#a855f7'),
('tag013', 'chip_off', '#f43f5e'),
('tag014', 'routine_service', '#84cc16');
