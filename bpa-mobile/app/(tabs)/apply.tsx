import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Animated, Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { useAuth } from '@/context/AuthContext'
import { Colors } from '@/constants/theme'
import api from '@/lib/api'
import { storage } from '@/lib/storage'
import { PayMongoService } from '@/lib/paymongo'
import { WebView } from 'react-native-webview'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.8.148/lccsystem/bpa-backend/api'

interface Location { id: number; name: string; slot_number: string; status: string }

const STATUS_META: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  pending:      { color: '#D97706', bg: '#FEF3C7', icon: 'time-outline',             label: 'Pending Review' },
  under_review: { color: '#2563EB', bg: '#DBEAFE', icon: 'search-outline',           label: 'Under Review' },
  approved:     { color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle-outline', label: 'Approved' },
  rejected:     { color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline',     label: 'Rejected' },
}

const PAY_METHOD_OPTIONS = [
  { v: 'cash',  label: 'Cash',  icon: 'cash-outline' },
  { v: 'check', label: 'Check', icon: 'document-text-outline' },
  { v: 'qrph',  label: 'QR Ph', icon: 'qr-code-outline' },
]

function FadeIn({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const anim  = useRef(new Animated.Value(0)).current
  const slide = useRef(new Animated.Value(20)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim,  { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 380, delay, useNativeDriver: true }),
    ]).start()
  }, [])
  return <Animated.View style={{ opacity: anim, transform: [{ translateY: slide }] }}>{children}</Animated.View>
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionHeaderText}>{title}</Text>
    </View>
  )
}

