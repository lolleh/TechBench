import { useState } from 'react'
import { useDeviceStore } from '../../lib/deviceStore'
import { tauri } from '../../lib/tauri'

interface JailbreakResult {
  success: boolean
  error: string
  device: {
    name: string
    marketingName: string
    model: string
    productType: string
    modelNumber: string
    iosVersion: string
    build: string
    serial: string
  } | null
  assessment: {
    chip: string
    checkm8: boolean
    iosVersion: string
    status: 'supported' | 'unsupported'
    verdict: string
    tools: Array<{ name: string; description: string; supported: boolean; note: string }>
  } | null
}

export function JailbreakTool() {
  const devices = useDeviceStore((s) => s.devices)
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<JailbreakResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedDevice = devices.find((d) => d.status === 'connected') || null

  const handleCheck = async () => {
    if (!selectedDevice || !selectedDevice.serial) return
    setIsChecking(true)
    setResult(null)
    setError(null)
    try {
      const res = await tauri.jailbreakInfo(selectedDevice.serial)
      setResult(res)
      if (!res.success) setError(res.error || 'Compatibility check failed')
    } catch (err) {
      setError(`Check error: ${err}`)
    } finally {
      setIsChecking(false)
    }
  }

  const status = result?.assessment?.status
  const statusStyles =
    status === 'supported'
      ? 'bg-neon-green/10 border-neon-green/30 text-neon-green'
      : 'bg-red-500/10 border-red-500/30 text-red-400'

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Device + Controls */}
      <div className="w-80 glass rounded-2xl p-4 flex flex-col shrink-0 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Jailbreak</h2>
          <button
            onClick={handleCheck}
            disabled={!selectedDevice || isChecking}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20 transition-all disabled:opacity-40"
          >
            {isChecking ? 'Checking...' : 'Check'}
          </button>
        </div>

        {!selectedDevice ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a7.5 7.5 0 0015 0m-6 0V14m0-2.5V8a1.5 1.5 0 113 0" />
                <path d="M5 21h14" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">No device connected</p>
            <p className="text-xs text-white/20">Connect an iOS device to check jailbreak compatibility</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Target Device</div>
              <div className="text-sm font-medium text-white/80">{selectedDevice.productName}</div>
              <div className="text-[11px] font-mono text-white/40 mt-1 break-all">{selectedDevice.serial}</div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
              <p className="text-[11px] text-white/50 leading-relaxed">
                Checks the connected device against known jailbreak tools and reports honest compatibility.
                Jailbreaking is legal in most regions, but always verify you own the device.
              </p>
            </div>

            {result?.assessment && (
              <div className="space-y-3 animate-fade-in">
                <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Device Details</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/50">Model</span>
                      <span className="text-[11px] font-mono text-white/70">
                        {result.device?.marketingName || result.device?.productType || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/50">Product Type</span>
                      <span className="text-[11px] font-mono text-white/70">{result.device?.productType || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/50">Chip</span>
                      <span className="text-[11px] font-mono text-white/70">{result.assessment.chip}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/50">iOS</span>
                      <span className="text-[11px] font-mono text-white/70">{result.assessment.iosVersion}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/50">Build</span>
                      <span className="text-[11px] font-mono text-white/70">{result.device?.build || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/50">checkm8</span>
                      <span className={`text-[11px] ${result.assessment.checkm8 ? 'text-neon-green' : 'text-white/40'}`}>
                        {result.assessment.checkm8 ? 'Vulnerable' : 'Patched'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right - Compatibility Report */}
      <div className="flex-1 glass rounded-2xl p-4 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <h2 className="text-sm font-semibold text-white/80 mb-4">Compatibility Report</h2>

        {!selectedDevice ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/30 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a7.5 7.5 0 0015 0m-6 0V14m0-2.5V8a1.5 1.5 0 113 0" />
                <path d="M5 21h14" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">No device selected</p>
            <p className="text-xs text-white/20">Connect an iOS device to run the compatibility check</p>
          </div>
        ) : !result ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/30 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">Check required</p>
            <p className="text-xs text-white/20">Click &quot;Check&quot; to evaluate jailbreak compatibility</p>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in overflow-y-auto custom-scrollbar pr-1">
            {result.error ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-xs text-red-400">{result.error}</p>
              </div>
            ) : result.assessment ? (
              <>
                <div className={`rounded-xl p-4 border ${statusStyles}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {status === 'supported' ? (
                          <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        ) : (
                          <path d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        )}
                      </svg>
                    </div>
                    <span className="text-sm font-semibold uppercase tracking-wide">
                      {result.assessment.status === 'supported' ? 'Potentially Supported' : 'Not Supported'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">{result.assessment.verdict}</p>
                </div>

                <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Known Tools</div>
                  <div className="space-y-2">
                    {result.assessment.tools.map((tool) => (
                      <div key={tool.name} className="flex items-start gap-3 rounded-lg bg-surface-3/30 p-2.5 border border-white/5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${tool.supported ? 'bg-neon-green/15 text-neon-green' : 'bg-white/5 text-white/30'}`}>
                          {tool.supported ? (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 6l12 12M18 6L6 18" /></svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white/80">{tool.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${tool.supported ? 'bg-neon-green/10 text-neon-green' : 'bg-white/5 text-white/30'}`}>
                              {tool.supported ? 'Supported' : 'Not supported'}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/40 mt-0.5">{tool.description}</p>
                          <p className="text-[11px] text-white/30 mt-0.5">{tool.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
