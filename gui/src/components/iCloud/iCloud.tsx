import { useEffect, useState } from 'react'
import { useDeviceStore } from '../../lib/deviceStore'
import { tauri } from '../../lib/tauri'

type ActiveTool = 'activation' | 'info' | 'signout'

const FIELD_LABELS: Array<{ key: string; label: string }> = [
  { key: 'MarketingName', label: 'Model' },
  { key: 'DeviceName', label: 'Device Name' },
  { key: 'SerialNumber', label: 'Serial Number' },
  { key: 'IMEI', label: 'IMEI' },
  { key: 'ICCID', label: 'ICCID' },
  { key: 'MEID', label: 'MEID' },
  { key: 'PhoneNumber', label: 'Phone Number' },
  { key: 'ProductType', label: 'Product Type' },
  { key: 'HardwareModel', label: 'Hardware Model' },
  { key: 'ModelNumber', label: 'Model Number' },
  { key: 'ProductVersion', label: 'iOS Version' },
  { key: 'BuildVersion', label: 'Build' },
  { key: 'ActivationState', label: 'Activation State' },
  { key: 'ActivationStateAcknowledged', label: 'Activation Acknowledged' },
  { key: 'WiFiAddress', label: 'WiFi MAC' },
  { key: 'BluetoothAddress', label: 'Bluetooth MAC' },
  { key: 'DeviceClass', label: 'Device Class' },
]

const RESTRICTED_FIELDS = new Set(['IMEI', 'ICCID', 'MEID', 'PhoneNumber'])

const SIGN_OUT_STEPS = [
  {
    title: 'Back up the device',
    body: 'Settings > your name > iCloud > iCloud Backup > Back Up Now. Optionally also back up to a computer with Finder/iTunes so nothing is lost.',
  },
  {
    title: 'Turn off Find My iPhone',
    body: 'Settings > your name > Find My > Find My iPhone, then switch it off. iOS asks for your Apple ID password to confirm.',
  },
  {
    title: 'Sign out of the Apple ID',
    body: 'Settings > your name > scroll to bottom > Sign Out. iOS asks for your Apple ID password and the device passcode.',
  },
  {
    title: 'Done - device is released',
    body: 'After signing out, the device is no longer tied to the account and Activation Lock is cleared. It can now be reset and sold or transferred safely.',
  },
]

