import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import Skeleton from './Skeleton'
import { fetchResponseTimeTrend, fetchResponseTimeByGroup, ResponseTimeTrend, ResponseTimeByGroup } from '../api'

export default function ResponseTimeTab() {
  const [trend, setTrend] = useState<ResponseTimeTrend[]>([])
  const [byGroup, setByGroup] = useState<ResponseTimeByGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchResponseTimeTrend(14), fetchResponseTimeByGroup()])
      .then(([tr, gr]) => { setTrend(tr); setByGroup(gr) })
      .finally(() => setLoading(false))
  }, [])

  const trendOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (p: any[]) => `${p[0].name}<br/>Avg: <b>${p[0].value}s</b>`,
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
      axisLabel: { color: '#475569', fontSize: 10, formatter: '{value}s' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      type: 'line',
      data: trend.map(d => d.avg_response_time),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#6366f1', width: 2 },
      itemStyle: { color: '#6366f1', borderColor: '#050b18', borderWidth: 2 },
      markLine: {
        symbol: 'none',
        data: [{ type: 'average', name: 'Avg' }],
        lineStyle: { color: 'rgba(245,158,11,0.5)', type: 'dashed' },
        label: { color: '#f59e0b', fontSize: 10 },
      },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(99,102,241,0.25)' },
            { offset: 1, color: 'rgba(99,102,241,0)' },
          ],
        },
      },
    }],
  }

  const groupOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: ['Min', 'Avg', 'Max'],
      textStyle: { color: '#64748b', fontSize: 11 },
      right: 0,
    },
    grid: { left: 0, right: 0, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: byGroup.map(g => g.group_name),
      axisLabel: { color: '#94a3b8', fontSize: 11, interval: 0 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.1)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#475569', fontSize: 10, formatter: '{value}s' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [
      {
        name: 'Min',
        type: 'bar',
        data: byGroup.map(g => g.min_response_time),
        itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'Avg',
        type: 'bar',
        data: byGroup.map(g => g.avg_response_time),
        itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'Max',
        type: 'bar',
        data: byGroup.map(g => g.max_response_time),
        itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] },
      },
    ],
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton height="h-48" />
        <Skeleton height="h-48" />
      </div>
    )
  }

  const overallAvg = trend.reduce((sum, d) => sum + d.avg_response_time, 0) / (trend.length || 1)
  const best = Math.min(...trend.map(d => d.avg_response_time))
  const worst = Math.max(...trend.map(d => d.avg_response_time))

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '14-Day Average', value: `${overallAvg.toFixed(1)}s`, color: '#818cf8' },
          { label: 'Best Day', value: `${best.toFixed(1)}s`, color: '#34d399' },
          { label: 'Worst Day', value: `${worst.toFixed(1)}s`, color: '#f87171' },
        ].map((k, i) => (
          <div key={i} className="card p-4 animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="section-label mb-2">{k.label}</div>
            <div className="text-3xl font-mono font-bold" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Trend line */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '240ms' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="section-label">14-Day Response Time Trend</span>
          <span className="text-[10px] text-[#475569] font-mono">dashed line = overall avg</span>
        </div>
        <ReactECharts option={trendOption} style={{ height: 200 }} />
      </div>

      {/* Group comparison */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '320ms' }}>
        <span className="section-label block mb-4">Response Time by Talkgroup — Min / Avg / Max</span>
        <ReactECharts option={groupOption} style={{ height: 200 }} />
      </div>

      {/* Table */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '400ms' }}>
        <span className="section-label block mb-4">Group Breakdown</span>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                {['Group', 'Min (s)', 'Avg (s)', 'Max (s)', 'SLA Status'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-[10px] font-semibold tracking-wider uppercase text-[#475569]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byGroup.map((g, i) => {
                const ok = g.avg_response_time < 30
                return (
                  <tr key={i} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(0,212,255,0.02)] transition-colors">
                    <td className="py-3 px-3 font-medium text-[#e2e8f0]">{g.group_name}</td>
                    <td className="py-3 px-3 font-mono text-[#34d399]">{g.min_response_time}</td>
                    <td className="py-3 px-3 font-mono text-[#818cf8]">{g.avg_response_time}</td>
                    <td className="py-3 px-3 font-mono text-[#f87171]">{g.max_response_time}</td>
                    <td className="py-3 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ok ? 'badge-normal' : 'badge-critical'}`}>
                        {ok ? '✓ Within SLA' : '⚠ Breach Risk'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
