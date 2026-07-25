use thiserror::Error;

#[derive(Error, Debug)]
pub enum HalError {
    #[error("USB error: {0}")]
    Usb(#[from] rusb::Error),

    #[error("Serial port error: {0}")]
    Serial(#[from] serialport::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Device not found: {0}")]
    DeviceNotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("Protocol error: {0}")]
    Protocol(String),

    #[error("JTAG error: {0}")]
    JtagError(String),

    #[error("SWD error: {0}")]
    SwdError(String),

    #[error("I2C error: {0}")]
    I2cError(String),

    #[error("SPI error: {0}")]
    SpiError(String),

    #[error("CAN error: {0}")]
    CanError(String),

    #[error("GPIO error: {0}")]
    GpioError(String),
}

pub type Result<T> = std::result::Result<T, HalError>;
