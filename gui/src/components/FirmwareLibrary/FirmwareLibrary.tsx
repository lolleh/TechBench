import { useState } from 'react'
import type { FirmwareLibraryEntry } from '../../lib/types'

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  official: { bg: 'bg-neon-green/10', text: 'text-neon-green' },
  sammobile: { bg: 'bg-neon-blue/10', text: 'text-neon-blue' },
  mifirmware: { bg: 'bg-neon-orange/10', text: 'text-neon-orange' },
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function FirmwareLibrary() {
  const [firmware] = useState<FirmwareLibraryEntry[]>([])
  const [search, setSearch] = useState('')
  const [selectedFirmware, setSelectedFirmware] = useState<FirmwareLibraryEntry | null>(null)
  const [filterDownloaded, setFilterDownloaded] = useState<boolean | null>(null)

  const filtered = firmware.filter((f) => {
    if (search && !f.name.toLowerCase().includes(search.toLowerCase()) && !f.device.toLowerCase().includes(search.toLowerCase())) return false
    if (filterDownloaded !== null && f.isDownloaded !== filterDownloaded) return false
    return true
  })

  const downloadedCount = firmware.filter((f) => f.isDownloaded).length
  const totalSize = firmware.filter((f) => f.isDownloaded).reduce((sum, f) => sum + f.size, 0)

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Firmware List */}
      <div className="flex-1 glass rounded-2xl p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Firmware Library</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/30">{filtered.length} files</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5 text-center">
            <div className="text-sm font-bold text-white/90">{firmware.length}</div>
            <div className="text-[9px] text-white/30">Total</div>
          </div>
          <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5 text-center">
            <div className="text-sm font-bold text-neon-green">{downloadedCount}</div>
            <div className="text-[9px] text-white/30">Downloaded</div>
          </div>
          <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5 text-center">
            <div className="text-sm font-bold text-neon-blue">{formatSize(totalSize)}</div>
            <div className="text-[9px] text-white/30">Total Size</div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search firmware..."
            className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-neon-blue/30"
          />
          <div className="flex gap-1">
            {[
              { label: 'All', value: null },
              { label: 'Downloaded', value: true },
              { label: 'Available', value: false },
            ].map((f) => (
              <button
                key={f.label}
                onClick={() => setFilterDownloaded(f.value)}
                className={`text-[10px] px-2 py-1.5 rounded-lg border transition-all ${
                  filterDownloaded === f.value
                    ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30'
                    : 'bg-surface-2/40 text-white/40 border-white/5 hover:text-white/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Firmware List */}
        <div className="flex-1 overflow-auto custom-scrollbar space-y-1">
          {firmware.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <p className="text-sm text-white/40 mb-1">No firmware files</p>
              <p className="text-xs text-white/20">Download firmware files to get started</p>
            </div>
          ) : (
            filtered.map((fw) => {
              const isSelected = selectedFirmware?.id === fw.id
              const sourceColors = SOURCE_COLORS[fw.source || 'official'] || SOURCE_COLORS.official

              return (
                <button
                  key={fw.id}
                  onClick={() => setSelectedFirmware(fw)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                    isSelected
                      ? 'bg-gradient-to-r from-neon-blue/10 to-transparent border border-neon-blue/20'
                      : 'bg-surface-2/30 border border-transparent hover:bg-surface-3/30 hover:border-white/5'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    fw.isDownloaded ? 'bg-neon-green/10 text-neon-green' : 'bg-surface-3/50 text-white/30'
                  }`}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/80 truncate">{fw.name}</span>
                      {fw.isDownloaded && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green border border-neon-green/20">DL</span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/30 font-mono truncate">{fw.version}</div>
                    <div className="flex items-center gap-3 text-[10px] text-white/20 mt-0.5">
                      <span>{fw.device}</span>
                      <span>{formatSize(fw.size)}</span>
                      <span className={`px-1.5 py-0.5 rounded ${sourceColors.bg} ${sourceColors.text}`}>{fw.source}</span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right - Firmware Details */}
      <div className="w-96 glass rounded-2xl p-4 flex flex-col shrink-0">
        {selectedFirmware ? (
          <div className="animate-fade-in flex flex-col h-full">
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                selectedFirmware.isDownloaded ? 'bg-neon-green/10 text-neon-green' : 'bg-surface-3/50 text-white/30'
              }`}>
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white/90 truncate">{selectedFirmware.name}</h3>
                <div className="text-[10px] text-white/30 font-mono truncate">{selectedFirmware.version}</div>
              </div>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
                <div className="text-[9px] text-white/30 uppercase">Device</div>
                <div className="text-xs text-white/70">{selectedFirmware.device}</div>
              </div>
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
                <div className="text-[9px] text-white/30 uppercase">Chipset</div>
                <div className="text-xs text-white/70">{selectedFirmware.chipset}</div>
              </div>
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
                <div className="text-[9px] text-white/30 uppercase">Size</div>
                <div className="text-xs text-white/70">{formatSize(selectedFirmware.size)}</div>
              </div>
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
                <div className="text-[9px] text-white/30 uppercase">Date</div>
                <div className="text-xs text-white/70">{selectedFirmware.date}</div>
              </div>
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
                <div className="text-[9px] text-white/30 uppercase">Source</div>
                <div className="text-xs text-white/70 capitalize">{selectedFirmware.source}</div>
              </div>
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
                <div className="text-[9px] text-white/30 uppercase">Status</div>
                <div className={`text-xs ${selectedFirmware.isDownloaded ? 'text-neon-green' : 'text-white/50'}`}>
                  {selectedFirmware.isDownloaded ? 'Downloaded' : 'Not Downloaded'}
                </div>
              </div>
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5 col-span-2">
                <div className="text-[9px] text-white/30 uppercase">MD5</div>
                <div className="text-[10px] text-white/50 font-mono truncate">{selectedFirmware.md5}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-auto flex gap-2">
              {selectedFirmware.isDownloaded ? (
                <>
                  <button className="flex-1 btn-cyber flex items-center justify-center gap-1.5 text-xs">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Flash Firmware
                  </button>
                  <button className="flex-1 btn-ghost flex items-center justify-center gap-1.5 text-xs">
                    Delete
                  </button>
                </>
              ) : (
                <button className="flex-1 btn-cyber flex items-center justify-center gap-1.5 text-xs">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/30 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">Select firmware</p>
            <p className="text-xs text-white/20">Choose a firmware file to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