function FormField({
  label, value, onChangeText, placeholder, keyboardType, editable = true,
}: {
  label: string; value: string; onChangeText?: (v: string) => void;
  placeholder?: string; keyboardType?: any; editable?: boolean;
}) {
  return (
    <View style={s.formField}>
      <Text style={s.formFieldLabel}>{label}</Text>
      <TextInput
        style={[s.formFieldInput, !editable && s.formFieldInputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ''}
        placeholderTextColor={Colors.textLight}
        keyboardType={keyboardType ?? 'default'}
        editable={editable}
      />
    </View>
  )
}

function ToggleGroup({
  label, options, value, onChange,
}: {
  label: string; options: { v: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={s.formField}>
      <Text style={s.formFieldLabel}>{label}</Text>
      <View style={s.toggleRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.v}
            style={[s.toggleBtn, value === opt.v && s.toggleBtnOn]}
            onPress={() => onChange(opt.v)}
            activeOpacity={0.8}
          >
            <Text style={[s.toggleBtnText, value === opt.v && s.toggleBtnTextOn]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

export default function Apply() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [locations, setLocations]     = useState<Location[]>([])
  const [loading, setLoading]         = useState(false)
  const [existingApp, setExistingApp] = useState<any>(null)
  const [checking, setChecking]       = useState(true)
  // Renewal state
  const [eligiblePermits, setEligiblePermits] = useState<any[]>([])
  const [selectedPermit, setSelectedPermit]   = useState<any>(null)
  const [hasActivePermit, setHasActivePermit] = useState(false)
  // Payment submission state
  const [payMethod, setPayMethod]     = useState('cash')
  const [payLoading, setPayLoading]   = useState(false)
  const [feeBreakdown, setFeeBreakdown] = useState<any[]>([])
  const [feeTotal, setFeeTotal]       = useState(0)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Payment result modals
  const [paySuccessModal, setPaySuccessModal] = useState(false)
  const [payFailedModal, setPayFailedModal]   = useState(false)
  const [payFailReason, setPayFailReason]     = useState('')

  // In-app WebView gateway
  const [webViewUrl, setWebViewUrl]           = useState<string | null>(null)
  const [webViewIntentId, setWebViewIntentId] = useState<string | null>(null)

  const today   = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const taxYear = new Date().getFullYear()

  // API form fields
  const [form, setForm] = useState({
    business_name:         '',
    business_type:         'Peddlers',
    products_sold:         '',
    type:                  'new',
    preferred_location_id: '',
  })

  // Display-only fields — prefilled from user profile
  const [gender, setGender] = useState(user?.gender ?? 'male')
  const civilStatusDisplay = user?.civil_status
    ? user.civil_status.charAt(0).toUpperCase() + user.civil_status.slice(1)
    : ''
  const [civilStatus, setCivilStatus]           = useState(civilStatusDisplay)
  const [age, setAge]                           = useState(user?.age ? String(user.age) : '')
  const [telNo, setTelNo]                       = useState((user as any)?.phone ?? '')
  const [ctcNo, setCtcNo]                       = useState(user?.ctc_number ?? '')
  const [lastName, setLastName]                 = useState((user as any)?.last_name ?? '')
  const [firstName, setFirstName]               = useState((user as any)?.first_name ?? '')
  const [middleName, setMiddleName]             = useState(user?.middle_name ?? '')
  const [address, setAddress]                   = useState(user?.address ?? '')
  const [numEmployees, setNumEmployees]         = useState(user?.num_employees ? String(user.num_employees) : '')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [emergencyTel, setEmergencyTel]         = useState('')
  const [numPapag, setNumPapag]                 = useState('')
  const [rulesAccepted, setRulesAccepted]       = useState(false)
  const [rulesModalOpen, setRulesModalOpen]     = useState(false)

  // Sync prefill fields when user data loads
  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name ?? '')
    setMiddleName(user.middle_name ?? '')
    setLastName(user.last_name ?? '')
    setTelNo((user as any).phone ?? '')
    setAddress(user.address ?? '')
    setAge(user.age ? String(user.age) : '')
    setCtcNo(user.ctc_number ?? '')
    setNumEmployees(user.num_employees ? String(user.num_employees) : '')
    if (user.gender) setGender(user.gender as 'male' | 'female' | 'other')
    if (user.civil_status) {
      setCivilStatus(user.civil_status.charAt(0).toUpperCase() + user.civil_status.slice(1))
    }
  }, [user])

  const fetchData = async (silent = false) => {
    try {
      const [locRes, appRes, renewalRes, permitsRes] = await Promise.all([
        api.get('/locations', { params: { status: 'available' } }),
        api.get('/applications'),
        api.get('/renewals/check-eligibility').catch(() => ({ data: { eligible_permits: [] } })),
        api.get('/permits').catch(() => ({ data: { data: [] } })),
      ])
      setLocations(locRes.data.data ?? [])
      
      // Get all active (non-revoked) permit application IDs
      const activePermitAppIds = (permitsRes.data.data ?? [])
        .filter((p: any) => p.status === 'active')
        .map((p: any) => p.application_id)
      
      // Show any non-cancelled application that:
      // 1. Is pending/under_review/approved AND
      // 2. Either has unverified payment OR has active permits (not revoked)
      const active = appRes.data.data?.find((a: any) => {
        if (!['pending', 'under_review', 'approved'].includes(a.status)) return false
        
        // If payment not verified yet, show the application
        if (a.payment_status !== 'verified') return true
        
        // If payment verified, only show if permits are still active (not revoked)
        return activePermitAppIds.includes(a.id)
      })
      
      setExistingApp(active ?? null)
      setEligiblePermits(renewalRes.data.eligible_permits ?? [])
      
      // Check if user has any active (non-revoked) permits that are not expiring soon
      const activePermits = (permitsRes.data.data ?? []).filter((p: any) => p.status === 'active')
      // Only block if they have active permits AND no eligible renewals
      setHasActivePermit(activePermits.length > 0 && renewalRes.data.eligible_permits?.length === 0)
    } catch {}
    finally { if (!silent) setChecking(false) }
  }

  useEffect(() => {
    fetchData(false)
    pollRef.current = setInterval(() => fetchData(true), 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])
  useEffect(() => {
    if (!existingApp || existingApp.status !== 'approved') return
    const n = Math.max(1, parseInt(existingApp.num_papag, 10) || 1)
    api.get('/payments/fees-preview', { params: { num_papag: n } })
      .then(r => { setFeeBreakdown(r.data.breakdown ?? []); setFeeTotal(r.data.total ?? 0) })
      .catch(() => {})
  }, [existingApp?.id, existingApp?.status])

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  // Handle renewal permit selection
  const handlePermitSelect = (permit: any) => {
    setSelectedPermit(permit)
    setForm(f => ({
      ...f,
      business_name: permit.business_name,
      business_type: permit.business_type,
      products_sold: permit.products_sold,
      preferred_location_id: permit.preferred_location_id ? String(permit.preferred_location_id) : '',
    }))
  }

  // Handle application type change
  const handleTypeChange = (type: string) => {
    set('type')(type)
    if (type === 'new') {
      // Clear renewal data
      setSelectedPermit(null)
      setForm(f => ({
        ...f,
        business_name: '',
        business_type: 'Peddlers',
        products_sold: '',
      }))
    }
  }

  // Submit application only — no payment
  const handleSubmit = async () => {
    if (!form.business_name.trim()) { Alert.alert('Required', 'Registered Business Name is required'); return }
    if (form.type === 'renewal' && !selectedPermit) { Alert.alert('Required', 'Please select a permit to renew'); return }
    if (!rulesAccepted) { Alert.alert('Required', 'You must read and accept the Agora Market rules before submitting.'); return }
    setLoading(true)
    try {
      if (form.type === 'renewal') {
        // Use renewal endpoint
        const payload = {
          permit_id: selectedPermit.id,
          business_name: form.business_name,
          business_type: form.business_type,
          products_sold: form.products_sold,
          preferred_location_id: form.preferred_location_id || null,
          num_papag: numPapag ? parseInt(numPapag, 10) : 0,
          num_employees: numEmployees ? parseInt(numEmployees, 10) : 0,
        }
        const { data } = await api.post('/renewals/create', payload)
        Alert.alert(
          'Renewal Submitted!',
          `Renewal application ${data.application_number} has been submitted for review. You will be notified once it is approved.`,
          [{ text: 'OK', onPress: () => fetchData(false) }]
        )
      } else {
        // Use regular application endpoint
        const payload = {
          ...form,
          num_employees: numEmployees ? parseInt(numEmployees, 10) : 0,
          num_papag:     numPapag     ? parseInt(numPapag, 10)     : 0,
        }
        const { data } = await api.post('/applications', payload)
        Alert.alert(
          'Application Submitted!',
          `Application ${data.application_number} has been submitted for review. You will be notified once it is approved.`,
          [{ text: 'OK', onPress: () => fetchData(false) }]
        )
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'Submission failed')
    } finally { setLoading(false) }
  }

  // Cash / check — just record the payment, admin verifies manually
  const handleCashPayment = async () => {
    if (!existingApp) return
    setPayLoading(true)
    try {
      const { data } = await api.post('/payments', {
        application_id:      existingApp.id,
        payment_method_type: payMethod,
      })
      Alert.alert(
        'Payment Submitted!',
        `Your payment of ₱${parseFloat(data.amount).toLocaleString()} via ${payMethod.toUpperCase()} has been submitted. Proceed to Cashier Office to pay.`,
        [{ text: 'OK', onPress: () => fetchData(false) }]
      )
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error ?? 'Payment submission failed')
    } finally { setPayLoading(false) }
  }

  // QR Ph — create payment link and show checkout in WebView
  const handleOnlinePayment = async () => {
    if (!existingApp) return
    setPayLoading(true)
    try {
      const { checkoutUrl, linkId } = await PayMongoService.createPaymentLink(existingApp.id)

      if (!checkoutUrl) {
        setPayFailReason('Could not get payment URL. Please try again.')
        setPayFailedModal(true)
        return
      }

      setPayLoading(false)
      setWebViewIntentId(linkId)
      setWebViewUrl(checkoutUrl)
    } catch (err: any) {
      setPayLoading(false)
      setPayFailReason(err?.response?.data?.error ?? err.message ?? 'An unexpected error occurred. Please try again.')
      setPayFailedModal(true)
    }
  }

  const handleWebViewClose = () => {
    const linkId = webViewIntentId
    setWebViewUrl(null)
    if (!linkId || !existingApp) return

    PayMongoService.checkPaymentLinkStatus(linkId, existingApp.id)
      .then(status => {
        setWebViewIntentId(null)
        if (status === 'paid') {
          setPaySuccessModal(true)
          fetchData(false)
        } else {
          setPayFailReason(`Payment not completed (status: ${status}). If you already paid, please wait a moment.`)
          setPayFailedModal(true)
        }
      })
      .catch(() => {
        setWebViewIntentId(null)
        setPayFailReason('Could not verify payment. Please contact support if you were charged.')
        setPayFailedModal(true)
      })
  }

  const handleWebViewNavigationChange = (navState: any) => {
    const url: string = navState.url ?? ''
    if (url.includes('paymongo-return') || url === 'about:blank') {
      const linkId = webViewIntentId
      if (linkId && existingApp) {
        setWebViewUrl(null)
        setWebViewIntentId(null)
        PayMongoService.checkPaymentLinkStatus(linkId, existingApp.id)
          .then(status => {
            if (status === 'paid') { setPaySuccessModal(true); fetchData(false) }
            else { setPayFailReason(`Payment status: ${status}.`); setPayFailedModal(true) }
          })
          .catch(() => { setPayFailReason('Could not verify payment.'); setPayFailedModal(true) })
      }
    }
  }

  // Download official receipt PDF
  const downloadReceipt = async (paymentId: number) => {
    setReceiptLoading(true)
    try {
      const token = await storage.getItem('lcc_token')
      const res   = await fetch(`${API_URL}/payments/${paymentId}/receipt?token=${token ?? ''}&source=mobile`)
      const html  = await res.text()
      const { uri } = await Print.printToFileAsync({ html, base64: false })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or Share Official Receipt',
          UTI: 'com.adobe.pdf',
        })
      } else {
        Alert.alert('Receipt Saved', `Saved to: ${uri}`)
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to generate receipt')
    } finally { setReceiptLoading(false) }
  }

  const ScreenHeader = () => (
    <View style={[s.screenHeader, { paddingTop: insets.top + 12 }]}>
      <View>
        <Text style={s.screenHeaderTitle}>Apply for Permit</Text>
        <Text style={s.screenHeaderSub}>Submit your business permit application</Text>
      </View>
      <View style={s.screenHeaderBadge}>
        <Ionicons name="document-text" size={20} color="#fff" />
      </View>
    </View>
  )

  if (!user || (user as any).verification_status !== 'verified') {
    return (
      <View style={s.root}>
        <ScreenHeader />
        <FadeIn>
          <View style={s.lockedCard}>
            <View style={s.lockedIcon}>
              <Ionicons name="lock-closed" size={32} color={Colors.textMuted} />
            </View>
            <Text style={s.lockedTitle}>Account Not Verified</Text>
            <Text style={s.lockedMsg}>Your account must be verified by the admin before you can apply for a business permit.</Text>
            <View style={s.lockedBadge}>
              <Ionicons name="time-outline" size={14} color="#D97706" />
              <Text style={s.lockedBadgeText}>Verification pending</Text>
            </View>
          </View>
        </FadeIn>
      </View>
    )
  }

  if (checking) return (
    <View style={s.root}>
      <ScreenHeader />
      <ActivityIndicator style={{ flex: 1 }} color={Colors.accent} />
    </View>
  )

  // ── User has active permit (not expiring soon) ──────────────
  if (hasActivePermit && !existingApp && eligiblePermits.length === 0) {
    return (
      <View style={s.root}>
        <ScreenHeader />
        <FadeIn>
          <View style={s.activePermitCard}>
            <View style={s.activePermitIcon}>
              <Ionicons name="shield-checkmark" size={48} color={Colors.accent} />
            </View>
            <Text style={s.activePermitTitle}>You Have an Active Permit</Text>
            <Text style={s.activePermitMsg}>
              Your business permit is currently active and valid. You can apply for renewal when your permit is within 2 months of expiration.
            </Text>
            <View style={s.activePermitBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={s.activePermitBadgeText}>Permit Active</Text>
            </View>
            <Text style={s.activePermitHint}>
              View your permits in the Profile tab
            </Text>
          </View>
        </FadeIn>
      </View>
    )
  }

  // ── Active application status view ──────────────────────────
  if (existingApp) {
    const meta = STATUS_META[existingApp.status] ?? STATUS_META.pending
    const isApproved = existingApp.status === 'approved'
    const hasPendingPayment = existingApp.payment_status === 'pending'
    const paymentRejected   = existingApp.payment_status === 'rejected'
    const paymentVerified   = existingApp.payment_status === 'verified'

    return (
      <View style={s.root}>
        <ScreenHeader />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          
          {/* Renewal Banner - show even with existing app if permits are issued */}
          {eligiblePermits.length > 0 && paymentVerified && (
            <FadeIn>
              <View style={s.renewalBanner}>
                <View style={s.renewalBannerIcon}>
                  <Ionicons name="refresh-circle" size={28} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.renewalBannerTitle}>Permit Renewal Available</Text>
                  <Text style={s.renewalBannerMsg}>
                    You have {eligiblePermits.length} permit{eligiblePermits.length > 1 ? 's' : ''} expiring soon. Complete this application first, then you can renew.
                  </Text>
                </View>
              </View>
            </FadeIn>
          )}

          <FadeIn>
            <View style={s.existingHeader}>
              <Text style={s.existingHeaderTitle}>Active Application</Text>
              <Text style={s.existingHeaderSub}>You have an ongoing application</Text>
            </View>
          </FadeIn>

          <FadeIn delay={80}>
            <View style={s.existingCard}>
              {/* Status banner */}
              <View style={[s.existingStatusBanner, { backgroundColor: meta.bg }]}>
                <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                <Text style={[s.existingStatusText, { color: meta.color }]}>{meta.label}</Text>
              </View>

              {/* App details */}
              {[
                { label: 'Application No.', value: existingApp.application_number, mono: true },
                { label: 'Business Name',   value: existingApp.business_name },
                { label: 'Type',            value: existingApp.type === 'new' ? 'New Application' : 'Renewal' },
                { label: 'Submitted',       value: new Date(existingApp.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) },
              ].map(r => (
                <View key={r.label} style={s.existingRow}>
                  <Text style={s.existingRowLabel}>{r.label}</Text>
                  <Text style={[s.existingRowValue, r.mono && { fontFamily: 'monospace' }]}>{r.value}</Text>
                </View>
              ))}

              {/* Rejection reason */}
              {existingApp.rejection_reason && (
                <View style={s.rejectionBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                  <Text style={s.rejectionText}>{existingApp.rejection_reason}</Text>
                </View>
              )}
            </View>
          </FadeIn>

          {/* ── PAYMENT SECTION (only when approved) ── */}
          {isApproved && !paymentVerified && (
            <FadeIn delay={160}>
              <View style={s.payCard}>
                <View style={s.payCardHeader}>
                  <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
                  <Text style={s.payCardTitle}>
                    {hasPendingPayment ? 'Payment Pending Verification' : paymentRejected ? 'Resubmit Payment' : 'Submit Payment'}
                  </Text>
                </View>

                {hasPendingPayment ? (
                  <View style={s.payPendingBox}>
                    <Ionicons name="time-outline" size={28} color="#D97706" />
                    <Text style={s.payPendingTitle}>Awaiting Admin Verification</Text>
                    <Text style={s.payPendingMsg}>Your payment has been submitted and is being reviewed by the admin.</Text>
                  </View>
                ) : (
                  <>
                    {paymentRejected && existingApp.payment_rejection_reason && (
                      <View style={s.rejectionBox}>
                        <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                        <Text style={s.rejectionText}>Payment rejected: {existingApp.payment_rejection_reason}</Text>
                      </View>
                    )}

                    {/* Fee breakdown */}
                    <Text style={s.payBreakdownTitle}>Fee Breakdown</Text>
                    {feeBreakdown.map((f: any) => (
                      <View key={f.key} style={s.feeRow}>
                        <Text style={s.feeRowLabel}>{f.label}{f.qty ? ` (×${f.qty})` : ''}</Text>
                        <Text style={s.feeRowAmt}>₱{parseFloat(f.amount).toLocaleString()}</Text>
                      </View>
                    ))}
                    <View style={s.feeTotalRow}>
                      <Text style={s.feeTotalLabel}>TOTAL</Text>
                      <Text style={s.feeTotalAmt}>₱{feeTotal.toLocaleString()}</Text>
                    </View>

                    {/* Payment method */}
                    <Text style={[s.payBreakdownTitle, { marginTop: 16 }]}>Payment Method</Text>
                    <View style={s.payMethodRow}>
                      {PAY_METHOD_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.v}
                          style={[s.payMethodBtn, payMethod === opt.v && s.payMethodBtnOn]}
                          onPress={() => setPayMethod(opt.v)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={opt.icon as any} size={20} color={payMethod === opt.v ? '#fff' : Colors.textMuted} />
                          <Text style={[s.payMethodText, payMethod === opt.v && s.payMethodTextOn]}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={[s.paySubmitBtn, payLoading && s.submitBtnOff]}
                      onPress={() => {
                        if (payMethod === 'qrph') {
                          handleOnlinePayment()
                        } else {
                          handleCashPayment()
                        }
                      }}
                      disabled={payLoading}
                      activeOpacity={0.85}
                    >
                      {payLoading
                        ? <><ActivityIndicator color="#fff" size="small" /><Text style={[s.submitBtnText, { marginLeft: 8 }]}>Processing...</Text></>
                        : <><Ionicons name={payMethod === 'qrph' ? 'qr-code-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
                             <Text style={s.submitBtnText}>
                               {payMethod === 'qrph' ? 'Pay with QR Ph' : 'Submit Payment'}
                             </Text></>
                      }
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </FadeIn>
          )}

          {/* Permits issued */}
          {paymentVerified && (
            <FadeIn delay={160}>
              <View style={s.permitsIssuedBox}>
                <Ionicons name="ribbon" size={32} color={Colors.accent} />
                <Text style={s.permitsIssuedTitle}>Permits Issued!</Text>
                <Text style={s.permitsIssuedMsg}>Your permits are ready. Go to Profile → My Permits to download them.</Text>
                <TouchableOpacity
                  style={[s.receiptBtn, receiptLoading && { opacity: 0.6 }]}
                  onPress={() => downloadReceipt(existingApp.payment_id)}
                  disabled={receiptLoading}
                  activeOpacity={0.8}
                >
                  {receiptLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><Ionicons name="receipt-outline" size={16} color="#fff" />
                       <Text style={s.receiptBtnText}>Download Official Receipt</Text></>
                  }
                </TouchableOpacity>
              </View>
            </FadeIn>
          )}
        </ScrollView>

        {/* ── In-App Payment Gateway (WebView) ── */}
        <Modal visible={!!webViewUrl} animationType="slide" onRequestClose={handleWebViewClose}>
          <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={s.webViewHeader}>
              <TouchableOpacity onPress={handleWebViewClose} style={s.webViewCloseBtn}>
                <Ionicons name="close" size={24} color="#073B3A" />
              </TouchableOpacity>
              <Text style={s.webViewTitle}>Secure Payment</Text>
              <View style={s.webViewLock}>
                <Ionicons name="lock-closed" size={14} color="#059669" />
              </View>
            </View>
            {webViewUrl && (
              <WebView
                source={{ uri: webViewUrl }}
                onNavigationStateChange={handleWebViewNavigationChange}
                startInLoadingState
                renderLoading={() => (
                  <View style={s.webViewLoading}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={s.webViewLoadingText}>Loading payment gateway...</Text>
                  </View>
                )}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="always"
              />
            )}
          </View>
        </Modal>

        {/* ── Payment Success Modal ── */}
        <Modal visible={paySuccessModal} transparent animationType="fade" onRequestClose={() => setPaySuccessModal(false)}>
          <View style={s.resultBackdrop}>
            <View style={s.resultModal}>
              <View style={s.resultIconCircle}>
                <Ionicons name="checkmark-circle" size={56} color="#059669" />
              </View>
              <Text style={s.resultTitle}>Payment Successful!</Text>
              <Text style={s.resultMsg}>
                Your payment has been processed successfully.{'\n'}Your permit will be issued shortly.
              </Text>
              <TouchableOpacity
                style={[s.resultBtn, { backgroundColor: '#059669' }]}
                onPress={() => { setPaySuccessModal(false); fetchData(false) }}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-outline" size={18} color="#fff" />
                <Text style={s.resultBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Payment Failed Modal ── */}
        <Modal visible={payFailedModal} transparent animationType="fade" onRequestClose={() => setPayFailedModal(false)}>
          <View style={s.resultBackdrop}>
            <View style={s.resultModal}>
              <View style={[s.resultIconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="close-circle" size={56} color="#DC2626" />
              </View>
              <Text style={[s.resultTitle, { color: '#DC2626' }]}>Payment Failed</Text>
              <Text style={s.resultMsg}>{payFailReason || 'Something went wrong. Please try again.'}</Text>
              <TouchableOpacity
                style={[s.resultBtn, { backgroundColor: '#DC2626' }]}
                onPress={() => setPayFailedModal(false)}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh-outline" size={18} color="#fff" />
                <Text style={s.resultBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    )
  }

  return (
    <View style={s.root}>
      <ScreenHeader />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Renewal Eligibility Banner */}
        {eligiblePermits.length > 0 && !existingApp && (
          <FadeIn>
            <View style={s.renewalBanner}>
              <View style={s.renewalBannerIcon}>
                <Ionicons name="refresh-circle" size={28} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.renewalBannerTitle}>Permit Renewal Available</Text>
                <Text style={s.renewalBannerMsg}>
                  You have {eligiblePermits.length} permit{eligiblePermits.length > 1 ? 's' : ''} expiring soon.
                </Text>
              </View>
              <TouchableOpacity
                style={s.renewalBannerBtn}
                onPress={() => {
                  // Auto-select first eligible permit and set to renewal mode
                  if (eligiblePermits.length > 0) {
                    const permit = eligiblePermits[0]
                    setSelectedPermit(permit)
                    setForm({
                      business_name: permit.business_name,
                      business_type: permit.business_type,
                      products_sold: permit.products_sold,
                      type: 'renewal',
                      preferred_location_id: '',
                    })
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={s.renewalBannerBtnText}>Renew</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </FadeIn>
        )}

        <View style={s.docCard}>

          {/* Title */}
          <View style={s.docTitleBlock}>
            <Text style={s.docTitle}>APPLICATION FORM FOR</Text>
            <Text style={s.docTitleMain}>MARKET PEDDLER'S PERMIT</Text>
            <Text style={s.docTaxYear}>TAX YEAR {taxYear}</Text>
            <Text style={s.docCity}>LA CARLOTA CITY</Text>
          </View>

          {/* Instructions */}
          <Text style={s.docInstructions}>
            Provide accurate information and print legibly to avoid delays. Incomplete application form will be returned. Ensure that all documents attached to this form (if any) are complete and properly filled out.
          </Text>

          {/* ── SECTION 1: BASIC INFORMATION ── */}
          <SectionHeader title="APPLICANT SECTION : BASIC INFORMATION" />

          {/* Application Type - read-only if renewal selected */}
          <View style={s.formField}>
            <Text style={s.formFieldLabel}>APPLICATION TYPE</Text>
            <View style={s.toggleRow}>
              {[{ v: 'new', label: 'NEW' }, { v: 'renewal', label: 'RENEWAL' }].map(opt => (
                <TouchableOpacity
                  key={opt.v}
                  style={[s.toggleBtn, form.type === opt.v && s.toggleBtnOn, selectedPermit && s.toggleBtnDisabled]}
                  onPress={() => {
                    if (!selectedPermit) {
                      handleTypeChange(opt.v)
                    }
                  }}
                  activeOpacity={selectedPermit ? 1 : 0.8}
                  disabled={!!selectedPermit}
                >
                  <Text style={[s.toggleBtnText, form.type === opt.v && s.toggleBtnTextOn]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedPermit && (
              <Text style={s.renewalHint}>
                <Ionicons name="information-circle" size={12} color={Colors.primary} /> Renewing permit {selectedPermit.permit_number}
              </Text>
            )}
          </View>

          {/* Permit Selector (only for renewal) */}
          {form.type === 'renewal' && (
            <View style={s.formField}>
              <View style={s.permitSelectorHeader}>
                <Text style={s.formFieldLabel}>SELECT PERMIT TO RENEW *</Text>
                {selectedPermit && (
                  <TouchableOpacity
                    style={s.clearRenewalBtn}
                    onPress={() => {
                      setSelectedPermit(null)
                      setForm({
                        business_name: '',
                        business_type: 'Peddlers',
                        products_sold: '',
                        type: 'new',
                        preferred_location_id: '',
                      })
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                    <Text style={s.clearRenewalText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              {eligiblePermits.length === 0 ? (
                <View style={s.noPermitsBox}>
                  <Ionicons name="alert-circle-outline" size={20} color="#D97706" />
                  <Text style={s.noPermitsText}>No permits eligible for renewal at this time.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4, marginBottom: 8 }}>
                  {eligiblePermits.map(p => {
                    const expiryDate = new Date(p.expiry_date)
                    const daysLeft = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    const isSelected = selectedPermit?.id === p.id
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[s.permitCard, isSelected && s.permitCardOn]}
                        onPress={() => handlePermitSelect(p)}
                        activeOpacity={0.8}
                      >
                        <View style={s.permitCardHeader}>
                          <Ionicons name="document-text" size={16} color={isSelected ? '#fff' : Colors.primary} />
                          <Text style={[s.permitCardNum, isSelected && s.permitCardNumOn]}>{p.permit_number}</Text>
                        </View>
                        <Text style={[s.permitCardBiz, isSelected && s.permitCardBizOn]} numberOfLines={1}>{p.business_name}</Text>
                        <View style={[s.permitCardExpiry, isSelected && s.permitCardExpiryOn]}>
                          <Ionicons name="time-outline" size={12} color={isSelected ? '#fff' : '#D97706'} />
                          <Text style={[s.permitCardExpiryText, isSelected && s.permitCardExpiryTextOn]}>
                            Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={s.permitCardCheck}>
                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {/* Gender — read-only, prefilled from profile */}
          <View style={s.formField}>
            <Text style={s.formFieldLabel}>GENDER</Text>
            <View style={s.readOnlyToggleRow}>
              {(['male','female','other'] as const).map(g => (
                <View
                  key={g}
                  style={[s.readOnlyToggleBtn, gender === g && s.readOnlyToggleBtnOn]}
                >
                  <Text style={[s.readOnlyToggleText, gender === g && s.readOnlyToggleTextOn]}>
                    {g === 'male' ? 'MALE' : g === 'female' ? 'FEMALE' : 'OTHER'}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={s.twoCol}>
            <View style={[s.formField, { flex: 1, marginRight: 8 }]}>
              <Text style={s.formFieldLabel}>AGE</Text>
              <TextInput
                style={[s.formFieldInput, s.formFieldInputDisabled]}
                value={age}
                editable={false}
                placeholderTextColor={Colors.textLight}
                keyboardType="numeric"
              />
            </View>
            <View style={[s.formField, { flex: 2 }]}>
              <Text style={s.formFieldLabel}>CIVIL STATUS</Text>
              <TextInput
                style={[s.formFieldInput, s.formFieldInputDisabled]}
                value={civilStatus}
                editable={false}
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>

          <View style={s.twoCol}>
            <View style={[s.formField, { flex: 1, marginRight: 8 }]}>
              <Text style={s.formFieldLabel}>TEL NO. / MOB NO.</Text>
              <TextInput
                style={[s.formFieldInput, s.formFieldInputDisabled]}
                value={telNo}
                editable={false}
                placeholderTextColor={Colors.textLight}
                keyboardType="phone-pad"
              />
            </View>
            <View style={[s.formField, { flex: 1 }]}>
              <Text style={s.formFieldLabel}>CTC NO.</Text>
              <TextInput
                style={s.formFieldInput}
                value={ctcNo}
                onChangeText={setCtcNo}
                placeholder="CTC number"
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>

          <FormField label="DATE OF APPLICATION" value={today} editable={false} />

          {/* ── SECTION 2: NAME OF TAXPAYER ── */}
          <SectionHeader title="NAME OF TAXPAYER / REGISTRANT" />

          <View style={s.threeCol}>
            <View style={[s.formField, { flex: 1, marginRight: 6 }]}>
              <Text style={s.formFieldLabel}>LAST NAME</Text>
              <TextInput style={[s.formFieldInput, s.formFieldInputDisabled]} value={lastName}
                editable={false} placeholderTextColor={Colors.textLight} />
            </View>
            <View style={[s.formField, { flex: 1, marginRight: 6 }]}>
              <Text style={s.formFieldLabel}>FIRST NAME</Text>
              <TextInput style={[s.formFieldInput, s.formFieldInputDisabled]} value={firstName}
                editable={false} placeholderTextColor={Colors.textLight} />
            </View>
            <View style={[s.formField, { flex: 1 }]}>
              <Text style={s.formFieldLabel}>MIDDLE NAME</Text>
              <TextInput style={[s.formFieldInput, s.formFieldInputDisabled]} value={middleName}
                editable={false} placeholderTextColor={Colors.textLight} />
            </View>
          </View>

          {/* ── SECTION 3: ADDRESS ── */}
          <SectionHeader title="ADDRESS" />
          <FormField label="COMPLETE ADDRESS" value={address} editable={false} />

          {/* ── SECTION 4: BUSINESS INFORMATION ── */}
          <SectionHeader title="BUSINESS INFORMATION" />

          <View style={s.formField}>
            <Text style={s.formFieldLabel}>REGISTERED BUSINESS NAME *</Text>
            <TextInput
              style={[s.formFieldInput, selectedPermit && s.formFieldInputDisabled]}
              value={form.business_name}
              onChangeText={set('business_name')}
              placeholder="e.g. Juan's Sari-Sari Store"
              placeholderTextColor={Colors.textLight}
              editable={!selectedPermit}
            />
            {selectedPermit && (
              <Text style={s.readOnlyHint}>
                <Ionicons name="lock-closed" size={10} color={Colors.textMuted} /> From existing permit
              </Text>
            )}
          </View>

          <View style={s.formField}>
            <Text style={s.formFieldLabel}>NATURE OF BUSINESS</Text>
            <TextInput
              style={[s.formFieldInput, selectedPermit && s.formFieldInputDisabled]}
              value={form.products_sold}
              onChangeText={set('products_sold')}
              placeholder="e.g. Vegetables, Cooked Food, Clothing"
              placeholderTextColor={Colors.textLight}
              editable={!selectedPermit}
            />
            {selectedPermit && (
              <Text style={s.readOnlyHint}>
                <Ionicons name="lock-closed" size={10} color={Colors.textMuted} /> From existing permit
              </Text>
            )}
          </View>

          {/* ── SECTION 5: BUSINESS ADDRESS / LOCATION ── */}
          <SectionHeader title="BUSINESS ADDRESS / LOCATION" />

          <View style={s.formField}>
            <Text style={s.formFieldLabel}>SELECT VENDING LOCATION</Text>
            {selectedPermit ? (
              <View style={s.lockedLocationBox}>
                <Ionicons name="location" size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={s.lockedLocationText}>
                    {form.preferred_location_id 
                      ? locations.find(l => String(l.id) === form.preferred_location_id)?.name || 'Same as previous'
                      : 'Same as previous location'}
                  </Text>
                  <Text style={s.lockedLocationHint}>
                    <Ionicons name="lock-closed" size={10} color={Colors.textMuted} /> Location locked for renewal
                  </Text>
                </View>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4, marginBottom: 8 }}>
                <TouchableOpacity
                  style={[s.locChip, !form.preferred_location_id && s.locChipOn]}
                  onPress={() => set('preferred_location_id')('')}
                >
                  <Text style={[s.locChipText, !form.preferred_location_id && s.locChipTextOn]}>None</Text>
                </TouchableOpacity>
                {locations.map(l => (
                  <TouchableOpacity key={l.id}
                    style={[s.locChip, form.preferred_location_id === String(l.id) && s.locChipOn]}
                    onPress={() => set('preferred_location_id')(String(l.id))}
                  >
                    <Text style={[s.locChipText, form.preferred_location_id === String(l.id) && s.locChipTextOn]}>
                      {l.slot_number} — {l.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* ── SECTION 6: ADDITIONAL DETAILS ── */}
          <SectionHeader title="ADDITIONAL DETAILS" />

          <View style={s.twoCol}>
            <View style={[s.formField, { flex: 1, marginRight: 8 }]}>
              <Text style={s.formFieldLabel}>TYPE OF BUSINESS</Text>
              <TextInput style={[s.formFieldInput, s.formFieldInputDisabled]} value={form.business_type}
                editable={false} placeholderTextColor={Colors.textLight} />
            </View>
            <View style={[s.formField, { flex: 1 }]}>
              <Text style={s.formFieldLabel}>NO. OF EMPLOYEES</Text>
              <TextInput style={s.formFieldInput} value={numEmployees}
                onChangeText={setNumEmployees} placeholder="0"
                placeholderTextColor={Colors.textLight} keyboardType="numeric" />
            </View>
          </View>

          <FormField label="NO. OF PAPAG / LAG-IT" value={numPapag}
            onChangeText={setNumPapag} placeholder="e.g. 1" keyboardType="numeric" />

          {/* ── SECTION 7: EMERGENCY CONTACT ── */}
          <SectionHeader title="IN CASE OF EMERGENCY" />

          <FormField label="CONTACT PERSON" value={emergencyContact}
            onChangeText={setEmergencyContact} placeholder="Full name of contact person" />

          <FormField label="MOBILE NO." value={emergencyTel}
            onChangeText={setEmergencyTel} placeholder="09XX-XXX-XXXX" keyboardType="phone-pad" />

          {/* Rules checkbox */}
          <View style={s.rulesRow}>
            <TouchableOpacity
              style={[s.checkbox, rulesAccepted && s.checkboxOn]}
              onPress={() => setRulesAccepted(v => !v)}
              activeOpacity={0.8}
            >
              {rulesAccepted && <Text style={s.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={s.rulesText}>
              I have read and agree to the{' '}
              <Text style={s.rulesLink} onPress={() => setRulesModalOpen(true)}>
                Agora Market Rules
              </Text>
            </Text>
          </View>

          {/* Rules Modal */}
          <Modal visible={rulesModalOpen} animationType="slide" transparent onRequestClose={() => setRulesModalOpen(false)}>
            <View style={s.modalBackdrop}>
              <View style={s.modalSheet}>
                <View style={s.modalHandle} />
                <Text style={s.modalTitle}>PAGSULUNDAN (RULES)</Text>
                <Text style={s.modalSubtitle}>
                  Ang Tag dumala sang Merkado Publiko naga paihibalo sa tanan nga Bulantero sang mga PAGSULUNDAN:
                </Text>
                <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
                  {[
                    'Pagsunod sa oras sang Pagbaligya (3:00 a.m. to 3:00 p.m.)',
                    'Pagsunod sang sakto nga Papag suno sa Takos (3 x 6 ft.)',
                    'Pag gamit sang sakto nga Papag suno sa gin Bayaran mo.',
                    'Pag Baligya sang Insakto nga Pruducto ukon Serbisyo suno sa gin Gawad mo nga Permit.',
                    'Indi puide nga ipahulam O ihatag O Pa Arkilahan ang imo puwesto.',
                    'Pag mintinar sang katinlo sa lugar Okun puwesto.',
                    'Pag butang sa (2) ka klase nga basura-han (Madunot kag Indi Madunot)',
                    'Regular nga bulantihan ukon baligyaan ang Imo puwesto kada sabado.',
                    '(3) ka sunod-sunod nga Sabado nga indi mo ma Baligyaan ang imo puwesto gina tagaan mo sang diretso ang management sang Merkado Publiko sa pag bawi sang imo puwesto.',
                    'May kahigayunan ikaw sa pag Presentar sang imo balido nga rason sa tag dumalahan sa sulod sang (1) ka Semana.',
                    'Indi puide ang Pag panigarilyo, Pag panahor, Pag Inom sang Makahulubog nga ilimnon, Pag uba Panapton kag Pag Luto sa imo puwesto.',
                    'Pagabutangan mo sang PRICE TAG ang mga Pruducto nga gina baligya mo.',
                    'Sa Papag gid lamang puide ka Baligya Indi sa dalan kag indi puide ilibud ang baligya O Pruducto.',
                    'Maga sunod ikaw sa Regulasyon kag Polisiya sang AGORA PUBLIC MARKET KAG SYUDAD.',
                    'Pag Bayad sang Insakto nga Kantidad sa Arkabala O Cash Ticket.',
                    'Indi puide mag hatag sang Suhol O Regalo sa Empleyado sang Merkado Publiko. (puide gid marebokar ang imo Permit sa pagbaligya.)',
                    'NO USE OF SINGLE-USE PLASTIC (City Ordinance No. 2022 - 006)',
                  ].map((rule, i) => (
                    <View key={i} style={s.ruleItem}>
                      <Text style={s.ruleNum}>{i + 1}.</Text>
                      <Text style={s.ruleText}>{rule}</Text>
                    </View>
                  ))}
                  <Text style={s.rulesFooter}>AGORA MANAGEMENT</Text>
                </ScrollView>
                <TouchableOpacity
                  style={s.modalAcceptBtn}
                  onPress={() => { setRulesAccepted(true); setRulesModalOpen(false) }}
                >
                  <Text style={s.modalAcceptText}>✓ I Understand & Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalCloseBtn} onPress={() => setRulesModalOpen(false)}>
                  <Text style={s.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Submit Application */}
          <TouchableOpacity style={[s.submitBtn, loading && s.submitBtnOff]}
            onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <><ActivityIndicator color="#fff" size="small" /><Text style={[s.submitBtnText, { marginLeft: 8 }]}>Submitting...</Text></>
              : <><Ionicons name="send-outline" size={18} color="#fff" /><Text style={s.submitBtnText}>Submit Application</Text></>
            }
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* ── In-App Payment Gateway (WebView) ── */}
      <Modal visible={!!webViewUrl} animationType="slide" onRequestClose={handleWebViewClose}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={s.webViewHeader}>
            <TouchableOpacity onPress={handleWebViewClose} style={s.webViewCloseBtn}>
              <Ionicons name="close" size={24} color="#073B3A" />
            </TouchableOpacity>
            <Text style={s.webViewTitle}>Secure Payment</Text>
            <View style={s.webViewLock}>
              <Ionicons name="lock-closed" size={14} color="#059669" />
            </View>
          </View>
          {webViewUrl && (
            <WebView
              source={{ uri: webViewUrl }}
              onNavigationStateChange={handleWebViewNavigationChange}
              startInLoadingState
              renderLoading={() => (
                <View style={s.webViewLoading}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={s.webViewLoadingText}>Loading payment gateway...</Text>
                </View>
              )}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
            />
          )}
        </View>
      </Modal>

      {/* ── Payment Success Modal ── */}
      <Modal visible={paySuccessModal} transparent animationType="fade" onRequestClose={() => setPaySuccessModal(false)}>
        <View style={s.resultBackdrop}>
          <View style={s.resultModal}>
            <View style={s.resultIconCircle}>
              <Ionicons name="checkmark-circle" size={56} color="#059669" />
            </View>
            <Text style={s.resultTitle}>Payment Successful!</Text>
            <Text style={s.resultMsg}>
              Your payment has been processed successfully.{'\n'}Your permit will be issued shortly.
            </Text>
            <TouchableOpacity
              style={[s.resultBtn, { backgroundColor: '#059669' }]}
              onPress={() => { setPaySuccessModal(false); fetchData(false) }}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-outline" size={18} color="#fff" />
              <Text style={s.resultBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Payment Failed Modal ── */}
      <Modal visible={payFailedModal} transparent animationType="fade" onRequestClose={() => setPayFailedModal(false)}>
        <View style={s.resultBackdrop}>
          <View style={s.resultModal}>
            <View style={[s.resultIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="close-circle" size={56} color="#DC2626" />
            </View>
            <Text style={[s.resultTitle, { color: '#DC2626' }]}>Payment Failed</Text>
            <Text style={s.resultMsg}>{payFailReason || 'Something went wrong. Please try again.'}</Text>
            <TouchableOpacity
              style={[s.resultBtn, { backgroundColor: '#DC2626' }]}
              onPress={() => setPayFailedModal(false)}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh-outline" size={18} color="#fff" />
              <Text style={s.resultBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  screenHeader: {
    backgroundColor: Colors.primary, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  screenHeaderTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  screenHeaderSub:   { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  screenHeaderBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  docCard: {
    backgroundColor: '#fff', margin: 14, borderRadius: 4,
    borderWidth: 1, borderColor: '#C8D8D5', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },

  docTitleBlock: {
    alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16,
    borderBottomWidth: 2, borderBottomColor: Colors.primary, backgroundColor: '#fff',
  },
  docTitle:     { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  docTitleMain: { fontSize: 16, fontWeight: '900', color: Colors.primary, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center', marginTop: 2 },
  docTaxYear:   { fontSize: 12, fontWeight: '700', color: Colors.secondary, marginTop: 6, letterSpacing: 1 },
  docCity:      { fontSize: 11, color: Colors.textMuted, letterSpacing: 1.2, marginTop: 2, textTransform: 'uppercase' },

  docInstructions: {
    fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', lineHeight: 17,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: '#FAFCFB',
  },

  sectionHeader: {
    backgroundColor: Colors.bg, borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 7, marginTop: 4,
  },
  sectionHeaderText: { fontSize: 10, fontWeight: '800', color: Colors.primary, letterSpacing: 1.4, textTransform: 'uppercase' },

  formField:             { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 },
  formFieldLabel:        { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  formFieldInput:        { fontSize: 14, color: Colors.text, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 6, paddingHorizontal: 0 },
  formFieldInputDisabled:{ color: Colors.textMuted },

  twoCol:   { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12 },
  threeCol: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12 },

  toggleRow:       { flexDirection: 'row', gap: 8, marginTop: 2, marginBottom: 4 },
  toggleBtn:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff' },
  toggleBtnOn:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleBtnText:   { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8 },
  toggleBtnTextOn: { color: '#fff' },

  // Read-only gender display
  readOnlyToggleRow:    { flexDirection: 'row', gap: 8, marginTop: 2, marginBottom: 4 },
  readOnlyToggleBtn:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg, opacity: 0.6 },
  readOnlyToggleBtnOn:  { backgroundColor: Colors.primary, borderColor: Colors.primary, opacity: 1 },
  readOnlyToggleText:   { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8 },
  readOnlyToggleTextOn: { color: '#fff' },

  locChip:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 4, borderWidth: 1, borderColor: Colors.border, marginRight: 8, backgroundColor: '#fff' },
  locChipOn:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  locChipText:   { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  locChipTextOn: { color: '#fff' },

  // Locked location for renewal
  lockedLocationBox:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bg, borderRadius: 8, padding: 12, marginTop: 4, borderWidth: 1, borderColor: Colors.border },
  lockedLocationText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  lockedLocationHint: { fontSize: 10, color: Colors.textMuted, marginTop: 2, fontStyle: 'italic' },

  feeRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  feeRowLabel:     { fontSize: 12, color: Colors.textMuted },
  feeRowAmt:       { fontSize: 12, fontWeight: '600', color: Colors.text },
  feeTotalRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.primary },
  feeTotalLabel:   { fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  feeTotalAmt:     { fontSize: 14, fontWeight: '900', color: '#fff' },

  submitBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, marginHorizontal: 16, marginBottom: 20, borderRadius: 6, paddingVertical: 15, shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  submitBtnOff:  { opacity: 0.6, shadowOpacity: 0 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },

  // Locked
  lockedCard:      { margin: 24, backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  lockedIcon:      { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  lockedTitle:     { fontSize: 18, fontWeight: '800', color: Colors.text },
  lockedMsg:       { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  lockedBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  lockedBadgeText: { fontSize: 12, color: '#D97706', fontWeight: '600' },

  // Active permit (not expiring)
  activePermitCard:      { margin: 24, backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  activePermitIcon:      { width: 88, height: 88, borderRadius: 44, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  activePermitTitle:     { fontSize: 18, fontWeight: '800', color: Colors.text },
  activePermitMsg:       { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  activePermitBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8 },
  activePermitBadgeText: { fontSize: 13, color: '#059669', fontWeight: '700' },
  activePermitHint:      { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', marginTop: 8 },

  // Existing app
  existingHeader:     { marginBottom: 12 },
  existingHeaderTitle:{ fontSize: 18, fontWeight: '800', color: Colors.text },
  existingHeaderSub:  { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  existingCard:       { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  existingStatusBanner:{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  existingStatusText: { fontSize: 14, fontWeight: '700' },
  existingRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  existingRowLabel:   { fontSize: 12, color: Colors.textMuted },
  existingRowValue:   { fontSize: 13, fontWeight: '600', color: Colors.text, maxWidth: '60%', textAlign: 'right' },
  rejectionBox:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF2F2', margin: 12, borderRadius: 10, padding: 12 },
  rejectionText:      { flex: 1, fontSize: 12, color: '#DC2626', lineHeight: 18 },

  // Payment card
  payCard:            { backgroundColor: '#fff', borderRadius: 16, marginTop: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  payCardHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  payCardTitle:       { fontSize: 15, fontWeight: '700', color: Colors.text },
  payPendingBox:      { alignItems: 'center', padding: 24, gap: 8 },
  payPendingTitle:    { fontSize: 15, fontWeight: '700', color: '#D97706' },
  payPendingMsg:      { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  payBreakdownTitle:  { fontSize: 10, fontWeight: '800', color: Colors.primary, letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  payMethodRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  payMethodBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#fff' },
  payMethodBtnOn:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  payMethodText:      { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  payMethodTextOn:    { color: '#fff' },
  paySubmitBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, margin: 16, borderRadius: 10, paddingVertical: 14, shadowColor: Colors.accent, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },

  // Permits issued
  permitsIssuedBox:   { backgroundColor: '#D1FAE5', borderRadius: 16, marginTop: 14, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#6EE7B7' },
  permitsIssuedTitle: { fontSize: 16, fontWeight: '800', color: '#065F46' },
  permitsIssuedMsg:   { fontSize: 13, color: '#047857', textAlign: 'center', lineHeight: 18 },
  receiptBtn:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, marginTop: 4, shadowColor: Colors.primary, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 },
  receiptBtnText:     { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Rules modal
  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '85%' },
  modalHandle:     { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:      { fontSize: 16, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  modalSubtitle:   { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: 14, lineHeight: 17 },
  modalScroll:     { maxHeight: 340 },
  ruleItem:        { flexDirection: 'row', gap: 8, marginBottom: 10 },
  ruleNum:         { fontSize: 12, fontWeight: '700', color: Colors.primary, width: 20 },
  ruleText:        { flex: 1, fontSize: 12, color: Colors.text, lineHeight: 18 },
  rulesFooter:     { fontSize: 12, fontWeight: '700', color: Colors.primary, textAlign: 'center', marginTop: 12, marginBottom: 4 },
  modalAcceptBtn:  { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  modalAcceptText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalCloseBtn:   { alignItems: 'center', marginTop: 10, paddingVertical: 8 },
  modalCloseText:  { fontSize: 13, color: Colors.textMuted },

  // WebView gateway
  webViewHeader:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  webViewCloseBtn:    { padding: 4, marginRight: 12 },
  webViewTitle:       { flex: 1, fontSize: 16, fontWeight: '700', color: '#073B3A' },
  webViewLock:        { padding: 4 },
  webViewLoading:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  webViewLoadingText: { marginTop: 12, fontSize: 14, color: Colors.textMuted },

  // Payment result modals
  resultBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  resultModal:      {
    backgroundColor: '#fff', borderRadius: 24, marginHorizontal: 32,
    padding: 28, alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  resultIconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  resultTitle:   { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  resultMsg:     { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 21 },
  resultBtn:     {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32, marginTop: 4,
  },
  resultBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Rules checkbox
  rulesRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxOn:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark:   { color: '#fff', fontSize: 13, fontWeight: '700' },
  rulesText:   { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 19 },
  rulesLink:   { color: Colors.primary, fontWeight: '700', textDecorationLine: 'underline' },

  // Renewal banner
  renewalBanner:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FEF3C7', marginHorizontal: 14, marginTop: 14, marginBottom: 4, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FCD34D' },
  renewalBannerIcon:  { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  renewalBannerTitle: { fontSize: 14, fontWeight: '800', color: '#92400E', marginBottom: 2 },
  renewalBannerMsg:   { fontSize: 12, color: '#78350F', lineHeight: 17 },
  renewalBannerBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  renewalBannerBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Permit selector
  permitSelectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  clearRenewalBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  clearRenewalText:     { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  noPermitsBox:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 8, padding: 12, marginTop: 4 },
  noPermitsText:        { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },
  permitCard:           { width: 200, backgroundColor: '#fff', borderRadius: 12, borderWidth: 2, borderColor: Colors.border, padding: 12, marginRight: 10, position: 'relative' },
  permitCardOn:         { backgroundColor: Colors.primary, borderColor: Colors.primary },
  permitCardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  permitCardNum:        { fontSize: 11, fontWeight: '700', color: Colors.primary, fontFamily: 'monospace' },
  permitCardNumOn:      { color: '#fff' },
  permitCardBiz:        { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  permitCardBizOn:      { color: '#fff' },
  permitCardExpiry:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  permitCardExpiryOn:   { backgroundColor: 'rgba(255,255,255,0.2)' },
  permitCardExpiryText: { fontSize: 10, fontWeight: '600', color: '#92400E' },
  permitCardExpiryTextOn:{ color: '#fff' },
  permitCardCheck:      { position: 'absolute', top: 8, right: 8 },

  // Read-only hints
  renewalHint:    { fontSize: 11, color: Colors.primary, marginTop: 6, fontStyle: 'italic' },
  readOnlyHint:   { fontSize: 10, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  toggleBtnDisabled: { opacity: 0.6 },
})
