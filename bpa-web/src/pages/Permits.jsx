import { useEffect, useState, useCallback } from 'react'
import api from '../lib/api'
import { TableSkeleton } from '../components/Skeleton'
import { StatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'
import toast from 'react-hot-toast'
import { ArrowDownTrayIcon, NoSymbolIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useDebounce } from '../hooks/useDebounce'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost/lccsystem/bpa-backend'

export default function Permits() {
  const [permits, setPermits]   = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]         = useState(1)
  const [revokeModal, setRevokeModal]   = useState(null)  // permit object
  const [revokeReason, setRevokeReason] = useState('')
  const debouncedSearch = useDebounce(search)

  const fetchPermits = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/permits', { params: { search: debouncedSearch, status: statusFilter, page, limit: 15 } })
      setPermits(data.data ?? [])
      setTotal(data.total ?? data.data?.length ?? 0)
    } finally { setLoading(false) }
  }, [debouncedSearch, statusFilter, page])

  useEffect(() => { fetchPermits() }, [fetchPermits])

  const downloadMPP = (id) => {
    const token = localStorage.getItem('lcc_token')
    window.open(`${BACKEND_URL}/api/permits/${id}/download/mpp?token=${token}`, '_blank')
  }

  const downloadSP = (id) => {
    const token = localStorage.getItem('lcc_token')
    window.open(`${BACKEND_URL}/api/permits/${id}/download/sp?token=${token}`, '_blank')
  }

  const revoke = async () => {
    if (!revokeModal) return
    try {
      await api.post(`/permits/${revokeModal.id}/revoke`, { reason: revokeReason })
      toast.success('Permit revoked. Location freed and peddler notified.')
      setRevokeModal(null); setRevokeReason('')
      fetchPermits()
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to revoke')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: '#073B3A' }}>Permits</h2>
        <span className="text-sm" style={{ color: '#4A7A72' }}>{total} total</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search permit no. or holder..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#073B3A]" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#073B3A]">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100" style={{ backgroundColor: '#F0F7F4' }}>
              <tr>
                {['Permit No.','Type','Holder','Business','Issued','Expires','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A7A72' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="p-4"><TableSkeleton rows={5} cols={8} /></td></tr>
              ) : permits.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm" style={{ color: '#8AADA8' }}>No permits found</td></tr>
              ) : permits.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${p.status === 'revoked' ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs font-medium" style={{ color: '#4A7A72' }}>{p.permit_number}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                      style={{ backgroundColor: p.permit_type === 'mayors_permit' ? '#EAF4EF' : '#E0F2FE', color: p.permit_type === 'mayors_permit' ? '#073B3A' : '#0369A1' }}>
                      {p.permit_type === 'mayors_permit' ? "Mayor's" : 'Sanitary'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: '#073B3A' }}>{p.holder_name}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{p.business_name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8AADA8' }}>{p.issued_date}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8AADA8' }}>{p.expiry_date}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {p.status !== 'revoked' && (
                        <>
                          <button onClick={() => downloadMPP(p.id)} title="Download Peddlers Permit"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white rounded-lg"
                            style={{ backgroundColor: '#073B3A' }}>
                            <ArrowDownTrayIcon className="w-3.5 h-3.5" /> MPP
                          </button>
                          <button onClick={() => downloadSP(p.id)} title="Download Sanitary Permit"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white rounded-lg"
                            style={{ backgroundColor: '#0B6E4F' }}>
                            <ArrowDownTrayIcon className="w-3.5 h-3.5" /> SP
                          </button>
                          <button onClick={() => { setRevokeModal(p); setRevokeReason('') }}
                            title="Revoke Permit"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white rounded-lg bg-red-600 hover:bg-red-700">
                            <NoSymbolIcon className="w-3.5 h-3.5" /> Revoke
                          </button>
                        </>
                      )}
                      {p.status === 'revoked' && (
                        <span className="text-xs italic" style={{ color: '#8AADA8' }}>Revoked</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">Page {page} of {Math.ceil((total || permits.length) / 15) || 1}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      </div>

      {/* Revoke Modal */}
      <Modal open={!!revokeModal} onClose={() => setRevokeModal(null)} title="Revoke Permit" size="sm">
        <div className="space-y-4">
          {revokeModal && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm">
              <div className="font-semibold text-red-800 mb-1">⚠ This action cannot be undone</div>
              <div className="text-red-700 text-xs space-y-1">
                <div>Permit: <span className="font-mono font-semibold">{revokeModal.permit_number}</span></div>
                <div>Holder: <span className="font-semibold">{revokeModal.holder_name}</span></div>
                <div className="mt-2">The assigned vendor location will be freed and the peddler will be notified. They can apply for a new permit.</div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#4A7A72' }}>
              Reason for Revocation
            </label>
            <textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)}
              placeholder="e.g. Violation of market rules, non-compliance..."
              className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 h-24 resize-none" />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setRevokeModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={revoke} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold">
              Revoke Permit
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
