import { useState, useRef, useEffect } from 'react'

interface Component {
  id: string
  type: string
  value: string
  footprint: string
  x: number
  y: number
  width: number
  height: number
  rail?: string
  testPoints?: string[]
  knownFaults?: string[]
  replacement?: string
  price?: string
}

const MOCK_COMPONENTS: Component[] = [
  {
    id: 'U101',
    type: 'PMIC',
    value: 'PM8550',
    footprint: 'BGA',
    x: 200,
    y: 150,
    width: 60,
    height: 60,
    rail: 'VREG_L3, VREG_L5',
    testPoints: ['TP101', 'TP102', 'TP103'],
    knownFaults: ['47% - No VREG_L3 output', '23% - Overheating'],
    replacement: 'PM8550',
    price: '$12.50',
  },
  {
    id: 'C204',
    type: 'Capacitor',
    value: '10µF',
    footprint: '0402',
    x: 280,
    y: 180,
    width: 20,
    height: 10,
    rail: 'VDD_CORE',
    testPoints: ['TP201'],
    knownFaults: ['12% - Short circuit'],
    replacement: '10µF 0402 MLCC',
    price: '$0.05',
  },
  {
    id: 'R305',
    type: 'Resistor',
    value: '10kΩ',
    footprint: '0201',
    x: 320,
    y: 200,
    width: 15,
    height: 8,
    rail: 'I2C_PULLUP',
    testPoints: [],
    knownFaults: ['5% - Open circuit'],
    replacement: '10kΩ 0201',
    price: '$0.01',
  },
  {
    id: 'L401',
    type: 'Inductor',
    value: '4.7µH',
    footprint: '0603',
    x: 350,
    y: 160,
    width: 25,
    height: 15,
    rail: 'BATT_FILT',
    testPoints: ['TP401'],
    knownFaults: ['8% - Open inductor'],
    replacement: '4.7µH 0603',
    price: '$0.15',
  },
  {
    id: 'J501',
    type: 'Connector',
    value: 'USB-C',
    footprint: 'USB-C-16P',
    x: 100,
    y: 300,
    width: 40,
    height: 20,
    testPoints: ['TP501', 'TP502', 'TP503', 'TP504'],
    knownFaults: ['35% - Bent pins', '20% - Corrosion'],
    replacement: 'USB-C 16P Connector',
    price: '$1.20',
  },
]

