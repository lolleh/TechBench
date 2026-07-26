import { useState } from 'react'
import type { DeviceHistoryEntry, DeviceType, BootMode } from '../../lib/types'

const MOCK_HISTORY: DeviceHistoryEntry[] = [
  { id: '1', timestamp: new Date(Date.now() - 300000), deviceName: 'Lenovo Tab M11', vendorId: '17ef', productId: '6010', deviceType: 'android', bootMode: 'normal', serial: 'HT892XYZ', action: 'connected', details: 'USB Debug mode' },
  { id: '2', timestamp: new Date(Date.now() - 250000), deviceName: 'Lenovo Tab M11', vendorId: '17ef', productId: '6010', deviceType: 'android', bootMode: 'fastboot', serial: 'HT892XYZ', action: 'flashed', details: 'Firmware v1.0.1 applied' },
  { id: '3', timestamp: new Date(Date.now() - 200000), deviceName: 'Samsung Galaxy S24', vendorId: '04e8', productId: '6860', deviceType: 'samsung', bootMode: 'download', serial: 'RF8N90XXXXX', action: 'connected', details: 'Odin mode' },
  { id: '4', timestamp: new Date(Date.now() - 180000), deviceName: 'Samsung Galaxy S24', vendorId: '04e8', productId: '6860', deviceType: 'samsung', bootMode: 'download', serial: 'RF8N90XXXXX', action: 'backed_up', details: 'Full NAND backup (128GB)' },
  { id: '5', timestamp: new Date(Date.now() - 150000), deviceName: 'Lenovo Tab M11', vendorId: '17ef', productId: '6010', deviceType: 'android', bootMode: 'normal', serial: 'HT892XYZ', action: 'disconnected' },
  { id: '6', timestamp: new Date(Date.now() - 100000), deviceName: 'Xiaomi Redmi Note 13', vendorId: '2717', productId: 'ff48', deviceType: 'android', bootMode: 'fastboot', serial: null, action: 'connected', details: 'Fastboot mode' },
  { id: '7', timestamp: new Date(Date.now() - 90000), deviceName: 'Xiaomi Redmi Note 13', vendorId: '2717', productId: 'ff48', deviceType: 'android', bootMode: 'edl', serial: null, action: 'error', details: 'EDL auth required' },
  { id: '8', timestamp: new Date(Date.now() - 50000), deviceName: 'Qualcomm QDLoader', vendorId: '05c6', productId: '90db', deviceType: 'qualcomm', bootMode: 'edl', serial: null, action: 'connected', details: 'Emergency Download mode' },
]

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

const ACTION_ICONS: Record<string, JSX.Element> = {
  connected: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  disconnected: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  flashed: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  backed_up: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  ),
  recovered: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
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
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const filtered = MOCK_HISTORY.filter((entry) => {
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
            <div className="text-2xl font-bold text-white/90">{MOCK_HISTORY.length}</div>
          </div>
          <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Unique Devices</div>
            <div className="text-2xl font-bold text-neon-blue">
              {new Set(MOCK_HISTORY.map((e) => `${e.vendorId}:${e.productId}`)).size}
            </div>
          </div>
          <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Flashes</div>
            <div className="text-2xl font-bold text-neon-orange">
              {MOCK_HISTORY.filter((e) => e.action === 'flashed').length}
            </div>
          </div>
          <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Errors</div>
            <div className="text-2xl font-bold text-red-400">
              {MOCK_HISTORY.filter((e) => e.action === 'error').length}
            </div>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="mt-6">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Filter by Action</div>
          <div className="flex flex-wrap gap-2">
            {['all', 'connected', 'flashed', 'backed_up', 'error'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                  filter === f
                    ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30'
                    : 'bg-surface-2/40 text-white/40 border-white/5 hover:text-white/60'
                }`}
              >
                {f === 'all' ? 'All' : f.replace('_', ' ')}
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
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-white/10" />

            <div className="space-y-1">
              {filtered.map((entry, i) => {
                const colors = ACTION_COLORS[entry.action]
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
                          {entry.action.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-white/40">
                        <span className="font-mono">{entry.vendorId}:{entry.productId}</span>
                        <span className={TYPE_COLORS[entry.deviceType]}>{entry.deviceType}</span>
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
        </div>
      </div>
    </div>
  )
}
