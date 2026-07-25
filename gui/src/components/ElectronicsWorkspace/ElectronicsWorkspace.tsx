import { useState, useRef, useEffect } from 'react'

interface Instrument {
  id: string
  name: string
  type: 'oscilloscope' | 'logic_analyzer' | 'multimeter' | 'signal_generator' | 'power_supply' | 'thermal_camera'
  status: 'connected' | 'disconnected' | 'error'
  interface: string
}

interface ProtocolCapture {
  id: string
  protocol: string
  timestamp: string
  data: string
  length: number
}

const MOCK_INSTRUMENTS: Instrument[] = [
  { id: 'sig1', name: 'Saleae Logic Pro 16', type: 'logic_analyzer', status: 'connected', interface: 'USB' },
  { id: 'dso1', name: 'Rigol DS1054Z', type: 'oscilloscope', status: 'connected', interface: 'USB/LAN' },
  { id: 'dmm1', name: 'Fluke 87V', type: 'multimeter', status: 'disconnected', interface: 'USB' },
  { id: 'psu1', name: 'Rigol DP832', type: 'power_supply', status: 'connected', interface: 'USB/LAN' },
  { id: 'sg1', name: 'AD9833 DDS', type: 'signal_generator', status: 'disconnected', interface: 'SPI' },
  { id: 'th1', name: 'FLIR Lepton 3.5', type: 'thermal_camera', status: 'disconnected', interface: 'USB' },
]

const PROTOCOLS = ['UART', 'SPI', 'I2C', 'USB', 'USB-PD', 'CAN', 'LIN', 'JTAG', 'SWD', 'MIPI', 'eMMC', 'UFS']

export function ElectronicsWorkspace() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [instruments] = useState<Instrument[]>(MOCK_INSTRUMENTS)
  const [activeTab, setActiveTab] = useState<'instruments' | 'protocols' | 'design' | 'embedded'>('instruments')
  const [selectedProtocol, setSelectedProtocol] = useState('I2C')
  const [isCapturing, setIsCapturing] = useState(false)
  const [captures] = useState<ProtocolCapture[]>([
    { id: '1', protocol: 'I2C', timestamp: '14:32:15', data: 'START 0x50 W [0x00 0x01 0x02] STOP', length: 6 },
    { id: '2', protocol: 'UART', timestamp: '14:32:18', data: 'RX: Hello World\r\n', length: 14 },
    { id: '3', protocol: 'SPI', timestamp: '14:32:20', data: 'CS_LOW 0xFF 0x9F CS_HIGH (Read ID)', length: 3 },
  ])

  useEffect(() => {
    drawGrid()
  }, [activeTab])

  const drawGrid = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 1

    for (let x = 0; x < w; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    if (isCapturing) {
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < w - 60; i++) {
        const x = 60 + i
        const y = h / 2 + Math.sin(i * 0.08) * 50 + (Math.random() - 0.5) * 10
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  const getInstrumentIcon = (type: Instrument['type']) => {
    switch (type) {
      case 'oscilloscope': return '📊'
      case 'logic_analyzer': return '🔬'
      case 'multimeter': return '🔢'
      case 'signal_generator': return '〰️'
      case 'power_supply': return '⚡'
      case 'thermal_camera': return '🌡️'
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
        {(['instruments', 'protocols', 'design', 'embedded'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded text-sm capitalize ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="flex-1" />
        <div className="text-sm text-gray-400">
          {instruments.filter(i => i.status === 'connected').length} instruments connected
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'instruments' && (
          <>
            <div className="flex-1 p-4">
              <canvas ref={canvasRef} width={800} height={400} className="w-full h-full bg-gray-900 rounded" />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setIsCapturing(!isCapturing)}
                  className={`px-4 py-1 rounded text-sm ${isCapturing ? 'bg-red-600' : 'bg-green-600'}`}
                >
                  {isCapturing ? 'Stop' : 'Start Capture'}
                </button>
              </div>
            </div>
            <div className="w-72 bg-gray-800 border-l border-gray-700 p-4 overflow-auto">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Instruments</h3>
              <div className="space-y-2">
                {instruments.map(inst => (
                  <div key={inst.id} className="bg-gray-700 rounded p-3">
                    <div className="flex items-center gap-2">
                      <span>{getInstrumentIcon(inst.type)}</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{inst.name}</div>
                        <div className="text-xs text-gray-400">{inst.interface}</div>
                      </div>
                      <span className={`w-2 h-2 rounded-full ${
                        inst.status === 'connected' ? 'bg-green-500' : 'bg-gray-500'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'protocols' && (
          <>
            <div className="flex-1 p-4">
              <div className="bg-gray-800 rounded-lg p-4 h-full">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-gray-400">Protocol:</span>
                  <select
                    value={selectedProtocol}
                    onChange={e => setSelectedProtocol(e.target.value)}
                    className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
                  >
                    {PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button
                    onClick={() => setIsCapturing(!isCapturing)}
                    className={`px-3 py-1 rounded text-sm ${isCapturing ? 'bg-red-600' : 'bg-green-600'}`}
                  >
                    {isCapturing ? 'Stop' : 'Capture'}
                  </button>
                </div>
                <div className="space-y-1 font-mono text-sm">
                  {captures.filter(c => c.protocol === selectedProtocol).map(cap => (
                    <div key={cap.id} className="flex gap-4 p-2 bg-gray-700 rounded">
                      <span className="text-gray-500 w-16">{cap.timestamp}</span>
                      <span className="text-blue-400 w-12">{cap.protocol}</span>
                      <span className="text-green-400 flex-1">{cap.data}</span>
                      <span className="text-gray-500">{cap.length}B</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="w-64 bg-gray-800 border-l border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Protocol Info</h3>
              <div className="space-y-2 text-sm">
                <div className="bg-gray-700 rounded p-2">
                  <div className="text-gray-400">Selected</div>
                  <div className="font-medium">{selectedProtocol}</div>
                </div>
                <div className="bg-gray-700 rounded p-2">
                  <div className="text-gray-400">Captures</div>
                  <div className="font-medium">{captures.filter(c => c.protocol === selectedProtocol).length}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'design' && (
          <div className="flex-1 p-4">
            <div className="bg-gray-800 rounded-lg p-6 h-full flex flex-col items-center justify-center text-gray-400">
              <div className="text-4xl mb-4">🔧</div>
              <h3 className="text-lg font-semibold text-white mb-2">Electronics Design</h3>
              <p className="text-sm text-center max-w-md">
                Integration with KiCad, SPICE simulation, and PCB viewing.
                Import schematics, simulate circuits, and manage BOMs.
              </p>
              <div className="flex gap-2 mt-4">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm">
                  Open KiCad
                </button>
                <button className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm">
                  SPICE Simulator
                </button>
                <button className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm">
                  Import Schematic
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'embedded' && (
          <div className="flex-1 p-4">
            <div className="bg-gray-800 rounded-lg p-6 h-full flex flex-col items-center justify-center text-gray-400">
              <div className="text-4xl mb-4">🔌</div>
              <h3 className="text-lg font-semibold text-white mb-2">Embedded Development</h3>
              <p className="text-sm text-center max-w-md">
                OpenOCD debugging, ARM toolchains, FPGA development.
                Support for STM32, ESP32, Raspberry Pi Pico, Nordic, AVR, PIC.
              </p>
              <div className="grid grid-cols-3 gap-2 mt-4 max-w-lg">
                {['STM32', 'ESP32', 'RP2040', 'Nordic nRF', 'AVR', 'PIC', 'FPGA Xilinx', 'FPGA Lattice'].map(chip => (
                  <button key={chip} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
