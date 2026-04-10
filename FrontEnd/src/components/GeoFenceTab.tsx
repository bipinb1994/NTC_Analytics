import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import Skeleton from './Skeleton'
import {
  fetchGeoFenceOverview, fetchGeoFenceEvents, fetchGeoFenceByZone, fetchWorkerCompliance,
  GeoFenceOverview, GeoFenceEventItem, GeoFenceByZone, WorkerCompliance,
} from '../api_extended'

function complianceColor(pct: number) {
  if (pct >= 95) return '#10b981'
  if (pct >= 80) return '#f59e0b'
  return '#ef4444'
}

export default function GeoFenceTab() {
  const [overview,    setOverview]    = useState<GeoFenceOverview | null>(null)
  const [events,      setEvents]      = useState<GeoFenceEventItem[]>([])
  const [byZone,      setByZone]      = useState<GeoFenceByZone[]>([])
  const [compliance,  setCompliance]  = useState<WorkerCompliance[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([fetchGeoFenceOverview(), fetchGeoFenceEvents(), fetchGeoFenceByZone(), fetchWorkerCompliance()])
      .then(([ov, ev, bz, co]) => { setOverview(ov); setEvents(ev); setByZone(bz); setCompliance(co) })
      .finally(() => setLoading(false))
  }, [])

  const zoneBarOption = {
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
      data: byZone.map(z => z.zone_name.split(' ').slice(0,2).join(' ')),
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.1)' } },
    },
    series: [{
      type: 'bar',
      data: byZone.map(z => ({
        value: z.alert_count,
        itemStyle: {
          color: z.alert_level === 'critical' ? '#ef4444' : '#f59e0b',
          borderRadius: [0, 6, 6, 0],
        },
      })),
      label: {
        show: true, position: 'right',
        color: '#94a3b8', fontSize: 11,
        formatter: '{c} alerts',
      },
    }],
  }

  const complianceOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (p: any[]) => `${p[0].name}<br/>Compliance: <b>${p[0].value}%</b>`,
    },
    grid: { left: 0, right: 0, top: 10, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: compliance.map(w => w.worker_name.split(' ')[0]),
      axisLabel: { color: '#475569', fontSize: 10, interval: 0, rotate: 30 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.1)' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0, max: 100,
      axisLabel: { color: '#475569', fontSize: 10, formatter: '{value}%' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    visualMap: {
      show: false,
      min: 0, max: 100,
      inRange: { color: ['#ef4444', '#f59e0b', '#10b981'] },
    },
    series: [{
      type: 'bar',
      data: compliance.map(w => w.compliance_pct),
      itemStyle: { borderRadius: [4, 4, 0, 0] },
    }],
  }

  if (loading) {
    return <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_,i)=><div key={i} className="card p-5"><div className="skeleton h-4 w-24 mb-3"/><div className="skeleton h-8 w-16"/></div>)}</div>
      <Skeleton height="h-44"/>
    </div>
  }

  const compRate = overview?.compliance_rate ?? 100
  const compColor = complianceColor(compRate)

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Alerts Today',       value: overview?.alerts_today ?? 0,         color: '#f87171',  icon: '🚨' },
          { label: 'Active Violations',  value: overview?.active_violations ?? 0,     color: '#fbbf24',  icon: '⚠️' },
          { label: '7-Day Events',       value: overview?.total_events_7days ?? 0,    color: '#818cf8',  icon: '📋' },
          { label: 'Fleet Compliance',   value: `${compRate}%`,                       color: compColor,  icon: '✅' },
        ].map((s, i) => (
          <div key={i} className="card p-5 animate-slide-up" style={{ animationDelay: `${i*80}ms` }}>
            <div className="flex justify-between mb-3">
              <span className="section-label">{s.label}</span>
              <span className="text-xl">{s.icon}</span>
            </div>
            <div className="text-3xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Zone alerts bar + compliance bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '320ms' }}>
          <span className="section-label block mb-4">Alerts by Zone (7 days)</span>
          {byZone.length > 0
            ? <ReactECharts option={zoneBarOption} style={{ height: 160 }} />
            : <div className="h-40 flex items-center justify-center text-[#475569] text-sm">No alerts in last 7 days</div>
          }
        </div>
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="section-label">Worker Compliance Rate</span>
            <span className="text-[10px] text-[#475569]">green ≥ 95% · amber ≥ 80%</span>
          </div>
          <ReactECharts option={complianceOption} style={{ height: 160 }} />
        </div>
      </div>

      {/* Compliance table */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '480ms' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="section-label">Worker Compliance Details (7 days)</span>
          <span className="text-xs text-[#475569]">{compliance.length} workers</span>
        </div>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0b1628]">
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                {['Worker','Group','Compliance','Violations','Status'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-[10px] font-semibold tracking-wider uppercase text-[#475569]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compliance.map((w, i) => {
                const cc = complianceColor(w.compliance_pct)
                return (
                  <tr key={i} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(0,212,255,0.02)] transition-colors">
                    <td className="py-3 px-3 font-medium text-[#e2e8f0]">{w.worker_name}</td>
                    <td className="py-3 px-3 text-[#64748b] text-xs">{w.group_name}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="battery-bar w-16">
                          <div className="battery-bar-fill" style={{ width: `${w.compliance_pct}%`, background: cc }}/>
                        </div>
                        <span className="font-mono text-xs font-bold" style={{ color: cc }}>{w.compliance_pct}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs" style={{ color: w.violation_count > 0 ? '#f87171' : '#34d399' }}>
                      {w.violation_count}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${w.compliance_pct >= 95 ? 'badge-normal' : w.compliance_pct >= 80 ? 'badge-low' : 'badge-critical'}`}>
                        {w.compliance_pct >= 95 ? '✓ Compliant' : w.compliance_pct >= 80 ? '⚡ Watch' : '✗ At Risk'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live events feed */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '560ms' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="section-label">Recent Breach Events</span>
          <div className="pulse-dot"/>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {events.map((e, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                e.resolved
                  ? 'bg-[rgba(255,255,255,0.01)] border-[rgba(255,255,255,0.04)]'
                  : e.alert_level === 'critical'
                    ? 'bg-[rgba(239,68,68,0.05)] border-[rgba(239,68,68,0.2)]'
                    : 'bg-[rgba(245,158,11,0.05)] border-[rgba(245,158,11,0.15)]'
              }`}
            >
              {/* Icon */}
              <div className="mt-0.5 shrink-0">
                {e.alert_level === 'critical'
                  ? <span className="text-base">🔴</span>
                  : <span className="text-base">🟡</span>
                }
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[#e2e8f0]">{e.worker_name}</span>
                  <span className="text-xs text-[#475569]">→</span>
                  <span className="text-xs text-[#94a3b8]">{e.zone_name}</span>
                </div>
                <div className="text-xs text-[#475569] mt-0.5">
                  {e.event_type === 'unauthorized_entry' ? 'Entered restricted zone' : `Dwell limit exceeded`}
                  {e.duration_seconds && ` · ${Math.round(e.duration_seconds / 60)} min`}
                </div>
              </div>

              {/* Meta */}
              <div className="text-right shrink-0">
                <div className="text-[10px] font-mono text-[#475569]">{e.timestamp}</div>
                <div className="mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${e.resolved ? 'badge-normal' : 'badge-critical'}`}>
                    {e.resolved ? 'resolved' : 'open'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
