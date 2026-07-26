import { useState, useEffect } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { DeviceTray } from './components/layout/DeviceTray'
import { StatusBar } from './components/layout/StatusBar'
import { DeviceManager } from './components/DeviceManager/DeviceManager'
import { SignalAnalyzer } from './components/SignalAnalyzer/SignalAnalyzer'
import { PowerMonitor } from './components/PowerMonitor/PowerMonitor'
import { SchematicViewer } from './components/SchematicViewer/SchematicViewer'
import { Flasher } from './components/Flasher/Flasher'
import { Recovery } from './components/Recovery/Recovery'
import { DeviceHistory } from './components/DeviceHistory/DeviceHistory'
import { PartitionManager } from './components/PartitionManager/PartitionManager'
import { CommandRunner } from './components/CommandRunner/CommandRunner'
import { DeviceHealthCheck } from './components/DeviceHealth/DeviceHealth'
import { BatchOperations } from './components/BatchOperations/BatchOperations'
import { FirmwareLibrary } from './components/FirmwareLibrary/FirmwareLibrary'
import { SettingsView } from './components/Settings/Settings'
import { useDeviceStore } from './lib/deviceStore'
import { startDeviceSimulation, stopDeviceSimulation } from './lib/mockDevices'

type View = 'devices' | 'signal' | 'schematic' | 'power' | 'flash' | 'recovery' | 'history' | 'partitions' | 'commands' | 'health' | 'batch' | 'firmware' | 'settings'

function App() {
  const [activeView, setActiveView] = useState<View>('devices')
  const [time, setTime] = useState(new Date())
  const addDevice = useDeviceStore((s) => s.addDevice)
  const removeDevice = useDeviceStore((s) => s.removeDevice)

  useEffect(() => {
    startDeviceSimulation(addDevice, removeDevice)
    return () => stopDeviceSimulation()
  }, [addDevice, removeDevice])

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const renderView = () => {
    switch (activeView) {
      case 'devices':
        return <DeviceManager />
      case 'signal':
        return <SignalAnalyzer />
      case 'schematic':
        return <SchematicViewer />
      case 'power':
        return <PowerMonitor />
      case 'flash':
        return <Flasher />
      case 'recovery':
        return <Recovery />
      case 'history':
        return <DeviceHistory />
      case 'partitions':
        return <PartitionManager />
      case 'commands':
        return <CommandRunner />
      case 'health':
        return <DeviceHealthCheck />
      case 'batch':
        return <BatchOperations />
      case 'firmware':
        return <FirmwareLibrary />
      case 'settings':
        return <SettingsView />
      default:
        return <DeviceManager />
    }
  }

  return (
    <div className="flex h-screen bg-surface-0 text-white font-sans overflow-hidden">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-blue/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-purple/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-bench-600/3 rounded-full blur-[150px]" />
      </div>

      {/* Sidebar */}
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        {/* Header */}
        <header className="h-14 glass-strong border-b border-white/5 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-blue to-bench-600 flex items-center justify-center shadow-lg shadow-neon-blue/20">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gradient-blue leading-tight">BenchPanel</h1>
                <p className="text-[10px] text-white/30 font-mono tracking-wider">HYBRIDBENCH OS v0.1.0</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              <span className="font-mono">SYSTEM ACTIVE</span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="text-xs font-mono text-white/50">
              {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div className="text-sm font-mono font-medium text-white/80 tabular-nums">
              {time.toLocaleTimeString('en-US', { hour12: false })}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto custom-scrollbar">
          <div className="animate-fade-in">
            {renderView()}
          </div>
        </main>

        {/* Device Tray */}
        <DeviceTray />

        {/* Status Bar */}
        <StatusBar />
      </div>
    </div>
  )
}

export default App
