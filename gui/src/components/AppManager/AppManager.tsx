import { useState, useCallback, useEffect } from 'react'
import { tauri } from '../../lib/tauri'
import type { InstalledApp, AppAction, AppActionExecution, OperationStatus } from '../../lib/types'

const STATUS_COLORS: Record<OperationStatus, { bg: string; text: string }> = {
  idle: { bg: 'bg-white/5', text: 'text-white/40' },
  running: { bg: 'bg-neon-blue/10', text: 'text-neon-blue' },
  success: { bg: 'bg-neon-green/10', text: 'text-neon-green' },
  error: { bg: 'bg-red-500/10', text: 'text-red-400' },
  cancelled: { bg: 'bg-white/5', text: 'text-white/30' },
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

interface AppManagerProps {
  deviceSerial: string | null
  deviceName?: string | null
}

export function AppManager({ deviceSerial, deviceName }: AppManagerProps) {
  const [apps, setApps] = useState<InstalledApp[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'system' | 'user' | 'disabled'>('all')
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null)
  const [executions, setExecutions] = useState<Record<string, AppActionExecution>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadApps = useCallback(async () => {
    if (!deviceSerial) {
      setApps([])
      setLoadError(null)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const deviceIdentifier = deviceName || deviceSerial
      const packageList = await tauri.invoke(
        'adb_list_apps',
        { device: deviceIdentifier, includeSystem: true }
      ) as Array<{ packageName: string; isSystem: boolean }>

      const detailedApps: InstalledApp[] = []

      for (const pkg of packageList) {
        try {
          const details = await tauri.invoke(
            'adb_get_app_details',
            { device: deviceIdentifier, packageName: pkg.packageName }
          ) as Record<string, unknown>

          if (details) {
            detailedApps.push({
              id: pkg.packageName,
              packageName: pkg.packageName,
              appName: (details.appName as string) || pkg.packageName.split('.').pop() || pkg.packageName,
              version: (details.version as string) || 'unknown',
              versionCode: (details.versionCode as number) || 0,
              size: (details.size as number) || 0,
              installDate: (details.installDate as string) || 'unknown',
              updateDate: (details.updateDate as string) || null,
              isSystem: pkg.isSystem,
              isDisabled: (details.isDisabled as boolean) || false,
              isUpdated: (details.isUpdated as boolean) || false,
              permissions: (details.permissions as string[]) || [],
              apkPath: (details.apkPath as string) || '',
              dataPath: (details.dataPath as string) || '',
              targetSdk: (details.targetSdk as number) || 0,
              minSdk: (details.minSdk as number) || 0,
            })
          }
        } catch {
          detailedApps.push({
            id: pkg.packageName,
            packageName: pkg.packageName,
            appName: pkg.packageName.split('.').pop() || pkg.packageName,
            version: 'unknown',
            versionCode: 0,
            size: 0,
            installDate: 'unknown',
            updateDate: null,
            isSystem: pkg.isSystem,
            isDisabled: false,
            isUpdated: false,
            permissions: [],
            apkPath: '',
            dataPath: '',
            targetSdk: 0,
            minSdk: 0,
          })
        }
      }

      detailedApps.sort((a, b) => a.appName.localeCompare(b.appName))
      setApps(detailedApps)
    } catch (err) {
      setLoadError(`Failed to load apps: ${err}`)
      setApps([])
    } finally {
      setIsLoading(false)
    }
  }, [deviceSerial, deviceName])

  useEffect(() => {
    loadApps()
  }, [loadApps])

  const filteredApps = apps.filter((app) => {
    if (search && !app.appName.toLowerCase().includes(search.toLowerCase()) && !app.packageName.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'system' && !app.isSystem) return false
    if (filter === 'user' && app.isSystem) return false
    if (filter === 'disabled' && !app.isDisabled) return false
    return true
  })

  const systemCount = apps.filter((a) => a.isSystem).length
  const userCount = apps.filter((a) => !a.isSystem).length

  const handleAction = useCallback(async (app: InstalledApp, action: AppAction) => {
    if (!deviceSerial) return

    const execId = `${app.packageName}-${action}-${Date.now()}`
    const actionLabels: Record<AppAction, string> = {
      uninstall: 'Uninstalling',
      force_uninstall: 'Force uninstalling',
      disable: 'Disabling',
      enable: 'Enabling',
      clear_data: 'Clearing data',
      force_stop: 'Force stopping',
      upgrade: 'Upgrading',
    }

    const adbCommands: Record<AppAction, string> = {
      uninstall: `uninstall ${app.packageName}`,
      force_uninstall: `uninstall -k ${app.packageName}`,
      disable: `pm disable-user --user 0 ${app.packageName}`,
      enable: `pm enable ${app.packageName}`,
      clear_data: `pm clear ${app.packageName}`,
      force_stop: `am force-stop ${app.packageName}`,
      upgrade: `install -r ${app.packageName}`,
    }

    setExecutions((prev) => ({
      ...prev,
      [execId]: {
        id: execId,
        appPackage: app.packageName,
        action,
        status: 'running',
        progress: 0,
        output: `[ADB] ${actionLabels[action]} ${app.appName}...\n`,
        startTime: new Date(),
      },
    }))

    try {
      const deviceIdentifier = deviceName || deviceSerial

      setExecutions((prev) => ({
        ...prev,
        [execId]: {
          ...prev[execId],
          progress: 30,
          output: prev[execId].output + `[${new Date().toLocaleTimeString()}] Executing: adb -s ${deviceSerial} shell ${adbCommands[action]}\n`,
        },
      }))

      const result = await tauri.invoke(
        action === 'upgrade' ? 'adb_upgrade_app' :
        action === 'uninstall' || action === 'force_uninstall' ? 'adb_uninstall_app' :
        action === 'disable' ? 'adb_disable_app' :
        action === 'enable' ? 'adb_enable_app' :
        action === 'clear_data' ? 'adb_clear_app_data' :
        'adb_force_stop_app',
        {
          device: deviceIdentifier,
          packageName: app.packageName,
          force: action === 'force_uninstall',
        }
      ) as { success: boolean; message: string }

      setExecutions((prev) => ({
        ...prev,
        [execId]: {
          ...prev[execId],
          progress: 100,
          status: result.success ? 'success' : 'error',
          endTime: new Date(),
          error: result.success ? undefined : result.message,
          output: prev[execId].output + (result.success ? `[OK] ${result.message}\n` : `[ERROR] ${result.message}\n`),
        },
      }))

      if (result.success && (action === 'uninstall' || action === 'force_uninstall')) {
        setApps((prev) => prev.filter((a) => a.packageName !== app.packageName))
        setSelectedApp(null)
      }
      if (result.success && action === 'disable') {
        setApps((prev) => prev.map((a) => a.packageName === app.packageName ? { ...a, isDisabled: true } : a))
      }
      if (result.success && action === 'enable') {
        setApps((prev) => prev.map((a) => a.packageName === app.packageName ? { ...a, isDisabled: false } : a))
      }
    } catch (err) {
      setExecutions((prev) => ({
        ...prev,
        [execId]: {
          ...prev[execId],
          status: 'error',
          progress: 100,
          endTime: new Date(),
          error: String(err),
          output: prev[execId].output + `[ERROR] ${err}\n`,
        },
      }))
    }
  }, [deviceSerial, deviceName])

  return (
    <div className="flex h-full gap-4">
      {/* App List */}
      <div className="flex-1 glass rounded-2xl p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80">Installed Applications</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/30">{filteredApps.length} apps</span>
            <button
              onClick={loadApps}
              disabled={isLoading || !deviceSerial}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20 transition-all disabled:opacity-40"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5 text-center">
            <div className="text-lg font-bold text-white/90">{apps.length}</div>
            <div className="text-[9px] text-white/30">Total</div>
          </div>
          <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5 text-center">
            <div className="text-lg font-bold text-neon-blue">{systemCount}</div>
            <div className="text-[9px] text-white/30">System</div>
          </div>
          <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5 text-center">
            <div className="text-lg font-bold text-neon-green">{userCount}</div>
            <div className="text-[9px] text-white/30">User</div>
          </div>
        </div>

        {/* Error */}
        {loadError && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs border border-red-500/20">
            {loadError}
          </div>
        )}

        {/* No Device */}
        {!deviceSerial && !isLoading && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-neon-blue/10 text-neon-blue text-xs border border-neon-blue/20">
            Connect a device via USB or Wi-Fi to view installed apps
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps..."
            className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-neon-blue/30"
          />
          <div className="flex gap-1">
            {[
              { label: 'All', value: 'all' as const },
              { label: 'User', value: 'user' as const },
              { label: 'System', value: 'system' as const },
              { label: 'Disabled', value: 'disabled' as const },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`text-[10px] px-2 py-1.5 rounded-lg border transition-all ${
                  filter === f.value
                    ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30'
                    : 'bg-surface-2/40 text-white/40 border-white/5 hover:text-white/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* App List */}
        <div className="flex-1 overflow-auto custom-scrollbar space-y-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin mb-3" />
              <p className="text-sm text-white/40">Fetching installed apps...</p>
              <p className="text-xs text-white/20 mt-1">Running: adb shell pm list packages</p>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-surface-3/50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <p className="text-sm text-white/40 mb-1">{deviceSerial ? 'No apps found' : 'No device connected'}</p>
              <p className="text-xs text-white/20">{deviceSerial ? 'Try refreshing the app list' : 'Connect a device to begin'}</p>
            </div>
          ) : (
            filteredApps.map((app) => {
              const isSelected = selectedApp?.packageName === app.packageName
              const exec = Object.values(executions).find((e) => e.appPackage === app.packageName && e.status === 'running')

              return (
                <button
                  key={app.packageName}
                  onClick={() => setSelectedApp(app)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                    isSelected
                      ? 'bg-gradient-to-r from-neon-blue/10 to-transparent border border-neon-blue/20'
                      : 'bg-surface-2/30 border border-transparent hover:bg-surface-3/30 hover:border-white/5'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${
                    app.isSystem ? 'bg-neon-blue/10 text-neon-blue' : 'bg-neon-green/10 text-neon-green'
                  }`}>
                    {app.appName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/80 truncate">{app.appName}</span>
                      {app.isSystem && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-blue/10 text-neon-blue border border-neon-blue/20">SYS</span>
                      )}
                      {app.isUpdated && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-orange/10 text-neon-orange border border-neon-orange/20">UPD</span>
                      )}
                      {app.isDisabled && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/10">OFF</span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/30 font-mono truncate">{app.packageName}</div>
                    <div className="flex items-center gap-3 text-[10px] text-white/20 mt-0.5">
                      <span>v{app.version}</span>
                      {app.size > 0 && <span>{formatSize(app.size)}</span>}
                    </div>
                  </div>
                  {exec && (
                    <div className="w-5 h-5 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin shrink-0" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* App Details */}
      <div className="w-96 glass rounded-2xl p-4 flex flex-col shrink-0">
        {selectedApp ? (
          <div className="animate-fade-in flex flex-col h-full">
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                selectedApp.isSystem ? 'bg-neon-blue/10 text-neon-blue' : 'bg-neon-green/10 text-neon-green'
              }`}>
                {selectedApp.appName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white/90 truncate">{selectedApp.appName}</h3>
                <div className="text-[10px] text-white/30 font-mono truncate">{selectedApp.packageName}</div>
              </div>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
                <div className="text-[9px] text-white/30 uppercase">Version</div>
                <div className="text-xs text-white/70 font-mono">{selectedApp.version}</div>
              </div>
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
                <div className="text-[9px] text-white/30 uppercase">Size</div>
                <div className="text-xs text-white/70">{selectedApp.size > 0 ? formatSize(selectedApp.size) : 'N/A'}</div>
              </div>
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
                <div className="text-[9px] text-white/30 uppercase">Target SDK</div>
                <div className="text-xs text-white/70">{selectedApp.targetSdk || 'N/A'}</div>
              </div>
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
                <div className="text-[9px] text-white/30 uppercase">Min SDK</div>
                <div className="text-xs text-white/70">{selectedApp.minSdk || 'N/A'}</div>
              </div>
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
                <div className="text-[9px] text-white/30 uppercase">Installed</div>
                <div className="text-xs text-white/70 font-mono">{selectedApp.installDate}</div>
              </div>
              <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5">
                <div className="text-[9px] text-white/30 uppercase">Type</div>
                <div className="text-xs text-white/70">{selectedApp.isSystem ? 'System' : 'User'}</div>
              </div>
              {selectedApp.apkPath && (
                <div className="bg-surface-2/40 rounded-lg p-2 border border-white/5 col-span-2">
                  <div className="text-[9px] text-white/30 uppercase">APK Path</div>
                  <div className="text-[10px] text-white/50 font-mono truncate">{selectedApp.apkPath}</div>
                </div>
              )}
            </div>

            {/* Permissions */}
            {selectedApp.permissions.length > 0 && (
              <div className="mb-4">
                <div className="text-[9px] text-white/30 uppercase tracking-wider mb-2">Permissions ({selectedApp.permissions.length})</div>
                <div className="max-h-20 overflow-auto custom-scrollbar space-y-1">
                  {selectedApp.permissions.map((perm) => (
                    <div key={perm} className="text-[10px] text-white/40 font-mono bg-surface-1/30 rounded px-2 py-1">
                      {perm}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-auto space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(selectedApp, 'upgrade')}
                  className="flex-1 btn-cyber flex items-center justify-center gap-1.5 text-xs"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Upgrade
                </button>
                <button
                  onClick={() => handleAction(selectedApp, selectedApp.isDisabled ? 'enable' : 'disable')}
                  className="flex-1 btn-ghost flex items-center justify-center gap-1.5 text-xs"
                >
                  {selectedApp.isDisabled ? 'Enable' : 'Disable'}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(selectedApp, 'clear_data')}
                  className="flex-1 btn-ghost flex items-center justify-center gap-1.5 text-xs"
                >
                  Clear Data
                </button>
                <button
                  onClick={() => handleAction(selectedApp, 'force_stop')}
                  className="flex-1 btn-ghost flex items-center justify-center gap-1.5 text-xs"
                >
                  Force Stop
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(selectedApp, 'uninstall')}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition-all"
                >
                  Uninstall
                </button>
                <button
                  onClick={() => handleAction(selectedApp, 'force_uninstall')}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium hover:bg-red-500/30 transition-all"
                >
                  Force Uninstall
                </button>
              </div>
            </div>

            {/* Execution Output */}
            {Object.values(executions).filter((e) => e.appPackage === selectedApp.packageName).length > 0 && (
              <div className="mt-3 bg-surface-1/50 rounded-xl p-3 border border-white/5 max-h-32 overflow-auto custom-scrollbar">
                {Object.values(executions)
                  .filter((e) => e.appPackage === selectedApp.packageName)
                  .slice(-2)
                  .map((exec) => (
                    <div key={exec.id} className="mb-2 last:mb-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-white/40 capitalize">{exec.action.replace('_', ' ')}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[exec.status].bg} ${STATUS_COLORS[exec.status].text}`}>
                          {exec.status}
                        </span>
                      </div>
                      <pre className="text-[9px] font-mono text-neon-green/60 whitespace-pre-wrap">
                        {exec.output}
                      </pre>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-3/30 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <p className="text-sm text-white/40 mb-1">Select an app</p>
            <p className="text-xs text-white/20">Choose an app to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
