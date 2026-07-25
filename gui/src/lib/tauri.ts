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