export function ICloudTool() {
  const devices = useDeviceStore((s) => s.devices)
  const [activeTool, setActiveTool] = useState<ActiveTool>('activation')
  const [error, setError] = useState<string | null>(null)

  const selectedDevice = devices.find((d) => d.status === 'connected') || null

  // Activation Lock state
  const [identifier, setIdentifier] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [lockResult, setLockResult] = useState<{
    locked: boolean
    established: boolean
    desc: string
  } | null>(null)

  // Info state
  const [isReading, setIsReading] = useState(false)
  const [infoResult, setInfoResult] = useState<Record<string, string> | null>(null)

  const switchTool = (tool: ActiveTool) => {
    setActiveTool(tool)
    setError(null)
  }

  useEffect(() => {
    if (!selectedDevice || !selectedDevice.serial) return
    let cancelled = false
    tauri.icloudInfo(selectedDevice.serial).then((res) => {
      if (cancelled) return
      if (res.success && res.device?.SerialNumber) {
        setIdentifier(res.device.SerialNumber)
      }
    })
    return () => { cancelled = true }
  }, [selectedDevice?.id, activeTool])

  const handleCheckLock = async () => {
    const id = identifier.trim()
    if (!id) return
    setIsChecking(true)
    setLockResult(null)
    setError(null)
    try {
      const res = await tauri.icloudActivation(id)
      if (res.success) {
        setLockResult({ locked: res.locked, established: res.established, desc: res.desc })
      } else {
        setError(res.error || 'Activation Lock check failed')
      }
    } catch (err) {
      setError(`Check error: ${err}`)
    } finally {
      setIsChecking(false)
    }
  }

  const handleReadInfo = async () => {
    if (!selectedDevice || !selectedDevice.serial) return
    setIsReading(true)
    setInfoResult(null)
    setError(null)
    try {
      const res = await tauri.icloudInfo(selectedDevice.serial)
      if (res.success) {
        setInfoResult(res.device)
      } else {
        setError(res.error || 'Info read failed')
      }
    } catch (err) {
      setError(`Info read error: ${err}`)
    } finally {
      setIsReading(false)
    }
  }

  const toolCards: Array<{ id: ActiveTool; title: string; desc: string }> = [
    { id: 'activation', title: 'Activation Lock', desc: 'Check if the device is activation-locked' },
    { id: 'info', title: 'Info Report', desc: 'iCloud-relevant device identifiers' },
    { id: 'signout', title: 'Sign Out Guide', desc: 'Legitimate iCloud account removal' },
  ]

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Tool Selector */}
      <div className="w-80 glass rounded-2xl p-4 flex flex-col shrink-0 min-h-0 overflow-y-auto custom-scrollbar">
        <h2 className="text-sm font-semibold text-white/80 mb-4">iCloud Tools</h2>
        <div className="space-y-2">
          {toolCards.map((tool) => (
            <button
              key={tool.id}
              onClick={() => switchTool(tool.id)}
              className={`w-full text-left rounded-xl p-3 border transition-all ${
                activeTool === tool.id
                  ? 'bg-neon-cyan/10 border-neon-cyan/40'
                  : 'bg-surface-2/40 border-white/5 hover:bg-surface-2/70'
              }`}
            >
              <div className={`text-xs font-semibold mb-1 ${activeTool === tool.id ? 'text-neon-cyan' : 'text-white/70'}`}>
                {tool.title}
              </div>
              <div className="text-[11px] text-white/40">{tool.desc}</div>
            </button>
          ))}
        </div>

        {selectedDevice && (
          <div className="mt-4 bg-surface-2/40 rounded-xl p-3 border border-white/5">
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Target Device</div>
            <div className="text-sm font-medium text-white/80">{selectedDevice.productName}</div>
            <div className="text-[11px] font-mono text-white/40 mt-1 break-all">{selectedDevice.serial}</div>
          </div>
        )}

        <div className="mt-4 bg-surface-2/40 rounded-xl p-3 border border-white/5">
          <p className="text-[11px] text-white/50 leading-relaxed">
            These tools only report status or guide legitimate sign-out with the owner&apos;s Apple ID credentials.
            There is no supported way to bypass Activation Lock without the owner&apos;s proof of purchase.
          </p>
        </div>
      </div>

      {/* Right - Active Tool */}
      <div className="flex-1 glass rounded-2xl p-4 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {activeTool === 'activation' && (
          <div className="flex flex-col min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1">
            <h2 className="text-sm font-semibold text-white/80 mb-1">Activation Lock Status</h2>
            <p className="text-[11px] text-white/40 mb-4">
              Queries Apple&apos;s public activation-lock endpoint by serial number or IMEI. Useful for
              checking a device before purchase or repair.
            </p>

            <div className="flex gap-2 mb-4">
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Serial number or IMEI"
                className="flex-1 bg-surface-2/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white/80 focus:outline-none focus:border-neon-cyan/50 placeholder:text-white/25"
              />
              <button
                onClick={handleCheckLock}
                disabled={!identifier.trim() || isChecking}
                className="text-xs px-4 py-2 rounded-xl bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-all disabled:opacity-40 shrink-0"
              >
                {isChecking ? 'Checking...' : 'Check'}
              </button>
            </div>

            {isChecking && (
              <div className="text-xs text-white/40 animate-pulse">Contacting Apple activation-lock service...</div>
            )}

            {lockResult && !isChecking && (
              <div className="animate-fade-in">
                <div className={`rounded-xl p-4 border mb-3 ${
                  lockResult.locked
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-neon-green/10 border-neon-green/30 text-neon-green'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        {lockResult.locked ? (
                          <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        ) : (
                          <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25zm6-7.5a1.5 1.5 0 010 3 1.5 1.5 0 010-3z" />
                        )}
                      </svg>
                    </div>
                    <div>
                      <div className="text-base font-bold">
                        {lockResult.locked ? 'Activation Locked' : 'Not Locked'}
                      </div>
                      {lockResult.desc && <div className="text-xs opacity-80 mt-0.5">{lockResult.desc}</div>}
                    </div>
                  </div>
                  <div className="text-[11px] opacity-70 mt-3">
                    Activation Lock established: {lockResult.established ? 'yes' : 'no'}
                  </div>
                </div>
                {lockResult.locked && (
                  <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5 text-[11px] text-white/40 leading-relaxed">
                    A locked device is still linked to the previous owner&apos;s Apple ID. It can only be unlocked
                    by signing in with that account or by Apple after verified proof of purchase. Proceed only with
                    the rightful owner.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTool === 'info' && (
          <div className="flex flex-col min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/80">iCloud Info Report</h2>
              <button
                onClick={handleReadInfo}
                disabled={!selectedDevice || isReading}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20 transition-all disabled:opacity-40"
              >
                {isReading ? 'Reading...' : 'Read Info'}
              </button>
            </div>

            {!infoResult ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-3/30 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                  </svg>
                </div>
                <p className="text-sm text-white/40 mb-1">
                  {selectedDevice ? 'Click "Read Info" to pull iCloud identifiers' : 'No device selected'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 animate-fade-in">
                {FIELD_LABELS.map((field) => (
                  <div key={field.key} className="flex items-center justify-between bg-surface-2/40 rounded-lg px-3 py-2 border border-white/5">
                    <span className="text-[11px] text-white/50">{field.label}</span>
                    {infoResult[field.key] ? (
                      <span className="text-[11px] font-mono text-white/70 text-right break-all max-w-[60%]">
                        {infoResult[field.key]}
                      </span>
                    ) : RESTRICTED_FIELDS.has(field.key) ? (
                      <span className="text-[11px] font-mono text-neon-orange/80 text-right">
                        Not exposed over USB
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-white/25 text-right">N/A</span>
                    )}
                  </div>
                ))}
                <div className="bg-surface-2/40 rounded-xl p-3 border border-neon-orange/20 mt-2">
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    <span className="text-neon-orange">IMEI, ICCID, MEID and phone number are not exposed
                    over USB on iOS 17+</span> - Apple restricted these fields and only authorized
                    service providers with special entitlements can read them. This applies to every
                    tool, not just TechBench. You can find them on the phone itself:
                    <span className="text-white/70"> Settings &gt; General &gt; About</span>.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTool === 'signout' && (
          <div className="flex flex-col min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1">
            <h2 className="text-sm font-semibold text-white/80 mb-1">Legitimate iCloud Sign-Out</h2>
            <p className="text-[11px] text-white/40 mb-4">
              Removes the owner&apos;s Apple ID from the device using their own credentials. This is the only
              supported way to release a device from iCloud. The owner&apos;s Apple ID password and device passcode
              are required - no software can bypass this.
            </p>
            <div className="space-y-3">
              {SIGN_OUT_STEPS.map((step, i) => (
                <div key={step.title} className="bg-surface-2/40 rounded-xl p-4 border border-white/5 flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-neon-cyan/10 text-neon-cyan flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white/80 mb-1">{step.title}</div>
                    <div className="text-[11px] text-white/40 leading-relaxed">{step.body}</div>
                  </div>
                </div>
              ))}
              <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5">
                <div className="text-xs font-semibold text-white/80 mb-1">Lost the owner&apos;s credentials?</div>
                <div className="text-[11px] text-white/40 leading-relaxed">
                  The device must be unlocked through Apple Support with verified proof of purchase (invoice,
                  original packaging, or similar). Apple will not remove Activation Lock without it, and no
                  third-party tool can either - anyone claiming otherwise is running a scam.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
