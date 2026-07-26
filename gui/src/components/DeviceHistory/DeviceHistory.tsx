import { useState } from 'react'
import { useDeviceStore } from '../../lib/deviceStore'
import type { DeviceHistoryEntry } from '../../lib/types'

const TYPE_COLORS: Record<string, string> = {
  android: 'text-neon-green',
  samsung: 'text-bench-400',
  qualcomm: 'text-neon-blue',
  mediatek: 'text-neon-orange',
  apple: 'text-white/70',
  generic: 'text-white/50',
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  connected: { bg: 'bg-neon-green/10', text: 'text-neon-green' },
  disconnected: { bg: 'bg-white/5', text: 'text-white/40' },
  flashed: { bg: 'bg-neon-orange/10', text: 'text-neon-orange' },
  backed_up: { bg: 'bg-neon-blue/10', text: 'text-neon-blue' },
  recovered: { bg: 'bg-neon-purple/10', text: 'text-neon-purple' },
  error: { bg: 'bg-red-500/10', text: 'text-red-400' },
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function DeviceHistory() {
  const devices = useDeviceStore((s) => s.devices)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const history: DeviceHistoryEntry[] = devices.map((d) => ({
    id: d.id,
    timestamp: d.lastSeen || d.firstSeen || new Date(),
    deviceName: d.productName,
    vendorId: d.vendorId,
    productId: d.productId,
    deviceType: d.deviceType,
    bootMode: d.bootMode,
    serial: d.serial,
    action: d.status === 'connected' ? 'connected' : 'disconnected',
    details: d.bootMode !== 'unknown' ? `${d.bootMode} mode` : undefined,
  }))

  const filtered = history.filter((entry) => {
    if (filter !== 'all' && entry.action !== filter) return false
    if (search && !entry.deviceName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left panel - Stats */}
      <div className="w-72 glass rounded-2xl p-4 flex flex-col shrink-0">
        <h2 className="text-sm font-semibold text-white/80 mb-4">Session Summary</h2>

        <div className="space-y-3">
          <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Total Events</div>
            <div className="text-2xl font-bold text-white/90">{history.length}</div>
          </div>
          <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Unique Devices</div>
            <div className="text-2xl font-bold text-neon-blue">
              {new Set(history.map((e) => `${e.vendorId}:${e.productId}`)).size}
            </div>
          </div>
          <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Connected</div>
            <div className="text-2xl font-bold text-neon-green">
              {history.filter((e) => e.action === 'connected').length}
            </div>
          </div>
          <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Disconnected</div>
            <div className="text-2xl font-bold text-white/50">
              {history.filter((e) => e.action === 'disconnected').length}
            </div>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="mt-6">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Filter by Action</div>
          <div className="flex flex-wrap gap-2">
            {['all', 'connected', 'disconnected'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                  filter === f
                    ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30'
                    : 'bg-surface-2/40 text-white/40 border-white/5 hover:text-white/60'
                }`}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - Timeline */}
      <div className="flex-1 glass rounded-2xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Event Timeline</h2>
          <input
            type="text"
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface-2/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-neon-blue/30 w-48"
          />
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-white/40 mb-1">No device history</p>
              <p className="text-xs text-white/20">Connect a device to start tracking</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-white/10" />

              <div className="space-y-1">
                {filtered.map((entry) => {
                  const colors = ACTION_COLORS[entry.action] || ACTION_COLORS.connected
                  return (
                    <div key={entry.id} className="relative flex items-start gap-4 p-3 rounded-xl hover:bg-surface-2/30 transition-colors group">
                      {/* Timeline dot */}
                      <div className={`relative z-10 w-5 h-5 rounded-full ${colors.bg} flex items-center justify-center shrink-0 mt-0.5 border border-white/5`}>
                        <div className={`w-2 h-2 rounded-full ${colors.text.replace('text-', 'bg-')}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-white/80 truncate">{entry.deviceName}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border border-white/5 capitalize`}>
                            {entry.action}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-white/40">
                          <span className="font-mono">{entry.vendorId}:{entry.productId}</span>
                          <span className={TYPE_COLORS[entry.deviceType] || 'text-white/50'}>{entry.deviceType}</span>
                          {entry.serial && <span className="font-mono">SN: {entry.serial}</span>}
                          {entry.bootMode !== 'unknown' && (
                            <span className="px-1.5 py-0.5 rounded bg-surface-3/60 border border-white/5">{entry.bootMode}</span>
                          )}
                        </div>
                        {entry.details && (
                          <div className="text-[11px] text-white/30 mt-1">{entry.details}</div>
                        )}
                      </div>

                      <div className="text-[10px] text-white/20 font-mono shrink-0">{formatTimeAgo(entry.timestamp)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
