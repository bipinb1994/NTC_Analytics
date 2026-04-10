import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import Skeleton from './Skeleton'
import { fetchCurrentBattery, fetchBatteryTrend, BatteryDevice, BatteryTrend } from '../api'

function batteryColor(level: number) {
  if (level < 20) return '#ef4444'
  if (level < 40) return '#f59e0b'
  return '#10b981'
}

export default function BatteryTab() {
  const [devices, setDevices] = useState<BatteryDevice[]>([])
  const [trend, setTrend] = useState<BatteryTrend[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchCurrentBattery(), fetchBatteryTrend(7)])
      .then(([devs, tr]) => { setDevices(devs); setTrend(tr) })
      .finally(() => setLoading(false))
  }, [])

  const trendOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (params: any[]) => `${params[0].name}<br/>Avg Battery: <b>${params[0].value}%</b>`,
    },
    grid: { left: 0, right: 0, top: 10, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: trend.map(d => d.date),
      axisLabel: { color: '#475569', fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.1)' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0, max: 100,
      axisLabel: { color: '#475569', fontSize: 10, formatter: '{value}%' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      type: 'line',
      data: trend.map(d => d.avg_battery),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#00d4ff', width: 2 },
      itemStyle: { color: '#00d4ff', borderColor: '#050b18', borderWidth: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(0,212,255,0.2)' },
            { offset: 1, color: 'rgba(0,212,255,0)' },
          ],
        },
      },
    }],
  }

  const critical = devices.filter(d => d.status === 'critical')
  const low = devices.filter(d => d.status === 'low')
  const normal = devices.filter(d => d.status === 'normal')

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton height="h-40" />
        <Skeleton height="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary pills */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Critical (< 20%)', count: critical.length, cls: 'badge-critical', icon: '🔴' },
          { label: 'Low (20–40%)', count: low.length, cls: 'badge-low', icon: '🟡' },
          { label: 'Normal (> 40%)', count: normal.length, cls: 'badge-normal', icon: '🟢' },
        ].map((s, i) => (
          <div key={i} className={`card p-4 animate-slide-up`} style={{ animationDelay: `${i * 80}ms` }}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold font-mono text-[#e2e8f0]">{s.count}</div>
            <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${s.cls}`}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Trend line */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '240ms' }}>
        <span className="section-label block mb-4">7-Day Fleet Avg Battery %</span>
        <ReactECharts option={trendOption} style={{ height: 160 }} />
      </div>

      {/* Device list sorted by level */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '320ms' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="section-label">All Devices — Current Level</span>
          <span className="text-xs text-[#475569]">{devices.length} devices</span>
        </div>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {devices.map((d, i) => (
            <div
              key={d.device_id}
              className="flex items-center gap-4 p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(0,212,255,0.15)] transition-colors"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="w-20 shrink-0">
                <div className="text-xs font-mono text-[#64748b]">{d.device_id}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#e2e8f0] truncate">{d.worker_name}</div>
                <div className="text-xs text-[#475569]">{d.group}</div>
              </div>
              <div className="w-32 shrink-0">
                <div className="battery-bar">
                  <div
                    className="battery-bar-fill"
                    style={{ width: `${d.battery_level}%`, background: batteryColor(d.battery_level) }}
                  />
                </div>
              </div>
              <div className="w-12 text-right">
                <span className="text-sm font-mono font-semibold" style={{ color: batteryColor(d.battery_level) }}>
                  {d.battery_level}%
                </span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium badge-${d.status}`}>
                {d.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
