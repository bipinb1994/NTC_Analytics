import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import Skeleton from './Skeleton'
import { fetchTopCommunicators, TopCommunicator } from '../api'

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function WorkersTab() {
  const [workers, setWorkers] = useState<TopCommunicator[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTopCommunicators().then(setWorkers).finally(() => setLoading(false))
  }, [])

  const barOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      axisPointer: { type: 'shadow' },
    },
    grid: { left: 0, right: 16, top: 10, bottom: 0, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#475569', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    yAxis: {
      type: 'category',
      data: [...workers].reverse().map(w => w.worker_name),
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.1)' } },
    },
    series: [{
      type: 'bar',
      data: [...workers].reverse().map((w, i) => ({
        value: w.call_count,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: `hsl(${200 + i * 18},80%,45%)` },
              { offset: 1, color: '#00d4ff' },
            ],
          },
          borderRadius: [0, 6, 6, 0],
        },
      })),
      label: {
        show: true,
        position: 'right',
        color: '#94a3b8',
        fontSize: 11,
        formatter: '{c} calls',
      },
    }],
  }

  if (loading) {
    return <div className="space-y-4"><Skeleton height="h-72" /><Skeleton height="h-48" /></div>
  }

  const maxCalls = Math.max(...workers.map(w => w.call_count), 1)

  return (
    <div className="space-y-6">
      {/* Horizontal bar chart */}
      <div className="card p-5 animate-slide-up">
        <span className="section-label block mb-4">Top 10 Most Active Workers — Call Count</span>
        <ReactECharts option={barOption} style={{ height: 300 }} />
      </div>

      {/* Ranked leaderboard */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="section-label">Leaderboard</span>
          <span className="text-xs text-[#475569]">30-day activity</span>
        </div>
        <div className="space-y-2">
          {workers.map((w, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(0,212,255,0.15)] transition-all"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Rank */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
                i === 0 ? 'bg-[rgba(245,158,11,0.2)] text-[#fbbf24]' :
                i === 1 ? 'bg-[rgba(148,163,184,0.2)] text-[#94a3b8]' :
                i === 2 ? 'bg-[rgba(217,119,6,0.15)] text-[#d97706]' :
                'bg-[rgba(255,255,255,0.04)] text-[#475569]'
              }`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </div>

              {/* Name + group */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#e2e8f0] truncate">{w.worker_name}</div>
                <div className="text-xs text-[#475569]">{w.group_name}</div>
              </div>

              {/* Activity bar */}
              <div className="w-28 shrink-0 hidden sm:block">
                <div className="battery-bar">
                  <div
                    className="battery-bar-fill"
                    style={{
                      width: `${(w.call_count / maxCalls) * 100}%`,
                      background: `linear-gradient(90deg, #6366f1, #00d4ff)`,
                    }}
                  />
                </div>
              </div>

              {/* Calls */}
              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-bold text-[#00d4ff]">{w.call_count}</div>
                <div className="text-[10px] text-[#475569]">calls</div>
              </div>

              {/* Duration */}
              <div className="text-right shrink-0 w-14">
                <div className="text-xs font-mono text-[#818cf8]">{formatDuration(w.total_duration)}</div>
                <div className="text-[10px] text-[#475569]">on air</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
