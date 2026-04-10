import { useState, useEffect } from 'react'
import OverviewTab from './components/OverviewTab'
import BatteryTab from './components/BatteryTab'
import ResponseTimeTab from './components/ResponseTimeTab'
import WorkersTab from './components/WorkersTab'
import QoSTab from './components/QoSTab'
import LocationTab from './components/LocationTab'
import GeoFenceTab from './components/GeoFenceTab'

const TABS = [
  { id: 'overview',  label: 'Overview',       icon: '◈' },
  { id: 'battery',   label: 'Battery Health',  icon: '⬡' },
  { id: 'response',  label: 'Response Time',   icon: '◎' },
  { id: 'workers',   label: 'Worker Activity', icon: '◑' },
  { id: 'qos',       label: 'Dynamic QoS',     icon: '◐' },
  { id: 'location',  label: 'Location',        icon: '◇' },
  { id: 'geofence',  label: 'Geo-Fence',       icon: '△' },
]

function useClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const time = useClock()

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab />
      case 'battery':  return <BatteryTab />
      case 'response': return <ResponseTimeTab />
      case 'workers':  return <WorkersTab />
      case 'qos':      return <QoSTab />
      case 'location': return <LocationTab />
      case 'geofence': return <GeoFenceTab />
      default:         return null
    }
  }

  return (
    <div className="relative min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[rgba(0,212,255,0.1)] bg-[rgba(5,11,24,0.9)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          {/* Logo area */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.25)] flex items-center justify-center">
              <span className="text-[#00d4ff] text-lg">◈</span>
            </div>
            <div>
              <div className="text-sm font-bold text-[#e2e8f0] leading-none">NTC Analytics</div>
              <div className="text-[10px] text-[#475569] leading-none mt-0.5 font-mono">OPERATIONS INTELLIGENCE</div>
            </div>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center gap-1 ml-4 overflow-x-auto flex-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`nav-tab flex items-center gap-1.5 ${activeTab === t.id ? 'active' : ''}`}
              >
                <span className="text-base leading-none">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          {/* Live status */}
          <div className="shrink-0 flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <div className="pulse-dot" />
              <span className="text-xs text-[#475569] font-mono">LIVE</span>
            </div>
            <div className="hidden md:block text-right">
              <div className="text-xs font-mono text-[#64748b]">
                {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-[10px] text-[#475569]">
                {time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Zone indicator bar */}
      <div className="border-b border-[rgba(255,255,255,0.04)] bg-[rgba(0,0,0,0.3)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-6 overflow-x-auto">
          {['Zone A — Loading Bay Alpha', 'Zone B — Processing Plant Beta', 'Zone C — Control Room Gamma'].map((z, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: ['#00d4ff','#6366f1','#10b981'][i] }} />
              <span className="text-[11px] text-[#475569]">{z}</span>
            </div>
          ))}
          <div className="ml-auto shrink-0 flex items-center gap-1.5">
            <span className="text-[10px] text-[#475569] font-mono">DATA SOURCE:</span>
            <span className="text-[10px] text-[#00d4ff] font-mono">MXIE Edge · SQLite POC</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#e2e8f0]">
            {TABS.find(t => t.id === activeTab)?.label}
          </h1>
          <p className="text-sm text-[#475569] mt-0.5">
            {activeTab === 'overview'  && 'Fleet-wide communication health across all zones and shifts'}
            {activeTab === 'battery'   && 'Real-time device battery levels and 7-day fleet trend'}
            {activeTab === 'response'  && 'PTT acknowledgement latency — 14-day trend and group breakdown'}
            {activeTab === 'workers'   && 'Most active communicators ranked by call count and air time'}
            {activeTab === 'qos'       && 'Network quality scores, latency and packet loss per zone — 24h view'}
            {activeTab === 'location'  && 'Live campus occupancy, zone dwell time and worker movement patterns'}
            {activeTab === 'geofence'  && 'Restricted zone breaches, dwell violations and per-worker compliance rates'}
          </p>
        </div>

        {/* Tab content */}
        <div key={activeTab}>
          {renderTab()}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[rgba(255,255,255,0.04)] mt-12 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span className="text-[11px] text-[#475569] font-mono">
            NTC ANALYTICS POC · v0.1.0 · Nokia Team Comms Intelligence Layer
          </span>
          <span className="text-[11px] text-[#475569] font-mono">
            3GPP MCS · On-Premise · MXIE Edge
          </span>
        </div>
      </footer>
    </div>
  )
}
