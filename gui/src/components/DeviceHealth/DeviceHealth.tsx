import { useState } from 'react'
import type { DeviceHealth } from '../../lib/types'

const MOCK_HEALTH: DeviceHealth = {
  batteryHealth: 'good',
  batteryLevel: 87,
  batteryCycles: 245,
  storageUsed: 51539607552,
  storageTotal: 137438953472,
  imei: '862345678901234',
  androidVersion: '13',
  securityPatch: '2024-01-05',
  screenLock: true,
  bootloaderUnlocked: false,
  rootStatus: 'not_rooted',
}

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
  const [health] = useState<DeviceHealth>(MOCK_HEALTH)
  const [isScanning, setIsScanning] = useState(false)

  const storagePercent = health.storageUsed && health.storageTotal
    ? Math.round((health.storageUsed / health.storageTotal) * 100)
    : 0

  const batteryColor = health.batteryLevel && health.batteryLevel > 50 ? 'text-neon-green'
    : health.batteryLevel && health.batteryLevel > 20 ? 'text-neon-yellow'
    : 'text-red-400'

  const handleScan = () => {
    setIsScanning(true)
    setTimeout(() => setIsScanning(false), 2000)
  }

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Device Info */}
      <div className="w-80 glass rounded-2xl p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Device Health</h2>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20 transition-all disabled:opacity-40"
          >
            {isScanning ? 'Scanning...' : 'Rescan'}
          </button>
        </div>

        {/* Device card */}
        <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-green/20 to-neon-blue/20 flex items-center justify-center border border-white/5">
              <svg className="w-5 h-5 text-neon-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-white/90">Lenovo Tab M11</div>
              <div className="text-[10px] text-white/30">HT892XYZ</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-white/30">IMEI</span>
              <div className="text-white/60 font-mono">{health.imei}</div>
            </div>
            <div>
              <span className="text-white/30">Android</span>
              <div className="text-white/60">{health.androidVersion}</div>
            </div>
            <div>
              <span className="text-white/30">Security Patch</span>
              <div className="text-white/60">{health.securityPatch}</div>
            </div>
            <div>
              <span className="text-white/30">Root</span>
              <div className="text-white/60 capitalize">{health.rootStatus.replace('_', ' ')}</div>
            </div>
          </div>
        </div>

        {/* Status items */}
        <div className="space-y-2">
          {[
            { label: 'Screen Lock', value: health.screenLock ? 'Enabled' : 'Disabled', icon: health.screenLock ? 'text-neon-green' : 'text-white/40' },
            { label: 'Bootloader', value: health.bootloaderUnlocked ? 'Unlocked' : 'Locked', icon: health.bootloaderUnlocked ? 'text-neon-orange' : 'text-neon-green' },
            { label: 'Root Access', value: health.rootStatus === 'rooted' ? 'Rooted' : 'Not Rooted', icon: health.rootStatus === 'rooted' ? 'text-neon-orange' : 'text-neon-green' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-3 bg-surface-2/40 rounded-xl border border-white/5">
              <span className="text-xs text-white/50">{item.label}</span>
              <span className={`text-xs font-medium ${item.icon}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right - Health Details */}
      <div className="flex-1 grid grid-cols-2 gap-4">
        {/* Battery */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-neon-green/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-neon-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M4.5 10.5H18V15a2.25 2.25 0 01-2.25 2.25h-9A2.25 2.25 0 014.5 15v-4.5zM3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white/80">Battery</h3>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                  strokeDasharray={`${(health.batteryLevel ?? 0) * 0.94} 100`}
                  className={batteryColor} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-bold ${batteryColor}`}>{health.batteryLevel}%</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className={`text-xs px-2.5 py-1 rounded-lg inline-block ${HEALTH_COLORS[health.batteryHealth].bg} ${HEALTH_COLORS[health.batteryHealth].text} ${HEALTH_COLORS[health.batteryHealth].border} border`}>
                {health.batteryHealth.toUpperCase()}
              </div>
              <div className="text-xs text-white/40">{health.batteryCycles} charge cycles</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-white/40">Capacity</span>
              <span className="text-white/60">7040 mAh</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-white/40">Health</span>
              <span className={`font-medium ${HEALTH_COLORS[health.batteryHealth].text}`}>{health.batteryHealth}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-white/40">Cycles</span>
              <span className="text-white/60">{health.batteryCycles}/1000</span>
            </div>
          </div>
        </div>

        {/* Storage */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-neon-blue/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-neon-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white/80">Storage</h3>
          </div>

          <div className="mb-4">
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-2xl font-bold text-white/90">{storagePercent}%</span>
              <span className="text-xs text-white/30">used</span>
            </div>
            <div className="w-full h-3 bg-surface-3/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  storagePercent > 90 ? 'bg-red-400' : storagePercent > 70 ? 'bg-neon-yellow' : 'bg-neon-blue'
                }`}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-white/30">
              <span>{formatBytes(health.storageUsed ?? 0)} used</span>
              <span>{formatBytes(health.storageTotal ?? 0)} total</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-white/40">Type</span>
              <span className="text-white/60">eMMC 5.1</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-white/40">Free Space</span>
              <span className="text-white/60">{formatBytes((health.storageTotal ?? 0) - (health.storageUsed ?? 0))}</span>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="glass rounded-2xl p-5 col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-neon-purple/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-neon-purple" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white/80">System Information</h3>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Android', value: health.androidVersion ?? 'N/A', color: 'text-neon-green' },
              { label: 'Security Patch', value: health.securityPatch ?? 'N/A', color: 'text-white/60' },
              { label: 'IMEI', value: health.imei ?? 'N/A', color: 'text-white/60', mono: true },
              { label: 'Root', value: health.rootStatus.replace('_', ' '), color: health.rootStatus === 'rooted' ? 'text-neon-orange' : 'text-neon-green' },
              { label: 'Screen Lock', value: health.screenLock ? 'Enabled' : 'Disabled', color: health.screenLock ? 'text-neon-green' : 'text-white/40' },
              { label: 'Bootloader', value: health.bootloaderUnlocked ? 'Unlocked' : 'Locked', color: health.bootloaderUnlocked ? 'text-neon-orange' : 'text-neon-green' },
              { label: 'Chipset', value: 'MediaTek Helio G88', color: 'text-neon-orange' },
              { label: 'Serial', value: 'HT892XYZ', color: 'text-white/60', mono: true },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{item.label}</div>
                <div className={`text-sm font-medium ${item.color} ${item.mono ? 'font-mono' : ''}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
