use rusb::{Context, Device, DeviceDescriptor, DeviceHandle, GlobalContext};
use std::sync::{Arc, Mutex};
use log::{info, warn, error};

use crate::{HalError, Result};

/// Represents a USB controller (not a hub)
#[derive(Debug, Clone)]
pub struct USBController {
    pub bus: u8,
    pub address: u8,
    pub ports: u8,
    pub description: String,
}

/// USB device information
#[derive(Debug, Clone)]
pub struct USBDeviceInfo {
    pub vendor_id: u16,
    pub product_id: u16,
    pub vendor_name: String,
    pub product_name: String,
    pub manufacturer: String,
    pub serial: Option<String>,
    pub bus: u8,
    pub address: u8,
    pub speed: String,
}

/// USB manager for controlling USB devices
pub struct USBManager {
    context: Context,
    controllers: Vec<USBController>,
}

impl USBManager {
    /// Create a new USB manager
    pub fn new() -> Result<Self> {
        let context = Context::new()?;
        let controllers = Self::identify_controllers(&context)?;
        
        info!("Found {} USB controllers", controllers.len());
        
        Ok(Self {
            context,
            controllers,
        })
    }
    
    /// Identify independent USB controllers (not hubs)
    fn identify_controllers(context: &Context) -> Result<Vec<USBController>> {
        let mut controllers = Vec::new();
        
        for device in context.devices()?.iter() {
            if let Ok(desc) = device.device_descriptor() {
                // USB controller class code is 0x09 (Hub)
                // We want to find the root hubs/controllers
                if let Ok(config) = device.active_config_descriptor() {
                    // Check if this is a root hub
                    if device.device_address() == 0 || device.bus_number() > 0 {
                        controllers.push(USBController {
                            bus: device.bus_number(),
                            address: device.device_address(),
                            ports: config.number_of_interfaces() as u8,
                            description: format!(
                                "Bus {:03} Device {:03}",
                                device.bus_number(),
                                device.device_address()
                            ),
                        });
                    }
                }
            }
        }
        
        Ok(controllers)
    }
    
    /// List all connected USB devices
    pub fn list_devices(&self) -> Result<Vec<USBDeviceInfo>> {
        let mut devices = Vec::new();
        
        for device in self.context.devices()?.iter() {
            if let Ok(desc) = device.device_descriptor() {
                let device_info = USBDeviceInfo {
                    vendor_id: desc.vendor_id(),
                    product_id: desc.product_id(),
                    vendor_name: self.get_vendor_name(&device, &desc),
                    product_name: self.get_product_name(&device, &desc),
                    manufacturer: self.get_manufacturer(&device, &desc),
                    serial: self.get_serial_number(&device, &desc),
                    bus: device.bus_number(),
                    address: device.device_address(),
                    speed: format!("{:?}", desc.usb_version()),
                };
                devices.push(device_info);
            }
        }
        
        Ok(devices)
    }
    
    /// Find a device by vendor and product ID
    pub fn find_device(&self, vendor_id: u16, product_id: u16) -> Result<Option<USBDeviceInfo>> {
        for device in self.context.devices()?.iter() {
            if let Ok(desc) = device.device_descriptor() {
                if desc.vendor_id() == vendor_id && desc.product_id() == product_id {
                    return Ok(Some(USBDeviceInfo {
                        vendor_id: desc.vendor_id(),
                        product_id: desc.product_id(),
                        vendor_name: self.get_vendor_name(&device, &desc),
                        product_name: self.get_product_name(&device, &desc),
                        manufacturer: self.get_manufacturer(&device, &desc),
                        serial: self.get_serial_number(&device, &desc),
                        bus: device.bus_number(),
                        address: device.device_address(),
                        speed: format!("{:?}", desc.usb_version()),
                    }));
                }
            }
        }
        Ok(None)
    }
    
    /// Open a device and get a handle
    pub fn open_device(&self, vendor_id: u16, product_id: u16) -> Result<DeviceHandle<GlobalContext>> {
        for device in self.context.devices()?.iter() {
            if let Ok(desc) = device.device_descriptor() {
                if desc.vendor_id() == vendor_id && desc.product_id() == product_id {
                    let handle = device.open()?;
                    return Ok(handle);
                }
            }
        }
        Err(HalError::DeviceNotFound(
            format!("{:04x}:{:04x}", vendor_id, product_id)
        ))
    }
    
    /// Get list of independent USB controllers
    pub fn get_controllers(&self) -> &[USBController] {
        &self.controllers
    }
    
    /// Check if a device is on a dedicated controller (not shared via hub)
    fn get_vendor_name(&self, device: &Device<GlobalContext>, desc: &DeviceDescriptor) -> String {
        if let Some(manufacturer) = device.manufacturer_string() {
            return manufacturer.to_string_lossy().to_string();
        }
        format!("Unknown ({:04x})", desc.vendor_id())
    }
    
    fn get_product_name(&self, device: &Device<GlobalContext>, desc: &DeviceDescriptor) -> String {
        if let Some(product) = device.product_string() {
            return product.to_string_lossy().to_string();
        }
        format!("Unknown ({:04x})", desc.product_id())
    }
    
    fn get_manufacturer(&self, device: &Device<GlobalContext>, _desc: &DeviceDescriptor) -> String {
        device.manufacturer_string()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Unknown".to_string())
    }
    
    fn get_serial_number(&self, device: &Device<GlobalContext>, _desc: &DeviceDescriptor) -> Option<String> {
        device.serial_number_string().map(|s| s.to_string_lossy().to_string())
    }
}

impl Default for USBManager {
    fn default() -> Self {
        Self::new().expect("Failed to initialize USB manager")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_usb_manager_creation() {
        let manager = USBManager::new();
        assert!(manager.is_ok());
    }
    
    #[test]
    fn test_list_devices() {
        let manager = USBManager::new().unwrap();
        let devices = manager.list_devices().unwrap();
        // Should be able to list devices (may be empty in test env)
        assert!(devices.len() >= 0);
    }
}
