import { useState } from 'react'
import { useDeviceStore } from '../../lib/deviceStore'
import { tauri } from '../../lib/tauri'
import type { DeviceHealth } from '../../lib/types'

const HEALTH_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  good: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/20' },
  fair: { bg: 'bg-neon-yellow/10', text: 'text-neon-yellow', border: 'border-neon-yellow/20' },
  poor: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  unknown: { bg: 'bg-white/5', text: 'text-white/40', border: 'border-white/10' },
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function DeviceHealthCheck() {
  const devices = useDeviceStore((s) => s.devices)
  const [isScanning, setIsScanning] = useState(false)
  const [health, setHealth] = useState<DeviceHealth | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedDevice = devices.find((d) => d.status === 'connected') || null

  const storagePercent = health?.storageUsed && health?.storageTotal
    ? Math.round((health.storageUsed / health.storageTotal) * 100)
    : 0

  const batteryColor = health?.batteryLevel && health.batteryLevel > 50 ? 'text-neon-green'
    : health?.batteryLevel && health.batteryLevel > 20 ? 'text-neon-yellow'
    : 'text-red-400'

  const handleScan = async () => {
    if (!selectedDevice || !selectedDevice.serial) return
    setIsScanning(true)
    setHealth(null)
    setError(null)
    try {
      const result = await tauri.fetchDeviceHealth(selectedDevice.serial, selectedDevice.deviceType)
      if (result.success && result.health) {
        setHealth(result.health)
      } else {
        setError(result.error || 'Health scan failed')
      }
    } catch (err) {
      setError(`Health scan error: ${err}`)
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Device Info */}
      <div className="w-80 glass rounded-2xl p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Device Health</h2>
          <button
            onClick={handleScan}
            disabled={!selectedDevice || isScanning}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20 transition-all disabled:opacity-40"
          >
            {isScanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        {!selectedDevice ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">No device connected</p>
            <p className="text-xs text-white/20">Connect a device to check health</p>
          </div>
        ) : !health ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 max-w-[90%]">
                <p className="text-xs text-red-400">Scan failed: {error}</p>
              </div>
            )}
            <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">Device detected: {selectedDevice.productName}</p>
            <p className="text-xs text-white/20">Click &quot;Scan&quot; to check health status</p>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            {/* Battery */}
            <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Battery</span>
                {health.batteryHealth && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${HEALTH_COLORS[health.batteryHealth]?.bg || HEALTH_COLORS.unknown.bg} ${HEALTH_COLORS[health.batteryHealth]?.text || HEALTH_COLORS.unknown.text} border ${HEALTH_COLORS[health.batteryHealth]?.border || HEALTH_COLORS.unknown.border}`}>
                    {health.batteryHealth}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className={`text-2xl font-bold ${batteryColor}`}>
                  {health.batteryLevel !== null ? `${health.batteryLevel}%` : '--'}
                </div>
                <div className="flex-1 h-2 bg-surface-3/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      health.batteryLevel && health.batteryLevel > 50 ? 'bg-neon-green'
                        : health.batteryLevel && health.batteryLevel > 20 ? 'bg-neon-yellow'
                        : 'bg-red-400'
                    }`}
                    style={{ width: `${health.batteryLevel || 0}%` }}
                  />
                </div>
              </div>
              {health.batteryCycles && (
                <div className="text-[10px] text-white/30 mt-2">Cycles: {health.batteryCycles}</div>
              )}
            </div>

            {/* Storage */}
            <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Storage</div>
              <div className="flex items-center gap-3">
                <div className="text-lg font-bold text-white/80">
                  {health.storageUsed !== null && health.storageTotal !== null
                    ? `${formatBytes(health.storageUsed)} / ${formatBytes(health.storageTotal)}`
                    : '-- / --'}
                </div>
              </div>
              <div className="h-2 bg-surface-3/60 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full rounded-full bg-neon-blue transition-all"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
              <div className="text-[10px] text-white/30 mt-1">{storagePercent}% used</div>
            </div>

            {/* Security Info */}
            <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Security</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">IMEI</span>
                  <span className="text-xs font-mono text-white/70">{health.imei || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">OS Version</span>
                  <span className="text-xs text-white/70">{health.androidVersion || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Security Patch</span>
                  <span className="text-xs text-white/70">{health.securityPatch || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Screen Lock</span>
                  <span className={`text-xs ${health.screenLock ? 'text-neon-green' : 'text-white/40'}`}>
                    {health.screenLock ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Bootloader</span>
                  <span className={`text-xs ${health.bootloaderUnlocked ? 'text-neon-orange' : 'text-white/40'}`}>
                    {health.bootloaderUnlocked ? 'Unlocked' : 'Locked'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">Root Status</span>
                  <span className={`text-xs ${
                    health.rootStatus === 'rooted' ? 'text-neon-orange'
                    : health.rootStatus === 'not_rooted' ? 'text-white/40'
                    : 'text-white/30'
                  }`}>
                    {health.rootStatus === 'rooted' ? 'Rooted' : health.rootStatus === 'not_rooted' ? 'Not Rooted' : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right - Recommendations */}
      <div className="flex-1 glass rounded-2xl p-4 flex flex-col">
        <h2 className="text-sm font-semibold text-white/80 mb-4">Health Summary</h2>

        {!selectedDevice ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/30 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">No device selected</p>
            <p className="text-xs text-white/20">Connect a device and scan to see health details</p>
          </div>
        ) : !health ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/30 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">Scan required</p>
            <p className="text-xs text-white/20">Click &quot;Scan&quot; to analyze device health</p>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-neon-blue/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-neon-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-white/80">Device: {selectedDevice.productName}</span>
              </div>
              <div className="space-y-1.5">
                {health.batteryHealth === 'poor' && (
                  <p className="text-xs text-red-400">Battery health is degraded - consider replacement.</p>
                )}
                {health.batteryHealth === 'fair' && (
                  <p className="text-xs text-neon-yellow">Battery health is fair - monitor it.</p>
                )}
                {health.batteryLevel !== null && health.batteryLevel <= 20 && (
                  <p className="text-xs text-neon-yellow">Battery level is low ({health.batteryLevel}%) - charge the device.</p>
                )}
                {health.batteryCycles !== null && (
                  <p className="text-xs text-white/40">{health.batteryCycles} charge cycles recorded.</p>
                )}
                {health.storageUsed !== null && health.storageTotal !== null && storagePercent > 90 && (
                  <p className="text-xs text-neon-orange">Storage is {storagePercent}% full - free up space.</p>
                )}
                {!health.imei && health.rootStatus !== 'unknown' && (
                  <p className="text-xs text-white/40">No IMEI reported.</p>
                )}
                {health.screenLock === false && (
                  <p className="text-xs text-neon-orange">Screen lock is disabled - security risk.</p>
                )}
                {health.bootloaderUnlocked && (
                  <p className="text-xs text-neon-orange">Bootloader is unlocked.</p>
                )}
                {health.rootStatus === 'rooted' && (
                  <p className="text-xs text-neon-orange">Device is rooted.</p>
                )}
                {health.batteryHealth === 'good' && health.batteryLevel === null
                  && health.storageUsed === null && health.imei && (
                  <p className="text-xs text-white/40">Health scan completed. All systems operational.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
