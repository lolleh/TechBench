import { useState } from 'react'
import type { SavedCommand } from '../../lib/types'
import { useDeviceStore } from '../../lib/deviceStore'
import { tauri } from '../../lib/tauri'

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  adb: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/20' },
  fastboot: { bg: 'bg-neon-orange/10', text: 'text-neon-orange', border: 'border-neon-orange/20' },
  apple: { bg: 'bg-white/10', text: 'text-white/70', border: 'border-white/10' },
  shell: { bg: 'bg-neon-blue/10', text: 'text-neon-blue', border: 'border-neon-blue/20' },
  custom: { bg: 'bg-neon-purple/10', text: 'text-neon-purple', border: 'border-neon-purple/20' },
}

interface PresetCommand {
  name: string
  command: string
  category: SavedCommand['category']
  description: string
}

const PRESET_COMMANDS: PresetCommand[] = [
  // --- Android / ADB ---
  { name: 'List ADB Devices', command: 'adb devices', category: 'adb', description: 'List connected ADB devices' },
  { name: 'Device Model', command: 'adb shell getprop ro.product.model', category: 'adb', description: 'Read device model' },
  { name: 'Android Version', command: 'adb shell getprop ro.build.version.release', category: 'adb', description: 'Read Android OS version' },
  { name: 'Security Patch', command: 'adb shell getprop ro.build.version.security_patch', category: 'adb', description: 'Read security patch level' },
  { name: 'IMEI', command: 'adb shell getprop gsm.imei', category: 'adb', description: 'Read IMEI (if exposed)' },
  { name: 'CPU Info', command: 'adb shell cat /proc/cpuinfo', category: 'adb', description: 'Dump CPU details' },
  { name: 'Memory Info', command: 'adb shell cat /proc/meminfo', category: 'adb', description: 'Dump memory usage' },
  { name: 'Battery Health', command: 'adb shell dumpsys battery', category: 'adb', description: 'Battery level, temp, health' },
  { name: 'Storage Usage', command: 'adb shell df -h', category: 'adb', description: 'Filesystem / storage usage' },
  { name: 'Display Size', command: 'adb shell wm size', category: 'adb', description: 'Read screen resolution' },
  { name: 'Network IP', command: 'adb shell ip addr show wlan0', category: 'adb', description: 'Wi-Fi IP address' },
  { name: 'Installed Apps', command: 'adb shell pm list packages -3', category: 'adb', description: 'List third-party packages' },
  { name: 'Top Activity', command: 'adb shell dumpsys activity top | head -80', category: 'adb', description: 'Foreground app details' },
  { name: 'Recent Logcat', command: 'adb logcat -d -t 200', category: 'adb', description: 'Last 200 logcat lines' },
  { name: 'Uptime', command: 'adb shell uptime', category: 'adb', description: 'Device uptime / load' },
  { name: 'Reboot', command: 'adb reboot', category: 'adb', description: 'Restart the device' },
  { name: 'Reboot to Recovery', command: 'adb reboot recovery', category: 'adb', description: 'Boot into recovery mode' },
  { name: 'Reboot to Bootloader', command: 'adb reboot bootloader', category: 'adb', description: 'Boot into fastboot mode' },
  // --- Android / Fastboot ---
  { name: 'List Fastboot Devices', command: 'fastboot devices', category: 'fastboot', description: 'List devices in fastboot mode' },
  { name: 'Fastboot Version', command: 'fastboot getvar version', category: 'fastboot', description: 'Read bootloader protocol version' },
  { name: 'All Fastboot Vars', command: 'fastboot getvar all', category: 'fastboot', description: 'Dump all bootloader variables' },
  { name: 'Bootloader State', command: 'fastboot oem device-info', category: 'fastboot', description: 'Unlock / flashing state' },
  { name: 'Reboot from Fastboot', command: 'fastboot reboot', category: 'fastboot', description: 'Restart out of fastboot' },
  { name: 'Reboot to Fastboot', command: 'fastboot reboot bootloader', category: 'fastboot', description: 'Stay / re-enter fastboot' },
  { name: 'Reboot to Recovery', command: 'fastboot reboot recovery', category: 'fastboot', description: 'Boot recovery from fastboot' },
  // --- Apple / idevice ---
  { name: 'Device Info', command: 'ideviceinfo', category: 'apple', description: 'Full device properties (model, iOS, serial)' },
  { name: 'List UDIDs', command: 'idevice_id -l', category: 'apple', description: 'List connected device UDIDs' },
  { name: 'Device Name', command: 'idevicename', category: 'apple', description: 'Read device name' },
  { name: 'Device Date', command: 'idevicedate', category: 'apple', description: 'Read device date/time' },
  { name: 'Battery (Diagnostics)', command: 'idevicediagnostics diagnostics GasGauge', category: 'apple', description: 'Battery / gas gauge status' },
  { name: 'IORegistry', command: 'idevicediagnostics ioreg', category: 'apple', description: 'Raw IORegistry dump' },
  { name: 'Installed Apps', command: 'ideviceinstaller list --all', category: 'apple', description: 'List all installed apps' },
  { name: 'Paired Devices', command: 'idevicepair list', category: 'apple', description: 'Show pairing status' },
  { name: 'Mounted Images', command: 'ideviceimagemounter -l', category: 'apple', description: 'List mounted disk images' },
  { name: 'Provisioning Profiles', command: 'ideviceprovision list', category: 'apple', description: 'List installed provisioning profiles' },
  { name: 'Crash Reports', command: 'idevicecrashreport -e data/crashes', category: 'apple', description: 'Collect crash logs to data/crashes' },
  { name: 'Screenshot', command: 'idevicescreenshot data/screenshot.png', category: 'apple', description: 'Capture screen to file (needs dev disk image)' },
  { name: 'Enter Recovery Mode', command: 'ideviceenterrecovery', category: 'apple', description: 'Reboot device into recovery mode' },
  // --- Shell / system ---
  { name: 'USB Devices', command: 'lsusb', category: 'shell', description: 'Enumerate USB buses' },
]

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'apple', label: 'Apple' },
  { id: 'adb', label: 'Android' },
  { id: 'fastboot', label: 'Fastboot' },
  { id: 'shell', label: 'Shell' },
  { id: 'custom', label: 'Custom' },
]

