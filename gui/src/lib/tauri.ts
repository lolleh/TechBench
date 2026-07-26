import type { Device, PowerReading } from './types'

let psuOn = false
let psuVoltage = 4.2
let psuCurrentLimit = 2.0

export const tauri = {
  invoke: async (cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
    return mockInvoke(cmd, args)
  },
}

async function mockInvoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 100))

  switch (cmd) {
    case 'list_usb_devices':
      return mockListUsbDevices()
    case 'get_device_info':
      return mockGetDeviceInfo(args as { vendorId: string; productId: string })
    case 'start_sigrok_capture':
      return { status: 'started', sessionId: crypto.randomUUID() }
    case 'stop_sigrok_capture':
      return { status: 'stopped' }
    case 'get_signal_data':
      return mockSignalData(args as { channels: string[]; sampleRate: number })
    case 'psu_set_voltage':
      psuVoltage = (args as { voltage: number }).voltage
      return { status: 'ok', voltage: psuVoltage }
    case 'psu_set_current_limit':
      psuCurrentLimit = (args as { current: number }).current
      return { status: 'ok', current: psuCurrentLimit }
    case 'psu_toggle':
      psuOn = (args as { enabled: boolean }).enabled
      return { status: 'ok', on: psuOn }
    case 'psu_read':
      return mockPsuRead()
    case 'launch_container':
      return { status: 'started', containerId: crypto.randomUUID().slice(0, 12) }
    case 'stop_container':
      return { status: 'stopped' }
    case 'run_adb_command':
      return mockAdbCommand(args as { device: string; command: string })
    case 'run_fastboot_command':
      return mockFastbootCommand(args as { device: string; command: string })
    case 'adb_list_apps':
      return mockAdbListApps(args as { device: string; includeSystem?: boolean })
    case 'adb_get_app_details':
      return mockAdbAppDetails(args as { device: string; packageName: string })
    case 'adb_uninstall_app':
      return mockAdbUninstall(args as { device: string; packageName: string; force?: boolean })
    case 'adb_upgrade_app':
      return mockAdbUpgrade(args as { device: string; packageName: string })
    case 'adb_disable_app':
      return mockAdbDisable(args as { device: string; packageName: string })
    case 'adb_enable_app':
      return mockAdbEnable(args as { device: string; packageName: string })
    case 'adb_clear_app_data':
      return mockAdbClearData(args as { device: string; packageName: string })
    case 'adb_force_stop_app':
      return mockAdbForceStop(args as { device: string; packageName: string })
    case 'open_terminal':
      return { status: 'opened', pid: Math.floor(Math.random() * 10000) }
    default:
      return { status: 'ok', message: `Mock: ${cmd} executed` }
  }
}

function mockListUsbDevices(): Device[] {
  return []
}

function mockGetDeviceInfo(args: { vendorId: string; productId: string }): Partial<Device> {
  return {
    vendorId: args.vendorId,
    productId: args.productId,
    status: 'connected',
  }
}

export function mockSignalData(args: { channels: string[]; sampleRate: number }): number[][] {
  const { channels, sampleRate } = args
  const points = 200
  const data: number[][] = []

  for (let ch = 0; ch < channels.length; ch++) {
    const channelData: number[] = []
    const freq = (sampleRate / 1000) * (0.5 + Math.random())
    const phase = (ch * Math.PI) / 2

    for (let i = 0; i < points; i++) {
      const t = i / points
      let v = 0
      v += Math.sin(2 * Math.PI * freq * t + phase) * 1.5
      v += Math.sin(2 * Math.PI * freq * 3 * t + phase) * 0.3
      v += (Math.random() - 0.5) * 0.1
      channelData.push(v)
    }
    data.push(channelData)
  }

  return data
}

function mockPsuRead(): PowerReading {
  if (!psuOn) {
    return { timestamp: Date.now(), voltage: 0, current: 0, power: 0 }
  }

  const voltage = psuVoltage + (Math.random() - 0.5) * 0.02
  const current = Math.min(
    psuCurrentLimit,
    Math.max(0, 0.3 + Math.random() * 0.8 + (Math.random() > 0.9 ? 1.5 : 0))
  )

  return {
    timestamp: Date.now(),
    voltage: Math.round(voltage * 1000) / 1000,
    current: Math.round(current * 1000) / 1000,
    power: Math.round(voltage * current * 1000) / 1000,
  }
}

function mockAdbCommand(args: { device: string; command: string }): string {
  const { command } = args
  if (command === 'devices') {
    return 'List of devices attached\n\tdevice'
  }
  if (command.startsWith('shell getprop')) {
    return 'userdebug'
  }
  return `OK: ${command}`
}

function mockFastbootCommand(args: { device: string; command: string }): string {
  return `OK: ${args.command}`
}

