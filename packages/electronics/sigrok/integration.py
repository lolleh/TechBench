#!/usr/bin/env python3
"""
TechBench - Sigrok Integration
Wrapper for sigrok-cli with mobile-specific protocol decoders
"""

import os
import sys
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class SigrokSession:
    """Sigrok capture session configuration"""
    session_id: str
    device: str
    sample_rate: int
    channels: List[str]
    protocol_decoders: List[str]
    trigger: Optional[str] = None
    output_file: Optional[str] = None


class SigrokIntegration:
    """Integration with sigrok-cli for logic analyzer and protocol decoding"""
    
    # Mobile-specific protocol decoder configurations
    PROTOCOL_CONFIGS = {
        'i2c-pmic': {
            'name': 'I2C (PMIC Communication)',
            'decoder': 'i2c',
            'channels': {'sda': 'D0', 'scl': 'D1'},
            'description': 'Monitor I2C communication with PMIC chips',
        },
        'spi-ufs': {
            'name': 'SPI (UFS Storage)',
            'decoder': 'spi',
            'channels': {'clk': 'D0', 'mosi': 'D1', 'miso': 'D2', 'cs': 'D3'},
            'description': 'Monitor SPI communication with UFS storage',
        },
        'uart-baseband': {
            'name': 'UART (Baseband Debug)',
            'decoder': 'uart',
            'channels': {'rx': 'D0', 'tx': 'D1'},
            'options': {'baudrate': 115200},
            'description': 'Monitor UART debug output from baseband processor',
        },
        'usb-pd': {
            'name': 'USB-PD (Power Delivery)',
            'decoder': 'usb-pd',
            'channels': {'cc1': 'D0', 'cc2': 'D1'},
            'description': 'Monitor USB Power Delivery negotiations',
        },
        'jtag': {
            'name': 'JTAG',
            'decoder': 'jtag',
            'channels': {'tck': 'D0', 'tms': 'D1', 'tdi': 'D2', 'tdo': 'D3'},
            'description': 'Monitor JTAG debug interface',
        },
        'swd': {
            'name': 'SWD (Serial Wire Debug)',
            'decoder': 'arm_swd',
            'channels': {'swclk': 'D0', 'swdio': 'D1'},
            'description': 'Monitor ARM SWD debug interface',
        },
    }
    
    def __init__(self):
        self.sigrok_cli = self._find_sigrok_cli()
        self.supported_devices = self._get_supported_devices()
    
    def _find_sigrok_cli(self) -> str:
        """Find sigrok-cli binary"""
        try:
            result = subprocess.run(['which', 'sigrok-cli'], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip()
        except:
            pass
        
        # Try common locations
        common_paths = [
            '/usr/bin/sigrok-cli',
            '/usr/local/bin/sigrok-cli',
            '/opt/sigrok/bin/sigrok-cli',
        ]
        
        for path in common_paths:
            if os.path.exists(path):
                return path
        
        raise FileNotFoundError("sigrok-cli not found. Please install sigrok-cli.")
    
    def _get_supported_devices(self) -> List[str]:
        """Get list of supported logic analyzer devices"""
        try:
            result = subprocess.run(
                [self.sigrok_cli, '--list-supported'],
                capture_output=True,
                text=True
            )
            
            devices = []
            for line in result.stdout.split('\n'):
                if line.strip() and not line.startswith('Supported'):
                    # Extract device name
                    parts = line.strip().split()
                    if parts:
                        devices.append(parts[0])
            
            return devices
        except Exception as e:
            logger.error(f"Failed to get supported devices: {e}")
            return []
    
    def list_devices(self) -> List[Dict[str, str]]:
        """List connected logic analyzer devices"""
        try:
            result = subprocess.run(
                [self.sigrok_cli, '--scan'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            devices = []
            for line in result.stdout.split('\n'):
                if ':' in line and 'Demo' not in line:
                    parts = line.strip().split(':')
                    if len(parts) >= 2:
                        devices.append({
                            'driver': parts[0].strip(),
                            'channels': parts[1].strip() if len(parts) > 1 else '',
                        })
            
            return devices
        except Exception as e:
            logger.error(f"Failed to list devices: {e}")
            return []
    
    def create_session(self, config: SigrokSession) -> bool:
        """Create a new capture session"""
        # Build command
        cmd = [self.sigrok_cli]
        
        # Device
        cmd.extend(['-d', config.device])
        
        # Sample rate
        cmd.extend(['-s', str(config.sample_rate)])
        
        # Channels
        if config.channels:
            cmd.extend(['-c', ','.join(config.channels)])
        
        # Protocol decoders
        if config.protocol_decoders:
            cmd.extend(['-P', ','.join(config.protocol_decoders)])
        
        # Trigger
        if config.trigger:
            cmd.extend(['--triggers', config.trigger])
        
        # Output file
        if config.output_file:
            cmd.extend(['-o', config.output_file])
        
        # Log the command
        logger.info(f"Sigrok command: {' '.join(cmd)}")
        
        return True
    
    def capture(self, duration: float = 1.0, output_file: Optional[str] = None) -> str:
        """Perform a capture"""
        if not output_file:
            output_file = tempfile.mktemp(suffix='.sr')
        
        cmd = [
            self.sigrok_cli,
            '-d', 'fx2lafw',  # Default device
            '-s', '1000000',  # 1MHz sample rate
            '-c', 'D0,D1,D2,D3',
            '-P', 'i2c:sda=D0:scl=D1',
            '-o', output_file,
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=duration + 5
            )
            
            if result.returncode == 0:
                logger.info(f"Capture saved to {output_file}")
                return output_file
            else:
                logger.error(f"Capture failed: {result.stderr}")
                return ""
        except subprocess.TimeoutExpired:
            logger.warning("Capture timed out")
            return ""
        except Exception as e:
            logger.error(f"Capture error: {e}")
            return ""
    
    def decode_protocol(self, input_file: str, decoder: str, output_file: Optional[str] = None) -> str:
        """Decode protocol from capture file"""
        if not output_file:
            output_file = tempfile.mktemp(suffix='.txt')
        
        cmd = [
            self.sigrok_cli,
            '-i', input_file,
            '-P', decoder,
            '-A', output_file,
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                logger.info(f"Protocol decoded to {output_file}")
                return output_file
            else:
                logger.error(f"Decode failed: {result.stderr}")
                return ""
        except Exception as e:
            logger.error(f"Decode error: {e}")
            return ""
    
    def get_protocol_config(self, protocol: str) -> Optional[Dict]:
        """Get configuration for a specific protocol"""
        return self.PROTOCOL_CONFIGS.get(protocol)
    
    def list_protocols(self) -> List[Dict[str, str]]:
        """List available protocol decoders"""
        protocols = []
        for key, config in self.PROTOCOL_CONFIGS.items():
            protocols.append({
                'id': key,
                'name': config['name'],
                'description': config['description'],
            })
        return protocols
    
    def configure_channels(self, protocol: str, channels: Dict[str, str]) -> Dict:
        """Configure channels for a protocol"""
        config = self.get_protocol_config(protocol)
        if not config:
            return {}
        
        # Merge with provided channels
        configured_channels = {**config.get('channels', {}), **channels}
        
        return {
            'protocol': protocol,
            'channels': configured_channels,
            'decoder': config['decoder'],
        }


class SigrokManager:
    """High-level manager for Sigrok operations"""
    
    def __init__(self):
        self.integration = SigrokIntegration()
        self.active_session = None
    
    def start_i2c_capture(self, sda: str = 'D0', scl: str = 'D1', baudrate: int = 100000):
        """Start I2C capture for PMIC communication"""
        config = SigrokSession(
            session_id='i2c-pmic',
            device='fx2lafw',
            sample_rate=1000000,
            channels=[sda, scl],
            protocol_decoders=[f'i2c:sda={sda}:scl={scl}'],
        )
        
        self.integration.create_session(config)
        self.active_session = config
        
        logger.info(f"Started I2C capture on {sda}/{scl}")
    
    def start_uart_capture(self, rx: str = 'D0', tx: str = 'D1', baudrate: int = 115200):
        """Start UART capture for baseband debug"""
        config = SigrokSession(
            session_id='uart-baseband',
            device='fx2lafw',
            sample_rate=baudrate * 4,
            channels=[rx, tx],
            protocol_decoders=[f'uart:rx={rx}:tx={tx}:baudrate={baudrate}'],
        )
        
        self.integration.create_session(config)
        self.active_session = config
        
        logger.info(f"Started UART capture on {rx}/{tx} at {baudrate} baud")
    
    def start_usb_pd_capture(self, cc1: str = 'D0', cc2: str = 'D1'):
        """Start USB-PD capture for power delivery analysis"""
        config = SigrokSession(
            session_id='usb-pd',
            device='fx2lafw',
            sample_rate=10000000,
            channels=[cc1, cc2],
            protocol_decoders=[f'usb-pd:cc1={cc1}:cc2={cc2}'],
        )
        
        self.integration.create_session(config)
        self.active_session = config
        
        logger.info(f"Started USB-PD capture on {cc1}/{cc2}")
    
    def stop_capture(self):
        """Stop active capture"""
        if self.active_session:
            logger.info(f"Stopped capture: {self.active_session.session_id}")
            self.active_session = None
    
    def get_status(self) -> Dict:
        """Get current capture status"""
        if self.active_session:
            return {
                'active': True,
                'session': self.active_session.session_id,
                'device': self.active_session.device,
                'channels': self.active_session.channels,
            }
        return {'active': False}


def main():
    """CLI entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='TechBench Sigrok Integration')
    parser.add_argument('command', choices=['list-devices', 'list-protocols', 'capture', 'decode'])
    parser.add_argument('--device', default='fx2lafw', help='Logic analyzer device')
    parser.add_argument('--protocol', help='Protocol decoder to use')
    parser.add_argument('--duration', type=float, default=1.0, help='Capture duration in seconds')
    parser.add_argument('--output', help='Output file path')
    
    args = parser.parse_args()
    
    integration = SigrokIntegration()
    
    if args.command == 'list-devices':
        devices = integration.list_devices()
        print("Connected devices:")
        for dev in devices:
            print(f"  {dev['driver']}: {dev['channels']}")
    
    elif args.command == 'list-protocols':
        protocols = integration.list_protocols()
        print("Available protocols:")
        for proto in protocols:
            print(f"  {proto['id']}: {proto['name']}")
            print(f"    {proto['description']}")
    
    elif args.command == 'capture':
        output = integration.capture(args.duration, args.output)
        if output:
            print(f"Capture saved to: {output}")
    
    elif args.command == 'decode':
        if not args.protocol:
            print("Error: --protocol required for decode command")
            sys.exit(1)
        
        output = integration.decode_protocol(args.output, args.protocol)
        if output:
            print(f"Decoded output: {output}")


if __name__ == '__main__':
    main()
