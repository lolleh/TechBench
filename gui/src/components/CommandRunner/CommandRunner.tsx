import { useState } from 'react'
import type { SavedCommand } from '../../lib/types'

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  adb: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/20' },
  fastboot: { bg: 'bg-neon-orange/10', text: 'text-neon-orange', border: 'border-neon-orange/20' },
  shell: { bg: 'bg-neon-blue/10', text: 'text-neon-blue', border: 'border-neon-blue/20' },
  custom: { bg: 'bg-neon-purple/10', text: 'text-neon-purple', border: 'border-neon-purple/20' },
}

export function CommandRunner() {
  const [commands, setCommands] = useState<SavedCommand[]>([])
  const [selectedCommand, setSelectedCommand] = useState<SavedCommand | null>(null)
  const [customCommand, setCustomCommand] = useState('')
  const [output, setOutput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  const handleRun = (_cmd: string) => {
    setIsRunning(true)
    setOutput('[INFO] No device connected. Connect a device to run commands.\n')
    setTimeout(() => setIsRunning(false), 500)
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

  const filtered = commands.filter((cmd) => {
    if (filter !== 'all' && cmd.category !== filter) return false
    return true
  })

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Command Library */}
      <div className="w-80 glass rounded-2xl p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Command Library</h2>
          <span className="text-[10px] font-mono text-white/30">{commands.length} saved</span>
        </div>

        {/* Filter */}
        <div className="flex gap-1 mb-4">
          {['all', 'adb', 'fastboot', 'shell', 'custom'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-2 py-1.5 rounded-lg border transition-all ${
                filter === f
                  ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30'
                  : 'bg-surface-2/40 text-white/40 border-white/5 hover:text-white/60'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Commands list */}
        <div className="flex-1 overflow-auto custom-scrollbar space-y-1">
          {commands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <p className="text-sm text-white/40 mb-1">No saved commands</p>
              <p className="text-xs text-white/20">Save commands below for quick access</p>
            </div>
          ) : (
            filtered.map((cmd) => {
              const colors = CATEGORY_COLORS[cmd.category] || CATEGORY_COLORS.custom
              const isSelected = selectedCommand?.id === cmd.id
              return (
                <button
                  key={cmd.id}
                  onClick={() => setSelectedCommand(cmd)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-gradient-to-r from-neon-blue/10 to-transparent border border-neon-blue/20'
                      : 'bg-surface-2/30 border border-transparent hover:bg-surface-3/30 hover:border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white/80">{cmd.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} ${colors.border} border`}>
                      {cmd.category}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-white/30 truncate">{cmd.command}</div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right - Runner */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Custom command input */}
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Run Command</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              placeholder="Enter ADB/Fastboot/shell command..."
              className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-neon-blue/30 font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customCommand.trim()) {
                  handleRun(customCommand)
                }
              }}
            />
            <button
              onClick={() => handleRun(customCommand)}
              disabled={!customCommand.trim() || isRunning}
              className="btn-cyber px-6"
            >
              {isRunning ? 'Running...' : 'Run'}
            </button>
            <button
              onClick={handleSave}
              disabled={!customCommand.trim()}
              className="btn-ghost px-4"
            >
              Save
            </button>
          </div>
        </div>

        {/* Output */}
        <div className="flex-1 glass rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] text-white/30 uppercase tracking-wider">Output</div>
            {isRunning && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                <span className="text-[10px] text-neon-green">Running</span>
              </div>
            )}
          </div>
          <div className="flex-1 bg-surface-1/50 rounded-xl p-4 border border-white/5 overflow-auto custom-scrollbar">
            <pre className="text-xs font-mono text-neon-green/70 whitespace-pre-wrap">
              {output || 'No output yet. Run a command to see results.'}
            </pre>
          </div>
        </div>

        {/* Quick commands */}
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Quick Commands</div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Devices', cmd: 'adb devices' },
              { label: 'Shell', cmd: 'adb shell' },
              { label: 'Reboot', cmd: 'adb reboot' },
              { label: 'Fastboot', cmd: 'fastboot devices' },
              { label: 'Reboot Recovery', cmd: 'adb reboot recovery' },
              { label: 'Reboot Bootloader', cmd: 'adb reboot bootloader' },
            ].map((q) => (
              <button
                key={q.label}
                onClick={() => {
                  setCustomCommand(q.cmd)
                  handleRun(q.cmd)
                }}
                className="text-[10px] px-2.5 py-1.5 rounded-lg bg-surface-2/40 text-white/50 border border-white/5 hover:text-white/70 hover:bg-surface-3/40 transition-all"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
