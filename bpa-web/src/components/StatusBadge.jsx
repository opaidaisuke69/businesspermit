const variants = {
  pending:      'bg-yellow-100 text-yellow-800',
  under_review: 'bg-blue-100 text-blue-800',
  approved:     'bg-green-100 text-green-800',
  rejected:     'bg-red-100 text-red-800',
  cancelled:    'bg-gray-100 text-gray-600',
  verified:     'bg-green-100 text-green-800',
  active:       'bg-green-100 text-green-800',
  expired:      'bg-gray-100 text-gray-600',
  revoked:      'bg-red-100 text-red-800',
  paid:         'bg-green-100 text-green-800',
  failed:       'bg-red-100 text-red-800',
  available:    'bg-emerald-100 text-emerald-800',
  occupied:     'bg-red-100 text-red-800',
  inactive:     'bg-gray-100 text-gray-500',
  confirmed:    'bg-green-100 text-green-800',
  completed:    'bg-blue-100 text-blue-800',
}

export function StatusBadge({ status }) {
  const cls = variants[status] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  )
}
