interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent: 'cyan' | 'indigo' | 'green' | 'amber' | 'red'
  icon: string
  delay?: number
}

const accentMap = {
  cyan:   { text: 'text-[#00d4ff]', glow: 'stat-glow-cyan',   icon: 'bg-[rgba(0,212,255,0.1)]'  },
  indigo: { text: 'text-[#818cf8]', glow: 'stat-glow-indigo', icon: 'bg-[rgba(99,102,241,0.1)]' },
  green:  { text: 'text-[#34d399]', glow: 'stat-glow-green',  icon: 'bg-[rgba(16,185,129,0.1)]' },
  amber:  { text: 'text-[#fbbf24]', glow: 'stat-glow-amber',  icon: 'bg-[rgba(245,158,11,0.1)]' },
  red:    { text: 'text-[#f87171]', glow: '',                  icon: 'bg-[rgba(239,68,68,0.1)]'  },
}

export default function StatCard({ label, value, sub, accent, icon, delay = 0 }: StatCardProps) {
  const a = accentMap[accent]
  return (
    <div
      className={`card p-5 ${a.glow} animate-slide-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="section-label">{label}</span>
        <span className={`text-xl p-2 rounded-lg ${a.icon}`}>{icon}</span>
      </div>
      <div className={`text-3xl font-bold ${a.text} font-mono mb-1`}>
        {value}
      </div>
      {sub && <div className="text-xs text-[#475569] mt-1">{sub}</div>}
    </div>
  )
}
