import { useEffect, useState, useCallback, useRef } from 'react'
import api from '../lib/api'
import { TableSkeleton } from '../components/Skeleton'
import { StatusBadge } from '../components/StatusBadge'
import { Modal } from '../components/Modal'
import toast from 'react-hot-toast'
import { CheckCircleIcon, XCircleIcon, MagnifyingGlassIcon, EyeIcon } from '@heroicons/react/24/outline'

const METHOD_LABELS = { cash: 'Cash', check: 'Check', gcash: 'GCash', maya: 'Maya', qrph: 'QRPH', card: 'Card', other: 'Other' }

export default function Payments() {
  const [payments, setPayments]   = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]           = useState(1)
  const [selected, setSelected]   = useState(null)
  const [rejectModal, setRejectModal]   = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const pollRef = useRef(null)

  const fetchPayments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { data } = await api.get('/payments', { params: { search, status: statusFilter, page, limit: 15 } })
      setPayments(data.data ?? [])
      setTotal(data.total ?? 0)
    } catch {}
    finally { if (!silent) setLoading(false) }
  }, [search, statusFilter, page])

  useEffect(() => {
    fetchPayments(false)
    pollRef.current = setInterval(() => fetchPayments(true), 8000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchPayments])

  const approve = async (id) => {
    try {
      const { data } = await api.post(`/payments/${id}/approve`)
      toast.success(`Payment approved! Permits issued: ${data.mayors_permit} & ${data.sanitary_permit}`)
      fetchPayments(false)
      setSelected(null)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to approve')
    }
  }

  const reject = async () => {
    try {
      await api.post(`/payments/${rejectModal}/reject`, { reason: rejectReason })
      toast.success('Payment rejected. Peddler notified.')
      setRejectModal(null); setRejectReason('')
      fetchPayments(false)
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: '#073B3A' }}>Payments</h2>
        <div className="flex items-center gap-2 text-xs" style={{ color: '#4A7A72' }}>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
          Live · {total} total
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by app no. or payer..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#073B3A]" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#073B3A]">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100" style={{ backgroundColor: '#F0F7F4' }}>
              <tr>
                {['App No.','Payer','Amount','Method','Status','Date','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A7A72' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="p-4"><TableSkeleton rows={5} cols={7} /></td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-sm" style={{ color: '#8AADA8' }}>No payments found</td></tr>
              ) : payments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#4A7A72' }}>{p.application_number}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: '#073B3A' }}>{p.payer_name}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: '#08A045' }}>₱{parseFloat(p.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs capitalize" style={{ color: '#4A7A72' }}>
                    {METHOD_LABELS[p.payment_method_type] ?? p.payment_method_type ?? '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#8AADA8' }}>
                    {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelected(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="View Details">
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      {p.status === 'pending' && (
                        <>
                          <button onClick={() => approve(p.id)}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Approve Payment">
                            <CheckCircleIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => setRejectModal(p.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Reject Payment">
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
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Payment Details" size="md">
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Info label="App No."   value={<span className="font-mono font-semibold">{selected.application_number}</span>} />
              <Info label="Status"    value={<StatusBadge status={selected.status} />} />
              <Info label="Payer"     value={selected.payer_name} />
              <Info label="Method"    value={METHOD_LABELS[selected.payment_method_type] ?? selected.payment_method_type ?? '—'} />
              <Info label="Business"  value={selected.business_name} />
              <Info label="Papag"     value={selected.num_papag ?? '—'} />
              <Info label="Total"     value={<span className="font-bold text-green-700">₱{parseFloat(selected.amount).toLocaleString()}</span>} />
              <Info label="Submitted" value={new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })} />
            </div>

            {/* Fee breakdown */}
            {selected.fee_breakdown && (() => {
              let breakdown = selected.fee_breakdown
              if (typeof breakdown === 'string') { try { breakdown = JSON.parse(breakdown) } catch { breakdown = [] } }
              return breakdown?.length > 0 ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A7A72' }}>Fee Breakdown</div>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    {breakdown.map((f, i) => (
                      <div key={i} className="flex justify-between px-3 py-2 text-xs border-b border-gray-50 last:border-0">
                        <span className="text-gray-600">{f.label}{f.qty ? ` (×${f.qty})` : ''}</span>
                        <span className="font-semibold text-gray-800">₱{parseFloat(f.amount).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2.5 font-bold text-xs" style={{ backgroundColor: '#073B3A', color: '#fff' }}>
                      <span>TOTAL</span>
                      <span>₱{parseFloat(selected.amount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : null
            })()}

            {selected.rejection_reason && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700">
                <span className="font-semibold">Rejection Reason: </span>{selected.rejection_reason}
              </div>
            )}

            {selected.status === 'pending' && (
              <div className="flex gap-3 pt-2 border-t">
                <button onClick={() => approve(selected.id)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: '#08A045' }}>
                  ✓ Approve & Issue Permits
                </button>
                <button onClick={() => { setRejectModal(selected.id); setSelected(null) }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600">
                  ✕ Reject Payment
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Payment" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">The peddler will be notified and can resubmit their payment.</p>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (e.g. incorrect amount, invalid reference)..."
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
