use std::sync::{Arc, Mutex};
use std::time::Duration;
use log::{info, warn};

use crate::{HalError, Result};

/// CAN bus speed
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CANSpeed {
    Speed125k,
    Speed250k,
    Speed500k,
    Speed1M,
}

impl CANSpeed {
    pub fn as_bps(&self) -> u32 {
        match self {
            CANSpeed::Speed125k => 125_000,
            CANSpeed::Speed250k => 250_000,
            CANSpeed::Speed500k => 500_000,
            CANSpeed::Speed1M => 1_000_000,
        }
    }
}

/// CAN message
#[derive(Debug, Clone)]
pub struct CANFrame {
    pub id: u32,
    pub data: Vec<u8>,
    pub is_extended: bool,
    pub is_remote: bool,
    pub timestamp: Option<u64>,
}

/// CAN bus interface for automotive and embedded communication
pub struct CANBus {
    interface: String,
    speed: CANSpeed,
    connected: bool,
    frames: Arc<Mutex<Vec<CANFrame>>>,
}

impl CANBus {
    pub fn new(interface: &str, speed: CANSpeed) -> Self {
        Self {
            interface: interface.to_string(),
            speed,
            connected: false,
            frames: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn connect(&mut self) -> Result<()> {
        info!(
            "Connecting to CAN interface {} at {} bps",
            self.interface,
            self.speed.as_bps()
        );
        self.connected = true;
        Ok(())
    }

    pub fn disconnect(&mut self) -> Result<()> {
        info!("Disconnecting CAN interface {}", self.interface);
        self.connected = false;
        Ok(())
    }

    pub fn send_frame(&self, frame: CANFrame) -> Result<()> {
        if !self.connected {
            return Err(HalError::Protocol("CAN not connected".to_string()));
        }
        info!(
            "CAN TX: ID=0x{:03X} DLC={} Data={:02X?}",
            frame.id,
            frame.data.len(),
            frame.data
        );
        Ok(())
    }

    pub fn receive_frame(&self, timeout: Duration) -> Result<Option<CANFrame>> {
        if !self.connected {
            return Err(HalError::Protocol("CAN not connected".to_string()));
        }
        let frames = self.frames.lock().unwrap();
        Ok(frames.first().cloned())
    }

    pub fn set_filter(&self, id: u32, mask: u32) -> Result<()> {
        info!("Setting CAN filter: ID=0x{:03X} Mask=0x{:03X}", id, mask);
        Ok(())
    }

    pub fn get_statistics(&self) -> Result<CANStatistics> {
        let frames = self.frames.lock().unwrap();
        Ok(CANStatistics {
            total_frames: frames.len() as u64,
            error_frames: 0,
            tx_frames: 0,
            rx_frames: frames.len() as u64,
        })
    }
}

#[derive(Debug, Clone)]
pub struct CANStatistics {
    pub total_frames: u64,
    pub error_frames: u64,
    pub tx_frames: u64,
    pub rx_frames: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_speed() {
        assert_eq!(CANSpeed::Speed500k.as_bps(), 500_000);
        assert_eq!(CANSpeed::Speed1M.as_bps(), 1_000_000);
    }

    #[test]
    fn test_can_creation() {
        let interface = if cfg!(target_os = "windows") { "PCAN_USBBUS1" } else { "can0" };
        let can = CANBus::new(interface, CANSpeed::Speed500k);
        assert_eq!(can.interface, interface);
        assert!(!can.connected);
    }
}
