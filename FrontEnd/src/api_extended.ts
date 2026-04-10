import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
})

export default api
// ── QoS ──────────────────────────────────────────────────────────────────────
export interface QoSOverview {
  fleet_qos_score: number
  avg_latency_ms: number
  avg_packet_loss_pct: number
  devices_below_threshold: number
  priority_distribution: { priority_level: number; label: string; count: number }[]
}
export interface QoSLatencyTrend { hour: string; zone_name: string; avg_latency: number }
export interface QoSByZone {
  zone_name: string; zone_type: string
  avg_latency: number; avg_packet_loss: number; avg_qos_score: number; avg_bandwidth: number
}
export interface DegradationEvent {
  worker_name: string; device_id: string; zone_name: string
  timestamp: string; qos_score: number; latency_ms: number; packet_loss_pct: number
}

export const fetchQoSOverview       = () => api.get<QoSOverview>('/api/qos/overview').then(r => r.data)
export const fetchQoSLatencyTrend   = () => api.get<QoSLatencyTrend[]>('/api/qos/latency-trend').then(r => r.data)
export const fetchQoSByZone         = () => api.get<QoSByZone[]>('/api/qos/by-zone').then(r => r.data)
export const fetchDegradationEvents = () => api.get<DegradationEvent[]>('/api/qos/degradation-events').then(r => r.data)

// ── Location ─────────────────────────────────────────────────────────────────
export interface ZoneOccupancy {
  zone_name: string; zone_type: string; worker_count: number
  workers: { name: string; device_id: string }[]
}
export interface OccupancyTrend  { hour: string; zone_name: string; worker_count: number }
export interface DwellTime       { zone_name: string; avg_dwell_minutes: number; total_visits: number }
export interface ZoneTransition  { from_zone: string; to_zone: string; count: number }

export const fetchCurrentOccupancy  = () => api.get<ZoneOccupancy[]>('/api/location/current-occupancy').then(r => r.data)
export const fetchOccupancyTrend    = () => api.get<OccupancyTrend[]>('/api/location/occupancy-trend').then(r => r.data)
export const fetchDwellTime         = () => api.get<DwellTime[]>('/api/location/dwell-time').then(r => r.data)
export const fetchZoneTransitions   = () => api.get<ZoneTransition[]>('/api/location/transitions').then(r => r.data)

// ── GeoFence ─────────────────────────────────────────────────────────────────
export interface GeoFenceOverview {
  alerts_today: number; active_violations: number
  total_events_7days: number; compliance_rate: number
}
export interface GeoFenceEventItem {
  worker_name: string; zone_name: string; rule_type: string; alert_level: string
  event_type: string; timestamp: string; duration_seconds: number | null; resolved: boolean
}
export interface GeoFenceByZone   { zone_name: string; rule_type: string; alert_level: string; alert_count: number }
export interface WorkerCompliance {
  worker_name: string; group_name: string; compliance_pct: number; violation_count: number
}

export const fetchGeoFenceOverview  = () => api.get<GeoFenceOverview>('/api/geofence/overview').then(r => r.data)
export const fetchGeoFenceEvents    = () => api.get<GeoFenceEventItem[]>('/api/geofence/events').then(r => r.data)
export const fetchGeoFenceByZone    = () => api.get<GeoFenceByZone[]>('/api/geofence/by-zone').then(r => r.data)
export const fetchWorkerCompliance  = () => api.get<WorkerCompliance[]>('/api/geofence/compliance').then(r => r.data)

// ── Location extensions ───────────────────────────────────────────────────────
export interface WorkerListItem  { id: number; name: string; device_id: string; group_name: string }
export interface TrailStep       { zone_name: string; timestamp: string }
export interface DwellAnomaly    { worker_name: string; zone_name: string; zone_type: string; dwell_hours: number; since: string; is_restricted: boolean }
export interface WorkerJourney {
  worker_id: number; worker_name: string; device_id: string; role: string; group_name: string
  current_zone: string; current_zone_type: string
  recent_path: { zone_name: string; zone_type: string; timestamp: string }[]
  dwell_summary: { zone_name: string; hours: number }[]
  breach_count: number; open_breaches: number; compliance_pct: number
}

export const fetchWorkersList     = () => api.get<WorkerListItem[]>('/api/location/workers-list').then(r => r.data)
export const fetchMovementTrail   = (id: number) => api.get<TrailStep[]>(`/api/location/movement-trail/${id}`).then(r => r.data)
export const fetchDwellAnomalies  = () => api.get<DwellAnomaly[]>('/api/location/dwell-anomalies').then(r => r.data)
export const fetchWorkerJourney   = (id: number) => api.get<WorkerJourney>(`/api/location/worker-journey/${id}`).then(r => r.data)
