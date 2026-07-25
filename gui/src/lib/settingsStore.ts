import { create } from 'zustand'

type BootMode = 'desktop' | 'mobile-service' | 'electronics-bench' | 'combined'

interface SettingsStore {
  bootMode: BootMode
  autoDetect: boolean
  containerRuntime: 'docker' | 'podman'
  logLevel: 'debug' | 'info' | 'warn' | 'error'

  setBootMode: (mode: BootMode) => void
  setAutoDetect: (enabled: boolean) => void
  setContainerRuntime: (runtime: 'docker' | 'podman') => void
  setLogLevel: (level: 'debug' | 'info' | 'warn' | 'error') => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  bootMode: 'combined',
  autoDetect: true,
  containerRuntime: 'docker',
  logLevel: 'info',

  setBootMode: (mode) => set({ bootMode: mode }),
  setAutoDetect: (enabled) => set({ autoDetect: enabled }),
  setContainerRuntime: (runtime) => set({ containerRuntime: runtime }),
  setLogLevel: (level) => set({ logLevel: level }),
}))
