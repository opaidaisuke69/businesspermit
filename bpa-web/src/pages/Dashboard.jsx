import { useEffect, useState, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie } from 'recharts'
import api from '../lib/api'
import { CardSkeleton } from '../components/Skeleton'
import { StatusBadge } from '../components/StatusBadge'

const COLORS = ['#08A045','#EF4444','#F59E0B','#3B82F6','#8B5CF6','#EC4899']

// Status-specific colors for better recognition
const STATUS_COLORS = {
  'approved': '#08A045',    // Green
  'rejected': '#EF4444',    // Red  
  'pending': '#F59E0B',     // Orange
  'submitted': '#3B82F6',   // Blue
  'review': '#8B5CF6',      // Purple
  'cancelled': '#6B7280'    // Gray
}

const ACTION_META = {
  application: { label: 'Application Update',     icon: '📄', color: '#0B6E4F' },
  payment:     { label: 'Payment Update',         icon: '💳', color: '#21D375' },
  permit:      { label: 'Permit Update',          icon: '🏆', color: '#08A045' },
  system:      { label: 'System Notification',    icon: '🔔', color: '#4A7A72' },
}

function getActionMeta(type) {
  return ACTION_META[type] ?? { label: 'Notification', icon: '🔔', color: '#4A7A72' }
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function StatCard({ label, value, sub, icon, accent = '#073B3A' }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ backgroundColor: accent + '18' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#4A7A72' }}>{label}</div>
        <div className="text-2xl font-extrabold" style={{ color: '#073B3A' }}>{value}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: '#8AADA8' }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs]     = useState([])
  const statsRef = useRef(null)

  const fetchStats = async (silent = false) => {
    try {
      const r = await api.get('/dashboard/stats')
      setStats(r.data)
      setLogs(r.data.activity_logs ?? [])
    } catch {}
    finally { if (!silent) setLoading(false) }
  }

  useEffect(() => {
    fetchStats(false)
    // Stats poll every 10s, logs poll every 5s
    statsRef.current = setInterval(() => fetchStats(true), 5000)
    return () => {
      if (statsRef.current) clearInterval(statsRef.current)
    }
  }, [])

  if (loading) return (
    <div>
      <h2 className="text-xl font-bold mb-6" style={{ color: '#073B3A' }}>Dashboard</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array(8).fill(0).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  )

  const pieData = stats?.application_breakdown?.map(r => ({ name: r.status, value: parseInt(r.count) })) ?? []

  // Debug log for pie chart data
  console.log('Pie chart data:', { 
    application_breakdown: stats?.application_breakdown, 
    processed: pieData 
  })

  const revenueData = stats?.monthly_revenue?.map(r => ({
    month: r.month?.slice(5) ?? r.month,
    revenue: parseFloat(r.revenue ?? 0),
  })) ?? []

  // Debug log for revenue data
  console.log('Revenue data:', { 
    monthly_revenue: stats?.monthly_revenue, 
    processed: revenueData,
    total_revenue: stats?.total_revenue 
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: '#073B3A' }}>Dashboard</h2>
        <div className="flex items-center gap-2 text-xs" style={{ color: '#4A7A72' }}>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
          Live · updates every 5s
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="👥" label="Total Peddlers"       value={stats?.total_users ?? 0}        sub={`${stats?.verified_users ?? 0} verified`}    accent="#073B3A" />
        <StatCard icon="⏳" label="Pending Verification"  value={stats?.pending_users ?? 0}       sub="awaiting review"                              accent="#F59E0B" />
        <StatCard icon="📄" label="Applications"          value={stats?.total_applications ?? 0}  sub={`${stats?.pending_apps ?? 0} pending`}        accent="#0B6E4F" />
        <StatCard icon="🏆" label="Active Permits"         value={stats?.total_permits ?? 0}       sub="issued this year"                             accent="#08A045" />
        <StatCard icon="💰" label="Total Revenue"          value={`₱${parseFloat(stats?.total_revenue ?? 0).toLocaleString()}`} sub="all time"       accent="#21D375" />
        <StatCard icon="💳" label="Pending Payments"       value={stats?.pending_payments ?? 0}    sub="awaiting verification"                        accent="#F59E0B" />
        <StatCard icon="✅" label="Available Slots"        value={stats?.available_slots ?? 0}     sub="vendor locations"                             accent="#08A045" />
        <StatCard icon="🔴" label="Occupied Slots"         value={stats?.occupied_slots ?? 0}      sub="currently in use"                             accent="#EF4444" />
      </div>

      {/* Activity Log - Full Width */}
      <div className="mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold" style={{ color: '#073B3A' }}>Activity Log</h3>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            </div>
            <span className="text-xs" style={{ color: '#8AADA8' }}>Actions</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {!logs.length && (
              <div className="px-5 py-8 text-center text-sm" style={{ color: '#8AADA8' }}>No activity yet</div>
            )}
            {logs.map((log, i) => {
              const meta = getActionMeta(log.type)
              return (
                <div key={log.id ?? i} className="px-5 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: meta.color + '15' }}>
                    {meta.icon}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium" style={{ color: '#073B3A' }}>{log.title}</div>
                    <div className="text-sm mt-1" style={{ color: '#8AADA8' }}>{log.message}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {log.admin_name && (
                        <span className="text-xs font-semibold" style={{ color: '#4A7A72' }}>
                          By: {log.admin_name}
                        </span>
                      )}
                      {log.user_name && (
                        <span className="text-xs" style={{ color: '#8AADA8' }}>
                          • For: {log.user_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Time */}
                  <span className="text-sm flex-shrink-0 mt-0.5" style={{ color: '#8AADA8' }}>
                    {timeAgo(log.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold mb-4" style={{ color: '#073B3A' }}>Monthly Revenue</h3>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 11, fill: '#4A7A72' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#4A7A72' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(value) => `₱${value.toLocaleString()}`}
                />
                <Tooltip
                  formatter={(v) => [`₱${parseFloat(v).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ 
                    borderRadius: 8, 
                    border: '1px solid #D1E8E2', 
                    fontSize: 12,
                    backgroundColor: 'white',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar 
                  dataKey="revenue" 
                  fill="#073B3A" 
                  radius={[6,6,0,0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-center">
              <div className="text-sm mb-2" style={{ color: '#8AADA8' }}>
                No monthly data for the last 6 months
              </div>
              {stats?.total_revenue > 0 && (
                <div className="text-lg font-semibold" style={{ color: '#073B3A' }}>
                  Total Revenue: ₱{parseFloat(stats.total_revenue).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Application Breakdown */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold mb-4" style={{ color: '#073B3A' }}>Application Status</h3>
          {pieData.length > 0 ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: STATUS_COLORS[entry.name.toLowerCase()] || COLORS[index % COLORS.length] }}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium capitalize" style={{ color: '#073B3A' }}>
                        {entry.name}
                      </div>
                      <div className="text-lg font-bold" style={{ color: '#073B3A' }}>
                        {entry.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie 
                    data={pieData.map((entry, index) => ({
                      ...entry,
                      fill: STATUS_COLORS[entry.name.toLowerCase()] || COLORS[index % COLORS.length]
                    }))} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={75}
                    innerRadius={25}
                    startAngle={90}
                    endAngle={450}
                    label={({ name, percent, value }) => {
                      // Only show label if slice is big enough to be visible
                      return percent > 0.05 ? `${name} ${(percent*100).toFixed(0)}%` : ''
                    }} 
                    labelLine={false}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: 8, 
                      border: '1px solid #D1E8E2', 
                      fontSize: 12,
                      backgroundColor: 'white',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => [`${value} applications`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Legend */}
              <div className="flex flex-wrap gap-2 mt-3">
                {pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: STATUS_COLORS[entry.name.toLowerCase()] || COLORS[index % COLORS.length] }}
                    />
                    <span className="text-xs" style={{ color: '#4A7A72' }}>
                      {entry.name} ({entry.value})
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm" style={{ color: '#8AADA8' }}>
              No application data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Applications */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: '#073B3A' }}>Recent Applications</h3>
          <a href="/applications" className="text-xs font-medium hover:underline" style={{ color: '#08A045' }}>View all →</a>
        </div>
        <div className="divide-y divide-gray-50">
          {!stats?.recent_applications?.length && (
            <div className="px-5 py-8 text-center text-sm" style={{ color: '#8AADA8' }}>No applications yet</div>
          )}
          {stats?.recent_applications?.map((app, i) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div>
                <div className="text-sm font-semibold" style={{ color: '#073B3A' }}>{app.name}</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: '#8AADA8' }}>{app.application_number}</div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={app.status} />
                <span className="text-xs" style={{ color: '#8AADA8' }}>
                  {new Date(app.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
