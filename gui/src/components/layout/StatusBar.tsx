import { useDeviceStore } from '../../lib/deviceStore'

export function StatusBar() {
  const deviceCount = useDeviceStore((s) => s.devices.length)
  const benchStatus = useDeviceStore((s) => s.benchStatus)

  const psuText =
    benchStatus.psuVoltage !== null
      ? `${benchStatus.psuVoltage.toFixed(2)}V ${benchStatus.psuCurrent !== null ? benchStatus.psuCurrent.toFixed(2) + 'A' : ''}`
      : null

  return (
    <footer className="h-7 glass-strong border-t border-white/5 px-4 flex items-center justify-between text-[10px] font-mono text-white/40 shrink-0">
      <div className="flex items-center gap-5">
        {/* Device status */}
        <div className="flex items-center gap-2">
          <div className={`status-dot ${deviceCount > 0 ? 'status-connected' : 'status-disconnected'}`} />
          <span>
            {deviceCount > 0 ? (
              <span className="text-white/60">{deviceCount} device{deviceCount > 1 ? 's' : ''}</span>
            ) : (
              'No devices'
            )}
          </span>
        </div>

        <div className="w-px h-3 bg-white/10" />

        {/* PSU */}
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-neon-yellow/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          <span className={psuText ? 'text-white/60' : ''}>
            PSU: {psuText ?? '--'}
          </span>
        </div>

        <div className="w-px h-3 bg-white/10" />

        {/* Temperature */}
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-neon-red/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
            <path d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
          </svg>
          <span>
            {benchStatus.temperature !== null ? `${benchStatus.temperature}°C` : '--'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {/* Mode */}
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan/60" />
          <span className="text-white/50">{benchStatus.mode}</span>
        </div>

        <div className="w-px h-3 bg-white/10" />

        {/* Connection indicator */}
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-2 rounded-full bg-neon-green/40" />
            <div className="w-0.5 h-3 rounded-full bg-neon-green/60" />
            <div className="w-0.5 h-2 rounded-full bg-neon-green/40" />
            <div className="w-0.5 h-1 rounded-full bg-neon-green/30" />
          </div>
          <span>HAL Ready</span>
        </div>
      </div>
    </footer>
  )
}
