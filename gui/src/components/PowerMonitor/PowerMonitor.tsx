import { useState, useEffect, useRef } from 'react'
import { tauri } from '../../lib/tauri'
import { useDeviceStore } from '../../lib/deviceStore'
import type { PowerReading, BootSignature } from '../../lib/types'

const KNOWN_SIGNATURES: BootSignature[] = [
  { name: 'Normal Boot', pattern: '0.3A -> 0.8A -> 1.2A -> 0.4A', status: 'healthy', diagnosis: 'Device booting normally', suggestion: 'No action required', avgCurrent: 0.7, variance: 0.02 },
  { name: 'PMIC Failure', pattern: '0.8A -> 0.2A (drops after 2s)', status: 'fault', diagnosis: 'Primary PMIC not maintaining voltage', suggestion: 'Check PM8550 output rails, reball if needed', avgCurrent: 0.5, variance: 0.08 },
  { name: 'Short Circuit', pattern: '2.5A -> PSU current limit', status: 'fault', diagnosis: 'Dead short on main power rail', suggestion: 'Thermal scan to locate short, check capacitors', avgCurrent: 2.5, variance: 0.01 },
  { name: 'Boot Loop', pattern: '0.3A -> 1.2A -> 0.3A -> 1.2A (repeat)', status: 'fault', diagnosis: 'Device failing early boot', suggestion: 'Try EDL/Recovery mode flash', avgCurrent: 0.75, variance: 0.15 },
  { name: 'No Power', pattern: '0.0A (no current draw)', status: 'fault', diagnosis: 'No power reaching device', suggestion: 'Check battery connector, charging IC, fuse', avgCurrent: 0.0, variance: 0.0 },
]

