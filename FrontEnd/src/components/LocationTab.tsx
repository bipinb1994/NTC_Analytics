import { useEffect, useState, useCallback, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import Skeleton from './Skeleton'
import {
  fetchCurrentOccupancy, fetchOccupancyTrend, fetchDwellTime, fetchZoneTransitions,
  fetchWorkersList, fetchDwellAnomalies, fetchWorkerJourney,
  ZoneOccupancy, OccupancyTrend, DwellTime, ZoneTransition,
  WorkerListItem, DwellAnomaly, WorkerJourney,
} from '../api_extended'

// ── Constants ────────────────────────────────────────────────────────────────
const ZONE_COLORS: Record<string, string> = {
  'Loading Bay Alpha':       '#00d4ff',
  'Processing Plant Beta':   '#6366f1',
  'Control Room Gamma':      '#10b981',
  'Maintenance Shaft Delta': '#ef4444',
}
const CAMPUS_ZONES = [
  { name: 'Loading Bay Alpha',       x: 110, y: 136, r: 78,  label: 'BAY A' },
  { name: 'Processing Plant Beta',   x: 325, y: 121, r: 98,  label: 'PLANT B' },
  { name: 'Control Room Gamma',      x: 220, y: 44,  r: 58,  label: 'CTRL C' },
  { name: 'Maintenance Shaft Delta', x: 260, y: 158, r: 40,  label: '⚠ RESTRICTED' },
]

// ── Tooltip helper — uses fixed position so it is never clipped by parent overflow ──
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const show = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
  }
  const hide = () => setPos(null)

  return (
    <div ref={ref} className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {pos && typeof document !== 'undefined' &&
        (() => {
          const el = document.createElement('div')
          // Inline portal into body via React portal-style rendering isn't available without ReactDOM,
          // so we use a fixed-positioned overlay div rendered as a sibling in the same component tree
          return null
        })()
      }
      {pos && (
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            background: '#0b1628',
            border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 11,
            color: '#94a3b8',
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            maxWidth: 280,
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            {text}
          </div>
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid rgba(0,212,255,0.3)',
          }}/>
        </div>
      )}
    </div>
  )
}