const MOCK_DEVICE_APPS: Record<string, Array<{ package: string; version: string; versionCode: number; size: number; installDate: string; isSystem: boolean; targetSdk: number; minSdk: number; apkPath: string }>> = {
  default: [
    { package: 'com.android.settings', version: '13.0.0', versionCode: 33, size: 52428800, installDate: '2024-01-15', isSystem: true, targetSdk: 33, minSdk: 28, apkPath: '/system/priv-app/Settings/Settings.apk' },
    { package: 'com.android.chrome', version: '121.0.6167.101', versionCode: 616710123, size: 268435456, installDate: '2024-01-10', isSystem: false, targetSdk: 34, minSdk: 24, apkPath: '/data/app/com.android.chrome/base.apk' },
    { package: 'com.android.systemui', version: '13.0.0', versionCode: 33, size: 83886080, installDate: '2024-01-15', isSystem: true, targetSdk: 33, minSdk: 28, apkPath: '/system/priv-app/SystemUI/SystemUI.apk' },
    { package: 'com.google.android.gms', version: '24.02.14', versionCode: 240214000, size: 167772160, installDate: '2024-01-15', isSystem: true, targetSdk: 34, minSdk: 21, apkPath: '/system/priv-app/GmsCore/GmsCore.apk' },
    { package: 'com.android.vending', version: '40.1.21', versionCode: 40121000, size: 67108864, installDate: '2024-01-15', isSystem: true, targetSdk: 34, minSdk: 24, apkPath: '/system/priv-app/Phonesky/Phonesky.apk' },
    { package: 'com.android.providers.downloads', version: '13.0.0', versionCode: 33, size: 20971520, installDate: '2024-01-15', isSystem: true, targetSdk: 33, minSdk: 28, apkPath: '/system/priv-app/DownloadProvider/DownloadProvider.apk' },
  ],
  xiaomi: [
    { package: 'com.miui.home', version: '13.0.1', versionCode: 130001, size: 41943040, installDate: '2024-01-15', isSystem: true, targetSdk: 33, minSdk: 28, apkPath: '/system/priv-app/MiuiHome/MiuiHome.apk' },
    { package: 'com.miui.securitycenter', version: '13.0.5', versionCode: 130005, size: 94371840, installDate: '2024-01-15', isSystem: true, targetSdk: 33, minSdk: 28, apkPath: '/system/priv-app/SecurityCenter/SecurityCenter.apk' },
    { package: 'com.miui.gallery', version: '13.0.2', versionCode: 130002, size: 62914560, installDate: '2024-01-15', isSystem: true, targetSdk: 33, minSdk: 28, apkPath: '/system/priv-app/Gallery/Gallery.apk' },
    { package: 'com.xiaomi.market', version: '4.12.0', versionCode: 4120000, size: 45088768, installDate: '2024-01-15', isSystem: false, targetSdk: 33, minSdk: 24, apkPath: '/data/app/com.xiaomi.market/base.apk' },
  ],
  samsung: [
    { package: 'com.samsung.android.visionintelligence', version: '4.0.50', versionCode: 4050000, size: 73400320, installDate: '2024-01-15', isSystem: true, targetSdk: 33, minSdk: 28, apkPath: '/system/priv-app/BixbyVision/BixbyVision.apk' },
    { package: 'com.samsung.android.game.gamehome', version: '2.5.04', versionCode: 2504000, size: 35651584, installDate: '2024-01-15', isSystem: true, targetSdk: 33, minSdk: 28, apkPath: '/system/priv-app/GameHome/GameHome.apk' },
    { package: 'com.sec.android.app.sbrowser', version: '23.0.0.49', versionCode: 230004900, size: 134217728, installDate: '2024-01-10', isSystem: true, targetSdk: 33, minSdk: 28, apkPath: '/system/priv-app/Internet/Internet.apk' },
  ],
  lenovo: [
    { package: 'com.lenovo.anyshare.gps', version: '9.0.0', versionCode: 9000000, size: 78643200, installDate: '2024-01-15', isSystem: true, targetSdk: 33, minSdk: 28, apkPath: '/system/priv-app/SHAREit/SHAREit.apk' },
    { package: 'com.lenovo.launcher', version: '6.0.0', versionCode: 6000000, size: 52428800, installDate: '2024-01-15', isSystem: true, targetSdk: 33, minSdk: 28, apkPath: '/system/priv-app/LenovoLauncher/LenovoLauncher.apk' },
    { package: 'com.zui.privacypolicy', version: '1.0.0', versionCode: 10000, size: 10485760, installDate: '2024-01-15', isSystem: true, targetSdk: 33, minSdk: 28, apkPath: '/system/priv-app/PrivacyPolicy/PrivacyPolicy.apk' },
  ],
}

