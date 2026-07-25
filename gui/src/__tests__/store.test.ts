import { describe, it, expect } from 'vitest'
import { useAppStore } from '../store'

describe('App Store', () => {
  it('has correct initial state', () => {
    const state = useAppStore.getState()
    expect(state.connectedDevices).toEqual([])
    expect(state.activeProject).toBeNull()
    expect(state.projects).toEqual([])
    expect(state.isMonitoring).toBe(false)
    expect(state.aiInitialized).toBe(false)
  })

  it('adds a device', () => {
    const { addDevice, removeDevice } = useAppStore.getState()
    const device = {
      id: 'test-1',
      name: 'Test Device',
      manufacturer: 'Test',
      model: 'T1',
      chipset: 'TestSoC',
      bootMode: 'Normal',
      status: 'connected' as const,
      tools: ['ADB'],
    }
    addDevice(device)
    expect(useAppStore.getState().connectedDevices).toHaveLength(1)
    expect(useAppStore.getState().connectedDevices[0].id).toBe('test-1')

    removeDevice('test-1')
    expect(useAppStore.getState().connectedDevices).toHaveLength(0)
  })

  it('sets active project', () => {
    const { setActiveProject } = useAppStore.getState()
    const project = {
      id: 'p1',
      name: 'Test Project',
      description: 'Test',
      projectType: 'repair' as const,
      status: 'active' as const,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      tags: [],
    }
    setActiveProject(project)
    expect(useAppStore.getState().activeProject?.name).toBe('Test Project')

    setActiveProject(null)
    expect(useAppStore.getState().activeProject).toBeNull()
  })

  it('manages power readings', () => {
    const { addPowerReading, clearPowerReadings } = useAppStore.getState()
    addPowerReading({ timestamp: Date.now(), voltage: 4.2, current: 0.5, power: 2.1 })
    addPowerReading({ timestamp: Date.now(), voltage: 4.1, current: 0.6, power: 2.46 })
    expect(useAppStore.getState().powerReadings).toHaveLength(2)

    clearPowerReadings()
    expect(useAppStore.getState().powerReadings).toHaveLength(0)
  })

  it('toggles monitoring state', () => {
    const { setIsMonitoring } = useAppStore.getState()
    setIsMonitoring(true)
    expect(useAppStore.getState().isMonitoring).toBe(true)
    setIsMonitoring(false)
    expect(useAppStore.getState().isMonitoring).toBe(false)
  })
})