export function SchematicViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null)
  const [zoom, setZoom] = useState(1)
  const [showTestPoints, setShowTestPoints] = useState(true)
  const [showRails, setShowRails] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    drawPCB()
  }, [selectedComponent, zoom, showTestPoints, showRails])

  const drawPCB = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const width = canvas.width
    const height = canvas.height
    
    // Clear canvas
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, width, height)
    
    // Apply transform
    ctx.save()
    ctx.scale(zoom, zoom)
    
    // Draw PCB background (green)
    ctx.fillStyle = '#1a472a'
    ctx.fillRect(50, 50, 500, 400)
    
    // Draw traces
    ctx.strokeStyle = '#c9a227'
    ctx.lineWidth = 2
    
    // Example traces
    const traces = [
      [{ x: 100, y: 310 }, { x: 200, y: 310 }, { x: 200, y: 200 }],
      [{ x: 200, y: 200 }, { x: 280, y: 200 }, { x: 280, y: 190 }],
      [{ x: 280, y: 190 }, { x: 320, y: 190 }, { x: 320, y: 208 }],
      [{ x: 320, y: 208 }, { x: 350, y: 208 }, { x: 350, y: 175 }],
    ]
    
    traces.forEach(trace => {
      ctx.beginPath()
      trace.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y)
        } else {
          ctx.lineTo(point.x, point.y)
        }
      })
      ctx.stroke()
    })
    
    // Draw components
    MOCK_COMPONENTS.forEach(comp => {
      const isSelected = selectedComponent?.id === comp.id
      
      // Component body
      ctx.fillStyle = isSelected ? '#3b82f6' : '#4b5563'
      ctx.fillRect(comp.x, comp.y, comp.width, comp.height)
      
      // Component outline
      ctx.strokeStyle = isSelected ? '#60a5fa' : '#6b7280'
      ctx.lineWidth = isSelected ? 2 : 1
      ctx.strokeRect(comp.x, comp.y, comp.width, comp.height)
      
      // Component label
      ctx.fillStyle = '#ffffff'
      ctx.font = '10px monospace'
      ctx.fillText(comp.id, comp.x + 2, comp.y + 12)
      
      // Value
      ctx.fillStyle = '#9ca3af'
      ctx.font = '8px monospace'
      ctx.fillText(comp.value, comp.x + 2, comp.y + comp.height - 2)
      
      // Test points
      if (showTestPoints && comp.testPoints && comp.testPoints.length > 0) {
        comp.testPoints.forEach((tp, index) => {
          const tpX = comp.x + comp.width + 10 + (index * 20)
          const tpY = comp.y + comp.height / 2
          
          ctx.fillStyle = '#22c55e'
          ctx.beginPath()
          ctx.arc(tpX, tpY, 4, 0, Math.PI * 2)
          ctx.fill()
          
          ctx.fillStyle = '#22c55e'
          ctx.font = '8px monospace'
          ctx.fillText(tp, tpX - 10, tpY - 8)
        })
      }
      
      // Power rail indicator
      if (showRails && comp.rail) {
        ctx.fillStyle = '#eab308'
        ctx.font = '8px monospace'
        ctx.fillText(comp.rail, comp.x, comp.y - 5)
      }
    })
    
    ctx.restore()
    
    // Draw zoom indicator
    ctx.fillStyle = '#6b7280'
    ctx.font = '12px monospace'
    ctx.fillText(`Zoom: ${(zoom * 100).toFixed(0)}%`, 10, height - 10)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom
    
    // Check if click is on a component
    const clickedComponent = MOCK_COMPONENTS.find(comp => 
      x >= comp.x && x <= comp.x + comp.width &&
      y >= comp.y && y <= comp.y + comp.height
    )
    
    setSelectedComponent(clickedComponent || null)
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 3))
  }

  const filteredComponents = MOCK_COMPONENTS.filter(comp => 
    searchQuery === '' || 
    comp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comp.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comp.value.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-2 bg-gray-800 border-b border-gray-700">
        <input
          type="text"
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-gray-700 text-white px-3 py-1 rounded text-sm w-64"
        />
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showTestPoints}
            onChange={(e) => setShowTestPoints(e.target.checked)}
            className="rounded"
          />
          <label className="text-sm text-gray-400">Test Points</label>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showRails}
            onChange={(e) => setShowRails(e.target.checked)}
            className="rounded"
          />
          <label className="text-sm text-gray-400">Power Rails</label>
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.5))}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            🔍-
          </button>
          <span className="text-sm text-gray-400">{(zoom * 100).toFixed(0)}%</span>
          <button 
            onClick={() => setZoom(prev => Math.min(prev + 0.1, 3))}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            🔍+
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* PCB View */}
        <div className="flex-1 p-2 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-full bg-gray-900 rounded cursor-crosshair"
            onClick={handleCanvasClick}
            onWheel={handleWheel}
          />
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-auto">
          {/* Component List */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Components</h3>
            <div className="space-y-2 max-h-48 overflow-auto">
              {filteredComponents.map(comp => (
                <div
                  key={comp.id}
                  onClick={() => setSelectedComponent(comp)}
                  className={`p-2 rounded cursor-pointer ${
                    selectedComponent?.id === comp.id
                      ? 'bg-blue-600'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{comp.id}</span>
                    <span className="text-xs text-gray-400">({comp.type})</span>
                  </div>
                  <div className="text-xs text-gray-400">{comp.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Component Details */}
          {selectedComponent && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Component Details</h3>
              <div className="bg-gray-700 rounded p-3 space-y-2">
                <div>
                  <label className="text-xs text-gray-400">ID</label>
                  <div className="font-mono">{selectedComponent.id}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Type</label>
                  <div>{selectedComponent.type}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Value</label>
                  <div className="font-mono">{selectedComponent.value}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Footprint</label>
                  <div>{selectedComponent.footprint}</div>
                </div>
                {selectedComponent.rail && (
                  <div>
                    <label className="text-xs text-gray-400">Power Rail</label>
                    <div className="text-yellow-400">{selectedComponent.rail}</div>
                  </div>
                )}
                {selectedComponent.testPoints && selectedComponent.testPoints.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-400">Test Points</label>
                    <div className="flex flex-wrap gap-1">
                      {selectedComponent.testPoints.map(tp => (
                        <span key={tp} className="px-2 py-0.5 bg-green-900/50 text-green-400 rounded text-xs">
                          {tp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedComponent.knownFaults && selectedComponent.knownFaults.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-400">Known Faults</label>
                    <div className="space-y-1">
                      {selectedComponent.knownFaults.map((fault, i) => (
                        <div key={i} className="text-xs text-red-400">{fault}</div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedComponent.replacement && (
                  <div>
                    <label className="text-xs text-gray-400">Replacement</label>
                    <div>{selectedComponent.replacement}</div>
                  </div>
                )}
                {selectedComponent.price && (
                  <div>
                    <label className="text-xs text-gray-400">Price</label>
                    <div className="text-green-400">{selectedComponent.price}</div>
                  </div>
                )}
              </div>
              
              <div className="mt-3 flex gap-2">
                <button className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm">
                  📍 Highlight on PCB
                </button>
                <button className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm">
                  📋 Copy Info
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
