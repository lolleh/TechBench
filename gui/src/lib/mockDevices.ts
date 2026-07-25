import type { Device, DeviceType } from './types'

const CHIPSET_DB: Record<string, Partial<Device>> = {
  '05c6:90db': {
    vendorId: '05c6',
    productId: '90db',
    vendorName: 'Qualcomm',
    productName: 'QDLoader 9008',
    deviceType: 'qualcomm',
    bootMode: 'edl',
    tools: ['edl', 'firehose', 'sahara', 'qfil'],
    container: 'qualcomm-edl',
    chipset: 'Snapdragon',
    capabilities: {
      canFlash: true,
      canReadInfo: true,
      canBackup: false,
      canRestore: false,
      canUnlockBootloader: false,
      canIsp: true,
      canJtag: false,
      supportedProtocols: ['sahara', 'firehose'],
    },
  },
  '0e8d:0003': {
    vendorId: '0e8d',
    productId: '0003',
    vendorName: 'MediaTek',
    productName: 'Preloader',
    deviceType: 'mediatek',
    bootMode: 'preloader',
    tools: ['sp-flash-tool', 'mtkclient'],
    container: 'mediatek-flash',
    chipset: 'MTK',
    capabilities: {
      canFlash: true,
      canReadInfo: true,
      canBackup: false,
      canRestore: false,
      canUnlockBootloader: false,
      canIsp: true,
      canJtag: false,
      supportedProtocols: ['mtk_preloader'],
    },
  },
  '04e8:6860': {
    vendorId: '04e8',
    productId: '6860',
    vendorName: 'Samsung',
    productName: 'Download Mode',
    deviceType: 'samsung',
    bootMode: 'download',
    tools: ['heimdall', 'odin'],
    container: 'samsung-odin',
    chipset: 'Exynos',
    capabilities: {
      canFlash: true,
      canReadInfo: true,
      canBackup: true,
      canRestore: true,
      canUnlockBootloader: true,
      canIsp: false,
      canJtag: false,
      supportedProtocols: ['odin'],
    },
  },
  '05ac:1227': {
    vendorId: '05ac',
    productId: '1227',
    vendorName: 'Apple',
    productName: 'DFU Mode',
    deviceType: 'apple',
    bootMode: 'dfu',
    tools: ['idevicerestore', 'checkm8', 'libimobiledevice'],
    container: 'apple-tools',
    chipset: 'A-Series',
    capabilities: {
      canFlash: true,
      canReadInfo: true,
      canBackup: true,
      canRestore: true,
      canUnlockBootloader: false,
      canIsp: false,
      canJtag: false,
      supportedProtocols: ['usb', 'checkm8'],
    },
  },
  '18d1:4ee7': {
    vendorId: '18d1',
    productId: '4ee7',
    vendorName: 'Google',
    productName: 'Pixel (Fastboot)',
    deviceType: 'android',
    bootMode: 'fastboot',
    tools: ['fastboot', 'adb'],
    container: 'android-tools',
    chipset: 'Snapdragon',
    capabilities: {
      canFlash: true,
      canReadInfo: true,
      canBackup: true,
      canRestore: true,
      canUnlockBootloader: true,
      canIsp: false,
      canJtag: false,
      supportedProtocols: ['fastboot'],
    },
  },
  '18d1:d002': {
    vendorId: '18d1',
    productId: 'd002',
    vendorName: 'Google',
    productName: 'Pixel (ADB)',
    deviceType: 'android',
    bootMode: 'normal',
    tools: ['adb'],
    container: 'android-tools',
    chipset: 'Snapdragon',
    capabilities: {
      canFlash: false,
      canReadInfo: true,
      canBackup: true,
      canRestore: false,
      canUnlockBootloader: false,
      canIsp: false,
      canJtag: false,
      supportedProtocols: ['adb'],
    },
  },
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 14)
}

function lookupDevice(vendorId: string, productId: string): Partial<Device> | null {
  const key = `${vendorId}:${productId}`
  return CHIPSET_DB[key] ?? null
}

function guessDeviceType(vendorName: string): DeviceType {
  const lower = vendorName.toLowerCase()
  if (lower.includes('qualcomm') || lower.includes('qcom')) return 'qualcomm'
  if (lower.includes('mediatek') || lower.includes('mtk')) return 'mediatek'
  if (lower.includes('samsung')) return 'samsung'
  if (lower.includes('apple')) return 'apple'
  if (lower.includes('google')) return 'android'
  return 'generic'
}

const SIMULATED_DEVICES: { vendorId: string; productId: string; serial: string }[] = [
  { vendorId: '18d1', productId: '4ee7', serial: 'FA6910301234' },
  { vendorId: '04e8', productId: '6860', serial: 'R5CX21BF1MFN' },
  { vendorId: '05ac', productId: '1227', serial: 'DNQVK0ABCDEFG' },
]

let simulateTimer: ReturnType<typeof setInterval> | null = null

export function startDeviceSimulation(
  addDevice: (d: Device) => void,
  removeDevice: (id: string) => void
) {
  if (simulateTimer) return

  let index = 0

  simulateTimer = setInterval(() => {
    const sim = SIMULATED_DEVICES[index % SIMULATED_DEVICES.length]
    const lookup = lookupDevice(sim.vendorId, sim.productId)

    const device: Device = {
      id: generateId(),
      vendorId: sim.vendorId,
      productId: sim.productId,
      vendorName: lookup?.vendorName ?? 'Unknown',
      productName: lookup?.productName ?? 'Unknown Device',
      deviceType: lookup?.deviceType ?? guessDeviceType(lookup?.vendorName ?? ''),
      bootMode: lookup?.bootMode ?? 'normal',
      tools: lookup?.tools ?? ['adb'],
      container: lookup?.container ?? null,
      status: 'connected',
      serial: sim.serial,
      chipset: lookup?.chipset ?? null,
      workspacePath: `workspaces/${sim.vendorId}_${sim.productId}_${Date.now()}`,
      capabilities: lookup?.capabilities ?? {
        canFlash: false,
        canReadInfo: false,
        canBackup: false,
        canRestore: false,
        canUnlockBootloader: false,
        canIsp: false,
        canJtag: false,
        supportedProtocols: [],
      },
      firstSeen: new Date(),
      lastSeen: new Date(),
    }

    addDevice(device)
    index++

    setTimeout(() => {
      removeDevice(device.id)
    }, 8000)
  }, 5000)
}

export function stopDeviceSimulation() {
  if (simulateTimer) {
    clearInterval(simulateTimer)
    simulateTimer = null
  }
}

export function getDeviceByVidPid(vendorId: string, productId: string): Device | null {
  const lookup = lookupDevice(vendorId, productId)
  if (!lookup) return null

  return {
    id: generateId(),
    ...lookup,
    vendorId,
    productId,
    status: 'connected',
    serial: null,
    workspacePath: `workspaces/${vendorId}_${productId}_${Date.now()}`,
    firstSeen: new Date(),
    lastSeen: new Date(),
  } as Device
}
