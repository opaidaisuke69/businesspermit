import { useEffect, useState, useCallback } from 'react'
import api from '../lib/api'
import { useDebounce } from '../hooks/useDebounce'
import { TableSkeleton } from '../components/Skeleton'
import { StatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'
import toast from 'react-hot-toast'
import { MagnifyingGlassIcon, CheckCircleIcon, XCircleIcon, EyeIcon } from '@heroicons/react/24/outline'

export default function Applications() {
  const [apps, setApps]           = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [status, setStatus]       = useState('')
  const [page, setPage]           = useState(1)
  const [selected, setSelected]   = useState(null)
  const [rejectModal, setRejectModal]   = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const debouncedSearch = useDebounce(search)

  const fetchApps = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/applications', { params: { search: debouncedSearch, status, page, limit: 15 } })
      setApps(data.data)
      setTotal(data.total)
    } finally { setLoading(false) }
  }, [debouncedSearch, status, page])

  useEffect(() => { fetchApps() }, [fetchApps])

  // Approve application — peddler will be notified to pay
  const approve = async (id) => {
    try {
      const { data } = await api.post(`/applications/${id}/approve`)
      toast.success(data.message ?? 'Application approved')
      fetchApps()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to approve')
    }
  }

  const reject = async () => {
    try {
      await api.post(`/applications/${rejectModal}/reject`, { reason: rejectReason })
      toast.success('Application rejected')
      setRejectModal(null); setRejectReason('')
      fetchApps()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed')
    }
  }

  const viewDetails = async (app) => {
    const { data } = await api.get(`/applications/${app.id}`)
    setSelected(data)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: '#073B3A' }}>Applications</h2>
        <span className="text-sm" style={{ color: '#4A7A72' }}>{total} total</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search application no., business or applicant..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#073B3A]" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#073B3A]">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100" style={{ backgroundColor: '#F0F7F4' }}>
              <tr>
                {['App No.','Applicant','Business','Type','Status','Payment','Date','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A7A72' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="p-4"><TableSkeleton rows={5} cols={8} /></td></tr>
              ) : apps.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm" style={{ color: '#8AADA8' }}>No applications found</td></tr>
              ) : apps.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#4A7A72' }}>{a.application_number}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: '#073B3A' }}>{a.applicant_name}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{a.business_name}</td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-xs bg-gray-100 px-2 py-0.5 rounded font-medium">{a.type}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3">
                    {a.payment_status
                      ? <StatusBadge status={a.payment_status} />
                      : <span className="text-xs text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8AADA8' }}>
                    {new Date(a.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => viewDetails(a)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="View Details">
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      {['pending','under_review'].includes(a.status) && (
                        <>
                          <button onClick={() => approve(a.id)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Approve">
                            <CheckCircleIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => setRejectModal(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Reject">
                            <XCircleIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">Page {page} of {Math.ceil(total / 15) || 1}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Application Details" size="lg">
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Info label="App No."    value={<span className="font-mono font-semibold">{selected.application_number}</span>} />
              <Info label="Status"     value={<StatusBadge status={selected.status} />} />
              <Info label="Applicant"  value={selected.applicant_name} />
              <Info label="Email"      value={selected.applicant_email} />
              <Info label="Business"   value={selected.business_name} />
              <Info label="Type"       value={<span className="capitalize">{selected.type}</span>} />
              <Info label="Products"   value={selected.products_sold || '—'} />
              <Info label="Location"   value={selected.location_name || '—'} />
              <Info label="Employees"  value={selected.num_employees ?? '—'} />
              <Info label="Papag"      value={selected.num_papag ?? '—'} />
              <Info label="Payment"    value={<StatusBadge status={selected.payment_status ?? 'none'} />} />
              <Info label="Permit"     value={selected.permit_number || '—'} />
            </div>
            {selected.rejection_reason && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <span className="text-red-700 font-semibold">Rejection Reason: </span>
                <span className="text-red-600">{selected.rejection_reason}</span>
              </div>
            )}
            {selected.documents?.length > 0 && (
              <div>
                <div className="font-semibold text-gray-700 mb-2">Documents</div>
                <div className="space-y-1">
                  {selected.documents.map(d => (
                    <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:underline text-xs">
                      📎 {d.document_type}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {/* Approve / Reject from modal */}
            {['pending','under_review'].includes(selected.status) && (
              <div className="flex gap-3 pt-2 border-t">
                <button onClick={() => { approve(selected.id); setSelected(null) }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: '#08A045' }}>
                  ✓ Approve Application
                </button>
                <button onClick={() => { setRejectModal(selected.id); setSelected(null) }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600">
                  ✕ Reject Application
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Application" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">The peddler will be notified and can resubmit a new application.</p>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 h-24 resize-none" />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={reject} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Reject</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#4A7A72' }}>{label}</div>
      <div className="font-medium text-gray-800">{value}</div>
    </div>
  )
}
