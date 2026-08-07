import { useState, useEffect } from 'react'
import type { Partition } from '../../lib/types'
import { useDeviceStore } from '../../lib/deviceStore'
import { tauri } from '../../lib/tauri'

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
  const [partitions, setPartitions] = useState<Partition[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const devices = useDeviceStore((s) => s.devices)
  const selectedDeviceId = useDeviceStore((s) => s.selectedDeviceId)
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selectedDevice) {
        setPartitions([])
        setError('No device selected. Pick a device in the Device Manager first.')
        return
      }
      setLoading(true)
      setError('')
      const mode = selectedDevice.deviceType === 'apple' ? 'apple' : selectedDevice.bootMode
      const result = await tauri.fetchPartitions(selectedDevice.serial, mode, selectedDevice.deviceType)
      if (cancelled) return
      setPartitions(result.partitions)
      setError(result.error)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [selectedDevice])

  const totalSize = partitions.reduce((sum, p) => sum + p.size, 0)
  const dumpedCount = partitions.filter((p) => p.status === 'dumped').length

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Partition List */}
      <div className="w-96 glass rounded-2xl p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Partitions</h2>
          <span className="text-[10px] font-mono text-white/30">{partitions.length} found</span>
        </div>

        {partitions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">
              {loading ? 'Reading partitions...' : error ? 'No partitions detected' : 'No device selected'}
            </p>
            <p className="text-xs text-white/20 px-6">{error || 'Connect a device to view partitions'}</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5 text-center">
                <div className="text-sm font-bold text-white/90">{formatSize(totalSize)}</div>
                <div className="text-[9px] text-white/30">Total Size</div>
              </div>
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5 text-center">
                <div className="text-sm font-bold text-neon-green">{dumpedCount}</div>
                <div className="text-[9px] text-white/30">Dumped</div>
              </div>
            </div>

            {/* Partition list */}
            <div className="flex-1 overflow-auto custom-scrollbar space-y-1">
              {partitions.map((part) => {
                const colors = TYPE_COLORS[part.type] || TYPE_COLORS.unknown
                const statusColors = STATUS_COLORS[part.status] || STATUS_COLORS.empty
                const isSelected = selectedPartition?.id === part.id

                return (
                  <button
                    key={part.id}
                    onClick={() => setSelectedPartition(part)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-neon-blue/10 to-transparent border border-neon-blue/20'
                        : 'bg-surface-2/30 border border-transparent hover:bg-surface-3/30 hover:border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white/80 font-mono">{part.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColors.bg} ${statusColors.text}`}>
                        {part.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-white/30">
                      <span>{formatSize(part.size)}</span>
                      <span className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} ${colors.border} border`}>
                        {part.type}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Right - Partition Details */}
      <div className="flex-1 glass rounded-2xl p-4 flex flex-col">
        {selectedPartition ? (
          <div className="animate-fade-in">
            <h2 className="text-lg font-bold text-white/90 mb-4">{selectedPartition.name}</h2>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Name</div>
                <div className="text-sm font-medium text-white/80 font-mono">{selectedPartition.name}</div>
              </div>
              <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Size</div>
                <div className="text-sm font-medium text-white/80">{formatSize(selectedPartition.size)}</div>
              </div>
              <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Type</div>
                <div className="text-sm font-medium text-white/80">{selectedPartition.type}</div>
              </div>
              <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Status</div>
                <div className="text-sm font-medium text-white/80 capitalize">{selectedPartition.status}</div>
              </div>
            </div>

            {selectedPartition.filePath && (
              <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5 mb-4">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">File Path</div>
                <div className="text-xs font-mono text-neon-green/70">{selectedPartition.filePath}</div>
              </div>
            )}

            {selectedPartition.checksum && (
              <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5 mb-6">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Checksum</div>
                <div className="text-xs font-mono text-white/50">{selectedPartition.checksum}</div>
              </div>
            )}

            <div className="flex gap-3">
              <button className="btn-cyber flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Dump Partition
              </button>
              <button className="btn-ghost flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Restore
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/30 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
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
