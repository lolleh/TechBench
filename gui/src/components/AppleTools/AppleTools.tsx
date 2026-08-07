import { useEffect, useState } from 'react'
import { useDeviceStore } from '../../lib/deviceStore'
import { tauri } from '../../lib/tauri'

interface AppleToolsProps {
  onNavigate: (view: string) => void
}

export function AppleTools({ onNavigate }: AppleToolsProps) {
  const devices = useDeviceStore((s) => s.devices)
  const selectedDevice = devices.find((d) => d.status === 'connected') || null
  const serial = selectedDevice?.serial || null
  const deviceType = (selectedDevice?.deviceType || '').toLowerCase()

  // MDM / Remote Management
  const [mdmScanning, setMdmScanning] = useState(false)
  const [mdmEntries, setMdmEntries] = useState<Array<{ identifier: string; name: string; kind: string }>>([])
  const [mdmMsg, setMdmMsg] = useState<string | null>(null)
  const [mdmErr, setMdmErr] = useState<string | null>(null)
  const [mdmRemoving, setMdmRemoving] = useState<string | null>(null)

  // Stop iOS Update
  const [updateStatus, setUpdateStatus] = useState<'unknown' | 'blocked' | 'open'>('unknown')
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateMsg, setUpdateMsg] = useState<string | null>(null)
  const [updateErr, setUpdateErr] = useState<string | null>(null)
  const [delayDays, setDelayDays] = useState(90)

  // Virtual Location
  const [vlocActive, setVlocActive] = useState(false)
  const [vlocBusy, setVlocBusy] = useState(false)
  const [vlocMsg, setVlocMsg] = useState<string | null>(null)
  const [vlocErr, setVlocErr] = useState<string | null>(null)
  const [lat, setLat] = useState('40.690008')
  const [lng, setLng] = useState('-74.045843')

  const refreshUpdateStatus = async () => {
    if (!serial) return
    setUpdateBusy(true)
    try {
      const res = await tauri.stopUpdate('status', serial)
      if (res.success) {
        setUpdateStatus(res.blocked ? 'blocked' : 'open')
        setUpdateMsg(res.message)
        setUpdateErr(null)
      } else {
        setUpdateErr(res.error)
      }
    } finally {
      setUpdateBusy(false)
    }
  }

  const refreshVlocStatus = async () => {
    if (!serial) return
    try {
      const res = await tauri.virtualLocation('status', serial)
      setVlocActive(res.active)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshUpdateStatus()
    refreshVlocStatus()
  }, [serial]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBlockUpdates = async () => {
    if (!serial) return
    setUpdateBusy(true)
    setUpdateErr(null)
    setUpdateMsg(null)
    try {
      const res = await tauri.stopUpdate('block', serial, delayDays)
      if (res.success) {
        setUpdateStatus(res.blocked ? 'blocked' : 'open')
        setUpdateMsg(res.message)
      } else {
        setUpdateErr(res.error)
      }
    } finally {
      setUpdateBusy(false)
    }
  }

  const handleUnblockUpdates = async () => {
    if (!serial) return
    setUpdateBusy(true)
    setUpdateErr(null)
    setUpdateMsg(null)
    try {
      const res = await tauri.stopUpdate('unblock', serial)
      if (res.success) {
        setUpdateStatus('open')
        setUpdateMsg(res.message)
      } else {
        setUpdateErr(res.error)
      }
    } finally {
      setUpdateBusy(false)
    }
  }

  const handleSetLocation = async () => {
    if (!serial) return
    setVlocBusy(true)
    setVlocErr(null)
    setVlocMsg(null)
    try {
      const res = await tauri.virtualLocation('set', serial, parseFloat(lat), parseFloat(lng))
      if (res.success) {
        setVlocActive(res.active)
        setVlocMsg(res.message)
      } else {
        setVlocErr(res.error)
      }
    } finally {
      setVlocBusy(false)
    }
  }

  const handleClearLocation = async () => {
    if (!serial) return
    setVlocBusy(true)
    setVlocErr(null)
    setVlocMsg(null)
    try {
      const res = await tauri.virtualLocation('clear', serial)
      setVlocActive(false)
      setVlocMsg(res.message)
    } finally {
      setVlocBusy(false)
    }
  }

  const scanMdm = async () => {
    if (!serial) return
    setMdmScanning(true)
    setMdmErr(null)
    setMdmMsg(null)
    setMdmEntries([])
    try {
      const res = await tauri.mdmStatus(serial, deviceType)
      if (res.success) {
        setMdmEntries(res.entries)
        setMdmMsg(res.message)
      } else {
        setMdmErr(res.error)
      }
    } finally {
      setMdmScanning(false)
    }
  }

  const removeMdm = async (identifier: string) => {
    if (!serial) return
    setMdmRemoving(identifier)
    setMdmErr(null)
    setMdmMsg(null)
    try {
      const res = await tauri.mdmRemove(serial, deviceType, identifier)
      setMdmMsg(res.message)
      if (!res.success) setMdmErr(res.error)
      if (res.success && res.removed) {
        setMdmEntries((prev) => prev.filter((e) => e.identifier !== identifier))
      }
    } finally {
      setMdmRemoving(null)
    }
  }

  const updateBadge =
    updateStatus === 'blocked'
      ? 'bg-neon-orange/10 text-neon-orange border-neon-orange/30'
      : updateStatus === 'open'
        ? 'bg-neon-green/10 text-neon-green border-neon-green/30'
        : 'bg-white/5 text-white/30 border-white/10'

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Device */}
      <div className="w-80 glass rounded-2xl p-4 flex flex-col shrink-0 min-h-0 overflow-y-auto custom-scrollbar">
        <h2 className="text-sm font-semibold text-white/80 mb-4">VEE Tools</h2>

        {!selectedDevice ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">No device connected</p>
            <p className="text-xs text-white/20">Connect a phone to use these tools</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Target Device</div>
              <div className="text-sm font-medium text-white/80">{selectedDevice.productName}</div>
              <div className="text-[11px] font-mono text-white/40 mt-1 break-all">{selectedDevice.serial}</div>
            </div>
            <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
              <p className="text-[11px] text-white/50 leading-relaxed">
                VEE utilities. Remote Management (MDM) removal works on both iOS and Android.
                Stop iOS Update and Virtual Location are Apple-only and require the phone to be
                unlocked; Virtual Location also needs Developer Mode enabled and the Developer disk
                image mounted.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right - Tool Cards */}
      <div className="flex-1 glass rounded-2xl p-4 flex flex-col min-w-0 min-h-0 overflow-y-auto custom-scrollbar pr-1">
        <h2 className="text-sm font-semibold text-white/80 mb-4">Utilities</h2>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Stop iOS Update */}
          <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neon-orange/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-neon-orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-white/80">Stop iOS Update</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${updateBadge}`}>
                {updateStatus === 'blocked' ? 'Blocked' : updateStatus === 'open' ? 'Updates enabled' : 'Unknown'}
              </span>
            </div>
            <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
              Installs a Restrictions profile that delays over-the-air updates (up to 90 days).
              Removable anytime to re-enable updates.
            </p>

            <div className="flex items-center gap-2 mb-3">
              <label className="text-[11px] text-white/50">Delay</label>
              <select
                value={delayDays}
                onChange={(e) => setDelayDays(Number(e.target.value))}
                className="bg-surface-3/60 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/70 focus:outline-none focus:border-neon-orange/50"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
              <button
                onClick={handleBlockUpdates}
                disabled={!serial || updateBusy}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-neon-orange/10 text-neon-orange border border-neon-orange/30 hover:bg-neon-orange/20 transition-all disabled:opacity-40"
              >
                {updateBusy ? 'Working...' : 'Block Updates'}
              </button>
              <button
                onClick={handleUnblockUpdates}
                disabled={!serial || updateBusy}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-40"
              >
                Unblock
              </button>
            </div>

            {updateErr && <p className="text-[11px] text-red-400 mb-1">{updateErr}</p>}
            {updateMsg && <p className="text-[11px] text-white/40">{updateMsg}</p>}
          </div>

          {/* Virtual Location */}
          <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neon-blue/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-neon-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-white/80">Virtual Location</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${
                vlocActive ? 'bg-neon-green/10 text-neon-green border-neon-green/30'
                  : 'bg-white/5 text-white/30 border-white/10'
              }`}>
                {vlocActive ? 'Simulating' : 'Inactive'}
              </span>
            </div>
            <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
              Spoofs the GPS position through the DVT developer service (iOS 17+). Works while
              this session stays active.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">Latitude</label>
                <input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="e.g. 40.690008"
                  className="w-full bg-surface-3/60 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-mono text-white/70 focus:outline-none focus:border-neon-blue/50 placeholder:text-white/25"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">Longitude</label>
                <input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="e.g. -74.045843"
                  className="w-full bg-surface-3/60 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-mono text-white/70 focus:outline-none focus:border-neon-blue/50 placeholder:text-white/25"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSetLocation}
                disabled={!serial || vlocBusy}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20 transition-all disabled:opacity-40"
              >
                {vlocBusy ? 'Working...' : 'Set Location'}
              </button>
              <button
                onClick={handleClearLocation}
                disabled={!serial || vlocBusy}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-40"
              >
                Clear
              </button>
            </div>

            {vlocErr && <p className="text-[11px] text-red-400 mt-2">{vlocErr}</p>}
            {vlocMsg && <p className="text-[11px] text-white/40 mt-2">{vlocMsg}</p>}
          </div>

          {/* Real-time Screen */}
          <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-neon-pink/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 20.25h12m-13.5-3V6A2.25 2.25 0 016.75 3.75h10.5A2.25 2.25 0 0119.5 6v11.25m-13.5 0A2.25 2.25 0 008.25 20.25h7.5a2.25 2.25 0 002.25-2.25m-13.5 0h13.5" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white/80">Real-time Screen</span>
            </div>
            <p className="text-[11px] text-white/40 mb-4 leading-relaxed flex-1">
              Live screen preview of the connected phone with input injection. Uses the same
              screenshot pipeline as the Mirror page.
            </p>
            <button
              onClick={() => onNavigate('mirror')}
              disabled={!selectedDevice}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-neon-pink/10 text-pink-400 border border-pink-500/30 hover:bg-pink-500/20 transition-all disabled:opacity-40 self-start"
            >
              Open Mirror
            </button>
          </div>

          {/* Jailbreak */}
          <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M7.5 11.5v-2a4.5 4.5 0 119 0v2m-11.25 3h13.5a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-6a1.5 1.5 0 011.5-1.5z" />
                  <path d="M9.75 16a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5zm4.5 0a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white/80">Jailbreak</span>
            </div>
            <p className="text-[11px] text-white/40 mb-4 leading-relaxed flex-1">
              Compatibility check against known jailbreak tools for the connected device.
            </p>
            <button
              onClick={() => onNavigate('jailbreak')}
              disabled={!selectedDevice}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all disabled:opacity-40 self-start"
            >
              Open Jailbreak
            </button>
          </div>

          {/* MDM / Remote Management */}
          <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neon-yellow/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-white/80">Remote Management (MDM)</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${
                mdmEntries.length > 0 ? 'bg-neon-orange/10 text-neon-orange border-neon-orange/30'
                  : mdmMsg && !mdmErr ? 'bg-neon-green/10 text-neon-green border-neon-green/30'
                  : 'bg-white/5 text-white/30 border-white/10'
              }`}>
                {mdmEntries.length > 0 ? `${mdmEntries.length} detected` : mdmMsg && !mdmErr ? 'Clean' : 'Not scanned'}
              </span>
            </div>
            <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
              Detects and removes Remote Management (MDM) enrollment profiles on iOS and
              Android. Supervised iPhones may require the MDM removal passcode.
            </p>

            <button
              onClick={scanMdm}
              disabled={!serial || mdmScanning}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-neon-yellow/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 transition-all disabled:opacity-40 self-start mb-3"
            >
              {mdmScanning ? 'Scanning...' : 'Scan Device'}
            </button>

            {mdmEntries.length > 0 && (
              <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {mdmEntries.map((e) => (
                  <div key={e.identifier} className="flex items-center gap-2 bg-surface-3/40 rounded-lg px-2 py-1.5 border border-white/5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-mono text-white/70 truncate">{e.identifier}</div>
                      <div className="text-[10px] text-white/30">{e.kind}</div>
                    </div>
                    <button
                      onClick={() => removeMdm(e.identifier)}
                      disabled={mdmRemoving !== null}
                      className="text-[10px] px-2 py-1 rounded bg-neon-orange/10 text-neon-orange border border-neon-orange/30 hover:bg-neon-orange/20 transition-all disabled:opacity-40 shrink-0"
                    >
                      {mdmRemoving === e.identifier ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {mdmErr && <p className="text-[11px] text-red-400">{mdmErr}</p>}
            {mdmMsg && <p className="text-[11px] text-white/40">{mdmMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
