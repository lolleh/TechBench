import { useState } from 'react'
import type { SavedCommand } from '../../lib/types'

const MOCK_COMMANDS: SavedCommand[] = [
  { id: '1', name: 'Get Device Info', command: 'adb shell getprop ro.product.model', category: 'adb', description: 'Get device model name', lastRun: new Date(Date.now() - 60000), runCount: 12 },
  { id: '2', name: 'List Partitions', command: 'adb shell ls /dev/block/bootdevice/by-name/', category: 'adb', description: 'List all partition names', lastRun: new Date(Date.now() - 120000), runCount: 8 },
  { id: '3', name: 'Check Battery', command: 'adb shell dumpsys battery', category: 'adb', description: 'Get battery status', lastRun: new Date(Date.now() - 180000), runCount: 5 },
  { id: '4', name: 'Fastboot Devices', command: 'fastboot devices', category: 'fastboot', description: 'List connected fastboot devices', lastRun: new Date(Date.now() - 300000), runCount: 15 },
  { id: '5', name: 'Flash Boot', command: 'fastboot flash boot boot.img', category: 'fastboot', description: 'Flash boot partition', lastRun: null, runCount: 0 },
  { id: '6', name: 'Unlock Bootloader', command: 'fastboot oem unlock', category: 'fastboot', description: 'Unlock device bootloader', lastRun: null, runCount: 0 },
  { id: '7', name: 'System Info', command: 'cat /proc/version && uname -a', category: 'shell', description: 'Get system version info', lastRun: new Date(Date.now() - 600000), runCount: 3 },
  { id: '8', name: 'Clear Cache', command: 'adb shell pm clear com.android.providers.calendar', category: 'custom', description: 'Clear calendar cache', lastRun: null, runCount: 0 },
]

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  adb: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/20' },
  fastboot: { bg: 'bg-neon-orange/10', text: 'text-neon-orange', border: 'border-neon-orange/20' },
  shell: { bg: 'bg-neon-blue/10', text: 'text-neon-blue', border: 'border-neon-blue/20' },
  custom: { bg: 'bg-neon-purple/10', text: 'text-neon-purple', border: 'border-neon-purple/20' },
}

const MOCK_OUTPUT = `[OK] Device connected: Lenovo Tab M11
[OK] Serial: HT892XYZ
[OK] Android version: 13
[OK] Security patch: 2024-01-05
[OK] Build: TB330FU_S123_240115
[OK] Kernel: 5.10.101-android13-4-gb3f2c8d1
[OK] SELinux: Enforcing
[OK] Battery: 87% (health: good)
[OK] Storage: 48.2GB / 128GB (37.7% used)`

export function CommandRunner() {
  const [commands, setCommands] = useState(MOCK_COMMANDS)
  const [selectedCommand, setSelectedCommand] = useState<SavedCommand | null>(null)
  const [customCommand, setCustomCommand] = useState('')
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  const handleRun = (cmd: string) => {
    setIsRunning(true)
    setOutput('')
    let i = 0
    const lines = MOCK_OUTPUT.split('\n')
    const interval = setInterval(() => {
      if (i < lines.length) {
        setOutput((prev) => prev + lines[i] + '\n')
        i++
      } else {
        clearInterval(interval)
        setIsRunning(false)
      }
    }, 100)
  }

  const handleSave = () => {
    if (!customCommand.trim()) return
    const newCmd: SavedCommand = {
      id: String(Date.now()),
      name: `Custom ${commands.length + 1}`,
      command: customCommand,
      category: customCommand.startsWith('adb') ? 'adb' : customCommand.startsWith('fastboot') ? 'fastboot' : 'custom',
      runCount: 0,
    }
    setCommands([...commands, newCmd])
    setCustomCommand('')
  }

  const filtered = commands.filter((c) => filter === 'all' || c.category === filter)

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Command List */}
      <div className="w-80 glass rounded-2xl p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Saved Commands</h2>
          <span className="text-[10px] font-mono text-white/30 px-2 py-0.5 rounded-full bg-surface-3">
            {commands.length}
          </span>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {['all', 'adb', 'fastboot', 'shell', 'custom'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                filter === f
                  ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30'
                  : 'bg-surface-2/40 text-white/40 border-white/5 hover:text-white/60'
              }`}
            >
              {f === 'all' ? 'All' : f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Command list */}
        <div className="flex-1 overflow-auto custom-scrollbar space-y-2">
          {filtered.map((cmd) => {
            const colors = CATEGORY_COLORS[cmd.category]
            const isSelected = selectedCommand?.id === cmd.id
            return (
              <button
                key={cmd.id}
                onClick={() => { setSelectedCommand(cmd); setCustomCommand(cmd.command) }}
                className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-r from-neon-blue/10 to-transparent border border-neon-blue/20'
                    : 'bg-surface-2/40 border border-transparent hover:bg-surface-3/40 hover:border-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white/80 truncate">{cmd.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} ${colors.border} border`}>
                    {cmd.category.toUpperCase()}
                  </span>
                </div>
                <div className="text-[11px] text-white/30 font-mono truncate">{cmd.command}</div>
                {cmd.description && (
                  <div className="text-[10px] text-white/20 mt-1">{cmd.description}</div>
                )}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-white/20">
                  <span>Run {cmd.runCount}x</span>
                  {cmd.lastRun && <span>Last: {cmd.lastRun.toLocaleDateString()}</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right - Command Editor & Output */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Command input */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white/80">Command</h3>
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn-ghost text-xs flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                Save
              </button>
              <button
                onClick={() => handleRun(customCommand)}
                disabled={isRunning || !customCommand.trim()}
                className="btn-cyber text-xs flex items-center gap-1.5 disabled:opacity-40"
              >
                {isRunning ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                    Run
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <select className="bg-surface-2/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-neon-blue/30">
              <option value="local">Local</option>
              <option value="docker">Docker Container</option>
              <option value="device">On Device</option>
            </select>
            <input
              type="text"
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              placeholder="Enter command... (adb, fastboot, or shell)"
              className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-4 py-2 text-sm text-white/80 font-mono placeholder:text-white/20 focus:outline-none focus:border-neon-blue/30"
              onKeyDown={(e) => e.key === 'Enter' && handleRun(customCommand)}
            />
          </div>
        </div>

        {/* Output */}
        <div className="flex-1 glass rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white/80">Output</h3>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/30 font-mono">
                {isRunning ? 'Running...' : output ? 'Complete' : 'Ready'}
              </span>
              <button
                onClick={() => setOutput('')}
                className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar bg-surface-1/50 rounded-xl p-4 border border-white/5">
            <pre className="text-xs font-mono text-neon-green/80 whitespace-pre-wrap leading-relaxed">
              {output || '$ _'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