export function CommandRunner() {
  const [commands, setCommands] = useState<SavedCommand[]>(
    PRESET_COMMANDS.map((p, i) => ({ ...p, id: `preset-${i}`, runCount: 0 }))
  )
  const [selectedCommand, setSelectedCommand] = useState<SavedCommand | null>(null)
  const [customCommand, setCustomCommand] = useState('')
  const [output, setOutput] = useState('')
  const [lastError, setLastError] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const devices = useDeviceStore((s) => s.devices)
  const selectedDeviceId = useDeviceStore((s) => s.selectedDeviceId)
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) ?? null

  const deviceMode = selectedDevice
    ? selectedDevice.deviceType === 'apple' ? 'apple' : selectedDevice.bootMode
    : null

  const toolOf = (command: string): string => {
    const first = command.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
    if (first === 'adb') return 'adb'
    if (first === 'fastboot') return 'fastboot'
    if (first.startsWith('idevice') || first === 'irecovery') return 'apple'
    return 'shell'
  }

  const run = async (command: string) => {
    if (!command.trim()) return
    const tool = toolOf(command)
    let serial: string | null = null
    let notice = ''

    if (selectedDevice) {
      const isApple = selectedDevice.deviceType === 'apple'
      const first = command.trim().split(/\s+/)[0]
      if (tool === 'adb' && !isApple && ['normal', 'recovery', 'adb'].includes(selectedDevice.bootMode)) {
        serial = selectedDevice.serial
      } else if (tool === 'fastboot' && !isApple && selectedDevice.bootMode === 'fastboot') {
        serial = selectedDevice.serial
      } else if (tool === 'apple' && isApple) {
        serial = selectedDevice.serial
      } else if (tool === 'apple' && !isApple) {
        notice = `[WARN] '${first}' targets an Apple device, but the selected device is ${selectedDevice.productName} (${selectedDevice.deviceType}). Running without a device.\n\n`
      } else if ((tool === 'adb' || tool === 'fastboot') && isApple) {
        notice = `[WARN] '${first}' targets an Android device, but the selected device is an iPhone. Running globally (no serial).\n\n`
      } else if (tool === 'adb' || tool === 'fastboot') {
        notice = `[WARN] '${first}' targets ${tool} mode, but the selected device is in ${selectedDevice.bootMode} mode. Running globally (no serial).\n\n`
      }
    }

    setIsRunning(true)
    setOutput('')
    setLastError('')
    const result = await tauri.runCommand(command.trim(), serial, deviceMode ?? 'usb')
    setOutput(notice + result.output)
    setLastError(result.success ? '' : (result.error || 'Command failed'))
    setIsRunning(false)
    if (selectedCommand && selectedCommand.command === command.trim()) {
      setCommands((prev) =>
        prev.map((c) =>
          c.id === selectedCommand.id ? { ...c, runCount: c.runCount + 1, lastRun: new Date() } : c
        )
      )
    }
  }

  const handleRun = (command: string) => {
    run(command)
  }

  const handleSave = () => {
    if (!customCommand.trim()) return
    const newCmd: SavedCommand = {
      id: `custom-${Date.now()}`,
      name: `Custom ${commands.filter((c) => c.category === 'custom').length + 1}`,
      command: customCommand,
      category: customCommand.startsWith('adb')
        ? 'adb'
        : customCommand.startsWith('fastboot')
          ? 'fastboot'
          : customCommand.startsWith('idevice') || customCommand.startsWith('irecovery')
            ? 'apple'
            : 'custom',
      runCount: 0,
    }
    setCommands([...commands, newCmd])
    setCustomCommand('')
  }

  const filtered = commands.filter((cmd) => filter === 'all' || cmd.category === filter)

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Left - Command Library */}
      <div className="w-96 glass rounded-2xl p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Command Library</h2>
          <span className="text-[10px] font-mono text-white/30">{commands.length} saved</span>
        </div>

        {/* Filter */}
        <div className="flex gap-1 mb-4 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-[10px] px-2 py-1.5 rounded-lg border transition-all ${
                filter === f.id
                  ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30'
                  : 'bg-surface-2/40 text-white/40 border-white/5 hover:text-white/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Commands list */}
        <div className="flex-1 overflow-auto custom-scrollbar space-y-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <p className="text-sm text-white/40 mb-1">No commands in this category</p>
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
                  {cmd.description && (
                    <div className="text-[10px] text-white/25 mt-0.5 truncate">{cmd.description}</div>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right - Runner */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Run command */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] text-white/30 uppercase tracking-wider">Run Command</div>
            {selectedDevice && (
              <div className="text-[10px] font-mono text-neon-green/70">
                {selectedDevice.productName} · {selectedDevice.serial ?? 'no serial'}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              placeholder={selectedCommand ? selectedCommand.command : 'Enter ADB/Fastboot/idevice command...'}
              className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-neon-blue/30 font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customCommand.trim()) {
                  handleRun(customCommand)
                }
              }}
            />
            <button
              onClick={() => handleRun(customCommand || (selectedCommand?.command ?? ''))}
              disabled={(!customCommand.trim() && !selectedCommand) || isRunning}
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
          {selectedCommand && !customCommand && (
            <div className="mt-2 text-[10px] text-white/30">
              Loaded: <span className="text-white/50 font-mono">{selectedCommand.command}</span>
              {selectedCommand.description && <span> — {selectedCommand.description}</span>}
            </div>
          )}
        </div>

        {/* Output */}
        <div className="flex-1 glass rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] text-white/30 uppercase tracking-wider">Output</div>
            <div className="flex items-center gap-3">
              {lastError && <span className="text-[10px] text-red-400">{lastError}</span>}
              {isRunning && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                  <span className="text-[10px] text-neon-green">Running</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 bg-surface-1/50 rounded-xl p-4 border border-white/5 overflow-auto custom-scrollbar">
            <pre className="text-xs font-mono text-neon-green/70 whitespace-pre-wrap">
              {output || (isRunning ? 'Running command...' : 'No output yet. Select a command and press Run.')}
            </pre>
          </div>
        </div>

        {/* Quick commands */}
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Quick Commands</div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'ADB Devices', cmd: 'adb devices' },
              { label: 'Android Version', cmd: 'adb shell getprop ro.build.version.release' },
              { label: 'Battery', cmd: 'adb shell dumpsys battery' },
              { label: 'Reboot', cmd: 'adb reboot' },
              { label: 'Reboot Recovery', cmd: 'adb reboot recovery' },
              { label: 'Fastboot Devices', cmd: 'fastboot devices' },
              { label: 'Bootloader State', cmd: 'fastboot oem device-info' },
              { label: 'Apple Info', cmd: 'ideviceinfo' },
              { label: 'Apple UDID', cmd: 'idevice_id -l' },
              { label: 'Apple Name', cmd: 'idevicename' },
              { label: 'Apple Battery', cmd: 'idevicediagnostics diagnostics GasGauge' },
              { label: 'Apple Recovery', cmd: 'ideviceenterrecovery' },
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
