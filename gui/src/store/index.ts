import { create } from 'zustand'

export interface ConnectedDevice {
  id: string
  name: string
  manufacturer: string
  model: string
  chipset: string
  bootMode: string
  status: 'connected' | 'disconnected' | 'error'
  tools: string[]
  serialNumber?: string
  imei?: string
}

export interface Project {
  id: string
  name: string
  description: string
  projectType: 'repair' | 'diagnostics' | 'engineering' | 'research' | 'data_recovery'
  status: 'active' | 'completed' | 'archived' | 'on_hold'
  customerName?: string
  deviceId?: string
  createdAt: string
  updatedAt: string
  tags: string[]
  notes?: string
}

export interface PowerReading {
  timestamp: number
  voltage: number
  current: number
  power: number
}

interface AppState {
  connectedDevices: ConnectedDevice[]
  activeProject: Project | null
  projects: Project[]
  powerReadings: PowerReading[]
  isMonitoring: boolean
  aiInitialized: boolean

  addDevice: (device: ConnectedDevice) => void
  removeDevice: (id: string) => void
  setActiveProject: (project: Project | null) => void
  setProjects: (projects: Project[]) => void
  addPowerReading: (reading: PowerReading) => void
  clearPowerReadings: () => void
  setIsMonitoring: (val: boolean) => void
  setAiInitialized: (val: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  connectedDevices: [],
  activeProject: null,
  projects: [],
  powerReadings: [],
  isMonitoring: false,
  aiInitialized: false,

  addDevice: (device) =>
    set((state) => ({
      connectedDevices: [...state.connectedDevices.filter((d) => d.id !== device.id), device],
    })),

  removeDevice: (id) =>
    set((state) => ({
      connectedDevices: state.connectedDevices.filter((d) => d.id !== id),
    })),

  setActiveProject: (project) => set({ activeProject: project }),

  setProjects: (projects) => set({ projects }),

  addPowerReading: (reading) =>
    set((state) => ({
      powerReadings: [...state.powerReadings.slice(-999), reading],
    })),

  clearPowerReadings: () => set({ powerReadings: [] }),

  setIsMonitoring: (val) => set({ isMonitoring: val }),

  setAiInitialized: (val) => set({ aiInitialized: val }),
}))
