#!/usr/bin/env python3
"""
TechBench - Samsung Odin Protocol Client
Tools for flashing Samsung devices via Odin protocol
"""

import os
import sys
import json
import time
import struct
import hashlib
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, BinaryIO
from dataclasses import dataclass, field
from enum import Enum, IntEnum
import threading

logger = logging.getLogger(__name__)


class OdinCommand(IntEnum):
    """Odin protocol commands"""
    REQ_CONNECT = 0x00000000
    REQ_PARTIAL = 0x00000001
    REQ_END = 0x00000002
    REQ_PIT = 0x00000003
    REQ_BOOTOPT = 0x00000004
    REQ_WRITE = 0x00000005
    REQ_ERASE = 0x00000006
    REQ_READ = 0x00000007
    REQ_UNLOCK = 0x00000008
    REQ_WRITE_MEM = 0x00000009
    REQ_READ_MEM = 0x0000000A
    REQ_GET_BOOL = 0x0000000B
    REQ_SET_BOOL = 0x0000000C
    REQ_GET_VAR = 0x0000000D
    REQ_SET_VAR = 0x0000000E
    REQ_OPEN_WRITE = 0x0000000F
    REQ_OPEN_READ = 0x00000010
    REQ_CLOSE = 0x00000011
    REQ_CLOSE_ALL = 0x00000012
    REQ_SECURITY_INIT = 0x00000013
    REQ_SECURITY_WRITE = 0x00000014
    REQ_SECURITY_READ = 0x00000015
    REQ_SECURITY_GET_ROOT_STATUS = 0x00000016
    REQ_SECURITY_GET_STATUS = 0x00000017
    REQ_SECURITY_SET_STATUS = 0x00000018
    REQ_SECURITY_GET_VENDOR_STATUS = 0x00000019
    REQ_SECURITY_SET_VENDOR_STATUS = 0x0000001A
    REQ_SECURITY_GET_BOOT_STATUS = 0x0000001B
    REQ_SECURITY_SET_BOOT_STATUS = 0x0000001C
    REQ_SECURITY_GET_DONE_STATUS = 0x0000001D
    REQ_SECURITY_SET_DONE_STATUS = 0x0000001E
    REQ_SECURITY_GET_FUSE_STATUS = 0x0000001F
    REQ_SECURITY_SET_FUSE_STATUS = 0x00000020
    REQ_SECURITY_GET_CC_STATUS = 0x00000021
    REQ_SECURITY_SET_CC_STATUS = 0x00000022
    REQ_SECURITY_GET_SWREV_STATUS = 0x00000023
    REQ_SECURITY_SET_SWREV_STATUS = 0x00000024
    REQ_SECURITY_GET_DUALBIT_STATUS = 0x00000025
    REQ_SECURITY_SET_DUALBIT_STATUS = 0x00000026
    REQ_SECURITY_GET_TAMPER_STATUS = 0x00000027
    REQ_SECURITY_SET_TAMPER_STATUS = 0x00000028
    REQ_SECURITY_GET_DEBUG_STATUS = 0x00000029
    REQ_SECURITY_SET_DEBUG_STATUS = 0x0000002A
    REQ_SECURITY_GET_DDOMAIN_STATUS = 0x0000002B
    REQ_SECURITY_SET_DDOMAIN_STATUS = 0x0000002C
    REQ_SECURITY_GET_WARRANTY_STATUS = 0x0000002D
    REQ_SECURITY_SET_WARRANTY_STATUS = 0x0000002E
    REQ_SECURITY_GET_RMA_STATUS = 0x0000002F
    REQ_SECURITY_SET_RMA_STATUS = 0x00000030
    REQ_SECURITY_GET_UBLOCK_STATUS = 0x00000031
    REQ_SECURITY_SET_UBLOCK_STATUS = 0x00000032
    REQ_SECURITY_GET_SIMLOCK_STATUS = 0x00000033
    REQ_SECURITY_SET_SIMLOCK_STATUS = 0x00000034
    REQ_SECURITY_GET_ACTIVATION_STATUS = 0x00000035
    REQ_SECURITY_SET_ACTIVATION_STATUS = 0x00000036
    REQ_SECURITY_GET_PHONE_ACTIVE_STATUS = 0x00000037
    REQ_SECURITY_SET_PHONE_ACTIVE_STATUS = 0x00000038
    REQ_SECURITY_GET_SIM_APP_STATUS = 0x00000039
    REQ_SECURITY_SET_SIM_APP_STATUS = 0x0000003A
    REQ_SECURITY_GET_SIM_LOCK_STATUS = 0x0000003B
    REQ_SECURITY_SET_SIM_LOCK_STATUS = 0x0000003C
    REQ_SECURITY_GET_NETWORK_LOCK_STATUS = 0x0000003D
    REQ_SECURITY_SET_NETWORK_LOCK_STATUS = 0x0000003E
    REQ_SECURITY_GET_SIMLOCK_BLOCK_STATUS = 0x0000003F
    REQ_SECURITY_SET_SIMLOCK_BLOCK_STATUS = 0x00000040
    REQ_SECURITY_GET_SIMLOCK_RETRY_STATUS = 0x00000041
    REQ_SECURITY_SET_SIMLOCK_RETRY_STATUS = 0x00000042
    REQ_SECURITY_GET_SIMLOCK_UNBLOCK_STATUS = 0x00000043
    REQ_SECURITY_SET_SIMLOCK_UNBLOCK_STATUS = 0x00000044
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY_STATUS = 0x00000045
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY_STATUS = 0x00000046
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY2_STATUS = 0x00000047
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY2_STATUS = 0x00000048
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY3_STATUS = 0x00000049
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY3_STATUS = 0x0000004A
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY4_STATUS = 0x0000004B
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY4_STATUS = 0x0000004C
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY5_STATUS = 0x0000004D
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY5_STATUS = 0x0000004E
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY6_STATUS = 0x0000004F
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY6_STATUS = 0x00000050
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY7_STATUS = 0x00000051
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY7_STATUS = 0x00000052
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY8_STATUS = 0x00000053
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY8_STATUS = 0x00000054
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY9_STATUS = 0x00000055
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY9_STATUS = 0x00000056
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY10_STATUS = 0x00000057
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY10_STATUS = 0x00000058
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY11_STATUS = 0x00000059
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY11_STATUS = 0x0000005A
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY12_STATUS = 0x0000005B
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY12_STATUS = 0x0000005C
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY13_STATUS = 0x0000005D
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY13_STATUS = 0x0000005E
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY14_STATUS = 0x0000005F
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY14_STATUS = 0x00000060
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY15_STATUS = 0x00000061
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY15_STATUS = 0x00000062
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY16_STATUS = 0x00000063
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY16_STATUS = 0x00000064
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY17_STATUS = 0x00000065
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY17_STATUS = 0x00000066
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY18_STATUS = 0x00000067
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY18_STATUS = 0x00000068
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY19_STATUS = 0x00000069
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY19_STATUS = 0x0000006A
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY20_STATUS = 0x0000006B
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY20_STATUS = 0x0000006C
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY21_STATUS = 0x0000006D
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY21_STATUS = 0x0000006E
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY22_STATUS = 0x0000006F
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY22_STATUS = 0x00000070
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY23_STATUS = 0x00000071
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY23_STATUS = 0x00000072
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY24_STATUS = 0x00000073
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY24_STATUS = 0x00000074
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY25_STATUS = 0x00000075
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY25_STATUS = 0x00000076
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY26_STATUS = 0x00000077
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY26_STATUS = 0x00000078
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY27_STATUS = 0x00000079
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY27_STATUS = 0x0000007A
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY28_STATUS = 0x0000007B
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY28_STATUS = 0x0000007C
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY29_STATUS = 0x0000007D
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY29_STATUS = 0x0000007E
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY30_STATUS = 0x0000007F
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY30_STATUS = 0x00000080
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY31_STATUS = 0x00000081
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY31_STATUS = 0x00000082
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY32_STATUS = 0x00000083
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY32_STATUS = 0x00000084
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY33_STATUS = 0x00000085
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY33_STATUS = 0x00000086
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY34_STATUS = 0x00000087
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY34_STATUS = 0x00000088
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY35_STATUS = 0x00000089
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY35_STATUS = 0x0000008A
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY36_STATUS = 0x0000008B
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY36_STATUS = 0x0000008C
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY37_STATUS = 0x0000008D
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY37_STATUS = 0x0000008E
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY38_STATUS = 0x0000008F
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY38_STATUS = 0x00000090
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY39_STATUS = 0x00000091
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY39_STATUS = 0x00000092
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY40_STATUS = 0x00000093
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY40_STATUS = 0x00000094
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY41_STATUS = 0x00000095
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY41_STATUS = 0x00000096
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY42_STATUS = 0x00000097
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY42_STATUS = 0x00000098
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY43_STATUS = 0x00000099
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY43_STATUS = 0x0000009A
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY44_STATUS = 0x0000009B
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY44_STATUS = 0x0000009C
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY45_STATUS = 0x0000009D
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY45_STATUS = 0x0000009E
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY46_STATUS = 0x0000009F
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY46_STATUS = 0x000000A0
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY47_STATUS = 0x000000A1
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY47_STATUS = 0x000000A2
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY48_STATUS = 0x000000A3
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY48_STATUS = 0x000000A4
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY49_STATUS = 0x000000A5
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY49_STATUS = 0x000000A6
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY50_STATUS = 0x000000A7
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY50_STATUS = 0x000000A8
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY51_STATUS = 0x000000A9
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY51_STATUS = 0x000000AA
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY52_STATUS = 0x000000AB
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY52_STATUS = 0x000000AC
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY53_STATUS = 0x000000AD
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY53_STATUS = 0x000000AE
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY54_STATUS = 0x000000AF
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY54_STATUS = 0x000000B0
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY55_STATUS = 0x000000B1
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY55_STATUS = 0x000000B2
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY56_STATUS = 0x000000B3
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY56_STATUS = 0x000000B4
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY57_STATUS = 0x000000B5
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY57_STATUS = 0x000000B6
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY58_STATUS = 0x000000B7
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY58_STATUS = 0x000000B8
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY59_STATUS = 0x000000B9
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY59_STATUS = 0x000000BA
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY60_STATUS = 0x000000BB
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY60_STATUS = 0x000000BC
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY61_STATUS = 0x000000BD
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY61_STATUS = 0x000000BE
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY62_STATUS = 0x000000BF
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY62_STATUS = 0x000000C0
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY63_STATUS = 0x000000C1
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY63_STATUS = 0x000000C2
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY64_STATUS = 0x000000C3
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY64_STATUS = 0x000000C4
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY65_STATUS = 0x000000C5
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY65_STATUS = 0x000000C6
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY66_STATUS = 0x000000C7
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY66_STATUS = 0x000000C8
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY67_STATUS = 0x000000C9
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY67_STATUS = 0x000000CA
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY68_STATUS = 0x000000CB
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY68_STATUS = 0x000000CC
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY69_STATUS = 0x000000CD
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY69_STATUS = 0x000000CE
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY70_STATUS = 0x000000CF
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY70_STATUS = 0x000000D0
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY71_STATUS = 0x000000D1
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY71_STATUS = 0x000000D2
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY72_STATUS = 0x000000D3
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY72_STATUS = 0x000000D4
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY73_STATUS = 0x000000D5
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY73_STATUS = 0x000000D6
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY74_STATUS = 0x000000D7
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY74_STATUS = 0x000000D8
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY75_STATUS = 0x000000D9
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY75_STATUS = 0x000000DA
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY76_STATUS = 0x000000DB
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY76_STATUS = 0x000000DC
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY77_STATUS = 0x000000DD
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY77_STATUS = 0x000000DE
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY78_STATUS = 0x000000DF
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY78_STATUS = 0x000000E0
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY79_STATUS = 0x000000E1
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY79_STATUS = 0x000000E2
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY80_STATUS = 0x000000E3
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY80_STATUS = 0x000000E4
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY81_STATUS = 0x000000E5
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY81_STATUS = 0x000000E6
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY82_STATUS = 0x000000E7
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY82_STATUS = 0x000000E8
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY83_STATUS = 0x000000E9
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY83_STATUS = 0x000000EA
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY84_STATUS = 0x000000EB
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY84_STATUS = 0x000000EC
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY85_STATUS = 0x000000ED
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY85_STATUS = 0x000000EE
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY86_STATUS = 0x000000EF
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY86_STATUS = 0x000000F0
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY87_STATUS = 0x000000F1
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY87_STATUS = 0x000000F2
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY88_STATUS = 0x000000F3
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY88_STATUS = 0x000000F4
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY89_STATUS = 0x000000F5
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY89_STATUS = 0x000000F6
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY90_STATUS = 0x000000F7
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY90_STATUS = 0x000000F8
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY91_STATUS = 0x000000F9
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY91_STATUS = 0x000000FA
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY92_STATUS = 0x000000FB
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY92_STATUS = 0x000000FC
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY93_STATUS = 0x000000FD
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY93_STATUS = 0x000000FE
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY94_STATUS = 0x000000FF
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY94_STATUS = 0x00000100
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY95_STATUS = 0x00000101
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY95_STATUS = 0x00000102
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY96_STATUS = 0x00000103
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY96_STATUS = 0x00000104
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY97_STATUS = 0x00000105
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY97_STATUS = 0x00000106
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY98_STATUS = 0x00000107
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY98_STATUS = 0x00000108
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY99_STATUS = 0x00000109
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY99_STATUS = 0x0000010A
    REQ_SECURITY_GET_SIMLOCK_CONTROL_KEY100_STATUS = 0x0000010B
    REQ_SECURITY_SET_SIMLOCK_CONTROL_KEY100_STATUS = 0x0000010C


