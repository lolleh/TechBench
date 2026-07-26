import { useState } from 'react'
import type { BatchJob } from '../../lib/types'

const MOCK_DEVICES = [
  { id: '1', name: 'Lenovo Tab M11', serial: 'HT892XYZ', selected: false },
  { id: '2', name: 'Samsung Galaxy S24', serial: 'RF8N90XXXXX', selected: false },
  { id: '3', name: 'Xiaomi Redmi Note 13', serial: '8A5B7C9D', selected: false },
  { id: '4', name: 'Lenovo Tab M11 Gen 2', serial: 'HT893ABC', selected: false },
  { id: '5', name: 'OPPO Reno 11', serial: 'AB12CD34', selected: false },
]

const MOCK_JOBS: BatchJob[] = [
  {
    id: '1',
    name: 'Batch Backup',
    type: 'backup',
    deviceIds: ['1', '2', '3'],
    status: 'complete',
    progress: 100,
    startTime: new Date(Date.now() - 600000),
    endTime: new Date(Date.now() - 300000),
    results: [
      { deviceId: '1', status: 'success', message: 'Backup complete (4.2GB)' },
      { deviceId: '2', status: 'success', message: 'Backup complete (128GB)' },
      { deviceId: '3', status: 'success', message: 'Backup complete (2.8GB)' },
    ],
  },
  {
    id: '2',
    name: 'Flash Firmware',
    type: 'flash',
    deviceIds: ['1', '4'],
    status: 'running',
    progress: 65,
    startTime: new Date(Date.now() - 120000),
    results: [
      { deviceId: '1', status: 'success', message: 'Flashing system...' },
      { deviceId: '4', status: 'success', message: 'Queued' },
    ],
  },
  {
    id: '3',
    name: 'Unlock Batch',
    type: 'unlock',
    deviceIds: ['2', '5'],
    status: 'error',
    progress: 30,
    startTime: new Date(Date.now() - 300000),
    results: [
      { deviceId: '2', status: 'error', message: 'Auth required' },
      { deviceId: '5', status: 'success', message: 'Unlock initiated' },
    ],
  },
]

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  flash: { bg: 'bg-neon-orange/10', text: 'text-neon-orange' },
  backup: { bg: 'bg-neon-blue/10', text: 'text-neon-blue' },
  unlock: { bg: 'bg-neon-purple/10', text: 'text-neon-purple' },
  custom: { bg: 'bg-neon-green/10', text: 'text-neon-green' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  queued: { bg: 'bg-white/5', text: 'text-white/40' },
  running: { bg: 'bg-neon-blue/10', text: 'text-neon-blue' },
  complete: { bg: 'bg-neon-green/10', text: 'text-neon-green' },
  error: { bg: 'bg-red-500/10', text: 'text-red-400' },
  partial: { bg: 'bg-neon-yellow/10', text: 'text-neon-yellow' },
}

export function BatchOperations() {
  const [devices, setDevices] = useState(MOCK_DEVICES)
  const [jobs] = useState<BatchJob[]>(MOCK_JOBS)
  const [selectedType, setSelectedType] = useState<string>('flash')
  const [batchName, setBatchName] = useState('')

  const toggleDevice = (id: string) => {
    setDevices(devices.map((d) => d.id === id ? { ...d, selected: !d.selected } : d))
  }

  const selectedCount = devices.filter((d) => d.selected).length

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Create Batch */}
      <div className="w-96 glass rounded-2xl p-4 flex flex-col shrink-0">
        <h2 className="text-sm font-semibold text-white/80 mb-4">Create Batch Operation</h2>

        {/* Operation type */}
        <div className="mb-4">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Operation Type</div>
          <div className="grid grid-cols-2 gap-2">
            {['flash', 'backup', 'unlock', 'custom'].map((type) => {
              const colors = TYPE_COLORS[type]
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`p-3 rounded-xl border transition-all text-center ${
                    selectedType === type
                      ? `${colors.bg} ${colors.text} border-current/20`
                      : 'bg-surface-2/40 text-white/40 border-white/5 hover:text-white/60'
                  }`}
                >
                  <div className="text-xs font-medium capitalize">{type}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Batch name */}
        <div className="mb-4">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Batch Name</div>
          <input
            type="text"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="Enter batch name..."
            className="w-full bg-surface-2/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-neon-blue/30"
          />
        </div>

        {/* Device selection */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] text-white/30 uppercase tracking-wider">Select Devices</div>
            <span className="text-[10px] text-white/30">{selectedCount} selected</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-auto custom-scrollbar">
            {devices.map((device) => (
              <button
                key={device.id}
                onClick={() => toggleDevice(device.id)}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${
                  device.selected
                    ? 'bg-neon-blue/10 border border-neon-blue/20'
                    : 'bg-surface-2/40 border border-white/5 hover:bg-surface-3/40'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                  device.selected ? 'bg-neon-blue border-neon-blue' : 'border-white/20'
                }`}>
                  {device.selected && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/80 truncate">{device.name}</div>
                  <div className="text-[10px] text-white/30 font-mono">{device.serial}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Create button */}
        <button
          disabled={selectedCount === 0}
          className="btn-cyber w-full flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Batch ({selectedCount} devices)
        </button>
      </div>

      {/* Right - Job History */}
      <div className="flex-1 glass rounded-2xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Batch Jobs</h2>
          <span className="text-[10px] font-mono text-white/30 px-2 py-0.5 rounded-full bg-surface-3">
            {jobs.length} jobs
          </span>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar space-y-3">
          {jobs.map((job) => {
            const typeColors = TYPE_COLORS[job.type]
            const statusColors = STATUS_COLORS[job.status]

            return (
              <div key={job.id} className="bg-surface-2/40 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-lg ${typeColors.bg} ${typeColors.text} capitalize`}>
                      {job.type}
                    </span>
                    <span className="text-sm font-medium text-white/80">{job.name}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-lg ${statusColors.bg} ${statusColors.text} capitalize`}>
                    {job.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-surface-3/60 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${
                      job.status === 'complete' ? 'bg-neon-green' : job.status === 'error' ? 'bg-red-400' : 'bg-neon-blue'
                    }`}
                    style={{ width: `${job.progress}%` }}
                  />
                </div>

                {/* Device results */}
                <div className="space-y-2">
                  {job.results.map((result) => {
                    const device = MOCK_DEVICES.find((d) => d.id === result.deviceId)
                    return (
                      <div key={result.deviceId} className="flex items-center justify-between p-2 bg-surface-1/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            result.status === 'success' ? 'bg-neon-green' : 'bg-red-400'
                          }`} />
                          <span className="text-xs text-white/60">{device?.name ?? 'Unknown'}</span>
                        </div>
                        <span className="text-[10px] text-white/30">{result.message}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Timestamps */}
                <div className="flex items-center gap-4 mt-3 text-[10px] text-white/20">
                  {job.startTime && <span>Started: {job.startTime.toLocaleTimeString()}</span>}
                  {job.endTime && <span>Ended: {job.endTime.toLocaleTimeString()}</span>}
                  <span>{job.deviceIds.length} devices</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
