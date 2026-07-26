import { useState } from 'react'
import { useDeviceStore } from '../../lib/deviceStore'
import type { BatchJob } from '../../lib/types'

const JOB_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  backup: { bg: 'bg-neon-blue/10', text: 'text-neon-blue', border: 'border-neon-blue/20' },
  flash: { bg: 'bg-neon-orange/10', text: 'text-neon-orange', border: 'border-neon-orange/20' },
  unlock: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/20' },
  wipe: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-white/5', text: 'text-white/40' },
  running: { bg: 'bg-neon-blue/10', text: 'text-neon-blue' },
  complete: { bg: 'bg-neon-green/10', text: 'text-neon-green' },
  error: { bg: 'bg-red-500/10', text: 'text-red-400' },
}

export function BatchOperations() {
  const devices = useDeviceStore((s) => s.devices)
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [jobs, setJobs] = useState<BatchJob[]>([])
  const [operation, setOperation] = useState<'backup' | 'flash' | 'unlock' | 'wipe'>('backup')
  const [isRunning, setIsRunning] = useState(false)

  const connectedDevices = devices.filter((d) => d.status === 'connected')

  const toggleDevice = (id: string) => {
    setSelectedDevices((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedDevices(new Set(connectedDevices.map((d) => d.id)))
  }

  const deselectAll = () => {
    setSelectedDevices(new Set())
  }

  const startBatch = () => {
    if (selectedDevices.size === 0) return

    const newJob: BatchJob = {
      id: String(Date.now()),
      name: `Batch ${operation.charAt(0).toUpperCase() + operation.slice(1)}`,
      type: operation,
      deviceIds: Array.from(selectedDevices),
      status: 'running',
      progress: 0,
      startTime: new Date(),
      results: Array.from(selectedDevices).map((id) => ({
        deviceId: id,
        status: 'success' as const,
        message: 'Queued',
      })),
    }

    setJobs((prev) => [newJob, ...prev])
    setIsRunning(true)

    // Simulate progress
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 20
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        setIsRunning(false)
        setJobs((prev) =>
          prev.map((j) =>
            j.id === newJob.id
              ? { ...j, status: 'complete', progress: 100, endTime: new Date() }
              : j
          )
        )
      } else {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === newJob.id ? { ...j, progress: Math.round(progress) } : j
          )
        )
      }
    }, 500)
  }

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Device Selection */}
      <div className="w-80 glass rounded-2xl p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Select Devices</h2>
          <span className="text-[10px] font-mono text-white/30">{connectedDevices.length} connected</span>
        </div>

        {/* Bulk actions */}
        <div className="flex gap-2 mb-4">
          <button onClick={selectAll} className="flex-1 text-[10px] px-2 py-1.5 rounded-lg bg-surface-2/40 text-white/40 border border-white/5 hover:text-white/60 transition-all">
            Select All
          </button>
          <button onClick={deselectAll} className="flex-1 text-[10px] px-2 py-1.5 rounded-lg bg-surface-2/40 text-white/40 border border-white/5 hover:text-white/60 transition-all">
            Deselect All
          </button>
        </div>

        {/* Device list */}
        <div className="flex-1 overflow-auto custom-scrollbar space-y-1">
          {connectedDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
              </div>
              <p className="text-sm text-white/40 mb-1">No devices connected</p>
              <p className="text-xs text-white/20">Connect multiple devices for batch operations</p>
            </div>
          ) : (
            connectedDevices.map((device) => {
              const isSelected = selectedDevices.has(device.id)
              return (
                <button
                  key={device.id}
                  onClick={() => toggleDevice(device.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-neon-green/10 to-transparent border border-neon-green/20'
                      : 'bg-surface-2/30 border border-transparent hover:bg-surface-3/30 hover:border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-neon-green border-neon-green'
                        : 'border-white/20'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/80 truncate">{device.productName}</div>
                      <div className="text-[10px] text-white/30 font-mono">{device.serial || device.vendorId}</div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right - Operations */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Operation selector */}
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Operation</div>
          <div className="flex gap-2 mb-4">
            {(['backup', 'flash', 'unlock', 'wipe'] as const).map((op) => {
              const colors = JOB_COLORS[op]
              return (
                <button
                  key={op}
                  onClick={() => setOperation(op)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    operation === op
                      ? `${colors.bg} ${colors.text} ${colors.border}`
                      : 'bg-surface-2/40 text-white/40 border-white/5 hover:text-white/60'
                  }`}
                >
                  {op.charAt(0).toUpperCase() + op.slice(1)}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={startBatch}
              disabled={selectedDevices.size === 0 || isRunning}
              className="btn-cyber flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <div className="w-3 h-3 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                  Start Batch ({selectedDevices.size} devices)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Job history */}
        <div className="flex-1 glass rounded-2xl p-4 flex flex-col">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Job History</div>
          <div className="flex-1 overflow-auto custom-scrollbar space-y-2">
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                </div>
                <p className="text-sm text-white/40 mb-1">No batch jobs</p>
                <p className="text-xs text-white/20">Select devices and start a batch operation</p>
              </div>
            ) : (
              jobs.map((job) => {
                const jobColors = JOB_COLORS[job.type] || JOB_COLORS.backup
                const statusColors = STATUS_COLORS[job.status] || STATUS_COLORS.pending

                return (
                  <div key={job.id} className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${jobColors.bg} ${jobColors.text} ${jobColors.border} border`}>
                          {job.type}
                        </span>
                        <span className="text-sm font-medium text-white/80">{job.name}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${statusColors.bg} ${statusColors.text}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] text-white/30">{job.deviceIds.length} devices</span>
                      <span className="text-[10px] text-white/30">{job.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-3/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          job.status === 'complete' ? 'bg-neon-green'
                          : job.status === 'error' ? 'bg-red-400'
                          : 'bg-neon-blue'
                        }`}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
