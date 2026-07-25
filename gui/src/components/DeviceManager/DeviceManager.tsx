import { useDeviceStore } from '../../lib/deviceStore'
import { tauri } from '../../lib/tauri'
import type { Device } from '../../lib/types'

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  android: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/20' },
  apple: { bg: 'bg-white/5', text: 'text-white/70', border: 'border-white/10' },
  qualcomm: { bg: 'bg-neon-blue/10', text: 'text-neon-blue', border: 'border-neon-blue/20' },
  mediatek: { bg: 'bg-neon-orange/10', text: 'text-neon-orange', border: 'border-neon-orange/20' },
  samsung: { bg: 'bg-bench-400/10', text: 'text-bench-400', border: 'border-bench-400/20' },
  generic: { bg: 'bg-white/5', text: 'text-white/50', border: 'border-white/10' },
}

export function DeviceManager() {
  const devices = useDeviceStore((s) => s.devices)
  const selectedDeviceId = useDeviceStore((s) => s.selectedDeviceId)
  const selectDevice = useDeviceStore((s) => s.selectDevice)

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null

  const handleOpenShell = async (device: Device) => {
    await tauri.invoke('open_terminal', {
      command: device.container ? `docker exec techbench-${device.container} bash` : 'bash',
    })
  }

  const handleBackup = async (device: Device) => {
    if (device.container) {
      await tauri.invoke('run_adb_command', {
        device: device.serial ?? device.vendorId,
        command: 'backup',
      })
    }
  }

  const handleCopyInfo = async (device: Device) => {
    const info = [
      `${device.vendorName} ${device.productName}`,
      `VID:PID ${device.vendorId}:${device.productId}`,
      `Type: ${device.deviceType}`,
      `Boot: ${device.bootMode}`,
      `Serial: ${device.serial ?? 'N/A'}`,
      `Chipset: ${device.chipset ?? 'N/A'}`,
      `Container: ${device.container ?? 'N/A'}`,
      `Tools: ${device.tools.join(', ')}`,
    ].join('\n')
    await navigator.clipboard.writeText(info)
  }

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Device List */}
      <div className="w-80 glass rounded-2xl p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Devices</h2>
          <span className="text-[10px] font-mono text-white/30 px-2 py-0.5 rounded-full bg-surface-3">
            {devices.length}
          </span>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar space-y-2">
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <p className="text-sm text-white/40 mb-1">No devices connected</p>
              <p className="text-xs text-white/20">Plug in a USB device to begin</p>
            </div>
          ) : (
            devices.map((device) => {
              const colors = TYPE_COLORS[device.deviceType] ?? TYPE_COLORS.generic
              const isSelected = selectedDeviceId === device.id

              return (
                <button
                  key={device.id}
                  onClick={() => selectDevice(device.id === selectedDeviceId ? null : device.id)}
                  className={`
                    w-full text-left p-3 rounded-xl transition-all duration-200 group
                    ${isSelected
                      ? 'bg-gradient-to-r from-neon-blue/10 to-transparent border border-neon-blue/20 shadow-lg shadow-neon-blue/5'
                      : 'bg-surface-2/40 border border-transparent hover:bg-surface-3/40 hover:border-white/5'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-white/90 truncate">
                        {device.productName}
                      </div>
                      <div className="text-xs text-white/40 truncate">{device.vendorName}</div>
                    </div>
                    <div className={`status-dot ${device.status === 'connected' ? 'status-connected' : 'status-disconnected'} mt-1.5`} />
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} ${colors.border} border`}>
                      {device.bootMode}
                    </span>
                    <span className="text-[10px] text-white/20 font-mono">
                      {device.tools.length} tools
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Device Details */}
      <div className="flex-1 glass rounded-2xl p-6 overflow-auto custom-scrollbar">
        {selectedDevice ? (
          <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white/90 mb-1">{selectedDevice.productName}</h2>
                <p className="text-sm text-white/40">{selectedDevice.vendorName}</p>
              </div>
              <div className={`status-dot ${selectedDevice.status === 'connected' ? 'status-connected' : 'status-disconnected'} w-3 h-3`} />
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'VID:PID', value: `${selectedDevice.vendorId}:${selectedDevice.productId}`, mono: true },
                { label: 'Boot Mode', value: selectedDevice.bootMode },
                { label: 'Device Type', value: selectedDevice.deviceType },
                { label: 'Serial', value: selectedDevice.serial ?? 'N/A', mono: true },
                { label: 'Chipset', value: selectedDevice.chipset ?? 'N/A' },
                { label: 'Container', value: selectedDevice.container ?? 'N/A', mono: true },
              ].map((item) => (
                <div key={item.label} className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{item.label}</div>
                  <div className={`text-sm font-medium text-white/80 ${item.mono ? 'font-mono' : ''}`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Capabilities */}
            <div className="mb-6">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Capabilities</div>
              <div className="flex flex-wrap gap-2">
                {selectedDevice.capabilities.canFlash && (
                  <span className="px-3 py-1.5 rounded-lg bg-neon-green/10 text-neon-green border border-neon-green/20 text-xs font-medium">
                    Flash
                  </span>
                )}
                {selectedDevice.capabilities.canBackup && (
                  <span className="px-3 py-1.5 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/20 text-xs font-medium">
                    Backup
                  </span>
                )}
                {selectedDevice.capabilities.canIsp && (
                  <span className="px-3 py-1.5 rounded-lg bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/20 text-xs font-medium">
                    ISP
                  </span>
                )}
                {selectedDevice.capabilities.canUnlockBootloader && (
                  <span className="px-3 py-1.5 rounded-lg bg-neon-purple/10 text-neon-purple border border-neon-purple/20 text-xs font-medium">
                    Unlock
                  </span>
                )}
                {selectedDevice.capabilities.canReadInfo && (
                  <span className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 border border-white/10 text-xs font-medium">
                    Read Info
                  </span>
                )}
                {selectedDevice.capabilities.canJtag && (
                  <span className="px-3 py-1.5 rounded-lg bg-neon-orange/10 text-neon-orange border border-neon-orange/20 text-xs font-medium">
                    JTAG
                  </span>
                )}
              </div>
            </div>

            {/* Tools */}
            <div className="mb-8">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Available Tools</div>
              <div className="flex flex-wrap gap-2">
                {selectedDevice.tools.map((tool) => (
                  <span
                    key={tool}
                    className="px-3 py-1.5 rounded-lg bg-surface-3/60 text-white/60 border border-white/5 text-xs font-mono"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => handleOpenShell(selectedDevice)}
                className="btn-cyber flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Open Shell
              </button>
              <button
                onClick={() => handleCopyInfo(selectedDevice)}
                className="btn-ghost flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                Copy Info
              </button>
              <button
                onClick={() => handleBackup(selectedDevice)}
                className="btn-ghost flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
                Backup
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-surface-3/30 flex items-center justify-center mb-6 relative">
              <svg className="w-10 h-10 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface-4 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white/20" />
              </div>
            </div>
            <p className="text-sm text-white/40 mb-1">Select a device</p>
            <p className="text-xs text-white/20">Choose a connected device to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
