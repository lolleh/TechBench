import type { Device, DeviceType, BootMode, PowerReading, Partition, DeviceHealth, Modem, ModemInfo } from './types'

let psuOn = false
let psuVoltage = 4.2
let psuCurrentLimit = 2.0

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
const API_BASE = isTauri
  ? 'http://127.0.0.1:1420'
  : isLocalhost
    ? `http://${window.location.hostname}:${window.location.port || '1420'}`
    : ''

export const tauri = {
  invoke: async (cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
    // Try to use real API if available
    if (API_BASE && cmd === 'list_usb_devices') {
      try {
        const response = await fetch(`${API_BASE}/api/devices`)
        if (response.ok) {
          return await response.json()
        }
      } catch {
        // Fall through to mock
      }
    }
    return mockInvoke(cmd, args)
  },
  fetchDevices: async (): Promise<Device[]> => {
    if (API_BASE) {
      try {
        const response = await fetch(`${API_BASE}/api/devices`)
        if (response.ok) {
          const data = await response.json() as Array<Record<string, unknown>>
          return data.map((d) => {
            const mode = (d.mode as string) || 'usb'
            const flashModes = ['fastboot', 'apple', 'edl', 'preloader', 'download', 'meta', 'flash', 'uart']
            const backupModes = ['adb', 'apple', 'recovery']
            return {
              id: d.id as string,
              vendorId: (d.vendorId as string) || '0000',
              productId: (d.productId as string) || '0000',
              vendorName: (d.vendorName as string) || 'Unknown',
              productName: (d.productName as string) || 'Unknown Device',
              deviceType: (d.deviceType as DeviceType) || 'android',
              bootMode: (d.bootMode as BootMode) || 'normal',
              tools: mode === 'fastboot' ? ['fastboot', 'adb']
                : mode === 'apple' ? ['idevice', 'irecovery']
                : mode === 'edl' ? ['edl', 'qfill']
                : mode === 'preloader' || mode === 'meta' ? ['mtkflash']
                : mode === 'download' ? ['odin']
                : mode === 'diag' ? ['diag']
                : mode === 'serial' || mode === 'uart' ? ['serial']
                : mode === 'adb' ? ['adb']
                : mode === 'modem' || mode === 'mifi' ? ['mmcli', 'at']
                : mode === 'usb' ? []
                : ['adb'],
              container: null,
              status: 'connected' as const,
              serial: (d.serial as string) || null,
              chipset: (d.chipset as string) || null,
              workspacePath: '',
              capabilities: {
                canFlash: flashModes.includes(mode),
                canReadInfo: true,
                canBackup: backupModes.includes(mode),
                canRestore: flashModes.includes(mode),
                canUnlockBootloader: mode === 'fastboot',
                canIsp: false,
                canJtag: false,
                supportedProtocols: mode === 'fastboot' ? ['fastboot']
                  : mode === 'apple' ? ['idevice']
                  : mode === 'edl' ? ['edl', 'qualcomm']
                  : mode === 'preloader' || mode === 'meta' ? ['mediatek', 'brom']
                  : mode === 'download' ? ['odin', 'samsung']
                  : mode === 'diag' ? ['diag', 'qualcomm']
                  : mode === 'adb' || mode === 'recovery' ? ['adb']
                  : mode === 'usb' ? ['usb']
                  : [],
              },
              firstSeen: new Date(),
              lastSeen: new Date(),
            }
          })
        }
      } catch {
        // API not available
      }
    }
    return []
  },
  fetchModems: async (): Promise<Modem[]> => {
    if (API_BASE) {
      try {
        const response = await fetch(`${API_BASE}/api/modems`)
        if (response.ok) return await response.json() as Modem[]
      } catch {
        // API not available
      }
    }
    return []
  },
  readModemInfo: async (): Promise<{ available: boolean; message: string; modems: ModemInfo[] }> => {
    const empty = { available: false, message: 'Unable to reach TechBench server', modems: [] }
    if (!API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/modems/info`)
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  sendModemAt: async (port: string, index: number | null, command: string): Promise<{ success: boolean; message: string; response: string }> => {
    const empty = { success: false, message: 'Unable to reach TechBench server', response: '' }
    if (!API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/modems/at`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, index, command }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  modemUnlockCatalog: async (): Promise<{
    vendors: Array<{ id: string; name: string; notes: string; query: string[]; codeTypes: string[] }>
    facilities: Array<{ id: string; label: string; facility: string }>
  }> => {
    const empty = { vendors: [], facilities: [] }
    if (!API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/modems/unlock`)
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  modemUnlock: async (
    action: 'status' | 'unlock',
    modem: Modem,
    vendor: string,
    codeType: string,
    code: string,
  ): Promise<{
    success: boolean
    error: string
    message: string
    unlocked: boolean | null
    vendor: string
    steps: Array<{ label: string; command: string; ok: boolean; output: string }>
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', message: '', unlocked: null, vendor: '', steps: [] }
    if (!API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/modems/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          port: modem.port || '',
          index: modem.index ?? null,
          vendor,
          codeType,
          code,
        }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  zteWebUnlock: async (opts: {
    interface?: string
    gateway?: string
    password?: string
    code?: string
    imei?: string
  }): Promise<{
    success: boolean
    error: string
    message: string
    unlocked: boolean | null
    imei: string
    nckAttempts: string
    base: string
    interface: string
    unlockResponse: Record<string, unknown> | null
    steps: Array<{ label: string; ok: boolean; output: string }>
    warning: string
    autoComputed: boolean
    compatBlocked: boolean
  }> => {
    const empty = {
      success: false, error: 'Unable to reach TechBench server', message: '',
      unlocked: null, imei: '', nckAttempts: '', base: '', interface: '',
      unlockResponse: null, steps: [], warning: '', autoComputed: false,
      compatBlocked: false,
    }
    if (!API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/modems/zte/web-unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      })
      if (response.ok) {
        const data = await response.json()
        return {
          success: data.success ?? false,
          error: data.error ?? '',
          message: data.message ?? '',
          unlocked: data.unlocked ?? null,
          imei: data.imei ?? '',
          nckAttempts: data.nckAttempts ?? '',
          base: data.base ?? '',
          interface: data.interface ?? '',
          unlockResponse: data.unlockResponse ?? null,
          steps: data.steps ?? [],
          warning: data.warning ?? '',
          autoComputed: data.autoComputed ?? false,
          compatBlocked: data.compatBlocked ?? false,
        }
      }
    } catch {
      // API not available
    }
    return empty
  },
  fetchIosApps: async (): Promise<{ available: boolean; apps: Array<{ id: string; packageName: string; appName: string; version: string; isSystem: boolean }>; error: string }> => {
    if (API_BASE) {
      try {
        const response = await fetch(`${API_BASE}/api/ios/apps`)
        if (response.ok) {
          const data = await response.json() as { available: boolean; apps: Array<{ id: string; packageName: string; appName: string; version: string; isSystem: boolean }>; error: string }
          return { available: data.available ?? false, apps: data.apps ?? [], error: data.error ?? '' }
        }
      } catch {
        // API not available
      }
    }
    return { available: false, apps: [], error: 'Unable to reach TechBench server' }
  },
  iosUninstall: async (packageName: string): Promise<{ success: boolean; message: string }> => {
    if (API_BASE) {
      try {
        const response = await fetch(`${API_BASE}/api/ios/apps/uninstall`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageName }),
        })
        if (response.ok) return await response.json() as { success: boolean; message: string }
      } catch {
        // API not available
      }
    }
    return { success: false, message: 'Unable to reach TechBench server' }
  },
  iosInstall: async (file: File, upgrade: boolean): Promise<{ success: boolean; message: string }> => {
    if (API_BASE) {
      try {
        const response = await fetch(`${API_BASE}/api/ios/apps/${upgrade ? 'upgrade' : 'install'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file,
        })
        if (response.ok) return await response.json() as { success: boolean; message: string }
      } catch {
        // API not available
      }
    }
    return { success: false, message: 'Unable to reach TechBench server' }
  },
  runCommand: async (command: string, serial: string | null, mode: string): Promise<{ success: boolean; output: string; error: string }> => {
    if (API_BASE) {
      try {
        const response = await fetch(`${API_BASE}/api/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command, serial, mode }),
        })
        if (response.ok) return await response.json() as { success: boolean; output: string; error: string }
      } catch {
        // API not available
      }
    }
    return { success: false, output: '', error: 'Unable to reach TechBench server' }
  },
  fetchDeviceHealth: async (serial: string, deviceType: string): Promise<{ success: boolean; error: string; health: DeviceHealth | null }> => {
    if (API_BASE) {
      try {
        const response = await fetch(`${API_BASE}/api/device-health`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serial, deviceType }),
        })
        if (response.ok) return await response.json() as { success: boolean; error: string; health: DeviceHealth | null }
      } catch {
        // API not available
      }
    }
    return { success: false, error: 'Unable to reach TechBench server', health: null }
  },
  removeLock: async (serial: string | null, platform: string): Promise<{
    success: boolean
    removed: boolean
    error: string
    message: string
    steps: Array<{ label: string; command: string; ok: boolean; output: string }>
  }> => {
    const empty = { success: false, removed: false, error: 'Unable to reach TechBench server', message: '', steps: [] }
    if (!serial || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/remove-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, platform }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  mirrorScreenshot: async (serial: string, deviceType: string): Promise<{
    ok: boolean
    blob?: Blob
    error?: string
  }> => {
    if (!serial || !API_BASE) return { ok: false, error: 'Unable to reach TechBench server' }
    try {
      const response = await fetch(
        `${API_BASE}/api/mirror/screenshot?serial=${encodeURIComponent(serial)}&deviceType=${encodeURIComponent(deviceType)}&t=${Date.now()}`,
      )
      const contentType = response.headers.get('Content-Type') || ''
      if (response.ok && contentType.includes('image/png')) {
        return { ok: true, blob: await response.blob() }
      }
      let error = `Screenshot failed (HTTP ${response.status})`
      try {
        const data = await response.json() as { error?: string; success?: boolean }
        error = data.error || error
      } catch {
        // not JSON
      }
      return { ok: false, error }
    } catch {
      return { ok: false, error: 'Unable to reach TechBench server' }
    }
  },
  mirrorInput: async (serial: string, deviceType: string, payload: Record<string, unknown>): Promise<{
    success: boolean
    error: string
  }> => {
    if (!serial || !API_BASE) return { success: false, error: 'Unable to reach TechBench server' }
    try {
      const response = await fetch(`${API_BASE}/api/mirror/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, deviceType, ...payload }),
      })
      if (response.ok) return await response.json() as { success: boolean; error: string }
    } catch {
      // API not available
    }
    return { success: false, error: 'Unable to reach TechBench server' }
  },
  quickMediaBackup: async (serial: string | null): Promise<{
    success: boolean
    error: string
    backupPath: string
    totalFiles: number
    totalBytes: number
    dirs: Array<{ dir: string; ok: boolean; files: number; bytes: number; output: string }>
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', backupPath: '', totalFiles: 0, totalBytes: 0, dirs: [] }
    if (!serial || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/backup/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  iosMediaBackup: async (serial: string | null): Promise<{
    success: boolean
    error: string
    backupPath: string
    totalFiles: number
    totalBytes: number
    dirs: Array<{ dir: string; ok: boolean; files: number; bytes: number; output: string }>
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', backupPath: '', totalFiles: 0, totalBytes: 0, dirs: [] }
    if (!serial || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/backup/ios-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  recoverAndroidDeleted: async (serial: string | null): Promise<{
    success: boolean
    error: string
    recoveredPath: string
    totalFiles: number
    totalBytes: number
    message: string
    dirs: Array<{ dir: string; ok: boolean; files: number; bytes: number; output: string }>
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', recoveredPath: '', totalFiles: 0, totalBytes: 0, message: '', dirs: [] }
    if (!serial || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/recover/android-deleted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  recoverIosDeleted: async (serial: string | null): Promise<{
    success: boolean
    error: string
    recoveredPath: string
    totalFiles: number
    totalBytes: number
    message: string
    files: Array<{ dir: string; file: string; kind: string; ok: boolean; bytes: number; output: string }>
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', recoveredPath: '', totalFiles: 0, totalBytes: 0, message: '', files: [] }
    if (!serial || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/recover/ios-deleted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  networkUnlock: async (serial: string | null, platform: 'android' | 'ios'): Promise<{
    success: boolean
    error: string
    message: string
    steps: Array<{ label: string; command: string; ok: boolean; output: string }>
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', message: '', steps: [] }
    if (!serial || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/network-unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, platform }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  fetchTools: async (): Promise<Array<{
    name: string
    display: string
    description: string
    category: string
    action: string
    runnable: boolean
    available: boolean
    path: string | null
  }>> => {
    if (API_BASE) {
      try {
        const response = await fetch(`${API_BASE}/api/tools`)
        if (response.ok) return await response.json() as Array<{
          name: string
          display: string
          description: string
          category: string
          action: string
          runnable: boolean
          available: boolean
          path: string | null
        }>
      } catch {
        // API not available
      }
    }
    return []
  },
  fetchPartitions: async (serial: string | null, mode: string, deviceType: string): Promise<{
    partitions: Array<{ id: string; name: string; size: number; type: Partition['type']; status: Partition['status']; node: string }>
    error: string
  }> => {
    const empty = { partitions: [], error: 'Unable to reach TechBench server' }
    if (!API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/partitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, mode, deviceType }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  runTool: async (name: string, device: { mode: string; serial: string | null }): Promise<{
    success: boolean
    error: string
    output: string
    command: string
    artifact: string | null
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', output: '', command: '', artifact: null }
    if (!API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/tools/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mode: device.mode, serial: device.serial }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  jailbreakInfo: async (serial: string | null): Promise<{
    success: boolean
    error: string
    device: {
      name: string
      marketingName: string
      model: string
      productType: string
      modelNumber: string
      iosVersion: string
      build: string
      serial: string
    } | null
    assessment: {
      chip: string
      checkm8: boolean
      iosVersion: string
      status: 'supported' | 'unsupported'
      verdict: string
      tools: Array<{ name: string; description: string; supported: boolean; note: string }>
    } | null
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', device: null, assessment: null }
    if (!serial || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/jailbreak/info?serial=${encodeURIComponent(serial)}`)
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  icloudActivation: async (id: string): Promise<{
    success: boolean
    error: string
    identifier: string
    locked: boolean
    established: boolean
    desc: string
    raw: Record<string, unknown>
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', identifier: id, locked: false, established: false, desc: '', raw: {} }
    if (!id || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/icloud/activation?id=${encodeURIComponent(id)}`)
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  icloudInfo: async (serial: string | null): Promise<{
    success: boolean
    error: string
    device: Record<string, string> | null
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', device: null }
    if (!serial || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/icloud/info?serial=${encodeURIComponent(serial)}`)
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  stopUpdate: async (action: 'status' | 'block' | 'unblock', serial: string | null, days?: number): Promise<{
    success: boolean
    error: string
    blocked: boolean
    identifiers: string[]
    message: string
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', blocked: false, identifiers: [], message: '' }
    if (!serial || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/apple/stop-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, serial, days }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  virtualLocation: async (action: 'status' | 'set' | 'clear', serial: string | null, lat?: number, lng?: number): Promise<{
    success: boolean
    error: string
    active: boolean
    lat: number | null
    lng: number | null
    message: string
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', active: false, lat: null, lng: null, message: '' }
    if (!serial || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/apple/virtual-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, serial, lat, lng }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  mdmStatus: async (serial: string | null, deviceType: string): Promise<{
    success: boolean
    error: string
    platform: string
    enrolled: boolean
    entries: Array<{ identifier: string; name: string; kind: string }>
    message: string
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', platform: '', enrolled: false, entries: [], message: '' }
    if (!serial || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/mdm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', deviceType, serial }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  mdmRemove: async (serial: string | null, deviceType: string, identifier: string): Promise<{
    success: boolean
    error: string
    removed: boolean
    message: string
    output: string
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', removed: false, message: '', output: '' }
    if (!serial || !API_BASE) return empty
    try {
      const response = await fetch(`${API_BASE}/api/mdm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', deviceType, serial, identifier }),
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
  },
  updateApp: async (): Promise<{
    success: boolean
    error: string
    message: string
    behind: number
    ahead: number
    steps: Array<{ label: string; ok: boolean; output: string }>
  }> => {
    const empty = { success: false, error: 'Unable to reach TechBench server', message: '', behind: 0, ahead: 0, steps: [] }
    try {
      const response = await fetch(`${API_BASE}/api/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (response.ok) return await response.json() as typeof empty
    } catch {
      // API not available
    }
    return empty
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
