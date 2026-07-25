import { useState } from 'react'

type RecoveryMode = 'software' | 'isp' | 'chip-off'

interface RecoveryOption {
  id: string
  name: string
  description: string
  mode: RecoveryMode
  riskLevel: 'low' | 'medium' | 'high'
  requiresOwnership: boolean
}

interface RecoveryJob {
  id: string
  type: string
  status: 'pending' | 'running' | 'complete' | 'error'
  progress: number
  startTime?: Date
  output?: string
  error?: string
}

const RECOVERY_OPTIONS: RecoveryOption[] = [
  {
    id: 'adb-backup',
    name: 'ADB Backup',
    description: 'Backup data via ADB (requires device to be accessible)',
    mode: 'software',
    riskLevel: 'low',
    requiresOwnership: false,
  },
  {
    id: 'fastboot-backup',
    name: 'Fastboot Partition Backup',
    description: 'Backup partitions via fastboot',
    mode: 'software',
    riskLevel: 'low',
    requiresOwnership: false,
  },
  {
    id: 'edl-backup',
    name: 'EDL Raw Backup',
    description: 'Raw eMMC/UFS backup via Qualcomm EDL',
    mode: 'software',
    riskLevel: 'medium',
    requiresOwnership: true,
  },
  {
    id: 'isp-emmc',
    name: 'ISP eMMC Read',
    description: 'Direct eMMC access via ISP adapter (BGA153/162)',
    mode: 'isp',
    riskLevel: 'medium',
    requiresOwnership: true,
  },
  {
    id: 'isp-ufs',
    name: 'ISP UFS Read',
    description: 'Direct UFS access via ISP adapter (BGA221)',
    mode: 'isp',
    riskLevel: 'high',
    requiresOwnership: true,
  },
  {
    id: 'chip-off',
    name: 'Chip-Off Recovery',
    description: 'Physical chip removal and direct reading',
    mode: 'chip-off',
    riskLevel: 'high',
    requiresOwnership: true,
  },
]