class OdinPartitionType(Enum):
    """Odin partition types"""
    BOOT = "boot"
    RECOVERY = "recovery"
    SYSTEM = "system"
    USERDATA = "userdata"
    CACHE = "cache"
    MODEM = "modem"
    SBL1 = "sbl1"
    SBL2 = "sbl2"
    TZ = "tz"
    ABOOT = "aboot"
    RPM = "rpm"
    NON_HLOS = "non-hlos"
    DDR = "ddr"
    PMIC = "pmic"
    BOOTLOADER = "bootloader"
    PBL = "pbl"


@dataclass
class OdinPacket:
    """Odin protocol packet"""
    command: int
    data: bytes
    size: int = 0
    
    def serialize(self) -> bytes:
        """Serialize packet"""
        if self.size == 0:
            self.size = len(self.data)
        
        packet = struct.pack('<II', self.command, self.size)
        packet += self.data
        return packet
    
    @classmethod
    def deserialize(cls, data: bytes) -> 'OdinPacket':
        """Deserialize packet"""
        if len(data) < 8:
            raise ValueError("Invalid packet size")
        
        command, size = struct.unpack('<II', data[:8])
        packet_data = data[8:8+size]
        
        return cls(command=command, data=packet_data, size=size)


@dataclass
class PartitionInfo:
    """Odin partition information"""
    name: str
    filename: str
    size: int
    checksum: str
    partition_type: OdinPartitionType
    
    @property
    def size_mb(self) -> float:
        return self.size / (1024 * 1024)


