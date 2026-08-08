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
import { DeviceMirror } from './components/DeviceMirror/DeviceMirror'
import { JailbreakTool } from './components/Jailbreak/Jailbreak'
import { ICloudTool } from './components/iCloud/iCloud'
import { AppleTools } from './components/AppleTools/AppleTools'
import { ModemManager } from './components/ModemManager/ModemManager'
import { tauri } from './lib/tauri'
import { useDeviceStore } from './lib/deviceStore'

type View = 'devices' | 'modems' | 'signal' | 'schematic' | 'power' | 'flash' | 'recovery' | 'history' | 'partitions' | 'commands' | 'health' | 'batch' | 'firmware' | 'mirror' | 'jailbreak' | 'icloud' | 'appletools' | 'settings'

function App() {
  const [activeView, setActiveView] = useState<View>('devices')
  const [time, setTime] = useState(new Date())
  const addDevice = useDeviceStore((s) => s.addDevice)
  const removeDevice = useDeviceStore((s) => s.removeDevice)
  const devices = useDeviceStore((s) => s.devices)

  // Poll for connected devices
  useEffect(() => {
    const pollDevices = async () => {
      const connectedDevices = await tauri.fetchDevices()
      
      // Get current device IDs
      const currentIds = new Set(devices.map((d) => d.id))
      const newIds = new Set(connectedDevices.map((d) => d.id))
      
      // Add new devices
      for (const device of connectedDevices) {
        if (!currentIds.has(device.id)) {
          addDevice(device)
        }
      }
      
      // Remove disconnected devices
      for (const device of devices) {
        if (!newIds.has(device.id)) {
          removeDevice(device.id)
        }
      }
    }

    // Initial poll
    pollDevices()
    
    // Poll every 2 seconds
    const interval = setInterval(pollDevices, 2000)
    
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateResult, setUpdateResult] = useState<{
    success: boolean
    error: string
    message: string
    behind: number
    steps: Array<{ label: string; ok: boolean; output: string }>
  } | null>(null)

  const handleUpdate = async () => {
    setUpdateBusy(true)
    setUpdateResult(null)
    try {
      setUpdateResult(await tauri.updateApp())
    } finally {
      setUpdateBusy(false)
    }
  }

  const renderView = () => {
    switch (activeView) {
      case 'devices':
        return <DeviceManager />
      case 'modems':
        return <ModemManager />
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
      case 'mirror':
        return <DeviceMirror />
      case 'jailbreak':
        return <JailbreakTool />
      case 'icloud':
        return <ICloudTool />
      case 'appletools':
        return <AppleTools onNavigate={(v) => setActiveView(v as View)} />
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
          <div className="flex items-center gap-4 shrink-0">
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

          {/* Scrolling credit / support ticker */}
          <div className="flex-1 min-w-0 px-4 overflow-hidden relative" aria-hidden>
            <div className="flex whitespace-nowrap w-max animate-marquee">
              {[0, 1].map((i) => (
                <span key={i} className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-neon-cyan/80">Developed by Vamba Lolleh</span>
                  <span className="w-1 h-1 rounded-full bg-neon-green/70" />
                  <span className="text-white/40">For technical support contact:</span>
                  <span className="text-neon-yellow/80">WhatsApp: +23276823323</span>
                  <span className="mx-8 text-white/15">✦</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            {/* Update button */}
            <div className="relative">
              <button
                onClick={handleUpdate}
                disabled={updateBusy}
                className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-all disabled:opacity-40"
                title="Pull the latest changes from GitHub and update the app"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 4v10m0 0l-4-4m4 4l4-4M4 20h16" />
                </svg>
                {updateBusy ? 'Updating...' : 'Update'}
              </button>
              {updateResult && !updateBusy && (
                <div className="absolute right-0 top-full mt-2 w-80 glass-strong rounded-xl border border-white/10 p-3 z-50 animate-slide-down">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-semibold ${
                      updateResult.success ? 'text-neon-green' : 'text-neon-red'
                    }`}>
                      {updateResult.success ? 'Update complete' : 'Update failed'}
                    </span>
                    <button
                      onClick={() => setUpdateResult(null)}
                      className="text-white/40 hover:text-white/80 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-[11px] text-white/60 mb-2 break-words">
                    {updateResult.error || updateResult.message}
                  </p>
                  {updateResult.steps.length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                      {updateResult.steps.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px]">
                          <span className={`shrink-0 ${s.ok ? 'text-neon-green' : 'text-neon-red'}`}>
                            {s.ok ? '✓' : '✗'}
                          </span>
                          <span className="min-w-0">
                            <span className="text-white/70">{s.label}</span>
                            {s.output && !s.ok && (
                              <span className="block text-white/35 break-words">{s.output}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

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
          <div className="animate-fade-in h-full">
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