const MOCK_APP_PERMISSIONS: Record<string, string[]> = {
  default: ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'],
  chrome: ['android.permission.INTERNET', 'android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.READ_EXTERNAL_STORAGE'],
  settings: ['android.permission.BLUETOOTH', 'android.permission.BLUETOOTH_ADMIN', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.CAMERA'],
  miui: ['android.permission.INTERNET', 'android.permission.READ_PHONE_STATE', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.CAMERA', 'android.permission.READ_CONTACTS'],
  samsung: ['android.permission.INTERNET', 'android.permission.READ_PHONE_STATE', 'android.permission.CAMERA', 'android.permission.ACCESS_FINE_LOCATION'],
  gms: ['android.permission.INTERNET', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.READ_PHONE_STATE', 'android.permission.BLUETOOTH', 'android.permission.NFC'],
}

function getPermissionsForPackage(pkg: string): string[] {
  if (pkg.includes('chrome')) return MOCK_APP_PERMISSIONS.chrome
  if (pkg.includes('settings')) return MOCK_APP_PERMISSIONS.settings
  if (pkg.includes('miui') || pkg.includes('xiaomi')) return MOCK_APP_PERMISSIONS.miui
  if (pkg.includes('samsung')) return MOCK_APP_PERMISSIONS.samsung
  if (pkg.includes('gms') || pkg.includes('vending')) return MOCK_APP_PERMISSIONS.gms
  return MOCK_APP_PERMISSIONS.default
}

function mockAdbListApps(args: { device: string; includeSystem?: boolean }): Array<{ packageName: string; isSystem: boolean }> {
  const { device, includeSystem = true } = args
  let apps = MOCK_DEVICE_APPS.default

  const lower = device.toLowerCase()
  if (lower.includes('xiaomi') || lower.includes('redmi') || lower.includes('poco')) {
    apps = [...apps, ...MOCK_DEVICE_APPS.xiaomi]
  } else if (lower.includes('samsung')) {
    apps = [...apps, ...MOCK_DEVICE_APPS.samsung]
  } else if (lower.includes('lenovo')) {
    apps = [...apps, ...MOCK_DEVICE_APPS.lenovo]
  }

  if (!includeSystem) {
    return apps.filter((a) => !a.isSystem).map((a) => ({ packageName: a.package, isSystem: false }))
  }

  return apps.map((a) => ({ packageName: a.package, isSystem: a.isSystem }))
}

function mockAdbAppDetails(args: { device: string; packageName: string }): Record<string, unknown> | null {
  const { device, packageName } = args
  const lower = device.toLowerCase()
  let apps = MOCK_DEVICE_APPS.default

  if (lower.includes('xiaomi') || lower.includes('redmi') || lower.includes('poco')) {
    apps = [...apps, ...MOCK_DEVICE_APPS.xiaomi]
  } else if (lower.includes('samsung')) {
    apps = [...apps, ...MOCK_DEVICE_APPS.samsung]
  } else if (lower.includes('lenovo')) {
    apps = [...apps, ...MOCK_DEVICE_APPS.lenovo]
  }

  const app = apps.find((a) => a.package === packageName)
  if (!app) return null

  const appName = packageName.split('.').pop() ?? packageName

  return {
    packageName: app.package,
    appName: appName.charAt(0).toUpperCase() + appName.slice(1),
    version: app.version,
    versionCode: app.versionCode,
    size: app.size,
    installDate: app.installDate,
    updateDate: null,
    isSystem: app.isSystem,
    isDisabled: false,
    isUpdated: false,
    permissions: getPermissionsForPackage(packageName),
    apkPath: app.apkPath,
    dataPath: `/data/data/${packageName}`,
    targetSdk: app.targetSdk,
    minSdk: app.minSdk,
  }
}

function mockAdbUninstall(args: { device: string; packageName: string; force?: boolean }): { success: boolean; message: string } {
  const { packageName, force } = args
  const isSystem = MOCK_DEVICE_APPS.default.some((a) => a.package === packageName && a.isSystem)

  if (isSystem && !force) {
    return { success: false, message: `Cannot uninstall system app ${packageName}. Use force=true to remove for current user.` }
  }

  return { success: true, message: force ? `Force uninstalled ${packageName}` : `Uninstalled ${packageName}` }
}

function mockAdbUpgrade(args: { device: string; packageName: string }): { success: boolean; message: string } {
  return { success: true, message: `Upgraded ${args.packageName} to latest version` }
}

function mockAdbDisable(args: { device: string; packageName: string }): { success: boolean; message: string } {
  return { success: true, message: `Disabled ${args.packageName}` }
}

function mockAdbEnable(args: { device: string; packageName: string }): { success: boolean; message: string } {
  return { success: true, message: `Enabled ${args.packageName}` }
}

function mockAdbClearData(args: { device: string; packageName: string }): { success: boolean; message: string } {
  return { success: true, message: `Cleared data for ${args.packageName}` }
}

function mockAdbForceStop(args: { device: string; packageName: string }): { success: boolean; message: string } {
  return { success: true, message: `Force stopped ${args.packageName}` }
}