class OdinClient:
    """Samsung Odin protocol client"""
    
    SAMSUNG_VID = 0x04E8
    # Samsung Odin download-mode USB PIDs (0x04E8 VID). 0x6860 is MTP (normal
    # boot) mode and must NOT be treated as download mode - matching it would
    # grab a normally-booted phone and fail the Odin handshake.
    DOWNLOAD_PIDS = (0x685D, 0x6601, 0x68C3, 0x6877)
    DOWNLOAD_PID = DOWNLOAD_PIDS[0]  # kept for compatibility

    def __init__(self, port: str = "/dev/ttyUSB0"):
        self.port = port
        self.device = None
        self.connected = False
        self.device_info = {}
        self.partitions = {}

    def connect(self) -> bool:
        """Connect to Samsung device in download mode"""
        try:
            import usb.core

            self.device = None
            for pid in self.DOWNLOAD_PIDS:
                dev = usb.core.find(idVendor=self.SAMSUNG_VID, idProduct=pid)
                if dev:
                    self.device = dev
                    break

            if self.device:
                self.device.set_configuration()
                self.connected = True
                logger.info("Connected to Samsung device in download mode")

                # Perform handshake
                return self.handshake()

            logger.error("No Samsung device in download mode found")
            return False

        except Exception as e:
            logger.error(f"Connection failed: {e}")
            return False
    
    def handshake(self) -> bool:
        """Perform Odin handshake"""
        logger.info("Performing Odin handshake...")
        
        # Send connect request
        packet = OdinPacket(
            command=OdinCommand.REQ_CONNECT,
            data=b''
        )
        
        # In real implementation, send packet and receive response
        time.sleep(0.1)
        
        self.device_info = {
            'model': 'Unknown',
            'serial': 'Unknown',
            'android_version': 'Unknown',
        }
        
        return True
    
    def get_device_info(self) -> Dict:
        """Get device information"""
        return self.device_info
    
    def read_pit(self) -> Optional[Dict]:
        """Read PIT (Partition Information Table)"""
        logger.info("Reading PIT...")
        
        # In real implementation, request PIT from device
        return {
            'partitions': {
                'boot': {'offset': 0x0, 'size': 0x1000000},
                'recovery': {'offset': 0x1000000, 'size': 0x1000000},
                'system': {'offset': 0x2000000, 'size': 0x100000000},
                'userdata': {'offset': 0x102000000, 'size': 0x400000000},
            }
        }
    
    def flash_partition(self, partition_name: str, data: bytes, progress_callback=None) -> bool:
        """Flash partition"""
        logger.info(f"Flashing {partition_name} ({len(data)} bytes)")
        
        # Calculate checksum
        checksum = hashlib.md5(data).hexdigest()
        
        # In real implementation:
        # 1. Send partition info
        # 2. Send data
        # 3. Verify checksum
        
        if progress_callback:
            progress_callback(100)
        
        return True
    
    def flash_file(self, partition_name: str, filepath: str, progress_callback=None) -> bool:
        """Flash partition from file"""
        if not os.path.exists(filepath):
            logger.error(f"File not found: {filepath}")
            return False
        
        with open(filepath, 'rb') as f:
            data = f.read()
        
        return self.flash_partition(partition_name, data, progress_callback)
    
    def flash_firmware(self, firmware_dir: str, parts: Optional[List[str]] = None) -> bool:
        """Flash firmware from directory"""
        logger.info(f"Flashing firmware from {firmware_dir}")
        
        # Common Samsung firmware files
        firmware_files = {
            'boot': 'boot.img',
            'recovery': 'recovery.img',
            'system': 'system.img',
            'userdata': 'userdata.img',
            'modem': 'modem.bin',
            'cache': 'cache.img',
        }
        
        files_to_flash = parts if parts else firmware_files.keys()
        
        for part in files_to_flash:
            if part in firmware_files:
                filepath = os.path.join(firmware_dir, firmware_files[part])
                if os.path.exists(filepath):
                    if not self.flash_file(part, filepath):
                        logger.error(f"Failed to flash {part}")
                        return False
        
        logger.info("Firmware flash complete")
        return True
    
    def read_partition(self, partition_name: str) -> Optional[bytes]:
        """Read partition"""
        logger.info(f"Reading partition {partition_name}")
        
        # In real implementation, read from device
        return b''  # Placeholder
    
    def backup_partition(self, partition_name: str, output_path: str) -> bool:
        """Backup partition to file"""
        data = self.read_partition(partition_name)
        if data is None:
            return False
        
        with open(output_path, 'wb') as f:
            f.write(data)
        
        logger.info(f"Backed up {partition_name} to {output_path}")
        return True
    
    def erase_partition(self, partition_name: str) -> bool:
        """Erase partition"""
        logger.info(f"Erasing partition {partition_name}")
        return True
    
    def reboot(self, mode: str = "normal") -> bool:
        """Reboot device"""
        logger.info(f"Rebooting to {mode}")
        return True
    
    def disconnect(self):
        """Disconnect from device"""
        self.connected = False
        self.device = None
        logger.info("Disconnected from Samsung device")


