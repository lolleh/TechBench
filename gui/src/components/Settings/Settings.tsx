import { useState } from 'react'
import type { AppSettings } from '../../lib/types'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  adbPath: '/usr/bin/adb',
  fastbootPath: '/usr/bin/fastboot',
  dockerEnabled: true,
  autoDetectDevices: true,
  defaultContainer: 'android-tools',
  workspacePath: '/home/user/techbench-workspace',
  logRetentionDays: 30,
  showNotifications: true,
}

export function SettingsView() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [activeTab, setActiveTab] = useState<'general' | 'paths' | 'devices' | 'advanced'>('general')

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings({ ...settings, [key]: value })
  }

  const tabs = [
    { id: 'general' as const, label: 'General' },
    { id: 'paths' as const, label: 'Paths' },
    { id: 'devices' as const, label: 'Devices' },
    { id: 'advanced' as const, label: 'Advanced' },
  ]

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Tab Navigation */}
      <div className="w-48 glass rounded-2xl p-3 flex flex-col shrink-0">
        <h2 className="text-sm font-semibold text-white/80 mb-3 px-2">Settings</h2>
        <div className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20'
                  : 'text-white/50 hover:text-white/70 hover:bg-surface-2/40 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 glass rounded-2xl p-6 overflow-auto custom-scrollbar">
        {activeTab === 'general' && (
          <div className="animate-fade-in space-y-6">
            <h3 className="text-lg font-semibold text-white/90 mb-4">General Settings</h3>

            {/* Theme */}
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Theme</div>
              <div className="flex gap-2">
                {['dark', 'light', 'auto'].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => updateSetting('theme', theme as AppSettings['theme'])}
                    className={`px-4 py-2 rounded-lg text-sm capitalize transition-all ${
                      settings.theme === theme
                        ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/30'
                        : 'bg-surface-2/40 text-white/50 border border-white/5 hover:text-white/70'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between p-4 bg-surface-2/40 rounded-xl border border-white/5">
              <div>
                <div className="text-sm text-white/80">Show Notifications</div>
                <div className="text-xs text-white/30">Display system notifications</div>
              </div>
              <button
                onClick={() => updateSetting('showNotifications', !settings.showNotifications)}
                className={`w-12 h-6 rounded-full transition-all ${
                  settings.showNotifications ? 'bg-neon-green' : 'bg-surface-3'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.showNotifications ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Log Retention */}
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Log Retention</div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="90"
                  value={settings.logRetentionDays}
                  onChange={(e) => updateSetting('logRetentionDays', parseInt(e.target.value))}
                  className="flex-1 accent-neon-blue"
                />
                <span className="text-sm text-white/60 w-16 text-right">{settings.logRetentionDays} days</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'paths' && (
          <div className="animate-fade-in space-y-6">
            <h3 className="text-lg font-semibold text-white/90 mb-4">Tool Paths</h3>

            {[
              { label: 'ADB Path', key: 'adbPath' as const, placeholder: '/usr/bin/adb' },
              { label: 'Fastboot Path', key: 'fastbootPath' as const, placeholder: '/usr/bin/fastboot' },
              { label: 'Workspace Path', key: 'workspacePath' as const, placeholder: '/home/user/techbench-workspace' },
            ].map((item) => (
              <div key={item.key}>
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">{item.label}</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings[item.key]}
                    onChange={(e) => updateSetting(item.key, e.target.value)}
                    placeholder={item.placeholder}
                    className="flex-1 bg-surface-2/60 border border-white/10 rounded-lg px-4 py-2 text-sm text-white/70 font-mono placeholder:text-white/20 focus:outline-none focus:border-neon-blue/30"
                  />
                  <button className="btn-ghost text-xs px-3">Browse</button>
                </div>
              </div>
            ))}

            {/* Docker */}
            <div className="flex items-center justify-between p-4 bg-surface-2/40 rounded-xl border border-white/5">
              <div>
                <div className="text-sm text-white/80">Enable Docker</div>
                <div className="text-xs text-white/30">Use Docker containers for tools</div>
              </div>
              <button
                onClick={() => updateSetting('dockerEnabled', !settings.dockerEnabled)}
                className={`w-12 h-6 rounded-full transition-all ${
                  settings.dockerEnabled ? 'bg-neon-green' : 'bg-surface-3'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.dockerEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="animate-fade-in space-y-6">
            <h3 className="text-lg font-semibold text-white/90 mb-4">Device Settings</h3>

            {/* Auto detect */}
            <div className="flex items-center justify-between p-4 bg-surface-2/40 rounded-xl border border-white/5">
              <div>
                <div className="text-sm text-white/80">Auto-detect Devices</div>
                <div className="text-xs text-white/30">Automatically detect connected USB devices</div>
              </div>
              <button
                onClick={() => updateSetting('autoDetectDevices', !settings.autoDetectDevices)}
                className={`w-12 h-6 rounded-full transition-all ${
                  settings.autoDetectDevices ? 'bg-neon-green' : 'bg-surface-3'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.autoDetectDevices ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Default container */}
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Default Container</div>
              <select
                value={settings.defaultContainer}
                onChange={(e) => updateSetting('defaultContainer', e.target.value)}
                className="w-full bg-surface-2/60 border border-white/10 rounded-lg px-4 py-2 text-sm text-white/70 focus:outline-none focus:border-neon-blue/30"
              >
                <option value="android-tools">Android Tools</option>
                <option value="qualcomm-edl">Qualcomm EDL</option>
                <option value="mediatek-flash">MediaTek Flash</option>
                <option value="samsung-odin">Samsung Odin</option>
                <option value="apple-tools">Apple Tools</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="animate-fade-in space-y-6">
            <h3 className="text-lg font-semibold text-white/90 mb-4">Advanced Settings</h3>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span className="text-sm font-medium text-red-400">Danger Zone</span>
              </div>
              <p className="text-xs text-white/40 mb-4">These actions cannot be undone.</p>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs hover:bg-red-500/30 transition-all">
                  Reset All Settings
                </button>
                <button className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs hover:bg-red-500/30 transition-all">
                  Clear All Data
                </button>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">About</div>
              <div className="bg-surface-2/40 rounded-xl p-4 border border-white/5 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Version</span>
                  <span className="text-white/60 font-mono">0.1.0</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Build</span>
                  <span className="text-white/60 font-mono">2024.01.26</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">License</span>
                  <span className="text-white/60">MIT</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="mt-8 pt-4 border-t border-white/5 flex justify-end gap-2">
          <button
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="btn-ghost text-xs"
          >
            Reset to Defaults
          </button>
          <button className="btn-cyber text-xs">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
