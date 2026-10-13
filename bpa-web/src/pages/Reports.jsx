import { useEffect, useState } from 'react'
import api from '../lib/api'
import { Skeleton } from '../components/Skeleton'

export default function Reports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchReports = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/reports/weekly')
      setReports(data.data ?? [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { fetchReports() }, [])

  const generate = async () => {
    setGenerating(true)
    try {
      await api.post('/reports/generate')
      await fetchReports()
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed to generate report')
    } finally { setGenerating(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: '#073B3A' }}>Weekly Reports</h2>
        <button
          onClick={generate}
          disabled={generating}
          className="px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-60 transition-opacity hover:opacity-85"
          style={{ backgroundColor: '#073B3A' }}
        >
          {generating ? 'Generating...' : '+ Generate This Week'}
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <div className="text-4xl mb-3">📊</div>
            <div className="font-semibold mb-1" style={{ color: '#073B3A' }}>No reports yet</div>
            <div className="text-sm" style={{ color: '#8AADA8' }}>Click "Generate This Week" to create your first report.</div>
          </div>
        ) : reports.map(r => (
          <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-bold" style={{ color: '#073B3A' }}>
                  Week of {r.week_start} — {r.week_end}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#8AADA8' }}>
                  Generated: {new Date(r.generated_at).toLocaleString('en-PH')}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Peddlers',   value: r.total_peddlers,                                    icon: '👥', accent: '#073B3A' },
                { label: 'Total Payments',   value: `₱${parseFloat(r.total_payments).toLocaleString()}`, icon: '💰', accent: '#08A045' },
                { label: 'Permits Issued',   value: r.total_permits_issued,                              icon: '🏆', accent: '#0B6E4F' },
                { label: 'Applications',     value: r.total_applications,                                icon: '📄', accent: '#21D375' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: s.accent + '12' }}>
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="text-xl font-extrabold" style={{ color: s.accent }}>{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#4A7A72' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
