import { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/constants/theme'
import api from '@/lib/api'

interface Transaction {
  id: number
  application_number: string
  business_name: string
  amount: string
  payment_method: string
  payment_method_type: string
  status: string
  paid_at: string | null
  created_at: string
  // permit fields (joined)
  mayors_permit_number?: string
  sanitary_permit_number?: string
  or_number?: string
}

const STATUS_META: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  paid:     { color: '#059669', bg: '#D1FAE5', label: 'Paid',     icon: 'checkmark-circle' },
  verified: { color: '#2563EB', bg: '#DBEAFE', label: 'Verified', icon: 'shield-checkmark' },
  pending:  { color: '#D97706', bg: '#FEF3C7', label: 'Pending',  icon: 'time' },
  failed:   { color: '#DC2626', bg: '#FEE2E2', label: 'Failed',   icon: 'close-circle' },
  rejected: { color: '#DC2626', bg: '#FEE2E2', label: 'Rejected', icon: 'close-circle' },
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', check: 'Check', qrph: 'QR Ph', gcash: 'GCash', paymaya: 'PayMaya',
}

function FadeIn({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const anim  = useRef(new Animated.Value(0)).current
  const slide = useRef(new Animated.Value(16)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim,  { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 380, delay, useNativeDriver: true }),
    ]).start()
  }, [])
  return <Animated.View style={{ opacity: anim, transform: [{ translateY: slide }] }}>{children}</Animated.View>
}

function TransactionCard({ tx, index }: { tx: Transaction; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const meta = STATUS_META[tx.status] ?? STATUS_META.pending

  const rows = [
    { label: 'Application No.',    value: tx.application_number },
    { label: 'Business Name',      value: tx.business_name },
    { label: 'Amount',             value: `₱${parseFloat(tx.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
    { label: 'Payment Method',     value: METHOD_LABEL[tx.payment_method_type] ?? tx.payment_method ?? '—' },
    tx.mayors_permit_number  ? { label: "Mayor's Permit No.", value: tx.mayors_permit_number }  : null,
    tx.sanitary_permit_number ? { label: 'Sanitary Permit No.', value: tx.sanitary_permit_number } : null,
    tx.or_number             ? { label: 'OR Number',           value: tx.or_number }             : null,
    { label: 'Date',               value: new Date(tx.paid_at ?? tx.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <FadeIn delay={index * 60}>
      <TouchableOpacity
        style={s.card}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.85}
      >
        {/* Card header */}
        <View style={s.cardHeader}>
          <View style={[s.statusIcon, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={20} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardAppNum}>{tx.application_number}</Text>
            <Text style={s.cardBiz} numberOfLines={1}>{tx.business_name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={s.cardAmount}>₱{parseFloat(tx.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
            <View style={[s.statusPill, { backgroundColor: meta.bg }]}>
              <Text style={[s.statusPillText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.textMuted}
            style={{ marginLeft: 8 }}
          />
        </View>

        {/* Expanded details */}
        {expanded && (
          <View style={s.cardDetails}>
            <View style={s.divider} />
            {rows.map(r => (
              <View key={r.label} style={s.detailRow}>
                <Text style={s.detailLabel}>{r.label}</Text>
                <Text style={s.detailValue}>{r.value}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </FadeIn>
  )
}

export default function Transactions() {
  const insets = useSafeAreaInsets()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)

  const fetchTransactions = async (silent = false) => {
    try {
      const res = await api.get('/payments', { params: { limit: 50 } })
      // Only show paid/verified transactions
      const paid = (res.data.data ?? []).filter((p: Transaction) =>
        ['paid', 'verified'].includes(p.status)
      )
      setTransactions(paid)
    } catch {}
    finally {
      if (!silent) { setLoading(false); setRefreshing(false) }
    }
  }

  useEffect(() => { fetchTransactions(false) }, [])

  const onRefresh = () => { setRefreshing(true); fetchTransactions(false) }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={s.headerTitle}>Transactions</Text>
          <Text style={s.headerSub}>Your payment history</Text>
        </View>
        <View style={s.headerBadge}>
          <Ionicons name="receipt-outline" size={20} color="#fff" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={s.centerText}>Loading transactions...</Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={48} color={Colors.border} />
            <Text style={s.emptyTitle}>No transactions yet</Text>
            <Text style={s.emptyMsg}>Your completed payments will appear here.</Text>
          </View>
        ) : (
          transactions.map((tx, i) => (
            <TransactionCard key={tx.id} tx={tx} index={i} />
          ))
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: Colors.bg },

  header:          { backgroundColor: Colors.primary, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle:     { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub:       { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  headerBadge:     { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  card:            { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  statusIcon:      { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardAppNum:      { fontSize: 10, color: Colors.textMuted, fontFamily: 'monospace', letterSpacing: 0.5 },
  cardBiz:         { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 1 },
  cardAmount:      { fontSize: 15, fontWeight: '800', color: Colors.primary },
  statusPill:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusPillText:  { fontSize: 10, fontWeight: '700' },

  cardDetails:     { paddingHorizontal: 14, paddingBottom: 14 },
  divider:         { height: 1, backgroundColor: Colors.border, marginBottom: 12 },
  detailRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  detailLabel:     { fontSize: 12, color: Colors.textMuted, flex: 1 },
  detailValue:     { fontSize: 12, fontWeight: '600', color: Colors.text, flex: 1, textAlign: 'right' },

  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  centerText:      { fontSize: 14, color: Colors.textMuted },
  empty:           { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle:      { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyMsg:        { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
})