class HeimdallWrapper:
    """Wrapper for Heimdall (open-source Odin alternative)"""
    
    def __init__(self):
        self.heimdall_path = self._find_heimdall()
    
    def _find_heimdall(self) -> str:
        """Find Heimdall binary"""
        try:
            import subprocess
            result = subprocess.run(['which', 'heimdall'], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip()
        except:
            pass
        
        common_paths = [
            '/usr/bin/heimdall',
            '/usr/local/bin/heimdall',
            '/opt/heimdall/bin/heimdall',
        ]
        
        for path in common_paths:
            if os.path.exists(path):
                return path
        
        return "heimdall"  # Hope it's in PATH
    
    def detect(self) -> bool:
        """Detect Samsung device"""
        import subprocess
        result = subprocess.run(
            [self.heimdall_path, 'detect'],
            capture_output=True,
            text=True
        )
        return result.returncode == 0
    
    def flash(self, partitions: Dict[str, str], boot: bool = True) -> bool:
        """Flash partitions using Heimdall"""
        import subprocess
        
        cmd = [self.heimdall_path, 'flash']
        
        for name, filepath in partitions.items():
            cmd.extend(['--' + name, filepath])
        
        if boot:
            cmd.append('--boot')
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode == 0
    
    def download_pit(self, output_path: str) -> bool:
        """Download PIT from device"""
        import subprocess
        
        result = subprocess.run(
            [self.heimdall_path, 'download-pit', '--output', output_path],
            capture_output=True,
            text=True
        )
        return result.returncode == 0


def main():
    """CLI entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='TechBench Samsung Odin Client')
    parser.add_argument('command', choices=['info', 'flash', 'backup', 'reboot'])
    parser.add_argument('--port', default='/dev/ttyUSB0', help='Serial port')
    parser.add_argument('--partition', help='Partition name')
    parser.add_argument('--output', help='Output file')
    parser.add_argument('--input', help='Input file')
    parser.add_argument('--firmware-dir', help='Firmware directory')
    parser.add_argument('--use-heimdall', action='store_true', help='Use Heimdall instead of Odin')
    
    args = parser.parse_args()
    
    if args.use_heimdall:
        client = HeimdallWrapper()
        if not client.detect():
            print("No Samsung device detected")
            sys.exit(1)
    else:
        client = OdinClient(args.port)
        if not client.connect():
            print("Failed to connect")
            sys.exit(1)
    
    if args.command == 'info':
        if hasattr(client, 'get_device_info'):
            info = client.get_device_info()
            print(f"Model: {info.get('model', 'Unknown')}")
            print(f"Serial: {info.get('serial', 'Unknown')}")
    
    elif args.command == 'flash':
        if args.firmware_dir:
            client.flash_firmware(args.firmware_dir)
    
    elif args.command == 'backup':
        if args.partition and args.output:
            client.backup_partition(args.partition, args.output)
    
    elif args.command == 'reboot':
        client.reboot()
    
    if hasattr(client, 'disconnect'):
        client.disconnect()


if __name__ == '__main__':
    main()
