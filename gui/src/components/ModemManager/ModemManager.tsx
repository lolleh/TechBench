import { useEffect, useState } from 'react'
import { tauri } from '../../lib/tauri'
import type { Modem, ModemInfo } from '../../lib/types'

const AT_QUICK_COMMANDS = [
  'ATI',
  'AT+CGMI',
  'AT+CGMM',
  'AT+CGSN',
  'AT+ICCID',
  'AT+CSQ',
  'AT+COPS?',
  'AT+CREG?',
  'AT+CGDCONT?',
  'AT+CGACT?',
]

const TYPE_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  modem: { bg: 'bg-neon-cyan/10', text: 'text-neon-cyan', border: 'border-neon-cyan/20' },
  mifi: { bg: 'bg-neon-purple/10', text: 'text-neon-purple', border: 'border-neon-purple/20' },
}

interface UnlockVendor {
  id: string
  name: string
  notes: string
  query: string[]
  codeTypes: string[]
}
interface UnlockFacility {
  id: string
  label: string
  facility: string
}
interface UnlockStep {
  label: string
  command?: string
  ok: boolean
  output: string
}

const VENDOR_VIDS: Record<string, string> = {
  '12D1': 'huawei',
  '19D2': 'zte',
  '2C7C': 'quectel',
  '1E0E': 'simcom',
  '1BC7': 'telit',
  '2CB7': 'fibocom',
  '1546': 'ublox',
  '05C6': 'qualcomm',
  '1415': 'qualcomm',
}
const VENDOR_KEYWORDS = ['huawei', 'zte', 'quectel', 'simcom', 'telit', 'fibocom', 'ublox', 'qualcomm']

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-[11px] text-white/40">{label}</span>
      <span className={`text-[11px] text-white/75 text-right ${mono ? 'font-mono' : ''}`}>
        {value || 'N/A'}
      </span>
    </div>
  )
}

