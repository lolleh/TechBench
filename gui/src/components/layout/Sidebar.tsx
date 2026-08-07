import { useState } from 'react'

interface SidebarProps {
  activeView: string
  onViewChange: (view: any) => void
}

const NAV_ITEMS = [
  {
    id: 'devices',
    label: 'Devices',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
    color: 'neon-blue',
  },
  {
    id: 'mirror',
    label: 'Mirror',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
    ),
    color: 'neon-pink',
  },
  {
    id: 'signal',
    label: 'Signal',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    ),
    color: 'neon-green',
  },
  {
    id: 'schematic',
    label: 'Schematic',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11.42 15.17l-5.1-5.1m0 0L11.42 4.97m-5.1 5.1H21M3 3v18" />
      </svg>
    ),
    color: 'neon-purple',
  },
  {
    id: 'power',
    label: 'Power',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    color: 'neon-yellow',
  },
  {
    id: 'flash',
    label: 'Flash',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
    color: 'neon-orange',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
      </svg>
    ),
    color: 'neon-cyan',
  },
  {
    id: 'history',
    label: 'History',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'neon-blue',
  },
  {
    id: 'partitions',
    label: 'Partitions',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    color: 'neon-green',
  },
  {
    id: 'commands',
    label: 'Commands',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    color: 'neon-purple',
  },
  {
    id: 'health',
    label: 'Health',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    color: 'neon-orange',
  },
  {
    id: 'batch',
    label: 'Batch',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
    color: 'neon-yellow',
  },
  {
    id: 'firmware',
    label: 'Firmware',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    color: 'neon-cyan',
  },
  {
    id: 'jailbreak',
    label: 'Jailbreak',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M7.5 11.5v-2a4.5 4.5 0 119 0v2m-11.25 3h13.5a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-6a1.5 1.5 0 011.5-1.5z" />
        <path d="M9.75 16a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5zm4.5 0a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" />
      </svg>
    ),
    color: 'neon-red',
  },
  {
    id: 'icloud',
    label: 'iCloud',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
      </svg>
    ),
    color: 'neon-cyan',
  },
  {
    id: 'appletools',
    label: 'VEE',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11.42 15.17l-5.1-5.1m0 0L11.42 4.97m-5.1 5.1H21M3 3v18" />
      </svg>
    ),
    color: 'neon-yellow',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: 'neon-blue',
  },
]

const COLOR_MAP: Record<string, { active: string; hover: string; text: string; glow: string }> = {
  'neon-blue': {
    active: 'bg-neon-blue/10 border-neon-blue/40 text-neon-blue shadow-lg shadow-neon-blue/10',
    hover: 'hover:bg-neon-blue/5 hover:text-neon-blue',
    text: 'text-neon-blue',
    glow: 'shadow-neon-blue/20',
  },
  'neon-green': {
    active: 'bg-neon-green/10 border-neon-green/40 text-neon-green shadow-lg shadow-neon-green/10',
    hover: 'hover:bg-neon-green/5 hover:text-neon-green',
    text: 'text-neon-green',
    glow: 'shadow-neon-green/20',
  },
  'neon-purple': {
    active: 'bg-neon-purple/10 border-neon-purple/40 text-neon-purple shadow-lg shadow-neon-purple/10',
    hover: 'hover:bg-neon-purple/5 hover:text-neon-purple',
    text: 'text-neon-purple',
    glow: 'shadow-neon-purple/20',
  },
  'neon-yellow': {
    active: 'bg-neon-yellow/10 border-neon-yellow/40 text-neon-yellow shadow-lg shadow-neon-yellow/10',
    hover: 'hover:bg-neon-yellow/5 hover:text-neon-yellow',
    text: 'text-neon-yellow',
    glow: 'shadow-neon-yellow/20',
  },
  'neon-orange': {
    active: 'bg-neon-orange/10 border-neon-orange/40 text-neon-orange shadow-lg shadow-neon-orange/10',
    hover: 'hover:bg-neon-orange/5 hover:text-neon-orange',
    text: 'text-neon-orange',
    glow: 'shadow-neon-orange/20',
  },
  'neon-cyan': {
    active: 'bg-neon-cyan/10 border-neon-cyan/40 text-neon-cyan shadow-lg shadow-neon-cyan/10',
    hover: 'hover:bg-neon-cyan/5 hover:text-neon-cyan',
    text: 'text-neon-cyan',
    glow: 'shadow-neon-cyan/20',
  },
  'neon-red': {
    active: 'bg-red-500/10 border-red-500/40 text-red-400 shadow-lg shadow-red-500/10',
    hover: 'hover:bg-red-500/5 hover:text-red-400',
    text: 'text-red-400',
    glow: 'shadow-red-500/20',
  },
  'neon-pink': {
    active: 'bg-pink-500/10 border-pink-500/40 text-pink-400 shadow-lg shadow-pink-500/10',
    hover: 'hover:bg-pink-500/5 hover:text-pink-400',
    text: 'text-pink-400',
    glow: 'shadow-pink-500/20',
  },
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  return (
    <nav className="w-[64px] h-full glass-strong border-r border-white/5 flex flex-col shrink-0 relative z-20">
      {/* Logo */}
      <div className="py-3 pb-2 border-b border-white/5 w-full flex justify-center shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-blue via-bench-500 to-neon-purple flex items-center justify-center shadow-lg shadow-bench-500/30 animate-glow">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
          </svg>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 flex flex-col items-center gap-0.5 w-full px-1.5 py-2 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id
          const isHovered = hoveredItem === item.id
          const colors = COLOR_MAP[item.color]

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`
                relative w-full rounded-lg flex flex-col items-center justify-center py-1.5
                transition-all duration-200 ease-out border border-transparent
                ${isActive ? colors.active : `text-white/40 ${colors.hover} border-transparent`}
                ${isHovered && !isActive ? 'scale-105' : ''}
                ${isActive ? 'scale-105' : ''}
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full ${colors.text.replace('text-', 'bg-')}`} />
              )}

              <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </div>
              <span className="text-[7px] font-medium tracking-wider uppercase mt-0.5 leading-none">
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
