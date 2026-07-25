use serialport::{DataBits, Parity, StopBits};
use std::time::Duration;
use log::{info, warn};

use crate::{HalError, Result};

/// Voltage levels for UART level shifting
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum VoltageLevel {
    V1_2,
    V1_8,
    V3_3,
    V5_0,
}

impl VoltageLevel {
    /// Get voltage as float
    pub fn as_volts(&self) -> f32 {
        match self {
            VoltageLevel::V1_2 => 1.2,
            VoltageLevel::V1_8 => 1.8,
            VoltageLevel::V3_3 => 3.3,
            VoltageLevel::V5_0 => 5.0,
        }
    }
    
    /// Parse from string
    pub fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "1.2" | "1_2" | "1v2" => Ok(VoltageLevel::V1_2),
            "1.8" | "1_8" | "1v8" => Ok(VoltageLevel::V1_8),
            "3.3" | "3_3" | "3v3" => Ok(VoltageLevel::V3_3),
            "5.0" | "5_0" | "5v0" | "5" => Ok(VoltageLevel::V5_0),
            _ => Err(HalError::InvalidConfig(format!("Invalid voltage level: {}", s))),
        }
    }
}

/// UART configuration
#[derive(Debug, Clone)]
pub struct UARTConfig {
    pub port: String,
    pub baud_rate: u32,
    pub data_bits: DataBits,
    pub parity: Parity,
    pub stop_bits: StopBits,
    pub timeout: Duration,
    pub voltage_level: Option<VoltageLevel>,
}

impl Default for UARTConfig {
    fn default() -> Self {
        Self {
            port: if cfg!(target_os = "windows") {
                "COM3".to_string()
            } else {
                "/dev/ttyUSB0".to_string()
            },
            baud_rate: 115200,
            data_bits: DataBits::Eight,
            parity: Parity::None,
            stop_bits: StopBits::One,
            timeout: Duration::from_millis(100),
            voltage_level: Some(VoltageLevel::V3_3),
        }
    }
}

/// UART interface for serial communication
pub struct UART {
    port: Option<Box<dyn serialport::SerialPort>>,
    config: UARTConfig,
}

impl UART {
    /// Create a new UART interface
    pub fn new(config: UARTConfig) -> Self {
        Self {
            port: None,
            config,
        }
    }
    
    /// Open the serial port
    pub fn open(&mut self) -> Result<()> {
        info!("Opening UART port: {} at {} baud", self.config.port, self.config.baud_rate);
        
        let port = serialport::new(
            &self.config.port,
            self.config.baud_rate,
        )
        .data_bits(self.config.data_bits)
        .parity(self.config.parity)
        .stop_bits(self.config.stop_bits)
        .timeout(self.config.timeout)
        .open()
        .map_err(|e| HalError::Serial(e))?;
        
        self.port = Some(port);
        info!("UART port opened successfully");
        
        Ok(())
    }
    
    /// Close the serial port
    pub fn close(&mut self) -> Result<()> {
        if let Some(port) = self.port.take() {
            drop(port);
            info!("UART port closed");
        }
        Ok(())
    }
    
    /// Write data to the serial port
    pub fn write(&mut self, data: &[u8]) -> Result<usize> {
        let port = self.port.as_mut()
            .ok_or_else(|| HalError::DeviceNotFound("UART port not open".to_string()))?;
        
        let bytes_written = port.write(data)
            .map_err(|e| HalError::Serial(e))?;
        
        port.flush().map_err(|e| HalError::Serial(e))?;
        
        Ok(bytes_written)
    }
    
    /// Read data from the serial port
    pub fn read(&mut self, buffer: &mut [u8]) -> Result<usize> {
        let port = self.port.as_mut()
            .ok_or_else(|| HalError::DeviceNotFound("UART port not open".to_string()))?;
        
        let bytes_read = port.read(buffer)
            .map_err(|e| HalError::Serial(e))?;
        
        Ok(bytes_read)
    }
    
    /// Read a line (until newline character)
    pub fn read_line(&mut self) -> Result<String> {
        let mut buffer = Vec::new();
        let mut byte = [0u8; 1];
        
        loop {
            match self.read(&mut byte) {
                Ok(1) => {
                    if byte[0] == b'\n' {
                        break;
                    }
                    buffer.push(byte[0]);
                }
                Ok(_) => continue,
                Err(e) => return Err(e),
            }
        }
        
        String::from_utf8(buffer)
            .map_err(|e| HalError::Protocol(format!("Invalid UTF-8: {}", e)))
    }
    
    /// Write a string with newline
    pub fn write_line(&mut self, line: &str) -> Result<usize> {
        let mut data = line.as_bytes().to_vec();
        data.push(b'\n');
        self.write(&data)
    }
    
    /// Get list of available serial ports
    pub fn list_ports() -> Result<Vec<String>> {
        let ports = serialport::available_ports()
            .map_err(|e| HalError::Serial(e))?;
        
        Ok(ports.into_iter().map(|p| p.port_name).collect())
    }
    
    /// Set voltage level (for level shifters)
    pub fn set_voltage(&mut self, level: VoltageLevel) -> Result<()> {
        info!("Setting UART voltage to {:?}", level);
        self.config.voltage_level = Some(level);
        // In real implementation, this would control GPIO pins for level shifting
        Ok(())
    }
    
    /// Get current voltage level
    pub fn get_voltage(&self) -> Option<VoltageLevel> {
        self.config.voltage_level
    }
    
    /// Auto-detect voltage from target device
    pub fn auto_detect_voltage(&mut self) -> Result<VoltageLevel> {
        // In real implementation, this would read ADC to detect voltage
        // For now, return default
        warn!("Auto-detect voltage not implemented, using 3.3V");
        Ok(VoltageLevel::V3_3)
    }
}

impl Drop for UART {
    fn drop(&mut self) {
        let _ = self.close();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_voltage_level_parsing() {
        assert_eq!(VoltageLevel::from_str("3.3").unwrap(), VoltageLevel::V3_3);
        assert_eq!(VoltageLevel::from_str("1.8").unwrap(), VoltageLevel::V1_8);
        assert_eq!(VoltageLevel::from_str("5v0").unwrap(), VoltageLevel::V5_0);
    }
    
    #[test]
    fn test_voltage_as_volts() {
        assert_eq!(VoltageLevel::V1_2.as_volts(), 1.2);
        assert_eq!(VoltageLevel::V3_3.as_volts(), 3.3);
    }
}