export function ModemManager() {
  const [modems, setModems] = useState<Modem[]>([])
  const [detailed, setDetailed] = useState<ModemInfo[]>([])
  const [detailError, setDetailError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [command, setCommand] = useState('ATI')
  const [atOutput, setAtOutput] = useState('')
  const [atBusy, setAtBusy] = useState(false)
  const [atError, setAtError] = useState<string | null>(null)

  const [unlockCatalog, setUnlockCatalog] = useState<{ vendors: UnlockVendor[]; facilities: UnlockFacility[] }>({ vendors: [], facilities: [] })
  const [unlockVendor, setUnlockVendor] = useState('generic')
  const [unlockCodeType, setUnlockCodeType] = useState('nck')
  const [unlockCode, setUnlockCode] = useState('')
  const [unlockBusy, setUnlockBusy] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlockResult, setUnlockResult] = useState<{ message: string; unlocked: boolean | null; steps: UnlockStep[] } | null>(null)

  const [ztePassword, setZtePassword] = useState('admin')
  const [zteGateway, setZteGateway] = useState('')
  const [zteImei, setZteImei] = useState('')
  const [zteCode, setZteCode] = useState('')
  const [zteBusy, setZteBusy] = useState(false)
  const [zteError, setZteError] = useState<string | null>(null)
  const [zteResult, setZteResult] = useState<{ message: string; unlocked: boolean | null; imei: string; nckAttempts: string; base: string; steps: UnlockStep[]; warning: string; compatBlocked: boolean } | null>(null)
  const [zteRebootBusy, setZteRebootBusy] = useState(false)
  const [zteRebootResult, setZteRebootResult] = useState<{ message: string; counterBefore: string; counterAfter: string; counterReset: boolean; steps: UnlockStep[] } | null>(null)

  const poll = async () => {
    setModems(await tauri.fetchModems())
  }

  const loadUnlockCatalog = async () => {
    const catalog = await tauri.modemUnlockCatalog()
    setUnlockCatalog(catalog)
  }

  useEffect(() => {
    poll()
    loadUnlockCatalog()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [])

  const selected = modems.find((m) => m.id === selectedId) || null

  const detectVendor = (modem: Modem | null): string => {
    if (!modem) return 'generic'
    const vid = (modem.vendorId || '').toUpperCase()
    if (VENDOR_VIDS[vid]) return VENDOR_VIDS[vid]
    const text = `${modem.vendorName || ''} ${modem.productName || ''}`.toLowerCase()
    for (const keyword of VENDOR_KEYWORDS) {
      if (text.includes(keyword)) return keyword
    }
    return 'generic'
  }

  useEffect(() => {
    setUnlockVendor(detectVendor(selected))
    setUnlockResult(null)
    setUnlockError(null)
    if (selected) {
      const vid = (selected.vendorId || '').toUpperCase()
      if (vid === '19D2') {
        setZteGateway(zteGateway || '192.168.0.1')
      }
    }
  }, [selectedId])

  const runZteWebUnlock = async () => {
    setZteBusy(true)
    setZteError(null)
    setZteResult(null)
    try {
      const result = await tauri.zteWebUnlock({
        gateway: zteGateway.trim() || undefined,
        password: ztePassword,
        imei: zteImei.trim() || undefined,
        code: zteCode.trim() || undefined,
      })
      if (result.success || result.steps.length > 0) {
        setZteResult({
          message: result.message || (result.error || ''),
          unlocked: result.unlocked,
          imei: result.imei,
          nckAttempts: result.nckAttempts,
          base: result.base,
          steps: result.steps,
          warning: result.warning || '',
          compatBlocked: result.compatBlocked || false,
        })
        if (result.imei) setZteImei(result.imei)
      } else {
        setZteError(result.error || result.message || 'ZTE web unlock failed')
      }
    } catch (err) {
      setZteError(`ZTE web unlock error: ${err}`)
    } finally {
      setZteBusy(false)
    }
  }

  const runZteWebReboot = async () => {
    setZteRebootBusy(true)
    setZteRebootResult(null)
    setZteError(null)
    try {
      const result = await tauri.zteWebReboot({
        gateway: zteGateway.trim() || undefined,
      })
      if (result.success || result.steps.length > 0) {
        setZteRebootResult({
          message: result.message || (result.error || ''),
          counterBefore: result.counterBefore,
          counterAfter: result.counterAfter,
          counterReset: result.counterReset,
          steps: result.steps,
        })
        if (result.counterAfter) setZteResult((prev) => prev ? { ...prev, nckAttempts: result.counterAfter } : prev)
      } else {
        setZteError(result.error || result.message || 'ZTE reboot failed')
      }
    } catch (err) {
      setZteError(`ZTE reboot error: ${err}`)
    } finally {
      setZteRebootBusy(false)
    }
  }

  const handleReadDetails = async () => {
    setRefreshing(true)
    setDetailError(null)
    try {
      const result = await tauri.readModemInfo()
      setDetailed(result.modems)
      if (!result.available) {
        setDetailError(result.message || 'ModemManager is not available')
      }
    } catch (err) {
      setDetailError(`Failed to read modem details: ${err}`)
    } finally {
      setRefreshing(false)
    }
  }

  const detailedInfo = selected
    ? detailed.find((d) => selected.index !== undefined && d.index === selected.index)
    : undefined

  const handleSendAt = async () => {
    if (!selected) return
    if (!command.trim()) return
    setAtBusy(true)
    setAtError(null)
    try {
      const result = await tauri.sendModemAt(
        selected.port || '',
        selected.index ?? null,
        command.trim(),
      )
      if (result.success) {
        setAtOutput((prev) => `> ${command.trim()}\n${result.response}\n\n${prev}`)
      } else {
        setAtError(result.message || 'AT command failed')
      }
    } catch (err) {
      setAtError(`AT command error: ${err}`)
    } finally {
      setAtBusy(false)
    }
  }

  const runUnlock = async (action: 'status' | 'unlock') => {
    if (!selected) return
    setUnlockBusy(true)
    setUnlockError(null)
    setUnlockResult(null)
    try {
      const result = await tauri.modemUnlock(action, selected, unlockVendor, unlockCodeType, unlockCode.trim())
      if (result.success) {
        setUnlockResult({ message: result.message, unlocked: result.unlocked, steps: result.steps })
        if (result.vendor) setUnlockVendor(result.vendor)
      } else {
        setUnlockError(result.error || result.message || (action === 'unlock' ? 'Unlock failed' : 'Status check failed'))
      }
    } catch (err) {
      setUnlockError(`${action === 'unlock' ? 'Unlock' : 'Status check'} error: ${err}`)
    } finally {
      setUnlockBusy(false)
    }
  }

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Modem list */}
      <div className="w-96 glass rounded-2xl p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-white/80">Modems & MiFi</h2>
            <p className="text-[10px] text-white/30">USB dongles · hotspots · cellular modems</p>
          </div>
          <button
            onClick={() => poll()}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-all"
          >
            Refresh
          </button>
        </div>

        {modems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.592-5.588 14.56-5.588 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">No modems detected</p>
            <p className="text-xs text-white/20">Plug in a USB modem or MiFi hotspot</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto custom-scrollbar">
            {modems.map((modem) => {
              const badge = TYPE_BADGES[modem.deviceType] ?? TYPE_BADGES.modem
              const isActive = modem.id === selectedId
              return (
                <button
                  key={modem.id}
                  onClick={() => setSelectedId(modem.id)}
                  className={`
                    w-full rounded-xl p-3 text-left border transition-all
                    ${isActive
                      ? 'bg-surface-3/60 border-neon-cyan/30'
                      : 'bg-surface-2/40 border-white/5 hover:border-white/10'}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-white/80 truncate">{modem.productName}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${badge.bg} ${badge.text} border ${badge.border} uppercase tracking-wider`}>
                      {modem.deviceType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono">
                    <span>{modem.interface}</span>
                    {modem.signalQuality !== undefined && modem.signalQuality !== null && (
                      <span className={modem.deviceType === 'mifi' ? 'text-neon-purple' : 'text-neon-cyan'}>
                        📶 {modem.signalQuality}%
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-white/30 mt-1 font-mono truncate">
                    {modem.serial || modem.imei || modem.host || modem.port || ''}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Right - Detail / AT console */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {!selected ? (
          <div className="flex-1 glass rounded-2xl flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/30 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.592-5.588 14.56-5.588 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">Select a modem to inspect</p>
            <p className="text-xs text-white/20">Read IMEI, ICCID, operator, signal and run AT commands</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 shrink-0">
            {/* Detail card */}
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-white/80">{selected.productName}</h3>
                  <p className="text-[10px] text-white/30 font-mono">
                    {selected.vendorName} · {selected.chipset || 'chipset unknown'}
                    {selected.host ? ` · ${selected.adminUrl}` : ''}
                  </p>
                </div>
                {selected.index !== undefined && (
                  <button
                    onClick={handleReadDetails}
                    disabled={refreshing}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-neon-green/10 text-neon-green border border-neon-green/30 hover:bg-neon-green/20 transition-all disabled:opacity-40"
                  >
                    {refreshing ? 'Reading...' : 'Read Details'}
                  </button>
                )}
              </div>

              {detailError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mb-2">
                  <p className="text-[11px] text-red-400">{detailError}</p>
                </div>
              )}

              {selected.index !== undefined && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-2">
                  <Field label="IMEI" value={selected.imei || ''} mono />
                  <Field label="ICCID" value={selected.iccid || ''} mono />
                  <Field label="Operator" value={selected.operator || ''} />
                  <Field label="Signal" value={selected.signalQuality !== undefined && selected.signalQuality !== null ? `${selected.signalQuality}%` : ''} />
                  <Field label="Access Tech" value={selected.accessTechnology || ''} />
                  <Field label="Registration" value={selected.registration || ''} />
                  <Field label="Firmware" value={selected.firmware || ''} />
                  <Field label="Lock State" value={selected.lockState || ''} />
                  <Field label="APN" value={selected.apn || ''} />
                  <Field label="IP Address" value={selected.ipAddress || ''} mono />
                  {selected.ports && <Field label="Ports" value={selected.ports.join(', ')} mono />}
                </div>
              )}

              {detailedInfo && Object.keys(detailedInfo.info).length > 0 && (
                <div className="mt-3 border-t border-white/5 pt-2">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                    ModemManager Details
                  </div>
                  <div className="max-h-44 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-x-6">
                    {Object.entries(detailedInfo.info).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                        <span className="text-[10px] text-white/40 truncate">{k}</span>
                        <span className="text-[10px] text-white/70 text-right font-mono">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.index === undefined && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-2">
                  <Field label="IMEI" value={selected.imei || ''} mono />
                  <Field label="ICCID" value={selected.iccid || ''} mono />
                  <Field label="Serial" value={selected.serial || ''} mono />
                  <Field label="Port" value={selected.port || ''} mono />
                  <Field label="Interface" value={selected.interface || ''} />
                  <Field label="Signal" value={selected.signalQuality !== undefined && selected.signalQuality !== null ? `${selected.signalQuality}%` : ''} />
                </div>
              )}
            </div>

            {/* Unlock tools card */}
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white/80">Unlock Tools</h3>
                <span className="text-[10px] text-white/30">Carrier / network lock</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-white/40 w-16 shrink-0">Vendor</label>
                  <select
                    value={unlockVendor}
                    onChange={(e) => { setUnlockVendor(e.target.value); setUnlockResult(null); setUnlockError(null) }}
                    className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/75 focus:outline-none focus:border-neon-cyan/40"
                  >
                    {unlockCatalog.vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-white/40 w-16 shrink-0">Code type</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {unlockCatalog.facilities.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setUnlockCodeType(f.id)}
                        className={`text-[10px] px-2 py-1 rounded border transition-all ${
                          unlockCodeType === f.id
                            ? 'bg-neon-purple/15 text-neon-purple border-neon-purple/40'
                            : 'bg-surface-2/40 text-white/40 border-white/5 hover:border-white/10'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-white/40 w-16 shrink-0">Code</label>
                  <input
                    value={unlockCode}
                    onChange={(e) => setUnlockCode(e.target.value)}
                    placeholder="8-digit code from carrier"
                    spellCheck={false}
                    className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-white/80 focus:outline-none focus:border-neon-purple/40"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => runUnlock('status')}
                    disabled={unlockBusy}
                    className="flex-1 text-xs px-3 py-2 rounded-lg bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-all disabled:opacity-40"
                  >
                    {unlockBusy ? 'Working...' : 'Check Lock Status'}
                  </button>
                  <button
                    onClick={() => runUnlock('unlock')}
                    disabled={unlockBusy || !unlockCode.trim()}
                    className="flex-1 text-xs px-3 py-2 rounded-lg bg-neon-purple/15 text-neon-purple border border-neon-purple/40 hover:bg-neon-purple/25 transition-all disabled:opacity-40"
                  >
                    {unlockBusy ? 'Working...' : 'Submit Unlock Code'}
                  </button>
                </div>

                {unlockError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                    <p className="text-[11px] text-red-400">{unlockError}</p>
                  </div>
                )}

                {unlockResult && (
                  <div className="bg-black/40 border border-white/5 rounded-lg p-2.5 max-h-52 overflow-y-auto custom-scrollbar">
                    <p className={`text-[11px] mb-1.5 ${unlockResult.unlocked === true ? 'text-neon-green' : unlockResult.unlocked === false ? 'text-amber-400' : 'text-white/50'}`}>
                      {unlockResult.message}
                    </p>
                    {unlockResult.steps.map((step, i) => (
                      <div key={i} className="mb-1.5 last:mb-0">
                        <div className="flex items-center gap-2">
                          <span className={step.ok ? 'text-neon-green' : 'text-red-400'}>
                            {step.ok ? '✓' : '✗'}
                          </span>
                          <span className="text-[11px] text-white/70">{step.label}</span>
                        </div>
                        <div className="text-[10px] text-white/30 font-mono pl-5">{step.command}</div>
                        {step.output && (
                          <div className="text-[10px] text-white/40 font-mono pl-5 whitespace-pre-wrap">{step.output}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ZTE web (HiLink) unlock card */}
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white/80">ZTE Web Unlock</h3>
                <span className="text-[10px] text-white/30">HiLink / no AT port</span>
              </div>
              <p className="text-[10px] text-white/30 mb-3">
                For ZX297520V3 MiFi (MF927U/TU, H220m…) that expose no AT port. Logs into the
                device web UI (goform API) and submits the NCK. Leave the code blank to compute
                it from the IMEI automatically.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-white/40 w-16 shrink-0">Gateway</label>
                  <input
                    value={zteGateway}
                    onChange={(e) => { setZteGateway(e.target.value); setZteResult(null); setZteError(null) }}
                    placeholder="192.168.0.1 (auto-detect)"
                    spellCheck={false}
                    className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-mono text-white/75 focus:outline-none focus:border-neon-cyan/40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-white/40 w-16 shrink-0">Password</label>
                  <input
                    type="password"
                    value={ztePassword}
                    onChange={(e) => setZtePassword(e.target.value)}
                    placeholder="admin"
                    spellCheck={false}
                    className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white/75 focus:outline-none focus:border-neon-cyan/40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-white/40 w-16 shrink-0">IMEI</label>
                  <input
                    value={zteImei}
                    onChange={(e) => setZteImei(e.target.value)}
                    placeholder="auto-read from device"
                    spellCheck={false}
                    className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-mono text-white/75 focus:outline-none focus:border-neon-cyan/40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-white/40 w-16 shrink-0">Code</label>
                  <input
                    value={zteCode}
                    onChange={(e) => setZteCode(e.target.value)}
                    placeholder="leave blank to compute from IMEI"
                    spellCheck={false}
                    className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] font-mono text-white/75 focus:outline-none focus:border-neon-cyan/40"
                  />
                </div>

                <button
                  onClick={runZteWebUnlock}
                  disabled={zteBusy}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-neon-purple/15 text-neon-purple border border-neon-purple/40 hover:bg-neon-purple/25 transition-all disabled:opacity-40"
                >
                  {zteBusy ? 'Working (may take ~10s)...' : 'Read Status & Unlock'}
                </button>

                <button
                  onClick={runZteWebReboot}
                  disabled={zteRebootBusy}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/30 hover:bg-neon-yellow/20 transition-all disabled:opacity-40"
                >
                  {zteRebootBusy ? 'Rebooting (may take ~90s)...' : 'Reboot & Restore NCK Counter'}
                </button>

                {zteError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                    <p className="text-[11px] text-red-400">{zteError}</p>
                  </div>
                )}

                {zteResult && (
                  <div className="bg-black/40 border border-white/5 rounded-lg p-2.5 max-h-52 overflow-y-auto custom-scrollbar">
                    {zteResult.compatBlocked ? (
                      <p className="text-[11px] text-red-400 mb-1.5">{zteResult.message}</p>
                    ) : (
                      <p className={`text-[11px] mb-1.5 ${zteResult.unlocked === true ? 'text-neon-green' : zteResult.unlocked === false ? 'text-amber-400' : 'text-white/50'}`}>
                        {zteResult.message}
                      </p>
                    )}
                    {zteResult.warning && (
                      <p className="text-[11px] text-amber-400 mb-1.5">{zteResult.warning}</p>
                    )}
                    {(zteResult.imei || zteResult.nckAttempts) && (
                      <div className="text-[10px] font-mono text-white/40 mb-1.5">
                        {zteResult.imei && `IMEI: ${zteResult.imei}  `}
                        {zteResult.nckAttempts && `NCK attempts left: ${zteResult.nckAttempts}`}
                      </div>
                    )}
                    {zteResult.steps.map((step, i) => (
                      <div key={i} className="mb-1.5 last:mb-0">
                        <div className="flex items-center gap-2">
                          <span className={step.ok ? 'text-neon-green' : 'text-red-400'}>
                            {step.ok ? '✓' : '✗'}
                          </span>
                          <span className="text-[11px] text-white/70">{step.label}</span>
                        </div>
                        {step.output && (
                          <div className="text-[10px] text-white/40 font-mono pl-5 whitespace-pre-wrap">{step.output}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {zteRebootResult && (
                  <div className="bg-black/40 border border-white/5 rounded-lg p-2.5 max-h-52 overflow-y-auto custom-scrollbar">
                    <p className={`text-[11px] mb-1.5 ${zteRebootResult.counterReset ? 'text-neon-green' : 'text-amber-400'}`}>
                      {zteRebootResult.message}
                    </p>
                    {(zteRebootResult.counterBefore || zteRebootResult.counterAfter) && (
                      <div className="text-[10px] font-mono text-white/40 mb-1.5">
                        {zteRebootResult.counterBefore && `NCK attempts before: ${zteRebootResult.counterBefore}  `}
                        {zteRebootResult.counterAfter && `after: ${zteRebootResult.counterAfter}`}
                      </div>
                    )}
                    {zteRebootResult.steps.map((step, i) => (
                      <div key={i} className="mb-1.5 last:mb-0">
                        <div className="flex items-center gap-2">
                          <span className={step.ok ? 'text-neon-green' : 'text-red-400'}>
                            {step.ok ? '✓' : '✗'}
                          </span>
                          <span className="text-[11px] text-white/70">{step.label}</span>
                        </div>
                        {step.output && (
                          <div className="text-[10px] text-white/40 font-mono pl-5 whitespace-pre-wrap">{step.output}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </div>

            {/* AT console */}
            <div className="glass rounded-2xl p-4 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white/80">AT Console</h3>
                <span className="text-[10px] text-white/30 font-mono">
                  {selected.index !== undefined ? `mmcli -m ${selected.index}` : selected.port || 'no port'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendAt() }}
                  spellCheck={false}
                  placeholder="Enter AT command e.g. ATI"
                  className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white/80 focus:outline-none focus:border-neon-cyan/40"
                />
                <button
                  onClick={handleSendAt}
                  disabled={atBusy || !command.trim()}
                  className="text-xs px-4 py-2 rounded-lg bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-all disabled:opacity-40"
                >
                  {atBusy ? 'Sending...' : 'Send'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {AT_QUICK_COMMANDS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCommand(c)}
                    className={`text-[10px] px-2 py-0.5 rounded border font-mono transition-all ${
                      command === c
                        ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                        : 'bg-surface-2/40 text-white/40 border-white/5 hover:border-white/10'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {atError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-2">
                  <p className="text-[11px] text-red-400">{atError}</p>
                </div>
              )}

              <div className="flex-1 mt-2 bg-black/40 border border-white/5 rounded-lg p-3 overflow-y-auto custom-scrollbar min-h-0">
                <pre className="text-[11px] font-mono text-neon-green/80 whitespace-pre-wrap">
                  {atOutput || 'AT output will appear here...'}
                </pre>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
