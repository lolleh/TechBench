import { create } from 'zustand'
import type { Device, BenchStatus } from './types'

interface DeviceStore {
  devices: Device[]
  selectedDeviceId: string | null
  benchStatus: BenchStatus

  addDevice: (device: Device) => void
  removeDevice: (id: string) => void
  updateDevice: (id: string, updates: Partial<Device>) => void
  selectDevice: (id: string | null) => void
  getSelectedDevice: () => Device | undefined
  updateBenchStatus: (updates: Partial<BenchStatus>) => void
}

const DEFAULT_BENCH_STATUS: BenchStatus = {
  psuVoltage: null,
  psuCurrent: null,
  temperature: null,
  mode: 'Combined',
  deviceCount: 0,
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  devices: [],
  selectedDeviceId: null,
  benchStatus: DEFAULT_BENCH_STATUS,

  addDevice: (device) =>
    set((state) => ({
      devices: [...state.devices, device],
      benchStatus: {
        ...state.benchStatus,
        deviceCount: state.devices.length + 1,
      },
    })),

  removeDevice: (id) =>
    set((state) => ({
      devices: state.devices.filter((d) => d.id !== id),
      selectedDeviceId:
        state.selectedDeviceId === id ? null : state.selectedDeviceId,
      benchStatus: {
        ...state.benchStatus,
        deviceCount: Math.max(0, state.devices.length - 1),
      },
    })),

  updateDevice: (id, updates) =>
    set((state) => ({
      devices: state.devices.map((d) =>
        d.id === id ? { ...d, ...updates, lastSeen: new Date() } : d
      ),
    })),

  selectDevice: (id) => set({ selectedDeviceId: id }),

  getSelectedDevice: () => {
    const state = get()
    return state.devices.find((d) => d.id === state.selectedDeviceId)
  },

  updateBenchStatus: (updates) =>
    set((state) => ({
      benchStatus: { ...state.benchStatus, ...updates },
    })),
}))