export function PowerMonitor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [readings, setReadings] = useState<PowerReading[]>([])
  const [psuVoltage, setPsuVoltage] = useState(4.2)
  const [maxCurrent, setMaxCurrent] = useState(2.0)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [matchedSignature, setMatchedSignature] = useState<BootSignature | null>(null)
  const [totalEnergy, setTotalEnergy] = useState(0)
  const updateBenchStatus = useDeviceStore((s) => s.updateBenchStatus)

  useEffect(() => {
    if (isMonitoring) {
      monitorRef.current = setInterval(async () => {
        await tauri.invoke('psu_set_voltage', { voltage: psuVoltage })
        await tauri.invoke('psu_set_current_limit', { current: maxCurrent })
        const reading = (await tauri.invoke('psu_read')) as PowerReading
        setReadings((prev) => [...prev.slice(-300), reading])
        setTotalEnergy((prev) => prev + reading.power / 1000 / 20)
        updateBenchStatus({ psuVoltage: reading.voltage, psuCurrent: reading.current })
      }, 50)
    } else {
      if (monitorRef.current) clearInterval(monitorRef.current)
      monitorRef.current = null
      updateBenchStatus({ psuVoltage: null, psuCurrent: null })
    }
    return () => { if (monitorRef.current) clearInterval(monitorRef.current) }
  }, [isMonitoring, psuVoltage, maxCurrent, updateBenchStatus])

  useEffect(() => {
    drawChart()
  }, [readings])

  const drawChart = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
    bgGrad.addColorStop(0, '#080c14')
    bgGrad.addColorStop(1, '#0a0e17')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, w, h)

    // Grid
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.04)'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }

    if (readings.length < 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.font = '13px "Inter", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Turn on PSU to start monitoring', w / 2, h / 2)
      ctx.textAlign = 'left'
      return
    }

    const drawLine = (color: string, glowColor: string, getValue: (r: PowerReading) => number, maxVal: number) => {
      // Glow
      ctx.strokeStyle = glowColor
      ctx.lineWidth = 6
      ctx.beginPath()
      readings.forEach((r, i) => {
        const x = (i / readings.length) * w
        const y = h - (getValue(r) / maxVal) * h * 0.9 - h * 0.05
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      })
      ctx.stroke()

      // Main
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      readings.forEach((r, i) => {
        const x = (i / readings.length) * w
        const y = h - (getValue(r) / maxVal) * h * 0.9 - h * 0.05
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }

    drawLine('#39ff14', '#39ff1420', (r) => r.current, maxCurrent)
    drawLine('#00d4ff', '#00d4ff20', (r) => r.voltage, 5)
    drawLine('#ffe600', '#ffe60020', (r) => r.power, maxCurrent * 5)

    // Legend
    ctx.font = '10px "JetBrains Mono", monospace'
    const legends = [
      { label: 'Current', color: '#39ff14', x: 12 },
      { label: 'Voltage', color: '#00d4ff', x: 90 },
      { label: 'Power', color: '#ffe600', x: 168 },
    ]
    legends.forEach((l) => {
      ctx.fillStyle = l.color
      ctx.beginPath()
      ctx.arc(l.x, 16, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = l.color + 'aa'
      ctx.fillText(l.label, l.x + 8, 20)
    })
  }

  const analyzeSignature = () => {
    const avgCurrent = readings.length > 0
      ? readings.reduce((s, r) => s + r.current, 0) / readings.length
      : 0

    if (avgCurrent < 0.05) setMatchedSignature(KNOWN_SIGNATURES[4])
    else if (avgCurrent > 2.0) setMatchedSignature(KNOWN_SIGNATURES[2])
    else if (readings.length > 100) {
      const recent = readings.slice(-100).map((r) => r.current)
      const mean = recent.reduce((a, b) => a + b, 0) / recent.length
      const variance = recent.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / recent.length
      setMatchedSignature(variance > 0.1 ? KNOWN_SIGNATURES[3] : KNOWN_SIGNATURES[0])
    } else {
      setMatchedSignature(null)
    }
  }

  const togglePSU = async () => {
    const next = !isMonitoring
    await tauri.invoke('psu_toggle', { enabled: next })
    setIsMonitoring(next)
  }

  const currentReading = readings.length > 0 ? readings[readings.length - 1] : null

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Toolbar */}
      <div className="glass rounded-xl p-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-white/30 uppercase tracking-wider">Voltage</label>
          <input
            type="number" value={psuVoltage}
            onChange={(e) => setPsuVoltage(parseFloat(e.target.value))}
            step="0.1" min="0" max="20"
            className="input-cyber w-16 text-xs py-1"
          />
          <span className="text-[10px] text-white/30">V</span>
        </div>

        <div className="w-px h-6 bg-white/10" />

        <div className="flex items-center gap-2">
          <label className="text-[10px] text-white/30 uppercase tracking-wider">I-Limit</label>
          <input
            type="number" value={maxCurrent}
            onChange={(e) => setMaxCurrent(parseFloat(e.target.value))}
            step="0.1" min="0" max="5"
            className="input-cyber w-16 text-xs py-1"
          />
          <span className="text-[10px] text-white/30">A</span>
        </div>

        <div className="flex-1" />

        <button onClick={togglePSU} className={isMonitoring ? 'btn-neon-red' : 'btn-neon-green'}>
          {isMonitoring ? '⏹ OFF' : '▶ ON'}
        </button>

        <button onClick={analyzeSignature} className="btn-cyber">
          Analyze
        </button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Canvas */}
        <div className="flex-1 canvas-container">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* Sidebar */}
        <div className="w-80 glass rounded-xl p-4 overflow-auto custom-scrollbar flex flex-col gap-5 shrink-0">
          {/* Real-time Values */}
          <div>
            <h3 className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">Live Readings</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Voltage', value: currentReading?.voltage.toFixed(3), unit: 'V', color: 'text-neon-blue' },
                { label: 'Current', value: currentReading?.current.toFixed(3), unit: 'A', color: 'text-neon-green' },
                { label: 'Power', value: currentReading?.power.toFixed(3), unit: 'W', color: 'text-neon-yellow' },
                { label: 'Energy', value: totalEnergy.toFixed(3), unit: 'Wh', color: 'text-neon-purple' },
              ].map((item) => (
                <div key={item.label} className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                  <div className="text-[9px] text-white/25 uppercase tracking-wider">{item.label}</div>
                  <div className={`text-lg font-mono font-bold ${item.color} mt-0.5`}>
                    {item.value ?? '--'}
                    <span className="text-[10px] font-normal text-white/30 ml-1">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signature Analysis */}
          <div>
            <h3 className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">Analysis</h3>
            {matchedSignature ? (
              <div className={`rounded-xl p-3 border ${
                matchedSignature.status === 'healthy'
                  ? 'bg-neon-green/5 border-neon-green/20'
                  : 'bg-neon-red/5 border-neon-red/20'
              }`}>
                <div className={`font-semibold text-sm ${
                  matchedSignature.status === 'healthy' ? 'text-neon-green' : 'text-neon-red'
                }`}>
                  {matchedSignature.name}
                </div>
                <div className="text-xs text-white/50 mt-1">{matchedSignature.diagnosis}</div>
                <div className="text-[10px] text-white/30 mt-2">
                  <span className="text-white/40">Fix:</span> {matchedSignature.suggestion}
                </div>
              </div>
            ) : (
              <div className="bg-surface-2/30 rounded-xl p-3 border border-white/5 text-xs text-white/30">
                Click "Analyze" to match against known boot signatures
              </div>
            )}
          </div>

          {/* Known Signatures */}
          <div className="flex-1">
            <h3 className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">Known Patterns</h3>
            <div className="space-y-1.5">
              {KNOWN_SIGNATURES.map((sig, i) => (
                <button
                  key={i}
                  onClick={() => setMatchedSignature(sig)}
                  className="w-full text-left bg-surface-2/30 rounded-lg p-2 hover:bg-surface-3/40 border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className={`status-dot ${sig.status === 'healthy' ? 'status-connected' : 'status-error'}`} />
                    <span className="text-xs font-medium text-white/70">{sig.name}</span>
                  </div>
                  <div className="text-[10px] text-white/25 font-mono mt-1 ml-4">{sig.pattern}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
