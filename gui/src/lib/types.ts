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

export type OperationCategory = 'security' | 'system' | 'backup' | 'cloud' | 'network'
export type OperationStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled'

export interface DeviceOperation {
  id: string
  name: string
  description: string
  category: OperationCategory
  icon: string
  command: string
  requiresUnlock: boolean
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  supportedBootModes: BootMode[]
  supportedDeviceTypes: DeviceType[]
}

export interface OperationExecution {
  id: string
  operationId: string
  deviceId: string
  status: OperationStatus
  progress: number
  output: string
  startTime?: Date
  endTime?: Date
  error?: string
}

export interface DeviceHistoryEntry {
  id: string
  timestamp: Date
  deviceName: string
  vendorId: string
  productId: string
  deviceType: DeviceType
  bootMode: BootMode
  serial: string | null
  action: 'connected' | 'disconnected' | 'flashed' | 'backed_up' | 'recovered' | 'error'
  details?: string
}

export interface Partition {
  id: string
  name: string
  size: number
  type: 'system' | 'boot' | 'recovery' | 'vendor' | 'userdata' | 'cache' | 'misc' | 'unknown'
  status: 'dumped' | 'empty' | 'corrupted'
  filePath?: string
  checksum?: string
}

export interface SavedCommand {
  id: string
  name: string
  command: string
  category: 'adb' | 'fastboot' | 'shell' | 'custom'
  description?: string
  lastRun?: Date
  runCount: number
}

export interface DeviceHealth {
  batteryHealth: 'good' | 'fair' | 'poor' | 'unknown'
  batteryLevel: number | null
  batteryCycles: number | null
  storageUsed: number | null
  storageTotal: number | null
  imei: string | null
  androidVersion: string | null
  securityPatch: string | null
  screenLock: boolean | null
  bootloaderUnlocked: boolean | null
  rootStatus: 'rooted' | 'not_rooted' | 'unknown'
}

export interface BatchJob {
  id: string
  name: string
  type: 'flash' | 'backup' | 'unlock' | 'custom'
  deviceIds: string[]
  status: 'queued' | 'running' | 'complete' | 'error' | 'partial'
  progress: number
  startTime?: Date
  endTime?: Date
  results: { deviceId: string; status: 'success' | 'error'; message?: string }[]
}

export interface FirmwareLibraryEntry {
  id: string
  name: string
  version: string
  device: string
  chipset: string
  size: number
  date: string
  path: string
  md5: string
  isDownloaded: boolean
  source?: string
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'auto'
  adbPath: string
  fastbootPath: string
  dockerEnabled: boolean
  autoDetectDevices: boolean
  defaultContainer: string
  workspacePath: string
  logRetentionDays: number
  showNotifications: boolean
}
