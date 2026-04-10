import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
})

export default api

export interface Overview {
  total_calls_today: number
  total_calls_30days: number
  avg_response_time: number
  critical_battery_count: number
  active_workers: number
}

export interface DailyVolume {
  date: string
  day_calls: number
  night_calls: number
}

export interface CallsByGroup {
  group_name: string
  zone: string
  call_count: number
}

export interface CallsByType {
  call_type: string
  count: number
}

export interface TopCommunicator {
  worker_name: string
  group_name: string
  call_count: number
  total_duration: number
}

export interface BatteryDevice {
  worker_name: string
  device_id: string
  battery_level: number
  status: 'critical' | 'low' | 'normal'
  group: string
}

export interface BatteryTrend {
  date: string
  avg_battery: number
}

export interface ResponseTimeTrend {
  date: string
  avg_response_time: number
}

export interface ResponseTimeByGroup {
  group_name: string
  avg_response_time: number
  min_response_time: number
  max_response_time: number
}

export const fetchOverview = () =>
  api.get<Overview>('/api/stats/overview').then(r => r.data)

export const fetchDailyVolume = (days = 30) =>
  api.get<DailyVolume[]>('/api/calls/daily-volume', { params: { days } }).then(r => r.data)

export const fetchCallsByGroup = () =>
  api.get<CallsByGroup[]>('/api/calls/by-group').then(r => r.data)

export const fetchCallsByType = () =>
  api.get<CallsByType[]>('/api/calls/by-type').then(r => r.data)

export const fetchTopCommunicators = () =>
  api.get<TopCommunicator[]>('/api/calls/top-communicators').then(r => r.data)

export const fetchCurrentBattery = () =>
  api.get<BatteryDevice[]>('/api/battery/current').then(r => r.data)

export const fetchBatteryTrend = (days = 7) =>
  api.get<BatteryTrend[]>('/api/battery/trend', { params: { days } }).then(r => r.data)

export const fetchResponseTimeTrend = (days = 14) =>
  api.get<ResponseTimeTrend[]>('/api/response-time/trend', { params: { days } }).then(r => r.data)

export const fetchResponseTimeByGroup = () =>
  api.get<ResponseTimeByGroup[]>('/api/response-time/by-group').then(r => r.data)
