import { useRef, useState, useEffect, useCallback } from 'react'
import { useDeviceStore } from '../../lib/deviceStore'
import { tauri } from '../../lib/tauri'

const describeAppleError = (raw: string): string => {
  const s = raw.toLowerCase()
  if (s.includes('developer mode')) {
    return 'iOS Developer Mode must be enabled on the device (Settings → Privacy & Security → Developer Mode).'
  }
  if (s.includes('lock')) {
    return 'The iPhone is locked. Unlock it and keep the screen on while mirroring.'
  }
  if (s.includes('denied') || s.includes('pairing') || s.includes('trust')) {
    return 'The computer is not trusted by the iPhone. Unlock the device and tap "Trust" when prompted.'
  }
  if (s.includes('mount') || s.includes('personaliz') || s.includes('disk image')) {
    return 'The Developer disk image is not mounted on the device. Mount it before mirroring.'
  }
  return raw
}

const KEY_EVENTS: Array<{ label: string; key: number; title?: string }> = [
  { label: 'Home', key: 3 },
  { label: 'Back', key: 4 },
  { label: 'Apps', key: 187, title: 'Recents' },
  { label: 'Menu', key: 82 },
  { label: 'Enter', key: 66 },
  { label: 'Power', key: 26 },
  { label: 'Vol+', key: 24 },
  { label: 'Vol-', key: 25 },
  { label: 'Mute', key: 164 },
]

