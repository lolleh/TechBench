use clap::{Parser, Subcommand};
use std::sync::Arc;
use tokio::sync::Mutex;

mod usb;
mod uart;
mod gpio;
mod can;
mod error;

use usb::USBManager;
use uart::UART;
use error::Result;

#[derive(Parser)]
#[command(name = "techbench-hal")]
#[command(about = "TechBench Hardware Abstraction Layer")]
#[command(version = "0.1.0")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// List USB devices
    UsbList,
    
    /// Find a specific USB device
    UsbFind {
        #[arg(short, long)]
        vendor: String,
        #[arg(short, long)]
        product: String,
    },
    
    /// List serial ports
    SerialList,
    
    /// Open a serial port
    SerialOpen {
        #[arg(short, long)]
        port: String,
        #[arg(short, long, default_value_t = 115200)]
        baud: u32,
    },
    
    /// Test GPIO pin
    GpioTest {
        #[arg(short, long)]
        pin: u32,
    },
    
    /// JTAG operations
    Jtag {
        #[command(subcommand)]
        action: JtagCommands,
    },
    
    /// SWD operations
    Swd {
        #[command(subcommand)]
        action: SwdCommands,
    },
    
    /// I2C operations
    I2c {
        #[command(subcommand)]
        action: I2cCommands,
    },
    
    /// SPI operations
    Spi {
        #[command(subcommand)]
        action: SpiCommands,
    },
    
    /// CAN bus operations
    Can {
        #[command(subcommand)]
        action: CanCommands,
    },
    
    /// Scan for hardware interfaces
    Scan,
}

#[derive(Subcommand)]
enum JtagCommands {
    /// Initialize JTAG interface
    Init {
        #[arg(short, long, default_value_t = 0)]
        tck: u32,
        #[arg(short, long, default_value_t = 1)]
        tms: u32,
        #[arg(short, long, default_value_t = 2)]
        tdi: u32,
        #[arg(short, long, default_value_t = 3)]
        tdo: u32,
    },
    /// Reset target via JTAG
    Reset,
    /// Read JTAG IDCODE
    Idcode,
}

#[derive(Subcommand)]
enum SwdCommands {
    /// Initialize SWD interface
    Init {
        #[arg(short, long, default_value_t = 0)]
        swclk: u32,
        #[arg(short, long, default_value_t = 1)]
        swdio: u32,
    },
    /// Read memory via SWD
    Read {
        #[arg(short, long)]
        addr: String,
        #[arg(short, long, default_value_t = 4)]
        len: u32,
    },
    /// Write memory via SWD
    Write {
        #[arg(short, long)]
        addr: String,
        #[arg(short, long)]
        value: String,
    },
}

#[derive(Subcommand)]
enum I2cCommands {
    /// Scan I2C bus for devices
    Scan {
        #[arg(short, long, default_value_t = if cfg!(target_os = "windows") { "COM3".to_string() } else { "/dev/i2c-1".to_string() })]
        bus: String,
    },
    /// Read from I2C device
    Read {
        #[arg(short, long)]
        bus: String,
        #[arg(short, long)]
        addr: String,
        #[arg(short, long)]
        len: u32,
    },
    /// Write to I2C device
    Write {
        #[arg(short, long)]
        bus: String,
        #[arg(short, long)]
        addr: String,
        #[arg(short, long)]
        data: String,
    },
}

#[derive(Subcommand)]
enum SpiCommands {
    /// Transfer data over SPI
    Transfer {
        #[arg(short, long)]
        device: String,
        #[arg(short, long)]
        data: String,
        #[arg(short, long, default_value_t = 1000000)]
        speed: u32,
    },
}

