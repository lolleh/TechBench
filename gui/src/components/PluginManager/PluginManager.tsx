import { useState } from 'react'

interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  category: 'instrument' | 'device' | 'ai' | 'hardware' | 'automation' | 'report' | 'vendor'
  installed: boolean
  enabled: boolean
  downloads: number
  rating: number
}

const MOCK_PLUGINS: Plugin[] = [
  { id: 'p1', name: 'Sigrok Integration', version: '1.2.0', description: 'Full Sigrok/PulseView integration with protocol decoding', author: 'TechBench', category: 'instrument', installed: true, enabled: true, downloads: 1250, rating: 4.8 },
  { id: 'p2', name: 'OpenOCD Debugger', version: '0.11.0', description: 'JTAG/SWD debugging via OpenOCD', author: 'TechBench', category: 'instrument', installed: true, enabled: true, downloads: 890, rating: 4.5 },
  { id: 'p3', name: 'Samsung Tool Pro', version: '2.3.1', description: 'Advanced Samsung device servicing', author: 'Community', category: 'vendor', installed: false, enabled: false, downloads: 2100, rating: 4.7 },
  { id: 'p4', name: 'AI Component Detector', version: '0.8.0', description: 'ONNX-based PCB component detection', author: 'TechBench', category: 'ai', installed: true, enabled: false, downloads: 670, rating: 4.2 },
  { id: 'p5', name: 'Thermal Analysis', version: '1.0.0', description: 'FLIR thermal camera integration and analysis', author: 'Community', category: 'instrument', installed: false, enabled: false, downloads: 430, rating: 4.0 },
  { id: 'p6', name: 'Report Generator', version: '1.1.0', description: 'Generate PDF repair reports', author: 'TechBench', category: 'report', installed: true, enabled: true, downloads: 1580, rating: 4.6 },
  { id: 'p7', name: 'USB-PD Analyzer', version: '0.5.0', description: 'USB Power Delivery protocol analysis', author: 'Community', category: 'hardware', installed: false, enabled: false, downloads: 320, rating: 3.9 },
  { id: 'p8', name: 'Batch Flash Engine', version: '1.3.0', description: 'Multi-device parallel flashing automation', author: 'TechBench', category: 'automation', installed: true, enabled: true, downloads: 980, rating: 4.4 },
]

export function PluginManager() {
  const [plugins, setPlugins] = useState<Plugin[]>(MOCK_PLUGINS)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const categories = ['all', 'instrument', 'device', 'ai', 'hardware', 'automation', 'report', 'vendor']

  const filteredPlugins = plugins.filter(p => {
    if (filterCategory !== 'all' && p.category !== filterCategory) return false
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const togglePlugin = (id: string) => {
    setPlugins(prev => prev.map(p =>
      p.id === id ? { ...p, enabled: !p.enabled } : p
    ))
  }

  const installPlugin = (id: string) => {
    setPlugins(prev => prev.map(p =>
      p.id === id ? { ...p, installed: true, enabled: true } : p
    ))
  }

  const uninstallPlugin = (id: string) => {
    setPlugins(prev => prev.map(p =>
      p.id === id ? { ...p, installed: false, enabled: false } : p
    ))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search plugins..."
            className="flex-1 bg-gray-700 text-white px-3 py-1 rounded text-sm"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2 py-0.5 rounded text-xs capitalize ${
                filterCategory === cat ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {filteredPlugins.map(plugin => (
            <div key={plugin.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium">{plugin.name}</div>
                  <div className="text-xs text-gray-400">v{plugin.version} by {plugin.author}</div>
                </div>
                <span className="px-2 py-0.5 bg-gray-700 rounded text-xs capitalize">{plugin.category}</span>
              </div>
              <p className="text-sm text-gray-300 mb-3">{plugin.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>⬇ {plugin.downloads}</span>
                  <span>⭐ {plugin.rating}</span>
                </div>
                <div className="flex items-center gap-2">
                  {plugin.installed ? (
                    <>
                      <button
                        onClick={() => togglePlugin(plugin.id)}
                        className={`px-2 py-1 rounded text-xs ${
                          plugin.enabled ? 'bg-green-600' : 'bg-gray-600'
                        }`}
                      >
                        {plugin.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => uninstallPlugin(plugin.id)}
                        className="px-2 py-1 bg-red-600/30 text-red-400 hover:bg-red-600/50 rounded text-xs"
                      >
                        Uninstall
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => installPlugin(plugin.id)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs"
                    >
                      Install
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 bg-gray-800 border-t border-gray-700 flex items-center justify-between text-sm text-gray-400">
        <span>{plugins.filter(p => p.installed).length} installed | {plugins.filter(p => p.enabled).length} enabled</span>
        <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">
          Check for Updates
        </button>
      </div>
    </div>
  )
}
