import { useState } from 'react'
import type { Partition } from '../../lib/types'

const MOCK_PARTITIONS: Partition[] = [
  { id: '1', name: 'boot', size: 67108864, type: 'boot', status: 'dumped', filePath: '/workspace/backups/boot.img', checksum: 'a3f2c8d1e5b4' },
  { id: '2', name: 'system', size: 2147483648, type: 'system', status: 'dumped', filePath: '/workspace/backups/system.img', checksum: 'b7e9a1f3c2d8' },
  { id: '3', name: 'vendor', size: 536870912, type: 'vendor', status: 'empty' },
  { id: '4', name: 'recovery', size: 33554432, type: 'recovery', status: 'dumped', filePath: '/workspace/backups/recovery.img', checksum: 'c4d6e8f0a1b2' },
  { id: '5', name: 'userdata', size: 107374182400, type: 'userdata', status: 'empty' },
  { id: '6', name: 'cache', size: 1073741824, type: 'cache', status: 'empty' },
  { id: '7', name: 'misc', size: 1048576, type: 'misc', status: 'empty' },
  { id: '8', name: 'modem', size: 134217728, type: 'unknown', status: 'corrupted' },
]

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  boot: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/20' },
  system: { bg: 'bg-neon-blue/10', text: 'text-neon-blue', border: 'border-neon-blue/20' },
  vendor: { bg: 'bg-neon-purple/10', text: 'text-neon-purple', border: 'border-neon-purple/20' },
  recovery: { bg: 'bg-neon-orange/10', text: 'text-neon-orange', border: 'border-neon-orange/20' },
  userdata: { bg: 'bg-neon-yellow/10', text: 'text-neon-yellow', border: 'border-neon-yellow/20' },
  cache: { bg: 'bg-white/5', text: 'text-white/50', border: 'border-white/10' },
  misc: { bg: 'bg-white/5', text: 'text-white/40', border: 'border-white/10' },
  unknown: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  dumped: { bg: 'bg-neon-green/10', text: 'text-neon-green' },
  empty: { bg: 'bg-white/5', text: 'text-white/40' },
  corrupted: { bg: 'bg-red-500/10', text: 'text-red-400' },
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

export function PartitionManager() {
  const [selectedPartition, setSelectedPartition] = useState<Partition | null>(null)
  const [deviceSerial, setDeviceSerial] = useState('HT892XYZ')

  const totalSize = MOCK_PARTITIONS.reduce((sum, p) => sum + p.size, 0)
  const dumpedCount = MOCK_PARTITIONS.filter((p) => p.status === 'dumped').length

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Partition List */}
      <div className="w-96 glass rounded-2xl p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Partitions</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/30 px-2 py-0.5 rounded-full bg-surface-3">
              {dumpedCount}/{MOCK_PARTITIONS.length} dumped
            </span>
          </div>
        </div>

        {/* Device selector */}
        <div className="mb-4">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Device</div>
          <div className="flex items-center gap-2 bg-surface-2/40 rounded-xl p-3 border border-white/5">
            <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            <span className="text-sm text-white/80">Lenovo Tab M11</span>
            <span className="text-[10px] font-mono text-white/30 ml-auto">{deviceSerial}</span>
          </div>
        </div>

        {/* Partition list */}
        <div className="flex-1 overflow-auto custom-scrollbar space-y-2">
          {MOCK_PARTITIONS.map((partition) => {
            const colors = TYPE_COLORS[partition.type]
            const statusColors = STATUS_COLORS[partition.status]
            const isSelected = selectedPartition?.id === partition.id

            return (
              <button
                key={partition.id}
                onClick={() => setSelectedPartition(partition)}
                className={`w-full text-left p-3 rounded-xl transition-all duration-200 group ${
                  isSelected
                    ? 'bg-gradient-to-r from-neon-blue/10 to-transparent border border-neon-blue/20'
                    : 'bg-surface-2/40 border border-transparent hover:bg-surface-3/40 hover:border-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${colors.bg} ${colors.text} ${colors.border} border`}>
                      {partition.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColors.bg} ${statusColors.text}`}>
                      {partition.status}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-white/30">{formatSize(partition.size)}</span>
                </div>

                {/* Size bar */}
                <div className="w-full h-1 bg-surface-3/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      partition.status === 'dumped' ? 'bg-neon-green' : partition.status === 'corrupted' ? 'bg-red-400' : 'bg-white/20'
                    }`}
                    style={{ width: `${Math.min(100, (partition.size / totalSize) * 100 * 20)}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button className="btn-cyber flex-1 flex items-center justify-center gap-2 text-xs">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
            </svg>
            Dump All
          </button>
          <button className="btn-ghost flex-1 flex items-center justify-center gap-2 text-xs">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Restore
          </button>
        </div>
      </div>

      {/* Right - Partition Details */}
      <div className="flex-1 glass rounded-2xl p-6 overflow-auto custom-scrollbar">
        {selectedPartition ? (
          <div className="animate-fade-in">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white/90 mb-1">{selectedPartition.name}</h2>
                <p className="text-sm text-white/40 capitalize">{selectedPartition.type} partition</p>
              </div>
              <span className={`text-xs px-3 py-1.5 rounded-lg ${STATUS_COLORS[selectedPartition.status].bg} ${STATUS_COLORS[selectedPartition.status].text} border border-white/5`}>
                {selectedPartition.status.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Size</div>
                <div className="text-lg font-bold text-white/90">{formatSize(selectedPartition.size)}</div>
                <div className="text-xs text-white/30 font-mono mt-1">{selectedPartition.size.toLocaleString()} bytes</div>
              </div>
              <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Status</div>
                <div className={`text-lg font-bold capitalize ${STATUS_COLORS[selectedPartition.status].text}`}>{selectedPartition.status}</div>
              </div>
              {selectedPartition.filePath && (
                <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5 col-span-2">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">File Path</div>
                  <div className="text-sm text-white/70 font-mono break-all">{selectedPartition.filePath}</div>
                </div>
              )}
              {selectedPartition.checksum && (
                <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5 col-span-2">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">MD5 Checksum</div>
                  <div className="text-sm text-white/70 font-mono">{selectedPartition.checksum}</div>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex gap-3">
              <button className="btn-cyber flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                </svg>
                Dump Partition
              </button>
              <button className="btn-ghost flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Flash Partition
              </button>
              <button className="btn-ghost flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Verify
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-surface-3/30 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">Select a partition</p>
            <p className="text-xs text-white/20">Choose a partition to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
