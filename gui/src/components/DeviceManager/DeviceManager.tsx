import { useState, useCallback, useEffect } from 'react'
import { useDeviceStore } from '../../lib/deviceStore'
import { tauri } from '../../lib/tauri'
import type { Device, DeviceOperation, OperationExecution, OperationStatus } from '../../lib/types'
import { AppManager } from '../AppManager/AppManager'

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  android: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/20' },
  apple: { bg: 'bg-white/5', text: 'text-white/70', border: 'border-white/10' },
  qualcomm: { bg: 'bg-neon-blue/10', text: 'text-neon-blue', border: 'border-neon-blue/20' },
  mediatek: { bg: 'bg-neon-orange/10', text: 'text-neon-orange', border: 'border-neon-orange/20' },
  samsung: { bg: 'bg-bench-400/10', text: 'text-bench-400', border: 'border-bench-400/20' },
  modem: { bg: 'bg-neon-cyan/10', text: 'text-neon-cyan', border: 'border-neon-cyan/20' },
  mifi: { bg: 'bg-neon-purple/10', text: 'text-neon-purple', border: 'border-neon-purple/20' },
  generic: { bg: 'bg-white/5', text: 'text-white/50', border: 'border-white/10' },
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  security: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  system: { bg: 'bg-neon-orange/10', text: 'text-neon-orange', border: 'border-neon-orange/20' },
  backup: { bg: 'bg-neon-blue/10', text: 'text-neon-blue', border: 'border-neon-blue/20' },
  cloud: { bg: 'bg-neon-purple/10', text: 'text-neon-purple', border: 'border-neon-purple/20' },
  network: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/20' },
}

const RISK_COLORS: Record<string, string> = {
  LOW: 'text-neon-green',
  MEDIUM: 'text-neon-yellow',
  HIGH: 'text-red-400',
}

const STATUS_COLORS: Record<OperationStatus, { bg: string; text: string }> = {
  idle: { bg: 'bg-white/5', text: 'text-white/40' },
  running: { bg: 'bg-neon-blue/10', text: 'text-neon-blue' },
  success: { bg: 'bg-neon-green/10', text: 'text-neon-green' },
  error: { bg: 'bg-red-500/10', text: 'text-red-400' },
  cancelled: { bg: 'bg-white/5', text: 'text-white/30' },
}

