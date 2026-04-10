import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import Skeleton, { SkeletonStat } from './Skeleton'
import {
  fetchQoSOverview, fetchQoSLatencyTrend, fetchQoSByZone, fetchDegradationEvents,
  QoSOverview, QoSLatencyTrend, QoSByZone, DegradationEvent,
} from '../api_extended'

const ZONE_COLORS: Record<string, string> = {
  'Loading Bay Alpha':      '#00d4ff',
  'Processing Plant Beta':  '#6366f1',
  'Control Room Gamma':     '#10b981',
  'Maintenance Shaft Delta':'#ef4444',
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const label = score >= 70 ? 'GOOD' : score >= 50 ? 'FAIR' : 'POOR'
  const option = {
    backgroundColor: 'transparent',
    series: [{
      type: 'gauge',
      startAngle: 200, endAngle: -20,
      min: 0, max: 100,
      radius: '90%',
      pointer: { show: true, length: '55%', width: 4, itemStyle: { color } },
      axisLine: {
        lineStyle: {
          width: 14,
          color: [[score / 100, color], [1, 'rgba(255,255,255,0.05)']],
        },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: {
        valueAnimation: true,
        formatter: (val: number) => String(Math.round(val)),
        color,
        fontSize: 24,
        fontWeight: 'bold',
        fontFamily: '"JetBrains Mono", monospace',
        offsetCenter: [0, '8%'],
      },
      data: [{ value: score }],
    }],
  }
  return <ReactECharts option={option} style={{ height: 180 }} />
}

export default function QoSTab() {
  const [overview,     setOverview]     = useState<QoSOverview | null>(null)
  const [latencyTrend, setLatencyTrend] = useState<QoSLatencyTrend[]>([])
  const [byZone,       setByZone]       = useState<QoSByZone[]>([])
  const [degradation,  setDegradation]  = useState<DegradationEvent[]>([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    Promise.all([fetchQoSOverview(), fetchQoSLatencyTrend(), fetchQoSByZone(), fetchDegradationEvents()])
      .then(([ov, lt, bz, dg]) => { setOverview(ov); setLatencyTrend(lt); setByZone(bz); setDegradation(dg) })
      .finally(() => setLoading(false))
  }, [])

  // Build multi-line latency trend (one line per zone)
  const hours   = [...new Set(latencyTrend.map(d => d.hour))].sort()
  const zones   = [...new Set(latencyTrend.map(d => d.zone_name))]
  const latMap: Record<string, Record<string, number>> = {}
  latencyTrend.forEach(d => { if (!latMap[d.zone_name]) latMap[d.zone_name] = {}; latMap[d.zone_name][d.hour] = d.avg_latency })

  const latencyOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
    },
    legend: {
      data: zones,
      textStyle: { color: '#64748b', fontSize: 11 },
      right: 0, top: 0,
    },
    grid: { left: 0, right: 0, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category', data: hours,
      axisLabel: { color: '#475569', fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.1)' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#475569', fontSize: 10, formatter: '{value}ms' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: zones.map(z => ({
      name: z,
      type: 'line',
      smooth: true,
      data: hours.map(h => latMap[z]?.[h] ?? null),
      lineStyle: { color: ZONE_COLORS[z] ?? '#00d4ff', width: 2 },
      itemStyle: { color: ZONE_COLORS[z] ?? '#00d4ff', borderColor: '#050b18', borderWidth: 2 },
      symbol: 'circle', symbolSize: 5,
    })),
  }

  const zoneBarOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      axisPointer: { type: 'shadow' },
    },
    legend: { data: ['Avg Latency (ms)', 'Packet Loss (%)'], textStyle: { color: '#64748b', fontSize: 11 }, right: 0 },
    grid: { left: 0, right: 0, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: byZone.map(z => z.zone_name.replace(' Alpha','').replace(' Beta','').replace(' Gamma','').replace(' Delta','')),
      axisLabel: { color: '#94a3b8', fontSize: 10, interval: 0 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.1)' } },
    },
    yAxis: [
      { type: 'value', axisLabel: { color: '#475569', fontSize: 10, formatter: '{value}ms' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
      { type: 'value', axisLabel: { color: '#475569', fontSize: 10, formatter: '{value}%' },  splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Avg Latency (ms)', type: 'bar', yAxisIndex: 0,
        data: byZone.map((z, i) => ({ value: z.avg_latency, itemStyle: { color: Object.values(ZONE_COLORS)[i] ?? '#00d4ff', borderRadius: [4,4,0,0] } })),
      },
      {
        name: 'Packet Loss (%)', type: 'line', yAxisIndex: 1,
        data: byZone.map(z => z.avg_packet_loss),
        lineStyle: { color: '#f59e0b', width: 2 },
        itemStyle: { color: '#f59e0b' },
        symbol: 'diamond', symbolSize: 7,
      },
    ],
  }

  const donutOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: { orient: 'vertical', right: 0, top: 'middle', textStyle: { color: '#64748b', fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['50%', '75%'],
      center: ['38%', '50%'],
      data: (overview?.priority_distribution ?? []).map((p, i) => ({
        value: p.count,
        name: p.label,
        itemStyle: { color: ['#ef4444','#f59e0b','#00d4ff','#475569'][i] },
      })),
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 16, shadowColor: 'rgba(0,212,255,0.3)' } },
    }],
  }

  if (loading) {
    return <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_,i) => <SkeletonStat key={i}/>)}</div>
      <Skeleton height="h-48"/><div className="grid grid-cols-2 gap-4"><Skeleton height="h-44"/><Skeleton height="h-44"/></div>
    </div>
  }

  const scoreVal = overview?.fleet_qos_score ?? 0
  const scoreColor = scoreVal >= 70 ? '#34d399' : scoreVal >= 50 ? '#fbbf24' : '#f87171'

  return (
    <div className="space-y-6">
      {/* Top row: gauge + 3 stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Gauge */}
        <div className="card p-4 flex flex-col items-center animate-slide-up">
          <span className="section-label mb-1">Fleet QoS Score</span>
          <ScoreGauge score={scoreVal} />
          <span className="text-xs text-[#475569] mt-1">24-hour average</span>
        </div>
        {/* Stats */}
        {[
          { label: 'Avg Latency',    value: `${overview?.avg_latency_ms ?? 0}ms`,  sub: '24h average',           color: '#00d4ff', icon: '⚡' },
          { label: 'Avg Packet Loss',value: `${overview?.avg_packet_loss_pct ?? 0}%`, sub: '24h average',        color: '#f59e0b', icon: '📉' },
          { label: 'Poor QoS Events',value: overview?.devices_below_threshold ?? 0, sub: 'Score < 50 today',    color: '#f87171', icon: '⚠️' },
        ].map((s, i) => (
          <div key={i} className="card p-5 animate-slide-up" style={{ animationDelay: `${(i+1)*80}ms` }}>
            <div className="flex justify-between mb-3">
              <span className="section-label">{s.label}</span>
              <span className="text-xl">{s.icon}</span>
            </div>
            <div className="text-3xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-[#475569] mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Latency trend (multi-zone line) */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '320ms' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="section-label">24-Hour Latency by Zone</span>
          <span className="text-[10px] text-[#475569]">higher = degraded network path</span>
        </div>
        <ReactECharts option={latencyOption} style={{ height: 220 }} />
      </div>

      {/* Zone bar + priority donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '400ms' }}>
          <span className="section-label block mb-4">Latency & Packet Loss by Zone</span>
          <ReactECharts option={zoneBarOption} style={{ height: 200 }} />
        </div>
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '480ms' }}>
          <span className="section-label block mb-4">Call Priority Distribution (7 days)</span>
          <ReactECharts option={donutOption} style={{ height: 200 }} />
        </div>
      </div>

      {/* Zone QoS table */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '560ms' }}>
        <span className="section-label block mb-4">Zone QoS Breakdown — 7-Day Summary</span>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                {['Zone','Type','Avg Latency','Packet Loss','Bandwidth','QoS Score'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-[10px] font-semibold tracking-wider uppercase text-[#475569]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byZone.map((z, i) => {
                const sc = z.avg_qos_score
                const scColor = sc >= 70 ? '#34d399' : sc >= 50 ? '#fbbf24' : '#f87171'
                return (
                  <tr key={i} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(0,212,255,0.02)] transition-colors">
                    <td className="py-3 px-3 font-medium text-[#e2e8f0]">{z.zone_name}</td>
                    <td className="py-3 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${z.zone_type === 'restricted' ? 'badge-critical' : 'badge-normal'}`}>
                        {z.zone_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[#00d4ff]">{z.avg_latency}ms</td>
                    <td className="py-3 px-3 font-mono text-[#f59e0b]">{z.avg_packet_loss}%</td>
                    <td className="py-3 px-3 font-mono text-[#818cf8]">{z.avg_bandwidth} kbps</td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold" style={{ color: scColor }}>{z.avg_qos_score}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Degradation events */}
      {degradation.length > 0 && (
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '640ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="section-label">Worst QoS Events (7 days)</span>
            <span className="text-[10px] text-[#475569]">score below 45</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {degradation.map((d, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[rgba(239,68,68,0.04)] border border-[rgba(239,68,68,0.1)]">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#e2e8f0]">{d.worker_name}</div>
                  <div className="text-xs text-[#475569]">{d.zone_name} · {d.timestamp}</div>
                </div>
                <div className="text-xs font-mono text-[#00d4ff]">{d.latency_ms}ms</div>
                <div className="text-xs font-mono text-[#f59e0b]">{d.packet_loss_pct}% loss</div>
                <div className="text-sm font-bold font-mono text-[#f87171]">{d.qos_score}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