export function DeviceMirror() {
  const devices = useDeviceStore((s) => s.devices)
  const [selectedId, setSelectedId] = useState<string>('')
  const [mirroring, setMirroring] = useState(false)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)

  const imgRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const runningRef = useRef(false)
  const selectedIdRef = useRef('')
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = devices.find((d) => d.id === selectedId) || null

  useEffect(() => {
    if (!selectedId && devices.length > 0) {
      setSelectedId(devices[0].id)
    }
  }, [devices, selectedId])

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    if (!mirroring && imgUrl) {
      URL.revokeObjectURL(imgUrl)
      setImgUrl(null)
    }
  }, [mirroring, imgUrl])

  useEffect(() => {
    runningRef.current = running
  }, [running])

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2200)
  }, [])

  const captureOnce = useCallback(async (): Promise<boolean> => {
    const dev = devices.find((d) => d.id === selectedIdRef.current)
    if (!dev || !dev.serial) return false
    const result = await tauri.mirrorScreenshot(dev.serial, dev.deviceType)
    if (!runningRef.current) return false
    if (result.ok && result.blob) {
      const url = URL.createObjectURL(result.blob)
      setImgUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
      setError(null)
      return true
    }
    if (result.error) {
      setError(dev.deviceType === 'apple' ? describeAppleError(result.error) : result.error)
      setRunning(false)
      setMirroring(false)
    }
    return false
  }, [devices])

  useEffect(() => {
    if (!running) return
    let stopped = false
    const loop = async () => {
      while (!stopped && runningRef.current) {
        const dev = devices.find((d) => d.id === selectedIdRef.current)
        const interval = dev?.deviceType === 'apple' ? 2400 : 800
        setBusy(true)
        await captureOnce()
        setBusy(false)
        await new Promise((r) => setTimeout(r, interval))
      }
    }
    loop()
    return () => {
      stopped = true
    }
  }, [running, captureOnce, devices])

  const startMirror = () => {
    if (!selected) return
    setError(null)
    setRunning(true)
    setMirroring(true)
  }

  const stopMirror = () => {
    setRunning(false)
    setMirroring(false)
  }

  const toDeviceCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const el = imgRef.current
    if (!el || !natural) return null
    const rect = el.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * natural.w
    const py = ((clientY - rect.top) / rect.height) * natural.h
    return { x: Math.round(Math.max(0, Math.min(natural.w, px))), y: Math.round(Math.max(0, Math.min(natural.h, py))) }
  }

  const inject = async (payload: Record<string, unknown>) => {
    if (!selected?.serial) return
    const res = await tauri.mirrorInput(selected.serial, selected.deviceType, payload)
    if (!res.success && res.error) setError(res.error)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!selected || selected.deviceType === 'apple') return
    const pt = toDeviceCoords(e.clientX, e.clientY)
    if (pt) dragRef.current = pt
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!selected || selected.deviceType === 'apple') return
    const pt = toDeviceCoords(e.clientX, e.clientY)
    if (dragRef.current && pt) {
      const start = dragRef.current
      dragRef.current = null
      const dx = Math.abs(pt.x - start.x)
      const dy = Math.abs(pt.y - start.y)
      if (Math.max(dx, dy) > 8) {
        inject({ action: 'swipe', x: start.x, y: start.y, x2: pt.x, y2: pt.y, duration: 300 })
      } else {
        inject({ action: 'tap', x: pt.x, y: pt.y })
      }
    }
  }

  const sendKey = (key: number) => {
    inject({ action: 'key', key })
  }

  const sendText = () => {
    if (!text.trim()) return
    inject({ action: 'text', text })
    setText('')
    showFeedback('Text sent to device')
  }

  const isApple = selected?.deviceType === 'apple'

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Controls */}
      <div className="w-72 glass rounded-2xl p-4 flex flex-col shrink-0 min-h-0 overflow-y-auto custom-scrollbar space-y-4">
        <h2 className="text-sm font-semibold text-white/80">Device Mirror</h2>

        {/* Device selector */}
        <div>
          <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 block">Device</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={mirroring}
            className="w-full bg-surface-2/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-neon-blue/40 disabled:opacity-40"
          >
            {devices.length === 0 && <option value="">No devices connected</option>}
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.productName} ({d.deviceType}){d.serial ? ` - ${d.serial}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Start/Stop */}
        {selected && (
          <div className="flex gap-2">
            <button
              onClick={startMirror}
              disabled={mirroring || !selected.serial}
              className="flex-1 text-xs px-3 py-2 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20 transition-all disabled:opacity-40"
            >
              {running && busy ? 'Refreshing...' : 'Start Mirror'}
            </button>
            <button
              onClick={stopMirror}
              disabled={!mirroring}
              className="flex-1 text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all disabled:opacity-40"
            >
              Stop
            </button>
          </div>
        )}

        {isApple && (
          <div className="bg-neon-yellow/5 border border-neon-yellow/20 rounded-xl p-3">
            <p className="text-[11px] text-neon-yellow/90 leading-relaxed">
              iOS mirrors as a live screen preview only (captured via a RemoteServiceDiscovery
              tunnel). Tap/swipe input is not supported over USB. Requires Developer Mode enabled
              and the Developer disk image mounted on the device.
            </p>
          </div>
        )}

        {/* Input controls - Android only */}
        {selected && !isApple && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 block">Keys</label>
              <div className="grid grid-cols-3 gap-1.5">
                {KEY_EVENTS.map((k) => (
                  <button
                    key={k.key}
                    onClick={() => sendKey(k.key)}
                    title={k.title || k.label}
                    className="text-[10px] px-1 py-2 rounded-lg bg-surface-2/50 border border-white/10 text-white/70 hover:border-neon-blue/30 hover:text-neon-blue transition-all"
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5 block">Type Text</label>
              <div className="flex gap-1.5">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendText()}
                  placeholder="Text to send..."
                  className="flex-1 min-w-0 bg-surface-2/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-neon-blue/40"
                />
                <button
                  onClick={sendText}
                  disabled={!text.trim()}
                  className="px-3 py-2 rounded-lg bg-neon-green/10 text-neon-green border border-neon-green/30 hover:bg-neon-green/20 transition-all disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
            <p className="text-[10px] text-white/25 leading-relaxed">
              Click the screen to tap, or drag to swipe. Works only when USB debugging is
              authorized and the screen is unlocked.
            </p>
          </div>
        )}

        {feedback && <p className="text-xs text-neon-green">{feedback}</p>}
        {error && !mirroring && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <p className="text-xs text-red-400 break-words">{error}</p>
          </div>
        )}
      </div>

      {/* Right - Screen */}
      <div className="flex-1 glass rounded-2xl p-4 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="text-sm font-semibold text-white/80">
            {selected ? `${selected.productName} Screen` : 'No device selected'}
          </h2>
          <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
            {running && (
              <>
                <div className={`w-1.5 h-1.5 rounded-full ${busy ? 'bg-neon-green animate-pulse' : 'bg-neon-green/50'}`} />
                <span>MIRRORING{busy ? '...' : ''}</span>
              </>
            )}
            {natural && <span>{natural.w}&times;{natural.h}</span>}
          </div>
        </div>

        <div className="flex-1 min-h-0 rounded-xl bg-surface-2/30 border border-white/5 overflow-hidden flex items-center justify-center">
          {!selected ? (
            <div className="text-center py-12">
              <p className="text-sm text-white/40 mb-1">No device connected</p>
              <p className="text-xs text-white/20">Connect a device to start mirroring</p>
            </div>
          ) : !mirroring ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17.25 9.75L21 6.75v10.5l-3.75-3m-1.5-3.75h-1.5M5.25 6.75h1.5m3-2.25h3M6 9.75v10.5A2.25 2.25 0 008.25 22.5h7.5A2.25 2.25 0 0018 20.25V9.75A2.25 2.25 0 0015.75 7.5h-7.5A2.25 2.25 0 006 9.75z" />
                </svg>
              </div>
              <p className="text-sm text-white/40 mb-1">Mirroring is off</p>
              <p className="text-xs text-white/20">Press Start Mirror to begin</p>
            </div>
          ) : error && !imgUrl ? (
            <div className="max-w-md mx-auto text-center py-12 px-6">
              <p className="text-sm text-red-400 mb-2">Could not capture the screen</p>
              <p className="text-xs text-white/30 break-words">{error}</p>
            </div>
          ) : imgUrl ? (
            <img
              ref={imgRef}
              src={imgUrl}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              draggable={false}
              className={`max-h-full max-w-full object-contain select-none rounded-lg ${
                isApple ? '' : 'cursor-crosshair touch-none'
              }`}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-white/40">Capturing first frame...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
