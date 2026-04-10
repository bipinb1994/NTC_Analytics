import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import StatCard from './StatCard'
import Skeleton, { SkeletonStat } from './Skeleton'
import {
  fetchOverview, fetchDailyVolume, fetchCallsByType, fetchCallsByGroup,
  Overview, DailyVolume, CallsByType, CallsByGroup,
} from '../api'

const CHART_COMMON = {
  backgroundColor: 'transparent',
  animation: true,
  animationDuration: 800,
  animationEasing: 'cubicOut' as const,
}

export default function OverviewTab() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [volume, setVolume] = useState<DailyVolume[]>([])
  const [types, setTypes] = useState<CallsByType[]>([])
  const [groups, setGroups] = useState<CallsByGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchOverview(), fetchDailyVolume(30), fetchCallsByType(), fetchCallsByGroup()])
      .then(([ov, vol, ty, gr]) => {
        setOverview(ov)
        setVolume(vol)
        setTypes(ty)
        setGroups(gr)
      })
      .finally(() => setLoading(false))
  }, [])

  const volumeOption = {
    ...CHART_COMMON,
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
    },
    legend: {
      data: ['Day Shift', 'Night Shift'],
      textStyle: { color: '#64748b', fontSize: 12 },
      right: 0,
    },
    grid: { left: 0, right: 0, top: 40, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: volume.map(d => d.date),
      axisLabel: {
        color: '#475569',
        fontSize: 10,
        interval: 4,
      },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.1)' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#475569', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [
      {
        name: 'Day Shift',
        type: 'bar',
        stack: 'calls',
        data: volume.map(d => d.day_calls),
        itemStyle: { color: '#00d4ff', borderRadius: [0, 0, 0, 0] },
      },
      {
        name: 'Night Shift',
        type: 'bar',
        stack: 'calls',
        data: volume.map(d => d.night_calls),
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#6366f1' },
              { offset: 1, color: '#4338ca' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  }

  const typeOption = {
    ...CHART_COMMON,
    tooltip: {
      trigger: 'item',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'middle',
      textStyle: { color: '#64748b', fontSize: 12 },
    },
    series: [
      {
        name: 'Call Type',
        type: 'pie',
        radius: ['55%', '80%'],
        center: ['38%', '50%'],
        data: types.map((t, i) => ({
          value: t.count,
          name: t.call_type,
          itemStyle: {
            color: ['#00d4ff', '#6366f1', '#10b981'][i % 3],
          },
        })),
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 16, shadowColor: 'rgba(0,212,255,0.3)' },
        },
      },
    ],
  }

  const groupOption = {
    ...CHART_COMMON,
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      axisPointer: { type: 'shadow' },
    },
    grid: { left: 0, right: 16, top: 10, bottom: 0, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: '#475569', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
    yAxis: {
      type: 'category',
      data: groups.map(g => g.group_name),
      axisLabel: { color: '#94a3b8', fontSize: 10, formatter: (v: string) => v.replace(' Alpha','').replace(' Beta','').replace(' Gamma','') },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.1)' } },
    },
    series: [{
      type: 'bar',
      data: groups.map((g, i) => ({
        value: g.call_count,
        itemStyle: {
          color: ['#00d4ff', '#6366f1', '#10b981'][i % 3],
          borderRadius: [0, 6, 6, 0],
        },
      })),
      label: {
        show: true,
        position: 'right',
        color: '#94a3b8',
        fontSize: 11,
      },
    }],
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonStat key={i} />)}
        </div>
        <Skeleton height="h-56" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton height="h-48" />
          <Skeleton height="h-48" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Calls Today" value={overview?.total_calls_today ?? 0} sub="Across all shifts" accent="cyan" icon="📡" delay={0} />
        <StatCard label="30-Day Calls" value={overview?.total_calls_30days ?? 0} sub="Total volume" accent="indigo" icon="📊" delay={80} />
        <StatCard label="Avg Response" value={`${overview?.avg_response_time ?? 0}s`} sub="7-day average" accent="green" icon="⚡" delay={160} />
        <StatCard label="Low Battery" value={overview?.critical_battery_count ?? 0} sub="Devices below 20%" accent="red" icon="🔋" delay={240} />
      </div>

      {/* Stacked bar: daily volume */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '320ms' }}>
        <div className="flex items-center gap-3 mb-5">
          <span className="section-label">30-Day Call Volume</span>
          <span className="text-[10px] text-[#475569]">Day vs Night Shift</span>
        </div>
        <ReactECharts option={volumeOption} style={{ height: 220 }} />
      </div>

      {/* Bottom row: type donut + group bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '400ms' }}>
          <span className="section-label block mb-4">Call Type Breakdown</span>
          <ReactECharts option={typeOption} style={{ height: 200 }} />
        </div>
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '480ms' }}>
          <span className="section-label block mb-4">Calls by Talkgroup</span>
          <ReactECharts option={groupOption} style={{ height: 200 }} />
        </div>
      </div>
    </div>
  )
}
