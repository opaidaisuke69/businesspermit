import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar, Animated, Dimensions, Modal,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/constants/theme'
import api from '@/lib/api'

const { width: W } = Dimensions.get('window')

export default function VerifyEmail() {
  const { email, method } = useLocalSearchParams<{ email: string; method: string }>()
  const insets = useSafeAreaInsets()

  const [otp, setOtp]           = useState(['', '', '', '', '', ''])
  const [loading, setLoading]   = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [countdown, setCountdown] = useState(60)
  const inputs = useRef<(TextInput | null)[]>([])
  const successAnim  = useRef(new Animated.Value(0)).current
  const checkScale   = useRef(new Animated.Value(0)).current
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    startCountdown()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startCountdown = () => {
    setCountdown(60)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0 }
        return c - 1
      })
    }, 1000)
  }

  const handleOtpChange = (val: string, idx: number) => {
    if (!/^\d*$/.test(val)) return
    const next = [...otp]
    next[idx] = val.slice(-1)
    setOtp(next)
    setError('')
    if (val && idx < 5) inputs.current[idx + 1]?.focus()
    if (!val && idx > 0) inputs.current[idx - 1]?.focus()
    // Auto-submit when all 6 filled
    if (val && idx === 5 && next.every(d => d)) {
      verifyCode(next.join(''))
    }
  }

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus()
    }
  }

  const verifyCode = async (code?: string) => {
    const finalCode = code ?? otp.join('')
    if (finalCode.length < 6) { setError('Enter all 6 digits'); return }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/verify-email-code', { email, otp: finalCode })
      // Show success modal with animation
      setSuccess(true)
      Animated.sequence([
        Animated.spring(successAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.delay(300),
        Animated.spring(checkScale,  { toValue: 1, tension: 100, friction: 6, useNativeDriver: true }),
      ]).start()
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Invalid code. Please try again.')
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } finally { setLoading(false) }
  }

  const resend = async () => {
    if (countdown > 0) return
    setResending(true)
    setError('')
    try {
      await api.post('/auth/send-verification', { email, method: method ?? 'code' })
      startCountdown()
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to resend')
    } finally { setResending(false) }
  }

  if (method === 'link') {
    return (
      <View style={[st.root, { paddingTop: insets.top + 20 }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <View style={st.linkCard}>
          <Text style={st.linkIcon}>📧</Text>
          <Text style={st.linkTitle}>Check Your Email</Text>
          <Text style={st.linkMsg}>
            {'We sent a verification link to\n'}
            <Text style={st.linkEmail}>{email}</Text>
          </Text>
          <Text style={st.linkSub}>Click the link in the email to verify your account, then come back to sign in.</Text>
          <TouchableOpacity style={st.backBtn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={st.backBtnText}>← Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView contentContainerStyle={[st.scroll, { paddingTop: insets.top + 20 }]} keyboardShouldPersistTaps="handled">

        {/* Back */}
        <TouchableOpacity style={st.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
          <Text style={st.backText}>Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={st.header}>
          <View style={st.iconCircle}>
            <Ionicons name="mail-open-outline" size={32} color={Colors.emerald} />
          </View>
          <Text style={st.title}>Verify Your Email</Text>
          <Text style={st.sub}>Enter the 6-digit code sent to</Text>
          <Text style={st.emailText}>{email}</Text>
        </View>

        {/* Success overlay */}
        <View style={st.card}>
          {!!error && (
            <View style={st.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
              <Text style={st.errorText}>{error}</Text>
            </View>
          )}

          {/* OTP inputs */}
          <Text style={st.otpLabel}>Verification Code</Text>
          <View style={st.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={r => { inputs.current[i] = r }}
                  style={[st.otpInput, digit && st.otpInputFilled, error && !digit && st.otpInputErr]}
                  value={digit}
                  onChangeText={v => handleOtpChange(v, i)}
                  onKeyPress={e => handleKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  editable={!loading}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[st.verifyBtn, (loading || otp.some(d => !d)) && st.verifyBtnOff]}
              onPress={() => verifyCode()}
              disabled={loading || otp.some(d => !d)}
              activeOpacity={0.85}
            >
              {loading
                ? <><ActivityIndicator color="#fff" size="small" /><Text style={[st.verifyBtnText, { marginLeft: 8 }]}>Verifying...</Text></>
                : <Text style={st.verifyBtnText}>Verify Email →</Text>
              }
            </TouchableOpacity>

            {/* Resend */}
            <View style={st.resendRow}>
              <Text style={st.resendLabel}>Didn't receive it? </Text>
              <TouchableOpacity onPress={resend} disabled={countdown > 0 || resending}>
                {resending
                  ? <ActivityIndicator size="small" color={Colors.accent} />
                  : <Text style={[st.resendBtn, countdown > 0 && st.resendBtnOff]}>
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
      </ScrollView>

      {/* ── Account Created Success Modal ── */}
      <Modal visible={success} transparent animationType="none" statusBarTranslucent>
        <View style={st.modalBackdrop}>
          <Animated.View style={[st.modalCard, { opacity: successAnim, transform: [{ scale: successAnim }] }]}>
            {/* Animated check circle */}
            <Animated.View style={[st.checkCircle, { transform: [{ scale: checkScale }] }]}>
              <View style={st.checkRing} />
              <Ionicons name="checkmark" size={44} color="#fff" />
            </Animated.View>

            <Text style={st.modalTitle}>Account Created!</Text>
            <Text style={st.modalSubtitle}>Welcome to LCC BPA</Text>
            <Text style={st.modalBody}>
              {'Your email has been verified and your account is ready.\nPlease wait for admin verification before applying for a permit.'}
            </Text>

            <View style={st.modalChips}>
              <View style={st.modalChip}>
                <Ionicons name="shield-checkmark-outline" size={14} color={Colors.secondary} />
                <Text style={st.modalChipText}>Email verified</Text>
              </View>
              <View style={st.modalChip}>
                <Ionicons name="time-outline" size={14} color={Colors.secondary} />
                <Text style={st.modalChipText}>Admin review pending</Text>
              </View>
            </View>

            <TouchableOpacity style={st.modalBtn} onPress={() => router.replace('/(auth)/login')} activeOpacity={0.85}>
              <Text style={st.modalBtnText}>Go to Login →</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll:       { flexGrow: 1, backgroundColor: Colors.primary, padding: 24 },
  backRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  backText:     { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  header:       { alignItems: 'center', marginBottom: 28 },
  iconCircle:   { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(33,211,117,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: 'rgba(33,211,117,0.3)' },
  title:        { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sub:          { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  emailText:    { fontSize: 14, fontWeight: '700', color: Colors.emerald, marginTop: 2 },
  card:         { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  errorBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  errorText:    { flex: 1, fontSize: 13, color: '#DC2626' },
  otpLabel:     { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  otpRow:       { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 20 },
  otpInput:     { width: (W - 48 - 48 - 50) / 6, height: 56, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.bg, textAlign: 'center', fontSize: 22, fontWeight: '800', color: Colors.text },
  otpInputFilled: { borderColor: Colors.accent, backgroundColor: Colors.accent + '10' },
  otpInputErr:  { borderColor: '#FCA5A5' },
  verifyBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  verifyBtnOff: { opacity: 0.55, shadowOpacity: 0 },
  verifyBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  resendRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  resendLabel:  { fontSize: 13, color: Colors.textMuted },
  resendBtn:    { fontSize: 13, color: Colors.accent, fontWeight: '700' },
  resendBtnOff: { color: Colors.textLight },
  // Success
  successBox:   { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  successIcon:  { fontSize: 52 },
  successText:  { fontSize: 22, fontWeight: '800', color: Colors.text },
  successSub:   { fontSize: 13, color: Colors.textMuted },

  // Modal
  modalBackdrop:{ flex: 1, backgroundColor: 'rgba(7,59,58,0.75)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard:    { backgroundColor: '#fff', borderRadius: 28, padding: 28, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 32, elevation: 16 },
  checkCircle:  { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: Colors.accent, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8 },
  checkRing:    { position: 'absolute', width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: Colors.emerald, opacity: 0.4 },
  modalTitle:   { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.3, textAlign: 'center' },
  modalSubtitle:{ fontSize: 14, color: Colors.accent, fontWeight: '700', marginTop: 4, marginBottom: 12, textAlign: 'center' },
  modalBody:    { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  modalChips:   { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' },
  modalChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0F7F4', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  modalChipText:{ fontSize: 12, color: Colors.secondary, fontWeight: '600' },
  modalBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Link method
  linkCard:     { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', gap: 10, width: '100%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  linkIcon:     { fontSize: 52 },
  linkTitle:    { fontSize: 22, fontWeight: '800', color: Colors.text },
  linkMsg:      { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  linkEmail:    { color: Colors.primary, fontWeight: '700' },
  linkSub:      { fontSize: 12, color: Colors.textLight, textAlign: 'center', lineHeight: 17 },
  backBtn:      { marginTop: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  backBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
})
