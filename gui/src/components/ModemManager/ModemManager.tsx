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

  const poll = async () => {
    setModems(await tauri.fetchModems())
  }

  useEffect(() => {
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [])

  const selected = modems.find((m) => m.id === selectedId) || null

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