const ALL_OPERATIONS: DeviceOperation[] = [
  // Security Operations
  {
    id: 'erase-frp',
    name: 'Erase FRP',
    description: 'Remove Factory Reset Protection lock from device',
    category: 'security',
    icon: 'shield',
    command: 'adb shell content insert --uri content://settings/secure --bind name:s:user_setup_complete --bind value:s:1',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal', 'fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'erase-frp-fastboot',
    name: 'Erase FRP (Fastboot)',
    description: 'Remove Factory Reset Protection lock via fastboot (oem frp-erase)',
    category: 'security',
    icon: 'shield',
    command: 'fastboot oem frp-erase',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'unlock-bootloader',
    name: 'Unlock Bootloader',
    description: 'Unlock device bootloader for flashing custom firmware',
    category: 'security',
    icon: 'unlock',
    command: 'fastboot oem unlock',
    requiresUnlock: false,
    riskLevel: 'HIGH',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'lock-bootloader',
    name: 'Lock Bootloader',
    description: 'Lock device bootloader for security',
    category: 'security',
    icon: 'lock',
    command: 'fastboot oem lock',
    requiresUnlock: true,
    riskLevel: 'MEDIUM',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  // System Operations
  {
    id: 'factory-reset',
    name: 'Factory Reset',
    description: 'Reset device to factory settings (erases all data)',
    category: 'system',
    icon: 'reset',
    command: 'fastboot -w',
    requiresUnlock: true,
    riskLevel: 'HIGH',
    supportedBootModes: ['fastboot', 'recovery'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'auth-flash',
    name: 'Auth Flash',
    description: 'Flash firmware with authentication bypass',
    category: 'system',
    icon: 'flash',
    command: 'fastboot flashall',
    requiresUnlock: false,
    riskLevel: 'MEDIUM',
    supportedBootModes: ['fastboot', 'edl'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'disable-ota',
    name: 'Disable OTA',
    description: 'Disable Over-The-Air updates permanently',
    category: 'system',
    icon: 'block',
    command: 'adb shell pm disable-user --user 0 com.google.android.gms',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  // Backup Operations
  {
    id: 'backup-efs',
    name: 'Backup EFS',
    description: 'Backup EFS partition (IMEI and radio data)',
    category: 'backup',
    icon: 'backup',
    command: 'adb pull /dev/block/bootdevice/by-name/efs backup/efs.img',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal', 'fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'restore-efs',
    name: 'Restore EFS',
    description: 'Restore EFS partition from backup',
    category: 'backup',
    icon: 'restore',
    command: 'adb push backup/efs.img /dev/block/bootdevice/by-name/efs',
    requiresUnlock: true,
    riskLevel: 'MEDIUM',
    supportedBootModes: ['normal', 'fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'wipe-efs',
    name: 'Wipe EFS',
    description: 'Wipe EFS partition (WARNING: may lose IMEI)',
    category: 'backup',
    icon: 'wipe',
    command: 'fastboot erase efs',
    requiresUnlock: true,
    riskLevel: 'HIGH',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  // Cloud Operations
  {
    id: 'reset-micloud',
    name: 'Reset Mi Cloud',
    description: 'Remove Mi Cloud account lock from Xiaomi devices',
    category: 'cloud',
    icon: 'cloud',
    command: 'adb shell pm clear com.miui.cloudservice',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'xiaomi'],
  },
  {
    id: 'remove-micloud',
    name: 'Remove Mi Cloud',
    description: 'Permanently remove Mi Cloud account from device',
    category: 'cloud',
    icon: 'cloud-remove',
    command: 'adb shell pm uninstall --user 0 com.miui.cloudservice',
    requiresUnlock: false,
    riskLevel: 'MEDIUM',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'xiaomi'],
  },
  // Navigation / Reboot (ADB)
  {
    id: 'reboot-device',
    name: 'Reboot Device',
    description: 'Reboot the device normally',
    category: 'system',
    icon: 'power',
    command: 'adb reboot',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'reboot-bootloader',
    name: 'Reboot to Bootloader',
    description: 'Reboot device into fastboot/bootloader mode',
    category: 'system',
    icon: 'boot',
    command: 'adb reboot bootloader',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'reboot-recovery',
    name: 'Reboot to Recovery',
    description: 'Reboot device into recovery mode',
    category: 'system',
    icon: 'recovery',
    command: 'adb reboot recovery',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'reboot-edl',
    name: 'Reboot to EDL',
    description: 'Reboot into Qualcomm Emergency Download mode',
    category: 'system',
    icon: 'edl',
    command: 'adb reboot edl',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'qualcomm', 'xiaomi'],
  },
  {
    id: 'reboot-download',
    name: 'Reboot to Download Mode',
    description: 'Reboot into Samsung/MediaTek download mode',
    category: 'system',
    icon: 'download',
    command: 'adb reboot download',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'mediatek'],
  },
  // Navigation / Reboot (Fastboot)
  {
    id: 'fb-reboot',
    name: 'Reboot Device (Fastboot)',
    description: 'Reboot the device normally from fastboot',
    category: 'system',
    icon: 'power',
    command: 'fastboot reboot',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'fb-reboot-bootloader',
    name: 'Reboot to Bootloader (Fastboot)',
    description: 'Restart device into bootloader from fastboot',
    category: 'system',
    icon: 'boot',
    command: 'fastboot reboot bootloader',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'fb-reboot-recovery',
    name: 'Reboot to Recovery (Fastboot)',
    description: 'Restart device into recovery from fastboot',
    category: 'system',
    icon: 'recovery',
    command: 'fastboot reboot recovery',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'fb-continue',
    name: 'Continue Boot (Fastboot)',
    description: 'Resume normal boot from fastboot',
    category: 'system',
    icon: 'play',
    command: 'fastboot continue',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'fb-slot-a',
    name: 'Switch to Slot A',
    description: 'Set active boot slot to A (A/B devices)',
    category: 'system',
    icon: 'slot',
    command: 'fastboot set_active a',
    requiresUnlock: false,
    riskLevel: 'MEDIUM',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'fb-slot-b',
    name: 'Switch to Slot B',
    description: 'Set active boot slot to B (A/B devices)',
    category: 'system',
    icon: 'slot',
    command: 'fastboot set_active b',
    requiresUnlock: false,
    riskLevel: 'MEDIUM',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'fb-current-slot',
    name: 'Show Active Slot',
    description: 'Read the current active A/B slot',
    category: 'system',
    icon: 'slot',
    command: 'fastboot getvar current-slot',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'fb-getvar-all',
    name: 'Get All Variables',
    description: 'Dump all fastboot device variables',
    category: 'system',
    icon: 'info',
    command: 'fastboot getvar all',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'fb-device-info',
    name: 'Device Info (OEM)',
    description: 'Show OEM device info (unlock/version status)',
    category: 'system',
    icon: 'info',
    command: 'fastboot oem device-info',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'fb-erase-frp',
    name: 'Erase FRP Partition',
    description: 'Erase the FRP partition directly',
    category: 'security',
    icon: 'shield',
    command: 'fastboot erase frp',
    requiresUnlock: true,
    riskLevel: 'MEDIUM',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'fb-erase-cache',
    name: 'Erase Cache',
    description: 'Wipe the cache partition',
    category: 'system',
    icon: 'wipe',
    command: 'fastboot erase cache',
    requiresUnlock: true,
    riskLevel: 'LOW',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'fb-format-userdata',
    name: 'Format Userdata',
    description: 'Format the userdata partition (full wipe)',
    category: 'system',
    icon: 'reset',
    command: 'fastboot format userdata',
    requiresUnlock: true,
    riskLevel: 'HIGH',
    supportedBootModes: ['fastboot'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  // Device Info (ADB)
  {
    id: 'get-serial',
    name: 'Read Serial Number',
    description: 'Read the device serial number via ADB',
    category: 'system',
    icon: 'info',
    command: 'adb get-serialno',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'get-battery',
    name: 'Battery Status',
    description: 'Show battery health, level and charging state',
    category: 'system',
    icon: 'battery',
    command: 'adb shell dumpsys battery',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'get-storage',
    name: 'Disk Usage',
    description: 'Show filesystem/disk usage on the device',
    category: 'system',
    icon: 'storage',
    command: 'adb shell df -h',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'get-cpuinfo',
    name: 'CPU Info',
    description: 'Dump the device CPU information',
    category: 'system',
    icon: 'cpu',
    command: 'adb shell cat /proc/cpuinfo',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'get-meminfo',
    name: 'Memory Info',
    description: 'Dump the device memory information',
    category: 'system',
    icon: 'memory',
    command: 'adb shell cat /proc/meminfo',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'get-props',
    name: 'Dump Build Props',
    description: 'Show all Android build/system properties',
    category: 'system',
    icon: 'info',
    command: 'adb shell getprop',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'list-users',
    name: 'List Users',
    description: 'List all user profiles on the device',
    category: 'system',
    icon: 'users',
    command: 'adb shell pm list users',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  // Network toggles (ADB)
  {
    id: 'wifi-on',
    name: 'Enable Wi-Fi',
    description: 'Turn the Wi-Fi radio on via ADB',
    category: 'network',
    icon: 'wifi',
    command: 'adb shell svc wifi enable',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'wifi-off',
    name: 'Disable Wi-Fi',
    description: 'Turn the Wi-Fi radio off via ADB',
    category: 'network',
    icon: 'wifi-off',
    command: 'adb shell svc wifi disable',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'data-on',
    name: 'Enable Mobile Data',
    description: 'Turn mobile data on via ADB',
    category: 'network',
    icon: 'signal',
    command: 'adb shell svc data enable',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'data-off',
    name: 'Disable Mobile Data',
    description: 'Turn mobile data off via ADB',
    category: 'network',
    icon: 'signal-off',
    command: 'adb shell svc data disable',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'stay-awake-on',
    name: 'Keep Screen On',
    description: 'Keep the screen awake while charging',
    category: 'system',
    icon: 'screen',
    command: 'adb shell svc power stayon true',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'stay-awake-off',
    name: 'Allow Screen Off',
    description: 'Restore default screen timeout behavior',
    category: 'system',
    icon: 'screen',
    command: 'adb shell svc power stayon false',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  // Security extras
  {
    id: 'disable-verity',
    name: 'Disable DM-Verity',
    description: 'Disable dm-verity verification (needs reboot to apply)',
    category: 'security',
    icon: 'shield',
    command: 'adb disable-verity',
    requiresUnlock: false,
    riskLevel: 'MEDIUM',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'enable-verity',
    name: 'Enable DM-Verity',
    description: 'Re-enable dm-verity verification (needs reboot to apply)',
    category: 'security',
    icon: 'shield',
    command: 'adb enable-verity',
    requiresUnlock: false,
    riskLevel: 'MEDIUM',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'check-root',
    name: 'Check Root Access',
    description: 'Test whether the device has root (su) access',
    category: 'security',
    icon: 'shield',
    command: 'adb shell su -c id',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  // Backup extras
  {
    id: 'backup-all',
    name: 'Full Backup (adb backup)',
    description: 'Create a full app/data backup (backup.ab in portable/data)',
    category: 'backup',
    icon: 'backup',
    command: 'adb backup -apk -shared -all -f backup.ab',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'quick-media-backup',
    name: 'Quick Media Backup',
    description: 'Copy all photos, videos, audio and documents to a folder on this laptop',
    category: 'backup',
    icon: 'media',
    command: 'adb pull /sdcard media + documents',
    requiresUnlock: false,
    riskLevel: 'LOW',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'quick-media-backup-ios',
    name: 'Quick Media Backup (iOS)',
    description: 'Copy photos, videos, audio and documents off the iPhone via AFC (works with a broken screen)',
    category: 'backup',
    icon: 'media',
    command: 'afcclient get -r /DCIM + Documents',
    requiresUnlock: false,
    riskLevel: 'LOW',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'recover-deleted-media',
    name: 'Recover Deleted Media',
    description: 'Pull thumbnail caches and trash/recycle folders left behind by deleted photos and videos',
    category: 'backup',
    icon: 'trash',
    command: 'adb pull .thumbnails + trash folders',
    requiresUnlock: false,
    riskLevel: 'MEDIUM',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'recover-deleted-media-ios',
    name: 'Recover Deleted Media (iOS)',
    description: 'Recover photos and videos from the iPhone Recently Deleted album via the Photos library',
    category: 'backup',
    icon: 'trash',
    command: 'Photos.sqlite trashed assets -> laptop',
    requiresUnlock: false,
    riskLevel: 'MEDIUM',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'network-unlock',
    name: 'Network Unlock',
    description: 'Check SIM/network-lock state and open the unlock code screen (Samsung NCK menu, Testing menu)',
    category: 'network',
    icon: 'unlock',
    command: 'adb getprop + am start unlock codes',
    requiresUnlock: false,
    riskLevel: 'MEDIUM',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek', 'lenovo', 'oppo', 'vivo', 'motorola', 'huawei', 'tecno', 'zte', 'generic'],
  },
  {
    id: 'network-unlock-ios',
    name: 'Network Unlock (iOS)',
    description: 'Read iPhone carrier-lock / activation status (unlock is done by the carrier)',
    category: 'network',
    icon: 'unlock',
    command: 'ideviceinfo activation + IMEI',
    requiresUnlock: false,
    riskLevel: 'MEDIUM',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-device-info',
    name: 'Device Info (iOS)',
    description: 'Dump full device information: model, firmware, serial, IMEI, activation state',
    category: 'system',
    icon: 'info',
    command: 'ideviceinfo',
    requiresUnlock: false,
    riskLevel: 'LOW',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-device-name',
    name: 'Device Name (iOS)',
    description: 'Show the device name assigned to the iPhone',
    category: 'system',
    icon: 'tag',
    command: 'idevicename',
    requiresUnlock: false,
    riskLevel: 'LOW',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-device-date',
    name: 'Device Date/Time (iOS)',
    description: 'Show the current date and time reported by the device',
    category: 'system',
    icon: 'clock',
    command: 'idevicedate',
    requiresUnlock: false,
    riskLevel: 'LOW',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-battery-diagnostics',
    name: 'Battery Diagnostics (iOS)',
    description: 'Read battery gas gauge: cycle count, design capacity, health',
    category: 'system',
    icon: 'battery',
    command: 'idevicediagnostics diagnostics GasGauge',
    requiresUnlock: false,
    riskLevel: 'LOW',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-restart',
    name: 'Restart iPhone',
    description: 'Restart the device via the diagnostics interface',
    category: 'system',
    icon: 'reset',
    command: 'idevicediagnostics restart',
    requiresUnlock: false,
    riskLevel: 'MEDIUM',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-sleep',
    name: 'Sleep iPhone',
    description: 'Put the device into sleep mode (disconnects from host)',
    category: 'system',
    icon: 'moon',
    command: 'idevicediagnostics sleep',
    requiresUnlock: false,
    riskLevel: 'LOW',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-enter-recovery',
    name: 'Enter Recovery Mode',
    description: 'Put the iPhone into recovery mode for DFU/firmware operations',
    category: 'system',
    icon: 'flash',
    command: 'ideviceenterrecovery',
    requiresUnlock: false,
    riskLevel: 'HIGH',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-pair',
    name: 'Pair iPhone',
    description: 'Establish or refresh the host pairing with the device',
    category: 'security',
    icon: 'link',
    command: 'idevicepair pair',
    requiresUnlock: false,
    riskLevel: 'LOW',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-pairing-status',
    name: 'Pairing Status',
    description: 'Validate whether this host is paired and trusted with the device',
    category: 'security',
    icon: 'shield',
    command: 'idevicepair validate',
    requiresUnlock: false,
    riskLevel: 'LOW',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-activation-status',
    name: 'Activation Status',
    description: 'Show activation and SIM-lock state of the iPhone',
    category: 'network',
    icon: 'signal',
    command: 'ideviceinfo -k ActivationState',
    requiresUnlock: false,
    riskLevel: 'LOW',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-full-backup',
    name: 'Full iOS Backup',
    description: 'Create a full unencrypted backup of the iPhone (may take several minutes)',
    category: 'backup',
    icon: 'archive',
    command: 'idevicebackup2 backup --full backups/manual-ios',
    requiresUnlock: false,
    riskLevel: 'MEDIUM',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-screenshot',
    name: 'Take Screenshot',
    description: 'Capture the iPhone screen to data/screenshots/iphone.png (needs Developer disk image)',
    category: 'backup',
    icon: 'camera',
    command: 'idevicescreenshot screenshots/iphone.png',
    requiresUnlock: false,
    riskLevel: 'LOW',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'ios-crash-reports',
    name: 'Pull Crash Reports',
    description: 'Move crash reports from the device to data/crashreports/',
    category: 'backup',
    icon: 'bug',
    command: 'idevicecrashreport crashreports/',
    requiresUnlock: false,
    riskLevel: 'LOW',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
  {
    id: 'remove-lock',
    name: 'Remove Screen Lock (Android)',
    description: 'Remove PIN, password, pattern and fingerprint without erasing data (requires root)',
    category: 'security',
    icon: 'shield',
    command: 'remove-lock',
    requiresUnlock: false,
    riskLevel: 'HIGH',
    supportedBootModes: ['normal', 'recovery'],
    supportedDeviceTypes: ['android', 'samsung', 'xiaomi', 'qualcomm', 'mediatek'],
  },
  {
    id: 'remove-lock-ios',
    name: 'Remove Passcode / FaceID (iOS)',
    description: 'Check iPhone passcode/FaceID lock state - removal needs the passcode or a DFU restore',
    category: 'security',
    icon: 'shield',
    command: 'remove-lock-ios',
    requiresUnlock: false,
    riskLevel: 'HIGH',
    platform: 'ios',
    supportedBootModes: ['normal'],
    supportedDeviceTypes: ['apple'],
  },
]

export function DeviceManager() {
  const devices = useDeviceStore((s) => s.devices)
  const selectedDeviceId = useDeviceStore((s) => s.selectedDeviceId)
  const selectDevice = useDeviceStore((s) => s.selectDevice)
  const [activeTab, setActiveTab] = useState<'info' | 'operations' | 'tools' | 'apps'>('info')
  const [operationStatuses, setOperationStatuses] = useState<Record<string, OperationExecution>>({})
  const [activeOperation, setActiveOperation] = useState<string | null>(null)
  const [toolList, setToolList] = useState<Array<{
    name: string
    display: string
    description: string
    category: string
    action: string
    runnable: boolean
    available: boolean
    path: string | null
  }>>([])
  const [runningTool, setRunningTool] = useState<string | null>(null)
  const [toolOutput, setToolOutput] = useState<{
    success: boolean
    error: string
    output: string
    command: string
    artifact: string | null
  } | null>(null)

  useEffect(() => {
    tauri.fetchTools()
      .then((tools) => setToolList(tools))
      .catch(() => setToolList([]))
  }, [])

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null

  const handleRunTool = useCallback(async (name: string) => {
    if (!selectedDevice) return
    setRunningTool(name)
    setToolOutput(null)
    const mode = selectedDevice.deviceType === 'apple' ? 'apple' : selectedDevice.bootMode
    const result = await tauri.runTool(name, { mode, serial: selectedDevice.serial })
    setToolOutput(result)
    setRunningTool(null)
  }, [selectedDevice])

  const deviceToolCategories = (device: Device | null): string[] => {
    if (!device) return ['common']
    if (device.deviceType === 'apple') return ['apple', 'common']
    if (device.deviceType === 'android') return ['android', 'common']
    return ['common']
  }

  const visibleTools = toolList.filter((t) => deviceToolCategories(selectedDevice).includes(t.category))

  const opPlatform = (op: DeviceOperation): 'android' | 'ios' =>
    op.platform ?? (op.supportedDeviceTypes.includes('apple') ? 'ios' : 'android')

  const getAvailableOperations = useCallback((device: Device): DeviceOperation[] => {
    const isIosDevice = device.deviceType === 'apple'
    return ALL_OPERATIONS.filter((op) => {
      const bootModeMatch = op.supportedBootModes.includes(device.bootMode)
      const platformMatch = isIosDevice ? opPlatform(op) === 'ios' : opPlatform(op) === 'android'
      return bootModeMatch && platformMatch
    })
  }, [])

  const handleRunOperation = useCallback(async (device: Device, operation: DeviceOperation) => {
    const executionId = `${operation.id}-${device.id}-${Date.now()}`
    setActiveOperation(executionId)

    setOperationStatuses((prev) => ({
      ...prev,
      [executionId]: {
        id: executionId,
        operationId: operation.id,
        deviceId: device.id,
        status: 'running',
        progress: 0,
        output: `Starting ${operation.name}...\n`,
        startTime: new Date(),
      },
    }))

    try {
      let success: boolean
      let output: string
      let errorMsg: string | undefined

      if (operation.id === 'quick-media-backup') {
        const result = await tauri.quickMediaBackup(device.serial)
        success = result.success
        const dirLines = (result.dirs || []).map(
          (d) => `${d.ok ? '[OK]' : '[SKIP]'} ${d.dir}: ${d.files} file(s), ${(d.bytes / 1048576).toFixed(1)} MB`
        )
        output = [
          `Backup folder: ${result.backupPath || '(none)'}`,
          ...dirLines,
          '',
          `Total: ${result.totalFiles} file(s), ${(result.totalBytes / 1048576).toFixed(1)} MB`,
          success ? '\n[OK] Media backup completed' : '',
        ].join('\n')
        errorMsg = success ? undefined : (result.error || 'Media backup failed')
      } else if (operation.id === 'quick-media-backup-ios') {
        const result = await tauri.iosMediaBackup(device.serial)
        success = result.success
        const dirLines = (result.dirs || []).map(
          (d) => `${d.ok ? '[OK]' : '[SKIP]'} ${d.dir}: ${d.files} file(s), ${(d.bytes / 1048576).toFixed(1)} MB`
        )
        output = [
          `Backup folder: ${result.backupPath || '(none)'}`,
          ...dirLines,
          '',
          `Total: ${result.totalFiles} file(s), ${(result.totalBytes / 1048576).toFixed(1)} MB`,
          success ? '\n[OK] iOS media backup completed' : '',
        ].join('\n')
        errorMsg = success ? undefined : (result.error || 'iOS media backup failed')
      } else if (operation.id === 'recover-deleted-media') {
        const result = await tauri.recoverAndroidDeleted(device.serial)
        success = result.success
        const dirLines = (result.dirs || []).map(
          (d) => `${d.ok ? '[OK]' : '[SKIP]'} ${d.dir}: ${d.files} file(s), ${(d.bytes / 1048576).toFixed(1)} MB`
        )
        output = [
          `Recovered to: ${result.recoveredPath || '(none)'}`,
          ...dirLines,
          '',
          `Total: ${result.totalFiles} file(s), ${(result.totalBytes / 1048576).toFixed(1)} MB`,
          result.message || '',
          success ? '\n[OK] Deleted media recovery completed' : '',
        ].join('\n')
        errorMsg = success ? undefined : (result.error || 'Deleted media recovery failed')
      } else if (operation.id === 'recover-deleted-media-ios') {
        const result = await tauri.recoverIosDeleted(device.serial)
        success = result.success
        const fileLines = (result.files || []).map(
          (f) => `${f.ok ? '[OK]' : '[SKIP]'} ${f.dir}/${f.file} (${f.kind}, ${(f.bytes / 1048576).toFixed(1)} MB)`
        )
        output = [
          `Recovered to: ${result.recoveredPath || '(none)'}`,
          ...fileLines,
          '',
          `Total: ${result.totalFiles} file(s), ${(result.totalBytes / 1048576).toFixed(1)} MB`,
          result.message || '',
          success ? '\n[OK] iOS deleted media recovery completed' : '',
        ].join('\n')
        errorMsg = success ? undefined : (result.error || 'iOS deleted media recovery failed')
      } else if (operation.id === 'network-unlock') {
        const result = await tauri.networkUnlock(device.serial, 'android')
        success = result.success
        const stepLines = (result.steps || []).map(
          (s) => `${s.ok ? '[OK]' : '[--]'} ${s.label}: ${s.output}`
        )
        output = [
          ...stepLines,
          '',
          result.message || '',
          success ? '\n[OK] Network unlock check completed' : '',
        ].join('\n')
        errorMsg = success ? undefined : (result.error || 'Network unlock check failed')
      } else if (operation.id === 'network-unlock-ios') {
        const result = await tauri.networkUnlock(device.serial, 'ios')
        success = result.success
        const stepLines = (result.steps || []).map(
          (s) => `${s.ok ? '[OK]' : '[--]'} ${s.label}: ${s.output}`
        )
        output = [
          ...stepLines,
          '',
          result.message || '',
          success ? '\n[OK] iPhone network lock check completed' : '',
        ].join('\n')
        errorMsg = success ? undefined : (result.error || 'iPhone network lock check failed')
      } else if (operation.id === 'remove-lock') {
        const result = await tauri.removeLock(device.serial, 'android')
        success = result.success
        const stepLines = (result.steps || []).map(
          (s) => `${s.ok ? '[OK]' : '[--]'} ${s.label}: ${s.output}`
        )
        output = [
          ...stepLines,
          '',
          result.message || '',
          success && result.removed ? '\n[OK] Screen lock removed - data intact' : '',
        ].join('\n')
        errorMsg = success ? undefined : (result.error || 'Screen lock removal failed')
      } else if (operation.id === 'remove-lock-ios') {
        const result = await tauri.removeLock(device.serial, 'ios')
        success = result.success
        const stepLines = (result.steps || []).map(
          (s) => `${s.ok ? '[OK]' : '[--]'} ${s.label}: ${s.output}`
        )
        output = [
          ...stepLines,
          '',
          result.message || '',
          success ? '\n[OK] Lock status checked' : '',
        ].join('\n')
        errorMsg = success ? undefined : (result.error || 'iPhone lock state check failed')
      } else {
        const result = await tauri.runCommand(operation.command, device.serial, device.bootMode)
        success = result.success
        output = `${result.output ? `${result.output}\n` : ''}${success ? '[OK] Operation succeeded' : '[ERROR] Operation failed'}`
        errorMsg = success ? undefined : (result.error || 'Operation failed')
      }

      setOperationStatuses((prev) => ({
        ...prev,
        [executionId]: {
          ...prev[executionId],
          status: success ? 'success' : 'error',
          progress: 100,
          endTime: new Date(),
          error: errorMsg,
          output: prev[executionId].output
            + `$ ${operation.command}\n`
            + (output ? `${output}\n` : '')
            + (success ? '\n[OK] Operation succeeded\n' : '\n[ERROR] Operation failed\n'),
        },
      }))
    } catch (err) {
      setOperationStatuses((prev) => ({
        ...prev,
        [executionId]: {
          ...prev[executionId],
          status: 'error',
          progress: 100,
          endTime: new Date(),
          error: `Execution error: ${err}`,
          output: prev[executionId].output + `\n[ERROR] ${err}\n`,
        },
      }))
    }

    setActiveOperation(null)
  }, [])

  const handleOpenShell = async (device: Device) => {
    await tauri.invoke('open_terminal', {
      command: device.container ? `docker exec techbench-${device.container} bash` : 'bash',
    })
  }

  const handleBackup = async (device: Device) => {
    if (device.container) {
      await tauri.invoke('run_adb_command', {
        device: device.serial ?? device.vendorId,
        command: 'backup',
      })
    }
  }

  const handleCopyInfo = async (device: Device) => {
    const info = [
      `${device.vendorName} ${device.productName}`,
      `VID:PID ${device.vendorId}:${device.productId}`,
      `Type: ${device.deviceType}`,
      `Boot: ${device.bootMode}`,
      `Serial: ${device.serial ?? 'N/A'}`,
      `Chipset: ${device.chipset ?? 'N/A'}`,
      `Container: ${device.container ?? 'N/A'}`,
      `Tools: ${device.tools.join(', ')}`,
    ].join('\n')
    await navigator.clipboard.writeText(info)
  }

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Device List */}
      <div className="w-80 glass rounded-2xl p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Devices</h2>
          <span className="text-[10px] font-mono text-white/30 px-2 py-0.5 rounded-full bg-surface-3">
            {devices.length}
          </span>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar space-y-2">
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <p className="text-sm text-white/40 mb-1">No devices connected</p>
              <p className="text-xs text-white/20">Plug in a USB device to begin</p>
            </div>
          ) : (
            devices.map((device) => {
              const colors = TYPE_COLORS[device.deviceType] ?? TYPE_COLORS.generic
              const isSelected = selectedDeviceId === device.id

              return (
                <button
                  key={device.id}
                  onClick={() => selectDevice(device.id === selectedDeviceId ? null : device.id)}
                  className={`
                    w-full text-left p-3 rounded-xl transition-all duration-200 group
                    ${isSelected
                      ? 'bg-gradient-to-r from-neon-blue/10 to-transparent border border-neon-blue/20 shadow-lg shadow-neon-blue/5'
                      : 'bg-surface-2/40 border border-transparent hover:bg-surface-3/40 hover:border-white/5'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-white/90 truncate">
                        {device.productName}
                      </div>
                      <div className="text-xs text-white/40 truncate">{device.vendorName}</div>
                    </div>
                    <div className={`status-dot ${device.status === 'connected' ? 'status-connected' : 'status-disconnected'} mt-1.5`} />
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} ${colors.border} border`}>
                      {device.bootMode}
                    </span>
                    <span className="text-[10px] text-white/20 font-mono">
                      {getAvailableOperations(device).length} ops
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Device Details */}
      <div className="flex-1 glass rounded-2xl p-6 overflow-auto custom-scrollbar">
        {selectedDevice ? (
          <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white/90 mb-1">{selectedDevice.productName}</h2>
                <p className="text-sm text-white/40">{selectedDevice.vendorName}</p>
              </div>
              <div className={`status-dot ${selectedDevice.status === 'connected' ? 'status-connected' : 'status-disconnected'} w-3 h-3`} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-surface-2/40 rounded-xl p-1 border border-white/5">
              {[
                { id: 'info' as const, label: 'Info' },
                { id: 'operations' as const, label: `Operations (${getAvailableOperations(selectedDevice).length})` },
                { id: 'apps' as const, label: 'Apps' },
                { id: 'tools' as const, label: 'Tools' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20'
                      : 'text-white/40 hover:text-white/60 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Info Tab */}
            {activeTab === 'info' && (
              <div className="animate-fade-in">
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: 'VID:PID', value: `${selectedDevice.vendorId}:${selectedDevice.productId}`, mono: true },
                    { label: 'Boot Mode', value: selectedDevice.bootMode },
                    { label: 'Device Type', value: selectedDevice.deviceType },
                    { label: 'Serial', value: selectedDevice.serial ?? 'N/A', mono: true },
                    { label: 'Chipset', value: selectedDevice.chipset ?? 'N/A' },
                    { label: 'Container', value: selectedDevice.container ?? 'N/A', mono: true },
                  ].map((item) => (
                    <div key={item.label} className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                      <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{item.label}</div>
                      <div className={`text-sm font-medium text-white/80 ${item.mono ? 'font-mono' : ''}`}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mb-6">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Capabilities</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedDevice.capabilities.canFlash && (
                      <span className="px-3 py-1.5 rounded-lg bg-neon-green/10 text-neon-green border border-neon-green/20 text-xs font-medium">
                        Flash
                      </span>
                    )}
                    {selectedDevice.capabilities.canBackup && (
                      <span className="px-3 py-1.5 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/20 text-xs font-medium">
                        Backup
                      </span>
                    )}
                    {selectedDevice.capabilities.canIsp && (
                      <span className="px-3 py-1.5 rounded-lg bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/20 text-xs font-medium">
                        ISP
                      </span>
                    )}
                    {selectedDevice.capabilities.canUnlockBootloader && (
                      <span className="px-3 py-1.5 rounded-lg bg-neon-purple/10 text-neon-purple border border-neon-purple/20 text-xs font-medium">
                        Unlock
                      </span>
                    )}
                    {selectedDevice.capabilities.canReadInfo && (
                      <span className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 border border-white/10 text-xs font-medium">
                        Read Info
                      </span>
                    )}
                    {selectedDevice.capabilities.canJtag && (
                      <span className="px-3 py-1.5 rounded-lg bg-neon-orange/10 text-neon-orange border border-neon-orange/20 text-xs font-medium">
                        JTAG
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Operations Tab */}
            {activeTab === 'operations' && (
              <div className="animate-fade-in">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] text-white/30 uppercase tracking-wider">
                      {selectedDevice.deviceType === 'apple' ? 'iOS Operations' : 'Android Operations'}
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      selectedDevice.deviceType === 'apple'
                        ? 'bg-white/5 text-white/50 border border-white/10'
                        : 'bg-neon-green/10 text-neon-green border border-neon-green/20'
                    }`}>
                      {selectedDevice.deviceType === 'apple' ? 'iOS' : 'Android'}
                    </span>
                  </div>
                  {getAvailableOperations(selectedDevice).length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-16 bg-surface-2/20 rounded-2xl border border-white/5">
                      <div className="w-14 h-14 rounded-2xl bg-surface-3/40 flex items-center justify-center mb-3">
                        <svg className="w-7 h-7 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
                        </svg>
                      </div>
                      <p className="text-sm text-white/50 mb-1">No operations available</p>
                      <p className="text-xs text-white/25 max-w-xs">
                        No operations are defined for {selectedDevice.deviceType} devices in {selectedDevice.bootMode} mode.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                    {getAvailableOperations(selectedDevice).map((operation) => {
                      const catColors = CATEGORY_COLORS[operation.category]
                      const execution = Object.values(operationStatuses).find(
                        (e) => e.operationId === operation.id && e.deviceId === selectedDevice.id
                      )
                      const isRunning = execution?.status === 'running'

                      return (
                        <div
                          key={operation.id}
                          className={`p-4 rounded-xl border transition-all ${
                            execution?.status === 'success'
                              ? 'bg-neon-green/5 border-neon-green/20'
                              : execution?.status === 'error'
                              ? 'bg-red-500/5 border-red-500/20'
                              : 'bg-surface-2/40 border-white/5 hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded ${catColors.bg} ${catColors.text} ${catColors.border} border capitalize`}>
                                {operation.category}
                              </span>
                              <span className={`text-[10px] font-medium ${RISK_COLORS[operation.riskLevel]}`}>
                                {operation.riskLevel}
                              </span>
                            </div>
                            {execution && (
                              <span className={`text-[10px] px-2 py-0.5 rounded ${STATUS_COLORS[execution.status].bg} ${STATUS_COLORS[execution.status].text} capitalize`}>
                                {execution.status}
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-medium text-white/80 mb-1">{operation.name}</h4>
                          <p className="text-[10px] text-white/30 mb-3 line-clamp-2">{operation.description}</p>

                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-white/20 truncate max-w-[60%]">
                              {operation.command.substring(0, 30)}...
                            </span>
                            <button
                              onClick={() => handleRunOperation(selectedDevice, operation)}
                              disabled={isRunning || activeOperation !== null}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                                isRunning
                                  ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20 cursor-wait'
                                  : 'bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20'
                              } disabled:opacity-50`}
                            >
                              {isRunning ? (
                                <span className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 border border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
                                  Running
                                </span>
                              ) : (
                                'Run'
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  )}
                </div>

                {/* Operation Output */}
                {activeOperation && operationStatuses[activeOperation] && (
                  <div className="mt-4 bg-surface-1/50 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-white/60">Output</span>
                      <span className="text-[10px] text-white/30">
                        {operationStatuses[activeOperation].progress}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-3/60 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full transition-all ${
                          operationStatuses[activeOperation].status === 'success'
                            ? 'bg-neon-green'
                            : operationStatuses[activeOperation].status === 'error'
                            ? 'bg-red-400'
                            : 'bg-neon-blue'
                        }`}
                        style={{ width: `${operationStatuses[activeOperation].progress}%` }}
                      />
                    </div>
                    <pre className="text-[10px] font-mono text-neon-green/70 whitespace-pre-wrap max-h-32 overflow-auto">
                      {operationStatuses[activeOperation].output}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Apps Tab */}
            {activeTab === 'apps' && (
              <div className="animate-fade-in h-[calc(100vh-280px)]">
                <AppManager deviceSerial={selectedDevice.serial} deviceName={selectedDevice.productName} deviceType={selectedDevice.deviceType} />
              </div>
            )}

            {/* Tools Tab */}
            {activeTab === 'tools' && (
              <div className="animate-fade-in">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Available Tools</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
                  {visibleTools.length === 0 && (
                    <div className="col-span-full text-xs text-white/30 py-6 text-center border border-dashed border-white/10 rounded-lg">
                      No tools detected. Install them (e.g. <code className="text-white/50">libimobiledevice-utils</code>, platform-tools) and refresh.
                    </div>
                  )}
                  {visibleTools.map((tool) => (
                    <div
                      key={tool.name}
                      className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                        tool.available
                          ? 'bg-surface-3/60 border-white/5 hover:border-white/15'
                          : 'bg-surface-3/30 border-white/5 opacity-40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-mono ${tool.available ? 'text-white/70' : 'text-white/40'}`}>{tool.display}</span>
                        {tool.available && (
                          <span className={`w-1.5 h-1.5 rounded-full ${runningTool === tool.name ? 'bg-neon-yellow animate-pulse' : 'bg-neon-green'}`} />
                        )}
                      </div>
                      <div className="text-[10px] text-white/30 mt-0.5 truncate" title={tool.description}>{tool.description}</div>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          onClick={() => handleRunTool(tool.name)}
                          disabled={!tool.available || !tool.runnable || runningTool !== null}
                          className="text-[10px] px-2 py-1 rounded bg-neon-green/10 text-neon-green border border-neon-green/20 hover:bg-neon-green/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          {runningTool === tool.name ? 'Running...' : 'Run'}
                        </button>
                        {!tool.available && (
                          <span className="text-[10px] px-2 py-1 rounded bg-white/5 text-white/30">not installed</span>
                        )}
                        {!tool.runnable && tool.available && (
                          <span className="text-[10px] px-2 py-1 rounded bg-white/5 text-white/30">stream only</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {toolOutput && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${toolOutput.success ? 'bg-neon-green/10 text-neon-green' : 'bg-red-500/10 text-red-400'}`}>
                        {toolOutput.success ? 'SUCCESS' : 'ERROR'}
                      </span>
                      {toolOutput.artifact && (
                        <a
                          href={toolOutput.artifact}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] px-2 py-0.5 rounded bg-neon-blue/10 text-neon-blue border border-neon-blue/20 hover:bg-neon-blue/20 transition-colors"
                        >
                          Open artifact
                        </a>
                      )}
                      <button
                        onClick={() => setToolOutput(null)}
                        className="ml-auto text-[10px] text-white/30 hover:text-white/60"
                      >
                        Clear
                      </button>
                    </div>
                    {toolOutput.command && (
                      <div className="text-[10px] text-white/30 font-mono mb-2">{toolOutput.command}</div>
                    )}
                    <pre className="max-h-64 overflow-auto rounded-lg bg-black/40 border border-white/10 p-3 text-[11px] font-mono text-white/70 whitespace-pre-wrap">
                      {toolOutput.output || toolOutput.error || 'No output'}
                    </pre>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => handleOpenShell(selectedDevice)}
                    className="btn-cyber flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Open Shell
                  </button>
                  <button
                    onClick={() => handleCopyInfo(selectedDevice)}
                    className="btn-ghost flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                    Copy Info
                  </button>
                  <button
                    onClick={() => handleBackup(selectedDevice)}
                    className="btn-ghost flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                    </svg>
                    Backup
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-surface-3/30 flex items-center justify-center mb-6 relative">
              <svg className="w-10 h-10 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface-4 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white/20" />
              </div>
            </div>
            <p className="text-sm text-white/40 mb-1">Select a device</p>
            <p className="text-xs text-white/20">Choose a connected device to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
