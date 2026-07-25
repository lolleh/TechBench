-- Additional Power Analysis Signatures

INSERT OR IGNORE INTO boot_signatures (id, name, chipset, manufacturer, pattern_description, status, diagnosis, suggestion, avg_current_a, peak_current_a, duration_seconds) VALUES
('bs011', 'WiFi/BT Module Failure', NULL, NULL, '0.3A → 0.8A → 1.2A → 0.4A (WiFi toggle causes drop)', 'warning', 'WiFi/BT module not responding to power commands', 'Check WiFi IC power rails, crystal oscillator, antenna connections', 0.4, 1.2, 10.0),
('bs012', 'eMMC Degradation', NULL, NULL, '0.3A → 1.0A → 0.2A (hangs at storage init)', 'fault', 'eMMC storage failing to initialize properly', 'Try ISP backup, check eMMC VCC/VCCQ rails, may need chip replacement', 0.5, 1.0, 15.0),
('bs013', 'UFS Controller Failure', NULL, NULL, '0.3A → 0.9A → 0.3A (repeats at storage init)', 'fault', 'UFS controller not completing initialization', 'Check UFS VCC/VCCQ/VCCQ2, verify UniPro handshake, ISP recovery possible', 0.5, 0.9, 12.0),
('bs014', 'RF PA Overcurrent', NULL, NULL, '0.3A → 2.0A → PSU limit (during network search)', 'fault', 'RF Power Amplifier drawing excessive current', 'Check PA VCC, inspect for solder bridges, replace PA module', 1.5, 2.0, 5.0),
('bs015', 'Normal Boot (Dimensity 9000)', 'Dimensity 9000', 'MediaTek', '0.28A → 0.75A → 1.15A → 0.38A', 'healthy', 'Device booting normally', 'No action required', 0.38, 1.15, 10.0),
('bs016', 'Normal Boot (A16 Bionic)', 'A16 Bionic', 'Apple', '0.2A → 0.6A → 1.0A → 0.3A', 'healthy', 'Device booting normally', 'No action required', 0.3, 1.0, 8.0),
('bs017', 'Taptic Engine Short', NULL, NULL, '0.3A → 1.5A → 0.8A (vibration motor area)', 'fault', 'Taptic engine or nearby component shorted', 'Check Taptic engine connector, inspect nearby capacitors for shorts', 0.8, 1.5, 3.0),
('bs018', 'Camera Module Failure', NULL, NULL, '0.3A → 0.8A → 1.2A → 0.4A (camera app crashes)', 'warning', 'Camera module failing to initialize', 'Check camera connector, MIPI lanes, camera power rails', 0.4, 1.2, 10.0),
('bs019', 'NFC Controller Failure', NULL, NULL, '0.3A → 0.8A → 1.2A → 0.45A (NFC not working)', 'warning', 'NFC controller not responding', 'Check NFC IC I2C lines, antenna connection, NFC PMIC', 0.45, 1.2, 10.0),
('bs020', 'Fingerprint Sensor Failure', NULL, NULL, '0.3A → 0.8A → 1.2A → 0.4A (fingerprint error)', 'warning', 'Fingerprint sensor communication failing', 'Check FPC connector, SPI/I2C lines to sensor, sensor power rail', 0.4, 1.2, 10.0);
