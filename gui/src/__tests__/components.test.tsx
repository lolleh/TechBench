import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeviceManager } from '../components/DeviceManager/DeviceManager'
import { Sidebar } from '../components/layout/Sidebar'
import { StatusBar } from '../components/layout/StatusBar'
import { DeviceTray } from '../components/layout/DeviceTray'

describe('DeviceManager', () => {
  it('renders empty state when no devices connected', () => {
    render(<DeviceManager />)
    expect(screen.getByText('Devices')).toBeDefined()
    expect(screen.getByText('No devices connected')).toBeDefined()
    expect(screen.getByText('Plug in a USB device to begin')).toBeDefined()
  })

  it('renders device details placeholder', () => {
    render(<DeviceManager />)
    expect(screen.getByText('Select a device')).toBeDefined()
    expect(screen.getByText('Choose a connected device to view details')).toBeDefined()
  })
})

describe('Sidebar', () => {
  it('renders all navigation items', () => {
    render(<Sidebar activeView="devices" onViewChange={() => {}} />)
    expect(screen.getByText('Devices')).toBeDefined()
    expect(screen.getByText('Signal')).toBeDefined()
    expect(screen.getByText('Schematic')).toBeDefined()
    expect(screen.getByText('Power')).toBeDefined()
    expect(screen.getByText('Flash')).toBeDefined()
    expect(screen.getByText('Recovery')).toBeDefined()
  })

  it('highlights active view', () => {
    const { container } = render(<Sidebar activeView="devices" onViewChange={() => {}} />)
    const buttons = container.querySelectorAll('button')
    const devicesBtn = Array.from(buttons).find(b => b.textContent?.includes('Devices'))
    expect(devicesBtn).toBeDefined()
    expect(devicesBtn!.className).toContain('neon-blue')
  })
})

describe('StatusBar', () => {
  it('renders status information', () => {
    render(<StatusBar />)
    expect(screen.getByText('HAL Ready')).toBeDefined()
    expect(screen.getByText('No devices')).toBeDefined()
    expect(screen.getByText('PSU: --')).toBeDefined()
  })
})

describe('DeviceTray', () => {
  it('renders device tray', () => {
    render(<DeviceTray />)
    expect(screen.getByText('Connected Devices')).toBeDefined()
  })
})