// ── Campus Map ───────────────────────────────────────────────────────────────
function CampusMap({
  occupancy, trail, anomalyZones,
}: {
  occupancy:    ZoneOccupancy[]
  trail:        { zone_name: string; zone_type: string; timestamp: string }[]
  anomalyZones: Set<string>
}) {
  const countMap: Record<string, number> = {}
  occupancy.forEach(o => { countMap[o.zone_name] = o.worker_count })

  const zoneCx = (name: string) => CAMPUS_ZONES.find(z => z.name === name)?.x ?? 0
  const zoneCy = (name: string) => CAMPUS_ZONES.find(z => z.name === name)?.y ?? 0

  // Deduplicate consecutive same-zone trail entries
  const dedupedTrail: { zone_name: string; zone_type: string; timestamp: string }[] = []
  trail.forEach(t => {
    if (!dedupedTrail.length || dedupedTrail[dedupedTrail.length - 1].zone_name !== t.zone_name)
      dedupedTrail.push(t)
  })

  // Worker is "moving" only if their last two distinct zones differ
  const isMoving = dedupedTrail.length >= 2
  const lastSeg = isMoving ? {
    x1: zoneCx(dedupedTrail[dedupedTrail.length - 2].zone_name),
    y1: zoneCy(dedupedTrail[dedupedTrail.length - 2].zone_name),
    x2: zoneCx(dedupedTrail[dedupedTrail.length - 1].zone_name),
    y2: zoneCy(dedupedTrail[dedupedTrail.length - 1].zone_name),
  } : null

  const restrictedCnt = countMap['Maintenance Shaft Delta'] ?? 0

  return (
    <svg viewBox="0 0 500 240" className="w-full" style={{ maxHeight: 260 }}>
      <defs>
        {/* Arrow for active movement direction only */}
        <marker id="arrow-now" markerWidth="10" markerHeight="10" refX="8" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L10,3.5 z" fill="#f59e0b"/>
        </marker>
        {/* Glow filter for current position */}
        <filter id="glow-amber">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-red">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Subtle background grid */}
      {[...Array(11)].map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i*24} x2="500" y2={i*24}
          stroke="rgba(0,212,255,0.025)" strokeWidth="1"/>
      ))}
      {[...Array(11)].map((_, i) => (
        <line key={`v${i}`} x1={i*50} y1="0" x2={i*50} y2="240"
          stroke="rgba(0,212,255,0.025)" strokeWidth="1"/>
      ))}

      {/* ── Zone circles ─────────────────────────────────────────── */}
      {CAMPUS_ZONES.map(z => {
        const col      = ZONE_COLORS[z.name] ?? '#94a3b8'
        const cnt      = countMap[z.name] ?? 0
        const isR      = z.name.includes('Delta')
        const isBreach = isR && cnt > 0

        return (
          <g key={z.name}>
            {/* Breach pulse — red, restricted only, only when occupied */}
            {isBreach && (
              <circle cx={z.x} cy={z.y} r={z.r} fill="none" stroke="#ef4444" strokeWidth="3" opacity="0">
                <animate attributeName="r"       values={`${z.r};${z.r+18};${z.r}`}  dur="1.4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.55;0;0.55"                  dur="1.4s" repeatCount="indefinite"/>
              </circle>
            )}

            {/* Dwell anomaly pulse — amber, operational zones only */}
            {anomalyZones.has(z.name) && !isR && (
              <circle cx={z.x} cy={z.y} r={z.r} fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0">
                <animate attributeName="r"       values={`${z.r};${z.r+14};${z.r}`}  dur="2.8s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.4;0;0.4"                    dur="2.8s" repeatCount="indefinite"/>
              </circle>
            )}

            {/* Zone fill */}
            <circle cx={z.x} cy={z.y} r={z.r}
              fill={isR ? 'rgba(239,68,68,0.06)' : `${col}10`}
              stroke={col}
              strokeWidth={isR ? 2 : 1.5}
              strokeDasharray={isR ? '7,4' : 'none'}
            />

            {/* Zone short label — bigger and above center */}
            <text x={z.x} y={z.y - (isR ? 10 : 8)} textAnchor="middle"
              fontSize={isR ? "9" : "11"}
              fontFamily="'JetBrains Mono',monospace"
              fill={col} fontWeight="700" letterSpacing="1">
              {z.label}
            </text>

            {/* Worker count — large and readable */}
            <text x={z.x} y={z.y + 12} textAnchor="middle"
              fontSize="20"
              fontFamily="'JetBrains Mono',monospace"
              fill={isBreach ? '#ef4444' : '#e2e8f0'}
              fontWeight="800">
              {cnt}
            </text>

            {/* "workers" sub-label */}
            <text x={z.x} y={z.y + 25} textAnchor="middle"
              fontSize="8" fontFamily="'DM Sans',sans-serif" fill="#475569">
              workers
            </text>

            {/* Breach badge dot */}
            {isBreach && (
              <g filter="url(#glow-red)">
                <circle cx={z.x + z.r - 8} cy={z.y - z.r + 8} r="8" fill="#ef4444"/>
                <text x={z.x + z.r - 8} y={z.y - z.r + 12}
                  textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">!</text>
              </g>
            )}
          </g>
        )
      })}

      {/* ── Trail (only when a worker is selected) ───────────────── */}
      {dedupedTrail.length > 0 && (
        <g>
          {/* Clean solid line through visited zones — no dotted clutter */}
          {dedupedTrail.slice(0, -1).map((t, i) => {
            const x1 = zoneCx(t.zone_name),                      y1 = zoneCy(t.zone_name)
            const x2 = zoneCx(dedupedTrail[i+1].zone_name),      y2 = zoneCy(dedupedTrail[i+1].zone_name)
            const opacity = 0.2 + (i / dedupedTrail.length) * 0.5
            return (
              <line key={`seg-${i}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#f59e0b" strokeWidth="2"
                opacity={opacity}
                strokeLinecap="round"
              />
            )
          })}

          {/* Visited zone dots — numbered, fading */}
          {dedupedTrail.slice(0, -1).map((t, i) => {
            const cx = zoneCx(t.zone_name), cy = zoneCy(t.zone_name)
            return (
              <g key={`visit-${i}`}>
                <circle cx={cx} cy={cy} r="9" fill="rgba(245,158,11,0.15)" stroke="#f59e0b" strokeWidth="1.5" opacity="0.6"/>
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9"
                  fontFamily="'JetBrains Mono',monospace" fill="#f59e0b" fontWeight="700" opacity="0.8">
                  {i + 1}
                </text>
              </g>
            )
          })}

          {/* Direction arrow — ONLY on last segment, ONLY if worker moved (isMoving) */}
          {isMoving && lastSeg && (() => {
            const dx = lastSeg.x2 - lastSeg.x1
            const dy = lastSeg.y2 - lastSeg.y1
            const len = Math.sqrt(dx*dx + dy*dy) || 1
            // Draw arrow from 60% along the segment to near the destination circle edge
            const destZone = CAMPUS_ZONES.find(z => z.name === dedupedTrail[dedupedTrail.length-1].zone_name)
            const edgeOffset = (destZone?.r ?? 30) + 10
            const ax1 = lastSeg.x1 + (dx/len) * (len * 0.55)
            const ay1 = lastSeg.y1 + (dy/len) * (len * 0.55)
            const ax2 = lastSeg.x2 - (dx/len) * edgeOffset
            const ay2 = lastSeg.y2 - (dy/len) * edgeOffset
            return (
              <line
                x1={ax1} y1={ay1} x2={ax2} y2={ay2}
                stroke="#f59e0b" strokeWidth="3"
                markerEnd="url(#arrow-now)"
                strokeLinecap="round"
                opacity="0.95"
              />
            )
          })()}

          {/* Current position — pulsing amber dot on latest zone */}
          {(() => {
            const cur = dedupedTrail[dedupedTrail.length - 1]
            const cx = zoneCx(cur.zone_name), cy = zoneCy(cur.zone_name)
            return (
              <g filter="url(#glow-amber)">
                <circle cx={cx} cy={cy} r="8" fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0">
                  <animate attributeName="r"       values="6;16;6"     dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.5;0;0.5"  dur="2s" repeatCount="indefinite"/>
                </circle>
                <circle cx={cx} cy={cy} r="7" fill="#f59e0b"/>
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9"
                  fontFamily="'JetBrains Mono',monospace" fill="#050b18" fontWeight="900">▶</text>
              </g>
            )
          })()}
        </g>
      )}

      {/* Status bar */}
      <rect x="0" y="228" width="500" height="12" fill="rgba(5,11,24,0.6)"/>
      <text x="8" y="237" fontSize="7.5" fontFamily="'JetBrains Mono',monospace"
        fill={dedupedTrail.length > 0 ? '#f59e0b' : '#334155'} letterSpacing="0.5">
        {dedupedTrail.length > 0
          ? `TRAIL: ${dedupedTrail.length} ZONES · ${isMoving ? 'ARROW = LAST MOVE DIRECTION' : 'STATIONARY — NO DIRECTION SHOWN'} · ● = CURRENT`
          : 'SELECT A WORKER ABOVE TO VIEW THEIR MOVEMENT TRAIL'}
      </text>
    </svg>
  )
}

// ── Worker Journey Card ───────────────────────────────────────────────────────
function JourneyCard({ journey, onClose }: { journey: WorkerJourney; onClose: () => void }) {
  const compColor = journey.compliance_pct >= 95 ? '#10b981' : journey.compliance_pct >= 80 ? '#f59e0b' : '#ef4444'
  const zoneColor = ZONE_COLORS[journey.current_zone] ?? '#94a3b8'
  const isRestricted = journey.current_zone_type === 'restricted'

  return (
    <div className="card p-5 border-[rgba(0,212,255,0.2)] animate-slide-up"
      style={{ background: 'linear-gradient(135deg, #0b1628 0%, #0d1f3a 100%)' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center text-sm font-bold text-[#00d4ff]">
            {journey.worker_name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-[#e2e8f0]">{journey.worker_name}</div>
            <div className="text-[10px] text-[#475569] font-mono">{journey.device_id} · {journey.role}</div>
            <div className="text-[10px] text-[#475569]">{journey.group_name}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-[#475569] hover:text-[#e2e8f0] transition-colors text-xl leading-none px-1">✕</button>
      </div>

      {/* Current zone */}
      <div className={`p-3 rounded-lg mb-4 border ${isRestricted
        ? 'bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.35)]'
        : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)]'}`}>
        <div className="section-label mb-1.5">Current Zone</div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: zoneColor, boxShadow: `0 0 8px ${zoneColor}` }}/>
          <span className="text-sm font-bold" style={{ color: zoneColor }}>{journey.current_zone}</span>
          {isRestricted && (
            <span className="text-xs px-2 py-0.5 rounded-full badge-critical ml-auto animate-pulse-slow">⚠ BREACH</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Compliance', value: `${journey.compliance_pct}%`, color: compColor },
          { label: 'Breaches',   value: journey.breach_count,         color: journey.breach_count > 0 ? '#f87171' : '#34d399' },
          { label: 'Open',       value: journey.open_breaches,        color: journey.open_breaches > 0 ? '#fbbf24' : '#34d399' },
        ].map((s, i) => (
          <div key={i} className="text-center p-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]">
            <div className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[9px] text-[#475569] uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent path */}
      {journey.recent_path.length > 0 && (
        <div className="mb-4">
          <div className="section-label mb-2">Recent Path (24h)</div>
          <div className="flex items-center gap-1 flex-wrap">
            {journey.recent_path.map((p: any, i: number) => {
              const col = ZONE_COLORS[p.zone_name] ?? '#94a3b8'
              const isLast = i === journey.recent_path.length - 1
              return (
                <div key={i} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border ${
                    isLast
                      ? 'border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.1)] text-[#fbbf24]'
                      : 'border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]'
                  }`} style={{ color: isLast ? '#fbbf24' : col }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: isLast ? '#f59e0b' : col }}/>
                    {p.zone_name.split(' ').slice(0,2).join(' ')}
                    <span className="text-[#475569] ml-1 text-[9px]">{p.timestamp}</span>
                  </div>
                  {!isLast && <span className="text-[#334155] text-xs">→</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Dwell summary */}
      <div>
        <div className="section-label mb-2">Time by Zone (7 days)</div>
        <div className="space-y-1.5">
          {journey.dwell_summary.slice(0,4).map((d: any, i: number) => {
            const col = ZONE_COLORS[d.zone_name] ?? '#94a3b8'
            const maxH = journey.dwell_summary[0]?.hours || 1
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="text-[10px] text-[#64748b] w-24 truncate shrink-0">
                  {d.zone_name.split(' ').slice(0,2).join(' ')}
                </div>
                <div className="flex-1 battery-bar">
                  <div className="battery-bar-fill" style={{ width: `${(d.hours/maxH)*100}%`, background: col }}/>
                </div>
                <div className="text-[10px] font-mono text-[#94a3b8] w-8 text-right shrink-0">{d.hours}h</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Dwell Anomaly Feed ────────────────────────────────────────────────────────
function AnomalyFeed({ anomalies }: { anomalies: DwellAnomaly[] }) {
  if (!anomalies.length) return (
    <div className="text-center text-[#475569] text-sm py-6">No dwell anomalies detected (threshold: 3h in same zone)</div>
  )
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {anomalies.map((a, i) => (
        <Tooltip key={i} text={
          a.is_restricted
            ? `${a.worker_name} entered a restricted zone and stayed for ${a.dwell_hours}h — breach since ${a.since}`
            : `${a.worker_name} has been in ${a.zone_name} for ${a.dwell_hours}h (threshold: 3h) since ${a.since}`
        }>
          <div className={`flex items-center gap-3 p-3 rounded-lg border cursor-help ${
            a.is_restricted
              ? 'bg-[rgba(239,68,68,0.06)] border-[rgba(239,68,68,0.25)]'
              : 'bg-[rgba(245,158,11,0.05)] border-[rgba(245,158,11,0.15)]'
          }`}>
            <span className="text-base shrink-0">{a.is_restricted ? '🚨' : '⏱'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#e2e8f0]">{a.worker_name}</div>
              <div className="text-xs text-[#475569] truncate">{a.zone_name} · since {a.since}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className={`text-sm font-bold font-mono ${a.is_restricted ? 'text-[#f87171]' : 'text-[#fbbf24]'}`}>
                {a.dwell_hours}h
              </div>
              <div className="text-[10px] text-[#475569]">dwell</div>
            </div>
          </div>
        </Tooltip>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LocationTab() {
  const [occupancy,   setOccupancy]   = useState<ZoneOccupancy[]>([])
  const [trend,       setTrend]       = useState<OccupancyTrend[]>([])
  const [dwell,       setDwell]       = useState<DwellTime[]>([])
  const [transitions, setTransitions] = useState<ZoneTransition[]>([])
  const [workersList, setWorkersList] = useState<WorkerListItem[]>([])
  const [anomalies,   setAnomalies]   = useState<DwellAnomaly[]>([])
  const [loading,     setLoading]     = useState(true)

  const [selectedWorker, setSelectedWorker] = useState<number | null>(null)
  const [journey,        setJourney]        = useState<WorkerJourney | null>(null)
  const [journeyLoading, setJourneyLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchCurrentOccupancy(), fetchOccupancyTrend(), fetchDwellTime(),
      fetchZoneTransitions(), fetchWorkersList(), fetchDwellAnomalies(),
    ]).then(([oc, tr, dw, tx, wl, an]) => {
      setOccupancy(oc); setTrend(tr); setDwell(dw)
      setTransitions(tx); setWorkersList(wl); setAnomalies(an)
    }).finally(() => setLoading(false))
  }, [])

  const selectWorker = useCallback((id: number) => {
    if (id === selectedWorker) {
      setSelectedWorker(null); setJourney(null); return
    }
    setSelectedWorker(id)
    setJourneyLoading(true)
    fetchWorkerJourney(id)
      .then(j => { setJourney(j) })
      .finally(() => setJourneyLoading(false))
  }, [selectedWorker])

  const anomalyZones = new Set(anomalies.map(a => a.zone_name))

  // Occupancy trend chart
  const hours     = [...new Set(trend.map(d => d.hour))].sort()
  const zoneNames = [...new Set(trend.map(d => d.zone_name))]
  const tMap: Record<string, Record<string, number>> = {}
  trend.forEach(d => {
    if (!tMap[d.zone_name]) tMap[d.zone_name] = {}
    tMap[d.zone_name][d.hour] = d.worker_count
  })

  const trendOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
    },
    legend: { data: zoneNames, textStyle: { color: '#64748b', fontSize: 11 }, right: 0 },
    grid: { left: 0, right: 0, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category', data: hours,
      axisLabel: { color: '#475569', fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.1)' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#475569', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: zoneNames.map(z => ({
      name: z, type: 'line', stack: 'workers', smooth: true,
      data: hours.map(h => tMap[z]?.[h] ?? 0),
      lineStyle: { color: ZONE_COLORS[z] ?? '#00d4ff', width: 1.5 },
      itemStyle: { color: ZONE_COLORS[z] ?? '#00d4ff' },
      areaStyle: { color: `${ZONE_COLORS[z] ?? '#00d4ff'}28` },
      symbol: 'none',
    })),
  }

  const dwellOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0b1628',
      borderColor: 'rgba(0,212,255,0.2)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (p: any[]) => `${p[0].name}<br/>Avg dwell: <b>${p[0].value} min</b>`,
    },
    grid: { left: 0, right: 80, top: 10, bottom: 0, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#475569', fontSize: 10, formatter: '{value}m' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    yAxis: {
      type: 'category',
      data: dwell.map(d => d.zone_name.split(' ').slice(0,2).join(' ')),
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(0,212,255,0.1)' } },
    },
    series: [{
      type: 'bar',
      data: dwell.map((d, i) => ({
        value: d.avg_dwell_minutes,
        itemStyle: { color: Object.values(ZONE_COLORS)[i] ?? '#00d4ff', borderRadius: [0,6,6,0] },
      })),
      label: {
        show: true, position: 'right', color: '#94a3b8', fontSize: 11,
        formatter: (p: any) => `${p.value}m`,
      },
    }],
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_,i) => <div key={i} className="card p-5"><div className="skeleton h-4 w-24 mb-3"/><div className="skeleton h-8 w-12"/></div>)}
      </div>
      <Skeleton height="h-56"/>
      <Skeleton height="h-44"/>
    </div>
  )

  const totalWorkers = occupancy.reduce((s, z) => s + z.worker_count, 0)
  const restrictedOcc = occupancy.find(z => z.zone_type === 'restricted')
  const restrictedCount = restrictedOcc?.worker_count ?? 0

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Workers',  value: totalWorkers,      color: '#00d4ff', icon: '👥', tip: 'Total workers with a known location in the last 2 hours' },
          { label: 'Zones Occupied',  value: occupancy.filter(z=>z.worker_count>0).length, color: '#10b981', icon: '📍', tip: 'Number of campus zones with at least 1 worker currently' },
          { label: 'Dwell Anomalies', value: anomalies.length,  color: anomalies.length ? '#fbbf24' : '#34d399', icon: '⏱', tip: 'Workers who have remained in the same zone for ≥3 hours — potential fatigue or access issue' },
        ].map((s, i) => (
          <Tooltip key={i} text={s.tip}>
            <div className="card p-4 animate-slide-up cursor-help" style={{ animationDelay: `${i*80}ms` }}>
              <div className="flex justify-between mb-2">
                <span className="section-label">{s.label}</span>
                <span>{s.icon}</span>
              </div>
              <div className="text-3xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
              {s.label === 'Dwell Anomalies' && s.value > 0 && (
                <div className="text-[10px] text-[#f59e0b] mt-1">Hover each row below for details</div>
              )}
            </div>
          </Tooltip>
        ))}
      </div>

      {/* Worker selector */}
      <div className="card p-4 animate-slide-up" style={{ animationDelay: '240ms' }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="section-label">Select Worker — View Trail & Journey</span>
          {selectedWorker && <span className="text-[10px] text-[#f59e0b] font-mono">● TRAIL ACTIVE — dashed=history · arrow=direction · ▶=current</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {workersList.map(w => (
            <Tooltip key={w.id} text={`${w.group_name} · ${w.device_id} — click to see trail & journey`}>
              <button onClick={() => selectWorker(w.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedWorker === w.id
                    ? 'bg-[rgba(245,158,11,0.15)] border-[rgba(245,158,11,0.4)] text-[#fbbf24]'
                    : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)] text-[#64748b] hover:border-[rgba(0,212,255,0.2)] hover:text-[#e2e8f0]'
                }`}>
                {w.name}
                <span className="ml-1.5 opacity-40 text-[9px]">{w.device_id}</span>
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Map + Journey/Roster */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '320ms' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="section-label">Campus Live View</span>
            <div className="flex items-center gap-3">
              {restrictedCount > 0 && (
                <span className="text-[10px] text-[#f87171] font-mono flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse"/>
                  {restrictedCount} IN RESTRICTED
                </span>
              )}
              {anomalies.length > 0 && (
                <span className="text-[10px] text-[#fbbf24] font-mono">{anomalies.length} DWELL ANOMALIES</span>
              )}
            </div>
          </div>
          <CampusMap occupancy={occupancy} trail={journey?.recent_path ?? []} anomalyZones={anomalyZones} />
        </div>

        <div className="animate-slide-up" style={{ animationDelay: '400ms' }}>
          {journeyLoading ? (
            <div className="card p-5 h-full">
              <div className="skeleton h-4 w-32 mb-4"/>
              <div className="skeleton h-20 w-full mb-3"/>
              <div className="skeleton h-4 w-full mb-2"/>
              <div className="skeleton h-4 w-3/4"/>
            </div>
          ) : journey ? (
            <JourneyCard journey={journey} onClose={() => { setJourney(null); setSelectedWorker(null) }} />
          ) : (
            <div className="card p-5">
              <span className="section-label block mb-3">Zone Roster</span>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {occupancy.map((z, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${
                    z.zone_type === 'restricted' && z.worker_count > 0
                      ? 'border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.06)]'
                      : 'border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)]'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: ZONE_COLORS[z.zone_name] ?? '#94a3b8' }}/>
                        <span className="text-sm font-medium text-[#e2e8f0]">{z.zone_name}</span>
                        {z.zone_type === 'restricted' && z.worker_count > 0 && (
                          <span className="text-[9px] badge-critical px-1.5 py-0.5 rounded-full">BREACH</span>
                        )}
                      </div>
                      <span className="text-sm font-mono font-bold" style={{ color: ZONE_COLORS[z.zone_name] ?? '#94a3b8' }}>
                        {z.worker_count}
                      </span>
                    </div>
                    {z.workers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {z.workers.slice(0,4).map((w, j) => (
                          <button key={j}
                            onClick={() => { const wl = workersList.find(x => x.name === w.name); if(wl) selectWorker(wl.id) }}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] text-[#64748b] hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.08)] transition-colors cursor-pointer">
                            {w.name.split(' ')[0]}
                          </button>
                        ))}
                        {z.workers.length > 4 && (
                          <span className="text-[10px] text-[#475569] px-1">+{z.workers.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-[#334155] text-center">Click a worker name above or use the selector to view their trail ↑</div>
            </div>
          )}
        </div>
      </div>

      {/* Dwell anomalies */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '480ms' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="section-label">Dwell Anomalies</span>
          <Tooltip text="A dwell anomaly is raised when a worker stays in the same zone for 3+ consecutive hours. This may indicate fatigue, a stuck device, or an access violation. Hover each row for details.">
            <span className="text-[10px] text-[#475569] border border-[rgba(255,255,255,0.1)] rounded-full px-2 py-0.5 cursor-help">
              ≥3h in same zone · hover rows for details ⓘ
            </span>
          </Tooltip>
          {anomalies.some(a => a.is_restricted) && (
            <span className="text-[10px] text-[#f87171] font-medium ml-auto">🚨 Restricted zone violations</span>
          )}
        </div>
        <AnomalyFeed anomalies={anomalies} />
      </div>

      {/* Occupancy trend */}
      <div className="card p-5 animate-slide-up" style={{ animationDelay: '560ms' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="section-label">Zone Occupancy by Hour (7-day average)</span>
          <Tooltip text="Shows how many unique workers are recorded in each zone per hour of day, averaged across the last 7 days. Peaks indicate high-traffic periods.">
            <span className="text-[10px] text-[#475569] cursor-help border border-[rgba(255,255,255,0.08)] rounded-full px-2 py-0.5">stacked · hover for counts ⓘ</span>
          </Tooltip>
        </div>
        <ReactECharts option={trendOption} style={{ height: 200 }} />
      </div>

      {/* Dwell + transitions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '640ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="section-label">Avg Dwell Time per Zone</span>
            <Tooltip text="Average consecutive time a worker spends in each zone before moving to another. High dwell in restricted zones is a safety concern.">
              <span className="text-[10px] text-[#475569] cursor-help border border-[rgba(255,255,255,0.08)] rounded-full px-2 py-0.5">7 days ⓘ</span>
            </Tooltip>
          </div>
          <ReactECharts option={dwellOption} style={{ height: 160 }} />
        </div>
        <div className="card p-5 animate-slide-up" style={{ animationDelay: '720ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="section-label">Top Zone Transitions</span>
            <Tooltip text="Most frequent zone-to-zone movements by workers in the last 7 days. High frequency between operational zones is normal. Transitions into restricted zones are flagged.">
              <span className="text-[10px] text-[#475569] cursor-help border border-[rgba(255,255,255,0.08)] rounded-full px-2 py-0.5">7 days ⓘ</span>
            </Tooltip>
          </div>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {transitions.map((t, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                <div className="flex-1 text-xs text-[#94a3b8] truncate">{t.from_zone.split(' ').slice(0,2).join(' ')}</div>
                <div className="text-[#334155] text-sm shrink-0">→</div>
                <div className="flex-1 text-xs text-[#94a3b8] truncate">{t.to_zone.split(' ').slice(0,2).join(' ')}</div>
                <div className="text-sm font-mono font-bold text-[#6366f1] shrink-0">{t.count}×</div>
              </div>
            ))}
            {transitions.length === 0 && (
              <div className="text-xs text-[#475569] text-center py-4">No transitions recorded yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