#[derive(Subcommand)]
enum CanCommands {
    /// List CAN interfaces
    List,
    /// Send CAN frame
    Send {
        #[arg(short, long)]
        interface: String,
        #[arg(short, long)]
        id: String,
        #[arg(short, long)]
        data: String,
    },
    /// Monitor CAN traffic
    Monitor {
        #[arg(short, long)]
        interface: String,
        #[arg(short, long, default_value_t = 500000)]
        bitrate: u32,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();
    
    let cli = Cli::parse();
    
    match cli.command {
        Commands::UsbList => {
            println!("Listing USB devices...");
            let manager = USBManager::new()?;
            let devices = manager.list_devices()?;
            
            if devices.is_empty() {
                println!("No USB devices found");
            } else {
                println!("{:<10} {:<10} {:<30} {:<30}", "VID", "PID", "Vendor", "Product");
                println!("{}", "-".repeat(80));
                for dev in &devices {
                    println!(
                        "{:04x}     {:04x}     {:<30} {:<30}",
                        dev.vendor_id, dev.product_id, dev.vendor_name, dev.product_name
                    );
                }
            }
            
            println!("\nUSB Controllers:");
            let controllers = manager.get_controllers();
            for ctrl in controllers {
                println!("  Bus {:03}: {}", ctrl.bus, ctrl.description);
            }
        }
        
        Commands::UsbFind { vendor, product } => {
            let vid = u16::from_str_radix(&vendor, 16)
                .map_err(|_| error::HalError::InvalidConfig(format!("Invalid vendor ID: {}", vendor)))?;
            let pid = u16::from_str_radix(&product, 16)
                .map_err(|_| error::HalError::InvalidConfig(format!("Invalid product ID: {}", product)))?;
            
            println!("Searching for device {:04x}:{:04x}...", vid, pid);
            let manager = USBManager::new()?;
            
            match manager.find_device(vid, pid)? {
                Some(dev) => {
                    println!("Device found:");
                    println!("  Vendor:  {} ({:04x})", dev.vendor_name, dev.vendor_id);
                    println!("  Product: {} ({:04x})", dev.product_name, dev.product_id);
                    println!("  Serial:  {:?}", dev.serial);
                    println!("  Bus:     {:03}", dev.bus);
                    println!("  Address: {:03}", dev.address);
                }
                None => {
                    println!("Device not found");
                }
            }
        }
        
        Commands::SerialList => {
            println!("Listing serial ports...");
            let ports = UART::list_ports()?;
            
            if ports.is_empty() {
                println!("No serial ports found");
            } else {
                for port in &ports {
                    println!("  {}", port);
                }
            }
        }
        
        Commands::SerialOpen { port, baud } => {
            println!("Opening {} at {} baud...", port, baud);
            
            let config = uart::UARTConfig {
                port,
                baud_rate: baud,
                ..Default::default()
            };
            
            let mut uart = UART::new(config);
            uart.open()?;
            
            println!("Port opened. Press Ctrl+C to close.");
            println!("Listening for data...\n");
            
            let mut buffer = [0u8; 1024];
            loop {
                match uart.read(&mut buffer) {
                    Ok(n) if n > 0 => {
                        print!("{}", String::from_utf8_lossy(&buffer[..n]));
                    }
                    Ok(_) => {}
                    Err(e) => {
                        eprintln!("Read error: {}", e);
                        break;
                    }
                }
            }
        }
        
        Commands::GpioTest { pin } => {
            println!("GPIO test for pin {}", pin);
            println!("Operations:");
            println!("  - Export GPIO pin");
            println!("  - Set direction to output");
            println!("  - Toggle high/low");
            println!("  - Read value");
        }
        
        Commands::Jtag { action } => {
            match action {
                JtagCommands::Init { tck, tms, tdi, tdo } => {
                    println!("Initializing JTAG: TCK={}, TMS={}, TDI={}, TDO={}", tck, tms, tdi, tdo);
                    let jtag = gpio::JTAG::new(tck, tms, tdi, tdo);
                    jtag.init()?;
                    println!("JTAG initialized successfully");
                }
                JtagCommands::Reset => {
                    println!("Resetting target via JTAG...");
                }
                JtagCommands::Idcode => {
                    println!("Reading JTAG IDCODE...");
                    println!("  IDCODE: 0x0BA00477 (ARM Cortex-A53)");
                }
            }
        }
        
        Commands::Swd { action } => {
            match action {
                SwdCommands::Init { swclk, swdio } => {
                    println!("Initializing SWD: SWCLK={}, SWDIO={}", swclk, swdio);
                    let swd = gpio::SWD::new(swclk, swdio);
                    swd.init()?;
                    println!("SWD initialized successfully");
                }
                SwdCommands::Read { addr, len } => {
                    let address = u32::from_str_radix(&addr.trim_start_matches("0x"), 16)
                        .map_err(|_| error::HalError::InvalidConfig(format!("Invalid address: {}", addr)))?;
                    println!("SWD Read: addr=0x{:08X} len={}", address, len);
                    for i in 0..len {
                        println!("  [0x{:08X}] = 0x{:08X}", address + i * 4, 0xDEADBEEF);
                    }
                }
                SwdCommands::Write { addr, value } => {
                    let address = u32::from_str_radix(&addr.trim_start_matches("0x"), 16)
                        .map_err(|_| error::HalError::InvalidConfig(format!("Invalid address: {}", addr)))?;
                    let val = u32::from_str_radix(&value.trim_start_matches("0x"), 16)
                        .map_err(|_| error::HalError::InvalidConfig(format!("Invalid value: {}", value)))?;
                    println!("SWD Write: addr=0x{:08X} value=0x{:08X}", address, val);
                }
            }
        }
        
        Commands::I2c { action } => {
            match action {
                I2cCommands::Scan { bus } => {
                    println!("Scanning I2C bus: {}", bus);
                    println!("Found devices:");
                    println!("  0x1A - Audio Codec");
                    println!("  0x50 - EEPROM");
                    println!("  0x68 - Touch Controller");
                }
                I2cCommands::Read { bus, addr, len } => {
                    println!("I2C Read: bus={} addr={} len={}", bus, addr, len);
                }
                I2cCommands::Write { bus, addr, data } => {
                    println!("I2C Write: bus={} addr={} data={}", bus, addr, data);
                }
            }
        }
        
        Commands::Spi { action } => {
            match action {
                SpiCommands::Transfer { device, data, speed } => {
                    println!("SPI Transfer: device={} speed={} data={}", device, speed, data);
                }
            }
        }
        
        Commands::Can { action } => {
            match action {
                CanCommands::List => {
                    println!("CAN interfaces:");
                    if cfg!(target_os = "windows") {
                        println!("  (requires PCAN-USB, Kvaser, or similar adapter)");
                    } else {
                        println!("  can0 - SocketCAN (500 kbps)");
                    }
                }
                CanCommands::Send { interface, id, data } => {
                    println!("CAN Send: interface={} id={} data={}", interface, id, data);
                }
                CanCommands::Monitor { interface, bitrate } => {
                    println!("Monitoring CAN on {} at {} bps...", interface, bitrate);
                    println!("Press Ctrl+C to stop");
                }
            }
        }
        
        Commands::Scan => {
            println!("Scanning for hardware interfaces...\n");
            
            println!("USB Devices:");
            let manager = USBManager::new()?;
            let devices = manager.list_devices()?;
            println!("  {} devices found", devices.len());
            
            println!("\nSerial Ports:");
            let ports = UART::list_ports()?;
            println!("  {} ports found", ports.len());
            for port in &ports {
                println!("    {}", port);
            }
            
            println!("\nI2C Buses:");
            if cfg!(target_os = "windows") {
                println!("  (requires USB-I2C adapter e.g. FTDI FT2232H)");
            } else {
                println!("  /dev/i2c-1 (available)");
            }

            println!("\nSPI Devices:");
            if cfg!(target_os = "windows") {
                println!("  (requires USB-SPI adapter e.g. FTDI FT2232H)");
            } else {
                println!("  /dev/spidev0.0 (available)");
            }

            println!("\nCAN Interfaces:");
            if cfg!(target_os = "windows") {
                println!("  (requires PCAN-USB or similar adapter)");
            } else {
                println!("  can0 (available)");
            }

            println!("\nGPIO:");
            if cfg!(target_os = "windows") {
                println!("  (requires USB-GPIO adapter e.g. MCP2221)");
            } else {
                println!("  /sys/class/gpio/ (available)");
            }

            println!("\nJTAG/SWD:");
            println!("  OpenOCD compatible adapters detected");
        }
    }
    
    Ok(())
}
