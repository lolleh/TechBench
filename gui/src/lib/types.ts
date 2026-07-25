export type DeviceType = 'android' | 'apple' | 'qualcomm' | 'mediatek' | 'samsung' | 'generic' | 'unknown'
export type BootMode = 'normal' | 'fastboot' | 'edl' | 'recovery' | 'dfu' | 'download' | 'preloader' | 'unknown'
export type DeviceStatus = 'connected' | 'disconnected' | 'error' | 'busy'

export interface Device {
  id: string
  vendorId: string
  productId: string
  vendorName: string
  productName: string
  deviceType: DeviceType
  bootMode: BootMode
  tools: string[]
  container: string | null
  status: DeviceStatus
  serial: string | null
  chipset: string | null
  workspacePath: string | null
  capabilities: DeviceCapabilities
  firstSeen: Date
  lastSeen: Date
}

export interface DeviceCapabilities {
  canFlash: boolean
  canReadInfo: boolean
  canBackup: boolean
  canRestore: boolean
  canUnlockBootloader: boolean
  canIsp: boolean
  canJtag: boolean
  supportedProtocols: string[]
}

export interface SignalChannel {
  id: string
  name: string
  color: string
  enabled: boolean
  voltage: number[]
}

export interface ProtocolDecoder {
  id: string
  name: string
  description: string
  enabled: boolean
}

export interface PowerReading {
  timestamp: number
  voltage: number
  current: number
  power: number
}

export interface BootSignature {
  name: string
  pattern: string
  status: 'healthy' | 'fault' | 'warning'
  diagnosis: string
  suggestion: string
  avgCurrent: number
  variance: number
}

export interface Component {
  id: string
  type: string
  value: string
  footprint: string
  x: number
  y: number
  width: number
  height: number
  rail?: string
  testPoints?: string[]
  knownFaults?: { fault: string; percent: number }[]
  replacement?: string
  price?: string
}

export interface FirmwareFile {
  id: string
  name: string
  size: number
  device: string
  version: string
  date: string
  path: string
}

export interface FlashJob {
  id: string
  deviceName: string
  devicePort: string
  firmware: FirmwareFile | null
  status: 'queued' | 'flashing' | 'verifying' | 'complete' | 'error' | 'paused'
  progress: number
  startTime?: Date
  endTime?: Date
  error?: string
}

export type RecoveryMode = 'software' | 'isp' | 'chip-off'

export interface RecoveryOption {
  id: string
  name: string
  description: string
  mode: RecoveryMode
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  requiresOwnership: boolean
}

export interface RecoveryJob {
  id: string
  type: string
  status: 'queued' | 'running' | 'complete' | 'error'
  progress: number
  startTime?: Date
  output?: string
  error?: string
}

export interface BenchStatus {
  psuVoltage: number | null
  psuCurrent: number | null
  temperature: number | null
  mode: string
  deviceCount: number
}
