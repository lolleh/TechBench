import { useState } from 'react'

interface DeviceInfo {
  id: string
  name: string
  manufacturer: string
  model: string
  chipset: string
  androidVersion?: string
  iosVersion?: string
  bootloaderLocked: boolean
  securityState: string
  bootMode: string
  batteryLevel?: number
  storageUsed?: string
  storageTotal?: string
}

interface ShellCommand {
  id: string
  command: string
  output: string
  timestamp: string
  status: 'success' | 'error' | 'running'
}

const MOCK_DEVICE: DeviceInfo = {
  id: 'dev1',
  name: 'Samsung Galaxy S24',
  manufacturer: 'Samsung',
  model: 'SM-S926B',
  chipset: 'Snapdragon 8 Gen 3',
  androidVersion: '14',
  bootloaderLocked: true,
  securityState: 'Knox 0x1',
  bootMode: 'Normal (ADB)',
  batteryLevel: 87,
  storageUsed: '78 GB',
  storageTotal: '256 GB',
}

export function MobileService() {
  const [device] = useState<DeviceInfo>(MOCK_DEVICE)
  const [activeTab, setActiveTab] = useState<'info' | 'shell' | 'partitions' | 'firmware' | 'backup'>('info')
  const [shellCommands, setShellCommands] = useState<ShellCommand[]>([])
  const [commandInput, setCommandInput] = useState('')

  const executeCommand = () => {
    if (!commandInput.trim()) return
    const cmd: ShellCommand = {
      id: Date.now().toString(),
      command: commandInput,
      output: `$ ${commandInput}\n(ADB shell output would appear here)`,
      timestamp: new Date().toLocaleTimeString(),
      status: 'success',
    }
    setShellCommands(prev => [...prev, cmd])
    setCommandInput('')
  }

  const getManufacturerColor = (mfr: string) => {
    switch (mfr.toLowerCase()) {
      case 'samsung': return 'bg-blue-600'
      case 'apple': return 'bg-gray-600'
      case 'google': return 'bg-red-600'
      case 'xiaomi': case 'redmi': case 'poco': return 'bg-orange-600'
      case 'oneplus': return 'bg-red-500'
      case 'oppo': case 'realme': case 'vivo': return 'bg-green-600'
      default: return 'bg-gray-600'
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
        <div className={`px-2 py-1 rounded text-xs text-white ${getManufacturerColor(device.manufacturer)}`}>
          {device.manufacturer}
        </div>
        <span className="text-sm font-medium">{device.name}</span>
        <span className="text-xs text-gray-400">{device.model} | {device.chipset}</span>
        <div className="flex-1" />
        {(['info', 'shell', 'partitions', 'firmware', 'backup'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded text-sm capitalize ${
              activeTab === tab ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'info' && (
          <div className="grid grid-cols-2 gap-4 max-w-4xl">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Device Information</h3>
              <div className="space-y-2 text-sm">
                {[
                  ['Manufacturer', device.manufacturer],
                  ['Model', device.model],
                  ['Chipset', device.chipset],
                  ['Android', device.androidVersion || '--'],
                  ['Bootloader', device.bootloaderLocked ? 'Locked' : 'Unlocked'],
                  ['Security', device.securityState],
                  ['Boot Mode', device.bootMode],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Status</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Battery</span>
                    <span>{device.batteryLevel}%</span>
                  </div>
                  <div className="bg-gray-700 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${device.batteryLevel}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Storage</span>
                    <span>{device.storageUsed} / {device.storageTotal}</span>
                  </div>
                  <div className="bg-gray-700 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '30%' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 col-span-2">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  'Read Info', 'Backup EFS', 'Flash Firmware', 'Reboot Recovery',
                  'Reboot Fastboot', 'Reboot EDL', 'Install APK', 'Pull Log',
                  'Take Screenshot', 'Screen Record',
                ].map(action => (
                  <button key={action} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shell' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 bg-gray-900 rounded-lg p-3 font-mono text-sm overflow-auto">
              {shellCommands.map(cmd => (
                <div key={cmd.id} className="mb-2">
                  <div className="text-green-400">[{cmd.timestamp}] $ {cmd.command}</div>
                  <div className="text-gray-300 whitespace-pre">{cmd.output}</div>
                </div>
              ))}
              {shellCommands.length === 0 && (
                <div className="text-gray-500">ADB Shell ready. Type a command below.</div>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <span className="text-green-400 font-mono text-sm leading-8">$</span>
              <input
                type="text"
                value={commandInput}
                onChange={e => setCommandInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && executeCommand()}
                className="flex-1 bg-gray-800 text-white px-3 py-1 rounded font-mono text-sm"
                placeholder="Enter ADB shell command..."
              />
              <button onClick={executeCommand} className="px-4 py-1 bg-blue-600 rounded text-sm">
                Run
              </button>
            </div>
          </div>
        )}

        {activeTab === 'partitions' && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Partition Table</h3>
            <div className="space-y-1 font-mono text-sm">
              {[
                ['boot', '16 MB', 'Boot kernel'],
                ['recovery', '32 MB', 'Recovery partition'],
                ['system', '4 GB', 'Android system'],
                ['vendor', '1 GB', 'Vendor partition'],
                ['userdata', '200 GB', 'User data'],
                ['cache', '512 MB', 'Cache'],
                ['efs', '16 MB', 'NV data (Samsung)'],
                ['modem', '256 MB', 'Baseband firmware'],
              ].map(([name, size, desc]) => (
                <div key={name} className="flex items-center gap-4 p-2 bg-gray-700 rounded">
                  <span className="w-24 text-blue-400">{name}</span>
                  <span className="w-20 text-gray-400">{size}</span>
                  <span className="flex-1 text-gray-300">{desc}</span>
                  <button className="px-2 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-xs">Read</button>
                  <button className="px-2 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-xs">Backup</button>
                  <button className="px-2 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-xs">Flash</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'firmware' && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Firmware Management</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700 rounded p-3">
                <div className="text-sm font-medium mb-1">Current Firmware</div>
                <div className="text-xs text-gray-400">S926BXXS3AXE5</div>
                <div className="text-xs text-gray-400">Android 14 / One UI 6.1</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-sm font-medium mb-1">Baseband</div>
                <div className="text-xs text-gray-400">S926BXXS3AXE5</div>
                <div className="text-xs text-gray-400">Snapdragon X75</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm">Flash Firmware</button>
              <button className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm">Download Latest</button>
            </div>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Backup & Restore</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Full Backup', 'Complete device backup', '📦'],
                ['EFS Backup', 'NV data partition', '🔑'],
                ['Modem Backup', 'Baseband firmware', '📡'],
                ['Apps Backup', 'Installed applications', '📱'],
                ['Data Backup', 'User data partition', '💾'],
                ['Custom Backup', 'Select partitions', '⚙️'],
              ].map(([name, desc, icon]) => (
                <button key={name} className="bg-gray-700 hover:bg-gray-600 rounded p-3 text-left">
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-sm font-medium">{name}</div>
                  <div className="text-xs text-gray-400">{desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
