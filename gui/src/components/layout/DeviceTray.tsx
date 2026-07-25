import { useDeviceStore } from '../../lib/deviceStore'
import type { Device } from '../../lib/types'

const DEVICE_ICONS: Record<string, { emoji: string; gradient: string }> = {
  android: { emoji: '🤖', gradient: 'from-neon-green/20 to-cyber-600/20' },
  apple: { emoji: '🍎', gradient: 'from-white/10 to-white/5' },
  qualcomm: { emoji: '📡', gradient: 'from-neon-blue/20 to-bench-600/20' },
  mediatek: { emoji: '🔧', gradient: 'from-neon-orange/20 to-neon-yellow/20' },
  samsung: { emoji: '📱', gradient: 'from-bench-400/20 to-neon-blue/20' },
  generic: { emoji: '🔌', gradient: 'from-white/10 to-white/5' },
}

export function DeviceTray() {
  const devices = useDeviceStore((s) => s.devices)
  const selectDevice = useDeviceStore((s) => s.selectDevice)
  const selectedDeviceId = useDeviceStore((s) => s.selectedDeviceId)

  const handleSelect = (device: Device) => {
    selectDevice(device.id === selectedDeviceId ? null : device.id)
  }

  return (
    <div className="h-28 glass-strong border-t border-white/5 p-3 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-[10px] font-mono text-white/30 tracking-widest uppercase">
          Connected Devices
        </div>
        <div className="text-[10px] font-mono text-white/20">
          {devices.length} active
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-1">
        {devices.length === 0 ? (
          <div className="flex-shrink-0 w-40 h-[76px] rounded-xl bg-surface-2/50 border border-dashed border-white/10 flex flex-col items-center justify-center gap-1 animate-pulse-slow">
            <svg className="w-6 h-6 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="text-[10px] text-white/20">Plug in device</span>
          </div>
        ) : (
          devices.map((device) => {
            const icon = DEVICE_ICONS[device.deviceType] ?? DEVICE_ICONS.generic
            const isSelected = selectedDeviceId === device.id

            return (
              <button
                key={device.id}
                onClick={() => handleSelect(device)}
                className={`
                  flex-shrink-0 w-40 h-[76px] rounded-xl p-2.5 flex flex-col items-center justify-center
                  transition-all duration-300 ease-out group relative overflow-hidden
                  ${isSelected
                    ? 'bg-gradient-to-br ' + icon.gradient + ' border border-white/20 shadow-lg scale-105'
                    : 'bg-surface-2/60 border border-white/5 hover:border-white/10 hover:bg-surface-3/60 hover:scale-[1.02]'
                  }
                `}
              >
                {/* Glow effect on selected */}
                {isSelected && (
                  <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/5 to-transparent animate-pulse-slow" />
                )}

                <span className="text-2xl relative z-10 group-hover:scale-110 transition-transform duration-200">
                  {icon.emoji}
                </span>
                <span className="text-[11px] font-medium text-white/80 mt-1 relative z-10 truncate w-full text-center">
                  {device.productName}
                </span>
                <div className="flex items-center gap-1.5 relative z-10">
                  <div className="status-dot status-connected" />
                  <span className="text-[9px] font-mono text-white/40">
                    {device.bootMode}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
