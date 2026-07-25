import { useState } from 'react'

interface FlashJob {
  id: string
  deviceName: string
  devicePort: string
  firmware: string
  status: 'queued' | 'flashing' | 'verifying' | 'complete' | 'error'
  progress: number
  startTime?: Date
  endTime?: Date
  error?: string
}

interface FirmwareFile {
  id: string
  name: string
  size: number
  device: string
  version: string
  date: string
  path: string
}

const MOCK_FIRMWARES: FirmwareFile[] = [
  {
    id: 'fw1',
    name: 'Galaxy_S24_SM-S926B_FW.zip',
    size: 4.2 * 1024 * 1024 * 1024,
    device: 'Samsung Galaxy S24',
    version: 'S926BXXS3AXE5',
    date: '2024-05-15',
    path: 'firmware/samsung/galaxy_s24/',
  },
  {
    id: 'fw2',
    name: 'Pixel_8_Pro_Firmware.zip',
    size: 3.8 * 1024 * 1024 * 1024,
    device: 'Google Pixel 8 Pro',
    version: 'AP2A.240505.005',
    date: '2024-05-05',
    path: 'firmware/google/pixel_8_pro/',
  },
  {
    id: 'fw3',
    name: 'iPhone_13_iPSW.ipsw',
    size: 5.1 * 1024 * 1024 * 1024,
    device: 'Apple iPhone 13',
    version: 'iOS 17.5',
    date: '2024-05-13',
    path: 'firmware/apple/iphone_13/',
  },
]

const MOCK_JOBS: FlashJob[] = [
  {
    id: 'job1',
    deviceName: 'Samsung Galaxy S24',
    devicePort: 'USB 1',
    firmware: 'SM-S926B_Region.zip',
    status: 'complete',
    progress: 100,
    startTime: new Date(Date.now() - 5 * 60 * 1000),
    endTime: new Date(),
  },
  {
    id: 'job2',
    deviceName: 'Google Pixel 8',
    devicePort: 'USB 2',
    firmware: 'Pixel_8_Firmware.zip',
    status: 'flashing',
    progress: 67,
    startTime: new Date(Date.now() - 3 * 60 * 1000),
  },
  {
    id: 'job3',
    deviceName: 'Samsung Galaxy A54',
    devicePort: 'USB 3',
    firmware: 'A54_5G_FW.zip',
    status: 'queued',
    progress: 0,
  },
  {
    id: 'job4',
    deviceName: 'Xiaomi 14',
    devicePort: 'USB 4',
    firmware: 'Xiaomi_14_FW.zip',
    status: 'queued',
    progress: 0,
  },
]

export function Flasher() {
  const [jobs, setJobs] = useState<FlashJob[]>(MOCK_JOBS)
  const [selectedFirmware, setSelectedFirmware] = useState<FirmwareFile | null>(null)
  const [showFirmwareBrowser, setShowFirmwareBrowser] = useState(false)

  const getStatusColor = (status: FlashJob['status']) => {
    switch (status) {
      case 'queued': return 'bg-gray-600'
      case 'flashing': return 'bg-blue-600'
      case 'verifying': return 'bg-yellow-600'
      case 'complete': return 'bg-green-600'
      case 'error': return 'bg-red-600'
      default: return 'bg-gray-600'
    }
  }

  const getStatusText = (status: FlashJob['status']) => {
    switch (status) {
      case 'queued': return 'Queued'
      case 'flashing': return 'Flashing...'
      case 'verifying': return 'Verifying...'
      case 'complete': return 'Complete ✓'
      case 'error': return 'Error ✗'
      default: return 'Unknown'
    }
  }

  const startFlashing = () => {
    setJobs(prev => prev.map(job => {
      if (job.status === 'queued') {
        return { ...job, status: 'flashing', progress: 0, startTime: new Date() }
      }
      return job
    }))
  }

  const pauseFlashing = () => {
    setJobs(prev => prev.map(job => {
      if (job.status === 'flashing') {
        return { ...job, status: 'queued' }
      }
      return job
    }))
  }

  const cancelJob = (jobId: string) => {
    setJobs(prev => prev.filter(job => job.id !== jobId))
  }

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-2 bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => setShowFirmwareBrowser(true)}
          className="px-4 py-1 bg-blue-600 hover:bg-blue-500 rounded"
        >
          📁 Select Firmware
        </button>
        
        <div className="flex-1" />
        
        <div className="text-sm text-gray-400">
          Queue: {jobs.filter(j => j.status === 'queued').length} devices
        </div>
        
        <button
          onClick={startFlashing}
          disabled={jobs.every(j => j.status !== 'queued')}
          className="px-4 py-1 bg-green-600 hover:bg-green-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ▶ Start All
        </button>
        
        <button
          onClick={pauseFlashing}
          disabled={jobs.every(j => j.status !== 'flashing')}
          className="px-4 py-1 bg-yellow-600 hover:bg-yellow-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ⏸ Pause
        </button>
      </div>

      <div className="flex-1 flex">
        {/* Flash Queue */}
        <div className="flex-1 p-4">
          <h2 className="text-lg font-semibold mb-4">Flash Queue</h2>
          
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <div className="text-4xl mb-2">💾</div>
              <p>No devices in queue</p>
              <p className="text-sm mt-2">Connect devices and select firmware to begin</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => (
                <div key={job.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${getStatusColor(job.status)}`} />
                      <div>
                        <div className="font-medium">{job.deviceName}</div>
                        <div className="text-sm text-gray-400">{job.devicePort}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">{getStatusText(job.status)}</span>
                      {job.status !== 'complete' && (
                        <button
                          onClick={() => cancelJob(job.id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-400 mb-2">
                    Firmware: {job.firmware}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${getStatusColor(job.status)}`}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-400 w-12 text-right">
                      {job.progress}%
                    </span>
                  </div>
                  
                  {job.error && (
                    <div className="mt-2 text-sm text-red-400">{job.error}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Statistics */}
          {jobs.length > 0 && (
            <div className="mt-6 grid grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-sm text-gray-400">Total Jobs</div>
                <div className="text-2xl font-bold">{jobs.length}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-sm text-gray-400">Completed</div>
                <div className="text-2xl font-bold text-green-400">
                  {jobs.filter(j => j.status === 'complete').length}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-sm text-gray-400">In Progress</div>
                <div className="text-2xl font-bold text-blue-400">
                  {jobs.filter(j => j.status === 'flashing').length}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-sm text-gray-400">Errors</div>
                <div className="text-2xl font-bold text-red-400">
                  {jobs.filter(j => j.status === 'error').length}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Firmware Browser Modal */}
        {showFirmwareBrowser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg w-[600px] max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold">Firmware Browser</h3>
                <button
                  onClick={() => setShowFirmwareBrowser(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-4">
                <div className="space-y-3">
                  {MOCK_FIRMWARES.map(fw => (
                    <div
                      key={fw.id}
                      onClick={() => setSelectedFirmware(fw)}
                      className={`p-4 rounded-lg cursor-pointer ${
                        selectedFirmware?.id === fw.id
                          ? 'bg-blue-600'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{fw.name}</div>
                          <div className="text-sm text-gray-300">{fw.device}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">{fw.version}</div>
                          <div className="text-xs text-gray-400">{formatSize(fw.size)}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mt-2">{fw.date}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
                <button
                  onClick={() => setShowFirmwareBrowser(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowFirmwareBrowser(false)}
                  disabled={!selectedFirmware}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded disabled:opacity-50"
                >
                  Select
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