export function Recovery() {
  const [selectedMode, setSelectedMode] = useState<RecoveryMode>('software')
  const [selectedOption, setSelectedOption] = useState<RecoveryOption | null>(null)
  const [jobs, setJobs] = useState<RecoveryJob[]>([])
  const [ownershipVerified, setOwnershipVerified] = useState(false)
  const [showOwnershipDialog, setShowOwnershipDialog] = useState(false)

  const filteredOptions = RECOVERY_OPTIONS.filter(opt => opt.mode === selectedMode)

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-400'
      case 'medium': return 'text-yellow-400'
      case 'high': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const startRecovery = () => {
    if (!selectedOption) return
    
    if (selectedOption.requiresOwnership && !ownershipVerified) {
      setShowOwnershipDialog(true)
      return
    }
    
    const newJob: RecoveryJob = {
      id: `job-${Date.now()}`,
      type: selectedOption.name,
      status: 'running',
      progress: 0,
      startTime: new Date(),
    }
    
    setJobs(prev => [...prev, newJob])
    
    // Simulate progress
    const interval = setInterval(() => {
      setJobs(prev => prev.map(job => {
        if (job.id === newJob.id) {
          const newProgress = Math.min(job.progress + 10, 100)
          return {
            ...job,
            progress: newProgress,
            status: newProgress >= 100 ? 'complete' : 'running',
          }
        }
        return job
      }))
    }, 500)
    
    setTimeout(() => clearInterval(interval), 6000)
  }

  const verifyOwnership = (imei: string, serial: string) => {
    // In real implementation, this would check against database
    if (imei.length >= 15 && serial.length >= 10) {
      setOwnershipVerified(true)
      setShowOwnershipDialog(false)
      startRecovery()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mode Selector */}
      <div className="flex items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm text-gray-400 mr-2">Recovery Mode:</span>
        {(['software', 'isp', 'chip-off'] as RecoveryMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => { setSelectedMode(mode); setSelectedOption(null) }}
            className={`px-3 py-1 rounded text-sm ${
              selectedMode === mode
                ? 'bg-blue-600'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {mode === 'software' ? '💻 Software' : 
             mode === 'isp' ? '🔧 ISP' : '🔬 Chip-Off'}
          </button>
        ))}
        
        <div className="flex-1" />
        
        {ownershipVerified && (
          <span className="text-sm text-green-400">✓ Ownership Verified</span>
        )}
      </div>

      <div className="flex-1 flex">
        {/* Options Panel */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 p-4 overflow-auto">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">
            {selectedMode === 'software' ? 'Software Recovery' :
             selectedMode === 'isp' ? 'ISP Recovery' : 'Chip-Off Recovery'}
          </h3>
          
          <div className="space-y-2">
            {filteredOptions.map(option => (
              <div
                key={option.id}
                onClick={() => setSelectedOption(option)}
                className={`p-3 rounded-lg cursor-pointer ${
                  selectedOption?.id === option.id
                    ? 'bg-blue-600'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{option.name}</span>
                  <span className={`text-xs ${getRiskColor(option.riskLevel)}`}>
                    {option.riskLevel.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-gray-300">{option.description}</div>
                {option.requiresOwnership && (
                  <div className="text-xs text-yellow-400 mt-1">
                    ⚠ Requires ownership verification
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <button
            onClick={startRecovery}
            disabled={!selectedOption}
            className="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ▶ Start Recovery
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4">
          {/* Job List */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Recovery Jobs</h3>
            
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <p>No recovery jobs yet</p>
                <p className="text-sm mt-1">Select a recovery option and start</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map(job => (
                  <div key={job.id} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${
                          job.status === 'complete' ? 'bg-green-500' :
                          job.status === 'running' ? 'bg-blue-500 animate-pulse' :
                          job.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                        }`} />
                        <span className="font-medium">{job.type}</span>
                      </div>
                      <span className="text-sm text-gray-400">
                        {job.status === 'complete' ? '✓ Complete' :
                         job.status === 'running' ? `${job.progress}%` :
                         job.status === 'error' ? '✗ Error' : 'Pending'}
                      </span>
                    </div>
                    
                    <div className="bg-gray-700 rounded-full h-2 mb-2">
                      <div 
                        className={`h-2 rounded-full ${
                          job.status === 'complete' ? 'bg-green-500' :
                          job.status === 'running' ? 'bg-blue-500' :
                          job.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                        }`}
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    
                    {job.error && (
                      <div className="text-sm text-red-400">{job.error}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Information Panel */}
          {selectedOption && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">Recovery Information</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-sm text-gray-400">Method</label>
                  <div className="font-medium">{selectedOption.name}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Risk Level</label>
                  <div className={`font-medium ${getRiskColor(selectedOption.riskLevel)}`}>
                    {selectedOption.riskLevel.toUpperCase()}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Mode</label>
                  <div className="font-medium capitalize">{selectedOption.mode}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Ownership Required</label>
                  <div className="font-medium">
                    {selectedOption.requiresOwnership ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="text-sm text-gray-400">Description</label>
                <div className="text-gray-300">{selectedOption.description}</div>
              </div>
              
              <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3">
                <div className="flex items-center gap-2 text-yellow-400 mb-1">
                  <span>⚠</span>
                  <span className="font-medium">Warning</span>
                </div>
                <div className="text-sm text-gray-300">
                  {selectedOption.mode === 'chip-off' 
                    ? 'Chip-off recovery involves physically removing the storage chip. This process is irreversible and may damage the device permanently.'
                    : selectedOption.mode === 'isp'
                    ? 'ISP recovery requires connecting directly to the motherboard test points. Improper connections can damage the device.'
                    : 'Ensure you have proper authorization before attempting recovery on devices you do not own.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ownership Verification Dialog */}
      {showOwnershipDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg w-[500px] p-6">
            <h3 className="text-lg font-semibold mb-4">Ownership Verification Required</h3>
            
            <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3 mb-4">
              <div className="text-sm text-gray-300">
                This operation requires proof of device ownership. Please provide the device's IMEI number and serial number.
              </div>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">IMEI Number</label>
                <input
                  type="text"
                  placeholder="15 digits"
                  maxLength={15}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Serial Number</label>
                <input
                  type="text"
                  placeholder="Device serial number"
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Proof of Purchase (optional)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowOwnershipDialog(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => verifyOwnership('123456789012345', 'ABC123DEF456')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
              >
                Verify & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
