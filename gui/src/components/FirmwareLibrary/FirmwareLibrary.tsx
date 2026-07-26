import { useState } from 'react'
import type { FirmwareLibraryEntry } from '../../lib/types'

const MOCK_FIRMWARE: FirmwareLibraryEntry[] = [
  { id: '1', name: 'Lenovo Tab M11 TB330FU', version: 'S123_240115', device: 'Lenovo Tab M11', chipset: 'MediaTek Helio G88', size: 2147483648, date: '2024-01-15', path: '/firmware/lenovo/m11/tb330fu_s123.zip', md5: 'a3f2c8d1e5b4f7a2', isDownloaded: true, source: 'official' },
  { id: '2', name: 'Lenovo Tab M11 TB330KU', version: 'S124_240220', device: 'Lenovo Tab M11', chipset: 'MediaTek Helio G88', size: 2281701376, date: '2024-02-20', path: '/firmware/lenovo/m11/tb330ku_s124.zip', md5: 'b7e9a1f3c2d8e4b1', isDownloaded: true, source: 'official' },
  { id: '3', name: 'Samsung Galaxy S24 SM-S921B', version: 'S921BXXS3AXBA', device: 'Samsung Galaxy S24', chipset: 'Snapdragon 8 Gen 3', size: 8589934592, date: '2024-01-20', path: '/firmware/samsung/s24/s921bxxs3axba.zip', md5: 'c4d6e8f0a1b2c3d4', isDownloaded: true, source: 'sammobile' },
  { id: '4', name: 'Xiaomi Redmi Note 13', version: 'V14.0.25.0.TNGMIXM', device: 'Xiaomi Redmi Note 13', chipset: 'Snapdragon 685', size: 4294967296, date: '2024-01-10', path: '/firmware/xiaomi/rn13/v14_tngm.zip', md5: 'd5e7f9a1b2c3d4e5', isDownloaded: false, source: 'mifirmware' },
  { id: '5', name: 'OPPO Reno 11 CPH2599', version: 'CPH2599_14.0.0.302', device: 'OPPO Reno 11', chipset: 'Snapdragon 7s Gen 2', size: 5368709120, date: '2024-02-05', path: '/firmware/oppo/reno11/cph2599.zip', md5: 'e6f8a2b3c4d5e6f7', isDownloaded: false, source: 'official' },
  { id: '6', name: 'Lenovo Tab M11 Plus', version: 'S125_240310', device: 'Lenovo Tab M11 Plus', chipset: 'MediaTek Helio G88', size: 2684354560, date: '2024-03-10', path: '/firmware/lenovo/m11plus/s125.zip', md5: 'f9a1b2c3d4e5f6a7', isDownloaded: true, source: 'official' },
  { id: '7', name: 'Samsung Galaxy A54 SM-A546B', version: 'A546BXXS7AXA1', device: 'Samsung Galaxy A54', chipset: 'Exynos 1380', size: 6442450944, date: '2024-01-25', path: '/firmware/samsung/a54/a546bxxs7.zip', md5: 'a1b2c3d4e5f6a7b8', isDownloaded: true, source: 'sammobile' },
  { id: '8', name: 'Vivo V30 PD2367F', version: 'PD2367F_EX_A_14.0.11.5', device: 'Vivo V30', chipset: 'Snapdragon 7 Gen 3', size: 7516192768, date: '2024-02-15', path: '/firmware/vivo/v30/pd2367f.zip', md5: 'b2c3d4e5f6a7b8c9', isDownloaded: false, source: 'official' },
]

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  official: { bg: 'bg-neon-green/10', text: 'text-neon-green' },
  sammobile: { bg: 'bg-neon-blue/10', text: 'text-neon-blue' },
  mifirmware: { bg: 'bg-neon-orange/10', text: 'text-neon-orange' },
}

export function FirmwareLibrary() {
  const [firmware] = useState(FirmwareLibraryEntry[]>(MOCK_FIRMWARE)
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Firmware Library</h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/30">{downloadedCount} downloaded ({formatSize(totalSize)})</span>
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
                className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all ${
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

        {/* Firmware list */}
        <div className="flex-1 overflow-auto custom-scrollbar space-y-2">
          {filtered.map((fw) => {
            const sourceColors = SOURCE_COLORS[fw.source ?? 'official'] ?? SOURCE_COLORS.official
            const isSelected = selectedFirmware?.id === fw.id
            return (
              <button
                key={fw.id}
                onClick={() => setSelectedFirmware(fw)}
                className={`w-full text-left p-4 rounded-xl transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-r from-neon-blue/10 to-transparent border border-neon-blue/20'
                    : 'bg-surface-2/40 border border-transparent hover:bg-surface-3/40 hover:border-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white/80 truncate">{fw.name}</span>
                    {fw.isDownloaded && (
                      <svg className="w-4 h-4 text-neon-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${sourceColors.bg} ${sourceColors.text} capitalize`}>
                    {fw.source}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-white/40">
                  <span className="font-mono">{fw.version}</span>
                  <span>{fw.chipset}</span>
                  <span>{formatSize(fw.size)}</span>
                  <span>{fw.date}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right - Firmware Details */}
      <div className="w-80 glass rounded-2xl p-4 flex flex-col shrink-0">
        {selectedFirmware ? (
          <div className="animate-fade-in">
            <h3 className="text-sm font-semibold text-white/80 mb-4">Firmware Details</h3>

            <div className="space-y-3">
              <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Device</div>
                <div className="text-sm text-white/80">{selectedFirmware.device}</div>
              </div>
              <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Version</div>
                <div className="text-sm text-white/80 font-mono">{selectedFirmware.version}</div>
              </div>
              <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Chipset</div>
                <div className="text-sm text-white/80">{selectedFirmware.chipset}</div>
              </div>
              <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Size</div>
                <div className="text-sm text-white/80">{formatSize(selectedFirmware.size)}</div>
              </div>
              <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">MD5</div>
                <div className="text-xs text-white/60 font-mono break-all">{selectedFirmware.md5}</div>
              </div>
              {selectedFirmware.isDownloaded && (
                <div className="bg-surface-2/40 rounded-xl p-3 border border-white/5">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Path</div>
                  <div className="text-xs text-white/60 font-mono break-all">{selectedFirmware.path}</div>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {selectedFirmware.isDownloaded ? (
                <>
                  <button className="btn-cyber w-full flex items-center justify-center gap-2 text-xs">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Flash to Device
                  </button>
                  <button className="btn-ghost w-full flex items-center justify-center gap-2 text-xs">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Extract
                  </button>
                  <button className="btn-ghost w-full flex items-center justify-center gap-2 text-xs text-red-400 hover:bg-red-500/10">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Delete
                  </button>
                </>
              ) : (
                <button className="btn-cyber w-full flex items-center justify-center gap-2 text-xs">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download Firmware
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
            <p className="text-xs text-white/20">Choose firmware to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
