import { useState, useEffect, useRef, useCallback } from 'react'
import { tauri, mockSignalData } from '../../lib/tauri'
import type { SignalChannel, ProtocolDecoder } from '../../lib/types'

const PROTOCOL_DECODERS: ProtocolDecoder[] = [
  { id: 'i2c', name: 'I2C', description: 'Inter-Integrated Circuit', enabled: false },
  { id: 'spi', name: 'SPI', description: 'Serial Peripheral Interface', enabled: false },
  { id: 'uart', name: 'UART', description: 'Universal Async Receiver/Transmitter', enabled: false },
  { id: 'usb-pd', name: 'USB-PD', description: 'USB Power Delivery', enabled: false },
  { id: 'jtag', name: 'JTAG', description: 'Joint Test Action Group', enabled: false },
  { id: 'swd', name: 'SWD', description: 'Serial Wire Debug', enabled: false },
]

const SAMPLE_RATES: Record<string, number> = {
  '100kHz': 100000, '250kHz': 250000, '500kHz': 500000,
  '1MHz': 1000000, '2MHz': 2000000, '4MHz': 4000000,
  '8MHz': 8000000, '16MHz': 16000000, '24MHz': 24000000,
}

export function SignalAnalyzer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const captureRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [channels, setChannels] = useState<SignalChannel[]>([
    { id: 'd0', name: 'D0', color: '#39ff14', enabled: true, voltage: [] },
    { id: 'd1', name: 'D1', color: '#ff003c', enabled: true, voltage: [] },
    { id: 'd2', name: 'D2', color: '#00d4ff', enabled: false, voltage: [] },
    { id: 'd3', name: 'D3', color: '#ffe600', enabled: false, voltage: [] },
  ])
  const [decoders, setDecoders] = useState(PROTOCOL_DECODERS)
  const [sampleRate, setSampleRate] = useState('1MHz')
  const [isCapturing, setIsCapturing] = useState(false)
  const [triggerLevel, setTriggerLevel] = useState(1.65)
  const [measurements, setMeasurements] = useState({
    frequency: '-- Hz',
    period: '-- us',
    vpp: '-- V',
    dutyCycle: '-- %',
  })

  const drawWaveform = useCallback(
    (signalData: number[][]) => {
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

      // Background with subtle gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
      bgGrad.addColorStop(0, '#080c14')
      bgGrad.addColorStop(1, '#0a0e17')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, w, h)

      // Grid
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.04)'
      ctx.lineWidth = 1
      for (let x = 60; x < w; x += 50) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath()
        ctx.moveTo(60, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      // Center line
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.08)'
      ctx.beginPath()
      ctx.moveTo(60, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()

      const enabledChannels = channels.filter((c) => c.enabled)
      if (enabledChannels.length === 0) return

      const channelHeight = h / enabledChannels.length

      enabledChannels.forEach((channel, index) => {
        const chIdx = channels.indexOf(channel)
        const data = signalData[chIdx] ?? []
        const yOffset = index * channelHeight + channelHeight / 2

        // Channel separator
        if (index > 0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(60, index * channelHeight)
          ctx.lineTo(w, index * channelHeight)
          ctx.stroke()
        }

        // Channel label with background
        const labelWidth = 36
        ctx.fillStyle = 'rgba(10, 14, 23, 0.9)'
        ctx.fillRect(0, yOffset - 10, labelWidth, 20)
        ctx.fillStyle = channel.color
        ctx.font = '600 11px "JetBrains Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(channel.name, labelWidth / 2, yOffset + 4)
        ctx.textAlign = 'left'

        if (data.length === 0) return

        // Draw waveform with glow
        const sampleCount = Math.min(data.length, w - 70)

        // Glow effect
        ctx.strokeStyle = channel.color + '30'
        ctx.lineWidth = 6
        ctx.beginPath()
        for (let i = 0; i < sampleCount; i++) {
          const x = 70 + i
          const normalized = (data[i] + 3) / 6
          const y = yOffset - (normalized - 0.5) * channelHeight * 0.7
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()

        // Main line
        ctx.strokeStyle = channel.color
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < sampleCount; i++) {
          const x = 70 + i
          const normalized = (data[i] + 3) / 6
          const y = yOffset - (normalized - 0.5) * channelHeight * 0.7
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      })

      // Trigger line
      if (isCapturing) {
        const triggerY = h - 30
        ctx.strokeStyle = 'rgba(255, 230, 0, 0.3)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(60, triggerY)
        ctx.lineTo(w, triggerY)
        ctx.stroke()
        ctx.setLineDash([])

        ctx.fillStyle = 'rgba(255, 230, 0, 0.6)'
        ctx.font = '10px "JetBrains Mono", monospace'
        ctx.fillText(`T: ${triggerLevel}V`, w - 60, triggerY - 5)
      }
    },
    [channels, isCapturing, triggerLevel]
  )

  useEffect(() => {
    drawWaveform([])
  }, [drawWaveform])

  useEffect(() => {
    if (isCapturing) {
      const rate = SAMPLE_RATES[sampleRate] ?? 1000000
      captureRef.current = setInterval(() => {
        const enabledNames = channels.filter((c) => c.enabled).map((c) => c.id)
        if (enabledNames.length === 0) return
        const data = mockSignalData({ channels: enabledNames, sampleRate: rate })
        drawWaveform(data)

        const ch0 = data[0]
        if (ch0 && ch0.length > 0) {
          const maxV = Math.max(...ch0)
          const minV = Math.min(...ch0)
          setMeasurements({
            frequency: `${(rate / ch0.length * 0.5).toFixed(0)} Hz`,
            period: `${(ch0.length / rate * 1000000).toFixed(1)} us`,
            vpp: `${(maxV - minV).toFixed(2)} V`,
            dutyCycle: `${(45 + Math.random() * 10).toFixed(1)} %`,
          })
        }
      }, 80)
    } else {
      if (captureRef.current) {
        clearInterval(captureRef.current)
        captureRef.current = null
      }
    }
    return () => {
      if (captureRef.current) clearInterval(captureRef.current)
    }
  }, [isCapturing, sampleRate, channels, drawWaveform])

  const toggleChannel = (id: string) => {
    setChannels((prev) => prev.map((ch) => (ch.id === id ? { ...ch, enabled: !ch.enabled } : ch)))
  }

  const toggleDecoder = (id: string) => {
    setDecoders((prev) => prev.map((d) => (d.id === id ? { ...d, enabled: !d.enabled } : d)))
  }

  const startCapture = async () => {
    await tauri.invoke('start_sigrok_capture', { sampleRate })
    setIsCapturing(true)
  }

  const stopCapture = async () => {
    await tauri.invoke('stop_sigrok_capture')
    setIsCapturing(false)
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Toolbar */}
      <div className="glass rounded-xl p-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-white/30 uppercase tracking-wider">Rate</label>
          <select
            value={sampleRate}
            onChange={(e) => setSampleRate(e.target.value)}
            className="input-cyber text-xs py-1"
          >
            {Object.keys(SAMPLE_RATES).map((rate) => (
              <option key={rate} value={rate}>{rate}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-6 bg-white/10" />

        <div className="flex items-center gap-2">
          <label className="text-[10px] text-white/30 uppercase tracking-wider">Trigger</label>
          <input
            type="number"
            value={triggerLevel}
            onChange={(e) => setTriggerLevel(parseFloat(e.target.value))}
            step="0.1" min="0" max="5"
            className="input-cyber w-16 text-xs py-1"
          />
          <span className="text-[10px] text-white/30">V</span>
        </div>

        <div className="flex-1" />

        <button
          onClick={isCapturing ? stopCapture : startCapture}
          className={isCapturing ? 'btn-neon-red flex items-center gap-2' : 'btn-neon-green flex items-center gap-2'}
        >
          {isCapturing ? (
            <>
              <div className="w-2 h-2 rounded-full bg-neon-red animate-pulse" />
              Stop
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
              Start
            </>
          )}
        </button>

        <button className="btn-ghost text-xs flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export
        </button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Canvas */}
        <div className="flex-1 canvas-container">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* Sidebar */}
        <div className="w-64 glass rounded-xl p-4 overflow-auto custom-scrollbar flex flex-col gap-5 shrink-0">
          {/* Channels */}
          <div>
            <h3 className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">Channels</h3>
            <div className="space-y-1.5">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => toggleChannel(ch.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-sm ${
                    ch.enabled
                      ? 'bg-surface-3/60 border border-white/5'
                      : 'hover:bg-surface-2/40'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-sm border-2 transition-all ${
                      ch.enabled ? 'border-current' : 'border-white/20'
                    }`}
                    style={{ color: ch.color, backgroundColor: ch.enabled ? ch.color + '30' : 'transparent' }}
                  />
                  <span className={`font-mono text-xs ${ch.enabled ? 'text-white/80' : 'text-white/30'}`}>
                    {ch.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Decoders */}
          <div>
            <h3 className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">Decoders</h3>
            <div className="space-y-1.5">
              {decoders.map((dec) => (
                <button
                  key={dec.id}
                  onClick={() => toggleDecoder(dec.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${
                    dec.enabled ? 'bg-neon-purple/5 border border-neon-purple/10' : 'hover:bg-surface-2/40'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${dec.enabled ? 'bg-neon-purple' : 'bg-white/15'}`} />
                  <div className="text-left">
                    <div className={`text-xs font-medium ${dec.enabled ? 'text-neon-purple' : 'text-white/40'}`}>
                      {dec.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Measurements */}
          <div className="mt-auto">
            <h3 className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">Measurements</h3>
            <div className="bg-surface-2/40 rounded-lg p-3 space-y-2 border border-white/5">
              {[
                { label: 'Freq', value: measurements.frequency, color: 'text-neon-green' },
                { label: 'Period', value: measurements.period, color: 'text-neon-blue' },
                { label: 'Vpp', value: measurements.vpp, color: 'text-neon-yellow' },
                { label: 'Duty', value: measurements.dutyCycle, color: 'text-neon-cyan' },
              ].map((m) => (
                <div key={m.label} className="flex justify-between items-center">
                  <span className="text-[10px] text-white/30">{m.label}</span>
                  <span className={`text-xs font-mono font-medium ${m.color}`}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
